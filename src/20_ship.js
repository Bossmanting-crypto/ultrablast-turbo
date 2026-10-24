// =================== SHIP ===================
const flameMat = (c1, c2) => new THREE.ShaderMaterial({
  uniforms: { uTime: U_TIME, uC1: { value: c1 }, uC2: { value: c2 }, uPow: { value: 1 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; varying float vH; uniform float uTime; void main(){ vUv=uv; vec3 p=position; float w = 1.0 + 0.12*sin(uTime*60.0 + p.z*20.0); p.xy*=w; vH = -p.z; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
  fragmentShader: `uniform vec3 uC1,uC2; uniform float uPow, uTime; varying vec2 vUv; varying float vH;
  void main(){ float t = clamp(vH,0.0,1.0); vec3 col = mix(uC1*1.8, uC2*1.3, smoothstep(0.0,0.7,t)); float a = (1.0-t)*(0.85+0.15*sin(uTime*90.0+vUv.x*30.0)); gl_FragColor=vec4(col*uPow, a); }`
});
function makeJet(bodyColor, accent, flameA, flameB, scale = 1) {
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner);
  const prof = [[0, -1.15], [0.26, -1.05], [0.36, -0.45], [0.31, 0.35], [0.15, 1.0], [0, 1.45]].map(([r, y]) => new THREE.Vector2(r, y));
  const fus = new THREE.LatheGeometry(prof, 8); fus.rotateX(Math.PI / 2); fus.scale(1, 0.62, 1);
  const bodyM = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.6, roughness: 0.28, flatShading: true });
  inner.add(new THREE.Mesh(fus, bodyM));
  const ws = new THREE.Shape(); ws.moveTo(0.2, -0.45); ws.lineTo(1.55, 0.7); ws.lineTo(1.42, 0.95); ws.lineTo(0.2, 0.8); ws.closePath();
  const wg = new THREE.ExtrudeGeometry(ws, { depth: 0.06, bevelEnabled: false }); wg.rotateX(-Math.PI / 2); wg.translate(0, -0.03, 0);
  const wR = new THREE.Mesh(wg, bodyM); const wL = new THREE.Mesh(wg, bodyM); wL.scale.x = -1;
  inner.add(wR, wL);
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(0.55, -0.15); fs.lineTo(0.6, 0.05); fs.lineTo(0.1, 0.45); fs.closePath();
  const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.04, bevelEnabled: false }); fg.rotateY(-Math.PI / 2);
  const f1 = new THREE.Mesh(fg, bodyM); f1.position.set(0.22, 0.12, -0.95); f1.rotation.z = -0.35;
  const f2 = new THREE.Mesh(fg, bodyM); f2.position.set(-0.22, 0.12, -0.95); f2.rotation.z = 0.35;
  inner.add(f1, f2);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: 0x10142a, metalness: 1, roughness: 0.05 }));
  glass.scale.set(0.9, 0.55, 2.0); glass.position.set(0, 0.17, 0.35); inner.add(glass);
  const accM = new THREE.MeshBasicMaterial({ color: accent });
  for (const sx of [1, -1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 1.75), accM); s.position.set(sx * 0.88, 0.02, 0.15); s.rotation.y = sx * 0.83; inner.add(s); }
  const noz = new THREE.CylinderGeometry(0.13, 0.17, 0.3, 10); noz.rotateX(Math.PI / 2);
  const nozM = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.9, roughness: 0.3, emissive: accent, emissiveIntensity: 0.4 });
  const flames = [];
  const cone = new THREE.ConeGeometry(0.15, 1, 12, 1, true); cone.rotateX(-Math.PI / 2); cone.translate(0, 0, -0.5);
  const coreCone = new THREE.ConeGeometry(0.07, 1, 8, 1, true); coreCone.rotateX(-Math.PI / 2); coreCone.translate(0, 0, -0.5);
  const fm = flameMat(flameA, flameB), fm2 = flameMat(new THREE.Color(1, 1, 1), flameA);
  for (const sx of [0.2, -0.2]) {
    const n = new THREE.Mesh(noz, nozM); n.position.set(sx, 0, -1.12); inner.add(n);
    const f = new THREE.Mesh(cone, fm); f.position.set(sx, 0, -1.25); inner.add(f);
    const fc = new THREE.Mesh(coreCone, fm2); fc.position.set(sx, 0, -1.25); inner.add(fc);
    flames.push(f, fc);
  }
  g.scale.setScalar(scale);
  return { g, inner, flames, flameMat: fm, flameMat2: fm2, bodyM };
}
const ship = makeJet(0xd8262f, new THREE.Color(2.2, 1.5, 0.7), new THREE.Color(1.0, 0.75, 0.35), new THREE.Color(1.0, 0.25, 0.1), 1.3);
scene.add(ship.g);

