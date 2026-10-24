// =================== AUDIO ===================
// Samples: uisfx (CC0) interface + cinematic packs, Kenney impact / sci-fi sounds (CC0, via NetForge),
// "Battle Theme A" by cynicmusic (CC0). The jet engine is a live layered model so it can follow speed,
// boost and slow-mo continuously; enemy jets are positional with doppler. The storm has its own drone.
const SFX_NAMES = ['ui_hover', 'ui_select', 'ui_back', 'ui_start', 'ui_pause', 'ui_play', 'ui_warning', 'pick_crystal', 'pick_gem', 'pick_homer', 'pick_weapon', 'row_clear', 'weapon',
  'ring_add', 'puzzle_start', 'puzzle_hit', 'ev_match', 'ev_hyper', 'ev_ultra', 'ev_orb', 'ev_tunnel', 'ev_boom', 'ev_fizzle', 'ev_warning', 'ev_slam', 'ev_complete', 'sc_match',
  'boom_low', 'kill_soft', 'hurt', 'impact', 'hit_light', 'laser', 'bell', 'music'];
const MUSIC_LOOP = { start: 3.364, end: 85.7658 };

const AudioSys = (() => {
  const A = {};
  let ctx = null, master, comp, sfx, ui, musicBus, musicFilter, musicGain, engineBus, muted = false;
  let vols = { music: 0.7, sfx: 0.9 };
  const raw = {}, buf = {};
  let white, brown, pink;
  const E = {}; // engine nodes
  let musicSrc = null, musicRate = 1, duckUntil = 0;
  const voices = [];
  A.prefetch = () => {
    for (const n of SFX_NAMES) fetch(`assets/sfx/${n}.mp3`).then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (!b) return; raw[n] = b; if (ctx) decode(n); }).catch(() => { });
  };
  function decode(n) {
    const b = raw[n]; if (!b) return; raw[n] = null;
    try {
      ctx.decodeAudioData(b, d => { buf[n] = d; if (n === 'music') startMusic(); }, () => { });
    } catch (e) { }
  }
  function loopNoise(sec, kind) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
    }
    const X = Math.floor(ctx.sampleRate * 0.05); // seamless loop: crossfade the ends
    for (let i = 0; i < X; i++) { const t = i / X; d[len - X + i] = d[len - X + i] * (1 - t) + d[i] * t; }
    return b;
  }
  function loopSrc(b, rate = 1) { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * b.duration); return s; }
  A.init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = vols.sfx; sfx.connect(master);
    ui = ctx.createGain(); ui.gain.value = vols.sfx * 0.8; ui.connect(master);
    musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 2400; musicFilter.Q.value = 0.7;
    musicGain = ctx.createGain(); musicGain.gain.value = 0;
    musicBus = ctx.createGain(); musicBus.gain.value = vols.music * 0.55;
    musicGain.connect(musicFilter); musicFilter.connect(musicBus); musicBus.connect(master);
    engineBus = ctx.createGain(); engineBus.gain.value = 0; engineBus.connect(sfx);
    white = loopNoise(2, 'white'); brown = loopNoise(4, 'brown'); pink = loopNoise(4, 'pink');
    buildEngine();
    for (const n of SFX_NAMES) decode(n);
  };
  function buildEngine() {
    // 1. low roar: brown noise, lowpassed, with a rumble peak
    E.roarLP = ctx.createBiquadFilter(); E.roarLP.type = 'lowpass'; E.roarLP.frequency.value = 400; E.roarLP.Q.value = 0.4;
    E.roarPk = ctx.createBiquadFilter(); E.roarPk.type = 'peaking'; E.roarPk.frequency.value = 85; E.roarPk.gain.value = 4; E.roarPk.Q.value = 0.9;
    E.roarG = ctx.createGain(); E.roarG.gain.value = 0.2;
    loopSrc(brown).connect(E.roarLP); E.roarLP.connect(E.roarPk); E.roarPk.connect(E.roarG); E.roarG.connect(engineBus);
    // 2. airflow / exhaust hiss: pink noise band
    E.airBP = ctx.createBiquadFilter(); E.airBP.type = 'bandpass'; E.airBP.frequency.value = 1800; E.airBP.Q.value = 0.55;
    E.airG = ctx.createGain(); E.airG.gain.value = 0.02;
    loopSrc(pink).connect(E.airBP); E.airBP.connect(E.airG); E.airG.connect(engineBus);
    // 3. turbine whine: inharmonic partials with a slow wobble
    E.whineG = ctx.createGain(); E.whineG.gain.value = 0.01;
    E.whineHP = ctx.createBiquadFilter(); E.whineHP.type = 'highpass'; E.whineHP.frequency.value = 500;
    E.whineHP.connect(E.whineG); E.whineG.connect(engineBus);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.7; const lfoG = ctx.createGain(); lfoG.gain.value = 5; lfo.connect(lfoG); lfo.start();
    E.whine = [[1, 0.5, 'sine'], [2.003, 0.22, 'sine'], [3.41, 0.08, 'triangle'], [5.02, 0.035, 'sine']].map(([m, g, type]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = 600 * m; const gg = ctx.createGain(); gg.gain.value = g;
      lfoG.connect(o.frequency); o.connect(gg); gg.connect(E.whineHP); o.start(); return { o, m };
    });
    // 4. afterburner: driven noise band + crackle
    E.burnBP = ctx.createBiquadFilter(); E.burnBP.type = 'bandpass'; E.burnBP.frequency.value = 420; E.burnBP.Q.value = 0.6;
    E.burnSh = ctx.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3.2); } E.burnSh.curve = curve;
    E.burnG = ctx.createGain(); E.burnG.gain.value = 0;
    loopSrc(brown, 1.6).connect(E.burnBP); E.burnBP.connect(E.burnSh); E.burnSh.connect(E.burnG); E.burnG.connect(engineBus);
    // 5. tunnel wind
    E.windBP = ctx.createBiquadFilter(); E.windBP.type = 'bandpass'; E.windBP.frequency.value = 700; E.windBP.Q.value = 1.2;
    E.windG = ctx.createGain(); E.windG.gain.value = 0;
    loopSrc(pink, 0.9).connect(E.windBP); E.windBP.connect(E.windG); E.windG.connect(sfx);
    // 6. charge riser (filtered saw + shimmer)
    E.riserO = ctx.createOscillator(); E.riserO.type = 'sawtooth'; E.riserO.frequency.value = 160;
    E.riserO2 = ctx.createOscillator(); E.riserO2.type = 'sawtooth'; E.riserO2.frequency.value = 161.5;
    E.riserF = ctx.createBiquadFilter(); E.riserF.type = 'lowpass'; E.riserF.frequency.value = 800; E.riserF.Q.value = 7;
    E.riserG = ctx.createGain(); E.riserG.gain.value = 0;
    E.riserO.connect(E.riserF); E.riserO2.connect(E.riserF); E.riserF.connect(E.riserG); E.riserG.connect(sfx); E.riserO.start(); E.riserO2.start();
    // 7. storm drone: low rumble + a slow, detuned moan that swells when you are near or inside the storm
    E.stormLP = ctx.createBiquadFilter(); E.stormLP.type = 'lowpass'; E.stormLP.frequency.value = 260; E.stormLP.Q.value = 0.8;
    E.stormG = ctx.createGain(); E.stormG.gain.value = 0;
    loopSrc(brown, 0.6).connect(E.stormLP); E.stormLP.connect(E.stormG); E.stormG.connect(sfx);
    E.moanG = ctx.createGain(); E.moanG.gain.value = 0;
    E.moanF = ctx.createBiquadFilter(); E.moanF.type = 'bandpass'; E.moanF.frequency.value = 340; E.moanF.Q.value = 4;
    E.moan = [55, 55.8, 82.6].map(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(E.moanF); o.start(); return o; });
    E.moanF.connect(E.moanG); E.moanG.connect(sfx);
    engineBus.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
  }
  // ---- positional enemy jets ----
  A.attachVoices = (list) => {
    if (!ctx || voices.length) return;
    for (const e of list) {
      const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 7; p.rolloffFactor = 1.4; p.maxDistance = 300;
      const g = ctx.createGain(); g.gain.value = 0;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.7;
      loopSrc(brown, 1.3).connect(bp); bp.connect(g);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 900; const og = ctx.createGain(); og.gain.value = 0.05; o.connect(og); og.connect(g); o.start();
      g.connect(p); p.connect(sfx);
      voices.push({ e, p, g, o, bp, prevD: 999, flyCd: 0 });
    }
  };
  function setPos(p, v, t) { if (p.positionX) { p.positionX.setTargetAtTime(v.x, t, 0.03); p.positionY.setTargetAtTime(v.y, t, 0.03); p.positionZ.setTargetAtTime(v.z, t, 0.03); } else p.setPosition(v.x, v.y, v.z); }
  A.updateListener = (cam, fwd, up) => {
    if (!ctx) return; const L = ctx.listener, t = ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(cam.x, t, 0.02); L.positionY.setTargetAtTime(cam.y, t, 0.02); L.positionZ.setTargetAtTime(cam.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.setTargetAtTime(up.x, t, 0.02); L.upY.setTargetAtTime(up.y, t, 0.02); L.upZ.setTargetAtTime(up.z, t, 0.02);
    } else { L.setPosition(cam.x, cam.y, cam.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
  };
  A.updateVoices = (dt, playerPos, playerVel, slow) => {
    if (!ctx) return; const t = ctx.currentTime;
    for (const v of voices) {
      const e = v.e;
      v.g.gain.setTargetAtTime(e.alive ? 0.55 : 0, t, 0.15);
      if (!e.alive) continue;
      setPos(v.p, e.pos, t);
      const d = e.pos.distanceTo(playerPos);
      // doppler from closing speed
      const closing = (v.prevD - d) / Math.max(dt, 1e-3); v.prevD = d;
      const dop = clamp(1 + closing / 160, 0.7, 1.4);
      v.o.frequency.setTargetAtTime(880 * dop * (slow ? 0.6 : 1), t, 0.05); v.bp.frequency.setTargetAtTime(620 * dop, t, 0.08);
      v.flyCd -= dt;
      if (d < 11 && closing < -5 && v.flyCd <= 0) { v.flyCd = 2.5; flyby(v.p); }
    }
  };
  function flyby(panner) {
    const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = pink;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(380, t + 0.7);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    s.connect(f); f.connect(g); g.connect(panner); s.start(t, Math.random() * 2); s.stop(t + 0.85);
  }
  // ---- music ----
  function startMusic() {
    if (!ctx || !buf.music || musicSrc) return;
    musicSrc = ctx.createBufferSource(); musicSrc.buffer = buf.music; musicSrc.loop = true; musicSrc.loopStart = MUSIC_LOOP.start; musicSrc.loopEnd = MUSIC_LOOP.end;
    musicSrc.connect(musicGain); musicSrc.start(ctx.currentTime + 0.05, 0);
    musicGain.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
  }
  A.duck = (amt = 0.45, dur = 0.5) => { if (!ctx) return; duckUntil = ctx.currentTime + dur; musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.setTargetAtTime(1 - amt, ctx.currentTime, 0.02); };
  // ---- sample playback ----
  A.play = (n, o = {}) => {
    const b = buf[n]; if (!ctx || !b) return null;
    const t = ctx.currentTime + (o.delay || 0);
    const s = ctx.createBufferSource(); s.buffer = b;
    s.playbackRate.value = (o.rate || 1) * (1 + (o.jit != null ? o.jit : 0.025) * (Math.random() * 2 - 1));
    const g = ctx.createGain(); g.gain.value = o.vol != null ? o.vol : 0.8;
    let node = s;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(g);
    if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(o.bus || sfx); } else g.connect(o.bus || sfx);
    s.start(t); return s;
  };
  // ---- synth primitives ----
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  A.tone = (f, dur = 0.2, type = 'sine', vol = 0.2, o = {}) => {
    if (!ctx) return; const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    const g = ctx.createGain(); env(g, t, o.a || 0.005, vol, dur);
    let node = osc; if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; osc.connect(fl); node = fl; }
    node.connect(g); g.connect(o.bus || sfx); osc.start(t); osc.stop(t + dur + 0.05);
  };
  A.noise = (dur = 0.3, vol = 0.2, type = 'lowpass', f0 = 2000, f1 = null, q = 1, o = {}) => {
    if (!ctx) return; const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = o.brown ? brown : white; src.playbackRate.value = o.rate || 1;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f0, t); fl.Q.value = q;
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, o.a || 0.004, vol, dur);
    src.connect(fl); fl.connect(g); g.connect(o.bus || sfx); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  };
  const PENTA = [0, 3, 5, 7, 10];
  const semis = i => PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
  A.note = (i, base = 440) => base * Math.pow(2, semis(i) / 12);
  const st = i => Math.pow(2, semis(i) / 12);
  // ---- semantic cues ----
  A.ui = (k) => { const m = { hover: ['ui_hover', 0.35], select: ['ui_select', 0.6], back: ['ui_back', 0.6], start: ['ui_start', 0.8], pause: ['ui_pause', 0.6], play: ['ui_play', 0.6], warning: ['ui_warning', 0.5] }[k]; if (m) A.play(m[0], { vol: m[1], bus: ui, jit: 0.01 }); };
  A.pickup = (combo) => { A.play('pick_crystal', { vol: 0.42, rate: 0.85 * st(combo % 12), jit: 0 }); };
  A.gem = (i) => { A.play('pick_gem', { vol: 0.4, rate: 0.9 * st(i % 12), jit: 0 }); };
  A.homer = () => { A.play('pick_homer', { vol: 0.55 }); A.whoosh(true, 0.15); };
  A.rowClear = () => A.play('row_clear', { vol: 0.7 });
  A.weapon = () => { A.play('pick_weapon', { vol: 0.7 }); A.play('weapon', { vol: 0.5, delay: 0.08 }); };
  A.ring = (i) => { A.play('ring_add', { vol: 0.6, rate: [1, 1.122, 1.26, 1.498][Math.min(3, i - 1)] || 1, jit: 0 }); A.tone(A.note(i * 2, 520), 0.45, 'sine', 0.07); };
  A.ringPass = (i) => { A.whoosh(true, 0.3); A.tone(55, 0.22, 'sine', 0.35, { to: 38 }); A.play('ring_add', { vol: 0.35, rate: 1.5 + i * 0.15, jit: 0 }); };
  A.boom = (big = 1) => { A.play('boom_low', { vol: 0.9 * Math.min(1.3, big) }); A.play('ev_boom', { vol: 0.55 }); A.tone(110 * big, 0.6, 'sine', 0.4, { to: 30 }); A.noise(0.7, 0.28, 'lowpass', 3000, 140, 1, { brown: true }); A.duck(0.5, 0.6); };
  A.explode = () => { A.play('kill_soft', { vol: 0.8 }); A.play('boom_low', { vol: 0.35, rate: 1.4 }); A.noise(0.4, 0.18, 'lowpass', 2400, 200); };
  A.shatter = () => { A.play('pick_gem', { vol: 0.35, rate: 2.2 }); A.play('pick_crystal', { vol: 0.3, rate: 1.7, delay: 0.03 }); A.play('pick_gem', { vol: 0.22, rate: 2.9, delay: 0.07 }); A.noise(0.3, 0.16, 'highpass', 5000, 10000, 1); for (let i = 0; i < 6; i++) A.tone(rand(3000, 7000), rand(0.04, 0.12), 'sine', 0.025, { delay: i * 0.025 }); };
  A.whoosh = (up = true, vol = 0.22) => { A.noise(0.55, vol, 'bandpass', up ? 260 : 3200, up ? 3600 : 260, 2.2, { brown: false }); };
  A.slam = () => { A.play('ev_slam', { vol: 0.7 }); A.duck(0.5, 0.5); };
  A.event = (k) => { const m = { match: 'ev_match', hyper: 'ev_hyper', ultra: 'ev_ultra', orb: 'ev_orb', tunnel: 'ev_tunnel', fizzle: 'ev_fizzle', warning: 'ev_warning', complete: 'ev_complete' }[k]; if (m) A.play(m, { vol: 0.85, jit: 0 }); };
  A.success = () => A.event('match');
  A.fail = () => A.event('fizzle');
  A.tick = (hi) => A.play('ui_hover', { vol: hi ? 0.5 : 0.32, rate: hi ? 1.6 : 1.25, jit: 0, bus: ui });
  A.click = () => A.play('puzzle_hit', { vol: 0.6, rate: 1.2 });
  A.puzzleStart = () => { A.play('puzzle_start', { vol: 0.7 }); A.tone(220, 0.6, 'sine', 0.12, { to: 880 }); };
  A.puzzleHit = (i) => A.play('puzzle_hit', { vol: 0.75, rate: [1, 1.19, 1.41, 1.68][Math.min(3, i - 1)] || 1, jit: 0 });
  A.hit = (n) => { A.play('sc_match', { vol: 0.75, rate: Math.min(1.8, 0.9 + n * 0.06), jit: 0 }); A.play('impact', { vol: 0.5 }); A.tone(70, 0.2, 'sine', 0.3, { to: 35 }); };
  A.perfect = () => A.play('pick_gem', { vol: 0.45, rate: 1.5, jit: 0 });
  A.pop = () => { A.tone(300, 0.14, 'sine', 0.3, { to: 1600 }); A.noise(0.45, 0.22, 'highpass', 1200, 8000, 1); A.play('boom_low', { vol: 0.8 }); A.whoosh(true, 0.35); A.duck(0.6, 0.7); };
  A.hurt = () => { A.play('hurt', { vol: 0.8 }); A.noise(0.15, 0.14, 'bandpass', 1500, 400, 2); };
  A.zap = () => A.noise(0.06, 0.1, 'highpass', 3000 + Math.random() * 3000);
  A.shot = (dist = 20) => A.play('laser', { vol: 0.5 * clamp(18 / Math.max(dist, 6), 0.08, 1), rate: 0.9 });
  A.alarm = (vol = 0.12) => {
    if (!ctx) return; const t = ctx.currentTime;
    for (let k = 0; k < 2; k++) {
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
      car.type = 'sine'; car.frequency.value = k ? 740 : 520; mod.frequency.value = k ? 9 : 6; mg.gain.value = k ? 180 : 140;
      mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(sfx);
      const s = t + k * 0.42; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(vol, s + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.8);
      car.start(s); mod.start(s); car.stop(s + 0.85); mod.stop(s + 0.85);
    }
  };
  A.rankUp = (r) => { A.play('pick_weapon', { vol: 0.5, rate: 0.85 + r * 0.07, jit: 0 }); if (r >= 4) A.play('ev_slam', { vol: 0.35, rate: 1.2 }); };
  A.rankDown = () => A.play('ui_back', { vol: 0.45, rate: 0.8, jit: 0 });
  A.cellFull = () => { A.play('ring_add', { vol: 0.7, rate: 1.9, jit: 0 }); A.play('pick_gem', { vol: 0.4, rate: 1.2, delay: 0.06, jit: 0 }); };
  A.turboReady = () => { A.play('weapon', { vol: 0.7 }); A.play('row_clear', { vol: 0.4, delay: 0.1 }); };
  A.ready = () => A.play('ui_hover', { vol: 0.45, rate: 1.4, jit: 0, bus: ui });
  A.vent = () => A.noise(0.45, 0.07, 'highpass', 2600, 900, 0.7);
  A.overheat = () => { A.play('ui_warning', { vol: 0.7 }); A.noise(1.6, 0.18, 'highpass', 4000, 700, 0.7); };
  A.strobe = (ok) => ok ? A.play('puzzle_hit', { vol: 0.85, rate: 1.6, jit: 0 }) : A.play('ui_back', { vol: 0.5 });
  A.step = () => { A.play('ui_select', { vol: 0.6, bus: ui }); A.play('pick_gem', { vol: 0.3, rate: 1.4, delay: 0.05 }); };
  A.crackle = (amt) => { if (!ctx || Math.random() > amt * 0.6) return; A.noise(rand(0.02, 0.05), 0.06 + amt * 0.1, 'bandpass', rand(500, 1400), null, 1.5, { brown: true }); };
  // ---- per-frame ----
  A.update = (s) => {
    if (!ctx) return; const t = ctx.currentTime;
    const sp = clamp(s.speed / 140, 0, 1), bo = clamp(s.boost / 60, 0, 1), slow = s.slowmo ? 1 : 0;
    const k = s.playing ? 1 : 0.35;
    // engine
    E.roarLP.frequency.setTargetAtTime((220 + sp * 1300 + bo * 700) * (slow ? 0.45 : 1), t, 0.12);
    E.roarG.gain.setTargetAtTime((0.1 + sp * 0.15 + bo * 0.08) * k, t, 0.15);
    E.airBP.frequency.setTargetAtTime(1500 + sp * 3200, t, 0.2);
    E.airG.gain.setTargetAtTime((0.015 + sp * sp * 0.11) * k * (slow ? 0.4 : 1), t, 0.15);
    const wf = (480 + sp * 1350 + bo * 250) * (slow ? 0.55 : 1);
    for (const w of E.whine) w.o.frequency.setTargetAtTime(wf * w.m, t, slow ? 0.25 : 0.45);
    E.whineG.gain.setTargetAtTime((0.016 + sp * 0.03) * k, t, 0.2);
    E.burnG.gain.setTargetAtTime(bo * 0.15 * k, t, 0.08);
    E.burnBP.frequency.setTargetAtTime(360 + bo * 300, t, 0.1);
    if (s.playing && bo > 0.15) A.crackle(bo);
    // world
    E.windG.gain.setTargetAtTime(s.wind * 0.3, t, 0.15); E.windBP.frequency.setTargetAtTime(500 + s.wind * 1500 + sp * 500, t, 0.2);
    E.riserG.gain.setTargetAtTime(s.charge > 0 ? 0.025 + s.charge * 0.04 : 0, t, 0.05);
    E.riserO.frequency.setTargetAtTime(150 + s.charge * 600, t, 0.06); E.riserO2.frequency.setTargetAtTime(151.5 + s.charge * 606, t, 0.06);
    E.riserF.frequency.setTargetAtTime(500 + s.charge * 3200, t, 0.06);
    const stm = clamp(s.storm || 0, 0, 1), inside = s.inStorm ? 1 : 0;
    E.stormG.gain.setTargetAtTime((stm * 0.22 + inside * 0.25) * k, t, 0.3);
    E.stormLP.frequency.setTargetAtTime(220 + inside * 500 + stm * 200, t, 0.3);
    E.moanG.gain.setTargetAtTime((stm * 0.012 + inside * 0.035) * k, t, 0.4);
    E.moanF.frequency.setTargetAtTime(300 + Math.sin(t * 0.7) * 120 + inside * 200, t, 0.2);
    // music: tape-slow in slow-mo, muffled on menus, lifted in supercut
    if (musicSrc) {
      const rate = s.slowmo ? 0.82 : 1;
      musicSrc.playbackRate.setTargetAtTime(rate, t, 0.12);
      const lp = s.mode === 'title' ? 1600 : s.mode === 'pause' ? 500 : s.mode === 'over' ? 900 : s.slowmo ? 1200 : s.inStorm ? 2200 : 18000;
      musicFilter.frequency.setTargetAtTime(lp, t, 0.12);
      const lvl = s.mode === 'ultra' ? 1.15 : (s.mode === 'title' ? 0.8 : 1);
      if (t > duckUntil) musicGain.gain.setTargetAtTime(lvl, t, 0.25);
    }
  };
  A.setMuted = m => { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05); };
  A.isMuted = () => muted;
  A.setVolumes = (v) => { vols = { ...vols, ...v }; if (ctx) { sfx.gain.setTargetAtTime(vols.sfx, ctx.currentTime, 0.05); ui.gain.setTargetAtTime(vols.sfx * 0.8, ctx.currentTime, 0.05); musicBus.gain.setTargetAtTime(vols.music * 0.55, ctx.currentTime, 0.05); } };
  A.getVolumes = () => ({ ...vols });
  A.suspend = () => { try { ctx && ctx.state === 'running' && ctx.suspend(); } catch (e) { } };
  A.resume = () => { try { ctx && ctx.state === 'suspended' && ctx.resume(); } catch (e) { } };
  A.shield = () => { A.play('pick_weapon', { vol: 0.6, rate: 1.2 }); A.tone(660, 0.3, 'sine', 0.08, { to: 1320 }); };
  A.shieldLost = () => { A.play('hurt', { vol: 0.85 }); A.play('impact', { vol: 0.5 }); A.noise(0.2, 0.16, 'bandpass', 1800, 300, 2); };
  A.gate = (i) => { A.play('ring_add', { vol: 0.55, rate: 1 + Math.min(i, 6) * 0.09, jit: 0 }); A.whoosh(true, 0.25); A.tone(A.note(i + 4, 440), 0.35, 'sine', 0.06); };
  A.countdown = (hi) => A.play('ui_hover', { vol: hi ? 0.6 : 0.4, rate: hi ? 1.7 : 1.3, jit: 0, bus: ui });
  A.stormMove = () => { A.play('ev_warning', { vol: 0.7, jit: 0 }); A.noise(2.2, 0.12, 'lowpass', 200, 900, 1, { brown: true, a: 0.6 }); };
  A.ctx = () => ctx;
  A.stats = () => ({ state: ctx && ctx.state, decoded: Object.keys(buf).length, music: !!musicSrc, voices: voices.length });
  A.debugTap = () => { const d = ctx.createMediaStreamDestination(); comp.connect(d); return d.stream; };
  return A;
})();
AudioSys.prefetch();
