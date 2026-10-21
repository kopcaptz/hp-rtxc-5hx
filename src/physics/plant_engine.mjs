/**
 * Stage 4 — Complete Plant Simulation Engine (src/physics/plant_engine.mjs)
 * Integrates:
 *   - Topology Registry (components & connections)
 *   - Datasets (DEMO vs SITE mode + missing data dependency blocking)
 *   - Stage 2 Hydraulic Core (network + pump curves + elevations + expansion tanks + PSVs)
 *   - Stage 3 Thermal Core (5 analytical & transient ε-NTU HXs + 4-pipe BT01 buffer + 5 consumer load models + RTXC HP01)
 *   - Stage 4 Two-Level Automation (Symbio 800 8-step startup + CP01 PI controllers + 1+1 pump failover + MU01/WT01)
 *   - Deterministic fixed internal physics substep (FPS-independent!) & Period Energy / COP integrators.
 */

import { createComponentRegistry, createConnectionRegistry } from '../topology/registry.mjs';
import { CONSUMER_LOAD_TYPES, DATA_MODES, createDataset, evaluateMissingDataDependencies } from '../equipment/datasets.mjs';
import { getWaterProperties } from './fluid_and_thermo.mjs';
import { evaluatePsvOrificeDischarge, solvePlantHydraulics } from './hydraulics.mjs';
import {
  THERMAL_REF_CONSTANTS,
  evaluateRtxcHeatPump,
  stepBufferTankBT01,
  stepTransientHeatExchanger
} from './thermal.mjs';
import {
  PUMP_STATES,
  SHUTDOWN_MODES,
  SYMBIO_STARTUP_STEPS,
  stepPIController,
  updatePumpGroupRedundancy
} from '../control/automation.mjs';

/**
 * Deterministic PRNG (Mulberry32) for repeatable sensor noise when enabled (Section 15)
 */
