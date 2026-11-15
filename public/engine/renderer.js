// SVG renderer: builds DOM nodes for a scene once, then updates attributes per frame.
import { COLORS } from './script.js';
import { arraySlotX, plotMapper } from './geometry.js';
import { elementState } from './timeline.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function h(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}
const chars = (str, reveal) => { const a = Array.from(str); return a.slice(0, Math.ceil(a.length * reveal)).join(''); };
const fontFamily = (el) => (el.font === 'math' ? 'var(--font-math)' : 'var(--font-sans)');

function textPair(g, el, size, { anchor = 'middle', y = 0, weight } = {}) {
  const attrs = { 'text-anchor': anchor, 'dominant-baseline': 'central', 'font-size': size, 'font-family': fontFamily(el), 'font-weight': weight, y };
  const prev = h('text', attrs, g);
  const cur = h('text', attrs, g);
  return (s, color = COLORS.text) => {
    cur.textContent = s.prevText != null ? s.text : chars(s.text, el.type === 'text' ? s.reveal : 1);
    cur.setAttribute('fill', color);
    cur.setAttribute('opacity', s.textMix);
    cur.setAttribute('y', y + (1 - s.textMix) * 2);
    prev.textContent = s.prevText ?? '';
    prev.setAttribute('fill', color);
    prev.setAttribute('opacity', 1 - s.textMix);
    prev.setAttribute('y', y - s.textMix * 2);
  };
}

