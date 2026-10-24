// =================== FX ===================
const FX = {};
// ---------- 3D shape particles ----------
const PMAX = 2600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pSize = new Float32Array(PMAX), pAlpha = new Float32Array(PMAX), pShape = new Float32Array(PMAX), pRot = new Float32Array(PMAX);
const pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pMax = new Float32Array(PMAX), pS0 = new Float32Array(PMAX), pS1 = new Float32Array(PMAX), pDrag = new Float32Array(PMAX), pSpin = new Float32Array(PMAX), pGrav = new Float32Array(PMAX);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('aShape', new THREE.BufferAttribute(pShape, 1).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('aRot', new THREE.BufferAttribute(pRot, 1).setUsage(THREE.DynamicDrawUsage));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: innerHeight * Q.dpr * 0.9 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute vec3 aColor; attribute float aSize, aAlpha, aShape, aRot; varying vec3 vC; varying float vA, vS, vR; uniform float uScale;
  void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = min(110.0, aSize*uScale/max(0.2,-mv.z)) * smoothstep(1.5, 4.0, -mv.z); vC=aColor; vA=aAlpha; vS=aShape; vR=aRot; if(aAlpha<=0.0) gl_PointSize=0.0; }`,
  fragmentShader: `varying vec3 vC; varying float vA, vS, vR;
  float sdTri(vec2 p, float r){ const float k=1.7320508; p.x=abs(p.x)-r; p.y=p.y+r/k; if(p.x+k*p.y>0.0) p=vec2(p.x-k*p.y,-k*p.x-p.y)/2.0; p.x-=clamp(p.x,-2.0*r,0.0); return -length(p)*sign(p.y); }
  float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.0))+min(max(d.x,d.y),0.0); }
  void main(){
    vec2 p = gl_PointCoord*2.0-1.0; float c=cos(vR), s=sin(vR); p = mat2(c,-s,s,c)*p;
    float a = 0.0, d;
    if(vS<0.5){ a = pow(max(0.0,1.0-length(p)),2.0); }
    else if(vS<1.5){ d = sdTri(p*vec2(1.0,-1.0), 0.6); a = smoothstep(0.1,0.0,abs(d)) + 0.3*smoothstep(0.35,0.0,abs(d)); }
    else if(vS<2.5){ d = length(p)-0.68; a = smoothstep(0.1,0.0,abs(d)) + 0.3*smoothstep(0.32,0.0,abs(d)); }
    else if(vS<3.5){ d = sdBox(p, vec2(0.55)); a = smoothstep(0.1,0.0,abs(d)) + 0.3*smoothstep(0.32,0.0,abs(d)); }
    else if(vS<4.5){ d = min(sdBox(p,vec2(0.75,0.08)), sdBox(p,vec2(0.08,0.75))); a = smoothstep(0.08,0.0,d) + 0.3*smoothstep(0.3,0.0,d); }
    else { a = max(0.0,1.0-abs(p.x*p.y)*14.0-length(p)*0.8)*1.4 + pow(max(0.0,1.0-length(p)),3.0); }
    if(a<0.01) discard;
    gl_FragColor = vec4(vC, a*vA);
  }`
});
Q.hook = () => { pMat.uniforms.uScale.value = innerHeight * Q.dpr * 0.9; };
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; points.renderOrder = 10; scene.add(points);
let pHead = 0;
const GOLD = new THREE.Color(1.6, 1.1, 0.5), PEACH = new THREE.Color(1.4, 1.0, 0.75), CYAN = new THREE.Color(0.45, 1.2, 1.6), MAG = new THREE.Color(1.6, 0.4, 1.2), CORAL = new THREE.Color(1.8, 0.5, 0.25), LIME = new THREE.Color(1.0, 1.5, 0.6), WHITE = new THREE.Color(1.4, 1.4, 1.4);
FX.spawn = (o) => {
  const i = pHead; pHead = (pHead + 1) % PMAX;
  pPos[i * 3] = o.pos.x; pPos[i * 3 + 1] = o.pos.y; pPos[i * 3 + 2] = o.pos.z;
  const v = o.vel || _v[15].set(0, 0, 0); pVel[i * 3] = v.x; pVel[i * 3 + 1] = v.y; pVel[i * 3 + 2] = v.z;
  const c = o.color || GOLD; pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
  pLife[i] = pMax[i] = o.life || 0.8; pS0[i] = o.size || 0.5; pS1[i] = o.size1 != null ? o.size1 : (o.size || 0.5) * 0.2;
  pShape[i] = o.shape || 0; pRot[i] = rand(0, TAU); pSpin[i] = o.spin != null ? o.spin : rand(-6, 6); pDrag[i] = o.drag != null ? o.drag : 1.5; pGrav[i] = o.grav || 0;
  pAlpha[i] = 1; pSize[i] = pS0[i];
};
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    if (pLife[i] <= 0) { if (pAlpha[i] > 0) { pAlpha[i] = 0; pSize[i] = 0; } continue; }
    pLife[i] -= dt;
    const k = Math.exp(-pDrag[i] * dt);
    pVel[i * 3] *= k; pVel[i * 3 + 1] *= k; pVel[i * 3 + 2] *= k;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    const f = Math.max(0, pLife[i] / pMax[i]);
    pAlpha[i] = f < 0.3 ? f / 0.3 : 1; pSize[i] = lerp(pS1[i], pS0[i], f); pRot[i] += pSpin[i] * dt;
  }
  for (const n of ['position', 'aColor', 'aSize', 'aAlpha', 'aShape', 'aRot']) pGeo.attributes[n].needsUpdate = true;
}
FX.burstShapes = (pos, n, shapes, speed = 20, color = null) => {
  for (let i = 0; i < n; i++) {
    const sh = pick(shapes);
    FX.spawn({ pos, vel: randUnit(_v[14]).multiplyScalar(rand(0.3, 1) * speed), color: color || (Math.random() < 0.75 ? GOLD : PEACH), size: sh === 0 ? rand(0.3, 0.7) : rand(0.8, 1.8), size1: 0.1, life: rand(0.6, 1.3), shape: sh, drag: 2.2 });
  }
};
FX.sparks = (pos, n, color = GOLD, speed = 14) => { for (let i = 0; i < n; i++) FX.spawn({ pos, vel: randUnit(_v[14]).multiplyScalar(rand(0.2, 1) * speed), color, size: rand(0.25, 0.6), life: rand(0.3, 0.7), shape: Math.random() < 0.2 ? 5 : 0, drag: 3 }); };

// ---------- shockwaves ----------
const swGeo = new THREE.SphereGeometry(1, 32, 18);
const shockwaves = [];
for (let i = 0; i < 8; i++) {
  const m = new THREE.Mesh(swGeo, new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uC: { value: new THREE.Color() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: STD_VERT,
    fragmentShader: `uniform float uA; uniform vec3 uC; varying vec3 vN,vW,vP; varying vec2 vUv; void main(){ vec3 V=normalize(cameraPosition-vW); float fr=pow(1.0-abs(dot(normalize(vN),V)),2.5); float bands = 0.5+0.5*sin(vUv.y*60.0); gl_FragColor=vec4(uC, (fr*0.9+bands*0.05)*uA); }`
  }));
  m.visible = false; m.renderOrder = 11; scene.add(m); shockwaves.push({ m, t: 0, dur: 1, r: 1, on: false });
}
FX.shockwave = (pos, r, color, dur = 0.7) => { const s = shockwaves.find(x => !x.on) || shockwaves[0]; s.on = true; s.t = 0; s.dur = dur; s.r = r; s.amp = pos.distanceTo(camera.position) < r + 4 ? 0.12 : 1.0; s.m.position.copy(pos); s.m.material.uniforms.uC.value.copy(color); s.m.visible = true; };
function updateShockwaves(dt) { for (const s of shockwaves) { if (!s.on) continue; s.t += dt; const k = s.t / s.dur; if (k >= 1) { s.on = false; s.m.visible = false; continue; } const e = 1 - Math.pow(1 - k, 3); s.m.scale.setScalar(0.5 + s.r * e); s.m.material.uniforms.uA.value = (1 - k) * (s.amp || 1); } }

// ---------- tentacle lines (bubble pop) ----------
const tentacles = [];
for (let i = 0; i < 12; i++) {
  const g = new THREE.BufferGeometry(); const N = 14;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  l.frustumCulled = false; l.visible = false; scene.add(l);
  tentacles.push({ l, N, t: 0, on: false, o: new V3(), d: new V3(), ax: new V3(), len: 6, curl: 2, life: 0.8 });
}
FX.tentacles = (pos, n, baseVel) => {
  for (let k = 0; k < n; k++) {
    const t = tentacles.find(x => !x.on); if (!t) return;
    t.on = true; t.t = 0; t.o.copy(pos); t.d = randUnit(new V3()); if (baseVel) t.d.addScaledVector(baseVel, -0.5).normalize();
    t.ax = randUnit(new V3()); t.len = rand(5, 11); t.curl = rand(1.5, 4); t.life = rand(0.6, 1.0); t.l.visible = true;
  }
};
function updateTentacles(dt) {
  for (const t of tentacles) {
    if (!t.on) continue; t.t += dt; const k = t.t / t.life; if (k >= 1) { t.on = false; t.l.visible = false; continue; }
    const pa = t.l.geometry.attributes.position.array, ca = t.l.geometry.attributes.color.array;
    const ext = (1 - Math.pow(1 - Math.min(1, k * 2.2), 3)) * t.len;
    for (let i = 0; i < t.N; i++) {
      const s = i / (t.N - 1); const along = s * ext;
      const p = _v[14].copy(t.o).addScaledVector(t.d, along);
      const wob = _v[15].copy(t.d).applyAxisAngle(t.ax, Math.PI / 2).multiplyScalar(Math.sin(s * t.curl * 3 + t.t * 10) * s * 1.5);
      p.add(wob);
      pa[i * 3] = p.x; pa[i * 3 + 1] = p.y; pa[i * 3 + 2] = p.z;
      const tailFade = Math.max(0, 1 - Math.abs(s - k * 1.1) * 1.4) * (1 - k);
      ca[i * 3] = 2.2 * tailFade; ca[i * 3 + 1] = 1.7 * tailFade; ca[i * 3 + 2] = 1.0 * tailFade;
    }
    t.l.geometry.attributes.position.needsUpdate = true; t.l.geometry.attributes.color.needsUpdate = true;
    if (Math.random() < 0.3) FX.spawn({ pos: _v[14], vel: _v[13].set(0, 0, 0), color: GOLD, size: 0.3, life: 0.4, shape: 5, drag: 1 });
  }
}

// ---------- speed lines ----------
const SL = 110;
const slGeo = new THREE.BufferGeometry(); slGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SL * 6), 3).setUsage(THREE.DynamicDrawUsage));
const slMat = new THREE.LineBasicMaterial({ color: new THREE.Color(1.5, 1.4, 1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const speedLines = new THREE.LineSegments(slGeo, slMat); speedLines.frustumCulled = false; scene.add(speedLines);
const slPts = [...Array(SL)].map(() => ({ p: new V3(1e5, 0, 0) }));
function updateSpeedLines(dt) {
  const sf = clamp((P.speed - 34) / 80, 0, 1) + (P.mode === 'tunnel' ? 0.5 : 0) + (P.mode === 'ultra' ? 0.4 : 0);
  slMat.opacity = damp(slMat.opacity, Math.min(0.55, sf * 0.7), 5, dt);
  const arr = slGeo.attributes.position.array; const len = 2 + P.speed * 0.07;
  for (let i = 0; i < SL; i++) {
    const s = slPts[i]; const rel = _v[14].subVectors(s.p, camera.position);
    const ahead = rel.dot(P.fwd);
    if (ahead < -3 || ahead > 90 || rel.lengthSq() > 9000) {
      const a = rand(0, TAU), r = rand(2.5, 16);
      s.p.copy(P.pos).addScaledVector(P.fwd, rand(20, 85)).addScaledVector(P.right, Math.cos(a) * r).addScaledVector(P.up, Math.sin(a) * r);
    }
    arr[i * 6] = s.p.x; arr[i * 6 + 1] = s.p.y; arr[i * 6 + 2] = s.p.z;
    arr[i * 6 + 3] = s.p.x + P.fwd.x * len; arr[i * 6 + 4] = s.p.y + P.fwd.y * len; arr[i * 6 + 5] = s.p.z + P.fwd.z * len;
  }
  slGeo.attributes.position.needsUpdate = true;
}

// ---------- turbo ring meshes ----------
const turboRingPool = [];
function getTurboRing() {
  let r = turboRingPool.find(x => !x.on);
  if (!r) {
    const g = new THREE.Group();
    const tor = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.09, 8, 72), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.8), transparent: true }));
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 5.0), new THREE.MeshBasicMaterial({ map: gateTex, color: new THREE.Color(1.1, 0.8, 0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    g.add(tor, gl); scene.add(g);
    r = { g, tor, gl, on: false }; turboRingPool.push(r);
  }
  r.on = true; r.g.visible = true; r.g.scale.setScalar(0.01); r.tor.material.opacity = 1; r.gl.material.opacity = 1; return r;
}
function freeTurboRing(r) { r.on = false; r.g.visible = false; }

// ---------- 2D overlay ----------
const fxc = document.getElementById('fx'); const fx2 = fxc.getContext('2d');
let FXW = innerWidth, FXH = innerHeight; const FXD = Math.min(window.devicePixelRatio || 1, 2);
function sizeFx() { FXW = innerWidth; FXH = innerHeight; fxc.width = Math.round(FXW * FXD); fxc.height = Math.round(FXH * FXD); }
sizeFx();
const crashes = [], popups = [], texts = [], specks = [];
const SHAPES2D = ['tri', 'sq', 'circ', 'squig', 'cross', 'chev', 'spiral'];
function path2D(ctx, type, s) {
  ctx.beginPath();
  switch (type) {
    case 'tri': for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; i ? ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s) : ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s); } ctx.closePath(); break;
    case 'sq': ctx.rect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6); ctx.moveTo(-s * 0.6, -s); ctx.lineTo(s, -s); ctx.lineTo(s, s * 0.6); break;
    case 'circ': ctx.arc(0, 0, s * 0.8, 0, TAU); ctx.moveTo(s * 0.32, 0); ctx.arc(0, 0, s * 0.32, 0, TAU * 0.8); break;
    case 'squig': ctx.moveTo(-s * 1.4, 0); ctx.bezierCurveTo(-s * 0.7, -s * 1.3, 0, s * 1.3, s * 0.7, 0); ctx.bezierCurveTo(s * 1.0, -s * 0.6, s * 1.3, -s * 0.4, s * 1.5, -s * 0.2); break;
    case 'cross': ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(0, -s); ctx.lineTo(0, s); break;
    case 'chev': ctx.moveTo(-s, -s * 0.8); ctx.lineTo(s * 0.4, 0); ctx.lineTo(-s, s * 0.8); break;
    case 'spiral': for (let i = 0; i <= 30; i++) { const a = i / 30 * TAU * 1.6, r = s * i / 30; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(0, 0); } break;
  }
}
FX.screenCrash = (n, kinds = null) => {
  kinds = kinds || [0, 1, 2];
  for (let i = 0; i < n; i++) {
    const type = SHAPES2D[pick(kinds)] || pick(SHAPES2D);
    const ang = rand(0, TAU), rr = rand(0.2, 0.48), k = clamp(FXH / 640, 0.5, 1);
    crashes.push({ type, x0: 0.5 + rand(-0.04, 0.04), y0: 0.5 + rand(-0.04, 0.04), x: 0.5 + Math.cos(ang) * rr * (FXH / FXW) * 1.6, y: 0.5 + Math.sin(ang) * rr, s: rand(22, 50) * k, rot: rand(0, TAU), vr: rand(-2, 2), t: -rand(0, 0.25), stick: rand(0.3, 0.7), dis: rand(0.5, 0.9), lw: rand(2.5, 4) * Math.max(0.7, k) });
  }
};
FX.popup = (text, color = '#ffd27a', big = false) => { const dup = popups.find(p => p.text === text && p.t < 0.5); if (dup) { dup.t = 0; return; } popups.push({ text, color, t: 0, y: null, big }); if (popups.length > 4) popups.shift(); };

const PALETTES = {
  gold: { top: '#fffbe0', mid: '#ffd067', bot: '#ff7a2e', ex1: '#8a2a3a', ex2: '#2a0a22', line: '#22091c' },
  red: { top: '#ffe2d6', mid: '#ff6a45', bot: '#c0142a', ex1: '#5a0a18', ex2: '#14030a', line: '#140308' },
  violet: { top: '#f3e6ff', mid: '#b98aff', bot: '#6a3ad0', ex1: '#2a1050', ex2: '#0a0420', line: '#0a0420' },
  cyan: { top: '#f0ffff', mid: '#8fe9ff', bot: '#2a8aff', ex1: '#0a2a5a', ex2: '#040a20', line: '#040a20' },
  mag: { top: '#fff0fa', mid: '#ff8ad6', bot: '#ff3a6a', ex1: '#5a0a3a', ex2: '#1a0414', line: '#1a0414' }
};
function renderTextCanvas(text, pal) {
  const fs = 150, pad = 70;
  const m = document.createElement('canvas').getContext('2d'); m.font = `${fs}px Bungee, Impact, sans-serif`;
  const w = Math.ceil(m.measureText(text).width) + pad * 2 + 60, h = Math.ceil(fs * 1.7);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
  ctx.font = `${fs}px Bungee, Impact, sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.setTransform(1, 0, -0.2, 1, h * 0.12, 0);
  const x = w / 2, y = h / 2 - 8;
  for (let i = 16; i >= 1; i--) { ctx.fillStyle = i > 8 ? pal.ex2 : pal.ex1; ctx.fillText(text, x + i * 0.8, y + i * 1.05); }
  ctx.lineWidth = 18; ctx.strokeStyle = pal.line; ctx.strokeText(text, x, y);
  const gr = ctx.createLinearGradient(0, y - fs * 0.5, 0, y + fs * 0.5); gr.addColorStop(0, pal.top); gr.addColorStop(0.5, pal.mid); gr.addColorStop(1, pal.bot);
  ctx.fillStyle = gr; ctx.fillText(text, x, y);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,240,0.85)'; ctx.strokeText(text, x, y);
  // shine band
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, y - fs * 0.48, w, fs * 0.18); ctx.restore();
  return c;
}
function makeShards(w, h) {
  const cols = 10, rows = 4, P2 = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const edgeX = i === 0 || i === cols, edgeY = j === 0 || j === rows;
    P2.push([i / cols * w + (edgeX ? 0 : rand(-0.35, 0.35) * w / cols), j / rows * h + (edgeY ? 0 : rand(-0.35, 0.35) * h / rows)]);
  }
  const sh = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = P2[j * (cols + 1) + i], b = P2[j * (cols + 1) + i + 1], c = P2[(j + 1) * (cols + 1) + i], d = P2[(j + 1) * (cols + 1) + i + 1];
    for (const tri of (Math.random() < 0.5 ? [[a, b, d], [a, d, c]] : [[a, b, c], [b, d, c]])) {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      const dx = cx - w / 2, dy = cy - h / 2, L = Math.hypot(dx, dy) + 1;
      sh.push({ tri, cx, cy, vx: dx / L * rand(300, 900) + rand(-100, 100), vy: dy / L * rand(200, 700) - rand(100, 300), vr: rand(-8, 8) });
    }
  }
  return sh;
}
FX.eventText = (text, palName = 'gold', slow = true) => {
  for (const t of texts) if (t.phase !== 'shatter') { t.phase = 'shatter'; t.t = 0; AudioSys.shatter(); }
  const cv = renderTextCanvas(text, PALETTES[palName] || PALETTES.gold);
  texts.push({ text, cv, t: 0, phase: 'slam', shards: makeShards(cv.width, cv.height) });
  if (slow) GAME.slowmo(0.22, 0.42);
  AudioSys.slam();
  FX.shake(0.35); CAM.punch += 6;
};
const doodleEl = document.getElementById('doodle');
const DOOD = { t: 9, s: 0, base: 0 };
FX.doodleFlash = (s = 1) => { DOOD.s = Math.min(0.8, Math.max(s * 0.8, DOOD.s * Math.exp(-DOOD.t * 1.8))); DOOD.t = 0; };
FX.shake = (a) => { CAM.trauma = Math.min(1.2, CAM.trauma + a); };

