/**
 * Section 11 — Mandatory Scenarios & Event-Reaction Protection Matrix
 * Each scenario configures a deterministic setup on the simulation instance
 * and includes full Event -> Detection -> Compressor -> Pumps -> Valves -> Alarm -> Recovery metadata.
 */

import { PUMP_STATES, SHUTDOWN_MODES } from '../control/automation.mjs';
import { computeTotalSecondaryStoredEnergyJ, computeTotalStoredThermalEnergyJ } from '../physics/plant_engine.mjs';
import { THERMAL_REF_CONSTANTS } from '../physics/thermal.mjs';

export const EVENT_REACTION_MATRIX = Object.freeze([
  {
    id: 'SCEN_01_NORMAL',
    nameHe: '1. עבודה תקינה ומאוזנת',
    nameRu: '1. Нормальная работа',
    eventRu: 'Штатный режим при T_нар = +12 °C, работа всех 5 теплообменных модулей HX01–HX05',
    detectionRu: 'Все датчики достоверны, проток FS-HP01 подтверждён (>15.3 л/с), уставки выдерживаются',
    compressorActionRu: 'Модуляция инверторных винтовых компрессоров (~89% загрузки) по уставке 50 °C',
    pumpsActionRu: 'Рабочие насосы PP01A, PD01A, PS01A–PS05A в работе; все резервные B в статусе «Готов в резерве»',
    valvesActionRu: 'ПИ-регуляторы CV01–CV05 поддерживают вторичную подачу 45.0 °C к צרכן 1–5',
    alarmRu: 'Нет аварий (спокойная индикация)',
    recoveryRu: 'Не требуется',
    apply(sim) {
      resetToCleanNormal(sim);
    }
  },
  {
    id: 'SCEN_02_BRANCH_LOAD_CHANGE',
    nameHe: '2. שינוי עומס בענף בודד (צרכן 1 +45%)',
    nameRu: '2. Изменение нагрузки одной ветки (צרכן 1 +45%)',
    eventRu: 'Увеличение теплопотребления צרכן 1 на +45% (до ~160 кВт)',
    detectionRu: 'Снижение температуры вторичной подачи TT-SEC01-SUP ниже уставки 45.0 °C',
    compressorActionRu: 'Увеличение загрузки HP01 по мере снижения температуры обратки из буфера BT01',
    pumpsActionRu: 'ЧРП распределительного насоса PD01A увеличивает частоту для удержания Δp_dist = 110 кПа',
    valvesActionRu: 'Клапан CV01 открывается шире; клапаны CV02–CV05 слегка прикрываются для сохранения баланса',
    alarmRu: 'Штатное регулирование без аварий',
    recoveryRu: 'Автоматическая стабилизация новым положением CV01 и ЧРП PD01A',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.faults.branch1LoadMultiplier = 1.45;
      sim.state.branches[0].secReturnTempC = 37.8;
      sim.state.branches[0].secSupplyTempC = 43.4;
      sim.state.branches[0].hxState.tColdOutC = 43.4;
      reanchorStoredEnergy(sim);
    }
  },
  {
    id: 'SCEN_03_ONE_BRANCH_CLOSED',
    nameHe: '3. סגירת ענף אחד (ענף 3 מופסק)',
    nameRu: '3. Закрытие одной ветки (ветка 3 отключена)',
    eventRu: 'Технологическое отключение модуля 3 (צרכן 3): закрытие CV03 и останов PS03A',
    detectionRu: 'FT-P03 = 0 л/с, рост перепада в коллекторе Δp_dist при закрытии CV03',
    compressorActionRu: 'Снижение тепловой нагрузки агрегата HP01 сообразно 4 работающим веткам (~440 кВт)',
    pumpsActionRu: 'Останов PS03A; ЧРП PD01A снижает обороты; остальные 4 вторичных контура продолжают работу!',
    valvesActionRu: 'CV03 = 0% (закрыт); перераспределение расходов через ветки 1, 2, 4, 5',
    alarmRu: 'Информационный статус: ветка 3 отключена (остальные ветки НЕ отключаются)',
    recoveryRu: 'Повторное включение ветки 3 оператором',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.state.branches[2].enabled = false;
      sim.state.branches[2].cvCommandPos = 0.0;
      sim.state.branches[2].cvActualPos = 0.0;
    }
  },
  {
    id: 'SCEN_04_ALL_BRANCHES_CLOSED',
    nameHe: '4. סגירת כל חמשת הענפים (עצירה לפי חוסר דרישה)',
    nameRu: '4. Закрытие всех веток (заряд буфера и останов по отсутствию потребности)',
    eventRu: 'Все пять потребителей צרכן 1–5 прекратили отбор тепла (CV01–CV05 закрыты)',
    detectionRu: 'Нулевой расход распределения FT-DIST = 0, прогрев буфера BT01 до 50.8 °C по всей высоте',
    compressorActionRu: 'Плавная разгрузка и переход Symbio 800 в режим ожидания (Шаг 10: Останов по отсутствию потребности)',
    pumpsActionRu: 'Останов распределительного насоса PD01A и вторичных PS01–05; дежурная циркуляция PP01A',
    valvesActionRu: 'Все регулирующие клапаны CV01–CV05 закрыты (0%)',
    alarmRu: 'Нет аварий — штатный режим ожидания по заряженному буферу BT01',
    recoveryRu: 'Автоматический пуск при появлении запроса хотя бы от одной ветки и остывании BT01',
    apply(sim) {
      resetToCleanNormal(sim);
      for (const b of sim.state.branches) {
        b.enabled = false;
        b.cvCommandPos = 0.0;
        b.cvActualPos = 0.0;
      }
      sim.state.bt01.topTempC = 50.9;
      sim.state.bt01.bottomTempC = 50.2;
      sim.state.bt01.distSupplyTempC = 50.9;
      sim.state.bt01.hpReturnTempC = 50.2;
      reanchorStoredEnergy(sim);
    }
  },
  {
    id: 'SCEN_05_DUTY_PUMP_FAILOVER',
    nameHe: '5. תקלה במשאבת עבודה PP01A ומעבר אוטומטי לגיבוי PP01B',
    nameRu: '5. Отказ рабочего насоса PP01A — переход на готовый резерв PP01B',
    eventRu: 'Аварийное отключение привода рабочего насоса PP01A',
    detectionRu: 'Потеря сигнала подтверждения работы привода PP01A и падение перепада Δp_PP01',
    compressorActionRu: 'Продолжает работу после подтверждения восстановления расхода FT-HP01 ≥ 15.3 л/с за < 6 с',
    pumpsActionRu: 'Автоматический пуск готового резервного насоса PP01B (контактор 1K28 / CP01) с проверкой расхода',
    valvesActionRu: 'Обратный клапан PP01A закрывается (исключён обратный проток через неисправный насос)',
    alarmRu: 'Предупреждение: Отказ PP01A, активен резервный насос PP01B',
    recoveryRu: 'Ремонт PP01A (возможен демонтаж по разъёмным фланцам без остановки PP01B) и сброс неисправности',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.state.pumps.PP01A.modeState = PUMP_STATES.FAULT;
      sim.state.pumps.PP01A.running = false;
      sim.state.pumps.PP01B.modeState = PUMP_STATES.READY_STANDBY;
    }
  },
  {
    id: 'SCEN_06_STANDBY_UNAVAILABLE',
    nameHe: '6. גיבוי לא זמין (משאבת גיבוי בתחזוקה / תקלה כפולה)',
    nameRu: '6. Резерв недоступен (вывод резерва на обслуживание + отказ рабочего насоса ветки 2)',
    eventRu: 'Резервный насос PP01B выведен на обслуживание (MAINTENANCE_OUT, рабочий PP01A продолжает работать!); а в группе PS02 оба насоса PS02A (FAULT) и PS02B (MAINTENANCE_OUT) недоступны',
    detectionRu: 'Контроль статусов готовности резерва в шкафу CP01 и отсутствие протока FT-S02',
    compressorActionRu: 'Продолжает работу для остальных 4 исправных веток (PP01A исправен, но без резерва)',
    pumpsActionRu: 'PP01A продолжает работу с индикацией «Нет резерва»; группа PS02A/B полностью остановлена',
    valvesActionRu: 'Клапан CV02 закрывается по прекращению циркуляции вторичного контура 2',
    alarmRu: 'Предупреждение по PP01B (нет резерва) + Авария PS02A/B (прекращение функции ветки 2)',
    recoveryRu: 'Возврат резервных насосов из режима обслуживания и устранение неисправности PS02A',
    apply(sim) {
      resetToCleanNormal(sim);
      // Case A: PP01B in maintenance while PP01A stays running healthy (Section 10.3 check!)
      sim.state.pumps.PP01B.modeState = PUMP_STATES.MAINTENANCE_OUT;
      // Case B: PS02A faults while PS02B is in maintenance -> complete loss of branch 2 circulation
      sim.state.pumps.PS02A.modeState = PUMP_STATES.FAULT;
      sim.state.pumps.PS02B.modeState = PUMP_STATES.MAINTENANCE_OUT;
    }
  },
  {
    id: 'SCEN_07_HP_LOSS_OF_FLOW',
    nameHe: '7. איבוד זרימה דרך משאבת החום RTXC (חסימת חימום)',
    nameRu: '7. Потеря протока через RTXC (запрет нагрева по реле протока FS-HP01)',
    eventRu: 'Прекращение циркуляции через испаритель/конденсатор HP01 (перекрытие трассы или отказ обоих насосов PP01A/B)',
    detectionRu: 'Размыкание реле протока FS-HP01 и падение расхода FT-HP01 < 15.3 л/с дольше 6 секунд (стр. 32)',
    compressorActionRu: 'Немедленный защитный останов компрессоров Symbio 800 с защёлкивающейся блокировкой (Latching Diagnostic)',
    pumpsActionRu: 'Фиксация аварии протока первичного контура',
    valvesActionRu: 'Переход CV01–CV05 в режим удержания / закрытия по мере остывания буфера',
    alarmRu: 'Критическая авария: Потеря протока через RTXC (Loss of Evaporator Water Flow, стр. 32)',
    recoveryRu: 'Восстановление циркуляции ≥ 15.3 л/с и ручной сброс защиты на панели TD7 / CP01',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.faults.hp01ValveClosed = true;
      sim.state.flowLossTimerS = 6.5;
    }
  },
  {
    id: 'SCEN_08_HX_FOULING',
    nameHe: '8. סתימה והתאבנות במחליף חום HX02 / מסנן',
    nameRu: '8. Засор фильтра / теплообменника HX02',
    eventRu: 'Отложение накипи / шлама в каналах HX02 (рост термического сопротивления R_f и гидравлического сопротивления)',
    detectionRu: 'Увеличение перепада давления Δp_HX02, падение расхода ветки 2 и снижение эффективности ε',
    compressorActionRu: 'Работает в штатном режиме',
    pumpsActionRu: 'Рост напора PD01A и PS02A при сниженном расходе через засорённый HX02',
    valvesActionRu: 'ПИ-регулятор открывает клапан CV02 до 100%, пытаясь компенсировать падение UA',
    alarmRu: 'Предупреждение: Повышенное гидравлическое и термическое сопротивление HX02 (требуется промывка CIP)',
    recoveryRu: 'Отсечение HX02 кранами и безразборная химическая промывка (CIP) обеих сторон',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.faults.hx02Fouled = true;
    }
  },
  {
    id: 'SCEN_09_SECONDARY_LEAK',
    nameHe: '9. דליפת מים במעגל משני 4 ותגובת מערכת המילוי MU01',
    nameRu: '9. Утечка вторичного контура 4 (потеря массы, падение давления и работа подпитки)',
    eventRu: 'Разгерметизация трубопровода вторичного контура 4 (утечка 0.35 кг/с)',
    detectionRu: 'Падение давления PT-PS04-S, включение линии подпитки SV-MU04 и рост счётчика FQ-MU04 до лимита 45 л',
    compressorActionRu: 'Продолжает работу для остальных контуров',
    pumpsActionRu: 'При падении давления ниже кавитационного порога и блокировке подпитки — риск кавитации PS04A',
    valvesActionRu: 'Клапан подпитки SV-MU04 пытается удержать давление, затем блокируется по превышению разового объёма 45 л',
    alarmRu: 'Критическая авария MU01: Превышен лимит подпитки контура 4 (подозрение на утечку!) + Низкое давление контура 4',
    recoveryRu: 'Локализация и устранение утечки в контуре 4, заполнение, развоздушивание и сброс блокировки MU01',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.faults.secLoop4LeakKgS = 0.35;
      sim.state.branches[3].secNetMassChangeKg = -16.0;
    }
  },
  {
    id: 'SCEN_10_MAKEUP_FAIL_OPEN',
    nameHe: '10. כשל ברז מילוי במצב פתוח (פתיחת שסתום פורק לחץ PSV01)',
    nameRu: '10. Отказ клапана подпитки открытым (независимая защита от превышения давления PSV01)',
    eventRu: 'Механическое заклинивание клапана подпитки SV-MU01 и редуктора в открытом положении (насос подпитки развивает до 3.5 бар)',
    detectionRu: 'Рост давления во вторичном контуре 1 выше допустимого диапазона и непрерывный расход по FQ-MU01',
    compressorActionRu: 'Штатная работа',
    pumpsActionRu: 'Блокировка насоса подпитки PMU01 и отключение PS01 автоматикой CP01; механическое открытие предохранительного клапана PSV01',
    valvesActionRu: 'Пружинный предохранительный клапан PSV01 открывается при 1.15 бар изб. на кровле (полный подъём до 1.265 бар изб.), удерживая давление у потребителя ≤ 2.0 бар изб.',
    alarmRu: 'Критическая авария: Отказ подпитки контура 1 открытым — срабатывание защиты PSV01!',
    recoveryRu: 'Перекрытие сервисного крана подпитки, ревизия SV-MU01/редуктора и проверка посадки PSV01',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.faults.muSec1FailOpen = true;
      sim.state.branches[0].secNetMassChangeKg = 24.5;
    }
  },
  {
    id: 'SCEN_11_EXPANSION_TANK_ISOLATED',
    nameHe: '11. מיכל התפשטות ET05 מנותק בזמן חימום (עליית לחץ חדה)',
    nameRu: '11. Отключённый расширительный бак ET05 (рост давления при нагреве)',
    eventRu: 'Ошибочно закрыт сервисный кран мембранного бака ET05 при нагреве воды вторичного контура 5',
    detectionRu: 'Быстрый рост давления PT-SEC05-SUP при температурном расширении воды ΔV без газового демпфера',
    compressorActionRu: 'Штатная работа',
    pumpsActionRu: 'При приближении к пределу 2.0 бар изб. автоматика CP01 защищает контур 5, а на кровле открывается PSV05',
    valvesActionRu: 'При достижении уставки 1.15 бар изб. открывается предохранительный клапан PSV05, сбрасывая объём теплового расширения',
    alarmRu: 'Критическая авария: Превышение давления контура 5 и срабатывание PSV05 (проверить подключение бака ET05!)',
    recoveryRu: 'Открытие и пломбировка сервисного крана (Kappenventil) бака ET05, контроль предзаряда азота',
    apply(sim) {
      resetToCleanNormal(sim);
      // Capture isolation snapshot at the normal operating temperature (42.6 °C) when the ET05 valve was closed,
      // then apply the subsequent heating of branch 5 (+0.6 K mean temperature rise while isolated):
      sim.state.branches[4].etIsolationSnapshot = {
        tempC: 0.5 * (sim.state.branches[4].secSupplyTempC + sim.state.branches[4].secReturnTempC),
        netMassChangeKg: 0.0
      };
      sim.faults.et05Isolated = true;
      sim.state.branches[4].secSupplyTempC = 45.4;
      sim.state.branches[4].secReturnTempC = 41.0;
      sim.state.branches[4].hxState.tColdOutC = 45.4;
      reanchorStoredEnergy(sim);
    }
  },
  {
    id: 'SCEN_12_SENSOR_COMM_LOSS',
    nameHe: '12. אובדן קשר עם רגש טמפרטורה TT-SEC03-SUP (מצב ״לא ידוע״)',
    nameRu: '12. Потеря связи с датчиком TT-SEC03-SUP («Неизвестно», запрет старого значения)',
    eventRu: 'Обрыв линии связи датчика температуры вторичной подачи ветки 3 (TT-SEC03-SUP)',
    detectionRu: 'Контроллер CP01 фиксирует выход тока за диапазон 4–20 мА -> статус измерения «UNKNOWN / Неизвестно»',
    compressorActionRu: 'Штатная работа по достоверным датчикам HP01',
    pumpsActionRu: 'Насос PS03A остаётся в работе для сохранения циркуляции',
    valvesActionRu: 'ПИ-регулятор CV03 блокируется (старое значение НЕ используется как текущее!) и переводится в безопасное фиксированное положение 35%',
    alarmRu: 'Авария датчика TT-SEC03-SUP: Значение неизвестно, авторегулирование ветки 3 переведено в безопасный режим',
    recoveryRu: 'Замена/восстановление цепи датчика TT-SEC03-SUP, проверка достоверности показаний',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.faults.sensorFaultBranch3 = true;
    }
  },
  {
    id: 'SCEN_13_DEFROST',
    nameHe: '13. מצב הפשרה (Defrost) — היפוך מחזור ושאיבת אנרגיה מהמים',
    nameRu: '13. Оттайка (Defrost) — реверс холодильного цикла и отбор тепла из водяного контура',
    eventRu: 'Обмерзание воздушного теплообменника HP01 при T_нар = +1.5 °C и влажности 88%; запуск цикла оттайки',
    detectionRu: 'Снижение температуры кипения R513A и перепада воздуха; переключение 4-ходового клапана Symbio 800 в режим оттайки',
    compressorActionRu: 'Компрессоры работают в реверсивном цикле оттайки; вентиляторы отключены (стр. 49); тепловой поток в воду меняет знак (Q_water = -185 кВт)!',
    pumpsActionRu: 'Обязательная работа PP01A и PD01A: энергия для оттайки берётся из запаса буфера BT01',
    valvesActionRu: 'Клапаны CV01–CV05 открываются шире по мере плавного снижения температуры подачи из BT01',
    alarmRu: 'Статус режима: Активна оттайка HP01 (тепловой поток из воды в контур оттайки -185 кВт)',
    recoveryRu: 'Завершение оттайки через ресивер (табл. 6 стр. 49) и плавный возврат в режим нагрева',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.dataset.ambient.temperatureC.value = 1.5;
      sim.dataset.ambient.relativeHumidityPct.value = 88.0;
      sim.state.inDefrost = true;
      sim.faults.forceDefrost = true;
    }
  },
  {
    id: 'SCEN_14_AMBIENT_OUT_OF_MAP',
    nameHe: '14. טמפרטורת חוץ מחוץ למעטפת עבודה בקיץ (+35°C — חימום חסום)',
    nameRu: '14. Наружная температура вне рабочей карты (+35 °C летом — ограничение без экстраполяции)',
    eventRu: 'Жаркий летний день в Израиле: температура наружного воздуха на крыше +35.0 °C (превышает и предел +21 °C стр. 48, и предел +30 °C стр. 50)',
    detectionRu: 'Контроль рабочей области по датчику наружного воздуха TT-AMB > 30 °C',
    compressorActionRu: 'Запрет работы на нагрев (Q_HP = 0 кВт)! Произвольная экстраполяция за пределы карты запрещена (п. 3.1 ТЗ)',
    pumpsActionRu: 'Циркуляция через буфер до исчерпания запасённого тепла',
    valvesActionRu: 'Открываются до 100% по мере остывания буфера BT01',
    alarmRu: 'Критическое ограничение рабочей области: Наружная температура +35.0 °C вне карты нагрева RTXC (стр. 48/50)',
    recoveryRu: 'Требуется инженерное решение с Trane по летнему режиму в Израиле (см. список вопросов к Trane)',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.dataset.ambient.temperatureC.value = 35.0;
    }
  },
  {
    id: 'SCEN_15_WINTER_POWER_LOSS',
    nameHe: '15. הפסקת חשמל מלאה בחורף (-3°C — אובדן הגנה מפני קפיאה)',
    nameRu: '15. Пропадание питания зимой (-3 °C — потеря активной защиты и риск замерзания)',
    eventRu: 'Полное исчезновение электропитания 400 В и 230 В при отрицательной наружной температуре -3.0 °C',
    detectionRu: 'Потеря питания шкафа CP01, контроллера Symbio 800, всех насосов и электронагревателей 230 В (стр. 33, 40, 57)',
    compressorActionRu: 'Обесточены и остановлены',
    pumpsActionRu: 'Все насосы обесточены и остановлены (активная антифризная циркуляция Symbio 800 невозможна без резервного питания, стр. 33)',
    valvesActionRu: 'Обесточены; остывание неподвижной воды в наружных трубопроводах и кожухе испарителя',
    alarmRu: 'КРИТИЧЕСКАЯ АВАРИЯ: Потеря питания зимой при -3.0 °C — угроза размораживания испарителя и наружных труб (стр. 33, 57)!',
    recoveryRu: 'Подача резервного питания ДГУ/ИБП на насосы и обогрев 230 В либо полное дренирование и продувка азотом (стр. 30, 58)',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.dataset.ambient.temperatureC.value = -3.0;
      sim.state.shutdownMode = SHUTDOWN_MODES.TOTAL_POWER_LOSS;
      sim.faults.powerOutageWinter = true;
    }
  },
  {
    id: 'SCEN_16_HX_INTERNAL_LEAK',
    nameHe: '16. דליפה פנימית במחליף חום HX01 (מעבר לחץ וערבוב מדיה)',
    nameRu: '16. Внутренняя течь теплообменника HX01 (передача давления и смешение сред)',
    eventRu: 'Сквозное повреждение пластины/трубки внутри теплообменника HX01 между первичным и вторичным контурами',
    detectionRu: 'Переток воды из более высоконапорного первичного контура (~2.9 бар) во вторичный контур 1, рост давления PT-SEC01-SUP и срабатывание PSV01',
    compressorActionRu: 'Продолжает работу до падения давления первичного контура',
    pumpsActionRu: 'Узел подпитки MU01 подпитывает первичный контур, а во вторичном контуре 1 открывается предохранительный клапан PSV01',
    valvesActionRu: 'Открытие PSV01 на вторичном контуре 1 для защиты рубашки צרכן 1 от первичного давления',
    alarmRu: 'Критическая авария HX01: Внутренняя негерметичность теплообменника — передача давления и смешение контуров!',
    recoveryRu: 'Немедленное отсечение HX01 запорными кранами с обеих сторон, опрессовка и замена пакета пластин',
    apply(sim) {
      resetToCleanNormal(sim);
      sim.faults.hx01InternalLeak = true;
      sim.state.branches[0].secNetMassChangeKg = 24.5;
    }
  }
]);

