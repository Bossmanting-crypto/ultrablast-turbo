// =================== UI: HUD, radar, coach, screens ===================
const UI = {};
const HUD = {
  root: $('hud'), score: $('score'), mult: $('mult'), comboBar: $('comboBar'), shields: $('shields'), shieldEls: [...$('shields').children],
  storm: $('storm'), stormText: $('stormText'), circleNo: $('circleNo'), radar: $('radar'), pips: [...document.querySelectorAll('#boostBtn .pips i')],
  controls: $('controls'), cache: {}
};
const radarCtx = HUD.radar.getContext('2d');
function setText(el, key, v) { if (HUD.cache[key] !== v) { HUD.cache[key] = v; el.textContent = v; } }
function setCls(el, key, cls) { if (HUD.cache[key] !== cls) { if (HUD.cache[key]) el.classList.remove(HUD.cache[key]); if (cls) el.classList.add(cls); HUD.cache[key] = cls; } }
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
UI.multBump = () => { HUD.mult.classList.remove('bump'); void HUD.mult.offsetWidth; HUD.mult.classList.add('bump'); setTimeout(() => HUD.mult.classList.remove('bump'), 160); };
UI.shieldHit = () => { HUD.shields.classList.remove('hit'); void HUD.shields.offsetWidth; HUD.shields.classList.add('hit'); };

UI.update = () => {
  setText(HUD.score, 'score', GAME.score.toLocaleString());
  setText(HUD.mult, 'mult', '×' + GAME.mult());
  HUD.comboBar.style.transform = `scaleX(${clamp(GAME.comboT / COMBO_TIME, 0, 1).toFixed(3)})`;
  HUD.shieldEls.forEach((el, i) => el.classList.toggle('off', i >= P.shields));
  HUD.shields.classList.toggle('empty', P.shields <= 0);
  // storm pill
  let txt, cls;
  if (P.outside) { txt = 'IN THE STORM · GET BACK!'; cls = 'danger'; }
  else if (GAME.holdStorm) { txt = 'STORM ON HOLD'; cls = 'safe'; }
  else if (ZONE.state === 'wait') { const rem = ZONE.dur - ZONE.t; txt = `STORM IN ${fmtTime(rem)}`; cls = rem <= 10 ? 'closing' : 'safe'; }
  else if (ZONE.state === 'shrink') { txt = `STORM CLOSING ${fmtTime(ZONE.dur - ZONE.t)}`; cls = 'closing'; }
  else { txt = `HOLD ON ${fmtTime(ZONE.dur - ZONE.t)}`; cls = 'closing'; }
  setText(HUD.stormText, 'storm', txt); setCls(HUD.storm, 'stormCls', cls);
  setText(HUD.circleNo, 'circle', ZONE.state === 'final' ? 'FINAL CIRCLE' : `CIRCLE ${ZONE.i + 1} / ${STORM_PHASES.length}`);
  // boost button: gold ring = ULTRA meter, dark sweep = cooldown, pips = charge
  boostBtn.style.setProperty('--m', (GAME.meter / 100).toFixed(3));
  boostBtn.style.setProperty('--cd', (BLAST.cd / BLAST.cdMax).toFixed(3));
  boostBtn.classList.toggle('full', GAME.meter >= 100);
  HUD.pips.forEach((p, i) => p.classList.toggle('on', BLAST.charging && i < BLAST.level));
  const showUltra = GAME.state === 'play' && GAME.meter >= 100 && P.mode === 'fly';
  if (ultraBtn.hidden === showUltra) ultraBtn.hidden = !showUltra;
  drawRadar();
};