function draw2D(rdt) {
  const ctx = fx2; ctx.setTransform(FXD, 0, 0, FXD, 0, 0); ctx.clearRect(0, 0, FXW, FXH);
  if (GAME.state === 'paused') return;
  // doodle overlay (DOM)
  DOOD.t += rdt; const dOp = clamp(DOOD.s * Math.exp(-DOOD.t * 1.8) + DOOD.base, 0, 1);
  doodleEl.style.opacity = dOp.toFixed(3);
  doodleEl.style.transform = `scale(${(1 + 0.22 * Math.exp(-DOOD.t * 2.5) + DOOD.base * 0.03 * Math.sin(NOW * 3)).toFixed(4)}) rotate(${(Math.sin(NOW * 0.7) * 1.5).toFixed(2)}deg)`;
  if (GAME.state === 'play') { drawReticle(ctx); drawThreats(ctx); drawStormGuide(ctx); drawUltra(ctx, rdt); }
  // crash shapes
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = crashes.length - 1; i >= 0; i--) {
    const c = crashes[i]; c.t += rdt; if (c.t < 0) continue;
    const fly = 0.18, T = c.t;
    let x, y, s, a = 1, dash = null;
    if (T < fly) { const k = T / fly; const e = k * k; x = lerp(c.x0, c.x, e); y = lerp(c.y0, c.y, e); s = c.s * (0.15 + e * 0.85); a = 0.5 + k * 0.5; }
    else {
      x = c.x; y = c.y + (T - fly) * 0.01; s = c.s;
      if (T < fly + 0.06) { ctx.fillStyle = 'rgba(255,240,200,0.5)'; ctx.beginPath(); ctx.arc(x * FXW, y * FXH, s * 1.5, 0, TAU); ctx.fill(); }
      const td = T - fly - c.stick;
      if (td > 0) { const k = td / c.dis; if (k >= 1) { crashes.splice(i, 1); continue; } a = 1 - k * 0.7; dash = [Math.max(1, 26 * (1 - k)), 4 + 40 * k];
        if (Math.random() < 0.5) specks.push({ x: x * FXW + rand(-s, s), y: y * FXH + rand(-s, s), vx: rand(-20, 20), vy: rand(10, 60), t: 0, life: rand(0.4, 0.9) }); }
    }
    c.rot += c.vr * rdt * (T < fly ? 4 : 0.3);
    ctx.save(); ctx.translate(x * FXW, y * FXH); ctx.rotate(c.rot);
    if (dash) ctx.setLineDash(dash);
    path2D(ctx, c.type, s);
    ctx.strokeStyle = `rgba(255,190,90,${0.22 * a})`; ctx.lineWidth = c.lw * 4; ctx.stroke();
    ctx.strokeStyle = `rgba(255,236,190,${0.95 * a})`; ctx.lineWidth = c.lw; ctx.stroke();
    ctx.restore();
  }
  ctx.setLineDash([]);
  for (let i = specks.length - 1; i >= 0; i--) { const s = specks[i]; s.t += rdt; if (s.t > s.life) { specks.splice(i, 1); continue; } s.x += s.vx * rdt; s.y += s.vy * rdt; ctx.fillStyle = `rgba(255,220,150,${1 - s.t / s.life})`; ctx.fillRect(s.x, s.y, 2, 2); }
  ctx.globalCompositeOperation = 'source-over';
  // event texts
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i]; t.t += rdt;
    const scl = Math.min(FXW * 0.88 / t.cv.width, FXH * 0.24 / t.cv.height, 1.1);
    const W = t.cv.width * scl, H = t.cv.height * scl, cx = FXW / 2, cy = FXH * 0.36;
    if (t.phase === 'slam') {
      const k = Math.min(1, t.t / 0.13); const s = lerp(2.4, 1, 1 - Math.pow(1 - k, 3));
      ctx.globalAlpha = k; ctx.drawImage(t.cv, cx - W * s / 2, cy - H * s / 2, W * s, H * s); ctx.globalAlpha = 1;
      if (t.t > 0.13) { t.phase = 'hold'; t.t = 0; FX.shake(0.25); }
    } else if (t.phase === 'hold') {
      const j = Math.max(0, 0.12 - t.t) * 30;
      ctx.drawImage(t.cv, cx - W / 2 + rand(-j, j), cy - H / 2 + rand(-j, j), W, H);
      if (t.t > 0.55) { t.phase = 'shatter'; t.t = 0; AudioSys.shatter(); }
    } else {
      const k = t.t / 0.9; if (k >= 1) { texts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      for (const s of t.shards) {
        const ox = s.vx * t.t * scl, oy = (s.vy * t.t + 900 * t.t * t.t) * scl;
        ctx.save(); ctx.translate(cx - W / 2 + s.cx * scl + ox, cy - H / 2 + s.cy * scl + oy); ctx.rotate(s.vr * t.t); ctx.scale(scl, scl);
        ctx.beginPath(); ctx.moveTo(s.tri[0][0] - s.cx, s.tri[0][1] - s.cy); ctx.lineTo(s.tri[1][0] - s.cx, s.tri[1][1] - s.cy); ctx.lineTo(s.tri[2][0] - s.cx, s.tri[2][1] - s.cy); ctx.closePath();
        ctx.save(); ctx.clip(); ctx.drawImage(t.cv, -s.cx, -s.cy); ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }
  // popups
  for (let i = popups.length - 1; i >= 0; i--) if ((popups[i].t += rdt) > 1.25) popups.splice(i, 1);
  const base = FXH * 0.66;
  const quiet = false;
  for (let i = 0; i < popups.length && !quiet; i++) {
    const p = popups[i], slot = base - (popups.length - 1 - i) * 26;
    p.y = p.y == null ? slot + 14 : damp(p.y, slot, 14, rdt);
    const a = p.t < 0.95 ? Math.min(1, p.t * 10) : 1 - (p.t - 0.95) / 0.3;
    const s = p.t < 0.08 ? 1.25 - p.t * 3 : 1;
    ctx.globalAlpha = Math.max(0, a); ctx.font = `700 ${Math.round((p.big ? 24 : 18) * s)}px "Chakra Petch", sans-serif`; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,8,30,0.85)'; ctx.strokeText(p.text, FXW / 2, p.y);
    ctx.fillStyle = p.color; ctx.fillText(p.text, FXW / 2, p.y); ctx.globalAlpha = 1;
  }
}
function project(v, out) { const p = _v[15].copy(v).project(camera); out.x = (p.x * 0.5 + 0.5) * FXW; out.y = (-p.y * 0.5 + 0.5) * FXH; out.z = p.z; out.behind = p.z > 1; return out; }
const _sp = { x: 0, y: 0, z: 0 };
function drawReticle(ctx) {
  if (P.mode !== 'fly') return;
  project(_v[3].copy(P.pos).addScaledVector(P.fwd, 30), _sp); if (_sp.behind) return;
  const x = _sp.x, y = _sp.y, r = 18 + BLAST.level * 5;
  ctx.save(); ctx.strokeStyle = 'rgba(244,198,160,0.7)'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + NOW * 0.6; ctx.beginPath(); ctx.arc(x, y, r, a + 0.25, a + Math.PI / 2 - 0.25); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fillStyle = 'rgba(255,230,190,0.9)'; ctx.fill();
  if (BLAST.charging) { ctx.strokeStyle = 'rgba(255,210,122,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(BLAST.ct / BLAST_LEVEL_T[2], 0, 1)); ctx.stroke(); }
  ctx.restore();
}
// edge arrow: back to the zone when outside, toward the white ring when the next circle leaves you out
function edgeArrow(ctx, target, color, label, pulse) {
  project(target, _sp);
  const cx = FXW / 2, cy = FXH / 2; let dx = _sp.x - cx, dy = _sp.y - cy; if (_sp.behind) { dx = -dx; dy = -dy; if (Math.abs(dy) < 1 && Math.abs(dx) < 1) dy = 1; }
  const onScreen = !_sp.behind && _sp.x > 60 && _sp.y > 60 && _sp.x < FXW - 60 && _sp.y < FXH - 60;
  const ang = Math.atan2(dy, dx);
  let x, y;
  if (onScreen) { x = _sp.x; y = _sp.y; }
  else { const m = 64; const k = Math.min((FXW / 2 - m) / Math.abs(Math.cos(ang) || 1e-3), (FXH / 2 - m) / Math.abs(Math.sin(ang) || 1e-3)); x = cx + Math.cos(ang) * k; y = cy + Math.sin(ang) * k; }
  const s = 18 * (1 + 0.15 * Math.sin(NOW * 8) * pulse);
  ctx.save(); ctx.translate(x, y);
  if (onScreen) { ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, s * 1.1, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fillStyle = color; ctx.fill(); }
  else { ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(s * 1.3, 0); ctx.lineTo(-s * 0.8, -s * 0.9); ctx.lineTo(-s * 0.3, 0); ctx.lineTo(-s * 0.8, s * 0.9); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,30,0.8)'; ctx.stroke(); ctx.rotate(-ang); }
  if (label) { ctx.font = '700 14px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; const ly = y > FXH * 0.6 ? -s - 14 : s + 22; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,8,30,0.85)'; ctx.strokeText(label, 0, ly); ctx.fillStyle = color; ctx.fillText(label, 0, ly); }
  ctx.restore();
}
function drawStormGuide(ctx) {
  if (P.mode === 'ultra') return;
  if (P.outside) edgeArrow(ctx, ZONE.c, '#ff7ad9', 'BACK TO THE ZONE', 1);
  else if (ZONE.state !== 'final' && nextDepth(P.pos) < 0 && (ZONE.state === 'shrink' || ZONE.t > ZONE.dur - 12 || GAME.circleHint)) edgeArrow(ctx, ZONE.nc, '#ffffff', ZONE.state === 'shrink' ? 'MOVE IN' : 'NEXT CIRCLE', 0.5);
}

// ---------- wingtip ribbon trails ----------
const RIB_N = 26;
class Ribbon {
  constructor() {
    this.pts = []; this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(RIB_N * 6); this.col = new Float32Array(RIB_N * 6);
    const idx = []; for (let i = 0; i < RIB_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 9; scene.add(this.mesh);
  }
  reset() { this.pts.length = 0; }
  update(p, intensity, color, width) {
    if (!this.pts.length || this.pts[0].distanceTo(p) > 0.55) { this.pts.unshift(p.clone()); if (this.pts.length > RIB_N) this.pts.pop(); }
    else this.pts[0].copy(p);
    const n = this.pts.length;
    for (let i = 0; i < RIB_N; i++) {
      const a = this.pts[Math.min(i, n - 1)];
      if (i >= n || n < 2) { for (let k = 0; k < 6; k++) { this.pos[i * 6 + k] = a ? a.getComponent(k % 3) : 0; this.col[i * 6 + k] = 0; } continue; }
      const b = this.pts[Math.min(i + 1, n - 1)], c = this.pts[Math.max(i - 1, 0)];
      const dir = _v[13].subVectors(c, b); if (dir.lengthSq() < 1e-6) dir.copy(P.fwd);
      const side = _v[14].crossVectors(dir, _v[15].subVectors(camera.position, a)).normalize();
      const f = 1 - i / (RIB_N - 1), w = width * (0.25 + 0.75 * f);
      this.pos[i * 6] = a.x + side.x * w; this.pos[i * 6 + 1] = a.y + side.y * w; this.pos[i * 6 + 2] = a.z + side.z * w;
      this.pos[i * 6 + 3] = a.x - side.x * w; this.pos[i * 6 + 4] = a.y - side.y * w; this.pos[i * 6 + 5] = a.z - side.z * w;
      const ahead = _v[15].subVectors(a, camera.position).dot(CAM_FWD);
      const k = intensity * Math.pow(f, 1.6) * (i === 0 ? 0 : 1) * smooth(2.5, 7, ahead);
      for (const o of [0, 3]) { this.col[i * 6 + o] = color.r * k; this.col[i * 6 + o + 1] = color.g * k; this.col[i * 6 + o + 2] = color.b * k; }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}
const ribbons = [new Ribbon(), new Ribbon()];
const RIB_COL = new THREE.Color();
const CAM_FWD = new V3();
function updateRibbons(rdt) {
  camera.getWorldDirection(CAM_FWD);
  let k = clamp((P.speed - 30) / 50, 0, 1) * 0.55 + clamp(P.boost / 40, 0, 1) * 0.45;
  if (P.mode === 'ultra') k = 1;
  if (!ship.g.visible) k = 0;
  RIB_COL.copy(P.mode === 'ultra' ? GOLD : (P.mode === 'tunnel' ? CYAN : (P.boost > 16 ? GOLD : PEACH))).multiplyScalar(0.55);
  ribbons.forEach((r, i) => { const tip = ship.inner.localToWorld(_v[12].set(i ? -1.5 : 1.5, 0, -0.78)); r.update(tip, k, RIB_COL, 0.09 + k * 0.06); });
}

// ---------- off-screen threat markers ----------
function drawThreats(ctx) {
  if (P.mode === 'ultra') return;
  const list = [];
  for (const e of jets) if (e.alive) list.push([e, '#b8f55a']);
  for (const p of drones) if (p.alive) list.push([p, '#ff6ad0']);
  ctx.save();
  for (const [t, col] of list) {
    const d = t.pos.distanceTo(P.pos); if (d > 75) continue;
    project(t.pos, _sp);
    const on = !_sp.behind && _sp.x > 30 && _sp.y > 30 && _sp.x < FXW - 30 && _sp.y < FXH - 30;
    if (on) continue;
    const cx = FXW / 2, cy = FXH / 2; let dx = _sp.x - cx, dy = _sp.y - cy; if (_sp.behind) { dx = -dx; dy = -dy; }
    const ang = Math.atan2(dy, dx), m = 34;
    const k = Math.min((FXW / 2 - m) / Math.abs(Math.cos(ang) || 1e-3), (FXH / 2 - m) / Math.abs(Math.sin(ang) || 1e-3));
    const x = cx + Math.cos(ang) * k, y = cy + Math.sin(ang) * k, s = 7 + 9 * smooth(75, 10, d);
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.globalAlpha = 0.45 + 0.5 * smooth(75, 15, d);
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, -s * 0.75); ctx.lineTo(-s * 0.3, 0); ctx.lineTo(-s * 0.7, s * 0.75); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(10,8,30,0.7)'; ctx.stroke();
    ctx.setTransform(FXD, 0, 0, FXD, 0, 0);
  }
  ctx.restore();
}
