/**
 * PACKAGE D (HP01-PACKAGE-D-ANIMATION-01): visual process motion of the accepted HP01 cutaway.
 *
 * Single source: the frozen own-copy view model of buildHP01CutawayViewModel(sim, unitPrefs, { visualPaused }).
 * Nothing here reads or writes the simulation, the dataset or the VM; motion only changes transforms, instance
 * matrices and (on discrete state changes) pipe material tint/opacity.
 *
 * Visual contracts (illustration, NOT machine data):
 *  - Screw rotors: common phase φ, Δθ_male = +6φ, Δθ_female = −5φ about each rotor's local X axis; dφ/dt = ω/6 where
 *    ω = animation.compressorRotorsRadPerSec is a CONDITIONAL angular speed of the male rotor (8.5 / 5.0), not RPM.
 *  - Fan impellers: 12 rotorGrp about local Y, dψ/dt = animation.fansRadPerSec (conditional, direction illustrative).
 *  - Particles: arrows on the pipe curve of each connection, own arc-length LUT (4000 dense samples → 128 equal steps), u ∈ [0,1),
 *    du/dt = direction · speed · V_SCENE_M_PER_S / L. The adapter clamps speed, so it is not proportional to flow.
 *  - dtAnim comes from the caller (bounded wall dt, never multiplied by sim.timeMultiplier, 0 on any pause).
 */

import * as THREE from 'three';
import { HP01_INTERNAL_CONNECTIONS } from './hp01_cutaway_meta.mjs';

export const HP01_ROTOR_LAW = Object.freeze({ male: +6, female: -5, phaseRatePerOmega: 1 / 6 });
export const V_SCENE_M_PER_S = 0.6;
export const PARTICLE_SPACING_M = 0.22;
export const PARTICLES_PER_CONNECTION_MIN = 2;
export const PARTICLES_PER_CONNECTION_MAX = 9;
export const MAX_PARTICLES = 384;
export const ARC_LUT_POINTS = 128;
export const PARTICLE_CONE_RADIUS_M = 0.018;
export const ARC_DENSE_SAMPLES = 4000;
export const PARTICLE_CONE_LENGTH_M = 0.06;
export const UNKNOWN_MARKER_RADIUS_M = 0.035;
export const MAX_DT_ANIM_S = 0.25;
const TWO_PI = Math.PI * 2;

export const HP01_ANIMATION_TEXT_HE = Object.freeze({
  freezeOn: 'הקפאת תנועה',
  freezeOff: 'המשך תנועה',
  freezeAria: 'הקפאת התנועה בחתך בלבד — חישוב המודל ממשיך',
  demoNote: 'התנועה בחתך היא המחשה יחסית לפי מצב המודל בלבד: אינה סל״ד, ספיקה או מהירות זרימה פיזיקליים.',
  globalPaused: 'הסימולציה מושהית — הזמן והתנועה עצורים',
  visualFreeze: 'הקפאת תנועה — המודל ממשיך לחשב',
  // D-R1-03: both pauses — the global pause governs the calculation; the freeze is only reported as also on
  bothPaused: 'הסימולציה מושהית (השהיה כללית) — החישוב והתנועה עצורים; גם הקפאת התנועה מופעלת',
  disabled: 'הנפשה כבויה',
  rotors: { RUNNING: 'רוטורים: מסתובבים', RUNNING_QUALITATIVE: 'רוטורים: מסתובבים (הפשרה, איכותי)', STOPPED: 'רוטורים: עצורים', UNKNOWN: 'רוטורים: לא ידוע', UNKNOWN_INVALID_CYCLE: 'רוטורים: לא ידוע (מחזור לא תקף)', HELD: 'רוטורים: מוקפאים' },
  fans: { RUNNING: 'מאווררים: מסתובבים', STOPPED: 'מאווררים: עצורים', UNCONFIRMED: 'מאווררים: מצב לא מאומת', UNKNOWN: 'מאווררים: לא ידוע', HELD: 'מאווררים: מוקפאים' },
  water: { MOVING: 'מים: זורמים', NO_FLOW: 'מים: אין זרימה', UNKNOWN: 'מים: זרימה לא ידועה', HELD: 'מים: מוקפא' },
  refrigerant: { MOVING: 'קרר: זורם', QUALITATIVE: 'קרר: כיוון איכותי (הפשרה)', STOPPED: 'קרר: עצור', UNKNOWN: 'קרר: לא ידוע', PARTIAL_UNKNOWN: 'קרר: חלקית לא ידוע', HELD: 'קרר: מוקפא' }
});

