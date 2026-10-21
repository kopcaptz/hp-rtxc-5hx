/**
 * Stage 1 — Unified Component & Connection Registry (Single Source of Truth)
 * Used identically by:
 *   1. 3D Rooftop & Cutaway Scene (viz3d)
 *   2. Flat Live Technician P&ID Mnemonic (ui)
 *   3. Hydraulic & Thermal Solver Core (physics)
 *   4. Component Inspector Cards & Bill of Materials / Specification
 */

import { DATA_STATUS, param } from '../equipment/rtxc_prototype.mjs';

export const MEDIUM_TYPES = Object.freeze({
  PRIMARY_WATER: 'primary_water',         // Первичный водяной контур (HP01 <-> BT01 <-> HX01..05 primary)
  SECONDARY_WATER_1: 'secondary_water_1', // Независимый вторичный контур 1 (HX01 <-> צרכן 1)
  SECONDARY_WATER_2: 'secondary_water_2', // Независимый вторичный контур 2 (HX02 <-> צרכן 2)
  SECONDARY_WATER_3: 'secondary_water_3', // Независимый вторичный контур 3 (HX03 <-> צרכן 3)
  SECONDARY_WATER_4: 'secondary_water_4', // Независимый вторичный контур 4 (HX04 <-> צרכן 4)
  SECONDARY_WATER_5: 'secondary_water_5', // Независимый вторичный контур 5 (HX05 <-> צרכן 5)
  MAKEUP_WATER: 'makeup_water',           // Подпиточная подготовленная вода (WT01 -> MU01 -> контуры)
  REFRIGERANT_R513A: 'refrigerant_r513a', // Внутренний холодильный контур HP01 (R513A)
  OUTDOOR_AIR: 'outdoor_air',             // Наружный воздух через HP01
  SIGNAL_ELECTRIC: 'signal_electric'      // Электрические и управляющие связи
});

/**
 * Complete Unified Component Registry
 * Every identifier matches Section 5 of the Technical Specification.
 */
