// Pulls numbers-with-units out of textbook-style problem statements, e.g.
// "mass of reciprocating parts 50 kg ... stroke 300 mm ... at 240 r.p.m."

const LENGTH = { mm: 1e-3, cm: 1e-2, m: 1 };

/** Removes symbol subscripts like m1, r2, θ3 so their digits aren't read as data. */
export function clean(q) {
  return q.replace(/(?<![\w.])[mrbθwlTW]_?\d(?![\d.])/g, ' ').replace(/[₀-₉]/g, ' ').replace(/\s+/g, ' ');
}

/** All quantities with one of the given units (regex alternation), in reading order. */
export function quantities(q, units) {
  const re = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${units})(?![\\w/])`, 'gi');
  return [...q.matchAll(re)].map((m) => ({
    v: parseFloat(m[1]), unit: m[2].toLowerCase().replace(/\./g, ''), i: m.index, end: m.index + m[0].length, used: false,
  }));
}

export const lengths = (q) => quantities(q, 'mm|cm|m').map((x) => ({ ...x, si: x.v * LENGTH[x.unit] }));
export const masses = (q) => quantities(q, 'kg');
export const degrees = (q) => quantities(q, '°|degrees?|deg');
export const rpms = (q) => quantities(q, 'r\\.?p\\.?m\\.?');
export const forces = (q) => quantities(q, 'kN|N').map((x) => ({ ...x, si: x.unit === 'kn' ? x.v * 1000 : x.v }));

/**
 * The quantity that belongs to a keyword: first one shortly AFTER it,
 * else the closest one shortly BEFORE it ("400 mm radius"). Marks it used.
 */
export function near(q, keyword, list, { after = 70, before = 30 } = {}) {
  for (const m of q.matchAll(new RegExp(keyword.source, keyword.flags.includes('g') ? keyword.flags : keyword.flags + 'g'))) {
    const k = m.index + m[0].length;
    const hit = list.find((x) => !x.used && m.index - x.end >= 0 && m.index - x.end <= 2) // "300 mm stroke"
      ?? list.filter((x) => !x.used && x.i >= k && x.i - k <= after).sort((a, b) => a.i - b.i)[0]
      ?? list.filter((x) => !x.used && x.i < m.index && m.index - x.i <= before).sort((a, b) => b.i - a.i)[0];
    if (hit) { hit.used = true; return hit; }
  }
  return null;
}

/** "two-third", "3/4", "60%", "half" ... -> number, or null. */
export function fraction(q) {
  const table = [
    [/two[- ]thirds?|2\s*\/\s*3/i, 2 / 3], [/three[- ](fourths?|quarters?)|3\s*\/\s*4/i, 0.75],
    [/one[- ]third|1\s*\/\s*3/i, 1 / 3], [/one[- ](fourth|quarter)|1\s*\/\s*4/i, 0.25],
    [/one[- ]half|\bhalf\b|1\s*\/\s*2/i, 0.5],
  ];
  for (const [re, v] of table) if (re.test(q)) return v;
  const pct = q.match(/(\d+(?:\.\d+)?)\s*(%|percent)/i);
  if (pct) return parseFloat(pct[1]) / 100;
  if (/\b(fully|completely|entirely)\b|\ball (of )?the reciprocating/i.test(q)) return 1;
  return null;
}

/** Significant-figure formatting for engineering answers. */
export function sig(x, digits = 4) {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const d = Math.max(0, digits - 1 - Math.floor(Math.log10(Math.abs(x))));
  return String(Number(x.toFixed(Math.min(d, 6))));
}

export const force = (F) => (Math.abs(F) >= 1000 ? `${sig(F / 1000)} kN` : `${sig(F)} N`);