const VIEWS = {
  text(g, el) {
    const set = textPair(g, el, el.size, { anchor: el.align, weight: el.bold ? 700 : 500 });
    return (s) => set(s, s.color);
  },

  box(g, el) {
    const rect = h('rect', { x: -el.w / 2, y: -el.h / 2, width: el.w, height: el.h, rx: 1.6, pathLength: 1, 'stroke-width': 0.5 }, g);
    const set = textPair(g, el, el.size);
    return (s) => {
      rect.setAttribute('stroke', s.color);
      rect.setAttribute('fill', s.color);
      rect.setAttribute('fill-opacity', 0.18 * s.reveal);
      rect.setAttribute('stroke-dasharray', '1');
      rect.setAttribute('stroke-dashoffset', 1 - s.reveal);
      set({ ...s, textMix: s.textMix * Math.min(1, s.reveal * 1.5) });
    };
  },

  circle(g, el) {
    const c = h('circle', { r: el.r, pathLength: 1, 'stroke-width': 0.5, transform: 'rotate(-90)' }, g);
    const set = textPair(g, el, el.size);
    return (s) => {
      c.setAttribute('stroke', s.color);
      c.setAttribute('fill', s.color);
      c.setAttribute('fill-opacity', 0.18 * s.reveal);
      c.setAttribute('stroke-dasharray', '1');
      c.setAttribute('stroke-dashoffset', 1 - s.reveal);
      set({ ...s, textMix: s.textMix * Math.min(1, s.reveal * 1.5) });
    };
  },

  point(g, el) {
    const c = h('circle', { r: el.r }, g);
    const label = h('text', { x: el.r + 1.2, y: -el.r - 1.2, 'font-size': el.size, 'font-family': 'var(--font-math)', fill: COLORS.text }, g);
    label.textContent = el.label ?? '';
    return (s) => c.setAttribute('fill', s.color);
  },

  line(g, el, s0) {
    const ox = s0.x, oy = s0.y;
    const x1 = el.x1 - ox, y1 = el.y1 - oy, x2 = el.x2 - ox, y2 = el.y2 - oy;
    const line = h('line', { x1, y1, x2, y2, pathLength: 1, 'stroke-width': el.width, 'stroke-linecap': 'round' }, g);
    let head = null;
    if (el.type === 'arrow') {
      const ang = Math.atan2(y2 - y1, x2 - x1), L = 2.6, W = 1.4;
      const bx = x2 - L * Math.cos(ang), by = y2 - L * Math.sin(ang);
      const px = -Math.sin(ang) * W, py = Math.cos(ang) * W;
      head = h('path', { d: `M${x2},${y2} L${bx + px},${by + py} L${bx - px},${by - py} Z` }, g);
    }
    let label = null;
    if (el.label) {
      label = h('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 2.5, 'text-anchor': 'middle', 'font-size': 3.2, 'font-family': 'var(--font-sans)', fill: COLORS.text }, g);
      label.textContent = el.label;
    }
    return (s) => {
      line.setAttribute('stroke', s.color);
      if (el.dashed) { line.setAttribute('stroke-dasharray', '1.5 1.2'); line.setAttribute('opacity', s.reveal); }
      else { line.setAttribute('stroke-dasharray', '1'); line.setAttribute('stroke-dashoffset', 1 - s.reveal); }
      if (head) { head.setAttribute('fill', s.color); head.setAttribute('opacity', s.reveal > 0.85 ? (s.reveal - 0.85) / 0.15 : 0); }
      if (label) label.setAttribute('opacity', s.reveal);
    };
  },

  array(g, el, s0) {
    const ox = s0.x, oy = s0.y;
    const n = el.values.length, size = el.cell * 0.9;
    const slotX = (i) => arraySlotX(el, i) - ox;
    const cells = el.values.map(() => {
      const cg = h('g', {}, g);
      const rect = h('rect', { x: -size / 2, y: -size / 2, width: size, height: size, rx: 1.2, 'stroke-width': 0.45 }, cg);
      const txt = h('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': size * 0.42, 'font-family': 'var(--font-math)', fill: COLORS.text, 'font-weight': 600 }, cg);
      return { cg, rect, txt };
    });
    if (el.showIndex) {
      for (let i = 0; i < n; i++) {
        const t = h('text', { x: slotX(i), y: size / 2 + 3, 'text-anchor': 'middle', 'font-size': 2.6, fill: COLORS.muted, 'font-family': 'var(--font-math)' }, g);
        t.textContent = i;
      }
    }
    return (s) => {
      const slotOf = []; s.order.forEach((cell, slot) => { slotOf[cell] = slot; });
      cells.forEach((c, cell) => {
        let x = slotX(slotOf[cell]), y = 0;
        if (s.swap) {
          const { i, j, p } = s.swap;
          const lift = Math.sin(Math.PI * p) * size * 0.9;
          if (slotOf[cell] === i) { x = slotX(i) + (slotX(j) - slotX(i)) * p; y = -lift; }
          if (slotOf[cell] === j) { x = slotX(j) + (slotX(i) - slotX(j)) * p; y = lift; }
        }
        c.cg.setAttribute('transform', `translate(${x} ${y})`);
        c.rect.setAttribute('stroke', s.cellColors[cell]);
        c.rect.setAttribute('fill', s.cellColors[cell]);
        c.rect.setAttribute('fill-opacity', 0.22);
        c.txt.textContent = s.values[cell];
      });
    };
  },

  bars(g, el, s0) {
    const n = el.values.length;
    const max = Math.max(...el.values.map(Math.abs), 1e-9);
    const left = el.x - el.w / 2 - s0.x, base = el.y + el.h / 2 - 5 - s0.y, usable = el.h - 12;
    const slot = el.w / n, bw = slot * 0.6;
    h('line', { x1: left, x2: left + el.w, y1: base, y2: base, stroke: COLORS.muted, 'stroke-width': 0.3 }, g);
    const bars = el.values.map((v, i) => {
      const cx = left + slot * (i + 0.5);
      const rect = h('rect', { x: cx - bw / 2, width: bw, rx: 0.8 }, g);
      const val = h('text', { x: cx, 'text-anchor': 'middle', 'font-size': 3, fill: COLORS.text, 'font-family': 'var(--font-math)' }, g);
      val.textContent = v;
      if (el.labels[i]) {
        const lab = h('text', { x: cx, y: base + 3.6, 'text-anchor': 'middle', 'font-size': 3, fill: COLORS.muted, 'font-family': 'var(--font-sans)' }, g);
        lab.textContent = el.labels[i];
      }
      return { rect, val, v };
    });
    return (s) => bars.forEach((b, i) => {
      const hgt = (Math.abs(b.v) / max) * usable * s.reveal;
      b.rect.setAttribute('y', base - hgt);
      b.rect.setAttribute('height', Math.max(0, hgt));
      b.rect.setAttribute('fill', s.cellColors[i]);
      b.val.setAttribute('y', base - hgt - 1.8);
      b.val.setAttribute('opacity', s.reveal);
    });
  },

  plot(g, el, s0) {
    const m = plotMapper(el);
    const tx = (x) => m.sx(x) - s0.x, ty = (y) => m.sy(y) - s0.y;
    const clipId = `clip${++uid}`;
    const clip = h('clipPath', { id: clipId }, g);
    h('rect', { x: m.left - s0.x, y: m.top - s0.y, width: el.w, height: el.h }, clip);
    const axes = h('g', { stroke: COLORS.muted, 'stroke-width': 0.3 }, g);
    h('rect', { x: m.left - s0.x, y: m.top - s0.y, width: el.w, height: el.h, fill: 'none', 'stroke-opacity': 0.35 }, axes);
    if (m.ymin < 0 && m.ymax > 0) h('line', { x1: tx(el.xmin), x2: tx(el.xmax), y1: ty(0), y2: ty(0) }, axes);
    if (el.xmin < 0 && el.xmax > 0) h('line', { x1: tx(0), x2: tx(0), y1: ty(m.ymin), y2: ty(m.ymax) }, axes);
    const lbl = (x, y, text, anchor) => { const t = h('text', { x, y, 'text-anchor': anchor, 'font-size': 2.6, fill: COLORS.muted, stroke: 'none', 'font-family': 'var(--font-math)' }, g); t.textContent = text; };
    const r = (v) => String(Math.round(v * 10) / 10);
    lbl(tx(el.xmin), ty(m.ymin) + 3.2, r(el.xmin), 'start');
    lbl(tx(el.xmax), ty(m.ymin) + 3.2, r(el.xmax), 'end');
    lbl(tx(el.xmin) - 1, ty(m.ymax) + 1, r(m.ymax), 'end');
    lbl(tx(el.xmin) - 1, ty(m.ymin), r(m.ymin), 'end');

    let d = '', pen = false;
    const span = m.ymax - m.ymin;
    const samples = el.points ?? Array.from({ length: 401 }, (_, k) => {
      const x = el.xmin + ((el.xmax - el.xmin) * k) / 400;
      return [x, m.f(x)];
    });
    for (const [x, y] of samples) {
      if (!Number.isFinite(y) || y < m.ymin - span * 2 || y > m.ymax + span * 2) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${tx(x).toFixed(2)},${ty(y).toFixed(2)} `;
      pen = true;
    }
    // Data plots (SFD/BMD) get a shaded area between the curve and the zero line.
    let area = null;
    if (el.points && el.fill) {
      const zero = ty(Math.max(m.ymin, Math.min(m.ymax, 0)));
      const pts = el.points.map(([x, y]) => `${tx(x).toFixed(2)},${ty(y).toFixed(2)}`).join(' L');
      area = h('path', { d: `M${tx(el.points[0][0])},${zero} L${pts} L${tx(el.points.at(-1)[0])},${zero} Z`, 'clip-path': `url(#${clipId})` }, g);
    }
    const curve = h('path', { d: d || 'M0,0', fill: 'none', 'stroke-width': 0.7, pathLength: 1, 'clip-path': `url(#${clipId})`, 'stroke-linejoin': 'round' }, g);
    return (s) => {
      curve.setAttribute('stroke', s.color);
      curve.setAttribute('stroke-dasharray', '1');
      curve.setAttribute('stroke-dashoffset', 1 - s.reveal);
      if (area) { area.setAttribute('fill', el.fill); area.setAttribute('fill-opacity', 0.22 * Math.max(0, s.reveal * 1.4 - 0.4)); }
      axes.setAttribute('opacity', Math.min(1, 0.3 + s.reveal * 2));
    };
  },
};
VIEWS.arrow = VIEWS.line;

/** Mounts one scene into <g> and returns render(t). */
export function mountScene(layer, scene) {
  layer.replaceChildren();
  const items = scene.elements.map((el) => {
    const s0 = elementState(el, [], 0);
    const g = h('g', {}, layer);
    const update = VIEWS[el.type](g, el, s0);
    return { el, g, update };
  });
  return (t) => {
    for (const { el, g, update } of items) {
      const s = elementState(el, scene.actions, t);
      g.setAttribute('transform', `translate(${s.x} ${s.y}) scale(${s.scale})`);
      g.setAttribute('opacity', s.opacity);
      g.style.filter = s.glow > 0.01 ? `drop-shadow(0 0 ${s.glow * 1.5}px ${s.color})` : '';
      update(s);
    }
  };
}
