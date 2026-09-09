/* An illustrative Milky Way, in light-years. Particles describe star clouds,
   not a catalogue of individual stars. The local solar scene stays in million km. */
(function (root) {
  'use strict';
  root.createGalaxyView = function createGalaxyView(THREE, SystemScale) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 300000);
    const LY = SystemScale.MKM_PER_LY;
    const solarRadius = SystemScale.SUN_GALACTIC_DISTANCE_LY;
    const outerRadius = SystemScale.GALAXY_RADIUS_LY;
    const transform = xyz => new THREE.Vector3(...SystemScale.galacticToScene(xyz));
    const centreLY = transform([solarRadius, 0, 0]);
    const centre = centreLY.clone().multiplyScalar(LY);
    const normal = transform([0, 0, 1]).normalize();
    const materials = [], geometries = [], textures = [];
    const softMaterials = [];
    let seed = 0x4d574159;
    function random() {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function gaussian() { return Math.sqrt(-2 * Math.log(Math.max(1e-9, random()))) * Math.cos(2 * Math.PI * random()); }
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const barAngle = 25 * Math.PI / 180;
    const pitch = Math.tan(16 * Math.PI / 180);
    function armAngle(radius, arm) {
      const winding = Math.log(Math.max(radius, 8500) / 11000);
      return barAngle + arm * Math.PI / 2 + winding / pitch + Math.sin(winding * 5 + arm * 1.7) * 0.115;
    }
    function armStrength(radius, arm) {
      const knots = 0.72 + 0.2 * Math.sin(radius / 2800 + arm * 2.3) + 0.12 * Math.sin(radius / 1100 + arm);
      const secondary = arm % 2 ? 0.32 * Math.exp(-Math.pow((radius - 25500) / 14500, 4)) : 1;
      return knots * secondary;
    }
    // An indicative local arm segment, anchored to the Sun rather than an invented
    // precise map: centred galactic (-26,000, 0, 0) is the solar-system location.
    function spurAngle(radius) { return Math.PI + Math.log(Math.max(radius, 1) / solarRadius) / Math.tan(18 * Math.PI / 180); }
    function spurStrength(radius) { return Math.exp(-Math.pow((radius - solarRadius) / 4200, 4)); }

    // A faint continuous disc avoids presenting a sparse particle sample as the galaxy.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 768;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const gx = (x / (canvas.width - 1) * 2 - 1) * outerRadius;
        const gy = (1 - y / (canvas.height - 1) * 2) * outerRadius;
        const radius = Math.hypot(gx, gy), theta = Math.atan2(gy, gx);
        const edge = 1 - Math.pow(clamp(radius / outerRadius, 0, 1), 5);
        const radial = Math.exp(-radius / 18500) * edge;
        let arms = 0, dust = 0;
        for (let a = 0; a < 4; a++) {
          const delta = Math.atan2(Math.sin(theta - armAngle(radius, a)), Math.cos(theta - armAngle(radius, a)));
          const width = 0.1 + 950 / Math.max(radius, 4000);
          const knots = armStrength(radius, a);
          arms += Math.exp(-0.5 * Math.pow(delta / width, 2)) * knots;
          dust += Math.exp(-0.5 * Math.pow((delta + 0.1) / (width * 0.3), 2)) * knots;
        }
        const spurDelta = Math.atan2(Math.sin(theta - spurAngle(radius)), Math.cos(theta - spurAngle(radius)));
        arms += Math.exp(-0.5 * Math.pow(spurDelta / 0.06, 2)) * spurStrength(radius) * 0.45;
        const bx = gx * Math.cos(barAngle) + gy * Math.sin(barAngle);
        const by = -gx * Math.sin(barAngle) + gy * Math.cos(barAngle);
        const bar = Math.exp(-Math.pow(bx / 11500, 4) - Math.pow(by / 2200, 2));
        const core = Math.exp(-0.5 * Math.pow(radius / 2400, 2));
        const armFade = clamp((radius - 7500) / 6500, 0, 1);
        const cloudiness = 0.82 + 0.13 * Math.sin(gx * 0.0008 + gy * 0.00049) + 0.12 * Math.sin(gx * 0.0014 - gy * 0.0011);
        const grain = (0.82 + random() * 0.36) * cloudiness;
        const alpha = clamp((radial * (0.28 + arms * armFade * 1.55) * (1 - 0.72 * dust * armFade) + bar * 0.35 + core * 0.58) * grain, 0, 0.9);
        const warmth = clamp(core + bar * 0.6 + Math.exp(-radius / 9000) * 0.3, 0, 1);
        const i = (y * canvas.width + x) * 4;
        pixels.data[i] = 180 + warmth * 73;
        pixels.data[i + 1] = 175 + warmth * 52;
        pixels.data[i + 2] = 181 + warmth * 19;
        pixels.data[i + 3] = Math.round(alpha * 230);
      }
    }
    context.putImageData(pixels, 0, 0);
    const discTexture = new THREE.CanvasTexture(canvas); textures.push(discTexture);
    const discGeometry = new THREE.PlaneGeometry(outerRadius * 2, outerRadius * 2); geometries.push(discGeometry);
    const discMaterial = new THREE.MeshBasicMaterial({ map: discTexture, transparent: true, opacity: 1,
      side: THREE.DoubleSide, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    materials.push(discMaterial); softMaterials.push({ material: discMaterial, opacity: 0.8 });
    const disc = new THREE.Mesh(discGeometry, discMaterial);
    const basis = new THREE.Matrix4().makeBasis(transform([1, 0, 0]), transform([0, 1, 0]), normal);
    disc.quaternion.setFromRotationMatrix(basis); disc.position.copy(centreLY); disc.renderOrder = -3;
    scene.add(disc);

    // Soft cloud particles give the thin disc, central bar and bulge actual depth.
    const positions = [], colors = [], sizes = [], strengths = [];
    function cloud(x, y, z, size, strength, warmth) {
      // No invented nearby star catalogue around the real solar-system position.
      if (Math.hypot(x + solarRadius, y, z) < 150) return;
      const p = transform([x + solarRadius, y, z]);
      positions.push(p.x, p.y, p.z);
      colors.push(0.69 + warmth * 0.29, 0.7 + warmth * 0.17, 0.8 - warmth * 0.12);
      sizes.push(size); strengths.push(strength);
    }
    for (let i = 0; i < 23500; i++) {
      const radius = 9000 + Math.pow(random(), 0.75) * (outerRadius - 9000);
      const a = i % 4;
      const angle = armAngle(radius, a) + gaussian() * (0.07 + 1200 / radius);
      const density = Math.exp(-radius / 57000) * armStrength(radius, a);
      const z = gaussian() * (190 + radius * 0.008);
      cloud(Math.cos(angle) * radius, Math.sin(angle) * radius, z,
        45 + Math.pow(random(), 3) * 260, (0.24 + random() * 0.45) * density, random() * 0.44);
    }
    for (let i = 0; i < 7000; i++) {
      const radius = Math.pow(random(), 0.6) * outerRadius;
      const angle = random() * Math.PI * 2;
      cloud(Math.cos(angle) * radius, Math.sin(angle) * radius, gaussian() * (230 + radius * 0.012),
        65 + random() * 170, (0.11 + random() * 0.17) * Math.exp(-radius / 55000), 0.4 + random() * 0.4);
    }
    for (let i = 0; i < 3000; i++) {
      const radius = solarRadius + gaussian() * 2300;
      const angle = spurAngle(radius) + gaussian() * 0.045;
      cloud(Math.cos(angle) * radius, Math.sin(angle) * radius, gaussian() * 270,
        45 + random() * 160, (0.065 + random() * 0.1) * spurStrength(radius), 0.15 + random() * 0.35);
    }
    for (let i = 0; i < 9000; i++) {
      const isBar = i < 5500;
      const bx = gaussian() * (isBar ? 5600 : 2300);
      const by = gaussian() * (isBar ? 1100 : 2100);
      const z = gaussian() * (isBar ? 700 : 1700);
      cloud(bx * Math.cos(barAngle) - by * Math.sin(barAngle), bx * Math.sin(barAngle) + by * Math.cos(barAngle), z,
        55 + random() * 140, 0.1 + random() * 0.24, 0.62 + random() * 0.38);
    }
    const geometry = new THREE.BufferGeometry(); geometries.push(geometry);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('cloudSize', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('strength', new THREE.Float32BufferAttribute(strengths, 1));
    const cloudMaterial = new THREE.ShaderMaterial({
      uniforms: { alpha: { value: 1 }, pixelScale: { value: 700 } },
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 color; attribute float cloudSize; attribute float strength;
        uniform float pixelScale; varying vec3 tint; varying float amount;
        void main(){vec4 v=modelViewMatrix*vec4(position,1.0);
          float size=cloudSize*pixelScale/max(0.01,-v.z);
          gl_PointSize=clamp(size,1.2,64.0); gl_Position=projectionMatrix*v;
          tint=color; amount=strength*min(1.0,size/1.2)*min(1.0,8.0/max(8.0,size))*smoothstep(20.0,180.0,length(v.xyz));
        }`,
      fragmentShader: `uniform float alpha; varying vec3 tint; varying float amount;
        void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);
          if(r>1.0)discard; float haze=exp(-r*5.0)*(1.0-smoothstep(0.5,1.0,r));
          gl_FragColor=vec4(tint,haze*amount*alpha);
        }`
    });
    materials.push(cloudMaterial);
    const points = new THREE.Points(geometry, cloudMaterial); points.frustumCulled = false; points.renderOrder = -2; scene.add(points);

    const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
    const glowContext = glowCanvas.getContext('2d');
    const gradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,226,179,0.8)'); gradient.addColorStop(0.18, 'rgba(247,219,185,0.4)');
    gradient.addColorStop(0.5, 'rgba(194,174,154,0.1)'); gradient.addColorStop(1, 'rgba(150,140,140,0)');
    glowContext.fillStyle = gradient; glowContext.fillRect(0, 0, 128, 128);
    const glowTexture = new THREE.CanvasTexture(glowCanvas); textures.push(glowTexture);
    const glowMaterial = new THREE.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false,
      depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.38 });
    materials.push(glowMaterial); softMaterials.push({ material: glowMaterial, opacity: 0.38 });
    const glow = new THREE.Sprite(glowMaterial); glow.position.copy(centreLY); glow.scale.set(14000, 14000, 1); glow.renderOrder = -1; scene.add(glow);

    function configureCamera(physicalCamera, physicalTarget) {
      camera.copy(physicalCamera, false);
      camera.position.copy(physicalCamera.position).divideScalar(LY);
      const radius = physicalTarget ? physicalCamera.position.distanceTo(physicalTarget) / LY : camera.position.distanceTo(centreLY);
      camera.near = Math.max(radius * 0.00002, 1e-7);
      camera.far = Math.max(200000, 200000 + camera.position.length());
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    }
    const bufferSize = new THREE.Vector2();
    function render(renderer, physicalCamera, physicalTarget, alpha) {
      alpha = clamp(alpha === undefined ? 1 : alpha, 0, 1);
      if (alpha <= 0) return;
      configureCamera(physicalCamera, physicalTarget);
      renderer.getDrawingBufferSize(bufferSize);
      cloudMaterial.uniforms.pixelScale.value = bufferSize.y * 0.5 / Math.tan(camera.fov * Math.PI / 360);
      cloudMaterial.uniforms.alpha.value = alpha;
      softMaterials.forEach(entry => { entry.material.opacity = entry.opacity * alpha; });
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
    }
    function project(pointMkm, physicalCamera, width, height) {
      configureCamera(physicalCamera);
      const p = pointMkm.clone().divideScalar(LY).project(camera);
      return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2,
        depth: p.z, visible: p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 };
    }
    function dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); }
    return { scene, camera, centre, normal, render, project, dispose };
  };
})(typeof window !== 'undefined' ? window : globalThis);
