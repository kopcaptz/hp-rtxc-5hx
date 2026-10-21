/**
 * Stage 0 & Section 13 — Datasets & Data Modes (Demo Dataset vs Site Data Template)
 * plus Unit Conversion & JSON Import/Export with strict schema & physical bounds validation.
 */

import { DATA_STATUS, param } from './rtxc_prototype.mjs';
export { DATA_STATUS };

export const DATA_MODES = Object.freeze({
  DEMO: 'DEMO', // Демонстрационный пример: полный, согласованный, явно обозначенный
  SITE: 'SITE'  // Данные площадки: неполные расчёты блокируются адресно; независимые подсистемы продолжают считаться
});

/**
 * Consumer Load Model Types (Section 9.6):
 * 1. PRESCRIBED_POWER: заданный отбор тепла во времени Q_demand(t)
 * 2. THERMAL_MASS: нагреваемая масса с теплопотерями (M_proc * cp_proc * dT/dt = UA_jacket*(T_sec - T_proc) - Q_loss)
 * 3. FLOW_PROCESS: проточный технологический процесс
 * 4. COMBINED: комбинация документированных нагрузок
 */
export const CONSUMER_LOAD_TYPES = Object.freeze({
  PRESCRIBED_POWER: 'PRESCRIBED_POWER',
  THERMAL_MASS: 'THERMAL_MASS',
  FLOW_PROCESS: 'FLOW_PROCESS',
  COMBINED: 'COMBINED'
});

/**
 * Creates a clean deep-cloned dataset for the selected mode ('DEMO' or 'SITE').
 */
