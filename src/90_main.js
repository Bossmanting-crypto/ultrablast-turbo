// =================== MAIN: game flow, loop, app lifecycle ===================
const controlsEl = $('controls');
function resetWorld() {
  Object.assign(GAME, { time: 0, score: 0, combo: 0, comboT: 0, bestCombo: 0, meter: 0, crystals: 0, kills: 0, ultras: 0, perfectUltra: false, boosts: 0,
    slowT: 0, hitT: 0, ts: 1, crashed: false, holdStorm: false, circleHint: false, nextShield: 20, nextGate: 3 });
  resetPlayer(); resetZone(); clearBlast(); clearProjs();
  ULT.phase = 'off'; ULT.targets = [];
  for (const e of jets) { e.alive = false; e.j.g.visible = false; e.respawn = rand(2, 6); }
  for (const d of drones) { d.alive = false; d.g.visible = false; d.respawn = rand(1, 4); }
  for (const s of shieldPicks) { s.alive = false; s.g.visible = false; }
  // a friendly trail of crystals right on the launch line, the rest spread through the zone
  trails.forEach((tr, i) => { if (i === 0) { const path = simulatePath(P.pos, P.fwd, P.up, TRAIL_LEN, 4.6, 0, 16); tr.ids.forEach((id, k) => { const c = crystals[id]; c.home.copy(path[k].pos); c.pos.copy(c.home); c.alive = true; c.spawn = 1; }); tr.got = 0; tr.age = 0; tr.live = true; } else layTrail(tr, false); });
  for (const c of powers) { randomInZone(c.home, 10, false); c.pos.copy(c.home); c.vel.set(0, 0, 0); c.alive = true; c.spawn = 1; }
  clearGateRuns();
  regenTunnels(_v[5].copy(P.pos).addScaledVector(P.fwd, 30));
  ribbons.forEach(r => r.reset());
  DOOD.base = 0;
}
function startGame() {
  AudioSys.init(); AudioSys.resume();
  resetWorld();
  GAME.firstRun = !store.get('ubm_onboarded', false);
  GAME.holdStorm = GAME.firstRun;
  if (!GAME.firstRun) { spawnGateRun(P.pos, P.fwd, P.up, 0, true); GAME.nextGate = 4; }
  GAME.state = 'play'; showScreen(null);
  HUD.root.classList.add('on'); controlsEl.classList.add('on');
  popups.length = 0; crashes.length = 0; texts.length = 0;
  Coach.reset(GAME.firstRun);
  snapCamera();
  FX.eventText('LAUNCH!', 'gold', false);
  AudioSys.ui('start'); AudioSys.attachVoices(jets); haptic('medium');
}
function goHome() {
  GAME.state = 'home'; resetWorld(); showScreen('home'); refreshBest();
  HUD.root.classList.remove('on'); controlsEl.classList.remove('on'); Coach.hide();
  popups.length = 0; texts.length = 0; crashes.length = 0;
}
function finishRun(title, won) {
  if (GAME.state !== 'play') return;
  GAME.state = 'over'; GAME.won = won; GAME.overT = 0;
  clearBlast(); if (P.mode === 'ultra') { P.mode = 'fly'; ULT.phase = 'off'; }
  if (P.mode === 'tunnel') { P.tunnel.u.uActive.value = 0; P.mode = 'fly'; P.tunnel = null; }
  Coach.hide(); controlsEl.classList.remove('on'); resetTouch();
  const prev = bestScore(), best = Math.max(prev, GAME.score); store.set('ubm_best', best);
  const goals = [
    { label: 'Survive the storm', ok: won },
    { label: 'Reach a ×3 combo', ok: GAME.bestCombo >= 20 },
    { label: 'Land a perfect ULTRA', ok: GAME.perfectUltra }
  ];
  const res = { title, score: GAME.score, best, newBest: GAME.score > prev && GAME.score > 0, crystals: GAME.crystals, kills: GAME.kills, combo: '×' + Math.min(5, 1 + Math.floor(GAME.bestCombo / 5) * 0.5), ultras: GAME.ultras, goals, stars: goals.filter(g => g.ok).length };
  if (!won) res.title = `${title} · CIRCLE ${ZONE.i + 1}`;
  setTimeout(() => { if (GAME.state === 'over') { HUD.root.classList.remove('on'); popups.length = 0; texts.length = 0; crashes.length = 0; UI.results(res); AudioSys.ui(won ? 'start' : 'back'); } }, won ? 2600 : 2100);
}
function endGame(why) { FX.eventText(why === 'LOST IN THE STORM' ? 'STORMED OUT' : 'SHOT DOWN', 'red', false); AudioSys.event('fizzle'); finishRun(why, false); }
function winGame() {
  award(5000, 'STORM SURVIVED', 0, false);
  FX.eventText('STORM SURVIVED!', 'gold', false); FX.doodleFlash(1); FX.screenCrash(8, [0, 1, 2, 3]); FX.shockwave(P.pos, 30, GOLD, 1.2);
  AudioSys.event('complete'); AudioSys.pop(); haptic('heavy');
  finishRun('STORM SURVIVED', true);
}
function togglePause(on) {
  if (GAME.state === 'play' && on) {
    GAME.state = 'paused'; showScreen('pause'); AudioSys.ui('pause'); HUD.root.classList.remove('on'); controlsEl.classList.remove('on');
    resetTouch(); if (BLAST.charging) cancelCharge(); BLAST.mustRelease = false;
    fx2.setTransform(1, 0, 0, 1, 0, 0); fx2.clearRect(0, 0, fxc.width, fxc.height); doodleEl.style.opacity = 0; coachEl.hidden = true; ghost.hidden = true;
  } else if (GAME.state === 'paused' && !on) {
    GAME.state = 'play'; showScreen(null); AudioSys.ui('play'); HUD.root.classList.add('on'); controlsEl.classList.add('on');
    if (Coach.cur) Coach.show(Coach.cur, Coach.dur);
  }
}

