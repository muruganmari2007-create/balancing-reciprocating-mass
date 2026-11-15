// Animex Script v1 — the contract between "whoever solves the problem"
// (an LLM, a local solver, a canned demo) and the animation player.
// This module is shared by the server (to validate LLM output) and the browser.

import { tryCompile } from './math.js';

export const STAGE = { w: 160, h: 90 }; // virtual 16:9 coordinate space

export const COLORS = {
  text: '#e8ecf4', muted: '#8a93a6', primary: '#6ea8ff', accent: '#c792ea',
  good: '#4fd18b', bad: '#ff6b6b', warn: '#ffc857', bg: '#0f1320',
};

export const ELEMENT_TYPES = ['text', 'box', 'circle', 'line', 'arrow', 'array', 'plot', 'point', 'bars'];
export const ENTER_ACTIONS = ['appear', 'write', 'draw', 'grow'];
export const ACTION_TYPES = [...ENTER_ACTIONS, 'fade', 'move', 'highlight', 'pulse', 'change', 'swap'];

const LIMITS = { scenes: 12, elements: 30, actions: 60, text: 240, narration: 600 };

const num = (v, d, lo = -1e6, hi = 1e6) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const str = (v, d = '', max = LIMITS.text) => (v == null ? d : String(v).slice(0, max));

export function resolveColor(c, fallback = COLORS.text) {
  if (!c) return fallback;
  if (COLORS[c]) return COLORS[c];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return c;
  return fallback;
}

function normalizeElement(raw, idx, warnings) {
  if (!raw || !ELEMENT_TYPES.includes(raw.type)) {
    warnings.push(`dropped element with unknown type "${raw?.type}"`);
    return null;
  }
  const W = STAGE.w, H = STAGE.h;
  const el = {
    id: str(raw.id, `e${idx}`, 40),
    type: raw.type,
    x: num(raw.x, W / 2, -20, W + 20),
    y: num(raw.y, H / 2, -20, H + 20),
    color: resolveColor(raw.color, raw.type === 'text' ? COLORS.text : COLORS.primary),
    fill: raw.fill ? resolveColor(raw.fill, null) : null,
    label: raw.label != null ? str(raw.label, '', 60) : null,
  };
  switch (raw.type) {
    case 'text':
      el.text = str(raw.text, '');
      el.size = num(raw.size, 5, 1.5, 16);
      el.font = raw.font === 'math' ? 'math' : 'sans';
      el.align = ['start', 'middle', 'end'].includes(raw.align) ? raw.align : 'middle';
      el.bold = !!raw.bold;
      break;
    case 'box':
      el.w = num(raw.w, 30, 1, W); el.h = num(raw.h, 12, 1, H);
      el.size = num(raw.size, 4, 1.5, 12);
      break;
    case 'circle':
      el.r = num(raw.r, 8, 0.5, H);
      el.size = num(raw.size, 4, 1.5, 12);
      break;
    case 'point':
      el.r = num(raw.r, 1.4, 0.3, 10);
      el.size = num(raw.size, 3.5, 1.5, 10);
      break;
    case 'line': case 'arrow':
      el.x1 = num(raw.x1, 40); el.y1 = num(raw.y1, 45);
      el.x2 = num(raw.x2, 120); el.y2 = num(raw.y2, 45);
      el.dashed = !!raw.dashed;
      el.width = num(raw.width, 0.6, 0.1, 4);
      break;
    case 'array': {
      const values = Array.isArray(raw.values) ? raw.values.slice(0, 14).map((v) => str(v, '', 8)) : [];
      if (!values.length) { warnings.push(`array "${el.id}" has no values`); return null; }
      el.values = values;
      el.cell = num(raw.cell, Math.min(12, 140 / values.length), 4, 20);
      el.showIndex = raw.showIndex !== false;
      break;
    }
    case 'bars': {
      const values = Array.isArray(raw.values) ? raw.values.slice(0, 16).map((v) => num(v, 0)) : [];
      if (!values.length) { warnings.push(`bars "${el.id}" has no values`); return null; }
      el.values = values;
      el.labels = Array.isArray(raw.labels) ? raw.labels.map((l) => str(l, '', 12)) : [];
      el.w = num(raw.w, 100, 10, W); el.h = num(raw.h, 50, 10, H);
      break;
    }
    case 'plot':
      // Either a formula ("fn") or data ("points": [[x,y],...]) e.g. for SFD/BMD diagrams.
      if (Array.isArray(raw.points) && raw.points.length >= 2) {
        el.points = raw.points.slice(0, 600)
          .map((p) => (Array.isArray(p) ? [num(p[0], NaN), num(p[1], NaN)] : null))
          .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
        if (el.points.length < 2) { warnings.push(`plot "${el.id}" has no usable points`); return null; }
        el.fn = null;
        el.fill = raw.fill ? resolveColor(raw.fill, null) : null;
      } else {
        el.fn = str(raw.fn, 'x', 120);
        if (!tryCompile(el.fn)) { warnings.push(`plot "${el.id}" has unparseable fn "${el.fn}"`); return null; }
      }
      el.w = num(raw.w, 100, 10, W); el.h = num(raw.h, 60, 10, H);
      el.xmin = num(raw.xmin, el.points ? Math.min(...el.points.map((p) => p[0])) : -5);
      el.xmax = num(raw.xmax, el.points ? Math.max(...el.points.map((p) => p[0])) : 5);
      if (el.xmax <= el.xmin) el.xmax = el.xmin + 10;
      el.ymin = raw.ymin != null ? num(raw.ymin, -5) : null; // null => auto range
      el.ymax = raw.ymax != null ? num(raw.ymax, 5) : null;
      break;
  }
  return el;
}

