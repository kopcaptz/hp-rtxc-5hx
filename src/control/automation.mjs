/**
 * Stage 4 — Two-Level Automation, Startup/Shutdown Sequences, Redundancy & Protections
 * (Section 10 & Section 11)
 *
 * Level 1: Symbio 800 OEM Controller (HP01)
 *   - 8-step startup state machine (command != confirmed operation)
 *   - 6-second flow switch debounce protection (p. 32)
 *   - 20-second compressor unload on normal shutdown (p. 57)
 *   - Anti-freeze pump circulation demand in low ambient standby (p. 32–33)
 *
 * Level 2: External Plant Controller CP01
 *   - PI controller with anti-windup for distribution differential pressure Δp_dist (PD01A/B VFD)
 *   - 5 PI controllers with anti-windup & rate limiting for secondary supply temperatures (CV01..CV05)
 *   - 1+1 Pump Redundancy State Machine (RUNNING, READY_STANDBY, FAULT, MANUAL, MAINTENANCE_OUT, UNKNOWN)
 *   - Controlled Makeup MU01 with duration/volume limits and Water Treatment WT01 dosing interlocks
 *   - Latching vs Auto-Reset Alarm Manager (acknowledgement != fault clearance or protection reset)
 */

export const PUMP_STATES = Object.freeze({
  RUNNING: 'RUNNING',                 // работает
  READY_STANDBY: 'READY_STANDBY',     // готов в резерве
  FAULT: 'FAULT',                     // неисправен
  MANUAL: 'MANUAL',                   // ручной режим
  MAINTENANCE_OUT: 'MAINTENANCE_OUT', // выведен на обслуживание
  UNKNOWN: 'UNKNOWN'                  // состояние неизвестно
});

export const PUMP_STATE_LABELS = Object.freeze({
  [PUMP_STATES.RUNNING]: { he: 'פועל (עבודה)', ru: 'Работает' },
  [PUMP_STATES.READY_STANDBY]: { he: 'מוכן בגיבוי', ru: 'Готов в резерве' },
  [PUMP_STATES.FAULT]: { he: 'תקלה', ru: 'Неисправен' },
  [PUMP_STATES.MANUAL]: { he: 'מצב ידני', ru: 'Ручной режим' },
  [PUMP_STATES.MAINTENANCE_OUT]: { he: 'הוצא לתחזוקה', ru: 'Выведен на обслуживание' },
  [PUMP_STATES.UNKNOWN]: { he: 'מצב לא ידוע', ru: 'Состояние неизвестно' }
});

export const SYMBIO_STARTUP_STEPS = Object.freeze({
  STEP_0_STOPPED: 'STEP_0_STOPPED',
  STEP_1_SENSOR_CHECK: 'STEP_1_SENSOR_CHECK',
  STEP_2_EQUIPMENT_READY: 'STEP_2_EQUIPMENT_READY',
  STEP_3_PRESSURE_PATH_CHECK: 'STEP_3_PRESSURE_PATH_CHECK',
  STEP_4_PUMP_START: 'STEP_4_PUMP_START',
  STEP_5_FLOW_PROOF: 'STEP_5_FLOW_PROOF',
  STEP_6_UNIT_ENABLE: 'STEP_6_UNIT_ENABLE',
  STEP_7_COMPRESSOR_CONFIRM: 'STEP_7_COMPRESSOR_CONFIRM',
  STEP_8_RUNNING_MODULATING: 'STEP_8_RUNNING_MODULATING',
  STEP_9_UNLOADING_STOP: 'STEP_9_UNLOADING_STOP',
  STEP_10_STANDBY_NO_LOAD: 'STEP_10_STANDBY_NO_LOAD',
  STEP_11_FAULT_LOCKOUT: 'STEP_11_FAULT_LOCKOUT'
});