// ---------- player ----------
const P = {
  pos: new V3(), fwd: new V3(0, 0, 1), up: new V3(0, 1, 0), right: new V3(-1, 0, 0),
  speed: 24, base: 24, boost: 0, boostHold: 0, mode: 'fly', hTarget: 6, inField: null, prevBody: null,
  invuln: 0, hurtCd: 0, stun: 0, bank: 0, pitchVis: 0, flameScale: 1, flameTarget: 1, ram: false,
  tunnel: null, tunT: 0, tunDir: 1, tunOff: new THREE.Vector2(), tunCool: 0, lastTunnel: null, lastTunnelT: -99,
  shields: 3, stormT: 0, outside: false
};
function resetPlayer() {
  P.pos.set(0, PLANET_R + 5.5, 0); P.fwd.set(0, 0, 1); P.up.set(0, 1, 0); orthoPlayer();
  P.speed = 24; P.boost = 0; P.boostHold = 0; P.mode = 'fly'; P.hTarget = 5.5; P.prevBody = null; P.stun = 0; P.invuln = 2; P.hurtCd = 0;
  P.fpitch = null; P.tunnel = null; P.tunCool = 0; P.flameTarget = 1; P.shields = 3; P.stormT = 0; P.outside = false; P.ram = false;
}
function orthoPlayer() {
  P.fwd.normalize();
  P.right.crossVectors(P.up, P.fwd).normalize();           // ship +X axis (screen left)
  P.up.crossVectors(P.fwd, P.right).normalize();
}

