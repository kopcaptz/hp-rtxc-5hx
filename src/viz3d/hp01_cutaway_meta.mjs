/**
 * STAGE 2 FOUNDATION (PKG-S2-A): Canonical HP01 3D Cutaway Metadata Catalog
 * Task: HP-RTXC-CUTAWAY-REDESIGN-01 (S2-FOUNDATION-09 / AC-S2F)
 *
 * Strictly isolated from frozen src/topology/registry.mjs.
 * Codifies:
 *  - 25 selectable 3D nodes (HP01_SUBNODES)
 *  - 19 paired functional categories = 38 physical auxiliary 3D sub-elements (HP01_AUX_VALVES)
 *  - 5 isolated port-level medium domains inside common WHEX (HP01_WHEX_PORT_DOMAINS)
 *  - 48 unique internal & boundary connections (HP01_INTERNAL_CONNECTIONS: 19 CKT1 + 19 CKT2 + 4 W + 2 A + 4 E)
 *  - 8 neoprene vibration isolator stations W1..W8 (Fig. 5-4 p. 25) & 8 rigging lugs A..H (Fig. 4-2 p. 22)
 */

import { HP01_CUTAWAY_TEXT_HE } from '../i18n/he_ru.mjs';

export const HP01_GEOMETRY_CONSTANTS = Object.freeze({
  scaleMetersPerUnit: 1.0,
  dimensionsMm: Object.freeze({
    lengthOverallTable2Mm: 7900,      // Table 2, p. 17 (CONFIRMED_BY_DOC / REQUIRES_CLARIFICATION vs 7882/7694)
    lengthDrawingFig3_2Mm: 7882,      // Figure 3-2, p. 19
    lengthIsolatorFrameFig5_4Mm: 7694,// Figure 5-4, p. 25
    widthOverallMm: 2250,             // Table 2 p. 17 & Fig. 3-2 p. 19 (vs 2245 mm on Fig. 5-4 p. 25)
    widthIsolatorCentersMm: 2170,     // Fig. 3-2 p. 19 & Fig. 5-4 p. 25 (z = ±1.085 m)
    heightOverallMm: 2500,            // Table 2 p. 17 & Fig. 3-2 p. 19
    isolatorPadDimensionsMm: Object.freeze([158.8, 69.9, 117.6]), // RDP4-WR (X10140305640), Table 3 p. 27, Fig. 6 p. 28
    flowSwitchPaddleTrimMm: 60,       // DN150 / 6" paddle length A = 60 mm, Table 4 p. 31, Fig. 9 p. 32
    vfdDimensionsMm: Object.freeze([375, 550, 320]) // CA300-4T132, Table 12 p. 69
  }),
  clearancesMm: Object.freeze({
    whexTubePullLeftMm: 2500,         // Figure 3-2, p. 20 (Tube Inserting / Drawing)
    symbioControlRightMm: 1200,       // Figure 3-2, p. 20
    frontServiceSideMm: 1200,         // Figure 3-2, p. 20
    rearSideMm: 1200,                 // Figure 3-2, p. 20
    oppositeEndMm: 1000               // Figure 3-2, p. 20
  }),
  massesKg: Object.freeze({
    shippingWeightTable2Kg: 6901,     // Table 2 p. 17, 23
    operatingWeightTable2Kg: 7371,    // Table 2 p. 17, 23
    pointLoadSumTable7Kg: 6842,       // Sum of W1..W8 in Table 7 p. 51 (discrepancy vs 7371 kg REQUIRES_CLARIFICATION)
    compressorEachKg: 692,            // Table 10 p. 65
    whexBodyKg: 910,                  // Table 10 p. 65
    whexFrontWaterboxKg: 41,          // Table 10 p. 65
    whexRearWaterboxKg: 15,           // Table 10 p. 65
    airCoilCassetteMinKg: 160,        // Table 10 p. 65
    airCoilCassetteMaxKg: 164,        // Table 10 p. 65
    oilSeparatorEachKg: 86,           // Table 10 p. 65
    liquidReceiverEachKg: 79,         // Table 10 p. 65
    fourWayValveEachKg: 22,           // Table 10 p. 65
    fanAssemblyEachKg: 54,            // Table 10 p. 65 (12 × 54 = 648 kg; 6 per group = 324 kg)
    controlPanelSymbioKg: 356,        // Table 10 p. 65
    vfdEachKg: 46,                    // Table 12 p. 69 (2 × CA300-4T132)
    refrigerantChargeTotalR513aKg: 304, // docs/RTXC-SVX003E-EN_0526.pdf Table 2 General Data p. 16, col. 180 (CONFIRMED_BY_DOC)
    refrigerantChargeCkt1EstimatedKg: 152, // Equal-split estimate 304 / 2 = 152 kg (ASSUMED_FOR_DEMO per stage-1/geometry-sources.md)
    refrigerantChargeCkt2EstimatedKg: 152, // Equal-split estimate 304 / 2 = 152 kg (ASSUMED_FOR_DEMO per stage-1/geometry-sources.md)
    refrigerantChargeBreakdown: Object.freeze({
      refrigerantType: 'R513A',
      totalKg: 304,
      totalProvenance: 'CONFIRMED_BY_DOC',
      totalSourceRef: 'docs/RTXC-SVX003E-EN_0526.pdf, Table 2 General Data p. 16, col. 180 (304 kg R513A total)',
      ckt1EstimatedKg: 152,
      ckt2EstimatedKg: 152,
      perCircuitProvenance: 'ASSUMED_FOR_DEMO',
      perCircuitAssumptionRule: 'EQUAL_SPLIT_OF_304_KG_TOTAL',
      totalDisplayHe: HP01_CUTAWAY_TEXT_HE.refrigerantChargeNotes.totalConfirmedHe,
      perCircuitDisplayHe: HP01_CUTAWAY_TEXT_HE.refrigerantChargeNotes.perCircuitAssumedHe
    }),
    oilChargeTotalKg: 20,             // Table 2 General Data p. 16, col. 180, p. 57 (20 kg total OIL00388 — CONFIRMED_BY_DOC)
    oilChargePerCktEstimatedKg: 10    // Equal-split estimate 20 / 2 = 10 kg per circuit (ASSUMED_FOR_DEMO)
  }),
  centerOfGravityM: Object.freeze({
    x: 0.004,                         // Xcg = 3851 mm from left edge (-3.847 + 3.851 = +0.004 m), Table 2 p. 23
    y: 0.937,                         // Zcg vertical = 937 mm, Table 2 p. 23
    z: -0.005                         // Ycg transverse = 1120 mm from rear edge, Table 2 p. 23
  }),
  // 8 Neoprene Isolators W1..W8 along frame 7694 mm (x_left = -3.847 m): offsets 1285, 2885, 4385, 6185 mm (span 4.900 m)
  isolatorStations: Object.freeze([
    Object.freeze({ id: 'W7', stationIdx: 1, offsetFromLeftMm: 1285, pos: Object.freeze([-2.562, 0.035, +1.085]), loadKg: 853, side: 'FRONT_Z_POS' }),
    Object.freeze({ id: 'W8', stationIdx: 1, offsetFromLeftMm: 1285, pos: Object.freeze([-2.562, 0.035, -1.085]), loadKg: 640, side: 'REAR_Z_NEG' }),
    Object.freeze({ id: 'W5', stationIdx: 2, offsetFromLeftMm: 2885, pos: Object.freeze([-0.962, 0.035, +1.085]), loadKg: 958, side: 'FRONT_Z_POS' }),
    Object.freeze({ id: 'W6', stationIdx: 2, offsetFromLeftMm: 2885, pos: Object.freeze([-0.962, 0.035, -1.085]), loadKg: 716, side: 'REAR_Z_NEG' }),
    Object.freeze({ id: 'W3', stationIdx: 3, offsetFromLeftMm: 4385, pos: Object.freeze([+0.538, 0.035, +1.085]), loadKg: 1094, side: 'FRONT_Z_POS' }),
    Object.freeze({ id: 'W4', stationIdx: 3, offsetFromLeftMm: 4385, pos: Object.freeze([+0.538, 0.035, -1.085]), loadKg: 821, side: 'REAR_Z_NEG' }),
    Object.freeze({ id: 'W1', stationIdx: 4, offsetFromLeftMm: 6185, pos: Object.freeze([+2.338, 0.035, +1.085]), loadKg: 995, side: 'FRONT_Z_POS' }),
    Object.freeze({ id: 'W2', stationIdx: 4, offsetFromLeftMm: 6185, pos: Object.freeze([+2.338, 0.035, -1.085]), loadKg: 765, side: 'REAR_Z_NEG' })
  ]),
  // 8 Rigging Lugs A..H (Figure 4-2 p. 22, steps 1081 + 1800 + 1800 + 1900 mm, sling angle > 60 deg at hook)
  riggingLugs: Object.freeze([
    Object.freeze({ id: 'A', pos: Object.freeze([+2.734, 0.220, +1.125]), loadKg: 950 }),
    Object.freeze({ id: 'B', pos: Object.freeze([+2.734, 0.220, -1.125]), loadKg: 731 }),
    Object.freeze({ id: 'C', pos: Object.freeze([+0.834, 0.220, +1.125]), loadKg: 1093 }),
    Object.freeze({ id: 'D', pos: Object.freeze([+0.834, 0.220, -1.125]), loadKg: 842 }),
    Object.freeze({ id: 'E', pos: Object.freeze([-0.966, 0.220, +1.125]), loadKg: 994 }),
    Object.freeze({ id: 'F', pos: Object.freeze([-0.966, 0.220, -1.125]), loadKg: 765 }),
    Object.freeze({ id: 'G', pos: Object.freeze([-2.766, 0.220, +1.125]), loadKg: 862 }),
    Object.freeze({ id: 'H', pos: Object.freeze([-2.766, 0.220, -1.125]), loadKg: 664 })
  ])
});

/**
 * 5 strictly isolated port-level medium domains inside common WHEX (S2P-03)
 * Zero internal edges exist between any two domains inside WHEX.
 */
export const HP01_WHEX_PORT_DOMAINS = Object.freeze({
  'WHEX::WATER_TUBES': Object.freeze({
    domainId: 'WHEX::WATER_TUBES',
    mediumDomain: 'PRIMARY_WATER',
    circuit: 'WATER',
    ports: Object.freeze(['tube_in', 'tube_out']),
    allowedConnections: Object.freeze(['W-01', 'W-02', 'W-03']),
    provenance: 'CONFIRMED_BY_DOC',
    descriptionHe: 'חלל פנימי של קופסאות המים (DN150) וצינורות הנחושת — מבודד לחלוטין מחלל הקרר'
  }),
  'WHEX::SHELL_CKT1': Object.freeze({
    domainId: 'WHEX::SHELL_CKT1',
    mediumDomain: 'REFRIGERANT_CKT1',
    circuit: 'CKT1',
    ports: Object.freeze(['ckt1_top', 'ckt1_bot', 'ckt1_dist', 'ckt1_rec_ret', 'ckt1_oil_drain']),
    allowedConnections: Object.freeze(['C1-03', 'C1-04', 'C1-05', 'C1-07', 'C1-18']),
    provenance: 'ASSUMED_FOR_DEMO',
    descriptionHe: 'מדור מעטפת ימני (CKT1) מחוץ לצינורות המים — מופרד ממדור CKT2 במחיצה עקרונית (ASSUMED_FOR_DEMO)'
  }),
  'WHEX::SHELL_CKT2': Object.freeze({
    domainId: 'WHEX::SHELL_CKT2',
    mediumDomain: 'REFRIGERANT_CKT2',
    circuit: 'CKT2',
    ports: Object.freeze(['ckt2_top', 'ckt2_bot', 'ckt2_dist', 'ckt2_rec_ret', 'ckt2_oil_drain']),
    allowedConnections: Object.freeze(['C2-03', 'C2-04', 'C2-05', 'C2-07', 'C2-18']),
    provenance: 'ASSUMED_FOR_DEMO',
    descriptionHe: 'מדור מעטפת שמאלי (CKT2) מחוץ לצינורות המים — ללא כל חיבור הידראולי עם CKT1 או עם המים'
  }),
  'WHEX::DRAIN_BOX': Object.freeze({
    domainId: 'WHEX::DRAIN_BOX',
    mediumDomain: 'DRAIN_WATER',
    circuit: 'DRAIN',
    ports: Object.freeze(['waterbox_drain']),
    allowedConnections: Object.freeze(['W-04']),
    provenance: 'CONFIRMED_BY_DOC',
    descriptionHe: 'פקקי ריקון תחתונים של קופסאות המים (סגורים בעבודה תקינה — ללא חלקיקים)'
  }),
  'WHEX::HEATER_TERM': Object.freeze({
    domainId: 'WHEX::HEATER_TERM',
    mediumDomain: 'ELEC_230V',
    circuit: 'ELEC',
    ports: Object.freeze(['freeze_heater_term']),
    allowedConnections: Object.freeze(['E-02']),
    provenance: 'CONFIRMED_BY_DOC',
    descriptionHe: 'קופסת חיבורים לגופי חימום מניעת קיפאון 230VAC 16A (< 2.8°C, עמ׳ 32, 40)'
  })
});

/**
 * Boundary flanges / external terminals for connections entering/leaving the HP01 package
 */
export const HP01_BOUNDARY_PORTS = Object.freeze({
  HP01_WATER_IN: Object.freeze({
    id: 'HP01_WATER_IN',
    portName: 'flange_dn150_in',
    pos: Object.freeze([-2.78, 0.86, -0.78]),
    mediumDomain: 'PRIMARY_WATER',
    circuit: 'WATER',
    portDomainId: 'WHEX::WATER_TUBES'
  }),
  HP01_WATER_OUT: Object.freeze({
    id: 'HP01_WATER_OUT',
    portName: 'flange_dn150_out',
    pos: Object.freeze([+2.78, 0.98, -0.78]),
    mediumDomain: 'PRIMARY_WATER',
    circuit: 'WATER',
    portDomainId: 'WHEX::WATER_TUBES'
  }),
  EXTERNAL_BMS_GW: Object.freeze({
    id: 'EXTERNAL_BMS_GW',
    portName: 'bacnet_trunk_out',
    pos: Object.freeze([+3.82, 1.65, +0.85]),
    mediumDomain: 'CONTROL_BMS',
    circuit: 'ELEC',
    portDomainId: 'CTRL::BMS'
  })
});

