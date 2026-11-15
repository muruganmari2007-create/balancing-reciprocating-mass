// LLM providers. Each returns raw text that should contain an Animex Script JSON.
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, userPrompt } from './prompt.js';

const env = (k) => (process.env[k] || '').trim();

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
    model: () => env('GEMINI_MODEL') || 'gemini-2.5-flash',
    async generate(question) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model())}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt(question) }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 12000 },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${data.error?.message || res.statusText}`);
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
      if (!text) throw new Error(`Gemini returned no text (finishReason: ${data.candidates?.[0]?.finishReason})`);
      return text;
    },
  },

  openai_compat: {
    label: 'OpenAI-compatible (Groq / OpenRouter / Ollama)',
    configured: () => !!env('OPENAI_COMPAT_API_KEY'),
    model: () => env('OPENAI_COMPAT_MODEL') || 'llama-3.3-70b-versatile',
    async generate(question) {
      const base = (env('OPENAI_COMPAT_BASE_URL') || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
      const res = await fetch(`${base}/chat/completions`, {
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
      });
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
