import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';
import type { CrmRepository } from './repository.js';
import type { Contact, Customer, Interaction } from './types.js';

const LOCAL_INTERACTIONS_FILE = path.join(DATA_DIR, 'interactions.local.json');

/** Minimal CSV parser supporting double-quoted fields with embedded commas/quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((c) => c !== '')) rows.push(row);
  }
  const [header, ...records] = rows;
  return records.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

export class CsvRepository implements CrmRepository {
  private customers: Customer[] = [];
  private contacts: Contact[] = [];
  private interactions: Interaction[] = [];

  constructor() {
    this.load();
  }

  private load() {
    const read = (file: string) => fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
    this.customers = parseCsv(read('customers.csv')) as unknown as Customer[];
    this.contacts = parseCsv(read('contacts.csv')) as unknown as Contact[];
    this.interactions = parseCsv(read('interactions.csv')) as unknown as Interaction[];

    // Interactions added through the UI persist to a JSON side-file so a dev
    // server restart doesn't lose them (deliberate simplification vs. a DB).
    if (fs.existsSync(LOCAL_INTERACTIONS_FILE)) {
      const local: Interaction[] = JSON.parse(fs.readFileSync(LOCAL_INTERACTIONS_FILE, 'utf-8'));
      this.interactions.push(...local);
    }
  }

  getCustomers(): Customer[] {
    return [...this.customers];
  }

  getCustomer(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id);
  }

  getContacts(customerId: string): Contact[] {
    return this.contacts.filter((c) => c.customer_id === customerId);
  }

  getContact(id: string): Contact | undefined {
    return this.contacts.find((c) => c.id === id);
  }

  getInteractions(customerId: string): Interaction[] {
    return this.interactions
      .filter((i) => i.customer_id === customerId)
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id));
  }

  addInteraction(input: Omit<Interaction, 'id'>): Interaction {
    const nextNum = this.interactions.length + 1;
    const interaction: Interaction = { id: `int_local_${String(nextNum).padStart(3, '0')}`, ...input };
    this.interactions.push(interaction);

    // The interaction is already live in memory; writing it to disk is what
    // makes it survive a restart. On a read-only filesystem (a serverless
    // host) that write fails, so the interaction stays in memory for the life
    // of the instance rather than the request erroring.
    try {
      const existing: Interaction[] = fs.existsSync(LOCAL_INTERACTIONS_FILE)
        ? JSON.parse(fs.readFileSync(LOCAL_INTERACTIONS_FILE, 'utf-8'))
        : [];
      existing.push(interaction);
      fs.writeFileSync(LOCAL_INTERACTIONS_FILE, JSON.stringify(existing, null, 2));
    } catch (err) {
      console.warn('[repository] could not persist interaction to disk; it is in memory only.', err);
    }

    return interaction;
  }
}
