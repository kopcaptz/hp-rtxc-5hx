/**
 * Stage 3 — Thermal Core (Section 9.4, 9.5, 9.6, 9.7, 9.10)
 * - Counterflow water-to-water heat exchanger analytical effectiveness-NTU solver (with exact Cr=1 limit,
 *   boundary guards for UA=0, zero flow, zero ΔT, fouling resistance Rf, and physical bounds check)
 * - Transient HX thermal mass (water + metal) matching analytical ε-NTU in steady state and handling
 *   residual water-metal heat exchange at zero flow
 * - Four-pipe buffer tank BT01 4-zone mixing & internal energy balance dU/dt
 * - External consumer loads (4 explicit types: prescribed power, heated thermal mass with jacket UA,
 *   flow process, combined)
 * - Trane RTXC 180 XE-HSE operating map & performance surface (with explicit Page 48 vs Page 50 summer check,
 *   defrost heat extraction Q_water < 0, and unit energy balance)
 * - Strict separation of Unit COP, Plant System COP, Consumer Delivered Heat, Buffer ΔE, and Period COP_period.
 */

import { getWaterProperties, solveR513ACycle } from './fluid_and_thermo.mjs';

/**
 * Analytical Steady-State Counterflow Effectiveness-NTU Solver (Section 9.5 & Section 15):
 *   C_h = m_dot_h * cp_h, C_c = m_dot_c * cp_c
 *   C_min = min(C_h, C_c), C_max = max(C_h, C_c), C_r = C_min / C_max, NTU = UA_eff / C_min
 *   If Cr != 1: ε = (1 - exp(-NTU*(1 - Cr))) / (1 - Cr*exp(-NTU*(1 - Cr)))
 *   If Cr == 1: ε = NTU / (1 + NTU)
 *   Q_dot = ε * C_min * (T_h,in - T_c,in)
 */
export function solveCounterflowEffectivenessNTU({
  mDotHotKgS,
  cpHotJKgK,
  tHotInC,
  mDotColdKgS,
  cpColdJKgK,
  tColdInC,
  nominalUAWK,
  areaM2 = 10.0,
  foulingResistanceM2KW = 0.0
}) {
  // Effective UA accounting for fouling resistance Rf [m²·K/W]: 1/UA_eff = 1/UA_0 + Rf / A
  let uaEff = 0.0;
  if (nominalUAWK > 0.0) {
    const rClean = 1.0 / nominalUAWK;
    const rFoul = Math.max(0.0, foulingResistanceM2KW) / Math.max(0.1, areaM2);
    uaEff = 1.0 / (rClean + rFoul);
  }

  const Ch = Math.max(0.0, mDotHotKgS) * Math.max(1.0, cpHotJKgK);
  const Cc = Math.max(0.0, mDotColdKgS) * Math.max(1.0, cpColdJKgK);
  const Cmin = Math.min(Ch, Cc);
  const Cmax = Math.max(Ch, Cc);
  const deltaTIn = tHotInC - tColdInC;

  // Boundary cases: UA = 0 or zero flow on either side.
  // Note: Do NOT zero out NTU or effectiveness when deltaTIn === 0; NTU and effectiveness are
  // hydrodynamic/geometric properties of (UA_eff, C_h, C_c) independent of inlet temperatures,
  // ensuring C^infty continuity of both steady and transient HX models across T_h,in === T_c,in.
  if (uaEff <= 1e-9 || Cmin <= 1e-6) {
    return {
      uaEff,
      Ch,
      Cc,
      Cmin,
      Cmax,
      Cr: Cmax > 1e-9 ? Cmin / Cmax : 0.0,
      NTU: 0.0,
      effectiveness: 0.0,
      qDotW: 0.0,
      tHotInC,
      tColdInC,
      tHotOutC: tHotInC,
      tColdOutC: tColdInC,
      lmtdK: 0.0
    };
  }

  const Cr = Cmin / Cmax;
  const NTU = uaEff / Cmin;

  // Smooth C^infty evaluation across Cr -> 1:
  //   (1 - exp(-x)) / (1 - Cr*exp(-x)) === (NTU * phi(x)) / (1 + Cr * NTU * phi(x))
  // where x = NTU * (1 - Cr) and phi(x) = (1 - exp(-x)) / x.
  const x = NTU * (1.0 - Cr);
  const phi =
    Math.abs(x) < 1e-4
      ? 1.0 - x * (0.5 - x * (1.0 / 6.0 - x / 24.0))
      : -Math.expm1(-x) / x;
  let effectiveness = (NTU * phi) / (1.0 + Cr * NTU * phi);

  // Clamp effectiveness strictly inside [0, 1] for floating-point safety at extreme NTU
  effectiveness = Math.max(0.0, Math.min(1.0, effectiveness));

  const rawQDotW = effectiveness * Cmin * deltaTIn;
  const qDotW = rawQDotW === 0.0 ? 0.0 : rawQDotW;
  const tHotOutC = deltaTIn === 0.0 ? tHotInC : tHotInC - qDotW / Ch;
  const tColdOutC = deltaTIn === 0.0 ? tColdInC : tColdInC + qDotW / Cc;

  // Log-mean temperature difference for reference diagnostics
  const dt1 = tHotInC - tColdOutC;
  const dt2 = tHotOutC - tColdInC;
  let lmtdK = 0.0;
  if (dt1 * dt2 > 0.0) {
    const meanDt = 0.5 * (dt1 + dt2);
    const relDiff = Math.abs(dt1 - dt2) / Math.max(1e-300, Math.abs(meanDt));
    lmtdK = relDiff < 1e-6 ? meanDt : (dt1 - dt2) / Math.log(dt1 / dt2);
  }

  return {
    uaEff,
    Ch,
    Cc,
    Cmin,
    Cmax,
    Cr,
    NTU,
    effectiveness,
    qDotW,
    tHotInC,
    tColdInC,
    tHotOutC,
    tColdOutC,
    lmtdK
  };
}

