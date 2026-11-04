// SNOW CRAB CO-130, the console film: the crab on the silt (stage.js) under the CO-130 specimen sheet (console.js).
// An operator isolates leg R2 and numbers its six segments, opens the claws, explodes the animal into its four
// systems, isolates the underside, flips the crab over to show the sternum and abdomen, then opens the cadence from
// 0.7 to 1.3 Hz and follows the sideways walk. Cadence drives the gait phase, the phase drives everything.
// A pure function of t.
import {runSim} from '../kit/runtime.js';
import {CHELA, DUTY, HERO, LEG_IDS, MM, SEG_NAMES, TRAVEL, bodyBob, legPhase, poseAt, profile} from './kin.js';
import {CAD_MAX, SEG_MM, SYS, VIEW_KEYS, createConsole} from './console.js';
import {createCrabStage} from './stage.js';

export const SCRIPT = [
  {t: 0, view: 'cine'},
  {t: 3.2, iso: 1, view: 'leg'},
  {t: 9.4, iso: 0, view: 'front'},
  {t: 10.6, claw: 1},
  {t: 12.4, claw: 0},
  {t: 13.6, explode: 1, view: 'cine'},
  {t: 16.0, sys: 'under'},
  {t: 18.0, sys: 'under'},
  {t: 19.0, explode: 0},
  {t: 20.6, flip: 1, view: 'front'},
  {t: 24.6, flip: 0, view: 'flank'},
  {t: 26.0, cad: [0.7, 1.3, 1.4]},
  {t: 28.4, view: 'top'},
  {t: 31.2, view: 'cine'},
];
export const DURATION = 34;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'snowcrab', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ operator state from the script
const evAt = (key, t, init = 0, dur = 0.8) => {
  let v = init;
  for (const e of SCRIPT) if (e[key] !== undefined) v += (e[key] - v) * ss(e.t, e.t + dur, t);
  return v;
};
export const isoAt = (t) => evAt('iso', t);
export const explodeAt = (t) => evAt('explode', t, 0, 1.3);
export const flipAt = (t) => evAt('flip', t, 0, 1.6);
export const clawAt = (t) => evAt('claw', t, 0, 0.45);
// a system row clicked once isolates it, clicked again clears it
const SYS_EV = SCRIPT.filter((e) => e.sys);
export const sysAt = (t) => {
  let cur = '';
  let since = -9;
  for (const e of SYS_EV)
    if (t >= e.t) {
      cur = cur === e.sys ? '' : e.sys;
      since = e.t;
    }
  return {sys: cur, k: ss(since, since + 0.5, t), since};
};
const CAD_EV = SCRIPT.find((e) => e.cad);
export const cadAt = (t) => {
  const [c0, c1, dur] = CAD_EV.cad;
  return c0 + (c1 - c0) * ss(CAD_EV.t, CAD_EV.t + dur, t);
};
export const relaxAt = (t) => Math.max(explodeAt(t), flipAt(t));

// gait phase and travel, integrated from t = 0 both ways
const T0 = -6;
const DT = 1 / 240;
const NTAB = Math.ceil((DURATION + 2 - T0) / DT);
const PH = new Float64Array(NTAB + 1);
const TR = new Float64Array(NTAB + 1);
{
  const i0 = Math.round(-T0 / DT);
  for (let i = i0 + 1; i <= NTAB; i++) {
    const t = T0 + (i - 0.5) * DT;
    PH[i] = PH[i - 1] + cadAt(t) * DT;
    TR[i] = TR[i - 1] + cadAt(t) * (1 - relaxAt(t)) * DT;
  }
  for (let i = i0 - 1; i >= 0; i--) {
    const t = T0 + (i + 0.5) * DT;
    PH[i] = PH[i + 1] - cadAt(t) * DT;
    TR[i] = TR[i + 1] - cadAt(t) * (1 - relaxAt(t)) * DT;
  }
}
const lookup = (A, t) => {
  const u = clamp((t - T0) / DT, 0, NTAB - 1e-6);
  const i = Math.floor(u);
  return A[i] + (A[i + 1] - A[i]) * (u - i);
};
export const phiAt = (t) => lookup(PH, t);
export const travelAt = (t) => lookup(TR, t);
export const ISO_T = SCRIPT.find((e) => e.iso === 1).t;
export const rowTimes = (start) => SEG_NAMES.map((_, i) => start + 0.9 + i * 0.55);

