// Hand-authored lessons for the offline demo. Each `build()` returns an Animex Script.

export const LESSONS = [
  {
    id: 'welcome',
    match: /^(hi|hello|help|what is animex|how does animex work)\b/i,
    build: () => ({
      title: 'How Animex works',
      answer: 'None of the built-in mechanical solvers recognised this question. Add a free GEMINI_API_KEY or Groq key to .env (and pick it in the dropdown) to answer any syllabus problem, or try one of the example prompts.',
      steps: [
        'Your question is sent to a solver: an LLM (Claude, Gemini, Groq, Ollama) or built-in code.',
        'The solver returns an Animex Script: JSON describing scenes, shapes and a timeline.',
        'The browser player renders the script as SVG and narrates it with your device voice.',
      ],
      scenes: [
        {
          caption: 'From question to animation',
          narration: 'Animex turns a question into an animated lesson. First, your question goes to a solver.',
          elements: [
            { id: 'q', type: 'box', x: 22, y: 48, w: 30, h: 14, label: 'Your question', fill: 'primary' },
            { id: 's', type: 'box', x: 62, y: 48, w: 30, h: 14, label: 'Solver', fill: 'accent' },
            { id: 'a1', type: 'arrow', x1: 38, y1: 48, x2: 46, y2: 48, color: 'muted' },
            { id: 'opts', type: 'text', text: 'LLM  or  built-in code', x: 62, y: 64, size: 3.2, color: 'muted' },
          ],
          actions: [
            { do: 'grow', target: 'q', at: 0.3 }, { do: 'draw', target: 'a1', at: 1.3 },
            { do: 'grow', target: 's', at: 1.9 }, { do: 'write', target: 'opts', at: 2.8 },
          ],
        },
        {
          caption: 'A script, not a video',
          narration: 'The solver does not draw pixels. It writes a small JSON script of shapes and timed actions, which is cheap, safe, and easy to check.',
          elements: [
            { id: 's', type: 'box', x: 30, y: 48, w: 30, h: 14, label: 'Solver', fill: 'accent' },
            { id: 'j', type: 'box', x: 80, y: 48, w: 34, h: 14, label: 'Animex Script', fill: 'warn' },
            { id: 'p', type: 'box', x: 130, y: 48, w: 30, h: 14, label: 'Player', fill: 'good' },
            { id: 'a1', type: 'arrow', x1: 46, y1: 48, x2: 62, y2: 48, color: 'muted' },
            { id: 'a2', type: 'arrow', x1: 98, y1: 48, x2: 114, y2: 48, color: 'muted' },
            { id: 'code', type: 'text', text: '{ "do": "draw", "target": "arrow1", "at": 1.5 }', x: 80, y: 70, size: 3.2, font: 'math', color: 'muted' },
          ],
          actions: [
            { do: 'grow', target: 'j', at: 0.6 }, { do: 'draw', target: 'a1', at: 0.2 },
            { do: 'write', target: 'code', at: 1.4, dur: 2 },
            { do: 'draw', target: 'a2', at: 3.6 }, { do: 'grow', target: 'p', at: 4.2 },
          ],
        },
        {
          caption: 'Try these offline',
          narration: 'Without an API key, built-in solvers still handle classic mechanical syllabus problems: balancing of reciprocating and rotating masses, shear force and bending moment diagrams, and belt drives. Add a free Gemini or Groq key to ask anything.',
          elements: [
            { id: 't1', type: 'text', text: 'Balancing of reciprocating masses', x: 80, y: 30, size: 4.5 },
            { id: 't2', type: 'text', text: 'Balancing of rotating masses (one plane)', x: 80, y: 42, size: 4.5 },
            { id: 't3', type: 'text', text: 'SFD & BMD of simply supported beams', x: 80, y: 54, size: 4.5 },
            { id: 't4', type: 'text', text: 'Belt drive tensions & power', x: 80, y: 66, size: 4.5 },
          ],
          actions: [
            { do: 'write', target: 't1', at: 0.3 }, { do: 'write', target: 't2', at: 1.3 },
            { do: 'write', target: 't3', at: 2.3 }, { do: 'write', target: 't4', at: 3.5 },
          ],
        },
      ],
    }),
  },

  {
    id: 'pythagoras',
    match: /pythag|right[- ]angled? triangle|hypotenuse/i,
    build: () => ({
      title: 'The Pythagorean theorem',
      answer: 'In a right triangle, a² + b² = c², where c is the side opposite the right angle (the hypotenuse).',
      steps: [
        'Take a right triangle with legs a and b, and hypotenuse c.',
        'Build a square on each side: their areas are a², b² and c².',
        'The two smaller squares exactly fill the big one: a² + b² = c².',
        'Example: 3² + 4² = 9 + 16 = 25 = 5², so c = 5.',
      ],
      scenes: [
        {
          caption: 'A right triangle',
          narration: 'Here is a right triangle. The two short sides, called legs, are 3 and 4. The long side, opposite the right angle, is the hypotenuse.',
          elements: [
            { id: 'b', type: 'line', x1: 50, y1: 74, x2: 98, y2: 74, color: 'primary', width: 1 },
            { id: 'a', type: 'line', x1: 50, y1: 74, x2: 50, y2: 38, color: 'accent', width: 1 },
            { id: 'c', type: 'line', x1: 50, y1: 38, x2: 98, y2: 74, color: 'warn', width: 1 },
            { id: 'ra', type: 'box', x: 52.5, y: 71.5, w: 5, h: 5, color: 'muted' },
            { id: 'la', type: 'text', text: 'a = 3', x: 44, y: 56, size: 4, color: 'accent', align: 'end' },
            { id: 'lb', type: 'text', text: 'b = 4', x: 74, y: 81, size: 4, color: 'primary' },
            { id: 'lc', type: 'text', text: 'c = ?', x: 80, y: 52, size: 4, color: 'warn', align: 'start' },
          ],
          actions: [
            { do: 'draw', target: 'b', at: 0.2 }, { do: 'draw', target: 'a', at: 0.9 }, { do: 'draw', target: 'ra', at: 1.6 },
            { do: 'write', target: 'la', at: 2 }, { do: 'write', target: 'lb', at: 2.5 },
            { do: 'draw', target: 'c', at: 3.4, dur: 1 }, { do: 'write', target: 'lc', at: 4.4 }, { do: 'pulse', target: 'c', at: 5.2 },
          ],
        },
        {
          caption: 'Compare the areas',
          narration: 'Now build a square on each side. Their areas are 3 squared, which is 9, 4 squared, which is 16, and c squared.',
          elements: [
            { id: 'bars', type: 'bars', values: [9, 16, 25], labels: ['a² = 9', 'b² = 16', 'c² = ?'], x: 80, y: 52, w: 90, h: 44, color: 'primary' },
          ],
          actions: [
            { do: 'grow', target: 'bars', at: 0.3, dur: 1.5 },
            { do: 'highlight', target: 'bars[0]', color: 'accent', at: 2 },
            { do: 'highlight', target: 'bars[1]', color: 'primary', at: 2.6 },
            { do: 'highlight', target: 'bars[2]', color: 'warn', at: 3.4 },
          ],
        },
        {
          caption: 'a² + b² = c²',
          narration: 'The two smaller squares together exactly fill the biggest one. 9 plus 16 is 25, and the square root of 25 is 5. So the hypotenuse is 5.',
          elements: [
            { id: 'eq', type: 'text', text: 'a² + b² = c²', x: 80, y: 32, size: 9, font: 'math', bold: true },
            { id: 'ex', type: 'text', text: '9 + 16 = 25', x: 80, y: 52, size: 6, font: 'math', color: 'muted' },
            { id: 'ans', type: 'box', x: 80, y: 70, w: 40, h: 12, label: 'c = √25 = 5', fill: 'good', size: 4.5 },
          ],
          actions: [
            { do: 'write', target: 'eq', at: 0.2, dur: 1.4 }, { do: 'write', target: 'ex', at: 2.2 },
            { do: 'grow', target: 'ans', at: 4 }, { do: 'pulse', target: 'eq', at: 5 },
          ],
        },
      ],
    }),
  },

  {
    id: 'photosynthesis',
    match: /photosynth/i,
    build: () => ({
      title: 'How photosynthesis works',
      answer: 'Plants use light energy to turn water and carbon dioxide into glucose, releasing oxygen: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂.',
      steps: [
        'Leaves absorb sunlight with chlorophyll inside chloroplasts.',
        'Roots supply water (H₂O); leaves take in carbon dioxide (CO₂) through stomata.',
        'Light reactions split water, release O₂, and make ATP + NADPH.',
        'The Calvin cycle uses ATP + NADPH to build glucose from CO₂.',
      ],
      scenes: [
        {
          caption: 'Ingredients',
          narration: 'A plant needs three ingredients: sunlight, water from the roots, and carbon dioxide from the air.',
          elements: [
            { id: 'sun', type: 'circle', x: 26, y: 26, r: 8, label: 'Light', fill: 'warn' },
            { id: 'h2o', type: 'box', x: 26, y: 52, w: 26, h: 10, label: '6 H₂O', fill: 'primary' },
            { id: 'co2', type: 'box', x: 26, y: 72, w: 26, h: 10, label: '6 CO₂', fill: 'muted' },
            { id: 'leaf', type: 'circle', x: 82, y: 50, r: 14, label: 'Leaf', fill: 'good' },
            { id: 'a1', type: 'arrow', x1: 35, y1: 30, x2: 68, y2: 44, color: 'warn' },
            { id: 'a2', type: 'arrow', x1: 40, y1: 52, x2: 67, y2: 51, color: 'primary' },
            { id: 'a3', type: 'arrow', x1: 40, y1: 70, x2: 69, y2: 57, color: 'muted' },
          ],
          actions: [
            { do: 'grow', target: 'leaf', at: 0.2 },
            { do: 'grow', target: 'sun', at: 1 }, { do: 'draw', target: 'a1', at: 1.6 },
            { do: 'grow', target: 'h2o', at: 2.4 }, { do: 'draw', target: 'a2', at: 3 },
            { do: 'grow', target: 'co2', at: 3.8 }, { do: 'draw', target: 'a3', at: 4.4 },
          ],
        },
        {
          caption: 'Products',
          narration: 'Inside the leaf, the chloroplasts turn those into glucose, the plant\'s food, and release oxygen into the air.',
          elements: [
            { id: 'leaf', type: 'circle', x: 60, y: 50, r: 14, label: 'Chloroplast', fill: 'good', size: 3.2 },
            { id: 'glu', type: 'box', x: 128, y: 36, w: 34, h: 11, label: 'C₆H₁₂O₆', fill: 'accent' },
            { id: 'o2', type: 'box', x: 128, y: 64, w: 34, h: 11, label: '6 O₂', fill: 'primary' },
            { id: 'b1', type: 'arrow', x1: 75, y1: 46, x2: 110, y2: 37, color: 'accent' },
            { id: 'b2', type: 'arrow', x1: 75, y1: 54, x2: 110, y2: 63, color: 'primary' },
          ],
          actions: [
            { do: 'pulse', target: 'leaf', at: 0.4 },
            { do: 'draw', target: 'b1', at: 1.2 }, { do: 'grow', target: 'glu', at: 1.9 },
            { do: 'draw', target: 'b2', at: 2.8 }, { do: 'grow', target: 'o2', at: 3.5 },
          ],
        },
        {
          caption: 'Two stages',
          narration: 'It happens in two stages. Light reactions split water and store energy as ATP and NADPH. The Calvin cycle then spends that energy to build glucose from carbon dioxide.',
          elements: [
            { id: 's1', type: 'box', x: 42, y: 46, w: 44, h: 16, label: 'Light reactions', fill: 'warn' },
            { id: 's2', type: 'box', x: 118, y: 46, w: 44, h: 16, label: 'Calvin cycle', fill: 'good' },
            { id: 'e', type: 'arrow', x1: 65, y1: 46, x2: 95, y2: 46, color: 'accent', label: 'ATP + NADPH' },
            { id: 'o', type: 'text', text: 'releases O₂', x: 42, y: 64, size: 3.5, color: 'muted' },
            { id: 'g', type: 'text', text: 'makes glucose', x: 118, y: 64, size: 3.5, color: 'muted' },
            { id: 'eq', type: 'text', text: '6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂', x: 80, y: 80, size: 4.2, font: 'math' },
          ],
          actions: [
            { do: 'grow', target: 's1', at: 0.3 }, { do: 'write', target: 'o', at: 1.2 },
            { do: 'draw', target: 'e', at: 2.2 }, { do: 'grow', target: 's2', at: 3.2 },
            { do: 'write', target: 'g', at: 4 }, { do: 'write', target: 'eq', at: 5, dur: 1.6 },
          ],
        },
      ],
    }),
  },
];
