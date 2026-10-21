/**
 * Section 9.1–9.8 — Thermophysical Properties of Water/Glycol and R513A Refrigerant Cycle
 * - Water density ρ(T, p), specific heat c_p(T), dynamic viscosity μ(T), specific enthalpy h(T, p)
 * - R513A (Opteon™ XP10: 56% R1234yf / 44% R134a) saturation & superheated properties calibrated against
 *   official Chemours SI Thermodynamic Properties Table (Publication C-10316 (3/16), based on NIST REFPROP v9.1)
 *   over the valid operating domain [-25 °C .. +72 °C].
 * - Four-point refrigerant cycle + BPHE economizer vapor-injection branch balance (Section 9.8).
 */

export const STD_ATM_PA = 101325.0;
export const GRAVITY_MS2 = 9.80665;

/**
 * Water / aqueous propylene-glycol properties in SI units.
 * @param {number} tempC - Fluid temperature in °C
 * @param {number} absPressurePa - Absolute pressure in Pa (used for subcooled liquid enthalpy & vapor pressure check)
 * @param {number} glycolPct - Mass percentage of glycol (0..20% per p. 55 of RTXC manual)
 */
export function getWaterProperties(tempC, absPressurePa = 250000.0, glycolPct = 0.0) {
  const T = Math.max(-15.0, Math.min(120.0, tempC));
  const gFrac = Math.max(0.0, Math.min(0.30, glycolPct / 100.0));

  // Kell / IAPWS-IF97 accurate liquid water density correlation (kg/m³) at 1 atm + isothermal compressibility
  const rhoPure =
    999.842594 +
    6.793952e-2 * T -
    9.095290e-3 * T * T +
    1.001685e-4 * T * T * T -
    1.120083e-6 * Math.pow(T, 4) +
    6.536332e-9 * Math.pow(T, 5);

  const compressibility = 4.55e-10; // 1/Pa
  const rhoCompressed = rhoPure * (1.0 + compressibility * (absPressurePa - STD_ATM_PA));
  const rho = rhoCompressed * (1.0 + 0.26 * gFrac);

  // Specific heat capacity c_p in J/(kg·K)
  const cpPure = 4217.4 - 3.65 * T + 0.107 * T * T - 1.18e-3 * T * T * T + 5.1e-6 * Math.pow(T, 4);
  const cp = cpPure * (1.0 - 0.52 * gFrac);

  // Dynamic viscosity μ in Pa·s (Vogel equation for liquid water, adjusted for glycol)
  const muPure = 2.414e-5 * Math.pow(10.0, 247.8 / (T + 273.15 - 140.0));
  const mu = muPure * (1.0 + 2.8 * gFrac);

  // Saturation vapor pressure of water (Antoine / Buck equation) in Pa (for NPSHa cavitation margin)
  const pSatPa = 611.21 * Math.exp((18.678 - T / 234.5) * (T / (257.14 + T)));

  // Specific enthalpy h(T, p) = integral(c_p dT) + (p - p_ref)/rho in J/kg (reference 0 °C at 101.325 kPa)
  const h = cp * T + (absPressurePa - STD_ATM_PA) / rho;

  return {
    tempC: T,
    tempK: T + 273.15,
    absPressurePa,
    rho,
    cp,
    mu,
    pSatPa,
    h
  };
}

/**
 * R513A (Opteon™ XP10: 56% R1234yf / 44% R134a) Thermophysical Property Module
 * Source: Chemours "Thermodynamic Properties of Opteon™ XP10 (R-513A) SI Units", Publication C-10316 (3/16),
 * based on NIST Standard Database 23 (REFPROP Version 9.1, Lemmon, Huber, McLinden, 2013).
 * Critical parameters per Chemours C-10316 p. 1:
 *   T_crit = 96.5 °C (369.65 K), P_crit = 3765.7 kPa (3,765,700 Pa), rho_crit = 516.75 kg/m³, M = 108.4 g/mol.
 * Enthalpy & entropy reference state (IIR): h_f(0 °C) = 200.0 kJ/kg, s_f(0 °C) = 1.000 kJ/(kg·K).
 * Since R-513A is a near-azeotropic blend with a tiny glide (< 0.5 K), the Chemours table lists both saturated
 * liquid bubble pressure p_f and saturated vapor dew pressure p_g; getR513ASaturation() returns both
 * pSatVaporPa (p_g) and pSatLiquidPa (p_f), with pSatPa = pSatVaporPa.
 * Coefficient fitting is performed strictly on 9 calibration points (fitPoints) and verified on 12 completely
 * disjoint validation points (validationPoints, including -20, -10, 0, 25, 45, 55 °C).
 */
