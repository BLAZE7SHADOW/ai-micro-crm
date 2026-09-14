import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { AI_MODEL, aiProvider, PORT } from './config.js';

const app = createApp();

// When the client has been built, serve it from this same process so the app
// can run as a single service on any Node host. On Vercel the static build is
// served by the CDN instead and this block is inert. In development Vite
// serves the client on :5173 and proxies /api here.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use((await import('express')).default.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  const provider = aiProvider();
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(
    provider !== 'none'
      ? `[server] AI insights enabled (${provider} · ${AI_MODEL})`
      : '[server] No AI key found — running with heuristic fallback. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in server/.env to enable AI insights.'
  );
});