// ---------- radar: you at the centre, facing up ----------
function drawRadar() {
  const c = radarCtx, W = 240, C = 120, RANGE = 130, s = 112 / RANGE;
  c.clearRect(0, 0, W, W);
  c.save(); c.beginPath(); c.arc(C, C, 118, 0, TAU); c.clip();
  const sr = _v[10].copy(P.right).negate(), fw = P.fwd, up = P.up;
  const proj = (p, out) => { const rel = _v[11].subVectors(p, P.pos); out.x = C + rel.dot(sr) * s; out.y = C - rel.dot(fw) * s; out.h = rel.dot(up); return out; };
  const a = {}, b = {};
  // storm outside the circle
  proj(ZONE.c, a); const rcs = Math.sqrt(Math.max(0, ZONE.r * ZONE.r - a.h * a.h)) * s;
  c.fillStyle = 'rgba(150,60,230,0.42)'; c.fillRect(0, 0, W, W);
  c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(a.x, a.y, rcs, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over';
  c.strokeStyle = '#c58bff'; c.lineWidth = 3; c.beginPath(); c.arc(a.x, a.y, rcs, 0, TAU); c.stroke();
  if (ZONE.state !== 'final') {
    proj(ZONE.nc, b); const nrc = Math.sqrt(Math.max(0, ZONE.nr * ZONE.nr - b.h * b.h)) * s;
    c.setLineDash([8, 6]); c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 2.5; c.beginPath(); c.arc(b.x, b.y, Math.max(2, nrc), 0, TAU); c.stroke(); c.setLineDash([]);
  }
  // grid rings
  c.strokeStyle = 'rgba(244,198,160,0.14)'; c.lineWidth = 1; for (const r of [40, 80]) { c.beginPath(); c.arc(C, C, r, 0, TAU); c.stroke(); }
  // planet + moons
  proj(planet.pos, a); c.fillStyle = 'rgba(90,150,255,0.75)'; c.beginPath(); c.arc(a.x, a.y, PLANET_R * s, 0, TAU); c.fill();
  c.fillStyle = 'rgba(170,230,120,0.8)'; for (const m of moons) { proj(m.pos, a); c.beginPath(); c.arc(a.x, a.y, Math.max(3, m.r * s), 0, TAU); c.fill(); }
  const dot = (p, col, r, clampEdge = true) => {
    proj(p, a); let dx = a.x - C, dy = a.y - C; const L = Math.hypot(dx, dy);
    if (L > 108) { if (!clampEdge) return; dx *= 108 / L; dy *= 108 / L; }
    c.fillStyle = col; c.beginPath(); c.arc(C + dx, C + dy, r, 0, TAU); c.fill();
  };
  for (const r of gateRuns) { const g = r.gates.find(x => !x.passed && !x.missed); if (g) dot(g.pos, '#ffd27a', 5, false); }
  for (const s2 of shieldPicks) if (s2.alive) dot(s2.pos, '#8fe9ff', 6);
  for (const p of powers) if (p.alive) dot(p.pos, '#ff7ad9', 4, false);
  for (const e of jets) if (e.alive) dot(e.pos, '#b8f55a', 6);
  for (const d of drones) if (d.alive) dot(d.pos, '#ff4a8a', 5);
  // you
  c.fillStyle = '#ffe3c4'; c.beginPath(); c.moveTo(C, C - 10); c.lineTo(C + 7, C + 7); c.lineTo(C, C + 3); c.lineTo(C - 7, C + 7); c.closePath(); c.fill();
  c.restore();
}

// ---------- coach: onboarding steps on the first run, then one-time tips ----------
const coachEl = $('coach'), coachText = $('coachText'), ghost = $('ghostHand');
const TIPS = {
  steer: { html: 'Drag on the <b>left side</b> to steer', at: 'stickBase', hand: true },
  boost: { html: '<b>Hold BOOST</b> to charge up to 3 rings, then <b>let go</b> to blast off', at: 'boostBtn' },
  gates: { html: 'Fly through the <b>gold rings</b> for speed and points', at: null },
  crystals: { html: 'Grab <b>crystals</b>. They fill the gold <b>ULTRA</b> ring around BOOST', at: 'boostBtn' },
  storm: { html: '<b>The storm is coming.</b> Stay inside the circle. The <b>white ring</b> shows where it shrinks to next', at: 'storm', below: true },
  ultra: { html: '<b>ULTRA is ready!</b> Tap it to blast through every target nearby', at: 'ultraBtn' },
  ultratap: { html: 'Tap anywhere as each ring closes on its target for <b>PERFECT</b>', at: null, low: true },
  letgo: { html: '<b>Let go</b> of BOOST to blast through the rings', at: 'boostBtn' },
  outside: { html: "You're in the storm and losing shields. Follow the <b>pink arrow</b> back!", at: null, perRun: true },
  movein: { html: 'Head for the <b>white ring</b> before the storm reaches you', at: 'radar', below: true },
  enemy: { html: 'Enemy drones! <b>Boost into them</b> to take them down', at: null },
  tunnel: { html: 'Draft tunnel! It carries you. <b>Steer</b> to grab the gems', at: null },
  shield: { html: 'Grab the <b>blue hexagon</b> to get a shield back', at: null }
};
const ONBOARD = ['steer', 'boost', 'gates', 'crystals', 'storm'];
const Coach = {
  seen: new Set(store.get('ubm_tips', [])), runSeen: new Set(), queue: [], cur: null, t: 0, step: -1, stepT: 0, counts: {}, steerT: 0,
  reset(firstRun) {
    this.runSeen.clear(); this.queue.length = 0; this.hide(); this.counts = {}; this.steerT = 0;
    this.step = firstRun ? 0 : -1; this.stepT = 0;
    if (firstRun) this.show('steer', 999);
  },
  once(key) {
    const tip = TIPS[key]; if (!tip || GAME.state !== 'play') return;
    if (tip.perRun ? this.runSeen.has(key) : this.seen.has(key)) return;
    if (this.step >= 0 && ONBOARD.includes(key)) return;
    this.runSeen.add(key);
    if (!tip.perRun) { this.seen.add(key); store.set('ubm_tips', [...this.seen]); }
    if (this.step >= 0 || (this.cur && this.t < 2.2)) { if (!this.queue.includes(key)) this.queue.push(key); return; }
    this.show(key, 5);
  },
  done(key) {
    if (this.step >= 0 && ONBOARD[this.step] === key) this.advance();
    if (this.cur === key && this.step < 0) this.hide();
  },
  count(key, n = 1) {
    this.counts[key] = (this.counts[key] || 0) + n;
    if (this.step >= 0) {
      const k = ONBOARD[this.step];
      if (k === 'gates' && key === 'gate' && this.counts.gate >= 2) this.advance();
      if (k === 'crystals' && key === 'crystal' && this.counts.crystal >= 4) this.advance();
    }
  },
  advance() {
    this.step++; this.stepT = 0; AudioSys.step(); haptic('light');
    if (this.step >= ONBOARD.length) { this.step = -1; this.hide(); store.set('ubm_onboarded', true); GAME.holdStorm = false; return; }
    const k = ONBOARD[this.step];
    if (k === 'gates') { clearGateRuns(); this.pendingGates = true; GAME.nextGate = 12; }
    if (k === 'storm') { GAME.holdStorm = false; ZONE.t = Math.max(ZONE.t, ZONE.dur - 16); GAME.circleHint = true; }
    this.show(k, 999);
  },
  show(key, dur) {
    const tip = TIPS[key]; this.cur = key; this.t = 0; this.dur = dur;
    coachText.innerHTML = tip.html; coachEl.hidden = false;
    coachEl.style.animation = 'none'; void coachEl.offsetWidth; coachEl.style.animation = '';
    this.place(tip);
    ghost.hidden = !tip.hand;
    if (tip.hand) { const r = $('stickBase').getBoundingClientRect(); ghost.style.left = (r.left + r.width / 2 - 27) + 'px'; ghost.style.top = (r.top + r.height / 2 - 27) + 'px'; }
  },
  place(tip) {
    const el = tip.at && $(tip.at);
    const r = el && !el.hidden && el.getBoundingClientRect();
    coachEl.classList.toggle('noarrow', !r || !r.width);
    coachEl.classList.toggle('below', !!(r && tip.below));
    const bw = coachEl.offsetWidth, bh = coachEl.offsetHeight, pad = 12;
    let x, y;
    if (r && r.width) {
      const cx = r.left + r.width / 2;
      x = clamp(cx - bw / 2, pad, innerWidth - bw - pad);
      y = tip.below ? r.bottom + 14 : r.top - bh - 14;
      if (y < pad) y = r.bottom + 14;
      coachEl.style.setProperty('--ax', clamp(cx - x, 16, bw - 16) + 'px');
    } else { x = (innerWidth - bw) / 2; y = tip.low ? innerHeight * 0.72 - bh : innerHeight * 0.2; }
    coachEl.style.left = x + 'px'; coachEl.style.top = y + 'px';
  },
  hide() { this.cur = null; coachEl.hidden = true; ghost.hidden = true; },
  update(rdt) {
    if (GAME.state !== 'play') { if (!coachEl.hidden) coachEl.hidden = true; return; }
    if (this.cur && coachEl.hidden && P.mode !== 'ultra') coachEl.hidden = false;
    if (P.mode === 'ultra' && this.cur !== 'ultratap') coachEl.hidden = true;
    this.t += rdt; this.stepT += rdt;
    if (this.step >= 0) {
      const k = ONBOARD[this.step];
      if (k === 'steer') { if (Math.hypot(input.steerX, input.steerY) > 0.3) this.steerT += rdt; if (this.steerT > 1.2 || this.stepT > 20) this.advance(); }
      else if (k === 'boost' && this.stepT > 25) this.advance();
      else if ((k === 'gates' || k === 'crystals') && this.stepT > 18) this.advance();
      if (k === 'gates' && this.pendingGates && P.mode === 'fly' && P.boost < 10 && !BLAST.dash.length) { this.pendingGates = false; this.stepT = 0; spawnGateRun(P.pos, P.fwd, P.up, 0, true); }
      else if (k === 'storm' && this.stepT > 7) this.advance();
      if (this.cur && TIPS[this.cur].at) this.place(TIPS[this.cur]);
      return;
    }
    if (this.cur && this.t > this.dur) this.hide();
    if (!this.cur && this.queue.length) this.show(this.queue.shift(), 5);
    if (this.cur && TIPS[this.cur].at) this.place(TIPS[this.cur]);
  }
};

// ---------- screens ----------
const SCREENS = ['home', 'howto', 'settings', 'pause', 'results'];
let screenBack = 'home';
function showScreen(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  UI.screen = id;
  if (id && !IS_TOUCH) { const b = $(id).querySelector('.btn'); try { b && b.focus({ preventScroll: true }); } catch (e) { } }
}
function bestScore() { return store.get('ubm_best', 0); }
function refreshBest() { const b = bestScore(); $('bestLine').textContent = b ? `BEST ${b.toLocaleString()}` : ''; }
UI.results = (r) => {
  $('resTitle').textContent = r.title;
  $('resScore').textContent = r.score.toLocaleString();
  $('resBest').textContent = r.newBest ? 'NEW BEST!' : `BEST ${r.best.toLocaleString()}`;
  $('rCrystals').textContent = r.crystals; $('rKills').textContent = r.kills; $('rCombo').textContent = r.combo; $('rUltra').textContent = r.ultras;
  const stars = [...$('stars').children];
  stars.forEach((s, i) => s.classList.toggle('on', i < r.stars));
  const g = $('goals');
  g.innerHTML = r.goals.map(x => `<li class="${x.ok ? 'ok' : ''}">${x.label}</li>`).join('');
  showScreen('results');
};
// settings
function syncSettingsUI() {
  for (const id of ['volMusic', 'volMusic2']) $(id).value = Math.round(SETTINGS.music * 100);
  for (const id of ['volSfx', 'volSfx2']) $(id).value = Math.round(SETTINGS.sfx * 100);
  $('qual').value = SETTINGS.quality; $('invY').checked = SETTINGS.invertY; $('haptic').checked = SETTINGS.haptics;
}
function bindSettings() {
  const vol = (src) => { SETTINGS.music = $(src[0]).value / 100; SETTINGS.sfx = $(src[1]).value / 100; AudioSys.setVolumes({ music: SETTINGS.music, sfx: SETTINGS.sfx }); saveSettings(); syncSettingsUI(); };
  ['volMusic', 'volSfx'].forEach(id => $(id).addEventListener('input', () => vol(['volMusic', 'volSfx'])));
  ['volMusic2', 'volSfx2'].forEach(id => $(id).addEventListener('input', () => vol(['volMusic2', 'volSfx2'])));
  ['volSfx', 'volSfx2'].forEach(id => $(id).addEventListener('change', () => AudioSys.ui('select')));
  $('qual').addEventListener('change', e => { SETTINGS.quality = e.target.value; saveSettings(); Q.tier = SETTINGS.quality === 'low' ? 0 : 1; Q.lowFrames = 0; applyQuality(); AudioSys.ui('select'); });
  $('invY').addEventListener('change', e => { SETTINGS.invertY = e.target.checked; saveSettings(); AudioSys.ui('select'); });
  $('haptic').addEventListener('change', e => { SETTINGS.haptics = e.target.checked; saveSettings(); haptic('medium'); AudioSys.ui('select'); });
  syncSettingsUI();
  AudioSys.setVolumes({ music: SETTINGS.music, sfx: SETTINGS.sfx });
}