/**
 * Helper to create circuit-mirrored X coordinate (k=1 is positive +X right half, k=2 is negative -X left half)
 */
function buildSubNodesCatalog() {
  const nodes = {};

  // 1 & 2: COMP1 / COMP2
  for (const k of [1, 2]) {
    const s = k === 1 ? +1 : -1;
    const ckt = `CKT${k}`;
    const med = `REFRIGERANT_${ckt}`;
    const cx = s * 1.95;
    const cy = 0.62;
    const cz = +0.58;
    nodes[`COMP${k}`] = {
      id: `COMP${k}`,
      shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe[`COMP${k}`],
      titleHe: `מדחס בורגי חצי-הרמטי ${k} (GP${k}, מעגל ${k})`,
      circuit: ckt,
      mediumDomain: med,
      center: [cx, cy, cz],
      boundsSize: [0.92, 0.64, 0.56],
      supportType: 'WELDED_PEDESTAL_AND_4_ISOLATORS',
      supportTargetId: 'FRAME-BASE',
      massKg: 692,
      dimensionsMm: null,
      sourceRef: 'Table 10 p. 65 (692 kg), Sec. 6.2 p. 38 (RLA=166 A, LRA=273 A), Fig. 19 p. 47, Table 2 p. 16 col. 180 (304 kg R513A total)',
      provenance: 'CONFIRMED_BY_DOC',
      confirmedDocNoteHe:
        'מאומת בתיעוד יצרן (CONFIRMED_BY_DOC): מדחס בורגי חצי-הרמטי 692 ק״ג (טבלה 10 עמ׳ 65), RLA=166 A / LRA=273 A (עמ׳ 38), סך מילוי קרר ליחידה 304 ק״ג R513A (טבלה 2 עמ׳ 16, עמודה 180)',
      assumedGeometryNoteHe:
        'גאומטריה עקרונית להדגמה (ASSUMED_FOR_DEMO): משטחים בורגיים רציפים של רוטור מוביל (זכר) ורוטור מובל (נקבה), פרופיל השיניים, הפסיעה, המרווחים, מספר הכניסות ומיקום על השלדה הם להמחשה הנדסית בלבד ואינם שרטוט ייצור מאומת של Trane; חלוקת הקרר (≈152 ק״ג למעגל מתוך 304 ק״ג סה״כ) היא הערכה בחלוקה שווה',
      highlightConnections: [`C${k}-01`, `C${k}-11`, `C${k}-15`, `C${k}-16`, `C${k}-17`, `C${k}-18`],
      ports: {
        suction_in: { pos: [cx - s * 0.36, cy + 0.22, cz - 0.12], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        econ_inj:   { pos: [cx - s * 0.10, cy + 0.24, cz + 0.14], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        disch_out:  { pos: [cx + s * 0.34, cy + 0.26, cz - 0.10], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        oil_in:     { pos: [cx + s * 0.16, cy - 0.16, cz - 0.18], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        oil_ret_in: { pos: [cx - s * 0.28, cy - 0.16, cz - 0.20], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` }
      }
    };
  }

  // 3: WHEX (Common Shell-and-Tube Falling Film Evaporator/Condenser with 5 isolated port domains)
  nodes.WHEX = {
    id: 'WHEX',
    shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe.WHEX,
    titleHe: 'מחליף חום מים-קרר (WHEX — מעטפת וצינורות נפילת סרט, DN150)',
    circuit: 'SHARED_ISOLATED_DOMAINS',
    mediumDomain: 'MULTI_DOMAIN_ISOLATED',
    center: [-0.05, 0.82, -0.38],
    boundsSize: [4.50, 0.86, 0.86],
    supportType: 'TWIN_STEEL_SADDLE_CRADLES',
    supportTargetId: 'FRAME-BASE',
    massKg: 966, // 910 kg shell + 41 kg front waterbox + 15 kg rear waterbox (Table 10 p. 65)
    dimensionsMm: { flangeDnMm: 150, tubePullClearanceMm: 2500 },
    sourceRef: 'Table 10 p. 65 (910+41+15 kg), Table 2 p. 16 & Sec. 5.5 p. 29 (DN150/6"), Fig. 3-2 p. 20 (2500 mm)',
    provenance: 'CONFIRMED_BY_DOC',
    assumedGeometryNoteHe: 'קוטר מעטפת, מספר צינורות נחושת ומחיצת הפרדה בין SHELL_CKT1 ל-SHELL_CKT2 — ASSUMED_FOR_DEMO',
    highlightConnections: [
      'W-01', 'W-02', 'W-03',
      'C1-03', 'C1-04', 'C1-05', 'C1-07', 'C1-18',
      'C2-03', 'C2-04', 'C2-05', 'C2-07', 'C2-18'
    ],
    ports: {
      // Domain 1: WHEX::WATER_TUBES
      tube_in:            { pos: [-2.22, 0.86, -0.38], mediumDomain: 'PRIMARY_WATER', circuit: 'WATER', portDomainId: 'WHEX::WATER_TUBES' },
      tube_out:           { pos: [+2.12, 0.98, -0.38], mediumDomain: 'PRIMARY_WATER', circuit: 'WATER', portDomainId: 'WHEX::WATER_TUBES' },
      // Domain 2: WHEX::SHELL_CKT1
      ckt1_top:           { pos: [+1.42, 1.22, -0.26], mediumDomain: 'REFRIGERANT_CKT1', circuit: 'CKT1', portDomainId: 'WHEX::SHELL_CKT1' },
      ckt1_bot:           { pos: [+1.22, 0.44, -0.18], mediumDomain: 'REFRIGERANT_CKT1', circuit: 'CKT1', portDomainId: 'WHEX::SHELL_CKT1' },
      ckt1_dist:          { pos: [+0.78, 1.14, -0.12], mediumDomain: 'REFRIGERANT_CKT1', circuit: 'CKT1', portDomainId: 'WHEX::SHELL_CKT1' },
      ckt1_rec_ret:       { pos: [+0.52, 0.46, -0.14], mediumDomain: 'REFRIGERANT_CKT1', circuit: 'CKT1', portDomainId: 'WHEX::SHELL_CKT1' },
      ckt1_oil_drain:     { pos: [+1.68, 0.42, -0.22], mediumDomain: 'REFRIGERANT_CKT1', circuit: 'CKT1', portDomainId: 'WHEX::SHELL_CKT1' },
      // Domain 3: WHEX::SHELL_CKT2
      ckt2_top:           { pos: [-1.42, 1.22, -0.26], mediumDomain: 'REFRIGERANT_CKT2', circuit: 'CKT2', portDomainId: 'WHEX::SHELL_CKT2' },
      ckt2_bot:           { pos: [-1.22, 0.44, -0.18], mediumDomain: 'REFRIGERANT_CKT2', circuit: 'CKT2', portDomainId: 'WHEX::SHELL_CKT2' },
      ckt2_dist:          { pos: [-0.78, 1.14, -0.12], mediumDomain: 'REFRIGERANT_CKT2', circuit: 'CKT2', portDomainId: 'WHEX::SHELL_CKT2' },
      ckt2_rec_ret:       { pos: [-0.52, 0.46, -0.14], mediumDomain: 'REFRIGERANT_CKT2', circuit: 'CKT2', portDomainId: 'WHEX::SHELL_CKT2' },
      ckt2_oil_drain:     { pos: [-1.68, 0.42, -0.22], mediumDomain: 'REFRIGERANT_CKT2', circuit: 'CKT2', portDomainId: 'WHEX::SHELL_CKT2' },
      // Domain 4: WHEX::DRAIN_BOX
      waterbox_drain:     { pos: [-2.18, 0.42, -0.46], mediumDomain: 'DRAIN_WATER', circuit: 'DRAIN', portDomainId: 'WHEX::DRAIN_BOX' },
      // Domain 5: WHEX::HEATER_TERM
      freeze_heater_term: { pos: [+2.08, 0.64, -0.58], mediumDomain: 'ELEC_230V', circuit: 'ELEC', portDomainId: 'WHEX::HEATER_TERM' }
    }
  };

  // 4 & 5: ECON1 / ECON2 (Brazed Plate Economizer & Unidirectional Liquid Bridge)
  for (const k of [1, 2]) {
    const s = k === 1 ? +1 : -1;
    const ckt = `CKT${k}`;
    const med = `REFRIGERANT_${ckt}`;
    const cx = s * 0.92;
    const cy = 0.68;
    const cz = +0.54;
    nodes[`ECON${k}`] = {
      id: `ECON${k}`,
      shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe[`ECON${k}`],
      titleHe: `אקונומייזר פלטות מלובדות וגשר נוזל חד-כיווני ${k} (BPHE ${k})`,
      circuit: ckt,
      mediumDomain: med,
      center: [cx, cy, cz],
      boundsSize: [0.46, 0.56, 0.36],
      supportType: 'STEEL_FRAME_STANCHION',
      supportTargetId: 'FRAME-BASE',
      massKg: null,
      dimensionsMm: null,
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (CONFIRMED_OEM_TOPOLOGY); Fig. 19 caption vs 180 XE-HSE REQUIRES_CLARIFICATION; PLR>=85% MODEL_ASSUMPTION',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      assumedGeometryNoteHe: 'ממדי חבילת הפלטות BPHE ומיקום התושבת — ASSUMED_FOR_DEMO',
      highlightConnections: [`C${k}-04`, `C${k}-13`, `C${k}-08`, `C${k}-09`, `C${k}-10`, `C${k}-11`],
      ports: {
        main_in:  { pos: [cx + s * 0.08, cy + 0.16, cz], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        main_out: { pos: [cx + s * 0.08, cy - 0.16, cz], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        aux_in:   { pos: [cx - s * 0.08, cy - 0.16, cz + 0.06], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        vap_out:  { pos: [cx - s * 0.08, cy + 0.18, cz + 0.06], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` }
      }
    };
  }

  // 6 & 7: REC1 / REC2 (Side-branch Liquid Receivers — strictly offset from main liquid bridge!)
  for (const k of [1, 2]) {
    const s = k === 1 ? +1 : -1;
    const ckt = `CKT${k}`;
    const med = `REFRIGERANT_${ckt}`;
    const cx = s * 0.46;
    const cy = 0.64;
    const cz = +0.16;
    nodes[`REC${k}`] = {
      id: `REC${k}`,
      shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe[`REC${k}`],
      titleHe: `רסיבר נוזל ${k} — מכל אגירת קרר צדדי (מעגל ${k})`,
      circuit: ckt,
      mediumDomain: med,
      center: [cx, cy, cz],
      boundsSize: [0.26, 0.84, 0.26],
      supportType: 'DEDICATED_RECEIVER_LEG_ON_FRAME',
      supportTargetId: 'FRAME-BASE',
      massKg: 79,
      dimensionsMm: null,
      sourceRef: 'Table 10 p. 65 (79 kg), Table 2 p. 16 col. 180 (304 kg R513A total), Fig. 19 p. 47, Table 6 p. 49, Fig. 20 p. 51 (CONFIRMED_BY_DOC / CONFIRMED_OEM_TOPOLOGY); branch Ck-07b UNKNOWN_TOPOLOGY',
      provenance: 'CONFIRMED_BY_DOC',
      confirmedDocNoteHe:
        'מאומת בתיעוד יצרן (CONFIRMED_BY_DOC): מסת רסיבר ריק 79 ק״ג (טבלה 10 עמ׳ 65), חיבור בענף צדדי מחוץ לקו הנוזל הראשי (איור 19 עמ׳ 47 וטבלה 6 עמ׳ 49), סך מילוי R513A ביחידה 304 ק״ג (טבלה 2 עמ׳ 16, עמודה 180)',
      assumedGeometryNoteHe:
        'גאומטריה והנחות להדגמה (ASSUMED_FOR_DEMO): הערכת מילוי של ≈152 ק״ג R513A למעגל מבוססת על הנחת חלוקה שווה של 304 ק״ג סה״כ (אינה ערך נפרד בטבלה 2 עמ׳ 16); מידות החיבור הפיזיות להמחשה; ענף משני Ck-07b מסומן כ-UNKNOWN_TOPOLOGY',
      highlightConnections: [`C${k}-06`, `C${k}-07`], // Strictly side branches only! Ck-04/05/08 excluded!
      ports: {
        in_side:  { pos: [cx, cy + 0.24, cz + 0.12], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        out_bot:  { pos: [cx, cy - 0.38, cz], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        top_dome: { pos: [cx, cy + 0.40, cz - 0.04], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` }
      }
    };
  }

  // 8 & 9: EXV-C1 / EXV-C2 (Separate Cooling / Defrost Expansion Valves)
  for (const k of [1, 2]) {
    const s = k === 1 ? +1 : -1;
    const ckt = `CKT${k}`;
    const med = `REFRIGERANT_${ckt}`;
    const cx = s * 0.78;
    const cy = 0.88;
    const cz = +0.36;
    nodes[`EXV-C${k}`] = {
      id: `EXV-C${k}`,
      shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe[`EXV-C${k}`],
      titleHe: `שסתום התפשטות אלקטרוני לקירור/הפשרה ${k} (EXV-C${k})`,
      circuit: ckt,
      mediumDomain: med,
      center: [cx, cy, cz],
      boundsSize: [0.18, 0.24, 0.18],
      supportType: 'VALVE_RACK_BRACKET',
      supportTargetId: 'FRAME-BASE',
      massKg: null,
      dimensionsMm: null,
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (CONFIRMED_OEM_TOPOLOGY); opening % telemetry MISSING_DATA',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      assumedGeometryNoteHe: 'גוף השסתום ומנוע הצעדים — ASSUMED_FOR_DEMO; משוב אחוז פתיחה אינו קיים במודל (MISSING_DATA)',
      highlightConnections: [`C${k}-09`, `C${k}-05`],
      ports: {
        in:  { pos: [cx + s * 0.04, cy - 0.08, cz + 0.04], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        out: { pos: [cx, cy + 0.08, cz - 0.06], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` }
      }
    };
  }

  // 10 & 11: EXV-H1 / EXV-H2 (Separate Heating Expansion Valves)
  for (const k of [1, 2]) {
    const s = k === 1 ? +1 : -1;
    const ckt = `CKT${k}`;
    const med = `REFRIGERANT_${ckt}`;
    const cx = s * 1.16;
    const cy = 1.24;
    const cz = +0.48;
    nodes[`EXV-H${k}`] = {
      id: `EXV-H${k}`,
      shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe[`EXV-H${k}`],
      titleHe: `שסתום התפשטות אלקטרוני לחימום ${k} (EXV-H${k})`,
      circuit: ckt,
      mediumDomain: med,
      center: [cx, cy, cz],
      boundsSize: [0.18, 0.24, 0.18],
      supportType: 'UPPER_HEADER_BRACKET',
      supportTargetId: 'FRAME-BASE',
      massKg: null,
      dimensionsMm: null,
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (CONFIRMED_OEM_TOPOLOGY); opening % telemetry MISSING_DATA',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      assumedGeometryNoteHe: 'גוף השסתום ומנוע הצעדים — ASSUMED_FOR_DEMO; משוב אחוז פתיחה אינו קיים במודל (MISSING_DATA)',
      highlightConnections: [`C${k}-09`, `C${k}-12`],
      ports: {
        in:  { pos: [cx - s * 0.04, cy - 0.10, cz], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        out: { pos: [cx + s * 0.04, cy + 0.10, cz - 0.04], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` }
      }
    };
  }

  // 12 & 13: ACOIL1 / ACOIL2 (V-shaped Finned Copper-Aluminum Air Coils)
  for (const k of [1, 2]) {
    const s = k === 1 ? +1 : -1;
    const ckt = `CKT${k}`;
    const med = `REFRIGERANT_${ckt}`;
    const cx = k === 1 ? +1.55 : -1.75;
    const cy = 1.76;
    const cz = 0.00;
    nodes[`ACOIL${k}`] = {
      id: `ACOIL${k}`,
      shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe[`ACOIL${k}`],
      titleHe: `סוללת אוויר (קסטות V נחושת-אלומיניום) מעגל ${k} (ACOIL${k})`,
      circuit: ckt,
      mediumDomain: med,
      center: [cx, cy, cz],
      boundsSize: [2.50, 0.88, 1.96],
      supportType: 'UPPER_DECK_A_FRAME_AND_DRAIN_PAN',
      supportTargetId: 'FRAME-BASE',
      massKg: 164, // 160 / 164 kg per cassette (Table 10 p. 65)
      dimensionsMm: null,
      sourceRef: 'Table 10 p. 65 (160/164 kg), Sec. 7.1 p. 48 (copper tubes + aluminum fins); V-angle is ASSUMED_FOR_DEMO (note: >60° on Fig. 4-2 p. 22 is rigging sling angle, NOT coil V-angle)',
      provenance: 'CONFIRMED_BY_DOC',
      assumedGeometryNoteHe: 'זווית מפתח קסטות ה-V וסידור הסעפות — ASSUMED_FOR_DEMO (זווית >60° באיור 4-2 מתייחסת לרצועות הרמה בלבד)',
      highlightConnections: [`C${k}-12`, `C${k}-13`, `C${k}-14`, `C${k}-06`, `A-0${k}`],
      ports: {
        bot_port:    { pos: [cx - s * 0.25, 1.38, +0.42], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        top_port:    { pos: [cx + s * 0.05, 2.08, -0.12], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        air_in_face: { pos: [cx, 1.72, +0.98], mediumDomain: `AIR_${ckt}`, circuit: ckt, portDomainId: `${ckt}::AIR` },
        air_out_top: { pos: [cx, 2.18, 0.00], mediumDomain: `AIR_${ckt}`, circuit: ckt, portDomainId: `${ckt}::AIR` }
      }
    };
  }

  // 14 & 15: 4WV1 / 4WV2 (4-Way Reversing Valves)
  for (const k of [1, 2]) {
    const s = k === 1 ? +1 : -1;
    const ckt = `CKT${k}`;
    const med = `REFRIGERANT_${ckt}`;
    const cx = s * 1.58;
    const cy = 1.24;
    const cz = -0.14;
    nodes[`4WV${k}`] = {
      id: `4WV${k}`,
      shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe[`4WV${k}`],
      titleHe: `שסתום היפוך 4-דרכי מעגל ${k} (4WV${k})`,
      circuit: ckt,
      mediumDomain: med,
      center: [cx, cy, cz],
      boundsSize: [0.34, 0.26, 0.24],
      supportType: 'PIPE_RACK_CLAMP_STANCHION',
      supportTargetId: 'FRAME-BASE',
      massKg: 22,
      dimensionsMm: null,
      sourceRef: 'Table 10 p. 65 (22 kg), Figure 19 p. 47, Sec. 7.1 p. 48–49',
      provenance: 'CONFIRMED_BY_DOC',
      assumedGeometryNoteHe: 'מיקום המסתם על עמוד הצנרת — ASSUMED_FOR_DEMO',
      highlightConnections: [`C${k}-02`, `C${k}-03`, `C${k}-14`, `C${k}-15`],
      ports: {
        port_D: { pos: [cx + s * 0.12, cy + 0.08, cz], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        port_W: { pos: [cx - s * 0.12, cy - 0.06, cz - 0.08], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        port_A: { pos: [cx - s * 0.04, cy + 0.10, cz + 0.06], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        port_S: { pos: [cx + s * 0.06, cy - 0.08, cz + 0.08], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` }
      }
    };
  }

  // 16 & 17: OS1 / OS2 (Centrifugal Oil Separators)
  for (const k of [1, 2]) {
    const s = k === 1 ? +1 : -1;
    const ckt = `CKT${k}`;
    const med = `REFRIGERANT_${ckt}`;
    const cx = s * 2.48;
    const cy = 0.80;
    const cz = -0.18;
    nodes[`OS${k}`] = {
      id: `OS${k}`,
      shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe[`OS${k}`],
      titleHe: `מפריד שמן צנטריפוגלי ${k} (OS${k}, מעגל ${k})`,
      circuit: ckt,
      mediumDomain: med,
      center: [cx, cy, cz],
      boundsSize: [0.34, 1.06, 0.34],
      supportType: 'VERTICAL_VESSEL_FRAME_STAND',
      supportTargetId: 'FRAME-BASE',
      massKg: 86,
      dimensionsMm: null,
      sourceRef: 'Table 10 p. 65 (86 kg), Sec. 7.1 p. 47–48 (centrifugal separator without coalescing element)',
      provenance: 'CONFIRMED_BY_DOC',
      assumedGeometryNoteHe: 'קוטר וגובה הגליל על השלדה — ASSUMED_FOR_DEMO',
      highlightConnections: [`C${k}-01`, `C${k}-02`, `C${k}-16`],
      ports: {
        gas_in:   { pos: [cx - s * 0.14, cy + 0.24, cz + 0.08], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        gas_out:  { pos: [cx, cy + 0.50, cz], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        oil_sump: { pos: [cx, cy - 0.48, cz + 0.06], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` }
      }
    };
  }

  // 18 & 19: FAN-GRP1 / FAN-GRP2 (6 Axial EC Fans per circuit = 12 total)
  for (const k of [1, 2]) {
    const ckt = `CKT${k}`;
    const cx = k === 1 ? +1.55 : -1.75;
    const cy = 2.34;
    const cz = 0.00;
    nodes[`FAN-GRP${k}`] = {
      id: `FAN-GRP${k}`,
      shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe[`FAN-GRP${k}`],
      titleHe: `קבוצת 6 מאווררי EC ציריים — מעגל ${k} (FAN-GRP${k})`,
      circuit: ckt,
      mediumDomain: `AIR_${ckt}`,
      center: [cx, cy, cz],
      boundsSize: [2.52, 0.32, 2.02],
      supportType: 'UPPER_FAN_DECK_STRUCTURE',
      supportTargetId: 'FRAME-BASE',
      massKg: 324, // 6 × 54 kg (Table 10 p. 65)
      dimensionsMm: null,
      sourceRef: 'Table 10 p. 65 (54 kg each), Sec. 6.3 p. 39 (1.77 kW, 2.8 A each), p. 49 (0% in Defrost); individual fan RPM MISSING_DATA',
      provenance: 'CONFIRMED_BY_DOC',
      assumedGeometryNoteHe: 'גאומטריית כנפי המאוורר והכונסים — ASSUMED_FOR_DEMO; סל״ד נפרד לכל מאוורר אינו קיים במודל (MISSING_DATA)',
      highlightConnections: [], // Strict S1-VISUAL-04 physical rule: 0 refrigerant/water pipes!
      airAndElecConnections: [`A-0${k}`, 'E-01'],
      ports: {
        air_in_deck: { pos: [cx, 2.20, 0.00], mediumDomain: `AIR_${ckt}`, circuit: ckt, portDomainId: `${ckt}::AIR` },
        air_out_top: { pos: [cx, 2.48, 0.00], mediumDomain: `AIR_${ckt}`, circuit: ckt, portDomainId: `${ckt}::AIR` },
        elec_in:     { pos: [cx + (k === 1 ? +1.10 : +1.10), 2.26, -0.88], mediumDomain: 'ELEC_400V', circuit: 'ELEC', portDomainId: 'CTRL::POWER_400V' }
      }
    };
  }

  // 20 & 21: OIL-CKT1 / OIL-CKT2 (Oil Management Assemblies per OEM p. 49: Oil Cooler -> Shutoff Valve -> Internal Filter -> Check Valve -> Compressor)
  for (const k of [1, 2]) {
    const s = k === 1 ? +1 : -1;
    const ckt = `CKT${k}`;
    const med = `REFRIGERANT_${ckt}`;
    const cx = s * 2.22;
    const cy = 0.44;
    const cz = +0.32;
    nodes[`OIL-CKT${k}`] = {
      id: `OIL-CKT${k}`,
      shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe[`OIL-CKT${k}`],
      titleHe: `מערכת ניהול וקירור שמן מעגל ${k} (OC${k} → VLV-OIL-SHUT${k} → OF-INT${k} → CV-OIL${k})`,
      circuit: ckt,
      mediumDomain: med,
      center: [cx, cy, cz],
      boundsSize: [0.58, 0.34, 0.48],
      supportType: 'LOWER_FRAME_OIL_SKID_BRACKET',
      supportTargetId: 'FRAME-BASE',
      massKg: 10, // 10 kg OIL00388 oil charge per circuit (Table 2 p. 16, p. 57)
      dimensionsMm: null,
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 Oil Management p. 49 (Oil Cooler → Shutoff Valve → Internal Filter → Check Valve → Compressor), p. 56 (max ΔP 150 psig)',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      assumedGeometryNoteHe: 'סידור הצנרת ומסנן השמן הפנימי בחלל הכניסה של המדחס — ASSUMED_FOR_DEMO',
      highlightConnections: [`C${k}-16`, `C${k}-17`, `C${k}-18`],
      ports: {
        oil_from_os:    { pos: [cx + s * 0.18, cy - 0.04, cz - 0.22], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        oil_to_comp:    { pos: [cx - s * 0.14, cy + 0.02, cz + 0.08], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        ref_from_hdr:   { pos: [cx - s * 0.22, cy + 0.06, cz + 0.12], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` },
        ref_to_suction: { pos: [cx - s * 0.26, cy + 0.14, cz + 0.04], mediumDomain: med, circuit: ckt, portDomainId: `${ckt}::REFRIG` }
      }
    };
  }

  // 22: FS-HP01 (Water Flow Switch on DN150 outlet pipe W-03)
  nodes['FS-HP01'] = {
    id: 'FS-HP01',
    shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe['FS-HP01'],
    titleHe: 'מפסק זרימת מים ראשי (FS-HP01 — להב 60 מ״מ על צינור יציאה DN150)',
    circuit: 'WATER',
    mediumDomain: 'PRIMARY_WATER',
    center: [+2.44, 0.98, -0.58],
    boundsSize: [0.32, 0.36, 0.28],
    supportType: 'MOUNTED_ON_DN150_OUTLET_PIPE_W03',
    supportTargetId: 'WHEX',
    massKg: null,
    dimensionsMm: { paddleLengthAMm: 60, pipeDnMm: 150 },
    sourceRef: 'Table 4 p. 31, Fig. 9 p. 32 (A = 60 mm for DN150/6"), interlock < 15.3 L/s with 6 s delay',
    provenance: 'CONFIRMED_BY_DOC',
    assumedGeometryNoteHe: 'גוף קופסת המפסק על מקטע הצינור הישר — ASSUMED_FOR_DEMO',
    highlightConnections: ['W-03'],
    elecConnections: ['E-03'],
    ports: {
      in:               { pos: [+2.32, 0.98, -0.52], mediumDomain: 'PRIMARY_WATER', circuit: 'WATER', portDomainId: 'WHEX::WATER_TUBES' },
      out:              { pos: [+2.56, 0.98, -0.64], mediumDomain: 'PRIMARY_WATER', circuit: 'WATER', portDomainId: 'WHEX::WATER_TUBES' },
      signal_interlock: { pos: [+2.44, 1.16, -0.58], mediumDomain: 'CONTROL_24V_230V', circuit: 'ELEC', portDomainId: 'CTRL::FS_INTERLOCK' }
    }
  };

  // 23: DRAIN-SYS (Condensate / Defrost Drain Pans & Waterbox Drain Manifold DN50)
  nodes['DRAIN-SYS'] = {
    id: 'DRAIN-SYS',
    shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe['DRAIN-SYS'],
    titleHe: 'מערכת מגשי ניקוז עיבוי/הפשרה וריקון קופסאות מים (DRAIN-SYS, DN50)',
    circuit: 'DRAIN',
    mediumDomain: 'DRAIN_WATER',
    center: [-0.10, 1.30, -0.52],
    boundsSize: [6.20, 1.05, 1.85],
    supportType: 'INTEGRATED_FRAME_TRAYS_AND_BRACKETS',
    supportTargetId: 'FRAME-BASE',
    massKg: null,
    dimensionsMm: { drainHeaderDnMm: 50 },
    sourceRef: 'Sec. 5.5 p. 29, Sec. 5.7 p. 32, Sec. 9.2 p. 74 (CONFIRMED_BY_DOC geometry); drain flow rate MISSING_DATA',
    provenance: 'CONFIRMED_BY_DOC',
    assumedGeometryNoteHe: 'תוואי סעפת הניקוז DN50 — ASSUMED_FOR_DEMO; ספיקת מי הפשרה/ניקוז אינה מחושבת במודל (MISSING_DATA — 0 חלקיקים)',
    highlightConnections: ['W-04'],
    ports: {
      acoil1_pan_out:     { pos: [+1.55, 1.30, -0.68], mediumDomain: 'DRAIN_WATER', circuit: 'DRAIN', portDomainId: 'WHEX::DRAIN_BOX' },
      acoil2_pan_out:     { pos: [-1.75, 1.30, -0.68], mediumDomain: 'DRAIN_WATER', circuit: 'DRAIN', portDomainId: 'WHEX::DRAIN_BOX' },
      waterbox_drain_in:  { pos: [-2.18, 0.36, -0.68], mediumDomain: 'DRAIN_WATER', circuit: 'DRAIN', portDomainId: 'WHEX::DRAIN_BOX' },
      drain_manifold_out: { pos: [-2.95, 0.28, -0.88], mediumDomain: 'DRAIN_WATER', circuit: 'DRAIN', portDomainId: 'WHEX::DRAIN_BOX' }
    }
  };

  // 24: CTRL-SYMBIO (Starter & Control Panel: Symbio 800, TD7, 2×VFD CA300-4T132, 1K27/1K28)
  nodes['CTRL-SYMBIO'] = {
    id: 'CTRL-SYMBIO',
    shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe['CTRL-SYMBIO'],
    titleHe: 'ארון התנעה ובקרה ראשי (Symbio 800, מסך TD7, שני וסתי תדר CA300-4T132)',
    circuit: 'CONTROL_ELEC',
    mediumDomain: 'ELEC_400V',
    center: [+3.50, 1.24, 0.00],
    boundsSize: [0.66, 1.92, 2.08],
    supportType: 'BOLTED_TO_RIGHT_END_OF_FRAME_BASE',
    supportTargetId: 'FRAME-BASE',
    massKg: 356,
    dimensionsMm: { vfdEachMm: [375, 550, 320] },
    sourceRef: 'Table 10 p. 65 (356 kg), Table 11–12 p. 67–69 (CA300-4T132 375×550×320 mm, 46 kg), Sec. 6 p. 36–46',
    provenance: 'CONFIRMED_BY_DOC',
    assumedGeometryNoteHe: 'סידור פנימי של הבקר והמגעים בתוך הארון — ASSUMED_FOR_DEMO',
    highlightConnections: [], // Strict S1-VISUAL-04 physical rule: 0 refrigerant/water pipes!
    elecConnections: ['E-01', 'E-02', 'E-03', 'E-04'],
    ports: {
      main_400v_in:           { pos: [+3.20, 1.82, -0.82], mediumDomain: 'ELEC_400V', circuit: 'ELEC', portDomainId: 'CTRL::POWER_400V' },
      ext_230v_out:           { pos: [+3.20, 0.68, -0.68], mediumDomain: 'ELEC_230V', circuit: 'ELEC', portDomainId: 'WHEX::HEATER_TERM' },
      pump_fs_interlock_port: { pos: [+3.20, 1.16, -0.58], mediumDomain: 'CONTROL_24V_230V', circuit: 'ELEC', portDomainId: 'CTRL::FS_INTERLOCK' },
      bacnet_bms_port:        { pos: [+3.52, 1.65, +0.85], mediumDomain: 'CONTROL_BMS', circuit: 'ELEC', portDomainId: 'CTRL::BMS' }
    }
  };

  // 25: FRAME-BASE (Structural Base Frame, 8 Isolators W1..W8, 8 Rigging Lugs A..H, CG, Clearance Envelope)
  nodes['FRAME-BASE'] = {
    id: 'FRAME-BASE',
    shortNameHe: HP01_CUTAWAY_TEXT_HE.subNodeShortNamesHe['FRAME-BASE'],
    titleHe: 'שלדת בסיס מפלדה, 8 מבודדי רעידות (W1..W8), 8 אוזני הרמה (A..H) ומרכז כובד (CG)',
    circuit: 'STRUCTURE',
    mediumDomain: 'STRUCTURE',
    center: [0.00, 0.18, 0.00],
    boundsSize: [7.90, 2.50, 2.25],
    supportType: 'SUPPORTED_BY_8_NEOPRENE_ISOLATORS_W1_W8',
    supportTargetId: 'GROUND_SLAB',
    massKg: 7371, // 6901 kg shipping / 7371 kg operating (Table 2 p. 17, 23) vs 6842 kg sum of W1..W8 (Table 7 p. 51)
    dimensionsMm: {
      lengthOverallMm: 7900,
      lengthDrawingMm: 7882,
      lengthFrameMm: 7694,
      widthOverallMm: 2250,
      widthMountMm: 2170,
      heightOverallMm: 2500
    },
    sourceRef: 'Table 2 p. 17 & 23 (7900×2250×2500 mm, 6901/7371 kg), Fig. 3-2 p. 19–20 (7882 mm, 2500 mm clearance), Fig. 4-2 p. 22 (A..H, >60° sling angle), Fig. 5-4 p. 25 (7694 mm, W1..W8 at 1285, 2885, 4385, 6185 mm), Table 7 p. 51 (6842 kg)',
    provenance: 'CONFIRMED_BY_DOC',
    assumedGeometryNoteHe: 'פרופילי קורות הפלדה הפנימיות ועמודי התמיכה — ASSUMED_FOR_DEMO; פערי מידות אורך (7900/7882/7694 מ״מ) ומשקל (6842 מול 7371 ק״ג) מתועדים כ-REQUIRES_CLARIFICATION',
    highlightConnections: [],
    ports: {
      iso_W1: { pos: [+2.338, 0.035, +1.085], mediumDomain: 'STRUCTURE', circuit: 'STRUCTURE', portDomainId: 'STRUCT::ISO' },
      iso_W2: { pos: [+2.338, 0.035, -1.085], mediumDomain: 'STRUCTURE', circuit: 'STRUCTURE', portDomainId: 'STRUCT::ISO' },
      iso_W3: { pos: [+0.538, 0.035, +1.085], mediumDomain: 'STRUCTURE', circuit: 'STRUCTURE', portDomainId: 'STRUCT::ISO' },
      iso_W4: { pos: [+0.538, 0.035, -1.085], mediumDomain: 'STRUCTURE', circuit: 'STRUCTURE', portDomainId: 'STRUCT::ISO' },
      iso_W5: { pos: [-0.962, 0.035, +1.085], mediumDomain: 'STRUCTURE', circuit: 'STRUCTURE', portDomainId: 'STRUCT::ISO' },
      iso_W6: { pos: [-0.962, 0.035, -1.085], mediumDomain: 'STRUCTURE', circuit: 'STRUCTURE', portDomainId: 'STRUCT::ISO' },
      iso_W7: { pos: [-2.562, 0.035, +1.085], mediumDomain: 'STRUCTURE', circuit: 'STRUCTURE', portDomainId: 'STRUCT::ISO' },
      iso_W8: { pos: [-2.562, 0.035, -1.085], mediumDomain: 'STRUCTURE', circuit: 'STRUCTURE', portDomainId: 'STRUCT::ISO' },
      cg_marker: { pos: [+0.004, 0.937, -0.005], mediumDomain: 'STRUCTURE', circuit: 'STRUCTURE', portDomainId: 'STRUCT::CG' }
    }
  };

    return Object.freeze(
      Object.fromEntries(
        Object.entries(nodes).map(([id, n]) => [
          id,
          Object.freeze({
            ...n,
            confirmedDocNoteHe:
              n.confirmedDocNoteHe ||
              `נתוני תיעוד ומקור (${n.provenance}): ${n.sourceRef}${n.massKg !== null ? ` | מסה בדרכון: ${n.massKg} ק״ג` : ''}`
          })
        ])
      )
    );
}

export const HP01_SUBNODES = buildSubNodesCatalog();

/**
 * 19 paired functional categories = 38 physical auxiliary 3D sub-elements (S2P-03, S2P-06)
 * Includes oil shutoff valve VLV-OIL-SHUT1/2 and internal oil filter OF-INT1/2 per OEM p. 49.
 */
function buildAuxValvesCatalog() {
  const aux = {};

  for (const k of [1, 2]) {
    const s = k === 1 ? +1 : -1;
    const ckt = `CKT${k}`;
    const med = `REFRIGERANT_${ckt}`;
    const dom = `${ckt}::REFRIG`;

    // Category 1: CV-WHEX1 / CV-WHEX2 (Lower liquid check valve from WHEX)
    aux[`CV-WHEX${k}`] = {
      id: `CV-WHEX${k}`,
      categoryIndex: 1,
      categoryKey: 'CV-WHEX',
      circuit: ckt,
      parentSubNodeId: `ECON${k}`,
      shortNameHe: `אל-חוזר תחתון CV-WHEX${k}`,
      titleHe: `שסתום אל-חוזר יציאת נוזל ממחליף המים (CV-WHEX${k}, מעגל ${k})`,
      mediumDomain: med,
      center: [s * 1.18, 0.50, +0.46],
      boundsSize: [0.12, 0.10, 0.10],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'OPEN', DEFROST: 'CLOSED', STOPPED: 'CLOSED', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 1.20, 0.48, +0.40], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 1.16, 0.52, +0.52], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 2: CV-ACOIL1 / CV-ACOIL2 (Upper liquid check valve from ACOIL)
    aux[`CV-ACOIL${k}`] = {
      id: `CV-ACOIL${k}`,
      categoryIndex: 2,
      categoryKey: 'CV-ACOIL',
      circuit: ckt,
      parentSubNodeId: `ECON${k}`,
      shortNameHe: `אל-חוזר עליון CV-ACOIL${k}`,
      titleHe: `שסתום אל-חוזר יציאת נוזל מסוללת האוויר בהפשרה (CV-ACOIL${k}, מעגל ${k})`,
      mediumDomain: med,
      center: [s * 1.24, 1.06, +0.52],
      boundsSize: [0.10, 0.12, 0.10],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'CLOSED', DEFROST: 'OPEN', STOPPED: 'CLOSED', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 1.24, 1.12, +0.50], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 1.24, 1.00, +0.54], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 3: LIQ-HDR-IN1 / LIQ-HDR-IN2 (Common liquid inlet header before filter)
    aux[`LIQ-HDR-IN${k}`] = {
      id: `LIQ-HDR-IN${k}`,
      categoryIndex: 3,
      categoryKey: 'LIQ-HDR-IN',
      circuit: ckt,
      parentSubNodeId: `ECON${k}`,
      shortNameHe: `סעפת כניסה למסנן LIQ-HDR-IN${k}`,
      titleHe: `צומת איחוד קו נוזל לפני מסנן-מייבש (LIQ-HDR-IN${k}, מעגל ${k})`,
      mediumDomain: med,
      center: [s * 1.18, 0.84, +0.54],
      boundsSize: [0.12, 0.14, 0.12],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'PASS_THROUGH', DEFROST: 'PASS_THROUGH', STOPPED: 'STATIC', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in_whex:     { pos: [s * 1.18, 0.78, +0.54], mediumDomain: med, circuit: ckt, portDomainId: dom },
        in_acoil:    { pos: [s * 1.20, 0.90, +0.54], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out_to_filt: { pos: [s * 1.14, 0.84, +0.54], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 4: FILT1 / FILT2 (Unidirectional Liquid Line Filter-Drier)
    aux[`FILT${k}`] = {
      id: `FILT${k}`,
      categoryIndex: 4,
      categoryKey: 'FILT',
      circuit: ckt,
      parentSubNodeId: `ECON${k}`,
      shortNameHe: `מסנן-מייבש קו נוזל FILT${k}`,
      titleHe: `מסנן-מייבש קו נוזל חד-כיווני (FILT${k}, מעגל ${k})`,
      mediumDomain: med,
      center: [s * 1.08, 0.84, +0.54],
      boundsSize: [0.16, 0.12, 0.12],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (unidirectional in both Heating and Defrost)',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'FLOW_FORWARD', DEFROST: 'FLOW_FORWARD', STOPPED: 'STATIC', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 1.12, 0.84, +0.54], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 1.04, 0.84, +0.54], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 5: LIQ-POST-FILT1 / LIQ-POST-FILT2 (Economizer tap tee AFTER FILT.out and BEFORE ECON.main_in)
    aux[`LIQ-POST-FILT${k}`] = {
      id: `LIQ-POST-FILT${k}`,
      categoryIndex: 5,
      categoryKey: 'LIQ-POST-FILT',
      circuit: ckt,
      parentSubNodeId: `ECON${k}`,
      shortNameHe: `צומת פיצול אקונומייזר LIQ-POST-FILT${k}`,
      titleHe: `צומת פיצול לאקונומייזר אחרי המסנן ולפני כניסת האקונומייזר (LIQ-POST-FILT${k})`,
      mediumDomain: med,
      center: [s * 1.02, 0.84, +0.54],
      boundsSize: [0.08, 0.08, 0.08],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47 (S1-VALIDITY-02 Rule 3: tap after Filter and before ECON.main_in)',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'SPLIT_MAIN_AND_ECON', DEFROST: 'MAIN_ONLY', STOPPED: 'STATIC', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in_from_filt:    { pos: [s * 1.03, 0.84, +0.54], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out_main:        { pos: [s * 1.01, 0.84, +0.54], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out_econ_branch: { pos: [s * 1.02, 0.87, +0.58], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 6: EXV-ECON1 / EXV-ECON2 (Economizer Expansion Valve)
    aux[`EXV-ECON${k}`] = {
      id: `EXV-ECON${k}`,
      categoryIndex: 6,
      categoryKey: 'EXV-ECON',
      circuit: ckt,
      parentSubNodeId: `ECON${k}`,
      shortNameHe: `שסתום התפשטות אקונומייזר EXV-ECON${k}`,
      titleHe: `שסתום התפשטות אלקטרוני להזרקת אקונומייזר (EXV-ECON${k}, מעגל ${k})`,
      mediumDomain: med,
      center: [s * 0.90, 0.94, +0.62],
      boundsSize: [0.12, 0.16, 0.12],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (CONFIRMED_OEM_TOPOLOGY); opening % MISSING_DATA',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'MODULATING_AT_HIGH_LOAD', DEFROST: 'CLOSED', STOPPED: 'CLOSED', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 0.94, 0.94, +0.62], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 0.86, 0.90, +0.62], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 7: LIQ-HDR-OUT1 / LIQ-HDR-OUT2 (Subcooled Liquid Outlet Manifold after ECON.main_out)
    aux[`LIQ-HDR-OUT${k}`] = {
      id: `LIQ-HDR-OUT${k}`,
      categoryIndex: 7,
      categoryKey: 'LIQ-HDR-OUT',
      circuit: ckt,
      parentSubNodeId: `ECON${k}`,
      shortNameHe: `סעפת יציאת נוזל LIQ-HDR-OUT${k}`,
      titleHe: `סעפת חלוקת נוזל בקירור-יתר אחרי האקונומייזר (LIQ-HDR-OUT${k}, מעגל ${k})`,
      mediumDomain: med,
      center: [s * 1.02, 0.50, +0.52],
      boundsSize: [0.14, 0.12, 0.14],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'TO_EXV_H_AND_TXV_OIL', DEFROST: 'TO_EXV_C_AND_TXV_OIL', STOPPED: 'STATIC', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in_from_econ: { pos: [s * 1.00, 0.52, +0.54], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out_exv_h:    { pos: [s * 1.06, 0.54, +0.50], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out_exv_c:    { pos: [s * 0.96, 0.54, +0.48], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out_txv_oil:  { pos: [s * 1.06, 0.46, +0.50], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 8: SOL-REC-IN1 / SOL-REC-IN2 (Receiver Fill Solenoid Valve, Normal Close, Table 6 p. 49)
    aux[`SOL-REC-IN${k}`] = {
      id: `SOL-REC-IN${k}`,
      categoryIndex: 8,
      categoryKey: 'SOL-REC-IN',
      circuit: ckt,
      parentSubNodeId: `REC${k}`,
      shortNameHe: `ברז סולנואיד מילוי רסיבר SOL-REC-IN${k}`,
      titleHe: `ברז סולנואיד מילוי רסיבר נוזל — Normal Close (SOL-REC-IN${k}, טבלה 6 עמ׳ 49)`,
      mediumDomain: med,
      center: [s * 0.58, 1.06, +0.34],
      boundsSize: [0.10, 0.14, 0.10],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47, Table 6 p. 49 (Fill Valve Normal Close: Close de-energized in all 4 steady modes)',
      provenance: 'CONFIRMED_BY_DOC',
      statesByMode: { HEATING: 'CLOSED_DEENERGIZED', DEFROST: 'CLOSED_DEENERGIZED', STOPPED: 'CLOSED_DEENERGIZED', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 0.62, 1.10, +0.36], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 0.54, 1.02, +0.32], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 9: CV-REC-IN1 / CV-REC-IN2 (Receiver Fill Check Valve)
    aux[`CV-REC-IN${k}`] = {
      id: `CV-REC-IN${k}`,
      categoryIndex: 9,
      categoryKey: 'CV-REC-IN',
      circuit: ckt,
      parentSubNodeId: `REC${k}`,
      shortNameHe: `אל-חוזר מילוי רסיבר CV-REC-IN${k}`,
      titleHe: `שסתום אל-חוזר קו מילוי רסיבר (CV-REC-IN${k}, מעגל ${k})`,
      mediumDomain: med,
      center: [s * 0.50, 0.94, +0.30],
      boundsSize: [0.09, 0.09, 0.09],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'CLOSED', DEFROST: 'CLOSED', STOPPED: 'CLOSED', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 0.52, 0.96, +0.31], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 0.48, 0.92, +0.29], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 10: SRV-REC1 / SRV-REC2 (Receiver Outlet Manual Service Valve)
    aux[`SRV-REC${k}`] = {
      id: `SRV-REC${k}`,
      categoryIndex: 10,
      categoryKey: 'SRV-REC',
      circuit: ckt,
      parentSubNodeId: `REC${k}`,
      shortNameHe: `ברז שירות יציאת רסיבר SRV-REC${k}`,
      titleHe: `ברז שירות ידני ביציאה תחתונה של הרסיבר (SRV-REC${k}, מעגל ${k})`,
      mediumDomain: med,
      center: [s * 0.46, 0.22, +0.12],
      boundsSize: [0.10, 0.10, 0.10],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'SERVICE_OPEN', DEFROST: 'SERVICE_OPEN', STOPPED: 'SERVICE_OPEN', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 0.46, 0.24, +0.16], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 0.46, 0.22, +0.08], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 11: SOL-REC-OUT1 / SOL-REC-OUT2 (Receiver Discharge Solenoid Valve, Normal Open, Table 6 p. 49)
    aux[`SOL-REC-OUT${k}`] = {
      id: `SOL-REC-OUT${k}`,
      categoryIndex: 11,
      categoryKey: 'SOL-REC-OUT',
      circuit: ckt,
      parentSubNodeId: `REC${k}`,
      shortNameHe: `ברז סולנואיד פריקת רסיבר SOL-REC-OUT${k}`,
      titleHe: `ברז סולנואיד פריקת רסיבר — Normal Open (SOL-REC-OUT${k}, טבלה 6 עמ׳ 49)`,
      mediumDomain: med,
      center: [s * 0.48, 0.30, +0.00],
      boundsSize: [0.10, 0.14, 0.10],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47, Table 6 p. 49 (Closed energized in Heating; Open de-energized in Defrost/Cooling)',
      provenance: 'CONFIRMED_BY_DOC',
      statesByMode: { HEATING: 'CLOSED_ENERGIZED', DEFROST: 'OPEN_DEENERGIZED', STOPPED: 'CLOSED_ENERGIZED', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 0.47, 0.28, +0.04], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 0.49, 0.32, -0.04], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 12: CV-REC-OUT1 / CV-REC-OUT2 (Receiver Discharge Check Valve to WHEX)
    aux[`CV-REC-OUT${k}`] = {
      id: `CV-REC-OUT${k}`,
      categoryIndex: 12,
      categoryKey: 'CV-REC-OUT',
      circuit: ckt,
      parentSubNodeId: `REC${k}`,
      shortNameHe: `אל-חוזר פריקת רסיבר CV-REC-OUT${k}`,
      titleHe: `שסתום אל-חוזר פריקת רסיבר לתחתית מחליף החום (CV-REC-OUT${k}, מעגל ${k})`,
      mediumDomain: med,
      center: [s * 0.50, 0.38, -0.08],
      boundsSize: [0.09, 0.09, 0.09],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'CLOSED', DEFROST: 'OPEN', STOPPED: 'CLOSED', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 0.50, 0.36, -0.06], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 0.51, 0.40, -0.10], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 13: CV-REC-TOP1 / CV-REC-TOP2 (Check valve on secondary unknown branch Ck-07b)
    aux[`CV-REC-TOP${k}`] = {
      id: `CV-REC-TOP${k}`,
      categoryIndex: 13,
      categoryKey: 'CV-REC-TOP',
      circuit: ckt,
      parentSubNodeId: `REC${k}`,
      shortNameHe: `אל-חוזר ענף משני CV-REC-TOP${k}`,
      titleHe: `שסתום אל-חוזר בענף רסיבר משני (CV-REC-TOP${k} — UNKNOWN_TOPOLOGY)`,
      mediumDomain: med,
      center: [s * 0.62, 1.12, +0.12],
      boundsSize: [0.08, 0.08, 0.08],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47 purple line without confirmation in Table 6 p. 49 (UNKNOWN_TOPOLOGY)',
      provenance: 'UNKNOWN_TOPOLOGY',
      statesByMode: { HEATING: 'UNKNOWN_TOPOLOGY', DEFROST: 'UNKNOWN_TOPOLOGY', STOPPED: 'UNKNOWN_TOPOLOGY', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 0.58, 1.08, +0.10], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 0.66, 1.16, +0.14], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 14: OC1 / OC2 (Brazed-Plate Oil Cooler)
    aux[`OC${k}`] = {
      id: `OC${k}`,
      categoryIndex: 14,
      categoryKey: 'OC',
      circuit: ckt,
      parentSubNodeId: `OIL-CKT${k}`,
      shortNameHe: `מקולר שמן פלטות OC${k}`,
      titleHe: `מקולר שמן פלטות מלובדות (OC${k}, מעגל ${k})`,
      mediumDomain: med,
      center: [s * 2.28, 0.42, +0.26],
      boundsSize: [0.18, 0.24, 0.16],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48–49',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'ACTIVE_COOLING', DEFROST: 'ACTIVE_COOLING', STOPPED: 'STATIC', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        oil_in:  { pos: [s * 2.34, 0.36, +0.20], mediumDomain: med, circuit: ckt, portDomainId: dom },
        oil_out: { pos: [s * 2.24, 0.38, +0.26], mediumDomain: med, circuit: ckt, portDomainId: dom },
        ref_in:  { pos: [s * 2.22, 0.46, +0.32], mediumDomain: med, circuit: ckt, portDomainId: dom },
        ref_out: { pos: [s * 2.22, 0.52, +0.30], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 15: TXV-OIL1 / TXV-OIL2 (Oil Cooler Thermal Expansion Valve)
    aux[`TXV-OIL${k}`] = {
      id: `TXV-OIL${k}`,
      categoryIndex: 15,
      categoryKey: 'TXV-OIL',
      circuit: ckt,
      parentSubNodeId: `OIL-CKT${k}`,
      shortNameHe: `שסתום התפשטות מקולר שמן TXV-OIL${k}`,
      titleHe: `שסתום התפשטות תרמוסטטי למקולר שמן (TXV-OIL${k}, מעגל ${k})`,
      mediumDomain: med,
      center: [s * 2.04, 0.46, +0.38],
      boundsSize: [0.10, 0.12, 0.10],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48',
      provenance: 'CONFIRMED_OEM_TOPOLOGY',
      statesByMode: { HEATING: 'MODULATING', DEFROST: 'MODULATING', STOPPED: 'CLOSED', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 2.00, 0.46, +0.40], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 2.08, 0.46, +0.36], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 16: VLV-OIL-SHUT1 / VLV-OIL-SHUT2 (Oil Line Shutoff Valve after Oil Cooler — OEM p. 49 S2P-06!)
    aux[`VLV-OIL-SHUT${k}`] = {
      id: `VLV-OIL-SHUT${k}`,
      categoryIndex: 16,
      categoryKey: 'VLV-OIL-SHUT',
      circuit: ckt,
      parentSubNodeId: `OIL-CKT${k}`,
      shortNameHe: `ברז ניתוק קו שמן VLV-OIL-SHUT${k}`,
      titleHe: `ברז ניתוק קו שמן אחרי מקולר השמן (Shutoff Valve VLV-OIL-SHUT${k}, עמ׳ 49)`,
      mediumDomain: med,
      center: [s * 2.18, 0.40, +0.30],
      boundsSize: [0.09, 0.10, 0.09],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'OEM Manual Sec. 7.1 Oil Management p. 49 ("oil cooler, shutoff valve, internal filter, and oil supply check valve")',
      provenance: 'CONFIRMED_BY_DOC',
      statesByMode: { HEATING: 'SERVICE_OPEN', DEFROST: 'SERVICE_OPEN', STOPPED: 'SERVICE_OPEN', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 2.20, 0.39, +0.28], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 2.16, 0.41, +0.32], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 17: OF-INT1 / OF-INT2 (Internal Oil Filter inside Compressor Oil Bore — OEM p. 49, 56 S2P-06!)
    aux[`OF-INT${k}`] = {
      id: `OF-INT${k}`,
      categoryIndex: 17,
      categoryKey: 'OF-INT',
      circuit: ckt,
      parentSubNodeId: `OIL-CKT${k}`,
      shortNameHe: `מסנן שמן פנימי OF-INT${k}`,
      titleHe: `מסנן שמן פנימי במדחס (Internal Oil Filter OF-INT${k}, עמ׳ 49, 56 — ASSUMED_FOR_DEMO)`,
      mediumDomain: med,
      center: [s * 2.13, 0.43, +0.35],
      boundsSize: [0.10, 0.09, 0.09],
      supportTargetId: `COMP${k}`,
      sourceRef: 'OEM Manual Sec. 7.1 p. 49 & Sec. 8.3 p. 56 (Internal Oil Filter, max ΔP 150 psig / 10.3 bar); 3D pocket representation ASSUMED_FOR_DEMO',
      provenance: 'CONFIRMED_BY_DOC',
      statesByMode: { HEATING: 'FILTERING_ACTIVE', DEFROST: 'FILTERING_ACTIVE', STOPPED: 'STATIC', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 2.14, 0.42, +0.34], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 2.12, 0.44, +0.36], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 18: CV-OIL1 / CV-OIL2 (Oil Supply Check Valve before COMP.oil_in — OEM p. 49)
    aux[`CV-OIL${k}`] = {
      id: `CV-OIL${k}`,
      categoryIndex: 18,
      categoryKey: 'CV-OIL',
      circuit: ckt,
      parentSubNodeId: `OIL-CKT${k}`,
      shortNameHe: `אל-חוזר אספקת שמן CV-OIL${k}`,
      titleHe: `שסתום אל-חוזר אספקת שמן למדחס (Oil Supply Check Valve CV-OIL${k}, עמ׳ 49)`,
      mediumDomain: med,
      center: [s * 2.11, 0.45, +0.38],
      boundsSize: [0.08, 0.08, 0.08],
      supportTargetId: `COMP${k}`,
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 49 (closes at compressor shutdown)',
      provenance: 'CONFIRMED_BY_DOC',
      statesByMode: { HEATING: 'OPEN', DEFROST: 'OPEN', STOPPED: 'CLOSED', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 2.115, 0.445, +0.37], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 2.11, 0.46, +0.40], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };

    // Category 19: SOL-OIL1 / SOL-OIL2 (Oil Return Solenoid Valve from WHEX to COMP.oil_ret_in — OEM p. 49)
    aux[`SOL-OIL${k}`] = {
      id: `SOL-OIL${k}`,
      categoryIndex: 19,
      categoryKey: 'SOL-OIL',
      circuit: ckt,
      parentSubNodeId: `OIL-CKT${k}`,
      shortNameHe: `ברז סולנואיד החזרת שמן SOL-OIL${k}`,
      titleHe: `ברז סולנואיד החזרת שמן ממחליף המים (SOL-OIL${k}, פתוח בהפשרה/קירור עמ׳ 49)`,
      mediumDomain: med,
      center: [s * 1.68, 0.44, +0.08],
      boundsSize: [0.10, 0.12, 0.10],
      supportTargetId: 'FRAME-BASE',
      sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 49 (closed in Heating, open in Defrost/Cooling)',
      provenance: 'CONFIRMED_BY_DOC',
      statesByMode: { HEATING: 'CLOSED', DEFROST: 'OPEN', STOPPED: 'CLOSED', UNKNOWN_OR_MISSING: 'UNKNOWN' },
      ports: {
        in:  { pos: [s * 1.68, 0.43, +0.02], mediumDomain: med, circuit: ckt, portDomainId: dom },
        out: { pos: [s * 1.68, 0.45, +0.14], mediumDomain: med, circuit: ckt, portDomainId: dom }
      }
    };
  }

  return Object.freeze(aux);
}

export const HP01_AUX_VALVES = buildAuxValvesCatalog();

/**
 * Helper to look up exact 3D port descriptor and coordinates from HP01_SUBNODES, HP01_AUX_VALVES, or HP01_BOUNDARY_PORTS
 */
export function resolveHP01PortDescriptor(ownerId, portName) {
  if (HP01_SUBNODES[ownerId] && HP01_SUBNODES[ownerId].ports[portName]) {
    const p = HP01_SUBNODES[ownerId].ports[portName];
    return { ownerType: 'SUBNODE', ownerId, portName, ...p };
  }
  if (HP01_AUX_VALVES[ownerId] && HP01_AUX_VALVES[ownerId].ports[portName]) {
    const p = HP01_AUX_VALVES[ownerId].ports[portName];
    return { ownerType: 'AUX', ownerId, portName, ...p };
  }
  if (HP01_BOUNDARY_PORTS[ownerId] && HP01_BOUNDARY_PORTS[ownerId].portName === portName) {
    const p = HP01_BOUNDARY_PORTS[ownerId];
    return { ownerType: 'BOUNDARY', ownerId, portName, ...p };
  }
  throw new Error(`Unresolved HP01 port: ${ownerId}.${portName}`);
}

/**
 * Canonical catalog of all 48 unique internal & boundary connections (S2P-03, S2P-06)
 * 19 CKT1 + 19 CKT2 + 4 Water (W-01..04) + 2 Air (A-01..02) + 4 Electrical/Control (E-01..04) = 48
 */
function buildInternalConnectionsCatalog() {
  const conns = {};

  for (const k of [1, 2]) {
    const s = k === 1 ? +1 : -1;
    const ckt = `CKT${k}`;
    const med = `REFRIGERANT_${ckt}`;
    const whexDom = `WHEX::SHELL_${ckt}`;
    const p = (ownerId, portName) => resolveHP01PortDescriptor(ownerId, portName);

    // 1. Ck-01: COMPk.disch_out -> OSk.gas_in
    {
      const from = p(`COMP${k}`, 'disch_out');
      const to = p(`OS${k}`, 'gas_in');
      conns[`C${k}-01`] = {
        id: `C${k}-01`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [],
        pipeRadiusM: 0.030,
        colorHex: '#ef4444',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: +1, DEFROST: +1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47 (Compressor discharge to Oil Separator)',
        waypoints: [
          from.pos,
          [s * 2.29, 1.08, +0.48],
          [s * 2.34, 1.08, -0.10],
          to.pos
        ]
      };
    }

    // 2. Ck-02: OSk.gas_out -> 4WVk.port_D
    {
      const from = p(`OS${k}`, 'gas_out');
      const to = p(`4WV${k}`, 'port_D');
      conns[`C${k}-02`] = {
        id: `C${k}-02`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [],
        pipeRadiusM: 0.030,
        colorHex: '#ef4444',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: +1, DEFROST: +1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47 (Oil Separator gas outlet to 4-Way Valve port D)',
        waypoints: [
          from.pos,
          [s * 2.48, 1.40, -0.18],
          [s * 1.70, 1.40, -0.14],
          to.pos
        ]
      };
    }

    // 3. Ck-03: 4WVk.port_W <-> WHEX.cktk_top (WHEX::SHELL_CKTk) — Reversible!
    {
      const from = p(`4WV${k}`, 'port_W');
      const to = p('WHEX', `ckt${k}_top`);
      conns[`C${k}-03`] = {
        id: `C${k}-03`,
        circuit: ckt,
        mediumDomain: med,
        whexPortDomainId: whexDom,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [],
        pipeRadiusM: 0.034,
        colorHex: '#ef4444',
        defrostColorHex: '#38bdf8',
        animationType: 'PARTICLE_STREAM_REVERSIBLE',
        directionByMode: { HEATING: +1, DEFROST: -1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48–49 (Reversible gas line between 4WV and WHEX shell)',
        waypoints: [
          from.pos,
          [s * 1.46, 1.18, -0.26],
          to.pos
        ]
      };
    }

    // 4. Ck-04: WHEX.cktk_bot -> CV-WHEXk -> LIQ-HDR-INk.in_whex (Strictly bypasses RECk Box3!)
    {
      const from = p('WHEX', `ckt${k}_bot`);
      const cvIn = p(`CV-WHEX${k}`, 'in');
      const cvOut = p(`CV-WHEX${k}`, 'out');
      const to = p(`LIQ-HDR-IN${k}`, 'in_whex');
      conns[`C${k}-04`] = {
        id: `C${k}-04`,
        circuit: ckt,
        mediumDomain: med,
        whexPortDomainId: whexDom,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [`CV-WHEX${k}`],
        bypassesReceiver: `REC${k}`,
        pipeRadiusM: 0.020,
        colorHex: '#f59e0b',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: +1, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (Heating liquid outlet from WHEX via lower check valve bypassing receiver)',
        waypoints: [
          from.pos,
          [s * 1.22, 0.44, +0.20],
          cvIn.pos,
          cvOut.pos,
          [s * 1.18, 0.64, +0.54],
          to.pos
        ]
      };
    }

    // 5. Ck-05: LIQ-HDR-OUTk.out_exv_c -> EXV-Ck -> WHEX.cktk_dist (Separate EXV-Ck node, bypasses RECk!)
    {
      const from = p(`LIQ-HDR-OUT${k}`, 'out_exv_c');
      const exvIn = p(`EXV-C${k}`, 'in');
      const exvOut = p(`EXV-C${k}`, 'out');
      const to = p('WHEX', `ckt${k}_dist`);
      conns[`C${k}-05`] = {
        id: `C${k}-05`,
        circuit: ckt,
        mediumDomain: med,
        whexPortDomainId: whexDom,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [],
        inlineSubNodeIds: [`EXV-C${k}`],
        bypassesReceiver: `REC${k}`,
        pipeRadiusM: 0.018,
        colorHex: '#38bdf8',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: 0, DEFROST: +1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (Cooling/Defrost liquid expansion via EXV-Ck into WHEX distributor)',
        waypoints: [
          from.pos,
          [s * 0.88, 0.66, +0.44],
          exvIn.pos,
          exvOut.pos,
          [s * 0.78, 1.14, +0.16],
          to.pos
        ]
      };
    }

    // 6. Ck-06: ACOILk.bot_port -> SOL-REC-INk -> CV-REC-INk -> RECk.in_side (Side fill branch, Table 6 Normal Close)
    {
      const from = p(`ACOIL${k}`, 'bot_port');
      const solIn = p(`SOL-REC-IN${k}`, 'in');
      const solOut = p(`SOL-REC-IN${k}`, 'out');
      const cvIn = p(`CV-REC-IN${k}`, 'in');
      const cvOut = p(`CV-REC-IN${k}`, 'out');
      const to = p(`REC${k}`, 'in_side');
      conns[`C${k}-06`] = {
        id: `C${k}-06`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [`SOL-REC-IN${k}`, `CV-REC-IN${k}`],
        pipeRadiusM: 0.014,
        colorHex: '#a855f7',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: 0, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Table 6 p. 49 (Receiver fill solenoid Normal Close — closed in all 4 steady modes)',
        waypoints: [
          from.pos,
          [s * 0.85, 1.32, +0.38],
          solIn.pos,
          solOut.pos,
          cvIn.pos,
          cvOut.pos,
          to.pos
        ]
      };
    }

    // 7. Ck-07: RECk.out_bot -> SRV-RECk -> SOL-REC-OUTk -> CV-REC-OUTk -> WHEX.cktk_rec_ret
    {
      const from = p(`REC${k}`, 'out_bot');
      const srvIn = p(`SRV-REC${k}`, 'in');
      const srvOut = p(`SRV-REC${k}`, 'out');
      const solIn = p(`SOL-REC-OUT${k}`, 'in');
      const solOut = p(`SOL-REC-OUT${k}`, 'out');
      const cvIn = p(`CV-REC-OUT${k}`, 'in');
      const cvOut = p(`CV-REC-OUT${k}`, 'out');
      const to = p('WHEX', `ckt${k}_rec_ret`);
      conns[`C${k}-07`] = {
        id: `C${k}-07`,
        circuit: ckt,
        mediumDomain: med,
        whexPortDomainId: whexDom,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [`SRV-REC${k}`, `SOL-REC-OUT${k}`, `CV-REC-OUT${k}`],
        pipeRadiusM: 0.015,
        colorHex: '#a855f7',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: 0, DEFROST: +1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Table 6 p. 49 (Receiver discharge line Normal Open — open in Defrost/Cooling to WHEX bottom)',
        waypoints: [
          from.pos,
          srvIn.pos,
          srvOut.pos,
          solIn.pos,
          solOut.pos,
          cvIn.pos,
          cvOut.pos,
          to.pos
        ]
      };
    }

    // 8. Ck-07b: RECk.top_dome -> CV-REC-TOPk -> ACOILk.bot_port (Secondary purple branch, UNKNOWN_TOPOLOGY, 0 particles)
    {
      const from = p(`REC${k}`, 'top_dome');
      const cvIn = p(`CV-REC-TOP${k}`, 'in');
      const cvOut = p(`CV-REC-TOP${k}`, 'out');
      const to = p(`ACOIL${k}`, 'bot_port');
      conns[`C${k}-07b`] = {
        id: `C${k}-07b`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [`CV-REC-TOP${k}`],
        pipeRadiusM: 0.010,
        colorHex: '#64748b',
        dashedStyle: true,
        animationType: 'STATIC_GEOMETRY_NO_PARTICLES',
        directionByMode: { HEATING: 0, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'UNKNOWN_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47 secondary purple branch without confirmation in Table 6 p. 49 (UNKNOWN_TOPOLOGY — 0 particles)',
        waypoints: [
          from.pos,
          cvIn.pos,
          cvOut.pos,
          [s * 0.98, 1.32, +0.26],
          to.pos
        ]
      };
    }

    // 9. Ck-08: LIQ-HDR-INk.out_to_filt -> FILTk -> LIQ-POST-FILTk -> ECONk.main_in (UNIDIRECTIONAL!)
    {
      const from = p(`LIQ-HDR-IN${k}`, 'out_to_filt');
      const filtIn = p(`FILT${k}`, 'in');
      const filtOut = p(`FILT${k}`, 'out');
      const postIn = p(`LIQ-POST-FILT${k}`, 'in_from_filt');
      const postOut = p(`LIQ-POST-FILT${k}`, 'out_main');
      const to = p(`ECON${k}`, 'main_in');
      conns[`C${k}-08`] = {
        id: `C${k}-08`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [`FILT${k}`, `LIQ-POST-FILT${k}`],
        unidirectional: true,
        bypassesReceiver: `REC${k}`,
        pipeRadiusM: 0.020,
        colorHex: '#f59e0b',
        animationType: 'PARTICLE_STREAM_UNIDIRECTIONAL',
        directionByMode: { HEATING: +1, DEFROST: +1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (Unidirectional liquid filter-drier to economizer main inlet in both modes)',
        waypoints: [
          from.pos,
          filtIn.pos,
          filtOut.pos,
          postIn.pos,
          postOut.pos,
          to.pos
        ]
      };
    }

    // 10. Ck-09: ECONk.main_in -> ECONk.main_out -> LIQ-HDR-OUTk.in_from_econ (UNIDIRECTIONAL!)
    {
      const from = p(`ECON${k}`, 'main_in');
      const econOut = p(`ECON${k}`, 'main_out');
      const to = p(`LIQ-HDR-OUT${k}`, 'in_from_econ');
      conns[`C${k}-09`] = {
        id: `C${k}-09`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [`LIQ-HDR-OUT${k}`],
        unidirectional: true,
        bypassesReceiver: `REC${k}`,
        pipeRadiusM: 0.020,
        colorHex: '#f59e0b',
        animationType: 'PARTICLE_STREAM_UNIDIRECTIONAL',
        directionByMode: { HEATING: +1, DEFROST: +1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (Unidirectional main liquid pass through economizer to outlet header)',
        waypoints: [
          from.pos,
          econOut.pos,
          to.pos
        ]
      };
    }

    // 11. Ck-10: LIQ-POST-FILTk.out_econ_branch -> EXV-ECONk -> ECONk.aux_in (Tapped AFTER FILTk and BEFORE ECONk.main_in!)
    {
      const from = p(`LIQ-POST-FILT${k}`, 'out_econ_branch');
      const exvIn = p(`EXV-ECON${k}`, 'in');
      const exvOut = p(`EXV-ECON${k}`, 'out');
      const to = p(`ECON${k}`, 'aux_in');
      conns[`C${k}-10`] = {
        id: `C${k}-10`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [`EXV-ECON${k}`],
        tappedAfterFilterBeforeEconMain: true,
        pipeRadiusM: 0.014,
        colorHex: '#a855f7',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: +1, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47 (Economizer branch tapped after Filter-Drier and before ECON.main_in via EXV-ECON)',
        waypoints: [
          from.pos,
          exvIn.pos,
          exvOut.pos,
          [s * 0.84, 0.72, +0.62],
          to.pos
        ]
      };
    }

    // 12. Ck-11: ECONk.vap_out -> COMPk.econ_inj
    {
      const from = p(`ECON${k}`, 'vap_out');
      const to = p(`COMP${k}`, 'econ_inj');
      conns[`C${k}-11`] = {
        id: `C${k}-11`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [],
        pipeRadiusM: 0.020,
        colorHex: '#a855f7',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: +1, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (Economizer intermediate vapor injection to screw compressor)',
        waypoints: [
          from.pos,
          [s * 0.84, 1.04, +0.72],
          [s * 1.85, 1.04, +0.72],
          to.pos
        ]
      };
    }

    // 13. Ck-12: LIQ-HDR-OUTk.out_exv_h -> EXV-Hk -> ACOILk.bot_port
    {
      const from = p(`LIQ-HDR-OUT${k}`, 'out_exv_h');
      const exvIn = p(`EXV-H${k}`, 'in');
      const exvOut = p(`EXV-H${k}`, 'out');
      const to = p(`ACOIL${k}`, 'bot_port');
      conns[`C${k}-12`] = {
        id: `C${k}-12`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [],
        inlineSubNodeIds: [`EXV-H${k}`],
        pipeRadiusM: 0.018,
        colorHex: '#38bdf8',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: +1, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (Heating expansion line via EXV-Hk to Air Coil bottom distributor)',
        waypoints: [
          from.pos,
          [s * 1.12, 0.82, +0.48],
          exvIn.pos,
          exvOut.pos,
          to.pos
        ]
      };
    }

    // 14. Ck-13: ACOILk.bot_port -> CV-ACOILk -> LIQ-HDR-INk.in_acoil
    {
      const from = p(`ACOIL${k}`, 'bot_port');
      const cvIn = p(`CV-ACOIL${k}`, 'in');
      const cvOut = p(`CV-ACOIL${k}`, 'out');
      const to = p(`LIQ-HDR-IN${k}`, 'in_acoil');
      conns[`C${k}-13`] = {
        id: `C${k}-13`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [`CV-ACOIL${k}`],
        pipeRadiusM: 0.018,
        colorHex: '#f59e0b',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: 0, DEFROST: +1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (Defrost liquid outlet from Air Coil via upper check valve CV-ACOIL to filter inlet)',
        waypoints: [
          from.pos,
          [s * 1.24, 1.28, +0.50],
          cvIn.pos,
          cvOut.pos,
          to.pos
        ]
      };
    }

    // 15. Ck-14: ACOILk.top_port <-> 4WVk.port_A — Reversible!
    {
      const from = p(`ACOIL${k}`, 'top_port');
      const to = p(`4WV${k}`, 'port_A');
      conns[`C${k}-14`] = {
        id: `C${k}-14`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [],
        pipeRadiusM: 0.034,
        colorHex: '#38bdf8',
        defrostColorHex: '#ef4444',
        animationType: 'PARTICLE_STREAM_REVERSIBLE',
        directionByMode: { HEATING: +1, DEFROST: -1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48–49 (Reversible gas line between Air Coil top header and 4WV port A)',
        waypoints: [
          from.pos,
          [s * 1.54, 1.70, -0.08],
          to.pos
        ]
      };
    }

    // 16. Ck-15: 4WVk.port_S -> COMPk.suction_in (UNIDIRECTIONAL suction!)
    {
      const from = p(`4WV${k}`, 'port_S');
      const to = p(`COMP${k}`, 'suction_in');
      conns[`C${k}-15`] = {
        id: `C${k}-15`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [],
        unidirectional: true,
        pipeRadiusM: 0.038,
        colorHex: '#38bdf8',
        animationType: 'PARTICLE_STREAM_UNIDIRECTIONAL',
        directionByMode: { HEATING: +1, DEFROST: +1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (Common compressor suction line from 4WV port S)',
        waypoints: [
          from.pos,
          [s * 1.59, 1.02, +0.26],
          [s * 1.59, 0.84, +0.46],
          to.pos
        ]
      };
    }

    // 17. Ck-16: OSk.oil_sump -> OCk.oil -> VLV-OIL-SHUTk -> OF-INTk -> CV-OILk -> COMPk.oil_in (OEM p. 49 S2P-06!)
    {
      const from = p(`OS${k}`, 'oil_sump');
      const ocIn = p(`OC${k}`, 'oil_in');
      const ocOut = p(`OC${k}`, 'oil_out');
      const shutIn = p(`VLV-OIL-SHUT${k}`, 'in');
      const shutOut = p(`VLV-OIL-SHUT${k}`, 'out');
      const filtIn = p(`OF-INT${k}`, 'in');
      const filtOut = p(`OF-INT${k}`, 'out');
      const cvIn = p(`CV-OIL${k}`, 'in');
      const cvOut = p(`CV-OIL${k}`, 'out');
      const to = p(`COMP${k}`, 'oil_in');
      conns[`C${k}-16`] = {
        id: `C${k}-16`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [`OC${k}`, `VLV-OIL-SHUT${k}`, `OF-INT${k}`, `CV-OIL${k}`],
        orderedOilSequence: [`OS${k}`, `OC${k}`, `VLV-OIL-SHUT${k}`, `OF-INT${k}`, `CV-OIL${k}`, `COMP${k}`],
        pipeRadiusM: 0.012,
        colorHex: '#d97706',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: +1, DEFROST: +1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'OEM Manual Sec. 7.1 Oil Management p. 49 ("oil cooler, shutoff valve, internal filter, and oil supply check valve")',
        waypoints: [
          from.pos,
          ocIn.pos,
          ocOut.pos,
          shutIn.pos,
          shutOut.pos,
          filtIn.pos,
          filtOut.pos,
          cvIn.pos,
          cvOut.pos,
          to.pos
        ]
      };
    }

    // 18. Ck-17: LIQ-HDR-OUTk.out_txv_oil -> TXV-OILk -> OCk.ref -> COMPk.suction_in
    {
      const from = p(`LIQ-HDR-OUT${k}`, 'out_txv_oil');
      const txvIn = p(`TXV-OIL${k}`, 'in');
      const txvOut = p(`TXV-OIL${k}`, 'out');
      const ocRefIn = p(`OC${k}`, 'ref_in');
      const ocRefOut = p(`OC${k}`, 'ref_out');
      const to = p(`COMP${k}`, 'suction_in');
      conns[`C${k}-17`] = {
        id: `C${k}-17`,
        circuit: ckt,
        mediumDomain: med,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [`TXV-OIL${k}`, `OC${k}`],
        pipeRadiusM: 0.011,
        colorHex: '#38bdf8',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: +1, DEFROST: +1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 48 (Refrigerant branch through TXV-OIL and Oil Cooler to suction)',
        waypoints: [
          from.pos,
          [s * 1.52, 0.46, +0.44],
          txvIn.pos,
          txvOut.pos,
          ocRefIn.pos,
          ocRefOut.pos,
          [s * 1.80, 0.72, +0.38],
          to.pos
        ]
      };
    }

    // 19. Ck-18: WHEX.cktk_oil_drain -> SOL-OILk -> COMPk.oil_ret_in
    {
      const from = p('WHEX', `ckt${k}_oil_drain`);
      const solIn = p(`SOL-OIL${k}`, 'in');
      const solOut = p(`SOL-OIL${k}`, 'out');
      const to = p(`COMP${k}`, 'oil_ret_in');
      conns[`C${k}-18`] = {
        id: `C${k}-18`,
        circuit: ckt,
        mediumDomain: med,
        whexPortDomainId: whexDom,
        fromEndpoint: from,
        toEndpoint: to,
        inlineAuxIds: [`SOL-OIL${k}`],
        pipeRadiusM: 0.011,
        colorHex: '#d97706',
        animationType: 'PARTICLE_STREAM',
        directionByMode: { HEATING: 0, DEFROST: +1, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
        provenance: 'CONFIRMED_OEM_TOPOLOGY',
        sourceRef: 'Figure 19 p. 47, Sec. 7.1 p. 49 (Oil return from WHEX via solenoid valve open in Defrost/Cooling)',
        waypoints: [
          from.pos,
          solIn.pos,
          solOut.pos,
          to.pos
        ]
      };
    }
  }

  // 39. W-01: HP01_WATER_IN -> WHEX.tube_in (WHEX::WATER_TUBES, DN150)
  {
    const from = resolveHP01PortDescriptor('HP01_WATER_IN', 'flange_dn150_in');
    const to = resolveHP01PortDescriptor('WHEX', 'tube_in');
    conns['W-01'] = {
      id: 'W-01',
      circuit: 'WATER',
      mediumDomain: 'PRIMARY_WATER',
      whexPortDomainId: 'WHEX::WATER_TUBES',
      fromEndpoint: from,
      toEndpoint: to,
      inlineAuxIds: [],
      pipeRadiusM: 0.076,
      colorHex: '#0ea5e9',
      animationType: 'PARTICLE_STREAM',
      directionByMode: { HEATING: +1, DEFROST: +1, STOPPED: +1, UNKNOWN_OR_MISSING: 0 },
      provenance: 'CONFIRMED_BY_DOC',
      sourceRef: 'Table 2 p. 16, Sec. 5.5 p. 29 (DN150 / 6" primary water inlet to WHEX waterbox)',
      waypoints: [
        from.pos,
        [-2.52, 0.86, -0.58],
        to.pos
      ]
    };
  }

  // 40. W-02: WHEX.tube_in -> WHEX.tube_out (Internal copper tube bundle inside WHEX::WATER_TUBES)
  {
    const from = resolveHP01PortDescriptor('WHEX', 'tube_in');
    const to = resolveHP01PortDescriptor('WHEX', 'tube_out');
    conns['W-02'] = {
      id: 'W-02',
      circuit: 'WATER',
      mediumDomain: 'PRIMARY_WATER',
      whexPortDomainId: 'WHEX::WATER_TUBES',
      fromEndpoint: from,
      toEndpoint: to,
      inlineAuxIds: [],
      pipeRadiusM: 0.048,
      colorHex: '#14b8a6',
      animationType: 'PARTICLE_STREAM',
      directionByMode: { HEATING: +1, DEFROST: +1, STOPPED: +1, UNKNOWN_OR_MISSING: 0 },
      provenance: 'CONFIRMED_BY_DOC',
      sourceRef: 'Sec. 5.5 p. 29, Fig. 19 p. 47 (Primary water flow inside WHEX copper tube bundle, isolated from shell R513A)',
      waypoints: [
        from.pos,
        [-0.85, 0.90, -0.38],
        [+0.85, 0.94, -0.38],
        to.pos
      ]
    };
  }

  // 41. W-03: WHEX.tube_out -> FS-HP01 -> HP01_WATER_OUT (DN150 outlet pipe with 60 mm paddle flow switch)
  {
    const from = resolveHP01PortDescriptor('WHEX', 'tube_out');
    const fsIn = resolveHP01PortDescriptor('FS-HP01', 'in');
    const fsOut = resolveHP01PortDescriptor('FS-HP01', 'out');
    const to = resolveHP01PortDescriptor('HP01_WATER_OUT', 'flange_dn150_out');
    conns['W-03'] = {
      id: 'W-03',
      circuit: 'WATER',
      mediumDomain: 'PRIMARY_WATER',
      whexPortDomainId: 'WHEX::WATER_TUBES',
      fromEndpoint: from,
      toEndpoint: to,
      inlineAuxIds: [],
      inlineSubNodeIds: ['FS-HP01'],
      pipeRadiusM: 0.076,
      colorHex: '#f97316',
      animationType: 'PARTICLE_STREAM',
      directionByMode: { HEATING: +1, DEFROST: +1, STOPPED: +1, UNKNOWN_OR_MISSING: 0 },
      provenance: 'CONFIRMED_BY_DOC',
      sourceRef: 'Table 2 p. 16, Sec. 5.5 p. 29, Sec. 5.6 p. 31–32 (DN150 water outlet with FS-HP01 60 mm paddle)',
      waypoints: [
        from.pos,
        fsIn.pos,
        fsOut.pos,
        to.pos
      ]
    };
  }

  // 42. W-04: DRAIN-SYS.acoil1_pan_out -> DRAIN-SYS.drain_manifold_out (with branches from acoil2_pan_out and WHEX.waterbox_drain)
  {
    const from = resolveHP01PortDescriptor('DRAIN-SYS', 'acoil1_pan_out');
    const pan2 = resolveHP01PortDescriptor('DRAIN-SYS', 'acoil2_pan_out');
    const wbDrain = resolveHP01PortDescriptor('WHEX', 'waterbox_drain');
    const to = resolveHP01PortDescriptor('DRAIN-SYS', 'drain_manifold_out');
    conns['W-04'] = {
      id: 'W-04',
      circuit: 'DRAIN',
      mediumDomain: 'DRAIN_WATER',
      whexPortDomainId: 'WHEX::DRAIN_BOX',
      fromEndpoint: from,
      toEndpoint: to,
      secondaryPorts: [pan2, wbDrain],
      inlineAuxIds: [],
      pipeRadiusM: 0.024,
      colorHex: '#64748b',
      animationType: 'STATIC_GEOMETRY_NO_PARTICLES',
      directionByMode: { HEATING: 0, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
      provenance: 'CONFIRMED_BY_DOC',
      sourceRef: 'Sec. 5.5 p. 29, Sec. 5.7 p. 32, Sec. 9.2 p. 74 (Condensate & waterbox drain header DN50; flow rate MISSING_DATA — 0 particles)',
      waypoints: [
        from.pos,
        [+1.55, 0.34, -0.76],
        [-1.75, 0.32, -0.76],
        [-2.18, 0.30, -0.76],
        to.pos
      ],
      branchSegments: [
        [pan2.pos, [-1.75, 0.32, -0.76]],
        [wbDrain.pos, [-2.18, 0.30, -0.76]]
      ]
    };
  }

  // 43 & 44: A-01 / A-02 (Outdoor air stream through ACOIL1/2 and FAN-GRP1/2)
  for (const k of [1, 2]) {
    const ckt = `CKT${k}`;
    const from = resolveHP01PortDescriptor(`ACOIL${k}`, 'air_in_face');
    const mid = resolveHP01PortDescriptor(`ACOIL${k}`, 'air_out_top');
    const to = resolveHP01PortDescriptor(`FAN-GRP${k}`, 'air_out_top');
    conns[`A-0${k}`] = {
      id: `A-0${k}`,
      circuit: ckt,
      mediumDomain: `AIR_${ckt}`,
      fromEndpoint: from,
      toEndpoint: to,
      inlineAuxIds: [],
      pipeRadiusM: 0.022,
      colorHex: '#2dd4bf',
      animationType: 'PARTICLE_STREAM',
      directionByMode: { HEATING: +1, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
      provenance: 'CONFIRMED_BY_DOC',
      sourceRef: 'Fig. 3-2 p. 19–20, Sec. 6.3 p. 39, Sec. 7.1 p. 49 (Outdoor air intake through V-coils and vertical discharge via 6 EC fans; 0% in Defrost)',
      waypoints: [
        from.pos,
        mid.pos,
        to.pos
      ]
    };
  }

  // 45. E-01: CTRL-SYMBIO.main_400v_in -> FAN-GRP2.elec_in (400VAC 3Ph main power tray feeding VFDs, COMP1/2, FAN-GRP1/2)
  {
    const from = resolveHP01PortDescriptor('CTRL-SYMBIO', 'main_400v_in');
    const fan1Elec = resolveHP01PortDescriptor('FAN-GRP1', 'elec_in');
    const to = resolveHP01PortDescriptor('FAN-GRP2', 'elec_in');
    conns['E-01'] = {
      id: 'E-01',
      circuit: 'ELEC',
      mediumDomain: 'ELEC_400V',
      fromEndpoint: from,
      toEndpoint: to,
      secondaryPorts: [fan1Elec],
      inlineAuxIds: [],
      pipeRadiusM: 0.018,
      colorHex: '#eab308',
      animationType: 'STATIC_GEOMETRY_NO_PARTICLES',
      directionByMode: { HEATING: 0, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
      provenance: 'CONFIRMED_BY_DOC',
      sourceRef: 'Sec. 6.1–6.3 p. 36–41 (400VAC 3Ph 50Hz main power distribution via 1Q1 and 2×CA300-4T132 VFDs, MCA=398 A)',
      waypoints: [
        from.pos,
        [+2.65, 2.26, -0.88],
        to.pos
      ]
    };
  }

  // 46. E-02: CTRL-SYMBIO.ext_230v_out -> WHEX.freeze_heater_term (External 230VAC 16A freeze protection heater cable)
  {
    const from = resolveHP01PortDescriptor('CTRL-SYMBIO', 'ext_230v_out');
    const to = resolveHP01PortDescriptor('WHEX', 'freeze_heater_term');
    conns['E-02'] = {
      id: 'E-02',
      circuit: 'ELEC',
      mediumDomain: 'ELEC_230V',
      whexPortDomainId: 'WHEX::HEATER_TERM',
      fromEndpoint: from,
      toEndpoint: to,
      inlineAuxIds: [],
      pipeRadiusM: 0.012,
      colorHex: '#f97316',
      animationType: 'STATIC_GEOMETRY_NO_PARTICLES',
      directionByMode: { HEATING: 0, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
      provenance: 'CONFIRMED_BY_DOC',
      sourceRef: 'Sec. 5.7 p. 32, Sec. 6.4 p. 40 (External 230VAC 16A waterbox freeze protection heater < 2.8°C; actual work status MISSING_DATA — 0 particles)',
      waypoints: [
        from.pos,
        [+2.65, 0.66, -0.64],
        to.pos
      ]
    };
  }

  // 47. E-03: CTRL-SYMBIO.pump_fs_interlock_port -> FS-HP01.signal_interlock (Flow switch & pump contactor interlock circuit)
  {
    const from = resolveHP01PortDescriptor('CTRL-SYMBIO', 'pump_fs_interlock_port');
    const to = resolveHP01PortDescriptor('FS-HP01', 'signal_interlock');
    conns['E-03'] = {
      id: 'E-03',
      circuit: 'ELEC',
      mediumDomain: 'CONTROL_24V_230V',
      fromEndpoint: from,
      toEndpoint: to,
      inlineAuxIds: [],
      pipeRadiusM: 0.010,
      colorHex: '#38bdf8',
      animationType: 'STATIC_GEOMETRY_NO_PARTICLES',
      directionByMode: { HEATING: 0, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
      provenance: 'CONFIRMED_BY_DOC',
      sourceRef: 'Sec. 5.6 p. 31–32, Sec. 6.5 p. 41 (FS-HP01 flow switch interlock & pump contactors 1K27/1K28)',
      waypoints: [
        from.pos,
        [+2.82, 1.16, -0.58],
        to.pos
      ]
    };
  }

  // 48. E-04: CTRL-SYMBIO.bacnet_bms_port -> EXTERNAL_BMS_GW.bacnet_trunk_out (BACnet MS/TP & IP / TD7 interface)
  {
    const from = resolveHP01PortDescriptor('CTRL-SYMBIO', 'bacnet_bms_port');
    const to = resolveHP01PortDescriptor('EXTERNAL_BMS_GW', 'bacnet_trunk_out');
    conns['E-04'] = {
      id: 'E-04',
      circuit: 'ELEC',
      mediumDomain: 'CONTROL_BMS',
      fromEndpoint: from,
      toEndpoint: to,
      inlineAuxIds: [],
      pipeRadiusM: 0.010,
      colorHex: '#a855f7',
      animationType: 'STATIC_GEOMETRY_NO_PARTICLES',
      directionByMode: { HEATING: 0, DEFROST: 0, STOPPED: 0, UNKNOWN_OR_MISSING: 0 },
      provenance: 'CONFIRMED_BY_DOC',
      sourceRef: 'Sec. 6.8 p. 45–46 (Symbio 800 BACnet MS/TP & IP communication trunk and Tracer TD7 display)',
      waypoints: [
        from.pos,
        to.pos
      ]
    };
  }

  return Object.freeze(conns);
}

export const HP01_INTERNAL_CONNECTIONS = buildInternalConnectionsCatalog();

/**
 * Node-to-pipe highlight lookup derived directly from HP01_SUBNODES
 */
export const HP01_NODE_PIPES = Object.freeze(
  Object.fromEntries(
    Object.values(HP01_SUBNODES).map((node) => [node.id, Object.freeze([...node.highlightConnections])])
  )
);

/**
 * Camera presets for standalone and integrated 3D cutaway viewing
 */
export const HP01_CAMERA_PRESETS = Object.freeze({
  OVERALL_FRONT_ISO: Object.freeze({
    id: 'OVERALL_FRONT_ISO',
    labelHe: '1. מבט איזומטרי כללי (חזית שירות +Z)',
    position: Object.freeze([0.2, 3.35, 6.95]),
    target: Object.freeze([0.0, 1.18, 0.0]),
    localInspectionTarget: null
  }),
  INTERNAL_CUTAWAY_WIDE: Object.freeze({
    id: 'INTERNAL_CUTAWAY_WIDE',
    labelHe: '2. חתך פנימי מלא (2 מעגלים + WHEX)',
    position: Object.freeze([0.0, 2.35, 5.45]),
    target: Object.freeze([0.0, 1.05, 0.0]),
    localInspectionTarget: null
  }),
  COMP1_AND_OIL_DETAIL: Object.freeze({
    id: 'COMP1_AND_OIL_DETAIL',
    labelHe: '3. תקריב מדחס בורג 1 — מבט צד (2 רוטורים + סטטור + מסנן שמן)',
    position: Object.freeze([1.93, 0.70, 1.58]),
    target: Object.freeze([1.95, 0.61, 0.58]),
    localInspectionTarget: 'COMP1'
  }),
  COMP1_AXIAL_END_DETAIL: Object.freeze({
    id: 'COMP1_AXIAL_END_DETAIL',
    labelHe: '4. תקריב מדחס בורג 1 — מבט צירי/קצה (פרופיל בורגי משולב)',
    position: Object.freeze([2.48, 0.68, 1.24]),
    target: Object.freeze([2.02, 0.61, 0.60]),
    localInspectionTarget: 'COMP1'
  }),
  COMP2_AND_OIL_DETAIL: Object.freeze({
    id: 'COMP2_AND_OIL_DETAIL',
    labelHe: '5. תקריב מדחס בורג 2 — מבט צד (2 רוטורים + סטטור + מסנן שמן)',
    position: Object.freeze([-1.93, 0.70, 1.58]),
    target: Object.freeze([-1.95, 0.61, 0.58]),
    localInspectionTarget: 'COMP2'
  }),
  COMP2_AXIAL_END_DETAIL: Object.freeze({
    id: 'COMP2_AXIAL_END_DETAIL',
    labelHe: '6. תקריב מדחס בורג 2 — מבט צירי/קצה (פרופיל בורגי משולב)',
    position: Object.freeze([-2.48, 0.68, 1.24]),
    target: Object.freeze([-2.02, 0.61, 0.60]),
    localInspectionTarget: 'COMP2'
  }),
  WHEX_AND_DOMAINS_DETAIL: Object.freeze({
    id: 'WHEX_AND_DOMAINS_DETAIL',
    labelHe: '7. תקריב מחליף חום מים-קרר (5 דומיינים מבודדים)',
    position: Object.freeze([0.05, 1.38, 2.25]),
    target: Object.freeze([-0.05, 0.82, -0.32]),
    localInspectionTarget: null
  }),
  ECON_AND_RECEIVER_BRIDGE: Object.freeze({
    id: 'ECON_AND_RECEIVER_BRIDGE',
    labelHe: '8. גשר נוזל חד-כיווני, אקונומייזר ורסיבר צדדי (CKT1)',
    position: Object.freeze([0.92, 1.18, 2.15]),
    target: Object.freeze([0.82, 0.72, 0.36]),
    localInspectionTarget: null
  }),
  SUPPORTS_AND_ISOLATORS: Object.freeze({
    id: 'SUPPORTS_AND_ISOLATORS',
    labelHe: '9. שלדת בסיס, 8 מבודדים (W1..W8) ופתחי שירות',
    position: Object.freeze([-3.95, 1.55, 5.10]),
    target: Object.freeze([-0.20, 0.55, -0.10]),
    localInspectionTarget: null
  })
});

/**
 * Dynamically computes counts and structural summary directly from the catalog objects (Requirement 1)
 */
export function computeHP01CatalogSummary() {
  const subNodeIds = Object.keys(HP01_SUBNODES);
  const auxValveIds = Object.keys(HP01_AUX_VALVES);
  const connectionIds = Object.keys(HP01_INTERNAL_CONNECTIONS);
  const whexDomainIds = Object.keys(HP01_WHEX_PORT_DOMAINS);

  const auxCategories = new Set(Object.values(HP01_AUX_VALVES).map((a) => a.categoryKey));
  const ckt1Conns = connectionIds.filter((id) => HP01_INTERNAL_CONNECTIONS[id].mediumDomain === 'REFRIGERANT_CKT1');
  const ckt2Conns = connectionIds.filter((id) => HP01_INTERNAL_CONNECTIONS[id].mediumDomain === 'REFRIGERANT_CKT2');
  const waterConns = connectionIds.filter((id) => ['WATER', 'DRAIN'].includes(HP01_INTERNAL_CONNECTIONS[id].circuit));
  const airConns = connectionIds.filter((id) => HP01_INTERNAL_CONNECTIONS[id].mediumDomain.startsWith('AIR_'));
  const elecConns = connectionIds.filter((id) => HP01_INTERNAL_CONNECTIONS[id].circuit === 'ELEC');
  const staticNoParticlesConns = connectionIds.filter(
    (id) => HP01_INTERNAL_CONNECTIONS[id].animationType === 'STATIC_GEOMETRY_NO_PARTICLES'
  );

  return Object.freeze({
    subNodeCount: subNodeIds.length,
    auxValveCount: auxValveIds.length,
    auxCategoryCount: auxCategories.size,
    connectionCount: connectionIds.length,
    whexPortDomainCount: whexDomainIds.length,
    breakdown: Object.freeze({
      ckt1RefrigerantAndOil: ckt1Conns.length,
      ckt2RefrigerantAndOil: ckt2Conns.length,
      waterAndDrain: waterConns.length,
      airStreams: airConns.length,
      electricalAndControl: elecConns.length,
      staticGeometryNoParticles: staticNoParticlesConns.length
    }),
    isolatorCount: HP01_GEOMETRY_CONSTANTS.isolatorStations.length,
    riggingLugCount: HP01_GEOMETRY_CONSTANTS.riggingLugs.length,
    refrigerantCharge: HP01_GEOMETRY_CONSTANTS.massesKg.refrigerantChargeBreakdown
  });
}
