// Live values: evaluates diagram variables and element formulas for a given moment.
import { compileCached } from './math.js';
import { BASE_VARS, DYNAMIC_FIELDS } from './script.js';
import { easeInOut } from './timeline.js';

const BLEND = 0.9; // seconds to glide when a step changes a variable (e.g. freezes the crank)
const TAU = Math.PI * 2;

function evalVars(defs, overrides, scope) {
  const names = Object.keys(scope); // t, s (+ any already-fixed vars)
  const out = { ...scope };
  for (const [name, def] of Object.entries(defs)) {
    const expr = overrides?.[name] ?? def.expr;
    out[name] = compileCached(expr, names)(out);
    names.push(name);
  }
  return out;
}

/**
 * Variable values at global time T inside `entry` (a timeline scene entry).
 * When a step overrides a var, the value glides from the previous step's value.
 */
export function varsAt(script, timeline, entry, local) {
  const defs = script.diagram?.vars ?? {};
  const T = entry.start + local;
  const now = evalVars(defs, entry.scene.vars, { t: T, s: local });
  if (entry.index === 0 || local >= BLEND) return now;

  const prevEntry = timeline.scenes[entry.index - 1];
  const changed = Object.keys(defs).filter((k) => (prevEntry.scene.vars[k] ?? defs[k].expr) !== (entry.scene.vars[k] ?? defs[k].expr));
  if (!changed.length) return now;
  const before = evalVars(defs, prevEntry.scene.vars, { t: T, s: prevEntry.duration + local });
  const p = easeInOut(local / BLEND);
  const blended = { ...now };
  for (const k of changed) {
    let a = before[k], b = now[k];
    if (defs[k].angle) { // shortest way round
      const d = ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
      blended[k] = a + d * p;
    } else blended[k] = a + (b - a) * p;
  }
  // Re-evaluate vars that depend on blended ones (keep blended values fixed).
  return evalVars(Object.fromEntries(Object.entries(defs).filter(([k]) => !changed.includes(k))), null,
    Object.fromEntries(Object.entries(blended).filter(([k]) => changed.includes(k) || BASE_VARS.includes(k))));
}

const fmt = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '—');

/** Fills "{expr}" / "{expr:2}" placeholders in text with live values. */
export function template(text, scope, names) {
  if (!text || !text.includes('{')) return text;
  return text.replace(/\{([^{}:]+)(?::(\d))?\}/g, (_, expr, d) => fmt(compileCached(expr, names)(scope), d != null ? Number(d) : 1));
}

/** Returns a copy of the element with every formula field evaluated. */
export function resolveElement(el, scope, names) {
  let out = el;
  for (const f of DYNAMIC_FIELDS) {
    if (typeof el[f] === 'string') {
      if (out === el) out = { ...el };
      const v = compileCached(el[f], names)(scope);
      out[f] = Number.isFinite(v) ? v : 0;
    }
  }
  if (typeof el.text === 'string' && el.text.includes('{')) { if (out === el) out = { ...el }; out.text = template(el.text, scope, names); }
  if (typeof el.label === 'string' && el.label.includes('{')) { if (out === el) out = { ...el }; out.label = template(el.label, scope, names); }
  return out;
}
