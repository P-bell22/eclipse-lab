const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../src',file),'utf8');

// Run the production controller and input handlers without a WebGL renderer.
class Vector {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  clone(){return new Vector(this.x,this.y,this.z);}
  copy(v){return Object.assign(this,v);}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  multiplyScalar(k){this.x*=k;this.y*=k;this.z*=k;return this;}
  addScaledVector(v,k){return this.add(v.clone().multiplyScalar(k));}
  normalize(){return this.multiplyScalar(1/Math.hypot(this.x,this.y,this.z));}
  negate(){return this.multiplyScalar(-1);}
  lerp(v,k){this.x+=(v.x-this.x)*k;this.y+=(v.y-this.y)*k;this.z+=(v.z-this.z)*k;return this;}
  setFromMatrixColumn(matrix,i){return this.copy(matrix[i]);}
}
class Element {
  constructor(){this.children=[];this.listeners={};this.style={};this.dataset={};this.textContent='';this.checked=false;this.clientHeight=720;this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(name,fn){this.listeners[name]=fn;}
  fire(name,event={}){this.listeners[name]({target:this,...event});}
  setAttribute(name,value){this[name]=value;}
  setPointerCapture(){}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
  replaceChildren(){this.children=[];}
  querySelector(){return this.children.find(child=>child instanceof Element);}
  after(child){child.parentElement=this.parentElement;}
}
function harness(reduced=false){
  const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const document={body:new Element(),createElement:()=>new Element(),createTextNode:text=>({textContent:text}),addEventListener(name,fn){this[name]=fn;}};
  const V=(...xyz)=>new Vector(...xyz),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const context={Date,document,THREE:{Vector3:Vector},REDUCED:reduced,DEG:Math.PI/180,V,ORIGIN:V(),clamp,
    lerp:(a,b,k)=>a+(b-a)*k,smooth:(a,b,k)=>clamp((k-a)/(b-a),0,1),
    $, $$:selector=>selector==='#yearTimeline button'?$('#yearTimeline').children:[],
    state:{view:'lab',yearMode:false,yearSite:null,dateMs:0,real:false},
    lab:{cam:{near:.05,updateProjectionMatrix(){},matrix:[V(1,0,0),V(0,1,0)]}},
    frame3:(dir,w,h)=>({r:Math.max(w,h)*3,shift:V(4,2,0),a:{theta:Math.atan2(dir.z,dir.x),phi:1.2}}),
    buildPathLines(){},computeViewRect(){},dtInputValue:ms=>String(ms),phaseName:()=> 'New Moon',fmtKm:km=>String(km)
  };
  for(const key of ['orbitGroup','eclRing','plane','heightLine','footMark','moonShadow','lblNodeA','lblNodeB','lblPlane','lblSun'])context.lab[key]={};
  context.window=context;context.innerWidth=1280;
  vm.createContext(context);
  for(const file of ['vendor/astronomy.browser.min.js','bessel.js','bessel_data.js','year-tour.js'])vm.runInContext(read(file),context);
  context.Bz=context.Bessel;context.Bz.setMoonRadius(1737.4/6378.137);
  context.setDate=ms=>{
    context.state.dateMs=ms;
    context.state.eph={sunLon:context.Astronomy.SunPosition(new Date(ms)).elon,moonKm:380000,elong:0,orbit:{node:[1,0,0]}};
  };
  context.applyGeometry=()=>{
    const moon=context.Astronomy.EclipticGeoMoon(new Date(context.state.dateMs)),angle=moon.lon*Math.PI/180;
    context.G={d:60,moonPos:V(60*Math.cos(angle),3,60*Math.sin(angle)),q:V(0,3,0),rho:3,P:V(1,0,0),sunUp:true,cov:1,aM:.005,aS:.004,skyX:0,skyY:0,skyKind:'total'};
  };
  const source=read('eclipse-lab.src.html');
  vm.runInContext(source.slice(source.indexOf('class OrbitCam{'),source.indexOf('function anglesOf'))+'\nglobalThis.controls=new OrbitCam(document.createElement());',context);
  context.controls.cam=context.lab.cam;context.controls.minR=.22;context.controls.maxR=600;
  vm.runInContext(read('year-tour-ui.js')+'\nglobalThis.tourController=yearTour;',context);
  const tour=context.tourController;tour.enter();
  const snapshot=()=>JSON.parse(JSON.stringify(context.controls.save()));
  const run=seconds=>{for(let i=0;i<seconds*20;i++){tour.tick(.05);tour.camera(.05);}};
  return {context,tour,controls:context.controls,$,snapshot,run,document};
}
const pointer=(x,y,extra={})=>({pointerId:1,clientX:x,clientY:y,button:0,...extra});
const gestures={
  orbit:c=>{c.down(pointer(100,100));c.move(pointer(180,120));c.up(pointer(180,120));},
  pan:c=>{c.down(pointer(100,100,{button:2}));c.move(pointer(130,125,{button:2}));c.up(pointer(130,125,{button:2}));},
  wheel:c=>c.wheel({deltaY:-160,preventDefault(){}}),
  touch:c=>{c.down(pointer(100,100));c.down(pointer(200,100,{pointerId:2}));c.move(pointer(240,120,{pointerId:2}));c.up(pointer(240,120,{pointerId:2}));c.up(pointer(100,100));}
};

test('orbit, pan, wheel and touch keep the paused viewpoint through resumed eclipse playback',()=>{
  for(const gesture of Object.values(gestures)){
    const h=harness();h.tour.seek(h.tour.tour.events[0].stop);
    const before=h.snapshot();gesture(h.controls);const chosen=h.snapshot();assert.notDeepEqual(chosen,before);
    h.tour.toggle();assert.equal(h.controls.enabled,true);h.run(16);
    assert.deepEqual(h.snapshot(),chosen,'Playback must preserve angle, zoom and target across the annular stop');
    assert.equal(h.$('#yearCameraReset').hidden,false);
    assert.equal(h.context.lab.moonShadow.visible,true,'Custom views keep the shadow visible at eclipse stops');
    assert.equal(h.$('#yearSunView').hidden,true,'The guided eclipse inset must not take over a custom view');
    h.run(14);assert.deepEqual(h.snapshot(),chosen,'Leaving the eclipse stop must also keep the view');
  }
});

test('navigation during playback takes over immediately; a click leaves the camera guided',()=>{
  const h=harness();h.tour.toggle();h.run(1);
  h.controls.down(pointer(100,100));h.controls.up(pointer(100,100));
  assert.equal(h.$('#yearCameraReset').hidden,true);
  const guided=h.snapshot();h.run(6);assert.notDeepEqual(h.snapshot(),guided);
  gestures.orbit(h.controls);const chosen=h.snapshot();h.run(20);
  assert.equal(h.tour.playing,true);assert.deepEqual(h.snapshot(),chosen);
  h.$('#yearCameraReset').fire('click');h.run(1);
  assert.equal(h.$('#yearCameraReset').hidden,true);assert.notDeepEqual(h.snapshot(),chosen);
  h.tour.seek(h.tour.tour.events[1].stop);h.tour.toggle();h.run(5);
  assert.equal(h.$('#yearSunView').hidden,false,'Guided close-ups still work after restoring the camera');
});

test('custom views survive date and year changes, resize, revisits and continuous playback',()=>{
  const h=harness();gestures.pan(h.controls);gestures.orbit(h.controls);const chosen=h.snapshot();
  h.tour.seek(h.tour.tour.events[7].stop);h.tour.camera(1,true);h.tour.show();
  assert.deepEqual(h.snapshot(),chosen);
  h.$('#yearChoice').value='2028';h.$('#yearChoice').fire('change');assert.deepEqual(h.snapshot(),chosen);
  h.$('#yearContinue').checked=true;h.tour.seek(h.tour.tour.duration-.1);h.tour.toggle();h.run(5);
  assert.equal(h.tour.tour.year,2029);assert.deepEqual(h.snapshot(),chosen);
  h.tour.pause();h.tour.leave();h.controls.radius=55;h.tour.enter();assert.deepEqual(h.snapshot(),chosen);
  h.document.hidden=true;h.document.visibilitychange();assert.equal(h.tour.playing,false);
  h.tour.toggle();h.run(2);assert.deepEqual(h.snapshot(),chosen);
});

test('explicit inspection can frame an eclipse without restoring automatic camera movement',()=>{
  const h=harness(true);gestures.wheel(h.controls);h.tour.seek(h.tour.tour.events[1].stop);
  h.$('#yearDetail').fire('click');const inspected=h.snapshot();assert.equal(h.$('#yearSunView').hidden,false);
  gestures.pan(h.controls);const chosen=h.snapshot();assert.notDeepEqual(chosen,inspected);
  assert.equal(h.context.lab.moonShadow.visible,true);
  h.tour.toggle();h.run(20);assert.deepEqual(h.snapshot(),chosen);
  h.tour.seek(0);h.tour.toggle();h.run(2);assert.deepEqual(h.snapshot(),chosen);
});
