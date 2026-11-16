import { Player } from './engine/player.js';

const $ = (id) => document.getElementById(id);
const player = new Player($('stage'));
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
  voiceOn: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  voiceOff: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};
$('play').innerHTML = ICON.play;
$('voice').innerHTML = ICON.voiceOn;

// ---------- player wiring ----------
let scrubbing = false;
player.addEventListener('time', ({ detail: { T, total, playing } }) => {
  $('play').innerHTML = playing ? ICON.pause : ICON.play;
  $('clock').textContent = `${fmtTime(T)} / ${fmtTime(total)}`;
  if (!scrubbing && total) $('scrub').value = Math.round((T / total) * 1000);
});
player.addEventListener('scene', ({ detail: entry }) => {
  $('subtitle').textContent = entry.scene.narration;
  [...$('steps').querySelectorAll('button')].forEach((b, i) => {
    b.classList.toggle('active', i === entry.index);
    b.classList.toggle('done', i < entry.index);
    if (i === entry.index) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
});

$('play').onclick = () => player.toggle();
$('prev').onclick = () => player.gotoScene(player.current - 1);
$('next').onclick = () => player.gotoScene(player.current + 1);
$('speed').onchange = (e) => { player.speed = Number(e.target.value); };
$('voice').onclick = (e) => {
  player.voice = !player.voice;
  e.currentTarget.classList.toggle('on', player.voice);
  e.currentTarget.innerHTML = player.voice ? ICON.voiceOn : ICON.voiceOff;
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

function playScript(script, card) {
  $('empty').classList.add('hidden');
  $('lessonTitle').textContent = script.title;
  $('kicker').textContent = script.diagram?.title || 'Animation';
  player.load(script);
  $('steps').replaceChildren(...script.scenes.map((s, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> ${esc(s.caption || `Step ${i + 1}`)}`;
    b.onclick = () => { player.gotoScene(i); player.play(); };
    li.appendChild(b);
    return li;
  }));
  $('ticks').replaceChildren(...player.timeline.scenes.slice(1).map((e) => {
    const t = document.createElement('i');
    t.style.left = `${(e.start / player.timeline.total) * 100}%`;
    return t;
  }));
  document.querySelectorAll('.sol').forEach((c) => c.classList.toggle('active', c === card));
  player.gotoScene(0);
  player.play();
}

// ---------- solving ----------
function solutionCard(question) {
  const card = document.createElement('article');
  card.className = 'sol pending';
  card.innerHTML = `<div class="q">${esc(question)}</div><div class="body">Solving…</div>`;
  $('messages').querySelector('.hint')?.remove();
  $('messages').prepend(card);
  return card;
}

async function ask(question) {
  const card = solutionCard(question);
  $('send').disabled = true;
  const label = $('provider').selectedOptions[0]?.dataset.llm;
  $('loadingText').textContent = label ? `Checking built-in solvers, else asking ${label}… (AI answers take 30–60 s)` : 'Solving…';
  $('loading').hidden = false;
  try {
    const res = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, provider: $('provider').value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const { script } = data;
    card.className = 'sol';
    card.querySelector('.body').innerHTML = `
      <h3>${esc(script.title)}</h3>
      ${script.answer ? `<p class="answer">${esc(script.answer)}</p>` : ''}
      ${script.steps.length ? `<ol>${script.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      <div class="meta">${data.provider === 'local' ? 'built-in solver' : esc(data.model)} · ${data.cached ? 'cached' : `${(data.ms / 1000).toFixed(1)} s`} · ${script.scenes.length} steps${data.warnings.length ? ` · ${data.warnings.length} auto-fixed` : ''}</div>`;
    card.onclick = () => playScript(script, card);
    playScript(script, card);
  } catch (err) {
    card.className = 'sol error';
    card.querySelector('.body').textContent = `Couldn't solve that: ${err.message}`;
  } finally {
    $('send').disabled = false;
    $('loading').hidden = true;
  }
}

$('ask').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('question').value.trim();
  if (!q) return;
  ask(q);
});
$('question').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('ask').requestSubmit(); }
});

// ---------- boot ----------
const boot = await fetch('/api/providers').then((r) => r.json());
const llm = boot.providers.find((p) => p.id === boot.default && p.id !== 'local');
$('provider').innerHTML = [
  `<option value="auto" data-llm="${llm ? esc(llm.label.split(' (')[0]) : ''}">Auto: built-in solvers${llm ? `, else ${esc(llm.label.split(' (')[0])}` : ''}</option>`,
  ...boot.providers.filter((p) => p.configured).map((p) => `<option value="${p.id}" data-llm="${p.id === 'local' ? '' : esc(p.label.split(' (')[0])}">${esc(p.label)}</option>`),
].join('');
$('examples').replaceChildren(...boot.examples.map((ex) => {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.title = ex.question;
  b.innerHTML = `<span class="subject">${esc(ex.subject)}</span><span class="label">${esc(ex.label)}</span>`;
  b.onclick = () => { $('question').value = ex.question; ask(ex.question); };
  li.appendChild(b);
  return li;
}));
