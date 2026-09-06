/* ============================================================
   ECLIPSE SIMPLE — the quick version. Five short lessons on one flat, friendly picture,
   drawn on a 2D canvas in the app's own style. Nothing here is to scale; it is a diagram
   you can push about with a finger: drag the Moon up and down, slide it nearer and farther,
   and watch what someone on the Earth would see in the porthole.
   ============================================================ */
const simple = (()=>{
  const cv=$('#simpleCanvas'); const g=cv.getContext('2d');
  const LESSONS = {
    overview:{ n:1, head:'Meet our solar family', title:'Meet our solar family', sw:'var(--sky)', align:0, dist:20,
      kid:'Eight planets go round one star. The Earth carries the Moon along for the ride — and every so often the three of them make a straight line.',
      idea:'An eclipse can only happen when the Sun, the Moon and the Earth line up.' },
    total:{ n:2, head:'Total solar eclipse', title:'The Moon hides the whole Sun', sw:'var(--gold)', align:0, dist:20,
      kid:'The Moon slides exactly between the Sun and the Earth. The dark tip of its shadow touches the ground, and for a few minutes day turns into night.',
      idea:'A total eclipse needs a centred Moon that is close enough to look bigger than the Sun.' },
    partial:{ n:3, head:'Partial solar eclipse', title:'The line-up is a bit off', sw:'var(--moon)', align:47, dist:20,
      kid:'The Moon still passes between the Sun and the Earth, but you are outside the darkest part of its shadow. Only a bite is taken out of the Sun.',
      idea:'A small sideways nudge turns a total eclipse into a partial one.' },
    lunar:{ n:4, head:'Lunar eclipse', title:'The Earth shades the Moon', sw:'var(--copper)', align:0, dist:55,
      kid:"Now the Earth is in the middle. The full Moon moves into the Earth's shadow and glows copper-red, lit only by sunsets bending round our atmosphere.",
      idea:"Solar eclipse: the Moon's shadow lands on the Earth. Lunar eclipse: the Earth's shadow lands on the Moon." },
    annular:{ n:5, head:'Annular eclipse', title:'The Moon is too far away', sw:'var(--ember)', align:0, dist:88,
      kid:"The Moon is centred, but it is farther away so it looks a little smaller. It can't cover the Sun's bright edge, and a ring of sunlight is left.",
      idea:'Total and annular eclipses have the same line-up. What differs is how big the Moon looks.' },
  };
  const ORDER=['overview','total','partial','lunar','annular'];
  const PAL = {
    sun:['#fff4d6','#ffc857','#b8651f'], earth:['#e4f6ff','#3d9fc9','#0d2a55'], moon:['#f6f7fb','#aeb5c4','#3d4457'],
    planets:[
      {name:'Mercury', orbit:0.68, r:0.075, speed:1.55, tilt:0.018, node:0.2, col:['#e8dccb','#9c8a7c','#3a3234']},
      {name:'Venus', orbit:1.02, r:0.12, speed:1.22, tilt:0.026, node:1.1, col:['#fff0c8','#d9a55e','#5a3d3a']},
      {name:'Earth', orbit:1.44, r:0.14, speed:1, tilt:0.018, node:2.2, col:['#e4f6ff','#3d9fc9','#0d2a55']},
      {name:'Mars', orbit:1.82, r:0.095, speed:0.82, tilt:0.035, node:0.6, col:['#ffc9a6','#d0603f','#4a2a2c']},
      {name:'Jupiter', orbit:2.42, r:0.27, speed:0.48, tilt:0.022, node:2.8, col:['#fff1d6','#c99a72','#5b4340'], stripes:true},
      {name:'Saturn', orbit:3.05, r:0.23, speed:0.38, tilt:0.042, node:1.7, col:['#fbe9c2','#c9a96f','#55423a'], rings:true},
      {name:'Uranus', orbit:3.62, r:0.18, speed:0.29, tilt:0.03, node:2.4, col:['#e6fffb','#7fd0d3','#2a5a7c']},
      {name:'Neptune', orbit:4.12, r:0.18, speed:0.24, tilt:0.035, node:0.9, col:['#dbe6ff','#4f7fe0','#1a2f74']},
    ]
  };
  const S={ lesson:'overview', time:0, speed:0.65, paused:false, names:true, view:'perspective', yaw:-0.62, pitch:0.48, zoom:1,
            align:0, dist:20, track:0.08, trackPlaying:true, drag:null, moonScr:null, W:1, H:1, dpr:1, touched:false, skyDirty:true };
  const stars=Array.from({length:230},(_,i)=>{ const a=(i*9301+49297)%233280, b=(a*9301+49297)%233280; return {x:a/233280, y:b/233280, s:i%19===0?1.4:i%7===0?0.9:0.5, al:0.18+((i*13)%62)/100}; });
  const FONT_D="500 12px Fredoka, system-ui, sans-serif";

  /* ---------- the physics of the picture (a toy, but a consistent one) ---------- */
  function ratio(){ return 1.35 - 0.6*(S.dist/100); }   // how big the Moon looks next to the Sun: 1.35 up close, 0.75 far away
  function result(){
    if(S.lesson==='overview') return {key:'normal', word:'Sunny day', cls:'w-none', sub:'Nothing lined up today'};
    const a=Math.abs(S.align);
    if(S.lesson==='lunar'){ const d=a*0.06;   // Earth's dark shadow is 2.6 Moons wide, the faint one 4.6
      if(d<=1.6) return {key:'lunar', word:'Lunar', cls:'w-lunar', sub:'The Moon glows copper-red'};
      if(d<3.6) return {key:'lunar-partial', word:'Partial lunar', cls:'w-lunar', sub:'A dark bite out of the Moon', frac:clamp((3.6-d)/2,0,1)};
      if(d<5.6) return {key:'penumbral', word:'Faint', cls:'w-none', sub:'The Moon only dims a touch'};
      return {key:'none', word:'No eclipse', cls:'w-none', sub:'The Moon misses the shadow'}; }
    const m=ratio(), d=a*0.021;
    if(d>=1+m) return {key:'none', word:'No eclipse', cls:'w-none', sub:'The Moon misses the Sun', cov:0};
    if(m>=1 && d<=m-1) return {key:'total', word:'Total', cls:'w-total', sub:'Sun fully covered — see the corona!', cov:1};
    if(m<1 && d<=1-m) return {key:'annular', word:'Annular', cls:'w-annular', sub:'A ring of fire', cov:m*m};
    const cov=lensCoverage(1,m,d); return {key:'partial', word:'Partial', cls:'w-partial', sub:`${Math.round(cov*100)}% of the Sun covered`, cov};
  }

  /* ---------- projection into the free part of the screen ---------- */
  function free(){ const R=viewRect; return { cx:(R.x0+R.x1)/2, cy:(R.y0+R.y1)/2, w:Math.max(200,R.x1-R.x0), h:Math.max(160,R.y1-R.y0) }; }
  function scale(){ const f=free(); return Math.min(f.w,f.h)*(S.lesson==='overview'?0.104:0.116)*S.zoom; }
  function project(p){
    const cy=Math.cos(S.yaw), sy=Math.sin(S.yaw); const x1=p.x*cy-p.z*sy, z1=p.x*sy+p.z*cy;
    const cp=Math.cos(S.pitch), sp=Math.sin(S.pitch); const y2=p.y*cp-z1*sp, z2=p.y*sp+z1*cp;
    const persp=clamp(1/(1+z2/15),0.62,1.55); const k=scale()*persp; const f=free();
    return {x:f.cx+x1*k, y:f.cy-y2*k, depth:z2, persp};
  }
  function path(pts,color,width=1,dash=[]){ g.save(); g.beginPath(); pts.forEach((p,i)=>{ const q=project(p); if(i) g.lineTo(q.x,q.y); else g.moveTo(q.x,q.y); }); g.strokeStyle=color; g.lineWidth=width; g.setLineDash(dash); g.stroke(); g.restore(); }
  function poly(pts,fill){ g.save(); g.beginPath(); pts.forEach((p,i)=>{ const q=project(p); if(i) g.lineTo(q.x,q.y); else g.moveTo(q.x,q.y); }); g.closePath(); g.fillStyle=fill; g.fill(); g.restore(); }

  /* ---------- drawing helpers in the app's style ---------- */
  function rrect(x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
  function pill(text, x, y, opts={}){   // a name label like the 3D views' pills
    g.save(); g.font=opts.font||FONT_D; const pad=opts.pad||7; const w=g.measureText(text).width+pad*2, h=opts.h||20;
    const left = opts.align==='right' ? x-w : opts.align==='center' ? x-w/2 : x; const top=y-h/2;
    g.fillStyle=opts.bg||'rgba(6,8,26,.6)'; g.strokeStyle=opts.border||'rgba(170,184,236,.16)'; g.lineWidth=1;
    rrect(left,top,w,h,h/2); g.fill(); g.stroke();
    g.fillStyle=opts.color||'#eef1ff'; g.textBaseline='middle'; g.textAlign='left'; g.fillText(text,left+pad,y+0.5); g.restore();
    return {left,top,w,h};
  }
  function label(text, p, r, color){ if(!S.names) return; const dir = p.x>S.W*0.78 ? -1 : 1; g.save(); g.strokeStyle=color; g.globalAlpha=0.5; g.lineWidth=1; g.beginPath(); g.moveTo(p.x+dir*r,p.y); g.lineTo(p.x+dir*(r+8),p.y); g.stroke(); g.restore(); pill(text, p.x+dir*(r+11), p.y, {align:dir>0?'left':'right', color}); }
  function ball(pt, r, pal){ const gr=g.createRadialGradient(pt.x-r*0.38,pt.y-r*0.42,r*0.03,pt.x,pt.y,r*1.18); gr.addColorStop(0,pal[0]); gr.addColorStop(0.44,pal[1]); gr.addColorStop(1,pal[2]); return gr; }
  function body(def, pos, r, o={}){
    const p=project(pos); const R=Math.max(2,r*scale()*p.persp);
    if(o.glow){ const gl=g.createRadialGradient(p.x,p.y,R*0.55,p.x,p.y,R*5); gl.addColorStop(0,o.glow); gl.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gl; g.beginPath(); g.arc(p.x,p.y,R*5,0,7); g.fill(); }
    if(def.rings){ g.save(); g.translate(p.x,p.y); g.rotate(-0.16+S.yaw*0.16); g.strokeStyle='rgba(232,214,178,.7)'; g.lineWidth=Math.max(1,R*0.15); g.beginPath(); g.ellipse(0,0,R*1.9,Math.max(2,R*(0.36+Math.abs(p.depth)*0.025)),0,0,7); g.stroke(); g.restore(); }
    g.save(); g.beginPath(); g.arc(p.x,p.y,R,0,7); g.clip(); g.fillStyle=ball(p,R,def.col||def); g.fillRect(p.x-R,p.y-R,R*2,R*2);
    if(def.stripes&&R>5){ g.globalAlpha=0.33; g.fillStyle='#fff0d3'; g.fillRect(p.x-R,p.y-R*0.3,R*2,R*0.13); g.fillStyle='#925b58'; g.fillRect(p.x-R,p.y+R*0.22,R*2,R*0.1); g.globalAlpha=1; }
    if(o.night){ const sh=g.createLinearGradient(p.x-R,0,p.x+R,0); sh.addColorStop(0,'rgba(0,0,0,.05)'); sh.addColorStop(0.52,'rgba(0,0,0,.1)'); sh.addColorStop(1,'rgba(0,0,0,.72)'); g.fillStyle=sh; g.fillRect(p.x-R,p.y-R,R*2,R*2); }
    if(o.tint){ g.fillStyle=o.tint; g.fillRect(p.x-R,p.y-R,R*2,R*2); }
    g.restore();
    if(o.label){ if(o.labelBelow){ if(S.names){ const drop=o.labelDrop||0; g.save(); g.strokeStyle=o.labelColor||'#eef1ff'; g.globalAlpha=0.5; g.beginPath(); g.moveTo(p.x,p.y+R); g.lineTo(p.x,p.y+R+7+drop); g.stroke(); g.restore(); pill(o.label,p.x,p.y+R+17+drop,{align:'center',color:o.labelColor||'#eef1ff'}); } } else label(o.label,p,R,o.labelColor||'#eef1ff'); }
    return {x:p.x,y:p.y,r:R,depth:p.depth};
  }
  function background(){
    const grd=g.createLinearGradient(0,0,S.W,S.H); grd.addColorStop(0,'#090c24'); grd.addColorStop(0.5,'#06081a'); grd.addColorStop(1,'#080b22'); g.fillStyle=grd; g.fillRect(0,0,S.W,S.H);
    for(const st of stars){ const tw=0.84+Math.sin(S.time*0.8+st.x*19)*0.14; g.globalAlpha=st.al*tw; g.fillStyle='#d5dcf4'; g.beginPath(); g.arc(st.x*S.W,st.y*S.H,st.s,0,7); g.fill(); }
    g.globalAlpha=1;
  }

  /* ---------- lesson 1: the orbit overview ---------- */
  function orbitPos(rad,ang,tilt,node){ const lx=Math.cos(ang)*rad, lz=Math.sin(ang)*rad; return {x:lx*Math.cos(node)-lz*Math.sin(node), y:Math.sin(ang*1.13+node)*tilt, z:lx*Math.sin(node)+lz*Math.cos(node)}; }
  function drawOverview(){
    PAL.planets.forEach(pl=>{ const pts=[]; for(let i=0;i<=128;i++) pts.push(orbitPos(pl.orbit,i/128*Math.PI*2,pl.tilt,pl.node)); path(pts, pl.name==='Earth'?'rgba(108,184,255,.45)':'rgba(143,162,224,.22)', pl.name==='Earth'?1.2:0.8); });
    const objs=[]; const sunP={x:0,y:0,z:0}; objs.push({d:project(sunP).depth, draw:()=>body({col:PAL.sun},sunP,0.48,{label:'Sun',labelColor:'#ffc857',glow:'rgba(255,200,87,.3)'})});
    let earthP=null;
    PAL.planets.forEach((pl,i)=>{ const ang=i*0.71+0.35+S.time*pl.speed*0.17; const pos=orbitPos(pl.orbit,ang,pl.tilt,pl.node); if(pl.name==='Earth') earthP=pos;
      const inner = pl.name==='Mercury'||pl.name==='Venus';
      objs.push({d:project(pos).depth, draw:()=>body(pl,pos,pl.r,{label:(inner&&S.zoom<1.25)?null:pl.name, labelColor:pl.name==='Earth'?'#6cb8ff':'#a3accf', night:true})}); });
    if(earthP){ const pts=[]; for(let i=0;i<=64;i++){ const a=i/64*Math.PI*2; pts.push({x:earthP.x+Math.cos(a)*0.34, y:earthP.y+Math.sin(a*1.7)*0.028, z:earthP.z+Math.sin(a)*0.34}); } path(pts,'rgba(207,212,227,.35)',0.85,[3,5]);
      const ma=S.time*0.72+2.3; const mp={x:earthP.x+Math.cos(ma)*0.34, y:earthP.y+Math.sin(ma*1.4)*0.028, z:earthP.z+Math.sin(ma)*0.34};
      objs.push({d:project(mp).depth, draw:()=>body({col:PAL.moon},mp,0.045,{label:S.zoom>1.25?'Moon':null, labelColor:'#cfd4e3'})}); }
    objs.sort((a,b)=>b.d-a.d).forEach(o=>o.draw()); S.moonScr=null;
  }

  /* ---------- lessons 2–5: the line-up ---------- */
  function positions(){
    const y=S.align*0.0082; const sun={x:-3.55,y:0,z:0};
    if(S.lesson==='lunar') return {sun, earth:{x:0,y:0,z:0}, moon:{x:3.05,y,z:0}};
    return {sun, moon:{x:lerp(2.05,1.15,S.dist/100), y, z:0}, earth:{x:3.25,y:0,z:0}};   // farther away in space = farther from the Earth in the picture
  }
  function cone(a,b,ra,rb,fill){   // a shadow volume: two crossed slabs read as a cone from any angle
    poly([{x:a.x,y:a.y-ra,z:a.z},{x:b.x,y:b.y-rb,z:b.z},{x:b.x,y:b.y+rb,z:b.z},{x:a.x,y:a.y+ra,z:a.z}],fill);
    poly([{x:a.x,y:a.y,z:a.z-ra},{x:b.x,y:b.y,z:b.z-rb},{x:b.x,y:b.y,z:b.z+rb},{x:a.x,y:a.y,z:a.z+ra}],fill.replace(/([\d.]+)\)$/,(m,al)=>`${+al*0.55})`));
  }
  function rays(sun,blocker,target,rb){ [-1,1].forEach(s=>path([{x:sun.x+0.5,y:sun.y+s*0.24,z:0},{x:blocker.x-0.12,y:blocker.y+s*rb,z:0},{x:target.x-0.2,y:target.y+s*0.17,z:0}],'rgba(255,200,87,.28)',0.8,[3,6])); }
  function drawLineup(){
    const {sun,earth,moon}=positions(); const res=result(); const rm=0.16;
    path([{x:-4.15,y:0,z:0},{x:4.1,y:0,z:0}],'rgba(143,162,224,.16)',0.8,[4,7]);
    if(S.lesson==='lunar'){
      cone({x:earth.x+0.18,y:0,z:0},{x:moon.x+0.35,y:0,z:0},0.28,0.11,'rgba(14,18,52,.78)');
      cone({x:earth.x+0.14,y:0,z:0},{x:moon.x+0.4,y:0,z:0},0.48,0.31,'rgba(120,135,200,.16)');
      rays(sun,earth,moon,0.24);
    } else {
      const m=ratio(); const slope=moon.y/(moon.x-sun.x);                           // the shadow points straight away from the Sun through the Moon
      const yAt=x=>moon.y+slope*(x-moon.x);
      const surf=earth.x-0.255; const tipX=moon.x+m*(surf-moon.x);                  // the dark cone reaches exactly the ground when the Moon looks the same size as the Sun
      const endX=Math.min(tipX, earth.x+0.12); const endR = tipX>earth.x+0.12 ? 0.12*(1-(earth.x+0.12-moon.x)/(tipX-moon.x)) : 0;
      cone({x:moon.x+0.1,y:yAt(moon.x+0.1),z:0},{x:endX,y:yAt(endX),z:0},0.12,Math.max(0.006,endR),'rgba(14,18,52,.8)');
      cone({x:moon.x+0.08,y:yAt(moon.x+0.08),z:0},{x:earth.x+0.22,y:yAt(earth.x+0.22),z:0},0.23,0.4,'rgba(120,135,200,.16)');
      if(tipX<surf) cone({x:tipX,y:yAt(tipX),z:0},{x:earth.x+0.18,y:yAt(earth.x+0.18),z:0},0.01,0.12*(earth.x+0.18-tipX)/(tipX-moon.x),'rgba(255,138,61,.25)');
      rays(sun,moon,earth,rm);
    }
    const tint = S.lesson==='lunar' ? (res.key==='lunar' ? 'rgba(226,104,63,.5)' : res.key==='lunar-partial' ? `rgba(226,104,63,${0.15+0.3*res.frac})` : null) : null;
    const objs=[
      {k:'sun', d:project(sun).depth, draw:()=>body({col:PAL.sun},sun,0.5,{label:'Sun',labelColor:'#ffc857',glow:'rgba(255,200,87,.3)'})},
      {k:'earth', d:project(earth).depth, draw:()=>body({col:PAL.earth},earth,0.255,{label:'Earth',labelColor:'#6cb8ff',night:true,labelBelow:S.lesson==='lunar'||S.W<=900,labelDrop:(S.lesson!=='lunar'&&S.W<=900)?18:0})},
      {k:'moon', d:project(moon).depth, draw:()=>body({col:PAL.moon},moon,rm,{label:'Moon',labelColor:'#cfd4e3',night:true,tint,labelBelow:S.lesson!=='lunar'})},
    ];
    objs.sort((a,b)=>b.d-a.d).forEach(o=>{ const drawn=o.draw(); if(o.k==='moon') S.moonScr=drawn; });
    // a little you-are-here on the Earth, and the drag hint on the Moon
    const ep=project(earth); const er=0.255*scale()*ep.persp; g.save(); g.strokeStyle=res.key==='none'?'rgba(163,172,207,.5)':'rgba(255,200,87,.9)'; g.setLineDash([2,3]); g.lineWidth=1; g.beginPath(); g.arc(ep.x,ep.y,er+7,0,7); g.stroke(); g.restore();
    if(S.moonScr && !S.touched) pill('Drag me ↕', S.moonScr.x, S.moonScr.y-S.moonScr.r-18, {align:'center', color:'#ffc857', border:'rgba(255,200,87,.45)'});
    pill(res.word+(res.key==='partial'?` · ${Math.round(res.cov*100)}%`:''), ep.x, ep.y-er-24, {align:'center', color:res.key==='none'?'#a3accf':res.key==='total'?'#ffc857':res.key==='annular'?'#ff8a3d':res.key.startsWith('lunar')?'#e2683f':'#cfd4e3', font:'600 13px Fredoka, system-ui, sans-serif', h:24, pad:10});
  }

  /* ---------- the Earth close-up: the umbra crossing the globe ---------- */
  const CONT=[[[-12,36],[18,70],[54,73],[92,70],[145,54],[151,30],[122,10],[104,7],[80,22],[61,25],[48,40],[22,34]],[[-17,36],[13,38],[37,31],[50,10],[41,-14],[28,-34],[12,-35],[2,-20],[-10,4],[-17,17]],[[112,-10],[136,-9],[154,-18],[150,-38],[124,-40],[113,-27]],[[-82,12],[-70,7],[-53,-3],[-47,-23],[-60,-54],[-72,-42],[-78,-13]],[[-168,67],[-140,71],[-113,56],[-89,50],[-81,26],[-103,17],[-119,30],[-143,47]],[[-52,81],[-23,74],[-28,59],[-48,58],[-63,70]]];
  function globePt(lon,lat,rot,c,R){ const la=(lon+rot)*DEG, ph=lat*DEG; return {x:c.x+R*Math.cos(ph)*Math.sin(la), y:c.y-R*Math.sin(ph), vis:Math.cos(ph)*Math.cos(la)>-0.025}; }
  function trackPt(t,c,R){ return {x:c.x+lerp(-0.78,0.78,t)*R, y:c.y+(-0.3+t*0.58-Math.sin(t*Math.PI)*0.035)*R}; }
  function drawCloseup(){
    const f=free(); const c={x:f.cx+f.w*0.04, y:f.cy}; const R=Math.min(f.w,f.h)*0.31*S.zoom; const spot=trackPt(S.track,c,R); const rot=-55+S.yaw*180/Math.PI;
    const sx=Math.max(f.cx-f.w/2+40, c.x-R-Math.min(145,f.w*0.17)), sy=spot.y-R*0.28;
    const pen=g.createLinearGradient(sx,sy,spot.x,spot.y); pen.addColorStop(0,'rgba(35,42,77,.08)'); pen.addColorStop(1,'rgba(35,42,77,.32)'); g.fillStyle=pen; g.beginPath(); g.moveTo(sx-60,sy-R*0.48); g.lineTo(spot.x,spot.y-R*0.15); g.lineTo(spot.x,spot.y+R*0.15); g.lineTo(sx-60,sy+R*0.48); g.closePath(); g.fill();
    g.fillStyle='rgba(4,5,15,.45)'; g.beginPath(); g.moveTo(sx,sy-R*0.11); g.lineTo(spot.x,spot.y-R*0.042); g.lineTo(spot.x,spot.y+R*0.042); g.lineTo(sx,sy+R*0.11); g.closePath(); g.fill();
    const mg=g.createRadialGradient(sx-7,sy-8,1,sx,sy,28); mg.addColorStop(0,'#f6f7fb'); mg.addColorStop(0.45,'#aeb5c4'); mg.addColorStop(1,'#3d4457'); g.fillStyle=mg; g.beginPath(); g.arc(sx,sy,24,0,7); g.fill();
    if(S.names) pill('Moon', sx, sy+42, {align:'center', color:'#cfd4e3'});
    g.save(); g.shadowColor='rgba(108,184,255,.6)'; g.shadowBlur=27; g.fillStyle='#143f78'; g.beginPath(); g.arc(c.x,c.y,R+3,0,7); g.fill(); g.restore();
    g.save(); g.beginPath(); g.arc(c.x,c.y,R,0,7); g.clip();
    const oc=g.createRadialGradient(c.x-R*0.28,c.y-R*0.31,R*0.05,c.x,c.y,R*1.08); oc.addColorStop(0,'#4f9ac4'); oc.addColorStop(0.32,'#176496'); oc.addColorStop(0.74,'#0d3d6d'); oc.addColorStop(1,'#061c38'); g.fillStyle=oc; g.fillRect(c.x-R,c.y-R,R*2,R*2);
    CONT.forEach((shape,i)=>{ const pts=shape.map(([lo,la])=>globePt(lo,la,rot,c,R)).filter(p=>p.vis); if(pts.length<3) return; g.beginPath(); pts.forEach((p,j)=>j?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y)); g.closePath(); const land=g.createLinearGradient(c.x-R,c.y-R,c.x+R,c.y+R); land.addColorStop(0,i%2?'#31553f':'#3e6746'); land.addColorStop(0.55,i%2?'#51714b':'#617b4d'); land.addColorStop(1,'#6c6c47'); g.fillStyle=land; g.fill(); g.strokeStyle='rgba(187,203,143,.14)'; g.lineWidth=0.8; g.stroke(); });
    g.strokeStyle='rgba(151,207,226,.12)'; g.lineWidth=0.65;
    for(let la=-60;la<=60;la+=30){ g.beginPath(); let up=true; for(let lo=-180;lo<=180;lo+=3){ const p=globePt(lo,la,rot,c,R); if(!p.vis){up=true;continue;} if(up) g.moveTo(p.x,p.y); else g.lineTo(p.x,p.y); up=false; } g.stroke(); }
    for(let lo=-150;lo<=180;lo+=30){ g.beginPath(); let up=true; for(let la=-88;la<=88;la+=3){ const p=globePt(lo,la,rot,c,R); if(!p.vis){up=true;continue;} if(up) g.moveTo(p.x,p.y); else g.lineTo(p.x,p.y); up=false; } g.stroke(); }
    const term=g.createLinearGradient(c.x-R,0,c.x+R*0.55,0); term.addColorStop(0,'rgba(0,5,16,.78)'); term.addColorStop(0.4,'rgba(0,7,18,.35)'); term.addColorStop(0.82,'rgba(0,0,0,0)'); g.fillStyle=term; g.fillRect(c.x-R,c.y-R,R*2,R*2);
    g.strokeStyle='rgba(255,200,87,.6)'; g.lineWidth=1.2; g.setLineDash([3,5]); g.beginPath(); for(let i=0;i<=50;i++){ const p=trackPt(i/50,c,R); i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y); } g.stroke(); g.setLineDash([]);
    const pg=g.createRadialGradient(spot.x,spot.y,R*0.025,spot.x,spot.y,R*0.17); pg.addColorStop(0,'rgba(0,2,10,.97)'); pg.addColorStop(0.34,'rgba(0,3,12,.84)'); pg.addColorStop(0.72,'rgba(25,19,57,.45)'); pg.addColorStop(1,'rgba(44,34,88,0)'); g.fillStyle=pg; g.beginPath(); g.arc(spot.x,spot.y,R*0.17,0,7); g.fill();
    g.fillStyle='rgba(0,2,9,.94)'; g.beginPath(); g.arc(spot.x,spot.y,Math.max(7,R*0.052),0,7); g.fill(); g.strokeStyle='rgba(255,200,87,.9)'; g.lineWidth=1.4; g.beginPath(); g.arc(spot.x,spot.y,Math.max(10,R*0.069),0,7); g.stroke();
    g.restore();
    g.strokeStyle='rgba(108,184,255,.8)'; g.lineWidth=1.2; g.beginPath(); g.arc(c.x,c.y,R+1,0,7); g.stroke();
    const right = spot.x < c.x+R*0.45; const lx=right?spot.x+26:spot.x-26, ly=spot.y-26;
    g.strokeStyle='rgba(255,200,87,.7)'; g.beginPath(); g.moveTo(spot.x+(right?8:-8),spot.y-7); g.lineTo(lx,ly+6); g.stroke();
    pill("Moon's shadow — dark middle (umbra)", lx, ly, {align:right?'left':'right', color:'#cfd4e3', bg:'rgba(6,8,26,.7)'});
    S.moonScr=null;
  }

  /* ---------- the porthole: what you would see from the Earth ---------- */
  function drawPorthole(){
    const c=skyCanvas; const shown=!!c.clientWidth; const dpr=Math.min(2,window.devicePixelRatio||1); const css=c.clientWidth||200;
    if(shown && c.width!==Math.round(css*dpr)){ c.width=c.height=Math.round(css*dpr); }
    const ctx=shown?c.getContext('2d'):offCtx; ctx.setTransform(dpr,0,0,dpr,0,0); const Sz=css, cx=Sz/2, cy=Sz/2;
    const res=result(); const word=$('#skyWord'), sub=$('#skySub'), note=$('#skyNote');
    word.textContent=res.word; word.className=res.cls; sub.textContent=res.sub;
    if(S.lesson==='lunar'){
      ctx.fillStyle='#06081a'; ctx.fillRect(0,0,Sz,Sz); skyStars.forEach(st=>{ ctx.fillStyle=`rgba(255,255,255,${0.35+0.6*st[2]})`; ctx.fillRect(st[0]*Sz,st[1]*Sz,1.3,1.3); });
      const rM=Sz*0.2; const d=Math.abs(S.align)*0.06; const dir=Math.sign(S.align)||1;
      const mg0=ctx.createRadialGradient(cx-rM*0.3,cy-rM*0.3,rM*0.1,cx,cy,rM); mg0.addColorStop(0,'#f6f7fb'); mg0.addColorStop(0.7,'#cfd4e3'); mg0.addColorStop(1,'#8d95a8'); ctx.fillStyle=mg0; ctx.beginPath(); ctx.arc(cx,cy,rM,0,7); ctx.fill();
      // the Earth's shadow: a faint disc and a dark disc, sliding past the Moon
      const sy=cy+dir*d*rM;
      ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,rM,0,7); ctx.clip();
      ctx.fillStyle='rgba(20,22,50,.35)'; ctx.beginPath(); ctx.arc(cx,sy,rM*4.6,0,7); ctx.fill();
      ctx.fillStyle='rgba(226,104,63,.82)'; ctx.beginPath(); ctx.arc(cx,sy,rM*2.6,0,7); ctx.fill();
      ctx.fillStyle='rgba(20,10,10,.45)'; ctx.beginPath(); ctx.arc(cx,sy,rM*2.6,0,7); ctx.fill();
      ctx.restore();
      note.textContent = res.key==='lunar' ? 'Safe to watch with bare eyes — go outside and look up.' : res.key==='none' ? 'Slide the Moon back towards the middle of the shadow.' : 'Part of the Moon is in the dark shadow.';
      return;
    }
    const cov=res.cov||0; const f=Math.pow((1-cov)*(1-0.5*cov*cov),0.45);
    const sky=[lerp(10,110,f),lerp(13,170,f),lerp(36,255,f)]; ctx.fillStyle=`rgb(${sky.map(Math.round)})`; ctx.fillRect(0,0,Sz,Sz);
    if(f<0.4){ const a=(0.4-f)/0.4; skyStars.forEach(st=>{ ctx.fillStyle=`rgba(255,255,255,${a*(0.4+0.6*st[2])})`; ctx.fillRect(st[0]*Sz,st[1]*Sz,1.3,1.3); }); }
    const rS=Sz*0.19, m=ratio(), rM=rS*m; const d=Math.abs(S.align)*0.021*rS*(S.lesson==='overview'?0:1); const my=cy-Math.sign(S.align||1)*d;
    if(cov<0.999){ const gl=ctx.createRadialGradient(cx,cy,rS*0.8,cx,cy,rS*2.6); gl.addColorStop(0,`rgba(255,245,215,${0.6*(1-cov)})`); gl.addColorStop(1,'rgba(255,245,215,0)'); ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(cx,cy,rS*2.6,0,7); ctx.fill(); }
    if(res.key==='total'){ const cg=ctx.createRadialGradient(cx,cy,rS*0.95,cx,cy,rS*2.4); cg.addColorStop(0,'rgba(255,255,255,.95)'); cg.addColorStop(0.25,'rgba(240,244,255,.5)'); cg.addColorStop(1,'rgba(220,230,255,0)'); ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(cx,cy,rS*2.4,0,7); ctx.fill(); }
    const sg=ctx.createRadialGradient(cx-rS*0.3,cy-rS*0.3,rS*0.1,cx,cy,rS); sg.addColorStop(0,'#fff8e6'); sg.addColorStop(0.7,'#ffc857'); sg.addColorStop(1,'#f0a030'); ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(cx,cy,rS,0,7); ctx.fill();
    if(S.lesson!=='overview'){ const mg=ctx.createRadialGradient(cx-rM*0.3,my-rM*0.3,rM*0.1,cx,my,rM); mg.addColorStop(0,'#2a3040'); mg.addColorStop(1,'#0b0e1c'); ctx.fillStyle=mg; ctx.beginPath(); ctx.arc(cx,my,rM,0,7); ctx.fill(); }
    // horizon
    ctx.fillStyle=`rgba(${Math.round(lerp(8,30,f))},${Math.round(lerp(10,50,f))},${Math.round(lerp(20,35,f))},1)`; ctx.beginPath(); ctx.arc(cx,Sz*1.55,Sz*0.72,0,7); ctx.fill();
    note.textContent = res.key==='total' ? 'Safe to look with bare eyes only during these few minutes of totality.' : res.key==='none' ? 'Drag the Moon back in front of the Sun.' : S.lesson==='overview' ? 'Pick an eclipse to see the Sun and Moon line up.' : 'Eclipse glasses on — never look at the Sun without them.';
  }

  /* ---------- the panel ---------- */
  function updatePanel(){
    const L=LESSONS[S.lesson]; const res=result();
    $('#headSimple').textContent = L.head; $('#simpleTitle').textContent=L.title; $('#simpleKid').textContent=L.kid; $('#simpleIdeaText').textContent=L.idea; $('#simpleSwatch').style.background=L.sw;
    $$('#simpleLessons button').forEach(b=>b.classList.toggle('on', b.dataset.lesson===S.lesson));
    const ov=S.lesson==='overview', lun=S.lesson==='lunar';
    $('#simpleTry').hidden=ov; $('#simpleDistBox').hidden=lun; $('#simpleShadow').hidden = S.lesson!=='total' || S.view==='earth';
    $('#simpleTrackBox').hidden = !(S.lesson==='total' && S.view==='earth');
    $('#sSAlign').value=S.align; $('#sSDist').value=S.dist;
    const a=Math.abs(S.align); $('#oSAlign').innerHTML = `<b>${a<8?'Centred':a<39?'Nearly':a<78?'Off to one side':'Missed'}</b>`;
    $('#oSDist').innerHTML = `<b>${S.dist<35?'Close':S.dist<68?'Middling':'Far'}</b> · Moon looks ${Math.round(ratio()*100)}% the size of the Sun`;
    $$('#simpleViews .chip').forEach(b=>{ b.classList.toggle('on', b.dataset.sview===S.view); if(b.dataset.sview==='earth') b.hidden = S.lesson!=='total'; });
    $('#simpleStep').textContent=`Lesson ${L.n} of 5`; $('#simplePrev').disabled = L.n===1; $('#simpleNext').disabled = L.n===5;
    $('#simplePause').textContent = S.paused ? '▶ Play' : '⏸ Pause'; $('#simplePause').classList.toggle('on', !S.paused);
    $('#simpleTrackPlay').textContent = S.trackPlaying ? '⏸ Pause' : '▶ Play'; $('#sSTrack').value=Math.round(S.track*100);
    $('#oSTrack').innerHTML=`<b>${S.track<0.14?'Arriving':S.track<0.4?'Totality begins':S.track<0.62?'Mid-eclipse':S.track<0.87?'Moving east':'Leaving'}</b>`;
    $('#hint').textContent = S.view==='earth' ? 'Drag to spin the Earth · Scroll to zoom · Play or slide the shadow along its path' : ov ? 'Drag to spin round · Scroll or pinch to zoom' : 'Drag the Moon up and down · Drag empty space to spin round · Scroll to zoom';
    S.skyDirty=true;
  }
  function cameraFor(v){
    if(v==='earth') return {yaw:0,pitch:0.1,zoom:1};
    if(v==='top') return {yaw:0,pitch:1.48,zoom:S.lesson==='overview'?1:1.04};
    if(v==='lineup') return {yaw:0,pitch:0.04,zoom:S.lesson==='overview'?1:1.08};
    return {yaw:S.lesson==='overview'?-0.62:-0.27, pitch:S.lesson==='overview'?0.48:0.28, zoom:S.lesson==='overview'?1:1.04};
  }
  function setView(v){ if(v==='earth'&&S.lesson!=='total') return; S.view=v; Object.assign(S,cameraFor(v)); updatePanel(); }
  function setLesson(name){
    if(!LESSONS[name]) return; const L=LESSONS[name]; S.lesson=name; S.align=L.align; S.dist=L.dist; S.track=0.08; S.trackPlaying=true; S.time=0; S.touched=false;
    S.view = name==='overview' ? 'perspective' : 'lineup'; Object.assign(S,cameraFor(S.view)); updatePanel();
  }

  /* ---------- pointer: drag the Moon, spin the picture, zoom ---------- */
  cv.addEventListener('pointerdown',e=>{
    const r=cv.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top;
    const dm = S.moonScr ? Math.hypot(x-S.moonScr.x, y-S.moonScr.y) : Infinity;
    const act = S.view==='earth' ? 'globe' : (S.lesson!=='overview' && dm < Math.max(30, S.moonScr.r+16)) ? 'moon' : 'camera';
    S.drag={id:e.pointerId, act, x:e.clientX, y:e.clientY, yaw:S.yaw, pitch:S.pitch, align:S.align}; cv.setPointerCapture(e.pointerId); cv.classList.add('grabbing');
  });
  cv.addEventListener('pointermove',e=>{
    if(!S.drag||S.drag.id!==e.pointerId) return; const dx=e.clientX-S.drag.x, dy=e.clientY-S.drag.y;
    if(S.drag.act==='moon'){ S.align=clamp(Math.round(S.drag.align-dy*1.35),-100,100); S.touched=true; updatePanel(); }
    else if(S.drag.act==='globe'){ S.yaw=S.drag.yaw+dx*0.007; }
    else { S.yaw=S.drag.yaw+dx*0.007; S.pitch=clamp(S.drag.pitch+dy*0.007,-1.35,1.52); if(Math.abs(dx)+Math.abs(dy)>3){ S.view='custom'; $$('#simpleViews .chip').forEach(b=>b.classList.remove('on')); } }
  });
  const release=e=>{ if(S.drag&&S.drag.id===e.pointerId){ S.drag=null; cv.classList.remove('grabbing'); } };
  cv.addEventListener('pointerup',release); cv.addEventListener('pointercancel',release);
  cv.addEventListener('wheel',e=>{ e.preventDefault(); S.zoom=clamp(S.zoom*Math.exp(-e.deltaY*0.0011),0.58,2.25); },{passive:false});
  // pinch on phones
  let pinch=null; cv.addEventListener('touchstart',e=>{ if(e.touches.length===2) pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); },{passive:true});
  cv.addEventListener('touchmove',e=>{ if(e.touches.length===2&&pinch){ const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); S.zoom=clamp(S.zoom*d/pinch,0.58,2.25); pinch=d; } },{passive:true});
  cv.addEventListener('touchend',()=>{ pinch=null; });

  /* ---------- panel wiring ---------- */
  $('#simpleLessons').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setLesson(b.dataset.lesson); });
  $('#simpleViews').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setView(b.dataset.sview); });
  $('#sSAlign').addEventListener('input',e=>{ S.align=+e.target.value; S.touched=true; updatePanel(); });
  $('#sSDist').addEventListener('input',e=>{ S.dist=+e.target.value; updatePanel(); });
  $('#simpleReset').addEventListener('click',()=>{ const L=LESSONS[S.lesson]; S.align=L.align; S.dist=L.dist; updatePanel(); });
  $('#simpleShadow').addEventListener('click',()=>setView('earth'));
  $('#sSTrack').addEventListener('input',e=>{ S.track=+e.target.value/100; S.trackPlaying=false; updatePanel(); });
  $('#simpleTrackPlay').addEventListener('click',()=>{ S.trackPlaying=!S.trackPlaying; updatePanel(); });
  $('#simplePause').addEventListener('click',()=>{ S.paused=!S.paused; updatePanel(); });
  $('#tSimpleNames').addEventListener('change',e=>{ S.names=e.target.checked; });
  $('#simplePrev').addEventListener('click',()=>{ const i=ORDER.indexOf(S.lesson); if(i>0) setLesson(ORDER[i-1]); });
  $('#simpleNext').addEventListener('click',()=>{ const i=ORDER.indexOf(S.lesson); if(i<4) setLesson(ORDER[i+1]); });
  $('#sSimpleSpeed').addEventListener('input',e=>{ S.speed=+e.target.value; $('#oSimpleSpeed').innerHTML=S.speed===0?'<b>Stopped</b>':`<b>${(S.speed/0.65).toFixed(1).replace('.0','')}×</b>`; });

  /* ---------- per-frame ---------- */
  function resize(){ const dpr=Math.min(2,window.devicePixelRatio||1); S.W=window.innerWidth; S.H=window.innerHeight; S.dpr=dpr; cv.width=Math.round(S.W*dpr); cv.height=Math.round(S.H*dpr); g.setTransform(dpr,0,0,dpr,0,0); }
  function frame(dt){
    if(!S.paused){ S.time+=dt*S.speed; if(S.lesson==='total'&&S.view==='earth'&&S.trackPlaying){ S.track=(S.track+dt*0.055)%1; $('#sSTrack').value=Math.round(S.track*100); } }
    if(cv.width!==Math.round(S.W*S.dpr)||S.W!==window.innerWidth||S.H!==window.innerHeight) resize();
    computeViewRect();
    background();
    if(S.lesson==='total'&&S.view==='earth') drawCloseup(); else if(S.lesson==='overview') drawOverview(); else drawLineup();
    if(S.skyDirty){ drawPorthole(); S.skyDirty=false; }
  }
  function enter(){ resize(); updatePanel(); S.skyDirty=true; }
  return {enter, frame, resize, setLesson, S, result, ratio};
})();
