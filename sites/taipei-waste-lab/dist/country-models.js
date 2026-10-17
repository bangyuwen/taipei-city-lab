import * as THREE from './vendor/three/three.module.js';
import { COUNTRY_MODELS } from './country-model-data.js';

function context(id) {
  const group = new THREE.Group();
  group.name = 'country-model-' + id;
  const materials = new Map();

  return {
    group,
    material(color, metalness = 0, roughness = metalness > 0 ? 0.42 : 0.7) {
      const key = color + '|' + metalness + '|' + roughness;
      if (!materials.has(key)) {
        materials.set(key, new THREE.MeshStandardMaterial({
          color,
          metalness,
          roughness,
          // Keep polymer bodies softly lit while existing metal trim catches the studio panels.
          envMapIntensity: metalness >= 0.55 ? 1.16 : 0.78,
        }));
      }
      return materials.get(key);
    },
  };
}

function addBox(ctx, name, width, height, depth, x, bottomY, z, color, parent = ctx.group, metalness = 0, roughness) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    ctx.material(color, metalness, roughness),
  );
  mesh.name = name;
  mesh.position.set(x, bottomY + height / 2, z);
  parent.add(mesh);
  return mesh;
}

function addBoxAt(ctx, name, width, height, depth, x, centerY, z, color, rotation = [0, 0, 0], parent = ctx.group, metalness = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    ctx.material(color, metalness),
  );
  mesh.name = name;
  mesh.position.set(x, centerY, z);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  parent.add(mesh);
  return mesh;
}

function addRoundedBox(ctx, name, width, height, depth, x, bottomY, z, color, radius = 0.055, parent = ctx.group, metalness = 0.04, roughness = 0.55) {
  const bevel = Math.min(radius, width * 0.22, height * 0.22, depth * 0.22);
  const shapeWidth = width - bevel * 2;
  const shapeHeight = height - bevel * 2;
  const corner = Math.min(bevel * 0.72, shapeWidth * 0.2, shapeHeight * 0.2);
  const halfWidth = shapeWidth / 2;
  const halfHeight = shapeHeight / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + corner, -halfHeight);
  shape.lineTo(halfWidth - corner, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + corner);
  shape.lineTo(halfWidth, halfHeight - corner);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - corner, halfHeight);
  shape.lineTo(-halfWidth + corner, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - corner);
  shape.lineTo(-halfWidth, -halfHeight + corner);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + corner, -halfHeight);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 3,
    steps: 1,
  });
  const mesh = new THREE.Mesh(geometry, ctx.material(color, metalness, roughness));
  mesh.name = name;
  mesh.position.set(x, bottomY + height / 2, z - depth / 2 + bevel);
  parent.add(mesh);
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
  const mesh = new THREE.Mesh(
    geometry,
    options.material || ctx.material(color, options.metalness || 0, options.roughness),
  );
  mesh.name = name;
  mesh.position.set(x, centerY, z);
  mesh.rotation.set(options.rotationX || 0, options.rotationY || 0, options.rotationZ || 0);
  (options.parent || ctx.group).add(mesh);
  return mesh;
}

function addCylinder(ctx, name, radiusTop, radiusBottom, height, x, bottomY, z, color, options = {}) {
  return addCylinderAt(ctx, name, radiusTop, radiusBottom, height, x, bottomY + height / 2, z, color, options);
}

function addFrontDisc(ctx, name, radius, height, x, centerY, z, color, metalness = 0, parent = ctx.group) {
  return addCylinderAt(ctx, name, radius, radius, height, x, centerY, z, color, {
    segments: 24,
    rotationX: Math.PI / 2,
    metalness,
    parent,
  });
}

function addHorizontalRing(ctx, name, radius, tube, x, centerY, z, color, metalness = 0, parent = ctx.group) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 8, 32),
    ctx.material(color, metalness),
  );
  mesh.name = name;
  mesh.position.set(x, centerY, z);
  mesh.rotation.x = Math.PI / 2;
  parent.add(mesh);
  return mesh;
}

function addTube(ctx, parent, name, points, radius, color, metalness = 0.5) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 20, radius, 8, false),
    ctx.material(color, metalness, 0.38),
  );
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function addUHandle(ctx, parent, name, width, centerY, z, height = 0.16) {
  const half = width / 2;
  return addTube(ctx, parent, name, [
    [-half, centerY - height * 0.42, z],
    [-half, centerY + height * 0.32, z],
    [-half * 0.78, centerY + height * 0.52, z],
    [half * 0.78, centerY + height * 0.52, z],
    [half, centerY + height * 0.32, z],
    [half, centerY - height * 0.42, z],
  ], 0.022, '#c7cdcd', 0.72);
}

function addDoor(ctx, name, x, hingeY, z, width, height, color, options = {}) {
  const pivot = new THREE.Group();
  pivot.name = name + '-hinge-group';
  pivot.position.set(x, hingeY, z);
  ctx.group.add(pivot);
  addRoundedBox(
    ctx,
    name + '-panel',
    width,
    height,
    options.depth || 0.055,
    0,
    -height,
    0,
    color,
    Math.min(0.055, height * 0.14),
    pivot,
    options.metalness ?? 0.08,
    options.roughness ?? 0.48,
  );
  addCylinderAt(ctx, name + '-hinge-bar', 0.018, 0.018, width * 0.84, 0, 0, 0, '#9aa2a3', {
    segments: 12,
    rotationZ: Math.PI / 2,
    metalness: 0.72,
    parent: pivot,
  });

  const fastenerY = -height * 0.18;
  for (const side of [-1, 1]) {
    addFrontDisc(ctx, name + '-fastener-' + side, 0.018, 0.018, side * width * 0.39, fastenerY, 0.04, '#d0d4d4', 0.62, pivot);
  }
  if (options.handle) {
    addUHandle(ctx, pivot, name + '-pull-handle', width * 0.42, -height * 0.38, 0.075, Math.min(0.16, height * 0.42));
  }
  return {
    object: pivot,
    axis: 'x',
    base: 0,
    delta: options.delta ?? -1.0,
    delay: options.delay || 0,
    closeStart: options.closeStart ?? 0.74,
  };
}

