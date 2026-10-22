/**
 * PACKAGE C: single Hebrew (RTL) inspector card for the integrated HP01 cutaway.
 * Everything live comes from buildHP01CutawayViewModel(currentSim, unitPrefs) — never from fixtures.
 * Purposes come from the accepted R4 editorial dictionary (EDITORIAL_EXPLANATION, with sources).
 * LRA is shown as two conflicting source records (REQUIRES_CLARIFICATION), read live from the source modules.
 */

import { HP01_SUBNODES, HP01_AUX_VALVES, HP01_INTERNAL_CONNECTIONS, HP01_CAMERA_PRESETS, HP01_NODE_PIPES } from '../viz3d/hp01_cutaway_meta.mjs';
import { HP01_ANIMATION_TEXT_HE, resolveConnectionPresentation } from '../viz3d/hp01_process_animation.mjs';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// LTR values (numbers + units, codes) isolated inside RTL text
const ltr = (v) => `<bdi dir="ltr">${esc(v)}</bdi>`;

export const PURPOSE_MISSING_HE = 'ייעוד הרכיב חסר במילון (MISSING)';
export const EDITORIAL_STATUS_HE = 'הסבר עורך המוקאפ (EDITORIAL_EXPLANATION)';


const NODE_GROUPS = {
  water: ['WHEX', 'FS-HP01', 'DRAIN-SYS'],
  compressor: ['COMP1', 'COMP2', 'OS1', 'OS2', 'OIL-CKT1', 'OIL-CKT2'],
  refrigerant: ['ECON1', 'ECON2', 'REC1', 'REC2', 'EXV-C1', 'EXV-C2', 'EXV-H1', 'EXV-H2', '4WV1', '4WV2'],
  air: ['ACOIL1', 'ACOIL2', 'FAN-GRP1', 'FAN-GRP2'],
  control: ['CTRL-SYMBIO'],
  structure: ['FRAME-BASE']
};
const groupOf = (id) => Object.keys(NODE_GROUPS).find((g) => NODE_GROUPS[g].includes(id)) || 'overview';

export function isUnknownMode(vm) {
  return vm.modeKey === 'SITE_MISSING' || vm.modeKey === 'UNKNOWN_OR_MISSING';
}

/** Two conflicting LRA records read live (passport vs cutaway metadata); no unified value is chosen */
export function buildLiveLraConflict(passport) {
  const pass = passport?.compressorLRAEach;
  const metaVals = ['COMP1', 'COMP2']
    .flatMap((id) => [HP01_SUBNODES[id].sourceRef, HP01_SUBNODES[id].confirmedDocNoteHe])
    .map((t) => (String(t).match(/LRA\s*=\s*(\d+(?:\.\d+)?)\s*A/) || [])[1])
    .filter((x) => x !== undefined)
    .map(Number);
  const metaUnique = [...new Set(metaVals)];
  const sources = [
    { valueA: Number.isFinite(pass?.value) ? pass.value : null, path: 'src/equipment/rtxc_prototype.mjs', field: 'RTXC_PROTOTYPE_PASSPORT.compressorLRAEach', recordedStatus: pass?.status ?? null, docRef: pass?.pageRef ?? null },
    { valueA: metaUnique.length === 1 ? metaUnique[0] : null, path: 'src/viz3d/hp01_cutaway_meta.mjs', field: 'HP01_SUBNODES.COMP1/COMP2.sourceRef', recordedStatus: HP01_SUBNODES.COMP1.provenance, docRef: 'Sec. 6.2 p. 38' }
  ];
  const distinct = [...new Set(sources.map((s) => s.valueA))];
  const conflict = distinct.length !== 1 || distinct.includes(null);
  return {
    status: conflict ? 'REQUIRES_CLARIFICATION' : 'CONSISTENT_BETWEEN_SOURCES',
    unifiedValueA: null,
    sources,
    warningHe:
      'זרם רוטור נעול (LRA) למדחס: שני מקורות סותרים — ' +
      sources.map((s) => `${s.valueA} A (${s.path.split('/').pop()})`).join(' מול ') +
      '. דורש הבהרה (REQUIRES_CLARIFICATION); לא נבחר ערך יחיד. זהו נתון התנעה מתיעוד, לא זרם נמדד.'
  };
}

// label: plain text (escaped) or { html } when part of it must be bidi-isolated (e.g. a unit inside RTL text)
function row(label, valueHtml, attrs = '') {
  return `<tr${attrs}><th>${typeof label === 'object' ? label.html : esc(label)}</th><td>${valueHtml}</td></tr>`;
}

