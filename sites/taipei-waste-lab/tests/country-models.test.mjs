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

test('unknown country ids are rejected', () => {
  assert.throws(() => buildCountryModel('missing'), RangeError);
  assert.throws(() => buildCountryModel(undefined), RangeError);
});