function addTopHatch(ctx, name, x, hingeY, hingeZ, width, depth, color, options = {}) {
  const pivot = new THREE.Group();
  pivot.name = name + '-hinge-group';
  pivot.position.set(x, hingeY, hingeZ);
  ctx.group.add(pivot);
  addRoundedBox(
    ctx,
    name + '-panel',
    width,
    options.thickness || 0.06,
    depth,
    0,
    -(options.thickness || 0.06) / 2,
    depth / 2,
    color,
    0.025,
    pivot,
    options.metalness ?? 0.12,
    0.48,
  );
  addCylinderAt(ctx, name + '-hinge-bar', 0.015, 0.015, width * 0.86, 0, 0, 0, '#9aa2a3', {
    segments: 12,
    rotationZ: Math.PI / 2,
    metalness: 0.68,
    parent: pivot,
  });
  const base = options.base || 0;
  pivot.rotation.x = base;
  return {
    object: pivot,
    axis: 'x',
    base,
    delta: options.delta ?? -0.8,
    delay: options.delay || 0,
    closeStart: options.closeStart ?? 0.72,
  };
}

function addPlayItem(ctx, name, position, color = '#d9ba71') {
  const item = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.09, 0),
    ctx.material(color, 0.04, 0.42),
  );
  item.name = 'play-item-' + name;
  item.position.set(position[0], position[1], position[2]);
  item.visible = false;
  ctx.group.add(item);
  return item;
}

