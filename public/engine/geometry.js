// Layout math shared by the renderer and by script generators (so a generator can
// place a pointer under array cell 3, or a dot on a plotted curve, precisely).
import { tryCompile } from './math.js';

/** Center x of slot i in an array element. */
export function arraySlotX(el, i) {
  const n = el.values.length;
  return el.x - ((n - 1) * el.cell) / 2 + i * el.cell;
}

/** Resolves a plot's y-range (auto if ymin/ymax omitted) and returns mapping helpers. */
export function plotMapper(el) {
  const f = (el.fn && tryCompile(el.fn)) || (() => NaN);
  let { ymin, ymax } = el;
  if (ymin == null || ymax == null) {
    let lo = Infinity, hi = -Infinity;
    const ys = el.points
      ? el.points.map((p) => p[1]).concat(0) // data plots always show the zero line
      : Array.from({ length: 201 }, (_, k) => f(el.xmin + ((el.xmax - el.xmin) * k) / 200));
    for (const y of ys) if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    if (!Number.isFinite(lo)) { lo = -5; hi = 5; }
    const pad = (hi - lo || 2) * 0.1;
    ymin ??= lo - pad; ymax ??= hi + pad;
  }
  if (ymax <= ymin) ymax = ymin + 1;
  const left = el.x - el.w / 2, top = el.y - el.h / 2;
  const sx = (vx) => left + ((vx - el.xmin) / (el.xmax - el.xmin)) * el.w;
  const sy = (vy) => top + el.h - ((vy - ymin) / (ymax - ymin)) * el.h;
  return { f, ymin, ymax, sx, sy, left, top };
}
