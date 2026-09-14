import { describe, expect, it } from 'vitest';
import type { Customer, Interaction } from '../types.js';
import { HeuristicInsightProvider } from './heuristic.js';
import { validateInsight } from './provider.js';

const interactions: Interaction[] = [
  { id: 'int_001', customer_id: 'cust_x', contact_id: 'contact_1', type: 'email', occurred_at: '2026-08-01', notes: 'Asked for pricing.' },
  { id: 'int_002', customer_id: 'cust_x', contact_id: 'contact_1', type: 'note', occurred_at: '2026-08-14', notes: 'Do not push aggressively before September planning meeting.' },
];

const validRaw = {
  summary: 'A prospect evaluating the product.',
  urgency: 'low',
  urgency_reason: 'They asked us to wait.',
  cited_interaction_ids: ['int_002'],
  suggested_action: 'Wait until after their September meeting.',
  action_reason: 'The notes explicitly ask not to push.',
  action_cited_interaction_ids: ['int_002'],
};

describe('validateInsight', () => {
  it('accepts a fully valid insight with real citations', () => {
    const result = validateInsight(validRaw, interactions);
    expect(result.ok).toBe(true);
    expect(result.lowConfidence).toBe(false);
    expect(result.insight?.cited_interaction_ids).toEqual(['int_002']);
  });

  it('strips hallucinated citation ids and flags low confidence', () => {
    const result = validateInsight(
      { ...validRaw, cited_interaction_ids: ['int_999', 'int_002'] },
      interactions
    );
    expect(result.ok).toBe(true);
    expect(result.lowConfidence).toBe(true);
    expect(result.insight?.cited_interaction_ids).toEqual(['int_002']);
  });

  it('flags low confidence when no valid citations survive at all', () => {
    const result = validateInsight(
      { ...validRaw, cited_interaction_ids: ['int_999'], action_cited_interaction_ids: ['int_888'] },
      interactions
    );
    expect(result.ok).toBe(true);
    expect(result.lowConfidence).toBe(true);
    expect(result.insight?.cited_interaction_ids).toEqual([]);
  });

  it('rejects an invalid urgency value', () => {
    const result = validateInsight({ ...validRaw, urgency: 'urgent!!' }, interactions);
    expect(result.ok).toBe(false);
  });

  it('rejects missing summary', () => {
    const result = validateInsight({ ...validRaw, summary: '' }, interactions);
    expect(result.ok).toBe(false);
  });
});

describe('HeuristicInsightProvider', () => {
  const provider = new HeuristicInsightProvider();
  const customer: Customer = { id: 'cust_x', name: 'Test Dental', status: 'prospect', created_at: '2026-07-01' };

  it('suppresses urgency when a hold instruction is present (the Evergreen case)', async () => {
    const insight = await provider.generate({ customer, contacts: [], interactions });
    expect(insight.urgency).toBe('low');
    expect(insight.cited_interaction_ids).toContain('int_002');
    expect(insight.suggested_action.toLowerCase()).toContain('hold');
  });

  it('flags a stalled thread as high urgency (the Lakeside case)', async () => {
    const stalled: Interaction[] = [
      { id: 'int_010', customer_id: 'cust_x', contact_id: 'contact_1', type: 'email', occurred_at: '2026-06-28', notes: 'Sent pricing details.' },
      { id: 'int_011', customer_id: 'cust_x', contact_id: 'contact_1', type: 'note', occurred_at: '2026-08-01', notes: 'No response after pricing. Prospect has been inactive for over a month.' },
    ];
    const insight = await provider.generate({ customer, contacts: [], interactions: stalled });
    expect(insight.urgency).toBe('high');
    expect(insight.cited_interaction_ids).toContain('int_011');
  });

  it('reports none/low urgency for a recently active account with no flags', async () => {
    const recent: Interaction[] = [
      { id: 'int_020', customer_id: 'cust_x', contact_id: 'contact_1', type: 'call', occurred_at: '2026-09-10', notes: 'Happy with the product, discussed expansion.' },
    ];
    const insight = await provider.generate({ customer, contacts: [], interactions: recent });
    expect(insight.urgency).toBe('none');
  });
});
