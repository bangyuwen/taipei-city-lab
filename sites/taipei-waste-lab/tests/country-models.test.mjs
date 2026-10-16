import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three/three.module.js';
import { COUNTRY_MODELS } from '../dist/country-model-data.js';
import { buildCountryModel } from '../dist/country-models.js';
import { highlightCountryPart } from '../dist/country-scene.js';

const countryIds = [
  'japan',
  'uk',
  'denmark',
  'us',
  'finland',
  'korea',
  'france',
  'netherlands',
  'singapore',
  'india',
  'australia',
  'south-africa',
];

test('country metadata is pure, complete fallback content for all twelve cases', () => {
  assert.deepEqual(Object.keys(COUNTRY_MODELS), countryIds);
  for (const id of countryIds) {
    const metadata = COUNTRY_MODELS[id];
    assert.equal(typeof metadata.title, 'string');
    assert.ok(metadata.title.length > 0);
    assert.equal(typeof metadata.description, 'string');
    assert.ok(metadata.description.length > 0);
    assert.equal(typeof metadata.limitation, 'string');
    assert.ok(metadata.limitation.length > 0);
    assert.equal(metadata.features.length, 3);
    assert.ok(metadata.features.every((feature) => typeof feature === 'string' && feature.length > 0));
    assert.equal(typeof metadata.playLabel, 'string');
    assert.ok(metadata.playLabel.length > 0);
    assert.equal(typeof metadata.playDescription, 'string');
    assert.ok(metadata.playDescription.length > 0);
    assert.ok(metadata.playDescription.length <= 45, id + ' play description should stay concise');
  }
});

test('each country model has finite nonempty geometry on a bounded y-up footprint', () => {
  for (const id of countryIds) {
    const model = buildCountryModel(id);
    model.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    assert.equal(bounds.isEmpty(), false, id + ' should have geometry');
    assert.ok(Math.abs(bounds.min.y) < 1e-5, id + ' should meet the y=0 floor');
    for (const [axis, value] of Object.entries({x: size.x, y: size.y, z: size.z})) {
      assert.ok(Number.isFinite(value) && value > 0 && value <= 4, id + ' has invalid ' + axis + ' bounds: ' + value);
    }

    let meshCount = 0;
    model.traverse((object) => {
      assert.ok(object.position.toArray().every(Number.isFinite), id + ' has a non-finite position');
      if (!object.isMesh) return;
      meshCount += 1;
      const positions = object.geometry?.attributes?.position;
      assert.ok(positions && positions.count > 0, id + ' contains an empty mesh');
      for (const coordinate of positions.array) {
        assert.ok(Number.isFinite(coordinate), id + ' contains a non-finite vertex');
      }
    });
    assert.ok(meshCount > 0, id + ' should contain meshes');
  }
});


test('each country action is finite, seekable, and resets to its exact rest pose', () => {
  const capturePose = (model) => {
    const pose = [];
    model.traverse((object) => {
      pose.push({
        name: object.name,
        position: object.position.toArray(),
        rotation: object.rotation.toArray(),
        scale: object.scale.toArray(),
        visible: object.visible,
      });
    });
    return pose;
  };

  for (const id of countryIds) {
    const model = buildCountryModel(id);
    const play = model.userData?.play;
    assert.equal(typeof play?.duration, 'number', id + ' should define an action duration');
    assert.ok(play.duration >= 3 && play.duration <= 4, id + ' should use a readable 3–4 second action duration');
    assert.equal(typeof play.update, 'function', id + ' should support normalized seeking');
    assert.equal(typeof play.reset, 'function', id + ' should support reset');

    play.reset();
    const restPose = capturePose(model);
    assert.deepEqual(restPose, capturePose(buildCountryModel(id)), id + ' reset should match a fresh rest pose');

    play.update(0.46);
    const midPose = capturePose(model);
    assert.notDeepEqual(midPose, restPose, id + ' should visibly change during its action');
    play.update(0.08);
    play.update(0.46);
    assert.deepEqual(capturePose(model), midPose, id + ' seeking should be deterministic');

    for (const progress of [0, 0.12, 0.35, 0.68, 0.9, 1]) {
      play.update(progress);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      assert.equal(bounds.isEmpty(), false, id + ' should retain finite geometry at ' + progress);
      assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite), id + ' has invalid bounds at ' + progress);
      model.traverse((object) => {
        assert.ok(object.position.toArray().every(Number.isFinite), id + ' has a non-finite position at ' + progress);
        assert.ok(object.rotation.toArray().slice(0, 3).every(Number.isFinite), id + ' has a non-finite rotation at ' + progress);
        assert.ok(object.scale.toArray().every(Number.isFinite), id + ' has a non-finite scale at ' + progress);
      });
    }

    play.update(1);
    model.traverse((object) => {
      if (object.name.startsWith('play-item-')) {
        assert.equal(object.visible, false, id + ' should finish with its illustrative item hidden');
      }
    });
    play.reset();
    assert.deepEqual(capturePose(model), restPose, id + ' reset should restore every local transform and visibility');
  }
});


