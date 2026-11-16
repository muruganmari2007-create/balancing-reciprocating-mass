// Offline "solvers": plain code that solves a problem AND writes the Animex Script
// for it. Zero API cost, fully deterministic, always correct for what they cover.
import { tryCompile } from '../../public/engine/math.js';
import { arraySlotX, plotMapper } from '../../public/engine/geometry.js';

const fmt = (n) => {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(Math.round(n * 1000) / 1000);
};
const fmtLinear = (a, b) => {
  const parts = [];
  if (Math.abs(a) > 1e-12) parts.push(a === 1 ? 'x' : a === -1 ? '−x' : `${fmt(a)}x`.replace('-', '−'));
  if (Math.abs(b) > 1e-12 || !parts.length) {
    if (!parts.length) parts.push(fmt(b).replace('-', '−'));
    else parts.push(b < 0 ? `− ${fmt(-b)}` : `+ ${fmt(b)}`);
  }
  return parts.join(' ');
};

// ---------------------------------------------------------------- linear equations
function asLinear(side) {
  const f = tryCompile(side);
  if (!f) return null;
  const b = f(0), a = f(1) - b;
  if (![a, b].every(Number.isFinite) || Math.abs(f(2.5) - (2.5 * a + b)) > 1e-9 || Math.abs(f(-3) - (-3 * a + b)) > 1e-9) return null;
  return { a, b };
}

export function solveLinear(question) {
  const m = question.match(/([-+*/^().\d\sx]+)=([-+*/^().\d\sx]+)/i);
  if (!m || !/x/i.test(m[0])) return null;
  const L = asLinear(m[1]), R = asLinear(m[2]);
  if (!L || !R) return null;
  const A = L.a - R.a, B = R.b - L.b;
  if (Math.abs(A) < 1e-12) return null;
  const x = B / A;
  const original = `${fmtLinear(L.a, L.b)} = ${fmtLinear(R.a, R.b)}`;
  const scenes = [];

  scenes.push({
    caption: 'Keep it balanced',
    narration: `We want the value of x that makes ${original.replace(/−/g, 'minus ')} true. Think of the equals sign as a balance: whatever we do to one side, we do to the other.`,
    elements: [
      { id: 'eq', type: 'text', text: original, x: 80, y: 30, size: 8, font: 'math' },
      { id: 'beam', type: 'line', x1: 30, y1: 62, x2: 130, y2: 62, color: 'muted', width: 1 },
      { id: 'post', type: 'line', x1: 80, y1: 62, x2: 80, y2: 80, color: 'muted', width: 1 },
      { id: 'l', type: 'box', x: 48, y: 54, w: 34, h: 12, label: fmtLinear(L.a, L.b), fill: 'primary' },
      { id: 'r', type: 'box', x: 112, y: 54, w: 34, h: 12, label: fmtLinear(R.a, R.b), fill: 'accent' },
    ],
    actions: [
      { do: 'write', target: 'eq', at: 0, dur: 1.4 },
      { do: 'draw', target: 'post', at: 1.6 }, { do: 'draw', target: 'beam', at: 2 },
      { do: 'grow', target: 'l', at: 2.8 }, { do: 'grow', target: 'r', at: 3.3 },
      { do: 'pulse', target: 'beam', at: 4.4 },
    ],
  });

  let cur = { a: L.a, b: L.b, ra: R.a, rb: R.b };
  const step = (caption, narration, op, next) => {
    const before = `${fmtLinear(cur.a, cur.b)} = ${fmtLinear(cur.ra, cur.rb)}`;
    cur = next;
    const after = `${fmtLinear(cur.a, cur.b)} = ${fmtLinear(cur.ra, cur.rb)}`;
    scenes.push({
      caption, narration,
      elements: [
        { id: 'eq', type: 'text', text: before, x: 80, y: 40, size: 8, font: 'math' },
        { id: 'op', type: 'text', text: op, x: 80, y: 60, size: 4.5, color: 'warn' },
      ],
      actions: [
        { do: 'appear', target: 'eq', at: 0, dur: 0.5 },
        { do: 'write', target: 'op', at: 0.9, dur: 1 },
        { do: 'pulse', target: 'eq', at: 2.1 },
        { do: 'change', target: 'eq', text: after, at: 2.8, dur: 1 },
        { do: 'fade', target: 'op', at: 4.2 },
      ],
    });
  };

  if (Math.abs(R.a) > 1e-12) {
    const k = R.a;
    step('Gather the x terms', `First collect every x on the left. ${k > 0 ? 'Subtract' : 'Add'} ${fmt(Math.abs(k))} x on both sides.`,
      `${k > 0 ? '−' : '+'} ${fmt(Math.abs(k)) === '1' ? '' : fmt(Math.abs(k))}x on both sides`,
      { a: A, b: L.b, ra: 0, rb: R.b });
  }
  if (Math.abs(cur.b) > 1e-12) {
    const k = cur.b;
    step('Move the constant', `Now ${k > 0 ? 'subtract' : 'add'} ${fmt(Math.abs(k))} on both sides so only the x term is left on the left.`,
      `${k > 0 ? '−' : '+'} ${fmt(Math.abs(k))} on both sides`,
      { a: A, b: 0, ra: 0, rb: B });
  }
  if (Math.abs(A - 1) > 1e-12) {
    step('Divide it out', `Finally divide both sides by ${fmt(A)} to get x on its own.`,
      `÷ ${fmt(A)} on both sides`, { a: 1, b: 0, ra: 0, rb: x });
  }

  const lhs = L.a * x + L.b;
  scenes.push({
    caption: 'Check the answer',
    narration: `So x equals ${fmt(x)}. Plug it back in: the left side gives ${fmt(lhs)} and so does the right side, so it checks out.`,
    elements: [
      { id: 'ans', type: 'box', x: 80, y: 34, w: 50, h: 16, label: `x = ${fmt(x)}`, fill: 'good', size: 6 },
      { id: 'chk', type: 'text', text: `${fmt(lhs)} = ${fmt(R.a * x + R.b)}  ✓`, x: 80, y: 62, size: 6, font: 'math', color: 'good' },
    ],
    actions: [
      { do: 'grow', target: 'ans', at: 0.2 },
      { do: 'write', target: 'chk', at: 2, dur: 1.2 },
      { do: 'pulse', target: 'ans', at: 3.8 },
    ],
  });

  return {
    title: `Solving ${original}`,
    answer: `x = ${fmt(x)}`,
    steps: scenes.slice(1, -1).map((s) => s.narration).concat(`Check: both sides equal ${fmt(lhs)}.`),
    scenes,
  };
}

