// =================== PLAY: boost, ULTRA, pickups, storm ===================
// The whole game in three verbs: steer, boost (hold, let go), ULTRA (tap when the meter is full).
GAME = {
  state: 'boot', time: 0, utime: 0, score: 0, combo: 0, comboT: 0, bestCombo: 0, meter: 0, crystals: 0, kills: 0, ultras: 0, perfectUltra: false,
  ts: 1, slowT: 0, slowV: 1, hitT: 0, crashed: false, holdStorm: false, firstRun: false, circleHint: false,
  nextShield: 20, nextGate: 3, frames: 0,
  mult() { return Math.min(5, 1 + Math.floor(this.combo / 5) * 0.5); },
  slowmo(v, d) { this.slowV = Math.min(this.slowT > 0 ? this.slowV : 1, v); this.slowT = Math.max(this.slowT, d); },
  hitstop(d) { this.hitT = Math.max(this.hitT, d); }
};
const COMBO_TIME = 3.2;
function bumpCombo() {
  const before = GAME.mult();
  GAME.combo++; GAME.comboT = COMBO_TIME; GAME.bestCombo = Math.max(GAME.bestCombo, GAME.combo);
  const after = GAME.mult();
  if (after > before) { AudioSys.rankUp(Math.round(after * 2 - 2)); UI.multBump(); FX.popup(`COMBO ×${after}`, '#8fe9ff', true); if (after >= 3) FX.screenCrash(3, [0, 1, 2]); }
}
function breakCombo() { if (GAME.combo >= 5) { FX.popup('COMBO LOST', '#b9a9c9'); AudioSys.rankDown(); } GAME.combo = 0; GAME.comboT = 0; }
function award(base, label, gain = 0, bump = true) {
  if (bump) bumpCombo();
  const pts = Math.round(base * GAME.mult()); GAME.score += pts;
  if (label) FX.popup(`${label} +${pts}`, '#ffd27a');
  if (gain) addMeter(gain);
  return pts;
}
function addMeter(v) {
  if (P.mode === 'ultra') return;
  const was = GAME.meter; GAME.meter = Math.min(100, GAME.meter + v);
  if (was < 100 && GAME.meter >= 100) { AudioSys.turboReady(); FX.popup('ULTRA READY!', '#ffd27a', true); haptic('medium'); Coach.once('ultra'); }
}

// ---------- shields ----------
function loseShield(why, ignoreInvuln = false) {
  if (GAME.state !== 'play' || P.mode === 'ultra') return false;
  if (!ignoreInvuln && P.invuln > 0) return false;
  if (P.shields <= 0) { crash(why); return true; }
  P.shields--; P.invuln = ignoreInvuln ? P.invuln : 1.6; breakCombo();
  FX.shake(0.45); LENS.flash.setRGB(0.5, 0.05, 0.08); AudioSys.shieldLost(); haptic('heavy');
  FX.popup(P.shields ? `SHIELD LOST · ${why}` : 'NO SHIELDS LEFT!', '#ff6a4a', !P.shields);
  UI.shieldHit();
  return true;
}
function gainShield() {
  if (P.shields >= 3) { award(300, 'SHIELD BONUS', 5); return; }
  P.shields++; AudioSys.shield(); haptic('light'); FX.popup('SHIELD +1', '#8fe9ff', true); FX.shockwave(P.pos, 6, CYAN, 0.5);
}
function crash(why) {
  GAME.crashed = true;
  FX.shockwave(P.pos, 14, CORAL, 0.8); FX.sparks(P.pos, 70, CORAL, 30); FX.burstShapes(P.pos, 40, [1, 2, 3], 24, CORAL);
  AudioSys.boom(1.3); haptic('buzz');
  endGame(why === 'STORM' ? 'LOST IN THE STORM' : 'SHOT DOWN');
}

