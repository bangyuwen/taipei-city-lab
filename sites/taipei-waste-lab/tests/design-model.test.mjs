import test from 'node:test';
import assert from 'node:assert/strict';
import {
  designs, defaultParameters, getDesign, normalizeParameters, items,
  evaluateItem, getReadout,
} from '../dist/design-model.js';

test('invalid controls fall back to finite defaults without mutating supplied values', () => {
  const input = {heightCm: NaN, openingCm: Infinity, sidewalkCm: '', fillPercent: null};
  assert.deepEqual(normalizeParameters('pair', input), defaultParameters);
  assert.equal(input.openingCm, Infinity);
  assert.deepEqual(normalizeParameters('pair', null), defaultParameters);
  assert.deepEqual(normalizeParameters('pair', {heightCm: true}), defaultParameters);
  assert.deepEqual(normalizeParameters('pair', {heightCm: '120', fillPercent: '60'}), {
    ...defaultParameters, heightCm: 120, fillPercent: 60,
  });
});

test('all controls clamp to bounds and changing design narrows the opening limit', () => {
  assert.deepEqual(normalizeParameters('pair', {
    heightCm: 999, openingCm: 999, sidewalkCm: -10, fillPercent: -1,
  }), {heightCm: 130, openingCm: 36, sidewalkCm: 120, fillPercent: 0});
  const wide = normalizeParameters('pair', {openingCm: 36});
  assert.equal(normalizeParameters('slot', wide).openingCm, 18);
  assert.equal(normalizeParameters('hood', wide).openingCm, 32);
  assert.equal(normalizeParameters('service', wide).openingCm, 30);
  assert.deepEqual(normalizeParameters('pair', {
    heightCm: 0, openingCm: 0, sidewalkCm: 999, fillPercent: 999,
  }), {heightCm: 85, openingCm: 8, sidewalkCm: 320, fillPercent: 100});
  assert.equal(getDesign('missing').id, 'pair');
  assert.equal(getDesign().id, 'pair');
});

test('default openings admit the sample cup and bottle across all concepts', () => {
  for (const design of designs) {
    assert.equal(evaluateItem(design, {}, 'cup').allowed, true, design.id);
    assert.equal(evaluateItem(design, {}, items.find((item) => item.id === 'bottle')).allowed, true, design.id);
    assert.equal(evaluateItem(design, {}, 'bag').allowed, false, design.id);
  }
});

test('wide round opening can admit the selected bag while a narrow slot cannot', () => {
  assert.equal(evaluateItem('pair', {openingCm: 28}, 'bag').allowed, true);
  assert.equal(evaluateItem('pair', {openingCm: 27.9}, 'bag').allowed, false);
  assert.equal(evaluateItem('slot', {openingCm: 36}, 'bag').allowed, false);
  // The rectangular opening is tall enough for a cup, but too short for the bag.
  assert.equal(evaluateItem('service', {openingCm: 30}, 'bag').allowed, false);
});

test('front opening checks both dimensions while a round opening uses diameter', () => {
  assert.equal(evaluateItem('pair', {openingCm: 8}, 'bottle').allowed, true);
  assert.equal(evaluateItem('slot', {openingCm: 8}, 'bottle').allowed, false);
  assert.equal(evaluateItem('slot', {openingCm: 15}, 'cup').allowed, true);
  assert.equal(evaluateItem('slot', {openingCm: 14.9}, 'cup').allowed, false);
});

test('a filled bin and unknown sample never report a successful trial', () => {
  assert.equal(evaluateItem('pair', {fillPercent: 100}, 'cup').allowed, false);
  assert.match(evaluateItem('pair', {fillPercent: 100}, 'cup').reason, /填滿/);
  assert.equal(evaluateItem('pair', {fillPercent: 99}, 'cup').allowed, true);
  assert.equal(evaluateItem('pair', {}, 'unknown').allowed, false);
});

test('sidewalk readout subtracts curb-side depth rather than the full along-street width', () => {
  const readout = getReadout('pair', {sidewalkCm: 200, heightCm: 120});
  assert.equal(readout.remainingWidthCm, 152);
  assert.equal(readout.openingHeightCm, 120);
  assert.equal(getReadout('pair', {sidewalkCm: 240}).remainingWidthCm, 192);
  assert.equal(getReadout('slot', {sidewalkCm: 200}).remainingWidthCm, 156);
  assert.equal(getReadout('service', {sidewalkCm: 200}).remainingWidthCm, 148);
  assert.equal(getReadout('hood', {heightCm: 120}).openingHeightCm, 105.6);
  assert.match(readout.notes.join(' '), /未計退縮與開門空間/);
  assert.match(readout.notes.join(' '), /未經工程、無障礙或防濫倒效果驗證/);
});

test('fill readout describes the chosen visual state rather than a predicted collection rate', () => {
  assert.equal(getReadout('pair', {fillPercent: 0}).fillLabel, '空桶');
  assert.equal(getReadout('pair', {fillPercent: 30}).fillLabel, '尚有空間');
  assert.equal(getReadout('pair', {fillPercent: 60}).fillLabel, '逐漸填滿');
  assert.equal(getReadout('pair', {fillPercent: 80}).fillLabel, '接近填滿');
  assert.equal(getReadout('pair', {fillPercent: 100}).fillLabel, '已填滿');
});
