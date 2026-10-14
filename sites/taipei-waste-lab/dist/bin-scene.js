import * as THREE from './vendor/three/three.module.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const metres = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback) / 100;
const ease = t => 1 - Math.pow(1 - t, 3);

/** A small, self-contained, on-demand Three.js street-bin scene. Dimensions are metres. */
export function createBinScene(container, { onStatus = () => {} } = {}) {
  if (!container) throw new Error('缺少 3D 場景容器。');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0xeeeae1, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '垃圾桶 3D 模型。拖曳或使用方向鍵旋轉；加減鍵縮放；Home 回到全景。');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeeeae1);
  scene.fog = new THREE.Fog(0xeeeae1, 12, 23);
  const camera = new THREE.PerspectiveCamera(37, 1, 0.05, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 1.1;
  controls.maxDistance = 9;
  controls.minPolarAngle = 0.13;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.enablePan = true;
  controls.target.set(0, 0.65, 0.3);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb2aa92, 2.65));
  const sunlight = new THREE.DirectionalLight(0xfff5df, 3.3);
  sunlight.position.set(-3.5, 7, 4.5);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  sunlight.shadow.camera.left = -5;
  sunlight.shadow.camera.right = 5;
  sunlight.shadow.camera.top = 5;
  sunlight.shadow.camera.bottom = -5;
  sunlight.shadow.camera.near = 0.5;
  sunlight.shadow.camera.far = 18;
  sunlight.shadow.normalBias = 0.025;
  sunlight.shadow.bias = -0.0002;
  scene.add(sunlight);

  let modelGroup = new THREE.Group();
  let environment = new THREE.Group();
  let thrownObject = null;
  scene.add(modelGroup, environment);
  let design = null;
  let params = null;
  let mouth = new THREE.Vector3(0, 1.1, 0);
  let isFrontOpening = false;
  let doorParts = [];
  let linerParts = [];
  let lidParts = [];
  let canopyParts = [];
  let serviceOpen = false;
  let serviceProgress = 0;
  let currentView = 'overview';
  let active = true;
  let disposed = false;
  let frame = 0;
  let runningAction = null;
  let cameraAction = null;
  let actionStamp = 0;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motion.matches;

  const palette = {
    street: 0xd1d2cb, paving: 0xe5e1d5, curb: 0xf3f0e8,
    dark: 0x24302e, gray: 0x77847e, green: 0x3c7967,
    line: 0x4f6c60, gold: 0xdaa657,
  };
  const material = (color, options = {}) => new THREE.MeshStandardMaterial({
    color, roughness: 0.68, metalness: 0.12, ...options,
  });

  function mesh(geometry, mat, parent = modelGroup, position = [0, 0, 0]) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(...position);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(width, height, depth, color, parent, position, options) {
    return mesh(new THREE.BoxGeometry(width, height, depth), material(color, options), parent, position);
  }
  function cylinder(radius, height, color, parent, position, options = {}) {
    return mesh(new THREE.CylinderGeometry(radius, radius, height, 40, 1, !!options.openEnded),
      material(color, { side: options.openEnded ? THREE.DoubleSide : THREE.FrontSide, ...options.material }), parent, position);
  }
  function ring(outerRadius, innerRadius, color, parent, position) {
    const result = mesh(new THREE.RingGeometry(innerRadius, outerRadius, 48), material(color, { side: THREE.DoubleSide }), parent, position);
    result.rotation.x = -Math.PI / 2;
    return result;
  }
  function disposeTree(tree) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    tree.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const mat of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (!mat) continue;
        materials.add(mat);
        for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
      }
    });
    textures.forEach(texture => texture.dispose());
    materials.forEach(mat => mat.dispose());
    geometries.forEach(geometry => geometry.dispose());
    tree.clear();
  }
  function removeThrown() {
    if (!thrownObject) return;
    scene.remove(thrownObject);
    disposeTree(thrownObject);
    thrownObject = null;
  }

  function textTexture(text, { ink = '#f7f6ee', background = null, size = 58, width = 384, height = 128 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (background) {
      context.fillStyle = background;
      context.beginPath();
      context.roundRect(2, 2, width - 4, height - 4, 24);
      context.fill();
    }
    context.font = `600 ${size}px system-ui, "Noto Sans TC", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = ink;
    context.fillText(text, width / 2, height / 2 + 2, width - 24);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  function frontLabel(text, x, y, z, width, height = width / 3, parent = modelGroup) {
    return mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({
      map: textTexture(text, { size: 82, width: 256, height: 112 }), transparent: true, depthWrite: false,
    }), parent, [x, y, z]);
  }
  function sprite(text, position, width = 1.05, parent = environment) {
    const object = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textTexture(text, { ink: '#3d5a4c', background: '#fffdf3cf', size: 44, width: 480, height: 112 }),
      transparent: true, depthTest: false, depthWrite: false,
    }));
    object.scale.set(width * .82, width * .82 * 112 / 480, 1);
    object.position.set(...position);
    object.renderOrder = 5;
    parent.add(object);
    return object;
  }
  function dimension(a, b, label, labelPosition, labelWidth = 1.0) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start).normalize();
    const perpendicular = Math.abs(direction.y) > 0.8 ? new THREE.Vector3(0.065, 0, 0) : new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(0.065);
    const points = [start, end, start.clone().sub(perpendicular), start.clone().add(perpendicular), end.clone().sub(perpendicular), end.clone().add(perpendicular)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: palette.line, transparent: true, opacity: 0.65 }));
    environment.add(line);
    sprite(label, labelPosition, labelWidth);
  }
  function colorsOf(value) {
    if (Array.isArray(value)) return { body: value[0] || '#78847e', recycle: value[1] || '#34795e', accent: value[2] || '#d4ad62' };
    return { body: '#78847e', recycle: '#34795e', accent: '#d4ad62', ...(value || {}) };
  }

  function buildEnvironment(width, depth, sidewalk, height) {
    const streetBack = -depth / 2;
    const frontEdge = streetBack + sidewalk;
    box(9, 0.10, 9, palette.street, environment, [0, -0.15, 0]);
    box(8, 0.10, sidewalk, palette.paving, environment, [0, -0.05, (streetBack + frontEdge) / 2]);
    box(8, 0.13, 0.12, palette.curb, environment, [0, -0.045, streetBack - 0.04]);
    box(8, 0.008, 0.018, 0xc9bea6, environment, [0, 0.006, frontEdge]);
    // Tile joints remain restrained so the bin and actual sidewalk span read first.
    const jointMaterial = new THREE.LineBasicMaterial({ color: 0xc9c5b9, transparent: true, opacity: 0.6 });
    const jointPoints = [];
    for (let x = -4; x <= 4; x += 0.5) jointPoints.push(new THREE.Vector3(x, 0.004, streetBack), new THREE.Vector3(x, 0.004, frontEdge));
    for (let z = streetBack + 0.5; z < frontEdge; z += 0.5) jointPoints.push(new THREE.Vector3(-4, 0.004, z), new THREE.Vector3(4, 0.004, z));
    environment.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(jointPoints), jointMaterial));
    // A recessed shop-front edge indicates the other side of the pavement.
    box(8, 0.08, 0.12, 0xb8b5a9, environment, [0, 0.015, frontEdge + 0.07]);
    box(1.75, 2.65, 0.35, 0xd4d7cd, environment, [-3.35, 1.325, frontEdge + 0.45]);
    box(1.3, 1.7, 0.025, 0xb9c6bb, environment, [-3.35, 1.15, frontEdge + 0.26]);
    box(1.5, 0.08, 0.65, 0x7e9d89, environment, [-3.35, 2.1, frontEdge + 0.08]);
    // Tree beyond the curb, with a planter rather than a hidden pavement obstruction.
    cylinder(0.24, 0.27, 0xa99d85, environment, [2.7, 0.025, streetBack - 0.48]);
    cylinder(0.045, 1.55, 0x9c8b6f, environment, [2.7, 0.88, streetBack - 0.48]);
    for (const [dx, dy, dz, radius] of [[0, 1.92, 0, .54], [-.2, 1.67, .07, .37], [.24, 1.75, -.05, .39]]) {
      mesh(new THREE.IcosahedronGeometry(radius, 1), material(0x809a75, { roughness: 1 }), environment, [2.7 + dx, dy, streetBack - .48 + dz]);
    }
    addScalePerson(Math.max(width / 2 + 0.75, 1.1), clamp(depth / 2 + 0.35, 0.55, frontEdge - 0.12));
    dimension([-width / 2, .035, depth / 2 + .13], [width / 2, .035, depth / 2 + .13], `桶寬 ${Math.round(width * 100)} cm`, [0, .08, depth / 2 + .32], .95);
    dimension([-width / 2 - .22, .04, -depth / 2], [-width / 2 - .22, .04, depth / 2], `深 ${Math.round(depth * 100)} cm`, [-width / 2 - .5, .12, 0], .78);
    dimension([-width / 2 - .16, .02, depth / 2], [-width / 2 - .16, height, depth / 2], `高 ${Math.round(height * 100)} cm`, [-width / 2 - .55, height * .57, depth / 2 + .04], .72);
    const remaining = sidewalk - depth;
    const dimensionX = width / 2 + .42;
    dimension([dimensionX, .04, depth / 2], [dimensionX, .04, frontEdge], `桶前 ${Math.round(remaining * 100)} cm`, [dimensionX + .20, .13, (depth / 2 + frontEdge) / 2], 1.04);
  }

  function addScalePerson(x, z) {
    const group = new THREE.Group();
    environment.add(group);
    group.position.set(x, 0, z);
    const ghost = material(0x9fafa5, { transparent: true, opacity: .28, roughness: 1, depthWrite: false });
    mesh(new THREE.SphereGeometry(.105, 16, 12), ghost, group, [0, 1.58, 0]);
    mesh(new THREE.CapsuleGeometry(.12, .36, 4, 12), ghost, group, [0, 1.15, 0]);
    for (const side of [-1, 1]) {
      const leg = mesh(new THREE.CapsuleGeometry(.055, .62, 4, 10), ghost, group, [side * .085, .43, 0]);
      leg.rotation.z = side * -.035;
      const arm = mesh(new THREE.CapsuleGeometry(.041, .39, 4, 10), ghost, group, [side * .19, 1.09, .015]);
      arm.rotation.z = side * .14;
    }
    sprite('170 cm 比例人形', [x, 1.91, z], .8);
  }

  function addFill(parent, x, radius, openingY, bodyHeight, fillPercent, shape = 'round', depth = radius * 2) {
    const fillHeight = Math.min(openingY - .045, .05 + bodyHeight * fillPercent / 100);
    if (shape === 'round') cylinder(radius * .94, .012, 0x303a33, parent, [x, fillHeight, 0]);
    else box(radius * 1.85, .012, depth * .88, 0x303a33, parent, [x, fillHeight, 0]);
    if (fillPercent < 75) return;
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.39996;
      const spread = radius * (.25 + .06 * (i % 4));
      const rubbish = box(.055 + i % 3 * .012, .025, .07, [0xd8cdb6, 0xa5c4ac, 0xe1ddd1][i % 3], parent,
        [x + Math.cos(angle) * spread, fillHeight + .02, Math.sin(angle) * Math.min(spread, depth * .3)]);
      rubbish.rotation.set(i * .12, angle, .1);
    }
  }

  function roundBin(x, radius, openingY, bodyHeight, openingWidth, color, text, width, linerMode = false) {
    const base = new THREE.Group();
    modelGroup.add(base);
    // A double-sided shell and recessed liner keep the opening visibly hollow.
    cylinder(radius, bodyHeight - .045, color, base, [x, (bodyHeight - .045) / 2 + .025, 0], { openEnded: true });
    cylinder(radius * .94, .04, 0x35413b, base, [x, .04, 0]);
    const aperture = Math.min(openingWidth / 2, radius - .025);
    const lid = new THREE.Group();
    lid.position.set(x, openingY, -radius);
    base.add(lid);
    lidParts.push(lid);
    ring(radius + .008, aperture, color, lid, [0, 0, radius]);
    const lip = mesh(new THREE.TorusGeometry(aperture, .012, 8, 48), material(0xe2e4d9, { metalness: .55, roughness: .3 }), lid, [0, .006, radius]);
    lip.rotation.x = Math.PI / 2;
    cylinder(aperture, .08, 0x34473b, lid, [0, -.045, radius], { openEnded: true });
    const lowerBand = cylinder(radius + .004, .045, 0x384a40, base, [x, .085, 0]);
    lowerBand.castShadow = false;
    frontLabel(text, x, bodyHeight * .57, radius + .008, Math.min(width * .7, .3), .11, base);
    const labelEn = text === '回收' ? 'RECYCLE' : 'GENERAL';
    const en = frontLabel(labelEn, x, bodyHeight * .57 - .08, radius + .012, Math.min(width * .68, .3), .055, base);
    en.material.opacity = .75;
    addFill(base, x, aperture, openingY, bodyHeight, params.fillPercent);
    const liner = new THREE.Group();
    modelGroup.add(liner);
    liner.position.set(x, 0, 0);
    cylinder(radius * .78, bodyHeight * .76, 0xadb4a8, liner, [0, bodyHeight * .38 + .04, 0], { openEnded: true });
    ring(radius * .8, radius * .73, 0xd9dcd0, liner, [0, bodyHeight * .76 + .045, 0]);
    liner.visible = false;
    linerParts.push({ object: liner, startZ: 0, lift: bodyHeight + .075, distance: radius * 2 + .28, reveal: true, topExtract: true });
    if (linerMode) base.userData.liner = liner;
  }

  function buildRoundBins(width, depth, height, opening, colors, withHood) {
    const gap = .055;
    const radius = Math.min((width - gap) / 4, depth / 2) - .008;
    const centers = [-width / 2 + radius + .008, width / 2 - radius - .008];
    const openingY = height * (design.openingRatio || (withHood ? .88 : 1));
    const bodyHeight = openingY;
    centers.forEach((x, i) => roundBin(x, radius, openingY, bodyHeight, opening, i ? colors.recycle : colors.body, i ? '回收' : '一般', radius * 2));
    if (withHood) {
      // Prominent shared rain canopy, open on the pedestrian side.
      for (const x of [-width / 2 + .045, width / 2 - .045]) {
        box(.035, height - .12, .035, 0x3a5146, modelGroup, [x, height / 2 - .02, -depth / 2 + .04]);
      }
      // A rear visor leaves the front of the mouth clear for a narrow-end-first approach.
      const canopyDepth = depth * .45;
      const canopyZ = -depth * .30;
      const canopyHinge = new THREE.Group();
      canopyHinge.position.set(0, height - .035, canopyZ - canopyDepth / 2);
      modelGroup.add(canopyHinge);
      canopyParts.push(canopyHinge);
      const canopy = box(width, .045, canopyDepth, colors.recycle, canopyHinge, [0, 0, canopyDepth / 2], { roughness: .56 });
      canopy.rotation.x = -.065;
      box(width, .065, .035, 0x345f4b, canopyHinge, [0, -.017, canopyDepth]);
      box(width, .08, .025, colors.body, modelGroup, [0, height - .09, -depth / 2 + .0125]);
    }
    mouth.set(centers[0], openingY, 0);
    isFrontOpening = false;
  }

  function frontCabinet({ x, width, depth, height, opening, openingY, openingAspect, color, label, service = false }) {
    const wall = .022;
    const front = depth / 2;
    const apertureWidth = Math.min(opening, width - .075);
    const apertureHeight = apertureWidth * openingAspect;
    const bottomOpening = openingY - apertureHeight / 2;
    const topOpening = openingY + apertureHeight / 2;
    const base = new THREE.Group();
    modelGroup.add(base);
    box(wall, height, depth, color, base, [x - width / 2 + wall / 2, height / 2, 0]);
    box(wall, height, depth, color, base, [x + width / 2 - wall / 2, height / 2, 0]);
    box(width, height, wall, color, base, [x, height / 2, -front + wall / 2]);
    box(width, wall, depth, color, base, [x, height - wall / 2, 0]);
    box(width, .05, depth, 0x3c4e43, base, [x, .04, 0]);
    // Separate front panels leave a real geometric aperture rather than a dark decal.
    const doorHeight = Math.max(.25, bottomOpening - .035);
    let doorX = x;
    if (service || design.id === 'slot') {
      const hinge = new THREE.Group();
      hinge.position.set(x - width / 2 + .012, .065, front - .01);
      modelGroup.add(hinge);
      doorX = width / 2 - .012;
      doorParts.push({ object: hinge, direction: -1 });
      box(width - .024, doorHeight - .065, wall, color, hinge, [doorX, (doorHeight - .065) / 2, 0]);
      box(.022, .12, .022, 0xcbd2c6, hinge, [width - .075, doorHeight * .55, .023], { metalness: .6 });
      frontLabel(label, doorX, doorHeight * .58, .017, Math.min(width * .65, .3), .1, hinge);
      box(width, Math.max(.015, bottomOpening - doorHeight), wall, color, base,
        [x, (bottomOpening + doorHeight) / 2, front - wall / 2]);
    } else {
      box(width, bottomOpening, wall, color, base, [x, bottomOpening / 2, front - wall / 2]);
      frontLabel(label, x, bottomOpening * .58, front + .004, Math.min(width * .65, .34), .12, base);
    }
    box(width, Math.max(.015, height - topOpening), wall, color, base, [x, (height + topOpening) / 2, front - wall / 2]);
    const sideWidth = (width - apertureWidth) / 2;
    for (const sign of [-1, 1]) {
      box(sideWidth, apertureHeight, wall, color, base, [x + sign * (apertureWidth / 2 + sideWidth / 2), openingY, front - wall / 2]);
    }
    // Metal sill and a dark internal chute make the opening legible at a glance.
    box(apertureWidth + .012, .018, .065, 0xaebcb0, base, [x, bottomOpening - .008, front - .012], { metalness: .65 });
    box(apertureWidth, apertureHeight, .006, 0x263a30, base, [x, openingY, front - .13]);
    box(width - .04, .035, depth - .02, 0xd1d5c9, base, [x, height - .0175, 0], { metalness: .4, roughness: .4 });
    const liner = new THREE.Group();
    modelGroup.add(liner);
    liner.position.set(x, 0, 0);
    const linerHeight = Math.min(bottomOpening - .09, height * .65);
    box(width - .085, linerHeight, depth - .09, 0xa6b0a2, liner, [0, linerHeight / 2 + .07, 0]);
    box(width - .11, .014, depth - .115, 0x334438, liner, [0, linerHeight + .078, 0]);
    box((width - .085) * .5, .035, .018, 0xd5dbcf, liner, [0, linerHeight - .02, (depth - .09) / 2 + .012]);
    linerParts.push({ object: liner, startZ: 0, lift: 0, distance: depth + .19, reveal: false });
    addFill(base, x, (width - .06) / 2, openingY, height, params.fillPercent, 'rect', depth - .05);
    if (params.fillPercent >= 80) {
      box(apertureWidth * .5, .025, .06, 0xd0c6ac, base, [x, openingY - apertureHeight * .22, front - .065]);
    }
    return new THREE.Vector3(x, openingY, front + .005);
  }

  function buildCabinets(width, depth, height, opening, colors, service) {
    const openingY = height * (design.openingRatio || .8);
    const aspect = design.openingAspectRatio || (service ? .75 : .6);
    if (service) {
      const gap = .016;
      const eachWidth = (width - gap) / 2;
      [-1, 1].forEach((sign, i) => {
        const center = sign * (eachWidth + gap) / 2;
        const point = frontCabinet({ x: center, width: eachWidth, depth, height, opening, openingY,
          openingAspect: aspect, color: i ? colors.recycle : colors.body, label: i ? '回收' : '一般', service: true });
        if (!i) mouth.copy(point);
      });
      box(width, .035, depth, 0xd4d8cb, modelGroup, [0, height - .0175, 0]);
    } else {
      mouth.copy(frontCabinet({ x: 0, width, depth, height, opening, openingY, openingAspect: aspect, color: colors.body, label: '一般垃圾' }));
      box(.055, height - .07, .012, colors.recycle, modelGroup, [-width / 2 + .055, height / 2, depth / 2 + .008]);
      frontLabel('街頭小型廢棄物', 0, height * .36, depth / 2 + .006, width * .7, .06);
    }
    isFrontOpening = true;
  }

  function applyService(progress) {
    serviceProgress = progress;
    const lidProgress = clamp(progress / .3, 0, 1);
    for (const lid of lidParts) lid.rotation.x = -lidProgress * Math.PI * .58;
    for (const canopy of canopyParts) canopy.rotation.x = -clamp(progress / .23, 0, 1) * Math.PI * .57;
    for (const part of doorParts) part.object.rotation.y = part.direction * clamp(progress / .42, 0, 1) * Math.PI * .56;
    const linerProgress = clamp((progress - .3) / .7, 0, 1);
    for (const part of linerParts) {
      if (part.reveal) part.object.visible = progress > .03;
      if (part.topExtract) {
        const lift = clamp((progress - .26) / .29, 0, 1);
        const forward = clamp((progress - .55) / .21, 0, 1);
        const lower = clamp((progress - .76) / .24, 0, 1);
        part.object.position.z = part.startZ + part.distance * forward;
        part.object.position.y = part.lift * lift * (1 - lower);
      } else {
        part.object.position.z = part.startZ + part.distance * linerProgress;
        part.object.position.y = 0;
      }
    }
  }

  function update(nextDesign, nextParams) {
    if (disposed) return;
    design = nextDesign;
    params = { heightCm: 110, openingCm: 22, sidewalkCm: 200, fillPercent: 30, ...nextParams };
    runningAction = null;
    removeThrown();
    disposeTree(modelGroup);
    disposeTree(environment);
    doorParts = [];
    linerParts = [];
    lidParts = [];
    canopyParts = [];
    const width = metres(design.widthCm, 100);
    const depth = metres(design.depthCm, 48);
    const height = metres(params.heightCm, 110);
    const opening = metres(params.openingCm, 22);
    const sidewalk = metres(params.sidewalkCm, 200);
    const colors = colorsOf(design.colors);
    buildEnvironment(width, depth, sidewalk, height);
    if (design.id === 'pair' || design.id === 'hood') buildRoundBins(width, depth, height, opening, colors, design.id === 'hood');
    else buildCabinets(width, depth, height, opening, colors, design.id === 'service');
    serviceOpen = false;
    applyService(0);
    if (!camera.position.length()) setView(currentView, true);
    requestRender();
  }

  function preset(view) {
    const narrow = (container.clientWidth || 600) < 550;
    const height = metres(params?.heightCm, 110);
    const scale = narrow ? 1.19 : 1;
    const presets = {
      overview: { position: [2.85 * scale, 2.25 * scale, 3.8 * scale], target: [0, height * .5, .38] },
      pedestrian: { position: [.95 * scale, 1.62, 3.05 * scale], target: [0, Math.min(height * .78, 1.1), .03] },
      wheelchair: { position: [.8 * scale, 1.1, 2.7 * scale], target: [0, height * .68, .03] },
      worker: { position: [-2.0 * scale, 1.7, 3.1 * scale], target: [0, height * .46, .25] },
    };
    return presets[view] || presets.overview;
  }
  function setView(view, instant = false) {
    if (disposed) return;
    currentView = view;
    const next = preset(view);
    const position = new THREE.Vector3(...next.position);
    const target = new THREE.Vector3(...next.target);
    if (reducedMotion || instant || !camera.position.length()) {
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
      cameraAction = null;
    } else {
      cameraAction = { start: performance.now(), from: camera.position.clone(), targetFrom: controls.target.clone(), to: position, targetTo: target, duration: 550 };
    }
    requestRender();
  }

  function makeItem(item) {
    const group = new THREE.Group();
    const width = metres(item.widthCm || item.crossSection?.widthCm, item.id === 'bag' ? 28 : item.id === 'bottle' ? 7 : 9);
    const height = metres(item.heightCm, item.id === 'bag' ? 32 : item.id === 'bottle' ? 23 : 14);
    if (item.id === 'bottle') {
      mesh(new THREE.CylinderGeometry(width * .38, width * .48, height * .68, 20), material(0xa7d0cd, { metalness: .05, roughness: .25 }), group, [0, height * .02, 0]);
      cylinder(width * .23, height * .16, 0x84bdb0, group, [0, height * .43, 0]);
      cylinder(width * .26, height * .065, 0x397461, group, [0, height * .54, 0]);
      cylinder(width * .485, height * .17, 0xf2eee0, group, [0, -.01, 0]);
    } else if (item.id === 'bag') {
      const bag = mesh(new THREE.SphereGeometry(.5, 20, 14), material(0x48524b, { roughness: .88 }), group, [0, 0, 0]);
      bag.scale.set(width, height * .85, width * .88);
      mesh(new THREE.ConeGeometry(width * .13, height * .15, 10), material(0x3c483f), group, [0, height * .45, 0]);
      const knot = mesh(new THREE.TorusGeometry(width * .075, width * .025, 6, 12), material(0x465449), group, [0, height * .52, 0]);
      knot.rotation.y = .5;
    } else {
      mesh(new THREE.CylinderGeometry(width * .47, width * .33, height * .82, 24), material(0xeee8d7), group, [0, 0, 0]);
      cylinder(width * .5, height * .06, 0x9b7051, group, [0, height * .44, 0]);
      cylinder(width * .43, height * .32, 0xb68664, group, [0, -.003, 0]);
    }
    return group;
  }

  function throwItem(item, allowed) {
    if (disposed || !design) return;
    runningAction = null;
    removeThrown();
    if (serviceProgress > 0) { serviceOpen = false; applyService(0); }
    thrownObject = makeItem(item);
    scene.add(thrownObject);
    const object = thrownObject;
    // Front openings accept the narrow end first, matching the model's simplified clearance test.
    const itemHeight = metres(item.heightCm, item.id === 'bottle' ? 23 : item.id === 'bag' ? 32 : 14);
    const isHood = design.id === 'hood';
    if (isFrontOpening) object.rotation.x = Math.PI / 2;
    else if (isHood) object.rotation.x = Math.PI * .34;
    const start = mouth.clone().add(new THREE.Vector3(-.38, isHood ? .015 : .5, 1.0));
    const hoodOffset = clamp(metres(params.openingCm, 22) / 2 - metres(item.widthCm, 9) / 2 - .005, 0, .06);
    const hit = mouth.clone().add(new THREE.Vector3(0, isFrontOpening ? 0 : isHood ? .015 : .09,
      isFrontOpening ? itemHeight / 2 : isHood ? hoodOffset : 0));
    const end = allowed
      ? mouth.clone().add(new THREE.Vector3(0, isFrontOpening ? -.08 : -.33, isFrontOpening ? -.3 : 0))
      : mouth.clone().add(new THREE.Vector3(.23, -mouth.y + itemHeight * .47 + .025, .62));
    object.position.copy(start);
    const duration = reducedMotion ? 0 : 1150;
    const stamp = ++actionStamp;
    const finish = () => {
      if (allowed) removeThrown();
      else if (thrownObject === object) { object.position.copy(end); object.rotation.set(.45, .25, -.4); }
      onStatus(allowed ? '已完成簡化投放示意。' : '已完成開口受限示意。');
    };
    if (!duration) { finish(); requestRender(); return; }
    runningAction = {
      start: performance.now(), duration,
      step(t) {
        if (stamp !== actionStamp || object !== thrownObject) return;
        if (t < .55) {
          const progress = ease(t / .55);
          object.position.lerpVectors(start, hit, progress);
          object.position.y += Math.sin(progress * Math.PI) * .12;
        } else {
          const progress = (t - .55) / .45;
          object.position.lerpVectors(hit, end, progress);
          if (!allowed) { object.position.y += Math.sin(progress * Math.PI) * .25; object.rotation.z = progress * -.4; }
          else {
            if (isHood) object.rotation.x = Math.PI * .34 * (1 - progress);
            object.scale.setScalar(1 - Math.max(0, progress - .75) * 1.8);
          }
        }
      },
      finish,
    };
    requestRender();
  }

  function toggleService() {
    if (disposed || !design) return;
    runningAction = null;
    removeThrown();
    serviceOpen = !serviceOpen;
    const from = serviceProgress;
    const to = serviceOpen ? 1 : 0;
    const finish = () => { applyService(to); onStatus(serviceOpen ? '清運示意：內桶已拉出。' : '清運示意：內桶已收回。'); };
    if (reducedMotion) { finish(); requestRender(); return serviceOpen; }
    runningAction = { start: performance.now(), duration: lidParts.length ? 1600 : 1050,
      step: t => applyService(THREE.MathUtils.lerp(from, to, lidParts.length ? t : ease(t))), finish };
    requestRender();
    return serviceOpen;
  }

  function render(now = performance.now()) {
    frame = 0;
    if (disposed || !active || document.hidden || !container.clientWidth || !container.clientHeight) return;
    let moving = controls.update();
    if (cameraAction) {
      const t = Math.min(1, (now - cameraAction.start) / cameraAction.duration);
      camera.position.lerpVectors(cameraAction.from, cameraAction.to, ease(t));
      controls.target.lerpVectors(cameraAction.targetFrom, cameraAction.targetTo, ease(t));
      camera.lookAt(controls.target);
      moving = true;
      if (t >= 1) cameraAction = null;
    }
    if (runningAction) {
      const action = runningAction;
      const t = Math.min(1, (now - action.start) / action.duration);
      action.step(t);
      moving = true;
      if (t >= 1 && runningAction === action) { runningAction = null; action.finish(); }
    }
    renderer.render(scene, camera);
    if (moving && !frame) frame = requestAnimationFrame(render);
  }
  function requestRender() {
    if (!disposed && active && !document.hidden && !frame) frame = requestAnimationFrame(render);
  }
  function resize() {
    if (disposed) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  }
  function setActive(value) {
    active = !!value;
    controls.enabled = active;
    if (!active && frame) { cancelAnimationFrame(frame); frame = 0; }
    if (active) { resize(); requestRender(); }
  }
  function visibilityChange() {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    if (!document.hidden) requestRender();
  }
  function motionChange(event) {
    reducedMotion = event.matches;
    if (reducedMotion) {
      if (runningAction) { const action = runningAction; runningAction = null; action.step(1); action.finish(); }
      if (cameraAction) { camera.position.copy(cameraAction.to); controls.target.copy(cameraAction.targetTo); cameraAction = null; }
      requestRender();
    }
  }
  function contextLost(event) {
    event.preventDefault();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    onStatus('3D 顯示暫停，請重新載入；文字尺寸與設計比較仍可使用。');
  }
  function keyboardView(event) {
    if (!active || disposed) return;
    const supported = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'Home'];
    if (!supported.includes(event.key)) return;
    event.preventDefault();
    cameraAction = null;
    if (event.key === 'Home') { setView('overview'); return; }
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= .12;
    if (event.key === 'ArrowRight') spherical.theta += .12;
    if (event.key === 'ArrowUp') spherical.phi -= .09;
    if (event.key === 'ArrowDown') spherical.phi += .09;
    if (event.key === '+' || event.key === '=') spherical.radius *= .9;
    if (event.key === '-' || event.key === '_') spherical.radius *= 1.1;
    spherical.radius = clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    spherical.phi = clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
    requestRender();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  controls.addEventListener('change', requestRender);
  controls.addEventListener('start', () => { cameraAction = null; });
  document.addEventListener('visibilitychange', visibilityChange);
  motion.addEventListener('change', motionChange);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  renderer.domElement.addEventListener('keydown', keyboardView);
  setView('overview', true);
  resize();

  return {
    update,
    setView,
    throwItem,
    toggleService,
    resetView() { setView('overview'); },
    setActive,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      motion.removeEventListener('change', motionChange);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('keydown', keyboardView);
      controls.dispose();
      removeThrown();
      disposeTree(modelGroup);
      disposeTree(environment);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
