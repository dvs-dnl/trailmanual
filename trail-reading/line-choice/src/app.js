import {STAGES,MAX_SCORE,initialState,sanitizeState,score,isValidChoice,CANDIDATE_PATHS,pathD,vehicleMarkers,canAdvance} from './line-lesson.js';
const app=document.querySelector('#trailLineLab');
const storageKey='tm.trailreading.lesson02.v1';
const esc=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lesson;let state=initialState();
const load=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null')}catch{return null}};
const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(state))}catch{}};
const icon=(s)=>`<span aria-hidden="true">${s}</span>`;
const stageTitle={scout:'1. Scout before you choose',line:'2. Compare all three lines',rear:'3. Think beyond the front axle',debrief:'4. Debrief your decision'};
function progress(){return `<nav class="trl-progress" aria-label="Lesson progress">${STAGES.map((id,i)=>`<span data-current="${state.stage===id}" data-done="${STAGES.indexOf(state.stage)>i}">${['Scout','Line choice','Rear path','Debrief'][i]}</span>`).join('')}</nav>`;}
function schematic(){
 const chosen=state.choice||'b';
 const points=CANDIDATE_PATHS[chosen];
 const markers=vehicleMarkers(chosen,state.progress);
 const colors={a:'#c17d36',b:'#315f46',c:'#b75d42'};
 const paths=Object.entries(CANDIDATE_PATHS).map(([id,pts])=>`<path d="${pathD(pts)}" fill="none" stroke="${colors[id]}" stroke-width="${chosen===id?9:5}" stroke-linecap="round" stroke-linejoin="round" opacity="${chosen===id?1:.42}" stroke-dasharray="${chosen===id?'none':'12 9'}"/><text x="${pts[3][0]+(id==='a'?-32:id==='c'?27:16)}" y="${pts[3][1]-3}" font-family="system-ui" font-weight="800" font-size="21" fill="${colors[id]}" paint-order="stroke" stroke="#f2e8d7" stroke-width="5">${id.toUpperCase()}</text>`).join('');
 return `<svg class="trl-diagram" viewBox="0 0 720 430" role="img" aria-label="Conceptual top-down view of a trail corridor with a left rock shelf, center inspection route and right erosion edge. Lines A, B and C are illustrative only, not measured or driveable directions." xmlns="http://www.w3.org/2000/svg">
 <rect width="720" height="430" fill="#e4cfad"/>
 <path d="M170 0 Q148 90 169 170 T176 430 H546 Q555 320 559 213 T548 0 Z" fill="#eee1c7" stroke="#a28f75" stroke-width="2" stroke-dasharray="11 7"/>
 <path d="M167 0 Q148 90 169 170 T176 430" fill="none" stroke="#af874f" stroke-width="9" opacity=".38"/>
 <path d="M547 0 Q559 145 551 255 T546 430" fill="none" stroke="#9f704d" stroke-width="10" opacity=".38"/>
 <g fill="#a37047" stroke="#875735" stroke-width="2"><path d="M170 73 L245 48 L280 92 L272 163 L202 177 L156 142Z"/><path d="M170 197 L266 187 L291 239 L246 276 L166 266 Z"/><path d="M151 306 L237 301 L255 342 L186 370 L144 350Z"/></g>
 <g fill="#f3d2a2" opacity=".72"><path d="M178 81L233 66L240 100L201 137Z"/><path d="M177 209L240 202L252 230L185 254Z"/></g>
 <path d="M527 -5 Q499 72 524 138 Q550 194 509 245 Q493 283 528 345 L543 435" stroke="#7a4b37" fill="none" stroke-width="55" opacity=".48"/><path d="M527 -5 Q499 72 524 138 Q550 194 509 245 Q493 283 528 345 L543 435" stroke="#6a4236" fill="none" stroke-width="17" stroke-dasharray="26 12" opacity=".6"/>
 <g fill="#ac9980"><ellipse cx="324" cy="223" rx="17" ry="9" transform="rotate(-10 324 223)"/><ellipse cx="391" cy="230" rx="13" ry="8"/><ellipse cx="334" cy="164" rx="9" ry="7"/></g>
 <path d="M183 12 L182 407 M539 12 L539 407" stroke="#523d2f" stroke-width="2" stroke-dasharray="3 12" opacity=".6"/>
 <text x="22" y="38" fill="#61442e" font-size="18" font-weight="800" font-family="system-ui">Rock shelf</text><text x="24" y="60" fill="#654b3a" font-size="13" font-family="system-ui">Clearance risk</text><text x="565" y="38" fill="#61442e" font-size="18" font-weight="800" font-family="system-ui">Rut edge</text><text x="565" y="60" fill="#654b3a" font-size="13" font-family="system-ui">No shoulder</text>
 ${paths}
 <circle id="trlRear" cx="${markers.rear.x}" cy="${markers.rear.y}" r="13" fill="#fff" stroke="#222" stroke-width="4"/><circle id="trlFront" cx="${markers.front.x}" cy="${markers.front.y}" r="13" fill="#203b2a" stroke="#fff" stroke-width="4"/><text x="580" y="358" font-size="13" font-family="system-ui" fill="#303e31">● front</text><text x="580" y="379" font-size="13" font-family="system-ui" fill="#303e31">○ rear</text><text x="579" y="400" font-size="11" font-family="system-ui" fill="#5b614f">conceptual</text>
 </svg>`;
}
function scout(){
 const choices=lesson.checks.map(c=>`<button type="button" class="trl-option" data-check="${esc(c.id)}" aria-pressed="${state.checks.includes(c.id)}" ${state.checkLocked?'disabled':''}><strong>${state.checks.includes(c.id)?icon('✓ '):icon('□ ')}${esc(c.text)}</strong>${state.checkLocked?`<small>${esc(c.why)} ${c.correct?'✓ Appropriate check':'✕ Not a valid check'}</small>`:''}</button>`).join('');
 return `<div class="trl-layout"><section class="trl-panel"><div class="trl-stagebar">Stage 1 of 4 · Observation</div><h2>${stageTitle.scout}</h2><p class="trl-lead">You are safely parked before the obstacle. Which checks matter before you consider a line? Select everything relevant.</p><div class="trl-scout-grid">${choices}</div>${state.checkLocked?`<div class="trl-info"><strong>Scout complete.</strong>Your assessment is recorded. Review the explanations above before choosing a schematic route.</div>`:''}<div class="trl-actionrow">${!state.checkLocked?`<button class="trl-btn" data-action="lock-checks" ${state.checks.length?'':'disabled'}>Check my scouting plan</button><span class="trl-caption">${state.checks.length} selected</span>`:`<button class="trl-btn" data-action="next">Compare lines →</button>`}</div></section><aside class="trl-panel"><h3>What the image can—and cannot—tell you</h3><div class="trl-frame"><img src="${esc(lesson.media.path)}" alt="${esc(lesson.media.alt)}"><div class="trl-figurelabel">No measured dimensions</div></div><p class="trl-micro">The photo-like illustration suggests a shelf and an eroded shoulder. It cannot verify clearance, ground support, trail legality or traction.</p><div class="trl-notice">${esc(lesson.notice)}</div></aside></div>`;
}
function line(){
 const opts=lesson.lines.map(x=>`<button type="button" class="trl-option" data-line="${esc(x.id)}" aria-pressed="${state.choice===x.id}" ${state.choiceLocked?'disabled':''}><strong>${esc(x.title)}</strong><small>${esc(x.summary)}</small></button>`).join('');
 const selected=lesson.lines.find(x=>x.id===state.choice);
 return `<div class="trl-layout"><section class="trl-panel"><div class="trl-stagebar">Stage 2 of 4 · Decision</div><h2>${stageTitle.line}</h2><p class="trl-lead">You have now completed the fictional on-foot scout. These findings—not the illustration—are the evidence for the exercise:</p><ul class="trl-facts">${lesson.scenario.scoutFindings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h3>Which line is defensible in this scenario?</h3><div class="trl-linegrid">${opts}</div>${state.choiceLocked?`<div class="trl-info ${selected.correct?'':'bad'}"><strong>${selected.correct?'Good assessment.':'Reassess this candidate.'}</strong>${esc(selected.why)}</div>`:''}<div class="trl-actionrow">${state.choiceLocked?`<button class="trl-btn" data-action="next">Follow the whole vehicle →</button>`:`<button class="trl-btn" data-action="lock-choice" ${state.choice?'':'disabled'}>Commit to this line</button>`}<button class="trl-btn ghost" data-action="back">← Scout</button></div></section><aside class="trl-panel"><h3>Conceptual line comparison</h3><div class="trl-frame">${schematic()}</div><div class="trl-key"><span><i style="background:#c17d36"></i>A: shelf</span><span><i style="background:#315f46"></i>B: inspected center</span><span><i style="background:#b75d42"></i>C: shoulder</span></div><p class="trl-svg-note">This map is invented for teaching. The colors and lines do not correspond to the photograph or to any actual trail. Do not use it to plan a real vehicle movement.</p></aside></div>`;
}
function rear(){
 const opts=lesson.rearQuestion.options.map(x=>`<button type="button" class="trl-option" data-rear="${esc(x.id)}" aria-pressed="${state.rear===x.id}" ${state.rearLocked?'disabled':''}><strong>${esc(x.label)}</strong></button>`).join('');
 const choice=lesson.rearQuestion.options.find(x=>x.id===state.rear);
 return `<div class="trl-layout"><section class="trl-panel"><div class="trl-stagebar">Stage 3 of 4 · Whole vehicle</div><h2>${stageTitle.rear}</h2><p class="trl-lead">${esc(lesson.rearQuestion.prompt)}</p><div class="trl-linegrid">${opts}</div>${state.rearLocked?`<div class="trl-info ${choice.correct?'':'bad'}"><strong>${choice.correct?'Correct principle.':'Not enough information.'}</strong>${esc(choice.why)}</div>`:''}<div class="trl-actionrow">${state.rearLocked?`<button class="trl-btn" data-action="next">View debrief →</button>`:`<button class="trl-btn" data-action="lock-rear" ${state.rear?'':'disabled'}>Check answer</button>`}<button class="trl-btn ghost" data-action="back">← Line choice</button></div></section><aside class="trl-panel"><h3>Move the conceptual axle markers</h3><div class="trl-frame">${schematic()}</div><label for="trl-progress" class="trl-micro">Progress through illustrated line: <strong id="trl-percent">${state.progress}%</strong></label><input id="trl-progress" class="trl-slider" type="range" min="0" max="100" value="${state.progress}" step="1" aria-label="Move the conceptual front and rear axle markers along the selected line"><div class="trl-notice">The white marker lags the green marker only to teach sequencing. It is not a turning-radius, tire-track, articulation, stability or breakover model.</div></aside></div>`;
}
function debrief(){
 const results=score(state,lesson);let pct=Math.round(results.total/results.max*100);
 return `<div class="trl-layout"><section class="trl-panel"><div class="trl-stagebar">Stage 4 of 4 · Debrief</div><h2>${stageTitle.debrief}</h2><div class="trl-score">${results.total}<span style="font-size:23px;color:#788273"> / ${MAX_SCORE}</span></div><p class="trl-lead">${pct===100?'Strong whole-vehicle reasoning.':'Review the evidence, not only the chosen line.'} This score checks learning decisions, not trail-driving readiness.</p><div class="trl-results"><div><strong>${results.scout}/30</strong><small>Scouting</small></div><div><strong>${results.line}/40</strong><small>Line choice</small></div><div><strong>${results.rear}/30</strong><small>Rear-axle awareness</small></div></div><h3>Before any real obstacle</h3><ul class="trl-facts">${lesson.debrief.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="trl-actionrow"><a class="trl-btn" style="text-decoration:none" href="/line-picker.html">Continue to Line Picker ↗</a><button class="trl-btn ghost" data-action="reset">Replay this lesson</button></div></section><aside class="trl-panel"><h3>What you should take away</h3><div class="trl-frame">${schematic()}</div><p>A line is a <strong>whole-vehicle commitment</strong>. Before moving, you need to know where the front, belly, axles, rear tires and exit will go, and what will make you stop.</p><div class="trl-notice">This is a fictional teaching scenario. No real trail-driving decision can be inferred from this exercise.</div><a href="/trail-reading/">← Trail Reading Lab overview</a></aside></div>`;
}
function render({focusHeading=false}={}){
 if(!lesson)return;
 const content={scout,line,rear,debrief}[state.stage]();
 app.innerHTML=`<div class="trl-main"><div class="trl-hero"><img src="${esc(lesson.media.path)}" alt="" loading="eager"><div class="trl-herotext"><div class="trl-eyebrow">Learn · Read the terrain</div><h1>${esc(lesson.title)}</h1><p>${esc(lesson.description)}</p></div></div>${progress()}${content}<footer class="trl-footer"><span class="trl-caption">Independent learning exercise · no account required · progress saved on this device</span><button class="trl-btn outline" data-action="reset">Reset lesson</button></footer></div>`;
 if(focusHeading){const h=app.querySelector('.trl-panel h2');h?.setAttribute('tabindex','-1');h?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});}
}
function updateMarkers(progress){const v=vehicleMarkers(state.choice||'b',progress);const front=app.querySelector('#trlFront'),rear=app.querySelector('#trlRear');for(const [node,p] of [[front,v.front],[rear,v.rear]]){if(node){node.setAttribute('cx',p.x);node.setAttribute('cy',p.y)}}const t=app.querySelector('#trl-percent');if(t)t.textContent=`${progress}%`;}
app.addEventListener('click',(event)=>{
 const btn=event.target.closest('button');if(!btn||!app.contains(btn)||!lesson)return;
 const dataset=btn.dataset;let focusHeading=false;
 if(dataset.check&&!state.checkLocked&&isValidChoice(lesson,dataset.check,'check')){
   state.checks=state.checks.includes(dataset.check)?state.checks.filter(x=>x!==dataset.check):[...state.checks,dataset.check];
 }else if(dataset.line&&!state.choiceLocked&&isValidChoice(lesson,dataset.line,'line')){
   state.choice=dataset.line;state.progress=0;
 }else if(dataset.rear&&!state.rearLocked&&isValidChoice(lesson,dataset.rear,'rear')){
   state.rear=dataset.rear;
 }else if(dataset.action){
   const action=dataset.action;
   if(action==='lock-checks'&&state.stage==='scout'&&state.checks.length){state.checkLocked=true}
   else if(action==='lock-choice'&&state.stage==='line'&&state.choice){state.choiceLocked=true}
   else if(action==='lock-rear'&&state.stage==='rear'&&state.rear){state.rearLocked=true}
   else if(action==='next'&&canAdvance(state)){state.stage=STAGES[STAGES.indexOf(state.stage)+1];focusHeading=true}
   else if(action==='back'){const idx=STAGES.indexOf(state.stage);if(idx>0){state.stage=STAGES[idx-1];focusHeading=true}}
   else if(action==='reset'){state=initialState();try{localStorage.removeItem(storageKey)}catch{};focusHeading=true}
 }
 save();render({focusHeading});
});
app.addEventListener('input',(event)=>{
 if(event.target?.id==='trl-progress'){state.progress=Math.round(Number(event.target.value));updateMarkers(state.progress);save();}
});
try{
 const res=await fetch(new URL('../data/lesson-02.json',import.meta.url));if(!res.ok)throw new Error(`Lesson JSON HTTP ${res.status}`);
 lesson=await res.json();state=sanitizeState(load(),lesson);render();
}catch(e){app.innerHTML=`<section class="trl-main"><h1>Lesson unavailable</h1><p>Could not load the lesson data. Please check the connection or try again.</p><p class="trl-caption">${esc(String(e.message))}</p></section>`;}