export const THERMAL_REF_CONSTANTS = Object.freeze({
  cpWaterJKgK: 4182.0,
  rhoPrimaryKgM3: 990.0,
  rhoSecondaryKgM3: 992.0,
  cpMetalJKgK: 500.0
});

/**
 * Advances one heat exchanger HX0i over time step dt [s] with a strictly conservative, unconditionally
 * monotone (M-matrix / convex-combination) 3-node implicit-Euler energy balance (F01 / R2-03):
 *   C_wh * (T_h,out^{n+1} - T_h,out^n)/dt = Q_pri,given - Q_h->m
 *   C_m  * (T_m^{n+1}     - T_m^n)/dt     = Q_h->m - Q_m->c - Q_loss,amb
 *   C_wc * (T_c,out^{n+1} - T_c,out^n)/dt = Q_m->c - Q_sec,received
 *
 * Physical series coupling (hot channel <-> metal plate pack <-> cold channel):
 *   Q_h->m = G_hm,tilde * (T_h,eff - T_m^{n+1})
 *   Q_m->c = G_mc,tilde * (T_m^{n+1} - T_c,eff)
 *   Q_loss,amb = UA_amb * (T_m^{n+1} - T_amb)
 *
 * Guarantees on every time step (for any dt > 0, UA >= 0, and any combination of flows):
 * 1. Exact energy conservation: U_HX(t + dt) - U_HX(t) === (Q_pri,given - Q_sec,received - Q_loss,amb) * dt
 * 2. Second-Law monotonicity without artificial clamping:
 *    min(T_in, T_0, T_amb) <= T_h,out, T_c,out, T_m <= max(T_in, T_0, T_amb)
 * 3. Exact steady-state convergence (as dT/dt -> 0, UA_amb -> 0) to the analytical counterflow ε-NTU solution.
 */