function flyUpdate(dt) {
  const ctl = P.stun > 0 ? 0 : 1;
  const sx = input.steerX * ctl, sy = input.steerY * ctl;
  // strongest gravity body: near a planet or moon you skim its surface (Mario Galaxy style)
  let best = null, bw = 0;
  for (const b of BODIES) {
    const d = P.pos.distanceTo(b.pos);
    if (d < b.field) { const w = 1 - smooth(b.field * 0.62, b.field, d); if (w > bw) { bw = w; best = b; } }
  }
  const gw = bw;
  P.inField = gw > 0.05 ? best : null;
  const yawRate = BLAST.charging ? 1.75 : 2.15;
  P.fwd.applyAxisAngle(P.up, -sx * yawRate * dt);
  if (best && gw > 0.05) {
    const n = _v[6].subVectors(P.pos, best.pos).normalize();
    P.up.lerp(n, 1 - Math.exp(-4.5 * gw * dt)).normalize();
    const alt = P.pos.distanceTo(best.pos) - best.r;
    if (P.prevBody !== best) { P.hTarget = clamp(alt, 2.5, best.field - best.r - 3); P.prevBody = best; }
    P.hTarget = clamp(P.hTarget + sy * 10 * dt, 2.4, best.field - best.r - 2.5);
    P.pos.addScaledVector(n, (P.hTarget - alt) * 2.6 * gw * dt);
    const tang = _v[7].copy(P.fwd).addScaledVector(n, -P.fwd.dot(n)).normalize();
    P.fwd.lerp(tang, 1 - Math.exp(-7 * gw * dt)).normalize();
    P.pitchVis = damp(P.pitchVis, sy * 0.35, 6, dt);
    if (gw < 0.6) { const ax = _v[8].crossVectors(P.fwd, P.up).normalize(); P.fwd.applyAxisAngle(ax, sy * 1.5 * dt * (1 - gw)); }
  } else {
    // open space: flight assist. Up/down sets a climb angle; let go and you level off into an orbit
    // around the planet at that height. The horizon rolls so the planet is always "down".
    const radial = _v[9].copy(P.pos).normalize(), r = P.pos.length();
    if (P.prevBody !== null || P.fpitch == null) { P.fpitch = Math.asin(clamp(P.fwd.dot(radial), -0.95, 0.95)); P.orbitR = r; }
    P.prevBody = null;
    P.fpitch = damp(P.fpitch, sy * 0.85, Math.abs(sy) > 0.05 ? 3.5 : 2.2, dt);
    const head = _v[10].copy(P.fwd).addScaledVector(radial, -P.fwd.dot(radial));
    if (head.lengthSq() < 1e-4) head.copy(P.up).addScaledVector(radial, -P.up.dot(radial));
    head.normalize();
    P.fwd.copy(head).multiplyScalar(Math.cos(P.fpitch)).addScaledVector(radial, Math.sin(P.fpitch)).normalize();
    if (Math.abs(sy) > 0.05 || Math.abs(P.fpitch) > 0.06) P.orbitR = r;
    else P.pos.addScaledVector(radial, (P.orbitR - r) * 2 * dt);
    const want = _v[11].copy(radial).addScaledVector(P.fwd, -radial.dot(P.fwd));
    if (want.lengthSq() > 0.01) P.up.lerp(want.normalize(), 1 - Math.exp(-3 * dt)).normalize();
    P.pitchVis = damp(P.pitchVis, sy * 0.2, 6, dt);
  }
  orthoPlayer();
  P.bank = damp(P.bank, sx * 0.75, 7, dt);
  if (P.boostHold > 0) P.boostHold -= dt;
  else P.boost = Math.max(0, P.boost * Math.exp(-0.9 * dt) - 1.5 * dt);
  const charge = BLAST.charging ? 0.8 : 1;
  const target = (P.base + Math.min(GAME.combo, 30) * 0.15) * charge + P.boost;
  P.speed = damp(P.speed, target, target > P.speed ? 6 : 2.5, dt);
  if (P.stun > 0) P.speed = damp(P.speed, 10, 3, dt);
  P.pos.addScaledVector(P.fwd, P.speed * dt);
  P.ram = P.boost > 16;
}

