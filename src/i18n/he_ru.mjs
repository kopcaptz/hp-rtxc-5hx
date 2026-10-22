/**
 * STAGE 6: I18N & TERMINOLOGY MODULE (Hebrew RTL UI + Russian Engineering Explanations)
 * Separated translation dictionary per Section 13.
 */

export const UI_TEXT_HE = {
  topBanner: 'סימולציה הנדסית — ללא חיבור למתקן אמיתי',
  appTitle: 'מערכת חימום מים תעשייתית Trane RTXC 180 XE-HSE — 5 מודולי מחליפי חום',
  appSubtitle: 'מודל חישובי הידראולי-תרמי משולב | בקרת Symbio 800 + אוטומציה חיצונית CP01',

  views: {
    rooftop3d: 'מבט גג תלת-ממדי (3D)',
    cutaway3d: 'רכיב מוגדל / חתך (3D)',
    pidMnemonic: 'סכמת P&ID חיה לטכנאי'
  },

  controls: {
    play: 'הפעל',
    pause: 'השהה',
    step: 'צעד בודד (1s)',
    reset: 'איפוס תרחיש',
    speed: 'מהירות זמן',
    showConnections: 'הצג חיבורים',
    datasetMode: 'מצב נתונים',
    demoMode: 'דוגמה להדגמה (DEMO)',
    siteMode: 'נתוני אתר (SITE — חסרים נחסמים)',
    scenarioSelect: 'תרחיש בדיקה / תקלה',
    ambientTemp: 'טמפ׳ חוץ',
    strict21C: 'מגבלת עמוד 48 מחמירה (21°C)',
    exportJson: 'ייצוא JSON',
    importJson: 'ייבוא JSON',
    graphsModal: 'גרפים ואנרגיה',
    waterChemModal: 'כימיית מים והזנה',
    serviceModal: 'מידע שירות, מקורות ובדיקות (22/22)'
  },

  glanceBar: {
    heatingActive: 'חימום פעיל',
    flowConfirmed: 'ספיקה מאושרת (FS-HP01)',
    activePumps: 'משאבות עובדות',
    standbyReady: 'גיבוי זמין (1+1)',
    sysPressure: 'לחץ מערכת / מרווח מותר',
    activeAlarms: 'התראות פעילות',
    copUnit: 'COP יחידה / מתקן',
    startupStage: 'שלב הפעלה Symbio 800'
  },

  statuses: {
    yes: 'כן — פעיל',
    no: 'לא — מופסק',
    blocked: 'חסום (מחוץ למפה / הגנה)',
    defrost: 'הפשקה (היפוך מחזור)',
    missing_data: 'אין נתונים (נדרש אימות אתר)',
    ok: 'תקין',
    warning: 'אזהרה',
    alarm: 'תקלה / התראה',
    unknown: 'לא ידוע (אובדן חיישן)'
  },

  provenance: {
    confirmed_by_doc: 'מאושר בתיעוד יצרן (Trane PDF)',
    from_site: 'נתון מהאתר (טרם אומת בדרכון)',
    assumed_for_demo: 'הנחה להדגמה הנדסית בלבד',
    requires_clarification: 'דורש הבהרה מול Trane / מהנדס האתר'
  },

  inspector: {
    title: 'כרטיס רכיב נבחר',
    purpose: 'ייעוד הנדסי',
    portsAndConnections: 'כניסות, יציאות וחיבורים',
    liveValues: 'ערכים נוכחיים בזמן אמת',
    commandVsResponse: 'פקודת בקרה מול תגובה בפועל',
    protections: 'הגנות משויכות',
    sourceAndProvenance: 'מקור נתונים וסטטוס תוקף',
    missingDataImpact: 'חישובים תלויים / נתונים חסרים',
    viewInCutaway: 'פתח בחתך תלת-ממדי מוגדל',
    isolateBranch: 'בודד / פתח שלוחה',
    tripPump: 'דמה תקלת משאבה',
    maintPump: 'הוצא משאבת גיבוי לתחזוקה'
  },

  legend: {
    airStream: 'זרימת אוויר (סלילי אידוי + 12 מאווררי EC)',
    refrigerantStream: 'קרר R513A (2 מעגלים + אקונומייזר)',
    waterCold: 'מים קרירים (<35°C)',
    waterWarm: 'מים חמים (35–48°C)',
    waterHot: 'מים חמים מאוד (>48°C)',
    calmNormal: 'מצב תקין (צבע רגוע)',
    deviationWarn: 'חריגה / אזהרה',
    deviationAlarm: 'תקלה / חסימת הגנה'
  },

  consumersTable: {
    header: 'חמישה צרכנים משניים עצמאיים (מים במעיל — לא שוקולד ישיר)',
    consumer: 'צרכן',
    chocTemp: 'טמפ׳ שוקולד תהליכית',
    secSupply: 'הזנה משנית (למעיל)',
    secReturn: 'חזרה משנית',
    priFlow: 'ספיקה ראשית',
    secFlow: 'ספיקה משנית',
    dutyKw: 'הספק תרמי',
    valvePos: 'שסתום CV (פקודה/פועל)',
    jacketPressure: 'לחץ במעיל הצרכן (z_i)',
    pumpStatus: 'משאבות משניות (A/B)'
  }
};

