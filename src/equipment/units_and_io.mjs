/**
 * Section 9, 13 & 15 — Unit Conversion Engine & JSON Import/Export Validator
 * - All internal calculations run strictly in SI (m³/s, kg/s, Pa, m, W, J, K / °C).
 * - Forward and inverse unit conversion preserves the exact physical value.
 * - JSON import validates schema version, structure, types, units, and physical bounds
 *   before applying; an invalid file never corrupts the active model.
 */

export const UNIT_SYSTEMS = Object.freeze({
  SI_ENGINEERING: 'SI_ENGINEERING', // L/s, bar, °C, kW, kWh
  SI_STRICT: 'SI_STRICT',           // m³/s, kPa/Pa, K, W, J
  METRIC_M3H: 'METRIC_M3H'          // m³/h, bar, °C, kW, kWh
});

export const UNIT_CONVERTERS = Object.freeze({
  flow: {
    'm3/s': { toSI: (v) => v, fromSI: (v) => v, label: 'm³/s' },
    'L/s':  { toSI: (v) => v / 1e3, fromSI: (v) => v * 1e3, label: 'ל/שנ׳ (L/s)' },
    'm3/h': { toSI: (v) => v / 3600.0, fromSI: (v) => v * 3600.0, label: 'מ"ק/ש׳ (m³/h)' }
  },
  pressure: {
    'Pa':  { toSI: (v) => v, fromSI: (v) => v, label: 'Pa' },
    'kPa': { toSI: (v) => v * 1e3, fromSI: (v) => v / 1e3, label: 'kPa' },
    'bar': { toSI: (v) => v * 1e5, fromSI: (v) => v / 1e5, label: 'בר (bar)' }
  },
  temperature: {
    'C': { toSI: (v) => v + 273.15, fromSI: (v) => v - 273.15, label: '°C' },
    'K': { toSI: (v) => v, fromSI: (v) => v, label: 'K' },
    'F': { toSI: (v) => (v - 32.0) * (5.0 / 9.0) + 273.15, fromSI: (v) => (v - 273.15) * (9.0 / 5.0) + 32.0, label: '°F' }
  },
  power: {
    'W':  { toSI: (v) => v, fromSI: (v) => v, label: 'W' },
    'kW': { toSI: (v) => v * 1e3, fromSI: (v) => v / 1e3, label: 'kW' }
  },
  energy: {
    'J':   { toSI: (v) => v, fromSI: (v) => v, label: 'J' },
    'kWh': { toSI: (v) => v * 3.6e6, fromSI: (v) => v / 3.6e6, label: 'kWh' }
  },
  head: {
    'm':  { toSI: (v) => v, fromSI: (v) => v, label: 'm' },
    'cm': { toSI: (v) => v / 100.0, fromSI: (v) => v * 100.0, label: 'cm' }
  }
});

export function convertValue(quantityType, value, fromUnit, toUnit) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const group = UNIT_CONVERTERS[quantityType];
  if (!group || !group[fromUnit] || !group[toUnit]) {
    throw new Error(`Unsupported unit conversion: ${quantityType} (${fromUnit} -> ${toUnit})`);
  }
  const siVal = group[fromUnit].toSI(value);
  return group[toUnit].fromSI(siVal);
}

/**
 * Formats a physical value for display according to the active UI unit system.
 */
