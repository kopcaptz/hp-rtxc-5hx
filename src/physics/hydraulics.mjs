/**
 * Stage 2 — Hydraulic Core (Section 9.1, 9.2, 9.3, 9.9)
 * - Darcy-Weisbach + Haaland friction factor + local losses (fittings, strainers, HX, equal-percentage CV)
 * - Joint solution of pump characteristic H(q_v, n) = r^2 H_0(q_v/r) and parallel network conductances
 * - Variable pump efficiency η_pump(q_v/r) * η_motor * η_drive with zero-flow shutoff guard (no division by zero)
 * - Nodal pressures with geodesic elevation z (roof z=0 vs lower factory consumers z_i) and NPSHa cavitation margin
 * - Boyle-Mariotte expansion tank gas cavity in absolute pressures, thermal expansion ΔV, leaks, makeup MU01,
 *   safety relief valves PSV00..PSV05 (with accumulation & backpressure), and HX internal leak cross-flow.
 */

import { GRAVITY_MS2, STD_ATM_PA, getWaterProperties } from './fluid_and_thermo.mjs';

/**
 * Computes Darcy-Weisbach friction factor f using laminar 64/Re and Haaland turbulent equation.
 */
export function computeFrictionFactor(reynolds, diameterM, roughnessM = 0.000045) {
  if (reynolds <= 1e-6) return 0.064;
  if (reynolds < 2300.0) {
    return 64.0 / Math.max(1.0, reynolds);
  }
  const relRough = Math.max(1e-7, roughnessM / Math.max(0.005, diameterM));
  const term = Math.pow(relRough / 3.7, 1.11) + 6.9 / reynolds;
  const invSqrtF = -1.8 * Math.log10(term);
  return 1.0 / (invSqrtF * invSqrtF);
}

/**
 * Computes hydraulic resistance coefficient K_seg [Pa / (m³/s)²] such that Δp = K_seg * q_v * |q_v|
 */
export function computeSegmentResistanceK({
  lengthM,
  diameterM,
  roughnessM = 0.000045,
  sumZeta = 2.0,
  rho = 990.0,
  mu = 0.0006,
  referenceFlowM3S = 0.005
}) {
  const area = (Math.PI * diameterM * diameterM) / 4.0;
  const vRef = Math.max(0.05, Math.abs(referenceFlowM3S) / area);
  const re = (rho * vRef * diameterM) / Math.max(1e-6, mu);
  const f = computeFrictionFactor(re, diameterM, roughnessM);
  const totalLossCoeff = f * (lengthM / diameterM) + sumZeta;
  return (totalLossCoeff * rho) / (2.0 * area * area);
}

/**
 * Equal-percentage control valve CV0i hydraulic resistance K_cv(u) [Pa / (m³/s)²]
 * @param {number} position0to1 - Actual stem position u in [0, 1]
 * @param {number} kvsM3hBar - Full-open Kv value in (m³/h)/sqrt(bar)
 * @param {number} rangeability - Equal-percentage rangeability R (default 50)
 * @param {number} rho - Fluid density kg/m³
 */
export function computeControlValveResistanceK(position0to1, kvsM3hBar = 40.0, rangeability = 50.0, rho = 990.0) {
  if (position0to1 <= 0.001) {
    return Infinity; // Tight shutoff
  }
  const u = Math.max(0.001, Math.min(1.0, position0to1));
  // Equal-percentage law blended smoothly near zero to reach tight shutoff
  const kvRel = Math.pow(rangeability, u - 1.0) * Math.min(1.0, u / 0.02);
  const kv = Math.max(1e-4, kvsM3hBar * kvRel);
  // In SI: q_v [m³/s] = (Kv / 3600) * sqrt( (Δp [Pa] / 1e5) * (1000 / rho) )
  // => Δp = (rho / 1000) * 1e5 * (3600 / Kv)^2 * q_v^2
  const factor = (3600.0 / kv);
  return (rho / 1000.0) * 1e5 * factor * factor;
}

/**
 * Evaluates a centrifugal pump or 1+1 pump group characteristic and electrical power (Section 9.2):
 *   H(q_v, n) = r^2 * H_0(q_v / r) = r^2 * H_shutoff - a_pump * (q_v / n_active)^2
 *   P_el = (ρ * g * q_v * H) / (η_pump * η_motor * η_drive) + P_shutoff_churn
 * Handles zero flow (shutoff head) cleanly without division by zero.
 */
