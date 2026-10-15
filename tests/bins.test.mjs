import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { bins } from '../sites/taipei-city-lab/dist/modules/bins.js';

const metric = (result, label) => result.metrics.find((item) => item.label === label).value;

test('零預算保留已知垃圾桶基準，不把合成需求冒充實測人流', () => {
  const result = bins.evaluate({ budget: 0 }, { bins: [{ id: 'b1', x: 121.5675, y: 25.0775 }] });
  assert.equal(metric(result, '快照內已知垃圾桶'), 1);
  assert.ok(metric(result, '已知垃圾桶基準服務率') > 0);
  assert.equal(metric(result, '相對已知垃圾桶基準增加'), 0);
  assert.equal(result.table.rows.length, 0);
  assert.ok(result.assumptions.some((text) => text.includes('並非實測人流')));
});

test('預算增加不減少相同模型下的需求服務率', () => {
  const budgets = [0, 1, 4, 20, 36, 100];
  let previous = 0;
  for (const budget of budgets) {
    const result = bins.evaluate({ budget, fairness: 40 }, {});
    const current = metric(result, '推薦方案需求服務率');
    assert.ok(current >= previous);
    assert.ok(result.table.rows.length <= budget);
    previous = current;
  }
});

test('同一上限下公平權重提高最低模擬區服務率', () => {
  const efficiency = bins.evaluate({ budget: 4, fairness: 0 });
  const fair = bins.evaluate({ budget: 4, fairness: 100 });
  assert.ok(metric(fair, '最低模擬區服務率') > metric(efficiency, '最低模擬區服務率'));
  assert.notDeepEqual(fair.table.rows, efficiency.table.rows);
});

test('需求全被已知桶服務時不花完不必要預算', () => {
  const fixture = Array.from({ length: 144 }, (_, index) => ({
    id: `fixture-${index}`, x: 121.51 + ((index % 12) + 0.5) / 12 * 0.06,
    y: 25.02 + (Math.floor(index / 12) + 0.5) / 12 * 0.06,
  }));
  const result = bins.evaluate({ budget: 36, radius: 100 }, { bins: fixture });
  assert.equal(metric(result, '已知垃圾桶基準服務率'), 100);
  assert.equal(metric(result, '推薦方案需求服務率'), 100);
  assert.equal(result.table.rows.length, 0);
});

test('每個新增位置的需求增益加總等於基準與推薦差值', () => {
  const result = bins.evaluate({ budget: 8, fairness: 65 });
  const demand = result.map.points.filter((point) => point.kind === 'demand');
  const total = demand.reduce((sum, point) => sum + point.weight, 0);
  const marginal = result.table.rows.reduce((sum, row) => sum + row.gain, 0);
  const percent = metric(result, '相對已知垃圾桶基準增加');
  assert.ok(Math.abs(100 * marginal / total - percent) < 1e-9);
  assert.ok(result.table.rows.every((row) => row.gain > 0));
});

test('極端、空值與非法座標輸入仍有限且可重現', () => {
  const params = { budget: Infinity, radius: -1e10, fairness: NaN };
  const data = { bins: [{ x: Infinity, y: 25 }, null, { x: 121.5, y: NaN }],
    meta: { bbox: [121.6, 25.1, 121.4, 24.9] } };
  const first = bins.evaluate(params, data);
  assert.deepEqual(first, bins.evaluate(params, data));
  assert.equal(metric(first, '快照內已知垃圾桶'), 0);
  assert.ok(first.metrics.every((item) => Number.isFinite(item.value)));
  assert.ok(first.chart.series.every((series) => series.values.every(Number.isFinite)));
  assert.ok(bins.evaluate(null, null).metrics.every((item) => Number.isFinite(item.value)));
});

test('正式垃圾桶快照預設 300 公尺、20 個新增點有正服務增益', () => {
  const data = JSON.parse(readFileSync(new URL('../sites/taipei-city-lab/dist/data/snapshot.json', import.meta.url), 'utf8'));
  const result = bins.evaluate(bins.defaults, data);
  assert.ok(metric(result, '快照內已知垃圾桶') > 0);
  assert.ok(metric(result, '已知垃圾桶基準服務率') < 100);
  assert.ok(metric(result, '相對已知垃圾桶基準增加') > 0);
  assert.equal(result.table.rows.length, 20);
});
