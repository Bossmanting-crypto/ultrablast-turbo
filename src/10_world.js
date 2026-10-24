// =================== WORLD ===================
// A small planet with two moons, crystals, gold gate runs and draft tunnels, all inside a storm
// that closes in over six circles.
const PLANET_R = 12, PLANET_FIELD = 34;
const NOISE_GLSL = `
float hash3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
 return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x), mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x), mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm(vec3 p){ float a=0.5, s=0.; for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5;} return s; }`;
const STD_VERT = `varying vec3 vN; varying vec3 vW; varying vec3 vP; varying vec2 vUv;
void main(){ vUv=uv; vP=position; vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`;
const U_TIME = { value: 0 };

// ---------- planet ----------
const planetGroup = new THREE.Group(); scene.add(planetGroup);
const planetShell = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R, 64, 40), new THREE.ShaderMaterial({
  uniforms: { uTime: U_TIME }, transparent: true, depthWrite: false, vertexShader: STD_VERT,
  fragmentShader: NOISE_GLSL + `uniform float uTime; varying vec3 vN,vW,vP; varying vec2 vUv;
  void main(){
    vec3 V = normalize(cameraPosition - vW); float fr = pow(1.0 - abs(dot(normalize(vN), V)), 2.5);
    vec3 d = normalize(vP); float lon = atan(d.z,d.x);
    float eq = smoothstep(0.014, 0.0, abs(d.y));
    float mer = smoothstep(0.02, 0.0, abs(sin(lon))*sqrt(1.0-d.y*d.y));
    float lat2 = smoothstep(0.01,0.0,abs(abs(d.y)-0.5));
    float sw = fbm(vP*0.3 + vec3(uTime*0.08));
    vec3 col = vec3(0.22,0.5,1.0)*(0.12 + fr*1.5 + sw*0.12) + vec3(1.0,0.32,0.28)*eq*1.2 + vec3(0.45,1.0,0.5)*(mer*0.8+lat2*0.4);
    float a = 0.16 + fr*0.65 + eq*0.6 + mer*0.4 + lat2*0.25;
    gl_FragColor = vec4(col, clamp(a,0.0,1.0));
  }`
}));
planetShell.renderOrder = 2;
const planetInner = new THREE.Mesh(new THREE.SphereGeometry(5, 48, 32), new THREE.ShaderMaterial({
  uniforms: { uTime: U_TIME }, vertexShader: STD_VERT,
  fragmentShader: NOISE_GLSL + `uniform float uTime; varying vec3 vN,vW,vP; varying vec2 vUv;
  void main(){
    vec3 d = normalize(vP); float lon = atan(d.z,d.x), lat = asin(d.y);
    float f = fbm(vP*0.6 + vec3(0.0,uTime*0.2,0.0));
    float glyph = smoothstep(0.16, 0.0, abs(sin(lon*3.0 + lat*5.0 + f*5.0 - uTime*1.6)));
    vec3 V = normalize(cameraPosition - vW); float fr = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
    vec3 col = vec3(0.22,0.05,0.42)*(0.6+f) + vec3(1.0,0.75,0.3)*glyph*1.6 + vec3(1.0,0.3,0.8)*fr*1.4;
    gl_FragColor = vec4(col, 1.0);
  }`
}));
planetGroup.add(planetInner, planetShell);
const planet = { pos: new V3(), r: PLANET_R, field: PLANET_FIELD, kind: 'planet' };