// ---------- BOOST: hold to charge up to three rings, let go to blast through them ----------
const BLAST_LEVEL_T = [0, 0.35, 0.7];
const BLAST = { charging: false, ct: 0, level: 0, cd: 0, cdMax: 0.6, mustRelease: false, rings: [], dash: [] };
function startCharge() {
  BLAST.charging = true; BLAST.ct = 0; BLAST.level = 0;
  addChargeRing();
  P.flameTarget = 0.6;
}
function addChargeRing() {
  BLAST.level++;
  const r = getTurboRing(); r.g.scale.setScalar(0.01); BLAST.rings.push({ r, grow: 0 });
  AudioSys.ring(BLAST.level); haptic('light');
  FX.sparks(_v[0].copy(P.pos).addScaledVector(P.fwd, 4 + BLAST.level * 3.4), 10, GOLD, 8);
}
function chargeTick(rdt) {
  BLAST.ct += rdt;
  while (BLAST.level < 3 && BLAST.ct >= BLAST_LEVEL_T[BLAST.level]) addChargeRing();
  if (BLAST.level >= 3 && BLAST.ct > 1.6) Coach.once('letgo');
}
function releaseCharge() {
  const lvl = BLAST.level;
  BLAST.charging = false; BLAST.cd = BLAST.cdMax; P.flameTarget = 1 + lvl * 0.4;
  P.boost += 16; P.boostHold = [0.25, 0.4, 0.6][lvl - 1] || 0.25;
  // the charge rings become dash rings that ride your flight path until you pass through them
  BLAST.rings.forEach((x, i) => BLAST.dash.push({ r: x.r, dist: 5 + (i + 1) * 3.4, i: i + 1, lvl }));
  BLAST.rings = [];
  AudioSys.whoosh(true, 0.3 + lvl * 0.06); FX.shake(0.1 + lvl * 0.06); CAM.punch += 2 + lvl * 2;
  if (lvl >= 3) { FX.popup('TURBO!', '#ffd27a', true); FX.screenCrash(2, [0, 2]); FX.doodleFlash(0.3); }
  Coach.done('boost');
  GAME.boosts = (GAME.boosts || 0) + 1;
}
function cancelCharge() {
  if (!BLAST.charging) return;
  BLAST.charging = false; for (const x of BLAST.rings) freeTurboRing(x.r); BLAST.rings = []; BLAST.level = 0; P.flameTarget = 1;
  if (input.boostHeld) BLAST.mustRelease = true;
}
function updateBlastRings(rdt, dt) {
  BLAST.rings.forEach((x, i) => {
    x.grow = Math.min(1, x.grow + rdt * 6);
    const p = _v[0].copy(P.pos).addScaledVector(P.fwd, 5 + (i + 1) * 3.4);
    x.r.g.position.copy(p); x.r.g.quaternion.copy(ship.g.quaternion);
    x.r.g.scale.setScalar((0.6 + 0.4 * (1 - Math.pow(1 - x.grow, 3))) * (1 + 0.04 * Math.sin(NOW * 14 + i)));
    x.r.gl.rotation.z += rdt * (2 + i);
  });
  for (let k = BLAST.dash.length - 1; k >= 0; k--) {
    const d = BLAST.dash[k];
    d.dist -= Math.max(10, P.speed - 6) * dt;
    const p = _v[0].copy(P.pos).addScaledVector(P.fwd, Math.max(0, d.dist));
    d.r.g.position.copy(p); d.r.g.quaternion.copy(ship.g.quaternion); d.r.gl.rotation.z += rdt * 8;
    d.r.g.scale.setScalar(1 + Math.max(0, 1 - d.dist / 4) * 0.3);
    if (d.dist <= 0) {
      P.boost += 10; P.boostHold = Math.max(P.boostHold, 0.15);
      FX.burstShapes(_v[1].copy(P.pos).addScaledVector(P.fwd, 3), 8 + d.i * 3, [1, 2], 14 + d.i * 4);
      AudioSys.ringPass(d.i); haptic('light');
      freeTurboRing(d.r); BLAST.dash.splice(k, 1);
    }
  }
}
function clearBlast() { for (const x of BLAST.rings) freeTurboRing(x.r); for (const d of BLAST.dash) freeTurboRing(d.r); BLAST.rings = []; BLAST.dash = []; BLAST.charging = false; BLAST.level = 0; BLAST.cd = 0; }

