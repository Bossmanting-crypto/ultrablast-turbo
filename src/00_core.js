import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------- utils ----------
const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function randUnit(out = new V3()) { const u = rand(-1, 1), th = rand(0, TAU), s = Math.sqrt(1 - u * u); return out.set(s * Math.cos(th), u, s * Math.sin(th)); }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const _v = [...Array(16)].map(() => new V3());
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const $ = id => document.getElementById(id);
let STORE = null; try { STORE = window.localStorage; STORE.getItem('x'); } catch (e) { STORE = null; }
const store = { get(k, d) { try { const v = STORE && STORE.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { STORE && STORE.setItem(k, JSON.stringify(v)); } catch (e) { } } };
let NOW = 0;
let GAME = null;
const CAP = window.Capacitor || null;               // present inside the Android app
const IS_APP = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const SETTINGS = Object.assign({ music: 0.7, sfx: 0.9, quality: 'auto', invertY: false, haptics: true }, store.get('ubm_settings', {}));
function saveSettings() { store.set('ubm_settings', SETTINGS); }

// haptics: Capacitor plugin in the app, the Vibration API on the web
function haptic(kind = 'light') {
  if (!SETTINGS.haptics) return;
  try {
    const H = CAP && CAP.Plugins && CAP.Plugins.Haptics;
    if (H) { if (kind === 'heavy') H.impact({ style: 'HEAVY' }); else if (kind === 'medium') H.impact({ style: 'MEDIUM' }); else if (kind === 'buzz') H.vibrate({ duration: 220 }); else H.impact({ style: 'LIGHT' }); return; }
    if (navigator.vibrate) navigator.vibrate(kind === 'heavy' ? 60 : kind === 'medium' ? 30 : kind === 'buzz' ? [80, 40, 80] : 12);
  } catch (e) { }
}

// ---------- renderer / quality ----------
const glCanvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 3000);
scene.add(camera);
const Q = { tier: SETTINGS.quality === 'low' ? 0 : 1, post: true, dpr: 1, fpsAvg: 60, checkT: 0, lowFrames: 0 };
function applyQuality() {
  Q.post = Q.tier >= 1;
  Q.dpr = Q.tier >= 1 ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(window.devicePixelRatio || 1, 1.0);
  renderer.setPixelRatio(Q.dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  if (composer) { composer.setPixelRatio(Q.dpr); composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth * 0.5, innerHeight * 0.5); }
  if (Q.hook) Q.hook();
}

// ---------- sky ----------
const ASSETS = { sky: false };
const skyTex = new THREE.TextureLoader().load('assets/sky.webp', t => {
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  try { const env = t.clone(); env.mapping = THREE.EquirectangularReflectionMapping; env.needsUpdate = true; const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(env).texture; pm.dispose(); } catch (e) { }
  ASSETS.sky = true;
}, undefined, () => { ASSETS.sky = true; });
skyTex.colorSpace = THREE.SRGBColorSpace; skyTex.generateMipmaps = false; skyTex.minFilter = THREE.LinearFilter;
const skyMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: skyTex }, uTint: { value: new THREE.Color(1, 1, 1) }, uBright: { value: 0.95 }, uRot: { value: 0 }, uStorm: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
  fragmentShader: `uniform sampler2D map; uniform vec3 uTint; uniform float uBright, uRot, uStorm; varying vec3 vDir;
  void main(){ vec3 d = normalize(vDir); float c=cos(uRot), s=sin(uRot); d.xz = mat2(c,-s,s,c)*d.xz;
    vec3 col = texture2D(map, vec2(atan(d.z, d.x)/6.2831853 + 0.5, asin(clamp(d.y,-1.0,1.0))/3.1415926 + 0.5)).rgb;
    float l = dot(col, vec3(0.299,0.587,0.114));
    col = mix(col, vec3(l)*vec3(0.75,0.45,1.15), uStorm*0.75);
    gl_FragColor = vec4(col*uTint*uBright, 1.0); }`,
  side: THREE.BackSide, depthWrite: false, depthTest: false
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), skyMat);
sky.renderOrder = -1000; sky.frustumCulled = false; scene.add(sky);
scene.add(new THREE.HemisphereLight(0xa9c2ff, 0xff7a4a, 0.75));
const sun = new THREE.DirectionalLight(0xffdcb0, 2.0); sun.position.set(-0.5, 0.6, 0.6); scene.add(sun);