// ---------- buttons ----------
const click = (id, fn, snd = 'select') => $(id).addEventListener('click', () => { AudioSys.init(); AudioSys.ui(snd); fn(); });
click('playBtn', startGame, 'start');
click('howBtn', () => { screenBack = 'home'; showScreen('howto'); });
click('howDone', () => showScreen(screenBack));
click('setBtn', () => showScreen('settings'));
click('setDone', () => showScreen('home'), 'back');
click('pauseBtn', () => togglePause(true), 'pause');
click('resumeBtn', () => togglePause(false), 'play');
click('restartBtn', () => { GAME.state = 'home'; startGame(); });
click('homeBtn', goHome, 'back');
click('againBtn', startGame, 'start');
click('resHome', goHome, 'back');
document.querySelectorAll('.btn').forEach(b => b.addEventListener('pointerdown', () => haptic('light')));
bindSettings();
const unlockAudio = () => { AudioSys.init(); AudioSys.resume(); removeEventListener('pointerdown', unlockAudio, true); removeEventListener('keydown', unlockAudio, true); };
addEventListener('pointerdown', unlockAudio, true); addEventListener('keydown', unlockAudio, true);

// ---------- lifecycle: pause when the app goes to the background, Android back button ----------
function onBackground() { if (GAME.state === 'play') togglePause(true); AudioSys.suspend(); }
function onForeground() { AudioSys.resume(); }
document.addEventListener('visibilitychange', () => { document.hidden ? onBackground() : onForeground(); });
function onBack() {
  if (GAME.state === 'play') togglePause(true);
  else if (GAME.state === 'paused') togglePause(false);
  else if (UI.screen === 'howto' || UI.screen === 'settings') { AudioSys.ui('back'); showScreen('home'); }
  else if (UI.screen === 'results') goHome();
  else if (IS_APP) { try { CAP.Plugins.App.exitApp(); } catch (e) { } }
}
try {
  const App = CAP && CAP.Plugins && CAP.Plugins.App;
  if (App) {
    App.addListener('backButton', onBack);
    App.addListener('appStateChange', s => { s.isActive ? onForeground() : onBackground(); });
    App.addListener('pause', onBackground); App.addListener('resume', onForeground);
  }
} catch (e) { }

