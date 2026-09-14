import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';
import type { CustomerInsight, Interaction } from './types.js';

const CACHE_FILE = path.join(DATA_DIR, '.ai-cache.json');

interface CacheEntry {
  hash: string;
  insight: CustomerInsight;
}

/**
 * Insight cache keyed by a content hash of the customer's interaction history,
 * so adding an interaction automatically invalidates only that customer.
 * Mirrored to a JSON file so dev-server restarts don't re-spend API tokens.
 */
export class InsightCache {
  private entries: Map<string, CacheEntry> = new Map();
  private readOnly = false;

  constructor() {
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const data: Record<string, CacheEntry> = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        this.entries = new Map(Object.entries(data));
      } catch {
        this.entries = new Map();
      }
    }
  }

  static hashOf(interactions: Interaction[]): string {
    const material = interactions.map((i) => `${i.id}|${i.occurred_at}|${i.notes}`).join('\n');
    return crypto.createHash('sha256').update(material).digest('hex');
  }

  get(customerId: string, hash: string): CustomerInsight | undefined {
    const entry = this.entries.get(customerId);
    return entry && entry.hash === hash ? entry.insight : undefined;
  }

  set(customerId: string, hash: string, insight: CustomerInsight): void {
    this.entries.set(customerId, { hash, insight });
    this.persist();
  }

  invalidate(customerId: string): void {
    this.entries.delete(customerId);
    this.persist();
  }

  private persist(): void {
    // The file mirror is an optimization, not a requirement: on a read-only
    // filesystem (e.g. a serverless host) the cache degrades to in-memory for
    // the life of the instance rather than taking the app down.
    if (this.readOnly) return;
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(this.entries), null, 2));
    } catch (err) {
      this.readOnly = true;
      console.warn('[cache] filesystem is read-only; continuing with an in-memory cache only.', err);
    }
  }
}