const isFin = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * D-R1-02: time base of the HP01 animation. One instance per scene; it never accumulates wall time itself.
 *  - frame(): the first frame after reset (re-entry into the cutaway, any visibility change) or after a gap > 0.5 s
 *    returns dtAnim = 0, so time spent hidden is never integrated; every hidden frame also returns 0.
 *  - onVisibilityChange(): called by the scene's single visibilitychange listener (hidden → visible and the reverse);
 *    it covers a return with no frame at all while hidden (RAF is suspended) and short hides < 0.5 s.
 */
export class HP01AnimationClock {
  constructor() { this.lastMs = null; this.resets = 0; }
  reset() { this.lastMs = null; this.resets += 1; }
  onVisibilityChange() { this.reset(); }
  frame({ nowMs, dtReal, hidden, globalPaused, visualFreeze }) {
    if (hidden) { this.lastMs = null; return 0; }
    const resumed = this.lastMs === null || nowMs - this.lastMs > 500;
    this.lastMs = nowMs;
    return computeHP01AnimationDt({ dtReal, globalPaused, visualFreeze, hidden: false, resumed });
  }
}

/**
 * Animation dt policy: bounded wall dt, never × sim.timeMultiplier; 0 on global pause, Visual Freeze (independent flags),
 * hidden document and the first frame after re-entry or a frame gap (no catch-up).
 */
export function computeHP01AnimationDt({ dtReal, globalPaused, visualFreeze, hidden, resumed }) {
  if (globalPaused || visualFreeze || hidden || resumed) return 0;
  return isFin(dtReal) ? Math.min(MAX_DT_ANIM_S, Math.max(0, dtReal)) : 0;
}

/** Rotor angles for the common phase φ (radians) */
export function computeRotorAngles(phi) {
  return { male: HP01_ROTOR_LAW.male * phi, female: HP01_ROTOR_LAW.female * phi };
}

/** Discrete visual state of one connection from its directive and static metadata */
export function resolveConnectionVisual(directive, meta) {
  if (!meta || meta.animationType === 'STATIC_GEOMETRY_NO_PARTICLES') return { visual: 'STATIC', reason: 'STATIC_NO_PARTICLES' };
  if (!directive || typeof directive !== 'object') return { visual: 'UNKNOWN', reason: 'NO_DIRECTIVE' };
  if (directive.isStateUnknown === true) return { visual: 'UNKNOWN', reason: directive.branchState || 'UNKNOWN' };
  if (directive.active !== true) return { visual: 'CLOSED', reason: directive.branchState || 'INACTIVE' };
  if (!(directive.direction === 1 || directive.direction === -1)) return { visual: 'BLOCKED', reason: 'NON_FINITE_OR_ZERO_DIRECTION' };
  if (!isFin(directive.speed) || directive.speed < 0) return { visual: 'BLOCKED', reason: 'NON_FINITE_SPEED' };
  if (directive.speed === 0) return { visual: 'ACTIVE_HELD', reason: 'ACTIVE_ZERO_VISUAL_SPEED' };
  return { visual: 'MOVING', reason: directive.branchState || 'ACTIVE' };
}

/**
 * Visual state used for drawing: the connection rule plus one VM-level rule — air paths of fans whose state is not
 * confirmed (adapter maps a non-finite fan speed to 0 / STOPPED_NO_FLOW) are UNKNOWN, never a confirmed closed path.
 */
export function resolveSlotVisual(directive, meta, fanState) {
  const r = resolveConnectionVisual(directive, meta);
  if (meta && meta.mediumDomain.startsWith('AIR_') && (fanState === 'UNCONFIRMED' || fanState === 'UNKNOWN') && r.visual !== 'STATIC') return { visual: 'UNKNOWN', reason: `FANS_${fanState}` };
  return r;
}

// Hebrew route state of the card, keyed by the adapter's branchState (unchanged texts of Package C)
export const HP01_BRANCH_STATE_HE = Object.freeze({
  OPEN_ACTIVE: 'פתוח — זרימה פעילה',
  ACTIVE: 'פעיל',
  STOPPED_COMPRESSOR_OFF: 'ללא זרימת קרר — מדחס לא פועל',
  STOPPED_NO_FLOW: 'ללא זרימה',
  CLOSED_IN_HEATING: 'סגור בחימום',
  CLOSED_IN_DEFROST: 'סגור בהפשרה',
  OPEN_QUALITATIVE_DEFROST: 'פתוח בהפשרה (איכותי)',
  STATIC_NO_PARTICLES: 'סטטי — גאומטריה בלבד',
  UNKNOWN_SYSTEM_MODE: 'לא ידוע — מצב מערכת לא ידוע',
  UNKNOWN_ECON_STATE: 'לא ידוע — מצב אקונומייזר לא ידוע',
  UNKNOWN_WATER_FLOW: 'לא ידוע — ספיקת מים לא ידועה'
});
const FAN_UNKNOWN_ROUTE_HE = {
  UNCONFIRMED: 'לא ידוע — מצב המאווררים לא מאומת (אין קביעה שאין זרימה)',
  UNKNOWN: 'לא ידוע — מצב המאווררים לא ידוע'
};