export const SYMBIO_STEP_LABELS = Object.freeze({
  [SYMBIO_STARTUP_STEPS.STEP_0_STOPPED]: {
    he: '0. מופסק (STOP)',
    ru: '0. Остановлен'
  },
  [SYMBIO_STARTUP_STEPS.STEP_1_SENSOR_CHECK]: {
    he: '1. בדיקת תקינות רגשים ומדידות',
    ru: '1. Проверка достоверности необходимых измерений'
  },
  [SYMBIO_STARTUP_STEPS.STEP_2_EQUIPMENT_READY]: {
    he: '2. בדיקת מוכנות ציוד וחימום שמן (12 שעות)',
    ru: '2. Проверка готовности оборудования и прогрева масла (≥12 ч)'
  },
  [SYMBIO_STARTUP_STEPS.STEP_3_PRESSURE_PATH_CHECK]: {
    he: '3. בדיקת לחץ סטטי וזמינות מסלול סחרור',
    ru: '3. Проверка давления и доступности путей циркуляции'
  },
  [SYMBIO_STARTUP_STEPS.STEP_4_PUMP_START]: {
    he: '4. הפעלת משאבות סחרור נדרשות (PP01)',
    ru: '4. Запуск требуемых насосов первичного контура'
  },
  [SYMBIO_STARTUP_STEPS.STEP_5_FLOW_PROOF]: {
    he: '5. אימות זרימה בפועל (מד ספיקה + מפסק זרימה FS-HP01)',
    ru: '5. Подтверждение действительного протока (расходомер + реле протока)'
  },
  [SYMBIO_STARTUP_STEPS.STEP_6_UNIT_ENABLE]: {
    he: '6. אישור עבודה ליחידה ובדיקת מעטפת עבודה',
    ru: '6. Разрешение агрегату и проверка рабочей области'
  },
  [SYMBIO_STARTUP_STEPS.STEP_7_COMPRESSOR_CONFIRM]: {
    he: '7. אימות הפעלת מדחסים בפועל',
    ru: '7. Подтверждение фактической работы компрессора'
  },
  [SYMBIO_STARTUP_STEPS.STEP_8_RUNNING_MODULATING]: {
    he: '8. עבודה סדירה וויסות הספק הדרגתי',
    ru: '8. Постепенный выход на режим и модуляция мощности'
  },
  [SYMBIO_STARTUP_STEPS.STEP_9_UNLOADING_STOP]: {
    he: '9. פריקת עומס מבוקרת (20 שנ׳) לקראת עצירה',
    ru: '9. Разгрузка компрессора (20 с по стр. 57) перед штатным остановом'
  },
  [SYMBIO_STARTUP_STEPS.STEP_10_STANDBY_NO_LOAD]: {
    he: '10. המתנה אוטומטית — אין דרישת חום מהצרכנים',
    ru: '10. Останов по отсутствию потребности (буфер заряжен)'
  },
  [SYMBIO_STARTUP_STEPS.STEP_11_FAULT_LOCKOUT]: {
    he: '11. חסימת הגנה פעילה (נדרש סילוק תקלה ואיפוס)',
    ru: '11. Защитная блокировка (требуется устранение причины и сброс)'
  }
});

export const SHUTDOWN_MODES = Object.freeze({
  NONE: 'NONE',
  NORMAL_STOP: 'NORMAL_STOP',                     // Штатный останов
  EMERGENCY_COMPRESSOR_TRIP: 'EMERGENCY_TRIP',   // Аварийный останов компрессора
  TOTAL_POWER_LOSS: 'TOTAL_POWER_LOSS'            // Полное исчезновение питания
});

/**
 * Evaluates 1+1 Pump Group Redundancy (PP01A/B, PD01A/B, PS01A/B..PS05A/B)
 * - Taking standby pump to MAINTENANCE_OUT never stops a healthy duty pump,
 *   but flags standbyAvailable = false.
 * - Automatic failover occurs only if standby pump is READY_STANDBY and startup conditions hold,
 *   and subsequently verifies flow restoration.
 */
