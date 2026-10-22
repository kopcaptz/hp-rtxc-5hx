/**
 * STAGE 2 FOUNDATION (PKG-S2-A): Pure Read-Only Simulation State Adapter for HP01 Cutaway
 * Task: HP-RTXC-CUTAWAY-REDESIGN-01 (S2-FOUNDATION-09 / AC-S2F)
 *
 * Enforces S2P-01..07 & plan-review-02.md contracts:
 *  1. Zero mutation of sim / sim.state / sim.dataset / sim.faults / COMPONENT_REGISTRY.
 *  2. Deep freeze (Object.freeze) ONLY on newly constructed own primitive copy (never touches sim graph).
 *  3. Source-aware effectiveDefrost (commandedDefrost = Boolean(state.inDefrost) || Boolean(faults?.forceDefrost))
 *     so forcedDefrost (inDefrost=false, forceDefrost=true, hp.defrostActive=true) is recognized as 'DEFROST'.
 *  4. Explicit separation of UNKNOWN_OR_MISSING / SITE_MISSING / DEFROST / HEATING / STOPPED without fake fallbacks.
 *  5. Strict separation of water.flow (flowM3S), water.flowSwitchClosed, water.loopSubState, and graphical cutoff (1e-4 m³/s).
 *  6. Exact solveR513ACycle keys (tEvapC, tCondC, massFlowEconKgS, etc.) and mode-dependent invalid reason text.
 */

import { convertValue } from '../equipment/units_and_io.mjs';
import { RTXC_PROTOTYPE_PASSPORT } from '../equipment/rtxc_prototype.mjs';
import { HP01_CUTAWAY_TEXT_HE } from '../i18n/he_ru.mjs';
import { HP01_GEOMETRY_CONSTANTS, HP01_AUX_VALVES, HP01_INTERNAL_CONNECTIONS } from './hp01_cutaway_meta.mjs';

export const EPS_VISUAL_FLOW_M3S = 1e-4;        // 0.1 L/s — purely graphical particle cutoff, NOT a protection threshold!
export const OEM_FLOW_SWITCH_MIN_LS = 15.3;     // 15.3 L/s (6 s delay) — OEM protection specification (p. 31–32)
export const V_QUAL_DEFROST = 0.45;             // Dimensionless qualitative visualization speed constant in Defrost (NOT physical refrigerant velocity!)

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonNegFinite(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function isPosFinite(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * F03: Strict boolean evaluator.
 * Accepts ONLY genuine boolean primitives (`true` or `false`) when `gatedValid !== false`.
 * Rejects `undefined`, `null`, `0`, `1`, `"false"`, `"true"`, `NaN`, `{}`, `[]`, etc. as unknown (`rawValue: null`).
 */
export function evaluateStrictBooleanField(rawValue, options = {}) {
  const gatedValid = options.gatedValid !== false;
  const isGenuineBoolean = typeof rawValue === 'boolean';

  if (!gatedValid || !isGenuineBoolean) {
    return {
      rawValue: null,
      isValid: false,
      isKnown: false,
      status: 'UNKNOWN_OR_MISSING',
      displayTextHe: options.unknownTextHe || HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.unknownStateHe
    };
  }

  if (rawValue === true) {
    return {
      rawValue: true,
      isValid: true,
      isKnown: true,
      status: options.trueStatus || 'TRUE',
      displayTextHe: options.trueTextHe || 'כן'
    };
  }

  return {
    rawValue: false,
    isValid: true,
    isKnown: true,
    status: options.falseStatus || 'FALSE',
    displayTextHe: options.falseTextHe || 'לא'
  };
}

/**
 * Normalizes an explicit status string from a passport record without ever promoting missing/empty/unknown statuses.
 */
function normalizeExplicitRecordStatus(rawStatus) {
  if (typeof rawStatus !== 'string') {
    return { canonicalStatus: 'UNKNOWN_OR_MISSING', isExplicitMissing: false, rawStatus: null };
  }
  const trimmed = rawStatus.trim();
  if (!trimmed) {
    return { canonicalStatus: 'UNKNOWN_OR_MISSING', isExplicitMissing: false, rawStatus: null };
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'missing_data' || lower === 'missing') {
    return { canonicalStatus: 'UNKNOWN_OR_MISSING', isExplicitMissing: true, rawStatus: trimmed };
  }
  if (lower === 'unknown' || lower === 'unknown_or_missing') {
    return { canonicalStatus: 'UNKNOWN_OR_MISSING', isExplicitMissing: false, rawStatus: trimmed };
  }
  if (lower === 'confirmed_by_doc' || lower === 'confirmed') {
    return { canonicalStatus: 'CONFIRMED_BY_DOC', isExplicitMissing: false, rawStatus: trimmed };
  }
  if (lower === 'assumed_for_demo' || lower === 'assumed') {
    return { canonicalStatus: 'ASSUMED_FOR_DEMO', isExplicitMissing: false, rawStatus: trimmed };
  }
  if (lower === 'requires_clarification') {
    return { canonicalStatus: 'REQUIRES_CLARIFICATION', isExplicitMissing: false, rawStatus: trimmed };
  }
  if (lower === 'from_site') {
    return { canonicalStatus: 'FROM_SITE', isExplicitMissing: false, rawStatus: trimmed };
  }
  if (lower === 'confirmed_project_schema_id' || lower === 'project_schema_id') {
    return { canonicalStatus: 'CONFIRMED_PROJECT_SCHEMA_ID', isExplicitMissing: false, rawStatus: trimmed };
  }
  return { canonicalStatus: 'UNKNOWN_OR_MISSING', isExplicitMissing: false, rawStatus: trimmed };
}

/**
 * Helper to validate a non-empty string or param({ value, status, source, pageRef, ... }) record
 * without ever calling String(undefined/null/object) and without promoting bare strings or missing statuses
 * to CONFIRMED_BY_DOC / ASSUMED_FOR_DEMO (R2-01).
 */
function extractValidatedStringRecord(input, options = {}) {
  const missingTextHe = options.missingTextHe || HP01_CUTAWAY_TEXT_HE.missingFallbacks.generic;
  const allowCanonicalTagLiteral = options.allowCanonicalTagLiteral || null;
  const forbiddenLiterals = new Set(['undefined', 'null', '[object Object]', 'NaN']);

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.length > 0 && !forbiddenLiterals.has(trimmed)) {
      if (allowCanonicalTagLiteral && trimmed === allowCanonicalTagLiteral) {
        return {
          rawValue: trimmed,
          isValid: true,
          status: 'CONFIRMED_PROJECT_SCHEMA_ID',
          passportDataStatus: 'confirmed_project_schema_id',
          source: 'HP-RTXC-5HX_PROJECT_SCHEMA',
          sourceRef: 'Stage 1 / Stage 2 canonical equipment schema ID',
          conditions: null,
          displayTextHe: trimmed
        };
      }
      // Bare primitive string without explicit status/source is NEVER promoted to CONFIRMED_BY_DOC or ASSUMED_FOR_DEMO
      return {
        rawValue: trimmed,
        isValid: false,
        status: 'UNKNOWN_OR_MISSING',
        passportDataStatus: null,
        source: null,
        sourceRef: null,
        conditions: null,
        displayTextHe: trimmed
      };
    }
    return {
      rawValue: null,
      isValid: false,
      status: 'UNKNOWN_OR_MISSING',
      passportDataStatus: null,
      source: null,
      sourceRef: null,
      conditions: null,
      displayTextHe: missingTextHe
    };
  }

  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const val = input.value;
    const { canonicalStatus, isExplicitMissing, rawStatus } = normalizeExplicitRecordStatus(input.status);
    if (isExplicitMissing) {
      return {
        rawValue: null,
        isValid: false,
        status: 'UNKNOWN_OR_MISSING',
        passportDataStatus: rawStatus,
        source: null,
        sourceRef: null,
        conditions: null,
        displayTextHe: missingTextHe
      };
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length > 0 && !forbiddenLiterals.has(trimmed)) {
        const rawSource = typeof input.source === 'string' && input.source.trim() ? input.source.trim() : null;
        const rawPageRef = typeof input.pageRef === 'string' && input.pageRef.trim() ? input.pageRef.trim() : null;
        const rawConditions = typeof input.conditions === 'string' && input.conditions.trim() ? input.conditions.trim() : null;
        const isKnownStatus = canonicalStatus !== 'UNKNOWN_OR_MISSING';
        return {
          rawValue: trimmed,
          isValid: isKnownStatus,
          status: canonicalStatus,
          passportDataStatus: rawStatus,
          source: rawSource,
          sourceRef: rawPageRef || rawSource || null,
          conditions: rawConditions,
          displayTextHe: trimmed
        };
      }
    }
  }

  return {
    rawValue: null,
    isValid: false,
    status: 'UNKNOWN_OR_MISSING',
    passportDataStatus: null,
    source: null,
    sourceRef: null,
    conditions: null,
    displayTextHe: missingTextHe
  };
}