export function stepTransientHeatExchanger({
  hxState,
  mDotHotKgS,
  cpHotJKgK = THERMAL_REF_CONSTANTS.cpWaterJKgK,
  tHotInC,
  mDotColdKgS,
  cpColdJKgK = THERMAL_REF_CONSTANTS.cpWaterJKgK,
  tColdInC,
  nominalUAWK,
  areaM2 = 10.0,
  foulingResistanceM2KW = 0.0,
  metalMassKg = 140.0,
  waterVolumePerSideM3 = 0.028,
  ambientTempC = 12.0,
  uaLossAmbientWK = 3.5,
  dtSeconds = 0.5
}) {
  const steady = solveCounterflowEffectivenessNTU({
    mDotHotKgS,
    cpHotJKgK,
    tHotInC,
    mDotColdKgS,
    cpColdJKgK,
    tColdInC,
    nominalUAWK,
    areaM2,
    foulingResistanceM2KW
  });

  const cpMetal = THERMAL_REF_CONSTANTS.cpMetalJKgK;
  const cMetalJK = Math.max(1000.0, metalMassKg * cpMetal);
  const cWaterHotJK = Math.max(500.0, waterVolumePerSideM3 * THERMAL_REF_CONSTANTS.rhoPrimaryKgM3 * THERMAL_REF_CONSTANTS.cpWaterJKgK);
  const cWaterColdJK = Math.max(500.0, waterVolumePerSideM3 * THERMAL_REF_CONSTANTS.rhoSecondaryKgM3 * THERMAL_REF_CONSTANTS.cpWaterJKgK);

  const prevHotOutC = hxState.tHotOutC;
  const prevColdOutC = hxState.tColdOutC;
  const prevMetalC = hxState.tMetalC;

  const dt = Math.max(1e-6, dtSeconds);
  const hasHotFlow = mDotHotKgS > 1e-6;
  const hasColdFlow = mDotColdKgS > 1e-6;
  const Ch = hasHotFlow ? steady.Ch : 0.0;
  const Cc = hasColdFlow ? steady.Cc : 0.0;

  const Kwh = cWaterHotJK / dt;
  const Kwc = cWaterColdJK / dt;
  const Kh = Kwh + Ch;
  const Kc = Kwc + Cc;
  const Km = cMetalJK / dt;
  const uaAmb = Math.max(0.0, uaLossAmbientWK);

  // Advected channel temperatures prior to wall heat transfer (convex combination of T_prev and T_in):
  const tHotAdvC = (Kwh * prevHotOutC + Ch * tHotInC) / Kh;
  const tColdAdvC = (Kwc * prevColdOutC + Cc * tColdInC) / Kc;

  let tMetalC;
  let tHotOutC;
  let tColdOutC;
  let qHotToMetalW;
  let qMetalToColdW;

  if (steady.uaEff > 1e-9 && hasHotFlow && hasColdFlow && steady.effectiveness > 1e-9) {
    // Unconditionally monotone (M-matrix / convex-combination) counterflow + metal-pack decomposition:
    //   Gm = 2 * min(eps, 1 - eps) * Cmin >= 0
    //   Gcf = eps * Cmin - 0.5 * Gm >= 0
    //   Gcf + 0.5 * Gm === eps * Cmin (exact counterflow steady-state heat transfer)
    //   Gcf + Gm <= Cmin <= min(Ch, Cc) (non-negative weights on T_h,in, T_c,in, T_m, T_prev for all states)
    const eps = steady.effectiveness;
    const cMin = steady.Cmin;
    const Gm = 2.0 * Math.min(eps, 1.0 - eps) * cMin;
    const Gcf = eps * cMin - 0.5 * Gm;

    tMetalC =
      (Km * prevMetalC + Gm * tHotInC + Gm * tColdInC + uaAmb * ambientTempC) /
      (Km + 2.0 * Gm + uaAmb);

    qHotToMetalW = Gcf * (tHotInC - tColdInC) + Gm * (tHotInC - tMetalC);
    qMetalToColdW = Gcf * (tHotInC - tColdInC) + Gm * (tMetalC - tColdInC);

    // Explicit convex-combination evaluation for outlet temperatures (all weights >= 0, sum === 1):
    tHotOutC =
      (Kwh * prevHotOutC + (Ch - Gcf - Gm) * tHotInC + Gcf * tColdInC + Gm * tMetalC) / Kh;
    tColdOutC =
      (Kwc * prevColdOutC + (Cc - Gcf - Gm) * tColdInC + Gcf * tHotInC + Gm * tMetalC) / Kc;
  } else {
    // One or both streams stopped (or UA=0): Schur-complement implicit film conduction between fluid and metal
    const GhmRaw = steady.uaEff > 1e-9 ? (hasHotFlow ? 2.0 * steady.uaEff : 0.5 * steady.uaEff) : 0.0;
    const GmcRaw = steady.uaEff > 1e-9 ? (hasColdFlow ? 2.0 * steady.uaEff : 0.5 * steady.uaEff) : 0.0;
    const GhmTilde = GhmRaw > 0.0 ? (GhmRaw * Kh) / (Kh + GhmRaw) : 0.0;
    const GmcTilde = GmcRaw > 0.0 ? (GmcRaw * Kc) / (Kc + GmcRaw) : 0.0;

    tMetalC =
      (Km * prevMetalC + GhmTilde * tHotAdvC + GmcTilde * tColdAdvC + uaAmb * ambientTempC) /
      (Km + GhmTilde + GmcTilde + uaAmb);

    qHotToMetalW = GhmTilde * (tHotAdvC - tMetalC);
    qMetalToColdW = GmcTilde * (tMetalC - tColdAdvC);

    tHotOutC = ((Kh - GhmTilde) * tHotAdvC + GhmTilde * tMetalC) / Kh;
    tColdOutC = ((Kc - GmcTilde) * tColdAdvC + GmcTilde * tMetalC) / Kc;
  }

  const qAmbientLossW = uaAmb * (tMetalC - ambientTempC);

  const qPrimaryGivenW = Ch * (tHotInC - tHotOutC);
  const qSecondaryReceivedW = Cc * (tColdOutC - tColdInC);
  const qResidualMetalExchangeW = Km * (tMetalC - prevMetalC);

  // Total internal energy stored in HX water channels + metal plates (pure function of the 3 state temperatures):
  const uTotalJ =
    cWaterHotJK * tHotOutC +
    cWaterColdJK * tColdOutC +
    cMetalJK * tMetalC;

  return {
    steadyAnalytical: steady,
    effectiveness: steady.effectiveness,
    ntu: steady.NTU,
    cr: steady.Cr,
    tHotInC,
    tHotOutC,
    tColdInC,
    tColdOutC,
    tMetalC,
    qHotToMetalW,
    qMetalToColdW,
    qPrimaryGivenW,
    qSecondaryReceivedW,
    qAmbientLossW,
    qResidualMetalExchangeW,
    cWaterHotJK,
    cWaterColdJK,
    cMetalJK,
    uTotalJ
  };
}

