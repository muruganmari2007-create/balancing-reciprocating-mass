// Mechanical-engineering syllabus solvers. Each one parses the question, solves it the
// textbook way, and builds an Animex Script whose DIAGRAM stays on screen for every step
// and MOVES (crank turning, rotor wobbling, section sweeping) while the right-hand panel
// walks through Given → Formula → Substitution → Result.
import { clean, quantities, lengths, masses, degrees, rpms, forces, near, fraction, sig, force } from './parse.js';
import { plotMapper } from '../../public/engine/geometry.js';

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const mm = (m) => sig(m * 1000);
const n4 = (v) => Number(v.toFixed(4));
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n) => String(n).split('').map((d) => SUB[d]).join('');
const fracText = (c) => [[2 / 3, '2/3'], [0.75, '3/4'], [1 / 3, '1/3'], [0.5, '1/2'], [0.25, '1/4'], [1, '1']]
  .find(([v]) => Math.abs(v - c) < 1e-9)?.[1] ?? sig(c, 3);

// ------------------------------------------------------------ step panel (right side)
const PX = 104, PW = 52;
const STYLE = {
  head: { size: 3.1, font: 'sans', color: 'primary', bold: true, enter: 'appear' },
  text: { size: 2.9, font: 'sans', color: 'text', enter: 'appear' },
  note: { size: 2.6, font: 'sans', color: 'muted', enter: 'appear' },
  formula: { size: 3.4, font: 'math', color: 'primary', bold: true, enter: 'write' },
  sub: { size: 2.9, font: 'math', color: 'text', enter: 'write' },
  value: { size: 3.1, font: 'math', color: 'text', bold: true, enter: 'write' },
  live: { size: 3.1, font: 'math', color: 'bad', bold: true, enter: 'appear' },
};
/** Lays out panel items top-to-bottom with staggered entrances. */
function panel(items, { y0 = 17.5, at0 = 0.5, gap = 1.1 } = {}) {
  const elements = [], actions = [];
  let y = y0, at = at0;
  items.filter(Boolean).forEach((it, i) => {
    const id = `p${i}`;
    if (it.kind === 'result') {
      elements.push({ id, type: 'box', x: PX + PW / 2, y: y + 5, w: PW, h: 9, label: it.text, fill: it.color || 'good', color: it.color || 'good', size: it.size || 3.2 });
      actions.push({ do: 'grow', target: id, at });
      y += 12;
    } else if (it.kind === 'raw') {
      it.elements.forEach((e) => elements.push(e));
      it.actions.forEach((a) => actions.push({ ...a, at: a.at + at }));
      y = it.bottom ?? y;
    } else {
      const st = STYLE[it.kind || 'text'];
      const perChar = st.size * (st.font === 'math' ? 0.6 : 0.52);
      const lines = Math.max(1, Math.ceil((it.text.length * perChar) / (PW * 0.92)));
      const hgt = lines * st.size * 1.3;
      elements.push({ id, type: 'text', text: it.text, x: PX, y: y + hgt / 2, size: st.size, font: st.font, align: 'start', w: PW, color: it.color || st.color, bold: !!st.bold });
      actions.push({ do: st.enter, target: id, at, dur: st.enter === 'write' ? 0.9 : 0.6 });
      y += hgt + (it.space ?? 2);
    }
    at += it.wait ?? gap;
  });
  return { elements, actions };
}
const step = (caption, narration, items, extra = {}) => ({ caption, narration, ...panel(items, extra.layout), focus: extra.focus || [], vars: extra.vars || {} });

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

  const A = m * omega * omega * r;
  const Bb = c * m * r + m1 * r1;
  const B = Bb / b;
  const shownTheta = theta ?? (1 - c >= c ? 0 : 90);
  const Fh = (1 - c) * A * Math.cos(rad(shownTheta));
  const Fv = c * A * Math.sin(rad(shownTheta));
  const FR = Math.hypot(Fh, Fv);
  const Fs = n ? (A * Math.cos(rad(2 * shownTheta))) / n : null;
  const thLabel = theta != null ? `θ = ${sig(theta)}°` : `θ = ${shownTheta}° (worst case)`;

  // ---------- the moving slider-crank (kept on screen for every step)
  const Ox = 30, Oy = 48, R = 12;
  const Ld = Math.min(48, R * Math.min(n ?? 4, 4));
  const Ax = `${Ox} + ${R}*cos(th)`, Ay = `${Oy} - ${R}*sin(th)`;
  const Bx = `${Ox} + ${R}*cos(th) + sqrt(${n4(Ld * Ld)} - (${R}*sin(th))^2)`;
  const G = { x: 26, y: 74 }, K = 18; // origin of the live residual-force triangle
  const S = { mech: 0, given: 1, bal: 2, res: 3, rev: 4, sec: 5 };
  const ans = n ? 6 : 5;
  const diagram = {
    title: 'Single-cylinder slider-crank with balance mass',
    vars: { th: { expr: '1.5708*t', angle: true } }, // one turn every 4 s (slowed down)
    elements: [
      { id: 'los', type: 'line', x1: 6, y1: Oy, x2: 98, y2: Oy, dashed: true, color: 'muted', width: 0.25 },
      { id: 'cyl1', type: 'line', x1: Ox + Ld - R - 7, y1: Oy - 6.2, x2: 98, y2: Oy - 6.2, color: 'text', width: 0.5 },
      { id: 'cyl2', type: 'line', x1: Ox + Ld - R - 7, y1: Oy + 6.2, x2: 98, y2: Oy + 6.2, color: 'text', width: 0.5 },
      { id: 'path', type: 'circle', x: Ox, y: Oy, r: R, color: 'muted' },
      { id: 'balArm', type: 'line', x1: Ox, y1: Oy, x2: `${Ox} - 9*cos(th)`, y2: `${Oy} + 9*sin(th)`, color: 'good', width: 0.9, from: S.bal },
      { id: 'bal', type: 'circle', x: `${Ox} - 9*cos(th)`, y: `${Oy} + 9*sin(th)`, r: 3.4, label: 'B', fill: 'good', color: 'good', size: 2.6, from: S.bal, enter: 'grow', at: 1.2 },
      { id: 'rod', type: 'line', x1: Ax, y1: Ay, x2: Bx, y2: Oy, color: 'accent', width: 1.1, label: 'l', at: 0.9 },
      { id: 'crank', type: 'line', x1: Ox, y1: Oy, x2: Ax, y2: Ay, color: 'primary', width: 1.6, label: 'r', at: 0.5 },
      { id: 'pist', type: 'box', x: Bx, y: Oy, w: 10, h: 10.4, label: 'm', fill: 'primary', size: 3, at: 1.4 },
      { id: 'O', type: 'point', x: Ox, y: Oy, r: 1.3, label: 'O', color: 'text' },
      { id: 'pinA', type: 'point', x: Ax, y: Ay, r: 0.9, label: 'A', color: 'primary' },
      { id: 'thTxt', type: 'text', text: 'θ = {mod(deg(th),360):0}°', x: 6, y: 16, size: 3.6, font: 'math', align: 'start', color: 'primary', bold: true, enter: 'appear' },
      { id: 'speed', type: 'text', text: `N = ${sig(N)} rpm (animation slowed)`, x: 6, y: 21, size: 2.4, align: 'start', color: 'muted', enter: 'appear' },
      // Unbalanced primary force on the piston: grows/shrinks as m·ω²·r·cosθ
      { id: 'Fp', type: 'arrow', x1: Bx, y1: Oy - 9.5, x2: `${Bx} + 9*cos(th)`, y2: Oy - 9.5, color: 'bad', width: 0.8, label: 'F', from: S.given, until: S.given },
      { id: 'Fres', type: 'arrow', x1: Bx, y1: Oy - 9.5, x2: `${Bx} + ${n4(9 * (1 - c))}*cos(th)`, y2: Oy - 9.5, color: 'bad', width: 0.8, label: 'F∥', from: S.bal },
      // Live residual-force triangle (bottom-left)
      { id: 'resT', type: 'text', text: 'Residual unbalanced force', x: 6, y: 64, size: 2.4, align: 'start', color: 'muted', from: S.res, enter: 'appear' },
      { id: 'fh', type: 'arrow', x1: G.x, y1: G.y, x2: `${G.x} + ${n4(K * (1 - c))}*cos(th)`, y2: G.y, color: 'warn', width: 0.7, label: 'F∥', from: S.res, at: 0.8 },
      { id: 'fv', type: 'arrow', x1: `${G.x} + ${n4(K * (1 - c))}*cos(th)`, y1: G.y, x2: `${G.x} + ${n4(K * (1 - c))}*cos(th)`, y2: `${G.y} - ${n4(K * c)}*sin(th)`, color: 'accent', width: 0.7, label: 'F⊥', from: S.res, at: 1.8 },
      { id: 'fr', type: 'arrow', x1: G.x, y1: G.y, x2: `${G.x} + ${n4(K * (1 - c))}*cos(th)`, y2: `${G.y} - ${n4(K * c)}*sin(th)`, color: 'bad', width: 1, label: 'R', from: S.res, at: 2.8 },
    ],
  };

  const given = [
    `N = ${sig(N)} rpm → ω = ${sig(omega)} rad/s`,
    `r = ${mm(r)} mm${strokeQ && !crankQ ? ` (stroke/2)` : ''}`,
    `m = ${sig(m)} kg (reciprocating)`,
    m1 ? `m${sub(1)} = ${sig(m1)} kg at ${mm(r1)} mm` : null,
    `c = ${fracText(c)},  b = ${mm(b)} mm`,
    theta != null ? `θ = ${sig(theta)}°` : null,
    n ? `n = l/r = ${sig(n, 3)}` : null,
  ].filter(Boolean);
  const subst = `B×${sig(b)} = ${fracText(c)}×${sig(m)}×${sig(r)}${m1 ? ` + ${sig(m1)}×${sig(r1)}` : ''}`;

  // Panel plots: forces over one revolution, with a marker riding at the live crank angle.
  const pbox = { type: 'plot', xmin: 0, xmax: 360, ymin: -A * 1.1, ymax: A * 1.1, x: 134, y: 46, w: 42, h: 34, axes: true };
  const cyc = (amp, trig, k = 1) => `${amp.toFixed(2)}*${trig}(${k}*x*pi/180)`;
  const marker = 'mod(deg(th),360)';

  const scenes = [
    step('The mechanism',
      `This is a single cylinder engine. The crank O A turns at ${sig(N)} r p m and the connecting rod drives the piston. Watch the piston: it speeds up and slows down every turn, so a changing force is needed to accelerate it. That force shakes the engine frame.`,
      [{ kind: 'head', text: 'Slider-crank mechanism' },
        { kind: 'text', text: 'Crank OA (radius r) rotates at ω. The connecting rod AB drives the piston of reciprocating mass m along the line of stroke.' },
        { kind: 'note', text: 'Watch the piston speed up and slow down every turn. That needs a varying force, which shakes the frame.' }]),
    step('Given data',
      `Here is the data. The angular speed is 2 pi N over 60, which is ${sig(omega, 3)} radians per second. Without balancing, the primary force on the frame is m omega squared r cos theta. The red arrow shows it growing and shrinking as the crank turns, up to ${force(A)}.`,
      [...given.map((g) => ({ kind: 'sub', text: g, space: 1.2, wait: 0.5 })),
        { kind: 'formula', text: 'F = m·ω²·r·cosθ' },
        { kind: 'value', text: `F max = ${force(A)}` },
        assumed.length ? { kind: 'note', text: `Assumed: ${assumed.join(', ')}` } : null],
      { focus: ['pist', 'Fp'] }),
    step('Find the balance mass',
      `We add a balance mass B opposite the crank. It must cancel ${m1 ? 'all the revolving mass plus ' : ''}the fraction ${fracText(c)} of the reciprocating mass. Taking moments of mass about O, B times b equals c m r${m1 ? ' plus m1 r1' : ''}. So B equals ${sig(B, 3)} kilograms.`,
      [{ kind: 'formula', text: `B·b = c·m·r${m1 ? ` + m${sub(1)}·r${sub(1)}` : ''}` },
        { kind: 'sub', text: subst },
        { kind: 'sub', text: `B × ${sig(b)} = ${sig(Bb)} kg·m` },
        { kind: 'result', text: `B = ${sig(B)} kg` },
        { kind: 'note', text: `The force along the stroke drops to (1−c) = ${fracText(1 - c)} of its old value.` }],
      { focus: ['bal', 'balArm', 'Fres'] }),
    step(`Residual force at θ = ${sig(shownTheta)}°`,
      `Let us stop the crank at ${sig(shownTheta)} degrees. Along the stroke, (1 minus c) m omega squared r cos theta remains: ${force(Fh)}. But the balance mass adds c m omega squared r sin theta perpendicular to the stroke: ${force(Fv)}. Together they give a resultant of ${force(FR)}.`,
      [{ kind: 'formula', text: 'F∥ = (1−c)·m·ω²·r·cosθ' },
        { kind: 'value', text: `= ${force(Fh)}`, color: 'warn' },
        { kind: 'formula', text: 'F⊥ = c·m·ω²·r·sinθ' },
        { kind: 'value', text: `= ${force(Fv)}`, color: 'accent' },
        { kind: 'formula', text: 'R = √(F∥² + F⊥²)' },
        { kind: 'result', text: `R = ${force(FR)}`, color: 'bad' }],
      { focus: ['fh', 'fv', 'fr', 'crank', 'bal'], vars: { th: `rad(${shownTheta})` } }),
    step('Over one revolution',
      `As the crank keeps turning, the red dot follows it on the graph. Balancing shrinks the force along the stroke but creates one across it. You cannot remove both, which is why only part of the reciprocating mass is balanced.`,
      [{ kind: 'raw', elements: [
          { id: 'g0', ...pbox, fn: cyc(A, 'cos'), color: 'muted' },
          { id: 'g1', ...pbox, fn: cyc((1 - c) * A, 'cos'), color: 'warn', marker },
          { id: 'g2', ...pbox, fn: cyc(c * A, 'sin'), color: 'accent' },
          { id: 'k0', type: 'text', text: '— no balancing', x: PX, y: 70, size: 2.4, align: 'start', color: 'muted' },
          { id: 'k1', type: 'text', text: '— along stroke F∥', x: PX, y: 74, size: 2.4, align: 'start', color: 'warn' },
          { id: 'k2', type: 'text', text: '— perpendicular F⊥', x: PX, y: 78, size: 2.4, align: 'start', color: 'accent' },
          { id: 'live', type: 'text', text: 'θ = {mod(deg(th),360):0}°', x: PX, y: 84, size: 2.8, font: 'math', align: 'start', color: 'bad', bold: true },
        ], actions: [
          { do: 'draw', target: 'g0', at: 0, dur: 1.4 }, { do: 'appear', target: 'k0', at: 0.4 },
          { do: 'draw', target: 'g1', at: 1.6, dur: 1.4 }, { do: 'appear', target: 'k1', at: 2 },
          { do: 'draw', target: 'g2', at: 3.2, dur: 1.4 }, { do: 'appear', target: 'k2', at: 3.6 },
          { do: 'appear', target: 'live', at: 4.6 },
        ] }],
      { focus: [] }),
  ];
  if (n) {
    const sbox = { ...pbox, y: 46 };
    scenes.push(step('Secondary force',
      `The connecting rod's angle adds a secondary force, m omega squared r cos 2 theta over n. It changes at twice the crank speed, with amplitude ${force(A / n)}. A rotating balance mass on the crank cannot cancel it.`,
      [{ kind: 'raw', elements: [
          { id: 'h0', ...sbox, fn: cyc(A, 'cos'), color: 'muted', marker },
          { id: 'h1', ...sbox, fn: cyc(A / n, 'cos', 2), color: 'bad' },
        ], actions: [{ do: 'draw', target: 'h0', at: 0, dur: 1.2 }, { do: 'draw', target: 'h1', at: 1.4, dur: 1.6 }], bottom: 68 },
       { kind: 'formula', text: 'Fs = m·ω²·r·cos2θ / n' },
       { kind: 'value', text: `= ${force(Fs)} at ${thLabel}` }],
      { focus: ['rod', 'pist'], layout: { y0: 17.5 } }));
  }
  scenes.push(step('Answer',
    `So: a balance mass of ${sig(B, 3)} kilograms at ${mm(b)} millimetres radius, and a residual unbalanced force of ${force(FR)} at ${theta != null ? `${sig(theta)} degrees of crank angle` : 'its worst position'}.`,
    [{ kind: 'result', text: `B = ${sig(B)} kg at ${mm(b)} mm` },
      { kind: 'result', text: `R = ${force(FR)} (${thLabel})`, color: 'bad' },
      Fs != null ? { kind: 'result', text: `Fs = ${force(Fs)}`, color: 'accent' } : null,
      { kind: 'note', text: 'Balance mass sits opposite the crank and turns with it.' }]));

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
    diagram,
    scenes,
  };
}

