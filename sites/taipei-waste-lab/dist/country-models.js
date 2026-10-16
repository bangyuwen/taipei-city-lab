import * as THREE from './vendor/three/three.module.js';
import { COUNTRY_MODELS } from './country-model-data.js';

function context(id) {
  const group = new THREE.Group();
  group.name = 'country-model-' + id;
  const materials = new Map();

  return {
    group,
    material(color, metalness = 0) {
      const key = color + '|' + metalness;
      if (!materials.has(key)) {
        materials.set(key, new THREE.MeshStandardMaterial({
          color,
          metalness,
          roughness: metalness > 0 ? 0.42 : 0.72,
        }));
      }
      return materials.get(key);
    },
  };
}

function addBox(ctx, name, width, height, depth, x, bottomY, z, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    ctx.material(color),
  );
  mesh.name = name;
  mesh.position.set(x, bottomY + height / 2, z);
  ctx.group.add(mesh);
  return mesh;
}

function addBoxAt(ctx, name, width, height, depth, x, centerY, z, color, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    ctx.material(color),
  );
  mesh.name = name;
  mesh.position.set(x, centerY, z);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  ctx.group.add(mesh);
  return mesh;
}

function addCylinderAt(ctx, name, radiusTop, radiusBottom, height, x, centerY, z, color, options = {}) {
  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    options.segments || 20,
    1,
    Boolean(options.openEnded),
  );
  const mesh = new THREE.Mesh(geometry, options.material || ctx.material(color, options.metalness || 0));
  mesh.name = name;
  mesh.position.set(x, centerY, z);
  mesh.rotation.set(options.rotationX || 0, options.rotationY || 0, options.rotationZ || 0);
  ctx.group.add(mesh);
  return mesh;
}

function addCylinder(ctx, name, radiusTop, radiusBottom, height, x, bottomY, z, color, options = {}) {
  return addCylinderAt(ctx, name, radiusTop, radiusBottom, height, x, bottomY + height / 2, z, color, options);
}

function addFrontDisc(ctx, name, radius, height, x, centerY, z, color, metalness = 0) {
  return addCylinderAt(ctx, name, radius, radius, height, x, centerY, z, color, {
    segments: 24,
    rotationX: Math.PI / 2,
    metalness,
  });
}

function addHorizontalRing(ctx, name, radius, tube, x, centerY, z, color, metalness = 0) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 8, 28),
    ctx.material(color, metalness),
  );
  mesh.name = name;
  mesh.position.set(x, centerY, z);
  mesh.rotation.x = Math.PI / 2;
  ctx.group.add(mesh);
  return mesh;
}

function buildJapan() {
  const ctx = context('japan');
  addBox(ctx, 'shared-base', 2.22, 0.14, 0.88, 0, 0, 0, '#25292b');
  addBox(ctx, 'left-gold-body', 1.04, 1.82, 0.78, -0.55, 0.14, 0, '#d9b74e');
  addBox(ctx, 'right-gold-body', 1.04, 1.82, 0.78, 0.55, 0.14, 0, '#d9b74e');
  addBox(ctx, 'center-divider', 0.08, 1.84, 0.84, 0, 0.14, 0, '#22282b');
  addBox(ctx, 'shared-top-cap', 2.2, 0.13, 0.9, 0, 1.96, 0, '#303438');

  addBox(ctx, 'left-dark-flap', 0.78, 0.52, 0.055, -0.55, 1.23, 0.42, '#202528');
  addBox(ctx, 'left-handle-post-left', 0.045, 0.13, 0.055, -0.79, 1.77, 0.43, '#c3c8c8');
  addBox(ctx, 'left-handle-post-right', 0.045, 0.13, 0.055, -0.31, 1.77, 0.43, '#c3c8c8');
  addBox(ctx, 'left-handle-bar', 0.52, 0.045, 0.06, -0.55, 1.88, 0.44, '#d4d7d7');

  addBox(ctx, 'right-blue-panel', 0.78, 0.52, 0.055, 0.55, 1.23, 0.42, '#1763ae');
  addFrontDisc(ctx, 'right-blue-inlet', 0.16, 0.06, 0.55, 1.49, 0.47, '#092e51');
  addBox(ctx, 'left-lower-access-panel', 0.32, 0.25, 0.04, -0.81, 0.43, 0.42, '#33383b');
  addBox(ctx, 'right-lower-access-panel', 0.32, 0.25, 0.04, 0.29, 0.43, 0.42, '#33383b');
  return ctx.group;
}