function section(title, inner, id = '') {
  return `<div class="hp01c-section"${id ? ` data-section="${id}"` : ''}><div class="hp01c-section-title">${esc(title)}</div>${inner}</div>`;
}

function valueOrUnknown(field, unknownMode, unknownText = 'לא ידוע — נתוני אתר חסרים') {
  if (unknownMode) return `<span class="hp01c-unknown">${esc(unknownText)}</span>`;
  if (!field) return '<span class="hp01c-unknown">—</span>';
  return field.isValid === false ? `<span class="hp01c-unknown">${esc(field.displayTextHe)}</span>` : ltr(field.displayTextHe);
}

// The view model's qualification (badgeHe) of a valid value is shown next to it, e.g. the DEFROST external water balance
function valueWithQualifier(field, unknownMode, key) {
  const html = valueOrUnknown(field, unknownMode);
  if (unknownMode || !field || field.isValid === false || !field.badgeHe) return html;
  return `${html}<div class="hp01c-note" data-hp01-qualifier="${esc(key)}">${esc(field.badgeHe)}</div>`;
}

/**
 * @param {object} p
 *   vm               — live view model from buildHP01CutawayViewModel(currentSim, unitPrefs)
 *   state            — controller state { selectedSubNodeId, cameraPreset, circuitFilter, casingMode }
 *   purposeDict      — runtime copy of the R4 purpose dictionary
 *   passport         — RTXC_PROTOTYPE_PASSPORT (read-only)
 *   hp01Registry     — COMPONENT_REGISTRY.HP01 (overview purpose)
 */
