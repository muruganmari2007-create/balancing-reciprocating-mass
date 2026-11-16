// LLM providers. Each returns raw text that should contain an Animex Script JSON.
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, userPrompt } from './prompt.js';

const env = (k) => (process.env[k] || '').trim();
const TIMEOUT_MS = 120_000;

/** fetch with a hard time limit; a timeout is reported clearly and is not retried. */
async function fetchWithTimeout(url, options, label, timeoutMs = TIMEOUT_MS) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw Object.assign(new Error(`${label} did not answer within ${Math.round(timeoutMs / 1000)} s (it is probably overloaded). Please try again in a minute.`), { status: 504, noRetry: true, kind: 'busy' });
    }
    throw err;
  }
}

// Messages shown to the student when the AI service is unavailable.
const BUSY_MSG = 'Gemini is very busy right now (high demand on Google\'s servers), and every model we tried was overloaded. Please try again in a few minutes, or tomorrow morning when traffic is lower. The built-in topics below still work instantly.';
const QUOTA_MSG = 'Gemini\'s free daily quota for this app is used up. It resets once a day (midnight Pacific Time, about 1:30 PM IST), so please try again tomorrow. The built-in topics below still work instantly.';

/** The model list: GEMINI_MODEL may be "a,b,c" — tried in order until one answers. */
const DEFAULT_GEMINI_MODELS = 'gemini-3.8-flash,gemini-3.5-flash-lite,gemini-flash-lite-latest';
const geminiModels = () => (env('GEMINI_MODEL') || DEFAULT_GEMINI_MODELS).split(',').map((m) => m.trim()).filter(Boolean);

export const PROVIDERS = {
  anthropic: {
    label: 'Claude (Anthropic)',
    configured: () => !!env('ANTHROPIC_API_KEY'),
    model: () => env('ANTHROPIC_MODEL') || 'claude-opus-5-5',
    async generate(question) {
      // Pin the public endpoint so a stray ANTHROPIC_BASE_URL (e.g. from a dev tool) isn't picked up.
      const client = new Anthropic({
        apiKey: env('ANTHROPIC_API_KEY'),
        baseURL: env('ANIMEX_ANTHROPIC_BASE_URL') || 'https://api.anthropic.com',
      });
      const model = this.model();
      const params = {
        model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt(question) }],
        output_config: { effort: 'medium' },
      };
      // Server-side fallback re-routes the rare safety-classifier refusal to another model.
      const supportsFallback = /^claude-(opus-5|sonnet-5-5|fable-5)/.test(model);
      const response = supportsFallback
        ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
        : await client.messages.create(params);
      if (response.stop_reason === 'refusal') throw new Error('The model declined this request.');
      if (response.stop_reason === 'max_tokens') throw new Error('Model ran out of tokens before finishing the script.');
      return response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    },
  },

  gemini: {
    label: 'Gemini (Google, free tier)',
    configured: () => !!env('GEMINI_API_KEY'),
    model() { return this.lastModel || geminiModels()[0]; },
    /**
     * Tries each model in GEMINI_MODEL in turn. A busy (503), rate-limited / out-of-quota (429),
     * retired (404) or slow model is skipped. If none answers, the error says whether to retry
     * in a few minutes / tomorrow morning (busy) or after the daily quota reset (quota).
     */
    async generate(question) {
      const started = Date.now();
      const BUDGET_MS = 140_000; // stays under the 150 s Vercel function limit
      const failures = [];
      for (const model of geminiModels()) {
        const left = BUDGET_MS - (Date.now() - started);
        if (left < 8_000) break;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        let res, data;
        try {
          res = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt(question) }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 16000 },
            }),
          }, `Gemini (${model})`, Math.min(left, 75_000));
          data = await res.json().catch(() => ({}));
        } catch (err) {
          if (err.kind !== 'busy') throw err;
          failures.push({ model, kind: 'busy' });
          console.warn(`[gemini] ${model}: timed out, trying next model`);
          continue;
        }
        if (res.ok) {
          const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
          if (text) {
            this.lastModel = model;
            this.lastWasFallback = model !== geminiModels()[0]; // lighter backup model: less reliable maths
            return text;
          }
          failures.push({ model, kind: 'empty' });
          continue;
        }
        const msg = data.error?.message || res.statusText;
        if (res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(msg))) {
          throw Object.assign(new Error(`Gemini rejected the API key: ${msg}`), { status: 400, noRetry: true, kind: 'key' });
        }
        const kind = res.status === 429 ? (/quota/i.test(msg) ? 'quota' : 'busy') : res.status === 503 || res.status >= 500 ? 'busy' : 'unavailable';
        failures.push({ model, kind });
        console.warn(`[gemini] ${model}: ${res.status} ${msg.slice(0, 80)} — trying next model`);
      }
      const quota = failures.length && failures.every((f) => f.kind === 'quota' || f.kind === 'unavailable');
      throw Object.assign(new Error(quota ? QUOTA_MSG : BUSY_MSG), {
        status: 503, noRetry: true, kind: quota ? 'quota' : 'busy', tried: failures.map((f) => `${f.model}: ${f.kind}`),
      });
    },
  },

  openai_compat: {
    label: 'OpenAI-compatible (Groq / OpenRouter / Ollama)',
    configured: () => !!env('OPENAI_COMPAT_API_KEY'),
    model: () => env('OPENAI_COMPAT_MODEL') || 'llama-3.3-70b-versatile',
    async generate(question) {
      const base = (env('OPENAI_COMPAT_BASE_URL') || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
      const res = await fetchWithTimeout(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env('OPENAI_COMPAT_API_KEY')}` },
        body: JSON.stringify({
          model: this.model(),
          temperature: 0.4,
          max_tokens: 8000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt(question) },
          ],
        }),
      }, 'The LLM');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`LLM ${res.status}: ${data.error?.message || res.statusText}`);
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('LLM returned no content');
      return text;
    },
  },
};

export function listProviders() {
  return [
    { id: 'local', label: 'Offline demo (built-in solvers)', configured: true, model: 'local' },
    ...Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label, configured: p.configured(), model: p.model() })),
  ];
}

/** "auto" => first configured LLM, else the offline engine. */
export function pickProvider(requested) {
  if (requested && requested !== 'auto') return requested;
  return Object.keys(PROVIDERS).find((id) => PROVIDERS[id].configured()) || 'local';
}