function buildUk() {
  const ctx = context('uk');
  addBox(ctx, 'single-bin-body', 1.16, 1.63, 0.82, 0, 0, 0, '#33383b');
  const roof = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    ctx.material('#292e31', 0.18),
  );
  roof.name = 'shallow-domed-roof';
  roof.position.set(0, 1.63, 0);
  roof.scale.set(0.62, 0.42, 0.46);
  ctx.group.add(roof);
  addBoxAt(ctx, 'solar-panel', 0.42, 0.04, 0.28, 0, 2.04, 0, '#263d4b');
  addBox(ctx, 'front-intake-panel', 0.78, 0.5, 0.055, 0, 1.03, 0.43, '#22282b');
  addBox(ctx, 'front-flap', 0.58, 0.38, 0.045, 0, 1.09, 0.47, '#41474a');
  addBox(ctx, 'front-handle', 0.38, 0.07, 0.06, 0, 1.52, 0.49, '#c2c8c8');
  addBox(ctx, 'lower-service-panel', 0.42, 0.28, 0.045, 0, 0.36, 0.43, '#272c2f');
  return ctx.group;
}

function buildDenmark() {
  const ctx = context('denmark');
  addBox(ctx, 'black-cabinet', 1.06, 1.72, 0.82, 0, 0, 0, '#24282a');
  addBoxAt(ctx, 'angled-roof', 1.18, 0.22, 0.88, 0, 1.78, 0, '#202426', [0, 0, -0.1]);
  addBoxAt(ctx, 'solar-panel', 0.73, 0.05, 0.52, 0, 1.96, -0.02, '#35434a', [0, 0, -0.1]);
  addBox(ctx, 'lime-band', 0.92, 0.075, 0.045, 0, 1.28, 0.43, '#b4c84a');
  addBox(ctx, 'upper-intake', 0.68, 0.42, 0.05, 0, 1.49, 0.43, '#353b3e');
  addBox(ctx, 'silver-pedal', 0.54, 0.09, 0.22, 0, 0.14, 0.48, '#aeb5b6');
  addBox(ctx, 'pedal-front-edge', 0.59, 0.045, 0.07, 0, 0.14, 0.6, '#d0d4d4');
  return ctx.group;
}

function buildUs() {
  const ctx = context('us');
  addCylinder(ctx, 'round-basket-body', 0.47, 0.47, 1.5, 0, 0.12, 0, '#747c7e', {segments: 32, metalness: 0.68});
  addCylinder(ctx, 'lower-steel-collar', 0.49, 0.49, 0.12, 0, 0, 0, '#9aa1a2', {segments: 32, metalness: 0.76});
  addCylinder(ctx, 'upper-head', 0.51, 0.48, 0.24, 0, 1.54, 0, '#92999a', {segments: 32, metalness: 0.72});
  addBox(ctx, 'upper-slot', 0.29, 0.095, 0.035, 0, 1.62, 0.493, '#252a2c');

  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2;
    const x = Math.cos(angle) * 0.495;
    const z = Math.sin(angle) * 0.495;
    addCylinderAt(ctx, 'vertical-steel-slat-' + index, 0.018, 0.018, 1.24, x, 0.89, z, '#bcc2c3', {
      segments: 8,
      metalness: 0.82,
    });
  }
  return ctx.group;
}