// ---------- post (high tier only) ----------
const LensShader = {
  uniforms: { tDiffuse: { value: null }, uBlur: { value: 0 }, uChroma: { value: 0.002 }, uSat: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uFlash: { value: new THREE.Color(0, 0, 0) }, uAspect: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uBlur,uChroma,uSat,uAspect; uniform vec3 uTint,uFlash; varying vec2 vUv;
  void main(){
    vec2 c = vec2(0.5); vec2 dir = vUv - c; vec2 da = dir*vec2(uAspect,1.0); float r2 = dot(da,da);
    vec3 col = vec3(0.0);
    for(int i=0;i<6;i++){ float t = float(i)/5.0; vec2 suv = c + dir*(1.0 - uBlur*t*0.09*(0.3+r2*2.0)); float ch = uChroma*(1.0+r2*3.0);
      col.r += texture2D(tDiffuse, c+(suv-c)*(1.0+ch)).r; col.g += texture2D(tDiffuse, suv).g; col.b += texture2D(tDiffuse, c+(suv-c)*(1.0-ch)).b; }
    col /= 6.0;
    float l = dot(col, vec3(0.299,0.587,0.114)); col = mix(vec3(l), col, uSat);
    col = col*uTint + uFlash;
    gl_FragColor = vec4(col*mix(0.6,1.0,smoothstep(1.25,0.25,length(da))), 1.0);
  }`
};
let composer = null, bloom = null, lensPass = null;
composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth * 0.5, innerHeight * 0.5), 0.75, 0.5, 0.9);
composer.addPass(bloom);
lensPass = new ShaderPass(LensShader); composer.addPass(lensPass);
composer.addPass(new OutputPass());
const LENS = { blur: 0, chroma: 0, flash: new THREE.Color(0, 0, 0), sat: 1, tint: new THREE.Color(1, 1, 1) };
applyQuality();
function renderFrame() { if (Q.post) composer.render(); else renderer.render(scene, camera); }

// ---------- input (touch first; keyboard + gamepad for testing) ----------
const input = { keys: new Set(), events: [], steerX: 0, steerY: 0, boostHeld: false, touchBoost: false, stick: null };
addEventListener('keydown', e => {
  if (e.repeat) return; input.keys.add(e.code);
  if (e.code === 'Space') { e.preventDefault(); input.events.push({ t: 'boost' }); input.events.push({ t: 'tap' }); }
  if (e.code === 'KeyU' || e.code === 'KeyE' || e.code === 'Enter') input.events.push({ t: 'ultra' }, { t: 'tap' });
  if (e.code === 'Escape' || e.code === 'KeyP') input.events.push({ t: 'pause' });
});
addEventListener('keyup', e => input.keys.delete(e.code));
addEventListener('blur', () => { input.keys.clear(); input.touchBoost = false; input.stick = null; });
// floating stick
const stickZone = $('stickZone'), stickBase = $('stickBase'), stickKnob = $('stickKnob');
let stickId = null, stickO = null; const STICK_R = 52;
stickZone.addEventListener('pointerdown', e => {
  e.preventDefault(); stickId = e.pointerId; stickO = { x: e.clientX, y: e.clientY }; input.stick = { x: 0, y: 0 };
  stickBase.style.left = e.clientX + 'px'; stickBase.style.top = e.clientY + 'px'; stickBase.classList.add('active');
  try { stickZone.setPointerCapture(e.pointerId); } catch (err) { }
  input.events.push({ t: 'stick' });
});
stickZone.addEventListener('pointermove', e => {
  if (e.pointerId !== stickId) return;
  let dx = e.clientX - stickO.x, dy = e.clientY - stickO.y; const l = Math.hypot(dx, dy);
  if (l > STICK_R) { stickO.x += dx * (1 - STICK_R / l); stickO.y += dy * (1 - STICK_R / l); stickBase.style.left = stickO.x + 'px'; stickBase.style.top = stickO.y + 'px'; dx = e.clientX - stickO.x; dy = e.clientY - stickO.y; }
  input.stick = { x: dx / STICK_R, y: dy / STICK_R };
  stickKnob.style.setProperty('--kx', dx + 'px'); stickKnob.style.setProperty('--ky', dy + 'px');
});
function resetTouch() { stickId = null; input.stick = null; input.touchBoost = false; stickBase.classList.remove('active'); stickKnob.style.setProperty('--kx', '0px'); stickKnob.style.setProperty('--ky', '0px'); stickBase.style.left = ''; stickBase.style.top = ''; if (typeof boostBtn !== 'undefined') boostBtn.classList.remove('down'); }
const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; input.stick = null; stickBase.classList.remove('active'); stickKnob.style.setProperty('--kx', '0px'); stickKnob.style.setProperty('--ky', '0px'); };
stickZone.addEventListener('pointerup', stickEnd); stickZone.addEventListener('pointercancel', stickEnd);
// boost button
const boostBtn = $('boostBtn'), ultraBtn = $('ultraBtn');
boostBtn.addEventListener('pointerdown', e => { e.preventDefault(); input.touchBoost = true; boostBtn.classList.add('down'); input.events.push({ t: 'boost' }, { t: 'tap' }); try { boostBtn.setPointerCapture(e.pointerId); } catch (err) { } });
const boostEnd = () => { input.touchBoost = false; boostBtn.classList.remove('down'); };
boostBtn.addEventListener('pointerup', boostEnd); boostBtn.addEventListener('pointercancel', boostEnd);
ultraBtn.addEventListener('pointerdown', e => { e.preventDefault(); input.events.push({ t: 'ultra' }); });
// taps elsewhere on the right side count as timing taps (supercut)
glCanvas.addEventListener('pointerdown', e => { if (e.clientX > innerWidth * 0.45) input.events.push({ t: 'tap' }); });
function pollInput() {
  let x = 0, y = 0, padBoost = false;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && [...pads].find(p => p && p.connected);
  if (gp) {
    const dz = v => Math.abs(v) < 0.15 ? 0 : v;
    x = dz(gp.axes[0] || 0); y = -dz(gp.axes[1] || 0);
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), prev = input.padPrev || [];
    padBoost = b(0) || b(7);
    if ((b(0) && !prev[0]) || (b(7) && !prev[7])) input.events.push({ t: 'boost' }, { t: 'tap' });
    if (b(3) && !prev[3]) input.events.push({ t: 'ultra' });
    if (b(9) && !prev[9]) input.events.push({ t: 'pause' });
    input.padPrev = gp.buttons.map(v => v.pressed);
  }
  const k = input.keys;
  const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
  const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
  if (kx || ky) { x = kx; y = ky; }
  if (input.stick) { const s = input.stick; const m = Math.hypot(s.x, s.y); const g = m < 0.12 ? 0 : Math.min(1, (m - 0.12) / 0.75) / (m || 1); x = s.x * g; y = -s.y * g; }
  if (SETTINGS.invertY) y = -y;
  input.steerX = x; input.steerY = y;
  input.boostHeld = k.has('Space') || input.touchBoost || padBoost;
}

// ---------- alien script glyphs (decoration) ----------
function drawGlyph(ctx, seed, x, y, s) {
  const r = mulberry32(seed * 9301 + 49297);
  ctx.beginPath();
  if (r() < 0.55) {
    const R = s * 0.42, a0 = r() * TAU, span = TAU * (0.5 + r() * 0.5);
    ctx.moveTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R); ctx.arc(x, y, R, a0, a0 + span);
    if (r() < 0.7) { const R2 = s * (0.12 + r() * 0.12), b0 = r() * TAU; ctx.moveTo(x + Math.cos(b0) * R2, y + Math.sin(b0) * R2); ctx.arc(x, y, R2, b0, b0 + TAU * (0.6 + r() * 0.4)); }
    for (let i = 0, n = Math.floor(r() * 3); i < n; i++) { const a = r() * TAU; ctx.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R); ctx.lineTo(x + Math.cos(a) * (R + s * 0.18), y + Math.sin(a) * (R + s * 0.18)); }
  } else {
    const g = s / 3, ox = x - s / 2, oy = y - s / 2; let cx = Math.floor(r() * 4), cy = Math.floor(r() * 4);
    ctx.moveTo(ox + cx * g, oy + cy * g);
    for (let i = 0, n = 3 + Math.floor(r() * 3); i < n; i++) { if (r() < 0.5) cx = clamp(cx + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2)), 0, 3); else cy = clamp(cy + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2)), 0, 3); ctx.lineTo(ox + cx * g, oy + cy * g); }
  }
  ctx.stroke();
}
function scriptRingTexture(seed, color = '#ffffff', count = 26) {
  const size = 512, c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < count; i++) { const a = i / count * TAU; ctx.save(); ctx.translate(size / 2 + Math.cos(a) * size * 0.43, size / 2 + Math.sin(a) * size * 0.43); ctx.rotate(a + Math.PI / 2); drawGlyph(ctx, seed + i * 7, 0, 0, size * 0.075); ctx.restore(); }
  ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(256, 256, size * 0.36, 0, TAU); ctx.stroke();
  ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.arc(256, 256, size * 0.49, 0, TAU); ctx.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