// ------------------------------------------------------------ views: u = seconds since switched on, b = body, f = flip, e = explode
export const VIEW_FN = {
  cine: (u, b, f, e = 0) => ({tx: b.x + 0.1, ty: 0.42 + 1.1 * f + 1.05 * e, tz: b.z, az: 316 + 1.3 * u, el: 15 + 3 * e, d: 10.4 + 5.2 * e, sx: 0, sy: -34}),
  leg: (u, b, f, e = 0) => ({tx: b.x + 0.1, ty: 0.48, tz: b.z + 1.3, az: 8 + 0.5 * u, el: 9, d: 8.6, sx: 0, sy: -24}),
  front: (u, b, f, e = 0) => ({tx: b.x, ty: 0.42 + 1.3 * f + 1.05 * e, tz: b.z, az: 2 + 0.9 * u, el: 9 + 30 * f + 3 * e, d: 10.2 + 1.6 * f + 5.2 * e, sx: 0, sy: -34}),
  flank: (u, b, f, e = 0) => ({tx: b.x, ty: 0.42, tz: b.z, az: 262 - 1.0 * u, el: 13, d: 10.6, sx: 0, sy: -34}),
  top: (u, b, f, e = 0) => ({tx: b.x - 0.2, ty: 0.2, tz: b.z, az: 180 + 1.4 * u, el: 68, d: 12.4, sx: 0, sy: -26}),
};
const VIEWS_LIST = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
export const scriptView = (t) => VIEWS_LIST.filter(([t0]) => t0 <= t).pop();
const lerpDeg = (a, b, k) => a + ((((b - a + 540) % 360) - 180) * k);
export const viewAt = (t, b, f, e = 0, list = VIEWS_LIST) => {
  let i = 0;
  while (i < list.length - 1 && list[i + 1][0] <= t) i++;
  const cur = VIEW_FN[list[i][1]](t - list[i][0], b, f, e);
  if (i === 0) return cur;
  const prev = VIEW_FN[list[i - 1][1]](t - list[i - 1][0], b, f, e);
  const k = ss(list[i][0], list[i][0] + 1.9, t);
  const o = {};
  for (const key in cur) o[key] = key === 'az' ? lerpDeg(prev.az, cur.az, k) : prev[key] + (cur[key] - prev[key]) * k;
  const swing = Math.min(1, Math.abs(((cur.az - prev.az + 540) % 360) - 180) / 90);
  o.el += 8 * Math.sin(Math.PI * k) * swing;
  o.d += Math.max(0, Math.max(prev.d, cur.d) + 2.5 * swing - o.d) * Math.sin(Math.PI * k);
  return o;
};
export const toCam = (c) => ({...c, az: c.az * D2R, el: c.el * D2R});

/** the crab's ghosting for an isolated leg (iso) and an isolated system (sys, k) */
export const ghostOf = (iso, sys, k) => {
  const g = {shell: iso, under: iso, chela: iso, legs: iso, hero: 0};
  if (sys) for (const key of ['shell', 'under', 'chela', 'legs', 'hero']) if (key !== sys && !(sys === 'legs' && key === 'hero')) g[key] = Math.max(g[key], k);
  return g;
};

