/* Physical dimensions and presentation math shared by the solar-system views.
 * Solar radius: IAU 2015 Resolution B3 (nominal photospheric radius).
 * AU: IAU 2012 Resolution B2, https://ssd.jpl.nasa.gov/glossary/au.html
 * Light-year: c × one Julian year (365.25 days).
 * Galaxy estimates: https://imagine.gsfc.nasa.gov/science/featured_science/milkyway/
 * Galactic rotation: conventional J2000 matrix (Liu et al. 2010, eq. 6),
 * https://arxiv.org/html/1010.3773v1 ; equivalent to the SOFA galactic convention.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.SystemScale=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SUN_RADIUS_KM=695700, AU_KM=149597870.7, LY_KM=9460730472580.8;
  const MKM_PER_LY=LY_KM/1e6, GALAXY_RADIUS_LY=50000, SUN_GALACTIC_DISTANCE_LY=26000;
  const OBLIQUITY=23.4392911*Math.PI/180;
  // Equatorial J2000 -> galactic. Its transpose gives the inverse rotation.
  const EQJ_TO_GALACTIC=[
    [-0.0548755604162154,-0.8734370902348850,-0.4838350155487132],
    [ 0.4941094278755837,-0.4448296299600112, 0.7469822444972189],
    [-0.8676661490190047,-0.1980763734312015, 0.4559837761750669]
  ];

  function positive(value,name){
    if(!Number.isFinite(value)||value<=0) throw new RangeError(name+' must be positive and finite');
    return value;
  }

  // True-mode radii are in million km. Condensed proportional bodies share
  // one magnification; changing orbit spacing never changes their size ratios.
  function bodyRadius(radiusKm,options={}){
    positive(radiusKm,'radiusKm');
    const {mode='true',proportional=false,sunDisplayRadius=6.5,enlargedRadius}=options;
    if(mode==='true') return radiusKm/1e6;
    if(mode!=='condensed') throw new RangeError('Unknown size mode');
    if(!proportional&&enlargedRadius!==undefined) return positive(enlargedRadius,'enlargedRadius');
    return radiusKm/SUN_RADIUS_KM*positive(sunDisplayRadius,'sunDisplayRadius');
  }

  // A centred horizontal arrangement. Extent includes rings, even when their
  // current orientation makes them look narrower. Inputs are never reordered.
  function lineup(bodies,order='planet',sunDisplayRadius=6.5){
    positive(sunDisplayRadius,'sunDisplayRadius');
    if(order!=='planet'&&order!=='size') throw new RangeError('Unknown line-up order');
    const sorted=bodies.map((body,index)=>({...body,index}));
    sorted.sort((a,b)=>{
      if(a.name==='Sun') return b.name==='Sun'?a.index-b.index:-1;
      if(b.name==='Sun') return 1;
      return order==='size'?a.radiusKm-b.radiusKm||a.index-b.index:a.index-b.index;
    });
    const gap=sunDisplayRadius*.12;
    let cursor=0;
    const items=sorted.map(body=>{
      const radius=bodyRadius(body.radiusKm,{mode:'condensed',proportional:true,sunDisplayRadius});
      const extent=radius*Math.max(1,body.ringOuterRatio||1);
      const item={name:body.name,radius,x:cursor+extent,extent};
      cursor+=extent*2+gap;
      return item;
    });
    const width=items.length?cursor-gap:0;
    items.forEach(item=>{item.x-=width/2;});
    return {items,width};
  }

  // Scale on the plane through the orbit-camera target, perpendicular to its
  // view direction. Supplying physical camera distance keeps the bar truthful
  // even when the renderer rebases or rescales its internal coordinate units.
  function scaleBar(distanceMkm,fovRadians,viewportHeightPx,preferredPx=120){
    positive(distanceMkm,'distanceMkm'); positive(viewportHeightPx,'viewportHeightPx'); positive(preferredPx,'preferredPx');
    if(!(fovRadians>0&&fovRadians<Math.PI)) throw new RangeError('fovRadians must be between 0 and PI');
    const perPixel=2*distanceMkm*Math.tan(fovRadians/2)/viewportHeightPx;
    const target=perPixel*preferredPx;
    const unit=target>=MKM_PER_LY?{size:MKM_PER_LY,label:'ly'}:
      target>=AU_KM/1e6*.1?{size:AU_KM/1e6,label:'AU'}:{size:1e-6,label:'km'};
    const targetUnits=target/unit.size;
    const power=10**Math.floor(Math.log10(targetUnits));
    const leading=targetUnits/power;
    const nice=(leading>=5?5:leading>=2?2:1)*power;
    const lengthMkm=nice*unit.size;
    const number=Number(nice.toPrecision(12));
    return {
      pixels:lengthMkm/perPixel,
      label:number.toLocaleString('en-GB',{maximumFractionDigits:12})+' '+unit.label,
      lengthMkm
    };
  }

  // Pure rotation: [X toward the galactic centre, Y toward l=90°, Z north]
  // -> existing scene [ecliptic X, ecliptic north, -ecliptic Y]. Units and
  // origin are preserved. A galaxy-centred model places the Sun at
  // [-SUN_GALACTIC_DISTANCE_LY,0,0]; subtract that before this rotation to
  // obtain heliocentric positions. Directions need no translation.
  function galacticToScene(vector){
    const [gx,gy,gz]=vector;
    const x=EQJ_TO_GALACTIC[0][0]*gx+EQJ_TO_GALACTIC[1][0]*gy+EQJ_TO_GALACTIC[2][0]*gz;
    const y=EQJ_TO_GALACTIC[0][1]*gx+EQJ_TO_GALACTIC[1][1]*gy+EQJ_TO_GALACTIC[2][1]*gz;
    const z=EQJ_TO_GALACTIC[0][2]*gx+EQJ_TO_GALACTIC[1][2]*gy+EQJ_TO_GALACTIC[2][2]*gz;
    const c=Math.cos(OBLIQUITY),s=Math.sin(OBLIQUITY);
    return [x,-y*s+z*c,-y*c-z*s];
  }

  return Object.freeze({SUN_RADIUS_KM,AU_KM,LY_KM,MKM_PER_LY,GALAXY_RADIUS_LY,SUN_GALACTIC_DISTANCE_LY,
    bodyRadius,lineup,scaleBar,galacticToScene});
});
