// Tiny, safe math-expression compiler (no eval). Shared by browser + server.
// Grammar:  expr := term (('+'|'-') term)*
//           term := unary (('*'|'/') unary | implicit-mult)*
//           unary := ('-'|'+') unary | power
//           power := atom ('^' unary)?
//           atom := number | 'x' | const | fn '(' expr ')' | '(' expr ')'

const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos,
  atan: Math.atan, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log,
  log: Math.log10, floor: Math.floor, ceil: Math.ceil, sinh: Math.sinh, cosh: Math.cosh,
  tanh: Math.tanh,
};
const CONSTS = { pi: Math.PI, e: Math.E };

function tokenize(src) {
  const tokens = [];
  const re = /\s*(\d+\.?\d*|\.\d+|[a-zA-Z_]+|\*\*|[-+*/^(),])/y;
  let m;
  re.lastIndex = 0;
  while (re.lastIndex < src.length) {
    const start = re.lastIndex;
    m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(start))) break;
      throw new Error(`Unexpected character near "${src.slice(start, start + 6)}"`);
    }
    tokens.push(m[1] === '**' ? '^' : m[1]);
  }
  return tokens;
}

export function compile(source) {
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
      left = op === '+' ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
    }
    return left;
  }
  function startsAtom(tok) {
    return tok !== undefined && (tok === '(' || /^[\d.a-zA-Z_]/.test(tok));
  }
  function term() {
    let left = unary();
    for (;;) {
      const tok = peek();
      if (tok === '*' || tok === '/') {
        next(); const right = unary(); const l = left;
        left = tok === '*' ? (x) => l(x) * right(x) : (x) => l(x) / right(x);
      } else if (startsAtom(tok)) { // implicit multiplication: 2x, 3(x+1), x sin(x)
        const right = power(); const l = left;
        left = (x) => l(x) * right(x);
      } else break;
    }
    return left;
  }
  function unary() {
    if (peek() === '-') { next(); const u = unary(); return (x) => -u(x); }
    if (peek() === '+') { next(); return unary(); }
    return power();
  }
  function power() {
    const base = atom();
    if (peek() === '^') { next(); const ex = unary(); return (x) => Math.pow(base(x), ex(x)); }
    return base;
  }
  function atom() {
    const tok = next();
    if (tok === undefined) throw new Error('Unexpected end of expression');
    if (/^[\d.]/.test(tok)) { const v = parseFloat(tok); return () => v; }
    if (tok === '(') { const e = expr(); expect(')'); return e; }
    const name = tok.toLowerCase();
    if (name === 'x') return (x) => x;
    if (name in CONSTS) { const v = CONSTS[name]; return () => v; }
    if (name in FUNCS) {
      const f = FUNCS[name];
      expect('('); const arg = expr(); expect(')');
      return (x) => f(arg(x));
    }
    throw new Error(`Unknown name "${tok}"`);
  }

  const fn = expr();
  if (i < t.length) throw new Error(`Unexpected "${t[i]}"`);
  return fn;
}

/** Returns a function or null (never throws) — handy for validation. */
export function tryCompile(source) {
  try { const f = compile(source); f(0.5); return f; } catch { return null; }
}
