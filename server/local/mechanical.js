// Mechanical-engineering syllabus solvers (Theory of Machines / Dynamics of Machinery,
// Strength of Materials, Design of Transmission Elements). Each one: parse the question,
// solve it the textbook way, and storyboard an Animex Script.
import { clean, quantities, lengths, masses, degrees, rpms, forces, near, fraction, sig, force } from './parse.js';
import { plotMapper } from '../../public/engine/geometry.js';

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const mm = (m) => sig(m * 1000);
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n) => String(n).split('').map((d) => SUB[d]).join('');
const fracText = (c) => [[2 / 3, '2/3'], [0.75, '3/4'], [1 / 3, '1/3'], [0.5, '1/2'], [0.25, '1/4'], [1, '1']]
  .find(([v]) => Math.abs(v - c) < 1e-9)?.[1] ?? sig(c, 3);

const textLines = (lines, { x = 14, y = 22, dy = 8, size = 3.8, at = 0.3, gap = 0.9, font = 'math' } = {}) => {
  const elements = [], actions = [];
  lines.forEach((l, i) => {
    const { text, color } = typeof l === 'string' ? { text: l } : l;
    elements.push({ id: `ln${i}`, type: 'text', text, x, y: y + i * dy, size, font, align: 'start', color });
    actions.push({ do: 'write', target: `ln${i}`, at: at + i * gap, dur: 0.8 });
  });
  return { elements, actions };
};

