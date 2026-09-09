// Production-page regressions. Run after `python3 src/build.py` with a local
// server, then `node tests/system-view.browser.cjs [site URL]`.
// Uses an existing Playwright install (PLAYWRIGHT_MODULE may name its path).
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');

function getPlaywright(){
  const candidates=[process.env.PLAYWRIGHT_MODULE,'playwright',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
  for(const candidate of candidates){try{return require(candidate);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}
  throw new Error('An existing Playwright installation is required; set PLAYWRIGHT_MODULE to its path.');
}
function close(actual,expected,message,tolerance=1e-8){assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${message}: ${actual} versus ${expected}`);}
async function settled(page){await twoFrames(page);await page.waitForFunction(()=>{const E=window.__eclipseLab;return E&&!E.systemView.phase&&!E.controls.tw&&E.sys.t===E.sys.tTarget;},{},{timeout:20000});}
async function twoFrames(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function camera(page){return page.evaluate(()=>{const c=window.__eclipseLab.controls;return {target:c.target.toArray(),radius:c.radius,theta:c.theta,phi:c.phi,fov:c.fov};});}
function cameraEqual(actual,expected){for(const key of ['radius','theta','phi','fov'])close(actual[key],expected[key],key);actual.target.forEach((x,i)=>close(x,expected.target[i],'target '+i));}
async function bodyFraming(page,name){
  return page.evaluate(name=>{
    const E=window.__eclipseLab,b=E.sys.bodies.find(b=>b.def.n===name),mesh=b?b.mesh:E.sys.sun;
    // Rendered world matrices include the temporary floating-origin shift;
    // the camera is restored to physical coordinates after every frame.
    const p=mesh.getWorldPosition(new E.THREE.Vector3()).sub(E.sys.scene.position).project(E.sys.cam);
    return {x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight,z:p.z,view:E.viewRect,
      radiusRatio:E.controls.radius/(b?b.r:E.sys.sunR),focus:E.sys.focus==='sun'?'Sun':E.sys.focus&&E.sys.focus.def.n};
  },name);
}
function inWorkspace(frame,name){
  assert.ok(frame.x>frame.view.x0&&frame.x<frame.view.x1,`${name} is horizontally inside the workspace: ${JSON.stringify(frame)}`);
  assert.ok(frame.y>frame.view.y0&&frame.y<frame.view.y1,`${name} is vertically inside the workspace: ${JSON.stringify(frame)}`);
  assert.ok(frame.z>-1&&frame.z<1,`${name} is inside the camera's visible depth`);
}

async function run(browser,baseURL='http://127.0.0.1:4176/eclipse-lab-site/'){
  const results=[];
  async function check(name,fn,motion='reduce',viewport={width:1440,height:1000}){
    const context=await browser.newContext({viewport,reducedMotion:motion});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    try{
      await page.goto(baseURL);await page.waitForFunction(()=>Boolean(window.__eclipseLab&&window.__eclipseLab.systemView));
      await page.evaluate(()=>{window.__eclipseLab.state.sysPlaying=false;});await settled(page);
      await fn(page);assert.deepEqual(errors,[],'No uncaught page errors');
      results.push({name,passed:true});console.log('PASS '+name);
    }catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL '+name+'\n'+error.stack);}
    finally{await context.close();}
  }

  await check('production true scale uses one physical radius for Sun, every planet and moon',async page=>{
    await page.locator('[data-scale="true"]').click();await settled(page);
    const values=await page.evaluate(()=>{const E=window.__eclipseLab;return {sun:E.sys.sunR,bodies:E.sys.bodies.map(b=>({name:b.def.n,r:b.r,km:b.def.R,mesh:b.mesh.scale.x,moons:b.moons.map(m=>({name:m.def.n,r:m.r,km:m.def.R,mesh:m.mesh.scale.x}))}))};});
    close(values.sun,.6957,'Sun');
    for(const body of values.bodies){close(body.r,body.km/1e6,body.name);close(body.mesh,body.r,body.name+' mesh');for(const moon of body.moons){close(moon.r,moon.km/1e6,moon.name);close(moon.mesh,moon.r,moon.name+' mesh');}}
    close(values.sun/values.bodies.find(b=>b.name==='Earth').r,695700/6371,'Sun/Earth ratio');
  });

  await check('proportional orbital mode preserves common body sizes and compressed positions',async page=>{
    const before=await page.evaluate(()=>window.__eclipseLab.sys.bodies.map(b=>b.group.position.length()));
    await page.locator('[data-sizes="proportional"]').click();await twoFrames(page);
    const values=await page.evaluate(()=>{const E=window.__eclipseLab;return {scale:E.state.scale,sun:E.sys.sunR,bodies:E.sys.bodies.map(b=>({name:b.def.n,position:b.group.position.length(),r:b.r,km:b.def.R,moons:b.moons.map(m=>({name:m.def.n,r:m.r,km:m.def.R}))}))};});
    assert.equal(values.scale,'condensed');close(values.sun,6.5,'Sun');
    values.bodies.forEach((b,i)=>{close(b.position,before[i],b.name+' orbit');close(b.r/values.sun,b.km/695700,b.name+' ratio');b.moons.forEach(m=>close(m.r/values.sun,m.km/695700,m.name+' ratio'));});
  });

  await check('line-up freezes date, sorts by radius, and restores orbital camera and playback',async page=>{
    await page.evaluate(()=>{const E=window.__eclipseLab;E.sys.focus=null;E.controls.follow=null;E.controls.target.set(2,3,-4);E.controls.radius=117;E.controls.theta=.23;E.controls.phi=1.21;E.state.sysPlaying=true;});
    const before=await camera(page);await page.locator('[data-layout="lineup"]').click();
    const paused=await page.evaluate(()=>({playing:window.__eclipseLab.state.sysPlaying,days:window.__eclipseLab.state.sysDays}));
    assert.equal(paused.playing,false);await page.waitForTimeout(150);
    close(await page.evaluate(()=>window.__eclipseLab.state.sysDays),paused.days,'Paused date');
    await page.locator('[data-order="size"]').click();
    assert.deepEqual(await page.evaluate(()=>window.__eclipseLab.systemView.comparison.layout.items.map(b=>b.name)),['Sun','Pluto','Mercury','Mars','Venus','Earth','Neptune','Uranus','Saturn','Jupiter']);
    assert.equal(await page.evaluate(()=>window.__eclipseLab.systemView.comparison.cam.isOrthographicCamera),true);
    await page.locator('[data-layout="orbits"]').click();await twoFrames(page);
    cameraEqual(await camera(page),before);
    assert.deepEqual(await page.evaluate(()=>({sizes:window.__eclipseLab.state.sysSizes,playing:window.__eclipseLab.state.sysPlaying,layout:window.__eclipseLab.state.sysLayout})),{sizes:'enlarged',playing:true,layout:'orbits'});
  });

  await check('galaxy shortcut and home restore a custom proportional orbital view',async page=>{
    await page.locator('[data-sizes="proportional"]').click();
    await page.evaluate(()=>{const E=window.__eclipseLab;E.sys.focus=null;E.controls.target.set(2,3,-4);E.controls.radius=117;E.controls.theta=.23;E.controls.phi=1.21;});
    const before=await camera(page);await page.locator('#viewGalaxy').click();await settled(page);
    const far=await page.evaluate(()=>{const E=window.__eclipseLab;return {scale:E.state.scale,radius:E.controls.radius,ly:window.SystemScale.MKM_PER_LY,target:E.controls.target.toArray()};});
    assert.equal(far.scale,'true');assert.ok(far.radius>100000*far.ly);
    await page.locator('#returnSystem').click();await settled(page);cameraEqual(await camera(page),before);
    assert.equal(await page.evaluate(()=>window.__eclipseLab.state.sysSizes),'proportional');
    assert.equal(await page.evaluate(()=>window.__eclipseLab.state.scale),'condensed');
  });

  await check('manual zoom from squashed orbits enters true scale and returns near the Sun',async page=>{
    await page.evaluate(()=>{const E=window.__eclipseLab;E.controls.zoomBy(5);});await settled(page);
    assert.equal(await page.evaluate(()=>window.__eclipseLab.state.scale),'true');
    await page.evaluate(()=>{window.__eclipseLab.controls.zoomBy(2);});await twoFrames(page);
    await page.evaluate(()=>{const E=window.__eclipseLab;E.controls.target.set(0,0,0);E.controls.zoomBy(.1);});await settled(page);
    assert.equal(await page.evaluate(()=>window.__eclipseLab.state.scale),'condensed');
  });

  await check('zooming into the distant galactic centre does not teleport to the solar system',async page=>{
    await page.locator('#viewGalaxy').click();await settled(page);
    await page.evaluate(()=>{const E=window.__eclipseLab;E.controls.target.copy(E.systemView.galaxy.centre);E.controls.zoomBy(12000/E.controls.radius);});await twoFrames(page);await settled(page);
    const view=await page.evaluate(()=>{const E=window.__eclipseLab;return {scale:E.state.scale,distance:E.sys.cam.position.length()/window.SystemScale.MKM_PER_LY};});
    assert.equal(view.scale,'true','A small orbit around the galactic centre is still 26,000 ly from the Sun');
    assert.ok(view.distance>25000,'Camera stays at the inspected galactic location');
  });

  await check('tab switching preserves the galaxy camera and leaves eclipse controls usable',async page=>{
    await page.locator('#viewGalaxy').click();await settled(page);const before=await camera(page);
    await page.locator('.tabs [data-view="lab"]').click();await page.waitForFunction(()=>window.__eclipseLab.state.view==='lab');
    assert.equal(await page.evaluate(()=>window.__eclipseLab.controls.lockOrbit),false);
    await page.locator('.tabs [data-view="system"]').click();await page.waitForFunction(()=>window.__eclipseLab.state.view==='system');await twoFrames(page);
    cameraEqual(await camera(page),before);
  });

  await check('normal-motion transitions settle and return without losing the original camera',async page=>{
    const before=await camera(page);await page.locator('#viewGalaxy').click();await settled(page);
    assert.ok(await page.evaluate(()=>window.__eclipseLab.controls.radius>100000*window.SystemScale.MKM_PER_LY));
    await page.locator('#returnSystem').click();await settled(page);cameraEqual(await camera(page),before);
  },'no-preference');

  await check('first True scale click automatically frames Earth above the mobile panel',async page=>{
    await page.locator('[data-scale="true"]').click();await settled(page);
    const frame=await bodyFraming(page,'Earth');
    assert.equal(frame.focus,'Earth');
    assert.ok(frame.radiusRatio<50,`First-click Earth zoom is close enough: camera/body radius = ${frame.radiusRatio}`);
    inWorkspace(frame,'Earth');
  },'no-preference',{width:390,height:844});

  await check('Sun focus remains framed after a mobile true-to-squashed round trip',async page=>{
    await page.locator('[data-scale="true"]').click();await settled(page);
    await page.locator('#planetButtons [data-planet="Sun"]').click();await settled(page);
    const trueSun=await bodyFraming(page,'Sun');assert.equal(trueSun.focus,'Sun');inWorkspace(trueSun,'True-scale Sun');
    assert.ok(trueSun.radiusRatio<100,'The true-scale Sun remains large enough to inspect');
    await page.locator('[data-scale="condensed"]').click();await settled(page);
    const condensedSun=await bodyFraming(page,'Sun');assert.equal(condensedSun.focus,'Sun');inWorkspace(condensedSun,'Squashed Sun');
    assert.ok(condensedSun.radiusRatio<100,'The squashed Sun remains framed after the radius transition');
  },'no-preference',{width:390,height:844});
  return results;
}

module.exports={run};
if(require.main===module){
  (async()=>{
    const {chromium}=getPlaywright();
    const options={headless:true,args:['--enable-unsafe-swiftshader']};
    if(process.env.CHROME_EXECUTABLE)options.executablePath=process.env.CHROME_EXECUTABLE;
    else if(process.platform==='darwin')options.executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const browser=await chromium.launch(options);
    try{const results=await run(browser,process.argv[2]);console.log(`${results.filter(r=>r.passed).length}/${results.length} browser checks passed`);if(results.some(r=>!r.passed))process.exitCode=1;}
    finally{await browser.close();}
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