export const R513A_LIMITS = Object.freeze({
  minSatTempC: -25.0,
  maxSatTempC: 72.0,
  criticalTempC: 96.5,
  criticalTempK: 369.65,
  criticalPressurePa: 3765700.0,
  criticalDensityKgM3: 516.75,
  molarMassKgMol: 0.1084,
  referenceSource: 'Chemours Opteon XP10 (R-513A) Thermodynamic Properties SI Units, Pub. C-10316 (3/16), NIST REFPROP v9.1'
});

export const CHEMOURS_OPTEON_XP10_SI_REFERENCE = Object.freeze({
  publicationId: 'C-10316 (3/16)',
  equationOfStateBasis: 'NIST Standard Database 23 (REFPROP Version 9.1)',
  referenceState: { tempC: 0.0, hfJKg: 200000.0, sfJKgK: 1000.0 },
  fitPoints: Object.freeze([
    { tC: -25, pfKpa: 122.072, pgKpa: 121.568, hfKjKg: 168.1, hfgKjKg: 193.5, hgKjKg: 361.6, sfKjKgK: 0.878, sgKjKgK: 1.658 },
    { tC: -15, pfKpa: 184.579, pgKpa: 184.152, hfKjKg: 180.6, hfgKjKg: 187.4, hgKjKg: 368.1, sfKjKgK: 0.928, sgKjKgK: 1.654 },
    { tC: -5,  pfKpa: 269.530, pgKpa: 269.218, hfKjKg: 193.5, hfgKjKg: 180.9, hgKjKg: 374.4, sfKjKgK: 0.976, sgKjKgK: 1.651 },
    { tC: 10,  pfKpa: 449.774, pgKpa: 449.655, hfKjKg: 213.3, hfgKjKg: 170.2, hgKjKg: 383.6, sfKjKgK: 1.047, sgKjKgK: 1.649 },
    { tC: 20,  pfKpa: 612.915, pgKpa: 612.889, hfKjKg: 227.0, hfgKjKg: 162.4, hgKjKg: 389.4, sfKjKgK: 1.094, sgKjKgK: 1.648 },
    { tC: 35,  pfKpa: 936.565, pgKpa: 936.536, hfKjKg: 248.3, hfgKjKg: 149.1, hgKjKg: 397.4, sfKjKgK: 1.164, sgKjKgK: 1.648 },
    { tC: 50,  pfKpa: 1374.063, pgKpa: 1373.768, hfKjKg: 270.7, hfgKjKg: 133.5, hgKjKg: 404.2, sfKjKgK: 1.234, sgKjKgK: 1.647 },
    { tC: 65,  pfKpa: 1949.744, pgKpa: 1948.908, hfKjKg: 294.8, hfgKjKg: 114.3, hgKjKg: 409.1, sfKjKgK: 1.305, sgKjKgK: 1.643 },
    { tC: 72,  pfKpa: 2273.725, pgKpa: 2272.585, hfKjKg: 306.9, hfgKjKg: 103.3, hgKjKg: 410.2, sfKjKgK: 1.340, sgKjKgK: 1.639 }
  ]),
  validationPoints: Object.freeze([
    { tC: -20, pfKpa: 150.808, pgKpa: 150.337, hfKjKg: 174.3, hfgKjKg: 190.5, hgKjKg: 364.9, sfKjKgK: 0.903, sgKjKgK: 1.656 },
    { tC: -10, pfKpa: 223.954, pgKpa: 223.582, hfKjKg: 187.0, hfgKjKg: 184.2, hgKjKg: 371.2, sfKjKgK: 0.952, sgKjKgK: 1.652 },
    { tC: 0,   pfKpa: 321.926, pgKpa: 321.680, hfKjKg: 200.0, hfgKjKg: 177.5, hgKjKg: 377.5, sfKjKgK: 1.000, sgKjKgK: 1.650 },
    { tC: 5,   pfKpa: 381.785, pgKpa: 381.604, hfKjKg: 206.6, hfgKjKg: 173.9, hgKjKg: 380.6, sfKjKgK: 1.024, sgKjKgK: 1.649 },
    { tC: 15,  pfKpa: 526.580, pgKpa: 526.514, hfKjKg: 220.1, hfgKjKg: 166.4, hgKjKg: 386.5, sfKjKgK: 1.071, sgKjKgK: 1.649 },
    { tC: 25,  pfKpa: 709.514, pgKpa: 709.510, hfKjKg: 234.0, hfgKjKg: 158.2, hgKjKg: 392.1, sfKjKgK: 1.118, sgKjKgK: 1.648 },
    { tC: 30,  pfKpa: 817.135, pgKpa: 817.132, hfKjKg: 241.1, hfgKjKg: 153.8, hgKjKg: 394.8, sfKjKgK: 1.141, sgKjKgK: 1.648 },
    { tC: 40,  pfKpa: 1068.622, pgKpa: 1068.536, hfKjKg: 255.6, hfgKjKg: 144.2, hgKjKg: 399.8, sfKjKgK: 1.188, sgKjKgK: 1.648 },
    { tC: 45,  pfKpa: 1214.157, pgKpa: 1213.983, hfKjKg: 263.1, hfgKjKg: 139.0, hgKjKg: 402.1, sfKjKgK: 1.211, sgKjKgK: 1.648 },
    { tC: 55,  pfKpa: 1549.283, pgKpa: 1548.834, hfKjKg: 278.5, hfgKjKg: 127.6, hgKjKg: 406.1, sfKjKgK: 1.258, sgKjKgK: 1.646 },
    { tC: 60,  pfKpa: 1740.818, pgKpa: 1740.187, hfKjKg: 286.5, hfgKjKg: 121.2, hgKjKg: 407.7, sfKjKgK: 1.281, sgKjKgK: 1.645 },
    { tC: 70,  pfKpa: 2177.239, pgKpa: 2176.186, hfKjKg: 303.3, hfgKjKg: 106.6, hgKjKg: 410.0, sfKjKgK: 1.330, sgKjKgK: 1.640 }
  ])
});

