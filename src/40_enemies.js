// =================== ENEMIES ===================
// Drones (from circle 2) chase you and pop on contact. Jets (from circle 3) shoot slow orange shots.
// Boosting into either takes it down.
const N_PROJ = 40;
const projMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), N_PROJ);
projMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); projMesh.frustumCulled = false; scene.add(projMesh);
for (let i = 0; i < N_PROJ; i++) projMesh.setColorAt(i, new THREE.Color(2.6, 0.8, 0.5));
projMesh.instanceColor.needsUpdate = true;
const projs = [...Array(N_PROJ)].map((_, i) => ({ i, on: false, pos: new V3(), vel: new V3(), life: 0, minD: 99, nm: false }));
function fireProj(from, dir, speed = 30) {
  const p = projs.find(x => !x.on); if (!p) return;
  p.on = true; p.pos.copy(from); p.vel.copy(dir).normalize().multiplyScalar(speed); p.life = 4; p.minD = 99; p.nm = false;
  AudioSys.shot(from.distanceTo(P.pos));
}
function updateProjs(dt) {
  for (const p of projs) {
    if (!p.on) { _m.makeScale(0, 0, 0); projMesh.setMatrixAt(p.i, _m); continue; }
    p.life -= dt; p.pos.addScaledVector(p.vel, dt);
    const d = p.pos.distanceTo(P.pos);
    if (d < p.minD) p.minD = d;
    if (!p.nm && p.minD < 3.4 && p.minD > 1.4 && d > p.minD + 1.5 && P.mode === 'fly') { p.nm = true; FX.popup('NEAR MISS', '#8fe9ff'); bumpCombo(); }
    if (d < 2.6 && (P.ram || P.mode === 'ultra')) { p.on = false; FX.sparks(p.pos, 8, CORAL); continue; }
    if (d < 1.4) { p.on = false; FX.sparks(p.pos, 14, CORAL); loseShield('HIT'); continue; }
    if (p.life <= 0 || p.pos.length() < PLANET_R) { p.on = false; continue; }
    const s = 0.9 + Math.sin(NOW * 30 + p.i) * 0.2;
    _m.makeScale(s, s, s).setPosition(p.pos); projMesh.setMatrixAt(p.i, _m);
  }
  projMesh.instanceMatrix.needsUpdate = true;
}
function clearProjs(pos = null, r = 1e9) { for (const p of projs) if (p.on && (!pos || p.pos.distanceTo(pos) < r)) { p.on = false; FX.sparks(p.pos, 5, CORAL); } }

// steer a flyer so it stays inside the zone and off the planet
function avoid(want, pos) {
  if (zoneDepth(pos) < 10) want.addScaledVector(_v[3].subVectors(ZONE.c, pos).normalize(), 2).normalize();
  const cd = pos.length(); if (cd < PLANET_R + 6) want.addScaledVector(_v[3].copy(pos).normalize(), 2).normalize();
  for (const m of moons) { const od = pos.distanceTo(m.pos); if (od < m.r + 5) want.addScaledVector(_v[3].subVectors(pos, m.pos).normalize(), 2).normalize(); }
  return want;
}
function spawnSpot(out) {
  for (let k = 0; k < 12; k++) { randomInZone(out, 10, false); if (out.distanceTo(P.pos) > 45) return out; }
  return out;
}