export function renderHP01CutawayCardHtml({ vm, state, purposeDict, passport, hp01Registry, animStatus = null }) {
  const id = state.selectedSubNodeId;
  const meta = id ? HP01_SUBNODES[id] : null;
  const unknownMode = isUnknownMode(vm);
  const preset = HP01_CAMERA_PRESETS[state.cameraPreset];
  const group = id ? groupOf(id) : 'overview';

  // ---- header
  const header = `
    <div class="hp01c-header">
      <div class="hp01c-header-main">
        <span class="inspector-id-badge" data-hp01-card-id="${esc(id || 'HP01')}">${esc(id || 'HP01')}</span>
        <h3 class="inspector-title-he" data-hp01-card-title="1">${esc(meta ? meta.shortNameHe : 'HP01 — סקירת יחידה בחתך')}</h3>
        <div class="hp01c-subtitle">${meta ? esc(meta.titleHe) : 'Trane RTXC 180 XE-HSE — 25 צמתים, 48 חיבורים'}</div>
        <div class="hp01c-subtitle">מעגל: ${ltr(meta ? meta.circuit : 'CKT1 + CKT2')} | מצלמה: ${esc(preset ? preset.labelHe : state.cameraPreset)}</div>
      </div>
      <div class="hp01c-header-actions">
        ${id ? '<button class="btn-card-action" data-hp01-action="overview">↩ סקירת HP01</button>' : ''}
        <button class="btn-card-action" data-hp01-action="roof">🏢 חזרה לגג</button>
      </div>
    </div>`;

  // ---- purpose
  let purposeHtml;
  if (meta) {
    const e = purposeDict?.entries?.[id];
    const text = e && typeof e.purposeHe === 'string' && e.purposeHe.trim() ? e.purposeHe : PURPOSE_MISSING_HE;
    const sources = e && Array.isArray(e.sources) ? e.sources.map((s) => s.id) : [];
    const editorial = purposeDict?.status === 'EDITORIAL_EXPLANATION' && e;
    purposeHtml = section('מה הרכיב עושה', `
      <p class="hp01c-purpose" data-purpose="1">${esc(text)}</p>
      <div class="hp01c-meta"><span class="prov-tag-c assumed" data-purpose-status="1">${editorial ? EDITORIAL_STATUS_HE : 'MISSING'}</span>
      מקורות: <span data-purpose-sources="1">${sources.length ? sources.map((x) => `<code>${esc(x)}</code>`).join(', ') : 'חסרים (MISSING)'}</span></div>`, 'purpose');
  } else {
    purposeHtml = section('מה היחידה עושה', `<p class="hp01c-purpose" data-purpose="overview">${esc(hp01Registry?.purposeHe || '')}</p>
      <div class="hp01c-meta">מקור: <code>src/topology/registry.mjs → COMPONENT_REGISTRY.HP01.purposeHe</code>. בחרו רכיב ברשימה או בלחיצה על המודל.</div>`, 'purpose');
  }

  // ---- mode & validity
  const modeWarnings = [];
  if (unknownMode) modeWarnings.push('<div class="hp01c-warn" data-hp01-warning="site-missing">נתוני אתר חסרים — ערכים התלויים בהם מוצגים כ"לא ידוע". אין בכך קביעה שהציוד עצר או שהמים זורמים.</div>');
  if (!unknownMode && vm.refCycle.isValid === false) {
    modeWarnings.push(`<div class="hp01c-warn" data-hp01-warning="invalid-cycle">⚠ נתוני מחזור הקרר אינם תקפים להצגה במצב ${ltr(vm.modeKey)}: 13 מדדי המחזור ו-COP מוסתרים. ${esc(vm.refCycle.invalidReasonHe || '')} נתוני המים התקפים מוצגים בנפרד.</div>`);
  }
  const modeHtml = section('מצב פעולה ותקפות נתונים', `
    <table class="hp01c-table">
      ${row('מצב (modeKey)', `${ltr(vm.modeKey)} — ${esc(vm.modeBannerHe)}`)}
      ${row('זמן מודל', ltr(`${Number(vm.meta.simTimeSeconds ?? 0).toFixed(2)} s`), ' data-hp01-simtime="1"')}
      ${row('מצב נתונים', ltr(vm.meta.datasetMode || '—'))}
      ${animStatus ? row('תנועה בחתך', `<span data-hp01-anim-status="${esc(animStatus.pause)}" data-rotors="${esc(animStatus.rotors)}" data-fans="${esc(animStatus.fans)}" data-water="${esc(animStatus.water)}" data-refrigerant="${esc(animStatus.refrigerant)}">${esc(animStatus.textHe)}</span>`, ' data-hp01-reading="animation"') : ''}
    </table>
    ${modeWarnings.join('')}
    ${vm.animation?.defrostQualitativeNoteHe ? `<div class="hp01c-warn" data-hp01-warning="defrost-qualitative">${esc(vm.animation.defrostQualitativeNoteHe)}</div>` : ''}
    <div class="hp01c-note" data-hp01-demo-note="1">${esc(HP01_ANIMATION_TEXT_HE.demoNote)}</div>`, 'mode');

  // ---- live readings (rows depend on the node group)
  const w = vm.water;
  const waterRows = [
    row('טמפ׳ מים כניסה / יציאה (W-01 / W-03)', unknownMode ? valueOrUnknown(null, true) : `${valueOrUnknown(w.tIn, false)} ← ${valueOrUnknown(w.tOut, false)}`, ' data-hp01-reading="water-temps"'),
    row('הפרש טמפרטורה ΔT', valueOrUnknown(w.deltaT, unknownMode)),
    row('ספיקת מים (FT-HP01)', valueOrUnknown(w.flow, unknownMode), ' data-hp01-reading="water-flow"'),
    row('מצב הידראולי', unknownMode ? valueOrUnknown(null, true) : `${ltr(w.loopSubState)} — ${esc(w.loopSubStateBannerHe || '')}`, ' data-hp01-reading="loop-substate"'),
    row('לחץ מים כניסה / יציאה / Δp', unknownMode ? valueOrUnknown(null, true) : `${valueOrUnknown(w.inletGaugePressure, false)} / ${valueOrUnknown(w.outletGaugePressure, false)} | Δp ${valueOrUnknown(w.deltaP, false)}`),
    row('מפסק זרימה FS-HP01 (מגע, לא מד ספיקה)', unknownMode ? valueOrUnknown(null, true) : `${ltr(w.flowSwitchClosed.status)} — ${esc(w.flowSwitchClosed.displayTextHe)}`, ' data-hp01-reading="fs-contact"')
  ];
  const unitRows = [
    row('הספק תרמי למים Q_water', valueWithQualifier(vm.unit.qWater, unknownMode, 'q-water'), ' data-hp01-reading="q-water"'),
    row('הספק חשמלי כולל', valueOrUnknown(vm.unit.pElTotal, unknownMode)),
    row('COP יחידה', valueOrUnknown(vm.unit.cop, unknownMode), ' data-hp01-reading="cop"')
  ];
  const compRows = [
    row('הספק מדחסים — סה״כ לשני המדחסים', valueOrUnknown(vm.unit.pElCompressorsAggregate, unknownMode), ' data-hp01-reading="comp-aggregate"'),
    row('נתון למדחס בודד', `<span class="hp01c-unknown">${esc(vm.unit.compIndividualTelemetry.displayTextHe)}</span>`)
  ];
  const kpis = vm.refCycle.kpis;
  const kpiRows = vm.refCycle.isValid && !unknownMode
    ? [
        row({ html: `לחץ קרר ${ltr(`(${kpis.pEvap.unit})`)}` }, `איוד: ${ltr(kpis.pEvap.displayTextHe)}<br>עיבוי: ${ltr(kpis.pCond.displayTextHe)}`, ' data-hp01-reading="ref-kpi"'),
        row('טמפ׳ קרר', `איוד: ${ltr(kpis.tEvap.displayTextHe)}<br>עיבוי: ${ltr(kpis.tCond.displayTextHe)}`),
        row('שחון וקירור-יתר', `שחון יניקה: ${ltr(kpis.suctionSuperheat.displayTextHe)}<br>קירור-יתר: ${ltr(kpis.subcooling.displayTextHe)}`),
        row('ספיקת מסה', `ראשית: ${ltr(kpis.massFlowMain.displayTextHe)}<br>אקונומייזר: ${ltr(kpis.massFlowEcon.displayTextHe)}`)
      ]
    : [row('13 מדדי מחזור הקרר', `<span class="hp01c-unknown" data-hp01-reading="ref-kpi-hidden">מוסתרים — ${unknownMode ? 'נתוני אתר חסרים' : 'המחזור אינו תקף במצב זה'}</span>`)];
  const econRow = row('מצב אקונומייזר', unknownMode ? valueOrUnknown(null, true) : `${ltr(vm.refCycle.economizerActive.status)}`, ' data-hp01-reading="econ"');
  const airRows = [
    row('הספק מאווררים — סה״כ', valueOrUnknown(vm.unit.pElFansAggregate, unknownMode)),
    row('מהירות מאוורר בודד', `<span class="hp01c-unknown">${esc(vm.unit.fanIndividualRpm.displayTextHe)}</span>`),
    row('חום שנקלט מהאוויר Q_air', valueOrUnknown(vm.unit.qAir, unknownMode))
  ];
  const heaterRow = row('גופי חימום נגד קיפאון 230V', `<span class="hp01c-unknown">${esc(vm.heaters230v.displayTextHe)}</span>`);

  let readingRows;
  if (group === 'overview') readingRows = [...waterRows, ...unitRows, ...compRows, ...kpiRows, econRow];
  else if (group === 'water') readingRows = [...waterRows, unitRows[0], heaterRow];
  else if (group === 'compressor') readingRows = [...compRows, ...kpiRows, unitRows[2]];
  else if (group === 'refrigerant') readingRows = [...kpiRows, econRow];
  else if (group === 'air') readingRows = [...airRows, ...kpiRows.slice(0, 1)];
  else if (group === 'control') readingRows = [row('הספק חשמלי כולל', valueOrUnknown(vm.unit.pElTotal, unknownMode)), heaterRow, waterRows[5]];
  else readingRows = [row('נתונים חיים', '<span class="hp01c-unknown">לשלדה אין טלמטריה במודל</span>')];
  const readingsHtml = section('ערכים נוכחיים מהמודל', `<table class="hp01c-table">${readingRows.join('')}</table>`, 'readings');

  // ---- aux valves of the node (documented modal states, no feedback telemetry)
  let auxHtml = '';
  if (meta) {
    const auxIds = Object.values(HP01_AUX_VALVES).filter((a) => a.parentSubNodeId === id).map((a) => a.id);
    if (auxIds.length) {
      auxHtml = section('אביזרים ושסתומים בצומת', `<table class="hp01c-table">${auxIds
        .map((aid) => {
          const st = vm.valves.statesByAuxId[aid];
          return row(HP01_AUX_VALVES[aid].shortNameHe, unknownMode ? valueOrUnknown(null, true) : `${ltr(st?.stateCode ?? '—')} — ${esc(st?.provenanceBadgeHe || '')}`);
        })
        .join('')}</table>`, 'aux');
    }
  }

  // ---- passport & provenance
  const passRows = [];
  if (meta) {
    passRows.push(row('מסה בדרכון', meta.massKg !== null && meta.massKg !== undefined ? `${ltr(`${meta.massKg} kg`)} <span class="prov-tag-c">${esc(meta.provenance)}</span>` : '—'));
    passRows.push(row('מקור', `<code>${esc(meta.sourceRef)}</code>`));
    const note = String(meta.confirmedDocNoteHe || '').replace(/LRA\s*=\s*(\d+)\s*A/g, (m) => m + ' [⚠ סותר — ראו שורת LRA: REQUIRES_CLARIFICATION]');
    if (note) passRows.push(row('נתוני תיעוד', esc(note)));
    if (meta.assumedGeometryNoteHe) passRows.push(row('הנחות המחשה (ASSUMED_FOR_DEMO)', esc(meta.assumedGeometryNoteHe)));
  }
  if (!meta || id === 'COMP1' || id === 'COMP2') {
    const lra = buildLiveLraConflict(passport);
    passRows.push(row('זרם רוטור נעול LRA (סתירת מקורות)', `<span data-lra-warning="1">${esc(lra.warningHe)}</span><br>${lra.sources
      .map((s) => `${ltr(`${s.valueA} A`)} — <code>${esc(s.path)}</code> (<code>${esc(s.field)}</code>, רשום כ-${esc(s.recordedStatus)}, ${esc(s.docRef)})`)
      .join('<br>')}<br><span class="prov-tag-c clarify">${esc(lra.status)}</span>`, ' data-hp01-lra="1"'));
    const rla = passport?.compressorRLAEach?.value;
    const rlaMeta = (String(HP01_SUBNODES.COMP1.sourceRef).match(/RLA\s*=\s*(\d+(?:\.\d+)?)\s*A/) || [])[1];
    passRows.push(row('זרם RLA (סתירת מקורות)', `${ltr(`${rla} A`)} בדרכון (<code>rtxc_prototype.mjs</code>) מול ${ltr(`${rlaMeta ?? '—'} A`)} ב-sourceRef (<code>hp01_cutaway_meta.mjs</code>) <span class="prov-tag-c clarify">REQUIRES_CLARIFICATION</span>`));
  }
  if (!meta || NODE_GROUPS.compressor.includes(id)) {
    const rc = vm.unit.refrigerantCharge;
    if (rc) {
      passRows.push(row('מילוי קרר', `${esc(rc.totalUnitCharge?.displayHe || rc.totalDisplayHe || '')} <span class="prov-tag-c">${esc(rc.totalUnitCharge?.provenance || rc.totalProvenance || '')}</span> | ${esc(rc.perCircuitEqualSplitEstimate?.displayHe || rc.perCircuitDisplayHe || '')} <span class="prov-tag-c assumed">ASSUMED_FOR_DEMO</span>`));
      const ex = rc.frozenPrototypeClassificationNote?.explanationHe;
      if (ex) passRows.push(row('הערת סיווג המילוי', esc(ex), ' data-hp01-charge-note="1"'));
    }
  }
  const passportHtml = section('דרכון ומקור הנתונים', `<table class="hp01c-table">${passRows.join('')}</table>`, 'passport');

  // ---- connections of the node (route status only; no particles in Package C)
  let connHtml;
  if (meta) {
    const conns = HP01_NODE_PIPES[id] || [];
    connHtml = section(`חיבורים (${conns.length})`, `<ul class="hp01c-conn-list">${conns
      .map((cid) => {
        const c = HP01_INTERNAL_CONNECTIONS[cid];
        // D-R1-01: the same presentation as the animation and the status strip (never the raw branchState alone)
        const pres = resolveConnectionPresentation(vm, cid);
        const stateHe = unknownMode ? 'לא ידוע — נתוני אתר חסרים' : pres.textHe;
        const size = cid === 'W-01' || cid === 'W-03'
          ? `${ltr(String(passport?.waterConnectionSize?.value || 'DN150'))} (דרכון, CONFIRMED_BY_DOC)`
          : cid.startsWith('A-') || cid.startsWith('E-')
            ? 'קוטר נומינלי: לא ישים'
            : 'קוטר נומינלי לא מתועד (רדיוס התלת-ממד להמחשה בלבד)';
        return `<li data-conn="${esc(cid)}" data-route-state="${esc(unknownMode ? 'UNKNOWN_SITE_MISSING' : pres.stateKey || '')}" data-route-visual="${esc(unknownMode ? 'UNKNOWN' : pres.visual)}"><strong>${ltr(cid)}</strong> ${ltr(`${c.fromEndpoint.ownerId}.${c.fromEndpoint.portName} → ${c.toEndpoint.ownerId}.${c.toEndpoint.portName}`)}<br>
          <span class="hp01c-meta">מצב מסלול: ${esc(stateHe)} | ${size} | ${esc(c.provenance)}</span></li>`;
      })
      .join('')}</ul>`, 'connections');
  } else {
    connHtml = section('חיבורים', `<div class="hp01c-meta">${ltr(String(Object.keys(HP01_INTERNAL_CONNECTIONS).length))} חיבורים פנימיים וגבוליים; בחרו רכיב כדי לראות את החיבורים שלו.</div>`, 'connections');
  }

  return header + purposeHtml + modeHtml + readingsHtml + auxHtml + passportHtml + connHtml;
}