// ---------- resize / orientation ----------
const rotateEl = $('rotate');
function onResize() {
  applyQuality();
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  pMat.uniforms.uScale.value = innerHeight * Q.dpr * 0.9; sizeFx();
  const portrait = innerHeight > innerWidth * 1.05;
  rotateEl.hidden = !(portrait && IS_TOUCH && !IS_APP);
  if (Coach.cur) Coach.place(TIPS[Coach.cur]);
}
addEventListener('resize', onResize); addEventListener('orientationchange', () => setTimeout(onResize, 200));

// ---------- per-frame ----------
function audioFrame(rdt) {
  const mode = GAME.state === 'paused' ? 'pause' : GAME.state === 'home' || GAME.state === 'boot' ? 'title' : GAME.state === 'over' ? 'over' : P.mode === 'ultra' ? 'ultra' : 'play';
  AudioSys.update({
    mode, speed: GAME.state === 'paused' ? 0 : P.speed, boost: P.mode === 'ultra' ? 55 : (P.mode === 'tunnel' ? 30 : P.boost), playing: GAME.state === 'play',
    wind: GAME.state !== 'play' ? 0 : (P.mode === 'tunnel' ? 1 : clamp((P.speed - 50) / 90, 0, 0.6)),
    charge: GAME.state === 'play' && BLAST.charging ? Math.min(1, BLAST.level / 3 + 0.1) : 0,
    slowmo: GAME.ts < 0.5, storm: GAME.state === 'play' ? stormNearness() : 0, inStorm: GAME.state === 'play' && P.outside
  });
  camera.getWorldDirection(_v[14]);
  AudioSys.updateListener(camera.position, _v[14], camera.up);
  AudioSys.updateVoices(rdt, P.pos, null, GAME.ts < 0.5 || GAME.state !== 'play');
}
function worldUpdate(dt, rdt) {
  placeMoons(GAME.utime);
  for (const m of moons) m.body.material.uniforms.uHit.value = damp(m.body.material.uniforms.uHit.value, 0, 6, dt);
  planetInner.rotation.y += dt * 0.3; planetShell.rotation.y -= dt * 0.05;
  for (let i = tunnels.length - 1; i >= 0; i--) {
    const t = tunnels[i];
    t.fade = t.dying ? Math.max(0, t.fade - dt * 0.8) : Math.min(1, t.fade + dt * 0.6);
    t.u.uFade.value = t.fade;
    if (t.dying && t.fade <= 0 && P.tunnel !== t) { t.dispose(); tunnels.splice(i, 1); }
  }
  updatePickups(dt, rdt); updateGates(dt, rdt);
}
function playUpdate(dt, rdt, evs) {
  GAME.time += dt;
  const tapped = evs.some(e => e.t === 'tap' || e.t === 'ultra' || e.t === 'stick');
  if (evs.some(e => e.t === 'ultra') && P.mode === 'fly') startUltra();
  P.invuln = Math.max(0, P.invuln - dt); P.hurtCd = Math.max(0, P.hurtCd - dt); P.stun = Math.max(0, P.stun - dt); P.tunCool = Math.max(0, P.tunCool - dt);
  BLAST.cd = Math.max(0, BLAST.cd - rdt);
  if (GAME.comboT > 0) { GAME.comboT -= dt; if (GAME.comboT <= 0) GAME.combo = 0; }
  if (!input.boostHeld) BLAST.mustRelease = false;
  switch (P.mode) {
    case 'fly':
      flyUpdate(dt);
      if (input.boostHeld && !BLAST.charging && BLAST.cd <= 0 && !BLAST.mustRelease) startCharge();
      if (BLAST.charging) { if (!input.boostHeld) releaseCharge(); else chargeTick(rdt); }
      tryCaptureTunnel();
      break;
    case 'tunnel':
      if (evs.some(e => e.t === 'boost') && BLAST.cd <= 0) { P.boost += 18; P.boostHold = 0.3; BLAST.cd = BLAST.cdMax; AudioSys.whoosh(true, 0.3); }
      tunnelUpdate(dt);
      break;
    case 'ultra': ultraUpdate(dt, rdt, tapped); break;
  }
  updateBlastRings(rdt, dt);
  collisions();
  updateStorm(dt, rdt);
  if (GAME.state !== 'play') return;
  directorUpdate(dt);
  worldUpdate(dt, rdt);
  Coach.update(rdt);
  if (P.mode === 'fly' || P.mode === 'tunnel') {
    const n = P.boost > 15 ? 2 : 1;
    for (let i = 0; i < n; i++) FX.spawn({ pos: _v[9].copy(P.pos).addScaledVector(P.fwd, -1.6).addScaledVector(P.right, (Math.random() < 0.5 ? 0.2 : -0.2)), vel: _v[10].copy(P.fwd).multiplyScalar(-6).add(randUnit(_v[11]).multiplyScalar(1.5)), color: P.boost > 15 ? GOLD : PEACH, size: P.boost > 15 ? rand(0.35, 0.6) : 0.3, life: 0.13, shape: P.boost > 25 && Math.random() < 0.3 ? pick([1, 2]) : 0, drag: 2 });
  }
}
const attract = { t: 0 };
function homeUpdate(dt, rdt) {
  GAME.time += dt; attract.t += dt;
  input.steerX = Math.sin(attract.t * 0.35) * 0.35; input.steerY = Math.sin(attract.t * 0.21) * 0.5;
  flyUpdate(dt); collisions();
  worldUpdate(dt, rdt);
  if (Math.random() < 0.6) FX.spawn({ pos: _v[9].copy(P.pos).addScaledVector(P.fwd, -1.6), vel: _v[10].copy(P.fwd).multiplyScalar(-6), color: PEACH, size: 0.35, life: 0.35, shape: 0 });
}
function adaptQuality(rdt) {
  if (window.__UB_DT || SETTINGS.quality !== 'auto' || Q.tier === 0 || GAME.state !== 'play') return;
  const fps = 1 / Math.max(rdt, 1e-3);
  Q.fpsAvg = lerp(Q.fpsAvg, fps, 0.05);
  if (Q.fpsAvg < 40) Q.lowFrames += rdt; else Q.lowFrames = Math.max(0, Q.lowFrames - rdt * 0.5);
  if (Q.lowFrames > 4) { Q.tier = 0; applyQuality(); FX.popup('GRAPHICS: BATTERY SAVER', '#b9a9c9'); }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = window.__UB_DT || clamp((now - last) / 1000, 0, 0.05); last = now; NOW += rdt;
  pollInput(); GAME.frames++;
  const evs = input.events.splice(0);
  for (const e of evs) if (e.t === 'pause') { if (GAME.state === 'play') togglePause(true); else if (GAME.state === 'paused') togglePause(false); }
  if (GAME.state === 'paused') { audioFrame(rdt); renderFrame(); draw2D(rdt); return; }
  let target = 1;
  if (GAME.slowT > 0) { GAME.slowT -= rdt; target = Math.min(target, GAME.slowV); }
  if (GAME.state === 'play' && P.mode === 'ultra' && ULT.phase === 'dash') target = Math.min(target, 0.8);
  GAME.ts = damp(GAME.ts, target, 16, rdt);
  let ts = GAME.ts; if (GAME.hitT > 0) { GAME.hitT -= rdt; ts = 0.05; }
  const dt = rdt * ts;
  GAME.utime += dt; U_TIME.value = GAME.utime;

  if (GAME.state === 'play') playUpdate(dt, rdt, evs);
  else if (GAME.state === 'home' || GAME.state === 'boot') homeUpdate(dt, rdt);
  else if (GAME.state === 'over') { GAME.time += dt; if (!GAME.crashed) { flyUpdate(dt); collisions(); } worldUpdate(dt, rdt); updateBlastRings(rdt, dt); directorUpdate(dt); }

  updateCamera(rdt, dt);
  updateNextRing();
  updateShipVisual(rdt);
  updateRibbons(rdt);
  updateParticles(dt * 0.85 + rdt * 0.15);
  updateShockwaves(dt); updateTentacles(rdt); updateSpeedLines(rdt);
  // grading: speed blur, purple storm tint, flash
  const sf = clamp((P.speed - 30) / 100, 0, 1), inStorm = GAME.state === 'play' && P.outside, near = GAME.state === 'play' ? stormNearness() : 0;
  LENS.blur = damp(LENS.blur, sf * 0.7 + (P.mode === 'tunnel' ? 0.4 : 0) + (P.mode === 'ultra' ? 0.8 : 0), 6, rdt);
  LENS.chroma = damp(LENS.chroma, 0.002 + sf * 0.004 + (P.mode === 'ultra' ? 0.006 : 0) + (inStorm ? 0.004 : 0), 6, rdt);
  LENS.sat = damp(LENS.sat, P.mode === 'ultra' ? 1.2 : inStorm ? 0.7 : 1, 6, rdt);
  const tint = inStorm ? [1.0 + 0.06 * Math.sin(NOW * 5), 0.72, 1.18] : (P.mode === 'ultra' ? [1.1, 0.98, 0.86] : (P.shields <= 0 && GAME.state === 'play' ? [1.08 + 0.06 * Math.sin(NOW * 6), 0.92, 0.92] : [1, 1, 1]));
  LENS.tint.r = damp(LENS.tint.r, tint[0], 5, rdt); LENS.tint.g = damp(LENS.tint.g, tint[1], 5, rdt); LENS.tint.b = damp(LENS.tint.b, tint[2], 5, rdt);
  LENS.flash.multiplyScalar(Math.exp(-rdt * 7));
  const u = lensPass.uniforms; u.uBlur.value = LENS.blur; u.uChroma.value = LENS.chroma; u.uSat.value = LENS.sat; u.uTint.value.copy(LENS.tint); u.uFlash.value.copy(LENS.flash); u.uAspect.value = innerWidth / innerHeight;
  bloom.strength = 0.72 + (P.mode === 'ultra' ? 0.2 : 0);
  skyMat.uniforms.uRot.value += rdt * 0.004;
  skyMat.uniforms.uStorm.value = damp(skyMat.uniforms.uStorm.value, inStorm ? 1 : near * 0.25, 3, rdt);
  skyMat.uniforms.uBright.value = damp(skyMat.uniforms.uBright.value, inStorm ? 0.7 : (P.mode === 'ultra' ? 1.08 : 0.94), 4, rdt);
  if (!Q.post) { // no lens pass on low tier: fold the tint into the sky so the storm still reads
    skyMat.uniforms.uTint.value.setRGB(LENS.tint.r, LENS.tint.g, LENS.tint.b);
  } else skyMat.uniforms.uTint.value.setRGB(1, 1, 1);
  audioFrame(rdt);
  renderFrame();
  draw2D(rdt);
  if (GAME.state === 'play' && (NOW * 20 | 0) !== (GAME._hudF | 0)) { GAME._hudF = NOW * 20; UI.update(); }
  adaptQuality(rdt);
}

// test hooks (harmless in play)
window.__UB = { GAME, P, ZONE, BLAST, ULT, Coach, startGame, goHome, startUltra, togglePause, input, FX, AudioSys, jets, drones, crystals, powers, gateRuns, tunnels, Q, applyQuality, camera, store, winGame, endGame, spawnGateRun };

// boot
goHome(); GAME.state = 'boot'; showScreen(null);
onResize();
Promise.race([document.fonts.load('150px Bungee').catch(() => { }), new Promise(r => setTimeout(r, 2500))]).then(() => {
  const waitSky = () => { if (ASSETS.sky || NOW > 6) { $('loading').hidden = true; GAME.state = 'home'; showScreen('home'); refreshBest(); } else setTimeout(waitSky, 100); };
  waitSky();
});
requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