// ---------------------------------------------------------------- bubble sort
function parseNumbers(q) {
  const list = q.match(/\[([^\]]+)\]/)?.[1] ?? q.replace(/^[^\d-]*/, '');
  const nums = (list.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  return nums;
}

export function solveSort(question) {
  if (!/\bsort/i.test(question)) return null;
  const arr = parseNumbers(question).slice(0, 8);
  if (arr.length < 2) return null;
  const a = [...arr];
  const scenes = [{
    caption: 'Bubble sort',
    narration: 'Bubble sort walks through the list comparing neighbours. Whenever a pair is out of order, it swaps them, so big values bubble to the end.',
    elements: [{ id: 'arr', type: 'array', values: a.map(String), x: 80, y: 46 }],
    actions: [{ do: 'grow', target: 'arr', at: 0.2 }, { do: 'pulse', target: 'arr', at: 2.2 }],
  }];
  let totalSwaps = 0;
  for (let pass = 0; pass < a.length - 1; pass++) {
    const actions = [];
    let t = 0.4, swapped = false;
    const startValues = a.map(String);
    for (let j = 0; j < a.length - 1 - pass; j++) {
      actions.push({ do: 'highlight', target: `arr[${j}]`, color: 'warn', at: t, dur: 0.3 });
      actions.push({ do: 'highlight', target: `arr[${j + 1}]`, color: 'warn', at: t, dur: 0.3 });
      if (a[j] > a[j + 1]) {
        actions.push({ do: 'swap', target: 'arr', i: j, j: j + 1, at: t + 0.5, dur: 0.7 });
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true; totalSwaps++;
        t += 0.7;
      }
      actions.push({ do: 'highlight', target: `arr[${j}]`, color: 'primary', at: t + 0.6, dur: 0.3 });
      actions.push({ do: 'highlight', target: `arr[${j + 1}]`, color: 'primary', at: t + 0.6, dur: 0.3 });
      t += 1;
    }
    const done = a.length - 1 - pass;
    for (let k = done; k < a.length; k++) actions.push({ do: 'highlight', target: `arr[${k}]`, color: 'good', at: t, dur: 0.4 });
    scenes.push({
      caption: `Pass ${pass + 1}`,
      narration: swapped
        ? `Pass ${pass + 1}: compare each neighbouring pair and swap when the left one is bigger. ${a[done]} is now locked in place.`
        : `Pass ${pass + 1}: no swaps at all, so the list is already sorted and we can stop early.`,
      elements: [{ id: 'arr', type: 'array', values: startValues, x: 80, y: 46 }],
      actions,
    });
    if (!swapped) break;
  }
  scenes.push({
    caption: 'Sorted!',
    narration: `Done. The sorted list is ${a.join(', ')}, using ${totalSwaps} swaps. Bubble sort takes about n squared comparisons in the worst case.`,
    elements: [
      { id: 'arr', type: 'array', values: a.map(String), x: 80, y: 40, color: 'good' },
      { id: 'cx', type: 'text', text: 'Time: O(n²)   Space: O(1)', x: 80, y: 66, size: 4.5, color: 'muted' },
    ],
    actions: [{ do: 'grow', target: 'arr', at: 0.2 }, { do: 'write', target: 'cx', at: 1.6 }],
  });
  return {
    title: `Bubble sort of [${arr.join(', ')}]`,
    answer: `[${a.join(', ')}] (${totalSwaps} swaps)`,
    steps: scenes.slice(1, -1).map((s) => s.narration),
    scenes,
  };
}

