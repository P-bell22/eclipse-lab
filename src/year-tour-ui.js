// This controller shares the lab's renderer, but owns its presentation clock.
const yearTour=(()=>{
  const core=window.EclipseYearCore;
  const pauseKeys=['playing','playingDay','playingEclipse','playHours','playDays','playScrub'];
  const shortDate=ms=>new Date(ms).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
  const availableYears=core.years(BESSEL), cache=new Map();
  let selectedYear=availableYears.includes(2027)?2027:availableYears[0];
  let tour=null, previous=null, elapsed=0, playing=false, speed=1, current=null, accumulator=0, storyKey='',detail=false, endWait=0;
  const stopClocks=()=>pauseKeys.forEach(key=>state[key]=false);
  function prepareYear(year){
    if(!cache.has(year)) cache.set(year,core.build(window.Astronomy,BESSEL,Bz,year));
    return cache.get(year);
  }
  function installYear(next){
    tour=next; selectedYear=next.year; elapsed=0; current=null; accumulator=0; endWait=0; detail=false; storyKey=''; lastCameraStop=null;
    $('#yearChoice').value=String(selectedYear);
    $('#yearScrub').max=tour.duration;
    $('#yearStart').textContent=`Jan ${selectedYear}`; $('#yearEnd').textContent=`Dec ${selectedYear}`;
    $('#yearIntro').textContent=`Follow ${selectedYear}, new moon by new moon. See which shadows miss Earth and which reach it.`;
    $('#yearMonths').textContent=`${tour.events.length} new moons · 12 calendar months`;
    $('#yearTimeline').replaceChildren();
    $('#yearTimeline').setAttribute('aria-label',`New moons in ${selectedYear}`);
    tour.events.forEach((event,i)=>{
      const button=document.createElement('button'); button.dataset.event=i; button.dataset.kind=event.kind;
      button.append(document.createTextNode(shortDate(event.phaseMs)),document.createElement('span'));
      button.setAttribute('aria-label',`Show the new moon on ${shortDate(event.phaseMs)} ${selectedYear}`);
      $('#yearTimeline').append(button);
    });
  }
  function changeYear(year,resume=false){
    if(!state.yearMode||!availableYears.includes(year)) return;
    try{
      const next=prepareYear(year);
      pause(); installYear(next); $('#yearError').hidden=true;
      applyTime(true); camera(1,true);
      if(resume) toggle();
    }catch(error){
      pause();
      $('#yearChoice').value=String(selectedYear);
      $('#yearError').textContent='This year could not load. Please reload the page and try again.';
      $('#yearError').hidden=false;
    }
  }
  function layoutOverview(){
    const overview=$('#yearOverview');
    // A backdrop-filtered ancestor would trap position:fixed inside the panel.
    if(overview.parentElement!==document.body) document.body.append(overview);
    overview.hidden=!state.yearMode||state.view!=='lab';
    const sunView=$('#yearSunView');
    // On phones the Sun view stays beside the globe, above the scrolling controls.
    if(window.innerWidth<=900){ if(sunView.parentElement!==document.body) document.body.append(sunView); }
    else if(sunView.parentElement!==$('#yearBlock')) $('#yearDetail').after(sunView);
    if(overview.hidden) sunView.hidden=true;
  }
  function show(){
    document.body.classList.add('year-active');
    $('#yearBlock').hidden=false;
    ['#realBlock','#sandboxBlock','#sandboxBlock2','#sky'].forEach(id=>$(id).hidden=true);
    $('#yearMarkers').hidden=false;
    layoutOverview();
    $$('#labMode button').forEach(b=>b.classList.toggle('on',b.dataset.labmode==='year'));
    applyTime(true);
    camera(1,true);
  }
  function enter(){
    if(state.yearMode) return;
    try{
      if(!tour) installYear(prepareYear(selectedYear));
    }catch(error){
      $('#yearError').textContent='The guided year could not load its astronomy data. Please reload the page.';
      $('#yearError').hidden=false; return;
    }
    $('#yearError').hidden=true;
    previous={state:Object.fromEntries(Object.entries(state).filter(([key])=>key!=='view'&&key!=='scale'&&!key.startsWith('sys'))),camera:controls.save()};
    stopClocks();
    Object.assign(state,{yearMode:true,real:true,ground:false,home:false,path:false,camMode:'whole',follow:null,
      labScale:'true',labK:1,labKTarget:1,labKFrom:1,offset:0,shadows:true,orbit:true,labels:true,selEclipse:null,local:null});
    controls.look=null; controls.follow=null; controls.tw=null; controls.enabled=true;
    lab.cam.near=0.05; lab.cam.updateProjectionMatrix();
    buildPathLines(null);
    playing=false; storyKey='';
    show();
  }
  function leave(){
    pause();
    if(!previous) return;
    Object.assign(state,previous.state); stopClocks();
    document.body.classList.remove('year-active');
    $('#yearBlock').hidden=$('#yearMarkers').hidden=true;
    layoutOverview();
    $('#sky').hidden=state.view==='system';
    $('#realBlock').hidden=!state.real; $('#sandboxBlock').hidden=$('#sandboxBlock2').hidden=state.real;
    $$('#labMode button').forEach(b=>b.classList.toggle('on',b.dataset.labmode===(state.real?'real':'sandbox')));
    $$('#labScale button').forEach(b=>b.classList.toggle('on',b.dataset.labscale===state.labScale));
    for(const [id,key] of [['#sDist','dist'],['#sLam','lambda'],['#sOmega','omega'],['#sOff','offset'],['#sHour','hour']]) $(id).value=state[key];
    $('#dtInput').value=dtInputValue(state.dateMs);
    buildPathLines(state.selEclipse);
    controls.load(previous.camera); controls.enabled=true; controls.look=null;
    dirty=true; applyGeometry();
    if(state.ground) setCamera(state.camMode);
    else { lab.cam.near=0.05; lab.cam.updateProjectionMatrix(); }
    previous=null; computeViewRect();
  }
  function applyTime(force=false){
    current=core.sample(tour,elapsed,REDUCED);
    const observer=current.hold?tour.events[current.eventIndex].observer:null, changed=state.yearSite!==observer;
    state.yearSite=observer;
    if(force||changed||state.dateMs!==current.ms){ setDate(current.ms); applyGeometry(); }
    render();
  }
  function eclipsePoint(){return current&&current.hold&&tour.events[current.eventIndex].kind!=='none'&&G&&G.sunUp&&G.cov>0?G.P:null;}
  function nextYear(){return availableYears[availableYears.indexOf(selectedYear)+1];}
  function automaticCloseup(){return !REDUCED&&playing&&current&&current.hold&&tour.events[current.eventIndex].kind!=='none'&&current.progress>.32;}
  function pause(){ if(automaticCloseup()) detail=true; playing=false; controls.enabled=true; if(state.yearMode) render(); }
  function toggle(){
    if(!state.yearMode) return;
    if(playing){ pause(); return; }
    if(elapsed>=tour.duration) elapsed=0;
    playing=true; controls.enabled=false; detail=false;
    stopClocks(); accumulator=0; endWait=0; applyTime();
  }
  function seek(seconds){
    pause(); detail=false; endWait=0; elapsed=clamp(seconds,0,tour.duration); storyKey=''; applyTime(true); camera(1,true);
  }
  function tick(dt){
    if(!playing) return;
    if(elapsed>=tour.duration){
      if($('#yearContinue').checked&&nextYear()){
        endWait+=dt*speed;
        if(endWait>=4) changeYear(nextYear(),true);
      }else pause();
      return;
    }
    elapsed=core.advance(tour,elapsed,dt*speed);
    const next=core.sample(tour,elapsed,REDUCED);
    accumulator+=dt;
    if(accumulator>=1/30||next.hold!==current.hold||next.eventIndex!==current.eventIndex||next.complete){
      accumulator=0; applyTime();
    }
    if(elapsed>=tour.duration&&!($('#yearContinue').checked&&nextYear())) pause();
  }
  function render(){
    if(!state.yearMode||!tour||!current) return;
    $('#headLab').textContent=`Watch a year · ${tour.year}`;
    $('#yearEarlier').disabled=selectedYear===availableYears[0];
    $('#yearLater').disabled=!nextYear();
    $('#yearContinueRow').hidden=!nextYear();
    $('#yearPlay').textContent=playing?'⏸ Pause':current.complete?'↻ Replay year':elapsed===0?'▶ Play year':'▶ Resume';
    $('#yearPlay').classList.toggle('on',playing);
    $('#yearPrev').disabled=elapsed<=0; $('#yearNext').disabled=current.complete;
    $('#yearScrub').value=elapsed;
    $('#yearScrub').setAttribute('aria-valuetext',`${shortDate(current.ms)} ${tour.year}${current.hold?', new-moon teaching stop':''}`);
    $('#yearProgress').textContent=`${Math.round(elapsed/tour.duration*100)}%`;
    $('#yearDuration').textContent=`${Math.floor(tour.duration/speed/60)}m ${Math.round(tour.duration/speed%60)}s tour`;
    $('#yearDate').textContent=new Date(current.ms).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
    $('#yearPhase').textContent=`${phaseName(state.eph.elong).split(' — ')[0]} · ${fmtKm(state.eph.moonKm)} away · UTC`;
    const event=current.hold?tour.events[current.eventIndex]:null;
    const close=detail||automaticCloseup();
    const eclipseClose=close&&eclipsePoint();
    document.body.classList.toggle('year-eclipse-close',!!eclipseClose);
    $('#yearDetail').hidden=!event;
    $('#yearDetail').textContent=close?'← Show the whole alignment':'Inspect the shadow →';
    $('#yearSunView').hidden=!eclipseClose;
    if(eclipseClose){
      const annular=G.skyKind==='annular', total=G.skyKind==='total', ratio=G.aM/G.aS;
      $('#yearSunMoon').setAttribute('r',35*ratio);
      $('#yearSunMoon').setAttribute('cx',56+35*G.skyX/G.aS);
      $('#yearSunMoon').setAttribute('cy',56-35*G.skyY/G.aS);
      $('#yearSunCorona').style.display=total?'':'none';
      $('#yearSunTitle').textContent=annular?`Ring of fire · ${Math.round(G.cov*100)}% covered`:total?'The whole Sun is hidden':`Partial eclipse · ${Math.round(G.cov*100)}% covered`;
      $('#yearSunText').textContent=event.kind==='hybrid'?`This spot sees ${total?'totality':'a ring of fire'}. The eclipse changes between annular and total along different sections of its path.`:annular?'The ring is seen in the sky. On Earth, it makes a dim patch around the marker.':total?'The marker locates the dark inner shadow. From there, the Moon covers the Sun and its corona appears.':'This is one sunlit place where the Moon covers part of the Sun. The dark inner shadow misses Earth.';
      $('#yearSunDiagram').setAttribute('aria-label',annular?'A ring of sunlight around the smaller Moon, as seen from the marked spot':total?'The Moon fully covers the Sun, with its corona visible around it':'The Moon covers only part of the Sun, as seen from the marked spot');
    }
    const key=current.complete?'complete':elapsed===0?'intro':event?`event-${current.eventIndex}`:`travel-${current.eventIndex}`;
    if(key!==storyKey){
      storyKey=key;
      let title,copy,color='var(--sky)';
      if(current.complete){
        const summary=core.summary(tour); title=summary.title; copy=summary.copy; color='var(--gold)';
      }else if(elapsed===0){
        title='A new moon is only the first ingredient';
        copy='Every lunar month, the Moon comes between us and the Sun. Watch its tilted orbit: most months its shadow passes above or below Earth. Press Play year, or step through the new moons.';
      }else if(event){
        if(event.kind==='total'){
          title='The sweet spot: a total eclipse'; color='var(--gold)';
          copy=`New moon, close to a crossing point, and a Moon large enough in our sky. Its dark inner shadow reaches Earth on ${shortDate(event.ms)}. People in that narrow path see the whole Sun covered.`;
        }else if(event.kind==='annular'){
          title='Lined up — but a ring of fire'; color='var(--ember)';
          copy=`The alignment is right on ${shortDate(event.ms)}, but the Moon looks too small to hide the whole Sun. Its dark shadow ends before the ground; the ring-of-fire zone reaches Earth.`;
        }else if(event.kind==='partial'){
          title='A near miss: a partial eclipse'; color='var(--sky)';
          copy=`On ${shortDate(event.ms)}, the pale outer shadow brushes Earth, but the dark inner shadow misses. Some places see a bite out of the Sun. Nowhere sees totality or a complete ring of fire.`;
        }else if(event.kind==='hybrid'){
          title='On the boundary: a hybrid eclipse'; color='var(--gold)';
          copy=`On ${shortDate(event.ms)}, Earth’s curved surface makes the difference: the eclipse is annular along some sections of the path and total along others. The close-up shows one place on that path.`;
        }else{
          title=`The shadow misses ${event.beta>0?'above':'below'} Earth`; color='var(--moon)';
          copy=`New moon ${current.eventIndex+1} of ${tour.events.length}. The Moon is ${Math.abs(event.beta).toFixed(1)}° ${event.beta>0?'above':'below'} Earth’s orbital plane. It is between Earth and the Sun, but too far from a crossing point: no solar eclipse anywhere on Earth.`;
        }
      }else{
        title='Another orbit, a different alignment';
        copy='The Moon keeps circling Earth, and Earth keeps travelling around the Sun. The orbit stays tilted; the Sun’s direction relative to its crossing points changes. We slow down at the next new moon.';
        if(current.eventIndex===null) copy='The last new moon has passed. As the year ends, notice how many monthly alignments missed Earth completely.';
      }
      $('#yearTitle').textContent=title; $('#yearText').textContent=copy;
      $('#yearStory').style.borderColor=color;
    }
    const tally=core.counts(tour,current.ms);
    const categories=core.kinds.filter(kind=>tour.events.some(event=>event.kind===kind));
    $('#yearCounter').textContent=[`${tally.totalMoons}/${tour.events.length} new moons`,`${tally.none} ${tally.none===1?'miss':'misses'}`,...categories.map(kind=>`${tally[kind]} ${kind}`)].join(' · ');
    $$('#yearTimeline button').forEach((button,i)=>{
      const event=tour.events[i], seen=event.ms<=current.ms;
      button.classList.toggle('seen',seen);
      button.setAttribute('aria-current',String(current.hold&&current.eventIndex===i));
      button.querySelector('span').textContent=seen?event.kind==='none'?'Miss':event.kind[0].toUpperCase()+event.kind.slice(1):'New moon';
    });
    const theta=(state.eph.sunLon+180)*DEG, x=90+66*Math.cos(theta), y=74-49*Math.sin(theta);
    $('#yearEarth').setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    $('#yearSunLine').setAttribute('x2',x); $('#yearSunLine').setAttribute('y2',y);
    const node=state.eph.orbit.node, nodeAngle=Math.atan2(-node[2],node[0])+state.eph.sunLon*DEG;
    $('#yearMiniOrbit').setAttribute('transform',`rotate(${-nodeAngle/DEG})`);
    $('#yearOverviewDate').textContent=new Date(current.ms).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
    $('#hint').textContent=playing?'The dates speed up between new moons · Space to pause':'Drag to explore · Scroll to zoom · Space to play · Outlines help locate the true-scale Earth and Moon';
  }
  function camera(dt,snap=false){
    if(!G||!current) return;
    if(REDUCED&&!snap&&(!current.hold||lastCameraStop===current.eventIndex)) return;
    lastCameraStop=current.hold?current.eventIndex:null;
    // Ease from a full orbital-plane view into a side view of each alignment.
    const focus=current.hold?1:REDUCED?0:smooth(.68,1,current.progress);
    const d=G.d, target=G.moonPos.clone().multiplyScalar(.5*focus);
    let fit=frame3(V(.025,lerp(.7,.24,focus),-1),lerp(d+3,d*.54+2,focus),lerp(d*.6+2,d*.12+2,focus),45);
    const close=detail||automaticCloseup();
    if(close){
      const point=eclipsePoint();
      target.copy(point?ORIGIN:G.q.clone().multiplyScalar(.5));
      const span=point?1.3:Math.max(1.8,G.rho*.6+1.4);
      fit=frame3(point?point.clone().normalize():V(.8,.18,-1),span,span,45);
    }
    [lab.orbitGroup,lab.eclRing,lab.plane,lab.heightLine,lab.footMark,lab.moonShadow].forEach(object=>object.visible=!close);
    [lab.lblNodeA,lab.lblNodeB,lab.lblPlane,lab.lblSun].forEach(label=>label.on=!close);
    target.add(fit.shift);
    const alpha=snap||REDUCED?1:1-Math.exp(-dt*4);
    controls.tw=null; controls.follow=null; controls.look=null;
    controls.target.lerp(target,alpha); controls.radius=lerp(controls.radius,fit.r,alpha);
    controls.theta+=Math.atan2(Math.sin(fit.a.theta-controls.theta),Math.cos(fit.a.theta-controls.theta))*alpha;
    controls.phi=lerp(controls.phi,fit.a.phi,alpha); controls.fov=45;
  }
  let lastCameraStop=null;
  function markers(){
    if(!state.yearMode||state.view!=='lab') return;
    [ORIGIN,G.moonPos].forEach((position,i)=>{
      const p=position.clone().project(lab.cam), element=$$('#yearMarkers i')[i];
      const x=(p.x+1)*window.innerWidth/2,y=(1-p.y)*window.innerHeight/2;
      const radius=(i===0?RE:RM)/lab.cam.position.distanceTo(position)/Math.tan(lab.cam.fov*DEG/2)*window.innerHeight/2;
      element.hidden=radius>10||p.z<-1||p.z>1||x<viewRect.x0||x>viewRect.x1||y<viewRect.y0||y>viewRect.y1;
      element.style.left=x+'px'; element.style.top=y+'px';
    });
    const marker=$('#yearEclipseMarker');
    marker.hidden=true;
    const point=eclipsePoint();
    if(!(detail||automaticCloseup())||!point) return;
    marker.querySelector('span').textContent=tour.events[current.eventIndex].observer?'Eclipse visible here':'Eclipse centre';
    const towardCamera=lab.cam.position.clone().sub(point);
    if(point.dot(towardCamera)<=0) return;
    const p=point.clone().project(lab.cam), x=(p.x+1)*window.innerWidth/2,y=(1-p.y)*window.innerHeight/2;
    const earthRadius=RE/lab.cam.position.length()/Math.tan(lab.cam.fov*DEG/2)*window.innerHeight/2;
    marker.hidden=earthRadius<40||p.z<-1||p.z>1||x<viewRect.x0+55||x>viewRect.x1-55||y<viewRect.y0+15||y>viewRect.y1-55;
    marker.style.left=x+'px'; marker.style.top=y+'px';
  }
  availableYears.forEach(year=>{const option=document.createElement('option');option.value=year;option.textContent=year;$('#yearChoice').append(option);});
  $('#yearChoice').value=String(selectedYear);
  $('#yearChoice').addEventListener('change',e=>changeYear(+e.target.value));
  $('#yearEarlier').addEventListener('click',()=>changeYear(availableYears[availableYears.indexOf(selectedYear)-1]));
  $('#yearLater').addEventListener('click',()=>changeYear(nextYear()));
  $('#yearContinue').addEventListener('change',()=>{if(current&&current.complete&&!$('#yearContinue').checked) pause();});
  $('#yearPlay').addEventListener('click',toggle);
  $('#yearDetail').addEventListener('click',()=>{pause();detail=!detail;camera(1,true);render();});
  $('#yearRestart').addEventListener('click',()=>seek(0));
  $('#yearPrev').addEventListener('click',()=>seek(core.step(tour,elapsed,-1)));
  $('#yearNext').addEventListener('click',()=>seek(core.step(tour,elapsed,1)));
  $('#yearScrub').addEventListener('input',e=>seek(+e.target.value));
  $('#yearSpeed').addEventListener('change',e=>{speed=+e.target.value;render();});
  $('#yearTimeline').addEventListener('click',e=>{const b=e.target.closest('button');if(b) seek(tour.events[+b.dataset.event].stop);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.yearMode) pause();});
  return {enter,leave,show,pause,toggle,tick,render,camera,markers,seek,layoutOverview,get playing(){return playing;},get tour(){return tour;},get current(){return current;}};
})();
