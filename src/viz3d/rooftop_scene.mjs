/**
 * STAGE 5: INTERACTIVE 3D ROOFTOP & COMPONENT CUTAWAY SCENE (Three.js)
 * Strictly synchronized with COMPONENT_REGISTRY, CONNECTION_REGISTRY, and live physics state.
 */

import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three/addons/controls/OrbitControls.js';
import { COMPONENT_REGISTRY, CONNECTION_REGISTRY, getConnectedObjects } from '../topology/registry.mjs';

export class Rooftop3DScene {
  constructor(containerEl, callbacks = {}) {
    this.container = containerEl;
    this.onSelectComponent = callbacks.onSelectComponent || (() => {});
    this.onHoverComponent = callbacks.onHoverComponent || (() => {});

    this.mode = 'rooftop3d'; // 'rooftop3d' | 'cutaway3d'
    this.selectedId = 'HP01';
    this.hoveredId = null;
    this.showConnectionsOnly = false;

    this.componentMeshes = new Map(); // compId -> THREE.Group
    this.pickableMeshes = [];         // Array of meshes with userData.compId
    this.connectionMeshes = new Map(); // connId -> THREE.Group
    this.flowParticles = [];          // { mesh, curve, speedFn, tempFn, streamType, connId }
    this.fanBlades = [];              // THREE.Object3D[]
    this.pumpRotors = new Map();      // compId -> THREE.Object3D

    this.initThree();
    this.buildRooftopEnvironment();
    this.buildAllPlantEquipment();
    this.buildAllPipingAndStreams();
    this.buildCutawayStage();
    this.bindEvents();
  }