// ---------- ULTRA: an auto-homing chain; tap as each ring closes for PERFECT ----------
const ULT = { targets: [], i: 0, phase: 'off', t: 0, dur: 0.5, from: new V3(), perfect: 0, judged: false, flash: 0, lastPerfect: false };
function ultraTargets() {
  const list = [];
  const add = (obj, kind) => { if (list.length < 8 && !list.some(x => x.obj === obj)) list.push({ obj, kind, pos: obj.pos.clone() }); };
  const byDist = arr => arr.slice().sort((a, b) => a.pos.distanceToSquared(P.pos) - b.pos.distanceToSquared(P.pos));
  for (const e of byDist(allTargets())) if (e.pos.distanceTo(P.pos) < 140) add(e, e.kind);
  for (const c of byDist(powers.filter(c => c.alive))) if (c.pos.distanceTo(P.pos) < 110) add(c, 'power');
  for (const c of byDist(crystals.filter(c => c.alive && c.spawn <= 0))) if (c.pos.distanceTo(P.pos) < 90) add(c, 'crystal');
  // order as a path: always fly to the nearest remaining target
  const path = []; let at = P.pos.clone();
  while (list.length) { let bi = 0, bd = 1e9; list.forEach((x, i) => { const d = x.pos.distanceToSquared(at); if (d < bd) { bd = d; bi = i; } }); const n = list.splice(bi, 1)[0]; path.push(n); at = n.pos; }
  return path;
}
function startUltra() {
  if (GAME.meter < 100 || P.mode !== 'fly' || GAME.state !== 'play') return;
  const t = ultraTargets(); if (!t.length) { FX.popup('NO TARGETS IN RANGE', '#b9a9c9'); return; }
  cancelCharge(); GAME.meter = 0; GAME.ultras++;
  P.mode = 'ultra'; ULT.targets = t; ULT.i = 0; ULT.phase = 'intro'; ULT.t = 0; ULT.perfect = 0; ULT.flash = 0;
  FX.eventText('ULTRA!', 'gold'); AudioSys.event('ultra'); AudioSys.boom(0.8); haptic('heavy');
  FX.shockwave(P.pos, 10, GOLD, 0.6); FX.doodleFlash(0.8);
  Coach.done('ultra'); if (!store.get('ubm_ultra_done', false)) Coach.once('ultratap');
}
function ultraUpdate(dt, rdt, tapped) {
  ULT.flash = Math.max(0, ULT.flash - rdt * 3);
  if (ULT.phase === 'intro') {
    ULT.t += rdt; P.speed = damp(P.speed, 12, 4, rdt);
    P.pos.addScaledVector(P.fwd, P.speed * dt);
    if (ULT.t > 0.55) nextUltraTarget();
    return;
  }
  if (ULT.phase === 'dash') {
    const tg = ULT.targets[ULT.i];
    if (tg.obj.alive !== false) tg.pos.copy(tg.obj.pos);
    ULT.t += dt; const k = Math.min(1, ULT.t / ULT.dur);
    if (tapped && !ULT.judged) {
      ULT.judged = true;
      if (k >= 0.66) { ULT.perfect++; ULT.lastPerfect = true; ULT.flash = 1; AudioSys.perfect(); FX.popup('PERFECT!', '#ffd27a', true); haptic('medium'); }
      else { ULT.lastPerfect = false; FX.popup('EARLY', '#b9a9c9'); }
    }
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const prev = _v[0].copy(P.pos);
    P.pos.lerpVectors(ULT.from, tg.pos, e);
    const side = _v[1].copy(P.right).multiplyScalar(Math.sin(k * Math.PI) * 4 * (ULT.i % 2 ? 1 : -1));
    P.pos.add(side);
    const mv = _v[2].subVectors(P.pos, prev);
    if (mv.lengthSq() > 1e-6) { P.fwd.lerp(mv.normalize(), 1 - Math.exp(-14 * rdt)).normalize(); orthoPlayer(); }
    P.speed = 90; P.bank = damp(P.bank, Math.sin(k * Math.PI) * (ULT.i % 2 ? -0.9 : 0.9), 8, rdt);
    if (Math.random() < 0.8) FX.spawn({ pos: P.pos, vel: randUnit(_v[3]).multiplyScalar(3), color: GOLD, size: 0.6, life: 0.4, shape: pick([1, 2]) });
    if (k >= 1) hitUltraTarget(tg);
    return;
  }
}
function nextUltraTarget() {
  if (ULT.i >= ULT.targets.length) { finishUltra(); return; }
  ULT.phase = 'dash'; ULT.t = 0; ULT.judged = false; ULT.lastPerfect = false; ULT.from.copy(P.pos);
  const tg = ULT.targets[ULT.i];
  ULT.dur = clamp(tg.pos.distanceTo(P.pos) / 70, 0.42, 0.8);
  AudioSys.whoosh(true, 0.3);
}
function hitUltraTarget(tg) {
  const perfect = ULT.lastPerfect;
  if (tg.kind === 'jet') killJet(tg.obj, 'ULTRA');
  else if (tg.kind === 'drone') killDrone(tg.obj, 'ULTRA');
  else if (tg.kind === 'power') collectPower(tg.obj, true);
  else if (tg.kind === 'crystal') collectCrystal(tg.obj, true);
  award(perfect ? 500 : 250, null, 0);
  AudioSys.hit(ULT.i + 1); FX.burstShapes(tg.pos, 26, [1, 2, 3, 5], 26, perfect ? GOLD : PEACH); FX.shockwave(tg.pos, perfect ? 8 : 5, perfect ? GOLD : PEACH, 0.45);
  FX.screenCrash(perfect ? 3 : 1, [0, 1, 2]); FX.shake(0.25); GAME.hitstop(0.045); haptic(perfect ? 'medium' : 'light');
  ULT.i++; nextUltraTarget();
}
function finishUltra() {
  const n = ULT.targets.length, all = ULT.perfect === n;
  ULT.phase = 'off'; P.mode = 'fly'; P.invuln = Math.max(P.invuln, 1.4); if (input.boostHeld) BLAST.mustRelease = true; P.boost += 40; P.boostHold = 0.5; P.flameTarget = 2;
  FX.eventText(all ? 'PERFECT ULTRA!' : 'ULTRABLAST!', all ? 'gold' : 'mag');
  FX.shockwave(P.pos, 30, GOLD, 1.0); FX.tentacles(P.pos, 10, P.fwd); FX.burstShapes(P.pos, 50, [1, 2, 3, 4, 5], 34); FX.doodleFlash(1);
  AudioSys.pop(); haptic('heavy');
  for (const e of jets) if (e.alive && e.pos.distanceTo(P.pos) < 30) killJet(e, 'ULTRA');
  for (const d of drones) if (d.alive && d.pos.distanceTo(P.pos) < 30) killDrone(d, 'ULTRA');
  clearProjs(P.pos, 45);
  const bonus = all ? 1500 : ULT.perfect * 150;
  if (bonus) award(bonus, all ? 'ALL PERFECT' : `${ULT.perfect} PERFECT`, 0, false);
  if (all && n >= 3) GAME.perfectUltra = true;
  store.set('ubm_ultra_done', true);
}
function drawUltra(ctx) {
  if (P.mode !== 'ultra') return;
  ctx.save();
  ctx.font = '400 18px Bungee, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd27a'; ctx.strokeStyle = 'rgba(10,8,30,0.85)'; ctx.lineWidth = 5;
  const label = `ULTRA ${Math.min(ULT.i + 1, ULT.targets.length)} / ${ULT.targets.length}`;
  ctx.strokeText(label, FXW / 2, FXH * 0.9); ctx.fillText(label, FXW / 2, FXH * 0.9);
  if (ULT.phase === 'dash') {
    const tg = ULT.targets[ULT.i]; project(tg.pos, _sp);
    if (!_sp.behind) {
      const k = Math.min(1, ULT.t / ULT.dur), inWin = k >= 0.66;
      const r = lerp(120, 26, k);
      ctx.lineWidth = inWin ? 5 : 3; ctx.strokeStyle = ULT.judged ? (ULT.lastPerfect ? '#ffd27a' : 'rgba(185,169,201,0.6)') : (inWin ? '#ffe9a8' : 'rgba(255,255,255,0.85)');
      ctx.beginPath(); ctx.arc(_sp.x, _sp.y, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,210,122,0.9)'; ctx.beginPath(); ctx.arc(_sp.x, _sp.y, 26, 0, TAU); ctx.stroke();
      for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2 + NOW * 3; ctx.beginPath(); ctx.moveTo(_sp.x + Math.cos(a) * 32, _sp.y + Math.sin(a) * 32); ctx.lineTo(_sp.x + Math.cos(a) * 42, _sp.y + Math.sin(a) * 42); ctx.stroke(); }
      if (inWin && !ULT.judged) { ctx.font = '400 22px Bungee, Impact, sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,8,30,0.85)'; ctx.strokeText('TAP!', _sp.x, _sp.y - r - 12); ctx.fillStyle = '#ffe9a8'; ctx.fillText('TAP!', _sp.x, _sp.y - r - 12); }
    }
  }
  if (ULT.flash > 0) { ctx.globalAlpha = ULT.flash * 0.25; ctx.fillStyle = '#ffd27a'; ctx.fillRect(0, 0, FXW, FXH); }
  ctx.restore();
}