function smooth(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function openAmount(progress, target) {
  const opening = smooth((progress - target.delay) / 0.24);
  const closing = smooth((progress - target.closeStart) / (1 - target.closeStart));
  return opening * (1 - closing);
}

function createAction(options = {}) {
  const action = {
    duration: options.duration || 3.2,
    update(progress) {
      const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
      for (const target of options.targets || []) {
        target.object.rotation[target.axis] = target.base + target.delta * openAmount(p, target);
      }
      for (const entry of options.items || []) {
        const startAt = entry.startAt ?? 0.24;
        const endAt = entry.endAt ?? 0.73;
        const t = smooth((p - startAt) / (endAt - startAt));
        entry.object.visible = p > startAt && p < endAt;
        if (entry.object.visible) {
          entry.object.position.set(
            entry.start[0] + (entry.end[0] - entry.start[0]) * t,
            entry.start[1] + (entry.end[1] - entry.start[1]) * t,
            entry.start[2] + (entry.end[2] - entry.start[2]) * t,
          );
          entry.object.rotation.set(t * Math.PI * 1.5, t * Math.PI * 2, t * Math.PI * 0.8);
        } else {
          const rest = entry.rest || entry.end;
          entry.object.position.set(rest[0], rest[1], rest[2]);
          entry.object.rotation.set(0, 0, 0);
        }
      }
      if (options.update) options.update(p);
    },
    reset() {
      action.update(0);
    },
  };
  return action;
}

function actionPart(id, label, description, hitTargets, action = {}) {
  return { id, label, description, hitTargets, ...action };
}

function attachPlay(ctx, options = {}) {
  const play = createAction(options);
  const parts = [];
  const partActions = Object.create(null);
  for (const definition of options.parts || []) {
    const { id, label, description } = definition;
    if (typeof id !== 'string' || !id || Object.prototype.hasOwnProperty.call(partActions, id)) {
      throw new TypeError('Country model part ids must be unique nonempty strings');
    }
    const action = createAction({
      ...definition,
      duration: definition.duration ?? options.duration,
    });
    const hitTargets = Array.isArray(definition.hitTargets) ? definition.hitTargets : [definition.hitTargets];
    for (const target of hitTargets) {
      if (target) target.userData.countryPartId = id;
    }
    parts.push({ id, label, description });
    partActions[id] = action;
  }
  ctx.group.userData.play = play;
  ctx.group.userData.parts = parts;
  ctx.group.userData.partActions = partActions;
  for (const action of Object.values(partActions)) action.reset();
  play.reset();
  return ctx.group;
}

function frontFasteners(ctx, name, x, y, z, width, color = '#b8bfc0') {
  for (const side of [-1, 1]) {
    addFrontDisc(ctx, name + '-' + side, 0.018, 0.018, x + side * width / 2, y, z, color, 0.65);
  }
}

function buildJapan() {
  const ctx = context('japan');
  addRoundedBox(ctx, 'shared-plinth', 2.22, 0.14, 0.9, 0, 0, 0, '#252a2d', 0.045, ctx.group, 0.24, 0.38);
  for (const side of [-1, 1]) {
    const x = side * 0.55;
    addRoundedBox(ctx, side < 0 ? 'left-gold-cabinet' : 'right-gold-cabinet', 1.04, 1.82, 0.78, x, 0.14, 0, '#d4b64d', 0.075, ctx.group, 0.18, 0.44);
    addRoundedBox(ctx, side < 0 ? 'left-inset-face' : 'right-inset-face', 0.89, 1.57, 0.055, x, 0.27, 0.405, '#e0c65f', 0.035, ctx.group, 0.08, 0.48);
    addRoundedBox(ctx, side < 0 ? 'left-black-cap' : 'right-black-cap', 1.08, 0.14, 0.86, x, 1.96, 0, '#25292c', 0.045, ctx.group, 0.42, 0.35);
    addBox(ctx, side < 0 ? 'left-cap-metal-line' : 'right-cap-metal-line', 0.9, 0.018, 0.025, x, 2.015, 0.443, '#b7bdbe', ctx.group, 0.72);
    addRoundedBox(ctx, side < 0 ? 'left-service-door' : 'right-service-door', 0.32, 0.25, 0.04, x + (side < 0 ? -0.24 : 0.24), 0.42, 0.45, '#303538', 0.018, ctx.group, 0.22, 0.42);
    frontFasteners(ctx, side < 0 ? 'left-service-screws' : 'right-service-screws', x - 0.24, 0.62, 0.48, 0.24);
    addRoundedBox(ctx, side < 0 ? 'left-foot-pedal' : 'right-foot-pedal', 0.68, 0.065, 0.19, x, 0.14, 0.49, '#b7bec0', 0.025, ctx.group, 0.62, 0.34);
    addBox(ctx, side < 0 ? 'left-foot-pedal-grip' : 'right-foot-pedal-grip', 0.48, 0.018, 0.10, x, 0.195, 0.53, '#d5d9d9', ctx.group, 0.58);
  }
  addRoundedBox(ctx, 'center-divider', 0.09, 1.82, 0.84, 0, 0.14, 0, '#24292c', 0.025, ctx.group, 0.28, 0.42);
  const intake = addRoundedBox(ctx, 'left-intake-recess', 0.82, 0.56, 0.055, -0.55, 1.18, 0.423, '#171d20', 0.025, ctx.group, 0.16, 0.38);

  const leftFlap = addDoor(ctx, 'left-dark-intake-flap', -0.55, 1.72, 0.455, 0.77, 0.50, '#262b2e', { handle: true, delta: -0.96 });
  const rightPanel = addRoundedBox(ctx, 'right-blue-inset-panel', 0.8, 0.54, 0.055, 0.55, 1.18, 0.424, '#1763ae', 0.04, ctx.group, 0.12, 0.42);
  addFrontDisc(ctx, 'right-blue-inlet-rim', 0.18, 0.045, 0.55, 1.47, 0.463, '#d9e1e1', 0.48);
  addFrontDisc(ctx, 'right-blue-inlet', 0.145, 0.05, 0.55, 1.47, 0.493, '#11191c', 0.18);
  addFrontDisc(ctx, 'right-inlet-inner-shadow', 0.088, 0.052, 0.55, 1.47, 0.523, '#05090a', 0.06);
  addRoundedBox(ctx, 'left-classification-band', 0.76, 0.09, 0.025, -0.55, 1.76, 0.469, '#9d3232', 0.015, ctx.group, 0.06, 0.48);
  addRoundedBox(ctx, 'right-classification-band', 0.76, 0.09, 0.025, 0.55, 1.76, 0.469, '#164a86', 0.015, ctx.group, 0.06, 0.48);
  const item = addPlayItem(ctx, 'japan-paper', [-0.55, 0.52, 0]);
  const deposit = { object: item, start: [-0.55, 1.49, 0.59], end: [-0.55, 0.54, 0] };
  return attachPlay(ctx, {
    duration: 3.2,
    targets: [leftFlap],
    items: [deposit],
    parts: [
      actionPart('left-flap', '左側入口翻板', '翻開並闔上左側黑色入口翻板。', [leftFlap.object], { targets: [leftFlap] }),
      actionPart('paper-deposit', '紙張投入', '示意紙張經左側入口投入箱內。', [intake], { targets: [leftFlap], items: [deposit] }),
    ],
  });
}

function buildUk() {
  const ctx = context('uk');
  addRoundedBox(ctx, 'rounded-single-cabinet', 1.16, 1.64, 0.84, 0, 0, 0, '#303639', 0.11, ctx.group, 0.22, 0.42);
  const roof = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    ctx.material('#292f32', 0.3, 0.36),
  );
  roof.name = 'low-rounded-roof';
  roof.position.set(0, 1.63, 0);
  roof.scale.set(0.61, 0.34, 0.45);
  ctx.group.add(roof);
  addRoundedBox(ctx, 'roof-edge-metal-trim', 1.04, 0.045, 0.83, 0, 1.60, 0, '#909899', 0.018, ctx.group, 0.62, 0.32);
  addRoundedBox(ctx, 'roof-plate', 0.44, 0.035, 0.27, 0, 1.93, -0.035, '#263c48', 0.012, ctx.group, 0.4, 0.35);
  for (let index = 0; index < 4; index += 1) {
    addBox(ctx, 'roof-plate-cell-' + index, 0.085, 0.009, 0.22, -0.15 + index * 0.1, 1.952, -0.035, '#60737b', ctx.group, 0.46);
  }
  const intake = addRoundedBox(ctx, 'front-intake-recess', 0.82, 0.56, 0.055, 0, 0.82, 0.43, '#171c1f', 0.045, ctx.group, 0.2, 0.38);
  addBox(ctx, 'front-brass-band-upper', 0.98, 0.024, 0.022, 0, 0.58, 0.434, '#94744a', ctx.group, 0.42);
  addBox(ctx, 'front-brass-band-lower', 0.98, 0.024, 0.022, 0, 0.34, 0.434, '#94744a', ctx.group, 0.42);
  const flap = addDoor(ctx, 'front-entry-flap', 0, 1.30, 0.46, 0.60, 0.40, '#40484b', { handle: true, delta: -0.92 });
  addRoundedBox(ctx, 'lower-service-panel', 0.43, 0.25, 0.055, 0, 0.22, 0.44, '#252b2e', 0.03, ctx.group, 0.3, 0.42);
  frontFasteners(ctx, 'lower-service-fasteners', 0, 0.48, 0.475, 0.35);
  addBox(ctx, 'left-side-edge-rail', 0.055, 1.28, 0.07, -0.55, 0.20, 0.22, '#495154', ctx.group, 0.42);
  addBox(ctx, 'right-side-edge-rail', 0.055, 1.28, 0.07, 0.55, 0.20, 0.22, '#495154', ctx.group, 0.42);
  const item = addPlayItem(ctx, 'uk-paper', [0, 0.45, 0]);
  const deposit = { object: item, start: [0, 1.08, 0.59], end: [0, 0.45, 0] };
  return attachPlay(ctx, {
    targets: [flap],
    items: [deposit],
    parts: [
      actionPart('entry-flap', '入口翻板', '翻開並闔上前方入口翻板。', [flap.object], { targets: [flap] }),
      actionPart('paper-deposit', '紙張投入', '示意紙張經前方入口投入箱內。', [intake], { targets: [flap], items: [deposit] }),
    ],
  });
}