// ============================================================ 1. Balancing of reciprocating masses
export function solveReciprocating(question) {
  if (!/reciprocat/i.test(question) || !/balanc|unbalanc|primary|secondary/i.test(question)) return null;
  const q = clean(question);
  const L = lengths(q), M = masses(q), D = degrees(q), RPM = rpms(q);
  const assumed = [];

  let N = RPM[0]?.v, omega;
  const radps = quantities(q, 'rad\\s*\\/\\s*s')[0];
  if (N) omega = (2 * Math.PI * N) / 60;
  else if (radps) { omega = radps.v; N = (omega * 60) / (2 * Math.PI); }
  else { N = 240; omega = 8 * Math.PI; assumed.push('N = 240 rpm'); }

  const strokeQ = near(q, /stroke/i, L);
  const crankQ = near(q, /crank\s+(radius|length)|radius of (the )?crank/i, L);
  const rodQ = near(q, /connecting\s+rod/i, L, { after: 40 });
  const r1Q = near(q, /revolving|rotating/i, L, { after: 30, before: 0 });
  const bQ = near(q, /balanc|counter/i, L, { after: 140 }) ?? L.find((x) => !x.used);
  const mQ = near(q, /reciprocating\s+(parts|masses?)|mass(es)? of (the )?reciprocating( parts)?/i, M, { after: 50 });
  const m1Q = near(q, /revolving\s+(parts|masses?)|rotating\s+(parts|masses?)|mass(es)? of (the )?(revolving|rotating)( parts)?/i, M, { after: 60 });
  const thQ = near(q, /crank|rotated|turned|dead\s+cent|[it]dc|angle/i, D, { after: 80, before: 60 }) ?? D[0];
  const ratioM = q.match(/(?:obliquity|connecting rod to (?:the )?crank|\bn\s*=)[^.\d]{0,40}(\d+(?:\.\d+)?)/i);

  const r = crankQ?.si ?? (strokeQ ? strokeQ.si / 2 : (assumed.push('stroke = 300 mm'), 0.15));
  const m = mQ?.v ?? M.find((x) => !x.used)?.v ?? (assumed.push('m = 50 kg'), 50);
  const m1 = m1Q?.v ?? 0;
  const r1 = r1Q?.si ?? r;
  const b = bQ?.si ?? (assumed.push('b = r'), r);
  let c = fraction(q);
  if (c == null) { c = 2 / 3; assumed.push('c = 2/3 (usual for locomotives)'); }
  const n = rodQ ? rodQ.si / r : ratioM ? parseFloat(ratioM[1]) : null;
  const theta = thQ?.v ?? null;

  const A = m * omega * omega * r; // max primary force without balancing
  const Bb = c * m * r + m1 * r1;
  const B = Bb / b;
  const shownTheta = theta ?? (1 - c >= c ? 0 : 90);
  const Fh = (1 - c) * A * Math.cos(rad(shownTheta));
  const Fv = c * A * Math.sin(rad(shownTheta));
  const FR = Math.hypot(Fh, Fv);
  const Fs = n ? (A * Math.cos(rad(2 * shownTheta))) / n : null;
  const thLabel = theta != null ? `θ = ${sig(theta)}°` : `θ = ${shownTheta}° (worst case)`;

  // ---------- scene 1: slider-crank mechanism
  const O = { x: 36, y: 54 }, Rd = 15, th = rad(shownTheta);
  const Ax = O.x + Rd * Math.cos(th), Ay = O.y - Rd * Math.sin(th);
  const Ld = Math.min(84, Rd * (n ?? 4));
  const Bx = Ax + Math.sqrt(Ld * Ld - (Rd * Math.sin(th)) ** 2);
  const mech = {
    caption: 'The slider-crank',
    narration: `The crank O A of radius ${mm(r)} millimetres turns at ${sig(N)} r p m, and the connecting rod drives the piston, whose reciprocating mass is ${sig(m)} kilograms. To balance it we fix a balance mass B on the crank, exactly opposite the crank pin.`,
    elements: [
      { id: 'los', type: 'line', x1: 12, y1: O.y, x2: 152, y2: O.y, dashed: true, color: 'muted', width: 0.3 },
      { id: 'circ', type: 'circle', x: O.x, y: O.y, r: Rd, color: 'muted' },
      { id: 'cyl1', type: 'line', x1: Bx - 10, y1: O.y - 6.5, x2: 152, y2: O.y - 6.5, color: 'muted', width: 0.6 },
      { id: 'cyl2', type: 'line', x1: Bx - 10, y1: O.y + 6.5, x2: 152, y2: O.y + 6.5, color: 'muted', width: 0.6 },
      { id: 'crank', type: 'line', x1: O.x, y1: O.y, x2: Ax, y2: Ay, color: 'primary', width: 1.3, label: 'r' },
      { id: 'rod', type: 'line', x1: Ax, y1: Ay, x2: Bx, y2: O.y, color: 'accent', width: 1, label: 'l' },
      { id: 'pist', type: 'box', x: Bx, y: O.y, w: 12, h: 11, label: 'm', fill: 'warn' },
      { id: 'bal', type: 'circle', x: O.x - 0.8 * Rd * Math.cos(th), y: O.y + 0.8 * Rd * Math.sin(th), r: 4, label: 'B', fill: 'good', size: 3 },
      { id: 'O', type: 'point', x: O.x, y: O.y, label: 'O', color: 'text' },
      { id: 'th', type: 'text', text: thLabel, x: O.x + 4, y: O.y - Rd - 5, size: 3.4, align: 'start', color: 'primary' },
      { id: 'w', type: 'text', text: `ω = 2πN/60 = ${sig(omega)} rad/s`, x: O.x, y: 80, size: 3.4, font: 'math', color: 'muted' },
    ],
    actions: [
      { do: 'draw', target: 'los', at: 0.2 }, { do: 'draw', target: 'circ', at: 0.6, dur: 1 },
      { do: 'draw', target: 'crank', at: 1.4 }, { do: 'draw', target: 'rod', at: 2.1 },
      { do: 'draw', target: 'cyl1', at: 2.6 }, { do: 'draw', target: 'cyl2', at: 2.6 },
      { do: 'grow', target: 'pist', at: 3 }, { do: 'write', target: 'th', at: 3.6 }, { do: 'write', target: 'w', at: 4.2 },
      { do: 'grow', target: 'bal', at: 5.2 }, { do: 'pulse', target: 'bal', at: 6.2 },
    ],
  };

  // ---------- scene 2: given data
  const given = [
    `N = ${sig(N)} rpm  →  ω = ${sig(omega)} rad/s`,
    `r = ${mm(r)} mm${strokeQ && !crankQ ? `  (stroke ${mm(strokeQ.si)} mm ÷ 2)` : ''}`,
    `m = ${sig(m)} kg  (reciprocating parts)`,
    ...(m1 ? [`m${sub(1)} = ${sig(m1)} kg at r${sub(1)} = ${mm(r1)} mm  (revolving parts)`] : []),
    `c = ${fracText(c)}  (fraction of m to balance)`,
    `b = ${mm(b)} mm  (radius of balance mass)`,
    ...(theta != null ? [`θ = ${sig(theta)}° from dead centre`] : []),
    ...(n ? [`n = l / r = ${sig(n, 3)}`] : []),
    ...(assumed.length ? [{ text: `Assumed: ${assumed.join(', ')}`, color: 'warn' }] : []),
  ];
  const g = textLines(given, { y: 22, dy: Math.min(8, 62 / given.length) });
  const givenScene = { caption: 'Given data', narration: `Let us list what we know. The angular speed is 2 pi N over 60, which is ${sig(omega, 3)} radians per second, and the crank radius is half the stroke, ${mm(r)} millimetres.`, ...g };

  // ---------- scene 3: balance mass
  const subst = `B × ${sig(b)} = ${fracText(c)} × ${sig(m)} × ${sig(r)}${m1 ? ` + ${sig(m1)} × ${sig(r1)}` : ''}`;
  const massScene = {
    caption: 'Find the balance mass',
    narration: `The balance mass must cancel ${m1 ? 'all the revolving mass plus ' : ''}the fraction ${fracText(c)} of the reciprocating mass. Taking moments of mass about O: B times b equals c m r${m1 ? ' plus m1 r1' : ''}. So B equals ${sig(B, 3)} kilograms.`,
    elements: [
      { id: 'f', type: 'text', text: `B·b = c·m·r${m1 ? ` + m${sub(1)}·r${sub(1)}` : ''}`, x: 80, y: 26, size: 6.5, font: 'math', bold: true },
      { id: 's', type: 'text', text: subst, x: 80, y: 44, size: 4.2, font: 'math', color: 'muted' },
      { id: 'ans', type: 'box', x: 80, y: 66, w: 56, h: 13, label: `B = ${sig(B)} kg`, fill: 'good', size: 5 },
    ],
    actions: [
      { do: 'write', target: 'f', at: 0.2, dur: 1.3 }, { do: 'write', target: 's', at: 1.9, dur: 1.4 },
      { do: 'change', target: 's', text: `B × ${sig(b)} = ${sig(Bb)}  kg·m`, at: 4, dur: 0.9 },
      { do: 'grow', target: 'ans', at: 5.3 }, { do: 'pulse', target: 'ans', at: 6.4 },
    ],
  };

  // ---------- scene 4: unbalanced forces as vectors
  const P = { x: 118, y: 52 }, s = 27 / (FR || 1);
  const tip = { x: P.x + Fh * s, y: P.y - Fv * s };
  const forceScene = {
    caption: 'Residual unbalanced force',
    narration: `Balancing is a trade. Along the line of stroke, (1 minus c) m omega squared r cos theta remains: ${force(Fh)}. But the balance mass adds c m omega squared r sin theta perpendicular to the stroke: ${force(Fv)}. Their resultant is ${force(FR)}${theta == null ? ', the largest it ever gets' : ''}.`,
    elements: [
      { id: 't1', type: 'text', text: 'Along stroke: (1−c)·m·ω²·r·cosθ', x: 8, y: 24, size: 3.3, font: 'math', align: 'start' },
      { id: 'v1', type: 'text', text: `= ${force(Fh)}`, x: 14, y: 31, size: 3.8, font: 'math', align: 'start', color: 'warn' },
      { id: 't2', type: 'text', text: 'Perpendicular: c·m·ω²·r·sinθ', x: 8, y: 42, size: 3.3, font: 'math', align: 'start' },
      { id: 'v2', type: 'text', text: `= ${force(Fv)}`, x: 14, y: 49, size: 3.8, font: 'math', align: 'start', color: 'accent' },
      { id: 't3', type: 'text', text: 'Resultant: √(F∥² + F⊥²)', x: 8, y: 60, size: 3.3, font: 'math', align: 'start' },
      { id: 'v3', type: 'text', text: `= ${force(FR)}`, x: 14, y: 67, size: 4.4, font: 'math', align: 'start', color: 'bad', bold: true },
      { id: 'fh', type: 'arrow', x1: P.x, y1: P.y, x2: tip.x, y2: P.y, color: 'warn', width: 0.8 },
      { id: 'fv', type: 'arrow', x1: tip.x, y1: P.y, x2: tip.x, y2: tip.y, color: 'accent', width: 0.8 },
      { id: 'fr', type: 'arrow', x1: P.x, y1: P.y, x2: tip.x, y2: tip.y, color: 'bad', width: 1.1 },
      // Labels placed on the outside of the triangle so they never overlap.
      { id: 'lh', type: 'text', text: 'F∥', x: (P.x + tip.x) / 2, y: P.y + (Fv >= 0 ? 4 : -4), size: 3.2, color: 'warn' },
      { id: 'lv', type: 'text', text: 'F⊥', x: tip.x + (Fh >= 0 ? 4 : -4), y: (P.y + tip.y) / 2, size: 3.2, color: 'accent' },
      { id: 'lr', type: 'text', text: 'R', x: (P.x + tip.x) / 2 + (Fh >= 0 ? -4 : 4), y: (P.y + tip.y) / 2 + (Fv >= 0 ? -2 : 2), size: 3.6, color: 'bad', bold: true },
    ],
    actions: [
      { do: 'write', target: 't1', at: 0.2 }, { do: 'draw', target: 'fh', at: 0.9 }, { do: 'appear', target: 'lh', at: 1.4 }, { do: 'write', target: 'v1', at: 1.4 },
      { do: 'write', target: 't2', at: 2.6 }, { do: 'draw', target: 'fv', at: 3.3 }, { do: 'appear', target: 'lv', at: 3.8 }, { do: 'write', target: 'v2', at: 3.8 },
      { do: 'write', target: 't3', at: 5 }, { do: 'draw', target: 'fr', at: 5.7, dur: 1 }, { do: 'appear', target: 'lr', at: 6.4 }, { do: 'write', target: 'v3', at: 6.6 },
      { do: 'pulse', target: 'fr', at: 7.6 },
    ],
  };

  // ---------- scene 5: forces over one revolution
  const base = { type: 'plot', xmin: 0, xmax: 360, ymin: -A * 1.15, ymax: A * 1.15, x: 84, y: 54, w: 124, h: 54 };
  const map = plotMapper(base);
  const cyc = (amp, trig, k = 1) => `${amp.toFixed(3)}*${trig}(${k}*x*pi/180)`;
  const revScene = {
    caption: 'Over one revolution',
    narration: `Over a full turn, with no balancing the primary force swings between plus and minus m omega squared r, that is ${force(A)}. Balancing ${fracText(c)} of it shrinks the force along the stroke but creates a perpendicular one. You cannot remove both, which is why only partial balancing is used.`,
    elements: [
      { id: 'p0', ...base, fn: cyc(A, 'cos'), color: 'muted' },
      { id: 'p1', ...base, fn: cyc((1 - c) * A, 'cos'), color: 'warn' },
      { id: 'p2', ...base, fn: cyc(c * A, 'sin'), color: 'accent' },
      { id: 'k', type: 'line', x1: map.sx(shownTheta), y1: map.top, x2: map.sx(shownTheta), y2: map.top + base.h, dashed: true, color: 'primary', width: 0.3 },
      { id: 'l0', type: 'text', text: 'no balancing', x: 30, y: 20, size: 3.2, color: 'muted' },
      { id: 'l1', type: 'text', text: 'along stroke', x: 80, y: 20, size: 3.2, color: 'warn' },
      { id: 'l2', type: 'text', text: 'perpendicular', x: 130, y: 20, size: 3.2, color: 'accent' },
      { id: 'xa', type: 'text', text: 'crank angle θ (degrees)', x: 84, y: 86, size: 2.8, color: 'muted' },
    ],
    actions: [
      { do: 'draw', target: 'p0', at: 0.2, dur: 2 }, { do: 'appear', target: 'l0', at: 0.4 },
      { do: 'draw', target: 'p1', at: 2.6, dur: 2 }, { do: 'appear', target: 'l1', at: 2.8 },
      { do: 'draw', target: 'p2', at: 4.8, dur: 2 }, { do: 'appear', target: 'l2', at: 5 },
      { do: 'appear', target: 'xa', at: 0.4 }, { do: 'draw', target: 'k', at: 7 },
    ],
  };

  const scenes = [mech, givenScene, massScene, forceScene, revScene];

  if (n) {
    const sb = { ...base, ymin: -A * 1.15, ymax: A * 1.15 };
    scenes.push({
      caption: 'Secondary force',
      narration: `The connecting rod's obliquity adds a secondary force, m omega squared r cos 2 theta over n, varying at twice crank speed with amplitude ${force(A / n)}. At this crank angle it is ${force(Fs)}. A rotating balance mass on the crank cannot cancel it.`,
      elements: [
        { id: 'pp', ...sb, fn: cyc(A, 'cos'), color: 'muted' },
        { id: 'ps', ...sb, fn: cyc(A / n, 'cos', 2), color: 'bad' },
        { id: 'f', type: 'text', text: `Fs = m·ω²·r·cos2θ / n = ${force(Fs)}`, x: 84, y: 20, size: 3.8, font: 'math', color: 'bad' },
      ],
      actions: [
        { do: 'draw', target: 'pp', at: 0.2, dur: 1.6 }, { do: 'draw', target: 'ps', at: 2, dur: 2.4 },
        { do: 'write', target: 'f', at: 4.6 },
      ],
    });
  }

  scenes.push({
    caption: 'Answer',
    narration: `So: a balance mass of ${sig(B, 3)} kilograms at ${mm(b)} millimetres radius, and a residual unbalanced force of ${force(FR)} at ${theta != null ? `${sig(theta)} degrees of crank angle` : 'its worst position'}.`,
    elements: [
      { id: 'a1', type: 'box', x: 80, y: 32, w: 104, h: 13, label: `Balance mass B = ${sig(B)} kg  at  b = ${mm(b)} mm`, fill: 'good', size: 4 },
      { id: 'a2', type: 'box', x: 80, y: 52, w: 104, h: 13, label: `Unbalanced force = ${force(FR)}  (${thLabel})`, fill: 'bad', size: 4 },
      ...(Fs != null ? [{ id: 'a3', type: 'box', x: 80, y: 72, w: 104, h: 13, label: `Secondary force = ${force(Fs)}`, fill: 'accent', size: 4 }] : []),
    ],
    actions: [{ do: 'grow', target: 'a1', at: 0.3 }, { do: 'grow', target: 'a2', at: 1.6 }, ...(Fs != null ? [{ do: 'grow', target: 'a3', at: 2.9 }] : [])],
  });

  return {
    title: 'Balancing of reciprocating masses',
    answer: `Balance mass B = ${sig(B)} kg at ${mm(b)} mm radius; residual unbalanced force = ${force(FR)} at ${thLabel}${Fs != null ? `; secondary force = ${force(Fs)}` : ''}.${assumed.length ? ` (Assumed: ${assumed.join(', ')}.)` : ''}`,
    steps: [
      `ω = 2πN/60 = 2π × ${sig(N)}/60 = ${sig(omega)} rad/s; r = ${mm(r)} mm.`,
      `B·b = c·m·r${m1 ? ' + m₁·r₁' : ''} → ${subst} = ${sig(Bb)} kg·m → B = ${sig(B)} kg.`,
      `Unbalanced along stroke = (1−c)·m·ω²·r·cosθ = ${force(Fh)}.`,
      `Unbalanced perpendicular = c·m·ω²·r·sinθ = ${force(Fv)}.`,
      `Resultant = √(${sig(Fh)}² + ${sig(Fv)}²) = ${force(FR)}.`,
      ...(Fs != null ? [`Secondary force = m·ω²·r·cos2θ / n = ${force(Fs)}.`] : []),
    ],
    scenes,
  };
}

