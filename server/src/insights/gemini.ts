import { AI_MODEL, GEMINI_API_KEY } from '../config.js';
import type { CustomerInsight } from '../types.js';
import { INSIGHT_SCHEMA, SYSTEM_PROMPT, buildPrompt } from './prompt.js';
import type { InsightInput, InsightProvider } from './provider.js';
import { validateInsight } from './provider.js';

// Gemini's responseSchema is a subset of JSON Schema — it rejects
// `additionalProperties`, so strip it (validation still happens on our side
// in validateInsight, which is the check that actually matters).
function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(schema));
  const strip = (node: unknown): void => {
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      const obj = node as Record<string, unknown>;
      delete obj.additionalProperties;
      for (const value of Object.values(obj)) strip(value);
    }
  };
  strip(clone);
  return clone;
}

const GEMINI_SCHEMA = toGeminiSchema(INSIGHT_SCHEMA as unknown as Record<string, unknown>);

export class GeminiInsightProvider implements InsightProvider {
  async generate(input: InsightInput): Promise<CustomerInsight> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      AI_MODEL
    )}:generateContent`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: GEMINI_SCHEMA,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('');
    if (!text) {
      throw new Error(`Gemini returned no text (finishReason: ${candidate?.finishReason ?? 'unknown'})`);
    }

    const raw = JSON.parse(text);
    const result = validateInsight(raw, input.interactions);
    if (!result.ok || !result.insight) {
      throw new Error(`Insight failed validation: ${result.errors.join('; ')}`);
    }

    return {
      customer_id: input.customer.id,
      ...result.insight,
      source: 'ai',
      generated_at: new Date().toISOString(),
    };
  }
}