function buildDenmark() {
  const ctx = context('denmark');
  addRoundedBox(ctx, 'citysolar-cabinet', 1.04, 1.72, 0.82, 0, 0, 0, '#252a2c', 0.09, ctx.group, 0.24, 0.44);
  addRoundedBox(ctx, 'sloped-roof-shell', 1.18, 0.22, 0.88, 0, 1.66, 0, '#202527', 0.06, ctx.group, 0.32, 0.38);
  addRoundedBox(ctx, 'roof-solar-panel', 0.72, 0.04, 0.48, 0, 1.87, -0.02, '#33444c', 0.02, ctx.group, 0.46, 0.34);
  for (let index = 0; index < 5; index += 1) {
    addBox(ctx, 'solar-cell-line-' + index, 0.012, 0.008, 0.42, -0.27 + index * 0.135, 1.897, -0.02, '#789099', ctx.group, 0.5);
  }
  const intake = addRoundedBox(ctx, 'upper-intake-recess', 0.74, 0.45, 0.05, 0, 1.16, 0.42, '#171d20', 0.025, ctx.group, 0.16, 0.4);
  addBox(ctx, 'lime-identification-band', 0.92, 0.075, 0.035, 0, 1.39, 0.43, '#afc346');
  const flap = addDoor(ctx, 'upper-intake-flap', 0, 1.55, 0.46, 0.66, 0.36, '#383f42', { handle: true, delta: -0.95 });
  addRoundedBox(ctx, 'lower-service-panel', 0.54, 0.34, 0.045, 0, 0.45, 0.43, '#303639', 0.03, ctx.group, 0.18, 0.48);
  addBox(ctx, 'service-pull', 0.23, 0.035, 0.045, 0, 0.76, 0.47, '#aeb5b6', ctx.group, 0.68);
  const pedal = addRoundedBox(ctx, 'front-foot-pedal', 0.62, 0.08, 0.24, 0, 0.11, 0.49, '#aeb6b7', 0.03, ctx.group, 0.68, 0.34);
  addBox(ctx, 'pedal-grip', 0.48, 0.02, 0.12, 0, 0.18, 0.55, '#d2d7d7', ctx.group, 0.58);
  const item = addPlayItem(ctx, 'denmark-paper', [0, 0.52, 0]);
  const deposit = { object: item, start: [0, 1.34, 0.58], end: [0, 0.52, 0] };
  const pressPedal = (progress) => {
    pedal.rotation.x = 0.18 * Math.sin(Math.PI * progress);
  };
  return attachPlay(ctx, {
    targets: [flap],
    items: [deposit],
    update: pressPedal,
    parts: [
      actionPart('entry-flap', '入口翻板', '翻開並闔上上方入口翻板。', [flap.object], { targets: [flap] }),
      actionPart('paper-deposit', '紙張投入', '示意紙張經上方入口投入箱內。', [intake], { targets: [flap], items: [deposit] }),
      actionPart('foot-pedal', '前踏板', '示意踩下前方踏板並讓踏板回位。', [pedal], { update: pressPedal }),
    ],
  });
}

function buildUs() {
  const ctx = context('us');
  addCylinder(ctx, 'round-steel-basket', 0.45, 0.48, 1.48, 0, 0.1, 0, '#70797b', {
    segments: 40,
    metalness: 0.74,
    roughness: 0.4,
  });
  addCylinder(ctx, 'lower-steel-collar', 0.5, 0.5, 0.12, 0, 0, 0, '#a5acad', {
    segments: 40,
    metalness: 0.78,
  });
  addCylinder(ctx, 'upper-steel-head', 0.51, 0.48, 0.25, 0, 1.56, 0, '#959d9e', {
    segments: 40,
    metalness: 0.72,
  });
  addCylinder(ctx, 'upper-dark-rim', 0.515, 0.515, 0.035, 0, 1.695, 0, '#3b4244', {
    segments: 40,
    metalness: 0.55,
  });
  addHorizontalRing(ctx, 'lower-polished-ring', 0.49, 0.024, 0, 0.14, 0, '#c0c6c7', 0.76);
  addHorizontalRing(ctx, 'upper-polished-ring', 0.49, 0.022, 0, 1.32, 0, '#b7bfc0', 0.76);
  for (let index = 0; index < 22; index += 1) {
    const angle = (index / 22) * Math.PI * 2;
    const x = Math.cos(angle) * 0.474;
    const z = Math.sin(angle) * 0.474;
    addCylinderAt(ctx, 'vertical-steel-slat-' + index, 0.018, 0.018, 1.21, x, 0.85, z, '#c4cbcc', {
      segments: 10,
      metalness: 0.82,
      roughness: 0.34,
    });
  }
  const intake = addRoundedBox(ctx, 'upper-slot-recess', 0.36, 0.14, 0.045, 0, 1.59, 0.49, '#242a2c', 0.025, ctx.group, 0.35, 0.38);
  const flap = addDoor(ctx, 'upper-slot-flap', 0, 1.68, 0.525, 0.30, 0.10, '#6e7779', { depth: 0.035, delta: -0.78 });
  const item = addPlayItem(ctx, 'us-paper', [0, 0.53, 0]);
  const deposit = { object: item, start: [0, 1.61, 0.59], end: [0, 0.53, 0] };
  return attachPlay(ctx, {
    targets: [flap],
    items: [deposit],
    parts: [
      actionPart('slot-flap', '投入口翻板', '翻開並闔上圓筒上方的投入口翻板。', [flap.object], { targets: [flap] }),
      actionPart('paper-deposit', '紙張投入', '示意紙張經上方窄槽投入籃內。', [intake], { targets: [flap], items: [deposit] }),
    ],
  });
}

function buildFinland() {
  const ctx = context('finland');
  addCylinder(ctx, 'wood-cylinder-inner-body', 0.65, 0.68, 1.42, 0, 0, 0, '#604a34', { segments: 40 });
  for (let index = 0; index < 30; index += 1) {
    const angle = (index / 30) * Math.PI * 2;
    const x = Math.cos(angle) * 0.665;
    const z = Math.sin(angle) * 0.665;
    addBoxAt(ctx, 'vertical-oak-slat-' + index, 0.12, 1.33, 0.055, x, 0.72, z, index % 2 ? '#987950' : '#846642', [0, angle + Math.PI / 2, 0]);
  }
  addCylinder(ctx, 'lower-metal-collar', 0.72, 0.72, 0.12, 0, 0.02, 0, '#c0c6c6', {
    segments: 40,
    metalness: 0.72,
  });
  addCylinder(ctx, 'upper-metal-collar', 0.73, 0.73, 0.105, 0, 1.36, 0, '#b2babb', {
    segments: 40,
    metalness: 0.68,
  });
  addCylinder(ctx, 'broad-conical-lid', 0.055, 0.75, 0.31, 0, 1.465, 0, '#394143', {
    segments: 40,
    metalness: 0.22,
  });
  addCylinder(ctx, 'lid-edge-band', 0.75, 0.75, 0.035, 0, 1.33, 0, '#51595a', {
    segments: 40,
    metalness: 0.56,
  });
  const hatch = addDoor(ctx, 'small-front-lid-hatch', 0, 1.65, 0.51, 0.42, 0.17, '#30383a', {
    handle: true,
    depth: 0.04,
    delta: -0.84,
  });
  const item = addPlayItem(ctx, 'finland-paper', [0, 0.55, 0]);
  const deposit = { object: item, start: [0, 1.56, 0.60], end: [0, 0.55, 0] };
  return attachPlay(ctx, {
    targets: [hatch],
    items: [deposit],
    parts: [
      actionPart('front-hatch-deposit', '前方小蓋與投入', '翻開前方小蓋，示意紙張進入木桶。', [hatch.object], { targets: [hatch], items: [deposit] }),
    ],
  });
}