// ---------- jets ----------
const jets = [];
for (let i = 0; i < 3; i++) {
  const j = makeJet(0x5fb81a, new THREE.Color(1.2, 2.4, 0.6), new THREE.Color(0.6, 1.0, 0.3), new THREE.Color(0.2, 0.9, 0.3), 0.85);
  scene.add(j.g); j.g.visible = false;
  jets.push({ kind: 'jet', j, pos: new V3(), fwd: new V3(1, 0, 0), up: new V3(0, 1, 0), alive: false, respawn: rand(1, 4), cd: rand(1, 3), wp: new V3(), wpT: 0, speed: 22, spawnT: 0 });
}
function spawnJet(e) {
  spawnSpot(e.pos);
  e.fwd.copy(randUnit(_v[0])); e.up.copy(e.pos).normalize(); e.alive = true; e.j.g.visible = true; e.spawnT = 0.8; e.cd = rand(2.5, 4);
  FX.shockwave(e.pos, 5, LIME, 0.5); FX.burstShapes(e.pos, 12, [2, 5], 10, LIME);
  Coach.once('enemy');
}
function killJet(e, by) {
  if (!e.alive) return;
  e.alive = false; e.j.g.visible = false; e.respawn = rand(6, 10);
  FX.burstShapes(e.pos, 34, [0, 1, 2, 5], 26, LIME); FX.sparks(e.pos, 24, GOLD, 30); FX.shockwave(e.pos, 7, LIME, 0.5);
  AudioSys.explode(); GAME.kills++; haptic('medium');
  award(400, by === 'ULTRA' ? null : 'JET DOWN', 12);
  Coach.done('enemy');
}
function updateJets(dt, maxAlive) {
  let alive = 0; for (const e of jets) if (e.alive) alive++;
  for (const e of jets) {
    if (!e.alive) {
      e.respawn -= dt;
      if (e.respawn <= 0 && GAME.state === 'play' && alive < maxAlive) { spawnJet(e); alive++; }
      continue;
    }
    e.spawnT = Math.max(0, e.spawnT - dt);
    const toP = _v[0].subVectors(P.pos, e.pos); const dP = toP.length();
    e.wpT -= dt;
    if (e.wpT <= 0 || e.pos.distanceTo(e.wp) < 6) { randomInZone(e.wp, 10, false); e.wpT = rand(4, 8); }
    let target = e.wp;
    if (dP < 55 && P.mode !== 'ultra') target = _v[1].copy(P.pos).addScaledVector(P.fwd, 12).addScaledVector(P.right, Math.sin(NOW + e.cd) * 8);
    const want = avoid(_v[2].subVectors(target, e.pos).normalize(), e.pos);
    e.fwd.lerp(want, 1 - Math.exp(-1.6 * dt)).normalize();
    e.up.lerp(_v[3].copy(e.pos).normalize(), 1 - Math.exp(-2 * dt)); e.up.addScaledVector(e.fwd, -e.up.dot(e.fwd)).normalize();
    e.speed = dP < 55 ? 24 : 21;
    e.pos.addScaledVector(e.fwd, e.speed * dt);
    e.cd -= dt;
    if (e.cd <= 0 && dP < 55 && dP > 10 && e.fwd.dot(toP.normalize()) > 0.82 && e.spawnT <= 0 && P.mode === 'fly' && P.invuln <= 0) {
      const lead = _v[4].copy(P.pos).addScaledVector(P.fwd, P.speed * dP / 45);
      fireProj(_v[5].copy(e.pos).addScaledVector(e.fwd, 1.5), _v[6].subVectors(lead, e.pos), 30);
      e.cd = rand(2.4, 3.8);
    }
    if (e.pos.distanceTo(P.pos) < 2.6 && P.mode !== 'ultra') {
      if (P.ram) killJet(e, 'RAM');
      else if (loseShield('CRASH')) killJet(e, 'CRASH');
    }
    const right = _v[7].crossVectors(e.up, e.fwd).normalize();
    _m.makeBasis(right, e.up, e.fwd); e.j.g.quaternion.setFromRotationMatrix(_m); e.j.g.position.copy(e.pos);
    e.j.inner.rotation.z = Math.sin(NOW * 2 + e.cd) * 0.3;
    for (let i = 0; i < e.j.flames.length; i++) e.j.flames[i].scale.set(1, 1, 0.8 + Math.random() * 0.4);
    e.j.g.scale.setScalar(0.85 * (1 - e.spawnT * 0.8));
  }
}

// ---------- drones ----------
const droneGeo = new THREE.OctahedronGeometry(0.85, 0);
const droneMat = new THREE.MeshStandardMaterial({ color: 0x2a0a20, metalness: 0.8, roughness: 0.25, emissive: new THREE.Color(1.6, 0.2, 0.8), emissiveIntensity: 1.2, flatShading: true });
const droneRingMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.4, 1.3) });
const drones = [];
for (let i = 0; i < 6; i++) {
  const g = new THREE.Group(); const b = new THREE.Mesh(droneGeo, droneMat); const r = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 6, 24), droneRingMat);
  g.add(b, r); g.visible = false; scene.add(g);
  drones.push({ kind: 'drone', g, ring: r, pos: new V3(), vel: new V3(), alive: false, respawn: rand(2, 5) });
}
function spawnDrone(p) {
  spawnSpot(p.pos); p.vel.set(0, 0, 0); p.alive = true; p.g.visible = true;
  FX.sparks(p.pos, 10, MAG, 10); FX.shockwave(p.pos, 4, MAG, 0.4);
  Coach.once('enemy');
}
function killDrone(p, by) {
  if (!p.alive) return; p.alive = false; p.g.visible = false; p.respawn = rand(4, 7);
  FX.burstShapes(p.pos, 20, [1, 4, 5], 18, MAG); FX.shockwave(p.pos, 4, MAG, 0.4); AudioSys.explode();
  if (by) { GAME.kills++; award(200, by === 'ULTRA' ? null : 'DRONE POP', 12); haptic('light'); Coach.done('enemy'); }
}
function updateDrones(dt, maxAlive) {
  let alive = 0; for (const p of drones) if (p.alive) alive++;
  for (const p of drones) {
    if (!p.alive) {
      p.respawn -= dt;
      if (p.respawn <= 0 && GAME.state === 'play' && alive < maxAlive) { spawnDrone(p); alive++; }
      continue;
    }
    const want = _v[0].subVectors(P.pos, p.pos); const d = want.length();
    want.normalize();
    avoid(want, p.pos);
    p.vel.lerp(want.multiplyScalar(d < 70 ? 19 : 12), 1 - Math.exp(-1.2 * dt));
    p.pos.addScaledVector(p.vel, dt);
    if (P.mode !== 'ultra') {
      if (d < 2.7 && P.ram) { killDrone(p, 'RAM'); continue; }
      if (d < 1.7) { loseShield('DRONE'); killDrone(p, null); continue; }
    }
    p.g.position.copy(p.pos); p.g.rotation.x += dt * 3; p.g.rotation.y += dt * 5; p.ring.rotation.x += dt * 7;
  }
}
function allTargets() {
  const t = [];
  for (const e of jets) if (e.alive) t.push(e);
  for (const p of drones) if (p.alive) t.push(p);
  return t;
}