// ---------------------------------------------------------------- binary search
export function solveBinarySearch(question) {
  if (!/binary\s*search/i.test(question)) return null;
  const target = Number(question.match(/(?:for|find)\s+(-?\d+(\.\d+)?)/i)?.[1]);
  const list = (question.match(/\[([^\]]+)\]/)?.[1].match(/-?\d+(\.\d+)?/g) || []).map(Number);
  if (!Number.isFinite(target) || list.length < 2) return null;
  const arr = [...list].sort((p, q) => p - q).slice(0, 12);
  const base = { id: 'arr', type: 'array', values: arr.map(String), x: 80, y: 42 };
  const scenes = [{
    caption: 'Binary search',
    narration: `We look for ${target} in a sorted list. Instead of checking every item, we look at the middle and throw away the half that cannot contain it.`,
    elements: [base, { id: 'tg', type: 'text', text: `target = ${target}`, x: 80, y: 22, size: 5, color: 'warn', font: 'math' }],
    actions: [{ do: 'grow', target: 'arr', at: 0.2 }, { do: 'write', target: 'tg', at: 1.4 }],
  }];
  let lo = 0, hi = arr.length - 1, found = -1, iter = 0;
  while (lo <= hi && iter < 8) {
    iter++;
    const mid = Math.floor((lo + hi) / 2);
    const px = (i) => arraySlotX({ ...base, cell: Math.min(12, 140 / arr.length) }, i);
    const elements = [
      { ...base },
      { id: 'lo', type: 'text', text: 'lo', x: px(lo), y: 56, size: 3.5, color: 'primary' },
      { id: 'hi', type: 'text', text: 'hi', x: px(hi), y: 56, size: 3.5, color: 'primary' },
      { id: 'mid', type: 'arrow', x1: px(mid), y1: 70, x2: px(mid), y2: 52, color: 'warn' },
      { id: 'cmp', type: 'text', text: '', x: 80, y: 80, size: 4.5, font: 'math' },
    ];
    const actions = [];
    arr.forEach((_, i) => { if (i < lo || i > hi) actions.push({ do: 'highlight', target: `arr[${i}]`, color: 'muted', at: 0, dur: 0.1 }); });
    actions.push({ do: 'appear', target: 'lo', at: 0.3 }, { do: 'appear', target: 'hi', at: 0.3 });
    actions.push({ do: 'draw', target: 'mid', at: 1 }, { do: 'highlight', target: `arr[${mid}]`, color: 'warn', at: 1.4 });
    let narration;
    if (arr[mid] === target) {
      found = mid;
      actions.push({ do: 'change', target: 'cmp', text: `${arr[mid]} = ${target}  → found at index ${mid}`, at: 2.2 });
      actions.push({ do: 'highlight', target: `arr[${mid}]`, color: 'good', at: 3 }, { do: 'pulse', target: 'arr', at: 3.4 });
      narration = `The middle item, index ${mid}, is ${arr[mid]}. That is our target, so we found it after ${iter} checks.`;
    } else if (arr[mid] < target) {
      actions.push({ do: 'change', target: 'cmp', text: `${arr[mid]} < ${target}  → search right half`, at: 2.2 });
      for (let i = lo; i <= mid; i++) actions.push({ do: 'highlight', target: `arr[${i}]`, color: 'muted', at: 3.4, dur: 0.5 });
      narration = `The middle item is ${arr[mid]}, smaller than ${target}, so everything left of it is too small. Move lo to index ${mid + 1}.`;
      lo = mid + 1;
    } else {
      actions.push({ do: 'change', target: 'cmp', text: `${arr[mid]} > ${target}  → search left half`, at: 2.2 });
      for (let i = mid; i <= hi; i++) actions.push({ do: 'highlight', target: `arr[${i}]`, color: 'muted', at: 3.4, dur: 0.5 });
      narration = `The middle item is ${arr[mid]}, bigger than ${target}, so everything right of it is too big. Move hi to index ${mid - 1}.`;
      hi = mid - 1;
    }
    scenes.push({ caption: `Step ${iter}`, narration, elements, actions });
    if (found >= 0) break;
  }
  const answer = found >= 0 ? `${target} is at index ${found} (after ${iter} comparisons)` : `${target} is not in the list (${iter} comparisons)`;
  if (found < 0) {
    scenes.push({
      caption: 'Not found',
      narration: `lo passed hi, so the search space is empty: ${target} is not in the list.`,
      elements: [{ id: 'nf', type: 'text', text: answer, x: 80, y: 45, size: 5, color: 'bad' }],
      actions: [{ do: 'write', target: 'nf', at: 0.2 }],
    });
  }
  return { title: `Binary search for ${target}`, answer, steps: scenes.slice(1).map((s) => s.narration), scenes };
}