function buildKorea() {
  const ctx = context('korea');
  addRoundedBox(ctx, 'silver-weighing-cabinet', 1.12, 1.52, 0.78, 0, 0, 0, '#b7bec0', 0.08, ctx.group, 0.42, 0.42);
  addRoundedBox(ctx, 'front-lower-access-panel', 0.74, 0.37, 0.04, 0, 0.20, 0.405, '#aab2b4', 0.035, ctx.group, 0.36, 0.42);
  frontFasteners(ctx, 'lower-panel-screws', 0, 0.53, 0.438, 0.62, '#747e80');
  addRoundedBox(ctx, 'orange-hood-rear', 1.02, 0.51, 0.08, 0, 1.52, -0.35, '#ef6330', 0.05, ctx.group, 0.08, 0.42);
  addRoundedBox(ctx, 'orange-hood-side-left', 0.075, 0.52, 0.70, -0.52, 1.52, 0, '#ef6330', 0.025, ctx.group, 0.08, 0.42);
  addRoundedBox(ctx, 'orange-hood-side-right', 0.075, 0.52, 0.70, 0.52, 1.52, 0, '#ef6330', 0.025, ctx.group, 0.08, 0.42);
  addRoundedBox(ctx, 'orange-hood-top', 1.22, 0.15, 0.91, 0, 2.03, 0, '#f16a35', 0.045, ctx.group, 0.08, 0.4);
  addRoundedBox(ctx, 'horizontal-tray-recess', 0.84, 0.12, 0.55, 0, 1.49, 0.02, '#737d7f', 0.04, ctx.group, 0.34, 0.42);
  const intake = addRoundedBox(ctx, 'horizontal-intake-slot', 0.54, 0.04, 0.32, 0, 1.59, 0.06, '#202628', 0.02, ctx.group, 0.24, 0.38);
  const hatch = addTopHatch(ctx, 'horizontal-intake-hatch', 0, 1.59, -0.23, 0.68, 0.46, '#a9b0b2', {
    delta: -0.82,
    thickness: 0.045,
  });
  addRoundedBox(ctx, 'keypad-housing', 0.16, 0.36, 0.07, 0.46, 1.08, 0.414, '#22292c', 0.025, ctx.group, 0.4, 0.4);
  addRoundedBox(ctx, 'keypad-display', 0.10, 0.075, 0.025, 0.46, 1.31, 0.461, '#5d8991', 0.015, ctx.group, 0.18, 0.42);
  for (let index = 0; index < 6; index += 1) {
    addFrontDisc(ctx, 'keypad-button-' + index, 0.018, 0.02, 0.425 + (index % 2) * 0.06, 1.21 - Math.floor(index / 2) * 0.07, 0.465, '#d5dada', 0.4);
  }
  const item = addPlayItem(ctx, 'korea-paper', [0, 0.48, 0]);
  const deposit = { object: item, start: [0, 1.67, 0.18], end: [0, 0.48, 0] };
  return attachPlay(ctx, {
    targets: [hatch],
    items: [deposit],
    parts: [
      actionPart('horizontal-hatch-deposit', '水平上蓋與投入', '掀開水平入口蓋，示意物品投入秤重箱。', [hatch.object, intake], { targets: [hatch], items: [deposit] }),
    ],
  });
}

function buildFrance() {
  const ctx = context('france');
  const bagMaterial = new THREE.MeshStandardMaterial({
    color: '#c9cece',
    roughness: 0.45,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const liner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.305, 0.34, 0.9, 32, 1, true),
    bagMaterial,
  );
  liner.name = 'translucent-inner-liner';
  liner.position.set(0, 0.62, 0);
  ctx.group.add(liner);

  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2;
    const x = Math.cos(angle) * 0.36;
    const z = Math.sin(angle) * 0.36;
    addCylinderAt(ctx, 'slender-wire-upright-' + index, 0.013, 0.015, 1.2, x, 0.69, z, '#9aa2a3', {
      segments: 8,
      metalness: 0.72,
      roughness: 0.38,
    });
  }
  addHorizontalRing(ctx, 'ground-wire-ring', 0.36, 0.022, 0, 0.022, 0, '#aab1b2', 0.72);
  addHorizontalRing(ctx, 'lower-wire-ring', 0.36, 0.018, 0, 0.19, 0, '#abb2b3', 0.72);
  addHorizontalRing(ctx, 'middle-wire-ring', 0.36, 0.016, 0, 0.7, 0, '#abb2b3', 0.72);
  addHorizontalRing(ctx, 'upper-wire-ring', 0.36, 0.017, 0, 1.13, 0, '#abb2b3', 0.72);
  const openRim = addHorizontalRing(ctx, 'open-rim-ring', 0.38, 0.022, 0, 1.3, 0, '#c1c7c8', 0.78);
  for (let index = 0; index < 3; index += 1) {
    addCylinderAt(ctx, 'short-ground-foot-' + index, 0.035, 0.035, 0.10, Math.cos(index * 2.1) * 0.28, 0.05, Math.sin(index * 2.1) * 0.28, '#80898a', {
      segments: 10,
      metalness: 0.64,
    });
  }
  const item = addPlayItem(ctx, 'france-paper', [0, 0.5, 0]);
  const deposit = { object: item, start: [0, 1.44, 0], end: [0, 0.50, 0] };
  const liftLiner = (progress) => {
    const lift = progress <= 0.5
      ? smooth(progress / 0.5) * 0.42
      : (1 - smooth((progress - 0.5) / 0.5)) * 0.42;
    liner.position.y = 0.62 + lift;
  };
  return attachPlay(ctx, {
    items: [deposit],
    parts: [
      actionPart('open-top-deposit', '敞口投入', '示意紙張經開放式籃口投入；模型沒有另加翻蓋。', [openRim], { items: [deposit] }),
      actionPart('remove-liner', '提出內袋', '將現有內袋向上提出，再放回籃內。', [liner], { update: liftLiner }),
    ],
  });
}

