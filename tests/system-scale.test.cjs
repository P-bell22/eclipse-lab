const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
// The containing personal workspace declares type:module; exercise the UMD's
// CommonJS branch explicitly without changing that unrelated package setting.
const source=fs.readFileSync(path.join(__dirname,'../src/system-scale.js'),'utf8');
const commonJS={module:{exports:{}}};
vm.runInNewContext(source,commonJS);
const S=commonJS.module.exports;
const close=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const bodies=[
  {name:'Sun',radiusKm:695700}, {name:'Mercury',radiusKm:2440},
  {name:'Venus',radiusKm:6052}, {name:'Earth',radiusKm:6371},
  {name:'Mars',radiusKm:3390}, {name:'Jupiter',radiusKm:69911},
  {name:'Saturn',radiusKm:58232,ringOuterRatio:2.32},
  {name:'Uranus',radiusKm:25362}, {name:'Neptune',radiusKm:24622},
  {name:'Pluto',radiusKm:1188}
];

test('true and compressed proportional sizes retain measured Sun and planet ratios',()=>{
  for(const options of [{mode:'true'},{mode:'condensed',proportional:true,sunDisplayRadius:6.5}]){
    const radii=bodies.map(b=>S.bodyRadius(b.radiusKm,options));
    close(radii[0]/radii[3],109.1979281117564,1e-10);
    close(radii[5]/radii[3],10.973316590802071,1e-10);
    for(let i=0;i<bodies.length;i++) close(radii[i]/radii[0],bodies[i].radiusKm/695700);
  }
  close(S.bodyRadius(695700,{mode:'true'}),.6957);
  close(S.bodyRadius(6371,{mode:'true'}),.006371);
  close(S.bodyRadius(6371,{mode:'condensed',enlargedRadius:.74}),.74);
  close(S.bodyRadius(6371,{mode:'true',proportional:false,enlargedRadius:999}),.006371);
  close(S.AU_KM,149597870.7);
  close(S.LY_KM,299792.458*365.25*86400,.002);
  close(S.MKM_PER_LY*1e6,S.LY_KM,.002);
});

test('line-up preserves planet order or sorts by physical radius with Sun first',()=>{
  const original=JSON.stringify(bodies);
  assert.deepEqual(Array.from(S.lineup(bodies,'planet').items,b=>b.name),bodies.map(b=>b.name));
  assert.deepEqual(Array.from(S.lineup(bodies,'size').items,b=>b.name),[
    'Sun','Pluto','Mercury','Mars','Venus','Earth','Neptune','Uranus','Saturn','Jupiter'
  ]);
  assert.equal(JSON.stringify(bodies),original);
  // A caller need not have supplied the Sun first.
  assert.equal(S.lineup([...bodies.slice(1),bodies[0]]).items[0].name,'Sun');
});

test('line-up includes ring extents, equal gaps and a centred camera fitting width',()=>{
  for(const order of ['planet','size']){
    const {items,width}=S.lineup(bodies,order);
    close(items[0].x-items[0].extent,-width/2);
    close(items.at(-1).x+items.at(-1).extent,width/2);
    for(let i=1;i<items.length;i++){
      const gap=(items[i].x-items[i].extent)-(items[i-1].x+items[i-1].extent);
      close(gap,6.5*.12);
      assert.ok(gap>0,'Bodies and Saturn’s rings must never overlap');
    }
    const saturn=items.find(b=>b.name==='Saturn');
    close(saturn.extent/saturn.radius,2.32);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(S.lineup([]))),{items:[],width:0});
});

test('galactic rotation preserves physical lengths and matches known centre and north pole',()=>{
  function sceneToEqj([x,y,z]){
    const e=23.4392911*Math.PI/180;
    return [x,-z*Math.cos(e)-y*Math.sin(e),-z*Math.sin(e)+y*Math.cos(e)];
  }
  function toAngles(v){
    const [x,y,z]=sceneToEqj(v);
    return [(Math.atan2(y,x)*180/Math.PI+360)%360,Math.asin(z/Math.hypot(x,y,z))*180/Math.PI];
  }
  const centre=S.galacticToScene([1,0,0]),north=S.galacticToScene([0,0,1]);
  const [centreRA,centreDec]=toAngles(centre),[poleRA,poleDec]=toAngles(north);
  close(centreRA,266.4049948010461,1e-8); close(centreDec,-28.9361739601387,1e-8);
  close(poleRA,192.85948,1e-8); close(poleDec,27.12825,1e-8);
  close(centre.reduce((n,v,i)=>n+v*north[i],0),0);
  for(const vector of [[0,0,0],[1,2,3],[26000,0,0],[50000,-12000,400]]){
    close(Math.hypot(...S.galacticToScene(vector)),Math.hypot(...vector),1e-9);
  }
  const centrePosition=S.galacticToScene([S.SUN_GALACTIC_DISTANCE_LY,0,0]);
  close(Math.hypot(...centrePosition),26000,1e-9);
  assert.equal(S.GALAXY_RADIUS_LY*2,100000);
});

test('scale bar represents physical projected lengths from kilometres to galaxy distances',()=>{
  const fov=Math.PI/4,height=800,pixels=120;
  for(const [target,expectedLabel] of [[5000/1e6,'5,000 km'],[2*S.AU_KM/1e6,'2 AU'],[5000*S.MKM_PER_LY,'5,000 ly']]){
    // Stay safely above a nice-number boundary to avoid irrelevant float ties.
    const distance=target*1.01/pixels*height/(2*Math.tan(fov/2));
    const bar=S.scaleBar(distance,fov,height,pixels);
    assert.equal(bar.label,expectedLabel);
    close(bar.lengthMkm/target,1);
    close(bar.pixels,bar.lengthMkm/(2*distance*Math.tan(fov/2)/height));
    assert.ok(bar.pixels<=pixels&&bar.pixels>=pixels*.4);
  }
  for(let exponent=-7;exponent<14;exponent+=.25){
    const bar=S.scaleBar(10**exponent,fov,height,pixels);
    assert.ok(Number.isFinite(bar.pixels)&&bar.pixels>0);
    assert.ok(bar.pixels<=pixels+1e-8&&bar.pixels>=pixels*.4-1e-8);
    assert.ok(!bar.label.startsWith('0 '),'A visible scale bar cannot describe zero distance');
  }
});

test('helper exposes the same API in a plain browser script',()=>{
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/system-scale.js'),'utf8'),context);
  assert.equal(context.SystemScale.MKM_PER_LY,S.MKM_PER_LY);
  close(context.SystemScale.bodyRadius(6371),S.bodyRadius(6371));
});
