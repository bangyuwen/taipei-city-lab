import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/analyze-coordinate-distances.py', import.meta.url));
const DISTRICTS = ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'];
const BUCKETS = [
  { key: 'lt1', label: '小於 1 公尺', lower: 0, upper: 1 },
  { key: '1to10', label: '1 至未滿 10 公尺', lower: 1, upper: 10 },
  { key: '10to50', label: '10 至未滿 50 公尺', lower: 10, upper: 50 },
  { key: '50to100', label: '50 至未滿 100 公尺', lower: 50, upper: 100 },
  { key: '100to500', label: '100 至未滿 500 公尺', lower: 100, upper: 500 },
  { key: 'ge500', label: '500 公尺以上', lower: 500, upper: null },
];

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'waste-coordinate-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['dist/data', 'research/coordinate-distances-2024-2026', 'research/source-recovery-2026-10-15']) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  const beforeBytes = Buffer.from('fixture,before\n', 'utf8');
  const afterBytes = Buffer.from('fixture,after\n', 'utf8');
  writeFileSync(join(root, 'research/source-recovery-2026-10-15/before.csv'), beforeBytes);
  writeFileSync(join(root, 'research/source-recovery-2026-10-15/after.csv'), afterBytes);
  const beforeMeta = { date: 'fixture before date', file: 'before.csv', key: 'before', rows: 75, sha256: hash(beforeBytes) };
  const afterMeta = { date: 'fixture after date', file: 'after.csv', key: 'after', rows: 75, sha256: hash(afterBytes) };
  const entries = Array.from({ length: 75 }, (_, index) => {
    const district = DISTRICTS[index % DISTRICTS.length];
    const address = `fixture address ${index + 1}`;
    const before = {
      address, district, id: `before-${String(index + 1).padStart(3, '0')}`,
      plottable: true, quality: 'fixture', rawX: '0', rawY: '0', sourceRow: index + 2, x: 0, y: 0,
    };
    const afterX = 0.01 + index * 0.0001;
    const after = {
      address, district, id: `after-${String(index + 1).padStart(3, '0')}`,
      plottable: true, quality: 'fixture', rawX: String(afterX), rawY: '0', sourceRow: index + 2, x: afterX, y: 0,
    };
    return { address, after: [after], before: [before], category: 'same_address_changed', district, id: `comparison-${String(index + 1).padStart(3, '0')}` };
  });
  const comparison = {
    districts: DISTRICTS.map(district => ({ district })),
    entries,
    meta: { after: afterMeta, before: beforeMeta, protocolVersion: '1.0.0' },
    totals: {},
  };
  const protocol = {
    version: '1.0.0', frozenBeforeCalculation: true,
    comparisonFile: 'dist/data/comparison-2024-2026.json',
    comparisonSHA256: '', comparisonProtocolVersion: '1.0.0',
    selectedCategory: 'same_address_changed', expectedPairs: 75,
    unit: 'one original unique-address source-row pair; not a confirmed facility identity',
    method: { name: 'Haversine', radiusMeters: 6371000, referenceURL: 'https://www.movable-type.co.uk/scripts/latlong.html', description: 'fixture spherical distance' },
    'buckets': BUCKETS,
    limits: ['Same address does not establish facility identity or relocation.'],
  };
  const rootState = { root, comparison, protocol };
  refreshFixture(rootState);
  return rootState;
}
function refreshFixture(state, { updateProtocolHash = true } = {}) {
  const bytes = Buffer.from(`${JSON.stringify(state.comparison, null, 2)}\n`, 'utf8');
  writeFileSync(join(state.root, 'dist/data/comparison-2024-2026.json'), bytes);
  if (updateProtocolHash) state.protocol.comparisonSHA256 = hash(bytes);
  writeJson(join(state.root, 'research/coordinate-distances-2024-2026/protocol.json'), state.protocol);
}
function run(root) {
  return spawnSync('python3', [SCRIPT, '--root', root], {
    encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
}
function outputAt(root, name) {
  return join(root, name);
}
function loadOutput(root) {
  return JSON.parse(readFileSync(outputAt(root, 'dist/data/comparison-coordinate-distances.json'), 'utf8'));
}
function pyJson(expression) {
  const code = `import importlib.util,json,sys\nspec=importlib.util.spec_from_file_location('analysis',sys.argv[1])\nm=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(m)\nprint(json.dumps(${expression},allow_nan=False))`;
  const result = spawnSync('python3', ['-c', code, SCRIPT], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('Haversine handles known geometry, limits, antimeridian, poles, and invalid coordinates', () => {
  const facts = pyJson(`{
    'quarter': m.haversine(0,0,90,0), 'meridian': m.haversine(0,-90,0,0),
    'same': m.haversine(33,25,33,25), 'tiny': m.haversine(0,0,1e-12,0),
    'symmetricA': m.haversine(10,20,30,40), 'symmetricB': m.haversine(30,40,10,20),
    'dateline': m.haversine(179.5,0,-179.5,0), 'pole': m.haversine(0,90,180,90),
    'bounds': [m.valid_position({'x':-180,'y':-90}) is not None, m.valid_position({'x':180,'y':90}) is not None],
    'outside': [m.valid_position({'x':180.000001,'y':0}), m.valid_position({'x':0,'y':-90.000001})],
    'invalid': [m.haversine(None,0,0,0),m.haversine(float('nan'),0,0,0),m.haversine(float('inf'),0,0,0),m.haversine(0,0,181,0)],
    'boolean': m.valid_position({'x':True,'y':0})
  }`);
  const quarter = 6371000 * Math.PI / 2;
  assert.ok(Math.abs(facts.quarter - quarter) < 1e-7);
  assert.ok(Math.abs(facts.meridian - quarter) < 1e-7);
  assert.equal(facts.same, 0);
  assert.ok(facts.tiny > 0);
  assert.ok(Math.abs(facts.symmetricA - facts.symmetricB) < 1e-8);
  assert.ok(Math.abs(facts.dateline - (6371000 * Math.PI / 180)) < 1e-6);
  assert.ok(facts.pole < 1e-7);
  assert.deepEqual(facts.bounds, [true, true]);
  assert.deepEqual(facts.outside, [null, null]);
  assert.deepEqual(facts.invalid, [null, null, null, null]);
  assert.equal(facts.boolean, null);
});

test('median and frozen bucket boundaries use unrounded numeric values', () => {
  const facts = pyJson(`{
    'medians': [m.median([1,3,5]),m.median([1,3,5,7]),m.median([])],
    'buckets': [m.bucket_key(x,${JSON.stringify(BUCKETS).replaceAll('null', 'None')}) for x in [0,0.999999,1,9.999999,10,49.999999,50,99.999999,100,499.999999,500]]
  }`);
  assert.deepEqual(facts.medians, [3, 4, null]);
  assert.deepEqual(facts.buckets, ['lt1','lt1','1to10','1to10','10to50','10to50','50to100','50to100','100to500','100to500','ge500']);
});

test('CLI preserves 75 pairs, ranks exact values and ties, flags coarse records, and writes safe deterministic CSV', t => {
  const state = fixture(t);
  const { entries } = state.comparison;
  entries[0].address = '  =1+1\nsecond';
  entries[0].before[0].address = entries[0].address;
  entries[0].after[0].address = entries[0].address;
  entries[0].after[0].x = 0.0000001;
  entries[0].after[0].rawX = '0.0000001';
  entries[0].after[0].plottable = false;
  entries[1].after[0].x = 0.000000100001;
  entries[1].after[0].rawX = '0.000000100001';
  entries[2].id = 'z-tie';
  entries[2].after[0].x = 1;
  entries[2].after[0].rawX = '1';
  entries[3].id = 'a-tie';
  entries[3].after[0].x = -1;
  entries[3].after[0].rawX = '-1';
  entries[4].after[0].x = null;
  entries[4].after[0].rawX = 'null';
  refreshFixture(state);

  const firstRun = run(state.root);
  assert.equal(firstRun.status, 0, firstRun.stderr);
  assert.match(firstRun.stdout, /Wrote 75 pairs: 74 calculated, 1 unavailable, 1 coarse-flagged/);
  const output = loadOutput(state.root);
  assert.equal(output.summary.pairCount, 75);
  assert.equal(output.summary.calculatedPairs, 74);
  assert.equal(output.summary.unavailablePairs, 1);
  assert.equal(output.summary.coarseFlaggedPairs, 1);
  assert.equal(output.pairs.length, 75);
  assert.equal(new Set(output.pairs.map(pair => pair.comparisonId)).size, 75);
  assert.equal(output.pairs.at(-1).distanceMeters, null);
  assert.equal(output.pairs.at(-1).rank, null);
  assert.equal(output.pairs.find(pair => pair.comparisonId === 'comparison-005').distanceMeters, null);
  const tieIds = output.pairs.filter(pair => pair.comparisonId === 'a-tie' || pair.comparisonId === 'z-tie').map(pair => pair.comparisonId);
  assert.deepEqual(tieIds, ['a-tie', 'z-tie']);
  const smaller = output.pairs.find(pair => pair.comparisonId === 'comparison-001');
  const larger = output.pairs.find(pair => pair.comparisonId === 'comparison-002');
  assert.ok(larger.distanceMeters > smaller.distanceMeters);
  assert.ok(larger.distanceMeters < 0.1 && smaller.distanceMeters < 0.1);
  assert.ok(larger.rank < smaller.rank);
  assert.equal(smaller.quality, 'needs_check');
  assert.equal(output.pairs.find(pair => pair.comparisonId === 'comparison-005').quality, 'unavailable');
  assert.deepEqual(output.pairs.find(pair => pair.comparisonId === 'comparison-001').before, entries[0].before[0]);
  assert.deepEqual(output.pairs.find(pair => pair.comparisonId === 'comparison-001').after, entries[0].after[0]);
  assert.deepEqual(output.meta.sources.before, state.comparison.meta.before);
  assert.deepEqual(output.meta.sources.after, state.comparison.meta.after);
  assert.equal(output.summary.buckets.reduce((sum, bucket) => sum + bucket.count, 0), 74);
  assert.equal(output.districts.length, 12);

  const csvPath = outputAt(state.root, 'dist/data/comparison-coordinate-distances.csv');
  const csvBytes = readFileSync(csvPath);
  assert.deepEqual([...csvBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const csvCheck = spawnSync('python3', ['-c', `import csv,json,sys\nwith open(sys.argv[1],encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))\nassert len(rows)==75\nrow=next(r for r in rows if r['比較ID（本站比對列號；非官方箱號）']=='comparison-001')\nassert row['地址']=="'  =1+1\\nsecond"\nassert row['2024來源實體起始行號']=='2'
assert row['2024來源ID（本站來源列號；非官方箱號）']=='before-001'\nprint('CSV rows=75; formula-like multiline address escaped')`, csvPath], { encoding: 'utf8' });
  assert.equal(csvCheck.status, 0, csvCheck.stderr);
  const paths = [csvPath, outputAt(state.root, 'dist/data/comparison-coordinate-distances.json'), outputAt(state.root, 'research/coordinate-distances-2024-2026/README.md')];
  const beforeRepeat = paths.map(path => readFileSync(path));
  const secondRun = run(state.root);
  assert.equal(secondRun.status, 0, secondRun.stderr);
  assert.deepEqual(paths.map(path => readFileSync(path)), beforeRepeat);
});

test('CLI calculates odd and even medians and keeps empty summaries null', t => {
  const state = fixture(t);
  let result = run(state.root);
  assert.equal(result.status, 0, result.stderr);
  let output = loadOutput(state.root);
  let values = output.pairs.map(pair => pair.distanceMeters).sort((a, b) => a - b);
  assert.equal(values.length, 75);
  assert.equal(output.summary.medianMeters, values[37]);

  state.comparison.entries[0].after[0].x = null;
  refreshFixture(state);
  result = run(state.root);
  assert.equal(result.status, 0, result.stderr);
  output = loadOutput(state.root);
  values = output.pairs.map(pair => pair.distanceMeters).filter(value => value !== null).sort((a, b) => a - b);
  assert.equal(values.length, 74);
  assert.equal(output.summary.medianMeters, (values[36] + values[37]) / 2);

  for (const entry of state.comparison.entries) entry.after[0].x = null;
  refreshFixture(state);
  result = run(state.root);
  assert.equal(result.status, 0, result.stderr);
  output = loadOutput(state.root);
  assert.equal(output.summary.calculatedPairs, 0);
  assert.equal(output.summary.unavailablePairs, 75);
  assert.equal(output.summary.minMeters, null);
  assert.equal(output.summary.medianMeters, null);
  assert.equal(output.summary.maxMeters, null);
  assert.ok(output.summary.buckets.every(bucket => bucket.count === 0));
  assert.ok(output.pairs.every(pair => pair.distanceMeters === null && pair.rank === null));
  assert.ok(output.districts.every(district => district.minMeters === null && district.medianMeters === null && district.maxMeters === null));
});

test('CLI rejects comparison hash, selected count, multiplicity, and source hash mismatches', t => {
  const hashState = fixture(t);
  hashState.comparison.entries[0].address = 'changed without freezing';
  refreshFixture(hashState, { updateProtocolHash: false });
  let result = run(hashState.root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /comparison SHA-256/);

  const countState = fixture(t);
  countState.comparison.entries.pop();
  refreshFixture(countState);
  result = run(countState.root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected 75 selected pairs, found 74/);

  const multiplicityState = fixture(t);
  multiplicityState.comparison.entries[0].before.push({ ...multiplicityState.comparison.entries[0].before[0] });
  refreshFixture(multiplicityState);
  result = run(multiplicityState.root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly one before source row/);

  const sourceState = fixture(t);
  writeFileSync(join(sourceState.root, 'research/source-recovery-2026-10-15/before.csv'), 'tampered');
  result = run(sourceState.root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /before source SHA-256/);
});
