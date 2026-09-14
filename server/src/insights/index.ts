import { aiProvider } from '../config.js';
import type { CustomerInsight } from '../types.js';
import { ClaudeInsightProvider } from './claude.js';
import { GeminiInsightProvider } from './gemini.js';
import { HeuristicInsightProvider } from './heuristic.js';
import type { InsightInput, InsightProvider } from './provider.js';

const heuristic = new HeuristicInsightProvider();
let llm: InsightProvider | null = null;

function getLlm(): InsightProvider | null {
  if (llm) return llm;
  switch (aiProvider()) {
    case 'gemini':
      llm = new GeminiInsightProvider();
      break;
    case 'anthropic':
      llm = new ClaudeInsightProvider();
      break;
    default:
      return null;
  }
  return llm;
}

/**
 * Provider chaining: the configured LLM (Gemini or Claude) when a key is
 * present, heuristic otherwise; a failed LLM call also degrades to the
 * heuristic rather than erroring the request — the UI shows the `source`
 * so degradation is never silent.
 */
export async function generateInsight(input: InsightInput): Promise<CustomerInsight> {
  const provider = getLlm();
  if (!provider) {
    return heuristic.generate(input);
  }
  try {
    return await provider.generate(input);
  } catch (err) {
    console.error(`[insights] ${aiProvider()} failed for ${input.customer.id}, falling back to heuristic:`, err);
    return heuristic.generate(input);
  }
}

export type { InsightInput, InsightProvider };
