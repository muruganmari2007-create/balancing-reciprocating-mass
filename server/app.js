// The API logic, shared by the local server (server/index.js) and the
// Vercel serverless functions (api/*.js), so both behave identically.
import { PROVIDERS, listProviders, pickProvider } from './providers.js';
import { solveLocally, tryLocally, EXAMPLES } from './local/index.js';
import { normalizeScript } from '../public/engine/script.js';

const cache = new Map(); // "provider|question" -> response (per server instance)

export function providersInfo() {
  return { providers: listProviders(), default: pickProvider('auto'), examples: EXAMPLES };
}

export async function explain(question, requested) {
  if (!question || typeof question !== 'string' || question.length > 2000) {
    throw Object.assign(new Error('Ask a question (max 2000 chars).'), { status: 400 });
  }
  question = question.trim();
  // Auto mode: a built-in solver that recognises the question is instant, free and
  // exact, so it wins; only unrecognised questions go to the LLM.
  const auto = !requested || requested === 'auto';
  const provider = auto && tryLocally(question) ? 'local' : pickProvider(requested);
  const key = `${provider}|${question.toLowerCase()}`;
  if (cache.has(key)) return { ...cache.get(key), cached: true };
  const started = Date.now();
  let script, warnings = [];

  if (provider === 'local') {
    ({ script, warnings } = normalizeScript(solveLocally(question)));
  } else {
    const p = PROVIDERS[provider];
    if (!p) throw Object.assign(new Error(`Unknown provider "${provider}"`), { status: 400 });
    if (!p.configured()) throw Object.assign(new Error(`${p.label} has no API key configured on the server.`), { status: 400 });
    let lastErr;
    for (let attempt = 0; attempt < 2 && !script; attempt++) { // one retry if the JSON is unusable
      try {
        ({ script, warnings } = normalizeScript(await p.generate(question)));
      } catch (err) {
        lastErr = err;
        console.warn(`[${provider}] attempt ${attempt + 1} failed: ${err.message}`);
        if (err.noRetry || (err.status && err.status < 500 && err.status !== 429)) break; // timeout/auth/bad request
      }
    }
    if (!script) throw lastErr;
  }
  const result = { script, warnings, provider, model: provider === 'local' ? 'local' : PROVIDERS[provider].model(), ms: Date.now() - started };
  cache.set(key, result);
  return result;
}

/** Maps an error to an HTTP status + JSON body. */
export function errorResponse(err) {
  if (!err.status || err.status >= 500) console.error(err);
  return { status: err.status && err.status < 600 ? err.status : 500, body: { error: err.message || 'Server error' } };
}
