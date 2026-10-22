/**
 * PACKAGE C (HP01-PACKAGE-C-INTEGRATION-01): coordinator of the accepted static HP01 cutaway inside Rooftop3DScene.
 *  - Builds HP01CutawayAssembly lazily ONCE per application lifetime and re-uses it.
 *  - Owns the single selection / camera preset / circuit filter / casing state (one source for card, focus strip,
 *    list, highlight and preset).
 *  - Picks on assembly.pickableMeshes only (never the rooftop list); child meshes resolve to the canonical sub-node ID.
 *  - Applies camera presets instantly (no tween).
 *  - PACKAGE D: owns the single HP01ProcessAnimator (created once with the assembly), the Visual Freeze flag and the
 *    phase reset on a new simulation object; motion is driven only by updateAnimation(vm, dtAnim, sim) from the scene.
 */

import * as THREE from 'three';
import { createHP01CutawayAssembly } from './hp01_cutaway_builder.mjs';
import { HP01ProcessAnimator } from './hp01_process_animation.mjs';
import { HP01_SUBNODES, HP01_CAMERA_PRESETS, HP01_NODE_PIPES } from './hp01_cutaway_meta.mjs';

// Accepted R2–R4 mapping (fixtures-registry.json → cameraPresetsCatalog.subNodeDefaultCameraPresetMap); equality is tested.
export const HP01_SUBNODE_DEFAULT_CAMERA_PRESET = Object.freeze({
  COMP1: 'COMP1_AND_OIL_DETAIL',
  COMP2: 'COMP2_AND_OIL_DETAIL',
  OS1: 'COMP1_AND_OIL_DETAIL',
  OS2: 'COMP2_AND_OIL_DETAIL',
  'OIL-CKT1': 'COMP1_AND_OIL_DETAIL',
  'OIL-CKT2': 'COMP2_AND_OIL_DETAIL',
  WHEX: 'WHEX_AND_DOMAINS_DETAIL',
  'FS-HP01': 'WHEX_AND_DOMAINS_DETAIL',
  'DRAIN-SYS': 'WHEX_AND_DOMAINS_DETAIL',
  ECON1: 'ECON_AND_RECEIVER_BRIDGE',
  ECON2: 'ECON_AND_RECEIVER_BRIDGE',
  REC1: 'ECON_AND_RECEIVER_BRIDGE',
  REC2: 'ECON_AND_RECEIVER_BRIDGE',
  'EXV-C1': 'ECON_AND_RECEIVER_BRIDGE',
  'EXV-C2': 'ECON_AND_RECEIVER_BRIDGE',
  'EXV-H1': 'ECON_AND_RECEIVER_BRIDGE',
  'EXV-H2': 'ECON_AND_RECEIVER_BRIDGE',
  ACOIL1: 'INTERNAL_CUTAWAY_WIDE',
  ACOIL2: 'INTERNAL_CUTAWAY_WIDE',
  '4WV1': 'INTERNAL_CUTAWAY_WIDE',
  '4WV2': 'INTERNAL_CUTAWAY_WIDE',
  'FAN-GRP1': 'INTERNAL_CUTAWAY_WIDE',
  'FAN-GRP2': 'INTERNAL_CUTAWAY_WIDE',
  'CTRL-SYMBIO': 'INTERNAL_CUTAWAY_WIDE',
  'FRAME-BASE': 'SUPPORTS_AND_ISOLATORS'
});

// Accepted preset → node rule (R2 PRESET_TO_DEFAULT_SUBNODE_MAP); null = general view keeps the current selection.
export const HP01_PRESET_DEFAULT_SUBNODE = Object.freeze({
  OVERALL_FRONT_ISO: null,
  INTERNAL_CUTAWAY_WIDE: null,
  COMP1_AND_OIL_DETAIL: 'COMP1',
  COMP1_AXIAL_END_DETAIL: 'COMP1',
  COMP2_AND_OIL_DETAIL: 'COMP2',
  COMP2_AXIAL_END_DETAIL: 'COMP2',
  WHEX_AND_DOMAINS_DETAIL: 'WHEX',
  ECON_AND_RECEIVER_BRIDGE: 'ECON1',
  SUPPORTS_AND_ISOLATORS: 'FRAME-BASE'
});

export const HP01_CIRCUIT_FILTERS = Object.freeze(['both', 'ckt1', 'ckt2', 'whex']);
export const HP01_CASING_MODES = Object.freeze(['ghost', 'full', 'hidden']);

// Same visibility rule as HP01CutawayAssembly.setCircuitFilter (kept in one place for selection consistency)
export function isSubNodeVisibleUnderFilter(subNodeId, filter) {
  const ckt = HP01_SUBNODES[subNodeId]?.circuit;
  if (!ckt) return false;
  if (filter === 'ckt1') return ckt !== 'CKT2';
  if (filter === 'ckt2') return ckt !== 'CKT1';
  if (filter === 'whex') return ['SHARED_ISOLATED_DOMAINS', 'WATER', 'DRAIN', 'STRUCTURE'].includes(ckt);
  return true;
}

