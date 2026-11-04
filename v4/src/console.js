// The CO-130 console: a cool specimen sheet over the silt (pale panels, slate ink) with one deep-sea blue accent for
// whatever is working right now. Fixed 1600 x 900 CSS layout. update(state) redraws every live part from the frame's
// state: the side profile is the hero leg's real IK pose, the contact chart the real stance of all 8 feet, the gait
// clock the real phase of each leg, so a captured frame depends only on t.
import {CHELA, DUTY, HERO, HERO_PATH, LEG_IDS, MM, SEG_NAMES, STRIDE, legLengths} from './kin.js';

export const C = {ink: '#1f2a30', mute: '#6b787e', faint: '#a9b4b8', line: 'rgba(58,78,88,.42)', paper: 'rgba(240,244,245,.88)', accent: '#1d6b8a', dark: '#26333a', crab: '#d4521f'};
export const VIEW_KEYS = ['cine', 'leg', 'front', 'flank', 'top'];
export const TOGGLES = ['iso', 'explode', 'flip', 'claw'];
export const SYS = [
  ['shell', 'CARAPACE', 'SHELL · ROSTRUM · EYES · ANTENNAE'],
  ['under', 'UNDERSIDE', 'STERNUM · ABDOMEN · MAXILLIPEDS'],
  ['chela', 'CHELIPEDS', '2 CLAWS · 7 PIECES EACH'],
  ['legs', 'WALKING LEGS', '4 PAIRS · 6 SEGMENTS EACH'],
];
const HERO_LEN = legLengths(HERO.i);
export const SEG_MM = [HERO_LEN.coxa, HERO_LEN.basis, HERO_LEN.merus, HERO_LEN.carpus, HERO_LEN.propodus, HERO_LEN.dactylus].map((v) => v * MM);
export const CAD_MAX = 1.6;
const CSS = `
#app{font-family:Inter,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.pn{position:absolute;background:${C.paper};border:1px solid ${C.line};backdrop-filter:blur(3px)}
.hd{font-size:9px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;white-space:nowrap}
.hd i{font-style:normal;color:${C.accent};margin-right:7px;letter-spacing:0}
.lb{font-size:8px;font-weight:600;letter-spacing:1.3px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.vl{font-size:10.5px;font-weight:600;letter-spacing:.4px;white-space:nowrap}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.vb{position:absolute;height:19px;padding:0 9px;display:flex;align-items:center;font-size:8.5px;font-weight:700;letter-spacing:1.4px;border:1px solid ${C.line};background:rgba(240,244,245,.92);color:${C.dark}}
.sysrow{position:absolute;display:flex;align-items:center;gap:9px;height:30px}
.call{position:absolute;white-space:nowrap;background:rgba(240,244,245,.88);border:1px solid ${C.line};padding:4px 7px 4px}
.call b{display:block;font-size:8.5px;font-weight:700;letter-spacing:1.4px}
.call span{display:block;font-size:7.5px;letter-spacing:1.1px;color:${C.mute};margin-top:2px}
.tag{position:absolute;display:flex;align-items:center;gap:5px;white-space:nowrap;transform:translate(-50%,-50%)}
.tag b{width:17px;height:17px;border-radius:50%;display:grid;place-items:center;font:700 10px 'JetBrains Mono',monospace;color:#f2f6f7;background:${C.dark};box-shadow:0 0 0 1.5px rgba(242,246,247,.9)}
.tag span{font:600 8.5px 'JetBrains Mono',monospace;color:${C.dark};background:rgba(240,244,245,.9);padding:1px 4px;border:1px solid ${C.line}}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}
.ring{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:1.6px solid ${C.accent};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};

export function createConsole(app, counts) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // ------------------------------------------------------------ top bar
  add(`<div style="position:absolute;left:12px;right:12px;top:8px;height:24px;border-bottom:1px solid ${C.line}"></div>`);
  add(`<div class="lb" style="left:18px;top:14px;position:absolute;color:${C.dark}">◇ COLD WATER BENTHOS LAB · DECAPODA</div>`);
  add(`<div class="lb mono" style="position:absolute;left:318px;top:14px;color:${C.dark};letter-spacing:2px">◆ CO-130-M ◆</div>`);
  const btn = {};
  {
    let x = 1588;
    const right = (key, txt, w) => {
      x -= w;
      btn[key] = add(`<div class="vb" style="left:${x}px;top:10px;width:${w}px;justify-content:center">${txt}</div>`);
      x -= 4;
    };
    right('pause', '❚❚ PAUSE', 84);
    x -= 10;
    right('claw', 'OPEN CLAWS', 92);
    right('flip', 'FLIP OVER', 82);
    right('explode', 'EXPLODE', 74);
    right('iso', 'ISOLATE LEG', 98);
    x -= 10;
    for (const k of [...VIEW_KEYS].reverse()) right(k, k.toUpperCase(), k.length * 7 + 22);
    add(`<div class="lb" style="position:absolute;left:${x - 34}px;top:15px">VIEW</div>`);
  }
  add(`<div class="lb" style="position:absolute;right:16px;top:36px;letter-spacing:1px;font-size:7.5px">DRAG TO ORBIT · 1–5 VIEWS · I ISOLATE · E EXPLODE · F FLIP · C CLAWS · ←/→ CADENCE · SPACE PAUSE</div>`);

  // ------------------------------------------------------------ title block
  add(`<div style="position:absolute;left:34px;top:50px;font-size:31px;font-weight:500;letter-spacing:.6px;line-height:1">SNOW CRAB <span style="color:${C.crab};font-weight:600">대게</span></div>`);
  add(`<div class="lb" style="position:absolute;left:35px;top:88px;color:${C.dark};font-size:8.5px;letter-spacing:1.6px">CHIONOECETES OPILIO · ADULT MALE · BUILT FROM 9 REFERENCE PHOTOS</div>`);
  const SPECS = [
    ['SUPERFAMILY', 'MAJOIDEA · SPIDER CRABS'],
    ['CARAPACE', '130 × 120 mm (MODEL)'],
    ['LIMBS', '8 WALKING LEGS + 2 CHELIPEDS'],
    ['SEGMENTS', '6 PER LEG'],
    ['PIECES', `${total} IN THIS MODEL`],
    ['GAIT', 'ALTERNATING TETRAPOD'],
  ];
  add(`<div style="position:absolute;left:35px;top:110px;display:grid;grid-template-columns:96px auto;row-gap:6px">${SPECS.map(([k, v]) => `<span class="lb">${k}:</span><span class="vl">${v}</span>`).join('')}
    <span style="grid-column:1/3;height:1px;background:${C.line};margin:3px 0"></span>
    <span class="lb">CADENCE:</span><span class="vl mono" data-k="cad"></span>
    <span class="lb">SIDEWAYS:</span><span class="vl mono" data-k="speed"></span>
    <span class="lb">FEET DOWN:</span><span class="vl mono" data-k="feet"></span>
    <span class="lb">DISTANCE:</span><span class="vl mono" data-k="dist"></span></div>`);

  // ------------------------------------------------------------ breakdown, left: systems you can isolate, the hero leg's segments
  const BD = {x: 34, y: 360, w: 262, h: 360};
  add(`<div class="pn" style="left:${BD.x}px;top:${BD.y}px;width:${BD.w}px;height:${BD.h}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:${BD.x + 12}px;top:${BD.y + 11}px"><i>›››</i>BREAKDOWN · 4 SYSTEMS</div>`);
  add(`<div class="lb" style="position:absolute;left:${BD.x + 12}px;top:${BD.y + 26}px;font-size:7px">CLICK A SYSTEM TO ISOLATE IT</div>`);
  const sysRows = {};
  SYS.forEach(([k, name, sub], i) => {
    const y = BD.y + 42 + i * 34;
    const n = counts[k] + (k === 'legs' ? counts.hero ?? 0 : 0);
    sysRows[k] = add(`<div class="sysrow" style="left:${BD.x + 8}px;top:${y}px;width:${BD.w - 16}px;padding:0 4px;pointer-events:auto;cursor:pointer">
      <span data-r="dot" style="width:9px;height:9px;border-radius:50%;border:1px solid ${C.dark}"></span>
      <span style="flex:1"><span class="vl" style="display:block;font-size:10px">${name}</span><span class="lb" style="display:block;font-size:6.8px;margin-top:2px">${sub}</span></span>
      <span class="mono vl" data-r="n" style="font-size:10.5px">${String(n).padStart(2, '0')}</span></div>`);
  });
  const SG = {y: BD.y + 42 + 4 * 34 + 10};
  add(`<div style="position:absolute;left:${BD.x + 12}px;top:${SG.y - 4}px;width:${BD.w - 24}px;border-top:1px dashed ${C.line}"></div>`);
  add(`<div class="hd" style="position:absolute;left:${BD.x + 12}px;top:${SG.y + 4}px;font-size:8px"><i>›</i>LEG R2 · SEGMENT LENGTHS · mm</div>`);
  const segRows = SEG_NAMES.map((nm, i) => {
    const y = SG.y + 22 + i * 19;
    return add(`<div style="position:absolute;left:${BD.x + 12}px;top:${y}px;width:${BD.w - 24}px;height:17px;display:flex;align-items:center;gap:8px">
      <span class="mono" data-r="dot" style="width:15px;height:15px;border-radius:50%;display:grid;place-items:center;font-size:8.5px;font-weight:700;border:1px solid ${C.line}">${i + 1}</span>
      <span class="lb" style="width:78px;font-size:7.4px;color:${C.dark}">${nm}</span>
      <span class="mono" data-r="val" style="font-size:10.5px;font-weight:600;width:28px;text-align:right">${SEG_MM[i].toFixed(0)}</span>
      <span style="flex:1;height:5px;background:rgba(58,78,88,.13);position:relative"><span data-r="bar" style="position:absolute;left:0;top:0;bottom:0;width:${((SEG_MM[i] / 100) * 100).toFixed(1)}%;background:${C.faint}"></span></span></div>`);
  });

  // ------------------------------------------------------------ side profile of the hero leg, top right
  const LP = {x: 1300, y: 52, w: 272, h: 398};
  add(`<div class="pn" style="left:${LP.x}px;top:${LP.y}px;width:${LP.w}px;height:${LP.h}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:${LP.x + 12}px;top:${LP.y + 11}px"><i>›››</i>LEG R2 · SIDE PROFILE</div>`);
  add(`<div class="lb" style="position:absolute;left:${LP.x + 12}px;top:${LP.y + 26}px;font-size:7px">IN THE LEG'S OWN PLANE · LIVE IK POSE</div>`);
  const prof = add(`<svg style="position:absolute;left:${LP.x + 12}px;top:${LP.y + 40}px" width="248" height="250"></svg>`);
  add(`<div style="position:absolute;left:${LP.x + 12}px;top:${LP.y + 300}px;width:${LP.w - 24}px;display:grid;grid-template-columns:1fr auto;row-gap:5px">
    <span class="lb">MERUS ELEVATION</span><span class="vl mono" data-k="merus"></span>
    <span class="lb">KNEE · MERUS–CARPUS</span><span class="vl mono" data-k="knee"></span>
    <span class="lb">PHASE</span><span class="vl mono" data-k="phase"></span>
    <span class="lb">FOOT LIFT</span><span class="vl mono" data-k="lift"></span></div>`);

  // ------------------------------------------------------------ cadence and the gait clock, right
  const GP = {x: 1300, y: 462, w: 272, h: 258};
  add(`<div class="pn" style="left:${GP.x}px;top:${GP.y}px;width:${GP.w}px;height:${GP.h}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:${GP.x + 12}px;top:${GP.y + 11}px"><i>›››</i>CADENCE · GAIT CLOCK</div>`);
  const SL = {x: GP.x + 16, y: GP.y + 52, w: GP.w - 32};
  add(`<div class="lb" style="position:absolute;left:${SL.x}px;top:${SL.y - 18}px">STEP CYCLES / S</div>`);
  const cadVal = add(`<div class="vl mono" style="position:absolute;right:${1600 - (SL.x + SL.w)}px;top:${SL.y - 20}px;color:${C.accent}"></div>`);
  add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y}px;width:${SL.w}px;height:3px;background:rgba(58,78,88,.2)"></div>`);
  const fill = add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y}px;height:3px;background:${C.accent}"></div>`);
  const knob = add(`<div style="position:absolute;top:${SL.y - 6.5}px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#f2f6f7;border:1.6px solid ${C.dark}"></div>`);
  add(`<svg style="position:absolute;left:${SL.x}px;top:${SL.y + 8}px" width="${SL.w}" height="14">${[0, 0.4, 0.8, 1.2, 1.6].map((v) => `<line x1="${(v / CAD_MAX) * SL.w}" x2="${(v / CAD_MAX) * SL.w}" y1="0" y2="4" stroke="${C.dark}" stroke-width=".8"/><text x="${Math.min(SL.w - 10, Math.max(5, (v / CAD_MAX) * SL.w))}" y="12" font-size="6.5" text-anchor="middle" fill="${C.mute}">${v.toFixed(1)}${v === 1.6 ? ' Hz' : ''}</text>`).join('')}</svg>`);
  const clock = add(`<svg style="position:absolute;left:${GP.x + 10}px;top:${GP.y + 86}px" width="150" height="150"></svg>`);
  add(`<div style="position:absolute;left:${GP.x + 166}px;top:${GP.y + 92}px;width:96px;display:flex;flex-direction:column;gap:7px">
    <div><div class="lb">DUTY FACTOR</div><div class="vl mono">${Math.round(DUTY * 100)} %</div></div>
    <div><div class="lb">STRIDE</div><div class="vl mono">${(STRIDE * MM).toFixed(0)} mm</div></div>
    <div><div class="lb">GROUP A</div><div class="vl mono" style="color:${C.accent}">L1 R2 L3 R4</div></div>
    <div><div class="lb">GROUP B</div><div class="vl mono">R1 L2 R3 L4</div></div></div>`);

  // ------------------------------------------------------------ bottom strip: contact chart, claw gape, body and foot
  const BY = 734;
  const BH = 154;
  add(`<div class="pn" style="left:34px;top:${BY}px;width:960px;height:${BH}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:46px;top:${BY + 11}px"><i>›››</i>FOOT CONTACT · 8 LEGS · LAST 3 S</div>`);
  add(`<div class="lb" style="position:absolute;left:740px;top:${BY + 12}px"><span style="display:inline-block;width:14px;height:6px;background:${C.dark};vertical-align:middle;margin-right:6px"></span>ON THE FLOOR <span style="display:inline-block;width:14px;height:6px;background:${C.accent};vertical-align:middle;margin:0 6px 0 14px"></span>LEG R2</div>`);
  const gait = add(`<svg style="position:absolute;left:46px;top:${BY + 32}px" width="936" height="114"></svg>`);

  add(`<div class="pn" style="left:1002px;top:${BY}px;width:276px;height:${BH}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:1014px;top:${BY + 11}px"><i>›››</i>CHELA · FINGER GAPE</div>`);
  const gape = add(`<svg style="position:absolute;left:1012px;top:${BY + 28}px" width="130" height="118"></svg>`);
  add(`<div style="position:absolute;left:1150px;top:${BY + 34}px;width:120px;display:flex;flex-direction:column;gap:6px">
    <div><div class="lb">FINGER</div><div class="vl mono">${(CHELA.finger * MM).toFixed(0)} mm</div></div>
    <div><div class="lb">OPENING</div><div class="vl mono" data-k="gdeg"></div></div>
    <div><div class="lb">TIP GAPE</div><div class="vl mono" data-k="gmm"></div></div>
    <div><div class="lb">EDGE</div><div class="vl mono">SERRATED</div></div></div>`);

  add(`<div class="pn" style="left:1286px;top:${BY}px;width:286px;height:${BH}px"></div>`);
  add(`<div class="hd" style="position:absolute;left:1298px;top:${BY + 11}px"><i>›››</i>BODY HEIGHT · FOOT LIFT</div>`);
  const ride = add(`<svg style="position:absolute;left:1296px;top:${BY + 28}px" width="268" height="96"></svg>`);
  add(`<div style="position:absolute;left:1298px;top:${BY + 128}px;width:262px;display:flex;justify-content:space-between">
    <span class="lb"><b style="color:${C.accent}">—</b> FOOT R2 <b class="mono" style="color:${C.ink}" data-k="lift2"></b></span>
    <span class="lb"><b style="color:${C.ink}">—</b> BODY <b class="mono" style="color:${C.ink}" data-k="body"></b></span></div>`);

  // ------------------------------------------------------------ overlays
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const tags = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="24" height="24" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#1d1a16" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);

  const K = {};
  for (const n of ui.querySelectorAll('[data-k]')) K[n.dataset.k] = n;
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    const sc = a.width / 1600 || 1;
    return [(r.left - a.left + r.width / 2) / sc, (r.top - a.top + r.height / 2) / sc];
  };
  const spots = Object.fromEntries([...Object.entries(btn), ...Object.entries(sysRows).map(([k, n]) => [`sys:${k}`, n])].map(([k, n]) => [k, centre(n)]));
  const knobAt = (c) => [SL.x + (c / CAD_MAX) * SL.w, SL.y + 1.5];
  const PANELS = [[1300, 52, 1572, 720], [34, 360, 296, 720], [34, BY, 1572, 888], [30, 44, 340, 330], [560, 6, 1592, 44]];
  const covered = (x, y) => PANELS.some(([a, b, c, d]) => x > a - 8 && x < c + 8 && y > b - 8 && y < d + 8);

  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };

  // profile frame: leg-plane units to panel px, socket at the left, floor near the bottom
  const PS = 82;
  const PX = (u) => 14 + u * PS;
  const PY = (v) => 92 - v * PS;
  const pathD = HERO_PATH.map(([u, v], i) => `${i ? 'L' : 'M'}${PX(u).toFixed(1)} ${PY(v).toFixed(1)}`).join(' ');

  return {
    spots,
    btn,
    sysRows,
    root: ui,
    covered,
    knobAt,
    update(s) {
      K.cad.textContent = `${s.cad.toFixed(2)} Hz`;
      K.speed.textContent = `${s.speed.toFixed(0)} mm/s`;
      K.feet.textContent = `${s.feetDown} / 8`;
      K.dist.textContent = `${s.dist.toFixed(2)} m`;
      const ik = s.hero.ik;
      K.merus.textContent = `${((ik.a1 * 180) / Math.PI).toFixed(1)}°`;
      K.knee.textContent = `${((-ik.knee * 180) / Math.PI).toFixed(1)}°`;
      K.phase.textContent = `${s.hero.down ? 'STANCE' : 'SWING'} ${(s.hero.p * 100).toFixed(0).padStart(2, '0')}%`;
      K.lift.textContent = `${(s.hero.lift * MM).toFixed(0)} mm`;
      K.lift2.textContent = `${(s.hero.lift * MM).toFixed(0)} mm`;
      K.body.textContent = `±${s.bodyMM.toFixed(1)} mm`;
      K.gdeg.textContent = `${s.gapeDeg.toFixed(0)}°`;
      K.gmm.textContent = `${s.gapeMM.toFixed(0)} mm`;

      // systems: isolated one inked, the rest hollow
      for (const [k] of SYS) {
        const r = sysRows[k];
        const on = s.sysIso === k;
        r.style.background = on ? 'rgba(29,107,138,.12)' : 'transparent';
        r.querySelector('[data-r=dot]').style.background = on ? C.accent : 'transparent';
        r.querySelector('[data-r=dot]').style.borderColor = on ? C.accent : C.dark;
        r.querySelector('[data-r=n]').style.color = on ? C.accent : C.ink;
      }
      // segments: revealed rows inked, the newest lit
      segRows.forEach((r, i) => {
        const st = s.rows[i] || 0;
        const dot = r.querySelector('[data-r=dot]');
        dot.style.background = st === 2 ? C.accent : st === 1 ? C.dark : 'transparent';
        dot.style.color = st ? '#f2f6f7' : C.dark;
        dot.style.borderColor = st ? 'transparent' : C.line;
        r.querySelector('[data-r=bar]').style.background = st === 2 ? C.accent : st === 1 ? C.dark : C.faint;
        r.querySelector('[data-r=val]').style.color = st === 2 ? C.accent : C.ink;
      });

      // the side profile: floor, the foot's closed path, the live chain
      {
        const pts = s.profile;
        let h = `<line x1="0" x2="248" y1="${PY(-0.4)}" y2="${PY(-0.4)}" stroke="${C.dark}" stroke-width=".8"/>`;
        for (let i = 0; i < 31; i++) h += `<line x1="${i * 8}" y1="${PY(-0.4) + 2}" x2="${i * 8 + 5}" y2="${PY(-0.4) + 7}" stroke="${C.faint}" stroke-width=".6"/>`;
        h += `<path d="${pathD} Z" fill="none" stroke="${C.accent}" stroke-width="1.3" stroke-dasharray="3 2" opacity=".85" transform="translate(0 ${(-s.bob * PS).toFixed(2)})"/>`;
        h += `<rect x="0" y="${PY(0.12)}" width="16" height="${0.24 * PS}" fill="rgba(212,82,31,.18)" stroke="${C.crab}" stroke-width=".8"/><text x="2" y="${PY(0.12) - 4}" font-size="6.5" fill="${C.mute}">BODY</text>`;
        for (let i = 0; i < pts.length - 1; i++) {
          const lit = s.rows[i] === 2 || (s.rows[i] === 1 && s.iso > 0.5);
          const [a, b] = [pts[i], pts[i + 1]];
          h += `<line x1="${PX(a[0]).toFixed(1)}" y1="${PY(a[1]).toFixed(1)}" x2="${PX(b[0]).toFixed(1)}" y2="${PY(b[1]).toFixed(1)}" stroke="${s.rows[i] === 2 ? C.accent : C.crab}" stroke-width="${i < 2 ? 5 : i === 5 ? 3 : 4.2}" stroke-linecap="round" opacity="${lit || s.iso < 0.5 ? 1 : 0.55}"/>`;
        }
        pts.forEach(([u, v], i) => {
          if (i === 6) return;
          h += `<circle cx="${PX(u).toFixed(1)}" cy="${PY(v).toFixed(1)}" r="${i === 0 ? 3.6 : 2.6}" fill="${i === 0 ? C.dark : '#f2f6f7'}" stroke="${C.dark}" stroke-width="1.2"/>`;
        });
        const tip = pts[6];
        h += `<circle cx="${PX(tip[0]).toFixed(1)}" cy="${PY(tip[1]).toFixed(1)}" r="4.5" fill="none" stroke="${C.accent}" stroke-width="1.6"/>`;
        for (let i = 0; i < 6; i++) {
          const mx = (PX(pts[i][0]) + PX(pts[i + 1][0])) / 2;
          const my = (PY(pts[i][1]) + PY(pts[i + 1][1])) / 2 - 9;
          const lit = s.rows[i] === 2;
          if (i < 2) continue;
          h += `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5.6" fill="${lit ? C.accent : '#f2f6f7'}" stroke="${lit ? C.accent : C.line}" stroke-width=".8"/><text x="${mx.toFixed(1)}" y="${(my + 2.6).toFixed(1)}" font-size="7.5" font-weight="700" text-anchor="middle" fill="${lit ? '#f2f6f7' : C.dark}" font-family="JetBrains Mono">${i + 1}</text>`;
        }
        h += `<text x="244" y="${PY(-0.4) - 6}" font-size="6.5" text-anchor="end" fill="${C.mute}">SEA FLOOR</text>`;
        prof.innerHTML = h;
      }

      // cadence slider
      {
        const [kx] = knobAt(s.cad);
        knob.style.left = `${kx.toFixed(1)}px`;
        knob.style.transform = `scale(${s.drag ? 1.18 : 1})`;
        knob.style.borderColor = s.drag ? C.accent : C.dark;
        fill.style.width = `${(kx - SL.x).toFixed(1)}px`;
        cadVal.textContent = `${s.cad.toFixed(2)} Hz`;
      }
      // gait clock: each leg at its phase; the stance arc shaded
      {
        const cx = 75, cy = 75, R = 56;
        const arc = (a0, a1, r) => {
          const p0 = [cx + Math.sin(a0) * r, cy - Math.cos(a0) * r];
          const p1 = [cx + Math.sin(a1) * r, cy - Math.cos(a1) * r];
          return `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
        };
        let h = `<circle cx="${cx}" cy="${cy}" r="${R + 8}" fill="none" stroke="${C.line}" stroke-width=".8"/>`;
        h += `<path d="${arc(0, DUTY * Math.PI * 2, R + 8)}" fill="none" stroke="${C.dark}" stroke-width="3" opacity=".75"/><text x="${cx + 34}" y="${cy + 54}" font-size="6.2" fill="${C.mute}">STANCE</text><text x="${cx - 60}" y="${cy - 52}" font-size="6.2" fill="${C.mute}">SWING</text>`;
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2;
          h += `<line x1="${cx + Math.sin(a) * (R + 8)}" y1="${cy - Math.cos(a) * (R + 8)}" x2="${cx + Math.sin(a) * (R + 4)}" y2="${cy - Math.cos(a) * (R + 4)}" stroke="${C.mute}" stroke-width=".5"/>`;
        }
        h += `<circle cx="${cx}" cy="${cy}" r="6" fill="${C.dark}"/>`;
        s.legs.forEach((L, k) => {
          const a = L.p * Math.PI * 2;
          const r = R - 6 - (k % 4) * 9;
          const x = cx + Math.sin(a) * r;
          const y = cy - Math.cos(a) * r;
          const hero = L.name === 'R2';
          const A = ['L1', 'R2', 'L3', 'R4'].includes(L.name);
          h += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${hero ? C.accent : C.dark}" stroke-width="${hero ? 1.8 : 0.6}" opacity="${hero ? 1 : 0.4}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hero ? 7.5 : 6.5}" fill="${hero ? C.accent : A ? '#dbe7ec' : '#f2f6f7'}" stroke="${hero ? C.accent : C.dark}" stroke-width=".8"/><text x="${x.toFixed(1)}" y="${(y + 2.3).toFixed(1)}" font-size="5.8" font-weight="700" text-anchor="middle" fill="${hero ? '#f2f6f7' : C.dark}" font-family="JetBrains Mono">${L.name}</text>`;
        });
        clock.innerHTML = h;
      }
      // contact chart
      {
        const W = 936, x0 = 46, rowH = 12.4;
        let h = '';
        s.gait.forEach((row, r) => {
          const y = 2 + r * rowH + (r >= 4 ? 6 : 0);
          const hero = LEG_IDS[r].name === 'R2';
          h += `<text x="0" y="${y + 8}" font-size="7" fill="${hero ? C.accent : C.mute}" font-family="JetBrains Mono" font-weight="${hero ? 700 : 400}">${LEG_IDS[r].name}</text>`;
          for (const [a, b] of row) h += `<rect x="${(x0 + a * (W - x0)).toFixed(1)}" y="${y}" width="${Math.max(0.8, (b - a) * (W - x0)).toFixed(1)}" height="${rowH - 3.4}" fill="${hero ? C.accent : C.dark}" opacity="${hero ? 1 : 0.75}"/>`;
        });
        h += `<line x1="${W}" x2="${W}" y1="0" y2="110" stroke="${C.accent}" stroke-width="1"/><text x="${W - 3}" y="113" font-size="6" text-anchor="end" fill="${C.mute}">NOW</text>`;
        gait.innerHTML = h;
      }
      // claw gape gauge
      {
        const cx = 16, cy = 92, R = 96;
        const a = (s.gapeDeg * Math.PI) / 180;
        let h = '';
        for (let d = 0; d <= 40; d += 5) {
          const r = (d * Math.PI) / 180;
          h += `<line x1="${cx + Math.cos(-r) * (R - 6)}" y1="${cy + Math.sin(-r) * (R - 6)}" x2="${cx + Math.cos(-r) * R}" y2="${cy + Math.sin(-r) * R}" stroke="${C.mute}" stroke-width=".6"/>`;
          if (d % 10 === 0) h += `<text x="${cx + Math.cos(-r) * (R + 8)}" y="${cy + Math.sin(-r) * (R + 8) + 2}" font-size="6" fill="${C.mute}" text-anchor="middle">${d}°</text>`;
        }
        h += `<path d="M${cx} ${cy} L${cx + R - 10} ${cy + 4} L${cx + R - 4} ${cy} Z" fill="${C.crab}" opacity=".85"/>`;
        h += `<path d="M${cx} ${cy} L${cx + Math.cos(-a) * (R - 4)} ${cy + Math.sin(-a) * (R - 4)} L${cx + Math.cos(-a - 0.06) * (R - 12)} ${cy + Math.sin(-a - 0.06) * (R - 12)} Z" fill="${C.accent}"/>`;
        h += `<path d="M${cx + 40} ${cy} A40 40 0 0 0 ${cx + Math.cos(-a) * 40} ${cy + Math.sin(-a) * 40}" fill="none" stroke="${C.accent}" stroke-width="1.2"/>`;
        h += `<circle cx="${cx}" cy="${cy}" r="4" fill="${C.dark}"/>`;
        gape.innerHTML = h;
      }
      // body height and the hero foot's lift, last 4 s
      {
        const W = 268;
        const Y = (mm) => 82 - (mm / 200) * 74;
        let pf = '', pb = '';
        s.liftHist.forEach((v, i) => (pf += `${i ? 'L' : 'M'}${((i / (s.liftHist.length - 1)) * W).toFixed(1)} ${Y(v).toFixed(1)}`));
        s.bodyHist.forEach((v, i) => (pb += `${i ? 'L' : 'M'}${((i / (s.bodyHist.length - 1)) * W).toFixed(1)} ${(Y(100) - v * 2).toFixed(1)}`));
        ride.innerHTML = `${[0, 50, 100, 150, 200].map((v) => `<line x1="18" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.faint}" stroke-width=".5" stroke-dasharray="2 3"/><text x="0" y="${Y(v) + 2}" font-size="6" fill="${C.mute}" font-family="JetBrains Mono">${v}</text>`).join('')}<path d="${pf}" fill="none" stroke="${C.accent}" stroke-width="1.5" transform="translate(18 0) scale(${(W - 18) / W} 1)"/><path d="${pb}" fill="none" stroke="${C.ink}" stroke-width="1.5" transform="translate(18 0) scale(${(W - 18) / W} 1)"/><text x="${W}" y="${Y(100) - 6}" font-size="6" text-anchor="end" fill="${C.mute}">BODY LEVEL</text>`;
      }
      // buttons
      for (const k of VIEW_KEYS) {
        const v = s.viewOn[k] || 0;
        btn[k].style.background = v > 0.5 ? C.dark : 'rgba(240,244,245,.92)';
        btn[k].style.color = v > 0.5 ? '#f2f6f7' : C.dark;
      }
      for (const k of TOGGLES) {
        const on = s[k] > 0.5;
        btn[k].style.background = on ? C.accent : 'rgba(240,244,245,.92)';
        btn[k].style.color = on ? '#f2f6f7' : C.dark;
        btn[k].style.borderColor = on ? C.accent : C.line;
      }
      btn.claw.textContent = s.claw > 0.5 ? 'CLOSE CLAWS' : 'OPEN CLAWS';
      // callouts and joint tags
      let ch = '', lh = '';
      for (const c of s.callouts) {
        if (c.o < 0.02) continue;
        const [ax, ay] = c.at;
        const lx = ax + c.dx, ly = ay + c.dy;
        lh += `<g opacity="${c.o.toFixed(2)}"><polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)} ${(lx + (c.dx < 0 ? -26 : 26)).toFixed(1)},${ly.toFixed(1)}" fill="none" stroke="${C.dark}" stroke-width=".8"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.2" fill="${C.accent}"/></g>`;
        ch += `<div class="call" style="left:${(lx + (c.dx < 0 ? -30 : 30)).toFixed(1)}px;top:${(ly - 8).toFixed(1)}px;opacity:${c.o.toFixed(2)};transform:translateX(${c.dx < 0 ? '-100%' : '0'});text-align:${c.dx < 0 ? 'right' : 'left'}"><b>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      let th = '';
      for (const g of s.tags) {
        if (g.o < 0.02) continue;
        th += `<div class="tag" style="left:${g.at[0].toFixed(1)}px;top:${g.at[1].toFixed(1)}px;opacity:${g.o.toFixed(2)}"><b style="${g.lit ? `background:${C.accent}` : ''};transform:scale(${(0.7 + 0.3 * Math.min(1, g.o * 1.5)).toFixed(2)})">${g.k}</b>${g.lit ? `<span>${g.label}</span>` : ''}</div>`;
      }
      tags.innerHTML = th;
      pointer(s.cursor);
    },
    pointer,
  };
}