// ---------- draft tunnels: ride automatically, steer to grab gems ----------
function tunnelUpdate(dt) {
  const tun = P.tunnel;
  const flow = 70 + P.boost * 0.4;
  P.tunT += P.tunDir * flow * dt / tun.len;
  tun.frameAt(P.tunT, TF);
  const dl = _v[14].copy(P.right).multiplyScalar(-input.steerX).addScaledVector(P.up, input.steerY).multiplyScalar(8 * dt);
  P.tunOff.x += dl.dot(TF.N); P.tunOff.y += dl.dot(TF.B);
  if (P.tunOff.length() > 2.4) P.tunOff.setLength(2.4);
  P.pos.copy(TF.p).addScaledVector(TF.N, P.tunOff.x).addScaledVector(TF.B, P.tunOff.y);
  P.fwd.copy(TF.T).multiplyScalar(P.tunDir);
  P.up.addScaledVector(P.fwd, -P.up.dot(P.fwd)).normalize();
  orthoPlayer();
  P.bank = damp(P.bank, input.steerX * 0.6 + Math.sin(GAME.time * 3) * 0.1, 6, dt);
  P.speed = damp(P.speed, flow, 5, dt);
  tun.u.uActive.value = 1;
  if (Math.random() < 0.5) FX.spawn({ pos: _v[9].copy(P.pos).add(randUnit(_v[10]).multiplyScalar(3)), vel: _v[11].copy(P.fwd).multiplyScalar(-rand(10, 30)), color: tun.u.uA.value, size: rand(0.3, 0.7), life: 0.5, shape: 0 });
  if (P.tunT <= 0 || P.tunT >= 1) exitTunnel();
}
function tryCaptureTunnel() {
  if (P.tunCool > 0 || P.mode !== 'fly' || P.stun > 0) return;
  if (Coach.step >= 0 && Coach.step < 2) return; // not during the first lessons
  for (const tun of tunnels) {
    if (tun.dying || tun.fade < 0.6) continue;
    if (tun === P.lastTunnel && GAME.time - P.lastTunnelT < 3) continue;
    const nr = tun.nearest(P.pos);
    if (nr.d < TUNNEL_R * 1.15) {
      const T = tun.tans[nr.i]; const dir = P.fwd.dot(T) >= 0 ? 1 : -1;
      if (Math.abs(P.fwd.dot(T)) < 0.2) continue;
      if (BLAST.charging) cancelCharge();
      P.mode = 'tunnel'; P.tunnel = tun; P.tunT = nr.t; P.tunDir = dir;
      tun.frameAt(nr.t, TF);
      const rel = _v[9].subVectors(P.pos, TF.p); P.tunOff.set(rel.dot(TF.N), rel.dot(TF.B));
      AudioSys.whoosh(true, 0.35); FX.popup('DRAFT TUNNEL', '#8fe9ff'); FX.shake(0.15); haptic('light');
      Coach.once('tunnel');
      return;
    }
  }
}
function exitTunnel() {
  const tun = P.tunnel; tun.u.uActive.value = 0;
  P.mode = 'fly'; P.lastTunnel = tun; P.lastTunnelT = GAME.time; P.tunnel = null; P.tunCool = 1.0;
  P.boost += 46; P.boostHold = 0.7; P.hTarget = 8;
  FX.eventText('TUNNEL BLAST!', 'cyan');
  FX.burstShapes(_v[9].copy(P.pos).addScaledVector(P.fwd, 6), 26, [1, 2], 30);
  FX.shockwave(P.pos, 14, new THREE.Color(0.4, 0.9, 1.3), 0.6);
  FX.screenCrash(4, [1, 2, 3]); FX.doodleFlash(0.6);
  AudioSys.event('tunnel'); AudioSys.ringPass(3); haptic('medium');
  award(300, 'TUNNEL BLAST', 15);
}

// ---------- collisions: planet, moons and the outer edge of space ----------
function collisions() {
  if (P.mode === 'ultra') return;
  for (const b of BODIES) {
    const d = P.pos.distanceTo(b.pos), min = b.r + 1.1;
    if (d < min) {
      const n = _v[6].subVectors(P.pos, b.pos).normalize();
      P.pos.copy(b.pos).addScaledVector(n, min);
      const dn = P.fwd.dot(n); if (dn < 0) P.fwd.addScaledVector(n, -dn * 1.6).normalize();
      orthoPlayer();
      if (P.hurtCd <= 0) {
        P.hurtCd = 0.6; P.boost *= 0.5; P.stun = 0.25; breakCombo();
        FX.shake(0.3); FX.sparks(P.pos, 16, CORAL, 12); AudioSys.play('impact', { vol: 0.6 }); haptic('medium'); FX.popup('SCRAPE!', '#ff9a7a');
        if (b.kind === 'moon') b.body.material.uniforms.uHit.value = 1;
      }
    }
  }
  const L = P.pos.length(), lim = STORM_R0 + 12;
  if (L > lim) {
    const n = _v[6].copy(P.pos).normalize(); P.pos.copy(n).multiplyScalar(lim);
    const dn = P.fwd.dot(n); if (dn > 0) P.fwd.addScaledVector(n, -dn * 1.8).normalize(); orthoPlayer();
  }
}

