/**
 * STAGE 6: LIVE INTERACTIVE P&ID MNEMONIC SCHEMATIC (Плоская живая мнемосхема для техника)
 * Driven strictly by COMPONENT_REGISTRY, CONNECTION_REGISTRY, and live simulation state.
 */

import { COMPONENT_REGISTRY, CONNECTION_REGISTRY, getConnectedObjects } from '../topology/registry.mjs';
import { formatValueWithUnit } from '../equipment/units_and_io.mjs';

export class LivePIDView {
  constructor(containerEl, callbacks = {}) {
    this.container = containerEl;
    this.onSelectComponent = callbacks.onSelectComponent || (() => {});
    this.onHoverComponent = callbacks.onHoverComponent || (() => {});
    this.selectedId = 'HP01';
    this.showConnectionsOnly = false;
    this.unitPrefs = { flow: 'L/s', pressure: 'bar', temp: '°C', power: 'kW' };
    this.animPhase = 0;

    // Layout coordinates in 1520 x 820 SVG space
    this.nodePositions = {
      HP01:  { x: 1330, y: 210, w: 155, h: 175, shape: 'rtxc' },
      PP01A: { x: 1120, y: 150, w: 68,  h: 48,  shape: 'pump' },
      PP01B: { x: 1120, y: 215, w: 68,  h: 48,  shape: 'pump' },
      BT01:  { x: 960,  y: 135, w: 95,  h: 245, shape: 'buffer' },
      ET00:  { x: 935,  y: 445, w: 58,  h: 72,  shape: 'et' },
      PSV00: { x: 1015, y: 455, w: 46,  h: 44,  shape: 'psv' },
      PD01A: { x: 790,  y: 145, w: 68,  h: 48,  shape: 'pump' },
      PD01B: { x: 790,  y: 210, w: 68,  h: 48,  shape: 'pump' },
      WT01:  { x: 1330, y: 470, w: 145, h: 75,  shape: 'wt' },
      MU01:  { x: 1145, y: 470, w: 135, h: 75,  shape: 'mu' },
      CP01:  { x: 1330, y: 585, w: 145, h: 85,  shape: 'plc' }
    };

    // Position the 5 parallel modules (HX01..HX05) vertically from y = 90 to y = 690
    for (let i = 1; i <= 5; i++) {
      const idx = i - 1;
      const yBase = 85 + idx * 142;
      const pad = String(i).padStart(2, '0');
      this.nodePositions[`CV${pad}`]    = { x: 615, y: yBase + 8,  w: 54, h: 36, shape: 'valve' };
      this.nodePositions[`HX${pad}`]    = { x: 465, y: yBase,      w: 96, h: 92, shape: 'hx' };
      this.nodePositions[`PS${pad}A`]   = { x: 315, y: yBase - 4,  w: 62, h: 40, shape: 'pump' };
      this.nodePositions[`PS${pad}B`]   = { x: 315, y: yBase + 42, w: 62, h: 40, shape: 'pump' };
      this.nodePositions[`ET${pad}`]    = { x: 210, y: yBase + 48, w: 48, h: 52, shape: 'et' };
      this.nodePositions[`PSV${pad}`]   = { x: 150, y: yBase + 54, w: 40, h: 38, shape: 'psv' };
      this.nodePositions[`CONS${pad}`]  = { x: 25,  y: yBase + 4,  w: 112, h: 78, shape: 'consumer' };
    }
  }

  setSelection(componentId, showConnectionsOnly = this.showConnectionsOnly) {
    this.selectedId = componentId;
    this.showConnectionsOnly = showConnectionsOnly;
  }

  setUnitPrefs(prefs) {
    this.unitPrefs = { ...this.unitPrefs, ...prefs };
  }

  tempToStrokeColor(tempC, calmMode = true) {
    if (tempC === null || tempC === undefined || Number.isNaN(tempC)) return '#64748b';
    if (calmMode) {
      if (tempC < 34) return '#38bdf8';
      if (tempC < 47) return '#2dd4bf';
      if (tempC < 56) return '#f59e0b';
      return '#f87171';
    }
    return '#38bdf8';
  }