export const PUMP_STATE_LABELS_HE = {
  running: 'עובדת (Running)',
  standby_ready: 'מוכנה בגיבוי (Standby)',
  fault: 'תקולה (Fault)',
  manual: 'מצב ידני (Manual)',
  maintenance_isolated: 'בודדה לתחזוקה (Maint)',
  unknown: 'מצב לא ידוע (Unknown)',
  stopped: 'מופסקת (Stopped)'
};

export const STARTUP_STAGE_LABELS_HE = {
  OFF: '0. מופסק (OFF)',
  STEP_1_SENSOR_CHECK: '1. בדיקת תקינות חיישנים',
  STEP_2_EQUIPMENT_READY: '2. בדיקת מוכנות ציוד וחימום שמן (≥12h)',
  STEP_3_PRESSURE_PATH_CHECK: '3. בדיקת לחץ ומסלולי זרימה',
  STEP_4_START_PUMPS: '4. הפעלת משאבות נדרשות',
  STEP_5_CONFIRM_FLOW: '5. המתנה לאישור ספיקה (FS-HP01 6s)',
  STEP_6_ENABLE_HP: '6. מתן הרשאה ליחידת RTXC',
  STEP_7_CONFIRM_COMPRESSOR: '7. אישור עבודת מדחסים בפועל',
  STEP_8_RAMP_LOAD: '8. עלייה הדרגתית לעומס (Ramp/Running)',
  SHUTDOWN_UNLOAD_WAIT: 'פריקת מדחסים לפני עצירת משאבה (20s)',
  FAULT_LOCKOUT: 'נעילת הגנה (Fault Lockout)'
};

/**
 * STAGE 2 FOUNDATION (PKG-S2-A): HP01 Cutaway Hebrew Dictionary (RTL)
 * Additive dictionary for HP01 3D cutaway metadata and read-only simulation adapter.
 */
