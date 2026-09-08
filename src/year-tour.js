/* Date-based teaching stops and a deterministic presentation clock. */
(function(root){
  'use strict';
  const DAY=86400000, AU_KM=149597870.7;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function build(A, elements, bessel, year=2027){
    if(!A) throw new Error('The astronomy library is unavailable.');
    const start=Date.UTC(year,0,1), end=Date.UTC(year+1,0,1)-1;
    const eclipses=[];
    let eclipse=A.SearchGlobalSolarEclipse(new Date(start));
    while(eclipse.peak.date.getTime()<=end){
      const key=eclipse.peak.date.toISOString().slice(0,10), B=elements[key];
      let ms=eclipse.peak.date.getTime();
      if(B&&bessel) ms=B.t0+bessel.greatest(B).t*3600000-B.dT*1000;
      eclipses.push({ms,kind:eclipse.kind,key});
      eclipse=A.NextGlobalSolarEclipse(eclipse.peak);
    }
    const events=[];
    for(let from=start;from<=end;){
      const phase=A.SearchMoonPhase(0,new Date(from),35);
      if(!phase||phase.date.getTime()>end) break;
      const phaseMs=phase.date.getTime();
      if(phaseMs<from) throw new Error('The new-moon dates are out of order.');
      const hit=eclipses.find(e=>Math.abs(e.ms-phaseMs)<2*DAY);
      const ms=hit?hit.ms:phaseMs, moon=A.EclipticGeoMoon(new Date(ms));
      events.push({phaseMs,ms,kind:hit?hit.kind:'none',beta:moon.lat,moonKm:moon.dist*AU_KM,key:hit?hit.key:null});
      from=phaseMs+DAY;
    }
    if(!events.length) throw new Error('No new moons were found for this year.');
    let seconds=0, previous=start;
    const segments=[];
    const add=(duration,from,to,eventIndex,hold)=>{
      segments.push({start:seconds,end:seconds+duration,from,to,eventIndex,hold}); seconds+=duration;
    };
    events.forEach((event,i)=>{
      add(6,previous,event.ms,i,false);
      event.stop=seconds;
      add(event.kind==='none'?3:12,event.ms,event.ms,i,true);
      previous=event.ms;
    });
    add(6,previous,end,null,false);
    return {year,start,end,events,segments,duration:seconds};
  }
  function sample(tour,elapsed,reduced=false){
    const time=clamp(elapsed,0,tour.duration), complete=time>=tour.duration;
    const segment=tour.segments.find(s=>time<s.end)||tour.segments[tour.segments.length-1];
    const progress=clamp((time-segment.start)/(segment.end-segment.start),0,1);
    const eased=progress*progress*(3-2*progress);
    const ms=complete?tour.end:segment.hold?segment.to:reduced?segment.from:segment.from+(segment.to-segment.from)*eased;
    return {time,ms,progress,hold:!complete&&segment.hold,eventIndex:segment.eventIndex,complete};
  }
  // Even a delayed frame must arrive at a teaching stop before advancing past it.
  function advance(tour,elapsed,delta){
    const next=clamp(elapsed+Math.max(0,delta),0,tour.duration);
    const stop=tour.events.find(e=>e.stop>elapsed+1e-8&&e.stop<next);
    return stop?stop.stop:next;
  }
  function step(tour,elapsed,direction){
    if(direction>0) return (tour.events.find(e=>e.stop>elapsed+1e-6)||{stop:tour.duration}).stop;
    return ([...tour.events].reverse().find(e=>e.stop<elapsed-1e-6)||{stop:0}).stop;
  }
  function counts(tour,ms){
    return tour.events.filter(e=>e.ms<=ms).reduce((out,e)=>{out[e.kind]=(out[e.kind]||0)+1;out.totalMoons++;return out;},{totalMoons:0,none:0,annular:0,total:0});
  }
  // The outer shadow continues into space; fade the illustration well past Earth.
  // This controls its visible extent, never the cone angles or the umbra's true tip.
  function shadowExtent(distance,projection,umbraLength){
    return {fadeStart:Math.max(distance*1.1,projection+distance*.2),length:Math.max(distance*2.6,umbraLength+distance*.8)};
  }
  // Express the instantaneous orbital plane in the lab's Sun-facing frame.
  function orbitFrame(A,ms,sunLon){
    const time=A.MakeTime(new Date(ms));
    const moon=A.RotateState(A.Rotation_EQJ_ECT(time),A.GeoMoonState(time));
    const a=sunLon*Math.PI/180, c=Math.cos(a), s=Math.sin(a);
    const transform=(x,y,z)=>[x*c+y*s,z,x*s-y*c];
    const r=transform(moon.x,moon.y,moon.z), v=transform(moon.vx,moon.vy,moon.vz);
    let n=[r[1]*v[2]-r[2]*v[1],r[2]*v[0]-r[0]*v[2],r[0]*v[1]-r[1]*v[0]];
    const length=Math.hypot(...n); n=n.map(x=>x/length);
    const d=Math.hypot(n[0],n[2]);
    return {normal:n,node:[n[2]/d,0,-n[0]/d],inclination:Math.acos(clamp(n[1],-1,1))*180/Math.PI};
  }
  root.EclipseYearCore={build,sample,advance,step,counts,orbitFrame,shadowExtent};
})(typeof window==='undefined'?globalThis:window);
