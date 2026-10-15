import test from 'node:test';
import assert from 'node:assert/strict';
import { traffic, simulateQueue, syntheticArrivals, shiftArrivals } from '../sites/taipei-city-lab/dist/modules/traffic.js';

const sum = (values) => values.reduce((a, b) => a + b, 0);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('queue conserves vehicles, drains its tail and measures waiting from backlog', () => {
  const result = simulateQueue([4, 0], 1);
  assert.deepEqual(result.served, [1, 1, 1, 1]);
  assert.deepEqual(result.queue, [3, 2, 1, 0]);
  close(result.total, sum(result.served));
  close(result.waitingArea, 6);
  close(result.meanWait, 1.5);
});

test('waiting cannot be negative and ample capacity removes queues', () => {
  const result = simulateQueue([5, 2, 9], 100);
  assert.equal(result.peakQueue, 0);
  assert.equal(result.meanWait, 0);
  assert.deepEqual(result.served, [5, 2, 9]);
});

test('delay moves demand without losing arrivals; zero intervention is identical', () => {
  const original = syntheticArrivals();
  close(sum(shiftArrivals(original, 0.8, 120)), sum(original));
  assert.deepEqual(shiftArrivals(original, 0.8, 0), original);
  const result = traffic.evaluate({ shift: 0, delay: 120, capacity: 1500 });
  close(result.metrics[3].value, 0);
});

test('scenario chart, table and metrics share the fully drained queue calculation', () => {
  const result = traffic.evaluate({ shift: 75, delay: 120, capacity: 300 });
  close(sum(result.chart.series[1].values), result.metrics[0].value);
  close(sum(result.chart.series[2].values), result.metrics[0].value);
  close(sum(result.table.rows.map((row) => row.incoming)), result.metrics[0].value);
  close(result.table.rows.at(-1).end, 0);
  assert.ok(result.table.rows.length > 6, 'tail extends well beyond original morning arrivals');
});

test('empty and invalid inputs are finite, and evaluation is deterministic', () => {
  assert.equal(simulateQueue([], 0).meanWait, 0);
  const settings = { shift: Infinity, delay: -9999, capacity: NaN };
  const first = traffic.evaluate(settings, {});
  assert.deepEqual(first, traffic.evaluate(settings, {}));
  first.metrics.forEach((metric) => assert.ok(Number.isFinite(metric.value)));
  first.chart.series.forEach((series) => series.values.forEach((value) => assert.ok(Number.isFinite(value))));
});
