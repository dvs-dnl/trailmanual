/** Pure, deterministic exercise logic. This module does not calculate real vehicle dynamics. */
export const STAGES = Object.freeze(['scout','line','rear','debrief']);
export const MAX_SCORE = 100;
export const POINTS = Object.freeze({scout:30, line:40, rear:30});
export const CANDIDATE_PATHS = Object.freeze({
  a: [[360,365],[328,295],[264,225],[225,150],[228,80]],
  b: [[360,365],[361,295],[358,225],[351,150],[350,80]],
  c: [[360,365],[414,295],[469,225],[501,150],[515,80]]
});
export function initialState(){return {stage:'scout', checks:[], checkLocked:false, choice:null, choiceLocked:false, rear:null, rearLocked:false, progress:0};}
export function sanitizeState(raw, lesson){
  const state=initialState();
  if(!raw||typeof raw!=='object') return state;
  const checkIds=new Set(lesson.checks.map(c=>c.id));
  const choiceIds=new Set(lesson.lines.map(c=>c.id));
  const rearIds=new Set(lesson.rearQuestion.options.map(c=>c.id));
  state.checks=Array.isArray(raw.checks)? [...new Set(raw.checks.filter(x=>checkIds.has(x)))]:[];
  state.checkLocked=raw.checkLocked===true;
  state.choice=choiceIds.has(raw.choice)?raw.choice:null;
  state.choiceLocked=raw.choiceLocked===true&&state.choice!==null;
  state.rear=rearIds.has(raw.rear)?raw.rear:null;
  state.rearLocked=raw.rearLocked===true&&state.rear!==null;
  // Lock chronology is an invariant: stale/inconsistent storage cannot skip stages.
  if (!state.checkLocked) { state.choiceLocked=false; state.rearLocked=false; }
  if (!state.choiceLocked) state.rearLocked=false;
  const wanted=STAGES.includes(raw.stage)?raw.stage:'scout';
  const available=state.rearLocked?'debrief':state.choiceLocked?'rear':state.checkLocked?'line':'scout';
  state.stage=STAGES.indexOf(wanted)<=STAGES.indexOf(available)?wanted:available;
  state.progress=Number.isFinite(raw.progress)?Math.max(0,Math.min(100,Math.round(raw.progress))):0;
  return state;
}
export function score(state, lesson){
  const selected=new Set(state.checks);
  const good=lesson.checks.filter(c=>c.correct&&selected.has(c.id)).length;
  const bad=lesson.checks.filter(c=>!c.correct&&selected.has(c.id)).length;
  const scout=state.checkLocked?Math.max(0,good*10-bad*5):0;
  const line=state.choiceLocked&&lesson.lines.find(x=>x.id===state.choice)?.correct?40:0;
  const rear=state.rearLocked&&lesson.rearQuestion.options.find(x=>x.id===state.rear)?.correct?30:0;
  return {scout,line,rear,total:scout+line+rear,max:MAX_SCORE};
}
export function isValidChoice(lesson,id,group){
  return (group==='line'?lesson.lines:group==='rear'?lesson.rearQuestion.options:lesson.checks).some(x=>x.id===id);
}
export function interpolate(points,percent){
  const t=Math.max(0,Math.min(1,percent));
  const scaled=t*(points.length-1);
  const i=Math.min(points.length-2,Math.floor(scaled));
  const u=scaled-i;const [a,b]=[points[i],points[i+1]];
  return {x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u};
}
export function vehicleMarkers(lineId,progress){
  const points=CANDIDATE_PATHS[lineId]||CANDIDATE_PATHS.b;
  const front=interpolate(points,progress/100);
  const rear=interpolate(points,Math.max(0,progress/100-.2));
  return {front,rear};
}
export function pathD(points){return points.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ');}
export function canAdvance(state){return (state.stage==='scout'&&state.checkLocked)||(state.stage==='line'&&state.choiceLocked)||(state.stage==='rear'&&state.rearLocked);}
