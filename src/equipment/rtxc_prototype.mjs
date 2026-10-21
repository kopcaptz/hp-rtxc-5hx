/**
 * Stage 0 — Documented Prototype Passport & Source Registry
 * Equipment Basis: Trane RTXC Air-to-Water Screw Heat Pump
 * Primary Documented Source: Trane Installation, Operation and Maintenance Manual RTXC-SVX003E-EN (May 2026)
 * Secondary Source: Trane Israel Product Catalog (prodId=217)
 *
 * IMPORTANT ENGINEERING NOTE:
 * We select ONE specific documented execution from RTXC-SVX003E-EN without mixing parameters across models:
 * Prototype Model: RTXC 180 XE-HSE (with EC Condenser Fans, R513A Refrigerant, W/O Factory Pump Package)
 * Full 28-digit model code per Page 8 of RTXC-SVX003E-EN:
 *   R T X C 1 8 0 D H B 0 1 C B B A R F 0 D 0 N 0 N F E D N
 * This is a geometric and functional prototype for the engineering demonstration simulation,
 * NOT a final equipment selection for construction or procurement.
 */

export const DATA_STATUS = Object.freeze({
  CONFIRMED_BY_DOC: 'confirmed_by_doc',       // подтверждено документацией
  FROM_SITE: 'from_site',                     // получено с площадки
  ASSUMED_FOR_DEMO: 'assumed_for_demo',       // принято для демонстрации
  REQUIRES_CLARIFICATION: 'requires_clarification', // требует уточнения
  MISSING_DATA: 'missing_data'                // нет данных (блокирует зависимые расчёты)
});

export const DATA_STATUS_LABELS_RU = Object.freeze({
  [DATA_STATUS.CONFIRMED_BY_DOC]: 'Подтверждено документацией',
  [DATA_STATUS.FROM_SITE]: 'Получено с площадки',
  [DATA_STATUS.ASSUMED_FOR_DEMO]: 'Принято для демонстрации',
  [DATA_STATUS.REQUIRES_CLARIFICATION]: 'Требует уточнения',
  [DATA_STATUS.MISSING_DATA]: 'Нет данных'
});

export const DATA_STATUS_LABELS_HE = Object.freeze({
  [DATA_STATUS.CONFIRMED_BY_DOC]: 'מאומת בתיעוד יצרן',
  [DATA_STATUS.FROM_SITE]: 'נתון מהאתר',
  [DATA_STATUS.ASSUMED_FOR_DEMO]: 'הנחה להדגמה בלבד',
  [DATA_STATUS.REQUIRES_CLARIFICATION]: 'דורש הבהרה הנדסית',
  [DATA_STATUS.MISSING_DATA]: 'חסר מידע — חישוב תלוי חסום'
});

export const SOURCE_REGISTRY = Object.freeze({
  TRANE_IOM_0526: {
    id: 'TRANE_IOM_0526',
    title: 'Trane RTXC-XE / RTXC-XE-HSE Installation, Operation and Maintenance Manual',
    docCode: 'RTXC-SVX003E-EN (May 2026)',
    url: 'https://www.trane.com/Resources/Partners/38881ef3-310b-483f-8abd-3aab7397f57a/documents/RTXC-SVX003E-EN_0526.pdf',
    localCopy: 'docs/RTXC-SVX003E-EN_0526.pdf',
    notes: 'Primary technical reference for dimensions, weights, electrical data, water flow limits, Symbio 800 controls, and operating envelope.'
  },
  TRANE_IL_WEB: {
    id: 'TRANE_IL_WEB',
    title: 'Trane Israel Product Catalog — RTXC Air-to-Water Heat Pump',
    docCode: 'trane.eu/en-il prodId=217',
    url: 'https://trane.eu/en-il/equipment/product-details.html?prodId=217',
    notes: 'Family overview: 380–1030 kW heating capacity range, 370–950 kW cooling capacity range, R513A / R134a, XE and HSE executions.'
  },
  CALEFFI_BUFFER: {
    id: 'CALEFFI_BUFFER',
    title: 'Caleffi Idronics / Design Details: Air-to-Water Heat Pump Buffer Tank Configurations',
    docCode: 'Caleffi Technical Blog',
    url: 'https://www.caleffi.com/en-us/blog/design-details-air-water-heat-pump',
    notes: 'Reference for external 4-pipe hydraulic decoupling buffer tank architecture and mixing equations.'
  },
  LBNL_BUILDINGS_HX: {
    id: 'LBNL_BUILDINGS_HX',
    title: 'LBNL Modelica Buildings Library — Fluid.HeatExchangers',
    docCode: 'LBNL Buildings Library Reference',
    url: 'https://simulationresearch.lbl.gov/modelica/releases/latest/help/Buildings_Fluid_HeatExchangers.html',
    notes: 'Reference for steady-state effectiveness-NTU and discretized/lumped thermal capacitance transient HX formulation.'
  },
  ENERGYPLUS_HP: {
    id: 'ENERGYPLUS_HP',
    title: 'EnergyPlus Engineering Reference — Sec. 16.6 Plant Loop Heat Pumps',
    docCode: 'EnergyPlus v24+ Engineering Reference',
    url: 'https://energyplus.readthedocs.io/en/stable/guides/engineering-reference/16.6-plant-loop-heat-pumps.html',
    notes: 'Methodology for heat pump capacity and electric power dependence on source/load temperatures, flow rate, and part-load ratio.'
  },
  COOLPROP_REF: {
    id: 'COOLPROP_REF',
    title: 'CoolProp Thermophysical Property Library Reference (R513A / Water)',
    docCode: 'CoolProp High-Level API',
    url: 'https://coolprop.org/coolprop/HighLevelAPI.html',
    notes: 'Thermodynamic property correlations for R513A (56% R1234yf / 44% R134a) and liquid water.'
  },
  SITE_VERBAL_TECH: {
    id: 'SITE_VERBAL_TECH',
    title: 'Устное сообщение техника площадки (не подтверждено паспортом оборудования)',
    docCode: 'Verbal site communication',
    url: null,
    notes: 'Reported jacket pressure limit up to 2 bar and nominal 45 °C reference temperature — requires formal nameplate/passport verification.'
  },
  DEMO_ENG_ASSUMPTION: {
    id: 'DEMO_ENG_ASSUMPTION',
    title: 'Инженерное допущение демонстрационного макета HP-RTXC-5HX',
    docCode: 'HP-RTXC-5HX Demo Specification',
    url: null,
    notes: 'External plant layout, buffer sizing, secondary loop piping, and demo thermal loads assumed for consistent simulation.'
  }
});