function buildNetherlands() {
  const ctx = context('netherlands');
  addRoundedBox(ctx, 'left-support-leg', 0.12, 0.56, 0.15, -0.28, 0, 0, '#7e8586', 0.03, ctx.group, 0.42, 0.44);
  addRoundedBox(ctx, 'right-support-leg', 0.12, 0.56, 0.15, 0.28, 0, 0, '#7e8586', 0.03, ctx.group, 0.42, 0.44);
  addRoundedBox(ctx, 'yellow-donation-body', 0.84, 1.08, 0.58, 0, 0.48, 0, '#e0c42e', 0.11, ctx.group, 0.12, 0.5);
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    ctx.material('#e2c72d', 0.08, 0.48),
  );
  hood.name = 'perforated-rounded-yellow-hood';
  hood.position.set(0, 1.55, 0);
  hood.scale.set(0.45, 0.33, 0.31);
  ctx.group.add(hood);
  for (let row = -2; row <= 2; row += 1) {
    for (let column = -3; column <= 3; column += 1) {
      const x = column * 0.092;
      const z = row * 0.073;
      const normalized = (x * x) / (0.45 * 0.45) + (z * z) / (0.31 * 0.31);
      if (normalized >= 0.7) continue;
      const y = 1.55 + 0.33 * Math.sqrt(Math.max(0, 1 - normalized)) + 0.005;
      addCylinderAt(ctx, 'hood-perforation-' + row + '-' + column, 0.012, 0.012, 0.009, x, y, z, '#8d801f', {
        segments: 8,
        metalness: 0.12,
      });
    }
  }
  addFrontDisc(ctx, 'round-deposit-opening-trim', 0.20, 0.055, 0, 1.49, 0.307, '#9c9b75', 0.46);
  addFrontDisc(ctx, 'round-deposit-opening-rim', 0.17, 0.06, 0, 1.49, 0.338, '#353a38', 0.32);
  const depositOpening = addFrontDisc(ctx, 'round-deposit-opening', 0.125, 0.065, 0, 1.49, 0.37, '#101617', 0.12);
  addRoundedBox(ctx, 'lower-pull-hatch', 0.58, 0.30, 0.05, 0, 0.69, 0.31, '#b5a747', 0.04, ctx.group, 0.16, 0.48);
  addBox(ctx, 'lower-hatch-handle', 0.23, 0.04, 0.045, 0, 0.85, 0.35, '#6c716e', ctx.group, 0.58);
  const item = addPlayItem(ctx, 'netherlands-bottle', [0, 0.55, 0]);
  const deposit = { object: item, start: [0, 1.49, 0.48], end: [0, 0.55, -0.08] };
  return attachPlay(ctx, {
    items: [deposit],
    parts: [
      actionPart('bottle-deposit', '瓶罐投入', '示意物品經圓形回收入口投入箱內。', [depositOpening], { items: [deposit] }),
    ],
  });
}

function buildSingapore() {
  const ctx = context('singapore');
  const bins = [
    { x: -0.84, color: '#267a57' },
    { x: -0.28, color: '#286aa0' },
    { x: 0.28, color: '#c84d4b' },
    { x: 0.84, color: '#d0ad35' },
  ];
  const targets = [];
  const slotHits = [];
  bins.forEach((bin, index) => {
    addRoundedBox(ctx, 'colored-cabinet-' + index, 0.49, 1.4, 0.49, bin.x, 0, 0, bin.color, 0.045, ctx.group, 0.12, 0.46);
    addRoundedBox(ctx, 'front-identification-inset-' + index, 0.37, 0.42, 0.035, bin.x, 0.88, 0.258, '#d2d8d6', 0.025, ctx.group, 0.08, 0.48);
    slotHits.push(addRoundedBox(ctx, 'front-slot-' + index, 0.23, 0.065, 0.04, bin.x, 1.07, 0.286, '#263033', 0.02, ctx.group, 0.2, 0.4));
    const lid = addTopHatch(ctx, 'colored-top-flap-' + index, bin.x, 1.38, -0.22, 0.5, 0.46, bin.color, {
      base: 0.14,
      delta: -0.90,
      thickness: 0.17,
      delay: index * 0.025,
      closeStart: 0.72,
    });
    targets.push(lid);
  });
  const item = addPlayItem(ctx, 'singapore-paper', [-0.28, 0.52, 0]);
  const deposit = { object: item, start: [-0.28, 1.57, 0.05], end: [-0.28, 0.52, 0] };
  const blueDeposit = { object: item, start: [-0.28, 1.10, 0.35], end: [-0.28, 0.52, 0] };
  return attachPlay(ctx, {
    targets,
    items: [deposit],
    parts: [
      actionPart('sorting-lids', '分類入口上蓋', '依序翻開並闔上四個分類入口上蓋。', targets.map((target) => target.object), { targets }),
      actionPart('paper-deposit', '藍色入口投入', '示意紙張經藍色前方槽投入分類箱。', [slotHits[1]], { items: [blueDeposit] }),
    ],
  });
}

