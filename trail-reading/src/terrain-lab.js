import { initialState, sanitizeState, nearestHazard, canAdvance, score, coachingBand, STAGES } from './assessment.js';

const STORAGE_KEY = 'trailmanual.terrain-reading-01.v1';
const LESSON_URL = new URL('../data/lesson-01.json', import.meta.url);
const assetUrl = path => new URL('../' + path, import.meta.url).href;
const root = document.getElementById('app');
let lesson;
let state;
let notice = '';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode/storage denial */ }
}
function update(fn, { focus = false } = {}) {
  fn(); persist(); render();
  if (focus) root.querySelector('#stage-title')?.focus();
}
function changeStage(stage) {
  if (!STAGES.includes(stage)) return;
  update(() => { state.stage = stage; notice = ''; }, { focus: true });
}
function stageIndex() { return STAGES.indexOf(state.stage); }
function progress() {
  const steps = [{id:'scan',name:'Spot hazards'},{id:'evidence',name:'Fact or unknown?'},{id:'decision',name:'Choose next step'},{id:'debrief',name:'Debrief'}];
  const current = stageIndex();
  return `<nav aria-label="Lesson steps"><ol class="stepper">${steps.map((s,i)=>`<li class="step ${i===current?'step--current':''} ${i<current?'step--done':''}"><span class="step__number" aria-hidden="true">${i<current?'✓':i+1}</span><span>${s.name}</span>${i===current?'<span class="sr-only">, current step</span>':''}</li>`).join('')}</ol></nav>`;
}
function noticeHtml() { return `<div class="feedback ${notice?'feedback--show':''}">${notice ? escapeHtml(notice) : ''}</div>`; }
function scan() {
  const remaining = state.revealed ? [] : lesson.hazards.filter(x => !state.found.includes(x.id));
  const pins = lesson.hazards.filter(x => state.found.includes(x.id) || state.revealed).map((h,i)=>`<span class="pin ${state.found.includes(h.id)?'pin--found':'pin--revealed'}" style="left:${h.x}%;top:${h.y}%" title="${escapeHtml(h.name)}">${i+1}</span>`).join('');
  const foundCards = lesson.hazards.filter(x => state.found.includes(x.id) || state.revealed).map(h=>`<article class="hazard-card"><div class="hazard-card__top"><span class="hazard-tag">${escapeHtml(h.zone)}</span><strong>${escapeHtml(h.name)}</strong></div><p>${escapeHtml(h.explanation)}</p><p class="hazard-card__check"><strong>Scout:</strong> ${escapeHtml(h.check)}</p></article>`).join('');
  return `<section aria-labelledby="stage-title"><div class="section-heading"><span class="eyebrow">01 / Observe</span><h2 id="stage-title" tabindex="-1">What could stop your rig?</h2><p>Look for changes in height, loose material, an unstable edge, and anything you can't see. Tap the suspicious areas of the illustration. Find all four.</p></div>
    <div class="scene-frame" id="scene-frame" role="group" aria-label="Interactive trail illustration. Tap likely hazards or use the inspect-zone buttons beneath the image.">
      <img class="scene-img" src="${assetUrl(lesson.asset)}" alt="${escapeHtml(lesson.assetAlt)}" width="1672" height="941" />
      <div class="map-markers" aria-hidden="true">${pins}</div>
      <div class="scene-counter"><span class="counter-dot"></span> ${state.found.length} / ${lesson.hazards.length} identified</div>
    </div>
    <p class="scene-note"><span aria-hidden="true">ⓘ</span> ${escapeHtml(lesson.assetStatus)}</p>
    <div class="zone-panel"><div><h3>Can't use the image?</h3><p>Inspect a named zone using the accessible buttons below.</p></div><div class="zone-grid">${remaining.map(h=>`<button class="zone-button" type="button" data-hazard="${h.id}">Inspect ${escapeHtml(h.zone)}</button>`).join('') || '<span class="mini-success">All zones identified.</span>'}</div></div>
    ${noticeHtml()}
    <div class="found-grid" aria-label="Hazard explanations">${foundCards || '<p class="empty-state">Find a hazard to reveal its explanation and what you need to verify.</p>'}</div>
    <div class="actions"><button class="btn btn--quiet" type="button" id="reveal-btn" ${state.revealed?'disabled':''}>${state.revealed?'All hazards shown':'Show what I missed'}</button><button class="btn btn--primary" type="button" data-advance ${canAdvance(state,lesson)?'':'disabled'}>Continue to evidence <span aria-hidden="true">→</span></button></div>
    </section>`;
}
function evidence() {
  const completed = Object.keys(state.answers).length;
  return `<section aria-labelledby="stage-title"><div class="section-heading"><span class="eyebrow">02 / Interpret</span><h2 id="stage-title" tabindex="-1">What do you actually know?</h2><p>An image can show an obstacle. It can't reliably tell you its measurements, surface strength, or your vehicle's clearance. Sort each statement.</p></div>
    <div class="lesson-insight"><span class="lesson-insight__glyph" aria-hidden="true">?</span><div><strong>Visible is not the same as verified.</strong><p>Answer “Visible observation” only if the image itself supports the complete statement. Otherwise select “Needs verification.”</p></div></div>
    <div class="question-stack">${lesson.evidenceQuestions.map((q,i)=>{
      const selected=state.answers[q.id];const answered=selected!==undefined;
      const correct=answered&&selected===q.answer;
      return `<fieldset class="question-card"><legend><span class="question-index">${String(i+1).padStart(2,'0')}</span> ${escapeHtml(q.prompt)}</legend><div class="choice-row"><button type="button" class="choice ${selected==='visible'?'choice--selected':''}" data-question="${q.id}" data-answer="visible" ${answered?'disabled':''}>Visible observation</button><button type="button" class="choice ${selected==='unknown'?'choice--selected':''}" data-question="${q.id}" data-answer="unknown" ${answered?'disabled':''}>Needs verification</button></div>${answered?`<p class="explanation ${correct?'explanation--yes':'explanation--no'}" id="explain-${q.id}" tabindex="-1"><strong>${correct?'Correct.':'Not quite.'}</strong> ${escapeHtml(q.explanation)}</p>`:''}</fieldset>`;}).join('')}</div>
    <div class="actions"><button class="btn btn--quiet" type="button" data-back>← Back to hazards</button><span class="action-count">${completed} / ${lesson.evidenceQuestions.length} answered</span><button class="btn btn--primary" type="button" data-advance ${canAdvance(state,lesson)?'':'disabled'}>Choose your response <span aria-hidden="true">→</span></button></div></section>`;
}
function decision() {
  return `<section aria-labelledby="stage-title"><div class="section-heading"><span class="eyebrow">03 / Decide</span><h2 id="stage-title" tabindex="-1">What's the next responsible move?</h2><p>${escapeHtml(lesson.decision.prompt)}</p></div>
   <div class="decision-grid">${lesson.decision.options.map((o,i)=>{
     const chosen=state.decision===o.id; const answered=state.decision!==null;
     return `<button type="button" class="decision-card ${chosen?'decision-card--chosen':''}" data-decision="${o.id}" ${answered?'disabled':''}><span class="decision-card__letter">${String.fromCharCode(65+i)}</span><span class="decision-card__body"><strong>${escapeHtml(o.title)}</strong><span>${escapeHtml(o.description)}</span></span><span class="decision-card__radio" aria-hidden="true">${chosen?'●':'○'}</span></button>`;
   }).join('')}</div>
   ${state.decision!==null?`<div class="decision-feedback" id="decision-review" tabindex="-1"><span class="eyebrow">Decision review</span><h3>${lesson.decision.options.find(x=>x.id===state.decision).correct?'Appropriate next action':'Reassess before driving'}</h3><p>${escapeHtml(lesson.decision.options.find(x=>x.id===state.decision).feedback)}</p><p>The point is not to prove you can drive the obstacle from a photo. It is to recognize when you need more information.</p></div>`:''}
   <div class="actions"><button type="button" class="btn btn--quiet" data-back>← Back to evidence</button><button class="btn btn--primary" type="button" data-advance ${canAdvance(state,lesson)?'':'disabled'}>View your debrief <span aria-hidden="true">→</span></button></div></section>`;
}
function debrief() {
  const s=score(state,lesson);
  return `<section aria-labelledby="stage-title"><div class="section-heading"><span class="eyebrow">04 / Apply</span><h2 id="stage-title" tabindex="-1">Make the scan a habit.</h2><p>You have completed this terrain reading lesson. The goal is a repeatable decision process—not a single memorized line.</p></div>
   <div class="results-grid"><div class="results-score"><span class="eyebrow">Lesson score</span><div class="big-score">${s.total}<span> / ${s.max}</span></div><strong>${escapeHtml(coachingBand(s.percentage))}</strong><p>First-attempt answers and hazards found before revealing the map.</p></div><div class="result-breakdown"><h3>What you demonstrated</h3><div><span>Hazards spotted</span><strong>${s.byStage.scan} / ${lesson.hazards.length*15}</strong></div><div><span>Evidence vs. inference</span><strong>${s.byStage.evidence} / ${lesson.evidenceQuestions.length*10}</strong></div><div><span>Decision quality</span><strong>${s.byStage.decision} / 20</strong></div></div></div>
   <div class="checklist-card"><div class="section-heading"><span class="eyebrow">Before the next obstacle</span><h3>Your five-point terrain scan</h3></div><ul class="checklist">${lesson.debrief.map((item,i)=>`<li><label><input type="checkbox" data-check="${i}" ${state.checklist.includes(i)?'checked':''}/><span>${escapeHtml(item)}</span></label></li>`).join('')}</ul><p class="checklist-note">This checklist is a learning aid, not a substitute for field instruction or route-specific judgment.</p></div>
   <div class="next-up"><div><span class="eyebrow">Next skill</span><h3>Put it together: Pick Your Line</h3><p>Take what you learned about hazards and verification into Trail Manual's existing Line Picker.</p></div><a class="btn btn--primary" href="/line-picker.html">Open Line Picker <span aria-hidden="true">↗</span></a></div>
   <div class="actions"><button type="button" class="btn btn--quiet" data-back>← Review your decision</button><button type="button" class="btn btn--quiet" id="reset-btn">Start this lesson over</button></div></section>`;
}
const live = document.getElementById('trl-live');
function focusKey(el) {
  if (!el || !root.contains(el)) return null;
  for (const attr of ['data-hazard', 'data-question', 'data-decision', 'data-check']) {
    if (el.hasAttribute(attr)) return { attr, value: el.getAttribute(attr) };
  }
  if (el.id === 'reveal-btn') return { attr: 'reveal' };
  return null;
}
function restoreFocus(key) {
  if (!key) return;
  const enabled = sel => [...root.querySelectorAll(sel)].find(x => !x.disabled) || null;
  let target = null;
  if (key.attr === 'data-hazard') target = enabled('[data-hazard]') || enabled('[data-advance]') || enabled('#reveal-btn');
  else if (key.attr === 'reveal') target = enabled('[data-advance]');
  else if (key.attr === 'data-question') target = root.querySelector(`#explain-${key.value}`) || enabled(`[data-question="${key.value}"]`);
  else if (key.attr === 'data-decision') target = root.querySelector('#decision-review') || enabled('[data-decision]');
  else if (key.attr === 'data-check') target = root.querySelector(`[data-check="${key.value}"]`);
  target?.focus();
}
function render() {
  const key = focusKey(document.activeElement);
  const stepContent = {scan, evidence, decision, debrief}[state.stage]();
  root.innerHTML = `${progress()}<div class="lab-layout"><div class="lab-main">${stepContent}</div><aside class="field-note" aria-label="Field notes"><div class="field-note__top"><span class="eyebrow">Field notes / 01</span><div class="field-note__rule"></div><h3>The three questions</h3><p>When you're reading terrain, ask:</p><ol><li><strong>What do I see?</strong><span>Terrain shape, loose material, edges, exits.</span></li><li><strong>What don't I know?</strong><span>Depth, stability, traction, clearance.</span></li><li><strong>What will I verify?</strong><span>Stop, scout, and evaluate the whole vehicle path.</span></li></ol></div><div class="field-note__bottom"><span class="mini-label">TRAINING PRINCIPLE</span><p>Being able to stop and reassess is a skill. Don't let a photo substitute for a trail inspection.</p><a href="https://treadlightly.org/tips/4x4/" target="_blank" rel="noopener noreferrer">Responsible four-wheeling guidance ↗</a></div></aside></div>`;
  bind();
  restoreFocus(key);
  if (live && live.textContent !== notice) live.textContent = notice;
}
function detect(hazard) {
  if (state.revealed) { notice = 'Review mode: hazards are visible, and the score is locked for this step.'; render(); return; }
  if (!hazard) { notice = 'Not one of the four target areas. Scan for an edge, rocks, an eroded channel, or a hidden exit.'; render(); return; }
  update(() => {
    if (!state.found.includes(hazard.id)) state.found.push(hazard.id);
    notice = `Found: ${hazard.name}. Read its explanation below.`;
  });
}
function bind() {
  const frame=root.querySelector('#scene-frame');
  frame?.addEventListener('click', evt => {
    const rect=frame.getBoundingClientRect();
    const x=(evt.clientX-rect.left)/rect.width*100;
    const y=(evt.clientY-rect.top)/rect.height*100;
    detect(nearestHazard(x,y,lesson.hazards,state.found));
  });
  root.querySelectorAll('[data-hazard]').forEach(btn=>btn.addEventListener('click',()=>detect(lesson.hazards.find(x=>x.id===btn.dataset.hazard))));
  root.querySelector('#reveal-btn')?.addEventListener('click',()=>update(()=>{state.revealed=true;notice='Unfound hazards are shown for review; only independently spotted hazards earn points.';}));
  root.querySelectorAll('[data-question]').forEach(btn=>btn.addEventListener('click',()=>update(()=>{if(state.answers[btn.dataset.question]===undefined)state.answers[btn.dataset.question]=btn.dataset.answer;})));
  root.querySelectorAll('[data-decision]').forEach(btn=>btn.addEventListener('click',()=>update(()=>{if(state.decision===null) state.decision=btn.dataset.decision;})));
  root.querySelectorAll('[data-check]').forEach(el=>el.addEventListener('change',()=>update(()=>{const id=Number(el.dataset.check);state.checklist=el.checked?[...new Set([...state.checklist,id])]:state.checklist.filter(x=>x!==id);})))
  root.querySelector('[data-advance]')?.addEventListener('click',()=>{if(canAdvance(state,lesson)) changeStage(STAGES[stageIndex()+1]);});
  root.querySelector('[data-back]')?.addEventListener('click',()=>changeStage(STAGES[stageIndex()-1]));
  root.querySelector('#reset-btn')?.addEventListener('click',()=>{if(window.confirm('Reset this lesson and score?'))update(()=>{state=initialState();notice='';},{focus:true});});
}
async function init() {
  try {
    const response = await fetch(LESSON_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Lesson JSON HTTP ${response.status}`);
    lesson = await response.json();
    state = sanitizeState(loadState(),lesson);
    render();
  } catch(error) {
    root.innerHTML = `<div class="load-error"><h2>Lesson unavailable</h2><p>The lesson data could not be loaded. Open this package through a local web server or deployed website, not directly as a file.</p><p><code>${escapeHtml(error.message)}</code></p></div>`;
  }
}
init();
