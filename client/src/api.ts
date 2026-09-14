import type { CustomerDetail, CustomerInsight, CustomerListItem, Interaction, InteractionType } from './types';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

export const api = {
  config: () => get<{ reference_date: string }>('/api/config'),
  customers: () => get<CustomerListItem[]>('/api/customers'),
  customer: (id: string) => get<CustomerDetail>(`/api/customers/${id}`),
  insights: () => get<CustomerInsight[]>('/api/insights'),
  insight: (id: string) => get<CustomerInsight>(`/api/insights/${id}`),

  regenerateInsight: async (id: string): Promise<CustomerInsight> => {
    const res = await fetch(`/api/insights/${id}/regenerate`, { method: 'POST' });
    if (!res.ok) throw new Error(`Regenerate failed: ${res.status}`);
    return res.json();
  },

  addInteraction: async (input: {
    customer_id: string;
    contact_id: string;
    type: InteractionType;
    occurred_at: string;
    notes: string;
  }): Promise<Interaction> => {
    const res = await fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Add interaction failed: ${res.status}`);
    }
    return res.json();
  },
};