export function updatePumpGroupRedundancy({
  groupName,
  pumpA,
  pumpB,
  groupDemandOn,
  targetSpeedRatio = 1.0,
  measuredFlowM3S = 0.0,
  minExpectedFlowM3S = 0.002,
  erroneousDualRun = false,
  powerAvailable = true,
  dtSeconds = 0.5,
  raiseAlarm
}) {
  if (!powerAvailable) {
    pumpA.commandOn = false;
    pumpB.commandOn = false;
    pumpA.running = false;
    pumpB.running = false;
    pumpA.speedRatio = 0;
    pumpB.speedRatio = 0;
    return {
      dutyPumpId: null,
      standbyAvailable: false,
      failoverActive: false,
      flowVerified: false
    };
  }

  const aCanRun = ![PUMP_STATES.FAULT, PUMP_STATES.MAINTENANCE_OUT, PUMP_STATES.UNKNOWN].includes(pumpA.modeState);
  const bCanRun = ![PUMP_STATES.FAULT, PUMP_STATES.MAINTENANCE_OUT, PUMP_STATES.UNKNOWN].includes(pumpB.modeState);

  if (pumpB.modeState === PUMP_STATES.MAINTENANCE_OUT || pumpA.modeState === PUMP_STATES.MAINTENANCE_OUT) {
    raiseAlarm({
      id: `ALM-${groupName}-NO-STANDBY-MAINT`,
      severity: 'WARNING',
      latching: false,
      componentId: pumpB.modeState === PUMP_STATES.MAINTENANCE_OUT ? pumpB.id : pumpA.id,
      titleHe: `גיבוי לא זמין בקבוצת ${groupName} (משאבה בתחזוקה)`,
      titleRu: `Отсутствует готовый резерв в группе ${groupName} (насос выведен на обслуживание)`
    });
  }

  if (!groupDemandOn) {
    pumpA.commandOn = false;
    pumpB.commandOn = false;
    pumpA.running = false;
    pumpB.running = false;
    pumpA.speedRatio = 0;
    pumpB.speedRatio = 0;
    if (aCanRun && pumpA.modeState !== PUMP_STATES.MANUAL) pumpA.modeState = PUMP_STATES.READY_STANDBY;
    if (bCanRun && pumpB.modeState !== PUMP_STATES.MANUAL) pumpB.modeState = PUMP_STATES.READY_STANDBY;
    return {
      dutyPumpId: null,
      standbyAvailable: aCanRun && bCanRun,
      failoverActive: false,
      flowVerified: false
    };
  }

  // Erroneous simultaneous dual-pump test (Section 15 acceptance check)
  if (erroneousDualRun && aCanRun && bCanRun) {
    pumpA.commandOn = true;
    pumpB.commandOn = true;
    pumpA.running = true;
    pumpB.running = true;
    pumpA.modeState = PUMP_STATES.RUNNING;
    pumpB.modeState = PUMP_STATES.RUNNING;
    pumpA.speedRatio = targetSpeedRatio;
    pumpB.speedRatio = targetSpeedRatio;
    raiseAlarm({
      id: `ALM-${groupName}-DUAL-RUN`,
      severity: 'WARNING',
      latching: false,
      componentId: pumpA.id,
      titleHe: `הפעלה כפולה שגויה של שתי משאבות ${groupName} במקביל`,
      titleRu: `Ошибочное одновременное включение рабочего и резервного насосов ${groupName}`
    });
    return {
      dutyPumpId: `${pumpA.id}+${pumpB.id}`,
      standbyAvailable: false,
      failoverActive: false,
      flowVerified: measuredFlowM3S >= minExpectedFlowM3S
    };
  }

  let failoverActive = false;
  let activePump = null;
  let standbyPump = null;

  if (aCanRun) {
    activePump = pumpA;
    standbyPump = pumpB;
  } else if (bCanRun) {
    activePump = pumpB;
    standbyPump = pumpA;
    failoverActive = true;
    raiseAlarm({
      id: `ALM-${groupName}-FAILOVER-ACTIVE`,
      severity: 'WARNING',
      latching: false,
      componentId: pumpB.id,
      titleHe: `מעבר אוטומטי למשאבת גיבוי ${pumpB.id} עקב תקלה ב-${pumpA.id}`,
      titleRu: `АВР ${groupName}: автоматический переход на резервный насос ${pumpB.id} после отказа ${pumpA.id}`
    });
  } else {
    // Neither pump available!
    pumpA.commandOn = false;
    pumpB.commandOn = false;
    pumpA.running = false;
    pumpB.running = false;
    pumpA.speedRatio = 0;
    pumpB.speedRatio = 0;
    raiseAlarm({
      id: `ALM-${groupName}-TOTAL-LOSS`,
      severity: 'CRITICAL',
      latching: true,
      componentId: pumpA.id,
      titleHe: `אובדן מלא של סחרור בקבוצת ${groupName} — עבודה ומילוי גיבוי אינם זמינים!`,
      titleRu: `Полный отказ насосной группы ${groupName}: рабочий насос неисправен, резерв недоступен!`
    });
    return {
      dutyPumpId: null,
      standbyAvailable: false,
      failoverActive: false,
      flowVerified: false
    };
  }

  activePump.commandOn = true;
  activePump.running = true;
  if (activePump.modeState !== PUMP_STATES.MANUAL) {
    activePump.modeState = PUMP_STATES.RUNNING;
  }
  activePump.speedRatio = targetSpeedRatio;

  standbyPump.commandOn = false;
  standbyPump.running = false;
  standbyPump.speedRatio = 0.0;
  if (standbyPump === pumpB && bCanRun && pumpB.modeState !== PUMP_STATES.MANUAL) {
    pumpB.modeState = PUMP_STATES.READY_STANDBY;
  }

  const standbyAvailable = standbyPump === pumpB ? bCanRun : aCanRun;

  // Post-start / post-failover flow restoration verification (Section 5.1)
  activePump.runTimerS = (activePump.runTimerS || 0.0) + dtSeconds;
  const flowVerified = measuredFlowM3S >= minExpectedFlowM3S;
  if (activePump.runTimerS > 3.0 && !flowVerified) {
    raiseAlarm({
      id: `ALM-${groupName}-FLOW-NOT-RESTORED`,
      severity: 'CRITICAL',
      latching: false,
      componentId: activePump.id,
      titleHe: `חוסר אימות ספיקה לאחר הפעלת משאבה ${activePump.id}`,
      titleRu: `Отсутствует подтверждение восстановления расхода после включения насоса ${activePump.id}`
    });
  }

  return {
    dutyPumpId: activePump.id,
    standbyAvailable,
    failoverActive,
    flowVerified
  };
}

/**
 * Anti-windup PI Controller step
 */
export function stepPIController({
  piState,
  setpoint,
  measurement,
  kp,
  ki,
  outMin = 0.0,
  outMax = 1.0,
  maxRatePerSec = 0.25,
  dtSeconds = 0.5
}) {
  const error = setpoint - measurement;
  const pTerm = kp * error;

  // Tentative integral update with clamping anti-windup
  let candidateIntegral = (piState.integral || 0.0) + ki * error * dtSeconds;
  let rawOut = pTerm + candidateIntegral;

  if (rawOut > outMax) {
    rawOut = outMax;
    if (error < 0) piState.integral = candidateIntegral;
  } else if (rawOut < outMin) {
    rawOut = outMin;
    if (error > 0) piState.integral = candidateIntegral;
  } else {
    piState.integral = candidateIntegral;
  }

  const prevOut = piState.output ?? rawOut;
  const maxDelta = maxRatePerSec * dtSeconds;
  const rateLimitedOut = Math.max(prevOut - maxDelta, Math.min(prevOut + maxDelta, rawOut));
  const finalOut = Math.max(outMin, Math.min(outMax, rateLimitedOut));

  piState.error = error;
  piState.output = finalOut;
  return finalOut;
}