// ---------- camera ----------
const CAM = { pos: new V3(0, PLANET_R + 10, -10), up: new V3(0, 1, 0), fov: 72, trauma: 0, punch: 0, look: new V3() };
function updateCamera(rdt, gdt) {
  const sf = clamp((P.speed - 24) / 90, 0, 1);
  const portraitish = innerHeight > innerWidth;
  const gw = P.inField && P.mode === 'fly' ? 1 : 0;
  CAM.gw = damp(CAM.gw || 0, gw, 2, rdt);
  let dist = 7.6 + sf * 2.8 + (portraitish ? 3 : 0), height = 2.9 + CAM.gw * 0.8, drop = CAM.gw * 1.2;
  if (P.mode === 'ultra') { dist = 9.5; height = 2.6; drop = 0; }
  const t = _v[12].copy(P.pos).addScaledVector(P.fwd, -dist).addScaledVector(P.up, height);
  const k = Math.max(gdt, rdt * 0.3);
  CAM.pos.lerp(t, 1 - Math.exp(-9 * k));
  CAM.up.lerp(P.up, 1 - Math.exp(-5 * k)).normalize();
  CAM.look.lerp(_v[13].copy(P.pos).addScaledVector(P.fwd, 9).addScaledVector(P.up, 0.9 - drop), 1 - Math.exp(-14 * k));
  CAM.trauma = Math.max(0, CAM.trauma - rdt * 1.5);
  const sh = CAM.trauma * CAM.trauma;
  camera.position.copy(CAM.pos);
  if (sh > 0) {
    const n = NOW * 31;
    camera.position.addScaledVector(P.right, (Math.sin(n * 1.7) + Math.sin(n * 2.9)) * sh * 0.5).addScaledVector(P.up, (Math.sin(n * 2.3) + Math.cos(n * 3.1)) * sh * 0.5);
  }
  camera.up.copy(CAM.up);
  if (sh > 0) camera.up.applyAxisAngle(P.fwd, Math.sin(NOW * 40) * sh * 0.05);
  camera.lookAt(CAM.look);
  CAM.punch = damp(CAM.punch, 0, 4, rdt);
  let fov = 70 + sf * 24 + CAM.punch;
  if (P.mode === 'tunnel') fov += 6;
  CAM.fov = damp(CAM.fov, fov, 6, rdt);
  camera.fov = CAM.fov; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
}

function snapCamera() {
  CAM.pos.copy(P.pos).addScaledVector(P.fwd, -7.6).addScaledVector(P.up, 2.9); CAM.up.copy(P.up);
  CAM.look.copy(P.pos).addScaledVector(P.fwd, 9).addScaledVector(P.up, 0.9); CAM.trauma = 0;
}
function updateShipVisual(rdt) {
  _m.makeBasis(P.right, P.up, P.fwd); ship.g.quaternion.setFromRotationMatrix(_m); ship.g.position.copy(P.pos);
  ship.inner.rotation.set(-P.pitchVis, 0, P.bank + (P.stun > 0 ? GAME.time * 14 : 0));
  P.flameScale = damp(P.flameScale, P.flameTarget, 10, rdt);
  const fl = P.flameScale * (0.7 + clamp(P.speed / 60, 0, 1.6) * 0.6);
  for (let i = 0; i < ship.flames.length; i++) { const f = ship.flames[i]; const w = (i % 2 ? 0.8 : 1) * (0.9 + P.flameScale * 0.25); const s = w * Math.min(2.4, 0.8 + P.flameScale * 0.4); f.scale.set(s, s, fl * (i % 2 ? 0.7 : 1) * (0.9 + Math.random() * 0.2)); }
  ship.flameMat.uniforms.uPow.value = 0.62 + Math.min(P.flameScale, 2) * 0.12; ship.flameMat2.uniforms.uPow.value = 0.55;
  ship.g.visible = GAME.state !== 'over' || !GAME.crashed;
  if (P.invuln > 0 && GAME.state === 'play' && P.mode === 'fly' && P.invuln < 1.95 && Math.floor(NOW * 16) % 2 === 0) ship.g.visible = false;
}