// ---------- pickups ----------
function collectCrystal(c, quiet) {
  c.alive = false; GAME.crystals++;
  const tr = trails[c.trail]; tr.got++;
  if (tr.got >= TRAIL_LEN && !quiet) { award(150, 'CRYSTAL TRAIL', 6, false); AudioSys.cellFull(); }
  if (!quiet) { award(50, null, 4); AudioSys.pickup(GAME.combo); FX.sparks(c.pos, 12, c.color, 12); }
  else addMeter(0);
  Coach.count('crystal');
}
function collectPower(c, quiet) {
  c.alive = false; c.respawn = rand(14, 20);
  if (!quiet) { award(250, 'POWER CRYSTAL', 20); AudioSys.homer(); haptic('light'); }
  FX.burstShapes(c.pos, 20, [1, 2], 18, MAG); FX.shockwave(c.pos, 5, MAG, 0.4);
  Coach.count('crystal', 3);
}
function updatePickups(dt, rdt) {
  const t = GAME.utime, play = GAME.state === 'play' && P.mode !== 'ultra';
  const reach = P.mode === 'tunnel' ? 2.2 : 2.9;
  // crystals
  for (const tr of trails) {
    tr.age += dt;
    const left = tr.ids.filter(id => crystals[id].alive).length;
    if (tr.live && left === 0) { tr.live = false; tr.respawn = rand(1.5, 4); }
    else if (tr.live && tr.age > 50 && crystals[tr.ids[0]].home.distanceTo(P.pos) > 80) { tr.live = false; tr.respawn = 0.5; for (const id of tr.ids) crystals[id].alive = false; }
    if (!tr.live) { tr.respawn -= dt; if (tr.respawn <= 0) layTrail(tr, GAME.state === 'play' && Math.random() < 0.55); }
  }
  for (const c of crystals) {
    if (!c.alive) { _m.makeScale(0, 0, 0); crystalMesh.setMatrixAt(c.idx, _m); continue; }
    c.spawn = Math.max(0, c.spawn - dt * 2);
    const d = c.pos.distanceTo(P.pos);
    if (play && d < 7 && c.spawn <= 0) c.pos.lerp(P.pos, 1 - Math.exp(-(9 - d) * 0.8 * dt));
    else c.pos.copy(c.home).addScaledVector(_v[0].copy(c.home).normalize(), Math.sin(t * 1.4 + c.ph) * 0.4);
    if (play && d < reach) { collectCrystal(c); continue; }
    if (zoneDepth(c.pos) < -3) { c.alive = false; continue; }
    const s = (1 - Math.min(1, c.spawn)) * (1 + 0.1 * Math.sin(t * 5 + c.ph));
    _q.setFromAxisAngle(_v[1].set(0, 1, 0), t * 1.6 + c.ph);
    _m.compose(c.pos, _q, _v[2].set(s, s, s)); crystalMesh.setMatrixAt(c.idx, _m);
  }
  crystalMesh.instanceMatrix.needsUpdate = true;
  // power crystals drift toward you once you are close
  for (const c of powers) {
    if (!c.alive) {
      c.respawn -= dt;
      if (c.respawn <= 0) { randomInZone(c.home, 10); c.pos.copy(c.home); c.vel.set(0, 0, 0); c.alive = true; c.spawn = 1; }
      _m.makeScale(0, 0, 0); powerMesh.setMatrixAt(c.idx, _m); continue;
    }
    c.spawn = Math.max(0, c.spawn - dt);
    const d = c.pos.distanceTo(P.pos);
    if (play && d < 14) { c.vel.lerp(_v[0].subVectors(P.pos, c.pos).normalize().multiplyScalar(26), 1 - Math.exp(-3 * dt)); c.pos.addScaledVector(c.vel, dt); }
    else c.pos.lerp(c.home, 1 - Math.exp(-0.5 * dt));
    if (play && d < 3.2) { collectPower(c); continue; }
    if (zoneDepth(c.pos) < -3) { c.alive = false; c.respawn = rand(2, 4); continue; }
    if (Math.random() < 0.15) FX.spawn({ pos: c.pos, vel: randUnit(_v[3]).multiplyScalar(2), color: MAG, size: 0.5, life: 0.6, shape: 5 });
    const s = (1 - c.spawn) * (1.1 + 0.15 * Math.sin(t * 6 + c.ph));
    _q.setFromEuler(new THREE.Euler(t * 0.9 + c.ph, t * 1.3, 0));
    _m.compose(c.pos, _q, _v[2].set(s, s, s)); powerMesh.setMatrixAt(c.idx, _m);
  }
  powerMesh.instanceMatrix.needsUpdate = true;
  // tunnel gems
  for (let i = 0; i < gems.length; i++) {
    const g = gems[i];
    if (!g.alive) { _m.makeScale(0, 0, 0); gemMesh.setMatrixAt(i, _m); continue; }
    if (play && g.pos.distanceTo(P.pos) < 2.1) { g.alive = false; award(20, null, 2); AudioSys.gem(GAME.combo); FX.sparks(g.pos, 6, GOLD, 8); continue; }
    _q.setFromAxisAngle(_v[1].set(0, 1, 0), t * 3 + g.ph);
    const s = 1 + 0.15 * Math.sin(t * 7 + g.ph);
    _m.compose(g.pos, _q, _v[2].set(s, s, s)); gemMesh.setMatrixAt(i, _m);
  }
  gemMesh.instanceMatrix.needsUpdate = true;
  // shield pickups
  for (const s of shieldPicks) {
    if (!s.alive) continue;
    s.life -= dt; s.g.rotation.y += dt * 1.5; s.g.children[1].rotation.x += dt;
    s.g.scale.setScalar(Math.min(1, (30 - s.life) * 2) * (1 + 0.08 * Math.sin(t * 6)));
    if (play && s.pos.distanceTo(P.pos) < 3.4) { s.alive = false; s.g.visible = false; gainShield(); continue; }
    if (s.life <= 0 || zoneDepth(s.pos) < -2) { s.alive = false; s.g.visible = false; }
  }
  if (play && P.shields < 3) {
    GAME.nextShield -= dt;
    if (GAME.nextShield <= 0) {
      const s = shieldPicks.find(x => !x.alive);
      if (s) {
        // near your path, inside the zone you need to be in
        s.pos.copy(P.pos).addScaledVector(P.fwd, rand(35, 55)).add(randUnit(_v[0]).multiplyScalar(10));
        if (nextDepth(s.pos) < 6) randomInZone(s.pos, 10);
        if (s.pos.length() < PLANET_R + 5) s.pos.setLength(PLANET_R + 7);
        s.alive = true; s.life = 30; s.g.visible = true; s.g.position.copy(s.pos);
        FX.popup('SHIELD NEARBY', '#8fe9ff'); Coach.once('shield');
      }
      GAME.nextShield = 24;
    }
  }
}