export function evaluatePumpGroupOperatingPoint({
  activePumpCount = 1, // 0 = off, 1 = single duty, 2 = erroneous dual pump operation
  speedRatio = 1.0,    // r = n / n_0
  shutoffHeadM = 22.0,
  nominalHeadM = 16.0,
  nominalFlowM3S = 0.030,
  networkResistanceK = 50000000.0, // Pa / (m³/s)²; Infinity when valve/path is closed
  rho = 990.0
}) {
  const r = Math.max(0.0, Math.min(1.2, speedRatio));
  if (activePumpCount <= 0 || r <= 0.01) {
    return {
      running: false,
      activePumpCount: 0,
      speedRatio: 0,
      flowM3S: 0,
      headM: 0,
      deltaPPa: 0,
      etaPump: 0,
      etaMotor: 0.92,
      etaDrive: 0.97,
      shaftPowerW: 0,
      electricalPowerW: 0,
      isDeadHead: false
    };
  }

  // Pump quadratic curve coefficient a0 [m / (m³/s)²] for a single pump at r=1:
  // H0(q) = H_shutoff - a0 * q^2, where H0(q_nom) = H_nom => a0 = (H_shutoff - H_nom) / q_nom^2
  const a0 = Math.max(1.0, (shutoffHeadM - nominalHeadM) / (nominalFlowM3S * nominalFlowM3S));
  // With N identical parallel pumps active, each pump carries q_v / N:
  const aGroupHead = a0 / (activePumpCount * activePumpCount);
  const aGroupPa = rho * GRAVITY_MS2 * aGroupHead;
  const shutoffPa = rho * GRAVITY_MS2 * (r * r * shutoffHeadM);

  let flowM3S = 0.0;
  let deltaPPa = shutoffPa;
  let isDeadHead = false;

  if (!Number.isFinite(networkResistanceK) || networkResistanceK > 1e14) {
    // Closed valve / dead-head operation
    flowM3S = 0.0;
    deltaPPa = shutoffPa;
    isDeadHead = true;
  } else {
    // Intersection: shutoffPa - aGroupPa * q^2 = networkResistanceK * q^2
    flowM3S = Math.sqrt(shutoffPa / (aGroupPa + networkResistanceK));
    deltaPPa = shutoffPa - aGroupPa * flowM3S * flowM3S;
  }

  const headM = deltaPPa / (rho * GRAVITY_MS2);

  // Per-pump normalized flow ratio q_rel = (q_v / activePumpCount) / (r * q_nom)
  const qPerPump = flowM3S / activePumpCount;
  const qScaled = qPerPump / Math.max(1e-5, r * nominalFlowM3S);

  // Realistic variable pump efficiency curve η_pump(qScaled):
  // Peaks at η_BEP = 0.78 when qScaled = 1.0; smoothly approaches 0 at qScaled = 0
  const qClamped = Math.max(0.0, Math.min(1.85, qScaled));
  const etaBep = 0.78;
  const etaPump = Math.max(0.0, etaBep * (2.0 * qClamped - qClamped * qClamped));
  const etaMotor = 0.92;
  const etaDrive = 0.97;

  // Hydraulic power P_hyd = q_v * deltaP
  const hydraulicPowerW = flowM3S * deltaPPa;

  // Churn/shutoff mechanical power per active pump (affinity law: proportional to r^3)
  const nominalHydraulicPerPumpW = rho * GRAVITY_MS2 * nominalFlowM3S * nominalHeadM;
  const shutoffShaftPerPumpW = 0.28 * (nominalHydraulicPerPumpW / etaBep) * (r * r * r);

  // Total shaft power smoothly combining shutoff churn power and hydraulic work without division by zero
  let shaftPowerW;
  if (qClamped < 0.15) {
    // Blend near shutoff so q=0 has finite churn power and no 0/0 singularity
    const w = qClamped / 0.15;
    const pAt15 = (0.15 * r * nominalFlowM3S * activePumpCount * shutoffPa) / Math.max(0.18, etaBep * (2 * 0.15 - 0.15 * 0.15));
    shaftPowerW = (1.0 - w) * (activePumpCount * shutoffShaftPerPumpW) + w * pAt15;
  } else {
    shaftPowerW = hydraulicPowerW / Math.max(0.15, etaPump);
  }

  const electricalPowerW = shaftPowerW / (etaMotor * etaDrive);

  return {
    running: true,
    activePumpCount,
    speedRatio: r,
    flowM3S,
    headM,
    deltaPPa,
    etaPump,
    etaMotor,
    etaDrive,
    hydraulicPowerW,
    shaftPowerW,
    electricalPowerW,
    isDeadHead
  };
}

/**
 * Physical Spring-Loaded Safety Relief Valve (PSV) Orifice Discharge Model (F02 & F03):
 * - Opens when inlet gauge pressure exceeds setpointGaugePa; reseats with 5% blowdown hysteresis.
 * - Proportional spring lift reaches full lift (1.0) at 10% overpressure accumulation above setpoint.
 * - Orifice mass flow depends on lift, effective discharge area/coefficient, fluid density, and (p_inlet - p_backpressure).
 * - Does NOT artificially clamp loop pressure; pressure is governed strictly by mass balance dM/dt.
 */
export function evaluatePsvOrificeDischarge({
  inletGaugePa,
  setpointGaugePa = 140000.0,
  backpressureGaugePa = 0.0,
  nominalFullLiftFlowKgSAtSet = 1.85,
  capacityScale = 1.0,
  previouslyOpen = false,
  rho = 990.0
}) {
  const reseatGaugePa = 0.95 * setpointGaugePa;
  const fullLiftOverpressurePa = Math.max(5000.0, 0.10 * setpointGaugePa);
  const dpDrivingPa = Math.max(0.0, inletGaugePa - backpressureGaugePa);

  let psvOpen = false;
  let lift0to1 = 0.0;

  if (inletGaugePa > setpointGaugePa) {
    psvOpen = true;
    lift0to1 = Math.min(1.0, (inletGaugePa - setpointGaugePa) / fullLiftOverpressurePa);
  } else if (previouslyOpen && inletGaugePa > reseatGaugePa) {
    psvOpen = true;
    lift0to1 = 0.12 * ((inletGaugePa - reseatGaugePa) / Math.max(1.0, setpointGaugePa - reseatGaugePa));
  }

  let psvReliefFlowKgS = 0.0;
  if (psvOpen && dpDrivingPa > 0.0 && capacityScale > 0.0) {
    const refDpPa = Math.max(10000.0, 1.10 * setpointGaugePa);
    psvReliefFlowKgS =
      Math.max(0.0, capacityScale) *
      nominalFullLiftFlowKgSAtSet *
      lift0to1 *
      Math.sqrt((dpDrivingPa / refDpPa) * (rho / 990.0));
  }

  return {
    psvOpen,
    lift0to1,
    reseatGaugePa,
    dpDrivingPa,
    psvReliefFlowKgS
  };
}

