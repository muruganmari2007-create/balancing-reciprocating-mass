// Player: owns the clock, swaps scenes, drives narration (Web Speech API — free, offline-capable).
import { STAGE } from './script.js';
import { buildTimeline, locate } from './timeline.js';
import { mountScene } from './renderer.js';

const NS = 'http://www.w3.org/2000/svg';

export class Player extends EventTarget {
  constructor(svg) {
    super();
    this.svg = svg;
    svg.setAttribute('viewBox', `0 0 ${STAGE.w} ${STAGE.h}`);
    this.layer = document.createElementNS(NS, 'g');
    this.caption = document.createElementNS(NS, 'text');
    Object.entries({ x: 8, y: 9, 'font-size': 4.2, 'font-weight': 700, fill: 'var(--stage-caption)', 'font-family': 'var(--font-sans)' })
      .forEach(([k, v]) => this.caption.setAttribute(k, v));
    svg.append(this.layer, this.caption);
    this.T = 0; this.playing = false; this.speed = 1; this.voice = true;
    this.timeline = null; this.current = -1; this.render = null; this.spoken = -1;
    this._tick = this._tick.bind(this);
  }

  load(script) {
    this.stopSpeech();
    this.script = script;
    this.timeline = buildTimeline(script);
    this.current = -1; this.spoken = -1;
    this.seek(0);
  }

  play() {
    if (!this.timeline) return;
    if (this.T >= this.timeline.total - 0.01) { this.spoken = -1; this.seek(0); }
    this.playing = true;
    if (window.speechSynthesis?.paused) speechSynthesis.resume();
    this._last = performance.now();
    requestAnimationFrame(this._tick);
    this._emit();
  }

  pause() {
    this.playing = false;
    if (window.speechSynthesis?.speaking) speechSynthesis.pause();
    this._emit();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  seek(T, { fromUser = false } = {}) {
    if (!this.timeline) return;
    this.T = Math.max(0, Math.min(T, this.timeline.total));
    if (fromUser) { // after a scrub, stay quiet until the next scene starts naturally
      this.stopSpeech();
      this.spoken = locate(this.timeline, this.T).entry.index;
    }
    this._draw();
  }

  gotoScene(i) {
    const entry = this.timeline?.scenes[Math.max(0, Math.min(i, this.timeline.scenes.length - 1))];
    if (!entry) return;
    this.stopSpeech();
    this.spoken = -1;
    this.seek(entry.start + 0.001);
  }

  stopSpeech() { window.speechSynthesis?.cancel(); }

  _speak(text) {
    if (!this.voice || !text || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = Math.min(2, 1.02 * this.speed);
    speechSynthesis.speak(u);
  }

  _tick(now) {
    if (!this.playing) return;
    const dt = Math.min(0.1, (now - this._last) / 1000) * this.speed;
    this._last = now;
    const { entry, local } = locate(this.timeline, this.T);
    const atSceneEnd = local + dt >= entry.duration - 0.02;
    // Hold the last frame of a scene until the narrator finishes talking.
    const waitForVoice = atSceneEnd && this.voice && speechSynthesis?.speaking && this.spoken === entry.index;
    if (!waitForVoice) this.T = Math.min(this.T + dt, this.timeline.total);
    this._draw();
    if (this.T >= this.timeline.total) { this.playing = false; this._emit(); return; }
    requestAnimationFrame(this._tick);
  }

  _draw() {
    const { entry, local } = locate(this.timeline, this.T);
    if (entry.index !== this.current) {
      this.current = entry.index;
      this.render = mountScene(this.layer, entry.scene);
      this.caption.textContent = entry.scene.caption || '';
      this.layer.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
      this.dispatchEvent(new CustomEvent('scene', { detail: entry }));
    }
    if (this.playing && this.spoken !== entry.index && local < 0.5) {
      this.spoken = entry.index;
      this._speak(entry.scene.narration);
    }
    this.render(local);
    this._emit();
  }

  _emit() { this.dispatchEvent(new CustomEvent('time', { detail: { T: this.T, total: this.timeline?.total ?? 0, playing: this.playing } })); }
}