// ---------- gold gate runs ----------
function updateGates(dt, rdt) {
  for (let ri = gateRuns.length - 1; ri >= 0; ri--) {
    const run = gateRuns[ri]; run.life -= dt;
    let open = 0;
    run.gates.forEach((g, gi) => {
      if (!g.passed && !g.missed) {
        open++;
        const rel = _v[0].subVectors(P.pos, g.pos); const s = rel.dot(g.n);
        const radial = rel.addScaledVector(g.n, -s).length();
        if (g.side !== null && Math.sign(s) !== Math.sign(g.side) && Math.abs(s) < 8 && GAME.state === 'play' && P.mode !== 'ultra') {
          if (radial < GATE_R + 0.7) passGate(run, g);
          else if (radial < 14) { g.missed = true; }
        }
        g.side = s;
        const isNext = gi === run.gates.findIndex(x => !x.passed && !x.missed);
        const pulse = isNext ? 1 + 0.08 * Math.sin(NOW * 8) : 1;
        g.g.grp.scale.setScalar(pulse); g.g.gl.rotation.z += rdt * (isNext ? 2 : 0.6);
        g.g.tor.material.opacity = isNext ? 1 : 0.6; g.g.gl.material.opacity = isNext ? 1 : 0.45;
        if (zoneDepth(g.pos) < 0) g.missed = true;
      } else {
        g.s = Math.min(1, g.s + rdt * 2.5);
        g.g.tor.material.opacity = (g.passed ? 1 : 0.4) * (1 - g.s); g.g.gl.material.opacity = (g.passed ? 1 : 0.3) * (1 - g.s);
        g.g.grp.scale.setScalar(1 + g.s * (g.passed ? 0.8 : 0));
        if (g.s >= 1) g.g.grp.visible = false;
      }
    });
    if (!run.done && open === 0) {
      run.done = true;
      if (run.got === run.gates.length) { FX.eventText('GATE RUN!', 'gold'); award(500, 'GATE RUN', 10, false); AudioSys.event('match'); FX.doodleFlash(0.5); haptic('medium'); }
      else if (run.got >= 3) FX.popup(`${run.got}/${run.gates.length} GATES`, '#ffd27a');
      run.life = Math.min(run.life, 0.6);
    }
    if (run.life <= 0) { for (const g of run.gates) freeGate(g.g); gateRuns.splice(ri, 1); }
  }
  if (GAME.state === 'play') {
    const want = ZONE.state === 'final' ? 1 : 2;
    GAME.nextGate -= dt;
    const lessons = Coach.step >= 0 && Coach.step < 2;
    if (!lessons && gateRuns.length < want && GAME.nextGate <= 0) { spawnGateRun(); GAME.nextGate = 6; }
  }
}
function passGate(run, g) {
  g.passed = true; run.got++;
  P.boost += 14; P.boostHold = Math.max(P.boostHold, 0.25);
  award(100, null, 6); AudioSys.gate(run.got); haptic('light');
  FX.burstShapes(g.pos, 18, [1, 2], 18); FX.shockwave(g.pos, GATE_R + 2, GOLD, 0.45);
  Coach.count('gate');
}

