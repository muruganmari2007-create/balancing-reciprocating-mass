// Offline engine: routes a question to a code solver or a hand-made lesson.
import { solveReciprocating, solveRotatingMasses, solveBeam, solveBelt } from './mechanical.js';
import { solveLinear, solveSort, solveBinarySearch, solvePlot } from './solvers.js';
import { LESSONS } from './lessons.js';

const ROUTES = [
  // Mechanical engineering syllabus solvers first
  solveReciprocating,
  solveRotatingMasses,
  solveBeam,
  solveBelt,
  // General maths / algorithms
  (q) => (/\b(plot|graph|sketch)\b/i.test(q) ? solvePlot(q) : null),
  solveBinarySearch,
  solveSort,
  solveLinear,
  (q) => LESSONS.find((l) => l.match.test(q))?.build() ?? null,
];

/** A script if a built-in solver recognises the question, else null. */
export function tryLocally(question) {
  for (const route of ROUTES) {
    const script = route(question);
    if (script) return script;
  }
  return null;
}

export function solveLocally(question) {
  return tryLocally(question) ?? LESSONS.find((l) => l.id === 'welcome').build();
}

export const EXAMPLES = [
  { subject: 'DOM', label: 'Balancing of reciprocating masses', question: 'Single cylinder engine: 240 rpm, stroke 300 mm, reciprocating parts 50 kg, revolving parts 37 kg at 150 mm. Balance 2/3 of the reciprocating mass; balance mass radius 400 mm. Find B and the unbalanced force at 60° crank angle.' },
  { subject: 'DOM', label: 'Rotating masses in one plane', question: 'Four masses 200 kg, 300 kg, 240 kg and 260 kg rotate in one plane at radii 0.2 m, 0.15 m, 0.25 m and 0.3 m. The angles between successive masses are 45°, 75° and 135°. Find the balance mass at radius 0.2 m.' },
  { subject: 'SOM', label: 'Beam SFD & BMD', question: 'Simply supported beam of span 6 m carries point loads 20 kN at 2 m and 30 kN at 4 m from A, and a UDL of 10 kN/m over the whole span. Draw the SFD and BMD.' },
  { subject: 'DTS', label: 'Belt drive tensions & power', question: 'Belt drive: tight side tension 2000 N, coefficient of friction 0.3, angle of lap 165°, belt speed 20 m/s. Find the slack side tension and power transmitted.' },
];