  render(sim) {
    if (!this.container || !sim) return;
    const s = sim.state;
    const connectedSet = this.selectedId ? getConnectedObjects(this.selectedId) : null;
    const isDimmedComp = (id) => {
      if (!this.showConnectionsOnly || !connectedSet) return false;
      return !connectedSet.components.has(id);
    };
    const isHighlightedConn = (connId) => {
      if (!this.showConnectionsOnly || !connectedSet) return false;
      return connectedSet.connections.has(connId);
    };

    const fFlow = (v) => formatValueWithUnit(v, 'm³/s', this.unitPrefs.flow, 2);
    const fTemp = (v) => formatValueWithUnit(v, '°C', this.unitPrefs.temp, 1);
    const fPres = (v) => formatValueWithUnit(v, 'Pa_g', this.unitPrefs.pressure, 2);
    const fPow  = (v) => formatValueWithUnit(v, 'W', this.unitPrefs.power, 1);

    // Advance dash phase ONLY by simulation time and flow rate
    const primaryFlowActive = s.primary.qv_m3s > 0.0005 ? 1 : 0;
    const distFlowActive = s.distribution.qv_total_m3s > 0.0002 ? 1 : 0;
    const dashOffsetPri = -((s.time_s * 28 * primaryFlowActive) % 24);
    const dashOffsetDist = -((s.time_s * 28 * distFlowActive) % 24);

    // Build SVG paths for primary, distribution, and 5 branch pipes
    let pipesSvg = '';

    // 1. Primary loop HP01 <-> PP01A/B <-> BT01
    const priHotColor = this.tempToStrokeColor(s.hp.T_out_C);
    const priColdColor = this.tempToStrokeColor(s.hp.T_in_C);
    const priDim = this.showConnectionsOnly && !isHighlightedConn('PIPE-HP-SUP-01') && !isHighlightedConn('PIPE-HP-RET-02') && !isHighlightedConn('PIPE-HP-RET-01');

    pipesSvg += `
      <g class="pid-pipe-group ${priDim ? 'dimmed' : ''}">
        <!-- HP01 Hot Supply to BT01 port p1_in -->
        <path d="M 1330 245 L 1055 245 L 1055 165" stroke="${priHotColor}" stroke-width="5" fill="none" opacity="0.85"/>
        <path d="M 1330 245 L 1055 245 L 1055 165" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="6 8" stroke-dashoffset="${dashOffsetPri}" fill="none" opacity="${primaryFlowActive ? 0.85 : 0}"/>
        <text x="1195" y="237" class="pid-pipe-label" text-anchor="middle">הזנה ראשית RTXC: ${fTemp(s.hp.T_out_C)} | ${fFlow(s.primary.qv_m3s)}</text>

        <!-- BT01 port p2_out -> PP01A/B -> HP01 Return -->
        <path d="M 1055 340 L 1095 340 L 1095 175 L 1120 175" stroke="${priColdColor}" stroke-width="4" fill="none"/>
        <path d="M 1095 240 L 1120 240" stroke="${priColdColor}" stroke-width="4" fill="none"/>
        <path d="M 1188 175 L 1225 175 L 1225 320 L 1330 320" stroke="${priColdColor}" stroke-width="5" fill="none"/>
        <path d="M 1188 240 L 1225 240" stroke="${priColdColor}" stroke-width="4" fill="none"/>
        <path d="M 1055 340 L 1095 340 L 1095 175 L 1225 175 L 1225 320 L 1330 320" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="6 8" stroke-dashoffset="${dashOffsetPri}" fill="none" opacity="${primaryFlowActive ? 0.75 : 0}"/>
        <text x="1210" y="342" class="pid-pipe-label" text-anchor="middle">חזרה ל-RTXC: ${fTemp(s.hp.T_in_C)}</text>

        <!-- ET00 & PSV00 dead-end connection to BT01 neutral pressure point -->
        <path d="M 985 380 L 985 445" stroke="#94a3b8" stroke-width="3" stroke-dasharray="4 3" fill="none"/>
        <path d="M 985 418 L 1038 418 L 1038 455" stroke="#94a3b8" stroke-width="2.5" fill="none"/>
      </g>
    `;

    // 2. Distribution headers from BT01 -> PD01A/B -> Manifold -> 5 branches
    const distHotColor = this.tempToStrokeColor(s.distribution.T_supply_header_C);
    const distColdColor = this.tempToStrokeColor(s.distribution.T_return_header_C);
    const distDim = this.showConnectionsOnly && !connectedSet?.components.has('BT01') && !connectedSet?.components.has('PD01A') && !connectedSet?.components.has('PD01B');

    pipesSvg += `
      <g class="pid-pipe-group ${distDim ? 'dimmed' : ''}">
        <!-- BT01 d1_out -> PD01A/B -> Supply Manifold at x=715 -->
        <path d="M 960 165 L 858 165" stroke="${distHotColor}" stroke-width="5" fill="none"/>
        <path d="M 910 165 L 910 230 L 858 230" stroke="${distHotColor}" stroke-width="4" fill="none"/>
        <path d="M 790 165 L 715 165" stroke="${distHotColor}" stroke-width="5" fill="none"/>
        <path d="M 790 230 L 715 230" stroke="${distHotColor}" stroke-width="4" fill="none"/>
        <!-- Primary Supply Header vertical bus x=715 -->
        <path d="M 715 100 L 715 680" stroke="${distHotColor}" stroke-width="7" fill="none"/>
        <path d="M 715 100 L 715 680" stroke="#fff" stroke-width="2" stroke-dasharray="7 9" stroke-dashoffset="${dashOffsetDist}" fill="none" opacity="${distFlowActive ? 0.75 : 0}"/>
        <!-- Primary Return Header vertical bus x=585 -> BT01 d2_in -->
        <path d="M 585 110 L 585 735 L 945 735 L 945 350 L 960 350" stroke="${distColdColor}" stroke-width="6" fill="none"/>
        <text x="715" y="76" class="pid-header-tag" text-anchor="middle">סעפת הזנה ראשית (${fTemp(s.distribution.T_supply_header_C)})</text>
        <text x="585" y="758" class="pid-header-tag" text-anchor="middle">סעפת חזרה ראשית ל-BT01 (${fTemp(s.distribution.T_return_header_C)} | Δp=${(s.distribution.dp_header_Pa/1000).toFixed(1)} kPa)</text>
      </g>
    `;

    // 3. Five Parallel Heat Exchange Modules & Secondary Consumer Loops
    for (let i = 0; i < 5; i++) {
      const idx = i + 1;
      const pad = String(idx).padStart(2, '0');
      const br = s.branches[i];
      const yBase = 85 + i * 142;
      const priFlowAct = br.primary.qv_m3s > 0.00005 ? 1 : 0;
      const secFlowAct = br.secondary.qv_m3s > 0.00005 ? 1 : 0;
      const dashPriBr = -((s.time_s * 26 * priFlowAct) % 18);
      const dashSecBr = -((s.time_s * 26 * secFlowAct) % 18);

      const brCompIds = [`HX${pad}`, `CV${pad}`, `PS${pad}A`, `PS${pad}B`, `ET${pad}`, `PSV${pad}`, `CONS${pad}`];
      const brDim = this.showConnectionsOnly && !brCompIds.some((id) => connectedSet?.components.has(id));

      const priSupCol = this.tempToStrokeColor(br.hx.T_pri_in_C);
      const priRetCol = this.tempToStrokeColor(br.hx.T_pri_out_C);
      const secSupCol = this.tempToStrokeColor(br.hx.T_sec_out_C);
      const secRetCol = this.tempToStrokeColor(br.hx.T_sec_in_C);

      pipesSvg += `
        <g class="pid-branch-pipes ${brDim ? 'dimmed' : ''}">
          <!-- Supply Header (715) -> CV_i -> HX_i pri_in (top right) -->
          <path d="M 715 ${yBase + 24} L 669 ${yBase + 24}" stroke="${priSupCol}" stroke-width="3.5" fill="none"/>
          <path d="M 615 ${yBase + 24} L 561 ${yBase + 24}" stroke="${priSupCol}" stroke-width="3.5" fill="none"/>
          <path d="M 715 ${yBase + 24} L 561 ${yBase + 24}" stroke="#f8fafc" stroke-width="1.5" stroke-dasharray="4 6" stroke-dashoffset="${dashPriBr}" fill="none" opacity="${priFlowAct ? 0.8 : 0}"/>

          <!-- HX_i pri_out (bottom right) -> Return Header (585) -->
          <path d="M 561 ${yBase + 68} L 585 ${yBase + 68}" stroke="${priRetCol}" stroke-width="3.5" fill="none"/>

          <!-- HX_i sec_out (top left, counterflow hot outlet) -> Consumer Supply Arrow -->
          <path d="M 465 ${yBase + 22} L 137 ${yBase + 22}" stroke="${secSupCol}" stroke-width="4" fill="none"/>
          <path d="M 465 ${yBase + 22} L 137 ${yBase + 22}" stroke="#fff" stroke-width="1.6" stroke-dasharray="5 6" stroke-dashoffset="${-dashSecBr}" fill="none" opacity="${secFlowAct ? 0.85 : 0}"/>

          <!-- Consumer Return Arrow -> PS_iA/B -> HX_i sec_in (bottom left, counterflow cold inlet) -->
          <path d="M 137 ${yBase + 64} L 315 ${yBase + 64}" stroke="${secRetCol}" stroke-width="3.5" fill="none"/>
          <path d="M 295 ${yBase + 64} L 295 ${yBase + 16} L 315 ${yBase + 16}" stroke="${secRetCol}" stroke-width="3" fill="none"/>
          <path d="M 377 ${yBase + 16} L 405 ${yBase + 16} L 405 ${yBase + 68} L 465 ${yBase + 68}" stroke="${secRetCol}" stroke-width="3.5" fill="none"/>
          <path d="M 377 ${yBase + 64} L 465 ${yBase + 64}" stroke="${secRetCol}" stroke-width="3.5" fill="none"/>
          <path d="M 137 ${yBase + 64} L 465 ${yBase + 64}" stroke="#e2e8f0" stroke-width="1.4" stroke-dasharray="5 6" stroke-dashoffset="${dashSecBr}" fill="none" opacity="${secFlowAct ? 0.75 : 0}"/>

          <!-- Dead-end branch to ET_0i & PSV_0i (no through-flow) -->
          <path d="M 234 ${yBase + 64} L 234 ${yBase + 48}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="3 2" fill="none"/>
          <path d="M 170 ${yBase + 64} L 170 ${yBase + 54}" stroke="#94a3b8" stroke-width="2" fill="none"/>
        </g>
      `;
    }

    // Build interactive component nodes
    let nodesSvg = '';
    for (const [compId, pos] of Object.entries(this.nodePositions)) {
      const comp = COMPONENT_REGISTRY[compId];
      if (!comp) continue;
      const isSelected = this.selectedId === compId;
      const dimmed = isDimmedComp(compId);
      nodesSvg += this.renderNode(compId, comp, pos, s, isSelected, dimmed, { fFlow, fTemp, fPres, fPow });
    }

    this.container.innerHTML = `
      <svg viewBox="0 0 1520 790" class="pid-svg" dir="ltr">
        <defs>
          <filter id="glow-select" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#38bdf8" flood-opacity="0.85"/>
          </filter>
          <filter id="glow-alarm" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#ef4444" flood-opacity="0.9"/>
          </filter>
          <marker id="arrow-supply" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b"/>
          </marker>
          <marker id="arrow-return" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8"/>
          </marker>
        </defs>

        <!-- Background Zones -->
        <rect x="10" y="12" width="1500" height="766" rx="10" fill="#0b1322" stroke="#1e293b" stroke-width="1.5"/>
        <rect x="920" y="45" width="575" height="365" rx="8" fill="#0f172a" stroke="#1e293b" stroke-dasharray="5 5"/>
        <text x="1480" y="68" fill="#64748b" font-size="12" font-weight="600" text-anchor="end">מקור חום ראשי ואגירה (HP01 + PP01 + BT01)</text>

        <rect x="15" y="45" width="885" height="720" rx="8" fill="#0f172a" stroke="#1e293b" stroke-dasharray="5 5"/>
        <text x="885" y="68" fill="#64748b" font-size="12" font-weight="600" text-anchor="end">5 מודולי מחליפי חום (HX01–HX05) ויציאות לצרכנים (צרכן 1–5)</text>

        ${pipesSvg}
        ${nodesSvg}
      </svg>
    `;

    // Bind click and hover handlers on every component group
    this.container.querySelectorAll('.pid-node').forEach((el) => {
      const id = el.getAttribute('data-comp-id');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelectComponent(id);
      });
      el.addEventListener('mouseenter', (e) => {
        this.onHoverComponent(id, e);
      });
      el.addEventListener('mouseleave', () => {
        this.onHoverComponent(null, null);
      });
    });
  }

  renderNode(compId, comp, pos, s, isSelected, dimmed, fmt) {
    const { x, y, w, h, shape } = pos;
    let statusState = 'normal'; // normal | warning | alarm
    let line1 = compId;
    let line2 = '';
    let line3 = '';
    let badgeText = '';

    if (compId === 'HP01') {
      if (s.hp.outOfMap || s.hp.protectionBlocked) statusState = 'alarm';
      else if (s.hp.inPage48To50AmbiguityZone || s.hp.defrostActive) statusState = 'warning';
      line1 = 'HP01 — Trane RTXC 180';
      line2 = `Q_w: ${fmt.fPow(s.hp.Q_water_W)} | P_el: ${fmt.fPow(s.hp.P_el_total_W)}`;
      line3 = `COP: ${s.hp.COP_unit ? s.hp.COP_unit.toFixed(2) : '—'} | עומס: ${s.hp.actualLoadPct.toFixed(0)}%`;
      badgeText = s.hp.defrostActive ? 'הפשקה (DEFROST)' : s.hp.outOfMap ? 'מחוץ למפה!' : s.hp.heatingActive ? 'חימום פעיל' : 'מופסק';
    } else if (compId === 'BT01') {
      line1 = 'BT01 — אוגר 4 חיבורים';
      line2 = `חלק עליון: ${fmt.fTemp(s.buffer.T_top_C)}`;
      line3 = `אמצע: ${fmt.fTemp(s.buffer.T_mid_C)} | תחתון: ${fmt.fTemp(s.buffer.T_bot_C)}`;
      badgeText = '2.5 m³';
    } else if (shape === 'pump') {
      let pState = null;
      if (compId === 'PP01A') pState = s.primary.pumpA;
      else if (compId === 'PP01B') pState = s.primary.pumpB;
      else if (compId === 'PD01A') pState = s.distribution.pumpA;
      else if (compId === 'PD01B') pState = s.distribution.pumpB;
      else {
        const m = compId.match(/^PS0(\d)([AB])$/);
        if (m) {
          const br = s.branches[Number(m[1]) - 1];
          pState = m[2] === 'A' ? br.secondary.pumpA : br.secondary.pumpB;
        }
      }
      if (pState) {
        if (pState.state === 'fault') statusState = 'alarm';
        else if (pState.state === 'maintenance_isolated') statusState = 'warning';
        line1 = compId;
        line2 = pState.state === 'running' ? `פעילה (${(pState.speedRatio * 100).toFixed(0)}%)` :
                pState.state === 'standby_ready' ? 'גיבוי מוכן' :
                pState.state === 'fault' ? 'תקלה!' :
                pState.state === 'maintenance_isolated' ? 'תחזוקה' : 'מופסקת';
      }
    } else if (shape === 'hx') {
      const idx = Number(compId.slice(2)) - 1;
      const br = s.branches[idx];
      if (br.hx.crossLeak_m3s > 0 || br.hx.foulingFactor > 1.35) statusState = 'warning';
      if (br.missingDataBlocked) statusState = 'warning';
      line1 = `${compId} (נגדי ε=${br.hx.effectiveness.toFixed(2)})`;
      line2 = `Q: ${fmt.fPow(br.hx.Q_W)} | Δp: ${(br.primary.dp_hx_Pa / 1000).toFixed(1)} kPa`;
      line3 = `ראשי: ${fmt.fTemp(br.hx.T_pri_in_C)}→${fmt.fTemp(br.hx.T_pri_out_C)}`;
    } else if (shape === 'valve') {
      const idx = Number(compId.slice(2)) - 1;
      const br = s.branches[idx];
      line1 = compId;
      line2 = `${(br.primary.valveActual * 100).toFixed(0)}%`;
    } else if (shape === 'consumer') {
      const idx = Number(compId.slice(4)) - 1;
      const br = s.branches[idx];
      if (br.secondary.exceedsUnconfirmed2Bar || br.secondary.leakRate_kg_s > 0) statusState = 'warning';
      if (br.secondary.psvOpen) statusState = 'alarm';
      line1 = `${comp.labelHe} (z=${br.secondary.z_consumer_m}m)`;
      line2 = `מים: ${fmt.fTemp(br.hx.T_sec_out_C)} → ${fmt.fTemp(br.hx.T_sec_in_C)} | ${fmt.fFlow(br.secondary.qv_m3s)}`;
      line3 = `שוקולד: ${fmt.fTemp(br.consumer.T_choc_C)} | מעיל: ${fmt.fPres(br.secondary.p_consumer_supply_Pa_g)}`;
    } else if (shape === 'et') {
      let etObj = compId === 'ET00' ? s.primary.et00 : s.branches[Number(compId.slice(2)) - 1]?.secondary.et;
      if (etObj?.isolated) statusState = 'alarm';
      line1 = compId;
      line2 = etObj?.isolated ? 'מבודד!' : `${fmt.fPres(etObj?.p_gas_Pa_g ?? 150000)}`;
    } else if (shape === 'psv') {
      let open = compId === 'PSV00' ? s.primary.psv00_open : s.branches[Number(compId.slice(3)) - 1]?.secondary.psvOpen;
      if (open) statusState = 'alarm';
      line1 = compId;
      line2 = open ? 'פורק!' : 'סגור';
    } else if (compId === 'WT01') {
      line1 = 'WT01 — הכנת מים ומינון';
      line2 = `pH 7.8 | 420 μS/cm | מעכב: ${s.waterTreatment.dosingBlocked ? 'חסום' : 'מוכן'}`;
    } else if (compId === 'MU01') {
      if (s.Faults.makeupValveStuckOpenLoop !== null) statusState = 'alarm';
      line1 = 'MU01 — מכלנת הזנה (מרווח אוויר)';
      line2 = s.Faults.makeupValveStuckOpenLoop !== null ? 'שסתום תקוע פתוח!' : 'מוכן להזנה מבוקרת';
    } else if (compId === 'CP01') {
      line1 = 'CP01 — בקר מתקן ראשי';
      line2 = `שלב: ${s.automation.startupStage.replace('STEP_', '')}`;
      line3 = `התראות פעילות: ${s.alarms.filter((a) => a.active).length}`;
    }

    const strokeCol = statusState === 'alarm' ? '#ef4444' :
                      statusState === 'warning' ? '#f59e0b' :
                      isSelected ? '#38bdf8' : '#334155';
    const fillCol = statusState === 'alarm' ? '#2a1215' :
                    statusState === 'warning' ? '#271c0c' :
                    isSelected ? '#112840' : '#131d31';
    const filterAttr = statusState === 'alarm' ? 'filter="url(#glow-alarm)"' :
                       isSelected ? 'filter="url(#glow-select)"' : '';

    return `
      <g class="pid-node ${dimmed ? 'dimmed' : ''}" data-comp-id="${compId}" transform="translate(${x}, ${y})" style="cursor:pointer;">
        <rect width="${w}" height="${h}" rx="6" fill="${fillCol}" stroke="${strokeCol}" stroke-width="${isSelected ? 2.5 : 1.5}" ${filterAttr}/>
        <text x="${w / 2}" y="16" fill="#f8fafc" font-size="11" font-weight="700" text-anchor="middle">${line1}</text>
        ${line2 ? `<text x="${w / 2}" y="33" fill="#cbd5e1" font-size="10" text-anchor="middle">${line2}</text>` : ''}
        ${line3 ? `<text x="${w / 2}" y="49" fill="#94a3b8" font-size="9.5" text-anchor="middle">${line3}</text>` : ''}
        ${badgeText ? `
          <rect x="${w / 2 - 46}" y="${h - 24}" width="92" height="18" rx="4" fill="${statusState === 'alarm' ? '#991b1b' : '#0369a1'}"/>
          <text x="${w / 2}" y="${h - 11}" fill="#fff" font-size="9.5" font-weight="700" text-anchor="middle">${badgeText}</text>
        ` : ''}
        ${shape === 'consumer' ? `
          <!-- Outgoing Supply & Incoming Return Arrows to Factory Boundary -->
          <line x1="0" y1="18" x2="-18" y2="18" stroke="#f59e0b" stroke-width="3" marker-end="url(#arrow-supply)"/>
          <line x1="-18" y1="60" x2="0" y2="60" stroke="#38bdf8" stroke-width="3" marker-end="url(#arrow-return)"/>
        ` : ''}
      </g>
    `;
  }
}