// ---------- storm ----------
const STORM_TICK = [3.6, 3.4, 3.0, 2.6, 2.2, 1.8];
function updateStorm(dt, rdt) {
  const ph = STORM_PHASES[ZONE.i];
  if (!GAME.holdStorm) ZONE.t += dt;
  if (ZONE.state === 'wait') {
    const rem = ZONE.dur - ZONE.t;
    if (rem <= 5 && Math.ceil(rem) !== Math.ceil(rem + dt) && rem > 0) AudioSys.countdown(rem <= 1);
    if (ZONE.t >= ZONE.dur) {
      ZONE.state = 'shrink'; ZONE.t = 0; ZONE.dur = ph.shrink; ZONE.fc.copy(ZONE.c); ZONE.fr = ZONE.r;
      AudioSys.stormMove(); FX.popup('THE STORM IS CLOSING', '#e3c6ff', true); haptic('medium');
      if (nextDepth(P.pos) < 0) Coach.once('movein');
    }
  } else if (ZONE.state === 'shrink') {
    const k = Math.min(1, ZONE.t / ZONE.dur);
    ZONE.c.lerpVectors(ZONE.fc, ZONE.nc, k); ZONE.r = lerp(ZONE.fr, ZONE.nr, k);
    if (k >= 1) {
      ZONE.i++;
      const np = STORM_PHASES[ZONE.i];
      award(500 * ZONE.i, `CIRCLE ${ZONE.i} SURVIVED`, 0, false); AudioSys.step();
      if (np.final) { ZONE.state = 'final'; ZONE.t = 0; ZONE.dur = np.wait; ZONE.nc.copy(ZONE.c); ZONE.nr = ZONE.r; FX.eventText('FINAL CIRCLE!', 'violet'); }
      else {
        ZONE.state = 'wait'; ZONE.t = 0; ZONE.dur = np.wait; ZONE.nr = np.r; pickNextCenter(ZONE.nc, ZONE.c, ZONE.r, ZONE.nr);
        regenTunnels();
      }
    }
  } else if (ZONE.state === 'final') {
    if (ZONE.t >= ZONE.dur) { winGame(); return; }
  }
  zoneSet();
  // the storm hurts
  const out = zoneDepth(P.pos) < 0 && P.mode !== 'ultra' && GAME.state === 'play' && !GAME.holdStorm;
  const tick = STORM_TICK[Math.min(ZONE.i, 5)];
  if (out && !P.outside) { P.stormT = tick * 0.45; FX.popup('YOU ARE IN THE STORM', '#ff7ad9', true); Coach.once('outside'); haptic('medium'); }
  P.outside = out;
  if (out) {
    P.stormT += dt;
    if (P.stormT >= tick) { P.stormT = 0; if (P.shields <= 0) crash('STORM'); else loseShield('STORM', true); }
    if (Math.random() < 0.08) { stormMat.uniforms.uFlash.value = 1; AudioSys.noise(0.5, 0.08, 'lowpass', 900, 120, 1, { brown: true }); }
  }
  stormMat.uniforms.uFlash.value = damp(stormMat.uniforms.uFlash.value, 0, 6, rdt);
}
// how close the storm wall is (0 far .. 1 touching), for audio and screen tint
function stormNearness() { return clamp(1 - zoneDepth(P.pos) / 25, 0, 1); }

// ---------- director: enemies by circle ----------
const MAX_DRONES = [0, 2, 3, 3, 4, 4];
const MAX_JETS = [0, 0, 1, 2, 2, 3];
function directorUpdate(dt) {
  const i = Math.min(ZONE.i, 5);
  updateDrones(dt, GAME.holdStorm ? 0 : MAX_DRONES[i]);
  updateJets(dt, GAME.holdStorm ? 0 : MAX_JETS[i]);
  updateProjs(dt);
}