  initThree() {
    const w = this.container.clientWidth || 1080;
    const h = this.container.clientHeight || 640;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x09111e);
    this.scene.fog = new THREE.FogExp2(0x09111e, 0.012);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.2, 160);
    this.camera.position.set(17.5, 13.5, 19.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 1.4, 0);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 55;

    // Industrial Lighting
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.95);
    this.scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    dirLight.position.set(18, 28, 16);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 65;
    const d = 20;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    fillLight.position.set(-16, 12, -14);
    this.scene.add(fillLight);

    this.rooftopRoot = new THREE.Group();
    this.cutawayRoot = new THREE.Group();
    this.cutawayRoot.visible = false;
    this.scene.add(this.rooftopRoot);
    this.scene.add(this.cutawayRoot);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
  }

  // Helper to register interactive component group
  registerComponentGroup(compId, group) {
    group.userData.compId = compId;
    this.componentMeshes.set(compId, group);
    group.traverse((child) => {
      if (child.isMesh) {
        child.userData.compId = compId;
        child.castShadow = true;
        child.receiveShadow = true;
        this.pickableMeshes.push(child);
      }
    });
    this.rooftopRoot.add(group);
  }

  buildRooftopEnvironment() {
    // 1. Concrete Roof Slab (28m x 18m)
    const roofGeo = new THREE.BoxGeometry(28, 0.5, 18);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85, metalness: 0.1 });
    const roofSlab = new THREE.Mesh(roofGeo, roofMat);
    roofSlab.position.set(0, -0.25, 0);
    roofSlab.receiveShadow = true;
    this.rooftopRoot.add(roofSlab);

    // Subtle technical grid
    const grid = new THREE.GridHelper(28, 28, 0x334155, 0x1e293b);
    grid.position.y = 0.01;
    this.rooftopRoot.add(grid);

    // 2. Organized Drainage Channels & Condensate/Defrost Trench (отвод конденсата и воды оттайки)
    const drainMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.5 });
    const drainTrench1 = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.04, 0.35), drainMat);
    drainTrench1.position.set(6.5, 0.02, -2.5);
    this.rooftopRoot.add(drainTrench1);

    const drainTrench2 = new THREE.Mesh(new THREE.BoxGeometry(16.0, 0.04, 0.3), drainMat);
    drainTrench2.position.set(-2.5, 0.02, 2.8);
    this.rooftopRoot.add(drainTrench2);

    // 3. Yellow/Dark-Slate Anti-Slip Maintenance Walkways (проходы обслуживания)
    const walkMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const borderMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });
    const addWalkway = (x, z, w, l) => {
      const g = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, l), walkMat);
      slab.position.y = 0.012;
      g.add(slab);
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.06), borderMat);
      b1.position.set(0, 0.015, l / 2);
      const b2 = b1.clone();
      b2.position.set(0, 0.015, -l / 2);
      g.add(b1, b2);
      g.position.set(x, 0, z);
      this.rooftopRoot.add(g);
    };
    addWalkway(6.5, -1.6, 9.6, 1.1);  // Front service corridor along RTXC & Symbio 800
    addWalkway(-2.2, -0.5, 13.5, 1.1); // Main operator aisle between manifolds & 5 HX skids
    addWalkway(2.1, -3.5, 1.1, 5.2);   // Cross walkway between buffer & RTXC

    // 4. Overhead Galvanized Cable Trays (электрические кабельные трассы)
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.65, roughness: 0.35 });
    const mainTray = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.08, 0.32), trayMat);
    mainTray.position.set(1.2, 2.85, -1.05);
    this.rooftopRoot.add(mainTray);
    for (let x = -6.5; x <= 9.5; x += 3.2) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.85, 8), trayMat);
      post.position.set(x, 1.425, -1.05);
      this.rooftopRoot.add(post);
    }

    // 5. Structural Pipe Rack Frames along Distribution Manifolds (опоры трубопроводов)
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 });
    for (let x = -8.5; x <= 0.5; x += 2.25) {
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.85, 0.08), steelMat);
      p1.position.set(x, 0.925, 0.4);
      const p2 = p1.clone();
      p2.position.set(x, 0.925, 1.15);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.95), steelMat);
      beam.position.set(x, 1.75, 0.775);
      const beamLow = beam.clone();
      beamLow.position.set(x, 1.25, 0.775);
      this.rooftopRoot.add(p1, p2, beam, beamLow);
    }
  }

  buildAllPlantEquipment() {
    // =========================================================================
    // 1. HP01 — Trane RTXC 180 XE-HSE (7.882m x 2.250m x 2.525m)
    // =========================================================================
    const hpGroup = new THREE.Group();
    hpGroup.position.set(6.8, 0, -4.5);

    // Structural Steel Base I-Beams (несущие основания)
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
    for (const zOff of [-1.085, 1.085]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.22, 0.18), beamMat);
      rail.position.set(0, 0.11, zOff);
      hpGroup.add(rail);
    }

    // 8 Neoprene Vibration Isolators X10140305640 (Manual p. 20 Fig. 3-4)
    const isoMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6 });
    const isoX = [-3.4, -1.15, 1.15, 3.4];
    for (const ix of isoX) {
      for (const iz of [-1.085, 1.085]) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.22), isoMat);
        pad.position.set(ix, 0.255, iz);
        hpGroup.add(pad);
      }
    }

    const baseY = 0.29;
    // Lower machinery frame housing 2 screw compressors, 2 BPHE economizers, falling-film evaporator
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.45 });
    const lowerFrame = new THREE.Mesh(new THREE.BoxGeometry(7.88, 1.05, 2.17), frameMat);
    lowerFrame.position.set(0, baseY + 0.525, 0);
    hpGroup.add(lowerFrame);

    // Insulated Falling-Film Evaporator/Condenser Vessel inside lower frame
    const vesselMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.3 });
    const evaporatorShell = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.6, 24), vesselMat);
    evaporatorShell.rotation.z = Math.PI / 2;
    evaporatorShell.position.set(0.3, baseY + 0.55, 0.45);
    hpGroup.add(evaporatorShell);

    // Two Trane Semi-Hermetic Twin-Screw Compressors (Circuit 1 & Circuit 2)
    const compMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.3 });
    for (const cx of [-1.6, 1.4]) {
      const compBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.15, 18), compMat);
      compBody.rotation.z = Math.PI / 2;
      compBody.position.set(cx, baseY + 0.52, -0.55);
      hpGroup.add(compBody);
      // BPHE Economizer next to each compressor
      const econ = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.52, 0.24), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7 }));
      econ.position.set(cx + 0.75, baseY + 0.55, -0.55);
      hpGroup.add(econ);
    }

    // Upper V-Coils (Air-Side Heat Exchangers)
    const coilMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.65, roughness: 0.35 });
    const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(7.88, 1.18, 2.25), coilMat);
    upperDeck.position.set(0, baseY + 1.64, 0);
    hpGroup.add(upperDeck);

    // Symbio 800 Electrical & Control Cabinet at left end (-3.94m)
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.3 });
    const symbioCab = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.95, 2.15), cabMat);
    symbioCab.position.set(-3.65, baseY + 1.05, 0);
    hpGroup.add(symbioCab);

    // 12 Top EC Axial Fans (2 rows x 6 fans)
    const shroudMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.5, roughness: 0.3 });
    for (let r = 0; r < 6; r++) {
      const fx = -2.75 + r * 1.15;
      for (const fz of [-0.58, 0.58]) {
        const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.18, 20), shroudMat);
        shroud.position.set(fx, baseY + 2.28, fz);
        hpGroup.add(shroud);

        const rotor = new THREE.Group();
        rotor.position.set(fx, baseY + 2.34, fz);
        for (let b = 0; b < 5; b++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.1), bladeMat);
          blade.rotation.y = (b * Math.PI * 2) / 5;
          blade.rotation.x = 0.35;
          rotor.add(blade);
        }
        hpGroup.add(rotor);
        this.fanBlades.push(rotor);
      }
    }

    this.registerComponentGroup('HP01', hpGroup);

    // =========================================================================
    // 2. Primary Pump Group PP01A & PP01B (on concrete plinth & steel skid)
    // =========================================================================
    this.createPumpUnit('PP01A', 3.4, -2.5, 0x0ea5e9);
    this.createPumpUnit('PP01B', 3.4, -3.4, 0x0ea5e9);

    // =========================================================================
    // 3. BT01 — 4-Pipe Insulated Hydraulic Buffer Tank (2.5 m³) on 4 legs
    // =========================================================================
    const btGroup = new THREE.Group();
    btGroup.position.set(1.2, 0, -2.9);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 1.7), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    plinth.position.y = 0.09;
    btGroup.add(plinth);

    // 4 Steel Support Legs
    for (const lx of [-0.48, 0.48]) {
      for (const lz of [-0.48, 0.48]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.45, 10), beamMat);
        leg.position.set(lx, 0.35, lz);
        btGroup.add(leg);
      }
    }
    const tankBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.68, 2.15, 28),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.35 })
    );
    tankBody.position.y = 1.55;
    btGroup.add(tankBody);

    const domeTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.35 })
    );
    domeTop.position.y = 2.62;
    btGroup.add(domeTop);
    this.registerComponentGroup('BT01', btGroup);

    // =========================================================================
    // 4. Primary Expansion Tank ET00 & Safety Relief Valve PSV00
    // =========================================================================
    this.createExpansionTank('ET00', 1.2, -4.7, 0.42, 1.25);
    this.createPSV('PSV00', 1.95, -4.7);

    // =========================================================================
    // 5. Distribution VFD Pump Group PD01A & PD01B
    // =========================================================================
    this.createPumpUnit('PD01A', -0.4, 0.35, 0x14b8a6);
    this.createPumpUnit('PD01B', -0.4, 1.15, 0x14b8a6);

    // =========================================================================
    // 6. Five Independent Heat Exchange Modules HX01..HX05 + CV01..05 + PS + ET + PSV + CONS
    // =========================================================================
    for (let i = 1; i <= 5; i++) {
      const idx = i - 1;
      const pad = String(i).padStart(2, '0');
      const xMod = -2.2 - idx * 2.15;

      // Control Valve CV01..05 on primary supply branch
      this.createControlValve(`CV${pad}`, xMod + 0.42, 1.55, 1.45);

      // Counterflow Plate Heat Exchanger HX01..05 on structural steel frame
      this.createHeatExchanger(`HX${pad}`, xMod, 2.25);

      // Secondary Twin Pump Group PS01A/B..PS05A/B
      this.createPumpUnit(`PS${pad}A`, xMod - 0.38, 3.65, 0x38bdf8, 0.78);
      this.createPumpUnit(`PS${pad}B`, xMod + 0.38, 3.65, 0x38bdf8, 0.78);

      // Secondary Expansion Tank ET01..05 & PSV01..05 on dedicated stand
      this.createExpansionTank(`ET${pad}`, xMod - 0.55, 4.75, 0.25, 0.78);
      this.createPSV(`PSV${pad}`, xMod + 0.1, 4.75);

      // Outgoing Supply & Returning Return Consumer Boundary Portal (צרכן 1..5)
      this.createConsumerPortal(`CONS${pad}`, xMod, 6.2, i);
    }

    // =========================================================================
    // 7. Water Treatment WT01, Atmospheric Break Makeup MU01, and PLC CP01
    // =========================================================================
    this.createWaterTreatmentSkid('WT01', 5.2, 2.8);
    this.createMakeupSkid('MU01', 3.1, 2.8);
    this.createControlCabinet('CP01', 5.2, 0.4);
  }

  createPumpUnit(compId, x, z, colorHex, scale = 1.0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);

    // Concrete inertia base & steel skid
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.16, 0.58),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
    );
    base.position.y = 0.08;
    g.add(base);

    // Electric Motor
    const motor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.52, 16),
      new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.55, roughness: 0.35 })
    );
    motor.rotation.z = Math.PI / 2;
    motor.position.set(-0.15, 0.36, 0);
    g.add(motor);

    // Volute Casing
    const volute = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.22, 18),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.3 })
    );
    volute.rotation.z = Math.PI / 2;
    volute.position.set(0.26, 0.36, 0);
    g.add(volute);

    // Visible rotating shaft/coupling indicator
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.26, 0.26),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.3 })
    );
    rotor.position.set(-0.42, 0.36, 0);
    g.add(rotor);
    this.pumpRotors.set(compId, rotor);

    this.registerComponentGroup(compId, g);
  }

  createHeatExchanger(compId, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    // Steel Skid Frame & Drip Tray
    const skid = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.14, 1.25),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5 })
    );
    skid.position.y = 0.07;
    g.add(skid);

    // Fixed Frame Plate & Follower Plate
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.35 });
    const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.32, 0.08), frameMat);
    frontPlate.position.set(0, 0.8, -0.35);
    const backPlate = frontPlate.clone();
    backPlate.position.set(0, 0.8, 0.35);
    g.add(frontPlate, backPlate);

    // Corrugated Stainless Plate Pack (with insulation jacket)
    const packMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.25 });
    const platePack = new THREE.Mesh(new THREE.BoxGeometry(0.54, 1.22, 0.62), packMat);
    platePack.position.set(0, 0.8, 0);
    g.add(platePack);

    // 4 Real Nozzles on Front Plate (pri_in, pri_out, sec_in, sec_out)
    const nozMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7 });
    const coords = [
      [-0.18, 1.22, -0.44], // pri_in (hot top right)
      [-0.18, 0.38, -0.44], // pri_out (cooled bottom right)
      [0.18,  1.22,  0.44], // sec_out (heated top left)
      [0.18,  0.38,  0.44]  // sec_in (cold bottom left)
    ];
    for (const [nx, ny, nz] of coords) {
      const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 12), nozMat);
      noz.rotation.x = Math.PI / 2;
      noz.position.set(nx, ny, nz);
      g.add(noz);
    }

    this.registerComponentGroup(compId, g);
  }

  createControlValve(compId, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.24, 12),
      new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.7 })
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);

    const actuator = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 })
    );
    actuator.position.y = 0.18;
    g.add(actuator);

    this.registerComponentGroup(compId, g);
  }

  createExpansionTank(compId, x, z, radius, height) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.85, radius * 0.95, 0.28, 16),
      new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    stand.position.y = 0.14;
    g.add(stand);

    const vessel = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 22),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.3 })
    );
    vessel.position.y = 0.28 + height / 2;
    g.add(vessel);

    this.registerComponentGroup(compId, g);
  }

  createPSV(compId, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.65, 10),
      new THREE.MeshStandardMaterial({ color: 0x64748b })
    );
    post.position.y = 0.325;
    g.add(post);

    const valve = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.28, 14),
      new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5 })
    );
    valve.position.y = 0.75;
    g.add(valve);

    this.registerComponentGroup(compId, g);
  }

  createConsumerPortal(compId, x, z, index) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    // Roof Pipe Penetration Curb (Уходящая подача и возвращающаяся обратка к צרכן i)
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.45, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4 })
    );
    curb.position.y = 0.225;
    g.add(curb);

    // Outgoing Supply Arrow Cone (Warm)
    const supArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.34, 14),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.35 })
    );
    supArrow.rotation.x = Math.PI; // Pointing down into factory consumer loop
    supArrow.position.set(-0.24, 0.72, 0);
    g.add(supArrow);

    // Incoming Return Arrow Cone (Cooler)
    const retArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.34, 14),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.35 })
    );
    retArrow.position.set(0.24, 0.72, 0);
    g.add(retArrow);

    // Floating crisp canvas plaque for צרכן 1..5 (allowed boundary designation per Section 1)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.roundRect(4, 4, 248, 88, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`צרכן ${index}`, 128, 46);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px sans-serif';
    ctx.fillText(`הזנה ↓  |  ↑ חזרה`, 128, 76);

    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(0, 1.38, 0);
    sprite.scale.set(1.35, 0.52, 1);
    g.add(sprite);

    this.registerComponentGroup(compId, g);
  }

  createWaterTreatmentSkid(compId, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 1.0), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    base.position.y = 0.07;
    g.add(base);
    const dosingTank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.95, 18), new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.3 }));
    dosingTank.position.set(-0.32, 0.6, 0);
    const analyzer = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.85, 0.4), new THREE.MeshStandardMaterial({ color: 0x0ea5e9 }));
    analyzer.position.set(0.32, 0.55, 0);
    g.add(dosingTank, analyzer);
    this.registerComponentGroup(compId, g);
  }

  createMakeupSkid(compId, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 1.0), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    base.position.y = 0.07;
    g.add(base);
    // Atmospheric Break Tank (Бак разрыва струи)
    const breakTank = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.05, 0.68), new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.35 }));
    breakTank.position.set(-0.3, 0.66, 0);
    // Makeup Pump + 6 fill manifold solenoids
    const muPump = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.45, 14), new THREE.MeshStandardMaterial({ color: 0x22c55e }));
    muPump.position.set(0.38, 0.36, 0);
    g.add(breakTank, muPump);
    this.registerComponentGroup(compId, g);
  }

  createControlCabinet(compId, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.65), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    plinth.position.y = 0.08;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.85, 0.55), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.35, roughness: 0.4 }));
    cab.position.y = 1.08;
    g.add(plinth, cab);
    this.registerComponentGroup(compId, g);
  }

  buildAllPipingAndStreams() {
    const addPipeWithParticles = (connId, pointsArray, radius, streamType, speedFn, tempFn) => {
      const pts = pointsArray.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05);
      const group = new THREE.Group();

      const tubeGeo = new THREE.TubeGeometry(curve, Math.max(16, pts.length * 8), radius, 10, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.55,
        roughness: 0.35,
        transparent: true,
        opacity: 0.88
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      group.add(tubeMesh);

      // Create directional moving flow spheres/cones along the curve
      const particleCount = Math.max(4, Math.floor(curve.getLength() * 1.4));
      const pGeo = new THREE.SphereGeometry(radius * 1.25, 8, 8);
      for (let k = 0; k < particleCount; k++) {
        const pMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        group.add(pMesh);
        this.flowParticles.push({
          mesh: pMesh,
          tubeMat,
          curve,
          u: k / particleCount,
          speedFn,
          tempFn,
          streamType,
          connId
        });
      }

      this.connectionMeshes.set(connId, group);
      this.rooftopRoot.add(group);
    };

    // 1. Primary Loop Pipes (HP01 <-> PP01A/B <-> BT01)
    addPipeWithParticles(
      'PIPE-HP-SUP-01',
      [[5.2, 1.1, -4.1], [2.4, 1.1, -4.1], [1.2, 2.2, -2.9]],
      0.075,
      'water',
      (s) => s.primary.qv_m3s * 12,
      (s) => s.hp.T_out_C
    );
    addPipeWithParticles(
      'PIPE-HP-RET-01',
      [[1.2, 0.7, -2.9], [3.4, 0.45, -2.9], [5.2, 0.7, -4.7]],
      0.075,
      'water',
      (s) => s.primary.qv_m3s * 12,
      (s) => s.hp.T_in_C
    );

    // 2. Distribution Supply & Return Headers (BT01 -> PD01A/B -> Rack -> 5 Branches)
    addPipeWithParticles(
      'PIPE-DIST-SUP-01',
      [[1.2, 2.1, -2.9], [-0.4, 0.55, 0.75], [-0.4, 1.75, 0.45], [-10.8, 1.75, 0.45]],
      0.08,
      'water',
      (s) => s.distribution.qv_total_m3s * 14,
      (s) => s.distribution.T_supply_header_C
    );
    addPipeWithParticles(
      'PIPE-DIST-RET-01',
      [[-10.8, 1.25, 1.1], [1.2, 1.25, 1.1], [1.2, 0.75, -2.9]],
      0.08,
      'water',
      (s) => s.distribution.qv_total_m3s * 14,
      (s) => s.distribution.T_return_header_C
    );

    // 3. Five Parallel Modules HX01..HX05 (Primary Branch + Secondary Consumer Loop)
    for (let i = 1; i <= 5; i++) {
      const idx = i - 1;
      const pad = String(i).padStart(2, '0');
      const xMod = -2.2 - idx * 2.15;

      // Primary Supply from Header -> CV_i -> HX_i
      addPipeWithParticles(
        `PIPE-BR${pad}-SUP`,
        [[xMod + 0.42, 1.75, 0.45], [xMod + 0.42, 1.55, 1.45], [xMod - 0.18, 1.22, 1.85]],
        0.045,
        'water',
        (s) => s.branches[idx].primary.qv_m3s * 45,
        (s) => s.branches[idx].hx.T_pri_in_C
      );
      // Primary Return from HX_i -> Return Header
      addPipeWithParticles(
        `PIPE-BR${pad}-RET`,
        [[xMod - 0.18, 0.38, 1.85], [xMod - 0.18, 1.25, 1.1]],
        0.045,
        'water',
        (s) => s.branches[idx].primary.qv_m3s * 45,
        (s) => s.branches[idx].hx.T_pri_out_C
      );
      // Secondary Heated Supply HX_i -> Consumer Portal (צרכן i)
      addPipeWithParticles(
        `PIPE-SEC${pad}-SUP`,
        [[xMod + 0.18, 1.22, 2.65], [xMod - 0.24, 1.05, 6.2], [xMod - 0.24, 0.35, 6.2]],
        0.045,
        'water',
        (s) => s.branches[idx].secondary.qv_m3s * 55,
        (s) => s.branches[idx].hx.T_sec_out_C
      );
      // Secondary Return from Consumer Portal -> PS_iA/B -> HX_i
      addPipeWithParticles(
        `PIPE-SEC${pad}-RET`,
        [[xMod + 0.24, 0.35, 6.2], [xMod + 0.24, 0.45, 3.65], [xMod + 0.18, 0.38, 2.65]],
        0.045,
        'water',
        (s) => s.branches[idx].secondary.qv_m3s * 55,
        (s) => s.branches[idx].hx.T_sec_in_C
      );
    }

    // 4. Air Stream & Refrigerant Stream on HP01 (distinct visual streams per Section 12.1)
    for (let a = 0; a < 4; a++) {
      const ax = 4.5 + a * 1.5;
      addPipeWithParticles(
        `AIR-STREAM-${a}`,
        [[ax, 1.5, -6.1], [ax, 1.8, -4.5], [ax, 3.6, -4.5]],
        0.035,
        'air',
        (s) => (s.hp.fanSpeedPct / 100) * 0.65,
        () => 20
      );
    }
    addPipeWithParticles(
      'REF-STREAM-C1',
      [[5.2, 0.85, -5.05], [7.8, 0.85, -5.05], [7.8, 1.9, -4.5], [5.2, 0.85, -4.05], [5.2, 0.85, -5.05]],
      0.035,
      'refrigerant',
      (s) => (s.hp.actualLoadPct > 0 ? (s.hp.defrostActive ? -0.55 : 0.55) : 0),
      () => 50
    );
  }

  buildCutawayStage() {
    // Interactive 3D Cutaway / Close-Up Stage (Выбранный компонент крупно или в разрезе)
    this.cutawayGroup = new THREE.Group();
    this.cutawayRoot.add(this.cutawayGroup);
  }

  rebuildCutawayForComponent(compId, sim) {
    while (this.cutawayGroup.children.length > 0) {
      this.cutawayGroup.remove(this.cutawayGroup.children[0]);
    }
    const s = sim.state;

    // Platform
    const stageDisk = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 4.8, 0.25, 36),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
    );
    stageDisk.position.y = -0.125;
    this.cutawayGroup.add(stageDisk);

    if (compId === 'BT01') {
      // 4-Pipe Buffer Tank Half-Cylinder Cutaway (back half: thetaStart = Math.PI/2, thetaLength = Math.PI)
      // so the open cutaway cross-section faces directly toward +Z camera!
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(1.45, 1.45, 3.8, 32, 1, true, Math.PI / 2, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide })
      );
      shell.position.y = 2.0;
      this.cutawayGroup.add(shell);

      // 3 Thermal Layers (Top Hot, Mid Warm, Bottom Cooler)
      const layers = [
        { y: 3.12, col: 0xf59e0b },
        { y: 2.00, col: 0x14b8a6 },
        { y: 0.88, col: 0x38bdf8 }
      ];
      layers.forEach((ly) => {
        const fluid = new THREE.Mesh(
          new THREE.CylinderGeometry(1.36, 1.36, 1.06, 28),
          new THREE.MeshStandardMaterial({ color: ly.col, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88 })
        );
        fluid.position.set(0, ly.y, -0.15);
        this.cutawayGroup.add(fluid);
      });

      // Internal Stratification Baffles
      for (const by of [1.45, 2.55]) {
        const baffle = new THREE.Mesh(
          new THREE.CylinderGeometry(1.22, 1.22, 0.06, 24),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.2 })
        );
        baffle.position.set(0, by, -0.1);
        this.cutawayGroup.add(baffle);
      }

      // 4 Side Nozzles (2 Right: HP01 Hot In / Cold Out; 2 Left: Dist Hot Out / Cold Return In)
      const nozConfigs = [
        { x: 1.65, y: 3.25, col: 0xf59e0b },
        { x: 1.65, y: 0.75, col: 0x38bdf8 },
        { x: -1.65, y: 3.25, col: 0xf59e0b },
        { x: -1.65, y: 0.75, col: 0x38bdf8 }
      ];
      nozConfigs.forEach((nz) => {
        const pipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 0.7, 16),
          new THREE.MeshStandardMaterial({ color: nz.col, metalness: 0.5 })
        );
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(nz.x, nz.y, 0);
        this.cutawayGroup.add(pipe);
      });
    } else if (compId.startsWith('HX')) {
      // Counterflow Plate Heat Exchanger Exploded Cutaway showing alternating hot primary & cold secondary channels
      const frameBack = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 3.2, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6 })
      );
      frameBack.position.set(0, 1.7, -1.6);
      const frameFront = frameBack.clone();
      frameFront.position.set(0, 1.7, 1.6);
      this.cutawayGroup.add(frameBack, frameFront);

      const idx = Number(compId.slice(2)) - 1;
      const br = s.branches[idx] || s.branches[0];
      const hotCol = this.waterTempToColorHex(br.hx.T_pri_in_C);
      const coldCol = this.waterTempToColorHex(br.hx.T_sec_out_C);

      for (let p = -5; p <= 5; p++) {
        const isPrimary = p % 2 === 0;
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 2.85, 0.12),
          new THREE.MeshStandardMaterial({
            color: isPrimary ? hotCol : coldCol,
            metalness: 0.4,
            roughness: 0.3,
            transparent: true,
            opacity: 0.85
          })
        );
        plate.position.set(0, 1.7, p * 0.24);
        this.cutawayGroup.add(plate);
      }
    } else if (compId.startsWith('ET')) {
      // Diaphragm Expansion Tank Cutaway showing dry N2 gas chamber above and water acceptor below
      const outer = new THREE.Mesh(
        new THREE.CylinderGeometry(1.25, 1.25, 3.2, 32, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, side: THREE.DoubleSide })
      );
      outer.position.y = 1.8;
      this.cutawayGroup.add(outer);

      const gasZone = new THREE.Mesh(
        new THREE.CylinderGeometry(1.18, 1.18, 1.7, 28, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
      );
      gasZone.position.y = 2.45;
      const waterZone = new THREE.Mesh(
        new THREE.CylinderGeometry(1.18, 1.18, 1.2, 28, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
      );
      waterZone.position.y = 0.95;
      this.cutawayGroup.add(gasZone, waterZone);
    } else {
      // Default / HP01 RTXC Cutaway showing Twin-Screw Rotor + Falling-Film Tube Bundle + BPHE Economizer + V-Coils
      const evapShell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 0.95, 4.8, 28, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x334155, side: THREE.DoubleSide, metalness: 0.7 })
      );
      evapShell.rotation.z = Math.PI / 2;
      evapShell.position.set(0, 1.15, 0);
      this.cutawayGroup.add(evapShell);

      // Internal copper tube bundle with heated water inside
      const tubeCol = this.waterTempToColorHex(s.hp.T_out_C);
      for (let ty = -0.55; ty <= 0.55; ty += 0.28) {
        for (let tz = -0.55; tz <= 0.55; tz += 0.28) {
          const tube = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 4.6, 12),
            new THREE.MeshStandardMaterial({ color: tubeCol, metalness: 0.6 })
          );
          tube.rotation.z = Math.PI / 2;
          tube.position.set(0, 1.15 + ty, tz);
          this.cutawayGroup.add(tube);
        }
      }

      // Twin-Screw Compressor Cutaway above shell
      const screwHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 2.2, 24, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, side: THREE.DoubleSide })
      );
      screwHousing.rotation.z = Math.PI / 2;
      screwHousing.position.set(-0.8, 2.65, 0);
      this.cutawayGroup.add(screwHousing);

      const bpEconomizer = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.25, 0.75),
        new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7 })
      );
      bpEconomizer.position.set(1.4, 2.65, 0);
      this.cutawayGroup.add(bpEconomizer);
    }
  }

  waterTempToColorHex(tempC) {
    if (tempC === null || tempC === undefined || Number.isNaN(tempC)) return 0x64748b;
    if (tempC < 34) return 0x38bdf8;
    if (tempC < 47) return 0x14b8a6;
    if (tempC < 56) return 0xf59e0b;
    return 0xef4444;
  }

  setMode(mode, sim) {
    this.mode = mode;
    if (mode === 'cutaway3d') {
      this.rooftopRoot.visible = false;
      this.cutawayRoot.visible = true;
      this.rebuildCutawayForComponent(this.selectedId || 'HP01', sim);
      this.camera.position.set(0, 3.6, 7.2);
      this.controls.target.set(0, 1.7, 0);
    } else {
      this.rooftopRoot.visible = true;
      this.cutawayRoot.visible = false;
      this.camera.position.set(17.5, 13.5, 19.5);
      this.controls.target.set(0, 1.4, 0);
    }
    this.controls.update();
  }

  setSelection(compId, showConnectionsOnly = this.showConnectionsOnly, sim = null) {
    this.selectedId = compId;
    this.showConnectionsOnly = showConnectionsOnly;
    if (this.mode === 'cutaway3d' && sim) {
      this.rebuildCutawayForComponent(compId, sim);
    }
  }

  focusOnModulesBank() {
    this.mode = 'rooftop3d';
    this.rooftopRoot.visible = true;
    this.cutawayRoot.visible = false;
    this.camera.position.set(-6.2, 6.8, 10.8);
    this.controls.target.set(-6.2, 1.2, 2.6);
    this.controls.update();
  }

  bindEvents() {
    const dom = this.renderer.domElement;

    const getIntersectedCompId = (clientX, clientY) => {
      if (this.mode !== 'rooftop3d') return null;
      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.pickableMeshes, false);
      if (hits.length > 0) {
        return hits[0].object.userData.compId || null;
      }
      return null;
    };

    dom.addEventListener('pointermove', (e) => {
      const id = getIntersectedCompId(e.clientX, e.clientY);
      if (id !== this.hoveredId) {
        this.hoveredId = id;
        dom.style.cursor = id ? 'pointer' : 'grab';
        this.onHoverComponent(id, e);
      }
    });

    let downPos = { x: 0, y: 0 };
    dom.addEventListener('pointerdown', (e) => {
      downPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (dist < 6) {
        const id = getIntersectedCompId(e.clientX, e.clientY);
        if (id) {
          this.onSelectComponent(id);
        }
      }
    });

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.container) return;
    const w = this.container.clientWidth || 1080;
    const h = this.container.clientHeight || 640;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  updateAndRender(sim, dtReal_s = 0.016) {
    if (!sim) return;
    const s = sim.state;
    const simRunning = !sim.paused;

    // 1. Rotate EC Fans strictly according to actual fanSpeedPct
    const fanOmega = simRunning ? (s.hp.fanSpeedPct / 100) * 14.0 * dtReal_s : 0;
    for (const bladeGroup of this.fanBlades) {
      bladeGroup.rotation.y += fanOmega;
    }

    // 2. Rotate Pump Shafts strictly according to actual pump running state
    for (const [compId, rotor] of this.pumpRotors.entries()) {
      let running = false;
      let speedRatio = 0;
      if (compId === 'PP01A') { running = s.primary.pumpA.state === 'running'; speedRatio = s.primary.pumpA.speedRatio; }
      else if (compId === 'PP01B') { running = s.primary.pumpB.state === 'running'; speedRatio = s.primary.pumpB.speedRatio; }
      else if (compId === 'PD01A') { running = s.distribution.pumpA.state === 'running'; speedRatio = s.distribution.pumpA.speedRatio; }
      else if (compId === 'PD01B') { running = s.distribution.pumpB.state === 'running'; speedRatio = s.distribution.pumpB.speedRatio; }
      else {
        const m = compId.match(/^PS0(\d)([AB])$/);
        if (m) {
          const br = s.branches[Number(m[1]) - 1];
          const p = m[2] === 'A' ? br.secondary.pumpA : br.secondary.pumpB;
          running = p.state === 'running';
          speedRatio = p.speedRatio;
        }
      }
      if (running && simRunning && speedRatio > 0) {
        rotor.rotation.x += 12.0 * speedRatio * dtReal_s;
      }
    }

    // 3. Advance stream particles strictly by calculated flow velocity (stop when flow == 0)
    const connectedSet = this.selectedId ? getConnectedObjects(this.selectedId) : null;
    for (const fp of this.flowParticles) {
      const vel = simRunning ? fp.speedFn(s) : 0;
      if (Math.abs(vel) > 1e-4) {
        fp.u = (fp.u + vel * dtReal_s * 0.35 + 10) % 1.0;
        fp.mesh.visible = true;
      } else {
        fp.mesh.visible = false; // Stationary / hidden arrows when flow is zero
      }
      const pos = fp.curve.getPointAt(fp.u);
      fp.mesh.position.copy(pos);

      if (fp.streamType === 'water') {
        const cHex = this.waterTempToColorHex(fp.tempFn(s));
        fp.mesh.material.color.setHex(cHex);
        fp.tubeMat.color.setHex(cHex);
      } else if (fp.streamType === 'air') {
        fp.mesh.material.color.setHex(0xe0f2fe);
        fp.tubeMat.color.setHex(0x38bdf8);
      } else if (fp.streamType === 'refrigerant') {
        fp.mesh.material.color.setHex(s.hp.defrostActive ? 0x60a5fa : 0xd946ef);
        fp.tubeMat.color.setHex(s.hp.defrostActive ? 0x2563eb : 0xa21caf);
      }

      if (this.showConnectionsOnly && connectedSet) {
        const keep = connectedSet.connections.has(fp.connId);
        fp.tubeMat.opacity = keep ? 0.95 : 0.12;
        if (!keep) fp.mesh.visible = false;
      } else {
        fp.tubeMat.opacity = 0.85;
      }
    }

    // 4. Highlight selected component & Show Connections filter
    for (const [compId, group] of this.componentMeshes.entries()) {
      const isSel = this.selectedId === compId;
      const keep = !this.showConnectionsOnly || (connectedSet && connectedSet.components.has(compId));
      group.traverse((child) => {
        if (child.isMesh && child.material && 'emissive' in child.material) {
          if (isSel) {
            child.material.emissive.setHex(0x0284c7);
            child.material.emissiveIntensity = 0.45;
          } else {
            child.material.emissiveIntensity = 0.0;
          }
          child.material.transparent = !keep;
          child.material.opacity = keep ? 1.0 : 0.16;
        }
      });
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