export function formatDisplayValue(quantityType, siValue, unitSystem = UNIT_SYSTEMS.SI_ENGINEERING, decimals = 1) {
  if (siValue === null || siValue === undefined || Number.isNaN(siValue)) {
    return { text: 'אין נתונים / Нет данных', unit: '', numeric: null };
  }
  let targetUnit;
  switch (quantityType) {
    case 'flow':
      targetUnit = unitSystem === UNIT_SYSTEMS.METRIC_M3H ? 'm3/h' : unitSystem === UNIT_SYSTEMS.SI_STRICT ? 'm3/s' : 'L/s';
      break;
    case 'pressure':
      targetUnit = unitSystem === UNIT_SYSTEMS.SI_STRICT ? 'kPa' : 'bar';
      break;
    case 'delta_pressure':
      targetUnit = unitSystem === UNIT_SYSTEMS.SI_ENGINEERING ? 'kPa' : unitSystem === UNIT_SYSTEMS.SI_STRICT ? 'Pa' : 'bar';
      break;
    case 'temperature':
      // Internal temperature in state is stored in °C (with K available via +273.15)
      if (unitSystem === UNIT_SYSTEMS.SI_STRICT) {
        const kVal = siValue + 273.15;
        return { text: kVal.toFixed(decimals), unit: 'K', numeric: kVal };
      }
      return { text: siValue.toFixed(decimals), unit: '°C', numeric: siValue };
    case 'power':
      targetUnit = unitSystem === UNIT_SYSTEMS.SI_STRICT ? 'W' : 'kW';
      break;
    case 'energy':
      targetUnit = unitSystem === UNIT_SYSTEMS.SI_STRICT ? 'J' : 'kWh';
      break;
    default:
      return { text: Number(siValue).toFixed(decimals), unit: '', numeric: siValue };
  }

  const realQuantity = quantityType === 'delta_pressure' ? 'pressure' : quantityType;
  const conv = UNIT_CONVERTERS[realQuantity][targetUnit];
  const val = conv.fromSI(siValue);
  const actualDecimals = targetUnit === 'm3/s' ? 4 : targetUnit === 'bar' ? 2 : decimals;
  return {
    text: val.toFixed(actualDecimals),
    unit: conv.label,
    numeric: val
  };
}

import { CONSUMER_LOAD_TYPES, DATA_STATUS, evaluateMissingDataDependencies } from './datasets.mjs';

const VALID_STATUSES = new Set(Object.values(DATA_STATUS));
const VALID_LOAD_TYPES = new Set(Object.values(CONSUMER_LOAD_TYPES));

const AMBIENT_SCHEMA = {
  temperatureC: { type: 'number', unit: '°C', min: -45, max: 60, nullableInSite: false },
  relativeHumidityPct: { type: 'number', unit: '%', min: 0, max: 100, nullableInSite: false },
  altitudeM: { type: 'number', unit: 'm', min: -500, max: 5000, nullableInSite: false },
  barometricPressurePa: { type: 'number', unit: 'Pa', min: 70000, max: 110000, nullableInSite: false },
  strictPage48AmbientLimit: { type: 'boolean', unit: 'boolean', nullableInSite: false }
};

const HP01_SCHEMA = {
  leavingWaterTempSetpointC: { type: 'number', unit: '°C', min: 15, max: 60, nullableInSite: false },
  oilSumpPreheatedHours: { type: 'number', unit: 'h', min: 0, max: 1000, nullableInSite: false },
  evapAntiFreezeHeater230VAvailable: { type: 'boolean', unit: 'boolean', nullableInSite: false },
  glycolConcentrationPct: { type: 'number', unit: '%', min: 0, max: 60, nullableInSite: false }
};

const PRIMARY_LOOP_SCHEMA = {
  totalWaterVolumeM3: { type: 'number', unit: 'm3', min: 0.5, max: 100, nullableInSite: false },
  coldFillTempC: { type: 'number', unit: '°C', min: 1, max: 45, nullableInSite: false },
  initialStaticGaugePa: { type: 'number', unit: 'Pa', min: 20000, max: 900000, nullableInSite: false },
  et00VolumeM3: { type: 'number', unit: 'm3', min: 0.02, max: 10, nullableInSite: false },
  et00PrechargeGaugePa: { type: 'number', unit: 'Pa', min: 10000, max: 800000, nullableInSite: false },
  psv00SetpointGaugePa: { type: 'number', unit: 'Pa', min: 150000, max: 1600000, nullableInSite: false },
  pp01NominalHeadM: { type: 'number', unit: 'm', min: 1, max: 80, nullableInSite: false },
  pp01ShutoffHeadM: { type: 'number', unit: 'm', min: 2, max: 100, nullableInSite: false },
  pd01NominalHeadM: { type: 'number', unit: 'm', min: 1, max: 80, nullableInSite: false },
  pd01ShutoffHeadM: { type: 'number', unit: 'm', min: 2, max: 100, nullableInSite: false },
  distDeltaPSetpointPa: { type: 'number', unit: 'Pa', min: 10000, max: 500000, nullableInSite: false }
};

