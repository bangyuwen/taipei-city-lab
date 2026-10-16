import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three/three.module.js';
import { COUNTRY_MODELS } from '../dist/country-model-data.js';
import { buildCountryModel } from '../dist/country-models.js';

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

test('unknown country ids are rejected', () => {
  assert.throws(() => buildCountryModel('missing'), RangeError);
  assert.throws(() => buildCountryModel(undefined), RangeError);
});
