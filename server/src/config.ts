import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.resolve(here, '../data');

// The sample dataset is set in mid-2026; using the real system clock would make
// every customer look either stale or fine incorrectly. All recency math is
// relative to this fixed reference date instead.
export const REFERENCE_DATE = new Date('2026-09-14');

export type AiProvider = 'anthropic' | 'gemini' | 'none';

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Provider selection: explicit AI_PROVIDER wins; otherwise use whichever key
 * is present (Gemini preferred if both). 'none' → heuristic fallback.
 */
export function aiProvider(): AiProvider {
  const requested = (process.env.AI_PROVIDER || '').toLowerCase();
  if (requested === 'gemini') return GEMINI_API_KEY ? 'gemini' : 'none';
  if (requested === 'anthropic' || requested === 'claude') return ANTHROPIC_API_KEY ? 'anthropic' : 'none';
  if (GEMINI_API_KEY) return 'gemini';
  if (ANTHROPIC_API_KEY) return 'anthropic';
  return 'none';
}

const DEFAULT_MODELS: Record<Exclude<AiProvider, 'none'>, string> = {
  anthropic: 'claude-opus-5',
  gemini: 'gemini-2.5-flash',
};

export const AI_MODEL =
  process.env.AI_MODEL ||
  process.env.MODEL_ID ||
  (aiProvider() !== 'none' ? DEFAULT_MODELS[aiProvider() as Exclude<AiProvider, 'none'>] : 'heuristic');

export const PORT = Number(process.env.PORT) || 3001;

export function daysSince(dateStr: string): number {
  const ms = REFERENCE_DATE.getTime() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
