# Animex — mechanical engineering problems, solved & animated

Paste a mechanical engineering syllabus problem into the chat. Animex solves it like a model exam answer (Given → Formula → Substitution → Result) **and plays the solution as an animated, narrated lesson**: mechanisms, free body diagrams, vector polygons, SFD/BMD.

### Built-in solvers (free, offline, checked against textbook answers)

| Topic | Subject | What it animates |
|---|---|---|
| Balancing of reciprocating masses (partial balancing, primary & secondary forces) | Dynamics of Machinery | slider-crank, balance mass, force components, forces over one revolution |
| Balancing of several masses rotating in one plane | Dynamics of Machinery | rotor end view, m·r comparison, vector polygon, balance mass position |
| Simply supported beam: reactions, SFD, BMD (point loads + UDL) | Strength of Materials | loaded beam, reactions, shaded SFD and BMD, M_max |
| Belt drive: T₁/T₂ = e^(μθ), power | Design of Transmission Systems | open belt drive, tension ratio, power |

Anything else in the syllabus (governors, flywheels, gears, cams, vibrations, thermodynamics, fluids…) is answered by an LLM when an API key is set.

```bash
cd animx
npm install
npm start            # http://localhost:3000
npm test
```

No API key? It still works: the built-in mechanical solvers above run offline (plus general maths: linear equations, plots, sorting). To answer *any* syllabus problem, copy `.env.example` to `.env` and add one key (Gemini and Groq both have free tiers).

## How it works

```
 question ─▶ Solver ─────────────▶ Animex Script (JSON) ─▶ validator ─▶ Player (SVG + voice)
             ├─ LLM: Claude / Gemini / Groq / Ollama           │
             └─ local code solvers + lessons (free)            └─ drops/repairs anything invalid
```

**The key idea:** the LLM never draws pixels or writes executable code. It writes a small, declarative **Animex Script**: scenes made of elements (text, box, circle, arrow, array, bars, plot…) plus a timeline of actions (`write`, `draw`, `grow`, `move`, `highlight`, `swap`, `change`…). A deterministic engine in the browser renders it.

| Approach we considered | Cost / speed | Quality | Safety | Verdict |
|---|---|---|---|---|
| LLM writes **Manim/Python** → render video server-side | slow (30s–minutes), needs Python + ffmpeg + LaTeX | beautiful when it works, often crashes | runs untrusted code | good "export" upgrade later |
| LLM writes raw **HTML/JS/p5** → run in iframe | 1 call, but long outputs | very inconsistent | runs untrusted code | too fragile |
| Text-to-video AI (Sora/Runway-like) | expensive, slow | pretty but **wrong math** | fine | not for explanations |
| **LLM writes a JSON scene script → our renderer** ✅ | 1 cheap call, renders instantly | consistent look | no code execution, validated | **chosen** |
| **Pure code solvers** (no LLM) ✅ | free, instant | always correct | safe | used for offline/demo |

## Project layout

```
server/
  index.js        HTTP server (no framework): /api/providers, /api/explain, static files, cache
  providers.js    Claude (official SDK), Gemini (REST), any OpenAI-compatible API (Groq/OpenRouter/Ollama)
  prompt.js       System prompt that teaches the LLM the Animex Script format
  local/          Offline engine:
    mechanical.js   reciprocating & rotating mass balancing, beam SFD/BMD, belt drives
    parse.js        reads quantities + units out of textbook-style problem statements
    solvers.js      general maths (linear equations, plots, sorting, binary search)
    lessons.js      hand-authored lessons
public/
  app.js          Chat UI + player controls
  engine/
    script.js     Animex Script spec + normalizer (shared by server and browser)
    timeline.js   Pure (script, time) -> element state; scene pacing
    renderer.js   SVG views per element type
    player.js     Clock, scene switching, narration via Web Speech API
    math.js       Safe expression parser for plots (no eval)
    geometry.js   Layout helpers shared by solvers and renderer
test/             node:test suite
```

## Cost notes

- Offline solvers and narration (browser speech) are free.
- Gemini Flash / Groq Llama free tiers are enough for demos.
- Claude: default `claude-opus-5-5` (best quality, about $0.05–0.10 per explanation). Set `ANTHROPIC_MODEL=claude-haiku-5-5` for ~50× cheaper. Server-side refusal fallback is enabled for Opus 5.5.
- Repeat questions are cached in memory per provider.

## Ideas for next steps

- Export to MP4 (MediaRecorder over a canvas rendering of the same timeline).
- More element types: matrix, tree/graph nodes, number line, geometry with angles.
- Let the LLM pick from a library of solver "templates" (sorting, graph search…) and fill in parameters, combining LLM flexibility with code correctness.
