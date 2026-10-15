const DEFAULT_BBOX = [121.51, 25.02, 121.57, 25.08];
const ZONE_LABELS = ['西南模擬區', '東南模擬區', '西北模擬區', '東北模擬區'];
const FACILITY_CACHE = new WeakMap();
const COVERAGE_CACHE = new WeakMap();
const GRID_CACHE = new Map();

function memoSet(cache, key, value) {
  if (cache.size >= 16) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

export function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function bounded(value, minimum, maximum, fallback) {
  return Math.min(maximum, Math.max(minimum, finiteNumber(value, fallback)));
}

export function bboxOf(data = {}) {
  const source = data?.meta?.bbox;
  const values = Array.isArray(source) ? source : [
    source?.west ?? source?.minX ?? source?.minLng,
    source?.south ?? source?.minY ?? source?.minLat,
    source?.east ?? source?.maxX ?? source?.maxLng,
    source?.north ?? source?.maxY ?? source?.maxLat,
  ];
  if (values.length !== 4 || !values.every(Number.isFinite)) return [...DEFAULT_BBOX];
  const [west, south, east, north] = values;
  if (west >= east || south >= north || west < -180 || east > 180
      || south < -85 || north > 85) return [...DEFAULT_BBOX];
  return [...values];
}

export function validFacilities(records, bbox) {
  if (!Array.isArray(records)) return [];
  const cache = FACILITY_CACHE.get(records) ?? new Map();
  FACILITY_CACHE.set(records, cache);
  const key = `${bbox.join(',')}:${records.length}`;
  if (cache.has(key)) return cache.get(key);
  const [west, south, east, north] = bbox;
  const seen = new Set();
  const result = records.filter((point) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
    if (point.x < west || point.x > east || point.y < south || point.y > north) return false;
    const key = `${point.x.toFixed(7)},${point.y.toFixed(7)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((point, index) => ({ ...point, id: String(point.id ?? `已知設施-${index + 1}`) }));
  return memoSet(cache, key, result);
}

export function distanceMeters(first, second) {
  const radian = Math.PI / 180;
  const dx = (first.x - second.x) * Math.cos((first.y + second.y) * radian / 2);
  const dy = first.y - second.y;
  return Math.hypot(dx, dy) * radian * 6371000;
}

export function syntheticGrid(bbox, side, kind, offset = kind === 'candidate' ? 0.25 : 0.5) {
  const key = `${bbox.join(',')}:${side}:${kind}:${offset}`;
  if (GRID_CACHE.has(key)) return GRID_CACHE.get(key);
  const [west, south, east, north] = bbox;
  const result = Array.from({ length: side * side }, (_, index) => {
    const column = index % side;
    const row = Math.floor(index / side);
    const u = (column + offset) / side;
    const v = (row + offset) / side;
    const zone = Number(u >= 0.5) + 2 * Number(v >= 0.5);
    const weight = kind === 'demand' ? 1 + 5 * u + 3 * v + ((column + 2 * row) % 4) : 0;
    return { id: `${kind}-${index + 1}`, x: west + u * (east - west),
      y: south + v * (north - south), zone, weight,
      label: `${kind === 'demand' ? '合成需求' : '合成候選點'} ${index + 1}` };
  });
  return memoSet(GRID_CACHE, key, result);
}

export function coverageBy(facilities, demand, radius) {
  const cache = COVERAGE_CACHE.get(facilities) ?? new Map();
  if (facilities.length > 1) COVERAGE_CACHE.set(facilities, cache);
  const key = `${radius}:${demand.map((point) => `${point.x},${point.y}`).join(';')}`;
  if (cache.has(key)) return cache.get(key);
  const result = demand.map((point) => {
    const latitudeRange = radius / 111195;
    const longitudeRange = latitudeRange / Math.cos(point.y * Math.PI / 180);
    return facilities.some((facility) => Math.abs(point.y - facility.y) <= latitudeRange
      && Math.abs(point.x - facility.x) <= longitudeRange
      && distanceMeters(point, facility) <= radius);
  });
  return facilities.length > 1 ? memoSet(cache, key, result) : result;
}

export function coverageStats(covered, demand) {
  const zones = ZONE_LABELS.map((label) => ({ label, total: 0, covered: 0 }));
  demand.forEach((point, index) => {
    zones[point.zone].total += point.weight;
    if (covered[index]) zones[point.zone].covered += point.weight;
  });
  const total = zones.reduce((sum, zone) => sum + zone.total, 0);
  const value = zones.reduce((sum, zone) => sum + zone.covered, 0);
  const rates = zones.map((zone) => zone.total ? zone.covered / zone.total : 0);
  return { total, covered: value, rate: total ? value / total : 0,
    rates, zones, minimumRate: Math.min(...rates),
    fairnessUtility: rates.reduce((sum, rate) => sum + Math.sqrt(rate), 0) / rates.length };
}

function objective(stats, fairness) {
  return (1 - fairness) * stats.rate + fairness * stats.fairnessUtility;
}

// Sparse marginal updates retain the exact objective while avoiding a full
// demand scan for every candidate at every iteration.
export function greedyCoverage(facilities, candidates, demand, budget, radius, fairness, candidateRadius = radius) {
  let covered = [...coverageBy(facilities, demand, radius)];
  let stats = coverageStats(covered, demand);
  const coverages = candidates.map(point => candidateRadius > 0
    ? coverageBy([point], demand, candidateRadius).flatMap((yes, i) => yes ? [i] : []) : []);
  const selected = [], chosen = new Set();
  for (let iteration = 0; iteration < budget; iteration++) {
    let best;
    coverages.forEach((indices, index) => {
      if (chosen.has(index)) return;
      const extras = [0, 0, 0, 0];
      for (const i of indices) if (!covered[i]) extras[demand[i].zone] += demand[i].weight;
      const added = extras.reduce((sum, value) => sum + value, 0);
      const rates = stats.zones.map((zone, i) => zone.total ? (zone.covered + extras[i]) / zone.total : 0);
      const utility = rates.reduce((sum, rate) => sum + Math.sqrt(rate), 0) / rates.length;
      const gain = (1 - fairness) * (stats.total ? added / stats.total : 0)
        + fairness * (utility - stats.fairnessUtility);
      if (gain > 1e-12 && (!best || gain > best.gain + 1e-12)) best = { index, gain, added };
    });
    if (!best) break;
    chosen.add(best.index);
    selected.push({ ...candidates[best.index], marginalDemand: best.added });
    for (const i of coverages[best.index]) covered[i] = true;
    stats = coverageStats(covered, demand);
  }
  return { selected, covered, stats };
}

export function regularCoverage(facilities, candidates, demand, budget, radius, candidateRadius = radius) {
  const count = Math.min(budget, candidates.length);
  const selected = Array.from({ length: count }, (_, index) =>
    candidates[Math.floor((index + 0.5) * candidates.length / count)]);
  const baseline = coverageBy(facilities, demand, radius);
  const added = candidateRadius > 0 ? coverageBy(selected, demand, candidateRadius) : demand.map(() => false);
  return coverageStats(baseline.map((value, i) => value || added[i]), demand);
}

export function clusteredDemand(bbox) {
  const key = bbox.join(',') + ':cluster';
  if (GRID_CACHE.has(key)) return GRID_CACHE.get(key);
  const dx = Math.min(30 / (111195 * Math.cos((bbox[1] + bbox[3]) / 2 * Math.PI / 180)), (bbox[2] - bbox[0]) / 48);
  const dy = Math.min(30 / 111195, (bbox[3] - bbox[1]) / 48);
  return memoSet(GRID_CACHE, key, syntheticGrid(bbox, 12, 'demand').flatMap(point =>
    [-1, 0, 1].flatMap(row => [-1, 0, 1].map(column => ({ ...point,
      id: point.id + ':' + row + ':' + column, x: point.x + column * dx,
      y: point.y + row * dy, weight: point.weight / 9 })))));
}

export function eligibleCandidates(candidates, siting) {
  // Illustrative feasibility mask only; it is not observed sidewalk geometry.
  return siting === 'constrained' ? candidates.filter((_, i) => i % 4 !== 0) : candidates;
}

export function mapPoints(facilities, demand, candidates, selected, sourceLabel) {
  const step = Math.max(1, Math.ceil(facilities.length / 220));
  const known = facilities.filter((_, index) => index % step === 0).map((point) => ({
    ...point, label: `${sourceLabel}：${point.species || point.address || point.id}`, kind: 'existing',
  }));
  const chosen = new Set(selected.map((point) => point.id));
  const needs = demand.map((point) => ({ ...point, kind: 'demand', value: point.weight }));
  const sites = candidates.map((point) => ({ ...point, selected: chosen.has(point.id),
    kind: chosen.has(point.id) ? 'recommended' : 'candidate' }));
  return [...known, ...needs, ...sites];
}

export function comparisonChart(baseline, regular, optimized) {
  return { labels: baseline.zones.map((zone) => zone.label), unit: '%', series: [
    { label: '已知設施基準', color: '#8799b4', values: baseline.rates.map((value) => 100 * value) },
    { label: '均分候選方案', color: '#e7b462', values: regular.rates.map((value) => 100 * value) },
    { label: '推薦配置方案', color: '#2fd5ad', values: optimized.rates.map((value) => 100 * value) },
  ], caption: '同一份合成需求、相同既有／新增半徑假設與點數上限；四區是矩形範圍分區，並非行政區。' };
}

export function actionTable(selected, action) {
  return { columns: [
    { key: 'rank', label: '順序' }, { key: 'action', label: '建議行動' },
    { key: 'zone', label: '模擬分區' }, { key: 'location', label: '候選中心（緯度、經度）' },
    { key: 'gain', label: '新增需求權重' },
  ], rows: selected.map((point, index) => ({ rank: index + 1, action,
    zone: ZONE_LABELS[point.zone], location: `${point.y.toFixed(5)}, ${point.x.toFixed(5)}`,
    gain: point.marginalDemand })) };
}