const WATER_CHEM_SCHEMA = {
  ph: { type: 'number', unit: 'pH', min: 4.0, max: 11.0, nullableInSite: true },
  conductivityUsCm: { type: 'number', unit: 'µS/cm', min: 1.0, max: 10000.0, nullableInSite: true },
  hardnessFrenchDeg: { type: 'number', unit: '°fH', min: 0.0, max: 100.0, nullableInSite: true },
  chloridesMgL: { type: 'number', unit: 'mg/L', min: 0.0, max: 2000.0, nullableInSite: true },
  reagentTankLevelPct: { type: 'number', unit: '%', min: 0.0, max: 100.0, nullableInSite: false },
  makeupPumpMaxGaugePa: { type: 'number', unit: 'Pa', min: 50000, max: 1500000, nullableInSite: false },
  makeupRegulatedTargetGaugePa: { type: 'number', unit: 'Pa', min: 20000, max: 600000, nullableInSite: false },
  makeupMaxSingleVolumeL: { type: 'number', unit: 'L', min: 1.0, max: 5000.0, nullableInSite: false },
  makeupMaxDurationS: { type: 'number', unit: 's', min: 1.0, max: 86400.0, nullableInSite: false }
};

const BRANCH_PARAM_SCHEMA = {
  hxNominalUA: { type: 'number', unit: 'W/K', min: 0, max: 500000, nullableInSite: false },
  hxHeatTransferAreaM2: { type: 'number', unit: 'm2', min: 0.1, max: 500, nullableInSite: false },
  hxMetalMassKg: { type: 'number', unit: 'kg', min: 1, max: 10000, nullableInSite: false },
  hxWaterVolumePerSideM3: { type: 'number', unit: 'm3', min: 0.001, max: 10, nullableInSite: false },
  hxFoulingResistanceM2KW: { type: 'number', unit: 'm2*K/W', min: 0, max: 0.05, nullableInSite: false },
  secondaryWaterVolumeM3: { type: 'number', unit: 'm3', min: 0.02, max: 50, nullableInSite: false },
  secondaryInitialGaugeRoofPa: { type: 'number', unit: 'Pa', min: 10000, max: 600000, nullableInSite: false },
  etVolumeM3: { type: 'number', unit: 'm3', min: 0.005, max: 5, nullableInSite: false },
  etPrechargeGaugePa: { type: 'number', unit: 'Pa', min: 5000, max: 500000, nullableInSite: false },
  psNominalHeadM: { type: 'number', unit: 'm', min: 0.5, max: 60, nullableInSite: false },
  psShutoffHeadM: { type: 'number', unit: 'm', min: 1.0, max: 80, nullableInSite: false },
  consumerElevationFromRoofM: { type: 'number', unit: 'm', min: -50, max: 30, nullableInSite: true },
  jacketMaxAllowablePressureGaugePa: { type: 'number', unit: 'Pa', min: 50000, max: 1600000, nullableInSite: true },
  psvSetpointGaugeRoofPa: { type: 'number', unit: 'Pa', min: 50000, max: 1600000, nullableInSite: false },
  secondarySupplyTempSetpointC: { type: 'number', unit: '°C', min: 10, max: 75, nullableInSite: false },
  processTargetTempC: { type: 'number', unit: '°C', min: 10, max: 75, nullableInSite: true },
  loadModelType: { type: 'enum', unit: 'enum', allowedValues: VALID_LOAD_TYPES, nullableInSite: false },
  nominalThermalDemandW: { type: 'number', unit: 'W', min: 0, max: 1000000, nullableInSite: false },
  processThermalMassJK: { type: 'number', unit: 'J/K', min: 1000, max: 5e8, nullableInSite: false },
  jacketUA: { type: 'number', unit: 'W/K', min: 10, max: 500000, nullableInSite: true }
};