function buildFinland() {
  const ctx = context('finland');
  addCylinder(ctx, 'round-body-core', 0.69, 0.69, 1.42, 0, 0, 0, '#493c2e', {segments: 32});
  for (let index = 0; index < 28; index += 1) {
    const angle = (index / 28) * Math.PI * 2;
    const x = Math.cos(angle) * 0.68;
    const z = Math.sin(angle) * 0.68;
    addBoxAt(ctx, 'wood-slat-' + index, 0.13, 1.32, 0.055, x, 0.72, z, index % 2 ? '#96764f' : '#876a47', [0, angle + Math.PI / 2, 0]);
  }
  addCylinder(ctx, 'bottom-rim', 0.73, 0.73, 0.11, 0, 0.02, 0, '#bac0c0', {segments: 32, metalness: 0.7});
  addCylinder(ctx, 'top-rim', 0.74, 0.74, 0.09, 0, 1.36, 0, '#9ca4a5', {segments: 32, metalness: 0.7});
  addCylinderAt(ctx, 'dark-conical-lid', 0.05, 0.77, 0.34, 0, 1.62, 0, '#343a3c', {segments: 32});
  addBox(ctx, 'lid-hatch', 0.39, 0.2, 0.04, 0, 1.47, 0.48, '#252a2c');
  addBox(ctx, 'lid-hatch-handle', 0.18, 0.04, 0.055, 0, 1.63, 0.51, '#aeb4b5');
  return ctx.group;
}

function buildKorea() {
  const ctx = context('korea');
  addBox(ctx, 'silver-cabinet', 1.12, 1.52, 0.78, 0, 0, 0, '#b7bdbe');
  addBox(ctx, 'orange-hood-back', 1.02, 0.53, 0.08, 0, 1.785, -0.36, '#f06432');
  addBox(ctx, 'orange-hood-side-left', 0.08, 0.53, 0.76, -0.53, 1.785, 0, '#ef6532');
  addBox(ctx, 'orange-hood-side-right', 0.08, 0.53, 0.76, 0.53, 1.785, 0, '#ef6532');
  addBox(ctx, 'orange-hood-roof', 1.25, 0.15, 0.92, 0, 2.05, 0, '#f46a35');
  addBoxAt(ctx, 'horizontal-intake-shelf', 0.82, 0.07, 0.62, 0, 1.555, 0, '#737a7c');
  addBoxAt(ctx, 'horizontal-intake-slot', 0.52, 0.035, 0.3, 0, 1.607, 0.08, '#252a2b');
  addBox(ctx, 'side-keypad', 0.16, 0.36, 0.07, 0.46, 1.19, 0.43, '#20272b');
  addBox(ctx, 'keypad-display', 0.09, 0.08, 0.03, 0.46, 1.39, 0.48, '#547b85');
  for (let index = 0; index < 3; index += 1) {
    addFrontDisc(ctx, 'key-' + index, 0.022, 0.025, 0.43 + (index % 2) * 0.06, 1.28 - Math.floor(index / 2) * 0.07, 0.49, '#d9dddc');
  }
  return ctx.group;
}

function buildFrance() {
  const ctx = context('france');
  const bagMaterial = new THREE.MeshStandardMaterial({
    color: '#c9cece',
    roughness: 0.46,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const bag = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.35, 0.86, 24, 1, true),
    bagMaterial,
  );
  bag.name = 'inner-bag';
  bag.position.set(0, 0.61, 0);
  ctx.group.add(bag);

  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2;
    const x = Math.cos(angle) * 0.36;
    const z = Math.sin(angle) * 0.36;
    addCylinderAt(ctx, 'wire-upright-' + index, 0.014, 0.014, 1.18, x, 0.7, z, '#929a9b', {
      segments: 8,
      metalness: 0.7,
    });
  }
  addHorizontalRing(ctx, 'ground-wire-ring', 0.36, 0.02, 0, 0.02, 0, '#aab0b1', 0.7);
  addHorizontalRing(ctx, 'lower-wire-ring', 0.36, 0.018, 0, 0.16, 0, '#aab0b1', 0.7);
  addHorizontalRing(ctx, 'middle-wire-ring', 0.36, 0.016, 0, 0.69, 0, '#aab0b1', 0.7);
  addHorizontalRing(ctx, 'open-top-wire-ring', 0.38, 0.02, 0, 1.3, 0, '#b8bebe', 0.72);
  return ctx.group;
}