export function createDataset(mode = DATA_MODES.DEMO) {
  const isSite = mode === DATA_MODES.SITE;

  return {
    schemaVersion: '1.0.0',
    projectCode: 'HP-RTXC-5HX-REV1',
    mode,
    modeLabelRu: isSite
      ? 'Данные площадки (отсутствующие параметры = «Нет данных», зависимые расчёты блокируются адресно)'
      : 'Демонстрационный набор (полный согласованный инженерный пример, числа не являются паспортом завода)',
    modeLabelHe: isSite
      ? 'נתוני אתר (פרמטרים חסרים מסומנים כ״חסר מידע״ וחוסמים חישובים תלויים בלבד)'
      : 'מערך נתוני הדגמה (עקבי ומוגדר להדגמה הנדסית — אינו מהווה נתוני מפעל מאומתים)',

    // Ambient & Site Boundary Conditions
    ambient: {
      temperatureC: param(12.0, '°C', isSite ? 'TRANE_IOM_0526' : 'DEMO_ENG_ASSUMPTION', 'Температура наружного воздуха на кровле', DATA_STATUS.ASSUMED_FOR_DEMO),
      relativeHumidityPct: param(75.0, '%', 'DEMO_ENG_ASSUMPTION', 'Относительная влажность наружного воздуха (влияет на инееобразование при T_amb < 5°C)', DATA_STATUS.ASSUMED_FOR_DEMO),
      altitudeM: param(50.0, 'm', 'DEMO_ENG_ASSUMPTION', 'Высота площадки над уровнем моря (карта RTXC до 1000 м, стр. 50)', DATA_STATUS.ASSUMED_FOR_DEMO),
      barometricPressurePa: param(101325.0, 'Pa', 'TRANE_IOM_0526', 'Стандартное атмосферное давление (стр. 56: 101.35 кПа)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 56'),
      strictPage48AmbientLimit: param(false, 'boolean', 'TRANE_IOM_0526', 'Использовать строгий предел +21°C со стр. 48 вместо +30°C со стр. 50', DATA_STATUS.REQUIRES_CLARIFICATION, 'p. 48 vs p. 50')
    },

    // Heat Pump HP01 Operating Setpoints
    hp01: {
      leavingWaterTempSetpointC: param(50.0, '°C', 'DEMO_ENG_ASSUMPTION', 'Уставка температуры первичной подачи HP01 (в пределах рабочей карты 20..55 °C, стр. 50). Выше 45 °C для обеспечения температурного напора на HX01–HX05.', DATA_STATUS.ASSUMED_FOR_DEMO, 'p. 50'),
      oilSumpPreheatedHours: param(12.0, 'h', 'TRANE_IOM_0526', 'Предварительный прогрев картера и маслоотделителя перед пуском ≥ 12 ч (стр. 4, 53, 56)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 53, 56'),
      evapAntiFreezeHeater230VAvailable: param(true, 'boolean', 'TRANE_IOM_0526', 'Наличие независимого питания 230 В электронагревателей испарителя (не контролируется Symbio 800, стр. 32, 40)', DATA_STATUS.CONFIRMED_BY_DOC, 'p. 32, 40'),
      glycolConcentrationPct: param(0.0, '%', 'TRANE_IOM_0526', 'Концентрация гликоля (0% чистая вода; при использовании гликоля макс. 20% для насосного модуля, стр. 55)', DATA_STATUS.ASSUMED_FOR_DEMO, 'p. 55')
    },

    // Primary & Distribution Hydraulic Parameters
    primaryLoop: {
      totalWaterVolumeM3: param(5.8, 'm3', 'DEMO_ENG_ASSUMPTION', 'Общий объём первичного контура (4.0 м³ буфер BT01 + 1.8 м³ теплообменники и коллекторы > мин. 9 л/кВт × 619 кВт = 5.57 м³, стр. 30)', DATA_STATUS.ASSUMED_FOR_DEMO, 'p. 30'),
      coldFillTempC: param(15.0, '°C', 'DEMO_ENG_ASSUMPTION', 'Температура холодного заполнения первичного контура', DATA_STATUS.ASSUMED_FOR_DEMO),
      initialStaticGaugePa: param(220000.0, 'Pa', 'DEMO_ENG_ASSUMPTION', 'Начальное статическое избыточное давление первичного контура на отметке крыши (2.20 бар изб.)', DATA_STATUS.ASSUMED_FOR_DEMO),
      et00VolumeM3: param(0.50, 'm3', 'DEMO_ENG_ASSUMPTION', 'Полный объём мембранного бака ET00 (500 л)', DATA_STATUS.ASSUMED_FOR_DEMO),
      et00PrechargeGaugePa: param(180000.0, 'Pa', 'DEMO_ENG_ASSUMPTION', 'Предварительное давление азотной полости ET00 (1.80 бар изб. = 281.325 кПа абс.)', DATA_STATUS.ASSUMED_FOR_DEMO),
      psv00SetpointGaugePa: param(600000.0, 'Pa', 'DEMO_ENG_ASSUMPTION', 'Номинальное давление начала открытия предохранительного клапана PSV00 (6.0 бар изб.; в заводском насосном модуле Trane ставит 10 бар, стр. 36)', DATA_STATUS.ASSUMED_FOR_DEMO, 'p. 36'),
      pp01NominalHeadM: param(16.0, 'm', 'DEMO_ENG_ASSUMPTION', 'Номинальный напор первичного насоса PP01A/B при номинальном расходе 30 л/с', DATA_STATUS.ASSUMED_FOR_DEMO),
      pp01ShutoffHeadM: param(22.0, 'm', 'DEMO_ENG_ASSUMPTION', 'Напор насоса PP01A/B при нулевом расходе (на закрытую задвижку)', DATA_STATUS.ASSUMED_FOR_DEMO),
      pd01NominalHeadM: param(18.0, 'm', 'DEMO_ENG_ASSUMPTION', 'Номинальный напор распределительного насоса PD01A/B при 100% скорости и расходе 30 л/с', DATA_STATUS.ASSUMED_FOR_DEMO),
      pd01ShutoffHeadM: param(25.0, 'm', 'DEMO_ENG_ASSUMPTION', 'Напор распределительного насоса PD01A/B при нулевом расходе (100% скорости)', DATA_STATUS.ASSUMED_FOR_DEMO),
      distDeltaPSetpointPa: param(110000.0, 'Pa', 'DEMO_ENG_ASSUMPTION', 'Уставка перепада давления между подающим и обратным первичными коллекторами Δp_dist (110 кПа)', DATA_STATUS.ASSUMED_FOR_DEMO)
    },

    // Water Treatment WT01 & Makeup Unit MU01 Parameters (Section 7)
    waterChemistryAndMakeup: {
      ph: param(isSite ? null : 7.8, 'pH', isSite ? 'SITE_VERBAL_TECH' : 'DEMO_ENG_ASSUMPTION', 'Водородный показатель подпиточной и циркуляционной воды', isSite ? DATA_STATUS.MISSING_DATA : DATA_STATUS.ASSUMED_FOR_DEMO),
      conductivityUsCm: param(isSite ? null : 380.0, 'µS/cm', isSite ? 'SITE_VERBAL_TECH' : 'DEMO_ENG_ASSUMPTION', 'Удельная электропроводность воды (не является универсальным измерителем концентрации ингибитора!)', isSite ? DATA_STATUS.MISSING_DATA : DATA_STATUS.ASSUMED_FOR_DEMO),
      hardnessFrenchDeg: param(isSite ? null : 8.5, '°fH', isSite ? 'SITE_VERBAL_TECH' : 'DEMO_ENG_ASSUMPTION', 'Общая жёсткость исходной воды (требует лабораторного анализа воды площадки)', isSite ? DATA_STATUS.MISSING_DATA : DATA_STATUS.ASSUMED_FOR_DEMO),
      chloridesMgL: param(isSite ? null : 42.0, 'mg/L', isSite ? 'SITE_VERBAL_TECH' : 'DEMO_ENG_ASSUMPTION', 'Содержание хлоридов Cl⁻ (критично для выбора стали пластин HX01–HX05 AISI 304 vs AISI 316)', isSite ? DATA_STATUS.MISSING_DATA : DATA_STATUS.ASSUMED_FOR_DEMO),
      reagentTankLevelPct: param(82.0, '%', 'DEMO_ENG_ASSUMPTION', 'Уровень реагента в ёмкости дозирования WT01', DATA_STATUS.ASSUMED_FOR_DEMO),
      makeupPumpMaxGaugePa: param(350000.0, 'Pa', 'DEMO_ENG_ASSUMPTION', 'Максимальный напор насоса подпитки PMU01 за атмосферным разрывом (3.5 бар изб. — выше 2.0 бар вторичных контуров, поэтому обязательны редукторы и PSV01–PSV05!)', DATA_STATUS.ASSUMED_FOR_DEMO),
      makeupRegulatedTargetGaugePa: param(85000.0, 'Pa', 'DEMO_ENG_ASSUMPTION', 'Целевое давление редуктора подпитки вторичных контуров на кровле (0.85 бар изб., согласовано с перепадом высот 4 м до потребителей)', DATA_STATUS.ASSUMED_FOR_DEMO),
      makeupMaxSingleVolumeL: param(45.0, 'L', 'DEMO_ENG_ASSUMPTION', 'Максимальный допустимый разовый объём подпитки контура до блокировки по подозрению на утечку', DATA_STATUS.ASSUMED_FOR_DEMO),
      makeupMaxDurationS: param(120.0, 's', 'DEMO_ENG_ASSUMPTION', 'Максимальная непрерывная продолжительность подпитки до защитной блокировки', DATA_STATUS.ASSUMED_FOR_DEMO)
    },

    // Five Heat Exchange Modules & Secondary Consumer Loops (HX01..HX05 & צרכן 1..5)
    branches: [1, 2, 3, 4, 5].map((i) => {
      const idx = `0${i}`;
      const loadTypes = [
        CONSUMER_LOAD_TYPES.THERMAL_MASS,
        CONSUMER_LOAD_TYPES.PRESCRIBED_POWER,
        CONSUMER_LOAD_TYPES.FLOW_PROCESS,
        CONSUMER_LOAD_TYPES.COMBINED,
        CONSUMER_LOAD_TYPES.THERMAL_MASS
      ];
      return {
        index: i,
        id: `BRANCH_${idx}`,
        hxId: `HX${idx}`,
        consumerId: `CONS${idx}`,
        consumerLabelHe: `צרכן ${i}`,
        consumerLabelRu: `Потребитель ${i} (צרכן ${i})`,

        // Heat Exchanger HX0i Parameters
        hxNominalUA: param(34000.0, 'W/K', 'DEMO_ENG_ASSUMPTION', `Номинальный коэффициент теплопередачи UA противоточного теплообменника HX${idx} в чистом состоянии`, DATA_STATUS.ASSUMED_FOR_DEMO),
        hxHeatTransferAreaM2: param(10.0, 'm2', 'DEMO_ENG_ASSUMPTION', `Площадь теплообмена пластинчатого аппарата HX${idx}`, DATA_STATUS.ASSUMED_FOR_DEMO),
        hxMetalMassKg: param(140.0, 'kg', 'DEMO_ENG_ASSUMPTION', `Масса пакета пластин и корпуса HX${idx} (учитывается в нестационарной теплоёмкости)`, DATA_STATUS.ASSUMED_FOR_DEMO),
        hxWaterVolumePerSideM3: param(0.028, 'm3', 'DEMO_ENG_ASSUMPTION', `Объём каналов одной стороны HX${idx} (28 л)`, DATA_STATUS.ASSUMED_FOR_DEMO),
        hxFoulingResistanceM2KW: param(0.0, 'm2*K/W', 'DEMO_ENG_ASSUMPTION', `Термическое сопротивление загрязнения R_f (влияет на UA и гидравлическое сопротивление)`, DATA_STATUS.ASSUMED_FOR_DEMO),

        // Secondary Loop Hydraulics & Pressures
        secondaryWaterVolumeM3: param(0.45, 'm3', 'DEMO_ENG_ASSUMPTION', `Полный водяной объём вторичного контура ${i} (включая трассу и рубашку потребителя)`, DATA_STATUS.ASSUMED_FOR_DEMO),
        secondaryInitialGaugeRoofPa: param(75000.0, 'Pa', 'DEMO_ENG_ASSUMPTION', `Начальное статическое давление вторичного контура ${i} на отметке кровли (0.75 бар изб. при холодном заполнении; обеспечивает запас NPSHa > 17 м и непревышение 2.0 бар у потребителя на z = -4 м)`, DATA_STATUS.ASSUMED_FOR_DEMO),
        etVolumeM3: param(0.12, 'm3', 'DEMO_ENG_ASSUMPTION', `Объём мембранного расширительного бака ET${idx} (120 л)`, DATA_STATUS.ASSUMED_FOR_DEMO),
        etPrechargeGaugePa: param(60000.0, 'Pa', 'DEMO_ENG_ASSUMPTION', `Предварительное давление газовой полости ET${idx} (0.60 бар изб. = 161.325 кПа абс.)`, DATA_STATUS.ASSUMED_FOR_DEMO),
        psNominalHeadM: param(8.5, 'm', 'DEMO_ENG_ASSUMPTION', `Номинальный напор вторичного насоса PS${idx}A/B при расходе 5.5 л/с`, DATA_STATUS.ASSUMED_FOR_DEMO),
        psShutoffHeadM: param(12.0, 'm', 'DEMO_ENG_ASSUMPTION', `Напор вторичного насоса PS${idx}A/B на закрытую задвижку (q_v = 0)`, DATA_STATUS.ASSUMED_FOR_DEMO),

        // Consumer Elevation & Jacket Pressure Limit (Section 3.3 — Critical Clarification!)
        consumerElevationFromRoofM: param(
          isSite ? null : -4.0,
          'm',
          isSite ? 'SITE_VERBAL_TECH' : 'DEMO_ENG_ASSUMPTION',
          `Геодезическая отметка потребителя צרכן ${i} относительно площадки крыши (z_roof = 0 м). В режиме площадки требует инструментальной геодезии!`,
          isSite ? DATA_STATUS.MISSING_DATA : DATA_STATUS.ASSUMED_FOR_DEMO
        ),
        jacketMaxAllowablePressureGaugePa: param(
          isSite ? null : 200000.0,
          'Pa',
          'SITE_VERBAL_TECH',
          `Верхний предел давления рубашки צרכן ${i} («до 2 бар со слов техника» — НЕ подтверждён паспортом сосуда, требует уточнения: изб./абс., рабочее/MAWP, при какой температуре)`,
          isSite ? DATA_STATUS.MISSING_DATA : DATA_STATUS.REQUIRES_CLARIFICATION
        ),
        psvSetpointGaugeRoofPa: param(
          115000.0,
          'Pa',
          'DEMO_ENG_ASSUMPTION',
          `Демонстрационная уставка начала открытия PSV${idx} на кровле (1.15 бар изб., полный подъём при 1.265 бар изб., закрытие при 1.09 бар изб. — согласована с гидростатическим столбом +0.39 бар при z = -4 м и напором PS${idx} для защиты предела 2.0 бар изб. на потребителе; не выдавать за разрешённую эксплуатационную уставку до паспортизации рубашек!)`,
          DATA_STATUS.REQUIRES_CLARIFICATION
        ),

        // Secondary & Process Temperatures (Section 3.2 — Three Distinct Temperatures!)
        secondarySupplyTempSetpointC: param(
          45.0,
          '°C',
          'DEMO_ENG_ASSUMPTION',
          `Уставка температуры вторичной водяной подачи к צרכן ${i} (поддерживается клапаном CV${idx} при более горячей первичной подаче ~50 °C)`,
          DATA_STATUS.ASSUMED_FOR_DEMO
        ),
        processTargetTempC: param(
          isSite ? null : 38.0,
          '°C',
          isSite ? 'SITE_VERBAL_TECH' : 'DEMO_ENG_ASSUMPTION',
          `Целевая температура технологического продукта (шоколадной массы) внутри аппарата צרכן ${i} — отличается от температуры вторичной воды в рубашке и выхода RTXC!`,
          isSite ? DATA_STATUS.MISSING_DATA : DATA_STATUS.ASSUMED_FOR_DEMO
        ),

        // Consumer Thermal Load Parameters
        loadModelType: param(
          loadTypes[i - 1],
          'enum',
          'DEMO_ENG_ASSUMPTION',
          `Тип модели внешней нагрузки потребителя צרכן ${i}`,
          DATA_STATUS.ASSUMED_FOR_DEMO
        ),
        nominalThermalDemandW: param(
          110000.0,
          'W',
          'DEMO_ENG_ASSUMPTION',
          `Расчётная тепловая нагрузка потребителя צרכן ${i} (110 кВт; сумма 5 веток = 550 кВт в пределах 619 кВт RTXC 180 XE-HSE)`,
          DATA_STATUS.ASSUMED_FOR_DEMO
        ),
        processThermalMassJK: param(
          4200000.0,
          'J/K',
          'DEMO_ENG_ASSUMPTION',
          `Эквивалентная теплоёмкость нагреваемой массы и рубашки потребителя צרכן ${i}`,
          DATA_STATUS.ASSUMED_FOR_DEMO
        ),
        jacketUA: param(
          isSite ? null : 16500.0,
          'W/K',
          isSite ? 'SITE_VERBAL_TECH' : 'DEMO_ENG_ASSUMPTION',
          `Коэффициент теплопередачи водяной рубашки аппарата צרכן ${i} к продукту`,
          isSite ? DATA_STATUS.MISSING_DATA : DATA_STATUS.ASSUMED_FOR_DEMO
        )
      };
    }),

    // Explicit Engineering Simplifications List (Stage 0 requirement)
    simplifications: [
      '1. Акустическое поле на крыше не моделируется волновым методом; паспортные уровни шума RTXC (101 дБ(А) L_WA, 79 дБ(А) на 1 м, стр. 16) приведены справочно.',
      '2. Внутренний холодильный цикл R513A представлен четырёхточечной термодинамической моделью с отдельным балансом ветви впрыска экономайзера BPHE и контролем области применимости.',
      '3. Волновой гидроудар (уравнения Жуковского в частных производных) не интегрируется на миллисекундной сетке; квазистационарная гидравлика сети решается совместно с инерцией приводов насосов и клапанов и податливостью мембранных баков ET00–ET05.',
      '4. Теплообменники HX01–HX05 рассчитываются аналитическим противоточным методом ε-NTU с динамической теплоёмкостью воды и металла корпусов/пластин.'
    ]
  };
}

