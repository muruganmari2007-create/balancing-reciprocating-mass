// Pure timeline math: (script, time) -> what every element looks like.
// No DOM here, so the same frame is produced whether you play, pause, or scrub.
import { ENTER_ACTIONS } from './script.js';

export const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const easeOutBack = (p) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const lerp = (a, b, p) => a + (b - a) * p;

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mixColor(a, b, p) {
  if (p >= 1) return b;
  if (p <= 0) return a;
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], p)).toString(16).padStart(2, '0')).join('');
}

/** Seconds a scene stays on screen. */
export function sceneDuration(scene) {
  // Long enough for every animation AND for the narrator (~2.6 words/s), plus a
  // short pause to absorb the final frame. The LLM's own hint is only a lower bound.
  const animEnd = scene.actions.reduce((m, a) => Math.max(m, a.at + a.dur), 0);
  const words = scene.narration.split(/\s+/).filter(Boolean).length;
  const speech = words / 2.6;
  return Math.min(40, Math.max(animEnd + 1.5, speech + 0.8, scene.duration ?? 0, 3));
}

export function buildTimeline(script) {
  let t = 0;
  const scenes = script.scenes.map((scene, index) => {
    const duration = sceneDuration(scene);
    const entry = { index, start: t, duration, scene };
    t += duration;
    return entry;
  });
  return { scenes, total: t };
}

/** Global time -> { entry, local } */
export function locate(timeline, T) {
  const { scenes } = timeline;
  for (const entry of scenes) if (T < entry.start + entry.duration) return { entry, local: Math.max(0, T - entry.start) };
  const last = scenes[scenes.length - 1];
  return { entry: last, local: last.duration };
}

/** State of one element at scene-local time t. */
export function elementState(el, actions, t) {
  const isLine = el.type === 'line' || el.type === 'arrow';
  const s = {
    opacity: 1, reveal: 1, scale: 1, glow: 0,
    x: isLine ? (el.x1 + el.x2) / 2 : el.x,
    y: isLine ? (el.y1 + el.y2) / 2 : el.y,
    color: el.fill || el.color,
    text: el.text ?? el.label ?? '',
    prevText: null, textMix: 1,
  };
  const n = el.values?.length || 0;
  if (n) {
    s.order = [...Array(n).keys()]; // slot -> cell identity
    s.cellColors = Array(n).fill(s.color);
    s.values = [...el.values];
    s.swap = null;
  }

  const mine = actions.filter((a) => a.target === el.id);
  if (mine.some((a) => ENTER_ACTIONS.includes(a.do))) { s.opacity = 0; s.reveal = 0; }

  for (const a of mine) {
    if (t < a.at) break; // actions are sorted by start time
    const raw = Math.min(1, (t - a.at) / a.dur);
    const p = easeInOut(raw);
    switch (a.do) {
      case 'appear': s.opacity = p; s.reveal = 1; break;
      case 'write': case 'draw': s.opacity = 1; s.reveal = raw; break;
      case 'grow': s.opacity = Math.min(1, raw * 2); s.reveal = 1; s.scale = Math.max(0, easeOutBack(raw)); break;
      case 'fade': s.opacity *= 1 - p; break;
      case 'move':
        if (a.to.x != null) s.x = lerp(s.x, a.to.x, p);
        if (a.to.y != null) s.y = lerp(s.y, a.to.y, p);
        break;
      case 'highlight':
        if (a.index != null && s.cellColors) {
          const cell = s.order[a.index];
          if (cell != null) s.cellColors[cell] = mixColor(s.cellColors[cell], a.color, p);
        } else s.color = mixColor(s.color, a.color, p);
        break;
      case 'pulse': {
        const bump = Math.sin(Math.PI * raw);
        s.scale *= 1 + 0.12 * bump; s.glow = Math.max(s.glow, bump);
        break;
      }
      case 'change':
        if (a.text != null) {
          if (raw < 1) { s.prevText = s.text; s.textMix = p; } else { s.prevText = null; s.textMix = 1; }
          s.text = a.text;
        }
        if (a.values && s.values) s.values = s.values.map((v, i) => (a.values[i] ?? v));
        break;
      case 'swap':
        if (!s.order || a.i >= n || a.j >= n) break;
        if (raw >= 1) { [s.order[a.i], s.order[a.j]] = [s.order[a.j], s.order[a.i]]; s.swap = null; }
        else s.swap = { i: a.i, j: a.j, p };
        break;
    }
  }
  return s;
}
