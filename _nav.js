/* Loaded once per page even if a page includes it twice. */
if(!window.__tmNavLoaded){window.__tmNavLoaded=true;
(function(){
  function tmDrop(id){
    var all=['build','learn','garage','vehicles','buying'];
    all.forEach(function(x){
      var p=document.getElementById('tm-dd-'+x);
      var b=document.getElementById('tm-btn-'+x);
      if(x===id){var open=p&&p.classList.contains('open');p&&p.classList.toggle('open',!open);b&&b.classList.toggle('tm-active',!open);}
      else{p&&p.classList.remove('open');b&&b.classList.remove('tm-active');}
    });
  }
  function tmExplore(){
    fetch('/db/data/manifest.json').then(function(r){return r.json();}).then(function(m){
      var active=m.vehicles.filter(function(v){return v.active && !v.hidden;});
      var v=active[Math.floor(Math.random()*active.length)];
      window.location.href='/db/#/'+v.id+'/home';
    }).catch(function(){window.location.href='/db/';});
  }
  function tmInitGarage(){
    try{
      var g=JSON.parse(localStorage.getItem('tm.garage')||'{}');
      var vids=Object.keys(g);
      if(!vids.length) return;
      var vid=vids[0];
      var icons={xj:'/images/icon-xj.png',tj:'/images/icon-tj.png',yj:'/images/icon-yj.png',jk:'/images/icon-jk.png',jl:'/images/icon-jl.png',cj5:'/images/icon-cj5.png',cj7:'/images/icon-cj5.png',zj:'/images/icon-zj.png',wj:'/images/icon-zj.png',wk:'/images/icon-wk.png',gladiator:'/images/icon-gladiator.png','4runner':'/images/icon-4runner.png',tacoma:'/images/icon-tacoma.png',pathfinder:'/images/icon-pathfinder.png',bronco:'/images/icon-bronco.png','bronco-ii':'/images/icon-bronco.png','full-size-bronco':'/images/icon-bronco.png',bronco6g:'/images/icon-bronco.png',raptor:'/images/icon-raptor.png','power-wagon':'/images/icon-power-wagon.png'};
      var el=document.getElementById('tm-garage-icon');
      if(el&&icons[vid])el.innerHTML='<img src="'+icons[vid]+'" alt="'+vid+'" style="width:100%;height:100%;object-fit:contain">';
    }catch(e){}
  }
  window.tmDrop=tmDrop;
  window.tmExplore=tmExplore;
  document.addEventListener('click',function(e){
    if(!e.target.closest('#tm-topbar')){
      ['build','learn','garage','vehicles','buying'].forEach(function(x){
        var p=document.getElementById('tm-dd-'+x),b=document.getElementById('tm-btn-'+x);
        if(p)p.classList.remove('open');if(b)b.classList.remove('tm-active');
      });
    }
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tmInitGarage);
  else tmInitGarage();
})();
/* Mobile sub-nav: hamburger clears open panels; each panel gets a back control */
(function(){
  var ids=['build','learn','garage','vehicles','buying'];
  function init(){
    document.querySelectorAll('.tm-hamburger').forEach(function(h){
      h.addEventListener('click',function(){
        ids.forEach(function(x){
          var p=document.getElementById('tm-dd-'+x),b=document.getElementById('tm-btn-'+x);
          if(p)p.classList.remove('open');if(b)b.classList.remove('tm-active');
        });
      });
    });
    ids.forEach(function(x){
      var p=document.getElementById('tm-dd-'+x);
      if(!p||p.querySelector('.tm-dd-back'))return;
      var btn=document.createElement('button');
      btn.className='tm-dd-back';btn.type='button';btn.textContent='Menu';
      btn.addEventListener('click',function(e){e.stopPropagation();tmDrop(x);});
      p.insertBefore(btn,p.firstChild);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
/* Theme toggle for the canonical header button ([data-tm-theme], id tm-theme-btn).
   Handled once, in the capture phase, so older per-page handlers bound to
   #tm-theme-btn never fire a second toggle. Light is default; the choice
   persists in localStorage 'tm-theme'. */
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-tm-theme]');
  if(!b)return;
  e.stopPropagation();
  var n=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',n);
  try{localStorage.setItem('tm-theme',n);}catch(err){}
},true);
/* Direction B shell (2026-11-08): pillar highlighting, aria-expanded state,
   Escape to close, skip-link target. Labels and routes never change with rig state. */
(function(){
  var PANELS=['build','learn','garage','vehicles','buying'];
  var TOOLS=['/gear-ratio-calculator.html','/budget-ladder.html','/line-picker.html','/v8-swap-parts-checklist.html',
    '/jk-wrangler-engine-swap-tool.html','/db/death-wobble-guide.html','/db/jk-death-wobble-guide.html','/db/tj-yj-death-wobble-guide.html',
    '/xj-death-wobble-guide.html','/db/wire-gauge-calculator.html','/db/fuel-range-planner.html','/db/tire-pressure-airdown.html',
    '/db/trail-tool-kit-builder.html','/db/build-cost-tracker.html','/db/wheel-offset-visualizer.html','/db/parts-compatibility-tool.html',
    '/db/lift-tire-fitment.html'];
  var BUYING=['/model-year-matrix.html','/vehicle-research-tool.html','/db/otd-pricing-calculator.html'];
  function pillarFor(p){
    if(p==='/my-garage.html')return 'garage';
    if(p.indexOf('/tools/')===0||p.indexOf('/build/')===0||p.indexOf('/trail-tools/')===0||TOOLS.indexOf(p)>=0)return 'interactive';
    if(p.indexOf('/buying/')===0||p.indexOf('/jl/buying-decision/')===0||/-lift-kit-comparison\.html$/.test(p)||BUYING.indexOf(p)>=0)return 'buying';
    if(p.indexOf('/trails/')===0)return 'trails';
    if(p.indexOf('/learn/')===0||p.indexOf('/workshop/')===0||p.indexOf('/trail-reading/')===0||p.indexOf('/blog/')===0)return 'learn';
    if(p==='/'||p==='/index.html'||p.indexOf('/about')===0||p.indexOf('/privacy')===0||p.indexOf('/terms')===0||p.indexOf('/search/')===0)return null;
    return 'guides';
  }
  function setExpanded(){
    PANELS.forEach(function(x){
      var p=document.getElementById('tm-dd-'+x),b=document.getElementById('tm-btn-'+x);
      if(b)b.setAttribute('aria-expanded',p&&p.classList.contains('open')?'true':'false');
    });
    var m=document.getElementById('tm-nav-menu');
    document.querySelectorAll('.tm-hamburger').forEach(function(h){h.setAttribute('aria-expanded',m&&m.classList.contains('open')?'true':'false');});
  }
  function closeAll(){
    var opened=null;
    PANELS.forEach(function(x){
      var p=document.getElementById('tm-dd-'+x),b=document.getElementById('tm-btn-'+x);
      if(p&&p.classList.contains('open'))opened=b;
      if(p)p.classList.remove('open');if(b)b.classList.remove('tm-active');
    });
    var m=document.getElementById('tm-nav-menu'),hb=document.querySelector('.tm-hamburger');
    if(m&&m.classList.contains('open')){m.classList.remove('open');opened=hb;}
    setExpanded();
    if(opened&&hb&&hb.offsetParent!==null)return hb;
    return opened;
  }
  function init(){
    var path=location.pathname.replace(/index\.html$/,'');
    var pil=pillarFor(path);
    if(pil){
      document.querySelectorAll('#tm-topbar [data-tm-pillar="'+pil+'"]').forEach(function(el){el.classList.add('tm-current');});
      document.querySelectorAll('.tm-bottom-nav [data-tm-pillar="'+pil+'"]').forEach(function(a){
        a.classList.add('tm-current');
        a.setAttribute('aria-current',a.getAttribute('href')===path?'page':'true');
      });
    }
    if(!document.getElementById('tm-content')){
      var t=document.querySelector('main')||document.querySelector('h1');
      if(t){t.id=t.id||'tm-content';if(t.id!=='tm-content'){var s=document.querySelector('.tm-skip');if(s)s.setAttribute('href','#'+t.id);}if(!t.hasAttribute('tabindex'))t.setAttribute('tabindex','-1');}
    }
    document.addEventListener('click',function(){setTimeout(setExpanded,0);});
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape')return;
      var back=closeAll();
      if(back&&back.focus)back.focus();
    });
    setExpanded();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
}
