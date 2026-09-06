// Besselian-element geometry (node + browser). Units: Earth equatorial radii, degrees, hours from t0 (TDT).
(function(root){
const DEG=Math.PI/180;
const A_EQ=6378.137, F=1/298.257223563, E2=F*(2-F), B_EQ=A_EQ*(1-F);
const K_MOON=0.2725076; let K_UMB=0.2722810;   // Moon's radius in Earth equatorial radii: NASA's penumbral (l1) and umbral (l2) values
function poly(c,t){ let v=0,p=1; for(const a of c){ v+=a*p; p*=t; } return v; }
function dpoly(c,t){ let v=0,p=1; for(let i=1;i<c.length;i++){ v+=i*c[i]*p; p*=t; } return v; }
function parseHMS(s){ const m=s.match(/(\d+):(\d+):([\d.]+)/); return +m[1]+(+m[2])/60+(+m[3])/3600; }
function parseLat(s){ const m=s.match(/(\d+)°([\d.]+)'([NS])/); return (+m[1]+(+m[2])/60)*(m[3]==='S'?-1:1); }
function parseLon(s){ const m=s.match(/(\d+)°([\d.]+)'([EW])/); return (+m[1]+(+m[2])/60)*(m[3]==='W'?-1:1); }
// elements at t (hours from t0, TDT)
function elements(B,t){
  return { x:poly(B.x,t), y:poly(B.y,t), d:poly(B.d,t)*DEG, mu:poly(B.mu,t)*DEG, l1:poly(B.l1,t), l2:poly(B.l2,t),
           dx:dpoly(B.x,t), dy:dpoly(B.y,t), tanf1:B.f1, tanf2:B.f2 };
}
// Earth-fixed geographic frame: X through Greenwich meridian on the equator, Y through 90°E, Z north.
// The Greenwich hour angle of the shadow axis is mu minus the ephemeris-meridian offset 0.00417807*deltaT degrees.
function frame(B,t){
  const e=elements(B,t); const muG=e.mu - 0.00417807*B.dT*DEG;
  const cd=Math.cos(e.d), sd=Math.sin(e.d);
  const z=[cd*Math.cos(-muG), cd*Math.sin(-muG), sd];          // axis direction, toward the Sun
  const x=[Math.sin(muG), Math.cos(muG), 0];                    // east in the fundamental plane
  const y=[z[1]*x[2]-z[2]*x[1], z[2]*x[0]-z[0]*x[2], z[0]*x[1]-z[1]*x[0]];   // z × x = north-ish
  return {e, x, y, z, muG};
}
function toFund(fr,p){ return [p[0]*fr.x[0]+p[1]*fr.x[1]+p[2]*fr.x[2], p[0]*fr.y[0]+p[1]*fr.y[1]+p[2]*fr.y[2], p[0]*fr.z[0]+p[1]*fr.z[1]+p[2]*fr.z[2]]; }
function fromFund(fr,q){ return [q[0]*fr.x[0]+q[1]*fr.y[0]+q[2]*fr.z[0], q[0]*fr.x[1]+q[1]*fr.y[1]+q[2]*fr.z[1], q[0]*fr.x[2]+q[1]*fr.y[2]+q[2]*fr.z[2]]; }
// Moon centre (Earth-fixed, equatorial radii) and Sun direction
function moonAndSun(B,t){
  const fr=frame(B,t); const e=fr.e;
  const zm=(e.l1-K_MOON)/e.tanf1;                    // where the penumbra cone is exactly one Moon wide
  const m=fromFund(fr,[e.x,e.y,zm]);
  return {moon:m, sunDir:fr.z, zm, fr};
}
// geodetic lat/lon (deg) + height (km) → Earth-fixed vector in equatorial radii
function siteEF(lat,lon,h){ const la=lat*DEG, lo=lon*DEG; const C=1/Math.sqrt(1-E2*Math.sin(la)**2), S=(1-E2)*C; const hh=(h||0)/A_EQ;
  return [(C+hh)*Math.cos(la)*Math.cos(lo), (C+hh)*Math.cos(la)*Math.sin(lo), (S+hh)*Math.sin(la)]; }
function efToGeo(p){ const lon=Math.atan2(p[1],p[0])/DEG; const r=Math.hypot(p[0],p[1]); let lat=Math.atan2(p[2],r*(1-E2)); for(let i=0;i<5;i++){ const N=1/Math.sqrt(1-E2*Math.sin(lat)**2); lat=Math.atan2(p[2]+E2*N*Math.sin(lat), r); } return {lat:lat/DEG, lon:((lon+540)%360)-180}; }
// intersect the ray p + s*dir with the ellipsoid; returns the smallest s>0 (the exit point when p is inside), or null
function hitEllipsoid(p,dir){ const a2=1, b2=(1-F)*(1-F);
  const A=dir[0]*dir[0]/a2+dir[1]*dir[1]/a2+dir[2]*dir[2]/b2, Bq=2*(p[0]*dir[0]/a2+p[1]*dir[1]/a2+p[2]*dir[2]/b2), C=p[0]*p[0]/a2+p[1]*p[1]/a2+p[2]*p[2]/b2-1;
  const disc=Bq*Bq-4*A*C; if(disc<0) return null; const r1=(-Bq-Math.sqrt(disc))/(2*A), r2=(-Bq+Math.sqrt(disc))/(2*A);
  if(r1>0) return r1; if(r2>0) return r2; return null; }
// where the shadow axis meets the sunlit ground at time t (Earth-fixed), or null when the axis misses the Earth
function axisGround(B,t){ const fr=frame(B,t); const e=fr.e; if(Math.hypot(e.x,e.y)>1.02) return null;
  const p=fromFund(fr,[e.x,e.y,0]); const s=hitEllipsoid(p,fr.z); if(s===null) return null;
  return [p[0]+s*fr.z[0],p[1]+s*fr.z[1],p[2]+s*fr.z[2]]; }
// local circumstances at an Earth-fixed point: fraction of the Sun's disc covered (0..1), from the real cone geometry
function sunMoon(e){ const f1=Math.atan(e.tanf1), f2=Math.atan(e.tanf2); const Dsm=K_MOON/Math.sin((f1-f2)/2); const Rs=Dsm*Math.sin((f1+f2)/2);
  const zm=(e.l1-K_MOON)/e.tanf1; return {Dsm,Rs,zm}; }
function coverageAt(B,t,pEF){
  const fr=frame(B,t); const e=fr.e; const q=toFund(fr,pEF); const {Dsm,Rs,zm}=sunMoon(e);
  const vm=[e.x-q[0], e.y-q[1], zm-q[2]], vs=[e.x-q[0], e.y-q[1], zm+Dsm-q[2]];
  const dm=Math.hypot(...vm), ds=Math.hypot(...vs);
  const aM=Math.asin(Math.min(1,K_UMB/dm)), aS=Math.asin(Math.min(1,Rs/ds));
  const dot=(vm[0]*vs[0]+vm[1]*vs[1]+vm[2]*vs[2])/(dm*ds); const th=Math.acos(Math.max(-1,Math.min(1,dot)));
  const up=(q[2]-0)*1; // ζ>0 roughly means the Sun is above the horizon at that point only near the sub-solar hemisphere; caller decides
  return { cov: lens(aS, aM, th), aS, aM, th, dist:Math.hypot(q[0]-e.x,q[1]-e.y), zeta:q[2] };
}
function lens(r1,r2,d){ if(d>=r1+r2) return 0; if(d<=Math.abs(r1-r2)) return r2>=r1?1:(r2*r2)/(r1*r1);
  const a1=r1*r1*Math.acos(Math.max(-1,Math.min(1,(d*d+r1*r1-r2*r2)/(2*d*r1)))), a2=r2*r2*Math.acos(Math.max(-1,Math.min(1,(d*d+r2*r2-r1*r1)/(2*d*r2))));
  const a3=0.5*Math.sqrt(Math.max(0,(-d+r1+r2)*(d+r1-r2)*(d-r1+r2)*(d+r1+r2))); return Math.max(0,Math.min(1,(a1+a2-a3)/(Math.PI*r1*r1))); }
// greatest eclipse: time of closest approach of the axis to the Earth's centre
function greatest(B){ let best=null; for(let t=-4;t<=4;t+=1/240){ const e=elements(B,t); const r=Math.hypot(e.x,e.y); if(!best||r<best.r) best={t,r}; }
  // refine
  let t=best.t; for(let i=0;i<30;i++){ const h=1/7200; const f=(tt)=>{ const e=elements(B,tt); return Math.hypot(e.x,e.y); }; const g=(f(t+h)-f(t-h))/(2*h), gg=(f(t+h)-2*f(t)+f(t-h))/(h*h); if(gg<=0) break; t-=g/gg; }
  const g=axisGround(B,t); return { t, ground:g, geo:g?efToGeo(g):null };
}

// surface normal of the ellipsoid at p (Earth-fixed, equatorial radii)
function normalAt(p){ const b2=(1-F)*(1-F); const n=[p[0],p[1],p[2]/b2]; const L=Math.hypot(...n); return [n[0]/L,n[1]/L,n[2]/L]; }
function onSurface(p){ const b2=(1-F)*(1-F); const k=1/Math.sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2]/b2); return [p[0]*k,p[1]*k,p[2]*k]; }
function sunAltAt(B,t,p){ const fr=frame(B,t); const n=normalAt(p); return Math.asin(n[0]*fr.z[0]+n[1]*fr.z[1]+n[2]*fr.z[2])/DEG; }
// the umbra (or antumbra) edge test at a point: negative inside, positive outside
function umbraTest(B,t,p){ const c=coverageAt(B,t,p); return c.th - Math.abs(c.aM-c.aS); }
// northern and southern umbral limits at time t, given the axis ground point g
function limitsAt(B,t,g){
  const fr=frame(B,t); const e=fr.e; const v=fromFund(fr,[e.dx,e.dy,0]); const up=normalAt(g);
  const vd=v[0]*up[0]+v[1]*up[1]+v[2]*up[2]; let m=[v[0]-vd*up[0],v[1]-vd*up[1],v[2]-vd*up[2]]; const mL=Math.hypot(...m); if(mL<1e-9) return null; m=m.map(c=>c/mL);
  const pdir=[m[1]*up[2]-m[2]*up[1], m[2]*up[0]-m[0]*up[2], m[0]*up[1]-m[1]*up[0]];
  const edge=(sign)=>{ let lo=0, hi=0.05; const at=s=>onSurface([g[0]+sign*s*pdir[0],g[1]+sign*s*pdir[1],g[2]+sign*s*pdir[2]]);
    if(umbraTest(B,t,at(0))>0) return null;   // the centre itself is not inside the umbra (should not happen on the central line)
    let guard=0; while(umbraTest(B,t,at(hi))<0 && hi<1.5 && guard++<12) hi*=2; if(umbraTest(B,t,at(hi))<0) return null;
    for(let i=0;i<40;i++){ const mid=(lo+hi)/2; if(umbraTest(B,t,at(mid))<0) lo=mid; else hi=mid; }
    return at((lo+hi)/2); };
  const a=edge(1), b=edge(-1); if(!a||!b) return null;
  const ga=efToGeo(a), gb=efToGeo(b); const width=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])*A_EQ;
  return ga.lat>=gb.lat ? {n:a, s:b, nGeo:ga, sGeo:gb, width} : {n:b, s:a, nGeo:gb, sGeo:ga, width};
}
// the whole path: central line and umbral limits every stepMin minutes
function path(B, stepMin=2){
  const centre=[], north=[], south=[]; let tFirst=null, tLast=null; const dt=stepMin/60;
  for(let t=-4;t<=4;t+=dt){ const g=axisGround(B,t); if(!g) continue; if(tFirst===null) tFirst=t; tLast=t;
    const geo=efToGeo(g); centre.push([geo.lat,geo.lon,t]);
    const lim=limitsAt(B,t,g); if(lim){ north.push([lim.nGeo.lat,lim.nGeo.lon,t]); south.push([lim.sGeo.lat,lim.sGeo.lon,t]); } }
  return {centre,north,south,tFirst,tLast};
}
// local circumstances at a place: contacts (hours from t0, TDT), greatest, coverage, kind, Sun altitude
function local(B,lat,lon,h){
  const P=siteEF(lat,lon,h||0); const f=t=>coverageAt(B,t,P).cov;
  const step=1/120; let first=null,last=null,tm=null,cm=0;
  for(let t=-4;t<=4;t+=step){ const c=f(t); if(c>0){ if(first===null) first=t; last=t; if(c>cm){cm=c;tm=t;} } }
  if(first===null) return {kind:'none', cov:0};
  const bis=(a,b,want)=>{ for(let i=0;i<30;i++){ const m=(a+b)/2; if((f(m)>0)===want) b=m; else a=m; } return (a+b)/2; };
  const t1=bis(first-step, first, true), t4=bis(last, last+step, false);   // careful: want tells which side is "inside"
  // greatest eclipse at this place: golden-section on -cov
  let a=tm-step, b=tm+step; const gr=(Math.sqrt(5)-1)/2; let c=b-gr*(b-a), d=a+gr*(b-a); let fc=f(c), fd=f(d);
  for(let i=0;i<50;i++){ if(fc>fd){ b=d; d=c; fd=fc; c=b-gr*(b-a); fc=f(c); } else { a=c; c=d; fc=fd; d=a+gr*(b-a); fd=f(d); } }
  let tMax=(a+b)/2;
  let kind='partial', t2=null, t3=null;
  const inside=t=>{ const q=coverageAt(B,t,P); return q.th<=Math.abs(q.aM-q.aS); };
  // a short totality can slip between the coarse samples, so comb the neighbourhood of the maximum second by second
  let tin=null; if(inside(tMax)) tin=tMax; else { for(let dt=0; dt<=1/30 && tin===null; dt+=1/3600){ if(inside(tMax+dt)) tin=tMax+dt; else if(inside(tMax-dt)) tin=tMax-dt; } }
  if(tin!==null){
    let lo=tin, hi=tin-0.2; for(let i=0;i<40;i++){ const m=(lo+hi)/2; if(inside(m)) lo=m; else hi=m; } t2=(lo+hi)/2;
    lo=tin; hi=tin+0.2; for(let i=0;i<40;i++){ const m=(lo+hi)/2; if(inside(m)) lo=m; else hi=m; } t3=(lo+hi)/2;
    tMax=(t2+t3)/2; const q=coverageAt(B,tMax,P); kind = q.aM>=q.aS ? 'total' : 'annular'; }
  const cv=coverageAt(B,tMax,P);
  return {kind, cov:cv.cov, t1, t2, t3, t4, tMax, sunAlt:sunAltAt(B,tMax,P), sunAlt1:sunAltAt(B,t1,P), sunAlt4:sunAltAt(B,t4,P)};
}
// places 'inside' km inside and outside the northern umbral limit at greatest eclipse
function edgeSites(B, km){
  const g=greatest(B); if(!g.ground) return null; const lim=limitsAt(B,g.t,g.ground); if(!lim) return null;
  const n=lim.n, c=g.ground; let u=[n[0]-c[0],n[1]-c[1],n[2]-c[2]]; const L=Math.hypot(...u); u=u.map(v=>v/L); const s=km/A_EQ;
  const inP=onSurface([n[0]-s*u[0],n[1]-s*u[1],n[2]-s*u[2]]), outP=onSurface([n[0]+s*u[0],n[1]+s*u[1],n[2]+s*u[2]]);
  return {inside:efToGeo(inP), outside:efToGeo(outP), limit:efToGeo(n), width:lim.width, t:g.t};
}
const api={setMoonRadius:(k)=>{K_UMB=k;},DEG,A_EQ,B_EQ,F,E2,K_MOON,K_UMB,sunMoon,normalAt,onSurface,sunAltAt,limitsAt,path,local,edgeSites,poly,elements,frame,toFund,fromFund,moonAndSun,siteEF,efToGeo,hitEllipsoid,axisGround,coverageAt,greatest,parseHMS,parseLat,parseLon};
if(typeof module!=='undefined') module.exports=api; else root.Bessel=api;
})(typeof window!=='undefined'?window:globalThis);