function buildConsistentRoleNoteHe(fieldKind, rec) {
  const notes = HP01_CUTAWAY_TEXT_HE.identityNotes;
  if (rec.rawValue === null) {
    if (fieldKind === 'equipmentTag') return notes.missingEquipmentIdHe;
    if (fieldKind === 'shortModelName') return notes.missingShortModelNameHe;
    return notes.missingConfigCodeHe;
  }

  if (fieldKind === 'equipmentTag') {
    if (rec.status === 'CONFIRMED_PROJECT_SCHEMA_ID') {
      return notes.equipmentSchemaRoleHe;
    }
    if (rec.status === 'CONFIRMED_BY_DOC') {
      return rec.sourceRef
        ? `מזהה רכיב מאומת בתיעוד (${rec.sourceRef} — CONFIRMED_BY_DOC; אינו מספר סידורי של היצרן)`
        : 'מזהה רכיב מאומת בתיעוד (CONFIRMED_BY_DOC — אינו מספר סידורי של היצרן)';
    }
    if (rec.status === 'ASSUMED_FOR_DEMO') {
      return notes.equipmentTagAssumedHe;
    }
    if (rec.status === 'REQUIRES_CLARIFICATION') {
      return 'מזהה רכיב הדורש הבהרה הנדסית (REQUIRES_CLARIFICATION — אינו מספר סידורי של היצרן)';
    }
    if (rec.status === 'FROM_SITE') {
      return 'מזהה רכיב מהאתר ללא אימות דרכון (FROM_SITE — אינו מספר סידורי של היצרן)';
    }
    return notes.equipmentTagUnverifiedHe;
  }

  if (fieldKind === 'shortModelName') {
    if (rec.status === 'CONFIRMED_BY_DOC') {
      const isCanonicalRtxc180 =
        rec.rawValue === RTXC_PROTOTYPE_PASSPORT.shortModelName.value &&
        rec.source === 'TRANE_IOM_0526' &&
        rec.sourceRef === 'p. 16–17';
      if (isCanonicalRtxc180) {
        return notes.shortModelConfirmedHe;
      }
      return rec.sourceRef
        ? `שם דגם מאומת בתיעוד (${rec.sourceRef} — CONFIRMED_BY_DOC)`
        : notes.shortModelConfirmedGenericHe;
    }
    if (rec.status === 'ASSUMED_FOR_DEMO') {
      return rec.sourceRef
        ? `שם דגם להדגמה בלבד (${rec.sourceRef} — ASSUMED_FOR_DEMO)`
        : notes.shortModelAssumedHe;
    }
    if (rec.status === 'REQUIRES_CLARIFICATION') {
      return notes.shortModelClarificationHe;
    }
    if (rec.status === 'FROM_SITE') {
      return notes.shortModelFromSiteHe;
    }
    return notes.shortModelUnverifiedHe;
  }

  // fieldKind === 'prototypeConfigCode'
  if (rec.status === 'ASSUMED_FOR_DEMO') {
    const isCanonical28Digit =
      rec.rawValue === RTXC_PROTOTYPE_PASSPORT.modelDesignation.value &&
      rec.source === 'TRANE_IOM_0526';
    if (isCanonical28Digit) {
      return notes.configCodeAssumedHe;
    }
    return notes.configCodeAssumedGenericHe;
  }
  if (rec.status === 'CONFIRMED_BY_DOC') {
    return rec.sourceRef
      ? `קוד תצורה מתועד (${rec.sourceRef} — אינו הזמנת מפעל מאומתת מהאתר — CONFIRMED_BY_DOC)`
      : notes.configCodeConfirmedGenericHe;
  }
  if (rec.status === 'REQUIRES_CLARIFICATION') {
    return notes.configCodeClarificationHe;
  }
  if (rec.status === 'FROM_SITE') {
    return notes.configCodeFromSiteHe;
  }
  return notes.configCodeUnverifiedHe;
}

/**
 * F02 + R2-01: Resolves and strictly separates:
 *  1. `equipmentSchemaTag` ('HP01' — project schema equipment identifier, NOT a factory serial number)
 *  2. `shortModelName` (from `RTXC_PROTOTYPE_PASSPORT.shortModelName.value` — CONFIRMED_BY_DOC when backed by passport record)
 *  3. `prototypeConfigCode` (from `RTXC_PROTOTYPE_PASSPORT.modelDesignation.value` — ASSUMED_FOR_DEMO constructed 28-digit prototype code)
 * Guarantees 100% consistency between rawValue, status, provenance, roleNoteHe, displayTextHe, and displayHe.
 * Never promotes bare strings or missing/unknown statuses to CONFIRMED_BY_DOC or ASSUMED_FOR_DEMO.
 */
export function resolveHP01EquipmentIdentity(...args) {
  const rawPassportArg = args.length >= 1 ? args[0] : RTXC_PROTOTYPE_PASSPORT;
  const passportSource =
    rawPassportArg &&
    typeof rawPassportArg === 'object' &&
    !Array.isArray(rawPassportArg) &&
    rawPassportArg.passport &&
    typeof rawPassportArg.passport === 'object' &&
    !('shortModelName' in rawPassportArg) &&
    !('modelDesignation' in rawPassportArg)
      ? rawPassportArg.passport
      : rawPassportArg;

  const equipmentTagInput = args.length >= 2 ? args[1] : 'HP01';
  const tagRec = extractValidatedStringRecord(equipmentTagInput, {
    missingTextHe: HP01_CUTAWAY_TEXT_HE.identityNotes.missingEquipmentIdHe,
    allowCanonicalTagLiteral: 'HP01'
  });
  const tagRoleNoteHe = buildConsistentRoleNoteHe('equipmentTag', tagRec);
  const tagDisplayHe = tagRec.rawValue !== null ? `${tagRec.rawValue} (${tagRoleNoteHe})` : tagRoleNoteHe;
  const equipmentSchemaTag = {
    rawValue: tagRec.rawValue,
    isValid: tagRec.isValid,
    status: tagRec.status,
    provenance: tagRec.status,
    passportDataStatus: tagRec.passportDataStatus,
    source: tagRec.source,
    sourceRef: tagRec.sourceRef,
    isFactorySerialNumber: false,
    roleNoteHe: tagRoleNoteHe,
    displayTextHe: tagDisplayHe,
    displayHe: tagDisplayHe
  };

  const shortNameRec = extractValidatedStringRecord(
    passportSource && typeof passportSource === 'object' ? passportSource.shortModelName : null,
    {
      missingTextHe: HP01_CUTAWAY_TEXT_HE.identityNotes.missingShortModelNameHe
    }
  );
  const shortRoleNoteHe = buildConsistentRoleNoteHe('shortModelName', shortNameRec);
  const shortDisplayHe =
    shortNameRec.rawValue !== null ? `${shortNameRec.rawValue} (${shortRoleNoteHe})` : shortRoleNoteHe;
  const shortModelName = {
    rawValue: shortNameRec.rawValue,
    isValid: shortNameRec.isValid,
    status: shortNameRec.status,
    provenance: shortNameRec.status,
    passportDataStatus: shortNameRec.passportDataStatus,
    source: shortNameRec.source,
    sourceRef: shortNameRec.sourceRef,
    roleNoteHe: shortRoleNoteHe,
    displayTextHe: shortDisplayHe,
    displayHe: shortDisplayHe
  };

  const codeRec = extractValidatedStringRecord(
    passportSource && typeof passportSource === 'object' ? passportSource.modelDesignation : null,
    {
      missingTextHe: HP01_CUTAWAY_TEXT_HE.identityNotes.missingConfigCodeHe
    }
  );
  const codeRoleNoteHe = buildConsistentRoleNoteHe('prototypeConfigCode', codeRec);
  const codeDisplayHe = codeRec.rawValue !== null ? `${codeRec.rawValue} (${codeRoleNoteHe})` : codeRoleNoteHe;
  const prototypeConfigCode = {
    rawValue: codeRec.rawValue,
    isValid: codeRec.isValid,
    status: codeRec.status,
    provenance: codeRec.status,
    isConfirmedFactoryOrder: false,
    passportDataStatus: codeRec.passportDataStatus,
    source: codeRec.source,
    sourceRef: codeRec.sourceRef,
    roleNoteHe: codeRoleNoteHe,
    displayTextHe: codeDisplayHe,
    displayHe: codeDisplayHe
  };

  return {
    equipmentTag: equipmentSchemaTag,
    equipmentSchemaTag,
    shortModelName,
    prototypeConfigCode,
    equipmentId: equipmentSchemaTag.rawValue,
    shortModelNameText: shortModelName.rawValue,
    prototypeConfigCodeText: prototypeConfigCode.rawValue
  };
}