function validateParamGroup(groupObj, groupName, schemaMap, mode, errors) {
  if (!groupObj || typeof groupObj !== 'object' || Array.isArray(groupObj)) {
    errors.push(`Missing or invalid section "${groupName}": expected plain object`);
    return;
  }
  for (const [fieldKey, rule] of Object.entries(schemaMap)) {
    const path = `${groupName}.${fieldKey}`;
    const rec = groupObj[fieldKey];
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      errors.push(`${path}: missing parameter record object`);
      continue;
    }
    if (rec.unit !== rule.unit) {
      errors.push(`${path}.unit: expected "${rule.unit}", got "${rec.unit}"`);
    }
    if (rec.status !== undefined && !VALID_STATUSES.has(rec.status)) {
      errors.push(`${path}.status: invalid provenance status "${rec.status}"`);
    }
    const val = rec.value;
    if (val === null) {
      if (!(mode === 'SITE' && rule.nullableInSite)) {
        errors.push(`${path}.value: null is not permitted in mode "${mode}"`);
      }
      continue;
    }
    if (rule.type === 'number') {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        errors.push(`${path}.value: must be a finite number, got ${String(val)}`);
      } else if (val < rule.min || val > rule.max) {
        errors.push(`${path}.value: ${val} ${rule.unit} is outside physical range [${rule.min}..${rule.max}]`);
      }
    } else if (rule.type === 'boolean') {
      if (typeof val !== 'boolean') {
        errors.push(`${path}.value: must be boolean, got ${typeof val}`);
      }
    } else if (rule.type === 'enum') {
      if (typeof val !== 'string' || !rule.allowedValues.has(val)) {
        errors.push(`${path}.value: invalid enum value "${String(val)}"`);
      }
    }
  }
}

/**
 * Validates an imported JSON payload for HP-RTXC-5HX before applying it (F07 fix).
 * Checks schemaVersion, projectCode, mode, all 4 global sections + 5 branches,
 * finite numbers, units, provenance statuses, physical bounds, and DEMO vs SITE nullability.
 * Never throws on malformed/null entries and never mutates the active model if validation fails.
 */
export function validateImportedDatasetJSON(jsonStringOrObj) {
  const errors = [];
  let parsed;
  try {
    parsed = typeof jsonStringOrObj === 'string' ? JSON.parse(jsonStringOrObj) : structuredClone(jsonStringOrObj);
  } catch (e) {
    return { valid: false, errors: [`JSON syntax error: ${e.message}`], data: null, parsed: null };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, errors: ['Root payload must be a non-null JSON object'], data: null, parsed: null };
  }
  if (parsed.schemaVersion !== '1.0.0') {
    errors.push(`Unsupported or missing schemaVersion: expected "1.0.0", got "${parsed.schemaVersion}"`);
  }
  if (parsed.projectCode !== 'HP-RTXC-5HX-REV1') {
    errors.push(`Invalid projectCode: expected "HP-RTXC-5HX-REV1", got "${parsed.projectCode}"`);
  }
  const mode = parsed.mode || parsed.datasetMode;
  if (!['DEMO', 'SITE'].includes(mode)) {
    errors.push(`Invalid dataset mode: "${mode}" (expected "DEMO" or "SITE")`);
  }

  validateParamGroup(parsed.ambient, 'ambient', AMBIENT_SCHEMA, mode, errors);
  validateParamGroup(parsed.hp01, 'hp01', HP01_SCHEMA, mode, errors);
  validateParamGroup(parsed.primaryLoop, 'primaryLoop', PRIMARY_LOOP_SCHEMA, mode, errors);
  validateParamGroup(parsed.waterChemistryAndMakeup, 'waterChemistryAndMakeup', WATER_CHEM_SCHEMA, mode, errors);

  // Cross-field pump head checks on primaryLoop
  if (
    parsed.primaryLoop?.pp01ShutoffHeadM?.value <= parsed.primaryLoop?.pp01NominalHeadM?.value
  ) {
    errors.push('primaryLoop.pp01ShutoffHeadM must be strictly greater than pp01NominalHeadM');
  }
  if (
    parsed.primaryLoop?.pd01ShutoffHeadM?.value <= parsed.primaryLoop?.pd01NominalHeadM?.value
  ) {
    errors.push('primaryLoop.pd01ShutoffHeadM must be strictly greater than pd01NominalHeadM');
  }

  if (!Array.isArray(parsed.branches) || parsed.branches.length !== 5) {
    errors.push(`Dataset must contain an Array of exactly 5 branches, found ${Array.isArray(parsed.branches) ? parsed.branches.length : typeof parsed.branches}`);
  } else {
    const seenIndices = new Set();
    parsed.branches.forEach((b, idx) => {
      const bPath = `branches[${idx}]`;
      if (!b || typeof b !== 'object' || Array.isArray(b)) {
        errors.push(`${bPath}: branch entry must be a non-null object`);
        return;
      }
      if (b.index !== idx + 1 || seenIndices.has(b.index)) {
        errors.push(`${bPath}.index: expected unique branch index ${idx + 1}, got ${String(b.index)}`);
      }
      seenIndices.add(b.index);
      validateParamGroup(b, bPath, BRANCH_PARAM_SCHEMA, mode, errors);
      if (b.psShutoffHeadM?.value <= b.psNominalHeadM?.value) {
        errors.push(`${bPath}.psShutoffHeadM must be strictly greater than psNominalHeadM`);
      }
    });
  }

  if (errors.length === 0) {
    parsed.mode = mode;
    parsed.datasetMode = mode;
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? parsed : null,
    parsed: errors.length === 0 ? parsed : null
  };
}