// ---------- moons ----------
const moonMat = () => new THREE.ShaderMaterial({
  uniforms: { uTime: U_TIME, uHit: { value: 0 } }, vertexShader: STD_VERT,
  fragmentShader: `uniform float uTime, uHit; varying vec3 vN,vW,vP; varying vec2 vUv;
  void main(){
    vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); vec3 L = normalize(vec3(-0.5,0.6,0.6));
    float diff = dot(N,L)*0.5+0.5; float toon = diff>0.55?1.0:(diff>0.3?0.82:0.66);
    float fr = 1.0 - abs(dot(N,V));
    vec3 d = normalize(vP);
    float bands = smoothstep(0.03,0.0,abs(abs(d.y)-0.35)) + smoothstep(0.025,0.0,abs(d.x*0.8+d.z*0.6));
    vec3 green = vec3(0.45,0.95,0.35);
    vec3 col = mix(vec3(0.78,0.8,0.72)*toon, green*1.6, smoothstep(0.62,0.8,fr));
    col = mix(col, green*1.4, clamp(bands,0.0,1.0)) + uHit*vec3(1.5,1.3,1.0);
    gl_FragColor = vec4(col, 1.0);
  }`
});
const moons = [];
for (let i = 0; i < 2; i++) {
  const r = 4.6, g = new THREE.Group(); scene.add(g);
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 24), moonMat()); g.add(body);
  const ringR = r * 1.85;
  const ringG = new THREE.Group(); g.add(ringG);
  ringG.add(new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.14, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.0, 0.8) })));
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(ringR * 2.9, ringR * 2.9), new THREE.MeshBasicMaterial({ map: scriptRingTexture(100 + i * 13, '#ffffff', 30), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(0.8, 1.2, 0.55) }));
  ringG.add(glyph);
  ringG.quaternion.setFromEuler(new THREE.Euler(rand(-0.9, 0.9), rand(0, TAU), rand(-0.6, 0.6)));
  moons.push({ i, r, field: 15, kind: 'moon', g, body, glyph, ringG, pos: new V3(), orbitR: 44, speed: (i ? 1 : -1) * 0.06, phase: i * Math.PI + 0.6,
    incl: new THREE.Quaternion().setFromEuler(new THREE.Euler(i ? 0.55 : -0.4, 0, i ? 0.35 : -0.25)) });
}
function placeMoons(time) {
  for (const m of moons) {
    const a = m.phase + time * m.speed;
    m.pos.set(Math.cos(a) * m.orbitR, 0, Math.sin(a) * m.orbitR).applyQuaternion(m.incl);
    m.g.position.copy(m.pos); m.glyph.rotation.z += 0.004; m.ringG.rotateY(0.002);
  }
}
const BODIES = [planet, ...moons];

