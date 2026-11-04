// The crab's stage: a cool, pale studio over fine silt. PBR with VSM shadows, GTAO (the floor kept out of the AO
// pass), an ink outline from the AO pass's g-buffer. frame(phi, t, cam, ops) poses the crab from the gait phase and
// draws one frame. Adapted from the strandbeest stage in the teardown kit.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {buildCrab} from './crab.js';
import {TRAVEL} from './kin.js';

const V3 = THREE.Vector3;
export const P = {
  bg: '#dfe5e6',
  silt: '#cfcbc1',
  shadow: ['#1d2a33', 0.4],
  env: {bg: '#d9e0e3', ground: '#bdb7aa', k: 0.9},
  hemi: ['#f3f7fa', '#b9b2a4', 0.55],
};
const INK_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform sampler2D tNormal;
  uniform float uNear; uniform float uFar; uniform vec2 uPx; uniform vec3 uInk; uniform float uStrength;
  varying vec2 vUv;
  float lz(vec2 uv){ float d = texture2D(tDepth, uv).x; return uNear * uFar / (uFar - d * (uFar - uNear)); }
  vec3 nn(vec2 uv){ return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0); }
  void main(){
    vec4 c = texture2D(tDiffuse, vUv);
    float z0 = lz(vUv);
    float zl = lz(vUv - vec2(uPx.x, 0.0)), zr = lz(vUv + vec2(uPx.x, 0.0));
    float zd = lz(vUv - vec2(0.0, uPx.y)), zu = lz(vUv + vec2(0.0, uPx.y));
    float lap = (abs(zl + zr - 2.0 * z0) + abs(zu + zd - 2.0 * z0)) / max(z0, 1e-3);
    float eD = smoothstep(0.004, 0.016, lap);
    vec3 n0 = nn(vUv);
    float eN = max(max(1.0 - dot(n0, nn(vUv - vec2(uPx.x, 0.0))), 1.0 - dot(n0, nn(vUv + vec2(uPx.x, 0.0)))),
                   max(1.0 - dot(n0, nn(vUv - vec2(0.0, uPx.y))), 1.0 - dot(n0, nn(vUv + vec2(0.0, uPx.y)))));
    float e = max(eD, smoothstep(0.35, 0.7, eN));
    c.rgb = mix(c.rgb, uInk, e * uStrength);
    gl_FragColor = c;
  }`;
const SILT_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SILT_FRAG = /* glsl */ `uniform vec3 uSilt; uniform vec3 uBg; uniform vec3 uC; varying vec3 vW;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main(){
    vec2 p = vW.xz;
    // soft current ripples, fine grain, a few pale shell flecks
    float bend = n(p * 0.25) * 2.2;
    float rip = sin((p.x * 0.9 + p.y * 0.25 + bend) * 6.2831 * 0.55) * 0.5 + 0.5;
    float grain = n(p * 55.0) * 0.6 + n(p * 160.0) * 0.4;
    float pat = n(p * 0.18);
    float fleck = step(0.985, h(floor(p * 22.0))) * 0.5;
    vec3 col = uSilt * (0.99 + 0.035 * rip - 0.06 * grain + 0.05 * (pat - 0.5)) + fleck * 0.05;
    float d = length(p - uC.xz);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(6.0, 19.0, d)), 1.0);
  }`;

export function createCrabStage({canvas, ink = 0.55}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(P.bg);
  scene.fog = new THREE.Fog(P.bg, 12, 30);
  const camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.05, 200);
  const rt = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8});
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.8;
  gtao.updateGtaoMaterial({radius: 0.1, distanceExponent: 1.4, thickness: 1.0, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  // the AO pass (and the ink drawn from it) sees only the solid crab: no floor, nothing ghosted
  const hidden = [];
  const aoView = (on) => () => {
    if (on) {
      floor.visible = shade.visible = false;
      hidden.length = 0;
      crab.group.traverse((o) => {
        if (o.isMesh && o.visible && crab.ghosted(o)) {
          o.visible = false;
          hidden.push(o);
        }
      });
    } else {
      floor.visible = shade.visible = true;
      for (const o of hidden) o.visible = true;
    }
  };
  composer.addPass(new Toggle(aoView(true)));
  let aoOn = true;
  const gtaoRender = gtao.render.bind(gtao);
  gtao.render = (r, w, rd, ...rest) => {
    if (aoOn) return gtaoRender(r, w, rd, ...rest);
    gtao._overrideVisibility();
    gtao._renderOverride(r, gtao.normalMaterial, gtao.normalRenderTarget, 0x7777ff, 1.0);
    gtao._restoreVisibility();
  };
  composer.addPass(gtao);
  composer.addPass(new Toggle(aoView(false)));
  const inkPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: {value: null},
        tDepth: {value: gtao.depthTexture},
        tNormal: {value: gtao.normalTexture},
        uNear: {value: camera.near},
        uFar: {value: camera.far},
        uPx: {value: new THREE.Vector2(1 / 1920, 1 / 1080)},
        uInk: {value: new THREE.Color().setRGB(0.18, 0.05, 0.02, THREE.LinearSRGBColorSpace)},
        uStrength: {value: ink},
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: INK_FRAG,
    }),
  );
  inkPass.enabled = ink > 0;
  composer.addPass(inkPass);
  composer.addPass(new OutputPass());

  // studio environment: cool soft boxes, a warm floor bounce
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color(P.env.bg);
    const box = (w, h, pos, k, tint = [1, 0.99, 0.97]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(...tint).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(16, 7, new V3(-12, 11, 9), 3.0);
    box(10, 10, new V3(11, 14, -7), 2.2, [0.95, 0.98, 1]);
    box(20, 3, new V3(2, 5, 17), 1.6);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: P.env.ground, side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -1.5;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = P.env.k;
    pm.dispose();
  }
  const SUN_DIR = new V3(-0.45, 0.78, 0.43).normalize();
  const sun = new THREE.DirectionalLight('#fff8ef', 2.5);
  sun.castShadow = true;
  const EXT = 3.6;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.5, far: 26});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 6;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.003;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(...P.hemi));

  const siltMat = new THREE.ShaderMaterial({vertexShader: SILT_VERT, fragmentShader: SILT_FRAG, uniforms: {uSilt: {value: new THREE.Color(P.silt)}, uBg: {value: new THREE.Color(P.bg)}, uC: {value: new V3()}}, toneMapped: false});
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), siltMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({color: P.shadow[0], opacity: P.shadow[1], fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.0004;
  shade.receiveShadow = true;
  scene.add(shade);

  const crab = buildCrab();
  scene.add(crab.group);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    inkPass.material.uniforms.uPx.value.set(1 / (w * pr), 1 / (h * pr));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const tmp = new V3();
  const right = new V3().crossVectors(new V3(0, 1, 0), SUN_DIR).normalize();
  const upL = new V3().crossVectors(SUN_DIR, right);
  let texel = (2 * EXT) / sun.shadow.mapSize.x;

  /** where the body is on the floor for gait phase phi: it walks sideways toward +z */
  const bodyPos = (phi) => ({x: 0, z: phi * TRAVEL});

  // cam: tx ty tz az el d (radians), sx sy shift the picture in CSS px
  const frame = (phi, t, cam, ops = {}) => {
    const b = bodyPos(ops.travel ?? phi);
    crab.group.position.set(b.x, 0, b.z);
    crab.update(phi, {...ops, t});
    const {tx, ty, tz, az, el, d} = cam;
    camera.position.set(tx + d * Math.cos(el) * Math.cos(az), ty + d * Math.sin(el), tz - d * Math.cos(el) * Math.sin(az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    siltMat.uniforms.uC.value.set(tx, 0, tz);
    floor.position.x = shade.position.x = Math.round(tx);
    floor.position.z = shade.position.z = Math.round(tz);
    tmp.set(b.x, 0.8, b.z);
    const rr = Math.round(tmp.dot(right) / texel) * texel;
    const uu = Math.round(tmp.dot(upL) / texel) * texel;
    sun.target.position.copy(right).multiplyScalar(rr).addScaledVector(upL, uu).addScaledVector(SUN_DIR, tmp.dot(SUN_DIR));
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 12);
    sun.target.updateMatrixWorld();
    composer.render();
    return b;
  };
  const pv = new V3();
  const project = (x, y, z) => {
    pv.set(x, y, z).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, shadow, blur, radius, ao, pcf}) => {
    if (samples !== undefined)
      for (const tt of [composer.renderTarget1, composer.renderTarget2]) {
        tt.samples = samples;
        tt.dispose();
      }
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      texel = (2 * EXT) / shadow;
    }
    if (blur !== undefined) sun.shadow.blurSamples = blur;
    if (radius !== undefined) sun.shadow.radius = radius;
    if (ao !== undefined) {
      aoOn = ao > 0;
      gtao.needsSwap = aoOn;
      if (aoOn) {
        gtao.updateGtaoMaterial({samples: ao});
        gtao.updatePdMaterial({samples: Math.max(4, ao)});
      }
    }
    if (pcf !== undefined) {
      const type = pcf ? THREE.PCFSoftShadowMap : THREE.VSMShadowMap;
      if (renderer.shadowMap.type !== type) {
        renderer.shadowMap.type = type;
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        scene.traverse((o) => {
          if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true;
        });
      }
    }
  };
  return {renderer, scene, camera, crab, composer, gtao, sun, resize, frame, bodyPos, size, project, setQuality};
}
