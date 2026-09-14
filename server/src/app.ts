import 'dotenv/config';
import express, { type Express } from 'express';
import { AI_MODEL, aiProvider } from './config.js';
import { CsvRepository } from './csvRepository.js';
import { createRoutes } from './routes.js';

/**
 * Builds the API. Kept separate from index.ts (which listens) so the same app
 * can be exported as a serverless handler — see api/index.ts.
 */
export function createApp(): Express {
  const app = express();
  app.use(express.json());

  const repo = new CsvRepository();
  app.use('/api', createRoutes(repo));

  app.get('/api/health', (_req, res) => {
    const provider = aiProvider();
    res.json({
      ok: true,
      ai: provider === 'none' ? 'heuristic-fallback (no API key set)' : `${provider}:${AI_MODEL}`,
    });
  });

  return app;
}
