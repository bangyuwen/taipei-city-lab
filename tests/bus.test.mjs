import test from 'node:test';
import assert from 'node:assert/strict';
import { bus, planShuttle, simulateShuttle } from '../dist/modules/bus.js';

test('each vehicle and its driver receive the full rest interval', () => {
  const result = planShuttle({ fleet: 2, headway: 3, breakMinutes: 30 });
  assert.equal(result.feasible, false);
  assert.equal(result.requiredFleet, 20);
  assert.equal(result.interval, 30);
  const last = new Map();
  result.schedule.forEach((trip) => {
    if (last.has(trip.vehicle)) assert.ok(trip.minute >= last.get(trip.vehicle).ready);
    assert.equal(trip.ready - trip.returned, 30);
    last.set(trip.vehicle, trip);
  });
});

test('break increases required fleet; sufficient fleet preserves the requested headway', () => {
  const short = planShuttle({ fleet: 4, headway: 10, breakMinutes: 5 });
  const long = planShuttle({ fleet: 4, headway: 10, breakMinutes: 30 });
  assert.equal(short.feasible, true);
  assert.equal(short.interval, 10);
  assert.equal(long.feasible, false);
  assert.equal(long.interval, 15);
  assert.ok(long.requiredFleet > short.requiredFleet);
});

test('passengers are conserved and every departure observes its capacity', () => {
  const result = simulateShuttle({ fleet: 1, headway: 3, breakMinutes: 30, demand: 1500 });
  assert.equal(result.total, result.boarded + result.remaining);
  assert.equal(result.total, 3000);
  assert.ok(result.remaining > 0);
  result.schedule.forEach((trip) => assert.ok(trip.boarded <= 30));
  assert.ok(result.boarded <= result.offeredCapacity);
});

test('FIFO waits are computed for passengers actually boarded, not offered capacity', () => {
  const result = simulateShuttle({ fleet: 12, headway: 5, breakMinutes: 5, demand: 120 });
  assert.equal(result.total, 240);
  assert.equal(result.boarded, 240);
  assert.equal(result.remaining, 0);
  assert.equal(result.meanBoardedWait, 0);
  assert.ok(result.offeredCapacity > result.boarded);
  const delayed = simulateShuttle({ fleet: 12, headway: 10, breakMinutes: 5, demand: 120 });
  assert.ok(delayed.meanBoardedWait > 0);
  assert.ok(delayed.remaining > 0, 'end-of-window arrivals remain explicit');
});

test('zero demand and extreme parameters produce deterministic finite outputs', () => {
  const empty = bus.evaluate({ demand: 0 });
  assert.equal(empty.metrics[3].value, 0);
  assert.equal(empty.metrics[4].value, 0);
  const input = { fleet: 0, headway: Infinity, breakMinutes: -1, demand: NaN };
  const first = bus.evaluate(input, {});
  assert.deepEqual(first, bus.evaluate(input, {}));
  first.metrics.forEach((metric) => assert.ok(Number.isFinite(metric.value)));
  first.chart.series.forEach((series) => series.values.forEach((value) => assert.ok(Number.isFinite(value))));
  assert.doesNotThrow(() => bus.evaluate(null));
});

test('table and hourly chart describe the same rest-constrained service', () => {
  const result = bus.evaluate({ fleet: 2, headway: 5, breakMinutes: 20, demand: 600 });
  const chartBoarded = result.chart.series[1].values.reduce((a, b) => a + b, 0);
  const tableBoarded = result.table.rows.reduce((sum, row) => sum + row.boarded, 0);
  assert.equal(chartBoarded, tableBoarded);
  assert.equal(chartBoarded, result.metrics[3].value);
  assert.match(result.explanation, /不可行/);
});
