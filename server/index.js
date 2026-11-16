// Local development server: static files from public/ + the same API as Vercel.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

const { providersInfo, explain, errorResponse } = await import('./app.js');
const { listProviders } = await import('./providers.js');

const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 20_000) throw new Error('Request too large'); }
  return JSON.parse(raw || '{}');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/providers') return send(res, 200, providersInfo());
    if (url.pathname === '/api/explain' && req.method === 'POST') {
      const { question, provider } = await readJson(req);
      return send(res, 200, await explain(question, provider));
    }
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(PUBLIC, rel);
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, { error: 'Forbidden' });
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch (err) {
    if (err.code === 'ENOENT') return send(res, 404, { error: 'Not found' });
    const { status, body } = errorResponse(err);
    send(res, status, body);
  }
});

server.listen(PORT, () => {
  const ready = listProviders().filter((p) => p.configured && p.id !== 'local').map((p) => p.id);
  console.log(`Animex running at http://localhost:${PORT}`);
  console.log(ready.length ? `LLM providers ready: ${ready.join(', ')}` : 'No LLM keys found: running in offline demo mode (see .env.example)');
});
