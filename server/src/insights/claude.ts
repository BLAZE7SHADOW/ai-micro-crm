import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL } from '../config.js';
import type { CustomerInsight } from '../types.js';
import { INSIGHT_SCHEMA, SYSTEM_PROMPT, buildPrompt } from './prompt.js';
import type { InsightInput, InsightProvider } from './provider.js';
import { validateInsight } from './provider.js';

export class ClaudeInsightProvider implements InsightProvider {
  private client: Anthropic;

  constructor(client?: Anthropic) {
    this.client = client ?? new Anthropic();
  }

  async generate(input: InsightInput): Promise<CustomerInsight> {
    const response = await this.client.messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: INSIGHT_SCHEMA } },
      messages: [{ role: 'user', content: buildPrompt(input) }],
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('Model refused the request');
    }

    const text = response.content.find((b) => b.type === 'text')?.text;
    if (!text) throw new Error('Model returned no text content');

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