export function reanchorStoredEnergy(sim) {
  const cpRef = THERMAL_REF_CONSTANTS.cpWaterJKgK;
  const rhoPri = THERMAL_REF_CONSTANTS.rhoPrimaryKgM3;
  const rhoSec = THERMAL_REF_CONSTANTS.rhoSecondaryKgM3;
  const cpMetal = THERMAL_REF_CONSTANTS.cpMetalJKgK;

  sim.state.hp01.uWaterShellJ = 320.0 * cpRef * sim.state.hp01.leavingWaterTempC;
  const cZoneBtJK = 0.5 * 4.0 * rhoPri * cpRef;
  sim.state.bt01.uTotalJ = cZoneBtJK * (sim.state.bt01.topTempC + sim.state.bt01.bottomTempC);

  for (let i = 0; i < 5; i++) {
    const b = sim.state.branches[i];
    const bData = sim.dataset.branches[i];
    const vSide = Math.max(0.005, bData.hxWaterVolumePerSideM3.value);
    const cHot = vSide * rhoPri * cpRef;
    const cCold = vSide * rhoSec * cpRef;
    const cMet = Math.max(10.0, bData.hxMetalMassKg.value) * cpMetal;
    b.hxState.uTotalJ = cHot * b.hxState.tHotOutC + cCold * b.hxState.tColdOutC + cMet * b.hxState.tMetalC;
    const cSecLoopJK = Math.max(50000.0, bData.secondaryWaterVolumeM3.value * rhoSec * cpRef);
    b.uSecLoopJ = cSecLoopJK * b.secReturnTempC;
  }

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
}