// ---------- the storm ----------
// Six circles. Each one waits, then shrinks to the next (shown as a white sphere). Survive the final circle to win.
const STORM_R0 = 125;
const STORM_PHASES = [
  { wait: 35, shrink: 15, r: 92 },
  { wait: 22, shrink: 15, r: 68 },
  { wait: 20, shrink: 12, r: 50 },
  { wait: 16, shrink: 12, r: 36 },
  { wait: 14, shrink: 10, r: 25 },
  { wait: 16, final: true }
];
const ZONE = { c: new V3(), r: STORM_R0, nc: new V3(), nr: STORM_PHASES[0].r, fc: new V3(), fr: STORM_R0, i: 0, state: 'wait', t: 0, dur: 35, hold: false };
// the cloud swirl is evaluated per vertex (cheap on phones); bands and fades per pixel
const stormMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U_TIME, uFlash: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: NOISE_GLSL + `uniform float uTime; varying vec3 vW, vD; varying float vSw;
  void main(){ vD = normalize(position); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz;
    vSw = fbm(vD*4.0 + vec3(0.0, uTime*0.12, 0.0) + fbm(vD*2.5 - vec3(uTime*0.05))*1.6);
    gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float uTime, uFlash; varying vec3 vW, vD; varying float vSw;
  void main(){
    float sw = vSw;
    float dist = length(vW - cameraPosition);
    float near = smoothstep(70.0, 4.0, dist);
    float bands = smoothstep(0.75, 1.0, sin(vD.y*90.0 + sw*8.0 - uTime*2.0));
    vec3 col = mix(vec3(0.28,0.07,0.62), vec3(0.95,0.55,1.5), sw*sw*1.4) + vec3(1.2,0.9,1.6)*uFlash*sw;
    float a = 0.035 + near*(0.32 + sw*0.35 + bands*0.12) + uFlash*0.15*sw;
    a *= 0.35 + 0.65*smoothstep(1.5, 6.0, dist);
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.8));
  }`
});
const stormWall = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 56), stormMat);
stormWall.renderOrder = 6; stormWall.frustumCulled = false; scene.add(stormWall);
// next circle: a faint shell, plus a dashed white ring on its silhouette when you are outside it
const nextZone = new THREE.Group(); scene.add(nextZone);
const nextShell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({
  uniforms: {}, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, vertexShader: STD_VERT,
  fragmentShader: `varying vec3 vN,vW,vP; varying vec2 vUv; void main(){ vec3 V=normalize(cameraPosition-vW); float fr=pow(1.0-abs(dot(normalize(vN),V)),4.0);
    float near = smoothstep(40.0, 3.0, length(vW-cameraPosition)); vec2 g = abs(fract(vUv*vec2(48.0,24.0))-0.5); float grid = smoothstep(0.46,0.5,max(g.x,g.y));
    gl_FragColor = vec4(vec3(1.0), fr*0.14 + near*grid*0.22); }`
}));
nextShell.frustumCulled = false; nextZone.add(nextShell);
const nextRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.008, 4, 160), new THREE.ShaderMaterial({
  uniforms: { uTime: U_TIME }, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ float d = step(0.45, fract(vUv.x*48.0 - uTime*0.6)); gl_FragColor = vec4(vec3(1.5), 0.85*d); }`
}));
nextRing.renderOrder = 7; nextRing.frustumCulled = false; scene.add(nextRing);
// keep the silhouette ring facing the camera (call after the camera moves)
function updateNextRing() {
  const d = camera.position.distanceTo(ZONE.nc), R = ZONE.nr;
  const show = ZONE.state !== 'final' && d > R * 1.02 && GAME.state === 'play';
  nextRing.visible = show; if (!show) return;
  const dir = _v[15].subVectors(camera.position, ZONE.nc).normalize();
  nextRing.position.copy(ZONE.nc).addScaledVector(dir, R * R / d);
  nextRing.lookAt(camera.position);
  nextRing.scale.setScalar(R * Math.sqrt(1 - (R * R) / (d * d)));
}
function zoneSet() {
  stormWall.position.copy(ZONE.c); stormWall.scale.setScalar(ZONE.r);
  nextZone.position.copy(ZONE.nc); nextZone.scale.setScalar(ZONE.nr); nextZone.visible = ZONE.state !== 'final';
}
function pickNextCenter(out, c, r, nr) {
  const off = rand(0.2, 0.6) * (r - nr);
  out.copy(randUnit(_v[0])).multiplyScalar(off).add(c);
  // late circles stay close to the planet so the final fights happen around its surface
  if (nr < 50 && out.length() > PLANET_R + nr * 0.8) out.setLength(PLANET_R + nr * 0.8);
  if (nr < 30 && out.length() < PLANET_R + nr * 0.55) out.setLength(PLANET_R + nr * 0.55);
  if (out.distanceTo(c) > r - nr) out.sub(c).setLength(r - nr).add(c);
  return out;
}
function resetZone() {
  ZONE.c.set(0, 0, 0); ZONE.r = STORM_R0; ZONE.i = 0; ZONE.state = 'wait'; ZONE.t = 0; ZONE.dur = STORM_PHASES[0].wait;
  ZONE.nr = STORM_PHASES[0].r; pickNextCenter(ZONE.nc, ZONE.c, ZONE.r, ZONE.nr);
  zoneSet();
}
// signed distance into the safe zone (positive = inside)
const zoneDepth = p => ZONE.r - p.distanceTo(ZONE.c);
const nextDepth = p => ZONE.nr - p.distanceTo(ZONE.nc);
// a free point inside the zone players are heading to, away from the planet and moons
function randomInZone(out, margin = 8, useNext = true) {
  const c = useNext ? ZONE.nc : ZONE.c, r = Math.max(6, (useNext ? ZONE.nr : ZONE.r) - margin);
  for (let k = 0; k < 24; k++) {
    randUnit(out).multiplyScalar(r * Math.cbrt(Math.random())).add(c);
    if (out.length() < PLANET_R + 5) continue;
    let ok = true; for (const m of moons) if (out.distanceTo(m.pos) < m.r + 4) ok = false;
    if (ok && out.length() < STORM_R0 - 6) return out;
  }
  return out.copy(c).add(randUnit(_v[1]).multiplyScalar(PLANET_R + 6));
}

// ---------- draft tunnels ----------
const TUNNEL_R = 3.4, TUN_SAMPLES = 220;
const tunnelMatBase = {
  vertexShader: `varying vec2 vUv; varying vec3 vNv; varying vec3 vVp; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vVp=mv.xyz; vNv=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform float uTime, uLen, uFade, uActive; uniform vec3 uA, uB; varying vec2 vUv; varying vec3 vNv; varying vec3 vVp;
  float h1(float n){ return fract(sin(n)*43758.5453); }
  void main(){
    float along = vUv.x*uLen;
    float lane = floor(vUv.y*16.0);
    float streak = smoothstep(0.9, 1.0, fract((along*0.06) - uTime*(1.4+h1(lane+3.0)*1.2) + h1(lane)*10.0));
    float laneMask = smoothstep(0.12,0.0,abs(fract(vUv.y*16.0)-0.5));
    float fr = pow(1.0-abs(dot(normalize(vNv), normalize(-vVp))), 2.0);
    float ends = smoothstep(0.0,0.06,vUv.x)*smoothstep(1.0,0.94,vUv.x);
    vec3 col = mix(uA, uB, streak*laneMask);
    float a = (0.04 + fr*0.24 + streak*laneMask*0.34 + uActive*0.05)*ends*uFade;
    a *= 0.12 + 0.88*smoothstep(2.0, 12.0, length(vVp));
    gl_FragColor = vec4(col*(1.0+uActive*0.4), a);
  }`
};
const tunnels = [];
class Tunnel {
  constructor(points, hue) {
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.len = this.curve.getLength();
    this.pts = []; this.tans = [];
    for (let i = 0; i <= TUN_SAMPLES; i++) { const t = i / TUN_SAMPLES; this.pts.push(this.curve.getPointAt(t)); this.tans.push(this.curve.getTangentAt(t)); }
    this.frames = this.curve.computeFrenetFrames(TUN_SAMPLES, false);
    this.u = { uTime: U_TIME, uLen: { value: this.len }, uFade: { value: 0 }, uActive: { value: 0 }, uA: { value: new THREE.Color().setHSL(hue, 0.9, 0.62) }, uB: { value: new THREE.Color(1.6, 1.4, 1.0) } };
    this.mesh = new THREE.Mesh(new THREE.TubeGeometry(this.curve, TUN_SAMPLES, TUNNEL_R, 14, false), new THREE.ShaderMaterial({ ...tunnelMatBase, uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.mesh.renderOrder = 4; scene.add(this.mesh);
    this.fade = 0; this.dying = false;
    this.mid = this.pts[TUN_SAMPLES >> 1].clone();
  }
  frameAt(t, out) {
    const f = clamp(t, 0, 1) * TUN_SAMPLES, i = Math.min(TUN_SAMPLES - 1, Math.floor(f)), k = f - i;
    out.p.copy(this.pts[i]).lerp(this.pts[i + 1], k);
    out.T.copy(this.tans[i]).lerp(this.tans[i + 1], k).normalize();
    out.N.copy(this.frames.normals[i]).lerp(this.frames.normals[i + 1], k).normalize();
    out.B.crossVectors(out.T, out.N).normalize();
    return out;
  }
  nearest(p) { let best = 1e9, bi = 0; for (let i = 0; i <= TUN_SAMPLES; i += 2) { const d = this.pts[i].distanceToSquared(p); if (d < best) { best = d; bi = i; } } return { d: Math.sqrt(best), t: bi / TUN_SAMPLES, i: bi }; }
  dispose() { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
const TF = { p: new V3(), T: new V3(), N: new V3(), B: new V3() };
function tunnelPointsInZone() {
  const c = ZONE.nc, R = ZONE.nr * 0.78;
  const pts = []; const n = randi(5, 7);
  let pos = randomInZone(new V3(), ZONE.nr * 0.35), dir = randUnit(new V3());
  for (let i = 0; i < n; i++) {
    pts.push(pos.clone());
    dir.add(randUnit(_v[0]).multiplyScalar(0.8)).normalize();
    const next = pos.clone().addScaledVector(dir, rand(15, 22));
    if (next.distanceTo(c) > R) { const back = _v[1].subVectors(c, next).normalize(); dir.addScaledVector(back, 1.2).normalize(); next.copy(pos).addScaledVector(dir, rand(15, 22)); }
    if (next.length() < PLANET_R + 9) next.setLength(PLANET_R + 11);
    pos = next;
  }
  return pts;
}
function regenTunnels(avoid = null) {
  for (const t of tunnels) t.dying = true;
  if (ZONE.nr >= 40) {
    const hues = [0.53, 0.86];
    for (let k = 0; k < 2; k++) {
      let pts = tunnelPointsInZone();
      for (let tries = 0; avoid && tries < 12 && pts.some(p => p.distanceTo(avoid) < 40); tries++) pts = tunnelPointsInZone();
      tunnels.push(new Tunnel(pts, hues[k]));
    }
  }
  buildGemRows();
}

// ---------- jewel material ----------
function crystalMaterial(glow = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uGlow: { value: glow } },
    vertexShader: `varying vec3 vC; varying vec3 vW;
    void main(){ vec3 ctr = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
      float near = smoothstep(2.5, 7.0, distance(cameraPosition, ctr));
      vec4 w = modelMatrix * instanceMatrix * vec4(position*near,1.0); vW = w.xyz;
    #ifdef USE_INSTANCING_COLOR
      vC = instanceColor;
    #else
      vC = vec3(1.0);
    #endif
      gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uGlow; varying vec3 vC; varying vec3 vW;
    void main(){
      vec3 N = normalize(cross(dFdx(vW), dFdy(vW))); vec3 V = normalize(cameraPosition - vW); if(dot(N,V) < 0.0) N = -N;
      float fr = pow(1.0 - max(dot(N,V), 0.0), 2.2);
      vec3 L = normalize(vec3(-0.4,0.7,0.6)); float facet = 0.3 + 0.7*max(dot(N,L), 0.0);
      float spec = pow(max(dot(reflect(-V,N), L), 0.0), 36.0);
      vec3 c = normalize(vC + 1e-4) * min(length(vC), 1.6);
      gl_FragColor = vec4(c*(0.16 + 0.42*facet) + c*fr*1.5*uGlow + vec3(1.0,0.97,0.9)*spec*0.85, 1.0);
    }`
  });
}

// ---------- crystals, power crystals, gems ----------
const crystalGeo = new THREE.OctahedronGeometry(0.75, 0); crystalGeo.scale(0.8, 1.6, 0.8);
const N_CRYS = 70;
const crystalMesh = new THREE.InstancedMesh(crystalGeo, crystalMaterial(0.9), N_CRYS);
crystalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); crystalMesh.frustumCulled = false; scene.add(crystalMesh);
const N_POW = 6;
const powerMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.0, 0), crystalMaterial(1.3), N_POW);
powerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); powerMesh.frustumCulled = false; scene.add(powerMesh);
const crystals = [], powers = [];
const CRYS_COLORS = [new THREE.Color(0.25, 0.85, 1.0), new THREE.Color(1.0, 0.7, 0.25), new THREE.Color(0.6, 0.45, 1.0)];
for (let i = 0; i < N_CRYS; i++) { const c = { pos: new V3(), home: new V3(), ph: rand(0, 100), alive: true, respawn: 0, spawn: 1, idx: i, color: pick(CRYS_COLORS) }; crystals.push(c); crystalMesh.setColorAt(i, c.color); }
for (let i = 0; i < N_POW; i++) { const c = { pos: new V3(), home: new V3(), vel: new V3(), ph: rand(0, 100), alive: true, respawn: 0, spawn: 1, idx: i }; powers.push(c); powerMesh.setColorAt(i, new THREE.Color(1.5, 0.5, 1.2)); }
crystalMesh.instanceColor.needsUpdate = true; powerMesh.instanceColor.needsUpdate = true;
// crystals come in trails of 7 laid along real flight lines, so they lead you somewhere
const TRAIL_LEN = 7, trails = [];
for (let t = 0; t < N_CRYS / TRAIL_LEN; t++) { const ids = []; for (let k = 0; k < TRAIL_LEN; k++) { ids.push(t * TRAIL_LEN + k); crystals[t * TRAIL_LEN + k].trail = t; } trails.push({ ids, got: 0, respawn: 0, age: 0, live: false }); }
function layTrail(tr, nearPlayer) {
  const color = pick(CRYS_COLORS);
  let start, dir, up;
  for (let tries = 0; tries < 6; tries++) {
    if (nearPlayer) {
      start = P.pos.clone().addScaledVector(P.fwd, rand(28, 55)).addScaledVector(P.right, rand(-14, 14)).addScaledVector(P.up, rand(-4, 6));
      dir = P.fwd.clone().applyAxisAngle(P.up, rand(-0.7, 0.7)); up = P.up.clone();
    } else {
      start = randomInZone(new V3(), 10); const rad = start.clone().normalize();
      dir = randUnit(new V3()); dir.addScaledVector(rad, -dir.dot(rad) * 0.9).normalize(); up = rad;
    }
    if (start.length() < PLANET_R + 3) start.setLength(PLANET_R + 5);
    if (nextDepth(start) > 6) break;
    nearPlayer = false;
  }
  const path = simulatePath(start, dir, up, TRAIL_LEN, 4.6, rand(-0.35, 0.35));
  tr.ids.forEach((id, k) => { const c = crystals[id]; c.home.copy(path[k].pos); c.pos.copy(c.home); c.alive = true; c.spawn = 1 + k * 0.12; c.color = color; crystalMesh.setColorAt(id, color); });
  crystalMesh.instanceColor.needsUpdate = true;
  tr.got = 0; tr.age = 0; tr.live = true;
}
const N_GEM = 200;
const gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.42, 0), crystalMaterial(1.2), N_GEM);
gemMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); gemMesh.frustumCulled = false; scene.add(gemMesh);
for (let i = 0; i < N_GEM; i++) gemMesh.setColorAt(i, new THREE.Color(1.6, 1.2, 0.5));
gemMesh.instanceColor.needsUpdate = true;
let gems = [];
function buildGemRows() {
  gems = [];
  for (const tun of tunnels) {
    if (tun.dying) continue;
    for (const [a, b] of [[0.14, 0.36], [0.5, 0.72]]) {
      const pattern = pick(['line', 'helix', 'zig']);
      for (let k = 0; k < 10 && gems.length < N_GEM; k++) {
        tun.frameAt(lerp(a, b, k / 9), TF);
        let ox = 0, oy = 0;
        if (pattern === 'helix') { ox = Math.cos(k * 0.8) * 1.8; oy = Math.sin(k * 0.8) * 1.8; }
        if (pattern === 'zig') ox = k % 2 ? 1.6 : -1.6;
        gems.push({ pos: TF.p.clone().addScaledVector(TF.N, ox).addScaledVector(TF.B, oy), alive: true, ph: rand(0, 10) });
      }
    }
  }
  for (let i = gems.length; i < N_GEM; i++) { _m.makeScale(0, 0, 0); gemMesh.setMatrixAt(i, _m); }
  gemMesh.instanceMatrix.needsUpdate = true;
}

// ---------- shield pickups ----------
const shieldGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.35, 6); shieldGeo.rotateX(Math.PI / 2);
const shieldMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.6, 2.2) });
const shieldRingMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.8, 2.4), wireframe: true });
const shieldPicks = [];
for (let i = 0; i < 2; i++) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(shieldGeo, shieldMat), new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), shieldRingMat));
  g.visible = false; scene.add(g);
  shieldPicks.push({ g, pos: new V3(), alive: false, life: 0 });
}

// ---------- gold gate runs ----------
const gateTex = scriptRingTexture(42, '#ffffff', 22);
const GATE_R = 3.4;
const gatePool = [];
function getGate() {
  let g = gatePool.find(x => !x.on);
  if (!g) {
    const grp = new THREE.Group();
    const tor = new THREE.Mesh(new THREE.TorusGeometry(GATE_R, 0.16, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.7), transparent: true }));
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(GATE_R * 3, GATE_R * 3), new THREE.MeshBasicMaterial({ map: gateTex, color: new THREE.Color(1.0, 0.75, 0.45), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    grp.add(tor, gl); scene.add(grp);
    g = { grp, tor, gl, on: false }; gatePool.push(g);
  }
  g.on = true; g.grp.visible = true; g.tor.material.opacity = 1; g.gl.material.opacity = 1; return g;
}
function freeGate(g) { g.on = false; g.grp.visible = false; }
const gateRuns = [];
// gates follow a path the ship would really fly (gravity, orbit assist), with a gentle turn
function simulatePath(pos, fwd, up, count, spacing, steer, lead = 0, keep = false, gateKick = 0) {
  const save = { pos: P.pos.clone(), fwd: P.fwd.clone(), up: P.up.clone(), right: P.right.clone(), speed: P.speed, boost: P.boost, boostHold: P.boostHold,
    hTarget: P.hTarget, prevBody: P.prevBody, fpitch: P.fpitch, orbitR: P.orbitR, pitchVis: P.pitchVis, bank: P.bank, stun: P.stun, inField: P.inField, ram: P.ram, sx: input.steerX, sy: input.steerY, ch: BLAST.charging };
  P.pos.copy(pos); P.fwd.copy(fwd); P.up.copy(up); orthoPlayer(); P.stun = 0; BLAST.charging = false;
  if (!keep) { P.speed = 24; P.boost = 0; P.boostHold = 0; P.prevBody = null; P.fpitch = null; }
  input.steerX = steer; input.steerY = 0;
  const out = []; let travelled = -lead, next = 0, guard = 0;
  while (out.length < count && guard++ < 4000) {
    const before = P.pos.clone(); flyUpdate(1 / 30); travelled += before.distanceTo(P.pos);
    if (travelled >= next) { out.push({ pos: P.pos.clone(), n: P.fwd.clone() }); next += spacing; if (gateKick && out.length > 0) { P.boost += gateKick; P.boostHold = Math.max(P.boostHold, 0.25); } }
  }
  Object.assign(P, { speed: save.speed, boost: save.boost, boostHold: save.boostHold, hTarget: save.hTarget, prevBody: save.prevBody, fpitch: save.fpitch, orbitR: save.orbitR, pitchVis: save.pitchVis, bank: save.bank, stun: save.stun, inField: save.inField, ram: save.ram });
  P.pos.copy(save.pos); P.fwd.copy(save.fwd); P.up.copy(save.up); P.right.copy(save.right); input.steerX = save.sx; input.steerY = save.sy; BLAST.charging = save.ch;
  return out;
}
function spawnGateRun(start = null, dir = null, up = null, steer = null, keep = false) {
  const n = 5, run = { gates: [], got: 0, idx: 0, life: 45, done: false };
  const p = start ? start.clone() : randomInZone(new V3(), 18);
  const d = dir ? dir.clone().normalize() : randUnit(new V3());
  if (!dir) { const rad = _v[3].copy(p).normalize(); d.addScaledVector(rad, -d.dot(rad) * 0.85).normalize(); }
  const u = up ? up.clone() : _v[2].copy(p).normalize();
  u.addScaledVector(d, -u.dot(d)); if (u.lengthSq() < 0.01) u.set(0, 1, 0).addScaledVector(d, -d.y); u.normalize();
  const path = simulatePath(p, d, u, n, 15, steer != null ? steer : rand(-0.12, 0.12), keep ? 28 : 0, keep, 14);
  for (const s of path) {
    const g = getGate();
    g.grp.position.copy(s.pos); g.grp.lookAt(_v[0].copy(s.pos).add(s.n));
    run.gates.push({ g, pos: s.pos, n: s.n, passed: false, missed: false, side: null, s: 0 });
  }
  gateRuns.push(run); return run;
}
function clearGateRuns() { for (const r of gateRuns) for (const g of r.gates) freeGate(g.g); gateRuns.length = 0; }
