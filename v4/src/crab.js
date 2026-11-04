// SNOW CRAB CO-130, the geometry. Every part is built from code (deformed spheres, lathed and swept segments,
// extruded plates) against the reference photos listed in kin.js; update(phi, ops) poses it from the gait phase.
import * as THREE from 'three';
import {BASIS, BODY_Y, CHELA, CL, COXA, CW, HERO, HIP_Y, LEG_IDS, LEGS, TILT, halfWidth, hip, legLengths, poseAt, restFoot} from './kin.js';

// ------------------------------------------------------------ noise, deterministic
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const h = (a, b, c) => hash3(ix + a, iy + b, iz + c);
  return L(L(L(h(0, 0, 0), h(1, 0, 0), u), L(h(0, 1, 0), h(1, 1, 0), u), v), L(L(h(0, 0, 1), h(1, 0, 1), u), L(h(0, 1, 1), h(1, 1, 1), u), v), w);
}
function fbm(x, y, z, o = 4) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < o; i++) {
    s += a * noise3(x * f, y * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}
function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------ colour, from the photos (cooked-to-live orange)
const C = {
  deep: new THREE.Color('#9c2c0d'),
  red: new THREE.Color('#c9431a'),
  orange: new THREE.Color('#e2652a'),
  tip: new THREE.Color('#f59a5e'),
  cream: new THREE.Color('#f1dfc2'),
  peach: new THREE.Color('#ecc29c'),
  membrane: new THREE.Color('#e9b98e'),
  claw: new THREE.Color('#f7efe2'),
  dark: new THREE.Color('#5a170a'),
};
const _c = new THREE.Color();
const _c2 = new THREE.Color();
/** dorsal orange fading to cream where the surface faces down */
function shell(out, x, y, z, ny, k = 1) {
  const v = fbm(x * 5 + 7, y * 5, z * 5, 3);
  _c2.copy(C.deep).lerp(C.red, ss(0.2, 0.5, v)).lerp(C.orange, ss(0.5, 0.8, v) * 0.7);
  out.copy(C.cream).lerp(C.peach, ss(-0.8, -0.4, ny) * 0.4).lerp(_c2, ss(-0.62, -0.05, ny) * k);
  return out;
}
function paint(g, fn) {
  g.computeVertexNormals();
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    fn(_c, i, p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i));
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// a fine pitted bump map for the wet shell
function bumpTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const x = c.getContext('2d');
  const img = x.createImageData(s, s);
  for (let j = 0; j < s; j++)
    for (let i = 0; i < s; i++) {
      const v = fbm((i / s) * 16, (j / s) * 16, 0.5, 4) * 150 + 60;
      const k = (j * s + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
      img.data[k + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  const r = rng(5);
  for (let i = 0; i < s * 4; i++) {
    const px = r() * s, py = r() * s, rad = 0.8 + r() * 2.2;
    const gr = x.createRadialGradient(px, py, 0, px, py, rad);
    gr.addColorStop(0, 'rgba(255,255,255,.85)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr;
    x.beginPath();
    x.arc(px, py, rad, 0, 7);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

// ------------------------------------------------------------ the carapace
function carapaceGeo() {
  const g = new THREE.SphereGeometry(1, 150, 110);
  g.rotateZ(Math.PI / 2); // poles fore and aft
  const p = g.attributes.position;
  const R = rng(3);
  // tubercles: dense, a little larger and denser over the branchial swellings
  const tub = [];
  for (let i = 0; i < 900; i++) {
    const xn = R() * 2 - 1;
    const zn = R() * 2 - 1;
    if (xn * xn * 0.9 + zn * zn > 1) continue;
    const br = Math.exp(-((xn + 0.15) ** 2) / 0.2 - ((Math.abs(zn) - 0.55) ** 2) / 0.06);
    if (R() > 0.45 + 0.55 * br) continue;
    tub.push([xn, zn, 0.006 + R() * 0.008 + 0.006 * br, 0.022 + R() * 0.02]);
  }
  const TUB = new Float32Array(p.count);
  const GRV = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i), sy = p.getY(i), sz = p.getZ(i);
    const ring = Math.max(1e-4, Math.hypot(sy, sz));
    const yn = sy / ring, zr = sz / ring;
    const X = sx * (CL / 2);
    const xn = sx;
    const hw = halfWidth(X);
    // dome above, flatter below; the margin keeps a sharp shoulder
    const dome = 0.3 * (1 - 0.35 * xn * xn) * (1 - 0.25 * Math.max(0, xn));
    const Z = Math.sign(zr) * Math.pow(Math.abs(zr), 0.82) * hw;
    let Y = yn > 0 ? Math.pow(yn, 0.75) * dome * Math.pow(ring, 0.15) : yn * 0.14 * (1 - 0.3 * xn * xn);
    const zn = Z / (CW / 2);
    let tb = 0;
    let gr = 0;
    if (yn > -0.05) {
      const up = ss(-0.05, 0.25, yn);
      // regions of the dorsal shell
      let d = 0.04 * Math.exp(-((xn + 0.15) ** 2) / 0.2 - ((Math.abs(zn) - 0.52) ** 2) / 0.05);
      d += 0.035 * Math.exp(-((xn - 0.35) ** 2) / 0.05 - (zn * zn) / 0.05);
      d += 0.028 * Math.exp(-((xn + 0.38) ** 2) / 0.03 - (zn * zn) / 0.035);
      gr = Math.exp(-((Math.abs(zn) - 0.3) ** 2) / 0.003) * ss(-0.65, -0.4, xn) * (1 - ss(0.35, 0.55, xn));
      gr += Math.exp(-((xn - 0.08 - 0.35 * zn * zn) ** 2) / 0.0025) * (1 - ss(0.45, 0.7, Math.abs(zn)));
      gr = Math.min(1, gr);
      d -= 0.02 * gr;
      for (const t of tub) {
        const dx = xn - t[0], dz = zn - t[1];
        const r2 = dx * dx + dz * dz;
        if (r2 < t[3] * t[3] * 6) tb += t[2] * Math.exp(-r2 / (t[3] * t[3]));
      }
      d += tb;
      d += (fbm(xn * 6, zn * 6, 3.1, 3) - 0.5) * 0.012;
      Y += d * up;
    }
    // a row of small spines along the lateral margin
    const margin = Math.exp(-(yn * yn) / 0.02);
    const spine = Math.pow(Math.max(0, Math.sin(xn * 26)), 8) * margin * 0.022 * (1 - ss(0.75, 0.95, Math.abs(xn)));
    const zz = Z + Math.sign(Z) * spine;
    p.setXYZ(i, X, Y, zz);
    TUB[i] = tb;
    GRV[i] = gr;
  }
  return paint(g, (c, i, x, y, z, nx, ny) => {
    shell(c, x, y, z, ny);
    c.lerp(C.tip, ss(0.006, 0.02, TUB[i]) * 0.55 * ss(0, 0.4, ny));
    c.lerp(C.deep, GRV[i] * 0.45);
  });
}

// ------------------------------------------------------------ a leg segment along +x: flattened, spinules on both edges
function segmentGeo(len, w0, w1, o = {}) {
  const rad = o.radial ?? 18;
  const hs = o.hseg ?? Math.max(8, Math.round(len * 34));
  const flat = o.flat ?? 0.48; // height / width
  const seed = o.seed ?? 0;
  const g = new THREE.CylinderGeometry(1, 1, 1, rad, hs, false);
  const p = g.attributes.position;
  const T = new Float32Array(p.count);
  const S = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const cx = p.getX(i), cy = p.getY(i), cz = p.getZ(i);
    const t = cy + 0.5;
    let r = (w0 + (w1 - w0) * Math.pow(t, o.taper ?? 1)) / 2;
    r *= 1 + (o.bulge ?? 0.06) * Math.sin(Math.PI * t);
    // cross-section: width along z, height along y; ends rounded into a joint
    const end = o.capEnds === false ? 1 : Math.sqrt(Math.max(0.15, 1 - Math.pow(Math.abs(t - 0.5) * 2, 10)));
    let Z = cz * r * end;
    let Y = cx * r * flat * end;
    let sp = 0;
    const edge = Math.pow(Math.abs(cz), 6);
    if (o.spines && Math.abs(cy) < 0.49) {
      sp = Math.pow(Math.max(0, Math.sin(t * o.spines * Math.PI * 2 + seed)), 14) * edge;
      Z += Math.sign(cz) * sp * r * 0.22;
    }
    const n = (fbm(t * len * 14 + seed, cx * 3, cz * 3, 3) - 0.5) * 0.08 * r;
    Y += cx * n;
    Z += cz * n * 0.5;
    if (o.curve) Y -= o.curve * t * t * len;
    p.setXYZ(i, t * len, Y, Z);
    T[i] = t;
    S[i] = sp;
  }
  return paint(g, (c, i, x, y, z, nx, ny) => {
    shell(c, x + seed, y, z, ny);
    c.lerp(C.tip, S[i] * 0.8);
    if (o.darkTip) c.lerp(C.dark, ss(0.7, 1, T[i]) * 0.85);
    if (o.paleTip) c.lerp(C.claw, ss(0.55, 0.9, T[i]));
    if (o.joint) c.lerp(C.membrane, (1 - ss(0, 0.08, T[i])) * 0.6);
  });
}
function knuckleGeo(r, flat = 0.6, seed = 0) {
  const g = new THREE.SphereGeometry(r, 14, 10);
  g.scale(1, flat, 1);
  return paint(g, (c, i, x, y, z, nx, ny) => {
    shell(c, x + seed, y, z, ny);
    c.lerp(C.membrane, 0.3);
  });
}
function tinted(g, color, mix = 0) {
  return paint(g, (c, i, x, y, z, nx, ny) => {
    shell(c, x, y, z, ny);
    c.lerp(color, mix);
  });
}

// ------------------------------------------------------------ underside: sternum in plates, abdomen, maxillipeds
function sternumGeo() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 64, 1, false);
  g.translate(0, -0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const X = x * CL * 0.36;
    const hw = halfWidth(X * 0.95) * 0.74;
    const Z = z * hw;
    p.setXYZ(i, X, y * 0.05 + 0.02 * (1 - x * x - z * z), Z);
  }
  return paint(g, (c, i, x, y, z, nx, ny) => {
    c.copy(C.cream).lerp(C.peach, fbm(x * 8, y * 8, z * 8, 2) * 0.5);
    // the sutures between sternites run out toward each leg socket
    const s = Math.pow(Math.abs(Math.sin((x / (CL * 0.36)) * 4.2 * Math.PI + 0.6)), 22) * ss(0.12, 0.3, Math.abs(z));
    c.lerp(C.red, s * 0.35);
  });
}
function abdomenGeo() {
  // male: a narrow triangle with six segments, folded under the body
  const s = new THREE.Shape();
  s.moveTo(-0.5, -0.12);
  s.lineTo(-0.5, 0.12);
  s.quadraticCurveTo(-0.15, 0.14, 0.22, 0.05);
  s.quadraticCurveTo(0.27, 0, 0.22, -0.05);
  s.quadraticCurveTo(-0.15, -0.14, -0.5, -0.12);
  const g = new THREE.ExtrudeGeometry(s, {depth: 0.015, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 18});
  return paint(g, (c, i, x, y) => {
    c.copy(C.cream);
    c.lerp(C.membrane, Math.pow(Math.abs(Math.sin((x + 0.5) * 12)), 14) * 0.7);
    c.lerp(C.peach, ss(0.08, 0.13, Math.abs(y)) * 0.5);
  });
}

// ------------------------------------------------------------ build
export function buildCrab() {
  const bump = bumpTexture();
  const mk = (o = {}) =>
    new THREE.MeshPhysicalMaterial({vertexColors: true, roughness: o.roughness ?? 0.46, metalness: 0, clearcoat: o.clearcoat ?? 0.55, clearcoatRoughness: 0.32, bumpMap: bump, bumpScale: o.bump ?? 1.2, envMapIntensity: 0.55});
  const mats = {shell: mk(), under: mk({clearcoat: 0.35, roughness: 0.55}), chela: mk(), legs: mk(), hero: mk()};
  const eyeMat = new THREE.MeshPhysicalMaterial({color: '#0b0706', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04});
  const systems = {shell: [], under: [], chela: [], legs: [], hero: []};
  const count = {shell: 0, under: 0, chela: 0, legs: 0};
  const mesh = (geo, sys, mat = mats[sys]) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    systems[sys].push(m);
    m.userData.sys = sys;
    return m;
  };

  const group = new THREE.Group(); // on the floor, moves along +z
  const lift = new THREE.Group(); // explode raise and flip-over pivot at the carapace centre
  lift.position.y = BODY_Y;
  group.add(lift);
  const body = new THREE.Group();
  body.position.y = -BODY_Y; // body frame = floor frame
  lift.add(body);
  const sub = {};
  for (const k of ['shell', 'under']) {
    sub[k] = new THREE.Group();
    body.add(sub[k]);
  }

  // carapace, rostrum, orbits, eyes, antennae
  const cara = mesh(carapaceGeo(), 'shell');
  cara.position.y = BODY_Y;
  sub.shell.add(cara);
  count.shell++;
  const front = CL / 2;
  for (const s of [-1, 1]) {
    const horn = mesh(tinted(new THREE.ConeGeometry(0.03, 0.12, 10).rotateZ(-Math.PI / 2).translate(0.06, 0, 0), C.deep, 0.15), 'shell');
    horn.position.set(front - 0.05, BODY_Y + 0.07, s * 0.04);
    horn.rotation.set(0, -s * 0.22, 0.3);
    sub.shell.add(horn);
    // orbit spine above the eye
    const ob = mesh(tinted(new THREE.ConeGeometry(0.022, 0.08, 8).rotateZ(-Math.PI / 2).translate(0.04, 0, 0), C.red, 0.1), 'shell');
    ob.position.set(front - 0.13, BODY_Y + 0.07, s * 0.15);
    ob.rotation.set(0, -s * 0.9, 0.2);
    sub.shell.add(ob);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 18, 14), eyeMat);
    eye.scale.set(1.25, 1, 1);
    eye.position.set(front - 0.1, BODY_Y + 0.03, s * 0.13);
    eye.castShadow = true;
    systems.shell.push(eye);
    eye.userData.sys = 'shell';
    sub.shell.add(eye);
    const stalk = mesh(tinted(new THREE.CylinderGeometry(0.024, 0.03, 0.06, 10).rotateZ(Math.PI / 2), C.membrane, 0.4), 'shell');
    stalk.position.set(front - 0.135, BODY_Y + 0.025, s * 0.12);
    sub.shell.add(stalk);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(front - 0.04, BODY_Y + 0.0, s * 0.03), new THREE.Vector3(front + 0.06, BODY_Y + 0.05, s * 0.06), new THREE.Vector3(front + 0.16, BODY_Y + 0.12, s * 0.12), new THREE.Vector3(front + 0.22, BODY_Y + 0.2, s * 0.2)]);
    sub.shell.add(mesh(tinted(new THREE.TubeGeometry(curve, 24, 0.006, 6, false), C.red, 0.2), 'shell'));
    count.shell += 5;
  }

  // underside
  const st = mesh(sternumGeo(), 'under');
  st.position.y = BODY_Y - 0.12;
  sub.under.add(st);
  const ab = mesh(abdomenGeo(), 'under');
  ab.rotation.x = Math.PI / 2;
  ab.position.set(-0.08, BODY_Y - 0.165, 0);
  sub.under.add(ab);
  count.under += 2;
  for (const s of [-1, 1]) {
    const mx = mesh(tinted(new THREE.BoxGeometry(0.16, 0.025, 0.075, 6, 1, 3), C.cream, 0.75), 'under');
    mx.position.set(front - 0.2, BODY_Y - 0.115, s * 0.042);
    mx.rotation.set(0, s * 0.08, -0.15);
    sub.under.add(mx);
    count.under++;
  }

  // walking legs
  const legs = [];
  for (const {side, i, name} of LEG_IDS) {
    const len = legLengths(i);
    const w = LEGS[i].w;
    const isHero = side === HERO.side && i === HERO.i;
    const sys = isHero ? 'hero' : 'legs';
    const seed = i * 17 + (side > 0 ? 3 : 41);
    const root = new THREE.Group();
    root.position.set(...hip(side, i));
    body.add(root);
    const nodes = [];
    const chain = [
      ['coxa', COXA, w * 0.9, w * 0.85, {flat: 0.8, bulge: 0.15}],
      ['basis', BASIS, w * 0.8, w * 0.85, {flat: 0.6}],
      ['merus', len.merus, w * 0.95, w * 0.88, {spines: 16, joint: true}],
      ['carpus', len.carpus, w * 0.78, w * 0.72, {spines: 5, bulge: 0.12, joint: true}],
      ['propodus', len.propodus, w * 0.66, w * 0.5, {spines: 12, joint: true}],
      ['dactylus', len.dactylus, w * 0.42, 0.012, {spines: 7, bulge: 0.02, taper: 0.8, darkTip: true, curve: 0.05, joint: true}],
    ];
    let parent = root;
    let prev = 0;
    for (const [nm, L, w0, w1, o] of chain) {
      const j = new THREE.Group();
      j.position.x = prev;
      parent.add(j);
      const m = mesh(segmentGeo(L, w0, w1, {...o, seed: seed + nodes.length * 7}), sys);
      j.add(m);
      nodes.push(j);
      parent = j;
      prev = L;
    }
    const tip = new THREE.Object3D();
    tip.position.x = prev;
    parent.add(tip);
    nodes[1].rotation.z = TILT;
    count.legs += 6;
    legs.push({side, i, name, root, nodes, tip, isHero, home: root.position.clone()});
  }

  // chelipeds: slender, a long palm, serrated fingers with pale tips
  const chelae = [];
  for (const s of [-1, 1]) {
    const w = CHELA.w;
    const root = new THREE.Group();
    root.position.set(0.44, HIP_Y + 0.05, s * 0.32);
    body.add(root);
    const chain = [
      ['coxa', 0.08, w * 1.0, w * 0.9, {flat: 0.85, bulge: 0.15}],
      ['basis', 0.1, w * 0.85, w * 0.85, {flat: 0.75}],
      ['merus', CHELA.merus, w * 0.95, w * 0.9, {flat: 0.8, spines: 11, joint: true}],
      ['carpus', CHELA.carpus, w * 0.9, w * 0.95, {flat: 0.85, bulge: 0.2, spines: 4, joint: true}],
      ['palm', CHELA.palm, w * 1.0, w * 0.9, {flat: 1.25, bulge: 0.12, spines: 9, joint: true}],
    ];
    const nodes = [];
    let parent = root;
    let prev = 0;
    chain.forEach(([nm, L, w0, w1, o], k) => {
      const j = new THREE.Group();
      j.position.x = prev;
      parent.add(j);
      j.add(mesh(segmentGeo(L, w0, w1, {...o, seed: 90 + k * 5 + s}), 'chela'));
      nodes.push(j);
      parent = j;
      prev = L;
    });
    const palm = nodes[4];
    // fixed finger: continues the palm's lower edge; movable finger hinged above it
    const fixed = mesh(segmentGeo(CHELA.finger, w * 0.45, 0.012, {flat: 0.9, spines: 14, paleTip: true, curve: -0.04, taper: 0.9}), 'chela');
    fixed.position.set(CHELA.palm - 0.01, -w * 0.28, 0);
    fixed.rotation.z = -0.05;
    palm.add(fixed);
    const finger = new THREE.Group();
    finger.position.set(CHELA.palm - 0.02, w * 0.25, 0);
    palm.add(finger);
    finger.add(mesh(segmentGeo(CHELA.finger * 1.04, w * 0.42, 0.012, {flat: 0.9, spines: 14, paleTip: true, curve: 0.05, taper: 0.9}), 'chela'));
    finger.add(mesh(knuckleGeo(w * 0.16, 0.9, 7), 'chela'));
    count.chela += 7;
    chelae.push({side: s, root, nodes, finger, home: root.position.clone()});
  }

  // ------------------------------------------------------------ ghosting for isolate: per system opacity
  const allMats = Object.values(mats);
  const setAlpha = (mat, a) => {
    const tr = a < 0.995;
    if (mat.transparent !== tr) {
      mat.transparent = tr;
      mat.depthWrite = !tr;
      mat.needsUpdate = true;
    }
    mat.opacity = a;
  };
  const ghost = {shell: 0, under: 0, chela: 0, legs: 0, hero: 0};

  const out = {heroJoints: [], eyes: [], tips: []};
  const tmp = new THREE.Vector3();
  const CLAW_REST = {yaw: 1.08, merusZ: 0.42, carpusY: 1.25, carpusZ: -0.25, palmY: 0.5, palmZ: -0.32};

  /**
   * phi: gait phase in cycles. ops: amp (0 parks the legs), explode 0..1, flip 0..1, claw 0..1 (open),
   * iso {shell, under, chela, legs, hero} each 0..1 = how much that system is ghosted, t for idle motion.
   */
  const update = (phi, ops = {}) => {
    const amp = ops.amp ?? 1;
    const ex = ops.explode ?? 0;
    const fl = ops.flip ?? 0;
    const t = ops.t ?? 0;
    const relax = Math.max(ex, fl);
    const poses = poseAt(phi, amp * (1 - relax));
    const e = ex * ex * (3 - 2 * ex);
    // the explode lifts the whole animal and spreads its systems
    lift.position.y = BODY_Y + 0.85 * e + 1.25 * fl * fl * (3 - 2 * fl);
    lift.rotation.x = Math.PI * (fl * fl * (3 - 2 * fl));
    body.position.y = -BODY_Y + (1 - relax) * amp * 0.012 * Math.cos(4 * Math.PI * phi);
    sub.shell.position.y = 1.0 * e;
    sub.under.position.y = -0.32 * e;
    legs.forEach((L, k) => {
      const P = poses[k];
      const ik = P.ik;
      const yaw0 = (LEGS[L.i].yaw * Math.PI) / 180;
      const dir = [Math.sin(yaw0), 0, L.side * Math.cos(yaw0)];
      L.root.position.set(L.home.x + dir[0] * 0.55 * e, L.home.y + 0.18 * e, L.home.z + dir[2] * 0.55 * e);
      // relaxed pose when lifted off the floor: legs fold a little, swaying
      const sway = Math.sin(t * 1.3 + k * 1.7) * 0.05;
      const relaxPose = {yaw: Math.atan2(-(restFoot(L.side, L.i)[2] - L.home.z), restFoot(L.side, L.i)[0] - L.home.x), merus: 0.12 + sway + 0.25 * ex, knee: -0.55 - sway - 0.5 * ex};
      const mix = (a, b) => a + (b - a) * relax;
      L.root.rotation.y = mix(ik.yaw, relaxPose.yaw);
      L.nodes[2].rotation.z = mix(ik.merus, relaxPose.merus);
      L.nodes[3].rotation.z = mix(ik.knee, relaxPose.knee);
      L.nodes[4].rotation.z = ik.b1;
      L.nodes[5].rotation.z = ik.b2 + Math.sin(t * 2 + k) * 0.03 * relax;
    });
    chelae.forEach((Ch, k) => {
      const s = Ch.side;
      const sway = Math.sin(t * 1.1 + k * 2) * 0.04 + amp * (1 - relax) * Math.sin(2 * Math.PI * phi + k * Math.PI) * 0.05;
      Ch.root.position.set(Ch.home.x + 0.45 * e, Ch.home.y + 0.3 * e, Ch.home.z + s * 0.35 * e);
      Ch.root.rotation.y = -s * CLAW_REST.yaw;
      const n = Ch.nodes;
      n[2].rotation.set(0, 0, CLAW_REST.merusZ + sway);
      n[3].rotation.set(0, s * CLAW_REST.carpusY, CLAW_REST.carpusZ);
      n[4].rotation.set(0, s * CLAW_REST.palmY, CLAW_REST.palmZ - sway * 0.6 - (ops.claw ?? 0) * 0.1);
      Ch.finger.rotation.z = 0.02 + (ops.claw ?? 0) * 0.62;
    });
    // ghosting
    const iso = ops.iso || {};
    for (const k of Object.keys(ghost)) {
      ghost[k] = iso[k] ?? 0;
      setAlpha(mats[k], 1 - 0.86 * ghost[k]);
    }
    eyeMat.opacity = 1 - 0.86 * ghost.shell;
    eyeMat.transparent = ghost.shell > 0.005;
    group.updateMatrixWorld(true);
    const hero = legs.find((L) => L.isHero);
    out.heroJoints = [...hero.nodes.map((n) => n.getWorldPosition(new THREE.Vector3()).toArray()), hero.tip.getWorldPosition(tmp).toArray()];
    out.tips = legs.map((L) => L.tip.getWorldPosition(new THREE.Vector3()).toArray());
    out.chelaTip = chelae[1].finger.getWorldPosition(new THREE.Vector3()).toArray();
    out.shellTop = cara.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-0.15, 0.32, 0.1).applyQuaternion(lift.quaternion)).toArray();
    out.sternum = st.getWorldPosition(new THREE.Vector3()).toArray();
    out.poses = poses;
    return poses;
  };
  const ghosted = (m) => (ghost[m.userData.sys] ?? 0) > 0.5;
  return {group, lift, body, legs, chelae, systems, mats: allMats, update, out, count, ghost, ghosted, sub};
}
