import test from 'node:test';
import assert from 'node:assert/strict';
import { solveLocally, EXAMPLES } from '../server/local/index.js';
import { normalizeScript, extractJson } from '../public/engine/script.js';
import { compile } from '../public/engine/math.js';
import { buildTimeline, elementState } from '../public/engine/timeline.js';

test('math parser handles implicit multiplication and functions', () => {
  assert.equal(compile('2x^2 - 3x + 1')(2), 3);
  assert.equal(compile('y = 3(x+1)')(1), 6);
  assert.ok(Math.abs(compile('sin(pi/2)')(0) - 1) < 1e-12);
  assert.throws(() => compile('alert(1)'));
});

for (const { question: q } of EXAMPLES) {
  test(`offline example produces a clean script: ${q}`, () => {
    const { script, warnings } = normalizeScript(solveLocally(q));
    assert.deepEqual(warnings, []);
    assert.ok(script.scenes.length >= 2);
    assert.ok(buildTimeline(script).total > 0);
  });
}

// Textbook checks (R.S. Khurmi, Theory of Machines, Ch. 21-22 worked examples).
test('reciprocating balancing matches the textbook answer', () => {
  const s = solveLocally('A single cylinder reciprocating engine has speed 240 r.p.m., stroke 300 mm, mass of reciprocating parts 50 kg, mass of revolving parts at 150 mm radius 37 kg. If two-third of the reciprocating parts and all the revolving parts are to be balanced, find the balance mass required at a radius of 400 mm and the residual unbalanced force when the crank has rotated 60° from top dead centre.');
  assert.match(s.answer, /B = 26\.37 kg at 400 mm/);
  assert.match(s.answer, /2\.847 kN at θ = 60°/);
});

test('rotating masses in one plane matches the textbook answer', () => {
  const s = solveLocally('Four masses m1, m2, m3 and m4 are 200 kg, 300 kg, 240 kg and 260 kg respectively. The corresponding radii of rotation are 0.2 m, 0.15 m, 0.25 m and 0.3 m respectively and the angles between successive masses are 45°, 75° and 135°. Find the position and magnitude of the balance mass required, if its radius of rotation is 0.2 m.');
  assert.match(s.answer, /B = 116\.1 kg at radius 0\.2 m, placed at 201\.3°/);
});

test('simply supported beam reactions and max BM', () => {
  const s = solveLocally('Simply supported beam of span 6 m carries point loads 20 kN at 2 m and 30 kN at 4 m from A, and a UDL of 10 kN/m over the whole span. Draw the SFD and BMD.');
  assert.match(s.answer, /R_A = 53\.33 kN, R_B = 56\.67 kN; maximum bending moment = 95\.56 kN·m at 3\.33 m/);
});

test('belt drive tension ratio and power', () => {
  const s = solveLocally('Belt drive: tight side tension 2000 N, coefficient of friction 0.3, angle of lap 165°, belt speed 20 m/s. Find the slack side tension and power transmitted.');
  assert.match(s.answer, /T₂ = 843 N .*23\.14 kW/);
});

test('linear solver gets the right answer', () => {
  assert.equal(solveLocally('Solve 3x + 7 = 2x - 5').answer, 'x = -12');
  assert.equal(solveLocally('solve 4(x - 2) = 2x + 6').answer, 'x = 7');
});

test('plot finds each root once', () => {
  assert.match(solveLocally('Plot y = x^2 - 2x - 3').answer, /^Roots near x = -1, 3;/);
});

test('bubble sort result is sorted and swaps animate', () => {
  const s = solveLocally('sort [5, 1, 4, 2]');
  assert.match(s.answer, /\[1, 2, 4, 5\]/);
  const { script } = normalizeScript(s);
  const pass = script.scenes[1];
  const arr = pass.elements[0];
  const end = elementState(arr, pass.actions, 999);
  assert.deepEqual(end.order.map((c) => arr.values[c]), ['1', '4', '2', '5']);
});

test('Gemini falls back across models and explains busy / quota failures', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'model-a,model-b';
  const { PROVIDERS } = await import('../server/providers.js');
  const realFetch = globalThis.fetch;
  const reply = (status, message) => async () => new Response(JSON.stringify({ error: { message } }), { status });
  try {
    globalThis.fetch = reply(503, 'This model is currently experiencing high demand.');
    await assert.rejects(PROVIDERS.gemini.generate('q'), (e) => e.kind === 'busy' && /tomorrow morning/.test(e.message) && e.tried.length === 2);
    globalThis.fetch = reply(429, 'You exceeded your current quota, please check your plan.');
    await assert.rejects(PROVIDERS.gemini.generate('q'), (e) => e.kind === 'quota' && /resets once a day/.test(e.message));
    let calls = 0; // first model busy, second answers -> success marked as fallback
    globalThis.fetch = async () => (++calls === 1
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }] }), { status: 200 }));
    assert.equal(await PROVIDERS.gemini.generate('q'), '{"ok":1}');
    assert.equal(PROVIDERS.gemini.lastWasFallback, true);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL;
  }
});

test('normalizer repairs junk from an LLM', () => {
  const reply = 'Sure!\n```json\n{"title":"T","scenes":[{"elements":[{"id":"a","type":"text","text":"hi"},{"type":"hologram"}],"actions":[{"do":"write","target":"a"},{"do":"explode","target":"a"},{"do":"fade","target":"zzz"}]}]}\n```';
  const { script, warnings } = normalizeScript(extractJson(reply));
  assert.equal(script.scenes[0].elements.length, 1);
  assert.equal(script.scenes[0].actions.length, 1);
  assert.equal(warnings.length, 3);
});
