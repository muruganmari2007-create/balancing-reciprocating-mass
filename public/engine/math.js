// Tiny, safe math-expression compiler (no eval). Shared by browser + server.
// Supports variables (x, t, th, ...), constants, and 1- or 2-argument functions,
// so diagrams can be driven by time:  "32 + 13*cos(th)",  "RA*xs - 20*ramp(xs - 2)".
//
// Grammar:  expr  := term (('+'|'-') term)*
//           term  := unary (('*'|'/') unary | implicit-mult)*
//           unary := ('-'|'+') unary | power
//           power := atom ('^' unary)?
//           atom  := number | name | fn '(' expr (',' expr)* ')' | '(' expr ')'

const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sign: Math.sign,
  deg: (r) => (r * 180) / Math.PI,
  rad: (d) => (d * Math.PI) / 180,
  step: (v) => (v >= 0 ? 1 : 0), // Heaviside: point loads in shear force
  ramp: (v) => (v > 0 ? v : 0), // Macaulay bracket <x-a>: bending moment
  min: Math.min, max: Math.max, atan2: Math.atan2, pow: Math.pow, hypot: Math.hypot,
  mod: (a, b) => ((a % b) + b) % b,
};
const CONSTS = { pi: Math.PI, e: Math.E };

function tokenize(src) {
  const tokens = [];
  const re = /\s*(\d+\.?\d*(?:e[-+]?\d+)?|\.\d+|[a-zA-Z_][a-zA-Z_0-9]*|\*\*|[-+*/^(),])/y;
  while (re.lastIndex < src.length) {
    const start = re.lastIndex;
    const m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(start))) break;
      throw new Error(`Unexpected character near "${src.slice(start, start + 6)}"`);
    }
    tokens.push(m[1] === '**' ? '^' : m[1]);
  }
  return tokens;
}

/**
 * Compiles an expression. `vars` lists allowed variable names (default ["x"]).
 * The result takes either a number (value of x) or a scope object {name: value}.
 */
export function compile(source, vars = ['x']) {
  const allowed = new Set(vars);
  const src = String(source).replace(/^\s*(y|f\(x\))\s*=/i, '').replace(/·|×/g, '*').replace(/−/g, '-');
  const t = tokenize(src);
  let i = 0;
  const peek = () => t[i];
  const next = () => t[i++];
  const expect = (tok) => { if (next() !== tok) throw new Error(`Expected "${tok}"`); };

  function expr() {
    let left = term();
    while (peek() === '+' || peek() === '-') {
      const op = next(); const right = term(); const l = left;
      left = op === '+' ? (s) => l(s) + right(s) : (s) => l(s) - right(s);
    }
    return left;
  }
  const startsAtom = (tok) => tok !== undefined && (tok === '(' || /^[\d.a-zA-Z_]/.test(tok));
  function term() {
    let left = unary();
    for (;;) {
      const tok = peek();
      if (tok === '*' || tok === '/') {
        next(); const right = unary(); const l = left;
        left = tok === '*' ? (s) => l(s) * right(s) : (s) => l(s) / right(s);
      } else if (startsAtom(tok)) { // implicit multiplication: 2x, 3(x+1)
        const right = power(); const l = left;
        left = (s) => l(s) * right(s);
      } else break;
    }
    return left;
  }
  function unary() {
    if (peek() === '-') { next(); const u = unary(); return (s) => -u(s); }
    if (peek() === '+') { next(); return unary(); }
    return power();
  }
  function power() {
    const base = atom();
    if (peek() === '^') { next(); const ex = unary(); return (s) => Math.pow(base(s), ex(s)); }
    return base;
  }
  function atom() {
    const tok = next();
    if (tok === undefined) throw new Error('Unexpected end of expression');
    if (/^[\d.]/.test(tok)) { const v = parseFloat(tok); return () => v; }
    if (tok === '(') { const e = expr(); expect(')'); return e; }
    if (allowed.has(tok)) return (s) => s[tok];
    const name = tok.toLowerCase();
    if (allowed.has(name)) return (s) => s[name];
    if (name in CONSTS) { const v = CONSTS[name]; return () => v; }
    if (name in FUNCS) {
      const f = FUNCS[name];
      expect('(');
      const args = [expr()];
      while (peek() === ',') { next(); args.push(expr()); }
      expect(')');
      if (args.length === 1) { const [a] = args; return (s) => f(a(s)); }
      const [a, b] = args;
      return (s) => f(a(s), b(s));
    }
    throw new Error(`Unknown name "${tok}"`);
  }

  const fn = expr();
  if (i < t.length) throw new Error(`Unexpected "${t[i]}"`);
  return (arg) => fn(typeof arg === 'number' ? { x: arg } : arg);
}

/** Returns a function or null (never throws) — handy for validation. */
export function tryCompile(source, vars = ['x']) {
  try {
    const f = compile(source, vars);
    f(Object.fromEntries(vars.map((v) => [v, 0.5])));
    return f;
  } catch { return null; }
}

const cache = new Map();
/** Cached compile for per-frame evaluation. */
export function compileCached(source, vars) {
  const key = `${vars.join(',')}|${source}`;
  if (!cache.has(key)) cache.set(key, tryCompile(source, vars) || (() => NaN));
  return cache.get(key);
}