/**
 * Evaluates Trane RTXC 180 XE-HSE Operating Map & Performance (Section 3.1, 9.7, 9.8):
 * - Checks outdoor air temperature against BOTH Page 48 (+21 °C) and Page 50 (+30 °C) limits.
 * - Checks entering and leaving water temperatures against Page 50 limits.
 * - Computes available capacity and COP as functions of T_amb, T_LWT, water flow rate, compressor load PLR,
 *   relative humidity frost factor, and defrost state.
 */
export function evaluateRtxcHeatPump({
  outdoorAirTempC,
  relativeHumidityPct = 75.0,
  enteringWaterTempC,
  leavingWaterTempC,
  waterFlowM3S,
  compressorLoadCommand0to1, // 0 or 0.15..1.0
  inDefrost = false,
  strictPage48Limit = false
}) {
  // 1. Operating Map Verification (Page 48 & Page 50 of RTXC-SVX003E-EN_0526.pdf)
  const minAirC = -12.0; // R513A 180 ton limit (p. 48, 50)
  const maxAirPage48C = 21.0; // Page 48 text limit
  const maxAirPage50C = 30.0; // Page 50 table limit
  const activeMaxAirC = strictPage48Limit ? maxAirPage48C : maxAirPage50C;

  const inPage48To50AmbiguityZone = outdoorAirTempC > maxAirPage48C && outdoorAirTempC <= maxAirPage50C;
  const airBelowMin = outdoorAirTempC < minAirC;
  const airAboveMax = outdoorAirTempC > activeMaxAirC;
  const waterTooHot = leavingWaterTempC > 55.5 || enteringWaterTempC > 50.5;
  const waterTooColdForRunning = leavingWaterTempC < 10.0;
  const flowBelowMin = waterFlowM3S < 0.0153; // 15.3 L/s Table 4 minimum flow for RTXC 180

  const outOfMapReasons = [];
  if (airBelowMin) {
    outOfMapReasons.push(`Наружная температура ${outdoorAirTempC.toFixed(1)} °C ниже минимума карты (-12 °C для R513A, стр. 50)`);
  }
  if (airAboveMax) {
    outOfMapReasons.push(
      `Летнее ограничение (п. 3.1 ТЗ): наружная температура ${outdoorAirTempC.toFixed(1)} °C выше верхнего предела рабочей карты нагрева (${activeMaxAirC} °C, стр. ${strictPage48Limit ? '48' : '50'}). Экстраполяция запрещена!`
    );
  }
  if (waterTooHot) {
    outOfMapReasons.push(`Температура воды (${leavingWaterTempC.toFixed(1)} °C) превышает предел рабочей карты нагрева (макс. 55 °C выход / 50 °C вход, стр. 50)`);
  }

  const outOfMap = outOfMapReasons.length > 0;

  // 2. Defrost Mode (Section 9.7: heat flow to water reverses sign, extracting energy from primary water!)
  if (inDefrost && !flowBelowMin) {
    const qWaterHeatingW = -185000.0; // -185 kW extracted from water to melt outdoor coil frost
    const pElCompressorsW = 72000.0;
    const pElFansW = 0.0; // Fans off during defrost (p. 49)
    const pElControlsHeatersW = 1200.0;
    const pElTotalW = pElCompressorsW + pElFansW + pElControlsHeatersW;
    // Energy balance on HP boundary: dU_HP/dt = Q_air + P_el - Q_water - Q_loss
    // During defrost, Q_air is negative (heat rejected to melt frost on air coil)
    const qLossW = 2500.0;
    const qAirAbsorbedW = qWaterHeatingW - pElTotalW + qLossW; // negative: heat delivered to outdoor coil frost

    const cycle = solveR513ACycle({
      mode: 'DEFROST',
      outdoorAirTempC,
      leavingWaterTempC,
      targetWaterHeatingPowerW: Math.abs(qWaterHeatingW),
      compressorElectricalPowerW: pElCompressorsW,
      economizerActive: false
    });

    return {
      running: true,
      mode: 'DEFROST',
      outOfMap: false,
      inPage48To50AmbiguityZone,
      outOfMapReasons: [],
      plrActual: 0.45,
      qWaterHeatingW,
      qAirAbsorbedW,
      pElCompressorsW,
      pElFansW,
      pElControlsHeatersW,
      pElTotalW,
      qLossW,
      instantaneousUnitCOP: null, // In defrost Q_water < 0, heating COP is not positive
      refrigerantCycle: cycle
    };
  }

  // 3. Stopped or Blocked by Map / Flow Protection
  if (outOfMap || flowBelowMin || compressorLoadCommand0to1 < 0.14 || waterTooColdForRunning) {
    const pElStandbyW = 850.0; // Symbio 800 + oil sump crank heaters
    const cycle = solveR513ACycle({
      mode: 'STOPPED',
      outdoorAirTempC,
      leavingWaterTempC,
      targetWaterHeatingPowerW: 0
    });
    return {
      running: false,
      mode: outOfMap ? 'MAP_RESTRICTED' : 'STANDBY',
      outOfMap,
      inPage48To50AmbiguityZone,
      outOfMapReasons,
      plrActual: 0.0,
      qWaterHeatingW: 0.0,
      qAirAbsorbedW: 0.0,
      pElCompressorsW: 0.0,
      pElFansW: 0.0,
      pElControlsHeatersW: pElStandbyW,
      pElTotalW: pElStandbyW,
      qLossW: 850.0,
      instantaneousUnitCOP: null,
      refrigerantCycle: cycle
    };
  }

  // 4. Normal Heating Operation within Documented Envelope
  // Enforce minimum compressor unloading limit of 15% (Page 16: Minimum Load = 15% for 2-circuit RTXC 180)
  const plr = Math.max(0.15, Math.min(1.0, compressorLoadCommand0to1));

  // Documented nominal rating point for RTXC 180 XE-HSE (Page 16 of RTXC-SVX003E-EN_0526.pdf, EN 14511-2018):
  // At T_amb = 7°C DB / 6°C WB, T_EWT/LWT = 40/45°C, q_v = 27.2 L/s, PLR = 1.0:
  //   Q_nom = 619,000 W, COP_nom = 3.07 => P_el,nom = 201,628.7 W (CONFIRMED_BY_DOC).
  // Off-design modifiers below (capTempMod, copTempMod, hsePartLoadCopFactor, frostPenalty) are
  // ASSUMED_FOR_DEMO empirical demonstration surfaces anchored at the single EN 14511 rating point;
  // full multi-point Trane TOPSS selection tables were not provided by the site owner.
  const qNomW = 619000.0;
  const copNom = 3.07;

  const dTair = outdoorAirTempC - 7.0;
  const dTlwt = leavingWaterTempC - 45.0;
  const flowRatio = Math.max(0.5, Math.min(1.5, waterFlowM3S / 0.0272));

  // Empirical frost penalty when outdoor air is between -7°C and +4°C at high RH (ASSUMED_FOR_DEMO)
  const frostPenalty =
    outdoorAirTempC >= -7.0 && outdoorAirTempC <= 4.5 && relativeHumidityPct > 70.0
      ? 1.0 - 0.06 * ((relativeHumidityPct - 70.0) / 30.0)
      : 1.0;

  // Empirical off-design capacity modifier anchored to 1.0 at 7°C air / 45°C LWT / 27.2 L/s (ASSUMED_FOR_DEMO)
  const capTempMod = Math.max(
    0.45,
    (1.0 + 0.0245 * dTair - 0.00018 * dTair * dTair - 0.0062 * dTlwt + 0.04 * (flowRatio - 1.0)) * frostPenalty
  );

  // Full-load capacity available at current temperatures
  const qFullLoadAvailableW = qNomW * capTempMod;
  const qWaterHeatingW = qFullLoadAvailableW * plr;

  // Empirical off-design & part-load COP modifiers anchored to 1.0 at 7°C air / 45°C LWT / PLR=1.0 (ASSUMED_FOR_DEMO):
  const copTempMod = Math.max(
    0.45,
    (1.0 + 0.027 * dTair - 0.021 * dTlwt) * frostPenalty
  );
  const hsePartLoadCopFactor = 1.0 + 0.16 * Math.sin(Math.PI * (1.0 - plr)) * Math.max(0.0, plr - 0.12);
  const effectiveCOP = Math.max(1.35, copNom * copTempMod * hsePartLoadCopFactor);

  const pElTotalW = qWaterHeatingW / effectiveCOP;
  // 12 EC fans × 1.77 kW = 21.24 kW at high speed (Page 39 & Page 49: in heating mode fans run high speed)
  const activeFanFraction = plr > 0.5 ? 1.0 : 0.65;
  const pElFansW = 12 * 1770.0 * activeFanFraction;
  const pElControlsHeatersW = 950.0;
  const pElCompressorsW = Math.max(1000.0, pElTotalW - pElFansW - pElControlsHeatersW);
  const qLossW = 3200.0;

  // Exact unit boundary energy balance (Section 9.7):
  // dU_HP/dt = Q_air + P_el,HP - Q_water - Q_loss = 0 in quasi-steady refrigerant step =>
  const qAirAbsorbedW = qWaterHeatingW + qLossW - pElTotalW;

  const cycle = solveR513ACycle({
    mode: 'HEATING',
    outdoorAirTempC,
    leavingWaterTempC,
    targetWaterHeatingPowerW: qWaterHeatingW,
    compressorElectricalPowerW: pElCompressorsW,
    economizerActive: plr >= 0.85 // Page 48: economizer modulated near full load
  });

  return {
    running: true,
    mode: 'HEATING',
    outOfMap: false,
    inPage48To50AmbiguityZone,
    outOfMapReasons: [],
    plrActual: plr,
    qWaterHeatingW,
    qAirAbsorbedW,
    pElCompressorsW,
    pElFansW,
    pElControlsHeatersW,
    pElTotalW,
    qLossW,
    instantaneousUnitCOP: qWaterHeatingW / pElTotalW,
    performanceMapProvenance: {
      nominalRatingPointStatus: 'confirmed_by_doc',
      nominalRatingPointRef: 'RTXC-SVX003E-EN_0526.pdf, Table 1, p. 16 (EN 14511-2018: 7/6°C air, 40/45°C water, 619 kW, COP 3.07)',
      offDesignModifiersStatus: 'assumed_for_demo',
      offDesignModifiersNoteRu:
        'Модификаторы частичной нагрузки и температур вне номинальной точки (capTempMod, copTempMod, hsePartLoadCopFactor, frostPenalty) являются демонстрационной аппроксимацией (assumed_for_demo), привязанной к табличной точке EN 14511 (619 кВт, COP 3.07).'
    },
    refrigerantCycle: cycle
  };
}

