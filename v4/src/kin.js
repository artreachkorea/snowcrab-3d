// SNOW CRAB CO-130, the math. No three.js here: one input, the gait phase phi (cycles), poses every leg, and every
// readout on the console comes from these same functions.
//
// Reference: 9 photos supplied by the user (top views of cooked and live males, the underside held in a hand, the
// carapace close-up, a live crab on the sea floor). What they fix, and what this file encodes:
//   carapace   rounded triangle, wider behind than in front, about as long as wide; two short rostral horns; paired
//              branchial swellings left and right, an H of grooves between gastric and cardiac regions; dense small
//              tubercles, no white blotches; glossy orange-red above, cream under the margin
//   legs       4 pairs, long, flattened (broad face up), rows of spinules along both edges, dark red hooked dactyl;
//              orange above, cream below; 6 segments: coxa, basis-ischium, merus, carpus, propodus, dactylus
//   chelipeds  slender, tuberculate merus, long palm, long fingers with serrated edges and pale tips
//   underside  cream sternum in plates, narrow triangular abdomen (male), square third maxillipeds over the mouth
//   eyes       black, glossy, in orbits either side of the rostrum
// Units: 1 = 100 mm. Proportions are scaled from the top-view photos to a 130 mm carapace (an adult male); they are
// the model's numbers, not a measured specimen's.

export const MM = 100;
export const CW = 1.3; // carapace width
export const CL = 1.2; // carapace length
export const HIP_Y = 0.4; // leg sockets above the sea floor
export const BODY_Y = 0.5; // carapace centre
export const DUTY = 0.62; // fraction of a cycle each foot is on the floor
export const STRIDE = 0.5; // foot sweep in the body frame per stance
export const LIFT = 0.17; // foot clearance in swing
export const COXA = 0.1;
export const BASIS = 0.13;
export const TILT = -0.26; // coxa-basis slope, rad
export const BEND = [0.2, 0.42]; // fixed carpus-propodus and propodus-dactylus bends, rad (down)
export const FRAC = {merus: 0.4, carpus: 0.14, propodus: 0.27, dactylus: 0.19};
export const SEG_NAMES = ['COXA', 'BASIS-ISCHIUM', 'MERUS', 'CARPUS', 'PROPODUS', 'DACTYLUS'];

// the four walking legs, front to back: socket x, rest yaw (deg, + forward), total length merus..dactylus, width
export const LEGS = [
  {x: 0.3, yaw: 40, L: 1.6 * CW, w: 0.27},
  {x: 0.1, yaw: 12, L: 1.8 * CW, w: 0.29},
  {x: -0.13, yaw: -16, L: 1.7 * CW, w: 0.28},
  {x: -0.36, yaw: -46, L: 1.36 * CW, w: 0.25},
];
export const CHELA = {merus: 0.58 * CW, carpus: 0.24 * CW, palm: 0.56 * CW, finger: 0.4 * CW, w: 0.18};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const frac = (x) => x - Math.floor(x);
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

/** Carapace half width at x (forward). A rounded triangle: widest a little behind the middle, narrow at the front. */
export function halfWidth(x) {
  const u = clamp(x / (CL / 2), -1, 1);
  const base = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(u), 2.4)));
  return (CW / 2) * base * (1 - 0.38 * smoother((u + 0.05) / 1.05)) * (1 + 0.06 * Math.exp(-((u + 0.2) ** 2) / 0.08));
}

// legs are named L1..L4, R1..R4; side +1 is the crab's right (+z), the way it walks
export const LEG_IDS = [];
for (const side of [-1, 1]) for (let i = 0; i < 4; i++) LEG_IDS.push({side, i, name: `${side > 0 ? 'R' : 'L'}${i + 1}`});
export const HERO = {side: 1, i: 1}; // R2

/** Alternating tetrapod: L1 R2 L3 R4 together, R1 L2 R3 L4 half a cycle later. */
export const groupOf = (side, i) => ((i + (side > 0 ? 1 : 0)) % 2 === 0 ? 'A' : 'B');
export const legPhase = (phi, side, i) => frac(phi + (groupOf(side, i) === 'A' ? 0 : 0.5));

export function legLengths(i) {
  const {L} = LEGS[i];
  return {coxa: COXA, basis: BASIS, merus: L * FRAC.merus, carpus: L * FRAC.carpus, propodus: L * FRAC.propodus, dactylus: L * FRAC.dactylus};
}

export function hip(side, i) {
  const {x} = LEGS[i];
  return [x, HIP_Y, side * halfWidth(x) * 0.9];
}

// the foot's resting point lies along the rest yaw, measured from the socket, at 86 % of full reach
export const restFoot = (side, i) => {
  const H = hip(side, i);
  const yaw = (LEGS[i].yaw * Math.PI) / 180;
  const len = legLengths(i);
  const r = COXA + BASIS * Math.cos(TILT) + 0.86 * (len.merus + len.carpus + len.propodus + len.dactylus * 0.8);
  // yaw 0 points straight out to the side; + swings the leg toward the head
  return [H[0] + r * Math.sin(yaw), 0, H[2] + side * r * Math.cos(yaw)];
};