export const HP01_CUTAWAY_TEXT_HE = {
  modeBanners: {
    HEATING: 'מצב חימום פעיל (2 מעגלים במקביל)',
    DEFROST: 'מצב הפשרה — נתוני מחזור הקרר בהפשרה אינם תקפים — נדרשת בדיקת מודל',
    STOPPED: 'מצב עצירה / המתנה (מדחסים מופסקים)',
    SITE_MISSING: 'נתוני אתר חסרים (SITE) — חישוב והנפשה חסומים עד להשלמת קלט',
    UNKNOWN_OR_MISSING: 'מצב לא ידוע / נתונים חסרים או סותרים — הנפשה מושבתת'
  },

  refCycleInvalidReasons: {
    DEFROST: '— (נתוני מחזור הקרר בהפשרה אינם תקפים — נדרשת בדיקת מודל)',
    HEATING: '— (נתוני מחזור הקרר בחימום אינם תקפים פיזיקלית — נדרשת בדיקת מודל)',
    STOPPED: '— (מדחס מושבת — אין מחזור דחיסה פעיל)',
    SITE_MISSING: '— (נתוני אתר חסרים — חישוב חסום)',
    UNKNOWN_OR_MISSING: '— (אין נתון / מצב מערכת לא ידוע)'
  },

  defrostQualitativeRouteNoteHe:
    'חיצי הזרימה בהפשרה מציגים כיוון איכותי בלבד לפי תיעוד היצרן (איור 19 וטבלה 6)',

  waterLoopSubStates: {
    WATER_CIRCULATING: 'סחרור מים פעיל בצינורות מחליף החום (WHEX)',
    WATER_NO_FLOW: 'ללא זרימת מים בצינורות WHEX',
    WATER_FLOW_UNKNOWN: 'זרימת מים לא ידועה — MISSING_DATA'
  },

  stoppedWithWaterCirculationBadgeHe: 'מדחס מושבת, סחרור מים נמשך',
  defrostExternalWaterBalanceBadgeHe: 'מודל מאזן מים חיצוני מקורב',
  visualFlowCutoffNoteHe:
    'סף תצוגה גרפי להנפשת חלקיקים בלבד (0.1 L/s) — אינו סף הגנה של היצרן (15.3 L/s, השהיה 6s)',

  flowSwitchMessages: {
    closedVerified: 'סגור — זרימה מאומתת במפסק FS-HP01 (סף הגנה יצרן: 15.3 L/s, השהיה 6s)',
    closedBelowThreshold: 'סגור (מפסק FS-HP01 סגור כעת; ספיקה מדודה מתחת ל-15.3 L/s)',
    closedUnknownFlow: 'סגור (מפסק FS-HP01 סגור; ספיקה מדודה לא ידועה)',
    openForcedAtNormalFlow:
      'פתוח — חסימת מפסק זרימה פעילה למרות ספיקה מדודה ≥ 15.3 L/s (כפיית תקלה / מגע פתוח; אינו מוכיח ספיקה נמוכה)',
    openLowFlow: 'פתוח — חסימת זרימת מים במפסק FS-HP01 (ספיקה מדודה < 15.3 L/s, השהיית 6s, עמ׳ 31–32)',
    openUnknownFlow: 'פתוח — חסימת מפסק זרימה FS-HP01 (ספיקת מים לא ידועה)',
    unknownState: '— (מצב מפסק זרימה לא ידוע — MISSING_DATA)'
  },

  missingFallbacks: {
    generic: '— (אין נתון / לא ידוע)',
    setpoint: '— (אין נתון פקודת בקרה)',
    waterFlow: '— (ספיקת מים לא ידועה — MISSING_DATA)',
    inletPressure: '— (אין נתון לחץ כניסה)',
    outletPressure: '— (אין נתון לחץ יציאה)',
    deltaPressure: '— (אין נתון מפל לחץ)',
    waterPower: '— (אין נתון הספק מים)',
    airPower: '— (אין נתון הספק אוויר)',
    elecPower: '— (אין נתון הספק חשמלי)',
    copDefrost: '— (לא מוגדר בהפשרה, Q_water < 0)',
    copStopped: '— (לא זמין בעצירה, Q_water = 0)'
  },

  telemetryNotes: {
    compAggregateNote: 'סה״כ 2 מדחסים יחד (COMP1+COMP2) — אין מדידה נפרדת במודל',
    compIndividualMissing:
      '— (אין נתון נפרד במודל — שני המדחסים פועלים במקביל בשני מעגלים עצמאיים, לא עבודה/גיבוי)',
    fanAggregateNote: 'סה״כ 12 מאווררי EC יחד',
    fanIndividualRpmMissing: '— (אין נתון סל״ד נפרד במודל)',
    valveDocStateBadge: 'מצב תפעולי לפי תיעוד היצרן (ללא טלמטריה/משוב שסתום במודל)',
    valveUnknownBySystemMode: '— (מצב שסתום לא ידוע עקב מצב מערכת לא ידוע)',
    exvOpeningMissing: '— (אין נתון משוב פתיחה במודל)',
    heater230vActualMissing: 'מצב עבודה בפועל: — (אין נתון במודל — אינו מנוטר ע״י Symbio 800, עמ׳ 32, 40)',
    unknownTopologyBranchNote: 'UNKNOWN_TOPOLOGY — ענף משני באיור 19 ללא אישור בטבלה 6 (נדרשת הבהרת יצרן Trane)',
    assumedGeometryBadge: 'גאומטריה עקרונית להדגמה (ASSUMED_FOR_DEMO — אינה שרטוט ייצור CAD)',
    localInspectionModeBannerHe:
      'מצב בדיקה מקומי פעיל: עמודי שלדה ומעטפת קדמיים הועברו לשקיפות/הסתרה זמנית לצורך בחינת הרוטורים והסטטור (אינו מעיד על היעדר עמודים במבנה האמיתי; במעבר למבט כללי תוחזר השלדה המלאה)',
    localInspectionModeInactiveHe: 'מצב תצוגה רגיל: כל עמודי השלדה, התמיכות והמעטפת מוצגים לפי מצב המעטפת שנבחר'
  },

  identityNotes: {
    equipmentSchemaRoleHe: 'מזהה רכיב בסכמת המתקן שלנו (HP01) — אינו מספר סידורי של היצרן (CONFIRMED_PROJECT_SCHEMA_ID)',
    equipmentTagAssumedHe: 'מזהה רכיב (הנחה לדמו) — אינו מספר סידורי של היצרן (ASSUMED_FOR_DEMO)',
    equipmentTagUnverifiedHe: 'מזהה רכיב (לא ידוע / חסר) — חסר מקור או סטטוס תוקף; אינו מספר סידורי של היצרן (UNKNOWN_OR_MISSING)',
    shortModelConfirmedHe: 'דגם אב-טיפוס מאומת במסמך OEM ממשפחת RTXC (עמ׳ 16–17, עמודה 180 — CONFIRMED_BY_DOC)',
    shortModelConfirmedGenericHe: 'שם דגם מאומת במסמך OEM (CONFIRMED_BY_DOC)',
    shortModelAssumedHe: 'שם דגם להדגמה בלבד (הנחה לדמו) — אינו מאומת בתיעוד יצרן (ASSUMED_FOR_DEMO)',
    shortModelClarificationHe: 'שם דגם — נדרש בירור הנדסי (REQUIRES_CLARIFICATION)',
    shortModelFromSiteHe: 'שם דגם — נתון אתר ללא אימות בתיעוד יצרן (FROM_SITE)',
    shortModelUnverifiedHe: 'שם דגם (לא ידוע / חסר) — חסר מקור או סטטוס תוקף (UNKNOWN_OR_MISSING)',
    configCodeAssumedHe:
      'קוד תצורה מורכב של אב-טיפוס להדגמה (28 תווים לפי עמ׳ 8, הנחה לדמו) — אינו הזמנת מפעל מאומתת מהאתר (ASSUMED_FOR_DEMO)',
    configCodeConfirmedGenericHe:
      'קוד תצורה מתועד — אינו הזמנת מפעל מאומתת מהאתר (CONFIRMED_BY_DOC)',
    configCodeAssumedGenericHe:
      'קוד תצורה להדגמה בלבד (הנחה לדמו) — אינו הזמנת מפעל מאומתת מהאתר (ASSUMED_FOR_DEMO)',
    configCodeClarificationHe:
      'קוד תצורה — נדרש בירור הנדסי; אינו הזמנת מפעל מאומתת מהאתר (REQUIRES_CLARIFICATION)',
    configCodeFromSiteHe:
      'קוד תצורה — נתון אתר ללא אימות דרכון; אינו הזמנת מפעל מאומתת מהאתר (FROM_SITE)',
    configCodeUnverifiedHe:
      'קוד תצורה (לא ידוע / חסר) — חסר מקור או סטטוס תוקף; אינו הזמנת מפעל מאומתת מהאתר (UNKNOWN_OR_MISSING)',
    missingEquipmentIdHe: '— (אין נתון מזהה רכיב — לא ידוע / חסר — UNKNOWN_OR_MISSING)',
    missingShortModelNameHe: '— (אין נתון שם דגם — לא ידוע / חסר — UNKNOWN_OR_MISSING)',
    missingConfigCodeHe: '— (אין נתון קוד תצורה — לא ידוע / חסר — UNKNOWN_OR_MISSING)'
  },

  refrigerantChargeNotes: {
    totalConfirmedHe: '304 ק״ג R513A סה״כ ליחידה (מאומת בתיעוד יצרן: טבלה 2 עמ׳ 16, עמודה 180 — CONFIRMED_BY_DOC)',
    perCircuitAssumedHe:
      'הערכת חלוקה שווה: ≈152 ק״ג למעגל 1 + ≈152 ק״ג למעגל 2 = 304 ק״ג (ASSUMED_FOR_DEMO — בטבלה 2 עמ׳ 16 מופיע סך 304 ק״ג בלבד; בדרכון הקפוא סווגו 152 ק״ג כנתון מתועד אך בשכבת החתך הם מוצגים במפורש כהנחת חלוקה שווה)',
    frozenPrototypeClassificationNoteHe:
      'בדרכון הקפוא (rtxc_prototype.mjs) סווגו השדות refrigerantChargeCkt1=152 ו-refrigerantChargeCkt2=152 כ-confirmed_by_doc, אך בטבלה 2 עמ׳ 16 מופיע רק הסכום הכולל 304 ק״ג; לכן בשכבת החתך התלת-ממדי מוצג 152 ק״ג למעגל במפורש כ-ASSUMED_FOR_DEMO',
    frozenPrototypeMissingNoteHe:
      'שדות הקרר למעגל (refrigerantChargeCkt1 / refrigerantChargeCkt2) חסרים או ללא סטטוס בדרכון שהועבר (UNKNOWN_OR_MISSING); בשכבת החתך מוצגת הערכת חלוקה 152+152 ק״ג כ-ASSUMED_FOR_DEMO בלבד'
  },

  localInspectionModeBannerHe:
    'מצב בדיקה מקומי פעיל: עמודי שלדה ומעטפת קדמיים הועברו לשקיפות/הסתרה זמנית לצורך בחינת הרוטורים והסטטור (אינו מעיד על היעדר עמודים במבנה האמיתי; במעבר למבט כללי תוחזר השלדה המלאה)',

  booleanDiagnostics: {
    unknownStateHe: '— (לא ידוע)',
    coolPropWithinHe: 'כן — בתחום תקף של משוואת המצב R513A (CoolProp)',
    coolPropOutsideHe: 'לא — מחוץ לתחום משוואת המצב R513A (CoolProp)',
    coolPropUnknownHe: '— (לא ידוע — תחום משוואת מצב CoolProp אינו מאומת)',
    econActiveTrueHe: 'פעיל — הזרקת אדים לאקונומייזר פתוחה (EXV-ECON)',
    econActiveFalseHe: 'מופסק — ענף הזרקת אקונומייזר סגור בעומס הנוכחי',
    econActiveUnknownHe: '— (לא ידוע — מצב הפעלת אקונומייזר אינו ידוע; הזרימה בענף מושהית לבטיחות תצוגה)',
    outOfMapTrueHe: 'חריגה ממעטפת העבודה של היצרן (Out of Map)',
    outOfMapFalseHe: 'תקין — בתוך מעטפת העבודה של היצרן (עמ׳ 50)',
    outOfMapUnknownHe: '— (לא ידוע — מעטפת עבודה אינה מאומתת)'
  },

  subNodeShortNamesHe: {
    COMP1: 'מדחס בורג 1',
    COMP2: 'מדחס בורג 2',
    WHEX: 'מחליף חום מים-קרר',
    ECON1: 'אקונומייזר וגשר נוזל 1',
    ECON2: 'אקונומייזר וגשר נוזל 2',
    REC1: 'רסיבר נוזל 1',
    REC2: 'רסיבר נוזל 2',
    'EXV-C1': 'שסתום התפשטות הפשרה 1',
    'EXV-C2': 'שסתום התפשטות הפשרה 2',
    'EXV-H1': 'שסתום התפשטות חימום 1',
    'EXV-H2': 'שסתום התפשטות חימום 2',
    ACOIL1: 'סוללת אוויר 1',
    ACOIL2: 'סוללת אוויר 2',
    '4WV1': 'שסתום היפוך 4-דרכי 1',
    '4WV2': 'שסתום היפוך 4-דרכי 2',
    OS1: 'מפריד שמן 1',
    OS2: 'מפריד שמן 2',
    'FAN-GRP1': 'מאווררי EC מעגל 1',
    'FAN-GRP2': 'מאווררי EC מעגל 2',
    'OIL-CKT1': 'מערכת שמן מעגל 1',
    'OIL-CKT2': 'מערכת שמן מעגל 2',
    'FS-HP01': 'מפסק זרימת מים',
    'DRAIN-SYS': 'ניקוז עיבוי וריקון',
    'CTRL-SYMBIO': 'ארון התנעה ובקר',
    'FRAME-BASE': 'שלדת בסיס ומבודדים'
  }
};