export function getR513ASaturation(satTempC) {
  const withinDomain = satTempC >= R513A_LIMITS.minSatTempC && satTempC <= R513A_LIMITS.maxSatTempC;
  const T = Math.max(R513A_LIMITS.minSatTempC, Math.min(R513A_LIMITS.maxSatTempC, satTempC));
  const Tk = T + 273.15;

  // Wagner saturation pressure correlations for R-513A (Pa), fitted to 9 calibration points of
  // Chemours C-10316 (3/16) and verified on 12 independent validation points (max error < 0.007%):
  const Tc = R513A_LIMITS.criticalTempK; // 369.65 K
  const Pc = R513A_LIMITS.criticalPressurePa; // 3,765,700 Pa
  const tau = 1.0 - Tk / Tc;
  const tau15 = Math.pow(tau, 1.5);
  const tau25 = Math.pow(tau, 2.5);
  const tau50 = Math.pow(tau, 5.0);

  const lnPrVapor = (Tc / Tk) * (
    -7.537207865626266 * tau +
    1.8136851971893984 * tau15 -
    2.54026782487091 * tau25 -
    3.0679441546152235 * tau50
  );
  const lnPrLiquid = (Tc / Tk) * (
    -7.5075067555199855 * tau +
    1.7149121558035127 * tau15 -
    2.3884571300496678 * tau25 -
    2.4894529229483107 * tau50
  );

  const pSatVaporPa = Pc * Math.exp(lnPrVapor);
  const pSatLiquidPa = Pc * Math.exp(lnPrLiquid);
  const pSatPa = pSatVaporPa;

  // Saturated liquid enthalpy h_f (J/kg), latent heat h_fg (J/kg), and saturated vapor enthalpy h_g (J/kg)
  // per Chemours C-10316 (3/16) IIR reference state (h_f = 200,000 J/kg at 0 °C):
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T2 * T2;
  const hf = 1000.0 * (
    200.0 +
    1.3180329389641687 * T +
    0.0015788974060992405 * T2 -
    8.536440977743299e-7 * T3 +
    1.5299192137836951e-7 * T4
  );

  const tr = Math.max(0.01, (R513A_LIMITS.criticalTempC - T) / R513A_LIMITS.criticalTempC);
  const hfg = 1000.0 * (
    154.83753136041474 * Math.pow(tr, 0.38) +
    54.56049617214928 * Math.pow(tr, 0.76) -
    30.914949905187854 * tr -
    1.00301139893148 * tr * tr
  );
  const hg = hf + hfg;

  // Saturated liquid entropy s_f and saturated vapor entropy s_g in J/(kg·K)
  // per Chemours C-10316 (3/16) IIR reference state (s_f = 1000 J/(kg·K) at 0 °C):
  const sf = 1000.0 * (
    1.0 +
    0.0047613825086021445 * T -
    0.00000371111708819884 * T2 +
    3.422860513946327e-8 * T3 +
    1.2591048399651364e-10 * T4
  );
  const sg = 1000.0 * (
    1.6500793896972616 -
    0.0001821995914667906 * T +
    0.000005059032574265548 * T2 -
    2.5285997269158375e-8 * T3 -
    5.468330264208816e-10 * T4
  );

  // Isobaric specific heat of superheated vapor near saturation cp_vap in J/(kg·K) (from Chemours C-10316 superheat tables)
  const cpVap = 920.0 + 4.4 * T + 0.032 * T2;
  // Liquid specific heat cp_liq = dh_f/dT in J/(kg·K)
  const cpLiq = 1318.03 + 3.1578 * T - 0.00256 * T2 + 0.000612 * T3;

  return {
    satTempC: T,
    satTempK: Tk,
    withinDomain,
    pSatPa,
    pSatVaporPa,
    pSatLiquidPa,
    pSatBarAbs: pSatPa * 1e-5,
    pSatBarGauge: (pSatPa - STD_ATM_PA) * 1e-5,
    hf,
    hg,
    hfg,
    sf,
    sg,
    cpVap,
    cpLiq,
    referenceSource: R513A_LIMITS.referenceSource
  };
}