function buildNetherlands() {
  const ctx = context('netherlands');
  addBox(ctx, 'left-support-leg', 0.11, 0.56, 0.13, -0.28, 0, 0, '#7f8585');
  addBox(ctx, 'right-support-leg', 0.11, 0.56, 0.13, 0.28, 0, 0, '#7f8585');
  addBox(ctx, 'yellow-body', 0.82, 1.08, 0.54, 0, 0.48, 0, '#e2c72d');
  addCylinderAt(ctx, 'rounded-yellow-top', 0.27, 0.27, 0.84, 0, 1.57, 0, '#e2c72d', {
    segments: 24,
    rotationZ: Math.PI / 2,
  });
  addFrontDisc(ctx, 'round-deposit-opening-rim', 0.19, 0.05, 0, 1.49, 0.29, '#2f3435', 0.12);
  addFrontDisc(ctx, 'round-deposit-opening', 0.13, 0.055, 0, 1.49, 0.325, '#12191b');
  addBox(ctx, 'lower-pull-hatch', 0.57, 0.3, 0.05, 0, 0.72, 0.3, '#b6a947');
  addBox(ctx, 'lower-hatch-handle', 0.22, 0.045, 0.06, 0, 0.82, 0.34, '#6d716d');
  return ctx.group;
}

function buildSingapore() {
  const ctx = context('singapore');
  const bins = [
    {x: -0.84, color: '#257b55'},
    {x: -0.28, color: '#2868a0'},
    {x: 0.28, color: '#c94b4a'},
    {x: 0.84, color: '#d4ad32'},
  ];
  bins.forEach((bin, index) => {
    addBox(ctx, 'colored-cabinet-' + index, 0.48, 1.42, 0.48, bin.x, 0, 0, bin.color);
    addBoxAt(ctx, 'sloped-flap-' + index, 0.52, 0.18, 0.52, bin.x, 1.43, 0, bin.color, [0, 0, -0.13]);
    addBox(ctx, 'front-intake-panel-' + index, 0.34, 0.25, 0.045, bin.x, 1.0, 0.26, '#d6dcda');
    addBox(ctx, 'front-slot-' + index, 0.22, 0.06, 0.05, bin.x, 1.09, 0.29, '#32383a');
  });
  return ctx.group;
}

function buildIndia() {
  const ctx = context('india');
  addBox(ctx, 'truck-chassis', 1.12, 0.17, 2.05, 0, 0.24, 0, '#353a3b');
  addBox(ctx, 'yellow-collection-bed', 1.08, 0.63, 1.25, 0, 0.42, -0.35, '#d6ad22');
  addBox(ctx, 'yellow-cab', 1.08, 0.82, 0.74, 0, 0.42, 0.7, '#e5bd22');
  addBox(ctx, 'cab-roof', 1.12, 0.12, 0.79, 0, 1.24, 0.7, '#d6ad22');
  addBox(ctx, 'front-windshield', 0.78, 0.34, 0.045, 0, 0.91, 1.08, '#83aeb6');
  addBox(ctx, 'front-bumper', 1.18, 0.12, 0.13, 0, 0.27, 1.13, '#aeb4b4');

  for (const side of [-1, 1]) {
    for (const z of [-0.68, 0.7]) {
      addCylinderAt(ctx, 'truck-wheel-' + side + '-' + z, 0.3, 0.3, 0.18, side * 0.58, 0.3, z, '#252a2b', {
        segments: 20,
        rotationZ: Math.PI / 2,
      });
      addCylinderAt(ctx, 'wheel-hub-' + side + '-' + z, 0.12, 0.12, 0.19, side * 0.58, 0.31, z, '#9ca3a4', {
        segments: 16,
        rotationZ: Math.PI / 2,
        metalness: 0.5,
      });
    }
  }

  addBox(ctx, 'small-container-body', 0.54, 0.67, 0.56, 1.03, 0.04, -0.25, '#548568');
  addBox(ctx, 'small-container-rim', 0.6, 0.08, 0.62, 1.03, 0.71, -0.25, '#3f6e55');
  return ctx.group;
}