/**
 * D-R1-01: ONE presentation of a connection for the animation, the status strip and the card. The adapter cannot
 * tell a commanded zero fan speed from a missing one in HEATING (both arrive as 0 / STOPPED_NO_FLOW); the air paths
 * of such fans are therefore UNKNOWN everywhere — never "no flow" in the card while the picture says "unknown".
 */
export function resolveConnectionPresentation(vm, connId) {
  const meta = HP01_INTERNAL_CONNECTIONS[connId];
  const d = vm?.animation?.connectionDirectives?.[connId];
  const fanState = resolveFanState(vm).state;
  const r = resolveSlotVisual(d, meta, fanState);
  const fanOverride = r.reason === 'FANS_UNCONFIRMED' || r.reason === 'FANS_UNKNOWN';
  const textHe = fanOverride ? FAN_UNKNOWN_ROUTE_HE[fanState] : (HP01_BRANCH_STATE_HE[d?.branchState] || d?.branchState || '—');
  return { connId, visual: r.visual, reason: r.reason, stateKey: fanOverride ? `UNKNOWN_FANS_${fanState}` : (d?.branchState ?? null), unknown: r.visual === 'UNKNOWN' || r.visual === 'BLOCKED', textHe };
}

const UNKNOWN_MODES = new Set(['UNKNOWN_OR_MISSING', 'SITE_MISSING']);

export function resolveRotorState(vm) {
  const omega = vm?.animation?.compressorRotorsRadPerSec;
  if (!vm || UNKNOWN_MODES.has(vm.modeKey) || !isFin(omega)) return { state: 'UNKNOWN', omega: 0 };
  if (vm.visualPaused && (vm.modeKey === 'HEATING' || vm.modeKey === 'DEFROST')) return { state: 'HELD', omega: 0 };
  if (vm.modeKey === 'STOPPED') return { state: omega === 0 ? 'STOPPED' : 'UNKNOWN', omega: 0 };
  if (omega > 0) return { state: vm.modeKey === 'DEFROST' ? 'RUNNING_QUALITATIVE' : 'RUNNING', omega };
  return { state: vm.modeKey === 'HEATING' ? 'UNKNOWN_INVALID_CYCLE' : 'UNKNOWN', omega: 0 };
}

export function resolveFanState(vm) {
  const omega = vm?.animation?.fansRadPerSec;
  if (!vm || UNKNOWN_MODES.has(vm.modeKey) || !isFin(omega) || omega < 0) return { state: 'UNKNOWN', omega: 0 };
  if (vm.visualPaused && vm.modeKey === 'HEATING') return { state: 'HELD', omega: 0 };
  if (omega > 0) return { state: 'RUNNING', omega };
  // The adapter maps a non-finite fan speed to 0 in HEATING; 0 there is therefore not a confirmed stop
  return { state: vm.modeKey === 'HEATING' ? 'UNCONFIRMED' : 'STOPPED', omega: 0 };
}

function summarizeDomain(vm, pred) {
  const dirs = vm?.animation?.connectionDirectives || {};
  const fanState = resolveFanState(vm).state;
  const visuals = [];
  for (const [id, meta] of Object.entries(HP01_INTERNAL_CONNECTIONS)) {
    if (!pred(meta)) continue;
    visuals.push(resolveSlotVisual(dirs[id], meta, fanState).visual);
  }
  return visuals.filter((v) => v !== 'STATIC');
}