/** Foot target in the body frame (origin on the floor under the carapace centre) and its stance state. */
export function footAt(phi, side, i, amp = 1) {
  const p = legPhase(phi, side, i);
  const F = restFoot(side, i);
  let dz;
  let y = 0;
  let down;
  if (p < DUTY) {
    // stance: the foot holds the floor while the body slides over it toward +z
    dz = STRIDE * (0.5 - p / DUTY);
    down = true;
  } else {
    const s = (p - DUTY) / (1 - DUTY);
    dz = STRIDE * (-0.5 + smoother(s));
    y = LIFT * Math.sin(Math.PI * s) ** 1.2;
    down = false;
  }
  return {F: [F[0], y * amp, F[2] + dz * amp], down, p, lift: y * amp};
}

/** Body travel along +z per gait cycle. */
export const TRAVEL = STRIDE / DUTY;
export const bodyBob = (phi, amp = 1) => amp * 0.012 * Math.cos(4 * Math.PI * phi);

/**
 * Joint angles for leg (side, i) reaching foot F (body frame), body raised by bob. Planar IK in the leg's vertical
 * plane: merus elevation a1 and the merus-carpus knee solve it, the two distal bends are fixed.
 */
export function legIK(side, i, F, bob = 0) {
  const len = legLengths(i);
  const H = hip(side, i);
  H[1] += bob;
  const dx = F[0] - H[0];
  const dz = F[2] - H[2];
  // rotation.y = yaw maps local +x to (cos yaw, 0, -sin yaw)
  const yaw = Math.atan2(-dz, dx);
  const rh = Math.hypot(dx, dz);
  const K0u = COXA + BASIS * Math.cos(TILT);
  const K0v = BASIS * Math.sin(TILT);
  const u = rh - K0u;
  const v = F[1] - H[1] - K0v;
  // the distal chain carpus -> propodus -> dactylus as one rigid arm
  const [b1, b2] = BEND;
  const tx = len.carpus + len.propodus * Math.cos(-b1) + len.dactylus * Math.cos(-b1 - b2);
  const ty = len.propodus * Math.sin(-b1) + len.dactylus * Math.sin(-b1 - b2);
  const L1 = len.merus;
  const L2 = Math.hypot(tx, ty);
  const beta = Math.atan2(ty, tx);
  const d = clamp(Math.hypot(u, v), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
  const a1 = Math.atan2(v, u) + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const k1u = L1 * Math.cos(a1);
  const k1v = L1 * Math.sin(a1);
  const ac = Math.atan2(v - k1v, u - k1u) - beta;
  return {yaw, merus: a1 - TILT, knee: ac - a1, b1: -b1, b2: -b2, a1, ac, u, v, K1: [k1u, k1v], len, reach: d};
}

/** The whole walk at phase phi: every foot and every joint. amp 0 parks the legs at rest. */
export function poseAt(phi, amp = 1) {
  const bob = bodyBob(phi, amp);
  return LEG_IDS.map(({side, i, name}) => {
    const f = footAt(phi, side, i, amp);
    return {name, side, i, ...f, ik: legIK(side, i, f.F, bob)};
  });
}

/** The hero leg's planar profile (u along the leg, v up) for the console: socket, knee, carpus, propodus, tip. */
export function profile(ik) {
  const {len, a1, ac} = ik;
  const [b1, b2] = BEND;
  const P0 = [0, 0];
  const P1 = [COXA, 0];
  const P2 = [COXA + BASIS * Math.cos(TILT), BASIS * Math.sin(TILT)];
  const P3 = [P2[0] + len.merus * Math.cos(a1), P2[1] + len.merus * Math.sin(a1)];
  const P4 = [P3[0] + len.carpus * Math.cos(ac), P3[1] + len.carpus * Math.sin(ac)];
  const P5 = [P4[0] + len.propodus * Math.cos(ac - b1), P4[1] + len.propodus * Math.sin(ac - b1)];
  const P6 = [P5[0] + len.dactylus * Math.cos(ac - b1 - b2), P5[1] + len.dactylus * Math.sin(ac - b1 - b2)];
  return [P0, P1, P2, P3, P4, P5, P6];
}

// the hero foot's closed path in its leg plane over one cycle, for the profile panel
export const HERO_PATH = (() => {
  const out = [];
  for (let k = 0; k <= 96; k++) {
    const phi = k / 96;
    const f = footAt(phi, HERO.side, HERO.i);
    const ik = legIK(HERO.side, HERO.i, f.F, bodyBob(phi));
    out.push([ik.u + COXA + BASIS * Math.cos(TILT), ik.v + BASIS * Math.sin(TILT)]);
  }
  return out;
})();