/**
 * Steps the 4-pipe Buffer Tank BT01 (Section 4 & Section 9.6):
 *   dU/dt = sum(m_in * h_in) - sum(m_out * h_out) - Q_loss
 *   Explicitly models the 2 vertical zones (Top hot zone & Bottom return zone) and internal mixing
 *   caused by flow mismatch between mDotHp (primary source) and mDotDist (primary distribution).
 *   When mDotDist > mDotHp, cooler return water mixes into the distribution supply, so T_dist_sup < T_HP_out!
 */
export function stepBufferTankBT01({
  btState,
  totalVolumeM3 = 4.0,
  mDotHpKgS,
  tHpOutC,
  mDotDistKgS,
  tDistReturnC,
  ambientTempC = 12.0,
  cpWaterJKgK = THERMAL_REF_CONSTANTS.cpWaterJKgK,
  rhoWaterKgM3 = THERMAL_REF_CONSTANTS.rhoPrimaryKgM3,
  dtSeconds = 0.5
}) {
  const cpRef = THERMAL_REF_CONSTANTS.cpWaterJKgK;
  const rhoRef = THERMAL_REF_CONSTANTS.rhoPrimaryKgM3;
  const halfMassKg = 0.5 * totalVolumeM3 * rhoRef;
  const cZoneJK = halfMassKg * cpRef;

  let tTopC = btState.topTempC;
  let tBotC = btState.bottomTempC;

  // Ambient heat losses from insulated 4 m³ vertical cylindrical tank (UA_tank ≈ 14 W/K total)
  const uaHalfTankWK = 7.0;
  const qLossTopW = uaHalfTankWK * (tTopC - ambientTempC);
  const qLossBotW = uaHalfTankWK * (tBotC - ambientTempC);
  const qLossTotalW = qLossTopW + qLossBotW;

  // Internal vertical flow inside the 4-pipe buffer tank:
  // Top ports: HP hot in (+mDotHp at tHpOutC), Dist hot out (-mDotDist at tTopC)
  // Bottom ports: Dist cold in (+mDotDist at tDistReturnC), HP cold out (-mDotHp at tBotC)
  // Net downward internal flow from Top zone to Bottom zone: mDotInternalDown = mDotHp - mDotDist
  const mDotDownKgS = Math.max(0.0, mDotHpKgS - mDotDistKgS);
  const mDotUpKgS = Math.max(0.0, mDotDistKgS - mDotHpKgS);
  // Small turbulent eddy exchange across internal baffle (Page 31: internal baffles)
  const mDotBaffleMixKgS = 0.04 * Math.min(mDotHpKgS, mDotDistKgS);

  // Energy balance on Top Zone:
  // cZone * dT_top/dt = mDotHp * cp * (tHpOutC - tTopC) + mDotUp * cp * (tBotC - tTopC)
  //                     + mDotBaffleMix * cp * (tBotC - tTopC) - qLossTopW
  const dQTopW =
    mDotHpKgS * cpRef * (tHpOutC - tTopC) +
    (mDotUpKgS + mDotBaffleMixKgS) * cpRef * (tBotC - tTopC) -
    qLossTopW;

  // Energy balance on Bottom Zone:
  // cZone * dT_bot/dt = mDotDist * cp * (tDistReturnC - tBotC) + mDotDown * cp * (tTopC - tBotC)
  //                     + mDotBaffleMix * cp * (tTopC - tBotC) - qLossBotW
  const dQBotW =
    mDotDistKgS * cpRef * (tDistReturnC - tBotC) +
    (mDotDownKgS + mDotBaffleMixKgS) * cpRef * (tTopC - tBotC) -
    qLossBotW;

  const nextTopC = tTopC + (dQTopW * dtSeconds) / cZoneJK;
  const nextBotC = tBotC + (dQBotW * dtSeconds) / cZoneJK;

  const qHpAdvectiveInW = mDotHpKgS * cpRef * (tHpOutC - tBotC);
  const qDistAdvectiveOutW = mDotDistKgS * cpRef * (tTopC - tDistReturnC);
  const dUdtW = dQTopW + dQBotW;
  const uTotalJ = cZoneJK * (nextTopC + nextBotC);

  return {
    topTempC: nextTopC,
    mid1TempC: 0.67 * nextTopC + 0.33 * nextBotC,
    mid2TempC: 0.33 * nextTopC + 0.67 * nextBotC,
    bottomTempC: nextBotC,
    distSupplyTempC: nextTopC,
    hpReturnTempC: nextBotC,
    qHpAdvectiveInW,
    qDistAdvectiveOutW,
    qLossTotalW,
    dUdtW,
    cZoneJK,
    uTotalJ
  };
}
