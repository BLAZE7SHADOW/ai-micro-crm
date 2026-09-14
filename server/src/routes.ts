import { Router } from 'express';
import { REFERENCE_DATE } from './config.js';
import { InsightCache } from './cache.js';
import { generateInsight } from './insights/index.js';
import type { CrmRepository } from './repository.js';
import type { CustomerInsight, InteractionType } from './types.js';

const INTERACTION_TYPES: InteractionType[] = ['email', 'call', 'meeting', 'note'];

export function createRoutes(repo: CrmRepository): Router {
  const router = Router();
  router.get('/config', (_req, res) => res.json({ reference_date: REFERENCE_DATE.toISOString().slice(0, 10) }));
  const cache = new InsightCache();
  // Serialize concurrent generation per customer so parallel requests don't
  // both call the model for the same account.
  const inFlight = new Map<string, Promise<CustomerInsight>>();

  async function insightFor(customerId: string, force = false): Promise<CustomerInsight> {
    const customer = repo.getCustomer(customerId);
    if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });

    const interactions = repo.getInteractions(customerId);
    const hash = InsightCache.hashOf(interactions);

    if (!force) {
      const cached = cache.get(customerId, hash);
      if (cached) return cached;
    }

    const existing = inFlight.get(customerId);
    if (existing && !force) return existing;

    const promise = (async () => {
      const insight = await generateInsight({
        customer,
        contacts: repo.getContacts(customerId),
        interactions,
      });
      cache.set(customerId, hash, insight);
      return insight;
    })().finally(() => inFlight.delete(customerId));

    inFlight.set(customerId, promise);
    return promise;
  }

  router.get('/customers', (_req, res) => {
    const customers = repo.getCustomers().map((c) => {
      const interactions = repo.getInteractions(c.id);
      const last = interactions[interactions.length - 1];
      return { ...c, last_interaction_at: last?.occurred_at ?? null, interaction_count: interactions.length };
    });
    res.json(customers);
  });

  router.get('/customers/:id', (req, res) => {
    const customer = repo.getCustomer(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({
      customer,
      contacts: repo.getContacts(customer.id),
      interactions: repo.getInteractions(customer.id),
    });
  });

  router.get('/insights', async (_req, res) => {
    try {
      const customers = repo.getCustomers();
      const insights = await Promise.all(customers.map((c) => insightFor(c.id)));
      res.json(insights);
    } catch (err) {
      console.error('[routes] /insights failed:', err);
      res.status(500).json({ error: 'Failed to generate insights' });
    }
  });

  router.get('/insights/:id', async (req, res) => {
    try {
      const insight = await insightFor(req.params.id);
      res.json(insight);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to generate insight' });
    }
  });

  router.post('/insights/:id/regenerate', async (req, res) => {
    try {
      cache.invalidate(req.params.id);
      const insight = await insightFor(req.params.id, true);
      res.json(insight);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message ?? 'Failed to regenerate insight' });
    }
  });

  router.post('/interactions', async (req, res) => {
    const { customer_id, contact_id, type, occurred_at, notes } = req.body ?? {};

    if (!repo.getCustomer(customer_id)) return res.status(400).json({ error: 'Unknown customer_id' });
    const contact = repo.getContact(contact_id);
    if (!contact || contact.customer_id !== customer_id) {
      return res.status(400).json({ error: 'contact_id does not belong to this customer' });
    }
    if (!INTERACTION_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid interaction type' });
    if (typeof notes !== 'string' || !notes.trim()) return res.status(400).json({ error: 'Notes are required' });
    if (typeof occurred_at !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(occurred_at)) {
      return res.status(400).json({ error: 'occurred_at must be YYYY-MM-DD' });
    }

    const interaction = repo.addInteraction({ customer_id, contact_id, type, occurred_at, notes: notes.trim() });
    cache.invalidate(customer_id);
    res.status(201).json(interaction);
  });

  return router;
}