/**
 * F01 + R2-01: Resolves R513A refrigerant charge with strict separation of confirmed total (304 kg, Table 2 p. 16 col. 180)
 * vs equal-split per-circuit estimate (2 × 152 kg, ASSUMED_FOR_DEMO), reading actual `refrigerantChargeCkt1` and
 * `refrigerantChargeCkt2` fields from the passport without any fake `'confirmed_by_doc'` fallback when absent.
 */
export function resolveHP01RefrigerantChargeProvenance(passportInput = RTXC_PROTOTYPE_PASSPORT) {
  const breakdown = HP01_GEOMETRY_CONSTANTS.massesKg.refrigerantChargeBreakdown;
  const hasPassportObj = Boolean(passportInput && typeof passportInput === 'object' && !Array.isArray(passportInput));
  const totalRec = hasPassportObj && Object.hasOwn(passportInput, 'refrigerantChargeTotal') ? passportInput.refrigerantChargeTotal : null;
  const ckt1Rec = hasPassportObj && Object.hasOwn(passportInput, 'refrigerantChargeCkt1') ? passportInput.refrigerantChargeCkt1 : null;
  const ckt2Rec = hasPassportObj && Object.hasOwn(passportInput, 'refrigerantChargeCkt2') ? passportInput.refrigerantChargeCkt2 : null;

  const passportTotalVal = isFiniteNum(totalRec?.value) ? Number(totalRec.value) : null;
  const ckt1Norm = normalizeExplicitRecordStatus(ckt1Rec?.status);
  const ckt2Norm = normalizeExplicitRecordStatus(ckt2Rec?.status);
  const bothCircuitsPresentAndKnown =
    Boolean(ckt1Rec && ckt2Rec) &&
    ckt1Norm.canonicalStatus !== 'UNKNOWN_OR_MISSING' &&
    ckt2Norm.canonicalStatus !== 'UNKNOWN_OR_MISSING';

  const actualPassportCircuitFields = [
    {
      key: 'refrigerantChargeCkt1',
      existsInPassport: Boolean(ckt1Rec),
      valueKg: isFiniteNum(ckt1Rec?.value) ? Number(ckt1Rec.value) : null,
      rawStatus: ckt1Norm.rawStatus,
      canonicalStatus: ckt1Rec ? ckt1Norm.canonicalStatus : 'UNKNOWN_OR_MISSING',
      pageRef: typeof ckt1Rec?.pageRef === 'string' ? ckt1Rec.pageRef : null
    },
    {
      key: 'refrigerantChargeCkt2',
      existsInPassport: Boolean(ckt2Rec),
      valueKg: isFiniteNum(ckt2Rec?.value) ? Number(ckt2Rec.value) : null,
      rawStatus: ckt2Norm.rawStatus,
      canonicalStatus: ckt2Rec ? ckt2Norm.canonicalStatus : 'UNKNOWN_OR_MISSING',
      pageRef: typeof ckt2Rec?.pageRef === 'string' ? ckt2Rec.pageRef : null
    }
  ];

  const frozenFileStatus =
    bothCircuitsPresentAndKnown && ckt1Norm.rawStatus === ckt2Norm.rawStatus
      ? ckt1Norm.rawStatus
      : 'UNKNOWN_OR_MISSING';

  return {
    refrigerantType: breakdown.refrigerantType,
    totalKg: breakdown.totalKg,
    totalProvenance: breakdown.totalProvenance,
    totalSourceRef: breakdown.totalSourceRef,
    ckt1EstimatedKg: breakdown.ckt1EstimatedKg,
    ckt2EstimatedKg: breakdown.ckt2EstimatedKg,
    sumOfCircuitsKg: breakdown.ckt1EstimatedKg + breakdown.ckt2EstimatedKg,
    perCircuitProvenance: 'ASSUMED_FOR_DEMO',
    perCircuitAssumptionRule: breakdown.perCircuitAssumptionRule,
    frozenPassportTotalMatches: passportTotalVal === breakdown.totalKg,
    totalDisplayHe: breakdown.totalDisplayHe,
    perCircuitDisplayHe: breakdown.perCircuitDisplayHe,
    totalUnitCharge: {
      valueKg: breakdown.totalKg,
      refrigerantType: breakdown.refrigerantType,
      provenance: breakdown.totalProvenance,
      sourceRef: breakdown.totalSourceRef,
      displayHe: breakdown.totalDisplayHe
    },
    perCircuitEqualSplitEstimate: {
      ckt1EstimatedKg: breakdown.ckt1EstimatedKg,
      ckt2EstimatedKg: breakdown.ckt2EstimatedKg,
      provenance: 'ASSUMED_FOR_DEMO',
      assumptionRule: breakdown.perCircuitAssumptionRule,
      displayHe: breakdown.perCircuitDisplayHe
    },
    frozenPrototypeClassificationNote: {
      frozenFilePath: 'src/equipment/rtxc_prototype.mjs',
      frozenFileField: 'refrigerantChargeCkt1',
      frozenFileFields: ['refrigerantChargeCkt1', 'refrigerantChargeCkt2'],
      actualPassportCircuitFields,
      frozenFileStatus,
      frozenFileOriginalClassification: frozenFileStatus,
      frozenFileValuesKg: {
        refrigerantChargeCkt1: actualPassportCircuitFields[0].valueKg,
        refrigerantChargeCkt2: actualPassportCircuitFields[1].valueKg
      },
      visualLayerCorrectedClassification: 'ASSUMED_FOR_DEMO',
      // P3-01: the explanation follows the statuses/values actually passed in. The fixed confirmed_by_doc note is used
      // only when both records really are confirmed_by_doc with the equal-split values it describes.
      explanationHe: !bothCircuitsPresentAndKnown
        ? HP01_CUTAWAY_TEXT_HE.refrigerantChargeNotes.frozenPrototypeMissingNoteHe
        : actualPassportCircuitFields.every(
              (f) => f.canonicalStatus === 'CONFIRMED_BY_DOC' && f.valueKg === breakdown.ckt1EstimatedKg
            )
          ? HP01_CUTAWAY_TEXT_HE.refrigerantChargeNotes.frozenPrototypeClassificationNoteHe
          : `בדרכון שהועבר: ${actualPassportCircuitFields
              .map((f) => `${f.key}=${f.valueKg === null ? '—' : f.valueKg} (${f.rawStatus})`)
              .join(', ')}; בטבלה 2 עמ׳ 16 מופיע רק הסכום הכולל ${breakdown.totalKg} ק״ג, לכן בשכבת החתך מוצגת חלוקה שווה למעגלים כ-ASSUMED_FOR_DEMO`
    }
  };
}

/**
 * Collects all object references reachable from root into a WeakSet (read-only traversal)
 * to guarantee deepFreezeOwnCopy never freezes any object belonging to `sim`.
 */
function collectObjectGraphWeakSet(root) {
  const seen = new WeakSet();
  const stack = [root];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object') continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const keys = Object.keys(cur);
    for (let i = 0; i < keys.length; i++) {
      const child = cur[keys[i]];
      if (child && typeof child === 'object' && !seen.has(child)) {
        stack.push(child);
      }
    }
  }
  return seen;
}

/**
 * Deeply freezes a newly created plain object/array tree after verifying none of its nodes belong to forbiddenSet.
 */
export function deepFreezeOwnCopy(node, forbiddenSet = null) {
  if (!node || typeof node !== 'object') return node;
  if (forbiddenSet && forbiddenSet.has(node)) {
    throw new Error('SECURITY/IMMUTABILITY VIOLATION: Attempted to freeze an object reference belonging to sim!');
  }
  if (Object.isFrozen(node)) return node;
  Object.freeze(node);
  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i++) {
    const child = node[keys[i]];
    if (child && typeof child === 'object') {
      deepFreezeOwnCopy(child, forbiddenSet);
    }
  }
  return node;
}

