/**
 * STAGE 6: MAIN TECHNICIAN INTERFACE & SIMULATION CONTROLLER (RTL Hebrew + Russian Docs)
 * Coordinates Physics Engine, 3D Rooftop/Cutaway Scene, Live P&ID Schematic,
 * Single Side Inspector Card, Scenarios, Unit Conversion, JSON I/O, and Modals.
 */

import {
  createSimulationInstance,
  advanceSimulationTime,
  acknowledgeAlarm,
  resetLatchedProtection
} from '../physics/plant_engine.mjs';
import {
  COMPONENT_REGISTRY,
  getComponentConnections,
  verifyTopologyIntegrity
} from '../topology/registry.mjs';
import {
  RTXC_PROTOTYPE_PASSPORT,
  SOURCE_REGISTRY,
  DOCUMENTED_CONTRADICTIONS_AND_GAPS,
  PROVENANCE_STATUS_LABELS
} from '../equipment/rtxc_prototype.mjs';
import {
  applyValidatedDatasetToSimulation,
  convertValue,
  formatValueWithUnit,
  exportSimulationSnapshotJSON,
  validateImportedDatasetJSON
} from '../equipment/units_and_io.mjs';
import { SCENARIOS, applyScenario, EVENT_REACTION_MATRIX } from '../scenarios/scenarios.mjs';
import { UI_TEXT_HE, PUMP_STATE_LABELS_HE, STARTUP_STAGE_LABELS_HE } from '../i18n/he_ru.mjs';
import { LivePIDView } from './p_and_id_view.mjs';
import { Rooftop3DScene } from '../viz3d/rooftop_scene.mjs';
import { HP01_SUBNODES, HP01_CAMERA_PRESETS } from '../viz3d/hp01_cutaway_meta.mjs';
import { buildHP01CutawayViewModel } from '../viz3d/hp01_sim_adapter.mjs';
import { renderHP01CutawayCardHtml } from './hp01_cutaway_panel.mjs';
import { describeHP01AnimationStatus, HP01_ANIMATION_TEXT_HE } from '../viz3d/hp01_process_animation.mjs';
import HP01_PURPOSE_DICTIONARY from '../i18n/hp01_purpose_he.json' with { type: 'json' };

class PlantSimulationApp {
  constructor() {
    this.datasetMode = 'DEMO';
    this.currentScenarioId = 'SCEN_01_NORMAL';
    this.sim = createSimulationInstance('DEMO');
    applyScenario(this.sim, this.currentScenarioId);
    // Warm up 12 seconds of initial steady state so normal scenario starts with active flow & heating
    advanceSimulationTime(this.sim, 12.0);

    this.viewMode = 'rooftop3d'; // 'rooftop3d' | 'cutaway3d' | 'pid'
    this.selectedComponentId = 'HP01';
    this.showConnectionsOnly = false;
    this.unitPrefs = {
      flow: 'L/s',
      pressure: 'bar',
      temp: '°C',
      power: 'kW'
    };

    // Gas comparison configurable inputs (Section 9.10: never hardcode 3x savings)
    this.econConfig = {
      elecTariff_ILS_per_kWh: 0.52,
      gasTariff_ILS_per_kWh_LHV: 0.24,
      gasBoilerEfficiency: 0.88
    };

    this.initDOM();
    this.initVisualizers();
    this.updateAllUI();
    this.startLoop();
  }