export function createSeededRng(seed = 20261019) {
  let a = seed >>> 0;
  return function nextRandom() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a clean initial simulation state for the given dataset mode.
 */
export function createSimulationInstance(mode = DATA_MODES.DEMO, seed = 20261019) {
  const components = createComponentRegistry();
  const connections = createConnectionRegistry();
  const dataset = createDataset(mode);
  const missingDataReport = evaluateMissingDataDependencies(dataset);

  const pumps = {
    PP01A: { id: 'PP01A', modeState: PUMP_STATES.RUNNING, commandOn: true, running: true, speedRatio: 1.0, runTimerS: 10.0 },
    PP01B: { id: 'PP01B', modeState: PUMP_STATES.READY_STANDBY, commandOn: false, running: false, speedRatio: 0.0, runTimerS: 0.0 },
    PD01A: { id: 'PD01A', modeState: PUMP_STATES.RUNNING, commandOn: true, running: true, speedRatio: 0.88, runTimerS: 10.0 },
    PD01B: { id: 'PD01B', modeState: PUMP_STATES.READY_STANDBY, commandOn: false, running: false, speedRatio: 0.0, runTimerS: 0.0 }
  };

  for (let i = 1; i <= 5; i++) {
    const idx = `0${i}`;
    pumps[`PS${idx}A`] = { id: `PS${idx}A`, modeState: PUMP_STATES.RUNNING, commandOn: true, running: true, speedRatio: 1.0, runTimerS: 10.0 };
    pumps[`PS${idx}B`] = { id: `PS${idx}B`, modeState: PUMP_STATES.READY_STANDBY, commandOn: false, running: false, speedRatio: 0.0, runTimerS: 0.0 };
  }

  const branches = [1, 2, 3, 4, 5].map((i) => ({
    index: i,
    enabled: true,
    cvCommandPos: 0.68,
    cvActualPos: 0.68,
    piController: { integral: 0.68, error: 0.0, output: 0.68 },
    hxState: {
      tHotInC: 49.8,
      tHotOutC: 40.4,
      tColdInC: 40.2,
      tColdOutC: 45.0,
      tMetalC: 43.8,
      qPrimaryGivenW: 110000.0,
      qSecondaryReceivedW: 110000.0,
      qAmbientLossW: 110.0,
      uTotalJ: 0.0
    },
    secSupplyTempC: 45.0,
    secReturnTempC: 40.2,
    processCoreTempC: dataset.branches[i - 1].processTargetTempC.value !== null ? 37.8 : null,
    loadScaleFactor: 1.0,
    secNetMassChangeKg: 0.0,
    makeupCumulativeVolumeL: 0.0,
    makeupActiveTimerS: 0.0,
    makeupLockedOut: false,
    makeupValveOpen: false,
    psvOpen: false,
    psvReliefFlowKgS: 0.0,
    overpressurePumpTripped: false,
    maxRoofGaugePa: 0.0,
    maxConsumerSupplyGaugeBottomPa: null,
    maxLoopGaugePa: 0.0,
    uSecLoopJ: 0.0,
    sensorValid: true
  }));

  const state = {
    simTimeSeconds: 0.0,
    stepCount: 0,
    seed,
    rng: createSeededRng(seed),
    sensorNoiseEnabled: false,
    staleResultsFlag: false,
    activeScenarioId: 'SCEN_01_NORMAL',

    // Commands & Sequences
    plantStartCommand: true,
    shutdownMode: SHUTDOWN_MODES.NONE,
    symbioStep: SYMBIO_STARTUP_STEPS.STEP_8_RUNNING_MODULATING,
    symbioStepTimerS: 30.0,
    flowSwitchClosed: true,
    flowLossTimerS: 0.0,
    unloadTimerS: 0.0,
    inDefrost: false,

    // HP01 Dynamic State
    hp01: {
      enteringWaterTempC: 40.4,
      leavingWaterTempC: 50.0,
      plrCommand: 0.89,
      plrActual: 0.89,
      piController: { integral: 0.89, error: 0.0, output: 0.89 },
      qWaterHeatingW: 552000.0,
      qAirAbsorbedW: 375000.0,
      pElTotalW: 180000.0,
      pElCompressorsW: 158000.0,
      pElFansW: 21240.0,
      instantaneousUnitCOP: 3.07,
      outOfMap: false,
      inPage48To50AmbiguityZone: false,
      outOfMapReasons: [],
      refrigerantCycle: null,
      uWaterShellJ: 320.0 * THERMAL_REF_CONSTANTS.cpWaterJKgK * 50.0
    },

    // Buffer Tank BT01 Dynamic State
    bt01: {
      topTempC: 49.9,
      mid1TempC: 46.7,
      mid2TempC: 43.6,
      bottomTempC: 40.4,
      distSupplyTempC: 49.9,
      hpReturnTempC: 40.4,
      qLossTotalW: 530.0,
      dUdtW: 0.0,
      uTotalJ: 0.0
    },

    // Primary Loop & Distribution Control
    primaryLoop: {
      netMassChangeKg: 0.0,
      makeupCumulativeVolumeL: 0.0,
      makeupValveOpen: false,
      psvOpen: false,
      psvReliefFlowKgS: 0.0,
      pdPiController: { integral: 0.88, error: 0.0, output: 0.88 }
    },

    // Water Treatment WT01
    wt01: {
      dosingPumpActive: true,
      dosingBlockedReasonRu: null,
      dosingBlockedReasonHe: null
    },

    pumps,
    branches,
    hydraulics: null,

    // Active & Latched Alarms
    alarms: [],

    // Energy & COP Integrators (Section 9.4 & 9.10 — strictly separating kW and kWh!)
    energyTotals: {
      hpThermalDeliveredJ: 0.0,
      consumersUsefulHeatJ: 0.0,
      consumersFinalHeatExtractedJ: 0.0,
      bufferEnergyChangeJ: 0.0,
      hxEnergyChangeJ: 0.0,
      secondaryLoopEnergyChangeJ: 0.0,
      thermalLossesJ: 0.0,
      secondaryAmbientLossesJ: 0.0,
      hpElectricEnergyJ: 0.0,
      pumpsAuxElectricEnergyJ: 0.0,
      totalPlantElectricEnergyJ: 0.0,
      initialStoredEnergyJ: null,
      currentStoredEnergyJ: null,
      initialSecondaryStoredEnergyJ: null,
      currentSecondaryStoredEnergyJ: null,
      netBalanceMismatchJ: 0.0,
      referenceEnergyScaleJ: 1.0,
      integralEnergyResidualRatio: 0.0,
      secondaryEnergyResidualRatio: 0.0
    },

    // Time-series history for technician trend charts
    history: []
  };

  const sim = {
    components,
    connections,
    dataset,
    missingDataReport,
    state,
    faults: {}
  };

  // Run one initial evaluation at dt = 0.01s to populate hydraulics, cycle, and initial stored energy
  stepPlantSimulation(sim, 0.01, false);
  sim.state.simTimeSeconds = 0.0;
  sim.state.stepCount = 0;
  sim.state.energyTotals.hpThermalDeliveredJ = 0.0;
  sim.state.energyTotals.consumersUsefulHeatJ = 0.0;
  sim.state.energyTotals.consumersFinalHeatExtractedJ = 0.0;
  sim.state.energyTotals.bufferEnergyChangeJ = 0.0;
  sim.state.energyTotals.hxEnergyChangeJ = 0.0;
  sim.state.energyTotals.secondaryLoopEnergyChangeJ = 0.0;
  sim.state.energyTotals.thermalLossesJ = 0.0;
  sim.state.energyTotals.secondaryAmbientLossesJ = 0.0;
  sim.state.energyTotals.hpElectricEnergyJ = 0.0;
  sim.state.energyTotals.pumpsAuxElectricEnergyJ = 0.0;
  sim.state.energyTotals.totalPlantElectricEnergyJ = 0.0;
  sim.state.energyTotals.initialStoredEnergyJ = computeTotalStoredThermalEnergyJ(sim);
  sim.state.energyTotals.currentStoredEnergyJ = sim.state.energyTotals.initialStoredEnergyJ;
  sim.state.energyTotals.initialSecondaryStoredEnergyJ = computeTotalSecondaryStoredEnergyJ(sim);
  sim.state.energyTotals.currentSecondaryStoredEnergyJ = sim.state.energyTotals.initialSecondaryStoredEnergyJ;
  sim.state.energyTotals.netBalanceMismatchJ = 0.0;
  sim.state.energyTotals.integralEnergyResidualRatio = 0.0;
  sim.state.energyTotals.secondaryEnergyResidualRatio = 0.0;
  for (let i = 0; i < 5; i++) {
    const b = sim.state.branches[i];
    const secHyd = sim.state.hydraulics.secondaryLoops[i];
    b.maxRoofGaugePa = secHyd.maxRoofGaugePa;
    b.maxConsumerSupplyGaugeBottomPa = secHyd.consumerSupplyGaugeBottomPa;
    b.maxLoopGaugePa = secHyd.maxLoopGaugePa;
  }
  sim.state.history = [];

  return sim;
}

/**
 * Computes total stored thermal energy U_stored [J] in HP01 water shell + BT01 + 5 HXs for integral energy verification.
 */
export function computeTotalStoredThermalEnergyJ(sim) {
  const { state } = sim;
  let uSumJ = (state.hp01.uWaterShellJ || 0.0) + (state.bt01.uTotalJ || 0.0);
  for (const b of state.branches) {
    uSumJ += b.hxState.uTotalJ || 0.0;
  }
  return uSumJ;
}

/**
 * Computes total stored thermal energy U_sec [J] in the 5 secondary consumer water loops.
 */
export function computeTotalSecondaryStoredEnergyJ(sim) {
  const { state } = sim;
  let uSecSumJ = 0.0;
  for (const b of state.branches) {
    uSecSumJ += b.uSecLoopJ || 0.0;
  }
  return uSecSumJ;
}

/**
 * Advances the entire plant simulation by a requested wall/sim delta time `requestedDtSeconds`.
 * Uses a deterministic fixed-timestep physics accumulator (`fixedStepSeconds = 0.05` s by default)
 * so that any UI frame rate (e.g. 20 FPS, 30 FPS, 60 FPS, 120 FPS in requestAnimationFrame)
 * produces bit-for-bit identical physical state trajectories! (Section 12.4 & Section 15 acceptance check).
 */
export function advanceSimulationTime(sim, requestedDtSeconds, fixedStepSeconds = 0.05) {
  if (requestedDtSeconds <= 0) return sim.state;
  const h = Math.max(0.001, fixedStepSeconds);
  sim.state.physicsAccumulatorS = (sim.state.physicsAccumulatorS || 0.0) + requestedDtSeconds;
  const eps = 1e-11;
  while (sim.state.physicsAccumulatorS + eps >= h) {
    const remainingAfter = sim.state.physicsAccumulatorS - h;
    const isLast = remainingAfter + eps < h;
    stepPlantSimulation(sim, h, isLast);
    sim.state.physicsAccumulatorS = Math.max(0.0, remainingAfter);
  }
  return sim.state;
}

/**
 * Single physics & automation integration step of duration `dt` [s].
 */
export function stepPlantSimulation(sim, dt, recordHistory = true) {
  const { dataset, state, faults } = sim;
  const powerAvailable = state.shutdownMode !== SHUTDOWN_MODES.TOTAL_POWER_LOSS && !faults.powerOutageWinter;
  const tAmbC = dataset.ambient.temperatureC.value;
  const rhPct = dataset.ambient.relativeHumidityPct.value;

  // Keep existing latching alarms that have not been reset; clear auto-reset alarms for fresh evaluation
  const latchedAlarmsMap = new Map();
  for (const alm of state.alarms) {
    if (alm.latching && !alm.resetCompleted) {
      latchedAlarmsMap.set(alm.id, alm);
    }
  }
  const currentAlarmsMap = new Map(latchedAlarmsMap);

  function raiseAlarm(almObj) {
    const existing = currentAlarmsMap.get(almObj.id);
    if (existing) {
      existing.activeCondition = true;
      return;
    }
    currentAlarmsMap.set(almObj.id, {
      ...almObj,
      timestampS: state.simTimeSeconds,
      acknowledged: false,
      activeCondition: true,
      resetCompleted: false
    });
  }

  // Mark activeCondition = false initially for latched alarms; if still present, raiseAlarm will set it true
  for (const alm of currentAlarmsMap.values()) {
    alm.activeCondition = false;
  }

  // --- 0. Winter Power Outage Protection Check (Section 6, 10.4, 11) ---
  if (!powerAvailable) {
    if (tAmbC <= 2.8) {
      raiseAlarm({
        id: 'ALM-WINTER-POWER-LOSS-FREEZE',
        severity: 'CRITICAL',
        latching: true,
        componentId: 'HP01',
        titleHe: 'סכנת קפיאה חמורה! אובדן מתח בחורף — חימום נגד קפיאה ומשאבות מושבתים (עמ׳ 33, 57)',
        titleRu: 'КРИТИЧЕСКИЙ РИСК ЗАМЕРЗАНИЯ! Пропадание питания зимой: отключены насосы Symbio 800 и электрообогрев 230 В (стр. 33, 57)'
      });
    } else {
      raiseAlarm({
        id: 'ALM-TOTAL-POWER-LOSS',
        severity: 'CRITICAL',
        latching: false,
        componentId: 'CP01',
        titleHe: 'אובדן הזנת חשמל ראשית למתקן',
        titleRu: 'Полное исчезновение электропитания установки'
      });
    }
  }

  // --- 1. Evaluate Plant Hydraulics first to get current flows and pressures ---
  const hydBefore = solvePlantHydraulics({ dataset, state, faults });

  // --- 2. Update 1+1 Pump Groups & Redundancy State Machines (Section 5.1 & 10.3) ---
  const needPrimaryPump =
    powerAvailable &&
    (state.plantStartCommand ||
      state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_9_UNLOADING_STOP ||
      tAmbC <= 3.5); // Symbio 800 anti-freeze circulation in low ambient (p. 32–33)

  updatePumpGroupRedundancy({
    groupName: 'PP01A/B',
    pumpA: state.pumps.PP01A,
    pumpB: state.pumps.PP01B,
    groupDemandOn: needPrimaryPump,
    targetSpeedRatio: 1.0,
    measuredFlowM3S: hydBefore.ppResult.flowM3S,
    minExpectedFlowM3S: 0.0153,
    erroneousDualRun: Boolean(faults.erroneousDualPumpPP01),
    powerAvailable,
    dtSeconds: dt,
    raiseAlarm
  });

  // Check if any branch needs distribution flow
  const anyBranchOpen = state.branches.some((b, idx) => b.enabled && !faults[`branch${idx + 1}Isolated`] && b.cvActualPos > 0.01);
  const needDistPump = powerAvailable && state.plantStartCommand && anyBranchOpen;

  // PI Controller for Distribution Pump PD01A/B VFD speed ratio to maintain Δp_manifold
  let pdTargetSpeed = 0.55;
  if (needDistPump) {
    pdTargetSpeed = stepPIController({
      piState: state.primaryLoop.pdPiController,
      setpoint: dataset.primaryLoop.distDeltaPSetpointPa.value,
      measurement: hydBefore.manifoldDeltaPPa,
      kp: 2.2e-6,
      ki: 1.5e-6,
      outMin: 0.38,
      outMax: 1.0,
      maxRatePerSec: 0.20,
      dtSeconds: dt
    });
  }

  updatePumpGroupRedundancy({
    groupName: 'PD01A/B',
    pumpA: state.pumps.PD01A,
    pumpB: state.pumps.PD01B,
    groupDemandOn: needDistPump,
    targetSpeedRatio: pdTargetSpeed,
    measuredFlowM3S: hydBefore.pdResult.flowM3S,
    minExpectedFlowM3S: anyBranchOpen ? 0.001 : 0.0,
    erroneousDualRun: Boolean(faults.erroneousDualPumpPD01),
    powerAvailable,
    dtSeconds: dt,
    raiseAlarm
  });

  // Update 5 secondary pump groups PS01A/B .. PS05A/B (including CP01 high-pressure pump interlock)
  for (let i = 1; i <= 5; i++) {
    const idx = `0${i}`;
    const bData = dataset.branches[i - 1];
    const bState = state.branches[i - 1];
    const secHydPrev = hydBefore.secondaryLoops[i - 1];
    const pLimitPa = bData.jacketMaxAllowablePressureGaugePa.value ?? 200000.0;
    const pBottomPrevPa = secHydPrev.consumerSupplyGaugeBottomPa ?? secHydPrev.maxRoofGaugePa;

    if (
      !faults.disableSecondaryOverpressurePumpTrip &&
      (pBottomPrevPa >= pLimitPa - 15000.0 ||
        secHydPrev.staticState.staticGaugeRoofPa >= bData.psvSetpointGaugeRoofPa.value)
    ) {
      bState.overpressurePumpTripped = true;
      raiseAlarm({
        id: `ALM-SEC${idx}-HIGH-PRESSURE-TRIP`,
        severity: 'CRITICAL',
        latching: false,
        componentId: `PS${idx}A`,
        titleHe: `הגנת לחץ גבוה במעגל משני ${i}: השבתת משאבת סחרור PS${idx} להגנת מעטפת הצרכן (≤ 2.0 בר)`,
        titleRu: `Защита от превышения давления во вторичном контуре ${i}: автоматическое отключение насоса PS${idx} для защиты рубашки потребителя (≤ 2.0 бар изб.)`
      });
    } else if (
      pBottomPrevPa < pLimitPa - 35000.0 &&
      secHydPrev.staticState.staticGaugeRoofPa < bData.psvSetpointGaugeRoofPa.value * 0.92 &&
      !faults[`muSec${i}FailOpen`] &&
      !faults[`hx0${i}InternalLeak`]
    ) {
      bState.overpressurePumpTripped = false;
    }

    const branchDemandOn =
      powerAvailable &&
      state.plantStartCommand &&
      bState.enabled &&
      !faults[`branch${i}Isolated`] &&
      !bState.overpressurePumpTripped;

    updatePumpGroupRedundancy({
      groupName: `PS${idx}A/B`,
      pumpA: state.pumps[`PS${idx}A`],
      pumpB: state.pumps[`PS${idx}B`],
      groupDemandOn: branchDemandOn,
      targetSpeedRatio: 1.0,
      measuredFlowM3S: hydBefore.secondaryLoops[i - 1].flowM3S,
      minExpectedFlowM3S: 0.002,
      erroneousDualRun: Boolean(faults[`erroneousDualPumpPS0${i}`]),
      powerAvailable,
      dtSeconds: dt,
      raiseAlarm
    });
  }

  // Re-solve hydraulics after pump commands update
  const hyd = solvePlantHydraulics({ dataset, state, faults });
  state.hydraulics = hyd;

  // --- 3. Flow Switch FS-HP01 & 6-Second Symbio 800 Debounce Logic (Page 31–32) ---
  const minFlowHp01M3S = 0.0153; // 15.3 L/s Table 4
  const physicalFlowPresent = hyd.ppResult.flowM3S >= minFlowHp01M3S && !faults.forceFlowSwitchOpen;
  state.flowSwitchClosed = physicalFlowPresent;

  if (!physicalFlowPresent && state.plantStartCommand && powerAvailable) {
    state.flowLossTimerS += dt;
    if (state.flowLossTimerS >= 6.0) {
      // Symbio 800 6-second delay on flow switch input (Page 32)
      raiseAlarm({
        id: 'ALM-HP01-LOSS-OF-FLOW',
        severity: 'CRITICAL',
        latching: true,
        componentId: 'HP01',
        titleHe: 'איבוד זרימה ב-RTXC (מפסק זרימה פתוח מעל 6 שניות — חימום נחסם, עמ׳ 32)',
        titleRu: 'Потеря протока через RTXC (< 15.3 л/с более 6 с по стр. 32) — запрет нагрева!'
      });
    }
  } else {
    state.flowLossTimerS = 0.0;
  }

  // --- 4. Symbio 800 Startup / Shutdown 8-Step Sequence (Section 10.1 & 10.4) ---
  const hasBlockingHpAlarm = Array.from(currentAlarmsMap.values()).some(
    (a) => a.componentId === 'HP01' && a.severity === 'CRITICAL' && !a.resetCompleted
  );

  if (!powerAvailable) {
    state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_0_STOPPED;
    state.hp01.plrActual = 0.0;
  } else if (state.shutdownMode === SHUTDOWN_MODES.EMERGENCY_COMPRESSOR_TRIP || hasBlockingHpAlarm) {
    state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_11_FAULT_LOCKOUT;
    state.hp01.plrActual = 0.0;
    if (state.shutdownMode === SHUTDOWN_MODES.EMERGENCY_COMPRESSOR_TRIP) {
      raiseAlarm({
        id: 'ALM-HP01-EMERGENCY-STOP',
        severity: 'CRITICAL',
        latching: true,
        componentId: 'HP01',
        titleHe: 'עצירת חירום למדחסי HP01 (מגע חירום W2 נפתח — דורש איפוס ידני, עמ׳ 42)',
        titleRu: 'Аварийный останов компрессоров HP01 (цепь Emergency Stop W2, стр. 42)'
      });
    }
  } else if (!state.plantStartCommand || state.shutdownMode === SHUTDOWN_MODES.NORMAL_STOP) {
    // Normal stop sequence: 20-second compressor unload before stopping (Page 57)
    if (state.hp01.plrActual > 0.01 && state.unloadTimerS < 20.0) {
      state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_9_UNLOADING_STOP;
      state.unloadTimerS += dt;
      state.hp01.plrActual = Math.max(0.15, state.hp01.plrActual * (1.0 - dt / 10.0));
    } else {
      state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_0_STOPPED;
      state.hp01.plrActual = 0.0;
    }
  } else {
    state.unloadTimerS = 0.0;
    // Check if all branches are closed and buffer is fully charged -> automatic standby by no demand!
    const lwtSetC = dataset.hp01.leavingWaterTempSetpointC.value;
    if (!anyBranchOpen && state.bt01.topTempC >= lwtSetC + 0.8 && state.bt01.bottomTempC >= lwtSetC - 0.5) {
      state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_10_STANDBY_NO_LOAD;
      state.hp01.plrActual = 0.0;
    } else {
      // Progress through the 8 mandatory startup verification steps (Section 10.1)
      state.symbioStepTimerS += dt;
      const oilPreheated = dataset.hp01.oilSumpPreheatedHours.value >= 12.0;
      const priPressureOk = hyd.primaryStatic.staticGaugeRoofPa >= 60000.0;

      if (state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_0_STOPPED || state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_10_STANDBY_NO_LOAD) {
        state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_1_SENSOR_CHECK;
        state.symbioStepTimerS = 0.0;
      } else if (state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_1_SENSOR_CHECK && state.symbioStepTimerS >= 1.0) {
        state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_2_EQUIPMENT_READY;
        state.symbioStepTimerS = 0.0;
      } else if (state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_2_EQUIPMENT_READY) {
        if (!oilPreheated) {
          raiseAlarm({
            id: 'ALM-HP01-OIL-PREHEAT',
            severity: 'CRITICAL',
            latching: false,
            componentId: 'HP01',
            titleHe: 'חימום מוקדם של שמן מדחס פחות מ-12 שעות (עמ׳ 53, 56)',
            titleRu: 'Запрет пуска: предпрогрев масла картера менее 12 часов (стр. 53, 56)'
          });
        } else if (state.symbioStepTimerS >= 1.0) {
          state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_3_PRESSURE_PATH_CHECK;
          state.symbioStepTimerS = 0.0;
        }
      } else if (state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_3_PRESSURE_PATH_CHECK && priPressureOk && state.symbioStepTimerS >= 1.0) {
        state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_4_PUMP_START;
        state.symbioStepTimerS = 0.0;
      } else if (state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_4_PUMP_START && hyd.ppResult.running && state.symbioStepTimerS >= 1.0) {
        state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_5_FLOW_PROOF;
        state.symbioStepTimerS = 0.0;
      } else if (state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_5_FLOW_PROOF && state.flowSwitchClosed && hyd.ppResult.flowM3S >= minFlowHp01M3S && state.symbioStepTimerS >= 1.5) {
        state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_6_UNIT_ENABLE;
        state.symbioStepTimerS = 0.0;
      } else if (state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_6_UNIT_ENABLE && state.symbioStepTimerS >= 1.0) {
        state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_7_COMPRESSOR_CONFIRM;
        state.symbioStepTimerS = 0.0;
      } else if (state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_7_COMPRESSOR_CONFIRM && state.symbioStepTimerS >= 1.5) {
        state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_8_RUNNING_MODULATING;
        state.symbioStepTimerS = 0.0;
      }
    }
  }

  // --- 5. Evaluate RTXC Heat Pump Performance & Water Outlet Temperature ---
  const lwtSetpointC = dataset.hp01.leavingWaterTempSetpointC.value;
  let hpPlrCommand = 0.0;
  if (state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_7_COMPRESSOR_CONFIRM) {
    hpPlrCommand = 0.20;
  } else if (state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_8_RUNNING_MODULATING) {
    hpPlrCommand = stepPIController({
      piState: state.hp01.piController,
      setpoint: lwtSetpointC,
      measurement: state.hp01.leavingWaterTempC,
      kp: 0.14,
      ki: 0.035,
      outMin: 0.15,
      outMax: 1.0,
      maxRatePerSec: 0.08,
      dtSeconds: dt
    });
  } else if (state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_9_UNLOADING_STOP) {
    hpPlrCommand = state.hp01.plrActual;
  }

  state.hp01.plrCommand = hpPlrCommand;

  const hpEval = evaluateRtxcHeatPump({
    outdoorAirTempC: tAmbC,
    relativeHumidityPct: rhPct,
    enteringWaterTempC: state.bt01.hpReturnTempC,
    leavingWaterTempC: state.hp01.leavingWaterTempC,
    waterFlowM3S: hyd.ppResult.flowM3S,
    compressorLoadCommand0to1: hpPlrCommand,
    inDefrost: Boolean(state.inDefrost || faults.forceDefrost),
    strictPage48Limit: Boolean(dataset.ambient.strictPage48AmbientLimit.value)
  });

  if (hpEval.inPage48To50AmbiguityZone) {
    raiseAlarm({
      id: 'ALM-HP01-SUMMER-DOC-DISCREPANCY',
      severity: 'WARNING',
      latching: false,
      componentId: 'HP01',
      titleHe: `אזהרת מעטפת קיץ (${tAmbC.toFixed(1)}°C): סתירה במדריך Trane בין עמ׳ 48 (מקס׳ 21°C) לעמ׳ 50 (מקס׳ 30°C)`,
      titleRu: `Внимание (п. 3.1 ТЗ): T_нар = ${tAmbC.toFixed(1)} °C находится в зоне противоречия руководства RTXC (стр. 48: макс. 21 °C vs стр. 50: макс. 30 °C)`
    });
  }

  if (hpEval.outOfMap) {
    raiseAlarm({
      id: 'ALM-HP01-OUT-OF-MAP',
      severity: 'CRITICAL',
      latching: false,
      componentId: 'HP01',
      titleHe: `מחוץ למעטפת העבודה המאושרת של RTXC (${tAmbC.toFixed(1)}°C) — החימום מוגבל ללא אקסטרפולציה!`,
      titleRu: hpEval.outOfMapReasons.join('; ')
    });
  }

  // Update HP01 water outlet temperature with falling-film shell water capacitance (220 L water + shell metal)
  // F01 fix: Use consistent reference density/cp and start-of-step temperatures so advective heat transfer
  // between HP01 and BT01 telescopes identically!
  const cpPri = THERMAL_REF_CONSTANTS.cpWaterJKgK;
  const rhoPri = THERMAL_REF_CONSTANTS.rhoPrimaryKgM3;
  const cpSec = THERMAL_REF_CONSTANTS.cpWaterJKgK;
  const rhoSec = THERMAL_REF_CONSTANTS.rhoSecondaryKgM3;

  const mDotHpKgS = hyd.ppResult.flowM3S * rhoPri;
  const cHpShellJK = 320.0 * cpPri;
  const tHpInPrevC = state.bt01.hpReturnTempC;
  const tHpOutPrevC = state.hp01.leavingWaterTempC;
  const dQHpShellW =
    mDotHpKgS * cpPri * (tHpInPrevC - tHpOutPrevC) + hpEval.qWaterHeatingW;
  const nextHpOutC = tHpOutPrevC + (dQHpShellW * dt) / cHpShellJK;

  state.hp01.enteringWaterTempC = tHpInPrevC;
  state.hp01.leavingWaterTempC = nextHpOutC;
  state.hp01.uWaterShellJ = cHpShellJK * nextHpOutC;
  state.hp01.running = hpEval.running;
  state.hp01.plrActual = hpEval.plrActual;
  state.hp01.qWaterHeatingW = hpEval.qWaterHeatingW;
  state.hp01.qAirAbsorbedW = hpEval.qAirAbsorbedW;
  state.hp01.pElTotalW = hpEval.pElTotalW;
  state.hp01.pElCompressorsW = hpEval.pElCompressorsW;
  state.hp01.pElFansW = hpEval.pElFansW;
  state.hp01.instantaneousUnitCOP = hpEval.instantaneousUnitCOP;
  state.hp01.outOfMap = hpEval.outOfMap;
  state.hp01.inPage48To50AmbiguityZone = hpEval.inPage48To50AmbiguityZone;
  state.hp01.outOfMapReasons = hpEval.outOfMapReasons;
  state.hp01.refrigerantCycle = hpEval.refrigerantCycle;

  // --- 6. Step Five Heat Exchange Modules HX01..HX05, Control Valves CV01..CV05 & Consumers צרכן 1..5 ---
  let sumBranchMassFlowPriKgS = 0.0;
  let sumBranchReturnEnthalpyFlowW = 0.0;
  let sumConsumersUsefulHeatW = 0.0;
  let sumConsumersFinalExtractedW = 0.0;
  let sumPipeSupplyAmbientLossW = 0.0;
  let sumHxAmbientLossW = 0.0;
  let sumSecAmbientLossW = 0.0;
  let sumPrimaryCrossLeakMassKgS = 0.0;

  const tBtTopPrevC = state.bt01.distSupplyTempC;
  const baroPa = dataset.ambient.barometricPressurePa.value;

  for (let i = 1; i <= 5; i++) {
    const idx = `0${i}`;
    const bData = dataset.branches[i - 1];
    const bState = state.branches[i - 1];
    const bHyd = hyd.branchHydraulics[i - 1];
    const secHyd = hyd.secondaryLoops[i - 1];

    // Check sensor validity fault (Section 11: "Потеря связи с датчиком — «Неизвестно», запрет использования старого значения как текущего")
    const sensorFault = Boolean(faults[`sensorFaultBranch${i}`]);
    bState.sensorValid = !sensorFault;

    if (sensorFault) {
      raiseAlarm({
        id: `ALM-SENS-BR0${i}`,
        severity: 'CRITICAL',
        latching: false,
        componentId: `CV${idx}`,
        titleHe: `תקלת תקשורת ברגש טמפרטורה TT-SEC${idx}-SUP (ערך ״לא ידוע״ — נאסר שימוש בערך ישן!)`,
        titleRu: `Обрыв датчика температуры TT-SEC${idx}-SUP ветки ${i}: статус «Неизвестно», использование старого значения для ПИ-регулятора запрещено!`
      });
    }

    // Update CV0i position command and actuator lag
    if (!powerAvailable) {
      // Power loss: actuators freeze in place
    } else if (!bState.enabled || faults[`branch${i}Isolated`]) {
      bState.cvCommandPos = 0.0;
      const maxMove = 0.25 * dt;
      bState.cvActualPos = Math.max(0.0, bState.cvActualPos - maxMove);
    } else if (sensorFault) {
      // Sensor invalid: do NOT feed stale temperature to PI controller! Hold safe fallback position
      bState.cvCommandPos = 0.35;
      const diff = bState.cvCommandPos - bState.cvActualPos;
      bState.cvActualPos += Math.sign(diff) * Math.min(Math.abs(diff), 0.15 * dt);
    } else {
      const targetSecTempC = bData.secondarySupplyTempSetpointC.value;
      bState.cvCommandPos = stepPIController({
        piState: bState.piController,
        setpoint: targetSecTempC,
        measurement: bState.secSupplyTempC,
        kp: 0.095,
        ki: 0.028,
        outMin: 0.0,
        outMax: 1.0,
        maxRatePerSec: 0.18,
        dtSeconds: dt
      });
      // Actuator travel dynamics
      const diff = bState.cvCommandPos - bState.cvActualPos;
      bState.cvActualPos += Math.sign(diff) * Math.min(Math.abs(diff), 0.22 * dt);
    }

    // Consistent primary & secondary mass flows for conservative thermal integration
    const mDotBranchPriKgS = bHyd.flowM3S * rhoPri;
    const mDotBranchSecKgS = secHyd.flowM3S * rhoSec;

    // Local primary supply temperature entering HX0i (accounting for supply pipe ambient loss along collector run)
    const pipeLossRunK =
      mDotBranchPriKgS > 0.1
        ? Math.min(0.4, (18.0 * Math.max(0.0, tBtTopPrevC - tAmbC)) / (mDotBranchPriKgS * cpPri))
        : 0.0;
    const tHotInLocalC = tBtTopPrevC - pipeLossRunK;
    const qPipeSupplyLossW = mDotBranchPriKgS * cpPri * (tBtTopPrevC - tHotInLocalC);
    sumPipeSupplyAmbientLossW += qPipeSupplyLossW;

    const foulRf = (bData.hxFoulingResistanceM2KW.value || 0.0) + (faults[`hx0${i}Fouled`] ? 0.00038 : 0.0);

    const hxStep = stepTransientHeatExchanger({
      hxState: bState.hxState,
      mDotHotKgS: mDotBranchPriKgS,
      cpHotJKgK: cpPri,
      tHotInC: tHotInLocalC,
      mDotColdKgS: mDotBranchSecKgS,
      cpColdJKgK: cpSec,
      tColdInC: bState.secReturnTempC,
      nominalUAWK: bData.hxNominalUA.value,
      areaM2: bData.hxHeatTransferAreaM2.value,
      foulingResistanceM2KW: foulRf,
      metalMassKg: bData.hxMetalMassKg.value,
      waterVolumePerSideM3: bData.hxWaterVolumePerSideM3.value,
      ambientTempC: tAmbC,
      dtSeconds: dt
    });

    bState.hxState = hxStep;
    bState.secSupplyTempC = hxStep.tColdOutC;
    sumHxAmbientLossW += hxStep.qAmbientLossW;
    sumBranchMassFlowPriKgS += mDotBranchPriKgS;
    sumBranchReturnEnthalpyFlowW += mDotBranchPriKgS * cpPri * hxStep.tHotOutC;

    // Fouling diagnostic alarm
    if (foulRf > 0.00015 && bHyd.flowM3S > 0.001) {
      raiseAlarm({
        id: `ALM-HX${idx}-FOULED`,
        severity: 'WARNING',
        latching: false,
        componentId: `HX${idx}`,
        titleHe: `עליית התנגדות הידראולית וירידת מקדם העברת חום ב-HX${idx} (חשד להתאבנות/סתימה)`,
        titleRu: `Рост перепада давления и снижение коэффициента теплопередачи UA на HX${idx} (загрязнение аппарата)`
      });
    }

    // Step External Consumer i Load Model (Section 9.6 — 4 Load Types) with conservative finite-volume secondary water balance
    const loadScale = faults[`branch${i}LoadMultiplier`] ?? bState.loadScaleFactor ?? 1.0;
    const nominalLoadW = bData.nominalThermalDemandW.value * loadScale;
    const cSecLoopJK = Math.max(50000.0, bData.secondaryWaterVolumeM3.value * rhoSec * cpSec);
    const tSecRetPrevC = bState.secReturnTempC;

    let qExtractedByConsumerW = 0.0;
    const loadType = bData.loadModelType.value;

    if (mDotBranchSecKgS > 1e-4) {
      if (loadType === CONSUMER_LOAD_TYPES.PRESCRIBED_POWER) {
        qExtractedByConsumerW = Math.min(
          nominalLoadW,
          mDotBranchSecKgS * cpSec * Math.max(0.0, bState.secSupplyTempC - 18.0)
        );
      } else if (loadType === CONSUMER_LOAD_TYPES.THERMAL_MASS) {
        // If SITE mode has missing jacketUA or processTargetTempC, block core chocolate temp calculation,
        // while keeping water-side jacket load solvable from nominal demand
        if (bData.jacketUA.value !== null && bState.processCoreTempC !== null) {
          const uaJacket = bData.jacketUA.value;
          const qJacketToProdW = uaJacket * (0.5 * (bState.secSupplyTempC + tSecRetPrevC) - bState.processCoreTempC);
          const qProdAmbientLossW = nominalLoadW * 0.92;
          const cProdJK = bData.processThermalMassJK.value;
          bState.processCoreTempC += ((qJacketToProdW - qProdAmbientLossW) * dt) / cProdJK;
          qExtractedByConsumerW = Math.max(0.0, qJacketToProdW);
        } else {
          bState.processCoreTempC = null;
          qExtractedByConsumerW = nominalLoadW;
        }
      } else if (loadType === CONSUMER_LOAD_TYPES.FLOW_PROCESS) {
        qExtractedByConsumerW = nominalLoadW * (0.85 + 0.15 * Math.sin(state.simTimeSeconds * 0.02 + i));
      } else {
        // COMBINED load
        qExtractedByConsumerW = nominalLoadW;
      }
    } else {
      qExtractedByConsumerW = 0.0;
    }

    // Secondary loop ambient heat loss and internal leak enthalpy transfer:
    const qSecAmbientLossW = 15.0 * (tSecRetPrevC - tAmbC);

    // --- 7. Single-Pass Mass & Enthalpy Accounting for Secondary Loop i (F02 & F03 fix) ---
    // 7a. External leak in secondary loop i:
    const leakRateKgS = Math.max(0.0, Number(faults[`secLoop${i}LeakKgS`] || 0.0));

    // 7b. Internal HX tube/plate leak between Primary and Secondary loop i:
    let crossLeakKgS = 0.0;
    let qCrossLeakToSecW = 0.0;
    if (faults[`hx0${i}InternalLeak`]) {
      const pPriAtHxPa = hyd.priSupplyHeaderGaugePa - 0.5 * bHyd.hxPriDeltaPPa;
      const pSecAtHxPa = secHyd.secSupplyGaugeRoofPa;
      const dpCrossPa = pPriAtHxPa - pSecAtHxPa;
      crossLeakKgS = Math.sign(dpCrossPa) * 0.08 * Math.sqrt(Math.abs(dpCrossPa) / 10000.0);
      sumPrimaryCrossLeakMassKgS += crossLeakKgS;
      const tCrossFluidC = crossLeakKgS >= 0.0 ? tHotInLocalC : bState.secSupplyTempC;
      qCrossLeakToSecW = crossLeakKgS * cpSec * (tCrossFluidC - tSecRetPrevC);
      raiseAlarm({
        id: `ALM-HX${idx}-INTERNAL-LEAK`,
        severity: 'CRITICAL',
        latching: true,
        componentId: `HX${idx}`,
        titleHe: `דליפה פנימית ב-HX${idx}! מעבר לחץ וערבוב מים מהמעגל הראשוני למעגל המשני ${i}`,
        titleRu: `Внутренняя негерметичность HX${idx}: передача повышенного давления из первичного контура во вторичный контур ${i} и смешение сред!`
      });
    }

    // Update secondary water return temperature conservatively:
    // cSecLoopJK * dT_ret/dt = qSecondaryReceivedW + qCrossLeakToSecW - qExtractedByConsumerW - qSecAmbientLossW
    const dQSecLoopW = hxStep.qSecondaryReceivedW + qCrossLeakToSecW - qExtractedByConsumerW - qSecAmbientLossW;
    bState.secReturnTempC = tSecRetPrevC + (dQSecLoopW * dt) / cSecLoopJK;
    bState.uSecLoopJ = cSecLoopJK * bState.secReturnTempC;

    sumConsumersUsefulHeatW += hxStep.qSecondaryReceivedW;
    sumConsumersFinalExtractedW += qExtractedByConsumerW - qCrossLeakToSecW;
    sumSecAmbientLossW += qSecAmbientLossW;

    // 7c. Controlled Makeup MU01 & Fail-Open logic for Secondary Loop i (counted ONCE! — F03 & R2-04):
    // Strictly separate mechanical valve state (makeupValveOpen) from makeup pressure source availability
    // (makeupPumpAvailable). MU01 incorporates an atmospheric break tank (air gap / разрыв струи, Section 7 ТЗ)
    // at roof datum (z = 0 m), a makeup booster pump, pressure reducer, water meter, and check valve (обратный клапан).
    // Without electrical power or when the makeup pump is off/faulted, gauge pressure downstream of the break tank is 0 Pa(g).
    // The check valve prevents reverse flow from the loop into the makeup line; positive fillKgS occurs ONLY when
    // makeupValveOpen === true AND pMakeupSourceGaugePa > pLoopSuctionGaugePa.
    const muTargetPa = dataset.waterChemistryAndMakeup.makeupRegulatedTargetGaugePa.value;
    const muMaxVolL = dataset.waterChemistryAndMakeup.makeupMaxSingleVolumeL.value;
    const muMaxDurS = dataset.waterChemistryAndMakeup.makeupMaxDurationS.value;
    const muFailOpen = Boolean(faults[`muSec${i}FailOpen`]);
    const makeupPumpAvailable =
      powerAvailable &&
      !faults.makeupPumpFault &&
      !faults.mu01PumpOff;
    const unpoweredBreakTankHeadPa = Math.max(0.0, Number(faults.makeupGravityHeadAfterBreakTankPa ?? 0.0));
    const pLoopSuctionGaugePa = secHyd.psSuctionGaugeRoofPa;
    const makeupProps = getWaterProperties(15.0, baroPa + Math.max(0.0, pLoopSuctionGaugePa), 0.0);

    let pMakeupSourceGaugePa = unpoweredBreakTankHeadPa;
    if (makeupPumpAvailable) {
      pMakeupSourceGaugePa = muFailOpen
        ? dataset.waterChemistryAndMakeup.makeupPumpMaxGaugePa.value
        : muTargetPa;
    }

    let fillKgS = 0.0;
    if (muFailOpen) {
      // Valve is mechanically stuck open, but flow requires positive driving pressure (p_makeup_source > p_loop_suction)
      // across the check valve!
      bState.makeupValveOpen = true;
      const dpMu = Math.max(0.0, pMakeupSourceGaugePa - pLoopSuctionGaugePa);
      fillKgS = dpMu > 0.0 ? 0.22 * Math.sqrt(dpMu / 100000.0) : 0.0;
      if (makeupPumpAvailable) {
        raiseAlarm({
          id: `ALM-MU-SEC${idx}-FAIL-OPEN`,
          severity: 'CRITICAL',
          latching: true,
          componentId: `PSV${idx}`,
          titleHe: `כשל ברז מילוי פתוח במעגל משני ${i} — פתיחת שסתום פורק לחץ PSV${idx}!`,
          titleRu: `Отказ клапана подпитки вторичного контура ${i} в открытом положении — срабатывание независимой защиты PSV${idx}!`
        });
      }
    } else if (
      powerAvailable &&
      !bState.makeupLockedOut &&
      pLoopSuctionGaugePa < muTargetPa - 15000.0
    ) {
      bState.makeupValveOpen = true;
      const dpMu = Math.max(0.0, pMakeupSourceGaugePa - pLoopSuctionGaugePa);
      if (dpMu > 0.0) {
        bState.makeupActiveTimerS += dt;
        fillKgS = 0.12; // Controlled fill rate ~0.12 kg/s when makeup pump pressure exceeds loop suction
      }
    } else {
      bState.makeupValveOpen = false;
      if (pLoopSuctionGaugePa >= muTargetPa - 5000.0) {
        bState.makeupActiveTimerS = 0.0;
      }
    }

    bState.makeupPumpAvailable = makeupPumpAvailable;
    bState.makeupSourceGaugePa = pMakeupSourceGaugePa;
    bState.makeupCheckValveForwardFlow = fillKgS > 0.0;
    bState.makeupFlowKgS = fillKgS;

    if (fillKgS > 0.0) {
      // F03 fix: Convert mass [kg] to volume [L] via cold makeup water density rho(T, p)
      const addedVolumeL = ((fillKgS * dt) / makeupProps.rho) * 1000.0;
      bState.makeupCumulativeVolumeL += addedVolumeL;
      if (!muFailOpen && (bState.makeupCumulativeVolumeL >= muMaxVolL || bState.makeupActiveTimerS >= muMaxDurS)) {
        bState.makeupLockedOut = true;
        bState.makeupValveOpen = false;
        raiseAlarm({
          id: `ALM-MU-SEC${idx}-LOCKOUT-LEAK`,
          severity: 'CRITICAL',
          latching: true,
          componentId: 'MU01',
          titleHe: `חסימת מילוי מים אוטומטי במעגל ${i} עקב חריגה מנפח/זמן מילוי מרבי (חשד לדליפה!)`,
          titleRu: `Защитная блокировка подпитки MU01 контура ${i} по превышению лимита объёма (${muMaxVolL} л) / длительности — подозрение на утечку!`
        });
      }
    }

    // 7d. Implicit L-stable PSV0i orifice relief & single-pass mass update:
    const netNonPsvMassFlowKgS = fillKgS + crossLeakKgS - leakRateKgS;
    const psvStep = solveImplicitPsvStep({
      currentGaugePa: secHyd.staticState.staticGaugeRoofPa,
      complianceKgPerPa: secHyd.staticState.effectiveComplianceKgPerPa,
      netNonPsvMassFlowKgS,
      psvSetpointGaugePa: bData.psvSetpointGaugeRoofPa.value,
      psvBackpressureGaugePa: faults[`psv0${i}BackpressurePa`] ?? 0.0,
      psvNominalFlowKgS: 1.85,
      psvCapacityScale: faults[`psv0${i}CapacityScale`] ?? 1.0,
      psvPreviouslyOpen: Boolean(bState.psvOpen || secHyd.staticState.psvOpen),
      rho: secHyd.fluidProps.rho,
      dtSeconds: dt
    });

    const psvNowOpen = Boolean(psvStep.psvOpen || secHyd.staticState.psvOpen);
    const effectivePsvReliefFlowKgS = psvStep.psvReliefFlowKgS;

    // Single-pass mass balance update for secondary loop i:
    bState.secNetMassChangeKg += (netNonPsvMassFlowKgS - effectivePsvReliefFlowKgS) * dt;
    bState.psvOpen = psvNowOpen;
    bState.psvReliefFlowKgS = effectivePsvReliefFlowKgS;

    if (psvNowOpen) {
      raiseAlarm({
        id: `ALM-PSV${idx}-OPEN`,
        severity: 'CRITICAL',
        latching: false,
        componentId: `PSV${idx}`,
        titleHe: `פתיחת שסתום פורק לחץ PSV${idx} להגנת מעגל משני ${i}`,
        titleRu: `Срабатывание предохранительного клапана PSV${idx} (сброс избыточного давления вторичного контура ${i})`
      });
    }

    // Low pressure alarm in secondary loop i
    if (secHyd.psSuctionGaugeRoofPa < 55000.0) {
      raiseAlarm({
        id: `ALM-SEC${idx}-LOW-PRESSURE`,
        severity: 'CRITICAL',
        latching: false,
        componentId: `ET${idx}`,
        titleHe: `לחץ נמוך במעגל משני ${i} (${(secHyd.psSuctionGaugeRoofPa / 1e5).toFixed(2)} בר)`,
        titleRu: `Низкое давление во вторичном контуре ${i} (${(secHyd.psSuctionGaugeRoofPa / 1e5).toFixed(2)} бар изб.)`
      });
    }
  }

  // Primary loop single-pass mass & PSV00 relief update:
  const priExternalLeakKgS = Math.max(0.0, Number(faults.primaryLoopLeakKgS || 0.0));
  const priNetNonPsvKgS = -sumPrimaryCrossLeakMassKgS - priExternalLeakKgS;
  const priPsvStep = solveImplicitPsvStep({
    currentGaugePa: hyd.primaryStatic.staticGaugeRoofPa,
    complianceKgPerPa: hyd.primaryStatic.effectiveComplianceKgPerPa,
    netNonPsvMassFlowKgS: priNetNonPsvKgS,
    psvSetpointGaugePa: dataset.primaryLoop.psv00SetpointGaugePa.value,
    psvBackpressureGaugePa: faults.psv00BackpressurePa ?? 0.0,
    psvNominalFlowKgS: 3.2,
    psvCapacityScale: faults.psv00CapacityScale ?? 1.0,
    psvPreviouslyOpen: Boolean(state.primaryLoop.psvOpen || hyd.primaryStatic.psvOpen),
    rho: hyd.primaryProps.rho,
    dtSeconds: dt
  });
  state.primaryLoop.netMassChangeKg += (priNetNonPsvKgS - priPsvStep.psvReliefFlowKgS) * dt;
  state.primaryLoop.psvOpen = Boolean(priPsvStep.psvOpen || hyd.primaryStatic.psvOpen);
  state.primaryLoop.psvReliefFlowKgS = priPsvStep.psvReliefFlowKgS;

  // --- 8. Step 4-Pipe Buffer Tank BT01 (Section 9.6) ---
  // F01 fix: Use start-of-step tHpOutPrevC and sumBranchMassFlowPriKgS so advective enthalpy flows
  // between HP01 <-> BT01 and BT01 <-> HX01..05 telescope identically!
  const mDotDistKgS = sumBranchMassFlowPriKgS;
  const tDistReturnMixedC =
    mDotDistKgS > 1e-9 ? sumBranchReturnEnthalpyFlowW / (mDotDistKgS * cpPri) : state.bt01.topTempC;

  const btNext = stepBufferTankBT01({
    btState: state.bt01,
    totalVolumeM3: 4.0,
    mDotHpKgS,
    tHpOutC: tHpOutPrevC,
    mDotDistKgS,
    tDistReturnC: tDistReturnMixedC,
    ambientTempC: tAmbC,
    cpWaterJKgK: cpPri,
    rhoWaterKgM3: rhoPri,
    dtSeconds: dt
  });
  state.bt01 = btNext;

  // Re-evaluate hydraulics at updated state so state.hydraulics reflects post-step PSV/mass state immediately
  state.hydraulics = solvePlantHydraulics({ dataset, state, faults });
  for (let i = 0; i < 5; i++) {
    const b = state.branches[i];
    const secHydNow = state.hydraulics.secondaryLoops[i];
    b.maxRoofGaugePa = Math.max(b.maxRoofGaugePa || 0.0, secHydNow.maxRoofGaugePa);
    if (secHydNow.consumerSupplyGaugeBottomPa !== null) {
      b.maxConsumerSupplyGaugeBottomPa =
        b.maxConsumerSupplyGaugeBottomPa === null
          ? secHydNow.consumerSupplyGaugeBottomPa
          : Math.max(b.maxConsumerSupplyGaugeBottomPa, secHydNow.consumerSupplyGaugeBottomPa);
    }
    b.maxLoopGaugePa = Math.max(b.maxLoopGaugePa || 0.0, secHydNow.maxLoopGaugePa);
    if (secHydNow.jacketPressureExceedsVerbal2Bar) {
      const idx = `0${i + 1}`;
      raiseAlarm({
        id: `ALM-SEC${idx}-JACKET-LIMIT-EXCEEDED`,
        severity: 'CRITICAL',
        latching: true,
        componentId: `CONS${idx}`,
        titleHe: `חריגת לחץ מעל גבול מעטפת צרכן ${i + 1} (מעל 2.0 בר) — בדיקת ספיקת PSV${idx}/לחץ נגדי!`,
        titleRu: `ПРЕВЫШЕНИЕ ПРЕДЕЛА ДАВЛЕНИЯ РУБАШКИ потребителя ${i + 1} (> 2.0 бар изб.: ${(secHydNow.maxLoopGaugePa / 1e5).toFixed(2)} бар изб.)!`
      });
    }
  }

  // --- 9. Water Treatment WT01 Dosing Interlock Logic (Section 7.2) ---
  const reagentLow = dataset.waterChemistryAndMakeup.reagentTankLevelPct.value <= 5.0 || Boolean(faults.wt01EmptyTank);
  const wtSensorInvalid =
    Boolean(faults.wt01SensorFault) ||
    dataset.waterChemistryAndMakeup.ph.value === null ||
    dataset.waterChemistryAndMakeup.conductivityUsCm.value === null;
  const priCirculating = hyd.ppResult.flowM3S >= 0.010;

  if (!powerAvailable || !priCirculating || reagentLow || wtSensorInvalid) {
    state.wt01.dosingPumpActive = false;
    if (reagentLow) {
      state.wt01.dosingBlockedReasonRu = 'Дозирование заблокировано: низкий уровень реагента в баке WT01';
      state.wt01.dosingBlockedReasonHe = 'מינון חסום: מפלס כימיקלים נמוך במיכל WT01';
    } else if (wtSensorInvalid) {
      state.wt01.dosingBlockedReasonRu = 'Дозирование заблокировано: нет данных анализа воды / недостоверность датчика';
      state.wt01.dosingBlockedReasonHe = 'מינון חסום: חסר נתון איכות מים או תקלת רגש';
    } else {
      state.wt01.dosingBlockedReasonRu = 'Дозирование заблокировано: отсутствует циркуляция воды';
      state.wt01.dosingBlockedReasonHe = 'מינון חסום: אין סחרור מים במעגל';
    }
  } else {
    state.wt01.dosingPumpActive = true;
    state.wt01.dosingBlockedReasonRu = null;
    state.wt01.dosingBlockedReasonHe = null;
  }

  // --- 10. Update Energy Integrators & COP Metrics (Section 9.4 & 9.10) ---
  let pumpsAuxElPowerW = hyd.ppResult.electricalPowerW + hyd.pdResult.electricalPowerW;
  for (const sLoop of hyd.secondaryLoops) {
    pumpsAuxElPowerW += sLoop.pumpResult.electricalPowerW;
  }
  const totalPlantElPowerW = state.hp01.pElTotalW + pumpsAuxElPowerW;

  state.energyTotals.hpThermalDeliveredJ += state.hp01.qWaterHeatingW * dt;
  state.energyTotals.consumersUsefulHeatJ += sumConsumersUsefulHeatW * dt;
  state.energyTotals.consumersFinalHeatExtractedJ += sumConsumersFinalExtractedW * dt;
  state.energyTotals.thermalLossesJ += (state.bt01.qLossTotalW + sumPipeSupplyAmbientLossW + sumHxAmbientLossW) * dt;
  state.energyTotals.secondaryAmbientLossesJ += sumSecAmbientLossW * dt;
  state.energyTotals.hpElectricEnergyJ += state.hp01.pElTotalW * dt;
  state.energyTotals.pumpsAuxElectricEnergyJ += pumpsAuxElPowerW * dt;
  state.energyTotals.totalPlantElectricEnergyJ += totalPlantElPowerW * dt;

  const currentStoredJ = computeTotalStoredThermalEnergyJ(sim);
  state.energyTotals.currentStoredEnergyJ = currentStoredJ;
  if (state.energyTotals.initialStoredEnergyJ === null) {
    state.energyTotals.initialStoredEnergyJ = currentStoredJ;
  }
  const deltaStoredJ = currentStoredJ - state.energyTotals.initialStoredEnergyJ;
  state.energyTotals.bufferEnergyChangeJ = deltaStoredJ;

  const currentSecStoredJ = computeTotalSecondaryStoredEnergyJ(sim);
  state.energyTotals.currentSecondaryStoredEnergyJ = currentSecStoredJ;
  if (state.energyTotals.initialSecondaryStoredEnergyJ === null) {
    state.energyTotals.initialSecondaryStoredEnergyJ = currentSecStoredJ;
  }
  const deltaSecStoredJ = currentSecStoredJ - state.energyTotals.initialSecondaryStoredEnergyJ;
  state.energyTotals.secondaryLoopEnergyChangeJ = deltaSecStoredJ;

  // F01 fix: Exact unclamped integral energy balance across the primary + HX boundary:
  // E_in_from_HP = E_delivered_to_secondary + E_losses + ΔU_stored
  // NO Math.min clamp and NO 0.01 multiplier!
  const referenceEnergyScaleJ = Math.max(
    1.0,
    Math.abs(state.energyTotals.hpThermalDeliveredJ) +
      Math.abs(state.energyTotals.consumersUsefulHeatJ) +
      Math.abs(state.energyTotals.thermalLossesJ) +
      Math.abs(deltaStoredJ)
  );
  const netBalanceMismatchJ =
    state.energyTotals.hpThermalDeliveredJ -
    (state.energyTotals.consumersUsefulHeatJ + state.energyTotals.thermalLossesJ + deltaStoredJ);

  state.energyTotals.netBalanceMismatchJ = netBalanceMismatchJ;
  state.energyTotals.referenceEnergyScaleJ = referenceEnergyScaleJ;
  state.energyTotals.integralEnergyResidualRatio = Math.abs(netBalanceMismatchJ) / referenceEnergyScaleJ;

  // Secondary consumer loop integral energy balance verification:
  const secReferenceScaleJ = Math.max(
    1.0,
    Math.abs(state.energyTotals.consumersUsefulHeatJ) +
      Math.abs(state.energyTotals.consumersFinalHeatExtractedJ) +
      Math.abs(state.energyTotals.secondaryAmbientLossesJ) +
      Math.abs(deltaSecStoredJ)
  );
  const secMismatchJ =
    state.energyTotals.consumersUsefulHeatJ -
    (state.energyTotals.consumersFinalHeatExtractedJ + state.energyTotals.secondaryAmbientLossesJ + deltaSecStoredJ);
  state.energyTotals.secondaryEnergyResidualRatio = Math.abs(secMismatchJ) / secReferenceScaleJ;

  // Instantaneous vs Period COP (Section 9.10: never show buffer discharge as compressor COP; guard zero denominator!)
  state.copMetrics = {
    unitInstantCOP: state.hp01.running && state.hp01.pElTotalW > 100 && state.hp01.qWaterHeatingW > 0
      ? state.hp01.qWaterHeatingW / state.hp01.pElTotalW
      : null,
    plantInstantEfficiency: state.hp01.qWaterHeatingW > 0 && totalPlantElPowerW > 100
      ? state.hp01.qWaterHeatingW / totalPlantElPowerW
      : null,
    periodPlantCOP: state.energyTotals.totalPlantElectricEnergyJ > 1000.0
      ? state.energyTotals.consumersUsefulHeatJ / state.energyTotals.totalPlantElectricEnergyJ
      : null,
    pumpsAuxElPowerW,
    totalPlantElPowerW,
    sumConsumersUsefulHeatW
  };

  state.alarms = Array.from(currentAlarmsMap.values());
  state.simTimeSeconds += dt;
  state.stepCount += 1;

  if (recordHistory) {
    state.history.push({
      t: +state.simTimeSeconds.toFixed(1),
      tHpOut: +state.hp01.leavingWaterTempC.toFixed(2),
      tBtTop: +state.bt01.topTempC.toFixed(2),
      tBtBot: +state.bt01.bottomTempC.toFixed(2),
      tSec1: +state.branches[0].secSupplyTempC.toFixed(2),
      tSec2: +state.branches[1].secSupplyTempC.toFixed(2),
      tSec3: +state.branches[2].secSupplyTempC.toFixed(2),
      tSec4: +state.branches[3].secSupplyTempC.toFixed(2),
      tSec5: +state.branches[4].secSupplyTempC.toFixed(2),
      qHpKw: +(state.hp01.qWaterHeatingW / 1000).toFixed(1),
      qConsKw: +(sumConsumersUsefulHeatW / 1000).toFixed(1),
      pElKw: +(totalPlantElPowerW / 1000).toFixed(1),
      T_hp_out: +state.hp01.leavingWaterTempC.toFixed(2),
      T_buf_top: +state.bt01.topTempC.toFixed(2),
      T_sec1_out: +state.branches[0].secSupplyTempC.toFixed(2)
    });
    if (state.history.length > 240) {
      state.history.shift();
    }
  }

  syncUIViewModel(sim);
  return state;
}

/**
 * Unconditionally L-stable Backward Euler solver for a loop's mass-pressure compliance + PSV orifice discharge over step `dtSeconds`:
 *   C_comp * (p_next - p_curr) / dt = mDot_net_in - mDot_psv(p_next)
 */
function solveImplicitPsvStep({
  currentGaugePa,
  complianceKgPerPa,
  netNonPsvMassFlowKgS,
  psvSetpointGaugePa,
  psvBackpressureGaugePa = 0.0,
  psvNominalFlowKgS = 1.85,
  psvCapacityScale = 1.0,
  psvPreviouslyOpen = false,
  rho = 990.0,
  dtSeconds
}) {
  const cComp = Math.max(1e-9, complianceKgPerPa);
  const pTrialNoPsv = currentGaugePa + (netNonPsvMassFlowKgS * dtSeconds) / cComp;

  const evalAtTrial = evaluatePsvOrificeDischarge({
    inletGaugePa: pTrialNoPsv,
    setpointGaugePa: psvSetpointGaugePa,
    backpressureGaugePa: psvBackpressureGaugePa,
    nominalFullLiftFlowKgSAtSet: psvNominalFlowKgS,
    capacityScale: psvCapacityScale,
    previouslyOpen: psvPreviouslyOpen,
    rho
  });

  if (!evalAtTrial.psvOpen || evalAtTrial.psvReliefFlowKgS <= 0.0) {
    return {
      psvOpen: false,
      psvReliefFlowKgS: 0.0,
      nextGaugePa: pTrialNoPsv
    };
  }

  const pReseat = psvSetpointGaugePa * 0.95;
  let lo = Math.min(currentGaugePa, pReseat);
  let hi = Math.max(pTrialNoPsv, currentGaugePa);
  for (let iter = 0; iter < 36; iter++) {
    const mid = 0.5 * (lo + hi);
    const ev = evaluatePsvOrificeDischarge({
      inletGaugePa: mid,
      setpointGaugePa: psvSetpointGaugePa,
      backpressureGaugePa: psvBackpressureGaugePa,
      nominalFullLiftFlowKgSAtSet: psvNominalFlowKgS,
      capacityScale: psvCapacityScale,
      previouslyOpen: true,
      rho
    });
    const fMid = cComp * (mid - currentGaugePa) - (netNonPsvMassFlowKgS - ev.psvReliefFlowKgS) * dtSeconds;
    if (fMid > 0.0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  const pSolved = 0.5 * (lo + hi);
  const finalEval = evaluatePsvOrificeDischarge({
    inletGaugePa: pSolved,
    setpointGaugePa: psvSetpointGaugePa,
    backpressureGaugePa: psvBackpressureGaugePa,
    nominalFullLiftFlowKgSAtSet: psvNominalFlowKgS,
    capacityScale: psvCapacityScale,
    previouslyOpen: true,
    rho
  });
  const effectiveReliefKgS = Math.max(
    0.0,
    netNonPsvMassFlowKgS - (cComp * (pSolved - currentGaugePa)) / Math.max(1e-9, dtSeconds)
  );
  return {
    psvOpen: Boolean(finalEval.psvOpen || effectiveReliefKgS > 1e-6),
    psvReliefFlowKgS: effectiveReliefKgS,
    nextGaugePa: pSolved
  };
}

function mapPumpToUI(pObj) {
  if (!pObj) return { state: 'unknown', speedRatio: 0, commandRun: false };
  if (pObj.fault) pObj.modeState = PUMP_STATES.FAULT;
  else if (pObj.maintenance) pObj.modeState = PUMP_STATES.MAINTENANCE;
  const stMap = {
    [PUMP_STATES.RUNNING]: 'running',
    [PUMP_STATES.READY_STANDBY]: 'standby_ready',
    [PUMP_STATES.FAULT]: 'fault',
    [PUMP_STATES.MANUAL]: 'manual',
    [PUMP_STATES.MAINTENANCE]: 'maintenance_isolated',
    [PUMP_STATES.UNKNOWN]: 'unknown'
  };
  return {
    state: stMap[pObj.modeState] || (pObj.running ? 'running' : 'standby_ready'),
    speedRatio: pObj.speedRatio ?? 0,
    commandRun: Boolean(pObj.commandOn),
    get fault() { return pObj.modeState === PUMP_STATES.FAULT; },
    set fault(v) { pObj.modeState = v ? PUMP_STATES.FAULT : PUMP_STATES.READY_STANDBY; },
    get maintenance() { return pObj.modeState === PUMP_STATES.MAINTENANCE; },
    set maintenance(v) { pObj.modeState = v ? PUMP_STATES.MAINTENANCE : PUMP_STATES.READY_STANDBY; }
  };
}

function syncUIViewModel(sim) {
  const { dataset, state, faults } = sim;
  const hyd = state.hydraulics;
  if (!hyd) return;

  if (sim.paused === undefined) sim.paused = false;
  if (sim.timeMultiplier === undefined) sim.timeMultiplier = 1.0;

  // Bind state.env directly to dataset.ambient
  if (!state.env) {
    state.env = {
      get T_amb_C() { return dataset.ambient.temperatureC.value; },
      set T_amb_C(v) { dataset.ambient.temperatureC.value = Number(v); },
      get strictPage48Limit21C() { return Boolean(dataset.ambient.strictPage48AmbientLimit.value); },
      set strictPage48Limit21C(v) { dataset.ambient.strictPage48AmbientLimit.value = Boolean(v); }
    };
  }

  state.time_s = state.simTimeSeconds;

  const cyc = state.hp01.refrigerantCycle || {};
  state.hp = {
    T_in_C: state.hp01.enteringWaterTempC,
    T_out_C: state.hp01.leavingWaterTempC,
    Q_water_W: state.hp01.qWaterHeatingW,
    P_el_total_W: state.hp01.pElTotalW,
    COP_unit: state.copMetrics?.unitInstantCOP ?? state.hp01.instantaneousUnitCOP,
    COP_system: state.copMetrics?.plantInstantEfficiency ?? null,
    commandEnable: Boolean(state.plantStartCommand),
    commandLoadPct: (state.hp01.plrCommand || 0) * 100,
    actualLoadPct: (state.hp01.plrActual || 0) * 100,
    fanSpeedPct: state.hp01.inDefrost ? 0 : Math.min(100, Math.max(0, (state.hp01.plrActual || 0) * 100)),
    heatingActive: state.hp01.qWaterHeatingW > 1000,
    defrostActive: Boolean(state.inDefrost || faults.forceDefrost),
    outOfMap: Boolean(state.hp01.outOfMap),
    inPage48To50AmbiguityZone: Boolean(state.hp01.inPage48To50AmbiguityZone),
    protectionBlocked: state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_11_FAULT_LOCKOUT || Boolean(state.hp01.outOfMap),
    refrigerant: {
      T_evap_C: cyc.tEvapC ?? (dataset.ambient.temperatureC.value - 6.0),
      T_cond_C: cyc.tCondC ?? (state.hp01.leavingWaterTempC + 3.5),
      p_evap_bar_a: (cyc.pEvapAbsPa ?? 320000) / 1e5,
      p_cond_bar_a: (cyc.pCondAbsPa ?? 1450000) / 1e5
    }
  };

  state.buffer = {
    T_top_C: state.bt01.topTempC,
    T_mid_C: 0.5 * (state.bt01.mid1TempC + state.bt01.mid2TempC),
    T_bot_C: state.bt01.bottomTempC,
    Q_loss_W: state.bt01.qLossTotalW
  };

  state.primary = {
    qv_m3s: hyd.ppResult.flowM3S,
    flowSwitchConfirmed: Boolean(state.flowSwitchClosed),
    p_suction_Pa_g: hyd.ppSuctionGaugePa,
    p_discharge_Pa_g: hyd.ppDischargeGaugePa,
    pumpA: mapPumpToUI(state.pumps.PP01A),
    pumpB: mapPumpToUI(state.pumps.PP01B),
    et00: {
      isolated: Boolean(faults.et00Isolated),
      p_gas_Pa_g: hyd.primaryStatic.staticGaugeRoofPa
    },
    psv00_open: Boolean(hyd.primaryStatic.psvOpen)
  };

  state.distribution = {
    qv_total_m3s: hyd.sumBranchFlowM3S,
    T_supply_header_C: state.bt01.distSupplyTempC,
    T_return_header_C: state.bt01.bottomTempC,
    dp_header_Pa: hyd.manifoldDeltaPPa,
    pumpA: mapPumpToUI(state.pumps.PD01A),
    pumpB: mapPumpToUI(state.pumps.PD01B)
  };

  for (let i = 0; i < 5; i++) {
    const idx = i + 1;
    const pad = `0${idx}`;
    const br = state.branches[i];
    const bData = dataset.branches[i];
    const bHyd = hyd.branchHydraulics[i];
    const secHyd = hyd.secondaryLoops[i];
    const missingBlocked = dataset.mode === 'SITE' && (bData.consumerElevationFromRoofM.value === null || bData.jacketMaxAllowablePressureGaugePa.value === null);

    br.missingDataBlocked = missingBlocked;
    br.primary = {
      qv_m3s: bHyd.flowM3S,
      dp_hx_Pa: bHyd.hxPriDeltaPPa,
      valveCommand: br.cvCommandPos,
      valveActual: br.cvActualPos,
      get isolated() { return Boolean(faults[`branch${idx}Isolated`]); },
      set isolated(v) { faults[`branch${idx}Isolated`] = Boolean(v); }
    };
    br.hx = {
      T_pri_in_C: br.hxState.tHotInC,
      T_pri_out_C: br.hxState.tHotOutC,
      T_sec_in_C: br.hxState.tColdInC,
      T_sec_out_C: br.sensorValid ? br.hxState.tColdOutC : null,
      Q_W: br.hxState.qSecondaryReceivedW,
      effectiveness: br.hxState.effectiveness ?? 0.75,
      NTU: br.hxState.ntu ?? 2.4,
      Cr: br.hxState.cr ?? 0.85,
      foulingFactor: faults[`hx0${idx}Fouled`] ? 2.4 : 1.0,
      crossLeak_m3s: faults[`hx0${idx}InternalLeak`] ? 0.0001 : 0.0
    };
    br.secondary = {
      qv_m3s: secHyd.flowM3S,
      T_supply_setpoint_C: bData.secondarySupplyTempSetpointC.value,
      z_consumer_m: secHyd.zConsumerM ?? 'אין נתונים',
      p_consumer_supply_Pa_g: secHyd.consumerSupplyGaugeBottomPa,
      p_consumer_supply_Pa_a: secHyd.consumerSupplyGaugeBottomPa !== null ? secHyd.consumerSupplyGaugeBottomPa + 101325 : 0,
      max_roof_Pa_g: br.maxRoofGaugePa,
      max_consumer_supply_Pa_g: br.maxConsumerSupplyGaugeBottomPa,
      max_loop_Pa_g: br.maxLoopGaugePa,
      exceedsUnconfirmed2Bar: Boolean(secHyd.jacketPressureExceedsVerbal2Bar || (br.maxLoopGaugePa > (bData.jacketMaxAllowablePressureGaugePa.value ?? 200000.0))),
      leakRate_kg_s: faults[`secLoop${idx}LeakKgS`] || 0,
      psvOpen: Boolean(br.psvOpen || secHyd.staticState.psvOpen),
      psvReliefFlow_kg_s: br.psvReliefFlowKgS ?? secHyd.staticState.psvReliefFlowKgS,
      et: {
        isolated: Boolean(faults[`et0${idx}Isolated`]),
        p_gas_Pa_g: secHyd.staticState.staticGaugeRoofPa
      },
      pumpA: mapPumpToUI(state.pumps[`PS${pad}A`]),
      pumpB: mapPumpToUI(state.pumps[`PS${pad}B`])
    };
    br.consumer = {
      T_choc_C: br.processCoreTempC,
      T_choc_target_C: bData.processTargetTempC.value,
      Q_demand_W: bData.nominalThermalDemandW.value * (faults[`branch${idx}LoadMultiplier`] ?? 1.0)
    };
  }

  state.energy = {
    E_useful_consumers_kWh: state.energyTotals.consumersUsefulHeatJ / 3.6e6,
    E_electric_total_kWh: state.energyTotals.totalPlantElectricEnergyJ / 3.6e6,
    E_buffer_change_kWh: state.energyTotals.bufferEnergyChangeJ / 3.6e6
  };

  state.automation = {
    startupStage: state.symbioStep
  };

  state.waterTreatment = {
    dosingBlocked: !state.wt01.dosingPumpActive
  };

  state.Faults = {
    makeupValveStuckOpenLoop: [1, 2, 3, 4, 5].find((k) => faults[`muSec${k}FailOpen`]) ?? null
  };

  for (const alm of state.alarms) {
    alm.code = alm.code || alm.id;
    alm.causeRu = alm.causeRu || alm.titleRu;
    alm.active = alm.activeCondition !== false;
    alm.severity = alm.severity === 'CRITICAL' ? 'alarm' : 'warning';
  }
}

/**
 * Acknowledges an alarm without clearing the fault or resetting a latching trip! (Section 11)
 */
export function acknowledgeAlarm(sim, alarmId) {
  const alm = sim.state.alarms.find((a) => a.id === alarmId || a.code === alarmId);
  if (alm) {
    alm.acknowledged = true;
    // Note per Section 11: "Квитирование сообщения не считать устранением причины или сбросом защиты."
  }
}

/**
 * Attempts a manual protection reset on a latching alarm — only succeeds if the underlying fault cause is gone!
 */
export function resetLatchedProtection(sim, alarmId) {
  const alm = alarmId
    ? sim.state.alarms.find((a) => a.id === alarmId || a.code === alarmId)
    : sim.state.alarms.find((a) => a.latching);
  if (!alm) return { reset: false, reasonRu: 'Авария не найдена' };
  if (alm.activeCondition) {
    return {
      reset: false,
      reasonRu: 'Сброс защиты невозможен: первопричина аварии ещё не устранена!',
      reasonHe: 'איפוס הגנה נדחה: גורם התקלה עדיין פעיל!'
    };
  }
  alm.resetCompleted = true;
  sim.state.alarms = sim.state.alarms.filter((a) => a.id !== alm.id);
  if (sim.state.symbioStep === SYMBIO_STARTUP_STEPS.STEP_11_FAULT_LOCKOUT) {
    sim.state.symbioStep = SYMBIO_STARTUP_STEPS.STEP_0_STOPPED;
  }
  return { reset: true, reasonRu: 'Защита успешно сброшена после устранения причины' };
}