/**
 * Normalizes UI unit selector values to exact codes expected by convertValue(dimension, value, fromUnit, toUnit)
 */
export function normalizeUnitPrefs(unitPrefs = {}) {
  const rawFlow = String(unitPrefs?.flow || 'L/s');
  const flow =
    rawFlow === 'm³/h' || rawFlow === 'm3/h' ? 'm3/h' :
    rawFlow === 'm³/s' || rawFlow === 'm3/s' ? 'm3/s' : 'L/s';
  const flowLabel = flow === 'm3/h' ? 'm³/h' : flow === 'm3/s' ? 'm³/s' : 'L/s';
  const flowDecimals = flow === 'm3/h' ? 1 : flow === 'm3/s' ? 4 : 2;

  const rawPressure = String(unitPrefs?.pressure || 'bar');
  const pressure = rawPressure === 'kPa' ? 'kPa' : rawPressure === 'Pa' ? 'Pa' : 'bar';
  const pressureDecimals = pressure === 'bar' ? 3 : pressure === 'kPa' ? 2 : 0;

  const rawTemp = String(unitPrefs?.temp || '°C');
  const temp = rawTemp === 'K' ? 'K' : 'C';
  const tempLabel = temp === 'K' ? 'K' : '°C';
  const tempDecimals = 2;

  const rawPower = String(unitPrefs?.power || 'kW');
  const power = rawPower === 'W' ? 'W' : 'kW';
  const powerDecimals = power === 'W' ? 0 : 2;

  return {
    flow,
    flowLabel,
    flowDecimals,
    pressure,
    pressureDecimals,
    temp,
    tempLabel,
    tempDecimals,
    power,
    powerDecimals
  };
}

/**
 * Evaluates source-aware modeKey, commandedDefrost, hasGenuineConflict, hasMissingHp01SiteInputs, and refCycleIsValid
 * Matches the exact 10-case predicate verified in night-supervision/review-s2/plan08-final-independent.json.
 */
export function evaluateHP01ModeAndValidity(sim) {
  const st = sim?.state;
  const hp01 = st?.hp01;
  const hp = st?.hp;
  const rc = hp01?.refrigerantCycle;
  const faults = sim?.faults;
  const dataset = sim?.dataset;

  const structOk = Boolean(
    sim && typeof sim === 'object' &&
    st && typeof st === 'object' &&
    hp01 && typeof hp01 === 'object' &&
    typeof hp01.running === 'boolean' &&
    (st.inDefrost === undefined || typeof st.inDefrost === 'boolean') &&
    (faults?.forceDefrost === undefined || typeof faults.forceDefrost === 'boolean') &&
    (hp?.defrostActive === undefined || typeof hp.defrostActive === 'boolean') &&
    (hp?.heatingActive === undefined || typeof hp.heatingActive === 'boolean')
  );

  // Adapter-derived SITE missing input predicate (no global sim.state.missingDataBlocked exists in frozen core)
  const hasMissingHp01SiteInputs = Boolean(
    dataset?.mode === 'SITE' && (
      !isFiniteNum(dataset?.ambient?.temperatureC?.value) ||
      !isFiniteNum(dataset?.ambient?.relativeHumidityPct?.value) ||
      !isFiniteNum(dataset?.ambient?.barometricPressurePa?.value) ||
      !isFiniteNum(dataset?.hp01?.leavingWaterTempSetpointC?.value) ||
      dataset?.ambient?.temperatureC?.status === 'missing_data' ||
      dataset?.ambient?.relativeHumidityPct?.status === 'missing_data' ||
      dataset?.ambient?.barometricPressurePa?.status === 'missing_data' ||
      dataset?.hp01?.leavingWaterTempSetpointC?.status === 'missing_data'
    )
  );

  const hasPrimaryDefrostSources =
    (typeof st?.inDefrost === 'boolean') || (typeof faults?.forceDefrost === 'boolean');
  const commandedDefrost = hasPrimaryDefrostSources
    ? (Boolean(st?.inDefrost) || Boolean(faults?.forceDefrost))
    : Boolean(hp?.defrostActive || rc?.mode === 'DEFROST');

  let hasGenuineConflict = false;
  if (structOk) {
    const claimHeatingFlag = Boolean(hp?.heatingActive);
    const claimDefrostAny = commandedDefrost || Boolean(hp?.defrostActive) || rc?.mode === 'DEFROST';
    // A. Simultaneous heating and defrost claims
    if (claimHeatingFlag && claimDefrostAny) hasGenuineConflict = true;
    // B. Alias hp.defrostActive contradicts core formula Boolean(state.inDefrost || faults.forceDefrost)
    if (hasPrimaryDefrostSources && typeof hp?.defrostActive === 'boolean' && hp.defrostActive !== commandedDefrost) {
      hasGenuineConflict = true;
    }
    // C. Compressor running under defrost command, but cycle in HEATING or qWaterHeatingW >= 0 / non-finite
    if (hp01.running && commandedDefrost) {
      if (rc?.mode === 'HEATING' || !isFiniteNum(hp01.qWaterHeatingW) || hp01.qWaterHeatingW >= 0) {
        hasGenuineConflict = true;
      }
    }
    // D. Compressor running without defrost (heating), but cycle in DEFROST or qWaterHeatingW <= 0 / non-finite
    if (hp01.running && !commandedDefrost) {
      if (rc?.mode === 'DEFROST' || !isFiniteNum(hp01.qWaterHeatingW) || hp01.qWaterHeatingW <= 0) {
        hasGenuineConflict = true;
      }
    }
    // E. Compressor stopped, but heating claimed, active cycle mode, or non-zero qWaterHeatingW
    if (!hp01.running) {
      if (
        claimHeatingFlag ||
        (rc?.mode && rc.mode !== 'STOPPED') ||
        (isFiniteNum(hp01.qWaterHeatingW) && Math.abs(hp01.qWaterHeatingW) > 1e-3)
      ) {
        hasGenuineConflict = true;
      }
    }
  }

  const modeKey =
    (!structOk || hasGenuineConflict) ? 'UNKNOWN_OR_MISSING' :
    hasMissingHp01SiteInputs ? 'SITE_MISSING' :
    (commandedDefrost && hp01.running) ? 'DEFROST' :
    (hp01.running && isFiniteNum(hp01.qWaterHeatingW) && hp01.qWaterHeatingW > 0) ? 'HEATING' :
    'STOPPED';

  // Exact solveR513ACycle keys from src/physics/fluid_and_thermo.mjs:347-379 (no arbitrary 50 kPa / 1.05..12 bounds!)
  const refCycleIsValid = Boolean(
    modeKey === 'HEATING' &&
    hp01?.running === true &&
    rc && typeof rc === 'object' &&
    rc.active === true &&
    rc.mode === 'HEATING' &&
    isPosFinite(rc.pEvapAbsPa) &&
    isPosFinite(rc.pCondAbsPa) && rc.pCondAbsPa > rc.pEvapAbsPa &&
    isFiniteNum(rc.tEvapC) && isFiniteNum(rc.tCondC) && rc.tCondC > rc.tEvapC &&
    isPosFinite(rc.compressorShaftPowerW) &&
    isPosFinite(rc.compressorDriveMotorEta) && rc.compressorDriveMotorEta <= 1.0 &&
    isPosFinite(rc.massFlowMainKgS) &&
    isNonNegFinite(rc.massFlowEconKgS) &&
    isPosFinite(rc.massFlowTotalKgS)
  );

  const refCycleInvalidReasonHe = refCycleIsValid
    ? null
    : (HP01_CUTAWAY_TEXT_HE.refCycleInvalidReasons[modeKey] || HP01_CUTAWAY_TEXT_HE.refCycleInvalidReasons.UNKNOWN_OR_MISSING);

  return {
    structOk,
    hasMissingHp01SiteInputs,
    commandedDefrost,
    hasGenuineConflict,
    modeKey,
    refCycleIsValid,
    refCycleInvalidReasonHe
  };
}

/**
 * Builds a complete, deeply-frozen own-copy view model for HP01 cutaway inspection & 3D rendering.
 */