function buildAustralia() {
  const ctx = context('australia');
  addBox(ctx, 'shared-receiving-station-base', 2.02, 0.14, 0.86, 0, 0, 0, '#38464b');
  const bays = [
    {x: -0.62, color: '#397f70'},
    {x: 0, color: '#33718f'},
    {x: 0.62, color: '#7b8a55'},
  ];
  bays.forEach((bay, index) => {
    addBox(ctx, 'generic-receiving-bay-' + index, 0.58, 1.16, 0.7, bay.x, 0.14, 0, bay.color);
    addBox(ctx, 'bay-front-panel-' + index, 0.42, 0.38, 0.05, bay.x, 0.7, 0.38, '#26363a');
    addBox(ctx, 'bay-intake-' + index, 0.29, 0.09, 0.055, bay.x, 1.12, 0.41, '#111b1e');
  });
  addBox(ctx, 'shared-canopy', 2.08, 0.16, 0.94, 0, 1.56, 0, '#38464b');
  addBox(ctx, 'shared-control-panel', 0.42, 0.36, 0.06, 0, 1.88, 0.48, '#d1d9d8');
  addFrontDisc(ctx, 'generic-status-indicator', 0.07, 0.035, 0, 1.9, 0.525, '#4e8a73');
  return ctx.group;
}

function buildSouthAfrica() {
  const ctx = context('south-africa');
  const bayCenters = [-0.82, 0, 0.82];
  addBox(ctx, 'rear-bottom-frame', 2.5, 0.09, 0.08, 0, 0, -0.4, '#555e60');
  addBox(ctx, 'front-bottom-frame', 2.5, 0.09, 0.08, 0, 0, 0.4, '#555e60');
  addBox(ctx, 'rear-top-frame', 2.5, 0.09, 0.08, 0, 1.55, -0.4, '#555e60');
  addBox(ctx, 'front-slot-header', 2.5, 0.1, 0.08, 0, 1.4, 0.4, '#555e60');

  for (let index = 0; index < 4; index += 1) {
    const x = -1.23 + index * 0.82;
    addBox(ctx, 'steel-post-front-' + index, 0.075, 1.92, 0.075, x, 0.05, 0.4, '#6b7475');
    addBox(ctx, 'steel-post-back-' + index, 0.075, 1.92, 0.075, x, 0.05, -0.4, '#6b7475');
  }

  bayCenters.forEach((x, index) => {
    addBox(ctx, 'dark-bay-interior-' + index, 0.72, 1.22, 0.06, x, 0.16, -0.32, '#32383a');
    for (let row = 0; row < 5; row += 1) {
      addBox(ctx, 'wood-front-slat-' + index + '-' + row, 0.72, 0.13, 0.055, x, 0.18 + row * 0.17, 0.36, row % 2 ? '#8a704e' : '#987b54');
    }
    for (const side of [-1, 1]) {
      addBox(ctx, 'wood-side-slat-' + index + '-' + side, 0.07, 1.04, 0.7, x + side * 0.37, 0.18, 0, '#896e4c');
    }
    addBox(ctx, 'open-intake-slot-' + index, 0.56, 0.2, 0.035, x, 1.2, 0.405, '#1e2729');
  });

  addBox(ctx, 'roof-front-beam', 2.58, 0.1, 0.09, 0, 1.93, 0.43, '#646d6e');
  addBox(ctx, 'roof-back-beam', 2.58, 0.1, 0.09, 0, 1.93, -0.43, '#646d6e');
  for (let index = 0; index < 7; index += 1) {
    const z = -0.39 + index * 0.13;
    addBox(ctx, 'roof-wood-slat-' + index, 2.5, 0.08, 0.095, 0, 1.99, z, index % 2 ? '#8a704e' : '#987b54');
  }
  return ctx.group;
}

const MODEL_BUILDERS = Object.freeze({
  japan: buildJapan,
  uk: buildUk,
  denmark: buildDenmark,
  us: buildUs,
  finland: buildFinland,
  korea: buildKorea,
  france: buildFrance,
  netherlands: buildNetherlands,
  singapore: buildSingapore,
  india: buildIndia,
  australia: buildAustralia,
  'south-africa': buildSouthAfrica,
});

export function buildCountryModel(id) {
  if (!Object.prototype.hasOwnProperty.call(COUNTRY_MODELS, id) || !MODEL_BUILDERS[id]) {
    throw new RangeError('Unknown country model: ' + String(id));
  }
  return MODEL_BUILDERS[id]();
}
