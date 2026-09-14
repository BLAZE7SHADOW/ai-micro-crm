import { daysSince } from '../config.js';
import type { CustomerInsight, Interaction, Urgency } from '../types.js';
import type { InsightInput, InsightProvider } from './provider.js';

const HOLD_PATTERNS = [/do not push/i, /wait until/i, /no additional follow-?up required/i, /no follow-?up required/i];
const STALL_PATTERNS = [/no response/i, /never scheduled/i, /inactive/i, /follow-?up may be appropriate/i, /no recent engagement/i];
const DEADLINE_PATTERNS = [/before (january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i, /by (january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i, /high-intent/i];
const SATISFIED_PATTERNS = [/appears satisfied/i, /satisfied/i, /feedback is positive/i, /happy/i];

function matching(interactions: Interaction[], patterns: RegExp[]): Interaction[] {
  return interactions.filter((i) => patterns.some((p) => p.test(i.notes)));
}

/**
 * Rule-based fallback used when no API key is configured or the model call
 * fails. Deliberately simple — it exists so the app runs out of the box and to
 * make the case for why the LLM path is meaningfully better (see README).
 */
export class HeuristicInsightProvider implements InsightProvider {
  async generate(input: InsightInput): Promise<CustomerInsight> {
    const { customer, interactions } = input;
    const last = interactions[interactions.length - 1];
    const stale = last ? daysSince(last.occurred_at) : Infinity;

    const holds = matching(interactions, HOLD_PATTERNS);
    const deadlines = matching(interactions, DEADLINE_PATTERNS);
    // A stall signal only counts if the same interaction isn't also a
    // satisfaction signal ("Customer appears satisfied. No recent engagement."
    // is contentment, not a stalled deal).
    const stalls = matching(interactions, STALL_PATTERNS).filter(
      (i) => !SATISFIED_PATTERNS.some((p) => p.test(i.notes))
    );

    let urgency: Urgency;
    let reason: string;
    let action: string;
    let actionReason: string;
    let cited: Interaction[];

    if (holds.length > 0 && deadlines.length === 0) {
      urgency = 'low';
      reason = `A note asks not to push this account right now, so silence here is expected.`;
      action = `Hold off; schedule a light check-in once the hold period passes.`;
      actionReason = `The notes explicitly ask to wait.`;
      cited = holds;
    } else if (deadlines.length > 0) {
      urgency = 'high';
      reason = `The notes reference a time-sensitive commitment or deadline.`;
      action = `Follow up today to confirm the timeline discussed.`;
      actionReason = `A deadline mentioned in the notes may be imminent.`;
      cited = deadlines;
    } else if (stalls.length > 0 && stale > 7) {
      urgency = 'high';
      reason = `The thread went quiet after an open item (${stale} days since last touch).`;
      action = `Send a re-engagement follow-up referencing the last open item.`;
      actionReason = `Notes flag no response and the account has been quiet for ${stale} days.`;
      cited = stalls;
    } else if (stale > 30 && customer.status === 'prospect') {
      urgency = 'medium';
      reason = `Prospect with no contact for ${stale} days.`;
      action = `Reach out with a check-in to revive the conversation.`;
      actionReason = `Long silence on an open prospect risks losing the deal.`;
      cited = last ? [last] : [];
    } else if (stale > 60) {
      urgency = 'low';
      reason = `Customer quiet for ${stale} days with no open issues in the notes.`;
      action = `Consider a routine check-in when convenient.`;
      actionReason = `No open items, but a long gap is worth a light touch.`;
      cited = last ? [last] : [];
    } else {
      urgency = 'none';
      reason = `Recent activity (${stale} days ago) and no open flags in the notes.`;
      action = `No action needed right now.`;
      actionReason = `The account is active and nothing in the notes is pending.`;
      cited = last ? [last] : [];
    }

    const summary = `${customer.name} is a ${customer.status} with ${interactions.length} recorded interaction${
      interactions.length === 1 ? '' : 's'
    }, last touched ${last ? `${stale} days ago (${last.occurred_at})` : 'never'}.`;

    return {
      customer_id: customer.id,
      summary,
      urgency,
      urgency_reason: reason,
      cited_interaction_ids: cited.map((i) => i.id),
      suggested_action: action,
      action_reason: actionReason,
      action_cited_interaction_ids: cited.map((i) => i.id),
      source: 'heuristic',
      generated_at: new Date().toISOString(),
    };
  }
}
