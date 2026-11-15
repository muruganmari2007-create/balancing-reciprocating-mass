import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

const { PROVIDERS, listProviders, pickProvider } = await import('./providers.js');
const { solveLocally, EXAMPLES } = await import('./local/index.js');
const { normalizeScript } = await import('../public/engine/script.js');

const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const cache = new Map(); // "provider|question" -> response; saves money on repeat questions

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 20_000) throw new Error('Request too large'); }
  return JSON.parse(raw || '{}');
}

async function explain(question, requested) {
  const provider = pickProvider(requested);
  const key = `${provider}|${question.toLowerCase()}`;
  if (cache.has(key)) return { ...cache.get(key), cached: true };
  const started = Date.now();
  let script, warnings = [];

  if (provider === 'local') {
    ({ script, warnings } = normalizeScript(solveLocally(question)));
  } else {
    const p = PROVIDERS[provider];
    if (!p) throw Object.assign(new Error(`Unknown provider "${provider}"`), { status: 400 });
    if (!p.configured()) throw Object.assign(new Error(`${p.label} has no API key set in .env`), { status: 400 });
    let lastErr;
    for (let attempt = 0; attempt < 2 && !script; attempt++) { // one retry if the JSON is unusable
      try {
        ({ script, warnings } = normalizeScript(await p.generate(question)));
      } catch (err) {
        lastErr = err;
        console.warn(`[${provider}] attempt ${attempt + 1} failed: ${err.message}`);
        if (err.status && err.status < 500 && err.status !== 429) break; // auth/bad request: don't retry
      }
    }
    if (!script) throw lastErr;
  }
  const result = { script, warnings, provider, model: provider === 'local' ? 'local' : PROVIDERS[provider].model(), ms: Date.now() - started };
  cache.set(key, result);
  return result;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/providers') return send(res, 200, { providers: listProviders(), default: pickProvider('auto'), examples: EXAMPLES });
    if (url.pathname === '/api/explain' && req.method === 'POST') {
      const { question, provider } = await readJson(req);
      if (!question || typeof question !== 'string' || question.length > 2000) return send(res, 400, { error: 'Ask a question (max 2000 chars).' });
      return send(res, 200, await explain(question.trim(), provider));
    }
    // Static files
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(PUBLIC, rel);
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, { error: 'Forbidden' });
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch (err) {
    if (err.code === 'ENOENT') return send(res, 404, { error: 'Not found' });
    console.error(err);
    send(res, err.status && err.status < 600 ? err.status : 500, { error: err.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  const ready = listProviders().filter((p) => p.configured && p.id !== 'local').map((p) => p.id);
  console.log(`Animex running at http://localhost:${PORT}`);
  console.log(ready.length ? `LLM providers ready: ${ready.join(', ')}` : 'No LLM keys found: running in offline demo mode (see .env.example)');
});
