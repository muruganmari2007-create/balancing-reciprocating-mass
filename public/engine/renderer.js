// SVG renderer. Shapes recompute their geometry every frame, so diagram parts can move
// (a crank turning, a piston sliding, a section line sweeping along a beam).
import { COLORS, STAGE, PANEL_X, BASE_VARS } from './script.js';
import { arraySlotX, plotMapper } from './geometry.js';
import { elementState } from './timeline.js';
import { resolveElement } from './dynamic.js';
import { compileCached } from './math.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function h(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}
const chars = (str, reveal) => { const a = Array.from(str ?? ''); return a.slice(0, Math.ceil(a.length * reveal)).join(''); };
const fontFamily = (el) => (el.font === 'math' ? 'var(--font-math)' : 'var(--font-sans)');

/** Writes text into a <text>, wrapping into <tspan> lines when the element has a width. */
function setText(node, str, el, size, anchorX = 0) {
  const lines = [];
  if (el.w && el.type === 'text') {
    const perChar = size * (el.font === 'math' ? 0.6 : 0.52);
    const max = Math.max(4, Math.floor(el.w / perChar));
    let line = '';
    for (const word of str.split(' ')) {
      if ((line + ' ' + word).trim().length > max && line) { lines.push(line); line = word; }
      else line = (line + ' ' + word).trim();
    }
    if (line) lines.push(line);
  } else lines.push(str);
  if (node._last === lines.join('\n')) return;
  node._last = lines.join('\n');
  node.replaceChildren();
  const lh = size * 1.3;
  lines.forEach((l, i) => {
    const t = h('tspan', { x: anchorX, dy: i === 0 ? -((lines.length - 1) * lh) / 2 : lh }, node);
    t.textContent = l;
  });
}

function textPair(g, el, size, { anchor = 'middle', weight } = {}) {
  const attrs = { 'text-anchor': anchor, 'dominant-baseline': 'central', 'font-size': size, 'font-family': fontFamily(el), 'font-weight': weight };
  const prev = h('text', attrs, g);
  const cur = h('text', attrs, g);
  return (s, el2, color = COLORS.text) => {
    setText(cur, s.prevText != null ? s.text : chars(s.text, el2.type === 'text' ? s.reveal : 1), el2, size);
    cur.setAttribute('fill', color);
    cur.setAttribute('opacity', s.textMix);
    cur.setAttribute('transform', `translate(0 ${(1 - s.textMix) * 2})`);
    setText(prev, s.prevText ?? '', el2, size);
    prev.setAttribute('fill', color);
    prev.setAttribute('opacity', 1 - s.textMix);
    prev.setAttribute('transform', `translate(0 ${-s.textMix * 2})`);
  };
}