/** One compact status for the toolbar strip and the card (same function → same truth) */
export function describeHP01AnimationStatus(vm, { globalPaused = false, visualFreeze = false, enabled = true } = {}) {
  const T = HP01_ANIMATION_TEXT_HE;
  const held = globalPaused || visualFreeze;
  // Either pause holds the picture still: HELD replaces only confirmed motion; UNKNOWN / UNCONFIRMED / STOPPED stay visible
  const rotor = resolveRotorState(vm);
  const fan = resolveFanState(vm);
  if (held && (rotor.state === 'RUNNING' || rotor.state === 'RUNNING_QUALITATIVE')) rotor.state = 'HELD';
  if (held && fan.state === 'RUNNING') fan.state = 'HELD';
  const water = summarizeDomain(vm, (m) => m.mediumDomain === 'PRIMARY_WATER');
  const refr = summarizeDomain(vm, (m) => m.mediumDomain.startsWith('REFRIGERANT_'));
  const waterKey = water.includes('UNKNOWN') || water.includes('BLOCKED') ? 'UNKNOWN'
    : water.includes('MOVING') ? (held ? 'HELD' : 'MOVING') : water.includes('ACTIVE_HELD') ? 'HELD' : 'NO_FLOW';
  const anyRefMoving = refr.includes('MOVING');
  const refKey = refr.length && refr.every((v) => v === 'UNKNOWN' || v === 'BLOCKED') ? 'UNKNOWN'
    : (refr.includes('UNKNOWN') || refr.includes('BLOCKED')) ? 'PARTIAL_UNKNOWN'
    : anyRefMoving ? (held ? 'HELD' : vm?.modeKey === 'DEFROST' ? 'QUALITATIVE' : 'MOVING')
    : refr.includes('ACTIVE_HELD') ? 'HELD' : 'STOPPED';
  const pause = !enabled ? 'DISABLED' : globalPaused && visualFreeze ? 'BOTH' : globalPaused ? 'GLOBAL' : visualFreeze ? 'VISUAL' : 'NONE';
  const parts = [T.rotors[rotor.state], T.fans[fan.state], T.water[waterKey], T.refrigerant[refKey]];
  const pauseText = pause === 'DISABLED' ? T.disabled : pause === 'BOTH' ? T.bothPaused : pause === 'GLOBAL' ? T.globalPaused : pause === 'VISUAL' ? T.visualFreeze : '';
  return {
    modeKey: vm?.modeKey ?? 'UNKNOWN_OR_MISSING',
    pause,
    rotors: rotor.state,
    fans: fan.state,
    water: waterKey,
    refrigerant: refKey,
    textHe: (pauseText ? pauseText + ' | ' : '') + parts.join(' · ')
  };
}

/** Machine table "connection ID → endpoints → domain → directive → visual object" for one VM */
export function buildConnectionAnimationTable(vm, animator = null) {
  const dirs = vm?.animation?.connectionDirectives || {};
  return Object.entries(HP01_INTERNAL_CONNECTIONS).map(([id, meta]) => {
    const d = dirs[id] || null;
    const r = resolveSlotVisual(d, meta, resolveFanState(vm).state);
    const slot = animator?.slotsById?.get(id) || null;
    return {
      id,
      mediumDomain: meta.mediumDomain,
      circuit: meta.circuit,
      from: { ownerId: meta.fromEndpoint.ownerId, portName: meta.fromEndpoint.portName, mediumDomain: meta.fromEndpoint.mediumDomain },
      to: { ownerId: meta.toEndpoint.ownerId, portName: meta.toEndpoint.portName, mediumDomain: meta.toEndpoint.mediumDomain },
      animationType: meta.animationType,
      provenance: meta.provenance,
      directive: d ? { active: d.active, direction: d.direction, visualSpeed: d.speed, stateKey: d.branchState, isStateUnknown: d.isStateUnknown, speedSource: d.speedSource } : null,
      visual: r.visual,
      visualReason: r.reason,
      visualObject: slot ? { instancedMesh: slot.pool.name, particleCount: slot.count, curveLengthM: +slot.length.toFixed(4), pathSource: slot.pathSource, pathDeviationFromPipeM: +slot.pathDeviationM.toFixed(6) } : { instancedMesh: null, particleCount: 0 }
    };
  });
}

const POOL_DEFS = [
  { key: 'water', name: 'HP01_D_PARTICLES_WATER', color: 0x7dd3fc, match: (m) => m.mediumDomain === 'PRIMARY_WATER' },
  { key: 'ckt1', name: 'HP01_D_PARTICLES_CKT1', color: 0xfca5a5, match: (m) => m.mediumDomain === 'REFRIGERANT_CKT1' },
  { key: 'ckt2', name: 'HP01_D_PARTICLES_CKT2', color: 0xfdba74, match: (m) => m.mediumDomain === 'REFRIGERANT_CKT2' },
  { key: 'air', name: 'HP01_D_PARTICLES_AIR', color: 0xe2e8f0, match: (m) => m.mediumDomain.startsWith('AIR_') }
];
const UNKNOWN_TINT = new THREE.Color(0x94a3b8);

export class HP01ProcessAnimator {
  constructor(assembly) {
    this.assembly = assembly;
    this.disposed = false;
    this.enabled = true;
    this.ownedGeometries = new Set();
    this.ownedMaterials = new Set();
    this.diagnostics = { missingRefs: [], nonFiniteRejections: 0, framesApplied: 0, resets: 0, lastResetReason: null, domainMismatches: [], pathOutsidePipe: [] };
    this.phi = 0;
    this.fanPhase = 0;
    this.animTimeS = 0;
    this.transformLog = [];
    this.transformLogMax = 600;
    this.lastVisualById = new Map();
    this._collectRefs();
    this._buildParticles();
  }

