export type CustomerStatus = 'prospect' | 'customer';
export type InteractionType = 'email' | 'call' | 'meeting' | 'note';
export type Urgency = 'high' | 'medium' | 'low' | 'none';

export interface Customer {
  id: string;
  name: string;
  status: CustomerStatus;
  created_at: string; // ISO date
}

export interface Contact {
  id: string;
  customer_id: string;
  name: string;
  email: string;
  role: string;
}

export interface Interaction {
  id: string;
  customer_id: string;
  contact_id: string;
  type: InteractionType;
  occurred_at: string; // ISO date
  notes: string;
}

export interface CustomerInsight {
  customer_id: string;
  summary: string;
  urgency: Urgency;
  urgency_reason: string;
  cited_interaction_ids: string[];
  suggested_action: string;
  action_reason: string;
  action_cited_interaction_ids: string[];
  source: 'ai' | 'heuristic';
  low_confidence?: boolean;
  generated_at: string;
}

export interface CustomerDetail {
  customer: Customer;
  contacts: Contact[];
  interactions: Interaction[];
}
