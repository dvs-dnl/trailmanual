/** Pure scoring and progression rules for Trail Reading Lab 01. */
export const POINTS = Object.freeze({ hazard: 15, evidence: 10, decision: 20 });
export const STAGES = Object.freeze(['scan', 'evidence', 'decision', 'debrief']);

export function initialState() {
  return { stage: 'scan', found: [], revealed: false, answers: {}, decision: null, checklist: [] };
}

export function sanitizeState(raw, lesson) {
  const fresh = initialState();
  if (!raw || typeof raw !== 'object') return fresh;
  const hazards = new Set(lesson.hazards.map(x => x.id));
  const questionMap = new Map(lesson.evidenceQuestions.map(x => [x.id, x]));
  const optionIds = new Set(lesson.decision.options.map(x => x.id));
  const found = Array.isArray(raw.found) ? [...new Set(raw.found.filter(x => hazards.has(x)))] : [];
  const answers = {};
  if (raw.answers && typeof raw.answers === 'object') {
    for (const [key, value] of Object.entries(raw.answers)) {
      if (questionMap.has(key) && (value === 'visible' || value === 'unknown')) answers[key] = value;
    }
  }
  const decision = optionIds.has(raw.decision) ? raw.decision : null;
  let stage = STAGES.includes(raw.stage) ? raw.stage : 'scan';
  const revealed = raw.revealed === true;
  if (stage !== 'scan' && found.length !== lesson.hazards.length && !revealed) stage = 'scan';
  if (['decision', 'debrief'].includes(stage) && Object.keys(answers).length !== lesson.evidenceQuestions.length) stage = 'evidence';
  if (stage === 'debrief' && decision === null) stage = 'decision';
  return { stage, found, revealed, answers, decision, checklist: Array.isArray(raw.checklist) ? [...new Set(raw.checklist.filter(x => Number.isInteger(x) && x >= 0 && x < lesson.debrief.length))] : [] };
}

export function nearestHazard(x, y, hazards, found = []) {
  if (![x, y].every(Number.isFinite) || x < 0 || y < 0 || x > 100 || y > 100) return null;
  let best = null;
  let nearest = Infinity;
  for (const hazard of hazards) {
    if (found.includes(hazard.id)) continue;
    // Correct for the wide image aspect ratio so near clicks feel natural.
    const distance = Math.sqrt(((x - hazard.x) * 1.15) ** 2 + ((y - hazard.y) * 0.9) ** 2);
    if (distance <= hazard.radius && distance < nearest) { best = hazard; nearest = distance; }
  }
  return best;
}

export function canAdvance(state, lesson) {
  if (state.stage === 'scan') return state.revealed || state.found.length === lesson.hazards.length;
  if (state.stage === 'evidence') return lesson.evidenceQuestions.every(q => state.answers[q.id] !== undefined);
  if (state.stage === 'decision') return state.decision !== null;
  return false;
}

export function score(state, lesson) {
  const byStage = {
    scan: state.found.length * POINTS.hazard,
    evidence: lesson.evidenceQuestions.filter(q => state.answers[q.id] === q.answer).length * POINTS.evidence,
    decision: lesson.decision.options.some(x => x.id === state.decision && x.correct) ? POINTS.decision : 0
  };
  const max = lesson.hazards.length * POINTS.hazard + lesson.evidenceQuestions.length * POINTS.evidence + POINTS.decision;
  const total = Object.values(byStage).reduce((a, b) => a + b, 0);
  return { byStage, total, max, percentage: Math.round(total / max * 100) };
}

export function coachingBand(percentage) {
  if (percentage >= 90) return 'Strong hazard awareness';
  if (percentage >= 70) return 'Good foundation — review the missed details';
  return 'Build your scan routine — revisit the missed details';
}