function buildIndia() {
  const ctx = context('india');
  addRoundedBox(ctx, 'truck-chassis', 1.1, 0.18, 2.05, 0, 0.25, 0, '#33393b', 0.06, ctx.group, 0.3, 0.4);
  const bed = new THREE.Group();
  bed.name = 'tilting-collection-bed';
  bed.position.set(0, 0.88, 0.20);
  ctx.group.add(bed);
  addRoundedBox(ctx, 'yellow-collection-bed', 1.04, 0.55, 1.2, 0, -0.55, -0.62, '#d3ad25', 0.055, bed, 0.12, 0.48);
  addBox(ctx, 'collection-bed-inner-floor', 0.83, 0.035, 0.95, 0, -0.53, -0.62, '#b79522', bed);
  for (const side of [-1, 1]) {
    addRoundedBox(ctx, 'collection-side-rail-' + side, 0.055, 0.48, 1.12, side * 0.48, -0.03, -0.62, '#e2bc2c', 0.022, bed, 0.1, 0.46);
  }
  addRoundedBox(ctx, 'yellow-cab', 1.06, 0.82, 0.72, 0, 0.42, 0.70, '#e2b91f', 0.09, ctx.group, 0.12, 0.43);
  addRoundedBox(ctx, 'cab-roof', 1.11, 0.12, 0.78, 0, 1.22, 0.70, '#d6ab1d', 0.045, ctx.group, 0.12, 0.42);
  addRoundedBox(ctx, 'front-windshield', 0.79, 0.32, 0.04, 0, 0.91, 1.075, '#80aab4', 0.035, ctx.group, 0.16, 0.34);
  addRoundedBox(ctx, 'front-grille', 0.52, 0.20, 0.045, 0, 0.53, 1.10, '#293033', 0.025, ctx.group, 0.22, 0.38);
  for (const side of [-1, 1]) {
    addRoundedBox(ctx, 'front-headlight-' + side, 0.16, 0.10, 0.04, side * 0.37, 0.58, 1.11, '#d6d4b5', 0.025, ctx.group, 0.12, 0.4);
    addRoundedBox(ctx, 'cab-side-window-' + side, 0.04, 0.32, 0.30, side * 0.54, 0.91, 0.74, '#7197a0', 0.025, ctx.group, 0.18, 0.36);
    addBox(ctx, 'door-seam-' + side, 0.018, 0.48, 0.018, side * 0.54, 0.63, 0.72, '#b18f1b');
    addBox(ctx, 'side-mirror-arm-' + side, 0.15, 0.025, 0.025, side * 0.62, 0.95, 0.95, '#4d5658', ctx.group, 0.45);
    addRoundedBox(ctx, 'side-mirror-' + side, 0.075, 0.12, 0.045, side * 0.69, 0.94, 0.95, '#4e585a', 0.025, ctx.group, 0.46, 0.36);
  }
  addRoundedBox(ctx, 'front-bumper', 1.2, 0.12, 0.15, 0, 0.25, 1.12, '#aeb6b7', 0.035, ctx.group, 0.58, 0.36);

  const wheelAssemblies = [];
  for (const side of [-1, 1]) {
    for (const z of [-0.68, 0.7]) {
      const axle = new THREE.Group();
      axle.name = 'wheel-axle-' + side + '-' + z;
      axle.position.set(side * 0.57, 0.30, z);
      axle.rotation.z = Math.PI / 2;
      ctx.group.add(axle);
      const spin = new THREE.Group();
      spin.name = 'wheel-spin-' + side + '-' + z;
      axle.add(spin);
      addCylinderAt(ctx, 'rubber-wheel-' + side + '-' + z, 0.30, 0.30, 0.18, 0, 0, 0, '#242a2c', {
        segments: 24,
        parent: spin,
        roughness: 0.72,
      });
      addCylinderAt(ctx, 'silver-wheel-hub-' + side + '-' + z, 0.13, 0.13, 0.195, 0, 0, 0, '#aeb6b7', {
        segments: 20,
        parent: spin,
        metalness: 0.58,
        roughness: 0.36,
      });
      addCylinderAt(ctx, 'wheel-center-cap-' + side + '-' + z, 0.055, 0.055, 0.205, 0, 0, 0, '#555e60', {
        segments: 16,
        parent: spin,
        metalness: 0.56,
      });
      wheelAssemblies.push(spin);
    }
  }
  addRoundedBox(ctx, 'small-container-body', 0.54, 0.67, 0.56, 1.03, 0.04, -0.25, '#57846a', 0.055, ctx.group, 0.08, 0.5);
  addRoundedBox(ctx, 'small-container-rim', 0.60, 0.08, 0.62, 1.03, 0.71, -0.25, '#416d55', 0.035, ctx.group, 0.12, 0.46);
  addBox(ctx, 'container-side-grip', 0.04, 0.16, 0.09, 1.32, 0.38, -0.25, '#c0c7c3', ctx.group, 0.48);
  const turnWheels = (progress) => {
    const travel = smooth(progress);
    for (const wheel of wheelAssemblies) {
      wheel.rotation.y = travel * Math.PI * 2;
    }
  };
  const tiltBed = (progress) => {
    bed.rotation.x = 0.30 * Math.sin(Math.PI * progress);
  };
  return attachPlay(ctx, {
    duration: 3.5,
    update(progress) {
      turnWheels(progress);
      tiltBed(progress);
    },
    parts: [
      actionPart('collection-bed', '傾斜收集斗', '示意車斗抬起並回到行駛位置。', [bed], { update: tiltBed }),
      actionPart('truck-wheels', '車輪轉動', '示意四個車輪轉動一圈。', wheelAssemblies, { update: turnWheels }),
    ],
  });
}