/**
 * Evaluates whether a safe roof static pressure / PSV setpoint window exists for a secondary loop
 * given consumer elevation z_consumer, pump head, and unconfirmed jacket limit (F02).
 */
export function evaluateSecondaryPressureProtectionWindow({
  zConsumerM,
  psNominalDeltaPPa,
  hxSecDeltaPPa,
  psvSetpointGaugeRoofPa,
  jacketLimitGaugePa = 200000.0,
  rho = 990.0,
  pSatPa = 9600.0,
  barometricPressurePa = STD_ATM_PA
}) {
  // Minimum roof suction gauge pressure for positive air-free margin (>= 0.45 bar_g) and NPSHa >= 3.5 m
  const npshrPa = 3.5 * rho * GRAVITY_MS2;
  const minRoofForNpshGaugePa = npshrPa + pSatPa - barometricPressurePa;
  const minRequiredRoofStaticPa = Math.max(45000.0, minRoofForNpshGaugePa);

  if (typeof zConsumerM !== 'number' || Number.isNaN(zConsumerM) || typeof jacketLimitGaugePa !== 'number') {
    return {
      minRequiredRoofStaticPa,
      maxPermissibleRoofStaticRunningPa: null,
      maxPermissibleRoofStaticPumpTrippedPa: null,
      maxPermissibleRoofPsvSetpointPa: null,
      safeRoofWindowExistsRunning: null,
      safeRoofWindowExistsWithPumpTrip: null
    };
  }

  const hydroPa = rho * GRAVITY_MS2 * Math.max(0.0, -zConsumerM);
  const netExternalDynamicRisePa = Math.max(0.0, 0.75 * (psNominalDeltaPPa - hxSecDeltaPPa));

  // Maximum roof static pressure while pump is running so that bottom supply <= jacketLimitGaugePa:
  const maxPermissibleRoofStaticRunningPa = jacketLimitGaugePa - hydroPa - netExternalDynamicRisePa;
  // Maximum roof static pressure when pump is tripped on high pressure (dynamic head = 0):
  const maxPermissibleRoofStaticPumpTrippedPa = jacketLimitGaugePa - hydroPa;
  // Maximum roof PSV setpoint (allowing 10% accumulation at full lift with pump tripped):
  const maxPermissibleRoofPsvSetpointPa = (jacketLimitGaugePa - hydroPa) / 1.10;

  return {
    hydrostaticColumnPa: hydroPa,
    minRequiredRoofStaticPa,
    maxPermissibleRoofStaticRunningPa,
    maxPermissibleRoofStaticPumpTrippedPa,
    maxPermissibleRoofPsvSetpointPa,
    safeRoofWindowExistsRunning: maxPermissibleRoofStaticRunningPa >= minRequiredRoofStaticPa + 15000.0,
    safeRoofWindowExistsWithPumpTrip:
      maxPermissibleRoofPsvSetpointPa >= minRequiredRoofStaticPa + 25000.0 &&
      psvSetpointGaugeRoofPa <= maxPermissibleRoofPsvSetpointPa + 1000.0
  };
}

/**
 * Solves the Boyle-Mariotte Diaphragm Expansion Tank & Loop Static Pressure (Section 9.9, F02, F03 & R2-05):
 *   p_abs * V_gas = p_precharge_abs * V_tank
 *   When tank is isolated (etIsolated = true):
 *   - Captures/uses the exact state at the moment of valve closure (isolationSnapshot: { tempC, netMassChangeKg,
 *     staticGaugeRoofPa, vWaterTankM3 }), so closing the valve at unchanged T and Δm causes ZERO pressure jump (0 Pa).
 *   - Subsequent heating (ΔT > 0), cooling (ΔT < 0), makeup (Δm > 0), or leak (Δm < 0) while isolated acts on
 *     the stiff liquid/pipe bulk modulus relative to the captured isolation state.
 *   Never clamps static pressure artificially!
 */