/**
 * Inspects a dataset and returns a structured report of missing data ("нет данных")
 * and which dependent calculations are selectively blocked (Section 3.4 & Section 13).
 */
export function evaluateMissingDataDependencies(dataset) {
  const missingItems = [];
  const blockedCalculations = new Set();

  // Check water chemistry
  const chem = dataset.waterChemistryAndMakeup;
  for (const [key, rec] of Object.entries(chem)) {
    if (rec && (rec.status === DATA_STATUS.MISSING_DATA || rec.value === null)) {
      missingItems.push({ path: `waterChemistryAndMakeup.${key}`, conditions: rec.conditions });
      blockedCalculations.add('WATER_TREATMENT_DOSING_AND_SCALING_INDEX');
    }
  }

  // Check branches
  for (const br of dataset.branches) {
    if (br.consumerElevationFromRoofM.status === DATA_STATUS.MISSING_DATA || br.consumerElevationFromRoofM.value === null) {
      missingItems.push({ path: `branches[${br.index}].consumerElevationFromRoofM`, conditions: br.consumerElevationFromRoofM.conditions });
      blockedCalculations.add(`CONSUMER_${br.index}_BOTTOM_HYDROSTATIC_PRESSURE`);
      blockedCalculations.add(`CONSUMER_${br.index}_PSV_PERMISSIBLE_SETPOINT_VERIFICATION`);
    }
    if (br.jacketMaxAllowablePressureGaugePa.status === DATA_STATUS.MISSING_DATA || br.jacketMaxAllowablePressureGaugePa.value === null) {
      missingItems.push({ path: `branches[${br.index}].jacketMaxAllowablePressureGaugePa`, conditions: br.jacketMaxAllowablePressureGaugePa.conditions });
      blockedCalculations.add(`CONSUMER_${br.index}_JACKET_MAWP_COMPLIANCE`);
      blockedCalculations.add(`CONSUMER_${br.index}_PSV_PERMISSIBLE_SETPOINT_VERIFICATION`);
    }
    if (br.processTargetTempC.status === DATA_STATUS.MISSING_DATA || br.processTargetTempC.value === null ||
        br.jacketUA.status === DATA_STATUS.MISSING_DATA || br.jacketUA.value === null) {
      missingItems.push({ path: `branches[${br.index}].processJacketThermalModel`, conditions: br.processTargetTempC.conditions });
      blockedCalculations.add(`CONSUMER_${br.index}_CHOCOLATE_CORE_TEMPERATURE`);
    }
  }

  return {
    mode: dataset.mode,
    hasMissingData: missingItems.length > 0,
    missingCount: missingItems.length,
    missingItems,
    blockedCalculations: Array.from(blockedCalculations),
    activeIndependentSubsystems: [
      'PRIMARY_HYDRAULIC_NETWORK_AND_PUMPS',
      'DISTRIBUTION_PARALLEL_BRANCHES_AND_VALVES',
      'HX01_TO_HX05_WATER_TO_WATER_NTU_HEAT_TRANSFER',
      'BT01_FOUR_PIPE_BUFFER_MIXING_AND_ENERGY_BALANCE',
      'RTXC_OPERATING_MAP_AND_PERFORMANCE',
      'SECONDARY_ROOF_HYDRAULICS_AND_EXPANSION_TANKS'
    ]
  };
}