// ------------------------------------------------------------ the operator's pointer
const REST = [[820, 430], [700, 480], [900, 380], [760, 520], [640, 420]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => {
    const key = e.iso !== undefined ? 'iso' : e.explode !== undefined ? 'explode' : e.flip !== undefined ? 'flip' : e.claw !== undefined ? 'claw' : e.sys ? `sys:${e.sys}` : e.cad ? 'cad' : e.view;
    return {t: e.t, key, spot: key === 'cad' ? ui.knobAt(e.cad[0]) : ui.spots[key], drag: key === 'cad' ? e.cad[2] : 0};
  });
  const WP = [[0, 840, 560]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot]);
    if (e.drag) {
      for (let k = 0; k <= 12; k++) {
        const tt = e.t + (k / 12) * e.drag;
        WP.push([tt + 0.02, ...ui.knobAt(cadAt(tt))]);
      }
      WP.push([e.t + e.drag + 0.3, ...ui.knobAt(CAD_EV.cad[1])]);
    } else WP.push([e.t + 0.24, ...e.spot]);
    WP.push([e.t + e.drag + 1.0, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const lin = WP[i + 1][0] - WP[i][0] < 0.2;
    const k = lin ? clamp((t - t0) / (t1 - t0), 0, 1) : ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = lin ? 0 : Math.sin(Math.PI * k) * Math.min(26, len * 0.07);
    let press = false, drag = false, ring = 0, rx = 0, ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + Math.max(0.09, e.drag + 0.1)) press = true;
      if (e.drag && t >= e.t && t < e.t + e.drag + 0.1) drag = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, drag, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ console data for a frame
const CALLS = [
  {name: 'CARAPACE', sub: '130 mm · TUBERCLES · H-SHAPED GROOVE', pt: (o) => o.shellTop},
  {name: 'CHELIPED', sub: 'SERRATED FINGERS · PALE TIPS', pt: (o) => o.chelaTip},
  {name: 'WALKING LEG', sub: 'FLATTENED · SPINULES ON BOTH EDGES', pt: (o) => o.heroJoints[2].map((v, i) => (v + o.heroJoints[3][i]) / 2)},
  {name: 'DACTYLUS', sub: 'HOOKED TIP · THE ONLY PART ON THE FLOOR', pt: (o) => o.heroJoints[6]},
];
const CALL_VIEWS = {cine: 1, front: 1, flank: 1, leg: 0, top: 0};
const FILM_SRC = {phiAt, cadAt, relaxAt};

export function makeConsoleFrame(ui, st, src = FILM_SRC) {
  return (t, ops) => {
    const phi = src.phiAt(t);
    const cad = src.cadAt(t);
    const relax = ops.relax ?? src.relaxAt(t);
    const amp = 1 - relax;
    const {view, since, iso, cursor} = ops;
    const poses = st.crab.out.poses || poseAt(phi, amp);
    const hero = poses.find((L) => L.side === HERO.side && L.i === HERO.i);
    // contact chart: 150 columns over the last 3 s
    const gait = LEG_IDS.map(({side, i}) => {
      const runs = [];
      let a = -1;
      for (let c = 0; c <= 150; c++) {
        const tt = t - 3 + (c / 150) * 3;
        const on = src.relaxAt(tt) < 0.5 && legPhase(src.phiAt(tt), side, i) < DUTY;
        if (on && a < 0) a = c / 150;
        if ((!on || c === 150) && a >= 0) {
          runs.push([a, c / 150]);
          a = -1;
        }
      }
      return runs;
    });
    const feetDown = relax > 0.5 ? 0 : poses.filter((L) => L.down).length;
    const liftHist = [];
    const bodyHist = [];
    let bodyMax = 0;
    for (let i = 0; i <= 120; i++) {
      const tt = t - 4 + (i / 120) * 4;
      const ph = src.phiAt(tt);
      const am = 1 - src.relaxAt(tt);
      const lp = legPhase(ph, HERO.side, HERO.i);
      const lift = lp < DUTY ? 0 : 0.17 * Math.sin(Math.PI * ((lp - DUTY) / (1 - DUTY))) ** 1.2;
      liftHist.push(lift * am * MM);
      const bb = bodyBob(ph, am) * MM;
      bodyHist.push(bb);
      bodyMax = Math.max(bodyMax, Math.abs(bb));
    }
    // segment rows and their tags on the leg
    const ROW_T = rowTimes(ops.labelStart ?? ISO_T);
    const rows = {};
    const tags = [];
    const J = st.crab.out.heroJoints;
    ROW_T.forEach((tl, i) => {
      if (iso < 0.05) return;
      if (t >= tl) rows[i] = t - tl < 0.7 ? 2 : 1;
      const o = ss(tl, tl + 0.25, t) * iso * (view === 'leg' ? 1 : 0);
      if (o < 0.02 || !J?.length) return;
      const mid = J[i].map((v, k) => (v + J[i + 1][k]) / 2);
      const at = st.project(mid[0], mid[1] + 0.12, mid[2]);
      if (at) tags.push({k: String(i + 1), at, o, lit: rows[i] === 2, label: `${SEG_NAMES[i]} ${SEG_MM[i].toFixed(0)} mm`});
    });
    const vw = (CALL_VIEWS[view] ?? 0) * ss(1.2, 1.9, since) * (1 - iso) * (1 - relax);
    const callouts = CALLS.map((c) => {
      if (vw < 0.02) return {o: 0};
      const p = c.pt(st.crab.out);
      const at = p && st.project(...p);
      if (!at || at[0] < 40 || at[0] > 1560 || at[1] < 60 || at[1] > 720 || ui.covered(at[0], at[1])) return {o: 0};
      const dx = at[0] < 790 ? -70 : 70;
      const dy = at[1] > 420 ? 56 : -64;
      if (ui.covered(at[0] + dx + (dx < 0 ? -190 : 190), at[1] + dy)) return {o: 0};
      return {...c, at, dx, dy, o: vw};
    });
    const claw = ops.claw ?? 0;
    const gapeRad = 0.62 * claw;
    ui.update({
      cad,
      speed: cad * TRAVEL * MM * amp,
      feetDown,
      dist: (ops.travel ?? 0) * TRAVEL * 0.1,
      hero,
      profile: profile(hero.ik),
      bob: bodyBob(phi, amp),
      rows,
      gait,
      legs: poses,
      liftHist,
      bodyHist,
      bodyMM: Math.max(0.1, bodyMax),
      gapeDeg: (gapeRad * 180) / Math.PI,
      gapeMM: 2 * CHELA.finger * Math.sin(gapeRad / 2) * MM,
      drag: cursor.drag,
      viewOn: Object.fromEntries(VIEW_KEYS.map((k) => [k, k === view ? 1 : 0])),
      iso,
      explode: ops.explode ?? 0,
      flip: ops.flip ?? 0,
      claw,
      sysIso: ops.sys ?? '',
      tags,
      callouts,
      cursor,
    });
  };
}

export function makeFilm() {
  return async ({cfg, canvas, capture}) => {
    const st = createCrabStage({canvas, ink: cfg.ink ?? 0.55});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    if (cfg.quality) st.setQuality(cfg.quality);
    const ui = createConsole(document.getElementById('app'), st.crab.count);
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    window.CRAB = st;
    return {
      resize,
      render(t) {
        const phi = phiAt(t);
        const trav = travelAt(t);
        const ex = explodeAt(t);
        const fl = flipAt(t);
        const iso = isoAt(t);
        const sy = sysAt(t);
        const claw = clawAt(t);
        const b = st.bodyPos(trav);
        st.frame(phi, t, toCam(viewAt(t, b, fl, ex)), {travel: trav, explode: ex, flip: fl, claw, iso: ghostOf(iso, sy.sys, sy.k)});
        const [t0, view] = scriptView(t);
        frame(t, {view, since: t - t0, iso, cursor: cursorAt(t), explode: ex, flip: fl, claw, sys: sy.sys, travel: trav});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
void SYS;
void CAD_MAX;