export function resetToCleanNormal(sim) {
  sim.faults = {};
  sim.dataset.ambient.temperatureC.value = 12.0;
  sim.dataset.ambient.relativeHumidityPct.value = 75.0;
  sim.dataset.ambient.strictPage48AmbientLimit.value = false;
  sim.state.plantStartCommand = true;
  sim.state.shutdownMode = SHUTDOWN_MODES.NONE;
  sim.state.inDefrost = false;
  sim.state.flowLossTimerS = 0.0;
  sim.state.unloadTimerS = 0.0;
  sim.state.alarms = [];
  sim.state.primaryLoop.netMassChangeKg = 0.0;
  sim.state.primaryLoop.etIsolationSnapshot = null;
  sim.state.primaryLoop.psvOpen = false;
  sim.state.primaryLoop.psvReliefFlowKgS = 0.0;

  sim.state.pumps.PP01A.modeState = PUMP_STATES.RUNNING;
  sim.state.pumps.PP01B.modeState = PUMP_STATES.READY_STANDBY;
  sim.state.pumps.PD01A.modeState = PUMP_STATES.RUNNING;
  sim.state.pumps.PD01B.modeState = PUMP_STATES.READY_STANDBY;

  for (let i = 1; i <= 5; i++) {
    const idx = `0${i}`;
    sim.state.pumps[`PS${idx}A`].modeState = PUMP_STATES.RUNNING;
    sim.state.pumps[`PS${idx}B`].modeState = PUMP_STATES.READY_STANDBY;
    const b = sim.state.branches[i - 1];
    b.enabled = true;
    b.cvCommandPos = 0.68;
    b.cvActualPos = 0.68;
    b.secSupplyTempC = 45.0;
    b.secReturnTempC = 40.2;
    b.hxState.tHotInC = 49.8;
    b.hxState.tHotOutC = 40.4;
    b.hxState.tColdInC = 40.2;
    b.hxState.tColdOutC = 45.0;
    b.hxState.tMetalC = 43.8;
    b.secNetMassChangeKg = 0.0;
    b.etIsolationSnapshot = null;
    b.makeupCumulativeVolumeL = 0.0;
    b.makeupActiveTimerS = 0.0;
    b.makeupLockedOut = false;
    b.psvOpen = false;
    b.psvReliefFlowKgS = 0.0;
    b.overpressurePumpTripped = false;
    b.maxRoofGaugePa = 0.0;
    b.maxConsumerSupplyGaugeBottomPa = null;
    b.maxLoopGaugePa = 0.0;
    b.sensorValid = true;
  }

  sim.state.hp01.leavingWaterTempC = 50.0;
  sim.state.hp01.enteringWaterTempC = 40.4;
  sim.state.bt01.topTempC = 49.9;
  sim.state.bt01.bottomTempC = 40.4;
  sim.state.bt01.distSupplyTempC = 49.9;
  sim.state.bt01.hpReturnTempC = 40.4;
  reanchorStoredEnergy(sim);
}

export function applyScenarioById(sim, scenarioId) {
  const scen = EVENT_REACTION_MATRIX.find((s) => s.id === scenarioId);
  if (!scen) {
    throw new Error(`Unknown scenario ID: ${scenarioId}`);
  }
  sim.state.activeScenarioId = scenarioId;
  scen.apply(sim);
  // Advance 2.0 seconds so immediate reactions & alarms populate cleanly
  for (let k = 0; k < 8; k++) {
    // 8 * 0.25s = 2.0s
    sim.stepFn ? sim.stepFn(0.25) : null;
  }
  return scen;
}

export const SCENARIOS = Object.fromEntries(
  EVENT_REACTION_MATRIX.map((sc) => [
    sc.id,
    {
      ...sc,
      descriptionHe: sc.nameHe,
      expectedBehaviorRu: `${sc.eventRu} -> ${sc.alarmRu}`
    }
  ])
);

export function applyScenario(sim, scenarioId) {
  return applyScenarioById(sim, scenarioId);
}