// ============================================================ 2. Several masses rotating in one plane
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
  const Ls = lengths(q).map((x) => x.si);
  let radii, b;
  const assumed = [];
  if (Ls.length === 1) { radii = Array(n).fill(Ls[0]); b = Ls[0]; }
  else if (Ls.length >= n) { radii = Ls.slice(0, n); b = Ls[n] ?? (assumed.push(`b = ${sig(Ls[0])} m`), Ls[0]); }
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
  const phiR = Math.atan2(V, H);

  // ---------- spinning rotor that wobbles until it is balanced
  const C = { x: 46, y: 47 };
  const rmax = Math.max(...radii, b), mmax = Math.max(...M, B);
  const rs = (r) => n4(8 + 22 * (r / rmax));
  const at = (r, a) => [`cx + ${rs(r)}*cos(th + ${n4(rad(a))})`, `cy - ${rs(r)}*sin(th + ${n4(rad(a))})`];
  const S = { rotor: 0, mr: 1, resolve: 2, poly: 3, done: 4 };
  const elements = [
    { id: 'bearing', type: 'circle', x: C.x, y: C.y, r: 4, color: 'text' },
    { id: 'disc', type: 'circle', x: 'cx', y: 'cy', r: 33, color: 'muted' },
    { id: 'shaft', type: 'circle', x: 'cx', y: 'cy', r: 2.3, fill: 'text', color: 'text' },
  ];
  M.forEach((m, i) => {
    const [x, y] = at(radii[i], angles[i]);
    elements.push({ id: `arm${i}`, type: 'line', x1: 'cx', y1: 'cy', x2: x, y2: y, color: 'muted', width: 0.5, at: 0.4 + i * 0.4 });
    elements.push({ id: `m${i}`, type: 'circle', x, y, r: n4(1.8 + 3 * Math.sqrt(m / mmax)), label: `m${sub(i + 1)}`, fill: 'primary', size: 2.4, enter: 'grow', at: 0.7 + i * 0.4 });
  });
  const [bx, by] = at(b, thB);
  elements.push(
    { id: 'Fu', type: 'arrow', x1: 'cx', y1: 'cy', x2: `cx + 18*wob*cos(th + ${n4(phiR)})`, y2: `cy - 18*wob*sin(th + ${n4(phiR)})`, color: 'bad', width: 1, label: 'unbalanced', at: 2.6 },
    { id: 'armB', type: 'line', x1: 'cx', y1: 'cy', x2: bx, y2: by, color: 'good', width: 0.8, from: S.done, at: 0.6 },
    { id: 'mB', type: 'circle', x: bx, y: by, r: n4(1.8 + 3 * Math.sqrt(B / mmax)), label: 'B', fill: 'good', color: 'good', size: 2.6, from: S.done, enter: 'grow', at: 1 },
    { id: 'thTxt', type: 'text', text: '{mod(deg(th),360):0}°', x: 6, y: 16, size: 3.4, font: 'math', align: 'start', color: 'primary', bold: true, enter: 'appear' },
    { id: 'note', type: 'text', text: 'Shaft wobbles in its bearing while unbalanced', x: 6, y: 84, size: 2.4, align: 'start', color: 'muted', enter: 'appear', until: S.poly },
    { id: 'note2', type: 'text', text: 'Balanced: the wobble is gone', x: 6, y: 84, size: 2.4, align: 'start', color: 'good', enter: 'appear', from: S.done, at: 2 },
  );
  const diagram = {
    title: `Rotor with ${n} masses in one plane (end view)`,
    vars: {
      th: { expr: '1.2566*t', angle: true }, // one turn every 5 s
      wob: { expr: '1' },
      cx: { expr: `${C.x} + 1.3*wob*cos(th + ${n4(phiR)})` },
      cy: { expr: `${C.y} - 1.3*wob*sin(th + ${n4(phiR)})` },
    },
    elements,
  };

  // Vector polygon scaled into the panel.
  const pts = [{ x: 0, y: 0 }];
  mr.forEach((v, i) => { const p = pts.at(-1); pts.push({ x: p.x + v * Math.cos(rad(angles[i])), y: p.y + v * Math.sin(rad(angles[i])) }); });
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const pcx = (Math.min(...xs) + Math.max(...xs)) / 2, pcy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const sc = Math.min(44 / (Math.max(...xs) - Math.min(...xs) || 1), 40 / (Math.max(...ys) - Math.min(...ys) || 1));
  const P = (p) => ({ x: n4(130 + (p.x - pcx) * sc), y: n4(46 - (p.y - pcy) * sc) });
  const poly = pts.slice(1).map((p, i) => {
    const a = P(pts[i]), z = P(p);
    return { id: `v${i}`, type: 'arrow', x1: a.x, y1: a.y, x2: z.x, y2: z.y, color: 'primary', width: 0.6, label: `m${sub(i + 1)}r${sub(i + 1)}` };
  });
  const last = P(pts.at(-1)), first = P(pts[0]);
  poly.push({ id: 'close', type: 'arrow', x1: last.x, y1: last.y, x2: first.x, y2: first.y, color: 'good', width: 0.9, label: 'B·b' });

  const scenes = [
    step('Masses on the rotor',
      `${n} masses turn together in one plane. Each one pulls outward with a centrifugal force, m omega squared r. Because they don't cancel, the leftover force, shown in red, turns with the rotor and makes the shaft wobble in its bearing.`,
      [{ kind: 'head', text: 'Given' },
        ...M.map((m, i) => ({ kind: 'sub', text: `m${sub(i + 1)} = ${sig(m)} kg, r = ${sig(radii[i])} m, ${sig(angles[i])}°`, space: 1.2, wait: 0.5 })),
        { kind: 'sub', text: `Balance radius b = ${sig(b)} m` },
        { kind: 'note', text: 'Watch the shaft wobble: the unbalanced force rotates with the rotor.' }]),
    step('Compare m·r',
      `All masses share the same omega, so we only need to compare m times r: ${mr.map((v) => sig(v, 3)).join(', ')} kilogram metres.`,
      [{ kind: 'formula', text: 'Fc = m·ω²·r ∝ m·r' },
        { kind: 'raw', elements: [{ id: 'bars', type: 'bars', values: mr.map((v) => Number(sig(v, 3))), labels: M.map((_, i) => `m${sub(i + 1)}r${sub(i + 1)}`), x: 130, y: 52, w: 50, h: 40, color: 'primary' }],
          actions: [{ do: 'grow', target: 'bars', at: 0, dur: 1.4 }], bottom: 74 },
        { kind: 'note', text: 'Units: kg·m' }],
      { focus: M.map((_, i) => `m${i}`) }),
    step('Resolve the forces',
      `Freeze the rotor at the reference position. Resolve every m r horizontally and vertically. Sum H is ${sig(H, 3)}, sum V is ${sig(V, 3)}, and the resultant is ${sig(R, 3)} kilogram metres. That is the red unbalanced force.`,
      [{ kind: 'formula', text: 'ΣH = Σ m·r·cosθ' },
        { kind: 'value', text: `= ${sig(H)} kg·m` },
        { kind: 'formula', text: 'ΣV = Σ m·r·sinθ' },
        { kind: 'value', text: `= ${sig(V)} kg·m` },
        { kind: 'formula', text: 'R = √(ΣH² + ΣV²)' },
        { kind: 'value', text: `= ${sig(R)} kg·m`, color: 'bad' }],
      { focus: ['Fu'], vars: { th: '0' } }),
    step('Vector polygon',
      'Graphically: draw each m r vector head to tail at its angle. The closing side, from the last tip back to the start, is B times b. It gives both the size and the direction of the balance mass.',
      [{ kind: 'raw', elements: poly, actions: poly.map((p, i) => ({ do: 'draw', target: p.id, at: i * 0.9, dur: 0.8 })).concat({ do: 'pulse', target: 'close', at: poly.length * 0.9 + 0.2 }), bottom: 70 },
        { kind: 'formula', text: `B·b = R = ${sig(R)} kg·m`, wait: poly.length * 0.9 }],
      { vars: { th: '0' } }),
    step('Balanced!',
      `Place a balance mass of ${sig(B, 3)} kilograms at ${sig(b)} metres radius, at ${sig(thB, 4)} degrees from m1. Watch the rotor now: the red force disappears and the shaft runs smoothly.`,
      [{ kind: 'formula', text: 'B = R / b' },
        { kind: 'sub', text: `= ${sig(R)} / ${sig(b)}` },
        { kind: 'result', text: `B = ${sig(B)} kg` },
        { kind: 'result', text: `θB = ${sig(thB)}° from m₁`, color: 'primary' },
        { kind: 'note', text: 'Opposite to the resultant R.' }],
      { focus: ['mB', 'armB'], vars: { wob: '0' } }),
  ];

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
    diagram,
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
  const P = loads.filter((p) => p.a >= 0 && p.a <= L);
  if (!P.length && !w) return null;

  const total = P.reduce((s, p) => s + p.W, 0) + w * L;
  const RB = (P.reduce((s, p) => s + p.W * p.a, 0) + (w * L * L) / 2) / L;
  const RA = total - RB;
  const V = (x) => RA - P.reduce((s, p) => s + (p.a <= x ? p.W : 0), 0) - w * x;
  const Mx = (x) => RA * x - P.reduce((s, p) => s + (x > p.a ? p.W * (x - p.a) : 0), 0) - (w * x * x) / 2;

  const breaks = [...new Set([0, ...P.map((p) => p.a), L])].sort((a, b) => a - b);
  const eps = 1e-9;
  const sfPts = [[0, 0], [0, n4(RA)]];
  for (let k = 0; k < breaks.length - 1; k++) sfPts.push([breaks[k], n4(V(breaks[k] + eps))], [breaks[k + 1], n4(V(breaks[k + 1] - eps))]);
  sfPts.push([L, 0]);
  const bmPts = Array.from({ length: 161 }, (_, k) => [n4((L * k) / 160), n4(Mx((L * k) / 160))]);
  let xMax = 0, Mmax = 0;
  for (let k = 0; k <= 4000; k++) { const x = (L * k) / 4000, v = Mx(x); if (Math.abs(v) > Math.abs(Mmax)) { Mmax = v; xMax = x; } }

  // Formulas (Macaulay form) so the live section readout matches the diagrams exactly.
  const Vexpr = `${n4(RA)}${P.map((p) => ` - ${n4(p.W)}*step(xs - ${n4(p.a)} - 0.000001)`).join('')}${w ? ` - ${n4(w)}*xs` : ''}`;
  const Mexpr = `${n4(RA)}*xs${P.map((p) => ` - ${n4(p.W)}*ramp(xs - ${n4(p.a)})`).join('')}${w ? ` - ${n4(w / 2)}*xs^2` : ''}`;

  // ---------- diagram: beam on top, SFD and BMD aligned underneath, moving section line
  const X0 = 12, XW = 78;
  const X = (x) => n4(X0 + (XW * x) / L);
  const beamY = 26;
  const S = { beam: 0, react: 1, sfd: 2, bmd: 3, ans: 4 };
  const els = [
    { id: 'beam', type: 'box', x: X0 + XW / 2, y: beamY, w: XW, h: 2.4, fill: 'primary', enter: 'grow', at: 0.2 },
    { id: 'sA', type: 'text', text: '▲', x: X0, y: beamY + 3.6, size: 5, color: 'text', enter: 'appear', at: 0.6 },
    { id: 'sB', type: 'text', text: '▲', x: X0 + XW, y: beamY + 3.6, size: 5, color: 'text', enter: 'appear', at: 0.6 },
    { id: 'lA', type: 'text', text: 'A', x: X0 - 5, y: beamY, size: 3.2, bold: true, enter: 'appear', at: 0.6 },
    { id: 'lB', type: 'text', text: 'B', x: X0 + XW + 5, y: beamY, size: 3.2, bold: true, enter: 'appear', at: 0.6 },
  ];
  P.forEach((p, i) => {
    els.push({ id: `P${i}`, type: 'arrow', x1: X(p.a), y1: 12, x2: X(p.a), y2: beamY - 1.4, color: 'bad', width: 0.8, at: 1.2 + i * 0.6 });
    els.push({ id: `Pt${i}`, type: 'text', text: `${sig(p.W)} kN`, x: X(p.a), y: 9.5, size: 2.6, font: 'math', color: 'bad', bold: true, enter: 'appear', at: 1.4 + i * 0.6 });
  });
  if (w) {
    els.push({ id: 'udl', type: 'line', x1: X0, y1: 18, x2: X0 + XW, y2: 18, color: 'warn', width: 0.4, at: 1.4 + P.length * 0.6 });
    els.push({ id: 'udlt', type: 'text', text: `${sig(w)} kN/m`, x: X0 + XW - 2, y: 15.8, size: 2.4, font: 'math', color: 'warn', align: 'end', enter: 'appear', at: 1.6 + P.length * 0.6 });
    for (let j = 0; j <= 8; j++) els.push({ id: `u${j}`, type: 'arrow', x1: n4(X0 + (XW * j) / 8), y1: 18, x2: n4(X0 + (XW * j) / 8), y2: beamY - 1.4, color: 'warn', width: 0.25, at: 1.8 + P.length * 0.6 + j * 0.06 });
  }
  els.push(
    { id: 'ra', type: 'arrow', x1: X0, y1: 41, x2: X0, y2: beamY + 6.5, color: 'good', width: 1, from: S.react, at: 1.4 },
    { id: 'rb', type: 'arrow', x1: X0 + XW, y1: 41, x2: X0 + XW, y2: beamY + 6.5, color: 'good', width: 1, from: S.react, at: 3.2 },
    { id: 'rat', type: 'text', text: `R_A = ${sig(RA)} kN`, x: X0 + 2, y: 39.5, size: 2.6, font: 'math', color: 'good', bold: true, align: 'start', from: S.react, enter: 'appear', at: 4.6 },
    { id: 'rbt', type: 'text', text: `R_B = ${sig(RB)} kN`, x: X0 + XW - 2, y: 39.5, size: 2.6, font: 'math', color: 'good', bold: true, align: 'end', from: S.react, enter: 'appear', at: 2.4 },
    { id: 'sfdT', type: 'text', text: 'SFD (kN)', x: 4, y: 46, size: 2.4, align: 'start', color: 'primary', bold: true, from: S.sfd, enter: 'appear' },
    { id: 'sfd', type: 'plot', points: sfPts, xmin: 0, xmax: L, x: X0 + XW / 2, y: 56, w: XW, h: 15, fill: 'primary', color: 'primary', axes: false, marker: 'xs', from: S.sfd, at: 0.4 },
    { id: 'bmdT', type: 'text', text: 'BMD (kN·m)', x: 4, y: 67, size: 2.4, align: 'start', color: 'accent', bold: true, from: S.bmd, enter: 'appear' },
    { id: 'bmd', type: 'plot', points: bmPts, xmin: 0, xmax: L, x: X0 + XW / 2, y: 77, w: XW, h: 15, fill: 'accent', color: 'accent', axes: false, marker: 'xs', from: S.bmd, at: 0.4 },
    { id: 'cut', type: 'line', x1: `${X0} + ${n4(XW / L)}*xs`, y1: 7, x2: `${X0} + ${n4(XW / L)}*xs`, y2: 86, dashed: true, color: 'bad', width: 0.35, from: S.sfd, at: 2 },
    { id: 'cutT', type: 'text', text: 'x = {xs:2} m', x: `${X0} + ${n4(XW / L)}*xs`, y: 88, size: 2.3, font: 'math', color: 'bad', from: S.sfd, enter: 'appear', at: 2 },
  );
  const bmMap = plotMapper({ type: 'plot', points: bmPts, xmin: 0, xmax: L, x: X0 + XW / 2, y: 77, w: XW, h: 15, ymin: null, ymax: null });
  els.push({ id: 'mmax', type: 'point', x: n4(bmMap.sx(xMax)), y: n4(bmMap.sy(Mmax)), label: `${sig(Mmax)}`, color: 'warn', from: S.bmd, at: 3 });
  const diagram = {
    title: `Simply supported beam, span ${sig(L)} m`,
    vars: {
      xs: { expr: `${n4(L / 2)} - ${n4(L / 2)}*cos(0.45*t)` }, // section sweeps A → B → A
      Vx: { expr: Vexpr },
      Mx: { expr: Mexpr.replace(/xs/g, 'xs') },
    },
    elements: els,
  };

  const loadText = [...P.map((p) => `${sig(p.W)} kN at ${sig(p.a)} m`), ...(w ? [`UDL ${sig(w)} kN/m (full span)`] : [])];
  const momentTerms = [...P.map((p) => `${sig(p.W)}×${sig(p.a)}`), ...(w ? [`${sig(w)}×${sig(L)}²/2`] : [])].join(' + ');
  const scenes = [
    step('The loaded beam',
      `A simply supported beam of span ${sig(L)} metres rests on supports A and B. It carries ${loadText.join(', ')}.`,
      [{ kind: 'head', text: 'Given' }, { kind: 'sub', text: `Span L = ${sig(L)} m` },
        ...loadText.map((t) => ({ kind: 'sub', text: t, space: 1.2, wait: 0.6 })),
        { kind: 'note', text: 'A: pinned support, B: roller support.' }]),
    step('Support reactions',
      `Take moments about A. R B times ${sig(L)} equals the sum of each load times its distance from A, so R B is ${sig(RB)} kilonewtons. Then vertical equilibrium gives R A = ${sig(RA)} kilonewtons.`,
      [{ kind: 'formula', text: 'ΣM_A = 0' },
        { kind: 'sub', text: `R_B×${sig(L)} = ${momentTerms}` },
        { kind: 'value', text: `R_B = ${sig(RB)} kN`, color: 'good' },
        { kind: 'formula', text: 'ΣV = 0' },
        { kind: 'sub', text: `R_A = ${sig(total)} − ${sig(RB)}` },
        { kind: 'value', text: `R_A = ${sig(RA)} kN`, color: 'good' }],
      { focus: ['ra', 'rb', 'rat', 'rbt'] }),
    step('Shear force diagram',
      `Now a section line sweeps along the beam. The shear force at the section is the sum of all vertical forces to its left. It jumps at each point load${w ? ' and slopes down steadily under the U D L' : ''}. The red dot traces the shear force diagram.`,
      [{ kind: 'formula', text: 'V(x) = Σ forces left of x' },
        { kind: 'live', text: 'x = {xs:2} m' },
        { kind: 'live', text: 'V = {Vx:2} kN' },
        { kind: 'note', text: `Starts at +R_A = ${sig(RA)}, ends at −R_B = −${sig(RB)}.` }],
      { focus: ['sfd', 'cut', 'cutT'] }),
    step('Bending moment diagram',
      `The bending moment at the section is the moment of all forces to its left. It is zero at both supports. It peaks at ${sig(Mmax)} kilonewton metres, ${sig(xMax, 3)} metres from A, exactly where the shear force crosses zero.`,
      [{ kind: 'formula', text: 'M(x) = Σ moments left of x' },
        { kind: 'live', text: 'x = {xs:2} m' },
        { kind: 'live', text: 'M = {Mx:2} kN·m' },
        { kind: 'value', text: `M_max = ${sig(Mmax)} kN·m`, color: 'warn' },
        { kind: 'note', text: `at x = ${sig(xMax, 3)} m, where V = 0` }],
      { focus: ['bmd', 'cut', 'cutT', 'mmax'] }),
    step('Answer',
      `Summary: R A is ${sig(RA)} kilonewtons and R B is ${sig(RB)} kilonewtons. The maximum bending moment is ${sig(Mmax)} kilonewton metres at ${sig(xMax, 3)} metres from A.`,
      [{ kind: 'result', text: `R_A = ${sig(RA)} kN` },
        { kind: 'result', text: `R_B = ${sig(RB)} kN` },
        { kind: 'result', text: `M_max = ${sig(Mmax)} kN·m`, color: 'warn' },
        { kind: 'note', text: `at x = ${sig(xMax, 3)} m from A` }],
      { vars: { xs: `${n4(xMax)}` } }),
  ];

  return {
    title: 'SFD and BMD of a simply supported beam',
    answer: `R_A = ${sig(RA)} kN, R_B = ${sig(RB)} kN; maximum bending moment = ${sig(Mmax)} kN·m at ${sig(xMax, 3)} m from A.`,
    steps: [
      `Loads: ${loadText.join(', ')}; span L = ${sig(L)} m.`,
      `ΣM_A = 0 → R_B × ${sig(L)} = ${momentTerms} → R_B = ${sig(RB)} kN.`,
      `ΣV = 0 → R_A = ${sig(total)} − ${sig(RB)} = ${sig(RA)} kN.`,
      `Shear force: starts at +${sig(RA)} kN, drops at each load${w ? `, slope −${sig(w)} kN/m under the UDL` : ''}, ends at −${sig(RB)} kN.`,
      `Max BM where SF = 0: M = ${sig(Mmax)} kN·m at x = ${sig(xMax, 3)} m.`,
    ],
    diagram,
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
    const Nr = rpms(q)[0]?.v;
    const d = near(q, /diameter/i, lengths(q), { after: 30, before: 15 });
    if (Nr && d) v = (Math.PI * d.si * Nr) / 60;
  }
  const ratio = Math.exp(mu * theta);
  const T2 = T1 / ratio;
  const P = v != null ? (T1 - T2) * v : null;

  // ---------- running belt drive: turning pulleys, moving belt
  const C1 = { x: 28, y: 46, r: 16 }, C2 = { x: 78, y: 46, r: 10 };
  const nx = (C2.r - C1.r) / (C2.x - C1.x), ny = Math.sqrt(1 - nx * nx);
  const top = [{ x: C1.x - C1.r * nx, y: C1.y - C1.r * ny }, { x: C2.x - C2.r * nx, y: C2.y - C2.r * ny }];
  const bot = [{ x: C1.x - C1.r * nx, y: C1.y + C1.r * ny }, { x: C2.x - C2.r * nx, y: C2.y + C2.r * ny }];
  const els = [
    { id: 'p1', type: 'circle', x: C1.x, y: C1.y, r: C1.r, label: '', color: 'primary' },
    { id: 'p2', type: 'circle', x: C2.x, y: C2.y, r: C2.r, label: '', color: 'primary' },
    { id: 'beltT', type: 'line', x1: n4(top[0].x), y1: n4(top[0].y), x2: n4(top[1].x), y2: n4(top[1].y), color: 'text', width: 0.9 },
    { id: 'beltB', type: 'line', x1: n4(bot[0].x), y1: n4(bot[0].y), x2: n4(bot[1].x), y2: n4(bot[1].y), color: 'text', width: 1.3 },
    { id: 'n1', type: 'text', text: 'Driver', x: C1.x, y: C1.y + C1.r + 5, size: 2.6, color: 'muted' },
    { id: 'n2', type: 'text', text: 'Driven', x: C2.x, y: C2.y + C2.r + 5, size: 2.6, color: 'muted' },
  ];
  for (let k = 0; k < 3; k++) {
    const a = n4((k * Math.PI) / 3);
    els.push({ id: `s1_${k}`, type: 'line', x1: `${C1.x} + ${C1.r - 1}*cos(${a} - th)`, y1: `${C1.y} - ${C1.r - 1}*sin(${a} - th)`, x2: `${C1.x} - ${C1.r - 1}*cos(${a} - th)`, y2: `${C1.y} + ${C1.r - 1}*sin(${a} - th)`, color: 'primary', width: 0.35 });
    els.push({ id: `s2_${k}`, type: 'line', x1: `${C2.x} + ${C2.r - 1}*cos(${a} - ${n4(C1.r / C2.r)}*th)`, y1: `${C2.y} - ${C2.r - 1}*sin(${a} - ${n4(C1.r / C2.r)}*th)`, x2: `${C2.x} - ${C2.r - 1}*cos(${a} - ${n4(C1.r / C2.r)}*th)`, y2: `${C2.y} + ${C2.r - 1}*sin(${a} - ${n4(C1.r / C2.r)}*th)`, color: 'primary', width: 0.35 });
  }
  for (let k = 0; k < 4; k++) { // belt "teeth" moving along both runs
    const u = `mod(0.22*t + ${k / 4}, 1)`;
    els.push({ id: `bt${k}`, type: 'point', x: `${n4(top[0].x)} + ${n4(top[1].x - top[0].x)}*${u}`, y: `${n4(top[0].y)} + ${n4(top[1].y - top[0].y)}*${u}`, r: 0.7, color: 'text' });
    els.push({ id: `bb${k}`, type: 'point', x: `${n4(bot[1].x)} + ${n4(bot[0].x - bot[1].x)}*${u}`, y: `${n4(bot[1].y)} + ${n4(bot[0].y - bot[1].y)}*${u}`, r: 0.7, color: 'text' });
  }
  els.push(
    { id: 'T1', type: 'arrow', x1: n4(bot[0].x + 8), y1: n4(bot[0].y + 4.5), x2: n4(bot[0].x + 22), y2: n4(bot[0].y + 3.3), color: 'bad', width: 0.9, label: 'T₁ (tight)', from: 1, at: 0.8 },
    { id: 'T2', type: 'arrow', x1: n4(top[0].x + 8), y1: n4(top[0].y - 4.5), x2: n4(top[0].x + 22), y2: n4(top[0].y - 3.3), color: 'warn', width: 0.6, label: 'T₂ (slack)', from: 1, at: 1.6 },
    { id: 'lap', type: 'text', text: `θ = ${sig(thetaDeg)}° (arc of contact)`, x: 6, y: 84, size: 2.6, align: 'start', color: 'muted', enter: 'appear', from: 1 },
  );
  const diagram = { title: 'Open belt drive', vars: { th: { expr: '2.0944*t', angle: true } }, elements: els };

  const scenes = [
    step('The belt drive',
      `The driver pulley pulls the belt round. Friction over the arc of contact lets the tight side carry more tension than the slack side.`,
      [{ kind: 'head', text: 'Given' },
        { kind: 'sub', text: `T₁ = ${force(T1)}` }, { kind: 'sub', text: `μ = ${sig(mu)}` },
        { kind: 'sub', text: `θ = ${sig(thetaDeg)}°` }, v != null ? { kind: 'sub', text: `v = ${sig(v)} m/s` } : null,
        assumed.length ? { kind: 'note', text: `Assumed: ${assumed.join(', ')}` } : null]),
    step('Ratio of tensions',
      `For a flat belt, T1 over T2 equals e to the power mu theta. With theta = ${sig(theta, 3)} radians the ratio is ${sig(ratio, 3)}, so T2 = ${force(T2)}.`,
      [{ kind: 'formula', text: 'T₁ / T₂ = e^(μθ)' },
        { kind: 'sub', text: `θ = ${sig(thetaDeg)}° = ${sig(theta)} rad` },
        { kind: 'sub', text: `e^(${sig(mu)}×${sig(theta)}) = ${sig(ratio)}` },
        { kind: 'result', text: `T₂ = ${force(T2)}` }],
      { focus: ['T1', 'T2', 'beltB', 'beltT'] }),
    ...(P != null ? [step('Power transmitted',
      `The net pull on the pulley is T1 minus T2. Power is that force times the belt speed, ${sig(v)} metres per second, which gives ${sig(P / 1000)} kilowatts.`,
      [{ kind: 'formula', text: 'P = (T₁ − T₂)·v' },
        { kind: 'sub', text: `= (${sig(T1)} − ${sig(T2)}) × ${sig(v)}` },
        { kind: 'result', text: `P = ${sig(P / 1000)} kW` }],
      { focus: ['p1', 'beltB'] })] : []),
  ];

  return {
    title: 'Belt drive: tensions and power',
    answer: `T₂ = ${force(T2)} (T₁/T₂ = ${sig(ratio)})${P != null ? `; power transmitted = ${sig(P / 1000)} kW` : ''}.${assumed.length ? ` (Assumed: ${assumed.join(', ')}.)` : ''}`,
    steps: [
      `θ = ${sig(thetaDeg)}° = ${sig(theta)} rad.`,
      `T₁/T₂ = e^(μθ) = e^(${sig(mu)} × ${sig(theta)}) = ${sig(ratio)}.`,
      `T₂ = ${sig(T1)} / ${sig(ratio)} = ${force(T2)}.`,
      ...(P != null ? [`P = (T₁ − T₂)·v = (${sig(T1)} − ${sig(T2)}) × ${sig(v)} = ${sig(P / 1000)} kW.`] : []),
    ],
    diagram,
    scenes,
  };
}