/**
 * Helper to create a traceable parameter record as required by Section 2 & Section 13:
 * параметр → значение → единица → источник → условия применения → статус
 */
export function param(value, unit, sourceId, conditions, status = DATA_STATUS.CONFIRMED_BY_DOC, pageRef = '') {
  return {
    value,
    unit,
    source: sourceId,
    pageRef,
    conditions,
    status
  };
}

/**
 * Documented Prototype Passport: RTXC 180 XE-HSE (EC Fan, R513A, W/O Factory Pump Package)
 * All numbers strictly verified against RTXC-SVX003E-EN_0526.pdf.
 */
export const RTXC_PROTOTYPE_PASSPORT = Object.freeze({
  modelDesignation: param(
    'RTXC180DHB01CBBARF0D0N0NFEDN',
    'code',
    'TRANE_IOM_0526',
    'Configured 28-digit prototype code constructed per Nomenclature Table on p. 8 (NOT a factory order confirmation from the site): RTXC 180 tons, 400V/50Hz/3Ph, HSE (Inverter), Single Point Power, Circuit Breaker, BACnet, Ext LWT & Current Limit, Prog. Relays, Neoprene Isolators, Field Flow Switch, Dual Relief Valve, No Evap Bypass, No PHR, Std Noise, R513A Field Charge, EC Fans, Dual-Pump Control, No Factory Pump Package',
    DATA_STATUS.ASSUMED_FOR_DEMO,
    'p. 8 (nomenclature), p. 16–17, 39'
  ),
  shortModelName: param(
    'Trane RTXC 180 XE-HSE (EC Fan, R513A, W/O Pump Package)',
    'text',
    'TRANE_IOM_0526',
    'Visual and functional prototype selected from the 380–1030 kW family (Column 5 "180" on pp. 16–17)',
    DATA_STATUS.CONFIRMED_BY_DOC,
    'p. 16–17'
  ),
  modelDigitsBreakdown: [
    { digits: '1–4', code: 'RTXC', meaning: 'Air-cooled Screw Heat Pump (p. 8)' },
    { digits: '5–7', code: '180', meaning: '180 Nominal Tons size (p. 8, 9)' },
    { digits: '8', code: 'D', meaning: '400V / 50Hz / 3Ph power supply (p. 8, 39)' },
    { digits: '9', code: 'H', meaning: 'High Seasonal Efficiency HSE with inverter-driven compressors (p. 8, 40)' },
    { digits: '10–11', code: 'B0', meaning: 'Factory assigned design sequence (p. 8)' },
    { digits: '12', code: '1', meaning: 'Single Point Power Connection (p. 8, 39)' },
    { digits: '13', code: 'C', meaning: 'Circuit Breaker incoming connection (p. 8, 39)' },
    { digits: '14', code: 'B', meaning: 'BACnet Communication Interface BCI-C (p. 8, 44)' },
    { digits: '15', code: 'B', meaning: 'External Leaving Water Temp & External Current Limit Setpoint (p. 8, 43)' },
    { digits: '16', code: 'A', meaning: 'With Programmable Alarm/Status Relays (module 1A21, p. 8, 42)' },
    { digits: '17', code: 'R', meaning: 'Neoprene Isolators X10140305640 (8 pcs, p. 8, 27–28)' },
    { digits: '18', code: 'F', meaning: 'Field Installed Flow Switch (p. 8, 31)' },
    { digits: '19', code: '0', meaning: 'Standard Configuration (p. 8)' },
    { digits: '20', code: 'D', meaning: 'Dual Relief Valve with 3-Way Valve (p. 8)' },
    { digits: '21', code: '0', meaning: 'No Evaporator Bypass Control (p. 8, 33)' },
    { digits: '22', code: 'N', meaning: 'No Partial Heat Recovery (PHR only operates in cooling mode per p. 35)' },
    { digits: '23', code: '0', meaning: 'Standard Noise package (p. 8, 16)' },
    { digits: '24', code: 'N', meaning: 'No Fin Coil Coating (p. 8)' },
    { digits: '25', code: 'F', meaning: 'Nitrogen waiting charge — R513A field supplied (p. 8, 10, 16)' },
    { digits: '26', code: 'E', meaning: 'EC Condenser Fan Motors (12 × 1.77 kW, p. 8, 39)' },
    { digits: '27', code: 'D', meaning: 'Dual-Pump Power Supply / Control (contactors 1K27/1K28, max 25A FLA, p. 8, 41)' },
    { digits: '28', code: 'N', meaning: 'No Factory Pump Package (external primary pump group PP01A/B used instead, p. 8, 36, 50)' }
  ],

  // Refrigerant & Oil
  refrigerantType: param('R513A', 'text', 'TRANE_IOM_0526', 'Azeotropic low-GWP blend (56% R1234yf / 44% R134a)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16, 47'),
  refrigerantChargeTotal: param(304, 'kg', 'TRANE_IOM_0526', 'Total R513A operating charge for RTXC 180 XE-HSE (152 kg Circuit 1 + 152 kg Circuit 2; for R134a it is 155 + 155 = 310 kg)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180), p. 23 Table 2'),
  refrigerantChargeCkt1: param(152, 'kg', 'TRANE_IOM_0526', 'Circuit 1 R513A operating charge (155 kg for R134a)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 23 Table 2'),
  refrigerantChargeCkt2: param(152, 'kg', 'TRANE_IOM_0526', 'Circuit 2 R513A operating charge (155 kg for R134a)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 23 Table 2'),
  oilType: param('Trane OIL00388', 'text', 'TRANE_IOM_0526', 'Approved compressor lubricant', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 47, 57'),
  oilChargeTotal: param(20, 'kg', 'TRANE_IOM_0526', 'Total oil charge (2 circuits, column 180)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),

  // Compressors & Circuits
  compressorType: param('Semi-Hermetic Twin Screw Compressor (Inverter-driven HSE)', 'text', 'TRANE_IOM_0526', 'Cast-iron twin-rotor male/female screw with variable frequency drive', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16, 40, 47'),
  numCompressors: param(2, 'pcs', 'TRANE_IOM_0526', '1 compressor per circuit', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16, 39'),
  numRefrigerantCircuits: param(2, 'pcs', 'TRANE_IOM_0526', '2 independent refrigerant circuits sharing 1 falling-film water heat exchanger', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 9, 16, 47'),
  minLoadPercent: param(15, '%', 'TRANE_IOM_0526', 'Minimum unit capacity unloading percentage (two-circuit unit)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  hasEconomizer: param(true, 'boolean', 'TRANE_IOM_0526', 'Brazed plate heat exchanger (BPHE) economizer with vapor injection EXV (explicitly listed for 180XE-HSE on p. 6, p. 47 text & p. 48 header; note p. 47 Fig. 19 caption omitted 180XE-HSE by typo)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 6, 47, 48'),
  hasFactoryPumpPackage: param(false, 'boolean', 'TRANE_IOM_0526', 'Ordered with Digit 28 = N (W/O Pump Package) to avoid hydraulic conflict with external primary pump group PP01A/B. Note: Factory Pump Package VFD MD630 has no automatic regulation function during operation (p. 50).', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 8, 16, 50'),
  waterSideHeatExchangerType: param('Trane Patented Falling Film Shell-and-Tube Heat Exchanger', 'text', 'TRANE_IOM_0526', 'Water in tubes, refrigerant in shell; DN150 flanged connections (welding prohibited on cast-iron waterbox)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 9, 16, 29, 48'),
  waterSideInternalVolumeL: param(166, 'L', 'DEMO_ENG_ASSUMPTION', 'Estimated water mass/volume inside evaporator tubes derived from Operating Weight (7371 kg) − Shipping Weight (6901 kg) − R513A Charge (304 kg) = 166 kg ≈ 166 L (not separately tabulated in General Data)', DATA_STATUS.ASSUMED_FOR_DEMO, 'Derived from p. 16–17, 23'),

  // Fans
  fanType: param('EC Axial Condenser Fans (Direct-Drive Propeller)', 'text', 'TRANE_IOM_0526', 'Variable speed EC motors, no ductwork allowed', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16, 39, 48–49'),
  numFans: param(12, 'pcs', 'TRANE_IOM_0526', '12 condensing/evaporating air fans', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 39 (col 180)'),
  fanMotorPowerEach: param(1.77, 'kW', 'TRANE_IOM_0526', 'Nominal power per EC fan motor', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 39 (col 180)'),
  fanMotorFLAEach: param(2.8, 'A', 'TRANE_IOM_0526', 'Full load amps per EC fan motor', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 39 (col 180)'),
  fanDiameterVisualMm: param(800, 'mm', 'DEMO_ENG_ASSUMPTION', 'Visual fan shroud diameter for 3D representation (exact impeller diameter not listed in RTXC-SVX003E-EN)', DATA_STATUS.ASSUMED_FOR_DEMO, '3D geometry assumption'),

  // Heating Rating Data (EN 14511:2018 & EN 14825:2018, p. 16 column 180)
  nominalHeatingCapacity: param(619000, 'W', 'TRANE_IOM_0526', 'EN 14511:2018 Heating Capacity W/O Pump Package: Outdoor air 7°C DB / 6°C WB (87% RH), Hot water 40°C entering / 45°C leaving, Fouling factor 0 m²·°C/kW (W/ Pump Package Std/High Head: 622 / 623 kW)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalHeatingCapacityWithPumpStdW: param(622000, 'W', 'TRANE_IOM_0526', 'EN 14511:2018 Heating Capacity W/ Pump Package (Standard Head)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalHeatingCapacityWithPumpHighW: param(623000, 'W', 'TRANE_IOM_0526', 'EN 14511:2018 Heating Capacity W/ Pump Package (High Head)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalHeatingCOP: param(3.07, 'W/W', 'TRANE_IOM_0526', 'EN 14511:2018 gross COP at 7°C DB / 6°C WB outdoor air and 40/45°C water, W/O Pump Package (W/ Pump Package Std/High Head: 2.94 / 2.88)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalHeatingCOPWithPumpStd: param(2.94, 'W/W', 'TRANE_IOM_0526', 'EN 14511:2018 net COP W/ Pump Package (Standard Head)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalHeatingCOPWithPumpHigh: param(2.88, 'W/W', 'TRANE_IOM_0526', 'EN 14511:2018 net COP W/ Pump Package (High Head)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalHeatingPdesignhW: param(341000, 'W', 'TRANE_IOM_0526', 'EN 14825:2018 Seasonal space heating design load Pdesign,h = 341 kW', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalHeatingEtaShPercent: param(135, '%', 'TRANE_IOM_0526', 'EN 14825:2018 Seasonal space heating energy efficiency η_s,h = 135%', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalHeatingSCOP: param(3.46, 'W/W', 'TRANE_IOM_0526', 'EN 14825:2018 Seasonal Coefficient of Performance SCOP = 3.46 (distinct from steady-state EN 14511 COP = 3.07)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalHeatingWaterFlow: param(0.0272, 'm3/s', 'TRANE_IOM_0526', '27.2 L/s at heating rating condition 40/45°C (p. 16, col 180)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalHeatingPressureDrop: param(40000, 'Pa', 'TRANE_IOM_0526', '40 kPa water pressure drop at 27.2 L/s heating rating flow', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),

  // Cooling Rating Data (EN 14511:2018, p. 16 column 180)
  nominalCoolingCapacity: param(612000, 'W', 'TRANE_IOM_0526', 'EN 14511:2018: Outdoor air 35°C, Chilled water 12/7°C, W/O Pump Package (W/ Pump Package Std/High: 609 / 608 kW)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalCoolingEER: param(2.99, 'W/W', 'TRANE_IOM_0526', 'EN 14511:2018 gross EER at 35°C outdoor air and 12/7°C water W/O Pump Package (W/ Pump Package: 2.84 / 2.77)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalCoolingSEER: param(5.04, 'W/W', 'TRANE_IOM_0526', 'EN 14825 SEER (η_s,c = 199%)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalCoolingWaterFlow: param(0.0265, 'm3/s', 'TRANE_IOM_0526', '26.5 L/s at cooling rating condition 12/7°C', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  nominalCoolingPressureDrop: param(40000, 'Pa', 'TRANE_IOM_0526', '40 kPa water pressure drop at 26.5 L/s cooling rating flow', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),

  // Acoustic Data (p. 16 column 180)
  soundPowerStd_dBA: param(101, 'dB(A)', 'TRANE_IOM_0526', 'Sound Power Level (Standard Noise / Low Noise: 101 / 96 dB(A))', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  soundPressure1mStd_dBA: param(79, 'dB(A)', 'TRANE_IOM_0526', 'Sound Pressure Level at 1 m (Standard Noise / Low Noise: 79 / 74 dB(A))', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),

  // Water Flow & Hydraulic Limits (Table 4, p. 31)
  waterConnectionSize: param('DN150', 'DN', 'TRANE_IOM_0526', 'Flanged water inlet/outlet connection (welding prohibited per p. 29)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16, 29, 31'),
  table4RatedWaterFlow: param(0.031, 'm3/s', 'TRANE_IOM_0526', '31.0 L/s (111.6 m³/h) Table 4 flow switch paddle reference rate (Trim length A = 60 mm)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 31 Table 4'),
  minWaterFlow: param(0.0153, 'm3/s', 'TRANE_IOM_0526', '15.3 L/s (55.08 m³/h) minimum allowable evaporator water flow rate (flow switch trip threshold)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 31 Table 4'),
  maxWaterFlow: param(0.0459, 'm3/s', 'TRANE_IOM_0526', '45.9 L/s (165.24 m³/h) maximum allowable water flow rate (tube erosion limit)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 31 Table 4, p. 55'),
  minWaterLoopVolumePerKw: param(9.0, 'L/kW', 'TRANE_IOM_0526', 'Minimum recommended water loop volume (9 L/kW for 160–280 sizes; 20 L/kW for 110–140 sizes)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 3, 30'),
  flowSwitchDelaySeconds: param(6.0, 's', 'TRANE_IOM_0526', 'Symbio 800 6-second debounce delay on flow switch input before Loss of Flow shutdown', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 32'),

  // Electrical Data (p. 16, 39 column 180)
  ratedVoltage: param(400, 'V', 'TRANE_IOM_0526', '400V ±10% / 50Hz / 3Ph, max phase voltage imbalance 2% (p. 54)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 39, 54'),
  compressorRLAEach: param(161, 'A', 'TRANE_IOM_0526', 'Rated Load Amps per compressor (2 × 161 A)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 39 (col 180)'),
  compressorLRAEach: param(1089, 'A', 'TRANE_IOM_0526', 'Locked Rotor Amps per compressor (2 × 1089 A)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 39 (col 180)'),
  maxStartingAmpsWoPump: param(392, 'A', 'TRANE_IOM_0526', 'Max starting amps W/O Pump Package (p. 16 col 180)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  maxOperatingAmpsWoPump: param(425, 'A', 'TRANE_IOM_0526', 'Max operating amps W/O Pump Package (p. 16 col 180)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  maxOperatingPowerWoPump: param(266000, 'W', 'TRANE_IOM_0526', '266 kW Max operating power W/O Pump Package (p. 16 col 180)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  maxStartingAmps: param(417, 'A', 'TRANE_IOM_0526', 'Max starting amps W/ Dual-Pump Control (392 A W/O pump control; 412 / 419 A W/ Pump Package Std / High Head)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  maxOperatingAmps: param(450, 'A', 'TRANE_IOM_0526', 'Max operating amps W/ Dual-Pump Control (425 A W/O pump control; 444 / 451 A W/ Pump Package Std / High Head)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  maxOperatingPower: param(283000, 'W', 'TRANE_IOM_0526', '283 kW Max operating power W/ Dual-Pump Control (266 kW W/O pump control; 279 / 284 kW W/ Pump Package Std / High Head)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 16 (col 180)'),
  powerSupplyWireSizeMax: param('2×300 mm²', 'mm2', 'TRANE_IOM_0526', 'Maximum power supply copper wire size (Single point power)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 39 (col 180)'),
  evaporatorHeaterSupply: param('230VAC 50Hz 1Ph 16A (2.5 mm²)', 'text', 'TRANE_IOM_0526', 'Independent field-supplied power for waterbox/shell anti-freeze heaters (energized below 2.8°C / 37°F; NOT monitored by Symbio 800!)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 32, 33, 39, 40'),

  // Dimensions, Weights & Isolators (p. 17, 19, 23, 24, 27–28)
  lengthMm: param(7900, 'mm', 'TRANE_IOM_0526', 'Overall length in General Data table p. 17 col 180 (Note: Fig. 3-2 clearance table on p. 19 lists 7882 mm frame length — 18 mm discrepancy documented)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 17 (col 180), p. 19'),
  widthMm: param(2250, 'mm', 'TRANE_IOM_0526', 'Overall unit width p. 17 col 180 (2170 mm base mounting width on p. 19)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 17 (col 180), p. 19'),
  heightMm: param(2500, 'mm', 'TRANE_IOM_0526', 'Overall unit height p. 17 col 180', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 17 (col 180)'),
  shippingWeightKg: param(6901, 'kg', 'TRANE_IOM_0526', 'Shipping weight W/O Pump Package for RTXC 180 XE-HSE (W/ Pump Package: 8089 kg; note 6781 kg is RTXC 160 XE-HSE)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 17 (col 180), p. 23 Table 2'),
  operatingWeightKg: param(7371, 'kg', 'TRANE_IOM_0526', 'Operating weight W/O Pump Package for RTXC 180 XE-HSE (W/ Pump Package: 8734 kg; note 7251 kg is RTXC 160 XE-HSE)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 17 (col 180), p. 23 Table 2'),
  shippingWeightWithPumpKg: param(8089, 'kg', 'TRANE_IOM_0526', 'Shipping weight W/ Pump Package for RTXC 180 XE-HSE', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 17 (col 180), p. 24 Table 2'),
  operatingWeightWithPumpKg: param(8734, 'kg', 'TRANE_IOM_0526', 'Operating weight W/ Pump Package for RTXC 180 XE-HSE', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 17 (col 180), p. 24 Table 2'),
  centerOfGravityMm: param({ x: 3851, y: 1120, z: 937 }, 'mm', 'TRANE_IOM_0526', 'Center of gravity coordinates (Xcg, Ycg, Zcg) W/O Pump Package (W/ Pump Package: 4323, 1139, 820 mm)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 23 Table 2'),
  riggingPointLoadsShippingKg: param(
    { A: 891, B: 838, C: 1028, D: 814, E: 798, F: 984, G: 734, H: 814 },
    'kg',
    'TRANE_IOM_0526',
    '8 lifting/rigging point weights per Table 2 for RTXC 180 XE-HSE W/O Pump Package (sum = 6901 kg shipping weight)',
    DATA_STATUS.CONFIRMED_BY_DOC,
    'p. 23 Table 2'
  ),
  operatingIsolatorPointLoadsEstimatedKg: param(
    { W1: 952, W2: 895, W3: 1098, W4: 869, W5: 852, W6: 1051, W7: 784, W8: 870 },
    'kg',
    'DEMO_ENG_ASSUMPTION',
    'Estimated operating point loads (sum = 7371 kg) scaled from Table 2 rigging weights A..H × (7371/6901). Page 24 states exact isolator point loads are supplied in the unit-specific handbook/submittal.',
    DATA_STATUS.REQUIRES_CLARIFICATION,
    'p. 23–25 (submittal required for exact W1–W8 operating loads)'
  ),
  isolatorSpec: param(
    { partNumber: 'X10140305640', type: 'RDP4-WR', color: 'Dark-grey', qty: 8, maxLoadPerIsolatorKg: 1814, maxDeflectionMm: 6 },
    'spec',
    'TRANE_IOM_0526',
    'Neoprene vibration isolators (158.8 × 117.6 × 69.9 mm, Table 3 p. 27 & Fig. 6 p. 28)',
    DATA_STATUS.CONFIRMED_BY_DOC,
    'p. 24, 27 Table 3, 28 Fig. 6'
  ),

  // Operating Map & Contradiction Records (p. 48 vs p. 50)
  operatingMapHeating: {
    enteringWaterTempStartupMinC: param(10, '°C', 'TRANE_IOM_0526', 'Minimum entering water temperature at startup in Heating Mode', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 50'),
    enteringWaterTempStartupMaxC: param(50, '°C', 'TRANE_IOM_0526', 'Maximum entering water temperature at startup in Heating Mode', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 50'),
    leavingWaterTempRunningMinC: param(20, '°C', 'TRANE_IOM_0526', 'Minimum leaving water temperature running in Heating Mode', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 50'),
    leavingWaterTempRunningMaxC: param(55, '°C', 'TRANE_IOM_0526', 'Maximum leaving water temperature running in Heating Mode', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 50'),
    ambientAirTempMinC: param(-12, '°C', 'TRANE_IOM_0526', 'Minimum entering outdoor air temperature for 110,160,180,200,220 ton with R513A (-10°C for R134a and 130,140,250,280 R513A)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 48, 50'),
    ambientAirTempMaxPage48C: param(21, '°C', 'TRANE_IOM_0526', 'CONTRADICTION ITEM 1: Page 48 text ("Air Side Heat Exchanger") states units operate from 14°F (-10°C) to 70°F (21°C) in heating mode.', DATA_STATUS.REQUIRES_CLARIFICATION, 'p. 48'),
    ambientAirTempMaxPage50C: param(30, '°C', 'TRANE_IOM_0526', 'CONTRADICTION ITEM 2: Page 50 table ("RTXC-XE/XE-HSE Operating Map") states Max Entering Air Temperature in Heating Mode is 30°C. Both 21°C and 30°C are exceeded in Israeli summer (>32–42°C)!', DATA_STATUS.REQUIRES_CLARIFICATION, 'p. 50'),
    maxAltitudeMeters: param(1000, 'm', 'TRANE_IOM_0526', 'Operating map valid up to 1000 m above mean sea level', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 50')
  },

  // Refrigerant Approach & Superheat Verification Limits (Table 7, p. 56–57)
  refrigerantVerificationHeating: {
    waterSideApproachRangeC: param([2, 6], '°C', 'TRANE_IOM_0526', 'Saturated discharge temperature minus Leaving water temperature in Heating Mode', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 57 Table 7'),
    airSideApproachRangeC: param([8, 12], '°C', 'TRANE_IOM_0526', 'Outdoor air temperature minus Saturated suction temperature in Heating Mode', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 57 Table 7'),
    suctionSuperheatRangeC: param([2, 6], '°C', 'TRANE_IOM_0526', 'Normal suction superheat range in Heating Mode', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 56'),
    minDischargeSuperheatRunningC: param(10, '°C', 'TRANE_IOM_0526', 'Minimum compressor discharge superheat during operation (>1°C after 12h oil sump preheat before start, p. 53)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 53, 56')
  }
});

/**
 * Documented secondary reference model from the same manual (RTXC 110 XE-HSE R513A)
 * Included for completeness of the family comparison table in Stage 0 report.
 */
export const RTXC_110_REFERENCE_SUMMARY = Object.freeze({
  shortModelName: 'Trane RTXC 110 XE-HSE (EC Fan, R513A, W/O Pump Package)',
  pageRef: 'p. 16, 17, 23, 31, 39',
  nominalHeatingCapacityW: 399000,
  nominalHeatingCOP: 3.26,
  nominalHeatingSCOP: 3.52,
  waterFlowHeatingLs: 19.3,
  pressureDropHeatingKpa: 71,
  numCompressors: 1,
  numCircuits: 1,
  minLoadPercent: 30,
  refrigerantChargeKg: 172,
  lengthMm: 4720,
  widthMm: 2250,
  heightMm: 2500,
  operatingWeightKg: 4344,
  waterConnection: 'DN100',
  minWaterFlowLs: 9.1,
  maxWaterFlowLs: 27.3
});

/**
 * List of documented contradictions and unconfirmed parameters (Section 3 & Stage 0 requirement)
 */
export const ENGINEERING_CONTRADICTIONS_AND_GAPS = Object.freeze([
  {
    id: 'GAP-01',
    topic: 'Летний режим и верхний предел наружной температуры (Section 3.1)',
    severity: 'CRITICAL',
    status: DATA_STATUS.REQUIRES_CLARIFICATION,
    description:
      'В руководстве RTXC-SVX003E-EN обнаружено внутреннее противоречие: на стр. 48 (раздел Air Side Heat Exchanger) указан рабочий диапазон нагрева от -10/-12 °C до +21 °C (70 °F), тогда как на стр. 50 (таблица RTXC-XE/XE-HSE Operating Map) указан максимум +30 °C. При этом летняя расчётная температура наружного воздуха в Израиле достигает +35…+42 °C, что выходит за оба предела. Круглогодичная работа RTXC на нагрев в климате Израиля документацией НЕ подтверждена.',
    simulationBehavior:
      'Реализована строгая проверка рабочей карты: при T_amb > 21 °C выдаётся предупреждение о разночтении документации (стр. 48 vs стр. 50), а при выходе за предел карты (по умолчанию 30 °C или переключаемый строгий предел 21 °C) нагрев блокируется без произвольной экстраполяции.'
  },
  {
    id: 'GAP-02',
    topic: 'Температурная цепочка: шоколад ≠ вторичная вода ≠ подача RTXC (Section 3.2)',
    severity: 'HIGH',
    status: DATA_STATUS.REQUIRES_CLARIFICATION,
    description:
      'Отсутствуют паспортные технологические карты пяти потребителей (צרכן 1–5). Ранее упоминавшиеся 45 °C нельзя одновременно приравнивать к температуре продукта (шоколада), вторичной воды в рубашке и выходу теплового насоса. Для получения 45 °C во вторичном контуре первичный вход HX_i должен быть горячее на величину температурного напора ΔT_HX (плюс смешение в буфере BT01 и потери в трассе), т.е. ~48–52 °C.',
    simulationBehavior:
      'В режиме «Данные площадки» целевые температуры шоколада и теплопередача рубашек помечены как «Нет данных». В «Демонстрационном наборе» заданы явные уставки вторичной подачи (например, 45 °C) при расчётной уставке RTXC 50 °C, а фактические температуры определяются решением метода ε-NTU и баланса буфера.'
  },
  {
    id: 'GAP-03',
    topic: 'Допустимое давление рубашек потребителей до 2 бар (Section 3.3)',
    severity: 'CRITICAL',
    status: DATA_STATUS.REQUIRES_CLARIFICATION,
    description:
      'Ограничение «до 2 бар» получено устно со слов техника площадки без паспорта сосудов/рубашек. Не уточнено: (1) избыточное или абсолютное давление, (2) рабочее или предельно допустимое (MAWP), (3) одинаково ли для всех пяти потребителей, (4) при какой температуре действует, (5) каковы геодезические отметки потребителей относительно крыши (каждые 10 м перепада вниз добавляют ~0.98 бар гидростатического давления!).',
    simulationBehavior:
      'Хранится со статусом «Требует уточнения». Гидравлическое ядро считает как давление на кровле (у насосов PS01–PS05 и HX01–HX05), так и давление в нижней точке у потребителя с учётом геодезической высоты z_i. В режиме «Данные площадки» проверка разрешённой уставки PSV блокируется до ввода паспортного MAWP и отметок высот.'
  },
  {
    id: 'GAP-04',
    topic: 'Роль частотника заводского насосного модуля MD630 (Section 5 & Section 10)',
    severity: 'MEDIUM',
    status: DATA_STATUS.CONFIRMED_BY_DOC,
    description:
      'Согласно стр. 50 руководства RTXC-SVX003E-EN, опциональный ЧРП (VFD MD630) встроенного насосного модуля используется ТОЛЬКО при пусконаладке для фиксации преднастроенных частот охлаждения и нагрева и НЕ выполняет автоматического регулирования перепада давления в работе.',
    simulationBehavior:
      'Агрегат HP01 выбран в исполнении без встроенного насосного модуля (Digit 28 = N). Циркуляция через HP01-BT01 осуществляется внешней группой PP01A/B (под управлением Symbio 800, контакторы 1K27/1K28), а регулирование перепада давления в коллекторах — внешней распределительной группой PD01A/B под управлением шкафа автоматики CP01.'
  },
  {
    id: 'GAP-05',
    topic: 'Разночтение габаритной длины RTXC 180 XE-HSE в руководстве (7900 мм vs 7882 мм) и наличия экономайзера в подписи рис. 19',
    severity: 'LOW',
    status: DATA_STATUS.CONFIRMED_BY_DOC,
    description:
      'В таблице General Data (стр. 17) длина RTXC 180 XE-HSE указана 7900 мм, а на чертеже монтажных зазоров Fig. 3-2 (стр. 19) — 7882 мм. Также в оглавлении (стр. 6) и тексте (стр. 48) экономайзер прямо указан для 180XE-HSE, но в подписи к Fig. 19 (стр. 47) типоразмер 180XE-HSE пропущен.',
    simulationBehavior:
      'Оба факта зафиксированы в паспорте прототипа и списке вопросов к Trane.'
  }
]);

export const DOCUMENTED_CONTRADICTIONS_AND_GAPS = ENGINEERING_CONTRADICTIONS_AND_GAPS.map((g) => ({
  ...g,
  findingRu: g.description
}));

export const PROVENANCE_STATUS_LABELS = Object.freeze({
  confirmed_by_doc: {
    he: DATA_STATUS_LABELS_HE.confirmed_by_doc,
    ru: DATA_STATUS_LABELS_RU.confirmed_by_doc,
    badgeColor: '#10b981'
  },
  from_site: {
    he: DATA_STATUS_LABELS_HE.from_site,
    ru: DATA_STATUS_LABELS_RU.from_site,
    badgeColor: '#38bdf8'
  },
  assumed_for_demo: {
    he: DATA_STATUS_LABELS_HE.assumed_for_demo,
    ru: DATA_STATUS_LABELS_RU.assumed_for_demo,
    badgeColor: '#f59e0b'
  },
  requires_clarification: {
    he: DATA_STATUS_LABELS_HE.requires_clarification,
    ru: DATA_STATUS_LABELS_RU.requires_clarification,
    badgeColor: '#ef4444'
  }
});

