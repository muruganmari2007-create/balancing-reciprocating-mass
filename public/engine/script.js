// Animex Script v2 — the contract between "whoever solves the problem"
// (an LLM, a local solver, a canned lesson) and the animation player.
// Shared by the server (to validate LLM output) and the browser.
//
// v2 adds a persistent, MOVING diagram:
//   script.diagram = { title, vars: {th: {expr:"1.57*t", angle:true}}, elements: [...] }
//   - numeric fields of diagram/scene elements may be formulas of t, s and the vars
//   - element.from = first step index where it appears (it stays for all later steps)
//   - scene.focus = [ids] to emphasise; scene.vars = {th: "rad(60)"} to freeze/override motion
// When a diagram exists the stage is split: diagram on the left (x 0..100),
// step panel on the right (x 100..160) holding the scene's own elements.

import { tryCompile } from './math.js';

export const STAGE = { w: 160, h: 90 };
export const PANEL_X = 100; // panel starts here when a diagram exists

// Blue & white engineering palette (works on a white stage).
export const COLORS = {
  text: '#0f172a', muted: '#94a3b8', primary: '#1d4ed8', accent: '#0891b2',
  good: '#047857', bad: '#dc2626', warn: '#d97706', bg: '#ffffff',
};

export const ELEMENT_TYPES = ['text', 'box', 'circle', 'line', 'arrow', 'array', 'plot', 'point', 'bars'];
export const ENTER_ACTIONS = ['appear', 'write', 'draw', 'grow'];
export const ACTION_TYPES = [...ENTER_ACTIONS, 'fade', 'move', 'highlight', 'pulse', 'change', 'swap'];
/** Fields that may be formulas instead of numbers. */
export const DYNAMIC_FIELDS = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'r', 'w', 'h', 'rot'];
/** Variables always available to formulas: t = lesson time (s), s = time within the step (s). */
export const BASE_VARS = ['t', 's'];

const LIMITS = { scenes: 12, elements: 40, actions: 80, text: 240, narration: 700 };

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

/** A number, or a formula string that compiles against `vars`. */
function numOrExpr(v, d, lo, hi, vars, warnings, where) {
  if (typeof v === 'string' && !/^\s*-?\d*\.?\d+\s*$/.test(v)) {
    if (tryCompile(v, vars)) return v.slice(0, 200);
    warnings.push(`bad formula "${v}" in ${where}`);
    return d;
  }
  return num(v, d, lo, hi);
}