test('each country exposes one to three illustrated parts with deterministic resettable actions', () => {
  const capturePose = (model) => {
    const pose = [];
    model.traverse((object) => {
      pose.push({
        name: object.name,
        position: object.position.toArray(),
        rotation: object.rotation.toArray(),
        scale: object.scale.toArray(),
        visible: object.visible,
      });
    });
    return pose;
  };

  for (const id of countryIds) {
    const model = buildCountryModel(id);
    const parts = model.userData?.parts;
    const actions = model.userData?.partActions;
    assert.ok(Array.isArray(parts) && parts.length >= 1 && parts.length <= 3, id + ' should expose one to three parts');
    assert.equal(Object.keys(actions || {}).length, parts.length, id + ' should define one action per part');
    const restPose = capturePose(model);

    for (const part of parts) {
      assert.equal(typeof part.id, 'string');
      assert.ok(part.id.length > 0);
      assert.equal(typeof part.label, 'string');
      assert.ok(part.label.length > 0);
      assert.equal(typeof part.description, 'string');
      assert.ok(part.description.length > 0);
      assert.equal(typeof actions[part.id]?.update, 'function', id + ' ' + part.id + ' should be seekable');
      assert.equal(typeof actions[part.id]?.reset, 'function', id + ' ' + part.id + ' should reset');
      assert.ok(actions[part.id].duration >= 3 && actions[part.id].duration <= 4);

      let hasRaycastTarget = false;
      model.traverse((object) => {
        if (object.userData?.countryPartId === part.id) hasRaycastTarget = true;
      });
      assert.equal(hasRaycastTarget, true, id + ' ' + part.id + ' should map to a named raycast target');

      const action = actions[part.id];
      action.reset();
      assert.deepEqual(capturePose(model), restPose, id + ' ' + part.id + ' reset should restore its rest pose');
      action.update(0.46);
      const midPose = capturePose(model);
      assert.notDeepEqual(midPose, restPose, id + ' ' + part.id + ' should visibly move a component or illustrative item');
      action.update(0.08);
      action.update(0.46);
      assert.deepEqual(capturePose(model), midPose, id + ' ' + part.id + ' seeking should be deterministic');

      for (const progress of [0, 0.12, 0.35, 0.68, 0.9, 1]) {
        action.update(progress);
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model);
        assert.equal(bounds.isEmpty(), false, id + ' ' + part.id + ' should retain geometry at ' + progress);
        assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite), id + ' ' + part.id + ' has invalid bounds');
        model.traverse((object) => {
          assert.ok(object.position.toArray().every(Number.isFinite), id + ' ' + part.id + ' has non-finite position');
          assert.ok(object.rotation.toArray().slice(0, 3).every(Number.isFinite), id + ' ' + part.id + ' has non-finite rotation');
          assert.ok(object.scale.toArray().every(Number.isFinite), id + ' ' + part.id + ' has non-finite scale');
        });
      }
      action.reset();
      assert.deepEqual(capturePose(model), restPose, id + ' ' + part.id + ' should reset after seeking');
    }
  }
});

test('unknown country ids are rejected', () => {
  assert.throws(() => buildCountryModel('missing'), RangeError);
  assert.throws(() => buildCountryModel(undefined), RangeError);
});


test('selected part highlighting isolates material clones and restores shared originals', () => {
  const captureMaterials = (model) => {
    const materials = new Map();
    model.traverse((object) => {
      if (object.isMesh) materials.set(object, object.material);
    });
    return materials;
  };

  for (const id of countryIds) {
    const model = buildCountryModel(id);
    for (const part of model.userData.parts) {
      const roots = [];
      model.traverse((object) => {
        if (object.userData?.countryPartId === part.id) roots.push(object);
      });
      const highlightedMeshes = new Set();
      const collect = (node, root) => {
        if (node !== root && node.userData?.countryPartId && node.userData.countryPartId !== part.id) return;
        if (node.isMesh) highlightedMeshes.add(node);
        for (const child of node.children) collect(child, root);
      };
      for (const root of roots) collect(root, root);
      assert.ok(highlightedMeshes.size > 0, id + ' ' + part.id + ' should highlight its visible model meshes');

      const originals = captureMaterials(model);
      const sourceAppearance = new Map();
      for (const materialValue of originals.values()) {
        for (const material of Array.isArray(materialValue) ? materialValue : [materialValue]) {
          if (material && !sourceAppearance.has(material)) {
            sourceAppearance.set(material, {
              color: material.color?.toArray(),
              emissive: material.emissive?.toArray(),
              emissiveIntensity: material.emissiveIntensity,
            });
          }
        }
      }

      const clearHighlight = highlightCountryPart(model, part.id);
      for (const [mesh, originalValue] of originals) {
        if (!highlightedMeshes.has(mesh)) {
          assert.strictEqual(mesh.material, originalValue, id + ' ' + part.id + ' must not recolor unrelated meshes');
          continue;
        }
        const original = Array.isArray(originalValue) ? originalValue : [originalValue];
        const highlighted = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        assert.equal(highlighted.length, original.length);
        for (let index = 0; index < original.length; index += 1) {
          assert.notStrictEqual(highlighted[index], original[index], id + ' ' + part.id + ' should use isolated material clones');
        }
      }
      for (const [material, appearance] of sourceAppearance) {
        assert.deepEqual(material.color?.toArray(), appearance.color, id + ' ' + part.id + ' must preserve shared source color');
        assert.deepEqual(material.emissive?.toArray(), appearance.emissive, id + ' ' + part.id + ' must preserve shared source emissive');
        assert.equal(material.emissiveIntensity, appearance.emissiveIntensity, id + ' ' + part.id + ' must preserve shared source intensity');
      }

      clearHighlight();
      for (const [mesh, originalValue] of originals) {
        assert.strictEqual(mesh.material, originalValue, id + ' ' + part.id + ' should restore material identity');
      }
      clearHighlight();
    }
  }
});
