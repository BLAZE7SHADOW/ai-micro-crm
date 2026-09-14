import { REFERENCE_DATE, daysSince } from '../config.js';
import type { InsightInput } from './provider.js';

// Shared by every LLM provider (Claude, Gemini) so the reasoning rules and
// output schema are identical regardless of which model serves the request.

export const SYSTEM_PROMPT = `You are the analysis engine of a micro-CRM used by the owner of a small business that sells an AI phone-answering product to dental practices. Your job is to read the full interaction history for one customer or prospect and produce a triage insight.

Rules:
- Reason ONLY from the interactions provided. Never invent events, promises, or sentiments that are not in the notes.
- Respect explicit hold instructions found in notes (e.g. "do not push before X", "no additional follow-up required") — a quiet account under a hold instruction is NOT urgent, and the suggested action should honor the hold.
- Consider deadlines and dates relative to today's date. A hard deadline that is imminent or just passed makes an account highly urgent.
- Silence after a proposal, pricing, or demo is a re-engagement signal; silence after a resolved issue is not.
- Cite the interaction ids your urgency claim and your suggested action rest on. Only cite ids that appear in the provided history.
- suggested_action must be one concrete, imperative sentence the owner can act on today (name the contact where relevant).`;

export const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: "2-3 sentence 'story so far' for this account: who they are, what has happened, where things stand.",
    },
    urgency: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
    urgency_reason: { type: 'string', description: 'One sentence explaining the urgency level, referencing what actually happened.' },
    cited_interaction_ids: {
      type: 'array',
      items: { type: 'string' },
      description: 'IDs of the interactions the urgency claim rests on.',
    },
    suggested_action: { type: 'string', description: 'One imperative sentence: the next action the owner should take.' },
    action_reason: { type: 'string', description: 'One sentence explaining why this is the right next action.' },
    action_cited_interaction_ids: {
      type: 'array',
      items: { type: 'string' },
      description: 'IDs of the interactions the suggested action rests on.',
    },
  },
  required: [
    'summary',
    'urgency',
    'urgency_reason',
    'cited_interaction_ids',
    'suggested_action',
    'action_reason',
    'action_cited_interaction_ids',
  ],
  additionalProperties: false,
} as const;

export function buildPrompt(input: InsightInput): string {
  const { customer, contacts, interactions } = input;
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const today = REFERENCE_DATE.toISOString().slice(0, 10);

  const contactLines = contacts.map((c) => `- ${c.name} (${c.role}, ${c.email})`).join('\n');
  const interactionLines = interactions
    .map((i) => {
      const contact = contactById.get(i.contact_id);
      const who = contact ? `${contact.name} (${contact.role})` : i.contact_id;
      return `[${i.id}] ${i.occurred_at} · ${i.type} · ${who}\n${i.notes}`;
    })
    .join('\n\n');

  const lastTouch = interactions.length > 0 ? interactions[interactions.length - 1] : null;
  const staleness = lastTouch ? `${daysSince(lastTouch.occurred_at)} days since last interaction.` : 'No interactions recorded.';

  return `Today's date: ${today}

Account: ${customer.name}
Status: ${customer.status}
Account created: ${customer.created_at}
${staleness}

Contacts:
${contactLines || '- none on file'}

Interaction history (oldest first):
${interactionLines || '(no interactions)'}

Produce the triage insight for this account.`;
}
