(function(){
  function tmDrop(id){
    var all=['build','learn','garage','vehicles'];
    all.forEach(function(x){
      var p=document.getElementById('tm-dd-'+x);
      var b=document.getElementById('tm-btn-'+x);
      if(x===id){var open=p&&p.classList.contains('open');p&&p.classList.toggle('open',!open);b&&b.classList.toggle('tm-active',!open);}
      else{p&&p.classList.remove('open');b&&b.classList.remove('tm-active');}
    });
  }
  function tmExplore(){
    fetch('/db/data/manifest.json').then(function(r){return r.json();}).then(function(m){
      var active=m.vehicles.filter(function(v){return v.active;});
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
      var icons={xj:'/images/icon-xj-mj.png',tj:'/images/icon-tj.png',yj:'/images/icon-yj.png',jk:'/images/icon-jk.png',jl:'/images/icon-jl.png',cj5:'/images/icon-cj-5.png',cj7:'/images/icon-cj-5.png',zj:'/images/icon-zj.png',wj:'/images/icon-zj.png',wk:'/images/icon-wk.png',gladiator:'/images/icon-gladiator.png','4runner':'/images/icon-4runner.png',tacoma:'/images/icon-tacoma.png',pathfinder:'/images/icon-r50.png',bronco:'/images/icon-bronco-early.png','bronco-ii':'/images/icon-bronco-early.png','full-size-bronco':'/images/icon-bronco-early.png',bronco6g:'/images/icon-bronco.png',raptor:'/images/icon-raptor.png','power-wagon':'/images/icon-power-wagon.png'};
      var el=document.getElementById('tm-garage-icon');
      if(el&&icons[vid])el.innerHTML='<img src="'+icons[vid]+'" alt="'+vid+'" style="width:100%;height:100%;object-fit:contain">';
    }catch(e){}
  }
  window.tmDrop=tmDrop;
  window.tmExplore=tmExplore;
  document.addEventListener('click',function(e){
    if(!e.target.closest('#tm-topbar')){
      ['build','learn','garage'].forEach(function(x){
        var p=document.getElementById('tm-dd-'+x),b=document.getElementById('tm-btn-'+x);
        if(p)p.classList.remove('open');if(b)b.classList.remove('tm-active');
      });
    }
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tmInitGarage);
  else tmInitGarage();
})();