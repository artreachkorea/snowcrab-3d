// CO-130 as a page you drive: the film's console over the stage, in real time. View buttons and keys 1-5,
// ISOLATE LEG (I), EXPLODE (E), FLIP OVER (F), OPEN CLAWS (C), PAUSE (space), the cadence slider (or ←/→), the
// breakdown rows to isolate a system, orbit by drag, zoom on the wheel. Left alone it plays the film's script as an
// auto tour with the operator's cursor, looped; any click, drag, wheel or key hands control over and 25 s of quiet
// hands it back. Cadence drives the gait phase here too, integrated frame by frame.
import {warmComposer} from '../kit/warm.js';
import {CAD_MAX, createConsole, SYS, VIEW_KEYS} from './console.js';
import {cadAt, clawAt, DURATION, explodeAt, flipAt, ghostOf, isoAt, makeConsoleFrame, makeCursor, scriptView, ss, sysAt, VIEW_FN} from './film.js';
import {createCrabStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrapDeg = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

const CSS = `
html,body{background:#dfe5e6;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.vb,.sysrow{pointer-events:auto;cursor:pointer}
.vb:hover{filter:brightness(.94)}
.cadhit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:48px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:21px;padding:0 11px;border:1px solid rgba(58,78,88,.5);background:rgba(240,244,245,.94);color:#26333a;font:700 8.5px Inter,sans-serif;letter-spacing:1.4px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#1d6b8a}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#6b787e;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.title = 'Snow crab CO-130 · teardown';
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);

  const st = createCrabStage({canvas, ink: 0.55});
  const ui = createConsole(app, st.crab.count);
  const tourCursorAt = makeCursor(ui);

  // ------------------------------------------------------------ quality tiers; phones start on the last one
  const TIERS = [
    {samples: 8, shadow: 4096, blur: 20, radius: 6, ao: 16, pcf: false, pr: 2},
    {samples: 4, shadow: 2048, blur: 10, radius: 4, ao: 8, pcf: false, pr: 1.5},
    {samples: 0, shadow: 1024, blur: 6, radius: 2, ao: 0, pcf: true, pr: 1.1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let fitReady = false;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
    if (fitReady) fit();
  };
  applyTier();
  addEventListener('resize', fit);
  fit();
  fitReady = true;
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };

  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const turnNote = document.createElement('div');
  turnNote.className = 'turn';
  turnNote.textContent = '가로로 돌리면 전체 콘솔이 보여요 · TURN SIDEWAYS';
  document.body.appendChild(turnNote);
  const [kx0, ky] = ui.knobAt(0);
  const [kx1] = ui.knobAt(CAD_MAX);
  const cadHit = document.createElement('div');
  cadHit.className = 'cadhit';
  Object.assign(cadHit.style, {left: `${kx0 - 12}px`, top: `${ky - 13}px`, width: `${kx1 - kx0 + 24}px`, height: '26px'});
  ui.root.appendChild(cadHit);

  // ------------------------------------------------------------ state
  let T = 0;
  let simT = 0;
  let phi = 0;
  let trav = 0;
  let paused = false;
  let cad = 0.7, cadTarget = 0.7;
  const tg = {iso: 0, explode: 0, flip: 0, claw: 0};
  const cv = {iso: 0, explode: 0, flip: 0, claw: 0};
  let sys = '';
  let sysK = 0;
  let isoOnAt = Infinity;
  let view = 'cine';
  let viewAt0 = 0;
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.cine(0, {x: 0, z: 0}, 0, 0)};
  let ring = {t: -9, x: 0, y: 0};
  const hist = [];
  const histAt = (t, key) => {
    if (!hist.length) return key === 'ph' ? phi : key === 'c' ? cad : 0;
    if (t <= hist[0].t) return key === 'ph' ? hist[0].ph - hist[0].c * (hist[0].t - t) : hist[0][key];
    const last = hist[hist.length - 1];
    if (t >= last.t) return last[key];
    let lo = 0, hi = hist.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (hist[m].t <= t) lo = m;
      else hi = m;
    }
    const a = hist[lo], b = hist[hi];
    return a[key] + (b[key] - a[key]) * ((t - a.t) / (b.t - a.t || 1));
  };
  const frameConsole = makeConsoleFrame(ui, st, {phiAt: (t) => histAt(t, 'ph'), cadAt: (t) => histAt(t, 'c'), relaxAt: (t) => histAt(t, 'r')});
  const pulse = (key) => {
    const n = ui.btn[key] || ui.sysRows[key];
    const r = n.getBoundingClientRect();
    const [x, y] = toStage(r.left + r.width / 2, r.top + r.height / 2);
    ring = {t: T, x, y};
  };
  const setView = (v) => {
    if (v === view) return;
    view = v;
    viewAt0 = T;
  };
  const setPaused = (p) => {
    paused = p;
    ui.btn.pause.textContent = p ? '▶ RESUME' : '❚❚ PAUSE';
  };

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, loop: 0, prevIso: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    AP.prevIso = 0;
    if (paused) setPaused(false);
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    cadTarget = cad;
    for (const k of Object.keys(tg)) tg[k] = cv[k] > 0.5 ? 1 : 0;
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', takeOver);
  for (const k of VIEW_KEYS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      if (k === 'leg') {
        tg.iso = 1;
        isoOnAt = simT;
      } else if (tg.iso) tg.iso = 0;
      setView(k);
      Object.assign(off, {az: 0, el: 0, k: 1});
    });
  ui.btn.iso.addEventListener('click', () => {
    takeOver();
    pulse('iso');
    tg.iso = tg.iso ? 0 : 1;
    if (tg.iso) {
      isoOnAt = simT;
      setView('leg');
    } else if (view === 'leg') setView('front');
  });
  for (const k of ['explode', 'flip', 'claw'])
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      tg[k] = tg[k] ? 0 : 1;
      if (k === 'flip' && tg.flip) setView('front');
    });
  for (const [k] of SYS)
    ui.sysRows[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      sys = sys === k ? '' : k;
      sysK = 0;
    });
  ui.btn.pause.addEventListener('click', () => {
    takeOver();
    pulse('pause');
    setPaused(!paused);
  });
  {
    const onMove = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      cadTarget = clamp(((x - kx0) / (kx1 - kx0)) * CAD_MAX, 0, CAD_MAX);
      lastInput = T;
    };
    cadHit.addEventListener('pointerdown', (e) => {
      takeOver();
      cadHit.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', onMove);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', onMove);
      addEventListener('pointerup', up);
      onMove(e);
    });
  }
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = {1: 'cine', 2: 'leg', 3: 'front', 4: 'flank', 5: 'top'}[key];
    if (v) ui.btn[v].click();
    else if (key === 'i') ui.btn.iso.click();
    else if (key === 'e') ui.btn.explode.click();
    else if (key === 'f') ui.btn.flip.click();
    else if (key === 'c') ui.btn.claw.click();
    else if (key === ' ') ui.btn.pause.click();
    else if (key === 'arrowright' || key === 'arrowleft') {
      takeOver();
      cadTarget = clamp(cadTarget + (key === 'arrowright' ? 0.1 : -0.1), 0, CAD_MAX);
    } else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / scale;
    const dy = (e.clientY - drag.y) / scale;
    drag = {x: e.clientX, y: e.clientY};
    off.az -= dx * 0.3;
    off.el = clamp(off.el + dy * 0.2, -10, 70);
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    takeOver();
    off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.45, 2.2);
  }, {passive: false});
  // pinch zoom on touch
  {
    const pts = new Map();
    let d0 = 0, k0 = 1;
    canvas.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
        k0 = off.k;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && d0 > 0) {
        const [a, b] = [...pts.values()];
        off.k = clamp((k0 * d0) / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])), 0.45, 2.2);
        drag = null;
      }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) d0 = 0;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  // ------------------------------------------------------------ the frame
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  let odd = false;
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.4) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    let since = T - viewAt0;
    let cursor;
    if (AP.on) {
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      if (loop > AP.loop) {
        AP.loop = loop;
        AP.prevIso = 0;
      }
      const cyc = c - loop * DURATION;
      const [t0, v] = scriptView(cyc);
      view = v;
      since = cyc - t0;
      viewAt0 = T - since;
      cadTarget = cadAt(cyc);
      const isoNow = isoAt(cyc);
      if (isoNow > 0.01 && AP.prevIso <= 0.01) isoOnAt = simT;
      AP.prevIso = isoNow;
      tg.iso = isoNow;
      tg.explode = explodeAt(cyc);
      tg.flip = flipAt(cyc);
      tg.claw = clawAt(cyc);
      const sy = sysAt(cyc);
      sys = sy.sys;
      sysK = sy.k;
      cursor = tourCursorAt(cyc);
      if (AP.loop > 0 && cyc < 0.8) {
        const end = tourCursorAt(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
      for (const k of Object.keys(cv)) cv[k] = tg[k];
    } else {
      if (T - lastInput > IDLE) startTour();
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, drag: false, ring: rk, ringX: ring.x, ringY: ring.y};
      const tau = {iso: 0.25, explode: 0.45, flip: 0.55, claw: 0.15};
      for (const k of Object.keys(cv)) cv[k] += (tg[k] - cv[k]) * (1 - Math.exp(-dt / tau[k]));
      sysK = Math.min(1, sysK + dt / 0.5);
    }
    cad += (cadTarget - cad) * (1 - Math.exp(-dt / 0.35));
    const relax = Math.max(cv.explode, cv.flip);

    if (!paused) {
      simT += dt;
      phi += cad * dt;
      trav += cad * (1 - relax) * dt;
    }
    if (!paused || !hist.length) hist.push({t: simT, ph: phi, c: cad, r: relax});
    while (hist.length > 2 && hist[0].t < simT - 6) hist.shift();
    const b = st.bodyPos(trav);

    const tgt = VIEW_FN[view](since, b, cv.flip, cv.explode);
    tgt.az += off.az;
    tgt.el = clamp(tgt.el + off.el, 2, 82);
    tgt.d *= off.k;
    const k = 1 - Math.exp(-dt / 0.55);
    const dAz = wrapDeg(tgt.az - cam.az);
    cam.az += dAz * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    const swing = Math.min(1, Math.abs(dAz) / 90);
    st.frame(phi, simT, {...cam, el: (cam.el + 8 * swing) * D2R, az: cam.az * D2R, d: cam.d + 2.5 * swing}, {travel: trav, explode: cv.explode, flip: cv.flip, claw: cv.claw, iso: ghostOf(cv.iso, sys, sysK)});

    odd = !odd;
    if (tier > 0 && odd) ui.pointer(cursor);
    else frameConsole(simT, {view, since, iso: cv.iso, cursor, labelStart: isoOnAt, explode: cv.explode, flip: cv.flip, claw: cv.claw, sys, travel: trav, relax});

    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>AUTO TOUR · CLICK TO TAKE OVER' : '▶ RESUME TOUR';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, get tier() {
    return tier;
  }, get T() {
    return T;
  }};
}