// ============================================================ 2. Balancing several masses in one plane
function numbersInSentence(q, keyword) {
  const m = q.match(keyword);
  if (!m) return [];
  const rest = q.slice(m.index + m[0].length);
  const end = rest.search(/\.(\s|$)/);
  return (rest.slice(0, end < 0 ? undefined : end).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
}

export function solveRotatingMasses(question) {
  if (/reciprocat/i.test(question) || !/balanc/i.test(question)) return null;
  const q = clean(question);
  const M = masses(q).map((x) => x.v);
  if (M.length < 2 || M.length > 6) return null;
  const n = M.length;
  const L = lengths(q).map((x) => x.si);
  let radii, b;
  const assumed = [];
  if (L.length === 1) { radii = Array(n).fill(L[0]); b = L[0]; }
  else if (L.length >= n) { radii = L.slice(0, n); b = L[n] ?? (assumed.push(`b = ${sig(L[0])} m`), L[0]); }
  else return null;

  let D = degrees(q).map((x) => x.v);
  if (D.length < n - 1) D = numbersInSentence(q, /angle/i);
  const successive = /successive|between (the )?(masses|them)/i.test(q);
  let angles;
  if (D.length >= n) angles = D.slice(0, n);
  else if (D.length === n - 1) angles = successive ? D.reduce((acc, d) => [...acc, acc.at(-1) + d], [0]) : [0, ...D];
  else return null;

  const mr = M.map((m, i) => m * radii[i]);
  const H = mr.reduce((s, v, i) => s + v * Math.cos(rad(angles[i])), 0);
  const V = mr.reduce((s, v, i) => s + v * Math.sin(rad(angles[i])), 0);
  const R = Math.hypot(H, V);
  const B = R / b;
  const thB = (deg(Math.atan2(-V, -H)) + 360) % 360;

  const C = { x: 42, y: 52 };
  const rmax = Math.max(...radii, b), mmax = Math.max(...M, B);
  const pos = (r, a) => ({ x: C.x + (8 + 22 * (r / rmax)) * Math.cos(rad(a)), y: C.y - (8 + 22 * (r / rmax)) * Math.sin(rad(a)) });
  const rotor = (withB) => {
    const els = [{ id: 'shaft', type: 'circle', x: C.x, y: C.y, r: 2.5, fill: 'muted' }];
    M.forEach((m, i) => {
      const p = pos(radii[i], angles[i]);
      els.push({ id: `arm${i}`, type: 'line', x1: C.x, y1: C.y, x2: p.x, y2: p.y, color: 'muted', width: 0.4 });
      els.push({ id: `m${i}`, type: 'circle', x: p.x, y: p.y, r: 2 + 3 * Math.sqrt(m / mmax), label: `m${sub(i + 1)}`, fill: 'primary', size: 2.6 });
    });
    if (withB) {
      const p = pos(b, thB);
      els.push({ id: 'armB', type: 'line', x1: C.x, y1: C.y, x2: p.x, y2: p.y, color: 'good', width: 0.6 });
      els.push({ id: 'mB', type: 'circle', x: p.x, y: p.y, r: 2 + 3 * Math.sqrt(B / mmax), label: 'B', fill: 'good', size: 2.8 });
    }
    return els;
  };

  const table = textLines(M.map((m, i) => `m${sub(i + 1)} = ${sig(m)} kg, r = ${sig(radii[i])} m, θ = ${sig(angles[i])}°`),
    { x: 84, y: 30, dy: Math.min(8, 44 / n), size: 3, at: 0.5 + n * 0.5, gap: 0.5 });
  const scenes = [{
    caption: 'Masses on the rotor',
    narration: `${n} masses rotate together in one plane. Each one, at its own radius and angle, pulls outward with a centrifugal force m omega squared r, so the shaft is shaken unless these forces cancel.`,
    elements: [...rotor(false), ...table.elements],
    actions: [
      { do: 'grow', target: 'shaft', at: 0.2 },
      ...M.flatMap((_, i) => [{ do: 'draw', target: `arm${i}`, at: 0.5 + i * 0.5 }, { do: 'grow', target: `m${i}`, at: 0.8 + i * 0.5 }]),
      ...table.actions,
    ],
  }, {
    caption: 'Compare m·r',
    narration: `All masses share the same omega, so we compare the products m times r. These are ${mr.map((v) => sig(v, 3)).join(', ')} kilogram metres.`,
    elements: [{ id: 'bars', type: 'bars', values: mr.map((v) => Number(sig(v, 3))), labels: M.map((_, i) => `m${sub(i + 1)}r${sub(i + 1)}`), x: 80, y: 52, w: 110, h: 54, color: 'primary' }],
    actions: [{ do: 'grow', target: 'bars', at: 0.3, dur: 1.6 }],
  }];

  const comp = textLines([
    `ΣH = Σ m·r·cosθ = ${sig(H)} kg·m`,
    `ΣV = Σ m·r·sinθ = ${sig(V)} kg·m`,
    `R = √(ΣH² + ΣV²) = ${sig(R)} kg·m`,
    { text: `B·b = R  →  B = ${sig(R)} / ${sig(b)} = ${sig(B)} kg`, color: 'good' },
    { text: `θB = tan⁻¹(ΣV/ΣH) + 180° = ${sig(thB)}°`, color: 'good' },
  ], { x: 16, y: 26, dy: 11, size: 4, gap: 1.4 });
  scenes.push({
    caption: 'Resolve horizontally and vertically',
    narration: `Resolve every m r into horizontal and vertical components. Sum H is ${sig(H, 3)} and sum V is ${sig(V, 3)}, giving a resultant of ${sig(R, 3)} kilogram metres. The balance mass must supply an equal and opposite m r.`,
    ...comp,
  });

  // Vector (force) polygon, scaled to fit the stage.
  const pts = [{ x: 0, y: 0 }];
  mr.forEach((v, i) => { const p = pts.at(-1); pts.push({ x: p.x + v * Math.cos(rad(angles[i])), y: p.y + v * Math.sin(rad(angles[i])) }); });
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const sc = Math.min(110 / (Math.max(...xs) - Math.min(...xs) || 1), 56 / (Math.max(...ys) - Math.min(...ys) || 1));
  const S = (p) => ({ x: 80 + (p.x - cx) * sc, y: 52 - (p.y - cy) * sc });
  const poly = pts.slice(1).map((p, i) => {
    const a = S(pts[i]), z = S(p);
    return { id: `v${i}`, type: 'arrow', x1: a.x, y1: a.y, x2: z.x, y2: z.y, color: 'primary', width: 0.7, label: `m${sub(i + 1)}r${sub(i + 1)}` };
  });
  const last = S(pts.at(-1)), first = S(pts[0]);
  poly.push({ id: 'close', type: 'arrow', x1: last.x, y1: last.y, x2: first.x, y2: first.y, color: 'good', width: 1, label: 'B·b' });
  scenes.push({
    caption: 'Vector polygon',
    narration: 'Graphically: draw each m r vector head to tail at its angle. The gap from the last tip back to the start is the closing side, and it represents B times b, both in size and direction.',
    elements: poly,
    actions: poly.map((p, i) => ({ do: 'draw', target: p.id, at: 0.3 + i * 0.9, dur: 0.8 })).concat({ do: 'pulse', target: 'close', at: 1.3 + poly.length * 0.9 }),
  });

  scenes.push({
    caption: 'Balanced!',
    narration: `Place a balance mass of ${sig(B, 3)} kilograms at ${sig(b)} metres radius, at ${sig(thB, 4)} degrees from m1, measured counter-clockwise. Now the centrifugal forces cancel and the shaft runs smoothly.`,
    elements: [
      ...rotor(true),
      { id: 'ans', type: 'box', x: 118, y: 52, w: 62, h: 16, label: `B = ${sig(B)} kg @ ${sig(thB)}°`, fill: 'good', size: 4 },
    ],
    actions: [
      { do: 'draw', target: 'armB', at: 0.6 }, { do: 'grow', target: 'mB', at: 1.2 },
      { do: 'grow', target: 'ans', at: 2.2 }, { do: 'pulse', target: 'mB', at: 3.2 },
    ],
  });

  return {
    title: 'Balancing of several masses rotating in a single plane',
    answer: `Balance mass B = ${sig(B)} kg at radius ${sig(b)} m, placed at ${sig(thB)}° from m₁ (counter-clockwise).${assumed.length ? ` (Assumed: ${assumed.join(', ')}.)` : ''}`,
    steps: [
      `Angles from m₁: ${angles.map((a) => `${sig(a)}°`).join(', ')}.`,
      `m·r values: ${mr.map((v) => sig(v)).join(', ')} kg·m.`,
      `ΣH = Σ m·r·cosθ = ${sig(H)} kg·m;  ΣV = Σ m·r·sinθ = ${sig(V)} kg·m.`,
      `Resultant R = √(ΣH² + ΣV²) = ${sig(R)} kg·m.`,
      `B = R / b = ${sig(R)} / ${sig(b)} = ${sig(B)} kg.`,
      `Direction: opposite the resultant, θB = ${sig(thB)}°.`,
    ],
    scenes,
  };
}

// ============================================================ 3. Simply supported beam: SFD & BMD
export function solveBeam(question) {
  if (!/beam/i.test(question) || !/simply\s+supported|s\.?f\.?d|b\.?m\.?d|shear\s+force|bending\s+moment/i.test(question)) return null;
  const q = clean(question);
  const spanQ = near(q, /span|long|length|beam of/i, lengths(q), { after: 30, before: 15 });
  if (!spanQ) return null;
  const L = spanQ.si;
  const toKN = (v, u) => (/^kn/i.test(u) ? v : v / 1000);

  const loads = [];
  for (const m of q.matchAll(/(\d+(?:\.\d+)?)\s*(kN|N)(?!\s*\/)\b[^.;]*?\bat\s+(?:a\s+distance\s+of\s+)?(\d+(?:\.\d+)?)\s*m\b(\s*from\s+(?:the\s+)?(right|B\b))?/gi)) {
    const a = parseFloat(m[3]);
    loads.push({ W: toKN(parseFloat(m[1]), m[2]), a: m[4] ? L - a : a });
  }
  const udlM = q.match(/(\d+(?:\.\d+)?)\s*(kN|N)\s*\/\s*m/i);
  const w = udlM ? toKN(parseFloat(udlM[1]), udlM[2]) : 0;
  const validLoads = loads.filter((p) => p.a >= 0 && p.a <= L);
  if (!validLoads.length && !w) return null;

  const total = validLoads.reduce((s, p) => s + p.W, 0) + w * L;
  const RB = (validLoads.reduce((s, p) => s + p.W * p.a, 0) + (w * L * L) / 2) / L;
  const RA = total - RB;
  const V = (x) => RA - validLoads.reduce((s, p) => s + (p.a <= x ? p.W : 0), 0) - w * x;
  const Mx = (x) => RA * x - validLoads.reduce((s, p) => s + (x > p.a ? p.W * (x - p.a) : 0), 0) - (w * x * x) / 2;

  const breaks = [...new Set([0, ...validLoads.map((p) => p.a), L])].sort((a, b) => a - b);
  const eps = 1e-9;
  const sfPts = [[0, 0], [0, RA]];
  for (let k = 0; k < breaks.length - 1; k++) {
    const a = breaks[k], b2 = breaks[k + 1];
    sfPts.push([a, V(a + eps)], [b2, V(b2 - eps)]);
  }
  sfPts.push([L, 0]);
  const bmPts = Array.from({ length: 241 }, (_, k) => [(L * k) / 240, Mx((L * k) / 240)]);
  let xMax = 0, Mmax = 0;
  for (let k = 0; k <= 4000; k++) { const x = (L * k) / 4000, v = Mx(x); if (Math.abs(v) > Math.abs(Mmax)) { Mmax = v; xMax = x; } }

  const X = (x) => 20 + (120 * x) / L;
  const loadText = [...validLoads.map((p) => `${sig(p.W)} kN at ${sig(p.a)} m`), ...(w ? [`UDL ${sig(w)} kN/m over full span`] : [])].join(', ');
  const beamEls = (yb = 40) => [
    { id: 'beam', type: 'box', x: 80, y: yb, w: 120, h: 3, fill: 'muted' },
    { id: 'sA', type: 'text', text: '▲', x: 20, y: yb + 4.5, size: 6, color: 'muted' },
    { id: 'sB', type: 'text', text: '▲', x: 140, y: yb + 4.5, size: 6, color: 'muted' },
    { id: 'A', type: 'text', text: 'A', x: 14, y: yb + 4, size: 3.6 },
    { id: 'B', type: 'text', text: 'B', x: 146, y: yb + 4, size: 3.6 },
  ];
  const loadEls = [], loadActs = [];
  validLoads.forEach((p, i) => {
    loadEls.push({ id: `P${i}`, type: 'arrow', x1: X(p.a), y1: 20, x2: X(p.a), y2: 38, color: 'bad', width: 0.8 });
    loadEls.push({ id: `Pt${i}`, type: 'text', text: `${sig(p.W)} kN`, x: X(p.a), y: 16, size: 3.2, color: 'bad' });
    loadActs.push({ do: 'draw', target: `P${i}`, at: 1.6 + i * 0.8 }, { do: 'appear', target: `Pt${i}`, at: 1.9 + i * 0.8 });
  });
  if (w) {
    const k0 = validLoads.length;
    loadEls.push({ id: 'udl', type: 'line', x1: 20, y1: 30, x2: 140, y2: 30, color: 'warn', width: 0.4 });
    loadEls.push({ id: 'udlt', type: 'text', text: `w = ${sig(w)} kN/m`, x: 80, y: 26.5, size: 3, color: 'warn' });
    loadActs.push({ do: 'draw', target: 'udl', at: 1.6 + k0 * 0.8 }, { do: 'appear', target: 'udlt', at: 2 + k0 * 0.8 });
    for (let j = 0; j <= 8; j++) {
      loadEls.push({ id: `u${j}`, type: 'arrow', x1: 20 + 15 * j, y1: 30, x2: 20 + 15 * j, y2: 38, color: 'warn', width: 0.3 });
      loadActs.push({ do: 'draw', target: `u${j}`, at: 2.2 + k0 * 0.8 + j * 0.08, dur: 0.4 });
    }
  }

  const scenes = [{
    caption: 'The loaded beam',
    narration: `A simply supported beam of span ${sig(L)} metres rests on supports A and B. It carries ${loadText}.`,
    elements: [...beamEls(), { id: 'span', type: 'text', text: `L = ${sig(L)} m`, x: 80, y: 58, size: 3.6, color: 'muted' }, ...loadEls],
    actions: [
      { do: 'grow', target: 'beam', at: 0.2 }, { do: 'appear', target: 'sA', at: 0.7 }, { do: 'appear', target: 'sB', at: 0.7 },
      { do: 'write', target: 'span', at: 1 }, ...loadActs,
    ],
  }];

  const momentTerms = [...validLoads.map((p) => `${sig(p.W)}×${sig(p.a)}`), ...(w ? [`${sig(w)}×${sig(L)}²/2`] : [])].join(' + ');
  scenes.push({
    caption: 'Support reactions',
    narration: `Take moments about A: R B times ${sig(L)} equals the sum of each load times its distance from A. That gives R B = ${sig(RB)} kilonewtons. Vertical equilibrium then gives R A = ${sig(RA)} kilonewtons.`,
    elements: [
      ...beamEls(50),
      { id: 'eq1', type: 'text', text: `ΣM_A = 0:  R_B × ${sig(L)} = ${momentTerms}`, x: 80, y: 20, size: 3.6, font: 'math' },
      { id: 'eq2', type: 'text', text: `ΣV = 0:  R_A + R_B = ${sig(total)} kN`, x: 80, y: 30, size: 3.6, font: 'math' },
      { id: 'ra', type: 'arrow', x1: 20, y1: 78, x2: 20, y2: 58, color: 'good', width: 1 },
      { id: 'rb', type: 'arrow', x1: 140, y1: 78, x2: 140, y2: 58, color: 'good', width: 1 },
      { id: 'rat', type: 'text', text: `R_A = ${sig(RA)} kN`, x: 24, y: 72, size: 3.6, color: 'good', align: 'start' },
      { id: 'rbt', type: 'text', text: `R_B = ${sig(RB)} kN`, x: 136, y: 72, size: 3.6, color: 'good', align: 'end' },
    ],
    actions: [
      { do: 'write', target: 'eq1', at: 0.3, dur: 1.4 }, { do: 'draw', target: 'rb', at: 2 }, { do: 'write', target: 'rbt', at: 2.6 },
      { do: 'write', target: 'eq2', at: 3.6, dur: 1.2 }, { do: 'draw', target: 'ra', at: 5 }, { do: 'write', target: 'rat', at: 5.6 },
    ],
  });

  const plotBox = { type: 'plot', xmin: 0, xmax: L, x: 80, y: 52, w: 120, h: 52 };
  const sfPlot = { id: 'sf', ...plotBox, points: sfPts, fill: 'primary', color: 'primary' };
  const sfMap = plotMapper(sfPlot);
  const sfLabels = breaks.slice(0, -1).map((a, k) => {
    const v = V(a + eps);
    return { id: `sl${k}`, type: 'text', text: sig(v, 3), x: sfMap.sx(a) + 1.5, y: sfMap.sy(v) + (v >= 0 ? -2.5 : 3), size: 2.8, color: 'text', align: 'start', font: 'math' };
  });
  scenes.push({
    caption: 'Shear force diagram',
    narration: `Walk from A to B adding the forces. Shear jumps up by R A, drops by each point load${w ? ', and slopes down steadily under the UDL' : ''}, ending at minus R B. Where the shear crosses zero, the bending moment is maximum.`,
    elements: [sfPlot, ...sfLabels, { id: 'u', type: 'text', text: 'SF (kN)', x: 22, y: 22, size: 3, color: 'muted', align: 'start' }],
    actions: [{ do: 'draw', target: 'sf', at: 0.3, dur: 3 }, ...sfLabels.map((l, k) => ({ do: 'appear', target: l.id, at: 1 + k * 0.6 }))],
  });

  const bmPlot = { id: 'bm', ...plotBox, points: bmPts, fill: 'accent', color: 'accent' };
  const bmMap = plotMapper(bmPlot);
  scenes.push({
    caption: 'Bending moment diagram',
    narration: `The bending moment at any section is the moment of all forces on one side. It is zero at both supports and peaks at ${sig(Mmax)} kilonewton metres, at ${sig(xMax, 3)} metres from A.`,
    elements: [
      bmPlot,
      { id: 'mx', type: 'point', x: bmMap.sx(xMax), y: bmMap.sy(Mmax), label: `M_max = ${sig(Mmax)} kN·m`, color: 'warn' },
      { id: 'u', type: 'text', text: 'BM (kN·m)', x: 22, y: 22, size: 3, color: 'muted', align: 'start' },
    ],
    actions: [{ do: 'draw', target: 'bm', at: 0.3, dur: 3 }, { do: 'grow', target: 'mx', at: 3.6 }, { do: 'pulse', target: 'mx', at: 4.6 }],
  });

  scenes.push({
    caption: 'Answer',
    narration: `Summary: R A is ${sig(RA)} kilonewtons, R B is ${sig(RB)} kilonewtons, and the maximum bending moment is ${sig(Mmax)} kilonewton metres at ${sig(xMax, 3)} metres from A.`,
    elements: [
      { id: 'a1', type: 'box', x: 80, y: 34, w: 96, h: 13, label: `R_A = ${sig(RA)} kN,   R_B = ${sig(RB)} kN`, fill: 'good', size: 4 },
      { id: 'a2', type: 'box', x: 80, y: 56, w: 96, h: 13, label: `M_max = ${sig(Mmax)} kN·m at x = ${sig(xMax, 3)} m`, fill: 'accent', size: 4 },
    ],
    actions: [{ do: 'grow', target: 'a1', at: 0.3 }, { do: 'grow', target: 'a2', at: 1.6 }],
  });

  return {
    title: 'SFD and BMD of a simply supported beam',
    answer: `R_A = ${sig(RA)} kN, R_B = ${sig(RB)} kN; maximum bending moment = ${sig(Mmax)} kN·m at ${sig(xMax, 3)} m from A.`,
    steps: [
      `Loads: ${loadText}; span L = ${sig(L)} m.`,
      `ΣM_A = 0 → R_B × ${sig(L)} = ${momentTerms} → R_B = ${sig(RB)} kN.`,
      `ΣV = 0 → R_A = ${sig(total)} − ${sig(RB)} = ${sig(RA)} kN.`,
      `Shear force: starts at +${sig(RA)} kN, drops at each load${w ? `, slope −${sig(w)} kN/m under the UDL` : ''}, ends at −${sig(RB)} kN.`,
      `Max BM where SF = 0: M = ${sig(Mmax)} kN·m at x = ${sig(xMax, 3)} m.`,
    ],
    scenes,
  };
}

// ============================================================ 4. Belt drive tensions & power
export function solveBelt(question) {
  if (!/\bbelt/i.test(question)) return null;
  const q = clean(question);
  const F = forces(q);
  const T1Q = near(q, /tight\s+side|maximum\s+tension|\bT1\b|larger tension/i, F, { after: 40, before: 20 });
  const muM = q.match(/(?:μ|\bmu\b|coefficient of friction)\D{0,20}(\d*\.\d+|\d+)/i);
  if (!T1Q || !muM) return null;
  const T1 = T1Q.si, mu = parseFloat(muM[1]);
  const assumed = [];
  const lapQ = near(q, /lap|contact|wrap/i, degrees(q), { after: 40, before: 20 });
  const thetaDeg = lapQ?.v ?? (assumed.push('angle of contact = 180°'), 180);
  const theta = rad(thetaDeg);
  const vQ = quantities(q, 'm\\s*\\/\\s*s')[0];
  let v = vQ?.v ?? null;
  if (v == null) {
    const N = rpms(q)[0]?.v;
    const d = near(q, /diameter/i, lengths(q), { after: 30, before: 15 });
    if (N && d) v = (Math.PI * d.si * N) / 60;
  }
  const ratio = Math.exp(mu * theta);
  const T2 = T1 / ratio;
  const P = v != null ? (T1 - T2) * v : null;

  const scenes = [{
    caption: 'Open belt drive',
    narration: `The belt wraps the pulley through an angle of ${sig(thetaDeg)} degrees. Friction lets the tight side carry more tension, T1 = ${force(T1)}, than the slack side, T2.`,
    elements: [
      { id: 'p1', type: 'circle', x: 46, y: 50, r: 16, label: 'Driver', fill: 'primary', size: 3.2 },
      { id: 'p2', type: 'circle', x: 120, y: 50, r: 11, label: 'Driven', fill: 'accent', size: 3 },
      { id: 'top', type: 'line', x1: 46, y1: 34, x2: 120, y2: 39, color: 'muted', width: 0.8, label: 'slack side  T₂' },
      { id: 'bot', type: 'line', x1: 46, y1: 66, x2: 120, y2: 61, color: 'bad', width: 1.2, label: 'tight side  T₁' },
      { id: 'th', type: 'text', text: `θ = ${sig(thetaDeg)}°,  μ = ${sig(mu)}`, x: 46, y: 80, size: 3.4, font: 'math', color: 'warn' },
    ],
    actions: [
      { do: 'grow', target: 'p1', at: 0.2 }, { do: 'grow', target: 'p2', at: 0.7 },
      { do: 'draw', target: 'top', at: 1.4 }, { do: 'draw', target: 'bot', at: 2.2 }, { do: 'pulse', target: 'bot', at: 3.2 },
      { do: 'write', target: 'th', at: 3.8 },
    ],
  }, {
    caption: 'Ratio of tensions',
    narration: `For a flat belt, T1 over T2 equals e to the power mu theta. With theta = ${sig(theta, 3)} radians, the ratio is ${sig(ratio, 3)}, so T2 = ${force(T2)}.`,
    elements: [
      { id: 'f', type: 'text', text: 'T₁ / T₂ = e^(μθ)', x: 80, y: 26, size: 7, font: 'math', bold: true },
      { id: 's', type: 'text', text: `θ = ${sig(thetaDeg)}° × π/180 = ${sig(theta)} rad`, x: 80, y: 44, size: 4.2, font: 'math', color: 'muted' },
      { id: 'r', type: 'text', text: `e^(${sig(mu)} × ${sig(theta)}) = ${sig(ratio)}`, x: 80, y: 56, size: 4.2, font: 'math', color: 'muted' },
      { id: 'a', type: 'box', x: 80, y: 72, w: 60, h: 12, label: `T₂ = ${force(T2)}`, fill: 'good', size: 4.5 },
    ],
    actions: [
      { do: 'write', target: 'f', at: 0.2 }, { do: 'write', target: 's', at: 1.6 }, { do: 'write', target: 'r', at: 3 },
      { do: 'grow', target: 'a', at: 4.4 },
    ],
  }];
  if (P != null) {
    scenes.push({
      caption: 'Power transmitted',
      narration: `The net pull is T1 minus T2, and power is that force times belt speed, ${sig(v)} metres per second. Power = ${sig(P / 1000)} kilowatts.`,
      elements: [
        { id: 'bars', type: 'bars', values: [Number(sig(T1)), Number(sig(T2))], labels: ['T₁', 'T₂'], x: 44, y: 54, w: 50, h: 50, color: 'bad' },
        { id: 'f', type: 'text', text: 'P = (T₁ − T₂)·v', x: 114, y: 34, size: 5.5, font: 'math', bold: true },
        { id: 's', type: 'text', text: `= (${sig(T1)} − ${sig(T2)}) × ${sig(v)}`, x: 114, y: 48, size: 3.6, font: 'math', color: 'muted' },
        { id: 'a', type: 'box', x: 114, y: 64, w: 48, h: 12, label: `P = ${sig(P / 1000)} kW`, fill: 'good', size: 4.5 },
      ],
      actions: [
        { do: 'grow', target: 'bars', at: 0.2, dur: 1.2 }, { do: 'highlight', target: 'bars[1]', color: 'muted', at: 1.2 },
        { do: 'write', target: 'f', at: 1.8 }, { do: 'write', target: 's', at: 3 }, { do: 'grow', target: 'a', at: 4.4 },
      ],
    });
  }
  return {
    title: 'Belt drive: tensions and power',
    answer: `T₂ = ${force(T2)} (T₁/T₂ = ${sig(ratio)})${P != null ? `; power transmitted = ${sig(P / 1000)} kW` : ''}.${assumed.length ? ` (Assumed: ${assumed.join(', ')}.)` : ''}`,
    steps: [
      `θ = ${sig(thetaDeg)}° = ${sig(theta)} rad.`,
      `T₁/T₂ = e^(μθ) = e^(${sig(mu)} × ${sig(theta)}) = ${sig(ratio)}.`,
      `T₂ = ${sig(T1)} / ${sig(ratio)} = ${force(T2)}.`,
      ...(P != null ? [`P = (T₁ − T₂)·v = (${sig(T1)} − ${sig(T2)}) × ${sig(v)} = ${sig(P / 1000)} kW.`] : []),
    ],
    scenes,
  };
}