export function buildHP01CutawayViewModel(sim, unitPrefs = {}, uiOptions = {}) {
  const simGraph = sim && typeof sim === 'object' ? collectObjectGraphWeakSet(sim) : null;
  const u = normalizeUnitPrefs(unitPrefs);
  const evalState = evaluateHP01ModeAndValidity(sim);
  const {
    structOk,
    hasMissingHp01SiteInputs,
    commandedDefrost,
    hasGenuineConflict,
    modeKey,
    refCycleIsValid,
    refCycleInvalidReasonHe
  } = evalState;

  const st = structOk ? sim.state : null;
  const hp01 = structOk ? st.hp01 : null;
  const hp = structOk ? st.hp : null;
  const hyd = structOk ? st.hydraulics : null;
  const rc = structOk ? hp01?.refrigerantCycle : null;
  const dataset = structOk ? sim.dataset : null;
  const globalInvalid = modeKey === 'UNKNOWN_OR_MISSING' || modeKey === 'SITE_MISSING';

  // Helper for scalar telemetry fields (never substitutes fake numbers!)
  const makeScalarField = ({
    rawVal,
    validPred,
    dimension,
    fromUnit,
    toUnit,
    unitSuffix,
    decimals,
    missingTextHe,
    badgeHe = null
  }) => {
    if (globalInvalid || !validPred(rawVal)) {
      const fallbackText =
        modeKey === 'SITE_MISSING'
          ? HP01_CUTAWAY_TEXT_HE.refCycleInvalidReasons.SITE_MISSING
          : (missingTextHe || HP01_CUTAWAY_TEXT_HE.missingFallbacks.generic);
      return {
        rawValue: null,
        convertedValue: null,
        unit: unitSuffix,
        isValid: false,
        status: modeKey === 'SITE_MISSING' ? 'SITE_MISSING' : 'UNKNOWN_OR_MISSING',
        displayTextHe: fallbackText,
        badgeHe: null
      };
    }
    const conv = dimension ? convertValue(dimension, Number(rawVal), fromUnit, toUnit) : Number(rawVal);
    return {
      rawValue: Number(rawVal),
      convertedValue: Number(conv),
      unit: unitSuffix,
      isValid: true,
      status: 'OK',
      displayTextHe: `${Number(conv).toFixed(decimals)} ${unitSuffix}`,
      badgeHe: badgeHe ? String(badgeHe) : null
    };
  };

  // 1. WATER LOOP TELEMETRY & INDEPENDENT FLOW SWITCH (S2P-02)
  const rawTIn = hp01?.enteringWaterTempC;
  const rawTOut = hp01?.leavingWaterTempC;
  const waterTIn = makeScalarField({
    rawVal: rawTIn,
    validPred: isFiniteNum,
    dimension: 'temperature',
    fromUnit: 'C',
    toUnit: u.temp,
    unitSuffix: u.tempLabel,
    decimals: u.tempDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.generic
  });
  const waterTOut = makeScalarField({
    rawVal: rawTOut,
    validPred: isFiniteNum,
    dimension: 'temperature',
    fromUnit: 'C',
    toUnit: u.temp,
    unitSuffix: u.tempLabel,
    decimals: u.tempDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.generic
  });

  // Temperature difference deltaT: NEVER shifts by +273.15 when temp === 'K'!
  const rawDeltaT = isFiniteNum(rawTIn) && isFiniteNum(rawTOut) ? (rawTOut - rawTIn) : null;
  const waterDeltaT = makeScalarField({
    rawVal: rawDeltaT,
    validPred: isFiniteNum,
    dimension: null, // 1 ΔK === 1 Δ°C
    fromUnit: 'K',
    toUnit: 'K',
    unitSuffix: 'K (ΔT)',
    decimals: 2,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.generic
  });

  // LWT Setpoint from dataset.hp01.leavingWaterTempSetpointC (never substitutes 50.0 °C!)
  const spParam = dataset?.hp01?.leavingWaterTempSetpointC;
  const spValid = Boolean(
    spParam && typeof spParam === 'object' &&
    spParam.status !== 'missing_data' &&
    isFiniteNum(spParam.value)
  );
  const waterLwtSetpoint = makeScalarField({
    rawVal: spValid ? spParam.value : null,
    validPred: isFiniteNum,
    dimension: 'temperature',
    fromUnit: 'C',
    toUnit: u.temp,
    unitSuffix: u.tempLabel,
    decimals: u.tempDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.setpoint
  });

  // Primary water flowM3S (never substitutes 0.00 L/s when missing/invalid!)
  const rawFlowM3S = hyd?.ppResult?.flowM3S;
  const waterFlow = makeScalarField({
    rawVal: rawFlowM3S,
    validPred: isNonNegFinite,
    dimension: 'flow',
    fromUnit: 'm3/s',
    toUnit: u.flow,
    unitSuffix: u.flowLabel,
    decimals: u.flowDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.waterFlow
  });

  const flowLsForContext = isNonNegFinite(rawFlowM3S) ? convertValue('flow', rawFlowM3S, 'm3/s', 'L/s') : null;

  // Independent water loop sub-state (S2P-02)
  const waterLoopSubState =
    (!structOk || !isNonNegFinite(rawFlowM3S)) ? 'WATER_FLOW_UNKNOWN' :
    (rawFlowM3S > EPS_VISUAL_FLOW_M3S) ? 'WATER_CIRCULATING' :
    'WATER_NO_FLOW';

  // Independent Flow Switch FS-HP01 status read strictly from sim.state.flowSwitchClosed (S2P-02)
  const rawFs = st?.flowSwitchClosed;
  let fsField;
  if (!structOk || typeof rawFs !== 'boolean') {
    fsField = {
      rawValue: null,
      isValid: false,
      status: 'UNKNOWN_OR_MISSING',
      displayTextHe: HP01_CUTAWAY_TEXT_HE.flowSwitchMessages.unknownState,
      oemProtectionThresholdLs: OEM_FLOW_SWITCH_MIN_LS,
      oemDelaySeconds: 6
    };
  } else if (rawFs === true) {
    const msg =
      flowLsForContext === null ? HP01_CUTAWAY_TEXT_HE.flowSwitchMessages.closedUnknownFlow :
      flowLsForContext >= OEM_FLOW_SWITCH_MIN_LS ? HP01_CUTAWAY_TEXT_HE.flowSwitchMessages.closedVerified :
      HP01_CUTAWAY_TEXT_HE.flowSwitchMessages.closedBelowThreshold;
    fsField = {
      rawValue: true,
      isValid: true,
      status: 'CLOSED',
      displayTextHe: msg,
      oemProtectionThresholdLs: OEM_FLOW_SWITCH_MIN_LS,
      oemDelaySeconds: 6
    };
  } else {
    // rawFs === false: distinguish forced open at normal flow vs low flow vs unknown flow
    const isForcedAtNormalFlow = flowLsForContext !== null && flowLsForContext >= OEM_FLOW_SWITCH_MIN_LS;
    const msg =
      flowLsForContext === null ? HP01_CUTAWAY_TEXT_HE.flowSwitchMessages.openUnknownFlow :
      isForcedAtNormalFlow ? HP01_CUTAWAY_TEXT_HE.flowSwitchMessages.openForcedAtNormalFlow :
      HP01_CUTAWAY_TEXT_HE.flowSwitchMessages.openLowFlow;
    fsField = {
      rawValue: false,
      isValid: true,
      status: isForcedAtNormalFlow ? 'OPEN_FORCED_AT_NORMAL_FLOW' : 'OPEN',
      displayTextHe: msg,
      oemProtectionThresholdLs: OEM_FLOW_SWITCH_MIN_LS,
      oemDelaySeconds: 6
    };
  }

  // Water Pressures: hp01InletGaugePa, hp01OutletGaugePa, hp01DeltaPPa, and separate ppDischargeGaugePa
  const gaugeUnitSuffix = `${u.pressure}(g)`;
  const deltaPUnitSuffix = `Δ${u.pressure}`;
  const waterInletGauge = makeScalarField({
    rawVal: hyd?.hp01InletGaugePa,
    validPred: isFiniteNum,
    dimension: 'pressure',
    fromUnit: 'Pa',
    toUnit: u.pressure,
    unitSuffix: gaugeUnitSuffix,
    decimals: u.pressureDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.inletPressure
  });
  const waterOutletGauge = makeScalarField({
    rawVal: hyd?.hp01OutletGaugePa,
    validPred: isFiniteNum,
    dimension: 'pressure',
    fromUnit: 'Pa',
    toUnit: u.pressure,
    unitSuffix: gaugeUnitSuffix,
    decimals: u.pressureDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.outletPressure
  });
  const waterDeltaP = makeScalarField({
    rawVal: hyd?.hp01DeltaPPa,
    validPred: isNonNegFinite,
    dimension: 'pressure',
    fromUnit: 'Pa',
    toUnit: u.pressure,
    unitSuffix: deltaPUnitSuffix,
    decimals: u.pressureDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.deltaPressure
  });
  const pumpDischargeGauge = makeScalarField({
    rawVal: hyd?.ppDischargeGaugePa,
    validPred: isFiniteNum,
    dimension: 'pressure',
    fromUnit: 'Pa',
    toUnit: u.pressure,
    unitSuffix: gaugeUnitSuffix,
    decimals: u.pressureDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.generic,
    badgeHe: 'לחץ סניקה PP01A (בנפרד מכניסת HP01)'
  });

  // 2. AGGREGATE UNIT THERMAL & ELECTRICAL POWERS + COP
  const qWaterBadge =
    modeKey === 'DEFROST' ? HP01_CUTAWAY_TEXT_HE.defrostExternalWaterBalanceBadgeHe :
    (modeKey === 'STOPPED' && waterLoopSubState === 'WATER_CIRCULATING')
      ? HP01_CUTAWAY_TEXT_HE.stoppedWithWaterCirculationBadgeHe
      : null;

  const unitQWater = makeScalarField({
    rawVal: hp01?.qWaterHeatingW,
    validPred: isFiniteNum,
    dimension: 'power',
    fromUnit: 'W',
    toUnit: u.power,
    unitSuffix: u.power,
    decimals: u.powerDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.waterPower,
    badgeHe: qWaterBadge
  });

  const unitQAir = makeScalarField({
    rawVal: hp01?.qAirAbsorbedW,
    validPred: isFiniteNum,
    dimension: 'power',
    fromUnit: 'W',
    toUnit: u.power,
    unitSuffix: u.power,
    decimals: u.powerDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.airPower,
    badgeHe: 'נתון כולל ל-HP01'
  });

  const unitPElTotal = makeScalarField({
    rawVal: hp01?.pElTotalW,
    validPred: isNonNegFinite,
    dimension: 'power',
    fromUnit: 'W',
    toUnit: u.power,
    unitSuffix: u.power,
    decimals: u.powerDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.elecPower,
    badgeHe: 'נתון כולל ל-HP01'
  });

  const unitPElCompressorsAggregate = makeScalarField({
    rawVal: hp01?.pElCompressorsW,
    validPred: isNonNegFinite,
    dimension: 'power',
    fromUnit: 'W',
    toUnit: u.power,
    unitSuffix: u.power,
    decimals: u.powerDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.generic,
    badgeHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.compAggregateNote
  });

  const unitPElFansAggregate = makeScalarField({
    rawVal: hp01?.pElFansW,
    validPred: isNonNegFinite,
    dimension: 'power',
    fromUnit: 'W',
    toUnit: u.power,
    unitSuffix: u.power,
    decimals: u.powerDecimals,
    missingTextHe: HP01_CUTAWAY_TEXT_HE.missingFallbacks.generic,
    badgeHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.fanAggregateNote
  });

  // COP: valid ONLY in HEATING with positive finite value
  const rawCop = hp01?.instantaneousUnitCOP;
  let unitCop;
  if (modeKey === 'HEATING' && isPosFinite(rawCop)) {
    unitCop = {
      rawValue: Number(rawCop),
      convertedValue: Number(rawCop),
      unit: 'W/W',
      isValid: true,
      status: 'OK',
      displayTextHe: `${Number(rawCop).toFixed(3)} W/W`,
      badgeHe: 'נתון כולל ל-HP01'
    };
  } else {
    const copReason =
      modeKey === 'DEFROST' ? HP01_CUTAWAY_TEXT_HE.missingFallbacks.copDefrost :
      modeKey === 'STOPPED' ? HP01_CUTAWAY_TEXT_HE.missingFallbacks.copStopped :
      modeKey === 'SITE_MISSING' ? HP01_CUTAWAY_TEXT_HE.refCycleInvalidReasons.SITE_MISSING :
      HP01_CUTAWAY_TEXT_HE.missingFallbacks.generic;
    unitCop = {
      rawValue: null,
      convertedValue: null,
      unit: 'W/W',
      isValid: false,
      status: modeKey === 'DEFROST' || modeKey === 'STOPPED' ? 'NOT_APPLICABLE_IN_MODE' : 'UNKNOWN_OR_MISSING',
      displayTextHe: copReason,
      badgeHe: null
    };
  }

  // 3. REFRIGERANT CYCLE KPIs ([data-ref-kpi]) — Gated by refCycleIsValid (S2P-07)
  const makeRefDualPressureKpi = (absPa, barGauge) => {
    if (!refCycleIsValid || !isPosFinite(absPa) || !isFiniteNum(barGauge)) {
      return {
        rawValue: null,
        convertedValue: null,
        convertedGaugeValue: null,
        unit: `${u.pressure}(a) / ${u.pressure}(g)`,
        isValid: false,
        status: 'INVALID_REF_CYCLE',
        displayTextHe: refCycleInvalidReasonHe
      };
    }
    const convAbs = convertValue('pressure', Number(absPa), 'Pa', u.pressure);
    const convGauge = convertValue('pressure', Number(barGauge), 'bar', u.pressure);
    return {
      rawValue: Number(absPa),
      rawBarGauge: Number(barGauge),
      convertedValue: Number(convAbs),
      convertedGaugeValue: Number(convGauge),
      unit: `${u.pressure}(a) / ${u.pressure}(g)`,
      isValid: true,
      status: 'OK',
      displayTextHe: `${Number(convAbs).toFixed(u.pressureDecimals)} ${u.pressure}(a) / ${Number(convGauge).toFixed(u.pressureDecimals)} ${u.pressure}(g)`
    };
  };

  const makeRefScalarKpi = ({ rawVal, dimension, fromUnit, toUnit, unitSuffix, decimals, scaleFactor = 1.0 }) => {
    if (!refCycleIsValid || !isFiniteNum(rawVal)) {
      return {
        rawValue: null,
        convertedValue: null,
        unit: unitSuffix,
        isValid: false,
        status: 'INVALID_REF_CYCLE',
        displayTextHe: refCycleInvalidReasonHe
      };
    }
    const scaled = Number(rawVal) * scaleFactor;
    const conv = dimension ? convertValue(dimension, scaled, fromUnit, toUnit) : scaled;
    return {
      rawValue: Number(rawVal),
      convertedValue: Number(conv),
      unit: unitSuffix,
      isValid: true,
      status: 'OK',
      displayTextHe: `${Number(conv).toFixed(decimals)} ${unitSuffix}`
    };
  };

  const rawPressureRatio =
    refCycleIsValid && isPosFinite(rc?.pEvapAbsPa) && isPosFinite(rc?.pCondAbsPa)
      ? rc.pCondAbsPa / rc.pEvapAbsPa
      : null;

  // F03: Strict boolean evaluation for diagnostic & operational flags (never converts undefined/null/"false" to false/true!)
  const withinCoolPropDiag = evaluateStrictBooleanField(rc?.withinCoolPropDomain, {
    gatedValid: refCycleIsValid,
    trueStatus: 'WITHIN_DOMAIN',
    falseStatus: 'OUTSIDE_DOMAIN',
    trueTextHe: HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.coolPropWithinHe,
    falseTextHe: HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.coolPropOutsideHe,
    unknownTextHe: HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.coolPropUnknownHe
  });

  const economizerActiveDiag = evaluateStrictBooleanField(rc?.economizerActive, {
    gatedValid: refCycleIsValid,
    trueStatus: 'ACTIVE',
    falseStatus: 'INACTIVE',
    trueTextHe: HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.econActiveTrueHe,
    falseTextHe: HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.econActiveFalseHe,
    unknownTextHe: HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.econActiveUnknownHe
  });

  const rawOutOfMapInput = hp01?.outOfMap;
  const outOfMapDiag = evaluateStrictBooleanField(rawOutOfMapInput, {
    gatedValid: structOk && !globalInvalid,
    trueStatus: 'OUT_OF_MAP',
    falseStatus: 'WITHIN_MAP',
    trueTextHe: HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.outOfMapTrueHe,
    falseTextHe: HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.outOfMapFalseHe,
    unknownTextHe: HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.outOfMapUnknownHe
  });

  const refCycle = {
    isValid: refCycleIsValid,
    invalidReasonHe: refCycleInvalidReasonHe,
    withinCoolPropDomain: withinCoolPropDiag,
    economizerActive: economizerActiveDiag,
    outOfMap: outOfMapDiag,
    diagnostics: {
      withinCoolPropDomain: withinCoolPropDiag,
      economizerActive: economizerActiveDiag,
      outOfMap: outOfMapDiag
    },
    kpis: {
      pEvap: makeRefDualPressureKpi(rc?.pEvapAbsPa, rc?.pEvapBarGauge),
      pCond: makeRefDualPressureKpi(rc?.pCondAbsPa, rc?.pCondBarGauge),
      tEvap: makeRefScalarKpi({
        rawVal: rc?.tEvapC,
        dimension: 'temperature',
        fromUnit: 'C',
        toUnit: u.temp,
        unitSuffix: u.tempLabel,
        decimals: u.tempDecimals
      }),
      tCond: makeRefScalarKpi({
        rawVal: rc?.tCondC,
        dimension: 'temperature',
        fromUnit: 'C',
        toUnit: u.temp,
        unitSuffix: u.tempLabel,
        decimals: u.tempDecimals
      }),
      suctionSuperheat: makeRefScalarKpi({
        rawVal: rc?.suctionSuperheatK,
        dimension: null, // ΔT: never add +273.15
        fromUnit: 'K',
        toUnit: 'K',
        unitSuffix: 'K (ΔT)',
        decimals: 2
      }),
      dischargeSuperheat: makeRefScalarKpi({
        rawVal: rc?.dischargeSuperheatK,
        dimension: null, // ΔT: never add +273.15
        fromUnit: 'K',
        toUnit: 'K',
        unitSuffix: 'K (ΔT)',
        decimals: 2
      }),
      subcooling: makeRefScalarKpi({
        rawVal: rc?.subcoolingK,
        dimension: null, // ΔT: never add +273.15
        fromUnit: 'K',
        toUnit: 'K',
        unitSuffix: 'K (ΔT)',
        decimals: 2
      }),
      massFlowMain: makeRefScalarKpi({
        rawVal: rc?.massFlowMainKgS,
        dimension: null,
        fromUnit: 'kg/s',
        toUnit: 'kg/s',
        unitSuffix: 'kg/s',
        decimals: 4
      }),
      massFlowEcon: makeRefScalarKpi({
        rawVal: rc?.massFlowEconKgS,
        dimension: null,
        fromUnit: 'kg/s',
        toUnit: 'kg/s',
        unitSuffix: 'kg/s',
        decimals: 4
      }),
      massFlowTotal: makeRefScalarKpi({
        rawVal: rc?.massFlowTotalKgS,
        dimension: null,
        fromUnit: 'kg/s',
        toUnit: 'kg/s',
        unitSuffix: 'kg/s',
        decimals: 4
      }),
      shaftPower: makeRefScalarKpi({
        rawVal: rc?.compressorShaftPowerW,
        dimension: 'power',
        fromUnit: 'W',
        toUnit: u.power,
        unitSuffix: u.power,
        decimals: u.powerDecimals
      }),
      motorEta: makeRefScalarKpi({
        rawVal: rc?.compressorDriveMotorEta,
        dimension: null,
        fromUnit: '%',
        toUnit: '%',
        unitSuffix: '%',
        decimals: 2,
        scaleFactor: 100.0
      }),
      pressureRatio: makeRefScalarKpi({
        rawVal: rawPressureRatio,
        dimension: null,
        fromUnit: '-',
        toUnit: '-',
        unitSuffix: 'pCond/pEvap',
        decimals: 3
      })
    }
  };

  // 4. DOCUMENTED VALVE STATES & ANIMATION DIRECTIVES (6-State Matrix)
  const visualPaused = Boolean(uiOptions?.visualPaused);
  const fanSpeedPct =
    modeKey === 'HEATING' && isPosFinite(hp?.fanSpeedPct) ? Number(hp.fanSpeedPct) : 0;

  const statesByAuxId = {};
  for (const [auxId, auxMeta] of Object.entries(HP01_AUX_VALVES)) {
    if (globalInvalid) {
      statesByAuxId[auxId] = {
        state: 'UNKNOWN',
        stateCode: 'UNKNOWN',
        isStateUnknown: true,
        displayTextHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.valveUnknownBySystemMode,
        provenanceBadgeHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.valveDocStateBadge
      };
    } else if (
      modeKey === 'HEATING' &&
      (auxMeta.categoryKey === 'EXV-ECON' || auxMeta.categoryKey === 'LIQ-POST-FILT')
    ) {
      // F03: When economizerActive is unknown (null) or refCycle is invalid, never present the economizer valve/tap as reliably open or closed!
      if (!refCycleIsValid || economizerActiveDiag.rawValue === null) {
        statesByAuxId[auxId] = {
          state: 'UNKNOWN_ECON_STATE',
          stateCode: 'UNKNOWN_ECON_STATE',
          isStateUnknown: true,
          displayTextHe: HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.econActiveUnknownHe,
          provenanceBadgeHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.valveDocStateBadge
        };
      } else if (economizerActiveDiag.rawValue === true) {
        const openCode = auxMeta.categoryKey === 'EXV-ECON' ? 'OPEN_MODULATING' : 'SPLIT_MAIN_AND_ECON';
        statesByAuxId[auxId] = {
          state: openCode,
          stateCode: openCode,
          isStateUnknown: false,
          displayTextHe: `${openCode} — ${HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.econActiveTrueHe}`,
          provenanceBadgeHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.valveDocStateBadge
        };
      } else {
        const closedCode = auxMeta.categoryKey === 'EXV-ECON' ? 'CLOSED_PART_LOAD' : 'MAIN_ONLY';
        statesByAuxId[auxId] = {
          state: closedCode,
          stateCode: closedCode,
          isStateUnknown: false,
          displayTextHe: `${closedCode} — ${HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.econActiveFalseHe}`,
          provenanceBadgeHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.valveDocStateBadge
        };
      }
    } else {
      const code = auxMeta.statesByMode[modeKey] || 'UNKNOWN';
      statesByAuxId[auxId] = {
        state: code,
        stateCode: code,
        isStateUnknown: code === 'UNKNOWN' || code === 'UNKNOWN_TOPOLOGY',
        displayTextHe: `${code} — ${HP01_CUTAWAY_TEXT_HE.telemetryNotes.valveDocStateBadge}`,
        provenanceBadgeHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.valveDocStateBadge
      };
    }
  }

  // Per-connection animation directives for all 48 unique connections
  const connectionDirectives = {};
  for (const [connId, connMeta] of Object.entries(HP01_INTERNAL_CONNECTIONS)) {
    if (connMeta.animationType === 'STATIC_GEOMETRY_NO_PARTICLES' || globalInvalid) {
      connectionDirectives[connId] = {
        active: false,
        direction: 0,
        speed: 0,
        branchState: connMeta.animationType === 'STATIC_GEOMETRY_NO_PARTICLES' ? 'STATIC_NO_PARTICLES' : 'UNKNOWN_SYSTEM_MODE',
        isStateUnknown: connMeta.provenance === 'UNKNOWN_TOPOLOGY' || globalInvalid,
        speedSource: connMeta.animationType === 'STATIC_GEOMETRY_NO_PARTICLES' ? 'STATIC_NO_PARTICLES' : 'BLOCKED_UNKNOWN_MODE'
      };
      continue;
    }

    if (connMeta.mediumDomain === 'PRIMARY_WATER') {
      const waterActive = waterLoopSubState === 'WATER_CIRCULATING';
      const waterUnknown = waterLoopSubState === 'WATER_FLOW_UNKNOWN';
      const waterSpeed = waterActive
        ? (visualPaused ? 0 : Math.min(1.2, Math.max(0.15, Number(rawFlowM3S) * 14.0)))
        : 0;
      connectionDirectives[connId] = {
        active: waterActive,
        direction: waterActive ? +1 : 0,
        speed: waterSpeed,
        branchState: waterActive ? 'OPEN_ACTIVE' : waterUnknown ? 'UNKNOWN_WATER_FLOW' : 'STOPPED_NO_FLOW',
        isStateUnknown: waterUnknown,
        speedSource: waterActive ? 'MEASURED_WATER_FLOW_M3S' : 'WATER_NO_FLOW_OR_UNKNOWN'
      };
      continue;
    }

    if (connMeta.mediumDomain.startsWith('AIR_')) {
      const airActive = modeKey === 'HEATING' && fanSpeedPct > 0;
      connectionDirectives[connId] = {
        active: airActive,
        direction: airActive ? +1 : 0,
        speed: airActive && !visualPaused ? (fanSpeedPct / 100.0) * 0.85 : 0,
        branchState: airActive ? 'OPEN_ACTIVE' : 'STOPPED_NO_FLOW',
        isStateUnknown: false,
        speedSource: airActive ? 'FAN_SPEED_PCT' : 'FANS_STOPPED'
      };
      continue;
    }

    // Refrigerant & Oil lines (CKT1 / CKT2)
    const dir = connMeta.directionByMode[modeKey] || 0;
    if (modeKey === 'HEATING') {
      const isEconLine = connId.endsWith('-10') || connId.endsWith('-11');
      if (!refCycleIsValid) {
        connectionDirectives[connId] = {
          active: false,
          direction: 0,
          speed: 0,
          branchState: 'UNKNOWN_INVALID_REF_CYCLE',
          isStateUnknown: true,
          speedSource: 'BLOCKED_INVALID_REF_CYCLE_IN_HEATING'
        };
      } else if (isEconLine) {
        // F03: Distinguish known true vs known false vs unknown (null) economizer state
        if (economizerActiveDiag.rawValue === null) {
          connectionDirectives[connId] = {
            active: false,
            direction: 0,
            speed: 0,
            branchState: 'UNKNOWN_ECON_STATE',
            isStateUnknown: true,
            speedSource: 'BLOCKED_UNKNOWN_ECON_STATE',
            displayNoteHe: HP01_CUTAWAY_TEXT_HE.booleanDiagnostics.econActiveUnknownHe
          };
        } else if (economizerActiveDiag.rawValue === true && dir !== 0) {
          const flowKgS = Number(rc?.massFlowEconKgS || 0);
          const speed = !visualPaused ? Math.min(1.2, Math.max(0.18, flowKgS * 0.16)) : 0;
          connectionDirectives[connId] = {
            active: true,
            direction: dir,
            speed,
            branchState: 'ACTIVE',
            isStateUnknown: false,
            speedSource: 'VALID_REF_CYCLE_MASSFLOW'
          };
        } else {
          connectionDirectives[connId] = {
            active: false,
            direction: 0,
            speed: 0,
            branchState: 'KNOWN_INACTIVE',
            isStateUnknown: false,
            speedSource: 'ECON_INACTIVE_IN_HEATING'
          };
        }
      } else {
        const lineOpen = dir !== 0;
        const flowKgS = Number(rc?.massFlowMainKgS || 0);
        const speed = lineOpen && !visualPaused ? Math.min(1.2, Math.max(0.18, flowKgS * 0.16)) : 0;
        connectionDirectives[connId] = {
          active: lineOpen,
          direction: lineOpen ? dir : 0,
          speed,
          branchState: lineOpen ? 'OPEN_ACTIVE' : 'CLOSED_IN_HEATING',
          isStateUnknown: false,
          speedSource: lineOpen ? 'VALID_REF_CYCLE_MASSFLOW' : 'CLOSED_IN_HEATING'
        };
      }
    } else if (modeKey === 'DEFROST') {
      // STRICT RULE (Req #5 & S2P-07): Never derive Defrost speed from invalid massFlowTotalKgS!
      const lineOpen = dir !== 0;
      connectionDirectives[connId] = {
        active: lineOpen,
        direction: lineOpen ? dir : 0,
        speed: lineOpen && !visualPaused ? V_QUAL_DEFROST : 0,
        branchState: lineOpen ? 'OPEN_QUALITATIVE_DEFROST' : 'CLOSED_IN_DEFROST',
        isStateUnknown: false,
        speedSource: lineOpen ? 'QUALITATIVE_OEM_ROUTE_CONSTANT' : 'CLOSED_IN_DEFROST'
      };
    } else {
      connectionDirectives[connId] = {
        active: false,
        direction: 0,
        speed: 0,
        branchState: 'STOPPED_COMPRESSOR_OFF',
        isStateUnknown: false,
        speedSource: 'COMPRESSOR_STOPPED'
      };
    }
  }

  const identity = resolveHP01EquipmentIdentity(
    uiOptions?.passportOverride !== undefined ? uiOptions.passportOverride : RTXC_PROTOTYPE_PASSPORT,
    uiOptions?.equipmentTagOverride !== undefined ? uiOptions.equipmentTagOverride : 'HP01'
  );
  const refrigerantCharge = resolveHP01RefrigerantChargeProvenance();

  const viewModel = {
    meta: {
      equipmentId: identity.equipmentId,
      shortModelNameText: identity.shortModelNameText,
      prototypeConfigCodeText: identity.prototypeConfigCodeText,
      equipmentSchemaTag: identity.equipmentSchemaTag,
      shortModelName: identity.shortModelName,
      prototypeConfigCode: identity.prototypeConfigCode,
      refrigerantCharge,
      simTimeSeconds: structOk && isFiniteNum(st?.simTimeSeconds) ? Number(st.simTimeSeconds) : null,
      datasetMode: dataset?.mode && typeof dataset.mode === 'string' ? dataset.mode : 'UNKNOWN',
      ownCopyVerified: true
    },
    modeKey,
    modeBannerHe: HP01_CUTAWAY_TEXT_HE.modeBanners[modeKey] || HP01_CUTAWAY_TEXT_HE.modeBanners.UNKNOWN_OR_MISSING,
    commandedDefrost,
    hasGenuineConflict,
    hasMissingHp01SiteInputs,
    visualPaused,
    unitPrefs: u,
    water: {
      tIn: waterTIn,
      tOut: waterTOut,
      deltaT: waterDeltaT,
      lwtSetpoint: waterLwtSetpoint,
      flow: waterFlow,
      inletGaugePressure: waterInletGauge,
      outletGaugePressure: waterOutletGauge,
      deltaP: waterDeltaP,
      pumpDischargeGauge,
      flowSwitchClosed: fsField,
      loopSubState: waterLoopSubState,
      loopSubStateBannerHe: HP01_CUTAWAY_TEXT_HE.waterLoopSubStates[waterLoopSubState],
      visualFlowCutoffM3S: EPS_VISUAL_FLOW_M3S,
      visualFlowCutoffNoteHe: HP01_CUTAWAY_TEXT_HE.visualFlowCutoffNoteHe
    },
    unit: {
      identity,
      refrigerantCharge,
      qWater: unitQWater,
      qAir: unitQAir,
      pElTotal: unitPElTotal,
      pElCompressorsAggregate: unitPElCompressorsAggregate,
      compIndividualTelemetry: {
        rawValue: null,
        convertedValue: null,
        isValid: false,
        status: 'MISSING_DATA',
        displayTextHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.compIndividualMissing
      },
      pElFansAggregate: unitPElFansAggregate,
      fanIndividualRpm: {
        rawValue: null,
        convertedValue: null,
        isValid: false,
        status: 'MISSING_DATA',
        displayTextHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.fanIndividualRpmMissing
      },
      cop: unitCop
    },
    refCycle,
    valves: {
      statesByAuxId,
      auxValveStates: statesByAuxId,
      exvOpeningFeedback: {
        rawValue: null,
        convertedValue: null,
        isValid: false,
        status: 'MISSING_DATA',
        displayTextHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.exvOpeningMissing
      },
      unknownBranchCk07bNoteHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.unknownTopologyBranchNote
    },
    heaters230v: {
      specPowerSupply: '230VAC / 1Ph / 50Hz / 16A (חיצוני עצמאי)',
      specThermostatSetpointC: 2.8,
      actualWorkStatus: null,
      status: 'MISSING_DATA',
      displayTextHe: HP01_CUTAWAY_TEXT_HE.telemetryNotes.heater230vActualMissing
    },
    animation: {
      compressorRotorsRadPerSec:
        visualPaused ? 0 :
        modeKey === 'HEATING' && refCycleIsValid ? 8.5 :
        modeKey === 'DEFROST' ? 5.0 : 0,
      fansRadPerSec:
        visualPaused ? 0 :
        modeKey === 'HEATING' && fanSpeedPct > 0 ? (fanSpeedPct / 100.0) * 12.0 : 0,
      defrostQualitativeNoteHe:
        modeKey === 'DEFROST' ? HP01_CUTAWAY_TEXT_HE.defrostQualitativeRouteNoteHe : null,
      connectionDirectives
    }
  };

  return deepFreezeOwnCopy(viewModel, simGraph);
}