  initDOM() {
    // Populate Scenario Select
    const scenSelect = document.getElementById('scenario-select');
    if (scenSelect) {
      scenSelect.innerHTML = Object.values(SCENARIOS)
        .map((sc) => `<option value="${sc.id}">${sc.nameHe} — ${sc.nameRu}</option>`)
        .join('');
      scenSelect.value = this.currentScenarioId;
      scenSelect.addEventListener('change', (e) => {
        this.loadScenario(e.target.value);
      });
    }

    // View Switcher Tabs
    document.querySelectorAll('[data-view-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-view-mode');
        this.switchViewMode(mode);
      });
    });

    // Camera Focus on 5 Modules Button
    const btnFocusModules = document.getElementById('btn-focus-modules');
    if (btnFocusModules) {
      btnFocusModules.addEventListener('click', () => {
        this.switchViewMode('rooftop3d');
        if (this.scene3d) this.scene3d.focusOnModulesBank();
      });
    }

    // Play / Pause / Step / Speed
    document.getElementById('btn-play-pause')?.addEventListener('click', () => {
      this.sim.paused = !this.sim.paused;
      this.updateControlButtons();
    });

    document.getElementById('btn-step')?.addEventListener('click', () => {
      this.sim.paused = true;
      advanceSimulationTime(this.sim, 1.0);
      this.updateControlButtons();
      this.updateAllUI();
    });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      this.loadScenario(this.currentScenarioId);
    });

    document.getElementById('speed-select')?.addEventListener('change', (e) => {
      this.sim.timeMultiplier = Number(e.target.value) || 1.0;
    });

    // Show Connections Toggle
    document.getElementById('btn-show-connections')?.addEventListener('click', () => {
      this.showConnectionsOnly = !this.showConnectionsOnly;
      document.getElementById('btn-show-connections')?.classList.toggle('active', this.showConnectionsOnly);
      if (this.scene3d) this.scene3d.setSelection(this.selectedComponentId, this.showConnectionsOnly, this.sim);
      if (this.pidView) {
        this.pidView.setSelection(this.selectedComponentId, this.showConnectionsOnly);
        this.pidView.render(this.sim);
      }
    });

    // Dataset Mode Switcher (DEMO vs SITE)
    document.getElementById('dataset-mode-select')?.addEventListener('change', (e) => {
      this.datasetMode = e.target.value;
      this.sim = createSimulationInstance(this.datasetMode);
      applyScenario(this.sim, this.currentScenarioId);
      if (this.datasetMode === 'DEMO' && this.currentScenarioId === 'SCEN_01_NORMAL') {
        advanceSimulationTime(this.sim, 12.0);
      } else {
        advanceSimulationTime(this.sim, 2.0);
      }
      this.updateAllUI();
    });

    // Ambient Temp Slider & Strict 21C Checkbox
    const ambSlider = document.getElementById('ambient-temp-slider');
    const ambVal = document.getElementById('ambient-temp-val');
    if (ambSlider) {
      ambSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        this.sim.dataset.ambient.temperatureC.value = val;
        this.sim.state.env.T_amb_C = val;
        if (ambVal) ambVal.textContent = `${val.toFixed(1)} °C`;
      });
      ambSlider.addEventListener('change', (e) => {
        const val = Number(e.target.value);
        this.sim.dataset.ambient.temperatureC.value = val;
        this.sim.state.env.T_amb_C = val;
        if (ambVal) ambVal.textContent = `${val.toFixed(1)} °C`;
        this.recalculateFromCurrentDataset();
      });
    }

    const strictCheck = document.getElementById('strict-21c-check');
    if (strictCheck) {
      strictCheck.addEventListener('change', (e) => {
        this.sim.dataset.ambient.strictPage48AmbientLimit.value = Boolean(e.target.checked);
        this.sim.state.env.strictPage48Limit21C = Boolean(e.target.checked);
        this.recalculateFromCurrentDataset();
      });
    }

    // Unit Selectors
    this.sim.dataset.uiUnitPrefs = { ...this.unitPrefs };
    ['flow', 'pressure', 'temp', 'power'].forEach((dim) => {
      const sel = document.getElementById(`unit-${dim}`);
      if (sel) {
        sel.addEventListener('change', (e) => {
          this.unitPrefs[dim] = e.target.value;
          this.sim.dataset.uiUnitPrefs = { ...this.unitPrefs };
          if (this.pidView) this.pidView.setUnitPrefs(this.unitPrefs);
          this.updateAllUI();
        });
      }
    });

    // JSON Export & Import
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      this.sim.dataset.uiUnitPrefs = { ...this.unitPrefs };
      const jsonStr = exportSimulationSnapshotJSON(this.sim);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hp-rtxc-5hx-${this.datasetMode.toLowerCase()}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    const fileInput = document.getElementById('json-file-input');
    document.getElementById('btn-import-json')?.addEventListener('click', () => {
      fileInput?.click();
    });
    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      this.lastImportedFileInfo = {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        importedAt: Date.now()
      };
      const text = await file.text();
      this.importDatasetJSONString(text);
      e.target.value = '';
    });

    // Package C: HP01 cutaway controls — bound once; every control goes through the single controller state
    const hp01NodeSel = document.getElementById('hp01-node-select');
    if (hp01NodeSel) {
      hp01NodeSel.innerHTML =
        '<option value="">HP01 — סקירת יחידה (כל 25 הצמתים)</option>' +
        Object.values(HP01_SUBNODES).map((n) => `<option value="${n.id}">${n.id} — ${n.shortNameHe}</option>`).join('');
      hp01NodeSel.addEventListener('change', (e) => this.hp01Controller?.selectSubNode(e.target.value || null, { reason: 'list' }));
    }
    const hp01CamSel = document.getElementById('hp01-camera-select');
    if (hp01CamSel) {
      hp01CamSel.innerHTML = Object.values(HP01_CAMERA_PRESETS).map((p) => `<option value="${p.id}">${p.labelHe}</option>`).join('');
      hp01CamSel.addEventListener('change', (e) => this.hp01Controller?.setCameraPreset(e.target.value));
    }
    document.getElementById('hp01-filter-select')?.addEventListener('change', (e) => this.hp01Controller?.setCircuitFilter(e.target.value));
    document.getElementById('hp01-casing-select')?.addEventListener('change', (e) => this.hp01Controller?.setCasingMode(e.target.value));
    document.getElementById('hp01-btn-overview')?.addEventListener('click', () => this.hp01Controller?.resetToOverview());
    document.getElementById('hp01-btn-roof')?.addEventListener('click', () => this.switchViewMode('rooftop3d'));
    // Package D: Visual Freeze holds only the picture still (the model keeps calculating); native button = keyboard access
    document.getElementById('hp01-btn-freeze')?.addEventListener('click', () => {
      this.hp01Controller?.setVisualFreeze(!this.hp01Controller.state.visualFreeze, 'freeze');
    });

    // Modal triggers
    document.querySelectorAll('[data-open-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-open-modal');
        document.getElementById(modalId)?.classList.add('open');
        this.renderActiveModals();
      });
    });
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-backdrop')?.classList.remove('open');
      });
    });
  }

  recalculateFromCurrentDataset() {
    const wasPaused = Boolean(this.sim?.paused);
    const snapshot = JSON.parse(exportSimulationSnapshotJSON(this.sim));
    const mode = snapshot.mode || this.datasetMode || 'DEMO';
    this.sim = createSimulationInstance(mode);
    this.sim.paused = wasPaused;
    applyValidatedDatasetToSimulation(this.sim, snapshot);
    this.sim.dataset.uiUnitPrefs = { ...this.unitPrefs };
    advanceSimulationTime(this.sim, 12.0);
    this.updateAllUI();
  }

  importDatasetJSONString(text) {
    const validation = validateImportedDatasetJSON(text);
    const banner = document.getElementById('import-status-toast');
    if (!validation.valid) {
      // Section 13: Corrupted file must not corrupt open model
      if (banner) {
        banner.textContent = `ייבוא נדחה (מודל פתוח נשמר ללא פגיעה): ${validation.errors.join('; ')}`;
        banner.className = 'toast-banner error visible';
        setTimeout(() => banner.classList.remove('visible'), 6000);
      }
      return validation;
    }
    const p = validation.parsed;
    const mode = p.mode || p.datasetMode || 'DEMO';
    const wasPaused = Boolean(this.sim?.paused);
    this.datasetMode = mode;
    const modeSel = document.getElementById('dataset-mode-select');
    if (modeSel) modeSel.value = mode;
    this.sim = createSimulationInstance(mode);
    this.sim.paused = wasPaused;
    applyValidatedDatasetToSimulation(this.sim, p);

    if (p.uiUnitPrefs && typeof p.uiUnitPrefs === 'object') {
      ['flow', 'pressure', 'temp', 'power'].forEach((dim) => {
        if (typeof p.uiUnitPrefs[dim] === 'string') {
          this.unitPrefs[dim] = p.uiUnitPrefs[dim];
          const sel = document.getElementById(`unit-${dim}`);
          if (sel) sel.value = p.uiUnitPrefs[dim];
        }
      });
      if (this.pidView) this.pidView.setUnitPrefs(this.unitPrefs);
    }
    this.sim.dataset.uiUnitPrefs = { ...this.unitPrefs };

    const ambSlider = document.getElementById('ambient-temp-slider');
    const ambVal = document.getElementById('ambient-temp-val');
    if (ambSlider) ambSlider.value = this.sim.dataset.ambient.temperatureC.value;
    if (ambVal) ambVal.textContent = `${this.sim.dataset.ambient.temperatureC.value.toFixed(1)} °C`;
    const strictCheck = document.getElementById('strict-21c-check');
    if (strictCheck) strictCheck.checked = Boolean(this.sim.dataset.ambient.strictPage48AmbientLimit.value);
    advanceSimulationTime(this.sim, 12.0);
    this.updateAllUI();
    if (banner) {
      banner.textContent = 'קובץ JSON אומת ויובא בהצלחה — התוצאות חושבו מחדש.';
      banner.className = 'toast-banner ok visible';
      setTimeout(() => banner.classList.remove('visible'), 4000);
    }
    return validation;
  }

  initVisualizers() {
    const hoverTip = document.getElementById('hover-short-tooltip');
    const handleHover = (compId, ev) => {
      if (!hoverTip) return;
      if (!compId) {
        hoverTip.classList.remove('visible');
        return;
      }
      const comp = COMPONENT_REGISTRY[compId];
      hoverTip.textContent = comp ? `${comp.id} — ${comp.labelHe}` : compId;
      hoverTip.classList.add('visible');
      if (ev && typeof ev.clientX === 'number') {
        hoverTip.style.left = `${Math.min(window.innerWidth - 220, ev.clientX + 14)}px`;
        hoverTip.style.top = `${Math.max(12, ev.clientY - 28)}px`;
      }
    };

    const handleSelect = (compId) => {
      if (!compId) return;
      this.selectedComponentId = compId;
      if (this.scene3d) this.scene3d.setSelection(compId, this.showConnectionsOnly, this.sim);
      if (this.pidView) {
        this.pidView.setSelection(compId, this.showConnectionsOnly);
        this.pidView.render(this.sim);
      }
      this.syncHP01Toolbar();
      this.renderInspectorCard();
    };

    const viewport3d = document.getElementById('viewport-3d');
    const viewportPid = document.getElementById('viewport-pid');

    const handleHoverSubNode = (subId, ev) => {
      if (!hoverTip) return;
      if (!subId) {
        hoverTip.classList.remove('visible');
        return;
      }
      hoverTip.textContent = `${subId} — ${HP01_SUBNODES[subId]?.shortNameHe || ''}`;
      hoverTip.classList.add('visible');
      if (ev && typeof ev.clientX === 'number') {
        hoverTip.style.left = `${Math.min(window.innerWidth - 220, ev.clientX + 14)}px`;
        hoverTip.style.top = `${Math.max(12, ev.clientY - 28)}px`;
      }
    };

    if (viewport3d) {
      this.scene3d = new Rooftop3DScene(viewport3d, {
        onSelectComponent: handleSelect,
        onHoverComponent: handleHover,
        onSelectHP01SubNode: (subId) => this.hp01Controller?.selectSubNode(subId, { reason: 'canvas' }),
        onHoverHP01SubNode: handleHoverSubNode
      });
      this.hp01Controller = this.scene3d.hp01Controller;
      // prefers-reduced-motion: calm initial state (frozen picture); the button can still start the motion
      if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.hp01Controller.setVisualFreeze(true, 'reduced-motion');
      }
      this.hp01Controller.onChange((state, reason) => {
        this.syncHP01Toolbar();
        this.renderInspectorCard();
        // Narrow screens: bring the focus strip, model and start of the card into view after a selection
        if ((reason === 'list' || reason === 'canvas' || reason === 'preset') && window.innerWidth <= 1100) {
          document.getElementById('hp01-cutaway-toolbar')?.scrollIntoView({ block: 'start', behavior: 'instant' });
        }
      });
    }

    if (viewportPid) {
      this.pidView = new LivePIDView(viewportPid, {
        onSelectComponent: handleSelect,
        onHoverComponent: handleHover
      });
    }
  }

  switchViewMode(mode) {
    this.viewMode = mode;
    document.querySelectorAll('[data-view-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-view-mode') === mode);
    });

    const vp3d = document.getElementById('viewport-3d');
    const vpPid = document.getElementById('viewport-pid');

    if (mode === 'pid') {
      vp3d.style.display = 'none';
      vpPid.style.display = 'block';
      this.pidView?.render(this.sim);
    } else {
      vp3d.style.display = 'block';
      vpPid.style.display = 'none';
      this.scene3d?. resize();
      this.scene3d?.setMode(mode, this.sim);
    }
    this.syncHP01Toolbar();
    this.renderInspectorCard();
  }

  isHP01CutawayView() {
    return this.viewMode === 'cutaway3d' && this.selectedComponentId === 'HP01';
  }

  // Toolbar, focus strip and legend follow the single controller state
  syncHP01Toolbar() {
    const bar = document.getElementById('hp01-cutaway-toolbar');
    const legend = document.getElementById('stream-legend-bar');
    const active = this.isHP01CutawayView();
    if (bar) bar.hidden = !active;
    if (legend) legend.style.display = active ? 'none' : '';
    if (!active || !this.hp01Controller) return;
    const st = this.hp01Controller.state;
    const nodeSel = document.getElementById('hp01-node-select');
    if (nodeSel) nodeSel.value = st.selectedSubNodeId || '';
    const camSel = document.getElementById('hp01-camera-select');
    if (camSel) camSel.value = st.cameraPreset;
    const fSel = document.getElementById('hp01-filter-select');
    if (fSel) fSel.value = st.circuitFilter;
    const cSel = document.getElementById('hp01-casing-select');
    if (cSel) cSel.value = st.casingMode;
    const freezeBtn = document.getElementById('hp01-btn-freeze');
    if (freezeBtn) {
      freezeBtn.setAttribute('aria-pressed', st.visualFreeze ? 'true' : 'false');
      freezeBtn.textContent = st.visualFreeze ? HP01_ANIMATION_TEXT_HE.freezeOff : HP01_ANIMATION_TEXT_HE.freezeOn;
    }
    const focus = document.getElementById('hp01-focus-strip');
    if (focus) {
      const n = st.selectedSubNodeId ? HP01_SUBNODES[st.selectedSubNodeId] : null;
      focus.textContent = n ? `מיקוד: ${n.id} — ${n.shortNameHe}` : 'מיקוד: HP01 — סקירה';
    }
  }

  /**
   * PACKAGE D: one fresh VM per frame while the HP01 cutaway is shown; the animator, the status strip and the card
   * rendered during the same frame read this one snapshot (no second "truth"). Outside the frame (button handlers,
   * "Step", imports) the card builds a fresh VM. Visual Freeze is not passed to the adapter: its visualPaused option
   * zeroes the conditional speeds and would hide UNKNOWN / UNCONFIRMED states; freeze is dtAnim = 0 in the scene.
   */
  buildHP01FrameViewModel() {
    if (!this.isHP01CutawayView() || !this.hp01Controller?.animationEnabled) {
      this.hp01FrameVM = null;
      return null;
    }
    const vm = buildHP01CutawayViewModel(this.sim, this.unitPrefs);
    this.hp01FrameVM = { vm, sim: this.sim };
    return vm;
  }

  getHP01ViewModelForCard() {
    const c = this.hp01FrameVM;
    if (this.hp01InFrame && c && c.sim === this.sim) return c.vm;
    return buildHP01CutawayViewModel(this.sim, this.unitPrefs);
  }

  getHP01AnimationStatus(vm) {
    return describeHP01AnimationStatus(vm, {
      globalPaused: Boolean(this.sim.paused),
      visualFreeze: Boolean(this.hp01Controller?.state.visualFreeze),
      enabled: this.hp01Controller?.animationEnabled !== false
    });
  }

  // Status strip of the toolbar follows every frame (text only rewritten on change); the card re-renders on a change
  syncHP01AnimationStatus(vm) {
    const el = document.getElementById('hp01-anim-status');
    if (!el || !vm || !this.isHP01CutawayView()) return;
    const st = this.getHP01AnimationStatus(vm);
    if (st.textHe === this.hp01LastAnimStatusText) return;
    this.hp01LastAnimStatusText = st.textHe;
    el.textContent = st.textHe;
    el.dataset.pause = st.pause;
    el.dataset.rotors = st.rotors;
    el.dataset.fans = st.fans;
    el.dataset.water = st.water;
    el.dataset.refrigerant = st.refrigerant;
    this.renderInspectorCard();
  }

  renderHP01CutawayCard(cardEl) {
    const vm = this.getHP01ViewModelForCard();
    this.hp01CardRenderCount = (this.hp01CardRenderCount || 0) + 1;
    cardEl.innerHTML = renderHP01CutawayCardHtml({
      vm,
      animStatus: this.getHP01AnimationStatus(vm),
      state: this.hp01Controller.state,
      purposeDict: HP01_PURPOSE_DICTIONARY,
      passport: RTXC_PROTOTYPE_PASSPORT,
      hp01Registry: COMPONENT_REGISTRY.HP01
    });
    cardEl.querySelector('[data-hp01-action="overview"]')?.addEventListener('click', () => this.hp01Controller.resetToOverview());
    cardEl.querySelector('[data-hp01-action="roof"]')?.addEventListener('click', () => this.switchViewMode('rooftop3d'));
  }

  loadScenario(scenarioId) {
    this.currentScenarioId = scenarioId;
    this.sim = createSimulationInstance(this.datasetMode);
    applyScenario(this.sim, scenarioId);

    // Advance appropriate initial time so the user immediately sees the scenario effect
    if (scenarioId === 'SCEN_01_NORMAL' && this.datasetMode === 'DEMO') {
      advanceSimulationTime(this.sim, 12.0);
    } else if (
      scenarioId === 'SCEN_04_ALL_BRANCHES_CLOSED' ||
      scenarioId === 'SCEN_09_SECONDARY_LEAK' ||
      scenarioId === 'SCEN_10_MAKEUP_FAIL_OPEN' ||
      scenarioId === 'SCEN_11_EXPANSION_TANK_ISOLATED'
    ) {
      advanceSimulationTime(this.sim, 16.0);
    } else {
      advanceSimulationTime(this.sim, 8.0);
    }

    const ambSlider = document.getElementById('ambient-temp-slider');
    const ambVal = document.getElementById('ambient-temp-val');
    if (ambSlider) ambSlider.value = this.sim.state.env.T_amb_C;
    if (ambVal) ambVal.textContent = `${this.sim.state.env.T_amb_C.toFixed(1)} °C`;

    const descEl = document.getElementById('scenario-description-bar');
    const sc = SCENARIOS[scenarioId];
    if (descEl && sc) {
      descEl.innerHTML = `<strong>${sc.nameHe}:</strong> ${sc.descriptionHe} <span class="ru-sub">(${sc.expectedBehaviorRu})</span>`;
    }

    this.updateAllUI();
  }

  updateControlButtons() {
    const btnPlay = document.getElementById('btn-play-pause');
    if (btnPlay) {
      btnPlay.textContent = this.sim.paused ? '▶ הפעל (Play)' : '⏸ השהה (Pause)';
      btnPlay.classList.toggle('paused', this.sim.paused);
    }
  }

  formatSI(val, fromUnit, dim, digits = 1) {
    if (val === null || val === undefined || Number.isNaN(val)) {
      return '<span class="missing-badge">אין נתונים (Нет данных)</span>';
    }
    const targetUnit = this.unitPrefs[dim] || fromUnit;
    return formatValueWithUnit(val, fromUnit, targetUnit, digits);
  }

  updateAllUI() {
    this.updateControlButtons();
    this.renderGlanceStrip();
    this.renderConsumersTable();
    this.renderAlarmsBar();
    this.renderInspectorCard();
    if (this.viewMode === 'pid') {
      this.pidView?.render(this.sim);
    }
  }

  renderGlanceStrip() {
    const s = this.sim.state;
    const el = document.getElementById('technician-glance-strip');
    if (!el) return;

    // 1. Heating status
    let heatBadge = `<span class="status-pill ok">פעיל (${this.formatSI(s.hp.Q_water_W, 'W', 'power', 1)})</span>`;
    if (s.hp.defrostActive) {
      heatBadge = `<span class="status-pill warn">הפשקה פעילה (${this.formatSI(s.hp.Q_water_W, 'W', 'power', 1)})</span>`;
    } else if (s.hp.outOfMap) {
      heatBadge = `<span class="status-pill alarm">חסום — מחוץ למפת עבודה!</span>`;
    } else if (!s.hp.heatingActive) {
      heatBadge = `<span class="status-pill neutral">מופסק (0 kW)</span>`;
    }

    // 2. Flow confirmation (FS-HP01 + FT-HP01)
    const flowBadge = s.primary.flowSwitchConfirmed
      ? `<span class="status-pill ok">מאושר (${this.formatSI(s.primary.qv_m3s, 'm³/s', 'flow', 1)})</span>`
      : `<span class="status-pill alarm">לא מאושר! (${this.formatSI(s.primary.qv_m3s, 'm³/s', 'flow', 1)})</span>`;

    // 3. Running pumps summary
    const runningPumps = [];
    if (s.primary.pumpA.state === 'running') runningPumps.push('PP01A');
    if (s.primary.pumpB.state === 'running') runningPumps.push('PP01B');
    if (s.distribution.pumpA.state === 'running') runningPumps.push('PD01A');
    if (s.distribution.pumpB.state === 'running') runningPumps.push('PD01B');
    const secRunningCount = s.branches.filter(
      (b) => b.secondary.pumpA.state === 'running' || b.secondary.pumpB.state === 'running'
    ).length;

    // 4. Standby readiness (1+1)
    const priStandbyOk = s.primary.pumpA.state === 'standby_ready' || s.primary.pumpB.state === 'standby_ready';
    const distStandbyOk = s.distribution.pumpA.state === 'standby_ready' || s.distribution.pumpB.state === 'standby_ready';
    const secStandbyOk = s.branches.every(
      (b) => b.secondary.pumpA.state === 'standby_ready' || b.secondary.pumpB.state === 'standby_ready'
    );
    const standbyBadge = (priStandbyOk && distStandbyOk && secStandbyOk)
      ? `<span class="status-pill ok">תקין (כל הקבוצות 1+1)</span>`
      : `<span class="status-pill warn">אובדן גיבוי בחלק מהקבוצות!</span>`;

    // 5. Pressure & Range
    const maxSecP = Math.max(...s.branches.map((b) => b.secondary.p_consumer_supply_Pa_g));
    const presWarn = maxSecP > 200000 || s.primary.p_suction_Pa_g < 50000;
    const presBadge = `<span class="status-pill ${presWarn ? 'warn' : 'ok'}">ראשי: ${this.formatSI(s.primary.p_discharge_Pa_g, 'Pa_g', 'pressure', 2)} | מעיל מקס׳: ${this.formatSI(maxSecP, 'Pa_g', 'pressure', 2)}</span>`;

    // 6. Startup Stage & COP
    const stageHe = STARTUP_STAGE_LABELS_HE[s.automation.startupStage] || s.automation.startupStage;
    const copUnitStr = s.hp.COP_unit !== null ? s.hp.COP_unit.toFixed(2) : '—';
    const copSysStr = s.hp.COP_system !== null ? s.hp.COP_system.toFixed(2) : '—';

    el.innerHTML = `
      <div class="glance-card">
        <div class="glance-label">1. מצב חימום (HP01)</div>
        <div class="glance-value">${heatBadge}</div>
        <div class="glance-sub">טמפ׳ יציאת RTXC: <strong>${this.formatSI(s.hp.T_out_C, '°C', 'temp', 1)}</strong> | אוגר: <strong>${this.formatSI(s.buffer.T_top_C, '°C', 'temp', 1)}</strong></div>
      </div>
      <div class="glance-card">
        <div class="glance-label">2. אישור ספיקה (FS-HP01 + FT)</div>
        <div class="glance-value">${flowBadge}</div>
        <div class="glance-sub">מינימום נדרש: 15.3 L/s | ספיקת חלוקה: ${this.formatSI(s.distribution.qv_total_m3s, 'm³/s', 'flow', 1)}</div>
      </div>
      <div class="glance-card">
        <div class="glance-label">3. משאבות עובדות כעת</div>
        <div class="glance-value"><span class="status-pill ok">${runningPumps.join(', ') || 'אין'} + ${secRunningCount}/5 משניות</span></div>
        <div class="glance-sub">שלב Symbio 800: ${stageHe}</div>
      </div>
      <div class="glance-card">
        <div class="glance-label">4. זמינות גיבוי (1+1 Redundancy)</div>
        <div class="glance-value">${standbyBadge}</div>
        <div class="glance-sub">הוצאת גיבוי לתחזוקה אינה עוצרת משאבה עובדת</div>
      </div>
      <div class="glance-card">
        <div class="glance-label">5. לחצים ומגבלת מעיל (≤2 bar לא מאומת)</div>
        <div class="glance-value">${presBadge}</div>
        <div class="glance-sub">טווח עבודה ראשי: 1.2–4.5 bar(g) | מעיל: דורש אימות דרכון</div>
      </div>
      <div class="glance-card">
        <div class="glance-label">6. יעילות (COP) ואנרגיה מצטברת</div>
        <div class="glance-value"><span class="status-pill neutral">COP יחידה: ${copUnitStr} | מתקן: ${copSysStr}</span></div>
        <div class="glance-sub">תפוקה: ${s.energy.E_useful_consumers_kWh.toFixed(1)} kWh | חשמל: ${s.energy.E_electric_total_kWh.toFixed(1)} kWh</div>
      </div>
    `;
  }

  renderConsumersTable() {
    const tbody = document.getElementById('consumers-table-body');
    if (!tbody) return;
    const s = this.sim.state;

    tbody.innerHTML = s.branches.map((br, i) => {
      const idx = i + 1;
      const pad = String(idx).padStart(2, '0');
      const isSelected = this.selectedComponentId === `HX${pad}` || this.selectedComponentId === `CONS${pad}`;
      const pWarn = br.secondary.exceedsUnconfirmed2Bar;
      const missing = br.missingDataBlocked;

      const pumpAStr = br.secondary.pumpA.state === 'running' ? 'A:עובדת' :
                       br.secondary.pumpA.state === 'standby_ready' ? 'A:גיבוי' : `A:${br.secondary.pumpA.state}`;
      const pumpBStr = br.secondary.pumpB.state === 'running' ? 'B:עובדת' :
                       br.secondary.pumpB.state === 'standby_ready' ? 'B:גיבוי' : `B:${br.secondary.pumpB.state}`;

      return `
        <tr class="${isSelected ? 'selected-row' : ''} ${missing ? 'missing-row' : ''}" data-select-comp="HX${pad}">
          <td>
            <strong>צרכן ${idx}</strong> <span class="tag-mono">(HX${pad})</span>
            ${missing ? '<span class="badge-missing">אין נתונים (SITE)</span>' : ''}
          </td>
          <td>${this.formatSI(br.consumer.T_choc_C, '°C', 'temp', 1)} <span class="temp- target-sub">(יעד ${br.consumer.T_choc_target_C ?? '—'}°C)</span></td>
          <td class="temp-sec-sup">${this.formatSI(br.hx.T_sec_out_C, '°C', 'temp', 1)} <span class="temp-target-sub">(פקודה ${br.secondary.T_supply_setpoint_C ?? '—'}°C)</span></td>
          <td>${this.formatSI(br.hx.T_sec_in_C, '°C', 'temp', 1)}</td>
          <td>${this.formatSI(br.primary.qv_m3s, 'm³/s', 'flow', 2)}</td>
          <td>${this.formatSI(br.secondary.qv_m3s, 'm³/s', 'flow', 2)}</td>
          <td><strong>${missing ? 'אין נתונים' : this.formatSI(br.hx.Q_W, 'W', 'power', 1)}</strong></td>
          <td>${(br.primary.valveCommand * 100).toFixed(0)}% / <strong>${(br.primary.valveActual * 100).toFixed(0)}%</strong></td>
          <td class="${pWarn ? 'cell-warn' : ''}">
            ${this.formatSI(br.secondary.p_consumer_supply_Pa_g, 'Pa_g', 'pressure', 2)}
            <span class="temp-target-sub">(z=${br.secondary.z_consumer_m}m${pWarn ? ' | >2bar*' : ''})</span>
          </td>
          <td><span class="pump-mini-tag">${pumpAStr} | ${pumpBStr}</span></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr[data-select-comp]').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-select-comp');
        this.selectedComponentId = id;
        if (this.scene3d) this.scene3d.setSelection(id, this.showConnectionsOnly, this.sim);
        if (this.pidView) {
          this.pidView.setSelection(id, this.showConnectionsOnly);
          this.pidView.render(this.sim);
        }
        this.syncHP01Toolbar();
        this.renderInspectorCard();
        this.renderConsumersTable();
      });
    });
  }

  renderAlarmsBar() {
    const container = document.getElementById('alarms-strip-container');
    if (!container) return;
    const alarms = this.sim.state.alarms;

    if (alarms.length === 0) {
      container.innerHTML = `<div class="alarm-empty-ok">✓ אין התראות פעילות — כל המערכות בתחום המותר (Normal Operation)</div>`;
      return;
    }

    container.innerHTML = alarms.map((al) => `
      <div class="alarm-item ${al.severity} ${al.acknowledged ? 'acked' : ''}" data-alarm-comp="${al.componentId}">
        <div class="alarm-main">
          <span class="alarm-code">[${al.code}]</span>
          <strong class="alarm-comp">${al.componentId}:</strong>
          <span class="alarm-text-he">${al.titleHe}</span>
          <span class="alarm-text-ru">(${al.causeRu})</span>
        </div>
        <div class="alarm-actions">
          <button class="btn-xs" data-ack-alarm="${al.code}">
            ${al.acknowledged ? '✓ אושר ע"י טכנאי (Acked)' : 'אשר הודעה (Ack — לא מאפס הגנה)'}
          </button>
          <button class="btn-xs btn-reset-prot" data-reset-prot="${al.code}">איפוס הגנה (Reset)</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-ack-alarm]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        acknowledgeAlarm(this.sim, btn.getAttribute('data-ack-alarm'));
        this.renderAlarmsBar();
      });
    });

    container.querySelectorAll('[data-reset-prot]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetLatchedProtection(this.sim);
        this.updateAllUI();
      });
    });

    container.querySelectorAll('[data-alarm-comp]').forEach((row) => {
      row.addEventListener('click', () => {
        const compId = row.getAttribute('data-alarm-comp');
        if (COMPONENT_REGISTRY[compId]) {
          this.selectedComponentId = compId;
          if (this.scene3d) this.scene3d.setSelection(compId, this.showConnectionsOnly, this.sim);
          if (this.pidView) {
            this.pidView.setSelection(compId, this.showConnectionsOnly);
            this.pidView.render(this.sim);
          }
          this.syncHP01Toolbar();
          this.renderInspectorCard();
        }
      });
    });
  }

  renderInspectorCard() {
    const cardEl = document.getElementById('side-inspector-card');
    if (!cardEl) return;
    if (this.isHP01CutawayView() && this.hp01Controller) {
      this.renderHP01CutawayCard(cardEl);
      return;
    }
    const compId = this.selectedComponentId || 'HP01';
    const comp = COMPONENT_REGISTRY[compId];
    if (!comp) return;

    const s = this.sim.state;
    const conns = getComponentConnections(compId);
    const provLabel = PROVENANCE_STATUS_LABELS[comp.status] || { he: comp.status, ru: comp.status, badgeColor: '#64748b' };

    // Build live values & command-vs-response specific to the selected component
    let liveRows = [];
    let cmdVsRespRows = [];
    let actionButtonsHtml = '';

    if (compId === 'HP01') {
      liveRows = [
        ['טמפ׳ כניסת מים (T_in)', this.formatSI(s.hp.T_in_C, '°C', 'temp', 1)],
        ['טמפ׳ יציאת מים (T_out)', this.formatSI(s.hp.T_out_C, '°C', 'temp', 1)],
        ['ספיקת מים בפועל (FT-HP01)', this.formatSI(s.primary.qv_m3s, 'm³/s', 'flow', 1)],
        ['מפסק זרימה (FS-HP01 6s)', s.primary.flowSwitchConfirmed ? 'מאושר (Confirmed)' : 'לא מאושר (Blocked)'],
        ['הספק תרמי למים (Q_water)', this.formatSI(s.hp.Q_water_W, 'W', 'power', 1)],
        ['הספק חשמלי (P_el_HP)', this.formatSI(s.hp.P_el_total_W, 'W', 'power', 1)],
        ['COP רגעי ליחידה', s.hp.COP_unit ? s.hp.COP_unit.toFixed(2) : 'לא מוגדר'],
        ['מעגל קירור R513A (מחושב)', `T_evap=${s.hp.refrigerant.T_evap_C.toFixed(1)}°C (${s.hp.refrigerant.p_evap_bar_a.toFixed(2)} bar_a) | T_cond=${s.hp.refrigerant.T_cond_C.toFixed(1)}°C (${s.hp.refrigerant.p_cond_bar_a.toFixed(2)} bar_a)`]
      ];
      cmdVsRespRows = [
        ['הרשאת הפעלה (Enable)', s.hp.commandEnable ? 'מופעל (ON)' : 'מופסק (OFF)', s.hp.heatingActive ? 'עובד' : s.hp.defrostActive ? 'בהפשקה' : 'עצור'],
        ['עומס מדחסים (C1+C2)', `${s.hp.commandLoadPct.toFixed(1)}%`, `${s.hp.actualLoadPct.toFixed(1)}%`],
        ['מהירות 12 מאווררי EC', `${s.hp.heatingActive || s.hp.defrostActive ? 'Auto EC' : '0%'}`, `${s.hp.fanSpeedPct.toFixed(0)}%`]
      ];
      actionButtonsHtml = `
        <div class="inspector-param-edit" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;">
          <label for="inp-hp01-lwt-setpoint" style="font-size:11px;">נקודת קביעה LWT (°C):</label>
          <input type="number" id="inp-hp01-lwt-setpoint" step="0.5" min="25" max="55" value="${this.sim.dataset.hp01.leavingWaterTempSetpointC.value}" style="width:68px;padding:2px 4px;background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:4px;" />
          <button class="btn-card-action" id="btn-apply-hp01-params">החל וחישוב מחדש</button>
        </div>
      `;
    } else if (compId === 'BT01') {
      liveRows = [
        ['טמפ׳ שכבה עליונה (T_top)', this.formatSI(s.buffer.T_top_C, '°C', 'temp', 2)],
        ['טמפ׳ שכבה אמצעית (T_mid)', this.formatSI(s.buffer.T_mid_C, '°C', 'temp', 2)],
        ['טמפ׳ שכבה תחתונה (T_bot)', this.formatSI(s.buffer.T_bot_C, '°C', 'temp', 2)],
        ['ספיקה מ-RTXC (q_pri)', this.formatSI(s.primary.qv_m3s, 'm³/s', 'flow', 2)],
        ['ספיקה למערכת החלוקה (q_dist)', this.formatSI(s.distribution.qv_total_m3s, 'm³/s', 'flow', 2)],
        ['איבודי חום לסביבה (Q_loss)', `${(s.buffer.Q_loss_W / 1000).toFixed(2)} kW`]
      ];
      cmdVsRespRows = [
        ['תפקיד הידראולי', 'הפרדת ספיקות (4 חיבורים)', `Δq = ${this.formatSI(s.primary.qv_m3s - s.distribution.qv_total_m3s, 'm³/s', 'flow', 2)}`]
      ];
    } else if (compId.startsWith('HX')) {
      const idx = Number(compId.slice(2)) - 1;
      const br = s.branches[idx];
      liveRows = [
        ['כניסה/יציאה ראשית', `${this.formatSI(br.hx.T_pri_in_C, '°C', 'temp', 1)} → ${this.formatSI(br.hx.T_pri_out_C, '°C', 'temp', 1)}`],
        ['כניסה/יציאה משנית (נגדי)', `${this.formatSI(br.hx.T_sec_in_C, '°C', 'temp', 1)} → ${this.formatSI(br.hx.T_sec_out_C, '°C', 'temp', 1)}`],
        ['ספיקה ראשית / משנית', `${this.formatSI(br.primary.qv_m3s, 'm³/s', 'flow', 2)} / ${this.formatSI(br.secondary.qv_m3s, 'm³/s', 'flow', 2)}`],
        ['הספק מועבר (Q_HX)', br.missingDataBlocked ? 'אין נתונים (SITE)' : this.formatSI(br.hx.Q_W, 'W', 'power', 1)],
        ['יעילות ε / NTU / Cr', `ε=${br.hx.effectiveness.toFixed(3)} | NTU=${br.hx.NTU.toFixed(2)} | Cr=${br.hx.Cr.toFixed(2)}`],
        ['מפל לחץ ראשי (Δp_HX)', `${(br.primary.dp_hx_Pa / 1000).toFixed(1)} kPa (מקדם סתימה ×${br.hx.foulingFactor.toFixed(2)})`]
      ];
      cmdVsRespRows = [
        ['שסתום ויסות ראשי ' + `CV0${idx + 1}`, `${(br.primary.valveCommand * 100).toFixed(1)}%`, `${(br.primary.valveActual * 100).toFixed(1)}%`],
        ['בידוד שלוחה', br.primary.isolated ? 'סגור (Isolated)' : 'פתוח (Open)', br.primary.qv_m3s > 1e-4 ? 'זרימה פעילה' : 'אין זרימה']
      ];
      actionButtonsHtml = `
        <button class="btn-card-action" id="act-toggle-branch">
          ${br.primary.isolated ? 'פתח שלוחה זו' : 'סגור / בודד שלוחה זו'}
        </button>
        <div class="inspector-param-edit" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;">
          <label for="inp-branch-setpoint" style="font-size:11px;">יעד משני (°C):</label>
          <input type="number" id="inp-branch-setpoint" step="0.5" min="20" max="54" value="${this.sim.dataset.branches[idx].secondarySupplyTempSetpointC.value}" style="width:60px;padding:2px 4px;background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:4px;" />
          <label for="inp-branch-demand-kw" style="font-size:11px;">עומס (kW):</label>
          <input type="number" id="inp-branch-demand-kw" step="5" min="10" max="250" value="${(this.sim.dataset.branches[idx].nominalThermalDemandW.value / 1000).toFixed(1)}" style="width:64px;padding:2px 4px;background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:4px;" />
          <button class="btn-card-action" id="btn-apply-branch-params">החל וחישוב מחדש</button>
        </div>
      `;
    } else if (compId.startsWith('CONS')) {
      const idx = Number(compId.slice(4)) - 1;
      const br = s.branches[idx];
      liveRows = [
        ['טמפ׳ שוקולד תהליכית (≠ מים)', this.formatSI(br.consumer.T_choc_C, '°C', 'temp', 2)],
        ['טמפ׳ מי הזנה למעיל (T_sec_sup)', this.formatSI(br.hx.T_sec_out_C, '°C', 'temp', 2)],
        ['טמפ׳ מי חזרה מהמעיל (T_sec_ret)', this.formatSI(br.hx.T_sec_in_C, '°C', 'temp', 2)],
        ['גובה גיאודזי ביחס לגג (z_i)', `${br.secondary.z_consumer_m} m`],
        ['לחץ בהזנת מעיל הצרכן (בגובה z_i)', `${this.formatSI(br.secondary.p_consumer_supply_Pa_g, 'Pa_g', 'pressure', 2)} (${(br.secondary.p_consumer_supply_Pa_a / 1e5).toFixed(2)} bar_a)`],
        ['סטטוס מגבלת 2 bar (מפי טכנאי)', br.secondary.exceedsUnconfirmed2Bar ? '⚠️ חורג מ-2 bar(g) — דורש אימות דרכון!' : 'מתחת ל-2 bar(g) (טרם אומת בדרכון)']
      ];
      cmdVsRespRows = [
        ['דרישת עומס צרכן', br.missingDataBlocked ? 'אין נתונים (SITE)' : `${(br.consumer.Q_demand_W / 1000).toFixed(1)} kW`, this.formatSI(br.hx.Q_W, 'W', 'power', 1)]
      ];
    } else if (comp.category === 'pump') {
      let pObj = null;
      if (compId === 'PP01A') pObj = s.primary.pumpA;
      else if (compId === 'PP01B') pObj = s.primary.pumpB;
      else if (compId === 'PD01A') pObj = s.distribution.pumpA;
      else if (compId === 'PD01B') pObj = s.distribution.pumpB;
      else {
        const m = compId.match(/^PS0(\d)([AB])$/);
        if (m) {
          const br = s.branches[Number(m[1]) - 1];
          pObj = m[2] === 'A' ? br.secondary.pumpA : br.secondary.pumpB;
        }
      }
      if (pObj) {
        liveRows = [
          ['סטטוס משאבה', PUMP_STATE_LABELS_HE[pObj.state] || pObj.state],
          ['מהירות יחסית (n/n_0)', `${(pObj.speedRatio * 100).toFixed(0)}%`]
        ];
        cmdVsRespRows = [
          ['פקודת בקר', pObj.commandRun ? 'הפעל (RUN)' : 'עצור / גיבוי', PUMP_STATE_LABELS_HE[pObj.state] || pObj.state]
        ];
        actionButtonsHtml = `
          <button class="btn-card-action warn" id="act-trip-pump">דמה תקלת משאבה (Fault)</button>
          <button class="btn-card-action" id="act-maint-pump">הוצא לתחזוקה / החזר לגיבוי</button>
        `;
      }
    } else {
      liveRows = [
        ['סוג רכיב', comp.category],
        ['מיקום תלת-ממדי על הגג', `(${comp.pos3d.join(', ')}) m`]
      ];
      cmdVsRespRows = [
        ['מצב מערכת', 'מנוטר ב-CP01', 'תקין']
      ];
    }

    cardEl.innerHTML = `
      <div class="inspector-header">
        <div>
          <span class="inspector-id-badge">${comp.id}</span>
          <h3 class="inspector-title-he">${comp.labelHe}</h3>
          <div class="inspector-title-ru">${comp.labelRu}</div>
        </div>
        <button class="btn-cutaway-jump" id="btn-jump-cutaway" title="פתח רכיב זה בחתך תלת-ממדי">🔍 חתך 3D</button>
      </div>

      <div class="inspector-section">
        <div class="sec-label">ייעוד הנדסי (Назначение):</div>
        <p class="sec-text">${comp.purposeHe}</p>
        <p class="sec-text-ru">${comp.purposeRu}</p>
      </div>

      <div class="inspector-section">
        <div class="sec-label">ערכים נוכחיים (Текущие величины):</div>
        <table class="inspector-kv-table">
          ${liveRows.map(([k, v]) => `<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`).join('')}
        </table>
      </div>

      <div class="inspector-section">
        <div class="sec-label">פקודה מול תגובה בפועל (Команда и отклик):</div>
        <table class="inspector-cmd-table">
          <thead><tr><th>פרמטר</th><th>פקודה (Cmd)</th><th>בפועל (Actual)</th></tr></thead>
          <tbody>
            ${cmdVsRespRows.map(([p, c, r]) => `<tr><td>${p}</td><td>${c}</td><td><strong>${r}</strong></td></tr>`).join('')}
          </tbody>
        </table>
        ${actionButtonsHtml ? `<div class="inspector-actions-row">${actionButtonsHtml}</div>` : ''}
      </div>

      <div class="inspector-section">
        <div class="sec-label">כניסות, יציאות וחיבורים (${conns.length} חיבורים מרישום הטופולוגיה):</div>
        <ul class="inspector-conn-list">
          ${conns.map((c) => `
            <li>
              <span class="conn-id">${c.id}</span>:
              <strong>${c.from}</strong>.${c.fromPort} → <strong>${c.to}</strong>.${c.toPort}
              <span class="conn-meta">(${c.DN}, L=${c.L_m}m, [${c.sensors.join(', ')}])</span>
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="inspector-section">
        <div class="sec-label">הגנות משויכות (Связанные защиты):</div>
        <div class="prot-tags">
          ${comp.protections.map((p) => `<span class="prot-tag">${p}</span>`).join('')}
        </div>
      </div>

      <div class="inspector-section">
        <div class="sec-label">מקור נתונים וסטטוס נתונים חסרים (Источник и статус):</div>
        <div class="prov-box" style="border-right: 4px solid ${provLabel.badgeColor};">
          <div><strong>סטטוס:</strong> ${provLabel.he} (${provLabel.ru})</div>
          <div class="prov-source"><strong>מקור:</strong> ${comp.source}</div>
          ${this.datasetMode === 'SITE' && comp.status !== 'confirmed_by_doc'
            ? `<div class="missing-alert">במצב נתוני אתר (SITE): פרמטרים ללא דרכון מאומת מסומנים "אין נתונים" וחישובים תלויים נחסמים נקודתית.</div>`
            : ''}
        </div>
      </div>
    `;

    // Bind Inspector buttons
    document.getElementById('btn-jump-cutaway')?.addEventListener('click', () => {
      this.switchViewMode('cutaway3d');
    });

    document.getElementById('act-toggle-branch')?.addEventListener('click', () => {
      const idx = Number(compId.slice(2)) - 1;
      const br = this.sim.state.branches[idx];
      br.primary.isolated = !br.primary.isolated;
      advanceSimulationTime(this.sim, 2.0);
      this.updateAllUI();
    });

    document.getElementById('btn-apply-hp01-params')?.addEventListener('click', () => {
      const lwtVal = Number(document.getElementById('inp-hp01-lwt-setpoint')?.value);
      if (Number.isFinite(lwtVal) && lwtVal >= 15 && lwtVal <= 60) {
        this.sim.dataset.hp01.leavingWaterTempSetpointC.value = lwtVal;
        this.recalculateFromCurrentDataset();
      }
    });

    document.getElementById('btn-apply-branch-params')?.addEventListener('click', () => {
      const idx = Number(compId.slice(2)) - 1;
      const spVal = Number(document.getElementById('inp-branch-setpoint')?.value);
      const kwVal = Number(document.getElementById('inp-branch-demand-kw')?.value);
      if (Number.isFinite(spVal) && spVal >= 10 && spVal <= 75) {
        this.sim.dataset.branches[idx].secondarySupplyTempSetpointC.value = spVal;
      }
      if (Number.isFinite(kwVal) && kwVal >= 0 && kwVal <= 1000) {
        this.sim.dataset.branches[idx].nominalThermalDemandW.value = kwVal * 1000.0;
      }
      this.recalculateFromCurrentDataset();
    });

    document.getElementById('act-trip-pump')?.addEventListener('click', () => {
      this.mutatePumpState(compId, 'fault');
    });

    document.getElementById('act-maint-pump')?.addEventListener('click', () => {
      this.mutatePumpState(compId, 'toggle_maint');
    });
  }

  mutatePumpState(compId, action) {
    const s = this.sim.state;
    let pObj = null;
    if (compId === 'PP01A') pObj = s.primary.pumpA;
    else if (compId === 'PP01B') pObj = s.primary.pumpB;
    else if (compId === 'PD01A') pObj = s.distribution.pumpA;
    else if (compId === 'PD01B') pObj = s.distribution.pumpB;
    else {
      const m = compId.match(/^PS0(\d)([AB])$/);
      if (m) {
        const br = s.branches[Number(m[1]) - 1];
        pObj = m[2] === 'A' ? br.secondary.pumpA : br.secondary.pumpB;
      }
    }
    if (!pObj) return;
    if (action === 'fault') {
      pObj.fault = !pObj.fault;
    } else if (action === 'toggle_maint') {
      pObj.maintenance = !pObj.maintenance;
      if (pObj.maintenance) pObj.fault = false;
    }
    advanceSimulationTime(this.sim, 2.0);
    this.updateAllUI();
  }

  renderActiveModals() {
    // 1. Graphs & Economics Modal
    const econBox = document.getElementById('modal-econ-summary');
    if (econBox) {
      const s = this.sim.state;
      const E_useful = s.energy.E_useful_consumers_kWh;
      const E_elec = s.energy.E_electric_total_kWh;
      const copPeriod = E_elec > 1e-6 ? (E_useful / E_elec).toFixed(2) : 'לא מוגדר (מכנה 0)';
      const hpCost = E_elec * this.econConfig.elecTariff_ILS_per_kWh;
      const gasInput_kWh = E_useful / this.econConfig.gasBoilerEfficiency;
      const gasCost = gasInput_kWh * this.econConfig.gasTariff_ILS_per_kWh_LHV;
      const ratio = hpCost > 1e-5 ? (gasCost / hpCost).toFixed(2) : '—';

      econBox.innerHTML = `
        <div class="modal-grid-2">
          <div class="modal-card">
            <h4>מאזן אנרגיה ו-COP מופרד (סעיף 9.10)</h4>
            <p><strong>COP רגעי יחידת RTXC (גבול יחידה בלבד):</strong> ${s.hp.COP_unit ? s.hp.COP_unit.toFixed(2) : '—'}</p>
            <p><strong>COP רגעי מתקן כולל (כולל משאבות ועזר):</strong> ${s.hp.COP_system ? s.hp.COP_system.toFixed(2) : '—'}</p>
            <p><strong>COP תקופתי מצטבר (E_useful / E_electric):</strong> ${copPeriod}</p>
            <p><strong>אנרגיה שהועברה ל-5 הצרכנים:</strong> ${E_useful.toFixed(2)} kWh</p>
            <p><strong>צריכת חשמל מצטברת (RTXC + משאבות):</strong> ${E_elec.toFixed(2)} kWh</p>
            <p><strong>שינוי אנרגיה באוגר BT01:</strong> ${s.energy.E_buffer_change_kWh.toFixed(2)} kWh</p>
          </div>
          <div class="modal-card">
            <h4>השוואה מול דוד גז (רק עבור תפוקה שווה ותעריפים מוגדרים)</h4>
            <p class="ru-sub">סעיף 9.10: אין לקבוע מראש "חיסכון פי 3" — החישוב תלוי בתעריפים, בנצילות הדוד וב-COP בפועל.</p>
            <p><strong>תעריף חשמל מוגדר:</strong> ${this.econConfig.elecTariff_ILS_per_kWh} ₪/kWh</p>
            <p><strong>תעריף גז (LHV) ונצילות דוד:</strong> ${this.econConfig.gasTariff_ILS_per_kWh_LHV} ₪/kWh | η=${(this.econConfig.gasBoilerEfficiency * 100).toFixed(0)}%</p>
            <p><strong>עלות חשמל למתקן משאבת חום בתקופה:</strong> ${hpCost.toFixed(2)} ₪</p>
            <p><strong>עלות גז שוות-ערך לאותה כמות חום מועילה:</strong> ${gasCost.toFixed(2)} ₪ (יחס עלות גז/חשמל: ${ratio})</p>
          </div>
        </div>
      `;
      this.drawHistoryChart();
    }

    // 2. Service, RTXC Passport & Acceptance Checks Modal
    const serviceBox = document.getElementById('modal-service-content');
    if (serviceBox) {
      const p = RTXC_PROTOTYPE_PASSPORT;
      const topoCheck = verifyTopologyIntegrity();
      serviceBox.innerHTML = `
        <div class="modal-grid-2">
          <div class="modal-card">
            <h4>דרכון אב-טיפוס ויזואלי וחישובי: ${p.shortModelName.value}</h4>
            <p><strong>קוד תצורה (28 ספרות לפי עמ' 8, מוגדר להדגמה):</strong> <code>${p.modelDesignation.value}</code></p>
            <p><strong>תפוקת חימום נומינלית (EN 14511, 7°C/6°C, מים 40/45°C, ללא מודול משאבות):</strong> ${(p.nominalHeatingCapacity.value / 1000).toFixed(0)} kW | <strong>COP:</strong> ${p.nominalHeatingCOP.value} | <strong>SCOP (EN 14825):</strong> ${p.nominalHeatingSCOP.value} (P<sub>design,h</sub> = ${(p.nominalHeatingPdesignhW.value / 1000).toFixed(0)} kW)</p>
            <p><strong>קרר ושמן (עמ' 16, 23):</strong> ${p.refrigerantType.value} — סה"כ <strong>${p.refrigerantChargeTotal.value} ק"ג</strong> (${p.refrigerantChargeCkt1.value} + ${p.refrigerantChargeCkt2.value} ק"ג) | שמן ${p.oilType.value}: ${p.oilChargeTotal.value} ק"ג</p>
            <p><strong>מדחסים ומעגלים:</strong> ${p.numRefrigerantCircuits.value} מעגלים, ${p.numCompressors.value} מדחסי בורג תאומים (RLA=${p.compressorRLAEach.value}A, LRA=${p.compressorLRAEach.value}A) + אקונומייזר BPHE (עמ' 6, 47, 48)</p>
            <p><strong>מאווררים (עמ' 39):</strong> ${p.numFans.value} × ${p.fanMotorPowerEach.value} kW (${p.fanType.value}, FLA=${p.fanMotorFLAEach.value}A)</p>
            <p><strong>מידות ומשקל (עמ' 17, 23 ללא מודול משאבות):</strong> ${p.lengthMm.value}×${p.widthMm.value}×${p.heightMm.value} מ"מ (7882 מ"מ בעמ' 19) | משקל משלוח: <strong>${p.shippingWeightKg.value} ק"ג</strong> | משקל עבודה: <strong>${p.operatingWeightKg.value} ק"ג</strong> (עם מודול משאבות: ${p.shippingWeightWithPumpKg.value}/${p.operatingWeightWithPumpKg.value} ק"ג)</p>
            <p><strong>מודול שאיבה פנימי:</strong> ללא (ספרה 28=N, בקרת משאבה כפולה חיצונית 1K27/1K28 ספרה 27=D)</p>
          </div>
          <div class="modal-card">
            <h4>סתירות ופערים שזוהו בתיעוד (סעיף 2 ו-3)</h4>
            <ul class="gap-list">
              ${DOCUMENTED_CONTRADICTIONS_AND_GAPS.map((g) => `<li><strong>${g.id} (${g.topic}):</strong> ${g.findingRu}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div class="modal-card" style="margin-top:12px;">
          <h4>סטטוס בדיקות קבלה הנדסיות (סעיף 15)</h4>
          <p>בדיקת שלמות טופולוגיה בזמן אמת: <strong>${topoCheck.passed ? '✓ PASSED (5 מחליפי חום × 4 פורטים, 66 חיבורים, 0 מכלים מנותקים)' : 'FAILED'}</strong></p>
          <p class="ru-sub">להרצת חבילת הבדיקות המלאה בטרמינל עם חישוב שאריות מסה ואנרגיה ללא חיתוך: <code>node tests/verify_acceptance.mjs</code>.</p>
        </div>
      `;
    }
  }

  drawHistoryChart() {
    const canvas = document.getElementById('history-trend-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const hist = this.sim.state.history;
    if (hist.length < 2) return;

    const drawSeries = (key, color, minY, maxY) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      hist.forEach((pt, idx) => {
        const x = 45 + (idx / Math.max(1, hist.length - 1)) * (w - 65);
        const val = pt[key] ?? minY;
        const y = h - 28 - ((val - minY) / (maxY - minY)) * (h - 48);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = 20 + (g / 4) * (h - 48);
      ctx.beginPath();
      ctx.moveTo(45, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();
    }

    drawSeries('T_hp_out', '#f59e0b', 20, 65);
    drawSeries('T_buf_top', '#2dd4bf', 20, 65);
    drawSeries('T_sec1_out', '#38bdf8', 20, 65);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText('כתום: T_out RTXC (°C)  |  טורקיז: T_top BT01 (°C)  |  כחול: T_sec_out צרכן 1 (°C)', 55, 16);
  }

  stepFrameByWallDt(dtRealSeconds) {
    const dtClamped = Math.min(0.25, Math.max(0.0, dtRealSeconds));
    const dtSim = dtClamped * (this.sim.timeMultiplier || 1.0);
    if (!this.sim.paused && dtSim > 0) {
      advanceSimulationTime(this.sim, dtSim);
    }
    return dtClamped;
  }

  startLoop() {
    let lastTime = performance.now();
    let uiTimer = 0;

    const frame = (now) => {
      const dtReal = this.stepFrameByWallDt((now - lastTime) / 1000);
      lastTime = now;

      this.hp01InFrame = true;
      if (this.viewMode !== 'pid' && this.scene3d) {
        const hp01VM = this.buildHP01FrameViewModel();
        this.scene3d.updateAndRender(this.sim, dtReal, { hp01VM });
        this.syncHP01AnimationStatus(hp01VM);
      }

      uiTimer += dtReal;
      if (uiTimer >= 0.35) {
        uiTimer = 0;
        if (!this.sim.paused) {
          this.renderGlanceStrip();
          this.renderConsumersTable();
          this.renderAlarmsBar();
          this.renderInspectorCard();
          if (this.viewMode === 'pid') {
            this.pidView?.render(this.sim);
          }
        }
      }

      this.hp01InFrame = false;
      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new PlantSimulationApp();
  window.plantApp = app;

  const params = new URLSearchParams(window.location.search);
  const scen = params.get('scenario');
  if (scen && SCENARIOS[scen]) {
    const sel = document.getElementById('scenario-select');
    if (sel) sel.value = scen;
    app.loadScenario(scen);
  }
  const comp = params.get('comp');
  if (comp && COMPONENT_REGISTRY[comp]) {
    app.selectedComponentId = comp;
    app.scene3d?.setSelection(comp, app.showConnectionsOnly, app.sim);
    app.pidView?.setSelection(comp, app.showConnectionsOnly);
    app.renderInspectorCard();
    app.renderConsumersTable();
  }
  const view = params.get('view');
  if (view === 'modules3d') {
    app.switchViewMode('rooftop3d');
    app.scene3d?.focusOnModulesBank();
  } else if (view === 'cutaway3d' || view === 'pid' || view === 'rooftop3d') {
    app.switchViewMode(view);
  }
});