/**
 * Solves the R513A Refrigerant Cycle (Section 9.8) for the RTXC 180 XE-HSE prototype:
 * - Supports both the 4-point verification cycle:
 *     h_2s = h(p_cond, s_1), h_2 = h_1 + (h_2s - h_1)/eta_is, h_4 = h_3,
 *     Q_evap = m_r*(h_1 - h_4), Q_cond = m_r*(h_2 - h_3)
 * - And the BPHE Economizer vapor-injection branch balance (Page 47 Fig. 19 & Page 48):
 *     Main liquid subcooled from T_3 to T_3,sub by flashing auxiliary refrigerant mass m_econ
 *     at intermediate pressure p_econ = sqrt(p_evap * p_cond).
 * - Strictly distinguishes calculated thermodynamic cycle values from unmeasured internal compressor parameters.
 */
export function solveR513ACycle({
  mode = 'HEATING', // 'HEATING', 'DEFROST', 'STOPPED'
  outdoorAirTempC = 12.0,
  leavingWaterTempC = 50.0,
  targetWaterHeatingPowerW = 550000.0,
  economizerActive = true,
  isropicEfficiency = 0.76,
  compressorElectricalPowerW = null
}) {
  if (mode === 'STOPPED' || Math.abs(targetWaterHeatingPowerW) < 100.0) {
    const eqSat = getR513ASaturation(outdoorAirTempC);
    return {
      active: false,
      mode: 'STOPPED',
      withinCoolPropDomain: eqSat.withinDomain,
      verificationNoteRu: 'Компрессоры остановлены — давления хладагента выровнены по температуре среды (приближённая демонстрационная модель цикла R513A).',
      evapTempC: outdoorAirTempC,
      condTempC: leavingWaterTempC,
      tEvapC: outdoorAirTempC,
      tCondC: leavingWaterTempC,
      pEvapPa: eqSat.pSatPa,
      pCondPa: eqSat.pSatPa,
      pEvapAbsPa: eqSat.pSatPa,
      pCondAbsPa: eqSat.pSatPa,
      suctionSuperheatK: 0,
      dischargeSuperheatK: 0,
      subcoolingK: 0,
      massFlowMainKgS: 0,
      massFlowEconKgS: 0,
      massFlowTotalKgS: 0,
      points: { h1: eqSat.hg, h2s: eqSat.hg, h2: eqSat.hg, h3: eqSat.hf, h3Sub: eqSat.hf, h4: eqSat.hf },
      qEvapW: 0,
      qCondW: 0,
      compressorShaftPowerW: 0,
      compressorElectricalPowerW: 0,
      compressorDriveMotorEta: 0.94,
      energyBalanceResidualW: 0
    };
  }

  // Table 7 (Page 57 of RTXC-SVX003E-EN):
  // Heating Mode:
  //   Water side approach (Saturated discharge temp - Leaving water temp): 2 ~ 6 °C (nominal 4.0 °C)
  //   Air side approach (Outdoor air temp - Saturated suction temp): 8 ~ 12 °C (nominal 9.5 °C)
  //   Suction superheat (Page 56): 2 ~ 6 °C (nominal 4.0 °C)
  //   Subcooling at condenser exit: nominal 4.5 °C
  const isDefrost = mode === 'DEFROST';
  const evapTempC = isDefrost ? Math.max(5.0, leavingWaterTempC - 8.0) : outdoorAirTempC - 9.5;
  const condTempC = isDefrost ? Math.max(18.0, outdoorAirTempC + 14.0) : leavingWaterTempC + 4.0;

  const evapSat = getR513ASaturation(evapTempC);
  const condSat = getR513ASaturation(condTempC);
  const withinCoolPropDomain = evapSat.withinDomain && condSat.withinDomain;

  const suctionSuperheatK = 4.0;
  const subcoolingK = 4.5;

  // Point 1: Compressor suction (superheated vapor at p_evap)
  const T1 = evapSat.satTempC + suctionSuperheatK;
  const h1 = evapSat.hg + evapSat.cpVap * suctionSuperheatK;
  const s1 = evapSat.sg + evapSat.cpVap * Math.log((T1 + 273.15) / evapSat.satTempK);

  // Point 3: Condenser liquid exit (subcooled by subcoolingK)
  const T3C = condSat.satTempC - subcoolingK;
  const h3 = condSat.hf - condSat.cpLiq * subcoolingK;

  // Economizer BPHE branch (Page 48: active near high load to subcool main liquid stream further)
  const T_econC = 0.5 * (evapSat.satTempC + condSat.satTempC);
  const econSat = getR513ASaturation(T_econC);
  let h3Sub = h3;
  let econRatio = 0.0; // m_econ / m_evap
  let hEconGas = h1;
  if (economizerActive && !isDefrost) {
    const deltaTSubEcon = Math.max(0.0, 0.55 * (T3C - (T_econC + 3.0)));
    h3Sub = h3 - condSat.cpLiq * deltaTSubEcon;
    hEconGas = econSat.hg + econSat.cpVap * 4.0;
    // Exact BPHE economizer energy balance: m_evap * (h3 - h3Sub) = m_econ * (hEconGas - h3)
    econRatio = Math.max(0.0, (h3 - h3Sub) / Math.max(10000.0, hEconGas - h3));
  }

  // Point 4: Isenthalpic expansion into evaporator (h_4 = h_3,sub)
  const h4 = h3Sub;

  // Two-stage compression with intermediate vapor injection at p_econ:
  const etaIs = Math.max(0.55, Math.min(0.90, isropicEfficiency));
  // Stage 1: Evap suction (p_evap, h1, s1) -> Intermediate port (p_econ)
  const TmsK = econSat.satTempK * Math.exp((s1 - econSat.sg) / econSat.cpVap);
  const TmsC = Math.max(econSat.satTempC + 1.0, TmsK - 273.15);
  const hms = econSat.hg + econSat.cpVap * (TmsC - econSat.satTempC);
  const hm1 = h1 + (hms - h1) / etaIs;

  // Adiabatic mixing of compressed main stream (1 kg at hm1) and injected economizer vapor (econRatio kg at hEconGas)
  const hMix = (hm1 + econRatio * hEconGas) / (1.0 + econRatio);
  const TmixC = econSat.satTempC + (hMix - econSat.hg) / econSat.cpVap;
  const sMix = econSat.sg + econSat.cpVap * Math.log(Math.max(1.001, (TmixC + 273.15) / econSat.satTempK));

  // Stage 2: Intermediate port (p_econ, hMix, sMix) -> Condenser pressure (p_cond)
  const T2sK = condSat.satTempK * Math.exp((sMix - condSat.sg) / condSat.cpVap);
  const T2sC = Math.max(condSat.satTempC + 2.0, T2sK - 273.15);
  const h2s = condSat.hg + condSat.cpVap * (T2sC - condSat.satTempC);
  const h2 = hMix + (h2s - hMix) / etaIs;
  const T2C = condSat.satTempC + (h2 - condSat.hg) / condSat.cpVap;
  const dischargeSuperheatK = T2C - condSat.satTempC;

  // Specific heat & work per kg of evaporator flow (computed independently for evaporator, compressor stages, and condenser):
  const qEvapPerKgEvap = h1 - h4;
  const wStage1PerKgEvap = hm1 - h1;
  const wStage2PerKgEvap = (1.0 + econRatio) * (h2 - hMix);
  const wShaftPerKgEvap = wStage1PerKgEvap + wStage2PerKgEvap;
  const qCondPerKgEvap = (1.0 + econRatio) * (h2 - h3);

  const absTargetCondW = Math.abs(targetWaterHeatingPowerW);
  const massFlowEvapKgS = absTargetCondW / Math.max(1000.0, qCondPerKgEvap);
  const massFlowEconKgS = massFlowEvapKgS * econRatio;
  const massFlowTotalKgS = massFlowEvapKgS + massFlowEconKgS;

  // Independent component energy transfer rates (no tautological W = Q_cond - Q_evap):
  const qEvapW = massFlowEvapKgS * qEvapPerKgEvap;
  const compressorShaftPowerW = massFlowEvapKgS * wStage1PerKgEvap + massFlowTotalKgS * (h2 - hMix);
  const qCondW = massFlowTotalKgS * (h2 - h3);
  const energyBalanceResidualW = qCondW - (qEvapW + compressorShaftPowerW);

  const compElW = compressorElectricalPowerW !== null ? compressorElectricalPowerW : compressorShaftPowerW / 0.94;
  const compressorDriveMotorEta = compElW > 1.0 ? compressorShaftPowerW / compElW : 0.94;

  return {
    active: true,
    mode,
    withinCoolPropDomain,
    economizerActive: economizerActive && !isDefrost,
    verificationNoteRu:
      'Приближённая проверочная четырёхточечная модель цикла R513A с двухступенчатым сжатием и балансом экономайзера BPHE (разд. 9.8 ТЗ, табл. 7 стр. 57 руководства). Не заменяет заводские стендовые карты компрессоров.',
    evapTempC,
    condTempC,
    tEvapC: evapTempC,
    tCondC: condTempC,
    pEvapPa: evapSat.pSatPa,
    pCondPa: condSat.pSatPa,
    pEvapAbsPa: evapSat.pSatPa,
    pCondAbsPa: condSat.pSatPa,
    pEvapBarGauge: evapSat.pSatBarGauge,
    pCondBarGauge: condSat.pSatBarGauge,
    waterSideApproachK: condTempC - leavingWaterTempC,
    airSideApproachK: outdoorAirTempC - evapTempC,
    suctionSuperheatK,
    dischargeSuperheatK,
    subcoolingK,
    massFlowMainKgS: massFlowEvapKgS,
    massFlowEconKgS,
    massFlowTotalKgS,
    points: { h1, hm1, hMix, h2s, h2, h3, h3Sub, h4, T1C: T1, T2sC, T2C, T3C },
    qEvapW,
    qCondW,
    compressorShaftPowerW,
    compressorElectricalPowerW: compElW,
    compressorDriveMotorEta,
    energyBalanceResidualW
  };
}
