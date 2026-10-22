/**
 * STAGE 2 FOUNDATION (PKG-S2-B): Standalone Realistic Industrial 3D Cutaway Assembly for HP01
 * Task: HP-RTXC-CUTAWAY-REDESIGN-01 (S2-FOUNDATION-09 / AC-S2F)
 *
 * Builds a complete, self-contained, cacheable Three.js assembly `HP01CutawayAssembly`:
 *  - Structural steel base frame (`FRAME-BASE`), 8 neoprene isolators `W1..W8` at exact OEM Fig. 5-4 stations
 *    (1285, 2885, 4385, 6185 mm; 4.900 m span), 8 rigging lugs `A..H` (Fig. 4-2), CG marker, 2500 mm service zone.
 *  - 12 axial EC fans (`FAN01..12` in `FAN-GRP1` & `FAN-GRP2`) and 2 V-shaped finned air coils (`ACOIL1`, `ACOIL2`).
 *  - 2 semi-hermetic twin-screw compressors (`COMP1`, `COMP2`) with open cutaway window showing suction motor stator,
 *    intermeshing helical male & female screw rotors (`ASSUMED_FOR_DEMO`), internal oil filter `OF-INT1/2` (OEM p. 49, 56),
 *    and 5 flanged nozzles.
 *  - Common falling-film shell-and-tube heat exchanger (`WHEX`) with 5 strictly isolated port-level medium domains
 *    (`WHEX::WATER_TUBES`, `WHEX::SHELL_CKT1`, `WHEX::SHELL_CKT2`, `WHEX::DRAIN_BOX`, `WHEX::HEATER_TERM`).
 *  - All 25 selectable 3D nodes, 38 physical auxiliary sub-elements (19 paired categories × 2 circuits),
 *    and 48 unique internal & boundary connections docked within <= 0.03 m (exact 0.000 m endpoint match).
 *  - Own resource management (`ownedGeometries`, `ownedMaterials`, `dispose()`, `pickableMeshes`).
 *  - Standalone only in S2-FOUNDATION-09 (no integration into rooftop_scene.mjs or app.mjs, no automatic Package C loop).
 */

import * as THREE from 'three';
import {
  HP01_GEOMETRY_CONSTANTS,
  HP01_WHEX_PORT_DOMAINS,
  HP01_BOUNDARY_PORTS,
  HP01_SUBNODES,
  HP01_AUX_VALVES,
  HP01_INTERNAL_CONNECTIONS,
  HP01_NODE_PIPES
} from './hp01_cutaway_meta.mjs';

/**
 * Generates a single continuous, closed, manifold indexed THREE.BufferGeometry for a helical screw rotor
 * along the local X axis [-lengthM/2, +lengthM/2] (F04: replaces discrete 8-disc approximation).
 *
 * Provenance: ASSUMED_FOR_DEMO — lobe profile, pitch, clearances, and lead count (5-lobe male / 6-flute female)
 * are illustrative engineering representations, not confirmed Trane manufacturing CAD drawings.
 */
