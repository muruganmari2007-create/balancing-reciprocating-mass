import { Player } from './engine/player.js';

const $ = (id) => document.getElementById(id);
const player = new Player($('stage'));
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- player wiring ----------
let scrubbing = false;
player.addEventListener('time', ({ detail: { T, total, playing } }) => {
  $('play').textContent = playing ? '⏸' : '▶';
  $('clock').textContent = `${fmtTime(T)} / ${fmtTime(total)}`;
  if (!scrubbing && total) $('scrub').value = Math.round((T / total) * 1000);
});
player.addEventListener('scene', ({ detail: entry }) => {
  $('subtitle').textContent = entry.scene.narration;
  [...$('sceneDots').children].forEach((d, i) => d.classList.toggle('active', i === entry.index));
});

$('play').onclick = () => player.toggle();
$('prev').onclick = () => player.gotoScene(player.current - 1);
$('next').onclick = () => player.gotoScene(player.current + 1);
$('speed').onchange = (e) => { player.speed = Number(e.target.value); };
$('voice').onclick = (e) => {
  player.voice = !player.voice;
  e.currentTarget.classList.toggle('on', player.voice);
  e.currentTarget.textContent = player.voice ? '🔊' : '🔇';
  if (!player.voice) player.stopSpeech();
};
$('scrub').addEventListener('pointerdown', () => { scrubbing = true; });
$('scrub').addEventListener('input', (e) => {
  if (player.timeline) player.seek((e.target.value / 1000) * player.timeline.total, { fromUser: true });
});
$('scrub').addEventListener('change', () => { scrubbing = false; });
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['TEXTAREA', 'INPUT', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) {
    e.preventDefault(); player.toggle();
  }
});

function playScript(script) {
  $('empty').classList.add('hidden');
  player.load(script);
  $('sceneDots').replaceChildren(...script.scenes.map((s, i) => {
    const b = document.createElement('button');
    b.title = s.caption || `Scene ${i + 1}`;
    b.onclick = () => player.gotoScene(i);
    return b;
  }));
  player.gotoScene(0);
  player.play();
}

// ---------- chat ----------
function addMessage(cls, html) {
  const div = document.createElement('div');
  div.className = `msg ${cls}`;
  div.innerHTML = html;
  $('messages').appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return div;
}

async function ask(question) {
  addMessage('user', esc(question));
  const pending = addMessage('bot', '<span class="spinner"></span>Solving and storyboarding…');
  $('send').disabled = true;
  try {
    const res = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, provider: $('provider').value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const { script } = data;
    pending.innerHTML = `
      <h3>${esc(script.title)}</h3>
      ${script.answer ? `<div class="answer">${esc(script.answer)}</div>` : ''}
      ${script.steps.length ? `<ol>${script.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      <div class="meta">
        <button class="replay">▶ Play animation</button>
        <span>${esc(data.provider)}${data.model !== 'local' ? ` · ${esc(data.model)}` : ''} · ${data.cached ? 'cached' : `${(data.ms / 1000).toFixed(1)}s`} · ${script.scenes.length} scenes</span>
        ${data.warnings.length ? `<span title="${esc(data.warnings.join('\n'))}">⚠ ${data.warnings.length} fixed</span>` : ''}
      </div>`;
    pending.querySelector('.replay').onclick = () => playScript(script);
    playScript(script);
  } catch (err) {
    pending.classList.add('error');
    pending.textContent = `Couldn't explain that: ${err.message}`;
  } finally {
    $('send').disabled = false;
  }
}

$('ask').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('question').value.trim();
  if (!q) return;
  $('question').value = '';
  ask(q);
});
$('question').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('ask').requestSubmit(); }
});

// ---------- boot ----------
const boot = await fetch('/api/providers').then((r) => r.json());
$('provider').innerHTML = [
  `<option value="auto">Auto (${esc(boot.default)})</option>`,
  ...boot.providers.map((p) => `<option value="${p.id}" ${p.configured ? '' : 'disabled'}>${esc(p.label)}${p.configured ? '' : ' — no key'}</option>`),
].join('');
$('examples').replaceChildren(...boot.examples.map((ex) => {
  const b = document.createElement('button');
  b.className = 'chip'; b.type = 'button'; b.textContent = ex.label; b.title = ex.question;
  b.onclick = () => ask(ex.question);
  return b;
}));
addMessage('bot', `Hi! Paste a mechanical engineering problem from your syllabus and I'll solve it step by step, then <b>animate</b> the solution.${boot.default === 'local' ? '<br><span style="color:var(--ink-2)">No LLM key found, so I\'m using the built-in solvers (balancing, beams, belt drives). Try an example below.</span>' : ''}`);