  _collectRefs() {
    const a = this.assembly;
    this.rotors = [];
    for (const compId of ['COMP1', 'COMP2']) {
      const ci = a.compressorInternals.get(compId);
      if (!ci || !ci.maleRotor || !ci.femaleRotor) { this.diagnostics.missingRefs.push(`${compId}.rotors`); continue; }
      this.rotors.push({ compId, male: ci.maleRotor, female: ci.femaleRotor, male0: ci.maleRotor.rotation.x, female0: ci.femaleRotor.rotation.x });
    }
    this.fans = [];
    for (const unit of a.fanUnits) {
      const r = unit.userData?.rotorGrp;
      if (!r) { this.diagnostics.missingRefs.push(`${unit.name}.rotorGrp`); continue; }
      this.fans.push({ fanId: unit.userData.fanId, rotor: r, y0: r.rotation.y });
    }
    if (this.fans.length !== 12) this.diagnostics.missingRefs.push(`fanUnits=${this.fans.length}`);
  }

  _buildParticles() {
    const a = this.assembly;
    const cone = new THREE.ConeGeometry(PARTICLE_CONE_RADIUS_M, PARTICLE_CONE_LENGTH_M, 8);
    cone.rotateX(Math.PI / 2); // tip along +Z, oriented to the curve tangent with lookAt-style quaternions
    this.ownedGeometries.add(cone);
    const marker = new THREE.OctahedronGeometry(UNKNOWN_MARKER_RADIUS_M, 0);
    this.ownedGeometries.add(marker);
    this.slots = [];
    this.slotsById = new Map();
    const perPool = new Map(POOL_DEFS.map((p) => [p.key, []]));
    for (const [id, meta] of Object.entries(HP01_INTERNAL_CONNECTIONS)) {
      if (meta.animationType === 'STATIC_GEOMETRY_NO_PARTICLES') continue;
      const grp = a.connectionGroups.get(id);
      const pipeCurve = grp?.userData?.curve;
      if (!grp || !pipeCurve) { this.diagnostics.missingRefs.push(`${id}.curve`); continue; }
      // A duplicated consecutive waypoint makes the centripetal pipe curve overshoot and fold back on itself; particles on
      // it would briefly run against the flow. Such paths use the same waypoints without the duplicate (same curve type);
      // the deviation from the pipe centre line is measured and must stay inside the pipe radius.
      const wp = meta.waypoints.filter((w, i, arr) => i === 0 || Math.hypot(w[0] - arr[i - 1][0], w[1] - arr[i - 1][1], w[2] - arr[i - 1][2]) > 1e-6);
      let curve = pipeCurve;
      let pathSource = 'PIPE_CURVE';
      let pathDeviationM = 0;
      if (wp.length !== meta.waypoints.length) {
        curve = new THREE.CatmullRomCurve3(wp.map((w) => new THREE.Vector3(w[0], w[1], w[2])), false, 'centripetal', 0.15);
        pathSource = 'DEDUPED_WAYPOINTS';
        const pipePts = Array.from({ length: 801 }, (_, j) => pipeCurve.getPoint(j / 800));
        for (let j = 0; j <= 400; j++) {
          const q = curve.getPoint(j / 400);
          pathDeviationM = Math.max(pathDeviationM, Math.min(...pipePts.map((pp) => pp.distanceTo(q))));
        }
        if (pathDeviationM > (meta.pipeRadiusM || 0.03)) this.diagnostics.pathOutsidePipe.push({ id, pathDeviationM });
      }
      const def = POOL_DEFS.find((p) => p.match(meta));
      if (!def) continue;
      if (meta.fromEndpoint.mediumDomain !== meta.mediumDomain || meta.toEndpoint.mediumDomain !== meta.mediumDomain) {
        this.diagnostics.domainMismatches.push(id);
      }
      // Own arc-length LUT: dense sampling of the curve parameter, cumulative length, inverted to equal arc steps
      const dense = [];
      const cum = [0];
      for (let j = 0; j <= ARC_DENSE_SAMPLES; j++) dense.push(curve.getPoint(j / ARC_DENSE_SAMPLES));
      for (let j = 1; j <= ARC_DENSE_SAMPLES; j++) cum.push(cum[j - 1] + dense[j].distanceTo(dense[j - 1]));
      const length = cum[ARC_DENSE_SAMPLES];
      const count = Math.min(PARTICLES_PER_CONNECTION_MAX, Math.max(PARTICLES_PER_CONNECTION_MIN, Math.ceil(length / PARTICLE_SPACING_M)));
      const lut = new Float32Array(ARC_LUT_POINTS * 3);
      const tan = new Float32Array(ARC_LUT_POINTS * 3);
      const t = new THREE.Vector3();
      let j = 1;
      for (let k = 0; k < ARC_LUT_POINTS; k++) {
        const target = (k / (ARC_LUT_POINTS - 1)) * length;
        while (j < ARC_DENSE_SAMPLES && cum[j] < target) j += 1;
        const seg = cum[j] - cum[j - 1];
        const w = seg > 0 ? Math.min(1, Math.max(0, (target - cum[j - 1]) / seg)) : 0;
        const p = dense[j - 1].clone().lerp(dense[j], w);
        t.copy(dense[j]).sub(dense[j - 1]).normalize();
        lut.set([p.x, p.y, p.z], k * 3);
        tan.set([t.x, t.y, t.z], k * 3);
      }
      const offsets = new Float32Array(count);
      for (let i = 0; i < count; i++) offsets[i] = i / count;
      // Arrow just wider than its own pipe (otherwise hidden inside the tube); axial length bounded so arrows stay separate
      const pipeR = Number(meta.pipeRadiusM) > 0 ? meta.pipeRadiusM : 0.03;
      const radial = (pipeR * 1.35) / PARTICLE_CONE_RADIUS_M;
      // Arrow length ≤ L/(2n) and ≤ 0.13 m; arrow centres are inset by half a length from both pipe ends
      const arrowLen = Math.min(0.13, length / (2 * count), Math.max(PARTICLE_CONE_LENGTH_M, radial * 0.8 * PARTICLE_CONE_LENGTH_M));
      const scale = new THREE.Vector3(radial, radial, arrowLen / PARTICLE_CONE_LENGTH_M);
      const inset = arrowLen / 2 / length;
      const markerScale = Math.max(1, (pipeR * 1.6) / UNKNOWN_MARKER_RADIUS_M);
      // Per path point: the largest half-length (≤ arrowLen/2) whose straight arrow ends stay within 0.8·pipe radius of
      // the path — arrows shorten on tight bends instead of cutting through the pipe wall
      const halfMax = new Float32Array(ARC_LUT_POINTS);
      const segDist = (x, y, z) => {
        let best = Infinity;
        for (let k = 0; k + 3 < lut.length; k += 3) {
          const ax = lut[k], ay = lut[k + 1], az = lut[k + 2], vx = lut[k + 3] - ax, vy = lut[k + 4] - ay, vz = lut[k + 5] - az;
          const vv = vx * vx + vy * vy + vz * vz || 1;
          const tt = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy + (z - az) * vz) / vv));
          best = Math.min(best, Math.hypot(ax + tt * vx - x, ay + tt * vy - y, az + tt * vz - z));
        }
        return best;
      };
      for (let k = 0; k < ARC_LUT_POINTS; k++) {
        const tx = tan[k * 3], ty = tan[k * 3 + 1], tz = tan[k * 3 + 2];
        // the drawn centre lies within ±0.5 LUT step of point k and uses the tangent of k: test those centres
        const centres = [];
        for (const f of [-0.5, -0.25, 0, 0.25, 0.5]) {
          const kk = Math.min(ARC_LUT_POINTS - 1, Math.max(0, k + Math.sign(f)));
          const w = Math.abs(f);
          centres.push([lut[k * 3] + (lut[kk * 3] - lut[k * 3]) * w, lut[k * 3 + 1] + (lut[kk * 3 + 1] - lut[k * 3 + 1]) * w, lut[k * 3 + 2] + (lut[kk * 3 + 2] - lut[k * 3 + 2]) * w]);
        }
        const fits = (h) => centres.every(([px, py, pz]) => segDist(px + tx * h, py + ty * h, pz + tz * h) <= pipeR * 0.8 && segDist(px - tx * h, py - ty * h, pz - tz * h) <= pipeR * 0.8);
        let lo = 0, hi = arrowLen / 2;
        if (fits(hi)) lo = hi; else for (let it = 0; it < 10; it++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
        halfMax[k] = lo;
      }
      const slot = { id, meta, group: grp, curve, pathSource, pathDeviationM, length, count, lut, tan, offsets, u: 0, poolKey: def.key, visual: 'CLOSED', direction: 1, scale, arrowLen, inset, markerScale, halfMax, drawn: 0 };
      perPool.get(def.key).push(slot);
      this.slots.push(slot);
      this.slotsById.set(id, slot);
    }
    this.totalParticles = this.slots.reduce((s, x) => s + x.count, 0);
    if (this.totalParticles > MAX_PARTICLES) throw new Error(`PARTICLE_BUDGET_EXCEEDED ${this.totalParticles} > ${MAX_PARTICLES}`);
    this.pools = new Map();
    for (const def of POOL_DEFS) {
      const slots = perPool.get(def.key);
      const capacity = slots.reduce((s, x) => s + x.count, 0);
      const mat = new THREE.MeshBasicMaterial({ color: def.color });
      this.ownedMaterials.add(mat);
      const mesh = new THREE.InstancedMesh(cone, mat, Math.max(1, capacity));
      mesh.name = def.name;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.userData.hp01DParticles = true; // never added to pickableMeshes
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      a.rootGroup.add(mesh);
      for (const s of slots) s.pool = mesh;
      this.pools.set(def.key, { mesh, slots, capacity, drawOrder: [] });
    }
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, wireframe: true });
    this.ownedMaterials.add(markerMat);
    this.unknownMarkers = new THREE.InstancedMesh(marker, markerMat, Math.max(1, this.slots.length));
    this.unknownMarkers.name = 'HP01_D_UNKNOWN_BRANCH_MARKERS';
    this.unknownMarkers.count = 0;
    this.unknownMarkers.frustumCulled = false;
    this.markerOrder = [];
    this._ms = new THREE.Vector3();
    this._mq = new THREE.Quaternion();
    a.rootGroup.add(this.unknownMarkers);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._fwd = new THREE.Vector3(0, 0, 1);
    this._sv = new THREE.Vector3();
  }

  /** Reset phases (new simulation object: reset / import / scenario); navigation never calls this */
  resetPhases(reason = 'reset') {
    this.phi = 0;
    this.fanPhase = 0;
    for (const s of this.slots) s.u = 0;
    this.diagnostics.resets += 1;
    this.diagnostics.lastResetReason = reason;
    this._writeRotors();
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (!this.enabled) {
      for (const { mesh } of this.pools.values()) mesh.count = 0;
      this.unknownMarkers.count = 0;
    }
  }

  _writeRotors() {
    const ang = computeRotorAngles(this.phi);
    for (const r of this.rotors) {
      r.male.rotation.x = r.male0 + ang.male;
      r.female.rotation.x = r.female0 + ang.female;
    }
    for (const f of this.fans) f.rotor.rotation.y = f.y0 + this.fanPhase;
  }

  _applyPipeMaterial(slot, visual, modeKey) {
    const key = `${visual}|${modeKey === 'DEFROST' ? 'D' : 'N'}`;
    if (this.lastVisualById.get(slot.id) === key) return;
    this.lastVisualById.set(slot.id, key);
    const ud = slot.group.userData;
    const mat = ud.pipeMat;
    if (!mat) return;
    const base = new THREE.Color(modeKey === 'DEFROST' && visual !== 'UNKNOWN' ? ud.defrostColorHex : ud.baseColorHex);
    if (visual === 'UNKNOWN' || visual === 'BLOCKED') mat.color.copy(base).lerp(UNKNOWN_TINT, 0.7);
    else mat.color.copy(base);
    const dim = visual === 'CLOSED' || visual === 'UNKNOWN' || visual === 'BLOCKED';
    mat.transparent = dim;
    mat.opacity = dim ? 0.5 : 1.0;
    mat.depthWrite = !dim;
    mat.needsUpdate = true;
  }

  /**
   * One frame: vm is the current frozen snapshot, dtAnim ≥ 0 seconds (0 on global pause / freeze / hidden / re-entry)
   */
  applyFrame(vm, dtAnim) {
    if (this.disposed || !this.enabled) return null;
    let dt = isFin(dtAnim) ? Math.min(MAX_DT_ANIM_S, Math.max(0, dtAnim)) : 0;
    if (!isFin(dtAnim)) this.diagnostics.nonFiniteRejections += 1;
    const rotor = resolveRotorState(vm);
    const fan = resolveFanState(vm);
    // Rotors and fans: integrate only finite positive conditional speeds; never let NaN reach a transform
    if (dt > 0 && rotor.omega > 0) this.phi = (this.phi + rotor.omega * HP01_ROTOR_LAW.phaseRatePerOmega * dt) % TWO_PI;
    if (dt > 0 && fan.omega > 0) this.fanPhase = (this.fanPhase + fan.omega * dt) % TWO_PI;
    if (!isFin(this.phi) || !isFin(this.fanPhase)) { this.diagnostics.nonFiniteRejections += 1; this.phi = 0; this.fanPhase = 0; }
    this._writeRotors();

    const dirs = vm?.animation?.connectionDirectives || {};
    const counts = { MOVING: 0, ACTIVE_HELD: 0, CLOSED: 0, UNKNOWN: 0, BLOCKED: 0 };
    for (const pool of this.pools.values()) { pool.mesh.count = 0; pool.drawOrder.length = 0; }
    this.markerOrder.length = 0;
    let markers = 0;
    for (const slot of this.slots) {
      const d = dirs[slot.id];
      const { visual } = resolveSlotVisual(d, slot.meta, fan.state);
      if (visual === 'BLOCKED' && slot.visual !== 'BLOCKED') this.diagnostics.nonFiniteRejections += 1;
      slot.visual = visual;
      slot.drawn = 0;
      counts[visual] = (counts[visual] || 0) + 1;
      this._applyPipeMaterial(slot, visual, vm?.modeKey);
      const groupVisible = slot.group.visible !== false;
      if ((visual === 'UNKNOWN' || visual === 'BLOCKED') && groupVisible) {
        const k = Math.floor((ARC_LUT_POINTS - 1) / 2) * 3;
        this._v.set(slot.lut[k], slot.lut[k + 1], slot.lut[k + 2]);
        this._ms.setScalar(slot.markerScale);
        this._m.compose(this._v, this._mq, this._ms);
        this.unknownMarkers.setMatrixAt(markers++, this._m);
        this.markerOrder.push(slot.id);
      }
      if (visual !== 'MOVING' && visual !== 'ACTIVE_HELD') continue;
      slot.direction = d.direction;
      if (visual === 'MOVING' && dt > 0) {
        slot.u = (slot.u + (d.direction * d.speed * V_SCENE_M_PER_S * dt) / slot.length) % 1;
        if (slot.u < 0) slot.u += 1;
      }
      if (!groupVisible) continue;
      const poolRec = this.pools.get(slot.poolKey);
      const pool = poolRec.mesh;
      for (let i = 0; i < slot.count; i++) {
        const uu = (slot.u + slot.offsets[i]) % 1;
        const f = (slot.inset + uu * (1 - 2 * slot.inset)) * (ARC_LUT_POINTS - 1);
        const k0 = Math.floor(f);
        const k1 = Math.min(ARC_LUT_POINTS - 1, k0 + 1);
        const w = f - k0;
        const a0 = k0 * 3;
        const a1 = k1 * 3;
        this._v.set(slot.lut[a0] + (slot.lut[a1] - slot.lut[a0]) * w, slot.lut[a0 + 1] + (slot.lut[a1 + 1] - slot.lut[a0 + 1]) * w, slot.lut[a0 + 2] + (slot.lut[a1 + 2] - slot.lut[a0 + 2]) * w);
        const kk = w < 0.5 ? k0 : k1;
        this._t.set(slot.tan[kk * 3], slot.tan[kk * 3 + 1], slot.tan[kk * 3 + 2]).multiplyScalar(d.direction).normalize();
        this._q.setFromUnitVectors(this._fwd, this._t);
        const hk = Math.min(slot.halfMax[k0], slot.halfMax[k1]);
        this._sv.set(slot.scale.x, slot.scale.y, Math.max(1e-3, (2 * hk) / PARTICLE_CONE_LENGTH_M));
        this._m.compose(this._v, this._q, this._sv);
        pool.setMatrixAt(pool.count++, this._m);
        poolRec.drawOrder.push(slot.id);
      }
      slot.drawn = slot.count;
    }
    for (const { mesh } of this.pools.values()) mesh.instanceMatrix.needsUpdate = true;
    this.unknownMarkers.count = markers;
    this.unknownMarkers.instanceMatrix.needsUpdate = true;

    this.animTimeS += dt;
    this.diagnostics.framesApplied += 1;
    const ang = computeRotorAngles(this.phi);
    const entry = { frame: this.diagnostics.framesApplied, animTimeS: this.animTimeS, resets: this.diagnostics.resets, dt, phi: this.phi, male: ang.male, female: ang.female, fanPhase: this.fanPhase, rotor: rotor.state, fan: fan.state, counts };
    this.transformLog.push(entry);
    if (this.transformLog.length > this.transformLogMax) this.transformLog.shift();
    return entry;
  }

  getTelemetry() {
    return {
      enabled: this.enabled,
      phi: this.phi,
      fanPhase: this.fanPhase,
      animTimeS: this.animTimeS,
      rotorAngles: this.rotors.map((r) => ({ compId: r.compId, male: r.male.rotation.x, female: r.female.rotation.x })),
      fanAngles: this.fans.map((f) => f.rotor.rotation.y),
      particlesDrawn: [...this.pools.values()].reduce((s, p) => s + p.mesh.count, 0),
      unknownMarkersDrawn: this.unknownMarkers.count,
      totalParticleCapacity: this.totalParticles,
      slotVisuals: Object.fromEntries(this.slots.map((s) => [s.id, { visual: s.visual, u: s.u, count: s.count, drawn: s.drawn || 0, direction: s.direction, length: s.length, groupVisible: s.group.visible !== false, arrowLen: s.arrowLen, inset: s.inset }])),
      markerIds: [...this.markerOrder],
      vSceneMPerS: V_SCENE_M_PER_S,
      ownedGeometryCount: this.ownedGeometries.size,
      ownedMaterialCount: this.ownedMaterials.size,
      diagnostics: { ...this.diagnostics, missingRefs: [...this.diagnostics.missingRefs], domainMismatches: [...this.diagnostics.domainMismatches], pathOutsidePipe: [...this.diagnostics.pathOutsidePipe] },
      lastLog: this.transformLog[this.transformLog.length - 1] || null
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const { mesh } of this.pools.values()) { mesh.removeFromParent(); mesh.dispose(); }
    this.unknownMarkers.removeFromParent();
    this.unknownMarkers.dispose();
    for (const g of this.ownedGeometries) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    this.ownedGeometries.clear();
    this.ownedMaterials.clear();
  }
}