const VIEWS = {
  text(g, el) {
    const set = textPair(g, el, el.size, { anchor: el.align, weight: el.bold ? 700 : 500 });
    return (s, e) => set(s, e, s.color);
  },

  box(g, el) {
    const rect = h('rect', { rx: 1.2, pathLength: 1, 'stroke-width': 0.45, 'stroke-dasharray': '1' }, g);
    const set = textPair(g, el, el.size, { weight: 600 });
    return (s, e) => {
      rect.setAttribute('x', -e.w / 2); rect.setAttribute('y', -e.h / 2);
      rect.setAttribute('width', e.w); rect.setAttribute('height', e.h);
      rect.setAttribute('stroke', s.color);
      rect.setAttribute('fill', s.color);
      rect.setAttribute('fill-opacity', (e.fill ? 0.14 : 0.04) * s.reveal);
      rect.setAttribute('stroke-dashoffset', 1 - s.reveal);
      set({ ...s, textMix: s.textMix * Math.min(1, s.reveal * 1.5) }, e);
    };
  },

  circle(g, el) {
    const c = h('circle', { pathLength: 1, 'stroke-width': 0.45, transform: 'rotate(-90)', 'stroke-dasharray': '1' }, g);
    const set = textPair(g, el, el.size, { weight: 600 });
    return (s, e) => {
      c.setAttribute('r', e.r);
      c.setAttribute('stroke', s.color);
      c.setAttribute('fill', s.color);
      c.setAttribute('fill-opacity', (e.fill ? 0.16 : 0) * s.reveal);
      c.setAttribute('stroke-dashoffset', 1 - s.reveal);
      set({ ...s, textMix: s.textMix * Math.min(1, s.reveal * 1.5) }, e);
    };
  },

  point(g, el) {
    const c = h('circle', {}, g);
    const label = h('text', { 'font-size': el.size, 'font-family': 'var(--font-math)', fill: COLORS.text, 'font-weight': 600 }, g);
    return (s, e) => {
      c.setAttribute('r', e.r);
      c.setAttribute('fill', s.color);
      label.setAttribute('x', e.r + 1); label.setAttribute('y', -e.r - 0.8);
      label.textContent = e.label ?? '';
    };
  },

  line(g, el) {
    const line = h('line', { pathLength: 1, 'stroke-linecap': 'round' }, g);
    const head = el.type === 'arrow' ? h('path', {}, g) : null;
    const label = el.label != null ? h('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 3, 'font-family': 'var(--font-math)', 'font-weight': 600 }, g) : null;
    return (s, e) => {
      const mx = (e.x1 + e.x2) / 2, my = (e.y1 + e.y2) / 2;
      const x1 = e.x1 - mx, y1 = e.y1 - my, x2 = e.x2 - mx, y2 = e.y2 - my;
      line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', s.color);
      line.setAttribute('stroke-width', e.width);
      if (e.dashed) { line.setAttribute('stroke-dasharray', '1.4 1'); line.removeAttribute('pathLength'); line.setAttribute('opacity', s.reveal); }
      else { line.setAttribute('stroke-dasharray', '1'); line.setAttribute('stroke-dashoffset', 1 - s.reveal); }
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (head) {
        const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.min(2.4, len * 0.45) + e.width, W = L * 0.5;
        const bx = x2 - L * Math.cos(ang), by = y2 - L * Math.sin(ang);
        const px = -Math.sin(ang) * W, py = Math.cos(ang) * W;
        head.setAttribute('d', len > 0.3 ? `M${x2},${y2} L${bx + px},${by + py} L${bx - px},${by - py} Z` : '');
        head.setAttribute('fill', s.color);
        head.setAttribute('opacity', s.reveal > 0.85 ? (s.reveal - 0.85) / 0.15 : 0);
      }
      if (label) {
        // Put the label beside the line (offset along its normal), not on top of it.
        const nx = len ? -(y2 - y1) / len : 0, ny = len ? (x2 - x1) / len : -1;
        const flip = ny > 0 ? -1 : 1;
        label.setAttribute('x', nx * 3 * flip); label.setAttribute('y', ny * 3 * flip);
        label.setAttribute('fill', s.color);
        label.setAttribute('opacity', len > 1 ? s.reveal : 0);
        label.textContent = e.label;
      }
    };
  },

  array(g, el, s0) {
    const n = el.values.length, size = el.cell * 0.9;
    const slotX = (i) => arraySlotX(el, i) - s0.x;
    const cells = el.values.map(() => {
      const cg = h('g', {}, g);
      const rect = h('rect', { x: -size / 2, y: -size / 2, width: size, height: size, rx: 1, 'stroke-width': 0.45 }, cg);
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
        c.rect.setAttribute('fill-opacity', 0.14);
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
      const rect = h('rect', { x: cx - bw / 2, width: bw, rx: 0.5 }, g);
      const val = h('text', { x: cx, 'text-anchor': 'middle', 'font-size': 2.8, fill: COLORS.text, 'font-family': 'var(--font-math)', 'font-weight': 600 }, g);
      val.textContent = v;
      if (el.labels[i]) {
        const lab = h('text', { x: cx, y: base + 3.4, 'text-anchor': 'middle', 'font-size': 2.8, fill: COLORS.text, 'font-family': 'var(--font-sans)' }, g);
        lab.textContent = el.labels[i];
      }
      return { rect, val, v };
    });
    return (s) => bars.forEach((b, i) => {
      const hgt = (Math.abs(b.v) / max) * usable * s.reveal;
      b.rect.setAttribute('y', base - hgt);
      b.rect.setAttribute('height', Math.max(0, hgt));
      b.rect.setAttribute('fill', s.cellColors[i]);
      b.rect.setAttribute('fill-opacity', 0.85);
      b.val.setAttribute('y', base - hgt - 1.6);
      b.val.setAttribute('opacity', s.reveal);
    });
  },

  plot(g, el, s0) {
    const m = plotMapper(el);
    const tx = (x) => m.sx(x) - s0.x, ty = (y) => m.sy(y) - s0.y;
    const clipId = `clip${++uid}`;
    const clip = h('clipPath', { id: clipId }, g);
    h('rect', { x: m.left - s0.x, y: m.top - s0.y, width: el.w, height: el.h }, clip);
    const axes = h('g', { stroke: COLORS.muted, 'stroke-width': 0.25 }, g);
    if (el.axes) {
      h('rect', { x: m.left - s0.x, y: m.top - s0.y, width: el.w, height: el.h, fill: 'none', 'stroke-opacity': 0.5 }, axes);
      const lbl = (x, y, text, anchor) => { const t = h('text', { x, y, 'text-anchor': anchor, 'font-size': 2.4, fill: COLORS.muted, stroke: 'none', 'font-family': 'var(--font-math)' }, g); t.textContent = text; };
      const r = (v) => String(Math.round(v * 10) / 10);
      lbl(tx(el.xmin), ty(m.ymin) + 3, r(el.xmin), 'start');
      lbl(tx(el.xmax), ty(m.ymin) + 3, r(el.xmax), 'end');
      lbl(tx(el.xmin) - 0.8, ty(m.ymax) + 1, r(m.ymax), 'end');
      lbl(tx(el.xmin) - 0.8, ty(m.ymin), r(m.ymin), 'end');
    }
    if (m.ymin < 0 && m.ymax > 0) h('line', { x1: tx(el.xmin), x2: tx(el.xmax), y1: ty(0), y2: ty(0), 'stroke-opacity': 0.9 }, axes);
    if (el.axes && el.xmin < 0 && el.xmax > 0) h('line', { x1: tx(0), x2: tx(0), y1: ty(m.ymin), y2: ty(m.ymax) }, axes);

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
    let area = null;
    if (el.points && el.fill) {
      const zero = ty(Math.max(m.ymin, Math.min(m.ymax, 0)));
      const pts = el.points.map(([x, y]) => `${tx(x).toFixed(2)},${ty(y).toFixed(2)}`).join(' L');
      area = h('path', { d: `M${tx(el.points[0][0])},${zero} L${pts} L${tx(el.points.at(-1)[0])},${zero} Z`, 'clip-path': `url(#${clipId})` }, g);
    }
    const curve = h('path', { d: d || 'M0,0', fill: 'none', 'stroke-width': 0.6, pathLength: 1, 'clip-path': `url(#${clipId})`, 'stroke-linejoin': 'round', 'stroke-dasharray': '1' }, g);
    const guide = el.marker ? h('line', { 'stroke-width': 0.25, 'stroke-dasharray': '0.8 0.8' }, g) : null;
    const dot = el.marker ? h('circle', { r: 1.1 }, g) : null;
    return (s, e) => {
      curve.setAttribute('stroke', s.color);
      curve.setAttribute('stroke-dashoffset', 1 - s.reveal);
      if (area) { area.setAttribute('fill', e.fill); area.setAttribute('fill-opacity', 0.16 * Math.max(0, s.reveal * 1.4 - 0.4)); }
      axes.setAttribute('opacity', Math.min(1, 0.3 + s.reveal * 2));
      if (dot) {
        const mx = e.markerValue;
        const ok = Number.isFinite(mx) && mx >= el.xmin && mx <= el.xmax && s.reveal > 0.95;
        const my = ok ? m.valueAt(mx) : 0;
        dot.setAttribute('opacity', ok ? 1 : 0); guide.setAttribute('opacity', ok ? 0.8 : 0);
        if (ok) {
          dot.setAttribute('cx', tx(mx)); dot.setAttribute('cy', ty(Math.max(m.ymin, Math.min(m.ymax, my))));
          dot.setAttribute('fill', COLORS.bad);
          guide.setAttribute('x1', tx(mx)); guide.setAttribute('x2', tx(mx));
          guide.setAttribute('y1', ty(m.ymin)); guide.setAttribute('y2', ty(m.ymax)); guide.setAttribute('stroke', COLORS.bad);
        }
      }
    };
  },
};
VIEWS.arrow = VIEWS.line;

const DEFAULT_ENTER = { line: 'draw', arrow: 'draw', plot: 'draw', circle: 'draw', box: 'grow', point: 'grow', text: 'write', array: 'grow', bars: 'grow' };

/** Builds a mounted item: a <g> plus an update(frameState) function. */
function mount(layer, el, scope, names) {
  const e0 = resolveElement(el, scope, names);
  const s0 = elementState(e0, [], 0);
  const g = h('g', {}, layer);
  return { el, g, update: VIEWS[el.type](g, e0, s0) };
}

function paint(item, scope, names, actions, t, { dim = 1, focus = false } = {}) {
  const e = resolveElement(item.el, scope, names);
  if (item.el.marker) e.markerValue = compileCached(item.el.marker, names)(scope);
  const s = elementState(e, actions, t);
  if (focus) s.glow = Math.max(s.glow, 0.55 + 0.25 * Math.sin(scope.t * 4));
  item.g.setAttribute('transform', `translate(${s.x} ${s.y}) rotate(${e.rot || 0}) scale(${s.scale})`);
  item.g.setAttribute('opacity', s.opacity * dim);
  item.g.style.filter = s.glow > 0.01 ? `drop-shadow(0 0 ${0.6 + s.glow * 1.6}px ${s.color})` : '';
  item.update(s, e);
}

/** Owns the SVG: grid background, persistent diagram, step panel, captions. */
export class StageRenderer {
  constructor(svg) {
    this.svg = svg;
    svg.setAttribute('viewBox', `0 0 ${STAGE.w} ${STAGE.h}`);
    svg.replaceChildren();
    const defs = h('defs', {}, svg);
    const minor = h('pattern', { id: 'gridMinor', width: 4, height: 4, patternUnits: 'userSpaceOnUse' }, defs);
    h('path', { d: 'M4 0H0V4', fill: 'none', stroke: 'var(--grid-minor)', 'stroke-width': 0.12 }, minor);
    const major = h('pattern', { id: 'gridMajor', width: 20, height: 20, patternUnits: 'userSpaceOnUse' }, defs);
    h('rect', { width: 20, height: 20, fill: 'url(#gridMinor)' }, major);
    h('path', { d: 'M20 0H0V20', fill: 'none', stroke: 'var(--grid-major)', 'stroke-width': 0.2 }, major);
    h('rect', { width: STAGE.w, height: STAGE.h, fill: 'var(--stage-bg)' }, svg);
    this.grid = h('rect', { width: STAGE.w, height: STAGE.h, fill: 'url(#gridMajor)' }, svg);
    this.panelBg = h('g', {}, svg);
    this.diagramLayer = h('g', {}, svg);
    this.sceneLayer = h('g', {}, svg);
    this.chrome = h('g', {}, svg);
  }

  setScript(script) {
    this.script = script;
    this.names = [...BASE_VARS, ...Object.keys(script.diagram?.vars ?? {})];
    this.diagramLayer.replaceChildren();
    this.panelBg.replaceChildren();
    this.chrome.replaceChildren();
    const scope = { t: 0, s: 0 };
    for (const k of Object.keys(script.diagram?.vars ?? {})) scope[k] = 0;
    this.diagramItems = (script.diagram?.elements ?? []).map((el) => mount(this.diagramLayer, el, scope, this.names));
    const split = !!script.diagram;
    this.grid.setAttribute('width', split ? PANEL_X : STAGE.w);
    if (split) {
      h('rect', { x: PANEL_X, y: 0, width: STAGE.w - PANEL_X, height: STAGE.h, fill: 'var(--panel-bg)' }, this.panelBg);
      h('line', { x1: PANEL_X, y1: 0, x2: PANEL_X, y2: STAGE.h, stroke: 'var(--panel-rule)', 'stroke-width': 0.35 }, this.panelBg);
      h('rect', { x: PANEL_X, y: 0, width: STAGE.w - PANEL_X, height: 13, fill: 'var(--panel-head)' }, this.panelBg);
      this.stepNo = h('text', { x: PANEL_X + 4, y: 5.2, 'font-size': 2.4, 'font-weight': 700, 'letter-spacing': 0.3, fill: 'var(--panel-head-ink)', 'font-family': 'var(--font-sans)' }, this.chrome);
      this.caption = h('text', { x: PANEL_X + 4, y: 9.8, 'font-size': 3.6, 'font-weight': 700, fill: '#ffffff', 'font-family': 'var(--font-sans)' }, this.chrome);
      const fig = h('text', { x: 4, y: 5, 'font-size': 2.4, fill: COLORS.muted, 'font-family': 'var(--font-sans)', 'font-style': 'italic' }, this.chrome);
      fig.textContent = script.diagram.title ? `Fig. — ${script.diagram.title}` : '';
    } else {
      this.stepNo = h('text', { x: 6, y: 6, 'font-size': 2.4, 'font-weight': 700, 'letter-spacing': 0.3, fill: COLORS.primary, 'font-family': 'var(--font-sans)' }, this.chrome);
      this.caption = h('text', { x: 6, y: 10.5, 'font-size': 4, 'font-weight': 700, fill: COLORS.text, 'font-family': 'var(--font-sans)' }, this.chrome);
    }
  }

  showScene(entry) {
    this.entry = entry;
    this.sceneLayer.replaceChildren();
    const scope = { t: entry.start, s: 0 };
    for (const k of Object.keys(this.script.diagram?.vars ?? {})) scope[k] = 0;
    this.sceneItems = entry.scene.elements.map((el) => mount(this.sceneLayer, el, scope, this.names));
    this.stepNo.textContent = `STEP ${entry.index + 1} OF ${this.script.scenes.length}`;
    this.caption.textContent = entry.scene.caption || '';
    this.sceneLayer.animate?.([{ opacity: 0, transform: 'translateX(1.5px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
  }

  render(local, scope) {
    const { scene, index } = this.entry;
    const focus = new Set(scene.focus);
    for (const item of this.diagramItems) {
      const el = item.el;
      const visible = index >= el.from && index <= el.until;
      item.g.style.display = visible ? '' : 'none';
      if (!visible) continue;
      const enter = index === el.from ? [{ do: el.enter || DEFAULT_ENTER[el.type], target: el.id, at: el.at ?? 0.3, dur: el.type === 'plot' ? 2 : 0.9 }] : [];
      const acts = enter.concat(scene.actions.filter((a) => a.target === el.id)).sort((a, b) => a.at - b.at);
      paint(item, scope, this.names, acts, local, { focus: focus.has(el.id), dim: focus.size && !focus.has(el.id) ? 0.38 : 1 });
    }
    for (const item of this.sceneItems) paint(item, scope, this.names, scene.actions, local);
  }
}