export function solveLoopStaticPressure({
  totalLoopVolumeM3,
  coldFillTempC,
  currentMeanTempC,
  initialStaticGaugeRoofPa,
  etVolumeM3,
  etPrechargeGaugePa,
  etIsolated = false,
  isolationSnapshot = null,
  netMassChangeKg = 0.0, // Positive from makeup/cross-leak, negative from external leak/PSV
  psvSetpointGaugeRoofPa = 600000.0,
  psvBackpressureGaugePa = 0.0,
  psvCapacityScale = 1.0,
  psvPreviouslyOpen = false,
  barometricPressurePa = STD_ATM_PA,
  glycolPct = 0.0
}) {
  const coldProps = getWaterProperties(coldFillTempC, barometricPressurePa + initialStaticGaugeRoofPa, glycolPct);
  const hotProps = getWaterProperties(currentMeanTempC, barometricPressurePa + initialStaticGaugeRoofPa, glycolPct);

  // Initial fluid mass at cold fill:
  const initialMassKg = totalLoopVolumeM3 * coldProps.rho;
  // Volume expansion from temperature change (Section 9.9 formula):
  // ΔV_thermal = M * (1/rho_hot - 1/rho_cold)
  const deltaVThermalM3 = initialMassKg * (1.0 / hotProps.rho - 1.0 / coldProps.rho);
  const deltaVMassM3 = netMassChangeKg / hotProps.rho;
  const totalDeltaVM3 = deltaVThermalM3 + deltaVMassM3;

  const pPreAbs = barometricPressurePa + etPrechargeGaugePa;
  const pInitAbs = barometricPressurePa + initialStaticGaugeRoofPa;

  // Initial water volume in expansion tank at cold fill:
  // pInitAbs * (V_tank - V_w0) = pPreAbs * V_tank => V_w0 = V_tank * (1 - pPreAbs / pInitAbs)
  const vWaterInitM3 = pInitAbs > pPreAbs ? etVolumeM3 * (1.0 - pPreAbs / pInitAbs) : 0.0;
  const maxDiaphragmWaterM3 = etVolumeM3 * 0.92;
  const stiffModulusPa = 1.6e8; // ~1600 bar effective bulk/pipe wall stiffness
  const pipeStiffnessPaPerFrac = 4.5e7;

  function evaluateOpenExpansionTankAt(tempC, massChangeKg) {
    const props = getWaterProperties(tempC, barometricPressurePa + initialStaticGaugeRoofPa, glycolPct);
    const dVThermM3 = initialMassKg * (1.0 / props.rho - 1.0 / coldProps.rho);
    const dVMassM3 = massChangeKg / props.rho;
    const totDeltaVM3 = dVThermM3 + dVMassM3;
    const unclampedWaterM3 = vWaterInitM3 + totDeltaVM3;
    const vTankM3 = Math.max(0.0, Math.min(maxDiaphragmWaterM3, unclampedWaterM3));
    let gaugePa;
    let complianceKgPerPa;

    if (unclampedWaterM3 >= 0.0 && unclampedWaterM3 <= maxDiaphragmWaterM3) {
      const vGasM3 = Math.max(etVolumeM3 * 0.08, etVolumeM3 - vTankM3);
      const pAbs = (pPreAbs * etVolumeM3) / vGasM3;
      gaugePa = pAbs - barometricPressurePa;
      complianceKgPerPa = (props.rho * vGasM3 * vGasM3) / Math.max(1.0, pPreAbs * etVolumeM3);
    } else if (unclampedWaterM3 > maxDiaphragmWaterM3) {
      const vGasMinM3 = etVolumeM3 - maxDiaphragmWaterM3;
      const pAtMaxTankGaugePa = (pPreAbs * etVolumeM3) / vGasMinM3 - barometricPressurePa;
      const excessVolumeM3 = unclampedWaterM3 - maxDiaphragmWaterM3;
      gaugePa = pAtMaxTankGaugePa + (excessVolumeM3 / totalLoopVolumeM3) * stiffModulusPa;
      complianceKgPerPa = (props.rho * totalLoopVolumeM3) / stiffModulusPa;
    } else {
      const deficitM3 = unclampedWaterM3; // negative
      gaugePa = Math.max(-50000.0, etPrechargeGaugePa + (deficitM3 / totalLoopVolumeM3) * pipeStiffnessPaPerFrac);
      complianceKgPerPa = (props.rho * totalLoopVolumeM3) / pipeStiffnessPaPerFrac;
    }

    return {
      tempC,
      netMassChangeKg: massChangeKg,
      rho: props.rho,
      staticGaugeRoofPa: gaugePa,
      vWaterTankM3: vTankM3,
      effectiveComplianceKgPerPa: complianceKgPerPa
    };
  }

  let staticGaugeRoofPa;
  let vWaterTankM3 = vWaterInitM3;
  let effectiveComplianceKgPerPa;
  let activeIsolationSnapshot = null;

  if (!etIsolated) {
    const openState = evaluateOpenExpansionTankAt(currentMeanTempC, netMassChangeKg);
    staticGaugeRoofPa = openState.staticGaugeRoofPa;
    vWaterTankM3 = openState.vWaterTankM3;
    effectiveComplianceKgPerPa = openState.effectiveComplianceKgPerPa;
  } else {
    // R2-05 fix: Use actual state captured at the moment of expansion tank valve closure (isolationSnapshot).
    // If no prior isolationSnapshot is supplied, the valve is being closed at the current (currentMeanTempC, netMassChangeKg),
    // which yields 0 Pa instantaneous jump at valve closure.
    const isoTempC =
      isolationSnapshot && typeof isolationSnapshot.tempC === 'number'
        ? isolationSnapshot.tempC
        : currentMeanTempC;
    const isoMassChangeKg =
      isolationSnapshot && typeof isolationSnapshot.netMassChangeKg === 'number'
        ? isolationSnapshot.netMassChangeKg
        : netMassChangeKg;

    const baseIsoState = evaluateOpenExpansionTankAt(isoTempC, isoMassChangeKg);
    const pAtIsoGaugePa =
      isolationSnapshot && typeof isolationSnapshot.staticGaugeRoofPa === 'number'
        ? isolationSnapshot.staticGaugeRoofPa
        : baseIsoState.staticGaugeRoofPa;
    const vTrappedTankM3 =
      isolationSnapshot && typeof isolationSnapshot.vWaterTankM3 === 'number'
        ? isolationSnapshot.vWaterTankM3
        : baseIsoState.vWaterTankM3;
    const isoRho = baseIsoState.rho;

    // Post-isolation thermal expansion and mass change relative to the captured isolation state:
    const postIsoThermalDeltaVM3 = initialMassKg * (1.0 / hotProps.rho - 1.0 / isoRho);
    const postIsoMassDeltaVM3 = (netMassChangeKg - isoMassChangeKg) / hotProps.rho;
    const uncompensatedDeltaVM3 = postIsoThermalDeltaVM3 + postIsoMassDeltaVM3;

    vWaterTankM3 = vTrappedTankM3;
    staticGaugeRoofPa = Math.max(
      -50000.0,
      pAtIsoGaugePa + (uncompensatedDeltaVM3 / totalLoopVolumeM3) * stiffModulusPa
    );
    effectiveComplianceKgPerPa = (hotProps.rho * totalLoopVolumeM3) / stiffModulusPa;
    activeIsolationSnapshot = {
      tempC: isoTempC,
      netMassChangeKg: isoMassChangeKg,
      rho: isoRho,
      staticGaugeRoofPa: pAtIsoGaugePa,
      vWaterTankM3: vTrappedTankM3
    };
  }

  // Evaluate PSV orifice flow at current static roof pressure (NO artificial clamping of staticGaugeRoofPa!)
  const psvEval = evaluatePsvOrificeDischarge({
    inletGaugePa: staticGaugeRoofPa,
    setpointGaugePa: psvSetpointGaugeRoofPa,
    backpressureGaugePa: psvBackpressureGaugePa,
    nominalFullLiftFlowKgSAtSet: psvSetpointGaugeRoofPa > 300000.0 ? 3.2 : 1.85,
    capacityScale: psvCapacityScale,
    previouslyOpen: psvPreviouslyOpen,
    rho: hotProps.rho
  });

  return {
    staticGaugeRoofPa,
    staticAbsRoofPa: barometricPressurePa + staticGaugeRoofPa,
    initialMassKg,
    currentMassKg: initialMassKg + netMassChangeKg,
    deltaVThermalM3,
    deltaVMassM3,
    totalDeltaVM3,
    vWaterTankM3,
    tankFillFraction: vWaterTankM3 / Math.max(1e-6, etVolumeM3),
    effectiveComplianceKgPerPa,
    etIsolated: Boolean(etIsolated),
    isolationSnapshot: activeIsolationSnapshot,
    psvOpen: psvEval.psvOpen,
    psvLift0to1: psvEval.lift0to1,
    psvReliefFlowKgS: psvEval.psvReliefFlowKgS
  };
}