export class HP01CutawayController {
  constructor(scene3d) {
    this.scene3d = scene3d;
    this.assembly = null;
    this.container = new THREE.Group();
    this.container.name = 'HP01_CUTAWAY_CONTAINER';

    this.state = {
      selectedSubNodeId: null,
      cameraPreset: 'OVERALL_FRONT_ISO',
      circuitFilter: 'both',
      casingMode: 'ghost',
      visualFreeze: false
    };
    this.animator = null;
    this.animationEnabled = true; // test-only switch (D03 on/off, D15 baseline); not exposed in the UI
    this._animSim = undefined;
    this.listeners = new Set();
    this.counters = {
      assemblyCreateCalls: 0,
      selectionChanges: 0,
      presetApplications: 0,
      pickRaycasts: 0,
      animatorCreateCalls: 0,
      animationFrames: 0,
      phaseResets: 0
    };

    this.selectionBox = null; // one re-used Box3Helper (owned)
    this.ownedGeometries = new Set();
    this.ownedMaterials = new Set();
  }

  /** Lazy, single construction of the accepted assembly (buildCount must stay 1) */
  ensureAssembly() {
    if (this.assembly) return this.assembly;
    this.counters.assemblyCreateCalls += 1;
    this.assembly = createHP01CutawayAssembly({ initialCasingMode: this.state.casingMode, initialCircuitFilter: this.state.circuitFilter });
    this.container.add(this.assembly.rootGroup);

    // Extra front fill light for the dense cutaway (belongs to the HP01 container only)
    this.frontFill = new THREE.DirectionalLight(0xfff7ed, 0.9);
    this.frontFill.position.set(0, 3.5, 9.5);
    this.container.add(this.frontFill);

    this.selectionBox = new THREE.Box3Helper(new THREE.Box3(), 0xfbbf24);
    this.ownedGeometries.add(this.selectionBox.geometry);
    this.ownedMaterials.add(this.selectionBox.material);
    this.selectionBox.visible = false;
    this.container.add(this.selectionBox);

    this.counters.animatorCreateCalls += 1;
    this.animator = new HP01ProcessAnimator(this.assembly);
    this.animator.setEnabled(this.animationEnabled);
    return this.assembly;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(reason) {
    for (const fn of this.listeners) fn({ ...this.state }, reason);
  }

  _applySelectionVisuals() {
    const a = this.ensureAssembly();
    const id = this.state.selectedSubNodeId;
    a.highlightSubNode(id);
    if (id && a.subNodeGroups.get(id)) {
      this.selectionBox.box.setFromObject(a.subNodeGroups.get(id));
      this.selectionBox.visible = !this.selectionBox.box.isEmpty();
    } else {
      this.selectionBox.visible = false;
    }
  }

  _applyPresetCamera(presetKey) {
    const preset = HP01_CAMERA_PRESETS[presetKey];
    if (!preset) throw new Error('UNKNOWN_CAMERA_PRESET_KEY: ' + String(presetKey));
    const a = this.ensureAssembly();
    this.state.cameraPreset = presetKey;
    a.setInspectionFocusMode(preset.localInspectionTarget || null);
    const cam = this.scene3d.camera;
    const controls = this.scene3d.controls;
    // Instant preset: consume any residual damping momentum from a previous drag first, so the camera stays on the preset
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    cam.position.set(preset.position[0], preset.position[1], preset.position[2]);
    controls.target.set(preset.target[0], preset.target[1], preset.target[2]);
    controls.update();
    controls.enableDamping = damping;
    this.counters.presetApplications += 1;
  }

  /** Select one of the 25 canonical sub-nodes (or null = HP01 overview) */
  selectSubNode(subNodeId, { applyPreset = true, reason = 'select' } = {}) {
    const id = subNodeId || null;
    if (id !== null && !HP01_SUBNODES[id]) throw new Error('UNKNOWN_SUBNODE_ID: ' + String(id));
    const a = this.ensureAssembly();
    if (id && !isSubNodeVisibleUnderFilter(id, this.state.circuitFilter)) {
      this.state.circuitFilter = 'both';
      a.setCircuitFilter('both');
    }
    if (this.state.selectedSubNodeId !== id) this.counters.selectionChanges += 1;
    this.state.selectedSubNodeId = id;
    if (applyPreset) {
      this._applyPresetCamera(id ? HP01_SUBNODE_DEFAULT_CAMERA_PRESET[id] : 'OVERALL_FRONT_ISO');
    }
    this._applySelectionVisuals();
    this._emit(reason);
  }

  /** Camera preset from the selector behaves like clicking its component; general presets keep the selection */
  setCameraPreset(presetKey) {
    if (!HP01_CAMERA_PRESETS[presetKey]) throw new Error('UNKNOWN_CAMERA_PRESET_KEY: ' + String(presetKey));
    const nodeForPreset = HP01_PRESET_DEFAULT_SUBNODE[presetKey];
    if (nodeForPreset) {
      const a = this.ensureAssembly();
      if (!isSubNodeVisibleUnderFilter(nodeForPreset, this.state.circuitFilter)) {
        this.state.circuitFilter = 'both';
        a.setCircuitFilter('both');
      }
      if (this.state.selectedSubNodeId !== nodeForPreset) this.counters.selectionChanges += 1;
      this.state.selectedSubNodeId = nodeForPreset;
    }
    this._applyPresetCamera(presetKey);
    this._applySelectionVisuals();
    this._emit('preset');
  }

  /** Circuit filter; a selected node hidden by the filter resets the view to the HP01 overview */
  setCircuitFilter(filter) {
    if (!HP01_CIRCUIT_FILTERS.includes(filter)) throw new Error('UNKNOWN_CIRCUIT_FILTER: ' + String(filter));
    const a = this.ensureAssembly();
    this.state.circuitFilter = filter;
    a.setCircuitFilter(filter);
    if (this.state.selectedSubNodeId && !isSubNodeVisibleUnderFilter(this.state.selectedSubNodeId, filter)) {
      this.state.selectedSubNodeId = null;
      this.counters.selectionChanges += 1;
      a.setInspectionFocusMode(null);
      if (HP01_PRESET_DEFAULT_SUBNODE[this.state.cameraPreset]) this.state.cameraPreset = 'OVERALL_FRONT_ISO';
      this._applyPresetCamera(this.state.cameraPreset);
    }
    this._applySelectionVisuals();
    this._emit('filter');
  }

  setCasingMode(mode) {
    if (!HP01_CASING_MODES.includes(mode)) throw new Error('UNKNOWN_CASING_MODE: ' + String(mode));
    this.state.casingMode = mode;
    this.ensureAssembly().setCasingMode(mode);
    this._emit('casing');
  }

  /** One-step return to the HP01 overview: no selection, overview camera, inspection off, both circuits */
  resetToOverview() {
    const a = this.ensureAssembly();
    this.state.circuitFilter = 'both';
    a.setCircuitFilter('both');
    this.selectSubNode(null, { reason: 'overview' });
  }

  /** Re-apply the current preset when (re)entering the cutaway view */
  enter() {
    this.ensureAssembly();
    this.container.visible = true;
    this._applyPresetCamera(this.state.cameraPreset);
    this._applySelectionVisuals();
  }

  leave() {
    this.container.visible = false;
    if (this.assembly) this.assembly.setInspectionFocusMode(null);
  }

  /** Visual Freeze: only the picture holds still; the simulation keeps running (independent of sim.paused) */
  setVisualFreeze(on, reason = 'freeze') {
    const v = Boolean(on);
    if (this.state.visualFreeze === v) return;
    this.state.visualFreeze = v;
    this._emit(reason);
  }

  setAnimationEnabled(on) {
    this.animationEnabled = Boolean(on);
    if (this.animator) this.animator.setEnabled(this.animationEnabled);
  }

  /** One animation frame from the scene's render loop; a new simulation object resets the phases (reset/import/scenario) */
  updateAnimation(vm, dtAnim, sim) {
    if (!this.animator || !this.animationEnabled) return null;
    if (sim !== this._animSim) {
      if (this._animSim !== undefined) {
        this.animator.resetPhases('new-simulation');
        this.counters.phaseResets += 1;
      }
      this._animSim = sim;
    }
    this.counters.animationFrames += 1;
    return this.animator.applyFrame(vm, dtAnim);
  }

  disposeAnimation() {
    if (this.animator) this.animator.dispose();
    this.animator = null;
  }

  /** Raycast only on the assembly's own pickable meshes; returns the canonical sub-node ID or null */
  pickSubNode(ndc, camera, raycaster) {
    if (!this.assembly || !this.container.visible) return null;
    this.counters.pickRaycasts += 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(this.assembly.pickableMeshes, false);
    for (const h of hits) {
      let o = h.object;
      let visible = true;
      while (o) {
        if (o.visible === false) { visible = false; break; }
        o = o.parent;
      }
      if (!visible) continue;
      const id = h.object.userData.subNodeId;
      if (id && HP01_SUBNODES[id]) return id;
    }
    return null;
  }

  getConnectionsOf(subNodeId) {
    return subNodeId ? [...(HP01_NODE_PIPES[subNodeId] || [])] : [];
  }

  getTelemetry() {
    return {
      counters: { ...this.counters },
      state: { ...this.state },
      assemblyStats: this.assembly ? this.assembly.getResourceStats() : null,
      inspectionFocus: this.assembly ? this.assembly.getInspectionFocusState() : null,
      containerVisible: this.container.visible,
      selectionBoxVisible: Boolean(this.selectionBox?.visible),
      animationEnabled: this.animationEnabled,
      animation: this.animator ? this.animator.getTelemetry() : null
    };
  }
}