function buildAustralia() {
  const ctx = context('australia');
  addRoundedBox(ctx, 'shared-station-plinth', 2.02, 0.15, 0.86, 0, 0, 0, '#37464a', 0.055, ctx.group, 0.24, 0.4);
  const bays = [
    { x: -0.62, color: '#397f70' },
    { x: 0, color: '#33718f' },
    { x: 0.62, color: '#7b8956' },
  ];
  const targets = [];
  const parts = [];
  const bayParts = [
    ['left-bay', '左側入口', '翻開並闔上左側投入入口。'],
    ['center-bay', '中央入口', '翻開並闔上中央投入入口。'],
    ['right-bay', '右側入口', '翻開並闔上右側投入入口。'],
  ];
  bays.forEach((bay, index) => {
    addRoundedBox(ctx, 'generic-receiving-bay-' + index, 0.58, 1.16, 0.70, bay.x, 0.15, 0, bay.color, 0.06, ctx.group, 0.1, 0.48);
    addRoundedBox(ctx, 'bay-front-recess-' + index, 0.43, 0.39, 0.045, bay.x, 0.65, 0.36, '#29393d', 0.03, ctx.group, 0.24, 0.4);
    const flap = addDoor(ctx, 'bay-intake-flap-' + index, bay.x, 1.18, 0.405, 0.30, 0.12, '#d3d9d7', {
      depth: 0.035,
      delta: -0.78,
      delay: index * 0.055,
      closeStart: 0.74,
      metalness: 0.28,
    });
    targets.push(flap);
    const [id, label, description] = bayParts[index];
    parts.push(actionPart(id, label, description, [flap.object], { targets: [flap] }));
  });
  addRoundedBox(ctx, 'shared-canopy', 2.08, 0.17, 0.94, 0, 1.48, 0, '#38474b', 0.055, ctx.group, 0.28, 0.4);
  for (const side of [-1, 1]) {
    addRoundedBox(ctx, 'canopy-support-front-' + side, 0.075, 1.30, 0.08, side * 0.88, 0.15, 0.40, '#46565a', 0.025, ctx.group, 0.34, 0.4);
    addRoundedBox(ctx, 'canopy-support-back-' + side, 0.075, 1.30, 0.08, side * 0.88, 0.15, -0.40, '#46565a', 0.025, ctx.group, 0.34, 0.4);
  }
  addRoundedBox(ctx, 'shared-control-panel', 0.42, 0.34, 0.055, 0, 1.79, 0.48, '#d1d9d8', 0.04, ctx.group, 0.14, 0.46);
  addFrontDisc(ctx, 'generic-status-indicator', 0.065, 0.035, 0, 1.95, 0.52, '#4e8a73', 0.18);
  return attachPlay(ctx, {
    targets,
    duration: 3.1,
    parts,
  });
}

function buildSouthAfrica() {
  const ctx = context('south-africa');
  addRoundedBox(ctx, 'rear-bottom-frame', 2.5, 0.09, 0.08, 0, 0, -0.4, '#535d5f', 0.025, ctx.group, 0.48, 0.4);
  addRoundedBox(ctx, 'front-bottom-frame', 2.5, 0.09, 0.08, 0, 0, 0.4, '#535d5f', 0.025, ctx.group, 0.48, 0.4);
  addRoundedBox(ctx, 'rear-top-frame', 2.5, 0.09, 0.08, 0, 1.55, -0.4, '#535d5f', 0.025, ctx.group, 0.48, 0.4);
  addRoundedBox(ctx, 'front-slot-header', 2.5, 0.10, 0.08, 0, 1.40, 0.4, '#535d5f', 0.025, ctx.group, 0.48, 0.4);

  for (let index = 0; index < 4; index += 1) {
    const x = -1.23 + index * 0.82;
    addRoundedBox(ctx, 'steel-post-front-' + index, 0.075, 1.92, 0.075, x, 0.05, 0.4, '#697375', 0.024, ctx.group, 0.52, 0.38);
    addRoundedBox(ctx, 'steel-post-back-' + index, 0.075, 1.92, 0.075, x, 0.05, -0.4, '#697375', 0.024, ctx.group, 0.52, 0.38);
  }

  const bayCenters = [-0.82, 0, 0.82];
  const intakeSlots = [];
  bayCenters.forEach((x, index) => {
    addRoundedBox(ctx, 'dark-bay-interior-' + index, 0.72, 1.22, 0.06, x, 0.16, -0.32, '#32393b', 0.03, ctx.group, 0.18, 0.44);
    for (let row = 0; row < 6; row += 1) {
      addRoundedBox(ctx, 'wood-front-slat-' + index + '-' + row, 0.72, 0.125, 0.055, x, 0.16 + row * 0.17, 0.36, row % 2 ? '#8d714e' : '#9a7b53', 0.018, ctx.group, 0.02, 0.78);
    }
    for (const side of [-1, 1]) {
      addRoundedBox(ctx, 'wood-side-slat-' + index + '-' + side, 0.065, 1.04, 0.70, x + side * 0.37, 0.18, 0, '#896f4e', 0.018, ctx.group, 0.02, 0.78);
    }
    intakeSlots.push(addRoundedBox(ctx, 'open-intake-slot-' + index, 0.56, 0.19, 0.035, x, 1.2, 0.405, '#1e282a', 0.02, ctx.group, 0.12, 0.38));
    addRoundedBox(ctx, 'bay-identification-plate-' + index, 0.56, 0.23, 0.035, x, 1.42, 0.405, ['#477f77', '#a99049', '#3c7190'][index], 0.02, ctx.group, 0.05, 0.54);
  });

  addRoundedBox(ctx, 'roof-front-beam', 2.58, 0.10, 0.09, 0, 1.93, 0.43, '#606b6d', 0.03, ctx.group, 0.5, 0.4);
  addRoundedBox(ctx, 'roof-back-beam', 2.58, 0.10, 0.09, 0, 1.93, -0.43, '#606b6d', 0.03, ctx.group, 0.5, 0.4);
  for (let index = 0; index < 7; index += 1) {
    const z = -0.39 + index * 0.13;
    addRoundedBox(ctx, 'roof-wood-slat-' + index, 2.5, 0.075, 0.095, 0, 1.99, z, index % 2 ? '#8d714e' : '#9a7b53', 0.018, ctx.group, 0.02, 0.76);
  }
  const item = addPlayItem(ctx, 'south-africa-paper', [0, 0.52, -0.12]);
  const centerDeposit = { object: item, start: [0, 1.26, 0.44], end: [0, 0.52, -0.12] };
  const bayDeposits = bayCenters.map((x) => ({
    object: item,
    start: [x, 1.26, 0.44],
    end: [x, 0.52, -0.12],
    rest: [0, 0.52, -0.12],
  }));
  return attachPlay(ctx, {
    items: [centerDeposit],
    parts: [
      actionPart('left-bay-deposit', '左側槽投入', '示意物品經左側開放槽投入。', [intakeSlots[0]], { items: [bayDeposits[0]] }),
      actionPart('center-bay-deposit', '中央槽投入', '示意物品經中央開放槽投入。', [intakeSlots[1]], { items: [bayDeposits[1]] }),
      actionPart('right-bay-deposit', '右側槽投入', '示意物品經右側開放槽投入。', [intakeSlots[2]], { items: [bayDeposits[2]] }),
    ],
  });
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
