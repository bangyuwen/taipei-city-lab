import test from 'node:test';
import assert from 'node:assert/strict';
import { buildings } from '../dist/modules/buildings.js';

const rows = result => result.table.rows;
const assigned = result => rows(result).filter(row => row.allocation === '已安排');
const metric = (result, label) => result.metrics.find(item => item.label === label).value;

function assertFinite(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(assertFinite);
  else if (value && typeof value === 'object') Object.values(value).forEach(assertFinite);
}

function brute(items, capacity, start = 0) {
  let best = 0;
  for (let index = start; index < items.length; index += 1) {
    const item = items[index];
    if (item.hours <= capacity) {
      best = Math.max(best, item.score + brute(items, capacity - item.hours, index + 1));
    }
  }
  return best;
}

test('buildings scenarios are deterministic and state the source grain and simulated location', () => {
  const result = buildings.evaluate();
  assert.deepEqual(result, buildings.evaluate(buildings.defaults));
  assert.deepEqual(result, buildings.evaluate(null, {}));
  assert.equal(rows(result).length, 24);
  assert.match(result.assumptions.join(' '), /全市總計/);
  assert.match(result.assumptions.join(' '), /未滿 30 年與 30 年以上/);
  assert.match(result.explanation, /不能推論耐震能力/);
  assert.ok(result.map.points.every(point => point.label.includes('虛構')));
});

test('buildings chart, table, map and metrics share the exact same resource allocation', () => {
  for (const budget of [0, 4, 12, 48, 100, 160]) {
    const result = buildings.evaluate({ budget });
    const selected = assigned(result);
    const hours = selected.reduce((sum, item) => sum + item.hours, 0);
    const score = selected.reduce((sum, item) => sum + item.score, 0);
    const missing = selected.reduce((sum, item) => sum + item.missing.length, 0);
    assert.ok(hours <= budget);
    assert.equal(hours, metric(result, '使用訪查工時'));
    assert.equal(score, metric(result, '納入訪查需求總分'));
    assert.equal(missing, metric(result, '需補齊的查勘資料'));
    assert.equal(selected.length, result.map.points.filter(point => point.selected).length);
    assert.equal(result.chart.series[0].values[1], score);
    assert.ok(metric(result, '較同預算編號訪查多納入') >= 0);
    assertFinite(result);
  }
});

test('small-budget buildings solution matches an independently enumerated optimum', () => {
  for (const purpose of ['disaster', 'liquefaction', 'rescue', 'elderly', 'documents', 'maintenance', 'accessibility']) {
    const result = buildings.evaluate({ budget: 12, purpose });
    assert.equal(metric(result, '納入訪查需求總分'), brute(rows(result), 12));
  }
});

test('disaster preparation combines explicitly synthetic soil, rescue and elderly clues', () => {
  const result = buildings.evaluate();
  assert.equal(buildings.defaults.purpose, 'disaster');
  assert.equal(buildings.title, '先健檢哪裡？');
  for (const source of ['soil', 'fire', 'population']) assert.ok(result.sources.includes(source));
  assert.match(result.assumptions.join(' '), /未使用其觀測值/);
  assert.match(result.assumptions.join(' '), /不是官方液化分級/);
  assert.match(result.assumptions.join(' '), /專業結構健檢/);
  for (const row of rows(result)) {
    assert.match(row.disasterClues, /液化潛勢.*救援通道受限.*高齡住戶需求/);
    for (const key of ['liquefaction', 'rescue', 'elderly']) {
      assert.ok(row[key] === null || (row[key] >= 1 && row[key] <= 5));
      if (row[key] === null) assert.ok(row.missing.includes(key));
    }
  }
});

test('disaster weighting scenarios actually change ranking and resource recipients', () => {
  const scenarios = ['liquefaction', 'rescue', 'elderly'].map(purpose =>
    buildings.evaluate({ ...buildings.defaults, purpose, ageWeight: 0, gapWeight: 0 }));
  const ranking = result => rows(result).map(row => row.id);
  const recipients = result => assigned(result).map(row => row.id).sort();
  assert.notDeepEqual(ranking(scenarios[0]), ranking(scenarios[1]));
  assert.notDeepEqual(ranking(scenarios[1]), ranking(scenarios[2]));
  assert.notDeepEqual(recipients(scenarios[0]), recipients(scenarios[1]));
  assert.notDeepEqual(recipients(scenarios[1]), recipients(scenarios[2]));
});

test('buildings intervention purpose changes priorities and visits', () => {
  const maintenance = buildings.evaluate({ ...buildings.defaults, purpose: 'maintenance' });
  const accessibility = buildings.evaluate({ ...buildings.defaults, purpose: 'accessibility' });
  assert.notDeepEqual(rows(maintenance).map(row => row.id), rows(accessibility).map(row => row.id));
  assert.notDeepEqual(assigned(maintenance).map(row => row.id), assigned(accessibility).map(row => row.id));
  assert.notEqual(assigned(maintenance)[0].action, assigned(accessibility)[0].action);
});

test('buildings gap sensitivity changes document assistance priorities', () => {
  const zero = buildings.evaluate({ ...buildings.defaults, ageWeight: 0, gapWeight: 0 });
  const high = buildings.evaluate({ ...buildings.defaults, ageWeight: 0, gapWeight: 60 });
  assert.notDeepEqual(rows(zero).map(row => row.id), rows(high).map(row => row.id));
  const selectedGaps = result => assigned(result).reduce((sum, row) => sum + row.missing.length, 0);
  assert.ok(selectedGaps(high) > selectedGaps(zero));
});

test('buildings empty budget and extreme controls produce finite bounded results', () => {
  const zero = buildings.evaluate({ budget: 0 });
  assert.equal(metric(zero, '使用訪查工時'), 0);
  assert.equal(metric(zero, '安排社區訪查'), 0);
  const result = buildings.evaluate({ budget: Infinity, purpose: '__proto__', ageWeight: 1000, gapWeight: 1000 });
  assertFinite(result);
  assert.ok(rows(result).every(row => row.score >= 0 && row.score <= 100));
  assert.ok(metric(result, '使用訪查工時') <= 160);
  assert.ok(rows(result).some(row => row.age === null && row.missing.includes('age')));
});

test('buildings larger budgets cannot reduce a fixed-weight objective', () => {
  const scores = [0, 8, 20, 48, 100, 160].map(budget => metric(buildings.evaluate({ budget }), '納入訪查需求總分'));
  scores.slice(1).forEach((score, index) => assert.ok(score >= scores[index]));
});