export function createComponentRegistry() {
  const components = {
    HP01: {
      id: 'HP01',
      category: 'heat_pump',
      nameHe: 'HP01 — משאבת חום Trane RTXC 180 XE-HSE',
      nameRu: 'HP01 — Тепловой насос Trane RTXC 180 XE-HSE',
      purposeHe: 'חימום מים ראשוניים באמצעות מחזור קירור R513A דו-מעגלי עם מדחסי בורג אינוורטר ומאייד אוויר',
      purposeRu: 'Нагрев воды первичного контура за счёт двухконтурного парокомпрессионного цикла R513A с инверторными винтовыми компрессорами и экономайзером',
      loopId: 'primary',
      elevationM: 0.0,
      pos3d: { x: -8.5, y: 0, z: -2.5 },
      dimensionsMm: { length: 7900, width: 2250, height: 2500 },
      operatingMassKg: 7371,
      supportType: '8 виброизоляторов X10140305640 (RDP4-WR Dark-grey) на стальной раме и ж/б основании',
      ports: {
        water_in: { id: 'water_in', dir: 'in', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'כניסת מים ראשוניים (DN150)' },
        water_out: { id: 'water_out', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'יציאת מים ראשוניים (DN150)' },
        air_in: { id: 'air_in', dir: 'in', medium: MEDIUM_TYPES.OUTDOOR_AIR, dn: 'Air', labelHe: 'כניסת אוויר חוץ' },
        air_out: { id: 'air_out', dir: 'out', medium: MEDIUM_TYPES.OUTDOOR_AIR, dn: 'Air', labelHe: 'פליטת אוויר (12 מאווררי EC)' },
        condensate_drain: { id: 'condensate_drain', dir: 'out', medium: MEDIUM_TYPES.MAKEUP_WATER, dn: 'DN50', labelHe: 'ניקוז עיבוי והפשרה' }
      },
      protections: [
        'Реле протока FS-HP01 (задержка 6 с, порог отключения < 15.3 л/с, стр. 31–32)',
        'Контроль рабочей области по наружному воздуху (-12…+21/+30 °C) и воде (20…55 °C, стр. 48, 50)',
        'Двойной предохранительный клапан с 3-ходовым переключателем на холодильном контуре (Digit 20 = D)',
        'Контроль перегрева нагнетания (>10 °C в работе, >1 °C после 12 ч предпрогрева картера, стр. 53, 56)',
        'Электрообогрев водяных коробок и кожуха 230 В (<2.8 °C, не контролируется Symbio 800, стр. 40)'
      ],
      sourceRef: 'TRANE_IOM_0526 (стр. 8, 16–17, 23, 27–33, 39–57)',
      dataStatus: DATA_STATUS.CONFIRMED_BY_DOC
    },

    BT01: {
      id: 'BT01',
      category: 'buffer_tank',
      nameHe: 'BT01 — מיכל אוגר הידראולי 4-חיבורים',
      nameRu: 'BT01 — Четырёхпатрубочный буферный бак (гидравлическая развязка и тепловая инерция)',
      purposeHe: 'הפרדה הידראולית בין ספיקת משאבת החום לספיקת רשת החלוקה ומניעת התנעות תכופות',
      purposeRu: 'Развязка расходов источника (HP01) и распределительного контура (PD01A/B), сглаживание переходных режимов и обеспечение энергии для оттайки (мин. 9 л/кВт по стр. 30)',
      loopId: 'primary',
      elevationM: 0.0,
      pos3d: { x: -1.8, y: 0, z: -2.2 },
      dimensionsMm: { length: 1600, width: 1600, height: 2800 },
      volumeM3: 4.0, // 4000 L + ~1800 L piping = 5800 L > 9 L/kW * 619 kW = 5571 L
      operatingMassKg: 4850,
      supportType: '3 кольцевые стойки с анкерным креплением к несущей раме крыши',
      ports: {
        hp_hot_in: { id: 'hp_hot_in', dir: 'in', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'כניסה חמה מ-HP01 (עליון)' },
        hp_cold_out: { id: 'hp_cold_out', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'יציאה קרה אל PP01A/B (תחתון)' },
        dist_hot_out: { id: 'dist_hot_out', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'יציאה חמה אל PD01A/B (עליון)' },
        dist_cold_in: { id: 'dist_cold_in', dir: 'in', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'חזרה קרה ממאסף ראשוני (תחתון)' },
        et00_port: { id: 'et00_port', dir: 'inout', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN50', labelHe: 'נקודת שמירת לחץ למיכל התפשטות ET00' },
        psv00_port: { id: 'psv00_port', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN40', labelHe: 'יציאה לשסתום פורק לחץ PSV00' }
      },
      protections: [
        'Предохранительный клапан PSV00 на верхней крышке',
        'Автоматический воздухоотводчик на верхней точке и дренажный кран DN40 в нижней точке',
        'Датчики температуры по высоте бака (T_top, T_mid1, T_mid2, T_bot)'
      ],
      sourceRef: 'TRANE_IOM_0526 (стр. 30–31: мин. 9 л/кВт и внутренние перегородки) + CALEFFI_BUFFER',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    },

    PP01A: {
      id: 'PP01A',
      GroupId: 'PP01A/B',
      category: 'pump',
      roleInGroup: 'A',
      nameHe: 'PP01A — משאבת סחרור ראשונית (עבודה)',
      nameRu: 'PP01A — Насос циркуляции через RTXC (Рабочий)',
      purposeHe: 'סחרור מים קבוע/מבוקר בין מיכל האוגר BT01 למשאבת החום HP01',
      purposeRu: 'Обеспечение расхода воды через теплообменник HP01 в допустимом диапазоне 15.3–45.9 л/с (управление от Symbio 800, контактор 1K27)',
      loopId: 'primary_hp',
      elevationM: 0.0,
      pos3d: { x: -4.2, y: 0, z: -0.6 },
      dimensionsMm: { length: 950, width: 600, height: 750 },
      operatingMassKg: 210,
      supportType: 'Стальная рама насосной станции на виброопорах с бетонным основанием',
      armature: {
        suctionValve: 'Затвор дисковый DN150 на всасывании',
        strainer: 'Сетчатый фильтр DN150 (≥20 mesh по стр. 29)',
        checkValve: 'Межфланцевый обратный клапан DN150 на нагнетании',
        dischargeValve: 'Затвор дисковый DN150 на нагнетании',
        unions: 'Фланцевые разъёмные соединения и вибровставки (позволяют снять PP01A без остановки PP01B)',
        gauges: 'Датчики давления PT-PP01-S (всас) и PT-PP01-D (напор)'
      },
      ports: {
        suction: { id: 'suction', dir: 'in', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'יניקה מ-BT01' },
        discharge: { id: 'discharge', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'סניקה אל HP01' }
      },
      protections: [
        'Обратный клапан исключает паразитный обратный проток через резервный насос',
        'Контроль подтверждения работы привода и перепада давления Δp_PP01',
        'Автоматический ввод резерва PP01B при наличии готовности и проверке восстановления протока'
      ],
      sourceRef: 'TRANE_IOM_0526 (стр. 29–32, 40–41 Scheme 3) + DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    },

    PP01B: {
      id: 'PP01B',
      GroupId: 'PP01A/B',
      category: 'pump',
      roleInGroup: 'B',
      nameHe: 'PP01B — משאבת סחרור ראשונית (גיבוי)',
      nameRu: 'PP01B — Насос циркуляции через RTXC (Резервный)',
      purposeHe: 'משאבת גיבוי 100% לסחרור דרך משאבת החום HP01',
      purposeRu: '100% резервирование насоса PP01A (контактор 1K28 Symbio 800 / АВР CP01)',
      loopId: 'primary_hp',
      elevationM: 0.0,
      pos3d: { x: -4.2, y: 0, z: 0.4 },
      dimensionsMm: { length: 950, width: 600, height: 750 },
      operatingMassKg: 210,
      supportType: 'Стальная рама насосной станции на виброопорах с бетонным основанием',
      armature: {
        suctionValve: 'Затвор дисковый DN150 на всасывании',
        strainer: 'Сетчатый фильтр DN150 (≥20 mesh)',
        checkValve: 'Межфланцевый обратный клапан DN150 на нагнетании (закрыт в резерве)',
        dischargeValve: 'Затвор дисковый DN150 на нагнетании',
        unions: 'Фланцевые разъёмные соединения и вибровставки (независимый демонтаж)',
        gauges: 'Датчики давления PT-PP01-S и PT-PP01-D'
      },
      ports: {
        suction: { id: 'suction', dir: 'in', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'יניקה מ-BT01' },
        discharge: { id: 'discharge', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'סניקה אל HP01' }
      },
      protections: [
        'Защита от обратного вращения обратным клапаном',
        'Вывод в ремонт (MAINTENANCE_OUT) не останавливает рабочий PP01A, но сигнализирует потерю резерва'
      ],
      sourceRef: 'TRANE_IOM_0526 (стр. 40–41) + DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    },

    PD01A: {
      id: 'PD01A',
      GroupId: 'PD01A/B',
      category: 'pump',
      roleInGroup: 'A',
      nameHe: 'PD01A — משאבת חלוקה ראשית VFD (עבודה)',
      nameRu: 'PD01A — Распределительный насос с ЧРП (Рабочий)',
      purposeHe: 'אספקת מים חמים מ-BT01 למאסף החלוקה של חמשת מחליפי החום בבקרת הפרש לחצים ΔP',
      purposeRu: 'Подача горячей первичной воды из BT01 в распределительный коллектор HX01–HX05 с регулированием частоты вращения по перепаду давления Δp_dist',
      loopId: 'primary_dist',
      elevationM: 0.0,
      pos3d: { x: 0.4, y: 0, z: -2.6 },
      dimensionsMm: { length: 950, width: 600, height: 750 },
      operatingMassKg: 225,
      supportType: 'Стальная рама насосной группы PD01 на виброопорах',
      armature: {
        suctionValve: 'Затвор дисковый DN150 на всасывании',
        strainer: 'Сетчатый фильтр DN150',
        checkValve: 'Обратный клапан DN150 на нагнетании',
        dischargeValve: 'Затвор дисковый DN150 на нагнетании',
        unions: 'Разъёмные фланцы и гибкие вставки для независимого снятия',
        gauges: 'PT-PD01-S (всас), PT-PD01-D (напор), PDT-DIST (перепад коллекторов)'
      },
      ports: {
        suction: { id: 'suction', dir: 'in', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'יניקה מ-BT01' },
        discharge: { id: 'discharge', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'סניקה למאסף חלוקה ראשוני' }
      },
      protections: [
        'Ограничение минимальной и максимальной частоты ЧРП, защита от работы на закрытую задвижку',
        'Автоматический ввод резерва PD01B при отказе с контролем восстановления расхода'
      ],
      sourceRef: 'DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    },

    PD01B: {
      id: 'PD01B',
      GroupId: 'PD01A/B',
      category: 'pump',
      roleInGroup: 'B',
      nameHe: 'PD01B — משאבת חלוקה ראשית VFD (גיבוי)',
      nameRu: 'PD01B — Распределительный насос с ЧРП (Резервный)',
      purposeHe: 'משאבת גיבוי 100% לרשת החלוקה הראשונית',
      purposeRu: '100% резервный распределительный насос с ЧРП под управлением CP01',
      loopId: 'primary_dist',
      elevationM: 0.0,
      pos3d: { x: 0.4, y: 0, z: -1.6 },
      dimensionsMm: { length: 950, width: 600, height: 750 },
      operatingMassKg: 225,
      supportType: 'Стальная рама насосной группы PD01 на виброопорах',
      armature: {
        suctionValve: 'Затвор дисковый DN150 на всасывании',
        strainer: 'Сетчатый фильтр DN150',
        checkValve: 'Обратный клапан DN150 на нагнетании',
        dischargeValve: 'Затвор дисковый DN150 на нагнетании',
        unions: 'Разъёмные фланцы и гибкие вставки',
        gauges: 'PT-PD01-S, PT-PD01-D, PDT-DIST'
      },
      ports: {
        suction: { id: 'suction', dir: 'in', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'יניקה מ-BT01' },
        discharge: { id: 'discharge', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN150', labelHe: 'סניקה למאסף חלוקה ראשוני' }
      },
      protections: [
        'Обратный клапан предотвращает рециркуляцию через стоящий насос',
        'Контроль готовности резерва в шкафу CP01'
      ],
      sourceRef: 'DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    },

    ET00: {
      id: 'ET00',
      category: 'expansion_tank',
      nameHe: 'ET00 — מיכל התפשטות ראשוני',
      nameRu: 'ET00 — Мембранный расширительный бак общего первичного водяного контура',
      purposeHe: 'קליטת התפשטות תרמית ושמירת לחץ סטטי בנקודת האפס ליד BT01',
      purposeRu: 'Компенсация температурного расширения воды первичного контура и поддержание статического давления на всасывании насосов у буфера BT01',
      loopId: 'primary',
      elevationM: 0.0,
      pos3d: { x: -2.0, y: 0, z: 1.8 },
      dimensionsMm: { length: 750, width: 750, height: 1650 },
      volumeM3: 0.5, // 500 L diaphragm tank
      operatingMassKg: 340,
      supportType: 'Собственная трёхопорная стойка на основании крыши (не висит на трубе)',
      ports: {
        nozzle: { id: 'nozzle', dir: 'inout', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN50', labelHe: 'חיבור יחיד (ללא זרימה עוברת) אל BT01' }
      },
      protections: [
        'Подключён тупиковой линией (без рабочего сквозного потока через мембранный бак)',
        'Запорно-дренажный сервисный клапан (Kappenventil) с пломбировкой от случайного закрытия',
        'Манометр контроля давления газа/воды PT-ET00'
      ],
      sourceRef: 'DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    },

    PSV00: {
      id: 'PSV00',
      category: 'safety_valve',
      nameHe: 'PSV00 — שסתום פורק לחץ מעגל ראשוני',
      nameRu: 'PSV00 — Предохранительный клапан первичного контура',
      purposeHe: 'הגנה עצמאית מפני לחץ יתר במעגל הראשוני',
      purposeRu: 'Независимая механическая защита первичного водяного объёма от превышения допустимого давления (уставка демонстр. 6.0 бар изб.)',
      loopId: 'primary',
      elevationM: 2.8,
      pos3d: { x: -1.8, y: 2.8, z: -2.2 },
      dimensionsMm: { length: 220, width: 180, height: 320 },
      operatingMassKg: 14,
      supportType: 'Штуцер верхней крышки BT01 с организованным отводом сброса в дренажный лоток',
      ports: {
        inlet: { id: 'inlet', dir: 'in', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN40', labelHe: 'כניסה מ-BT01' },
        discharge: { id: 'discharge', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN50', labelHe: 'פריקה לניקוז גג בטוח' }
      },
      protections: [
        'Прямое пружинное действие с учётом противодавления и 10% превышения при полном открытии'
      ],
      sourceRef: 'DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    },

    WT01: {
      id: 'WT01',
      category: 'water_treatment',
      nameHe: 'WT01 — יחידת טיפול במים ומינון כימיקלים',
      nameRu: 'WT01 — Узел водоподготовки, контроля качества воды и дозирования',
      purposeHe: 'סינון, בקרת מוליכות/pH, נקודת דיגום ומינון מבוקר של מעכב קורוזיה/אבנית',
      purposeRu: 'Контроль pH, электропроводности, жёсткости и хлоридов, пробоотборный кран и защищённое дозирование реагента (блокируется при отсутствии циркуляции, пустом баке или отказе датчика)',
      loopId: 'makeup',
      elevationM: 0.0,
      pos3d: { x: -6.8, y: 0, z: 3.2 },
      dimensionsMm: { length: 1200, width: 800, height: 1450 },
      operatingMassKg: 280,
      supportType: 'Стальная рама с поддоном удержания реагентов на основании крыши',
      ports: {
        raw_in: { id: 'raw_in', dir: 'in', medium: MEDIUM_TYPES.MAKEUP_WATER, dn: 'DN25', labelHe: 'כניסת מי רשת' },
        treated_out: { id: 'treated_out', dir: 'out', medium: MEDIUM_TYPES.MAKEUP_WATER, dn: 'DN25', labelHe: 'יציאת מים מטופלים אל MU01' },
        dosing_pri: { id: 'dosing_pri', dir: 'out', medium: MEDIUM_TYPES.MAKEUP_WATER, dn: 'DN15', labelHe: 'קו מינון למעגל ראשוני' }
      },
      protections: [
        'Блокировка насоса-дозатора при отсутствии протока в контуре',
        'Блокировка по нижнему уровню реагента LSL-WT01',
        'Блокировка при недостоверности датчиков (электропроводность не считается прямым измерителем ингибитора)'
      ],
      sourceRef: 'TRANE_IOM_0526 (стр. 32, 55: требования к качеству воды и макс. 20% гликоля) + DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.REQUIRES_CLARIFICATION
    },

    MU01: {
      id: 'MU01',
      category: 'makeup_unit',
      nameHe: 'MU01 — מערכת מילוי והשלמת מים מבוקרת (עם מרווח אוויר)',
      nameRu: 'MU01 — Узел контролируемой подпитки с атмосферным разрывом и коллектором 6 линий',
      purposeHe: 'הפרדת לחץ רשת באמצעות מרווח אוויר, משאבת מילוי ו-6 קווי מילוי מבוקרים ונפרדים לכל מעגל',
      purposeRu: 'Атмосферный разрыв струи (бак AB01), повысительный насос подпитки PMU01 и 6 индивидуальных линий заполнения (первичный контур + 5 вторичных контуров) с редукторами, НЗ клапанами, обратными клапанами и счётчиками объёма',
      loopId: 'makeup',
      elevationM: 0.0,
      pos3d: { x: -4.8, y: 0, z: 3.2 },
      dimensionsMm: { length: 1500, width: 850, height: 1500 },
      operatingMassKg: 390,
      supportType: 'Стальная рама на основании крыши',
      ports: {
        supply_in: { id: 'supply_in', dir: 'in', medium: MEDIUM_TYPES.MAKEUP_WATER, dn: 'DN25', labelHe: 'כניסה מ-WT01 דרך מרווח אוויר' },
        fill_pri: { id: 'fill_pri', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN20', labelHe: 'קו מילוי מבוקר למעגל ראשוני' },
        fill_sec1: { id: 'fill_sec1', dir: 'out', medium: MEDIUM_TYPES.SECONDARY_WATER_1, dn: 'DN20', labelHe: 'קו מילוי מבוקר למעגל משני 1' },
        fill_sec2: { id: 'fill_sec2', dir: 'out', medium: MEDIUM_TYPES.SECONDARY_WATER_2, dn: 'DN20', labelHe: 'קו מילוי מבוקר למעגל משני 2' },
        fill_sec3: { id: 'fill_sec3', dir: 'out', medium: MEDIUM_TYPES.SECONDARY_WATER_3, dn: 'DN20', labelHe: 'קו מילוי מבוקר למעגל משני 3' },
        fill_sec4: { id: 'fill_sec4', dir: 'out', medium: MEDIUM_TYPES.SECONDARY_WATER_4, dn: 'DN20', labelHe: 'קו מילוי מבוקר למעגל משני 4' },
        fill_sec5: { id: 'fill_sec5', dir: 'out', medium: MEDIUM_TYPES.SECONDARY_WATER_5, dn: 'DN20', labelHe: 'קו מילוי מבוקר למעגל משני 5' }
      },
      protections: [
        'Атмосферный разрыв исключает прямую передачу давления городского водопровода',
        'Проверка максимального напора насоса подпитки PMU01 (4.5 бар) относительно уставок PSV00–PSV05',
        'Нормально закрытые электромагнитные клапаны, обратные клапаны и водосчётчики на каждой из 6 линий',
        'Отсечка подпитки по лимиту длительности (T_max) и разового объёма (V_max) при утечке'
      ],
      sourceRef: 'DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    },

    CP01: {
      id: 'CP01',
      category: 'control_panel',
      nameHe: 'CP01 — לוח בקרה ואוטומציה של המתקן החיצוני',
      nameRu: 'CP01 — Шкаф автоматики и диспетчеризации внешней установки (IP54, наружного исполнения)',
      purposeHe: 'בקרת משאבות, וסתים CV01–CV05, יתירות משאבות, מילוי מים, הגנות ותקשורת מול Symbio 800',
      purposeRu: 'Управление насосами PP01/PD01/PS01–05, клапанами CV01–CV05, АВР насосов, узлами MU01/WT01 и обмен с контроллером Symbio 800 агрегата HP01',
      loopId: 'control',
      elevationM: 0.0,
      pos3d: { x: -2.2, y: 0, z: 3.4 },
      dimensionsMm: { length: 1200, width: 500, height: 2000 },
      operatingMassKg: 260,
      supportType: 'Стойка шкафа управления с навесом от солнца/осадков и зоной обслуживания 1.2 м перед дверями',
      ports: {
        power_in: { id: 'power_in', dir: 'in', medium: MEDIUM_TYPES.SIGNAL_ELECTRIC, dn: 'Cable', labelHe: 'הזנת חשמל 400V/230V' },
        symbio_bus: { id: 'symbio_bus', dir: 'inout', medium: MEDIUM_TYPES.SIGNAL_ELECTRIC, dn: 'BACnet/Hardwire', labelHe: 'ממשק מול Symbio 800 (HP01)' },
        field_io: { id: 'field_io', dir: 'inout', medium: MEDIUM_TYPES.SIGNAL_ELECTRIC, dn: 'I/O', labelHe: 'אותות רגשים, משאבות וברזים' }
      },
      protections: [
        'Разделение цепей <30 В и силовых цепей >30 В (стр. 39 руководства)',
        'Контроль достоверности датчиков (обрыв/КЗ → статус UNKNOWN без подстановки старого значения)',
        'Защита от интегрального насыщения (Anti-windup) ПИ-регуляторов CV01–CV05 и PD01A/B'
      ],
      sourceRef: 'TRANE_IOM_0526 (стр. 38–46) + DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    }
  };

  // Generate the 5 independent heat exchange modules (HX01..HX05) and their associated equipment:
  // CV01..CV05, PS01A/B..PS05A/B, ET01..ET05, PSV01..PSV05, CONS01..CONS05 (צרכן 1..5)
  for (let i = 1; i <= 5; i++) {
    const idx = `0${i}`;
    const secMedium = MEDIUM_TYPES[`SECONDARY_WATER_${i}`];
    // X positions spaced cleanly along the roof module rack: x = 2.8, 4.6, 6.4, 8.2, 10.0
    const modX = 1.2 + i * 1.85;

    components[`HX${idx}`] = {
      id: `HX${idx}`,
      branchIndex: i,
      category: 'heat_exchanger',
      nameHe: `HX${idx} — מחליף חום מים-מים בזרימה נגדית (מודול ${i})`,
      nameRu: `HX${idx} — Водо-водяной противоточный теплообменник модуля ${i}`,
      purposeHe: `העברת חום מהמים הראשוניים למעגל המשני המבודד של צרכן ${i} ללא ערבוב נוזלים`,
      purposeRu: `Нагрев независимого вторичного водяного контура потребителя צרכן ${i} (противоток, 4 патрубка, полное разделение первичной и вторичной воды стенками пластин/труб)`,
      loopId: `secondary_${i}`,
      elevationM: 0.0,
      pos3d: { x: modX, y: 0, z: -0.4 },
      dimensionsMm: { length: 850, width: 550, height: 1550 },
      operatingMassKg: 310,
      supportType: `Индивидуальная стальная рама модуля ${i} с пространством для разборки/промывки (CIP)`,
      ports: {
        pri_in: { id: 'pri_in', dir: 'in', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN65', labelHe: 'כניסה ראשונית חמה (Hot Primary In)' },
        pri_out: { id: 'pri_out', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN65', labelHe: 'יציאה ראשונית מקוררת (Cooled Primary Out)' },
        sec_in: { id: 'sec_in', dir: 'in', medium: secMedium, dn: 'DN65', labelHe: `כניסה משנית קרה מ-PS${idx}A/B (Cold Secondary In)` },
        sec_out: { id: 'sec_out', dir: 'out', medium: secMedium, dn: 'DN65', labelHe: `יציאה משנית חמה אל צרכן ${i} (Hot Secondary Out)` }
      },
      protections: [
        `Запорная арматура, дренажи, воздушники и штуцеры безразборной промывки (CIP) на обеих сторонах`,
        `Предохранительный сброс при запирании теплообменника между закрытыми отсечными кранами (тепловое расширение)`,
        `Контроль перепада давления Δp_HX${idx} (диагностика засорения) и баланса мощностей Q_pri vs Q_sec`
      ],
      sourceRef: 'LBNL_BUILDINGS_HX + DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    };

    components[`CV${idx}`] = {
      id: `CV${idx}`,
      branchIndex: i,
      category: 'control_valve',
      nameHe: `CV${idx} — ברז ויסות ראשוני למודול ${i}`,
      nameRu: `CV${idx} — Регулирующий клапан первичной ветки ${i}`,
      purposeHe: `ויסות ספיקת המים הראשוניים דרך HX${idx} לשמירת טמפרטורת האספקה לצרכן ${i}`,
      purposeRu: `Регулирование расхода первичного теплоносителя через HX${idx} по температуре вторичной подачи к צרכן ${i} (равнопроцентная характеристика, электропривод 0–10 В с обратной связью положения)`,
      loopId: `primary_branch_${i}`,
      elevationM: 1.1,
      pos3d: { x: modX - 0.35, y: 1.1, z: -1.4 },
      dimensionsMm: { length: 280, width: 220, height: 420 },
      operatingMassKg: 24,
      supportType: `Опора трубопровода первичной ветки ${i}`,
      ports: {
        inlet: { id: 'inlet', dir: 'in', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN65', labelHe: 'כניסה ממאסף חלוקה ראשוני' },
        outlet: { id: 'outlet', dir: 'out', medium: MEDIUM_TYPES.PRIMARY_WATER, dn: 'DN65', labelHe: `יציאה אל HX${idx} (pri_in)` }
      },
      protections: [
        `Ограничение скорости хода привода и защита ПИ-регулятора от интегрального насыщения (Anti-windup)`,
        `Контроль рассогласования команды u_cmd и фактического положения u_pos`
      ],
      sourceRef: 'DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    };

    for (const role of ['A', 'B']) {
      const roleHe = role === 'A' ? 'עבודה' : 'גיבוי';
      const roleRu = role === 'A' ? 'Рабочий' : 'Резервный';
      components[`PS${idx}${role}`] = {
        id: `PS${idx}${role}`,
        GroupId: `PS${idx}A/B`,
        branchIndex: i,
        category: 'pump',
        roleInGroup: role,
        nameHe: `PS${idx}${role} — משאבת סחרור משנית ${i} (${roleHe})`,
        nameRu: `PS${idx}${role} — Насос вторичного контура ${i} (${roleRu})`,
        purposeHe: `סחרור מים במעגל המשני הסגור של צרכן ${i}`,
        purposeRu: `Циркуляция воды в независимом вторичном контуре ${i} через холодную сторону HX${idx} и рубашку потребителя צרכן ${i}`,
        loopId: `secondary_${i}`,
        elevationM: 0.0,
        pos3d: { x: modX + (role === 'A' ? -0.32 : 0.32), y: 0, z: 1.15 },
        dimensionsMm: { length: 650, width: 420, height: 580 },
        operatingMassKg: 95,
        supportType: `Общая виброизолированная рама вторичной насосной группы PS${idx}A/B`,
        armature: {
          suctionValve: 'Шаровой/дисковый запорный кран DN65 на всасе',
          strainer: 'Сетчатый фильтр DN65 перед группой',
          checkValve: 'Обратный клапан DN65 на нагнетании (исключает обратный поток через резерв)',
          dischargeValve: 'Запорный кран DN65 на нагнетании',
          unions: 'Разъёмные соединения для демонтажа одного насоса без остановки соседнего',
          gauges: `Датчики давления PT-PS${idx}-S (всас) и PT-PS${idx}-D (напор)`
        },
        ports: {
          suction: { id: 'suction', dir: 'in', medium: secMedium, dn: 'DN65', labelHe: `יניקה מחזרת צרכן ${i}` },
          discharge: { id: 'discharge', dir: 'out', medium: secMedium, dn: 'DN65', labelHe: `סניקה אל HX${idx} (sec_in)` }
        },
        protections: [
          `АВР: автоматический переход на ${role === 'A' ? `PS${idx}B` : `PS${idx}A`} только при готовности резерва с проверкой восстановления расхода FT-S${idx}`,
          `Контроль кавитационного запаса NPSHa на всасывании`
        ],
        sourceRef: 'DEMO_ENG_ASSUMPTION',
        dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
      };
    }

    components[`ET${idx}`] = {
      id: `ET${idx}`,
      branchIndex: i,
      category: 'expansion_tank',
      nameHe: `ET${idx} — מיכל התפשטות משני ${i}`,
      nameRu: `ET${idx} — Мембранный расширительный бак вторичного контура ${i}`,
      purposeHe: `קליטת התפשטות תרמית ושמירת לחץ יניקה במעגל המשני ${i}`,
      purposeRu: `Компенсация теплового расширения и поддержание статического давления независимого вторичного контура ${i} (тупиковое подключение на всасе PS${idx}A/B)`,
      loopId: `secondary_${i}`,
      elevationM: 0.0,
      pos3d: { x: modX - 0.42, y: 0, z: 2.35 },
      dimensionsMm: { length: 480, width: 480, height: 980 },
      volumeM3: 0.12, // 120 L diaphragm tank for secondary loop i
      operatingMassKg: 85,
      supportType: `Индивидуальная опорная стойка бака ET${idx} на раме крыши`,
      ports: {
        nozzle: { id: 'nozzle', dir: 'inout', medium: secMedium, dn: 'DN32', labelHe: `חיבור יחיד (ללא זרימה עוברת) ליניקת PS${idx}A/B` }
      },
      protections: [
        `Запорно-сливной сервисный узел с защитой от несанкционированного перекрытия`,
        `Отсутствие сквозного рабочего потока воды через мембранный бак`,
        `Контроль предварительного давления газовой полости (в абс. единицах)`
      ],
      sourceRef: 'DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.ASSUMED_FOR_DEMO
    };

    components[`PSV${idx}`] = {
      id: `PSV${idx}`,
      branchIndex: i,
      category: 'safety_valve',
      nameHe: `PSV${idx} — שסתום פורק לחץ משני ${i}`,
      nameRu: `PSV${idx} — Предохранительный клапан вторичного контура ${i}`,
      purposeHe: `הגנה מפני לחץ יתר במעגל המשני ${i} וביגוד הצרכן`,
      purposeRu: `Независимая защита вторичного контура ${i} и рубашки צרכן ${i} от превышения давления (в т.ч. при отказе подпитки открытой или отключённом баке ET${idx})`,
      loopId: `secondary_${i}`,
      elevationM: 1.6,
      pos3d: { x: modX + 0.35, y: 1.6, z: -0.4 },
      dimensionsMm: { length: 160, width: 140, height: 260 },
      operatingMassKg: 8,
      supportType: `Коллектор безопасности вторичного модуля ${i} с дренажным отводом`,
      ports: {
        inlet: { id: 'inlet', dir: 'in', medium: secMedium, dn: 'DN25', labelHe: `כניסה ממוצא HX${idx}` },
        discharge: { id: 'discharge', dir: 'out', medium: secMedium, dn: 'DN40', labelHe: 'פריקה לתעלת ניקוז בטוחה' }
      },
      protections: [
        `Внимание (п. 3.3 ТЗ): предел давления рубашек «до 2 бар со слов техника» НЕ подтверждён паспортом! До уточнения MAWP и геодезических отметок z_i уставка PSV${idx} носит статус «Требует уточнения / Демо».`
      ],
      sourceRef: 'SITE_VERBAL_TECH + DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.REQUIRES_CLARIFICATION
    };

    components[`CONS${idx}`] = {
      id: `CONS${idx}`,
      branchIndex: i,
      category: 'consumer_boundary',
      nameHe: `צרכן ${i} (גבול מערכת משני ${i})`,
      nameRu: `צרכן ${i} — Граница расчётной модели потребителя ${i} (уходящая подача и возвращающаяся обратка)`,
      purposeHe: `ייצוג עומס החום, הנפח, הגובה ההידרוסטטי וההתנגדות ההידראולית של צרכן ${i} במפעל`,
      purposeRu: `Расчётное представление технологического потребителя ${i} за стрелками границы модели (водяной объём рубашки/трассы, геодезическая отметка высоты z_${i}, гидравлическое сопротивление и тепловая нагрузка)`,
      loopId: `secondary_${i}`,
      elevationM: -4.0, // Default demo elevation: 4m below roof (explicitly configurable per consumer!)
      pos3d: { x: modX, y: 0.4, z: 3.8 },
      dimensionsMm: { length: 600, width: 400, height: 600 },
      operatingMassKg: 0,
      supportType: 'Граница модели на парапете/шахте крыши (стрелки подачи и обратки с трубными опорами)',
      ports: {
        supply_from_roof: { id: 'supply_from_roof', dir: 'in', medium: secMedium, dn: 'DN65', labelHe: `אספקה חמה אל צרכן ${i}` },
        return_to_roof: { id: 'return_to_roof', dir: 'out', medium: secMedium, dn: 'DN65', labelHe: `חזרה מ-צרכן ${i}` }
      },
      protections: [
        `Контроль давления в верхней точке (на крыше) и в нижней точке (у рубашки потребителя с учётом гидростатики ρ·g·Δz)`,
        `Разделение температур: T_первичной_воды > T_вторичной_воды > T_продукта_(шоколада)`
      ],
      sourceRef: 'SITE_VERBAL_TECH + DEMO_ENG_ASSUMPTION',
      dataStatus: DATA_STATUS.REQUIRES_CLARIFICATION
    };
  }

  return components;
}

/**
 * Unified Connection Registry
 * Each connection stores:
 *   id, from, fromPort, to, toPort, medium, loopId,
 *   geometry: { lengthM, diameterM, elevationInM, elevationOutM, volumeM3 },
 *   hydraulics: { roughnessM, sumZeta, description },
 *   measurements: [sensorIds],
 *   status
 */
export function createConnectionRegistry() {
  const connections = [
    // === 1. PRIMARY SOURCE LOOP (BT01 -> PP01A/B -> HP01 -> BT01) ===
    {
      id: 'CONN-PRI-01A',
      from: 'BT01',
      fromPort: 'hp_cold_out',
      to: 'PP01A',
      toPort: 'suction',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: 'primary_hp',
      geometry: { lengthM: 3.5, diameterM: 0.150, elevationInM: 0.3, elevationOutM: 0.3, volumeM3: 0.062 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 2.2, description: 'Всасывающий коллектор DN150 от BT01 к рабочему насосу PP01A (затвор + фильтр 20 mesh + вибровставка)' },
      measurements: ['PT-PP01-S', 'TT-BT01-BOT'],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    },
    {
      id: 'CONN-PRI-01B',
      from: 'BT01',
      fromPort: 'hp_cold_out',
      to: 'PP01B',
      toPort: 'suction',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: 'primary_hp',
      geometry: { lengthM: 3.8, diameterM: 0.150, elevationInM: 0.3, elevationOutM: 0.3, volumeM3: 0.067 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 2.2, description: 'Всасывающая линия DN150 от BT01 к резервному насосу PP01B' },
      measurements: ['PT-PP01-S'],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    },
    {
      id: 'CONN-PRI-02A',
      from: 'PP01A',
      fromPort: 'discharge',
      to: 'HP01',
      toPort: 'water_in',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: 'primary_hp',
      geometry: { lengthM: 6.0, diameterM: 0.150, elevationInM: 0.5, elevationOutM: 0.8, volumeM3: 0.106 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 2.8, description: 'Напорная линия DN150 от PP01A (обратный клапан + затвор) к входу водяного теплообменника HP01' },
      measurements: ['PT-PP01-D', 'FT-HP01', 'PT-HP01-IN', 'TT-HP01-IN'],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    },
    {
      id: 'CONN-PRI-02B',
      from: 'PP01B',
      fromPort: 'discharge',
      to: 'HP01',
      toPort: 'water_in',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: 'primary_hp',
      geometry: { lengthM: 6.3, diameterM: 0.150, elevationInM: 0.5, elevationOutM: 0.8, volumeM3: 0.111 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 2.8, description: 'Напорная линия DN150 от резервного насоса PP01B к входу HP01' },
      measurements: ['PT-PP01-D', 'FT-HP01', 'PT-HP01-IN', 'TT-HP01-IN'],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    },
    {
      id: 'CONN-PRI-03',
      from: 'HP01',
      fromPort: 'water_out',
      to: 'BT01',
      toPort: 'hp_hot_in',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: 'primary_hp',
      geometry: { lengthM: 8.5, diameterM: 0.150, elevationInM: 1.4, elevationOutM: 2.3, volumeM3: 0.150 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 2.5, description: 'Горячая подающая магистраль DN150 от выхода HP01 (с реле протока FS-HP01 и балансировочным клапаном по рис. 8 стр. 30) к верхнему патрубку BT01' },
      measurements: ['TT-HP01-OUT', 'PT-HP01-OUT', 'FS-HP01'],
      status: DATA_STATUS.CONFIRMED_BY_DOC
    },

    // === 2. PRIMARY EXPANSION & SAFETY & MAKEUP ===
    {
      id: 'CONN-PRI-ET00',
      from: 'BT01',
      fromPort: 'et00_port',
      to: 'ET00',
      toPort: 'nozzle',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: 'primary',
      geometry: { lengthM: 3.2, diameterM: 0.050, elevationInM: 0.25, elevationOutM: 0.25, volumeM3: 0.006 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 1.5, description: 'Тупиковая линия подключения расширительного бака ET00 DN50 к нижней зоне BT01 (точка поддержания статического давления на всасе PP01/PD01, без сквозного протока)' },
      measurements: ['PT-ET00'],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    },
    {
      id: 'CONN-PRI-PSV00',
      from: 'BT01',
      fromPort: 'psv00_port',
      to: 'PSV00',
      toPort: 'inlet',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: 'primary',
      geometry: { lengthM: 0.4, diameterM: 0.040, elevationInM: 2.6, elevationOutM: 2.8, volumeM3: 0.0005 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 0.5, description: 'Патрубок предохранительного клапана PSV00 DN40 на верхней крышке BT01' },
      measurements: ['PT-BT01-TOP'],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    },
    {
      id: 'CONN-MU-WT01',
      from: 'WT01',
      fromPort: 'treated_out',
      to: 'MU01',
      toPort: 'supply_in',
      medium: MEDIUM_TYPES.MAKEUP_WATER,
      loopId: 'makeup',
      geometry: { lengthM: 2.2, diameterM: 0.025, elevationInM: 0.8, elevationOutM: 1.1, volumeM3: 0.001 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 1.8, description: 'Линия подготовленной воды DN25 от узла водоподготовки WT01 через атмосферный разрыв в бак подпитки MU01' },
      measurements: ['CT-WT01', 'PHT-WT01'],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    },
    {
      id: 'CONN-MU-PRI',
      from: 'MU01',
      fromPort: 'fill_pri',
      to: 'BT01',
      toPort: 'et00_port',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: 'makeup',
      geometry: { lengthM: 4.5, diameterM: 0.020, elevationInM: 0.6, elevationOutM: 0.3, volumeM3: 0.0014 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 4.5, description: 'Индивидуальная линия подпитки первичного контура DN20 (редуктор + НЗ клапан SV-MU00 + обратный клапан + водосчётчик FQ-MU00) в водяной трубопровод у BT01 (не в газовую полость бака!)' },
      measurements: ['FQ-MU00', 'PT-ET00'],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    },

    // === 3. PRIMARY DISTRIBUTION PUMP CONNECTIONS ===
    {
      id: 'CONN-DIST-01A',
      from: 'BT01',
      fromPort: 'dist_hot_out',
      to: 'PD01A',
      toPort: 'suction',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: 'primary_dist',
      geometry: { lengthM: 2.6, diameterM: 0.150, elevationInM: 2.3, elevationOutM: 0.4, volumeM3: 0.046 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 2.0, description: 'Всасывающий трубопровод DN150 от верхнего распределительного патрубка BT01 к рабочему насосу PD01A' },
      measurements: ['TT-PRI-SUP', 'PT-PD01-S'],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    },
    {
      id: 'CONN-DIST-01B',
      from: 'BT01',
      fromPort: 'dist_hot_out',
      to: 'PD01B',
      toPort: 'suction',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: 'primary_dist',
      geometry: { lengthM: 2.9, diameterM: 0.150, elevationInM: 2.3, elevationOutM: 0.4, volumeM3: 0.051 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 2.0, description: 'Всасывающий трубопровод DN150 от BT01 к резервному насосу PD01B' },
      measurements: ['TT-PRI-SUP', 'PT-PD01-S'],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    }
  ];

  // === 4. FIVE PARALLEL PRIMARY BRANCHES & FIVE INDEPENDENT SECONDARY LOOPS ===
  for (let i = 1; i <= 5; i++) {
    const idx = `0${i}`;
    const secMedium = MEDIUM_TYPES[`SECONDARY_WATER_${i}`];
    // Header run length increases slightly with branch index, or can be set symmetric/realistic
    const headerRunM = 2.0 + i * 1.85;

    // Primary supply from PD01A/B manifold to CV0i
    connections.push({
      id: `CONN-PRI-SUP-${idx}`,
      branchIndex: i,
      from: 'PD01A',
      fromPort: 'discharge',
      to: `CV${idx}`,
      toPort: 'inlet',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: `primary_branch_${i}`,
      geometry: { lengthM: headerRunM, diameterM: 0.065, elevationInM: 0.8, elevationOutM: 1.1, volumeM3: +(headerRunM * Math.PI * 0.065 * 0.065 / 4).toFixed(4) },
      hydraulics: { roughnessM: 0.000045, sumZeta: 1.8, description: `Участок подающего распределительного коллектора и подводка DN65 к регулирующему клапану CV${idx}` },
      measurements: [`PT-PRI-SUP`, `TT-HX${idx}-PRI-IN`],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    });

    // From CV0i to HX0i primary hot inlet
    connections.push({
      id: `CONN-PRI-CV-HX-${idx}`,
      branchIndex: i,
      from: `CV${idx}`,
      fromPort: 'outlet',
      to: `HX${idx}`,
      toPort: 'pri_in',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: `primary_branch_${i}`,
      geometry: { lengthM: 1.2, diameterM: 0.065, elevationInM: 1.1, elevationOutM: 1.25, volumeM3: 0.004 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 1.2, description: `Патрубок DN65 от клапана CV${idx} к горячему первичному входу HX${idx}` },
      measurements: [`FT-P${idx}`, `TT-HX${idx}-PRI-IN`],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    });

    // From HX0i primary cooled outlet back to BT01 via primary return manifold
    connections.push({
      id: `CONN-PRI-RET-${idx}`,
      branchIndex: i,
      from: `HX${idx}`,
      fromPort: 'pri_out',
      to: 'BT01',
      toPort: 'dist_cold_in',
      medium: MEDIUM_TYPES.PRIMARY_WATER,
      loopId: `primary_branch_${i}`,
      geometry: { lengthM: headerRunM + 1.5, diameterM: 0.065, elevationInM: 0.35, elevationOutM: 0.45, volumeM3: +((headerRunM + 1.5) * Math.PI * 0.065 * 0.065 / 4).toFixed(4) },
      hydraulics: { roughnessM: 0.000045, sumZeta: 2.1, description: `Отвод первичной обратки DN65 от выхода HX${idx} через обратный коллектор в нижний патрубок BT01` },
      measurements: [`TT-HX${idx}-PRI-OUT`, `PT-PRI-RET`],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    });

    // Secondary Loop i:
    // 1) Return from Consumer i (צרכן i) to PS0iA & PS0iB suction
    connections.push({
      id: `CONN-SEC-${idx}-RET-A`,
      branchIndex: i,
      from: `CONS${idx}`,
      fromPort: 'return_to_roof',
      to: `PS${idx}A`,
      toPort: 'suction',
      medium: secMedium,
      loopId: `secondary_${i}`,
      geometry: { lengthM: 12.0, diameterM: 0.065, elevationInM: -4.0, elevationOutM: 0.3, volumeM3: 0.040 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 3.0, description: `Возвратный трубопровод DN65 от потребителя צרכן ${i} к всасу рабочего насоса PS${idx}A (с узлом подпитки/расширения)` },
      measurements: [`TT-SEC${idx}-RET`, `PT-SEC${idx}-RET`, `PT-PS${idx}-S`],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    });

    connections.push({
      id: `CONN-SEC-${idx}-RET-B`,
      branchIndex: i,
      from: `CONS${idx}`,
      fromPort: 'return_to_roof',
      to: `PS${idx}B`,
      toPort: 'suction',
      medium: secMedium,
      loopId: `secondary_${i}`,
      geometry: { lengthM: 12.3, diameterM: 0.065, elevationInM: -4.0, elevationOutM: 0.3, volumeM3: 0.041 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 3.0, description: `Возвратный трубопровод DN65 от потребителя צרכן ${i} к всасу резервного насоса PS${idx}B` },
      measurements: [`TT-SEC${idx}-RET`, `PT-PS${idx}-S`],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    });

    // 2) Expansion Tank ET0i dead-end connection to PS0iA suction header
    connections.push({
      id: `CONN-SEC-${idx}-ET`,
      branchIndex: i,
      from: `PS${idx}A`,
      fromPort: 'suction',
      to: `ET${idx}`,
      toPort: 'nozzle',
      medium: secMedium,
      loopId: `secondary_${i}`,
      geometry: { lengthM: 1.4, diameterM: 0.032, elevationInM: 0.3, elevationOutM: 0.3, volumeM3: 0.0011 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 1.5, description: `Тупиковая линия подключения мембранного бака ET${idx} DN32 к точке поддержания давления на всасывании PS${idx}A/B (без сквозного потока)` },
      measurements: [`PT-ET${idx}`],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    });

    // 3) Controlled Makeup line from MU01 to Secondary Loop i suction pipe
    connections.push({
      id: `CONN-MU-SEC-${idx}`,
      branchIndex: i,
      from: 'MU01',
      fromPort: `fill_sec${i}`,
      to: `PS${idx}A`,
      toPort: 'suction',
      medium: secMedium,
      loopId: `secondary_${i}`,
      geometry: { lengthM: 5.0 + i * 1.5, diameterM: 0.020, elevationInM: 0.6, elevationOutM: 0.3, volumeM3: 0.002 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 4.5, description: `Отдельная контролируемая линия подпитки вторичного контура ${i} DN20 (редуктор + НЗ клапан SV-MU${idx} + обратный клапан + водосчётчик FQ-MU${idx}) в трубопровод всаса PS${idx}` },
      measurements: [`FQ-MU${idx}`, `PT-PS${idx}-S`],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    });

    // 4) PS0iA & PS0iB discharge to HX0i cold secondary inlet (sec_in)
    connections.push({
      id: `CONN-SEC-${idx}-PUMP-HX-A`,
      branchIndex: i,
      from: `PS${idx}A`,
      fromPort: 'discharge',
      to: `HX${idx}`,
      toPort: 'sec_in',
      medium: secMedium,
      loopId: `secondary_${i}`,
      geometry: { lengthM: 1.8, diameterM: 0.065, elevationInM: 0.5, elevationOutM: 0.35, volumeM3: 0.006 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 2.4, description: `Напорная линия DN65 от рабочего насоса PS${idx}A (обратный клапан + затвор) к холодному вторичному входу HX${idx} (противоток)` },
      measurements: [`PT-PS${idx}-D`, `FT-S${idx}`],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    });

    connections.push({
      id: `CONN-SEC-${idx}-PUMP-HX-B`,
      branchIndex: i,
      from: `PS${idx}B`,
      fromPort: 'discharge',
      to: `HX${idx}`,
      toPort: 'sec_in',
      medium: secMedium,
      loopId: `secondary_${i}`,
      geometry: { lengthM: 2.0, diameterM: 0.065, elevationInM: 0.5, elevationOutM: 0.35, volumeM3: 0.0066 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 2.4, description: `Напорная линия DN65 от резервного насоса PS${idx}B к холодному вторичному входу HX${idx}` },
      measurements: [`PT-PS${idx}-D`, `FT-S${idx}`],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    });

    // 5) Safety Valve PSV0i on HX0i secondary outlet header
    connections.push({
      id: `CONN-SEC-${idx}-PSV`,
      branchIndex: i,
      from: `HX${idx}`,
      fromPort: 'sec_out',
      to: `PSV${idx}`,
      toPort: 'inlet',
      medium: secMedium,
      loopId: `secondary_${i}`,
      geometry: { lengthM: 0.4, diameterM: 0.025, elevationInM: 1.25, elevationOutM: 1.6, volumeM3: 0.0002 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 0.6, description: `Подводка предохранительного клапана PSV${idx} DN25 от вторичного выхода HX${idx}` },
      measurements: [`PT-SEC${idx}-SUP`],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    });

    // 6) Hot Secondary Supply from HX0i (sec_out) to Consumer i boundary (צרכן i)
    connections.push({
      id: `CONN-SEC-${idx}-SUP`,
      branchIndex: i,
      from: `HX${idx}`,
      fromPort: 'sec_out',
      to: `CONS${idx}`,
      toPort: 'supply_from_roof',
      medium: secMedium,
      loopId: `secondary_${i}`,
      geometry: { lengthM: 12.0, diameterM: 0.065, elevationInM: 1.25, elevationOutM: -4.0, volumeM3: 0.040 },
      hydraulics: { roughnessM: 0.000045, sumZeta: 2.6, description: `Подающий трубопровод нагретой вторичной воды DN65 от выхода HX${idx} к потребителю צרכן ${i}` },
      measurements: [`TT-SEC${idx}-SUP`, `PT-SEC${idx}-SUP`, `FT-S${idx}`],
      status: DATA_STATUS.ASSUMED_FOR_DEMO
    });
  }

  return connections;
}

/**
 * Validates topological integrity required by Stage 1 & Section 15:
 * - 5 heat exchangers, 4 ports each
 * - 5 independent secondary water mediums (no cross-connection between secondary loops)
 * - Primary water separated from secondary water and from refrigerant
 * - Every expansion tank (ET00, ET01..ET05) connected via a single nozzle (no through-flow)
 * - Every loop has a dedicated safety relief valve (PSV00, PSV01..PSV05)
 */
export function verifyTopologyIntegrity(
  components = createComponentRegistry(),
  connections = createConnectionRegistry()
) {
  const issues = [];

  // 1. Check 5 HXs with 4 ports each
  const hxIds = ['HX01', 'HX02', 'HX03', 'HX04', 'HX05'];
  for (const hxId of hxIds) {
    const hx = components[hxId];
    if (!hx) {
      issues.push(`Missing heat exchanger ${hxId}`);
      continue;
    }
    const portKeys = Object.keys(hx.ports || {});
    if (portKeys.length !== 4 || !portKeys.includes('pri_in') || !portKeys.includes('pri_out') || !portKeys.includes('sec_in') || !portKeys.includes('sec_out')) {
      issues.push(`${hxId} does not have exactly 4 valid ports (pri_in, pri_out, sec_in, sec_out)`);
    }
    if (hx.ports.pri_in.medium !== MEDIUM_TYPES.PRIMARY_WATER || hx.ports.pri_out.medium !== MEDIUM_TYPES.PRIMARY_WATER) {
      issues.push(`${hxId} primary ports do not carry PRIMARY_WATER`);
    }
    const expectedSec = MEDIUM_TYPES[`SECONDARY_WATER_${hx.branchIndex}`];
    if (hx.ports.sec_in.medium !== expectedSec || hx.ports.sec_out.medium !== expectedSec) {
      issues.push(`${hxId} secondary ports do not carry isolated ${expectedSec}`);
    }
  }

  // 2. Check no connection mixes incompatible media or connects two different secondary loops
  for (const conn of connections) {
    const compFrom = components[conn.from];
    const compTo = components[conn.to];
    if (!compFrom) issues.push(`Connection ${conn.id} references unknown source component ${conn.from}`);
    if (!compTo) issues.push(`Connection ${conn.id} references unknown target component ${conn.to}`);
    if (compFrom && compTo) {
      const pFrom = compFrom.ports?.[conn.fromPort];
      const pTo = compTo.ports?.[conn.toPort];
      if (!pFrom) issues.push(`Connection ${conn.id} references missing port ${conn.from}.${conn.fromPort}`);
      if (!pTo) issues.push(`Connection ${conn.id} references missing port ${conn.to}.${conn.toPort}`);
      if (pFrom && pTo && pFrom.medium !== pTo.medium) {
        issues.push(`Medium mismatch on ${conn.id}: ${pFrom.medium} vs ${pTo.medium}`);
      }
    }
  }

  // 3. Check expansion tanks ET00..ET05 have exactly 1 connection and 1 port (dead-end, no through-flow)
  const etIds = ['ET00', 'ET01', 'ET02', 'ET03', 'ET04', 'ET05'];
  for (const etId of etIds) {
    const et = components[etId];
    if (!et) {
      issues.push(`Missing expansion tank ${etId}`);
      continue;
    }
    if (Object.keys(et.ports).length !== 1) {
      issues.push(`Expansion tank ${etId} has more than 1 port (through-flow prohibited)`);
    }
    const etConns = connections.filter((c) => c.from === etId || c.to === etId);
    if (etConns.length !== 1) {
      issues.push(`Expansion tank ${etId} must have exactly 1 pipe connection, found ${etConns.length}`);
    }
  }

  // 4. Check safety valves PSV00..PSV05 exist and are connected
  const psvIds = ['PSV00', 'PSV01', 'PSV02', 'PSV03', 'PSV04', 'PSV05'];
  for (const psvId of psvIds) {
    const psvConns = connections.filter((c) => c.from === psvId || c.to === psvId);
    if (psvConns.length === 0) {
      issues.push(`Safety valve ${psvId} is unconnected`);
    }
  }

  return {
    valid: issues.length === 0,
    passed: issues.length === 0,
    hxCount: hxIds.length,
    componentCount: Object.keys(components).length,
    connectionCount: connections.length,
    issues
  };
}

export const COMPONENT_REGISTRY = (() => {
  const reg = createComponentRegistry();
  for (const comp of Object.values(reg)) {
    comp.labelHe = comp.labelHe || comp.nameHe || comp.id;
    comp.labelRu = comp.labelRu || comp.nameRu || comp.id;
    comp.source = comp.source || comp.sourceRef || 'TRANE_IOM_0526';
    comp.status = comp.status || comp.dataStatus || 'assumed_for_demo';
    if (comp.pos3d && !Array.isArray(comp.pos3d)) {
      comp.pos3d = [comp.pos3d.x ?? 0, comp.pos3d.y ?? 0, comp.pos3d.z ?? 0];
    }
  }
  return reg;
})();

export const CONNECTION_REGISTRY = (() => {
  const list = createConnectionRegistry();
  for (const conn of list) {
    conn.DN = conn.DN || (conn.geometry?.diameterM ? `DN${Math.round(conn.geometry.diameterM * 1000)}` : 'Signal');
    conn.L_m = conn.L_m ?? (conn.geometry?.lengthM ?? 0);
    conn.sensors = conn.sensors || conn.measurements || [];
  }
  return list;
})();

export function getComponentConnections(compId) {
  return CONNECTION_REGISTRY.filter((c) => c.from === compId || c.to === compId);
}

export function getConnectedObjects(compId) {
  const components = new Set([compId]);
  const connections = new Set();
  for (const c of CONNECTION_REGISTRY) {
    if (c.from === compId || c.to === compId) {
      connections.add(c.id);
      components.add(c.from);
      components.add(c.to);
    }
  }
  // Map visual stream pipe aliases in 3D/PID
  if (compId === 'HP01' || compId === 'PP01A' || compId === 'PP01B' || compId === 'BT01') {
    connections.add('PIPE-HP-SUP-01');
    connections.add('PIPE-HP-RET-01');
    connections.add('PIPE-HP-RET-02');
  }
  if (compId === 'BT01' || compId === 'PD01A' || compId === 'PD01B') {
    connections.add('PIPE-DIST-SUP-01');
    connections.add('PIPE-DIST-RET-01');
  }
  for (let i = 1; i <= 5; i++) {
    const pad = String(i).padStart(2, '0');
    const brIds = [`HX${pad}`, `CV${pad}`, `PS${pad}A`, `PS${pad}B`, `ET${pad}`, `PSV${pad}`, `CONS${pad}`];
    if (brIds.includes(compId)) {
      brIds.forEach((id) => components.add(id));
      connections.add(`PIPE-BR${pad}-SUP`);
      connections.add(`PIPE-BR${pad}-RET`);
      connections.add(`PIPE-SEC${pad}-SUP`);
      connections.add(`PIPE-SEC${pad}-RET`);
    }
  }
  return { components, connections };
}