/**
 * Applies a validated dataset JSON object to a simulation instance and syncs initial dynamic states
 * so that subsequent simulation steps reflect all imported parameters (F07 fix).
 */
export function applyValidatedDatasetToSimulation(sim, validatedDataset) {
  const copySection = (targetSec, sourceSec) => {
    if (!targetSec || !sourceSec) return;
    for (const [k, rec] of Object.entries(sourceSec)) {
      if (targetSec[k] && rec && typeof rec === 'object' && 'value' in rec) {
        targetSec[k].value = rec.value;
        if (rec.status) targetSec[k].status = rec.status;
        if (rec.sourceId) targetSec[k].sourceId = rec.sourceId;
        if (rec.conditions) targetSec[k].conditions = rec.conditions;
      }
    }
  };

  sim.dataset.mode = validatedDataset.mode || validatedDataset.datasetMode || sim.dataset.mode;
  if (validatedDataset.uiUnitPrefs && typeof validatedDataset.uiUnitPrefs === 'object') {
    sim.dataset.uiUnitPrefs = { ...validatedDataset.uiUnitPrefs };
  }
  copySection(sim.dataset.ambient, validatedDataset.ambient);
  copySection(sim.dataset.hp01, validatedDataset.hp01);
  copySection(sim.dataset.primaryLoop, validatedDataset.primaryLoop);
  copySection(sim.dataset.waterChemistryAndMakeup, validatedDataset.waterChemistryAndMakeup);

  if (Array.isArray(validatedDataset.branches) && validatedDataset.branches.length === 5) {
    for (let i = 0; i < 5; i++) {
      const prevTarget = sim.dataset.branches[i]?.processTargetTempC?.value;
      copySection(sim.dataset.branches[i], validatedDataset.branches[i]);
      const pTarget = sim.dataset.branches[i].processTargetTempC.value;
      if (pTarget !== prevTarget) {
        sim.state.branches[i].processCoreTempC = pTarget !== null ? pTarget - 0.2 : null;
      }
    }
  }

  sim.missingDataReport = evaluateMissingDataDependencies(sim.dataset);
  return sim;
}

export function formatValueWithUnit(value, fromUnit, toUnit, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'אין נתונים';
  }
  const normUnit = (u) => {
    if (u === 'm³/s') return 'm3/s';
    if (u === 'm³/h') return 'm3/h';
    if (u === 'Pa_g' || u === 'Pa_a') return 'Pa';
    if (u === 'bar_g' || u === 'bar_a') return 'bar';
    if (u === '°C') return 'C';
    if (u === '°F') return 'F';
    return u;
  };
  const f = normUnit(fromUnit);
  const t = normUnit(toUnit);
  let qType = null;
  for (const [k, grp] of Object.entries(UNIT_CONVERTERS)) {
    if (grp[f] && grp[t]) {
      qType = k;
      break;
    }
  }
  if (!qType) {
    return `${Number(value).toFixed(decimals)} ${toUnit}`;
  }
  const convVal = convertValue(qType, value, f, t);
  const dec = t === 'm3/s' ? 4 : t === 'bar' ? 2 : decimals;
  return `${convVal.toFixed(dec)} ${toUnit}`;
}

export function exportSimulationSnapshotJSON(sim) {
  const payload = {
    ...sim.dataset,
    schemaVersion: '1.0.0',
    projectCode: 'HP-RTXC-5HX-REV1',
    mode: sim.dataset?.mode || 'DEMO',
    datasetMode: sim.dataset?.mode || 'DEMO',
    uiUnitPrefs: sim.dataset?.uiUnitPrefs || { flow: 'L/s', pressure: 'bar', temp: '°C', power: 'kW' },
    exportedAt: new Date().toISOString()
  };
  return JSON.stringify(payload, null, 2);
}