export function createContinuousHelicalRotorGeometry(options = {}) {
  const rotorRole = options.rotorRole === 'female' ? 'female' : 'male';
  const lobeCount = Number.isInteger(options.lobeCount) ? options.lobeCount : rotorRole === 'male' ? 5 : 6;
  const lengthM = Number.isFinite(options.lengthM) ? options.lengthM : 0.28;
  const rootRadiusM = Number.isFinite(options.rootRadiusM) ? options.rootRadiusM : rotorRole === 'male' ? 0.030 : 0.028;
  const tipRadiusM = Number.isFinite(options.tipRadiusM) ? options.tipRadiusM : rotorRole === 'male' ? 0.054 : 0.050;
  const totalTwistRad = Number.isFinite(options.totalTwistRad)
    ? options.totalTwistRad
    : rotorRole === 'male'
      ? +2.4 * Math.PI
      : -2.0 * Math.PI;
  const lineOfCentersAngleRad = Number.isFinite(options.lineOfCentersAngleRad) ? options.lineOfCentersAngleRad : 0;
  const axialSegments = Number.isInteger(options.axialSegments) ? options.axialSegments : 64;
  const radialSegments = Number.isInteger(options.radialSegments) ? options.radialSegments : 90; // divisible by both 5 and 6

  const halfL = lengthM * 0.5;
  const ringCount = axialSegments + 1;
  const positions = [];
  const uvs = [];
  const indices = [];

  const profileRadiusAt = (theta, u) => {
    // Phase-locked tooth engagement angle along axial fraction u in [0, 1]:
    // 5 * (+2.4*pi) = 12*pi and -6 * (-2.0*pi) = 12*pi
    const engagementPhase = Math.abs(lobeCount * totalTwistRad) * (u - 0.5);
    let psi;
    if (rotorRole === 'male') {
      psi = lobeCount * (theta - lineOfCentersAngleRad) - engagementPhase;
      const c = 0.5 * (1 + Math.cos(psi));
      return rootRadiusM + (tipRadiusM - rootRadiusM) * Math.pow(Math.max(0, c), 1.48);
    } else {
      psi = -lobeCount * (theta - lineOfCentersAngleRad) - engagementPhase + Math.PI;
      const c = 0.5 * (1 + Math.cos(psi));
      return rootRadiusM + (tipRadiusM - rootRadiusM) * Math.pow(Math.max(0, c), 1.48);
    }
  };

  // Build continuous helical surface vertices: ringCount * radialSegments
  for (let ix = 0; ix < ringCount; ix++) {
    const u = ix / axialSegments;
    const x = -halfL + u * lengthM;
    for (let it = 0; it < radialSegments; it++) {
      const v = it / radialSegments;
      const theta = v * Math.PI * 2;
      const r = profileRadiusAt(theta, u);
      const y = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  // Connect adjacent axial rings with shared vertex indices (0 longitudinal gaps, watertight side wall, outward CCW normals)
  for (let ix = 0; ix < axialSegments; ix++) {
    const rowA = ix * radialSegments;
    const rowB = (ix + 1) * radialSegments;
    for (let it = 0; it < radialSegments; it++) {
      const nextIt = (it + 1) % radialSegments;
      const a0 = rowA + it;
      const a1 = rowA + nextIt;
      const b0 = rowB + it;
      const b1 = rowB + nextIt;
      indices.push(a0, a1, b0);
      indices.push(a1, b1, b0);
    }
  }

  // Add closed end-cap center vertices at x = -halfL and x = +halfL for a manifold closed solid
  const leftCapCenterIdx = positions.length / 3;
  positions.push(-halfL, 0, 0);
  uvs.push(0, 0.5);

  const rightCapCenterIdx = positions.length / 3;
  positions.push(+halfL, 0, 0);
  uvs.push(1, 0.5);

  const firstRingOffset = 0;
  const lastRingOffset = axialSegments * radialSegments;
  for (let it = 0; it < radialSegments; it++) {
    const nextIt = (it + 1) % radialSegments;
    // Left cap at x = -halfL (-X outward normal; traverses rim edge nextIt -> it, opposite to side-wall a0 -> a1)
    indices.push(leftCapCenterIdx, firstRingOffset + nextIt, firstRingOffset + it);
    // Right cap at x = +halfL (+X outward normal; traverses rim edge it -> nextIt, opposite to side-wall b1 -> b0)
    indices.push(rightCapCenterIdx, lastRingOffset + it, lastRingOffset + nextIt);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  geo.userData = {
    rotorRole,
    lobeCount,
    axialLengthM: lengthM,
    rootRadiusM,
    tipRadiusM,
    totalTwistRad,
    axialSegments,
    radialSegments,
    ringCount,
    isContinuousHelicalSurface: true,
    provenance: 'ASSUMED_FOR_DEMO',
    provenanceNote:
      'Continuous helical rotor BufferGeometry (ASSUMED_FOR_DEMO: lobe profile, pitch, clearances, and lead count are illustrative, not confirmed Trane CAD)'
  };

  return geo;
}

export class HP01CutawayAssembly {
  constructor(options = {}) {
    this.options = {
      initialCasingMode: options.initialCasingMode || 'ghost', // 'full' | 'ghost' | 'hidden'
      initialCircuitFilter: options.initialCircuitFilter || 'both', // 'both' | 'ckt1' | 'ckt2' | 'whex'
      showClearanceEnvelope: Boolean(options.showClearanceEnvelope ?? true)
    };

    this.disposed = false;
    this.buildCount = 0;

    // Dedicated owned resource sets for clean lifecycle management (S2P-05)
    this.ownedGeometries = new Set();
    this.ownedMaterials = new Set();

    // Scene graph containers
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'HP01_CUTAWAY_ASSEMBLY_ROOT';

    this.subNodeGroups = new Map();       // 25 selectable sub-nodes (COMP1..FRAME-BASE)
    this.auxValveGroups = new Map();      // 38 physical auxiliary sub-elements
    this.connectionGroups = new Map();    // 48 unique internal & boundary connections
    this.whexDomainGroups = new Map();    // 5 isolated port domains inside WHEX
    this.portMarkers = new Map();         // key: "OWNER_ID.portName" -> THREE.Object3D
    this.isolatorGroups = new Map();      // 8 isolators W1..W8
    this.riggingLugGroups = new Map();    // 8 rigging lugs A..H
    this.fanUnits = [];                   // 12 individual EC fan assemblies FAN01..12
    this.compressorInternals = new Map(); // COMP1/COMP2 -> { maleRotor, femaleRotor, maleRotorMesh, femaleRotorMesh, stator, inspectionLight }
    this.casingMeshes = [];               // Meshes controlled by setCasingMode('full'|'ghost'|'hidden')
    this.frontStructuralObstacles = [];   // Front frame columns & rails switched to ghost in local compressor inspection mode (F05)
    this.frontCasingObstacles = [];       // Front acoustic louver hidden during local compressor inspection mode (F05)
    this.pickableMeshes = [];             // Dedicated cutaway pickables (never mixed with rooftopPickableMeshes)

    this.selectedSubNodeId = null;
    this.casingMode = this.options.initialCasingMode;
    this.circuitFilter = this.options.initialCircuitFilter;
    this.inspectionFocusTarget = null;    // null | 'COMP1' | 'COMP2' (F05 reversible local inspection mode)

    this._initSharedPalette();
    this._buildAssemblyOnce();
  }

  _trackGeo(geo) {
    this.ownedGeometries.add(geo);
    return geo;
  }

  _trackMat(mat) {
    this.ownedMaterials.add(mat);
    return mat;
  }

  _mesh(geo, mat, name = '') {
    this._trackGeo(geo);
    this._trackMat(mat);
    const m = new THREE.Mesh(geo, mat);
    if (name) m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  _initSharedPalette() {
    this.palette = {
      frameSteel: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.75 })),
      frameSteelInspectionGhost: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.55,
          metalness: 0.75,
          transparent: true,
          opacity: 0.05,
          depthWrite: false
        })
      ),
      pedestalSteel: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.7 })),
      neoprenePad: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.15 })),
      riggingLugYellow: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35, metalness: 0.6 })),
      compBodyCkt1: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.42, metalness: 0.68, side: THREE.DoubleSide })),
      compBodyCkt2: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.42, metalness: 0.68, side: THREE.DoubleSide })),
      cutFaceMachined: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.88 })),
      rotorMaleSteel: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0x92400e,
          emissiveIntensity: 0.20,
          roughness: 0.22,
          metalness: 0.86
        })
      ),
      rotorFemaleSteel: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0369a1,
          emissiveIntensity: 0.20,
          roughness: 0.22,
          metalness: 0.86
        })
      ),
      motorCopper: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xf97316,
          emissive: 0x9a3412,
          emissiveIntensity: 0.16,
          roughness: 0.28,
          metalness: 0.84
        })
      ),
      motorStatorCore: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.35,
          metalness: 0.80,
          side: THREE.DoubleSide
        })
      ),
      whexShellSteel: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.45, metalness: 0.65 })),
      whexWaterboxCast: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.48, metalness: 0.62 })),
      copperTubeBundle: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.3, metalness: 0.86 })),
      bafflePartition: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.35, metalness: 0.5 })),
      vesselOsSteel: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.42, metalness: 0.68 })),
      vesselRecSteel: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x6b21a8, roughness: 0.42, metalness: 0.68 })),
      stainlessBphe: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.28, metalness: 0.88 })),
      brassValve: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.32, metalness: 0.82 })),
      solenoidCoilBlue: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, metalness: 0.45 })),
      stepperMotorBlack: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.5 })),
      internalFilterGold: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.85 })),
      airCoilFins: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.45, metalness: 0.72 })),
      fanShroudDark: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.4 })),
      fanBladeSteel: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.65 })),
      drainPanStainless: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.38, metalness: 0.75 })),
      symbioCabinetGrey: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.48, metalness: 0.58 })),
      vfdHeatsink: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.85 })),
      td7ScreenGlow: this._trackMat(new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0284c7, emissiveIntensity: 0.45, roughness: 0.2 })),
      portNozzleRim: this._trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.85 })),
      casingPanelMat: this._trackMat(new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.55,
        metalness: 0.45,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
      }))
    };
  }

  _buildAssemblyOnce() {
    this.buildCount += 1;

    // 1. Initialize 25 selectable sub-node groups in exact catalog order
    for (const [subId, meta] of Object.entries(HP01_SUBNODES)) {
      const grp = new THREE.Group();
      grp.name = `SUBNODE_${subId}`;
      grp.userData = {
        compId: 'HP01',
        subNodeId: subId,
        shortNameHe: meta.shortNameHe,
        titleHe: meta.titleHe,
        circuit: meta.circuit,
        mediumDomain: meta.mediumDomain,
        supportType: meta.supportType,
        supportTargetId: meta.supportTargetId,
        provenance: meta.provenance,
        sourceRef: meta.sourceRef,
        highlightConnections: [...meta.highlightConnections]
      };
      this.subNodeGroups.set(subId, grp);
      this.rootGroup.add(grp);
    }

    // 2. Build detailed geometry for each of the 25 sub-nodes
    this._buildFrameBaseAndSupports();
    this._buildWhexAndFiveDomains();
    this._buildTwinScrewCompressors();
    this._buildOilSeparatorsAndFourWayValves();
    this._buildEconomizersAndExpansionValves();
    this._buildLiquidReceivers();
    this._buildOilManagementSkids();
    this._buildVCoilsFansAndDrainSystem();
    this._buildFlowSwitchAndSymbioCabinet();
    this._buildCasingEnvelope();

    // 3. Build all 38 physical auxiliary sub-elements (19 paired categories × 2 circuits)
    this._buildAll38AuxValves();

    // 4. Build all named port nozzles for sub-nodes, aux valves, and boundary flanges
    this._buildAllPortMarkers();

    // 5. Build all 48 internal & boundary connections with exact port docking and pipe clamps
    this._buildAll48Connections();

    // 6. Register pickable meshes for all 25 sub-nodes
    this._collectPickableMeshes();

    // 7. Apply initial casing mode and circuit filter
    this.setCasingMode(this.casingMode);
    this.setCircuitFilter(this.circuitFilter);
    this.rootGroup.updateMatrixWorld(true);
  }

  _buildFrameBaseAndSupports() {
    const frameGrp = this.subNodeGroups.get('FRAME-BASE');
    const frameHalfLen = 3.847; // 7694 mm frame length (Fig. 5-4 p. 25)
    const zMount = 1.085;      // 2170 mm isolator center width

    // Main longitudinal steel I-beams (front Z+, rear Z-, inner spine rails)
    for (const zPos of [+zMount, -zMount, +0.52, -0.38]) {
      const beam = this._mesh(
        new THREE.BoxGeometry(frameHalfLen * 2, 0.20, 0.12),
        this.palette.frameSteel,
        `FRAME_LONG_BEAM_Z_${zPos.toFixed(2)}`
      );
      beam.position.set(0, 0.17, zPos);
      frameGrp.add(beam);
    }

    // Transverse cross-members at isolator and bay stations
    const crossXStations = [-3.80, -2.562, -1.75, -0.962, 0.0, +0.538, +1.55, +2.338, +3.18, +3.80];
    for (const xPos of crossXStations) {
      const crossBeam = this._mesh(
        new THREE.BoxGeometry(0.11, 0.18, 2.22),
        this.palette.frameSteel,
        `FRAME_CROSS_BEAM_X_${xPos.toFixed(2)}`
      );
      crossBeam.position.set(xPos, 0.16, 0);
      frameGrp.add(crossBeam);
    }

    // Lower machine deck grating plate
    const deckPlate = this._mesh(
      new THREE.BoxGeometry(7.64, 0.03, 2.12),
      this.palette.pedestalSteel,
      'FRAME_DECK_PLATE'
    );
    deckPlate.position.set(0, 0.085, 0);
    frameGrp.add(deckPlate);

    // 12 Vertical structural columns supporting the upper V-coil and fan deck (6 bays)
    const bayPostX = [-3.15, -1.75, -0.35, +0.35, +1.75, +3.05];
    for (const xPos of bayPostX) {
      for (const zPos of [+1.04, -1.04]) {
        const col = this._mesh(
          new THREE.BoxGeometry(0.08, 1.96, 0.08),
          this.palette.frameSteel,
          `FRAME_VERTICAL_COLUMN_${xPos.toFixed(2)}_${zPos.toFixed(2)}`
        );
        col.position.set(xPos, 1.25, zPos);
        if (zPos > 0) {
          this.frontStructuralObstacles.push(col);
        }
        frameGrp.add(col);
      }
    }

    // Upper fan-deck perimeter frame rails
    for (const zPos of [+1.04, -1.04]) {
      const topRail = this._mesh(
        new THREE.BoxGeometry(6.40, 0.08, 0.08),
        this.palette.frameSteel,
        `FRAME_TOP_RAIL_${zPos.toFixed(2)}`
      );
      topRail.position.set(-0.05, 2.22, zPos);
      if (zPos > 0) {
        this.frontStructuralObstacles.push(topRail);
      }
      frameGrp.add(topRail);
    }

    // 8 Neoprene Vibration Isolators W1..W8 (RDP4-WR: 158.8 × 69.9 × 117.6 mm, Fig. 5-4 p. 25)
    for (const iso of HP01_GEOMETRY_CONSTANTS.isolatorStations) {
      const isoGrp = new THREE.Group();
      isoGrp.name = `ISOLATOR_${iso.id}`;
      isoGrp.position.set(iso.pos[0], iso.pos[1], iso.pos[2]);
      isoGrp.userData = { isolatorId: iso.id, loadKg: iso.loadKg, offsetFromLeftMm: iso.offsetFromLeftMm };

      const pad = this._mesh(
        new THREE.BoxGeometry(0.159, 0.052, 0.118),
        this.palette.neoprenePad,
        `${iso.id}_NEOPRENE_PAD`
      );
      const topPlate = this._mesh(
        new THREE.BoxGeometry(0.165, 0.016, 0.124),
        this.palette.cutFaceMachined,
        `${iso.id}_TOP_PLATE`
      );
      topPlate.position.y = 0.026;
      isoGrp.add(pad, topPlate);

      this.isolatorGroups.set(iso.id, isoGrp);
      frameGrp.add(isoGrp);
    }

    // 8 Rigging Lugs A..H (Figure 4-2 p. 22, steps 1081 + 1800 + 1800 + 1900 mm)
    for (const lug of HP01_GEOMETRY_CONSTANTS.riggingLugs) {
      const lugGrp = new THREE.Group();
      lugGrp.name = `RIGGING_LUG_${lug.id}`;
      lugGrp.position.set(lug.pos[0], lug.pos[1], lug.pos[2]);
      lugGrp.userData = { lugId: lug.id, loadKg: lug.loadKg };

      const plate = this._mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.03),
        this.palette.riggingLugYellow,
        `LUG_${lug.id}_PLATE`
      );
      const eyeRing = this._mesh(
        new THREE.TorusGeometry(0.035, 0.010, 10, 20),
        this.palette.riggingLugYellow,
        `LUG_${lug.id}_EYE`
      );
      eyeRing.position.y = 0.05;
      lugGrp.add(plate, eyeRing);

      this.riggingLugGroups.set(lug.id, lugGrp);
      frameGrp.add(lugGrp);
    }

    // Center of Gravity (CG) 3D Marker (Xcg=3851 mm, Ycg=1120 mm, Zcg=937 mm -> [+0.004, 0.937, -0.005])
    const cg = HP01_GEOMETRY_CONSTANTS.centerOfGravityM;
    const cgMarker = this._mesh(
      new THREE.SphereGeometry(0.075, 16, 16),
      this.palette.riggingLugYellow,
      'CG_MARKER_SPHERE'
    );
    cgMarker.position.set(cg.x, cg.y, cg.z);
    frameGrp.add(cgMarker);

    // Service Clearance Envelope (2500 mm WHEX tube pull on -X left end, Fig. 3-2 p. 20)
    this.clearanceGroup = new THREE.Group();
    this.clearanceGroup.name = 'SERVICE_CLEARANCE_ENVELOPE_2500MM';
    const tubePullZone = this._mesh(
      new THREE.BoxGeometry(2.50, 0.02, 1.10),
      this._trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true })),
      'WHEX_TUBE_PULL_ZONE_2500MM'
    );
    tubePullZone.position.set(-3.847 - 1.25, 0.02, -0.38);
    this.clearanceGroup.add(tubePullZone);
    this.clearanceGroup.visible = this.options.showClearanceEnvelope;
    frameGrp.add(this.clearanceGroup);
  }

  _buildWhexAndFiveDomains() {
    const whexGrp = this.subNodeGroups.get('WHEX');
    const cx = -0.05;
    const cy = 0.82;
    const cz = -0.38;

    // Two heavy steel saddle cradles welded to FRAME-BASE supporting WHEX
    for (const sx of [-1.35, +1.25]) {
      const saddle = this._mesh(
        new THREE.BoxGeometry(0.22, 0.42, 0.78),
        this.palette.pedestalSteel,
        `WHEX_SADDLE_SUPPORT_${sx.toFixed(2)}`
      );
      saddle.position.set(sx, 0.46, cz);
      whexGrp.add(saddle);
    }

    // Create 5 strictly isolated port-domain sub-groups inside WHEX (S2P-03)
    for (const domId of Object.keys(HP01_WHEX_PORT_DOMAINS)) {
      const dGrp = new THREE.Group();
      dGrp.name = domId;
      dGrp.userData = { ...HP01_WHEX_PORT_DOMAINS[domId] };
      this.whexDomainGroups.set(domId, dGrp);
      whexGrp.add(dGrp);
    }

    // Domain 1: WHEX::WATER_TUBES (Cast-iron waterboxes DN150, tube sheets, and 36 internal copper tubes)
    const waterDomGrp = this.whexDomainGroups.get('WHEX::WATER_TUBES');
    for (const endX of [-2.18, +2.08]) {
      const waterbox = this._mesh(
        new THREE.CylinderGeometry(0.41, 0.41, 0.24, 24),
        this.palette.whexWaterboxCast,
        `WHEX_WATERBOX_${endX < 0 ? 'INLET' : 'OUTLET'}`
      );
      waterbox.rotation.z = Math.PI / 2;
      waterbox.position.set(endX, cy, cz);
      waterDomGrp.add(waterbox);

      const tubeSheet = this._mesh(
        new THREE.CylinderGeometry(0.40, 0.40, 0.04, 24),
        this.palette.cutFaceMachined,
        `WHEX_TUBESHEET_${endX < 0 ? 'LEFT' : 'RIGHT'}`
      );
      tubeSheet.rotation.z = Math.PI / 2;
      tubeSheet.position.set(endX + (endX < 0 ? +0.13 : -0.13), cy, cz);
      waterDomGrp.add(tubeSheet);
    }

    // 36 internal copper water tubes spanning strictly between the left and right tube sheets
    const tubeGeo = this._trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 4.02, 10));
    for (let row = -2; row <= 2; row++) {
      for (let col = -3; col <= 3; col++) {
        if (Math.hypot(row * 0.08, col * 0.08) > 0.30) continue;
        const tube = new THREE.Mesh(tubeGeo, this.palette.copperTubeBundle);
        tube.rotation.z = Math.PI / 2;
        tube.position.set(cx, cy + row * 0.075, cz + col * 0.075);
        waterDomGrp.add(tube);
      }
    }

    // Domain 2: WHEX::SHELL_CKT1 (Right half of shell X in [+0.02, +1.95], cutaway front window)
    const shellCkt1Grp = this.whexDomainGroups.get('WHEX::SHELL_CKT1');
    const ckt1ShellRear = this._mesh(
      new THREE.CylinderGeometry(0.41, 0.41, 1.92, 24, 1, false, Math.PI * 0.15, Math.PI * 1.35),
      this.palette.whexShellSteel,
      'WHEX_SHELL_CKT1_CHAMBER'
    );
    ckt1ShellRear.rotation.z = Math.PI / 2;
    ckt1ShellRear.position.set(+0.98, cy, cz);
    const ckt1SprayDistributor = this._mesh(
      new THREE.BoxGeometry(1.70, 0.05, 0.18),
      this.palette.brassValve,
      'WHEX_CKT1_FALLING_FILM_DISTRIBUTOR'
    );
    ckt1SprayDistributor.position.set(+0.98, cy + 0.28, cz);
    shellCkt1Grp.add(ckt1ShellRear, ckt1SprayDistributor);

    // Domain 3: WHEX::SHELL_CKT2 (Left half of shell X in [-2.05, -0.02], separated by inter-circuit partition baffle)
    const shellCkt2Grp = this.whexDomainGroups.get('WHEX::SHELL_CKT2');
    const ckt2ShellRear = this._mesh(
      new THREE.CylinderGeometry(0.41, 0.41, 1.98, 24, 1, false, Math.PI * 0.15, Math.PI * 1.35),
      this.palette.whexShellSteel,
      'WHEX_SHELL_CKT2_CHAMBER'
    );
    ckt2ShellRear.rotation.z = Math.PI / 2;
    ckt2ShellRear.position.set(-1.04, cy, cz);
    const ckt2SprayDistributor = this._mesh(
      new THREE.BoxGeometry(1.75, 0.05, 0.18),
      this.palette.brassValve,
      'WHEX_CKT2_FALLING_FILM_DISTRIBUTOR'
    );
    ckt2SprayDistributor.position.set(-1.04, cy + 0.28, cz);

    // Conceptual Inter-Circuit Partition Baffle at X = -0.02 m (ASSUMED_FOR_DEMO — isolates SHELL_CKT1 and SHELL_CKT2)
    const partitionBaffle = this._mesh(
      new THREE.CylinderGeometry(0.405, 0.405, 0.035, 24),
      this.palette.bafflePartition,
      'WHEX_INTER_CIRCUIT_PARTITION_BAFFLE_ASSUMED'
    );
    partitionBaffle.rotation.z = Math.PI / 2;
    partitionBaffle.position.set(-0.02, cy, cz);
    shellCkt2Grp.add(ckt2ShellRear, ckt2SprayDistributor, partitionBaffle);

    // Domain 4: WHEX::DRAIN_BOX
    const drainBoxGrp = this.whexDomainGroups.get('WHEX::DRAIN_BOX');
    const drainBoss = this._mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.10, 12),
      this.palette.brassValve,
      'WHEX_WATERBOX_DRAIN_BOSS'
    );
    drainBoss.position.set(-2.18, 0.44, -0.46);
    drainBoxGrp.add(drainBoss);

    // Domain 5: WHEX::HEATER_TERM (230VAC 16A Freeze Protection Heater Terminal Box)
    const heaterTermGrp = this.whexDomainGroups.get('WHEX::HEATER_TERM');
    const heaterBox = this._mesh(
      new THREE.BoxGeometry(0.14, 0.16, 0.10),
      this._trackMat(new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4, metalness: 0.5 })),
      'WHEX_230V_FREEZE_HEATER_BOX'
    );
    heaterBox.position.set(+2.08, 0.64, -0.58);
    heaterTermGrp.add(heaterBox);
  }

  _buildTwinScrewCompressors() {
    for (const k of [1, 2]) {
      const s = k === 1 ? +1 : -1;
      const compId = `COMP${k}`;
      const compGrp = this.subNodeGroups.get(compId);
      const meta = HP01_SUBNODES[compId];
      const [cx, cy, cz] = meta.center;
      const bodyMat = k === 1 ? this.palette.compBodyCkt1 : this.palette.compBodyCkt2;

      // 1. Welded steel pedestal + 4 elastomeric mounting feet on FRAME-BASE
      const pedestal = this._mesh(
        new THREE.BoxGeometry(0.88, 0.22, 0.52),
        this.palette.pedestalSteel,
        `${compId}_STEEL_PEDESTAL`
      );
      pedestal.position.set(cx, 0.34, cz);
      compGrp.add(pedestal);

      for (const dx of [-0.34, +0.34]) {
        for (const dz of [-0.18, +0.18]) {
          const foot = this._mesh(
            new THREE.CylinderGeometry(0.04, 0.045, 0.05, 12),
            this.palette.neoprenePad,
            `${compId}_VIB_MOUNT`
          );
          foot.position.set(cx + dx, 0.46, cz + dz);
          compGrp.add(foot);
        }
      }

      // 2. Stepped Cast-Iron Semi-Hermetic Casing with Wide Front-Upper Cutaway Window (F05)
      // Note: With rotation.z = +PI/2, theta = 0 is +Z (front), theta = PI/2 is +Y (top), theta = PI is -Z (rear), theta = 1.5*PI is -Y (bottom).
      // Using thetaStart = 0.55*PI and thetaLength = 1.15*PI leaves the entire front sector (-54° to +99°) open for direct inspection.
      const motorBarrel = this._mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.38, 28, 1, false, Math.PI * 0.54, Math.PI * 1.16),
        bodyMat,
        `${compId}_SUCTION_MOTOR_BARREL`
      );
      motorBarrel.rotation.z = Math.PI / 2;
      motorBarrel.position.set(cx - s * 0.22, cy, cz);

      const rotorCasing = this._mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.36, 28, 1, false, Math.PI * 0.56, Math.PI * 1.14),
        bodyMat,
        `${compId}_ROTOR_COMPRESSION_CASING`
      );
      rotorCasing.rotation.z = Math.PI / 2;
      rotorCasing.position.set(cx + s * 0.12, cy, cz);

      const dischargeEndBell = this._mesh(
        new THREE.CylinderGeometry(0.23, 0.22, 0.16, 24),
        bodyMat,
        `${compId}_DISCHARGE_HOUSING`
      );
      dischargeEndBell.rotation.z = Math.PI / 2;
      dischargeEndBell.position.set(cx + s * 0.36, cy, cz);

      // Machined cutaway window upper & lower lips (framing the opening without crossing in front of the rotors)
      const cutRimTop = this._mesh(
        new THREE.BoxGeometry(0.68, 0.022, 0.05),
        this.palette.cutFaceMachined,
        `${compId}_CUTAWAY_SECTION_RIM_TOP`
      );
      cutRimTop.position.set(cx - s * 0.04, cy + 0.20, cz - 0.02);

      const cutRimBot = this._mesh(
        new THREE.BoxGeometry(0.68, 0.022, 0.05),
        this.palette.cutFaceMachined,
        `${compId}_CUTAWAY_SECTION_RIM_BOT`
      );
      cutRimBot.position.set(cx - s * 0.04, cy - 0.14, cz + 0.15);

      // 3. Suction-cooled electric motor stator + copper coil end-windings + inner motor rotor
      const statorGroup = new THREE.Group();
      statorGroup.name = `${compId}_MOTOR_STATOR`;
      const statorCore = this._mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.24, 24, 1, false, Math.PI * 0.50, Math.PI * 1.22),
        this.palette.motorStatorCore,
        `${compId}_STATOR_LAMINATIONS`
      );
      statorCore.rotation.z = Math.PI / 2;

      const motorInnerRotor = this._mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 0.26, 20),
        this.palette.cutFaceMachined,
        `${compId}_MOTOR_ROTOR_CORE`
      );
      motorInnerRotor.rotation.z = Math.PI / 2;

      const coilFront = this._mesh(
        new THREE.TorusGeometry(0.135, 0.034, 14, 24),
        this.palette.motorCopper,
        `${compId}_COPPER_WINDING_A`
      );
      coilFront.rotation.y = Math.PI / 2;
      coilFront.position.x = -0.12;
      const coilRear = this._mesh(
        new THREE.TorusGeometry(0.135, 0.034, 14, 24),
        this.palette.motorCopper,
        `${compId}_COPPER_WINDING_B`
      );
      coilRear.rotation.y = Math.PI / 2;
      coilRear.position.x = +0.12;

      // Copper stator slot bars visible across the open stator core
      for (let slotIdx = 0; slotIdx < 6; slotIdx++) {
        const slotAng = -0.35 + slotIdx * 0.28;
        const slotBar = this._mesh(
          new THREE.BoxGeometry(0.24, 0.012, 0.014),
          this.palette.motorCopper,
          `${compId}_STATOR_SLOT_BAR_${slotIdx}`
        );
        slotBar.position.set(0, Math.sin(slotAng) * 0.145, Math.cos(slotAng) * 0.145);
        statorGroup.add(slotBar);
      }

      statorGroup.add(statorCore, motorInnerRotor, coilFront, coilRear);
      statorGroup.position.set(cx - s * 0.22, cy, cz);

      // 4. Continuous Intermeshing Helical Twin-Screw Rotors (F04: Male 5-lobe + Female 6-flute continuous BufferGeometry, ASSUMED_FOR_DEMO)
      // Male center (upper-inner) and Female center (lower-front) inside rotorCasing:
      // dy = -0.075 m, dz = +0.046 m -> center distance D_mf = 0.087982952894 m (87.982952894 mm).
      // Tip sum R_tip_m (0.054) + R_tip_f (0.050) = 0.104 m > D_mf (19.1 mm pitch intermeshing).
      // Root+Tip sum max(0.054+0.028, 0.030+0.050) = 0.082 m < D_mf (>= 2.2 mm clearance at every slice, 0 solid interpenetration).
      const malePos = [cx + s * 0.12, cy + 0.038, cz + 0.014];
      const femalePos = [cx + s * 0.12, cy - 0.037, cz + 0.060];
      const dyMf = femalePos[1] - malePos[1];
      const dzMf = femalePos[2] - malePos[2];
      const thetaMf = Math.atan2(dzMf, dyMf);
      const thetaFm = thetaMf + Math.PI;

      const maleRotor = new THREE.Group();
      maleRotor.name = `${compId}_MALE_SCREW_ROTOR_ASSUMED`;
      maleRotor.position.set(malePos[0], malePos[1], malePos[2]);

      const maleHelicalGeo = createContinuousHelicalRotorGeometry({
        rotorRole: 'male',
        lobeCount: 5,
        lengthM: 0.28,
        rootRadiusM: 0.030,
        tipRadiusM: 0.054,
        totalTwistRad: +2.4 * Math.PI,
        lineOfCentersAngleRad: thetaMf,
        axialSegments: 64,
        radialSegments: 90
      });
      const maleRotorMesh = this._mesh(
        maleHelicalGeo,
        this.palette.rotorMaleSteel,
        `${compId}_MALE_HELICAL_ROTOR_SURFACE`
      );
      const maleShaft = this._mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.34, 18),
        this.palette.cutFaceMachined,
        `${compId}_MALE_JOURNAL_SHAFT`
      );
      maleShaft.rotation.z = Math.PI / 2;
      maleRotor.add(maleRotorMesh, maleShaft);

      const femaleRotor = new THREE.Group();
      femaleRotor.name = `${compId}_FEMALE_SCREW_ROTOR_ASSUMED`;
      femaleRotor.position.set(femalePos[0], femalePos[1], femalePos[2]);

      const femaleHelicalGeo = createContinuousHelicalRotorGeometry({
        rotorRole: 'female',
        lobeCount: 6,
        lengthM: 0.28,
        rootRadiusM: 0.028,
        tipRadiusM: 0.050,
        totalTwistRad: -2.0 * Math.PI,
        lineOfCentersAngleRad: thetaFm,
        axialSegments: 64,
        radialSegments: 90
      });
      const femaleRotorMesh = this._mesh(
        femaleHelicalGeo,
        this.palette.rotorFemaleSteel,
        `${compId}_FEMALE_HELICAL_ROTOR_SURFACE`
      );
      const femaleShaft = this._mesh(
        new THREE.CylinderGeometry(0.020, 0.020, 0.34, 18),
        this.palette.cutFaceMachined,
        `${compId}_FEMALE_JOURNAL_SHAFT`
      );
      femaleShaft.rotation.z = Math.PI / 2;
      femaleRotor.add(femaleRotorMesh, femaleShaft);

      // Top electrical terminal box on compressor
      const termBox = this._mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.16),
        this.palette.pedestalSteel,
        `${compId}_TERMINAL_BOX`
      );
      termBox.position.set(cx - s * 0.22, cy + 0.28, cz - 0.04);

      // Dedicated local inspection light illuminating the cutaway cavity (F05)
      const inspectionLight = new THREE.PointLight(0xfffbeb, 1.65, 1.5);
      inspectionLight.name = `${compId}_CUTAWAY_INSPECTION_LIGHT`;
      inspectionLight.position.set(cx, cy + 0.16, cz + 0.44);

      compGrp.add(
        motorBarrel,
        rotorCasing,
        dischargeEndBell,
        cutRimTop,
        cutRimBot,
        statorGroup,
        maleRotor,
        femaleRotor,
        termBox,
        inspectionLight
      );
      this.compressorInternals.set(compId, {
        maleRotor,
        femaleRotor,
        maleRotorMesh,
        femaleRotorMesh,
        stator: statorGroup,
        inspectionLight,
        centerDistanceM: Math.hypot(dyMf, dzMf)
      });
    }
  }

  _buildOilSeparatorsAndFourWayValves() {
    for (const k of [1, 2]) {
      // OS1 / OS2: Centrifugal oil separator vessels on steel frame legs (86 kg)
      const osId = `OS${k}`;
      const osGrp = this.subNodeGroups.get(osId);
      const [ox, oy, oz] = HP01_SUBNODES[osId].center;

      const stand = this._mesh(
        new THREE.BoxGeometry(0.28, 0.26, 0.28),
        this.palette.pedestalSteel,
        `${osId}_SUPPORT_STAND`
      );
      stand.position.set(ox, 0.22, oz);

      const vessel = this._mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.96, 24),
        this.palette.vesselOsSteel,
        `${osId}_CENTRIFUGAL_VESSEL`
      );
      vessel.position.set(ox, oy, oz);

      const topDome = this._mesh(
        new THREE.SphereGeometry(0.15, 20, 12),
        this.palette.vesselOsSteel,
        `${osId}_TOP_DOME`
      );
      topDome.position.set(ox, oy + 0.46, oz);
      osGrp.add(stand, vessel, topDome);

      // 4WV1 / 4WV2: 4-Way reversing slide valves on pipe rack stanchion (22 kg)
      const wvId = `4WV${k}`;
      const wvGrp = this.subNodeGroups.get(wvId);
      const [wx, wy, wz] = HP01_SUBNODES[wvId].center;

      const stanchion = this._mesh(
        new THREE.CylinderGeometry(0.025, 0.03, 1.05, 10),
        this.palette.pedestalSteel,
        `${wvId}_SUPPORT_STANCHION`
      );
      stanchion.position.set(wx, 0.68, wz);

      const valveBody = this._mesh(
        new THREE.CylinderGeometry(0.068, 0.068, 0.30, 18),
        this.palette.brassValve,
        `${wvId}_SLIDE_VALVE_BODY`
      );
      valveBody.rotation.z = Math.PI / 2;
      valveBody.position.set(wx, wy, wz);

      const pilotCoil = this._mesh(
        new THREE.BoxGeometry(0.07, 0.08, 0.07),
        this.palette.solenoidCoilBlue,
        `${wvId}_PILOT_SOLENOID`
      );
      pilotCoil.position.set(wx, wy + 0.10, wz);
      wvGrp.add(stanchion, valveBody, pilotCoil);
    }
  }

  _buildEconomizersAndExpansionValves() {
    for (const k of [1, 2]) {
      // ECON1 / ECON2: Brazed-plate economizer on steel bracket
      const econId = `ECON${k}`;
      const econGrp = this.subNodeGroups.get(econId);
      const [ex, ey, ez] = HP01_SUBNODES[econId].center;

      const stand = this._mesh(
        new THREE.BoxGeometry(0.36, 0.42, 0.28),
        this.palette.pedestalSteel,
        `${econId}_FRAME_STAND`
      );
      stand.position.set(ex, 0.32, ez);

      const bphePack = this._mesh(
        new THREE.BoxGeometry(0.24, 0.42, 0.18),
        this.palette.stainlessBphe,
        `${econId}_BPHE_PLATE_PACK`
      );
      bphePack.position.set(ex, ey, ez);
      econGrp.add(stand, bphePack);

      // EXV-C1 / EXV-C2: Cooling / Defrost Expansion Valves
      const exvCId = `EXV-C${k}`;
      const exvCGrp = this.subNodeGroups.get(exvCId);
      const [cx, cy, cz] = HP01_SUBNODES[exvCId].center;

      const cBracket = this._mesh(
        new THREE.BoxGeometry(0.06, 0.68, 0.06),
        this.palette.pedestalSteel,
        `${exvCId}_SUPPORT_BRACKET`
      );
      cBracket.position.set(cx, 0.52, cz);
      const cBody = this._mesh(
        new THREE.CylinderGeometry(0.042, 0.036, 0.14, 14),
        this.palette.brassValve,
        `${exvCId}_VALVE_BODY`
      );
      cBody.position.set(cx, cy - 0.03, cz);
      const cStepper = this._mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.09, 14),
        this.palette.stepperMotorBlack,
        `${exvCId}_STEPPER_HEAD`
      );
      cStepper.position.set(cx, cy + 0.07, cz);
      exvCGrp.add(cBracket, cBody, cStepper);

      // EXV-H1 / EXV-H2: Heating Expansion Valves
      const exvHId = `EXV-H${k}`;
      const exvHGrp = this.subNodeGroups.get(exvHId);
      const [hx, hy, hz] = HP01_SUBNODES[exvHId].center;

      const hBracket = this._mesh(
        new THREE.BoxGeometry(0.06, 1.04, 0.06),
        this.palette.pedestalSteel,
        `${exvHId}_SUPPORT_BRACKET`
      );
      hBracket.position.set(hx, 0.70, hz);
      const hBody = this._mesh(
        new THREE.CylinderGeometry(0.042, 0.036, 0.14, 14),
        this.palette.brassValve,
        `${exvHId}_VALVE_BODY`
      );
      hBody.position.set(hx, hy - 0.03, hz);
      const hStepper = this._mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.09, 14),
        this.palette.stepperMotorBlack,
        `${exvHId}_STEPPER_HEAD`
      );
      hStepper.position.set(hx, hy + 0.07, hz);
      exvHGrp.add(hBracket, hBody, hStepper);
    }
  }

  _buildLiquidReceivers() {
    for (const k of [1, 2]) {
      const recId = `REC${k}`;
      const recGrp = this.subNodeGroups.get(recId);
      const [rx, ry, rz] = HP01_SUBNODES[recId].center;

      const leg = this._mesh(
        new THREE.BoxGeometry(0.22, 0.24, 0.22),
        this.palette.pedestalSteel,
        `${recId}_FRAME_LEG`
      );
      leg.position.set(rx, 0.20, rz);

      const shell = this._mesh(
        new THREE.CylinderGeometry(0.125, 0.125, 0.76, 22),
        this.palette.vesselRecSteel,
        `${recId}_LIQUID_RECEIVER_SHELL`
      );
      shell.position.set(rx, ry, rz);

      const topCap = this._mesh(
        new THREE.SphereGeometry(0.125, 18, 12),
        this.palette.vesselRecSteel,
        `${recId}_TOP_CAP`
      );
      topCap.position.set(rx, ry + 0.36, rz);
      recGrp.add(leg, shell, topCap);
    }
  }

  _buildOilManagementSkids() {
    for (const k of [1, 2]) {
      const oilId = `OIL-CKT${k}`;
      const oilGrp = this.subNodeGroups.get(oilId);
      const [ox, oy, oz] = HP01_SUBNODES[oilId].center;

      const skidPlate = this._mesh(
        new THREE.BoxGeometry(0.54, 0.22, 0.42),
        this.palette.pedestalSteel,
        `${oilId}_SKID_MOUNT`
      );
      skidPlate.position.set(ox, 0.28, oz);

      const manifoldBlock = this._mesh(
        new THREE.BoxGeometry(0.32, 0.10, 0.22),
        this.palette.brassValve,
        `${oilId}_MANIFOLD_BLOCK`
      );
      manifoldBlock.position.set(ox, oy, oz);
      oilGrp.add(skidPlate, manifoldBlock);
    }
  }

  _buildVCoilsFansAndDrainSystem() {
    // DRAIN-SYS: Sloped condensate/defrost pans under ACOIL1 & ACOIL2 + DN50 drain manifold
    const drainGrp = this.subNodeGroups.get('DRAIN-SYS');
    for (const panX of [+1.55, -1.75]) {
      const pan = this._mesh(
        new THREE.BoxGeometry(2.54, 0.06, 1.98),
        this.palette.drainPanStainless,
        `DRAIN_PAN_${panX > 0 ? 'CKT1' : 'CKT2'}`
      );
      pan.position.set(panX, 1.32, 0.0);
      drainGrp.add(pan);
    }
    const drainDowncomer = this._mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 1.04, 12),
      this.palette.drainPanStainless,
      'DRAIN_SYS_VERTICAL_COLLECTOR'
    );
    drainDowncomer.position.set(-2.18, 0.78, -0.72);
    drainGrp.add(drainDowncomer);

    // ACOIL1 & ACOIL2: 3-bay V-shaped finned copper-aluminum coils
    for (const k of [1, 2]) {
      const acoilId = `ACOIL${k}`;
      const acoilGrp = this.subNodeGroups.get(acoilId);
      const [ax, ay, az] = HP01_SUBNODES[acoilId].center;

      for (const sideZ of [-1, +1]) {
        const slab = this._mesh(
          new THREE.BoxGeometry(2.42, 0.84, 0.09),
          this.palette.airCoilFins,
          `${acoilId}_FIN_SLAB_${sideZ > 0 ? 'FRONT' : 'REAR'}`
        );
        slab.position.set(ax, ay, az + sideZ * 0.46);
        slab.rotation.x = -sideZ * 0.34; // V-shape inclination (illustrative ASSUMED_FOR_DEMO)
        acoilGrp.add(slab);
      }

      // Top gas header & bottom liquid distributor manifold
      const topHdr = this._mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 2.44, 14),
        this.palette.copperTubeBundle,
        `${acoilId}_TOP_GAS_HEADER`
      );
      topHdr.rotation.z = Math.PI / 2;
      topHdr.position.set(ax, 2.08, -0.12);

      const botHdr = this._mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 2.44, 14),
        this.palette.copperTubeBundle,
        `${acoilId}_BOT_LIQUID_DISTRIBUTOR`
      );
      botHdr.rotation.z = Math.PI / 2;
      botHdr.position.set(ax, 1.38, +0.42);
      acoilGrp.add(topHdr, botHdr);
    }

    // FAN-GRP1 (FAN01..06) & FAN-GRP2 (FAN07..12): 12 Axial EC Fans (2 rows × 3 fans per circuit)
    for (const k of [1, 2]) {
      const fanGrpId = `FAN-GRP${k}`;
      const fanGrp = this.subNodeGroups.get(fanGrpId);
      const xCenters = k === 1 ? [+0.68, +1.55, +2.42] : [-2.62, -1.75, -0.88];
      const zCenters = [+0.56, -0.56];

      const deckPlate = this._mesh(
        new THREE.BoxGeometry(2.50, 0.04, 2.00),
        this.palette.pedestalSteel,
        `${fanGrpId}_DECK_PLATE`
      );
      deckPlate.position.set(k === 1 ? +1.55 : -1.75, 2.24, 0.0);
      fanGrp.add(deckPlate);

      let localIdx = 0;
      for (const fx of xCenters) {
        for (const fz of zCenters) {
          localIdx += 1;
          const globalFanIdx = (k - 1) * 6 + localIdx;
          const fanId = `FAN${String(globalFanIdx).padStart(2, '0')}`;
          const unitGrp = new THREE.Group();
          unitGrp.name = fanId;
          unitGrp.position.set(fx, 2.34, fz);

          const shroud = this._mesh(
            new THREE.CylinderGeometry(0.38, 0.34, 0.18, 24, 1, true),
            this.palette.fanShroudDark,
            `${fanId}_SHROUD`
          );
          const hub = this._mesh(
            new THREE.CylinderGeometry(0.10, 0.10, 0.12, 16),
            this.palette.stepperMotorBlack,
            `${fanId}_EC_HUB`
          );

          const rotorGrp = new THREE.Group();
          rotorGrp.name = `${fanId}_IMPELLER`;
          for (let b = 0; b < 5; b++) {
            const blade = this._mesh(
              new THREE.BoxGeometry(0.24, 0.014, 0.085),
              this.palette.fanBladeSteel,
              `${fanId}_BLADE_${b + 1}`
            );
            const ang = (b * Math.PI * 2) / 5;
            blade.position.set(Math.cos(ang) * 0.20, 0.02, Math.sin(ang) * 0.20);
            blade.rotation.y = -ang;
            blade.rotation.x = 0.38;
            rotorGrp.add(blade);
          }

          const guardRing = this._mesh(
            new THREE.TorusGeometry(0.36, 0.010, 8, 24),
            this.palette.cutFaceMachined,
            `${fanId}_GUARD_RING`
          );
          guardRing.rotation.x = Math.PI / 2;
          guardRing.position.y = 0.09;

          unitGrp.add(shroud, hub, rotorGrp, guardRing);
          unitGrp.userData = { fanId, circuit: `CKT${k}`, rotorGrp };
          this.fanUnits.push(unitGrp);
          fanGrp.add(unitGrp);
        }
      }
    }
  }

  _buildFlowSwitchAndSymbioCabinet() {
    // FS-HP01: Paddle Water Flow Switch (60 mm paddle trim on DN150 outlet pipe W-03, p. 31–32)
    const fsGrp = this.subNodeGroups.get('FS-HP01');
    const [fx, fy, fz] = HP01_SUBNODES['FS-HP01'].center;

    const pipeSpool = this._mesh(
      new THREE.CylinderGeometry(0.082, 0.082, 0.34, 18),
      this.palette.whexWaterboxCast,
      'FS_HP01_DN150_SPOOL'
    );
    pipeSpool.rotation.z = Math.PI / 2;
    pipeSpool.position.set(fx, fy, fz);

    const paddleStem = this._mesh(
      new THREE.BoxGeometry(0.018, 0.12, 0.03),
      this.palette.brassValve,
      'FS_HP01_PADDLE_60MM'
    );
    paddleStem.position.set(fx, fy + 0.06, fz);

    const switchHousing = this._mesh(
      new THREE.BoxGeometry(0.14, 0.12, 0.12),
      this.palette.solenoidCoilBlue,
      'FS_HP01_IP65_HOUSING'
    );
    switchHousing.position.set(fx, fy + 0.14, fz);
    fsGrp.add(pipeSpool, paddleStem, switchHousing);

    // CTRL-SYMBIO: Starter & Control Panel (356 kg, Symbio 800, TD7, 2×CA300-4T132 VFDs 375×550×320 mm)
    const ctrlGrp = this.subNodeGroups.get('CTRL-SYMBIO');
    const [cx, cy, cz] = HP01_SUBNODES['CTRL-SYMBIO'].center;

    const cabBack = this._mesh(
      new THREE.BoxGeometry(0.56, 1.90, 2.04),
      this.palette.symbioCabinetGrey,
      'CTRL_SYMBIO_ENCLOSURE_BODY'
    );
    cabBack.position.set(cx, cy, cz);

    // Two CA300-4T132 VFD Drives (375 × 550 × 320 mm, 46 kg each, Table 12 p. 69)
    for (const [idx, zPos] of [[1, +0.46], [2, -0.46]]) {
      const vfd = this._mesh(
        new THREE.BoxGeometry(0.32, 0.55, 0.375),
        this.palette.vfdHeatsink,
        `CTRL_VFD${idx}_CA300_4T132`
      );
      vfd.position.set(cx - 0.16, 1.32, zPos);
      ctrlGrp.add(vfd);
    }

    // Symbio 800 Controller Board + 1K27/1K28 Pump Contactors + Tracer TD7 Display
    const symbioBoard = this._mesh(
      new THREE.BoxGeometry(0.12, 0.28, 0.36),
      this.palette.solenoidCoilBlue,
      'CTRL_SYMBIO_800_MODULE'
    );
    symbioBoard.position.set(cx - 0.20, 0.78, +0.42);

    const td7Bezel = this._mesh(
      new THREE.BoxGeometry(0.06, 0.22, 0.30),
      this.palette.td7ScreenGlow,
      'CTRL_TRACER_TD7_DISPLAY'
    );
    td7Bezel.position.set(cx + 0.27, 1.48, +0.62);
    ctrlGrp.add(cabBack, symbioBoard, td7Bezel);
  }

  _buildCasingEnvelope() {
    const frameGrp = this.subNodeGroups.get('FRAME-BASE');
    const frontLouver = this._mesh(
      new THREE.BoxGeometry(6.30, 0.92, 0.025),
      this.palette.casingPanelMat,
      'CASING_FRONT_ACOUSTIC_PANEL'
    );
    frontLouver.position.set(-0.10, 0.78, +1.11);

    const rearLouver = this._mesh(
      new THREE.BoxGeometry(6.30, 0.92, 0.025),
      this.palette.casingPanelMat,
      'CASING_REAR_PANEL'
    );
    rearLouver.position.set(-0.10, 0.78, -1.11);

    this.casingMeshes.push(frontLouver, rearLouver);
    this.frontCasingObstacles.push(frontLouver);
    frameGrp.add(frontLouver, rearLouver);
  }

  _buildAll38AuxValves() {
    for (const [auxId, meta] of Object.entries(HP01_AUX_VALVES)) {
      const grp = new THREE.Group();
      grp.name = `AUX_${auxId}`;
      grp.userData = {
        auxId,
        categoryIndex: meta.categoryIndex,
        categoryKey: meta.categoryKey,
        circuit: meta.circuit,
        parentSubNodeId: meta.parentSubNodeId,
        shortNameHe: meta.shortNameHe,
        titleHe: meta.titleHe,
        mediumDomain: meta.mediumDomain,
        supportTargetId: meta.supportTargetId,
        provenance: meta.provenance,
        sourceRef: meta.sourceRef
      };

      const [ax, ay, az] = meta.center;
      const [bx, by, bz] = meta.boundsSize;

      // Distinct 3D geometry by functional category (including VLV-OIL-SHUT and internal OF-INT per S2P-06)
      let bodyMesh;
      if (meta.categoryKey === 'OF-INT') {
        // Internal Oil Filter cartridge inside compressor oil channel pocket (OEM p. 49, 56)
        bodyMesh = this._mesh(
          new THREE.CylinderGeometry(by * 0.45, by * 0.45, bx, 14),
          this.palette.internalFilterGold,
          `${auxId}_INTERNAL_CARTRIDGE`
        );
        bodyMesh.rotation.z = Math.PI / 2;
      } else if (meta.categoryKey === 'VLV-OIL-SHUT') {
        // Oil Line Shutoff Valve with quarter-turn yellow lever handle (OEM p. 49)
        bodyMesh = this._mesh(
          new THREE.CylinderGeometry(by * 0.4, by * 0.4, bx, 12),
          this.palette.brassValve,
          `${auxId}_SHUTOFF_BODY`
        );
        bodyMesh.rotation.z = Math.PI / 2;
        const handle = this._mesh(
          new THREE.BoxGeometry(0.06, 0.018, 0.018),
          this.palette.riggingLugYellow,
          `${auxId}_SHUTOFF_LEVER`
        );
        handle.position.set(0, by * 0.48, 0);
        bodyMesh.add(handle);
      } else if (meta.categoryKey === 'FILT') {
        bodyMesh = this._mesh(
          new THREE.CylinderGeometry(by * 0.48, by * 0.48, bx, 16),
          this.palette.vesselOsSteel,
          `${auxId}_FILTER_DRIER_SHELL`
        );
        bodyMesh.rotation.z = Math.PI / 2;
      } else if (meta.categoryKey === 'OC') {
        bodyMesh = this._mesh(
          new THREE.BoxGeometry(bx, by, bz),
          this.palette.stainlessBphe,
          `${auxId}_OIL_COOLER_BPHE`
        );
      } else if (meta.categoryKey.startsWith('SOL-')) {
        bodyMesh = this._mesh(
          new THREE.BoxGeometry(bx * 0.75, by * 0.55, bz * 0.75),
          this.palette.brassValve,
          `${auxId}_SOLENOID_BODY`
        );
        const coil = this._mesh(
          new THREE.BoxGeometry(bx * 0.65, by * 0.45, bz * 0.65),
          this.palette.solenoidCoilBlue,
          `${auxId}_SOLENOID_COIL`
        );
        coil.position.y = by * 0.45;
        bodyMesh.add(coil);
      } else {
        bodyMesh = this._mesh(
          new THREE.CylinderGeometry(Math.min(bx, bz) * 0.45, Math.min(bx, bz) * 0.45, by, 12),
          this.palette.brassValve,
          `${auxId}_VALVE_BODY`
        );
      }
      bodyMesh.position.set(ax, ay, az);

      // Physical mounting bracket connecting aux element to frame/parent
      const strutH = Math.max(0.08, ay - 0.18);
      const supportStrut = this._mesh(
        new THREE.CylinderGeometry(0.010, 0.012, strutH, 8),
        this.palette.pedestalSteel,
        `${auxId}_SUPPORT_STRUT`
      );
      supportStrut.position.set(ax, ay - strutH * 0.5, az);
      grp.add(bodyMesh, supportStrut);

      this.auxValveGroups.set(auxId, grp);
      // Attach to parent selectable subnode so selecting/filtering parent includes its aux components
      const parentGrp = this.subNodeGroups.get(meta.parentSubNodeId) || this.rootGroup;
      parentGrp.add(grp);
    }
  }

  _buildAllPortMarkers() {
    const addMarker = (ownerId, portName, portDesc, parentGrp) => {
      const key = `${ownerId}.${portName}`;
      const nozzle = this._mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.032, 12),
        this.palette.portNozzleRim,
        `PORT_${key}`
      );
      nozzle.position.set(portDesc.pos[0], portDesc.pos[1], portDesc.pos[2]);
      nozzle.userData = {
        portKey: key,
        ownerId,
        portName,
        mediumDomain: portDesc.mediumDomain,
        circuit: portDesc.circuit,
        portDomainId: portDesc.portDomainId,
        worldPos: [...portDesc.pos]
      };
      this.portMarkers.set(key, nozzle);
      parentGrp.add(nozzle);
    };

    for (const [subId, subMeta] of Object.entries(HP01_SUBNODES)) {
      const subGrp = this.subNodeGroups.get(subId);
      for (const [portName, portDesc] of Object.entries(subMeta.ports)) {
        const targetGrp =
          subId === 'WHEX' && this.whexDomainGroups.has(portDesc.portDomainId)
            ? this.whexDomainGroups.get(portDesc.portDomainId)
            : subGrp;
        addMarker(subId, portName, portDesc, targetGrp);
      }
    }

    for (const [auxId, auxMeta] of Object.entries(HP01_AUX_VALVES)) {
      const auxGrp = this.auxValveGroups.get(auxId);
      for (const [portName, portDesc] of Object.entries(auxMeta.ports)) {
        addMarker(auxId, portName, portDesc, auxGrp);
      }
    }

    for (const [bndId, bndDesc] of Object.entries(HP01_BOUNDARY_PORTS)) {
      addMarker(bndId, bndDesc.portName, bndDesc, this.rootGroup);
    }
  }

  _buildAll48Connections() {
    for (const [connId, meta] of Object.entries(HP01_INTERNAL_CONNECTIONS)) {
      const connGrp = new THREE.Group();
      connGrp.name = `CONN_${connId}`;

      const pts = meta.waypoints.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.15);

      const baseColor = new THREE.Color(meta.colorHex);
      const isStatic = meta.animationType === 'STATIC_GEOMETRY_NO_PARTICLES';
      const pipeMat = this._trackMat(
        new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: isStatic ? 0.65 : 0.35,
          metalness: isStatic ? 0.35 : 0.65,
          transparent: Boolean(meta.dashedStyle),
          opacity: meta.dashedStyle ? 0.68 : 1.0
        })
      );

      const tubularSegments = Math.max(16, pts.length * 10);
      const tubeGeo = new THREE.TubeGeometry(curve, tubularSegments, meta.pipeRadiusM, 10, false);
      const tubeMesh = this._mesh(tubeGeo, pipeMat, `PIPE_MESH_${connId}`);
      connGrp.add(tubeMesh);

      // Add secondary feeder branches for manifold connections (e.g. W-04 drain manifold)
      if (Array.isArray(meta.branchSegments)) {
        for (let bIdx = 0; bIdx < meta.branchSegments.length; bIdx++) {
          const segPts = meta.branchSegments[bIdx].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
          const segCurve = new THREE.CatmullRomCurve3(segPts, false, 'centripetal', 0.1);
          const segGeo = new THREE.TubeGeometry(segCurve, 12, meta.pipeRadiusM * 0.85, 8, false);
          const segMesh = this._mesh(segGeo, pipeMat, `PIPE_BRANCH_${connId}_${bIdx}`);
          connGrp.add(segMesh);
        }
      }

      // Add physical pipe support clamp at midpoint anchoring the line to the frame
      const midPt = curve.getPoint(0.5);
      const clamp = this._mesh(
        new THREE.TorusGeometry(meta.pipeRadiusM * 1.35, 0.005, 8, 16),
        this.palette.pedestalSteel,
        `CLAMP_${connId}`
      );
      clamp.position.copy(midPt);
      connGrp.add(clamp);

      connGrp.userData = {
        connId,
        circuit: meta.circuit,
        mediumDomain: meta.mediumDomain,
        whexPortDomainId: meta.whexPortDomainId || null,
        animationType: meta.animationType,
        provenance: meta.provenance,
        sourceRef: meta.sourceRef,
        unidirectional: Boolean(meta.unidirectional),
        bypassesReceiver: meta.bypassesReceiver || null,
        tappedAfterFilterBeforeEconMain: Boolean(meta.tappedAfterFilterBeforeEconMain),
        orderedOilSequence: meta.orderedOilSequence ? [...meta.orderedOilSequence] : null,
        fromEndpoint: meta.fromEndpoint,
        toEndpoint: meta.toEndpoint,
        waypointsVectors: pts,
        curve,
        startPointWorld: curve.getPoint(0),
        endPointWorld: curve.getPoint(1),
        pipeMat,
        baseColorHex: meta.colorHex,
        defrostColorHex: meta.defrostColorHex || meta.colorHex
      };

      this.connectionGroups.set(connId, connGrp);
      this.rootGroup.add(connGrp);
    }
  }

  _collectPickableMeshes() {
    this.pickableMeshes.length = 0;
    for (const [subId, subGrp] of this.subNodeGroups.entries()) {
      subGrp.traverse((child) => {
        if (child.isMesh) {
          child.userData.compId = 'HP01';
          child.userData.subNodeId = subId;
          this.pickableMeshes.push(child);
        }
      });
    }
  }

  /**
   * Switches outer casing visibility ('full' | 'ghost' | 'hidden') without recreating any geometry
   */
  setCasingMode(mode = 'ghost') {
    if (this.disposed) return;
    this.casingMode = mode;
    for (const m of this.casingMeshes) {
      if (this.inspectionFocusTarget && this.frontCasingObstacles.includes(m)) {
        m.visible = false;
        continue;
      }
      if (mode === 'hidden') {
        m.visible = false;
      } else if (mode === 'full') {
        m.visible = true;
        m.material.transparent = false;
        m.material.opacity = 1.0;
        m.material.depthWrite = true;
      } else {
        m.visible = true;
        m.material.transparent = true;
        m.material.opacity = 0.22;
        m.material.depthWrite = false;
      }
      m.material.needsUpdate = true;
    }
  }

  /**
   * Reversible local inspection mode for compressor internals (F05).
   * When targetSubNodeId is 'COMP1' or 'COMP2', front structural columns/rails are switched to ultra-transparent ghost
   * and front acoustic panel is hidden so the camera has an unobstructed view of both helical rotors and the motor stator.
   * When targetSubNodeId is null, 100% of structural columns and casing panels are restored to their normal state
   * without allocating or disposing any geometries, materials, or scene nodes.
   */
  setInspectionFocusMode(targetSubNodeId = null) {
    if (this.disposed) return;
    const normalized = targetSubNodeId === 'COMP1' || targetSubNodeId === 'COMP2' ? targetSubNodeId : null;
    this.inspectionFocusTarget = normalized;

    for (const colMesh of this.frontStructuralObstacles) {
      colMesh.material = normalized ? this.palette.frameSteelInspectionGhost : this.palette.frameSteel;
      colMesh.visible = true;
    }

    // Re-apply casing mode (hides front acoustic panel when inspectionFocusTarget is active, restores it when null)
    this.setCasingMode(this.casingMode);
  }

  getInspectionFocusState() {
    return {
      active: Boolean(this.inspectionFocusTarget),
      targetSubNodeId: this.inspectionFocusTarget,
      frontStructuralObstacleCount: this.frontStructuralObstacles.length,
      allFrontColumnsOpaqueRestored: this.frontStructuralObstacles.every(
        (m) => m.visible === true && m.material === this.palette.frameSteel
      ),
      allFrontColumnsInspectionGhost: this.frontStructuralObstacles.every(
        (m) => m.visible === true && m.material === this.palette.frameSteelInspectionGhost
      )
    };
  }

  /**
   * Filters circuit visibility ('both' | 'ckt1' | 'ckt2' | 'whex') without recreating geometry
   */
  setCircuitFilter(filter = 'both') {
    if (this.disposed) return;
    this.circuitFilter = filter;
    for (const [, grp] of this.subNodeGroups.entries()) {
      const ckt = grp.userData.circuit;
      if (filter === 'both') {
        grp.visible = true;
      } else if (filter === 'ckt1') {
        grp.visible = ckt !== 'CKT2';
      } else if (filter === 'ckt2') {
        grp.visible = ckt !== 'CKT1';
      } else if (filter === 'whex') {
        grp.visible = ['SHARED_ISOLATED_DOMAINS', 'WATER', 'DRAIN', 'STRUCTURE'].includes(ckt);
      }
    }
    for (const [, cGrp] of this.connectionGroups.entries()) {
      const ckt = cGrp.userData.circuit;
      if (filter === 'both') {
        cGrp.visible = true;
      } else if (filter === 'ckt1') {
        cGrp.visible = ckt !== 'CKT2';
      } else if (filter === 'ckt2') {
        cGrp.visible = ckt !== 'CKT1';
      } else if (filter === 'whex') {
        cGrp.visible = ['WATER', 'DRAIN'].includes(ckt);
      }
    }
  }

  /**
   * Highlights a selected sub-node (or null to clear) and its exact HP01_NODE_PIPES[subNodeId]
   */
  highlightSubNode(subNodeId = null) {
    if (this.disposed) return;
    this.selectedSubNodeId = subNodeId;
    const highlightedConns = new Set(subNodeId && HP01_NODE_PIPES[subNodeId] ? HP01_NODE_PIPES[subNodeId] : []);

    for (const [connId, cGrp] of this.connectionGroups.entries()) {
      const mat = cGrp.userData.pipeMat;
      if (!subNodeId) {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      } else if (highlightedConns.has(connId)) {
        mat.emissive.set(cGrp.userData.baseColorHex);
        mat.emissiveIntensity = 0.55;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      }
    }
  }

  /**
   * Returns resource tracking stats for lifecycle & WebGL memory verification (S2P-05)
   */
  getResourceStats() {
    return {
      disposed: this.disposed,
      buildCount: this.buildCount,
      subNodeGroupCount: this.subNodeGroups.size,
      auxValveGroupCount: this.auxValveGroups.size,
      connectionGroupCount: this.connectionGroups.size,
      whexDomainGroupCount: this.whexDomainGroups.size,
      fanUnitCount: this.fanUnits.length,
      isolatorCount: this.isolatorGroups.size,
      riggingLugCount: this.riggingLugGroups.size,
      portMarkerCount: this.portMarkers.size,
      pickableMeshCount: this.pickableMeshes.length,
      ownedGeometryCount: this.ownedGeometries.size,
      ownedMaterialCount: this.ownedMaterials.size
    };
  }

  /**
   * Disposes all owned geometries and materials cleanly without affecting any external/rooftop resources (S2P-05)
   */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const geo of this.ownedGeometries) {
      geo.dispose();
    }
    for (const mat of this.ownedMaterials) {
      mat.dispose();
    }
    this.ownedGeometries.clear();
    this.ownedMaterials.clear();
    this.pickableMeshes.length = 0;
  }
}

export function createHP01CutawayAssembly(options = {}) {
  return new HP01CutawayAssembly(options);
}