function normalizeElement(raw, idx, warnings, vars) {
  if (!raw || !ELEMENT_TYPES.includes(raw.type)) {
    warnings.push(`dropped element with unknown type "${raw?.type}"`);
    return null;
  }
  const W = STAGE.w, H = STAGE.h;
  const id = str(raw.id, `e${idx}`, 40);
  const D = (v, d, lo, hi) => numOrExpr(v, d, lo, hi, vars, warnings, id);
  const el = {
    id,
    type: raw.type,
    x: D(raw.x, W / 2, -20, W + 20),
    y: D(raw.y, H / 2, -20, H + 20),
    rot: D(raw.rot, 0, -1e5, 1e5),
    color: resolveColor(raw.color, raw.type === 'text' ? COLORS.text : COLORS.primary),
    fill: raw.fill ? resolveColor(raw.fill, null) : null,
    label: raw.label != null ? str(raw.label, '', 80) : null,
    from: num(raw.from, 0, 0, 20),
    until: raw.until != null ? num(raw.until, 99, 0, 99) : 99,
  };
  switch (raw.type) {
    case 'text':
      el.text = str(raw.text, '');
      el.size = num(raw.size, 5, 1.5, 16);
      el.font = raw.font === 'math' ? 'math' : 'sans';
      el.align = ['start', 'middle', 'end'].includes(raw.align) ? raw.align : 'middle';
      el.bold = !!raw.bold;
      el.w = raw.w != null ? num(raw.w, null, 5, W) : null; // wrap width
      break;
    case 'box':
      el.w = D(raw.w, 30, 1, W); el.h = D(raw.h, 12, 1, H);
      el.size = num(raw.size, 4, 1.5, 12);
      break;
    case 'circle':
      el.r = D(raw.r, 8, 0.3, H);
      el.size = num(raw.size, 4, 1.5, 12);
      break;
    case 'point':
      el.r = D(raw.r, 1.2, 0.3, 10);
      el.size = num(raw.size, 3.2, 1.5, 10);
      break;
    case 'line': case 'arrow':
      el.x1 = D(raw.x1, 40); el.y1 = D(raw.y1, 45);
      el.x2 = D(raw.x2, 120); el.y2 = D(raw.y2, 45);
      el.dashed = !!raw.dashed;
      el.width = num(raw.width, 0.6, 0.1, 4);
      break;
    case 'array': {
      const values = Array.isArray(raw.values) ? raw.values.slice(0, 14).map((v) => str(v, '', 8)) : [];
      if (!values.length) { warnings.push(`array "${el.id}" has no values`); return null; }
      el.values = values;
      el.cell = num(raw.cell, Math.min(12, 140 / values.length), 3, 20);
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
      if (Array.isArray(raw.points) && raw.points.length >= 2) {
        el.points = raw.points.slice(0, 600)
          .map((p) => (Array.isArray(p) ? [num(p[0], NaN), num(p[1], NaN)] : null))
          .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
        if (el.points.length < 2) { warnings.push(`plot "${el.id}" has no usable points`); return null; }
        el.fn = null;
      } else {
        el.fn = str(raw.fn, 'x', 160);
        if (!tryCompile(el.fn)) { warnings.push(`plot "${el.id}" has unparseable fn "${el.fn}"`); return null; }
      }
      el.w = num(raw.w, 100, 10, W); el.h = num(raw.h, 60, 8, H);
      el.xmin = num(raw.xmin, el.points ? Math.min(...el.points.map((p) => p[0])) : -5);
      el.xmax = num(raw.xmax, el.points ? Math.max(...el.points.map((p) => p[0])) : 5);
      if (el.xmax <= el.xmin) el.xmax = el.xmin + 10;
      el.ymin = raw.ymin != null ? num(raw.ymin, -5) : null;
      el.ymax = raw.ymax != null ? num(raw.ymax, 5) : null;
      el.axes = raw.axes !== false;
      // Optional live marker: x-value formula; a dot rides the curve there.
      el.marker = typeof raw.marker === 'string' && tryCompile(raw.marker, vars) ? raw.marker.slice(0, 200) : null;
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

function normalizeVars(raw, names, warnings) {
  const out = {};
  for (const [name, v] of Object.entries(raw || {})) {
    if (!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(name) || BASE_VARS.includes(name)) continue;
    const def = typeof v === 'object' && v ? v : { expr: v };
    const expr = String(def.expr ?? '0');
    // A var may use t, s and any var defined before it.
    if (!tryCompile(expr, [...BASE_VARS, ...names])) { warnings.push(`bad var "${name}": ${expr}`); continue; }
    out[name] = { expr, angle: !!def.angle };
    names.push(name);
  }
  return out;
}

/** Validates + repairs a script from any source. Never throws on bad content. */
export function normalizeScript(raw) {
  const warnings = [];
  if (typeof raw === 'string') raw = extractJson(raw);
  if (!raw || typeof raw !== 'object') throw new Error('Script is not a JSON object');

  // ---- persistent diagram
  let diagram = null;
  const varNames = [];
  if (raw.diagram && Array.isArray(raw.diagram.elements)) {
    const vars = normalizeVars(raw.diagram.vars, varNames, warnings);
    const allVars = [...BASE_VARS, ...varNames];
    const ids = new Set();
    const elements = [];
    raw.diagram.elements.slice(0, LIMITS.elements).forEach((e, i) => {
      const el = normalizeElement(e, i, warnings, allVars);
      if (!el) return;
      while (ids.has(el.id)) el.id += '_';
      ids.add(el.id);
      el.enter = ENTER_ACTIONS.includes(e.enter) ? e.enter : null;
      el.at = num(e.at, 0.3, 0, 30);
      elements.push(el);
    });
    if (elements.length) diagram = { title: str(raw.diagram.title, '', 80), vars, elements };
  }
  const allVars = [...BASE_VARS, ...varNames];
  const diagramIds = new Set(diagram?.elements.map((e) => e.id) ?? []);

  // ---- steps
  const scenesIn = Array.isArray(raw.scenes) ? raw.scenes.slice(0, LIMITS.scenes) : [];
  const scenes = [];
  for (const s of scenesIn) {
    const elements = [];
    const ids = new Set(diagramIds);
    (Array.isArray(s?.elements) ? s.elements.slice(0, LIMITS.elements) : []).forEach((e, i) => {
      const el = normalizeElement(e, i, warnings, allVars);
      if (!el) return;
      while (ids.has(el.id)) el.id += '_';
      ids.add(el.id);
      elements.push(el);
    });
    const actions = (Array.isArray(s?.actions) ? s.actions.slice(0, LIMITS.actions) : [])
      .map((a) => normalizeAction(a, ids, warnings))
      .filter(Boolean)
      .sort((a, b) => a.at - b.at);
    if (!elements.length && !diagram) { warnings.push('dropped empty scene'); continue; }
    const sceneVars = {};
    for (const [name, v] of Object.entries(s?.vars || {})) {
      if (diagram?.vars[name] && tryCompile(String(v), allVars)) sceneVars[name] = String(v);
      else warnings.push(`ignored step var "${name}"`);
    }
    scenes.push({
      narration: str(s.narration, '', LIMITS.narration),
      caption: str(s.caption, '', 80),
      duration: s.duration != null ? num(s.duration, null, 1, 60) : null,
      focus: Array.isArray(s.focus) ? s.focus.map(String).filter((id) => diagramIds.has(id)) : [],
      vars: sceneVars,
      elements, actions,
    });
  }
  if (!scenes.length) throw new Error('Script has no valid scenes');
  return {
    script: {
      title: str(raw.title, 'Explanation', 100),
      answer: str(raw.answer, '', 500),
      steps: Array.isArray(raw.steps) ? raw.steps.slice(0, 14).map((x) => str(x, '', 300)) : [],
      diagram,
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