// ---------------------------------------------------------------- function plots
export function solvePlot(question) {
  const m = question.match(/(?:plot|graph|sketch|draw)\s+(?:of\s+)?(?:y\s*=\s*|f\(x\)\s*=\s*)?(.+?)(?:\s+(?:from|for|between)\b.*)?$/i);
  if (!m) return null;
  const fnText = m[1].trim().replace(/[?.!]+$/, '');
  const f = tryCompile(fnText);
  if (!f) return null;
  const plot = { id: 'p', type: 'plot', fn: fnText, xmin: -6, xmax: 6, x: 80, y: 50, w: 120, h: 62 };
  const map = plotMapper(plot);
  plot.ymin = map.ymin; plot.ymax = map.ymax;

  // Roots by sign change scan + bisection.
  const roots = [];
  const N = 600, step = (plot.xmax - plot.xmin) / N;
  // A root sitting exactly on a grid point is seen by both neighbouring intervals: dedupe.
  const addRoot = (r) => { if (!roots.some((q) => Math.abs(q - r) < step * 1.5)) roots.push(r); };
  for (let k = 0; k < N && roots.length < 5; k++) {
    let a = plot.xmin + step * k, b = a + step;
    let fa = f(a), fb = f(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
    if (fa === 0) { addRoot(a); continue; }
    if (fa * fb < 0 && Math.abs(fa - fb) < (map.ymax - map.ymin)) {
      for (let it = 0; it < 50; it++) { const c = (a + b) / 2, fc = f(c); if (fa * fc <= 0) { b = c; fb = fc; } else { a = c; fa = fc; } }
      addRoot((a + b) / 2);
    }
  }
  const y0 = f(0);
  const scenes = [{
    caption: 'The curve',
    narration: `Here is y equals ${fnText}. For every x we compute y and connect the points into a curve.`,
    elements: [plot, { id: 'lbl', type: 'text', text: `y = ${fnText}`, x: 30, y: 22, size: 4.5, font: 'math', color: 'primary', align: 'start' }],
    actions: [{ do: 'draw', target: 'p', at: 0.3, dur: 3 }, { do: 'write', target: 'lbl', at: 0.6 }],
  }];
  const pts = roots.map((r, i) => ({ id: `r${i}`, type: 'point', x: map.sx(r), y: map.sy(0), label: `x≈${fmt(r)}`, color: 'good' }));
  if (pts.length) {
    scenes.push({
      caption: 'Where it crosses zero',
      narration: `The curve crosses the x axis ${pts.length === 1 ? 'once' : `${pts.length} times`} in this window, at ${roots.map(fmt).join(' and ')}. Those are the roots, where y equals zero.`,
      elements: [{ ...plot }, ...pts],
      actions: pts.map((p, i) => ({ do: 'grow', target: p.id, at: 0.6 + i * 0.8 })),
    });
  }
  if (Number.isFinite(y0) && y0 >= map.ymin && y0 <= map.ymax) {
    scenes.push({
      caption: 'The y-intercept',
      narration: `At x equals zero the curve passes through y equals ${fmt(y0)}. That is the y intercept.`,
      elements: [{ ...plot }, { id: 'yi', type: 'point', x: map.sx(0), y: map.sy(y0), label: `(0, ${fmt(y0)})`, color: 'warn' }],
      actions: [{ do: 'grow', target: 'yi', at: 0.6 }, { do: 'pulse', target: 'yi', at: 1.8 }],
    });
  }
  return {
    title: `Graph of y = ${fnText}`,
    answer: `${roots.length ? `Roots near x = ${roots.map(fmt).join(', ')}` : 'No roots in [-6, 6]'}${Number.isFinite(y0) ? `; y-intercept ${fmt(y0)}` : ''}.`,
    steps: scenes.map((s) => s.narration),
    scenes,
  };
}
