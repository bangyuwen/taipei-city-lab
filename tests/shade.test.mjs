import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { shade } from '../dist/modules/shade.js';
import { greedyCoverage } from '../dist/modules/spatial.js';

const metric = (result, label) => result.metrics.find((item) => item.label === label).value;

test('空資料的基準不捏造樹點，零預算也不新增位置', () => {
  const result = shade.evaluate({ budget: 0 }, {});
  assert.equal(metric(result, '快照內已知樹點'), 0);
  assert.equal(metric(result, '已知樹點基準可及率'), 0);
  assert.equal(metric(result, '推薦方案需求可及率'), 0);
  assert.equal(result.table.rows.length, 0);
  assert.ok(result.assumptions.some((text) => text.includes('不表示實際沒有樹木')));
});

test('真實點位增加可及基準，無效、重複與範圍外點不參與計算', () => {
  const data = { trees: [
    { id: 't1', x: 121.5675, y: 25.0775, species: '榕樹' },
    { id: 't1-copy', x: 121.5675, y: 25.0775 },
    { id: 'outside', x: 120, y: 23 }, { x: NaN, y: 25.05 },
  ] };
  const result = shade.evaluate({ budget: 0 }, data);
  assert.equal(metric(result, '快照內已知樹點'), 1);
  assert.ok(metric(result, '已知樹點基準可及率') > 0);
  assert.equal(metric(result, '相對已知樹點基準增加'), 0);
  assert.equal(result.map.points.filter((point) => point.kind === 'existing').length, 1);
});

test('預算是硬上限，推薦唯一且覆蓋不低於自己的基準', () => {
  for (const budget of [0, 1, 4, 20, 100]) {
    const result = shade.evaluate({ budget, fairness: 50 });
    const selected = result.map.points.filter((point) => point.selected);
    assert.ok(selected.length <= budget);
    assert.equal(new Set(selected.map((point) => point.id)).size, selected.length);
    assert.equal(result.table.rows.length, selected.length);
    assert.ok(metric(result, '推薦方案需求可及率') >= metric(result, '已知樹點基準可及率'));
  }
});

test('公平控制真的改變配置並改善最低服務區', () => {
  const efficiency = shade.evaluate({ budget: 4, fairness: 0 });
  const fairness = shade.evaluate({ budget: 4, fairness: 100 });
  assert.notDeepEqual(efficiency.table.rows, fairness.table.rows);
  assert.equal(new Set(efficiency.table.rows.map((row) => row.zone)).size, 1);
  assert.equal(new Set(fairness.table.rows.map((row) => row.zone)).size, 4);
  assert.ok(metric(fairness, '最低模擬區可及率') > metric(efficiency, '最低模擬區可及率'));
});

test('greedy 避免重覆覆蓋；公平能將資源轉到未服務區', () => {
  const demand = [
    { x: 0, y: 0, zone: 0, weight: 90 },
    { x: 0.01, y: 0, zone: 0, weight: 10 },
    { x: 0.02, y: 0, zone: 1, weight: 5 },
  ];
  const candidates = [{ id: 'covered', x: 0, y: 0 },
    { id: 'high', x: 0.01, y: 0 }, { id: 'underserved', x: 0.02, y: 0 }];
  const facilities = [{ x: 0, y: 0 }];
  assert.equal(greedyCoverage(facilities, candidates, demand, 1, 100, 0).selected[0].id, 'high');
  assert.equal(greedyCoverage(facilities, candidates, demand, 1, 100, 1).selected[0].id, 'underserved');
  assert.equal(greedyCoverage(facilities, candidates, demand, 36, 100, 1).selected.length, 2);
});

test('極端輸入與缺漏資料仍有限、可重現，地圖經緯度不交換', () => {
  const params = { budget: 1e12, fairness: -999, radius: Infinity };
  const data = { meta: { bbox: { west: 121.53, south: 25.03, east: 121.55, north: 25.05 } } };
  const before = JSON.stringify(data);
  const first = shade.evaluate(params, data);
  assert.deepEqual(first, shade.evaluate(params, data));
  assert.equal(JSON.stringify(data), before);
  assert.ok(first.metrics.every((item) => Number.isFinite(item.value)));
  assert.ok(first.chart.series.every((series) => series.values.every(Number.isFinite)));
  assert.ok(first.map.points.every((point) => point.x >= 121.53 && point.x <= 121.55
    && point.y >= 25.03 && point.y <= 25.05));
  assert.ok(shade.evaluate(null, null).metrics.every((item) => Number.isFinite(item.value)));
});

test('正式樹木快照預設有可改善缺口，20 個假設樹點帶來正增益', () => {
  const data = JSON.parse(readFileSync(new URL('../dist/data/snapshot.json', import.meta.url), 'utf8'));
  const result = shade.evaluate(shade.defaults, data);
  assert.ok(metric(result, '快照內已知樹點') > 0);
  assert.ok(metric(result, '已知樹點基準可及率') < 100);
  assert.ok(metric(result, '相對已知樹點基準增加') > 0);
  assert.equal(result.table.rows.length, 20);
  assert.ok(result.table.rows.every((row) => row.gain > 0));
});