/**
 * Solves the entire hydraulic state of the plant:
 *   1. Primary Source Loop (HP01 <-> PP01A/B <-> BT01)
 *   2. Primary Distribution Loop (BT01 <-> PD01A/B <-> 5 Parallel Branches with CV01..CV05 & HX01..HX05)
 *   3. 5 Independent Secondary Consumer Loops (PS01A/B..PS05A/B <-> HX01..HX05 <-> צרכן 1..5 with elevation z_i)
 */
export function solvePlantHydraulics({
  dataset,
  state,
  faults = {}
}) {
  const baroPa = dataset.ambient.barometricPressurePa.value;
  const glycolPct = dataset.hp01.glycolConcentrationPct.value;

  // --- 1. Primary Loop Static Pressure (at BT01 / ET00) ---
  const priMeanTempC = 0.5 * (state.hp01.leavingWaterTempC + state.bt01.bottomTempC);
  const et00Isolated = Boolean(faults.et00Isolated);
  if (!et00Isolated) {
    state.primaryLoop.etIsolationSnapshot = null;
  }
  const priStatic = solveLoopStaticPressure({
    totalLoopVolumeM3: dataset.primaryLoop.totalWaterVolumeM3.value,
    coldFillTempC: dataset.primaryLoop.coldFillTempC.value,
    currentMeanTempC: priMeanTempC,
    initialStaticGaugeRoofPa: dataset.primaryLoop.initialStaticGaugePa.value,
    etVolumeM3: dataset.primaryLoop.et00VolumeM3.value,
    etPrechargeGaugePa: dataset.primaryLoop.et00PrechargeGaugePa.value,
    etIsolated: et00Isolated,
    isolationSnapshot: state.primaryLoop.etIsolationSnapshot || null,
    netMassChangeKg: state.primaryLoop.netMassChangeKg || 0.0,
    psvSetpointGaugeRoofPa: dataset.primaryLoop.psv00SetpointGaugePa.value,
    psvBackpressureGaugePa: faults.psv00BackpressurePa ?? 0.0,
    psvCapacityScale: faults.psv00CapacityScale ?? 1.0,
    psvPreviouslyOpen: Boolean(state.primaryLoop.psvOpen),
    barometricPressurePa: baroPa,
    glycolPct
  });
  if (et00Isolated && !state.primaryLoop.etIsolationSnapshot) {
    state.primaryLoop.etIsolationSnapshot = priStatic.isolationSnapshot;
  }

  const priProps = getWaterProperties(priMeanTempC, priStatic.staticAbsRoofPa, glycolPct);

  // --- 2. Primary Source Loop (BT01 -> PP01A/B -> HP01 -> BT01) ---
  // Documented HP01 pressure drop: 40 kPa at 27.2 L/s (0.0272 m³/s) -> K_hp01 = 40000 / 0.0272^2 = 5.4065e7 Pa/(m³/s)^2
  const kHp01 = 40000.0 / (0.0272 * 0.0272);
  const kPriPiping = computeSegmentResistanceK({
    lengthM: 18.0,
    diameterM: 0.150,
    sumZeta: 7.5,
    rho: priProps.rho,
    mu: priProps.mu,
    referenceFlowM3S: 0.028
  });
  const priStrainerFoulingFactor = faults.hp01StrainerFouled ? 6.5 : 1.0;
  const priPathIsolated = Boolean(faults.hp01ValveClosed);
  const kPriSourceTotal = priPathIsolated ? Infinity : (kHp01 + kPriPiping * priStrainerFoulingFactor);

  const ppActiveCount =
    (state.pumps.PP01A.running ? 1 : 0) +
    (state.pumps.PP01B.running ? 1 : 0);

  const ppResult = evaluatePumpGroupOperatingPoint({
    activePumpCount: ppActiveCount,
    speedRatio: state.pumps.PP01A.running ? state.pumps.PP01A.speedRatio : (state.pumps.PP01B.running ? state.pumps.PP01B.speedRatio : 0),
    shutoffHeadM: dataset.primaryLoop.pp01ShutoffHeadM.value,
    nominalHeadM: dataset.primaryLoop.pp01NominalHeadM.value,
    nominalFlowM3S: 0.029,
    networkResistanceK: kPriSourceTotal,
    rho: priProps.rho
  });

  const hp01DeltaPPa = kHp01 * ppResult.flowM3S * ppResult.flowM3S;
  const ppSuctionGaugePa = priStatic.staticGaugeRoofPa - 0.18 * (ppResult.deltaPPa - hp01DeltaPPa);
  const ppDischargeGaugePa = ppSuctionGaugePa + ppResult.deltaPPa;
  const hp01InletGaugePa = ppDischargeGaugePa - 0.45 * (ppResult.deltaPPa - hp01DeltaPPa);
  const hp01OutletGaugePa = hp01InletGaugePa - hp01DeltaPPa;

  // Cavitation margin NPSHa at PP01 suction:
  const areaDn150 = (Math.PI * 0.15 * 0.15) / 4.0;
  const vPriSuction = ppResult.flowM3S / areaDn150;
  const ppNpshaM =
    (baroPa + ppSuctionGaugePa - priProps.pSatPa) / (priProps.rho * GRAVITY_MS2) +
    (vPriSuction * vPriSuction) / (2.0 * GRAVITY_MS2);

  // --- 3. Primary Distribution Network & 5 Parallel Branches (Section 9.1) ---
  // Compute each branch hydraulic resistance K_br,i [Pa / (m³/s)²] and conductance G_i = 1 / sqrt(K_br,i)
  const branchHydraulics = [];
  let sumBranchConductance = 0.0;

  for (let i = 1; i <= 5; i++) {
    const bData = dataset.branches[i - 1];
    const bState = state.branches[i - 1];
    const cvPos = bState.cvActualPos; // 0..1
    const branchIsolated = Boolean(faults[`branch${i}Isolated`]);
    const foulMult = 1.0 + 3500.0 * (bData.hxFoulingResistanceM2KW.value || 0.0) + (faults[`hx0${i}Fouled`] ? 4.8 : 0.0);

    // Pipe resistance for branch i (symmetric nominal length 6.0 m in branch piping so identical conditions give identical flows,
    // or header resistance can be toggled; per Section 15 "одинаковые ветки дают одинаковые расходы при одинаковых условиях")
    const kPipeBranch = computeSegmentResistanceK({
      lengthM: 6.0,
      diameterM: 0.065,
      sumZeta: 5.1,
      rho: priProps.rho,
      mu: priProps.mu,
      referenceFlowM3S: 0.0055
    });

    // HX primary side hydraulic resistance: 32 kPa at 5.5 L/s (0.0055 m³/s) clean
    const kHxPriClean = 32000.0 / (0.0055 * 0.0055);
    const kHxPri = kHxPriClean * foulMult;

    // Control valve CV0i resistance
    const kCv = branchIsolated ? Infinity : computeControlValveResistanceK(cvPos, 42.0, 50.0, priProps.rho);

    const kBranchTotal = kPipeBranch + kHxPri + kCv;
    const conductanceG = Number.isFinite(kBranchTotal) ? 1.0 / Math.sqrt(kBranchTotal) : 0.0;

    sumBranchConductance += conductanceG;
    branchHydraulics.push({
      index: i,
      cvPos,
      kPipeBranch,
      kHxPri,
      kCv,
      kBranchTotal,
      conductanceG
    });
  }

  // Main supply & return collector trunk resistance before the 5 parallel branches
  const kCollectorTrunk = computeSegmentResistanceK({
    lengthM: 4.5,
    diameterM: 0.150,
    sumZeta: 2.2,
    rho: priProps.rho,
    mu: priProps.mu,
    referenceFlowM3S: 0.0275
  });

  const kParallelBranches = sumBranchConductance > 1e-12 ? 1.0 / (sumBranchConductance * sumBranchConductance) : Infinity;
  const kDistNetworkTotal = Number.isFinite(kParallelBranches) ? kCollectorTrunk + kParallelBranches : Infinity;

  const pdActiveCount =
    (state.pumps.PD01A.running ? 1 : 0) +
    (state.pumps.PD01B.running ? 1 : 0);
  const pdSpeedRatio = state.pumps.PD01A.running
    ? state.pumps.PD01A.speedRatio
    : (state.pumps.PD01B.running ? state.pumps.PD01B.speedRatio : 0);

  const pdResult = evaluatePumpGroupOperatingPoint({
    activePumpCount: pdActiveCount,
    speedRatio: pdSpeedRatio,
    shutoffHeadM: dataset.primaryLoop.pd01ShutoffHeadM.value,
    nominalHeadM: dataset.primaryLoop.pd01NominalHeadM.value,
    nominalFlowM3S: 0.029,
    networkResistanceK: kDistNetworkTotal,
    rho: priProps.rho
  });

  // Manifold differential pressure Δp_manifold across the 5 parallel branches:
  const trunkLossPa = kCollectorTrunk * pdResult.flowM3S * pdResult.flowM3S;
  const manifoldDeltaPPa = Math.max(0.0, pdResult.deltaPPa - trunkLossPa);

  const pdSuctionGaugePa = priStatic.staticGaugeRoofPa - 0.35 * trunkLossPa;
  const pdDischargeGaugePa = pdSuctionGaugePa + pdResult.deltaPPa;
  const priSupplyHeaderGaugePa = pdDischargeGaugePa - 0.35 * trunkLossPa;
  const priReturnHeaderGaugePa = priSupplyHeaderGaugePa - manifoldDeltaPPa;

  // Individual branch primary flows q_v,i and exact mass conservation verification:
  let sumBranchFlowM3S = 0.0;
  let sumBranchMassFlowKgS = 0.0;
  for (const bh of branchHydraulics) {
    if (sumBranchConductance > 1e-12 && pdResult.running && bh.conductanceG > 0) {
      // Exact parallel split ensuring sum(q_v,i) == q_v,distribution
      bh.flowM3S = pdResult.flowM3S * (bh.conductanceG / sumBranchConductance);
    } else {
      bh.flowM3S = 0.0;
    }
    bh.massFlowKgS = bh.flowM3S * priProps.rho;
    bh.hxPriDeltaPPa = bh.kHxPri * bh.flowM3S * bh.flowM3S;
    bh.cvDeltaPPa = Number.isFinite(bh.kCv) ? bh.kCv * bh.flowM3S * bh.flowM3S : manifoldDeltaPPa;
    sumBranchFlowM3S += bh.flowM3S;
    sumBranchMassFlowKgS += bh.massFlowKgS;
  }

  const distMassFlowKgS = pdResult.flowM3S * priProps.rho;
  const referenceMassFlowKgS = Math.max(1.0, 0.031 * priProps.rho);
  const normalizedMassBalanceResidual = Math.abs(distMassFlowKgS - sumBranchMassFlowKgS) / referenceMassFlowKgS;

  // --- 4. Five Independent Secondary Loops (PS01A/B..PS05A/B, HX01..05 sec, צרכן 1..5) ---
  const secondaryLoops = [];
  for (let i = 1; i <= 5; i++) {
    const idx = `0${i}`;
    const bData = dataset.branches[i - 1];
    const bState = state.branches[i - 1];
    const secMeanTempC = 0.5 * (bState.secSupplyTempC + bState.secReturnTempC);

    // F03 & R2-05 fix: Never replace initialStaticGaugeRoofPa with makeupPumpMaxGaugePa on valve fail-open,
    // and preserve actual expansion tank isolation snapshot at the moment of valve closure!
    const etSecIsolated = Boolean(faults[`et0${i}Isolated`]);
    if (!etSecIsolated) {
      bState.etIsolationSnapshot = null;
    }
    const secStatic = solveLoopStaticPressure({
      totalLoopVolumeM3: bData.secondaryWaterVolumeM3.value,
      coldFillTempC: 15.0,
      currentMeanTempC: secMeanTempC,
      initialStaticGaugeRoofPa: bData.secondaryInitialGaugeRoofPa.value,
      etVolumeM3: bData.etVolumeM3.value,
      etPrechargeGaugePa: bData.etPrechargeGaugePa.value,
      etIsolated: etSecIsolated,
      isolationSnapshot: bState.etIsolationSnapshot || null,
      netMassChangeKg: bState.secNetMassChangeKg || 0.0,
      psvSetpointGaugeRoofPa: bData.psvSetpointGaugeRoofPa.value,
      psvBackpressureGaugePa: faults[`psv0${i}BackpressurePa`] ?? 0.0,
      psvCapacityScale: faults[`psv0${i}CapacityScale`] ?? 1.0,
      psvPreviouslyOpen: Boolean(bState.psvOpen),
      barometricPressurePa: baroPa,
      glycolPct: 0.0
    });
    if (etSecIsolated && !bState.etIsolationSnapshot) {
      bState.etIsolationSnapshot = secStatic.isolationSnapshot;
    }

    const secProps = getWaterProperties(secMeanTempC, secStatic.staticAbsRoofPa, 0.0);

    // Secondary loop hydraulic resistance (roof piping + HX0i secondary side + consumer jacket network)
    const foulSecMult = 1.0 + 3000.0 * (bData.hxFoulingResistanceM2KW.value || 0.0) + (faults[`hx0${i}Fouled`] ? 3.5 : 0.0);
    const kHxSec = (28000.0 / (0.0055 * 0.0055)) * foulSecMult;
    const kSecPipingAndConsumer = computeSegmentResistanceK({
      lengthM: 26.0,
      diameterM: 0.065,
      sumZeta: 8.5,
      rho: secProps.rho,
      mu: secProps.mu,
      referenceFlowM3S: 0.0055
    }) + (42000.0 / (0.0055 * 0.0055));

    const secIsolated = Boolean(faults[`secLoop${i}Closed`]);
    const kSecTotal = secIsolated ? Infinity : (kHxSec + kSecPipingAndConsumer);

    const psPumpA = state.pumps[`PS${idx}A`];
    const psPumpB = state.pumps[`PS${idx}B`];
    const psActiveCount = (psPumpA.running ? 1 : 0) + (psPumpB.running ? 1 : 0);
    const psSpeedRatio = psPumpA.running ? psPumpA.speedRatio : (psPumpB.running ? psPumpB.speedRatio : 0);

    const psResult = evaluatePumpGroupOperatingPoint({
      activePumpCount: psActiveCount,
      speedRatio: psSpeedRatio,
      shutoffHeadM: bData.psShutoffHeadM.value,
      nominalHeadM: bData.psNominalHeadM.value,
      nominalFlowM3S: 0.0055,
      networkResistanceK: kSecTotal,
      rho: secProps.rho
    });

    const hxSecDeltaPPa = kHxSec * psResult.flowM3S * psResult.flowM3S;
    // Suction of PS0i is tied to ET0i reference point on the roof (z = 0 m)
    const psSuctionGaugeRoofPa = secStatic.staticGaugeRoofPa;
    const psDischargeGaugeRoofPa = psSuctionGaugeRoofPa + psResult.deltaPPa;
    const secSupplyGaugeRoofPa = psDischargeGaugeRoofPa - hxSecDeltaPPa;
    const secReturnGaugeRoofPa = psSuctionGaugeRoofPa;
    const maxRoofGaugePa = Math.max(
      psSuctionGaugeRoofPa,
      psDischargeGaugeRoofPa,
      secSupplyGaugeRoofPa,
      secReturnGaugeRoofPa
    );

    // Hydrostatic pressure at Consumer i (Section 9.3: p/(ρg) + z + v²/(2g) = const - h_loss)
    // If consumer elevation z_consumer is MISSING_DATA (null in SITE mode), bottom pressure is selectively blocked (null)!
    const zConsumerM = bData.consumerElevationFromRoofM.value;
    const verbalLimitPa = bData.jacketMaxAllowablePressureGaugePa.value;
    let consumerSupplyGaugeBottomPa = null;
    let consumerReturnGaugeBottomPa = null;
    let hydrostaticDeltaPPa = null;
    let maxLoopGaugePa = maxRoofGaugePa;
    let jacketPressureExceedsVerbal2Bar = null;

    if (typeof zConsumerM === 'number' && !Number.isNaN(zConsumerM)) {
      // Roof is z = 0 m; if consumer is below roof (e.g. z = -4.0 m), (z_roof - z_consumer) = +4.0 m -> adds +ρgΔz
      hydrostaticDeltaPPa = secProps.rho * GRAVITY_MS2 * (0.0 - zConsumerM);
      // When secIsolated (valve closed downstream of consumer jacket), full shutoff pressure reaches consumer supply
      const halfLineLossPa = secIsolated ? 0.0 : 0.25 * (psResult.deltaPPa - hxSecDeltaPPa);
      consumerSupplyGaugeBottomPa = secSupplyGaugeRoofPa + hydrostaticDeltaPPa - halfLineLossPa;
      consumerReturnGaugeBottomPa = secIsolated
        ? consumerSupplyGaugeBottomPa
        : secReturnGaugeRoofPa + hydrostaticDeltaPPa + halfLineLossPa;

      maxLoopGaugePa = Math.max(maxRoofGaugePa, consumerSupplyGaugeBottomPa, consumerReturnGaugeBottomPa);
      if (typeof verbalLimitPa === 'number' && !Number.isNaN(verbalLimitPa)) {
        jacketPressureExceedsVerbal2Bar = maxLoopGaugePa > verbalLimitPa;
      }
    }

    const protectionWindow = evaluateSecondaryPressureProtectionWindow({
      zConsumerM,
      psNominalDeltaPPa: secProps.rho * GRAVITY_MS2 * bData.psNominalHeadM.value,
      hxSecDeltaPPa: 28000.0,
      psvSetpointGaugeRoofPa: bData.psvSetpointGaugeRoofPa.value,
      jacketLimitGaugePa: verbalLimitPa,
      rho: secProps.rho,
      pSatPa: secProps.pSatPa,
      barometricPressurePa: baroPa
    });

    // Cavitation margin NPSHa at secondary pump suction on roof:
    const areaDn65 = (Math.PI * 0.065 * 0.065) / 4.0;
    const vSecSuction = psResult.flowM3S / areaDn65;
    const psNpshaM =
      (baroPa + psSuctionGaugeRoofPa - secProps.pSatPa) / (secProps.rho * GRAVITY_MS2) +
      (vSecSuction * vSecSuction) / (2.0 * GRAVITY_MS2);

    secondaryLoops.push({
      index: i,
      staticState: secStatic,
      fluidProps: secProps,
      pumpResult: psResult,
      flowM3S: psResult.flowM3S,
      massFlowKgS: psResult.flowM3S * secProps.rho,
      hxSecDeltaPPa,
      psSuctionGaugeRoofPa,
      psDischargeGaugeRoofPa,
      secSupplyGaugeRoofPa,
      secReturnGaugeRoofPa,
      maxRoofGaugePa,
      zConsumerM,
      hydrostaticDeltaPPa,
      consumerSupplyGaugeBottomPa,
      consumerReturnGaugeBottomPa,
      maxLoopGaugePa,
      jacketPressureExceedsVerbal2Bar,
      protectionWindow,
      psNpshaM
    });
  }

  return {
    primaryStatic: priStatic,
    primaryProps: priProps,
    ppResult,
    hp01DeltaPPa,
    ppSuctionGaugePa,
    ppDischargeGaugePa,
    hp01InletGaugePa,
    hp01OutletGaugePa,
    ppNpshaM,
    pdResult,
    manifoldDeltaPPa,
    pdSuctionGaugePa,
    pdDischargeGaugePa,
    priSupplyHeaderGaugePa,
    priReturnHeaderGaugePa,
    branchHydraulics,
    sumBranchFlowM3S,
    sumBranchMassFlowKgS,
    distMassFlowKgS,
    normalizedMassBalanceResidual,
    secondaryLoops
  };
}
