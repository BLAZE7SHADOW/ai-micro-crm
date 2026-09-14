import type { Contact, Customer, Interaction } from './types.js';

/**
 * Data-access boundary. Routes and insight generation depend only on this
 * interface; the CSV/in-memory implementation is one of potentially many
 * (a SQL-backed implementation would slot in here without touching callers).
 */
export interface CrmRepository {
  getCustomers(): Customer[];
  getCustomer(id: string): Customer | undefined;
  getContacts(customerId: string): Contact[];
  getContact(id: string): Contact | undefined;
  getInteractions(customerId: string): Interaction[]; // sorted by occurred_at asc
  addInteraction(input: Omit<Interaction, 'id'>): Interaction;
}