function normalizeAction(raw, ids, warnings) {
  if (!raw || !ACTION_TYPES.includes(raw.do)) {
    warnings.push(`dropped action with unknown "do": "${raw?.do}"`);
    return null;
  }
  const [baseId, idxStr] = String(raw.target ?? '').split(/[[\]]/);
  if (!ids.has(baseId)) { warnings.push(`dropped "${raw.do}" on missing target "${raw.target}"`); return null; }
  const a = {
    do: raw.do,
    target: baseId,
    index: idxStr !== undefined && idxStr !== '' ? num(idxStr, null, 0, 99) : (raw.index != null ? num(raw.index, null, 0, 99) : null),
    at: num(raw.at, 0, 0, 120),
    dur: num(raw.dur, raw.do === 'write' ? 1.2 : 0.8, 0.05, 20),
  };
  if (raw.do === 'move') a.to = { x: num(raw.to?.x, null), y: num(raw.to?.y, null) };
  if (raw.do === 'highlight') a.color = resolveColor(raw.color, COLORS.warn);
  if (raw.do === 'change') {
    if (raw.text != null) a.text = str(raw.text);
    if (Array.isArray(raw.values)) a.values = raw.values.map((v) => str(v, '', 8));
  }
  if (raw.do === 'swap') { a.i = num(raw.i, 0, 0, 99); a.j = num(raw.j, 1, 0, 99); }
  return a;
}

/** Validates + repairs a script from any source. Never throws on bad content. */
export function normalizeScript(raw) {
  const warnings = [];
  if (typeof raw === 'string') raw = extractJson(raw);
  if (!raw || typeof raw !== 'object') throw new Error('Script is not a JSON object');
  const scenesIn = Array.isArray(raw.scenes) ? raw.scenes.slice(0, LIMITS.scenes) : [];
  const scenes = [];
  for (const s of scenesIn) {
    const elements = [];
    const ids = new Set();
    (Array.isArray(s?.elements) ? s.elements.slice(0, LIMITS.elements) : []).forEach((e, i) => {
      const el = normalizeElement(e, i, warnings);
      if (!el) return;
      while (ids.has(el.id)) el.id += '_';
      ids.add(el.id);
      elements.push(el);
    });
    const actions = (Array.isArray(s?.actions) ? s.actions.slice(0, LIMITS.actions) : [])
      .map((a) => normalizeAction(a, ids, warnings))
      .filter(Boolean)
      .sort((a, b) => a.at - b.at);
    if (!elements.length) { warnings.push('dropped empty scene'); continue; }
    scenes.push({
      narration: str(s.narration, '', LIMITS.narration),
      caption: str(s.caption, '', 80),
      duration: s.duration != null ? num(s.duration, null, 1, 60) : null,
      elements, actions,
    });
  }
  if (!scenes.length) throw new Error('Script has no valid scenes');
  return {
    script: {
      title: str(raw.title, 'Explanation', 100),
      answer: str(raw.answer, '', 400),
      steps: Array.isArray(raw.steps) ? raw.steps.slice(0, 12).map((x) => str(x, '', 300)) : [],
      scenes,
    },
    warnings,
  };
}

/** Pulls the first JSON object out of an LLM reply (handles ```json fences / chatter). */
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object found in model reply');
  return JSON.parse(body.slice(start, end + 1));
}
