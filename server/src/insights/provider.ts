import type { Contact, Customer, CustomerInsight, Interaction, Urgency } from '../types.js';

export interface InsightInput {
  customer: Customer;
  contacts: Contact[];
  interactions: Interaction[];
}

/**
 * Strategy interface for insight generation. ClaudeInsightProvider and
 * HeuristicInsightProvider are the two implementations; the route layer never
 * knows which one produced a result beyond the `source` field.
 */
export interface InsightProvider {
  generate(input: InsightInput): Promise<CustomerInsight>;
}

const URGENCIES: Urgency[] = ['high', 'medium', 'low', 'none'];

export interface RawInsight {
  summary?: unknown;
  urgency?: unknown;
  urgency_reason?: unknown;
  cited_interaction_ids?: unknown;
  suggested_action?: unknown;
  action_reason?: unknown;
  action_cited_interaction_ids?: unknown;
}

export interface ValidationResult {
  ok: boolean;
  lowConfidence: boolean;
  insight?: Omit<CustomerInsight, 'source' | 'generated_at' | 'customer_id'> & { low_confidence?: boolean };
  errors: string[];
}

/**
 * Validates a model-produced insight against the customer's real interaction
 * history. Every cited interaction id must exist for this customer — hallucinated
 * ids are stripped; if a claim ends up with no valid citations at all the result
 * is flagged low-confidence so the UI can say so instead of presenting an
 * ungrounded claim as fact.
 */
export function validateInsight(raw: RawInsight, interactions: Interaction[]): ValidationResult {
  const errors: string[] = [];
  const validIds = new Set(interactions.map((i) => i.id));

  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  if (!summary) errors.push('summary missing or empty');

  const urgency = URGENCIES.includes(raw.urgency as Urgency) ? (raw.urgency as Urgency) : null;
  if (!urgency) errors.push(`urgency invalid: ${String(raw.urgency)}`);

  const urgencyReason = typeof raw.urgency_reason === 'string' ? raw.urgency_reason.trim() : '';
  if (!urgencyReason) errors.push('urgency_reason missing or empty');

  const suggestedAction = typeof raw.suggested_action === 'string' ? raw.suggested_action.trim() : '';
  if (!suggestedAction) errors.push('suggested_action missing or empty');

  const actionReason = typeof raw.action_reason === 'string' ? raw.action_reason.trim() : '';
  if (!actionReason) errors.push('action_reason missing or empty');

  const filterIds = (ids: unknown): { kept: string[]; dropped: number } => {
    if (!Array.isArray(ids)) return { kept: [], dropped: 0 };
    const strings = ids.filter((x): x is string => typeof x === 'string');
    const kept = strings.filter((id) => validIds.has(id));
    return { kept, dropped: strings.length - kept.length };
  };

  const urgencyCites = filterIds(raw.cited_interaction_ids);
  const actionCites = filterIds(raw.action_cited_interaction_ids);

  if (errors.length > 0 || !urgency) {
    return { ok: false, lowConfidence: true, errors };
  }

  // Ungrounded = no valid citation survives for either claim. We keep the
  // insight but mark it low-confidence rather than discarding it.
  const lowConfidence =
    urgencyCites.dropped > 0 ||
    actionCites.dropped > 0 ||
    (urgencyCites.kept.length === 0 && actionCites.kept.length === 0 && interactions.length > 0);

  return {
    ok: true,
    lowConfidence,
    errors,
    insight: {
      summary,
      urgency,
      urgency_reason: urgencyReason,
      cited_interaction_ids: urgencyCites.kept,
      suggested_action: suggestedAction,
      action_reason: actionReason,
      action_cited_interaction_ids: actionCites.kept,
      ...(lowConfidence ? { low_confidence: true } : {}),
    },
  };
}
