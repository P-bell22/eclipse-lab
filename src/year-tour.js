/* Date-based teaching stops and a deterministic presentation clock. */
(function(root){
  'use strict';
  const DAY=86400000, AU_KM=149597870.7;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const kinds=['partial','annular','total','hybrid'];
  function years(elements){return [...new Set(Object.keys(elements).map(key=>+key.slice(0,4)))].sort((a,b)=>a-b);}
  // Pick an illustrative sunlit location when the central shadow axis misses Earth.
  // Keep the Sun at least 3 degrees up so the inset shows a clear disc above the horizon.
  function sunlitObserver(B,bessel,t,kind){
    let best=null;
    const consider=(lat,lon)=>{
      lat=clamp(lat,-90,90); lon=((lon+540)%360)-180;
      const p=bessel.siteEF(lat,lon,0);
      if(bessel.sunAltAt(B,t,p)<3) return;
      const coverage=bessel.coverageAt(B,t,p), cov=coverage.cov;
      // Rare non-central total/annular eclipses need a point inside the grazing cone.
      const score=kind==='partial'?cov:Math.abs(coverage.aM-coverage.aS)-coverage.th;
      if(cov>0&&(!best||score>best.score)) best={lat,lon,cov,score};
    };
    for(let lat=-90;lat<=90;lat+=5) for(let lon=-180;lon<180;lon+=5) consider(lat,lon);
    if(!best) throw new Error('No sunlit viewing location was found for this eclipse.');
    for(const step of [1,.2,.04]){
      const centre=best;
      for(let i=-5;i<=5;i++) for(let j=-5;j<=5;j++) consider(centre.lat+i*step,centre.lon+j*step);
    }
    if(kind!=='partial'&&best.score<0) throw new Error('The viewing location does not show the catalogued eclipse type.');
    return {lat:best.lat,lon:best.lon,cov:best.cov};
  }
  function build(A, elements, bessel, year=2027){
    if(!A) throw new Error('The astronomy library is unavailable.');
    if(!years(elements).includes(year)) throw new Error('Eclipse data is unavailable for this year.');
    const start=Date.UTC(year,0,1), end=Date.UTC(year+1,0,1)-1;
    const eclipses=[];
    let eclipse=A.SearchGlobalSolarEclipse(new Date(start));
    while(eclipse.peak.date.getTime()<=end){
      const key=eclipse.peak.date.toISOString().slice(0,10), B=elements[key];
      if(!B||!bessel) throw new Error(`Missing eclipse data for ${key}.`);
      const peak=bessel.greatest(B), ms=B.t0+peak.t*3600000-B.dT*1000;
      // The NASA type includes hybrids and grazing events classified as partial by the ephemeris library.
      const kind=B.kind||(B.hyb?'hybrid':eclipse.kind);
      const observer=!peak.ground?sunlitObserver(B,bessel,peak.t,kind):null;
      eclipses.push({ms,kind,key,observer});
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
      events.push({phaseMs,ms,kind:hit?hit.kind:'none',beta:moon.lat,moonKm:moon.dist*AU_KM,key:hit?hit.key:null,observer:hit?hit.observer:null});
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
    return tour.events.filter(e=>e.ms<=ms).reduce((out,e)=>{out[e.kind]++;out.totalMoons++;return out;},{totalMoons:0,none:0,partial:0,annular:0,total:0,hybrid:0});
  }
  function summary(tour){
    const tally=counts(tour,tour.end), eclipses=tally.totalMoons-tally.none;
    const list=kinds.filter(kind=>tally[kind]).map(kind=>`${tally[kind]} ${kind} eclipse${tally[kind]===1?'':'s'}`);
    const mix=list.length<2?list[0]:list.slice(0,-1).join(', ')+' and '+list[list.length-1];
    return {title:`${tally.totalMoons} new moons. ${eclipses} solar eclipses.`,
      copy:`In ${tour.year}, ${tally.none} new moons missed Earth completely. The year brought ${mix}. ${tally.total+tally.hybrid?'Totality was possible only along a narrow path.':'No alignment produced totality this year.'}`};
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
  root.EclipseYearCore={build,sample,advance,step,counts,orbitFrame,shadowExtent,years,kinds,summary};
})(typeof window==='undefined'?globalThis:window);
