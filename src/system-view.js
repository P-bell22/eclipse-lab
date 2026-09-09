// Solar-system presentation, comparison camera, and travel between physical scales.
const systemView=(()=>{
  const S=window.SystemScale, LY=S.MKM_PER_LY, MAX=500000*LY;
  const galaxy=window.createGalaxyView(THREE,S);
  const comparison={scene:new THREE.Scene(),cam:new THREE.OrthographicCamera(),items:[],layout:null,saved:null};
  let journey=null, phase=null, wasFar=false;
  const hud=document.createElement('div'); hud.id='systemScaleHud';
  hud.title='Scale on the plane through the camera target. Objects at other depths can appear larger or smaller.';
  hud.innerHTML='<span id="systemScaleText"></span><i id="systemScaleBar"></i><small id="systemScaleUnits"></small>';
  document.body.appendChild(hud);
  const locator=document.createElement('button'); locator.id='solarLocator'; locator.className='chip gold';
  locator.innerHTML='<span>⊙ Solar system</span><small>Location marker · not to scale</small>'; locator.hidden=true;
  locator.addEventListener('click',returnHome); document.body.appendChild(locator);
  const locationDot=document.createElement('i');locationDot.id='solarLocationDot';locationDot.hidden=true;document.body.appendChild(locationDot);
  const lineLabels=document.createElement('div'); lineLabels.id='comparisonLabels'; lineLabels.hidden=true; document.body.appendChild(lineLabels);
  const bodies=[{name:'Sun',radiusKm:S.SUN_RADIUS_KM},...BODIES.map(d=>({name:d.n,radiusKm:d.R,ringOuterRatio:d.rings?2.27:1}))];
  function snapshot(){return {camera:controls.save(),scale:state.scale,sizes:state.sysSizes,focus:sys.focus,layout:state.sysLayout};}
  function farFromSystem(){return state.scale==='true'&&Math.max(controls.radius,controls.target.length())>30000;}
  function buttons(key,value){ $$('[data-'+key+']').forEach(b=>{const on=b.dataset[key]===value;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));}); }
  function refresh(){
    const line=state.sysLayout==='lineup', far=farFromSystem();
    $('#systemPresentation').hidden=state.scale!=='condensed'; $('#lineupControls').hidden=!line; $('#systemOrbitControls').hidden=line;
    $$('[data-sizes]').forEach(b=>b.disabled=line);
    buttons('sizes',line?'proportional':state.sysSizes);buttons('layout',state.sysLayout);buttons('order',state.sysOrder);buttons('scale',state.scale);
    $('#returnSystem').hidden=!journey&&!far; $('#galaxyNote').hidden=!far;
    $('#sysPlay').textContent=state.sysPlaying?'⏸ Pause':'▶ Play';
    $('#scaleNote').textContent=line?'Correct relative diameters, side by side. Gaps are for comparison, not orbital distances.':state.scale==='true'?'One physical scale for sizes and distances. Scroll out beyond the planets to find our place in the Milky Way.':state.sysSizes==='proportional'?'Correct size ratios, including the Sun and moons. Orbital distances stay squashed; small planets really are this small.':'Distances squashed and body sizes enlarged individually so everything is easy to see. Choose Proportional for correct size ratios.';
    $('#scaleFact').innerHTML=line?'<b>Our Sun is enormous.</b> Its diameter is about 109 Earths, or nearly 10 Jupiters. Every body here uses the same magnification; the gaps are just for readability.':state.scale==='true'?'<b>True scale.</b> Sizes and distances use one physical scale. Mean radii represent the spherical bodies. Names and glows help you find them; they do not represent physical size.':'<b>Squashed up.</b> Orbital distances are compressed. Choose Proportional to compare the Sun, planets and moons at one shared size scale.';
    $('#hint').textContent=line?'Drag to pan · Scroll or pinch to zoom · Fit all to see the whole line-up':'Drag to orbit · Scroll or pinch to zoom · Right-drag or two fingers to pan · Scroll out to the Milky Way';
  }
  function setSizes(sizes){
    if(state.sysLayout==='lineup')return;
    const old=sys.focus&&sys.focus!=='sun'?sys.focus.r:sys.sunR;
    state.sysSizes=sizes; layoutSystem(sys.t);
    if(sys.focus){const next=sys.focus==='sun'?sys.sunR:sys.focus.r;controls.radius*=next/old;controls.tw=null;}
    refresh();
  }
  function makeComparison(){
    if(comparison.items.length)return;
    for(const d of bodies){
      const b=sys.bodies.find(b=>b.def.n===d.name), group=new THREE.Group();
      const mat=d.name==='Sun'?SUN_MAT():new THREE.MeshBasicMaterial({map:b.mat.uniforms.map.value});
      const mesh=new THREE.Mesh(unitSphere,mat); group.add(mesh);
      // Lighting is uniform here: this is a diameter comparison, not an eclipse scene.
      if(b){mesh.quaternion.copy(b.poleQ);mesh.rotation.y+=.5;}
      if(b&&b.rings){const ring=b.rings.clone();ring.material=b.rings.material.clone();ring.quaternion.copy(b.poleQ).multiply(b.rings.quaternion);group.add(ring);group.userData.ring=ring;}
      comparison.scene.add(group);
      const label=document.createElement('button');label.className='comparisonLabel';label.textContent=d.name;label.addEventListener('click',()=>focusComparison(d.name));lineLabels.appendChild(label);
      comparison.items.push({def:d,group,mesh,label});
    }
  }
  function arrange(){
    makeComparison(); comparison.layout=S.lineup(bodies,state.sysOrder,SUN_R.cond);
    for(const p of comparison.layout.items){ const it=comparison.items.find(it=>it.def.name===p.name);it.x=p.x;it.radius=p.radius;it.extent=p.extent;it.group.position.set(p.x,0,0);it.mesh.scale.setScalar(p.radius);if(it.group.userData.ring)it.group.userData.ring.scale.setScalar(p.radius); }
    $('#lineupList').replaceChildren();
    for(const p of comparison.layout.items){ const d=bodies.find(d=>d.name===p.name),b=document.createElement('button');b.className='lineupEntry';b.innerHTML=`<span>${d.name}${d.name==='Pluto'?' <small>(dwarf)</small>':''}</span><small>${(d.radiusKm*2).toLocaleString('en-GB')} km</small>`;b.addEventListener('click',()=>focusComparison(d.name));$('#lineupList').appendChild(b); }
    fitComparison();
  }
  function fitComparison(){
    if(!comparison.layout)return;computeViewRect();
    const f=frame3(V(0,0,1),comparison.layout.width/2+1,SUN_R.cond+2,45);
    controls.minR=.06;controls.maxR=300;controls.follow=null;
    controls.flyTo({target:f.shift,radius:f.r,theta:Math.PI/2,phi:Math.PI/2,fov:45},0);
  }
  function setLayout(layout){
    if(layout===state.sysLayout)return;
    cancelTravel();
    if(layout==='lineup'){
      comparison.saved={...snapshot(),playing:state.sysPlaying}; state.sysLayout='lineup';state.sysPlaying=false;sys.focus=null;controls.lockOrbit=true;controls.tw=null;
      sys.t=sys.tTarget=0;layoutSystem(0);arrange();
    }else{
      state.sysLayout='orbits';controls.lockOrbit=false;lineLabels.hidden=true;
      if(comparison.saved){ const old=comparison.saved;state.sysSizes=old.sizes;state.sysPlaying=old.playing;sys.focus=old.focus;controls.load(old.camera);comparison.saved=null;layoutSystem(sys.t); }
    }
    refresh();
  }
  function focusComparison(name){
    const it=comparison.items.find(it=>it.def.name===name);if(!it)return;
    computeViewRect();const f=frame3(V(0,0,1),it.extent*1.35,it.radius*1.5,45);
    controls.flyTo({target:V(it.x,0,0).add(f.shift),radius:f.r,theta:Math.PI/2,phi:Math.PI/2},700);
  }
  function cancelTravel(){phase=null;journey=null;pendingRestore=null;controls.tw=null;controls.follow=null;}
  function beforeScale(mode){
    cancelTravel();
    if(state.sysLayout==='lineup')setLayout('orbits');
    if(mode==='condensed'&&controls.radius>30000){journey=null;sys.focus='sun';controls.target.set(0,0,0);controls.radius=30000;}
  }
  function startOut(shortcut){
    const oldLine=state.sysLayout==='lineup';if(oldLine)setLayout('orbits');
    if(!journey){journey=snapshot();journey.layout=oldLine?'lineup':journey.layout;}
    sys.focus=null;controls.follow=null;controls.maxR=MAX;
    if(state.scale==='condensed'){
      setScale('true',{travel:true,noFocus:true});
      controls.flyTo({target:ORIGIN,radius:Math.max(30000,controls.radius*100),fov:45},2600);
      phase=shortcut?'prepare-galaxy':'expand';
    }else if(shortcut)flyGalaxy();
    refresh();
  }
  function flyGalaxy(completion='galaxy'){
    computeViewRect();const direction=galaxy.normal.clone().addScaledVector(V(1,0,0),.22).normalize();
    const f=frame3(direction,55000*LY,55000*LY,45), to=galaxy.centre.clone().add(f.shift);
    const from=controls.target.clone(), fromR=controls.radius;
    const startDirection=V(Math.sin(controls.phi)*Math.cos(controls.theta),Math.cos(controls.phi),Math.sin(controls.phi)*Math.sin(controls.theta));
    const startPosition=from.clone().addScaledVector(startDirection,fromR);
    const nearHome=startPosition.length()<1000*LY;
    sys.focus=null;controls.maxR=MAX;
    controls.flyTo({radius:f.r,theta:f.a.theta,phi:f.a.phi,fov:45},6000);
    // Target travel follows logarithmic zoom too, so the camera never races away while still close to the Sun.
    if(controls.tw)controls.tw.dynamicTarget=(r,e)=>nearHome?from.clone().multiplyScalar(1-e).addScaledVector(to,clamp((r-fromR)/Math.max(f.r-fromR,1),0,1)):from.clone().lerp(to,e);
    else controls.target.copy(to);
    phase=completion;refresh();
  }
  function returnHome(){
    if(!journey)journey={camera:{target:V(0,0,0),radius:140,theta:.9,phi:1.05,fov:45,follow:null,minR:2,maxR:MAX},scale:'condensed',sizes:state.sysSizes,focus:'sun',layout:'orbits'};
    if(controls.target.length()>1000*LY&&controls.radius<1000*LY){flyGalaxy('home-overview');return;}
    const from=controls.target.clone(),fromR=controls.radius;
    const target=journey.scale==='true'?journey.camera.target.clone():V(0,0,0);
    const radius=journey.scale==='true'?journey.camera.radius:30000;
    sys.focus=null;controls.follow=null;controls.maxR=MAX;
    controls.flyTo({radius,theta:journey.camera.theta,phi:journey.camera.phi,fov:journey.camera.fov},4800);
    if(controls.tw)controls.tw.dynamicTarget=r=>target.clone().addScaledVector(from.clone().sub(target),clamp((r-radius)/Math.max(fromR-radius,1),0,1));
    else controls.target.copy(target);
    phase='home';refresh();
  }
  function restoreHome(){
    const old=journey;if(!old)return;
    journey=null;phase=null;state.sysSizes=old.sizes;sys.focus=null;
    setScale(old.scale,{travel:true,noFocus:true});
    controls.maxR=MAX;controls.flyTo({...old.camera,target:old.camera.target},old.scale==='condensed'?2600:0);
    phase='restore';pendingRestore=old;refresh();
  }
  let pendingRestore=null;
  function tick(){
    controls.lockOrbit=state.sysLayout==='lineup';
    if(state.sysLayout==='lineup')return;
    if(state.scale==='condensed'&&controls.radius>400&&sys.t===sys.tTarget&&!phase){startOut(false);return;}
    if(phase&&(REDUCED||!controls.tw)&&sys.t===sys.tTarget){
      const done=phase;phase=null;
      if(done==='prepare-galaxy')flyGalaxy();
      else if(done==='home-overview')returnHome();
      else if(done==='home')restoreHome();
      else if(done==='restore'&&pendingRestore){const old=pendingRestore;pendingRestore=null;sys.focus=old.focus;controls.load(old.camera);if(old.layout==='lineup')setLayout('lineup');refresh();}
      else if(done==='galaxy')refresh();
    }
    const far=farFromSystem();
    if(far!==wasFar){wasFar=far;refresh();}
    if(journey&&far)journey.leftLocal=true;
    if(journey&&journey.leftLocal&&!phase&&!controls.tw&&controls.radius<15000&&controls.target.length()<15000)restoreHome();
  }
  function cameraLimits(){
    if(state.sysLayout==='lineup'){controls.minR=.06;controls.maxR=300;}
    else controls.maxR=MAX;
  }
  function hideOverlays(){hud.hidden=true;locator.hidden=true;locationDot.hidden=true;lineLabels.hidden=true;}
  function resize(){ if(state.view==='system'&&state.sysLayout==='lineup')fitComparison(); }
  function scaleHud(){
    hud.hidden=false;const R=viewRect;
    hud.style.left=(R.x0+16)+'px';hud.style.top=Math.max(R.y0+8,R.y1-68)+'px';
    const line=state.sysLayout==='lineup';
    let info=null;
    if(line)info=S.scaleBar(controls.radius*(SUN_R.real/SUN_R.cond),controls.fov*DEG,window.innerHeight,100);
    else if(state.scale==='true'&&sys.t===1)info=S.scaleBar(controls.radius,controls.fov*DEG,window.innerHeight,100);
    $('#systemScaleText').textContent=line?'Relative diameters':state.scale==='condensed'?'Compressed distances':sys.t!==1?'Moving into true scale…':controls.radius>LY?'Milky Way · true distances':'True sizes & distances';
    $('#systemScaleBar').hidden=!info;$('#systemScaleUnits').textContent=info?info.label:state.sysSizes==='proportional'?'One shared size scale':'Bodies enlarged individually';
    if(info)$('#systemScaleBar').style.width=info.pixels+'px';
  }
  function renderComparison(w,h){
    sysLabels.hideAll();locator.hidden=true;locationDot.hidden=true;lineLabels.hidden=false;
    const c=comparison.cam,hh=controls.radius*Math.tan(controls.fov*DEG/2);
    c.left=-hh*w/h;c.right=hh*w/h;c.top=hh;c.bottom=-hh;c.near=.001;c.far=1000;
    // Orthographic projection preserves diameter ratios at every zoom level.
    c.position.set(controls.target.x,controls.target.y,100);c.lookAt(controls.target.x,controls.target.y,0);c.updateProjectionMatrix();c.updateMatrixWorld();
    renderer.render(comparison.scene,c);comparison.scene.updateMatrixWorld(true);
    const order=comparison.layout.items, ends=[];
    const planetPx=Math.max(...comparison.items.filter(it=>it.def.name!=='Sun').map(it=>it.radius))/hh*h/2;
    for(const item of order){
      const it=comparison.items.find(it=>it.def.name===item.name);
      const p=it.group.position.clone().project(c),x=(p.x*.5+.5)*w,bodyY=(-p.y*.5+.5)*h,px=it.radius/hh*h/2;
      const labelWidth=it.label.offsetWidth||it.def.name.length*6+8;
      let row=0;while(ends[row]!==undefined&&x-labelWidth/2<ends[row]+5)row++;
      ends[row]=x+labelWidth/2;
      const above=it.def.name==='Sun'||row>=3;
      const offset=it.def.name==='Sun'?-px-30:above?-planetPx-32-(row-3)*19:planetPx+20+row*19;
      const y=bodyY+offset,R=viewRect;
      it.label.hidden=x<R.x0+12||x>R.x1-20||bodyY+px<R.y0||y<R.y0+5||y>R.y1-75;
      it.label.classList.toggle('above',above);
      it.label.style.left=x+'px';it.label.style.top=y+'px';it.label.style.setProperty('--stem',Math.max(0,Math.abs(offset)-px-(above?18:7))+'px');
    }
  }
  function render(w,h){
    scaleHud();
    if(state.sysLayout==='lineup'){renderComparison(w,h);return;}
    lineLabels.hidden=true;
    const distance=Math.max(controls.radius,sys.cam.position.length()), blend=smooth(Math.log(.01*LY),Math.log(3*LY),Math.log(Math.max(distance,1)));
    renderer.clear();galaxy.render(renderer,sys.cam,controls.target,blend);
    if(distance<4*LY){
      // Floating origin for detailed bodies. Sky spheres follow the physical camera, so scrolling cannot leave them behind.
      sys.sky.position.copy(sys.cam.position);sys.stars.position.copy(sys.cam.position);
      sys.sky.material.opacity=1-blend;sys.stars.material.opacity=1-blend;
      const near=clamp(controls.radius*.002,2e-5,Math.max(1,controls.radius*.01));
      sys.cam.near=near;sys.cam.far=Math.max(220000,controls.radius*4+controls.target.length());sys.cam.updateProjectionMatrix();
      const fade=1-smooth(30000,300000,distance);sys.disc.material.opacity=.035*fade;
      sys.bodies.forEach(b=>{b.orbit.material.opacity=.32*fade;});
      const shift=controls.target.clone();sys.scene.position.copy(shift).negate();sys.scene.updateMatrixWorld(true);
      sys.cam.position.sub(shift);sys.cam.updateMatrixWorld();updateSystemUniforms();
      renderer.clearDepth();const auto=renderer.autoClear;renderer.autoClear=false;renderer.render(sys.scene,sys.cam);renderer.autoClear=auto;
      sysLabels.visible=state.sysLabels&&distance<30000;sysLabels.update(sys.cam,w,h);
      sys.cam.position.add(shift);sys.cam.updateMatrixWorld();
    }else sysLabels.hideAll();
    locator.hidden=state.scale!=='true'||distance<30000;
    locationDot.hidden=true;
    if(!locator.hidden){
      const p=galaxy.project(ORIGIN,sys.cam,w,h),R=viewRect;
      locator.style.left=clamp(p.x,R.x0+90,R.x1-95)+'px';locator.style.top=clamp(p.y+24,R.y0+110,R.y1-100)+'px';
      const offscreen=!p.visible||p.x<R.x0||p.x>R.x1||p.y<R.y0||p.y>R.y1;
      const angle=Math.atan2(p.y-h/2,p.x-w/2)+(p.depth>1?Math.PI:0),arrows=['→','↘','↓','↙','←','↖','↑','↗'];
      locator.querySelector('span').textContent=(offscreen?arrows[(Math.round(angle/(Math.PI/4))+8)%8]:'⊙')+' Solar system';
      if(!offscreen){locationDot.hidden=false;locationDot.style.left=p.x+'px';locationDot.style.top=p.y+'px';}
    }
  }
  $$('[data-sizes]').forEach(b=>b.addEventListener('click',()=>setSizes(b.dataset.sizes)));
  $$('[data-layout]').forEach(b=>b.addEventListener('click',()=>setLayout(b.dataset.layout)));
  $$('[data-order]').forEach(b=>b.addEventListener('click',()=>{state.sysOrder=b.dataset.order;arrange();refresh();}));
  $('#lineupFit').addEventListener('click',fitComparison);$('#viewGalaxy').addEventListener('click',()=>startOut(true));$('#returnSystem').addEventListener('click',returnHome);
  const previousNavigate=controls.onNavigate;
  controls.onNavigate=()=>{if(previousNavigate)previousNavigate();if(state.view==='system'){phase=null;pendingRestore=null;}};
  refresh();
  return {tick,render,refresh,resize,cameraLimits,hideOverlays,setSizes,setLayout,focusComparison,fitComparison,beforeScale,cancelTravel,startOut,returnHome,galaxy,comparison,get journey(){return journey;},get phase(){return phase;}};
})();
