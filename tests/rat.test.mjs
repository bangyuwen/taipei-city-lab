import test from 'node:test';
import assert from 'node:assert/strict';
import { rat } from '../sites/taipei-city-lab/dist/modules/rat.js';

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

test('rat scenario is reproducible and empty input uses a disclosed synthetic scenario', () => {
  assert.deepEqual(rat.evaluate(), rat.evaluate(rat.defaults));
  assert.deepEqual(rat.evaluate(null, null), rat.evaluate());
  assert.equal(rows(rat.evaluate()).length, 24);
  assert.match(rat.evaluate().assumptions.join(' '), /缺少地址或座標/);
  assert.ok(rat.evaluate().map.points.every(point => point.label.includes('虛構')));
});

test('rat resource totals, map selections and comparison chart describe the same allocation', () => {
  for (const budget of [0, 4, 12, 48, 80, 160]) {
    const result = rat.evaluate({ ...rat.defaults, budget });
    const selected = assigned(result);
    const hours = selected.reduce((sum, item) => sum + item.hours, 0);
    const score = selected.reduce((sum, item) => sum + item.score, 0);
    assert.ok(hours <= budget);
    assert.equal(hours, metric(result, '使用巡查工時'));
    assert.equal(score, metric(result, '納入查核線索總分'));
    assert.equal(selected.length, metric(result, '安排查核街廓'));
    assert.equal(selected.length, result.map.points.filter(point => point.selected).length);
    assert.equal(result.chart.series[0].values[1], score);
    assert.ok(metric(result, '較同預算編號輪巡多納入') >= 0);
    assertFinite(result);
  }
});

test('small-budget rat allocation achieves the independently enumerated best score', () => {
  for (const focus of ['balanced', 'sanitation', 'drainage']) {
    const result = rat.evaluate({ budget: 12, focus });
    assert.equal(metric(result, '納入查核線索總分'), brute(rows(result), 12));
  }
});

test('rat focus and reporting sensitivity change rankings and assigned resources', () => {
  const sanitation = rat.evaluate({ ...rat.defaults, focus: 'sanitation' });
  const drainage = rat.evaluate({ ...rat.defaults, focus: 'drainage' });
  assert.notDeepEqual(rows(sanitation).map(row => row.id), rows(drainage).map(row => row.id));
  assert.notDeepEqual(assigned(sanitation).map(row => row.id), assigned(drainage).map(row => row.id));
  assert.notEqual(assigned(sanitation)[0].action, assigned(drainage)[0].action);
  const noReports = rat.evaluate({ ...rat.defaults, reportWeight: 0 });
  const reports = rat.evaluate({ ...rat.defaults, reportWeight: 40 });
  assert.notDeepEqual(rows(noReports).map(row => row.id), rows(reports).map(row => row.id));
});

test('rat budget increases cannot reduce the fixed-weight optimization target', () => {
  const scores = [0, 8, 20, 48, 100, 160].map(budget => metric(rat.evaluate({ budget }), '納入查核線索總分'));
  scores.slice(1).forEach((score, index) => assert.ok(score >= scores[index]));
});

test('rat handles invalid options and extreme non-finite controls without breaking the contract', () => {
  for (const params of [
    { budget: NaN, focus: 'unknown', reportWeight: Infinity, gapWeight: -100 },
    { budget: 1e10, focus: '__proto__', reportWeight: 1e10, gapWeight: 1e10 },
    { budget: -200, reportWeight: 'wrong', gapWeight: null },
  ]) {
    const result = rat.evaluate(params, {});
    assertFinite(result);
    assert.ok(metric(result, '使用巡查工時') <= 160);
    assert.ok(rows(result).every(row => row.score >= 0 && row.score <= 100));
    assert.ok(result.sources.includes('complaints'));
  }
});
