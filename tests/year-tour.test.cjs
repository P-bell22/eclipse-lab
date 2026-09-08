const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={Date}; context.window=context;
vm.createContext(context);
for(const file of ['vendor/astronomy.browser.min.js','bessel.js','bessel_data.js','year-tour.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),context);
}
const {Astronomy:A,EclipseYearCore:C,Bessel:B,BESSEL}=context;
B.setMoonRadius(1737.4/6378.137);
const tour=C.build(A,BESSEL,B);

test('2027 has 13 new moons, including two in August, and the NASA eclipse dates',()=>{
  assert.equal(tour.events.length,13);
  assert.equal(tour.events.filter(e=>new Date(e.phaseMs).getUTCMonth()===7).length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(C.counts(tour,tour.end))),{totalMoons:13,none:11,annular:1,total:1});
  assert.deepEqual(Array.from(tour.events.filter(e=>e.kind!=='none'),e=>[e.key,e.kind]),[
    ['2027-02-06','annular'],['2027-08-02','total']
  ]);
  assert.equal(tour.duration,141);
  assert.equal(new Date(tour.events[0].phaseMs).toISOString().slice(0,10),'2027-01-07');
  assert.equal(new Date(tour.events[12].phaseMs).toISOString().slice(0,10),'2027-12-27');
});

test('teaching stops match real new moons or NASA greatest-eclipse instants',()=>{
  for(const event of tour.events){
    const phase=A.MoonPhase(new Date(event.phaseMs));
    assert.ok(Math.min(phase,360-phase)<0.001);
    const result=C.sample(tour,event.stop);
    assert.equal(result.hold,true); assert.equal(result.ms,event.ms);
    if(event.key){
      const elements=BESSEL[event.key], t=(event.ms+elements.dT*1000-elements.t0)/3600000;
      const point=B.axisGround(elements,t);
      assert.ok(point,'The central shadow reaches the Earth at the teaching stop');
      const coverage=B.coverageAt(elements,t,point);
      if(event.kind==='total'){ assert.equal(coverage.cov,1); assert.ok(coverage.aM>coverage.aS); }
      else { assert.ok(coverage.cov>0&&coverage.cov<1); assert.ok(coverage.aM<coverage.aS); }
    }else assert.ok(Math.abs(event.beta)>2,'Every 2027 miss is well away from a crossing point');
  }
});

test('the real orbit guide lies in the Moon position/velocity plane throughout the year',()=>{
  const nodes=[];
  for(let ms=tour.start;ms<=tour.end;ms+=7*86400000){
    const sun=A.SunPosition(new Date(ms));
    const orbit=C.orbitFrame(A,ms,sun.elon);
    const moon=A.EclipticGeoMoon(new Date(ms));
    const lon=(moon.lon-sun.elon)*Math.PI/180,lat=moon.lat*Math.PI/180;
    const r=[Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon)];
    assert.ok(Math.abs(r.reduce((sum,x,i)=>sum+x*orbit.normal[i],0))<0.0001);
    assert.ok(orbit.inclination>4.8&&orbit.inclination<5.5);
    assert.ok(Math.abs(Math.hypot(...orbit.normal)-1)<1e-12);
    assert.ok(Math.abs(orbit.node.reduce((sum,x,i)=>sum+x*orbit.normal[i],0))<1e-12);
    assert.equal(orbit.node[1],0);
    nodes.push(orbit.node);
  }
  assert.ok(nodes.some(n=>n[0]<-.8)&&nodes.some(n=>n[0]>.8),'The crossing points turn relative to the Sun through the year');
});

test('normal and delayed playback reach every teaching stop at all supported speeds',()=>{
  for(const speed of [.5,1,2]) for(const delta of [1/30,10]){
    let elapsed=0,lastMs=tour.start;
    const seen=new Set();
    while(elapsed<tour.duration){
      elapsed=C.advance(tour,elapsed,delta*speed);
      const sample=C.sample(tour,elapsed);
      assert.ok(sample.ms>=lastMs); lastMs=sample.ms;
      if(sample.hold) seen.add(sample.eventIndex);
    }
    assert.equal(seen.size,13);
    assert.equal(C.sample(tour,elapsed).complete,true);
    assert.equal(lastMs,tour.end);
  }
});

test('stepping, bounds and reduced motion preserve predictable dates',()=>{
  assert.equal(C.step(tour,0,1),tour.events[0].stop);
  assert.equal(C.step(tour,tour.events[7].stop,-1),tour.events[6].stop);
  assert.equal(C.step(tour,tour.events[7].stop,1),tour.events[8].stop);
  assert.equal(C.step(tour,0,-1),0);
  assert.equal(C.sample(tour,-10).ms,tour.start);
  assert.equal(C.sample(tour,tour.duration+20).ms,tour.end);
  for(const segment of tour.segments.filter(s=>!s.hold)){
    assert.equal(C.sample(tour,segment.start+.1,true).ms,segment.from);
    assert.equal(C.sample(tour,segment.end-.1,true).ms,segment.from);
  }
  assert.throws(()=>C.build(null,BESSEL,B),/unavailable/);
});
