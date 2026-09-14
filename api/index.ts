// Vercel serverless entry point. It exports the same Express app the local
// server runs (server/src/app.ts), so the deployed API and the local one are
// the same code path — only the process model differs.
import { createApp } from '../server/dist/app.js';

export default createApp();
