import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { after, test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/compare-snapshots.py');
const sourceDir = 'research/source-recovery-2026-10-15';
const protocolPath = 'research/comparison-2024-2026/protocol.json';
const beforeName = 'taipei-bins-2024-10-18-archive-utc.csv';
const afterName = 'taipei-bins-2026-09-30-published.csv';
const roots = [];

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function encodeCsv(records) {
  const headers = ['行政區', '地址', '路名', '段號及其他註明', '經度', '緯度', '備註'];
  return `${[headers, ...records.map((record) => headers.map((key) => record[key] ?? ''))]
    .map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function makeFixture(before, afterRows) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'waste-comparison-'));
  roots.push(root);
  const sourceRoot = path.join(root, sourceDir);
  mkdirSync(sourceRoot, { recursive: true });
  const beforeBytes = Buffer.from(encodeCsv(before), 'utf8');
  const afterBytes = Buffer.from(encodeCsv(afterRows), 'utf8');
  writeFileSync(path.join(sourceRoot, beforeName), beforeBytes);
  writeFileSync(path.join(sourceRoot, afterName), afterBytes);
  const sourceMeta = (key, file, bytes, rows, date) => ({
    key,
    file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    expectedRows: rows.length,
    date,
  });
  const protocol = {
    version: '1.0.0',
    frozenBeforeCalculation: true,
    unit: 'published source row; no stable official facility ID',
    before: sourceMeta('2024-archive', beforeName, beforeBytes, before,
      'Archive capture 2024-10-18T21:17:32Z / Taipei 2024-10-19; survey date unknown'),
    after: sourceMeta('2026-main', afterName, afterBytes, afterRows,
      'Official update 2026-09-30; downloaded 2026-10-15'),
    addressNormalization: 'NFKC; remove Unicode whitespace; 臺 to 台.',
    coordinateNormalization: 'Finite Decimal numeric equality; malformed text is retained.',
    rules: ['Fixture rule: source rows are compared without spatial pairing.'],
    invariants: ['Every source row occurs exactly once in entries.'],
    limits: ['Coverage categories do not prove physical removal or installation.'],
  };
  mkdirSync(path.dirname(path.join(root, protocolPath)), { recursive: true });
  writeFileSync(path.join(root, protocolPath), `${JSON.stringify(protocol, null, 2)}\n`);
  return { root, protocol, beforeBytes, afterBytes };
}

function run(root) {
  return spawnSync('python3', [script, '--root', root], { encoding: 'utf8' });
}

function output(root) {
  return JSON.parse(readFileSync(path.join(root, 'dist/data/comparison-2024-2026.json'), 'utf8'));
}

function parseCsv(text) {
  text = text.replace(/^\uFEFF/u, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r' || char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (char === '\r' && text[index + 1] === '\n') index += 1;
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const record = (district, address, longitude, latitude, note = '') => ({
  行政區: district,
  地址: address,
  經度: longitude,
  緯度: latitude,
  備註: note,
});

test('normalizes keys and Decimal coordinates while conserving duplicate and coverage groups', () => {
  const before = [
    record('中正區', '臺北　路 1 號', '１２１.5000', '25.0000', 'first line\nsecond line'),
    record('中正區', '台北路1號', '121.6', '25.1'),
    record('中正區', '單側模糊', '121.5', '25.0'),
    record('中正區', '單側模糊', '121.6', '25.1'),
    record('中正區', '一對多', '121.51', '25.01'),
    record('中山區', '臺灣路 2號', '121.52', '25.02'),
    record('大同區', '缺失點', '121.5', '25.0'),
    record('大同區', '缺失點', '121.51', '25.01'),
    record('中正區', '舊址', '121.61', '25.21'),
    record('中正區', '同址', '121.62', '25.22'),
    record('中正區', '格式化', 'NaN', ' bad '),
    record('中正區', '單欄錯誤', '121.5', 'not-a-latitude'),
    { 行政區: '大安區', 地址: '', 路名: '大安路', 段號及其他註明: '大安路三段1號', 經度: '121.55', 緯度: '25.02' },
  ];
  const afterRows = [
    record('中正區', '台北 路1號', '121.5', '2.5e1'),
    record('中正區', '台北路1號', '121.8', '25.2'),
    record('中正區', '臺北路1號', '121.9', '25.2'),
    record('中正區', '單側模糊', '121.5', '25.0'),
    record('中正區', '一對多', '121.51', '25.01'),
    record('中正區', '一對多', '121.7', '25.03'),
    record('中山區', '台灣路2號', '121.53', '25.02'),
    record('中正區', '新址', '121.61', '25.21'),
    record('大同區', '同址', '121.62', '25.22'),
    record('中正區', '格式化', 'ＮａＮ', 'bad'),
    record('中正區', '單欄錯誤', '121.5000', 'not-a-latitude'),
    { 行政區: '大安區', 地址: '', 路名: '大安路', 段號及其他註明: '大安路三段1號', 經度: '121.55', 緯度: '25.02' },
    record('士林區', '僅新資料', '121.5', '25.0'),
    record('士林區', '僅新資料', '121.51', '25.01'),
  ];
  const fixture = makeFixture(before, afterRows);
  const result = run(fixture.root);
  assert.equal(result.status, 0, result.stderr);
  const data = output(fixture.root);

  const sharedDuplicate = data.entries.find((entry) =>
    entry.category === 'ambiguous' && entry.address === '臺北　路 1 號');
  assert.equal(sharedDuplicate.category, 'ambiguous');
  assert.equal(sharedDuplicate.before.length, 1);
  assert.equal(sharedDuplicate.after.length, 2);
  assert.equal(data.entries.filter((entry) => entry.category === 'same_fields').length, 6);
  assert.equal(data.entries.filter((entry) => entry.category === 'same_address_changed').length, 1);
  assert.equal(data.entries.filter((entry) => entry.category === 'not_reappeared').length, 3);
  assert.equal(data.entries.filter((entry) => entry.category === 'only_2026').length, 3);

  const changed = data.entries.find((entry) => entry.category === 'same_address_changed');
  assert.equal(changed.before[0].address, '臺灣路 2號');
  assert.equal(changed.after[0].address, '台灣路2號');
  const ambiguousOneToMany = data.entries.find((entry) => entry.category === 'ambiguous' && entry.address === '一對多');
  assert.equal(ambiguousOneToMany.before.length, 0);
  assert.equal(ambiguousOneToMany.after.length, 1);
  const ambiguousBeforeOnly = data.entries.find((entry) => entry.category === 'ambiguous' && entry.address === '單側模糊');
  assert.equal(ambiguousBeforeOnly.before.length, 1);
  assert.equal(ambiguousBeforeOnly.after.length, 0);

  const malformed = data.entries.find((entry) => entry.address === '格式化');
  assert.equal(malformed.category, 'same_fields');
  assert.equal(malformed.before[0].x, null);
  assert.equal(malformed.before[0].y, null);
  assert.equal(malformed.before[0].plottable, false);
  assert.equal(malformed.before[0].rawX, 'NaN');
  assert.equal(malformed.before[0].rawY, ' bad ');
  const oneInvalidAxis = data.entries.find((entry) => entry.address === '單欄錯誤');
  assert.equal(oneInvalidAxis.category, 'same_fields');
  assert.equal(oneInvalidAxis.before[0].x, null);
  assert.equal(oneInvalidAxis.before[0].y, null);
  assert.equal(oneInvalidAxis.before[0].rawX, '121.5');
  assert.equal(oneInvalidAxis.before[0].rawY, 'not-a-latitude');

  const coordinateOnlyBefore = data.entries.find((entry) => entry.address === '舊址');
  const coordinateOnlyAfter = data.entries.find((entry) => entry.address === '新址');
  assert.equal(coordinateOnlyBefore.category, 'not_reappeared');
  assert.equal(coordinateOnlyAfter.category, 'only_2026');
  assert.equal(data.entries.filter((entry) => entry.address === '同址').length, 2);

  const parsedAddress = data.entries.find((entry) => entry.address === '大安路三段1號');
  assert.equal(parsedAddress.category, 'same_fields');
  assert.equal(data.totals.beforeRows, before.length);
  assert.equal(data.totals.afterRows, afterRows.length);
  assert.equal(data.totals.deltaRows, afterRows.length - before.length);
  for (const district of data.districts) {
    assert.equal(district.beforeRows,
      district.exactPairs + district.sameAddressPairs + district.ambiguousBeforeRows + district.notReappearedRows);
    assert.equal(district.afterRows,
      district.exactPairs + district.sameAddressPairs + district.ambiguousAfterRows + district.only2026Rows);
  }
  const beforeIds = data.entries.flatMap((entry) => entry.before.map((row) => row.id));
  const afterIds = data.entries.flatMap((entry) => entry.after.map((row) => row.id));
  assert.deepEqual(beforeIds.sort(), before.map((_, index) => `2024-archive-row-${index + 1}`).sort());
  assert.deepEqual(afterIds.sort(), afterRows.map((_, index) => `2026-main-row-${index + 1}`).sort());
});

test('uses strict coarse-bounds checks at each boundary and immediately inside or outside', () => {
  const cases = [
    ['121.4', '25.0', false],
    ['121.4000000000000001', '25.0', true],
    ['121.39999999999999', '25.0', false],
    ['121.7', '25.0', false],
    ['121.6999999999999999', '25.0', true],
    ['121.70000000000001', '25.0', false],
    ['121.5', '24.95', false],
    ['121.5', '24.95000000000001', true],
    ['121.5', '24.94999999999999', false],
    ['121.5', '25.3', false],
    ['121.5', '25.29999999999999', true],
    ['121.5', '25.30000000000001', false],
  ];
  const before = cases.map(([longitude, latitude], index) =>
    record('中正區', `界線${index + 1}`, longitude, latitude));
  const fixture = makeFixture(before, before);
  const result = run(fixture.root);
  assert.equal(result.status, 0, result.stderr);
  const data = output(fixture.root);
  for (const [index, [, , expected]] of cases.entries()) {
    const entry = data.entries.find((candidate) => candidate.address === `界線${index + 1}`);
    assert.equal(entry.category, 'same_fields');
    assert.equal(entry.before[0].plottable, expected, `case ${index + 1}`);
  }
});

test('sourceRow stores physical record start while IDs retain logical row numbers', () => {
  const before = [
    record('中正區', '多行備註', '121.5', '25.0', 'first physical line\ncontinued line'),
    record('中正區', '下一筆', '121.51', '25.01'),
  ];
  const fixture = makeFixture(before, before);
  const result = run(fixture.root);
  assert.equal(result.status, 0, result.stderr);
  const data = output(fixture.root);
  const sourceRows = data.entries.flatMap((entry) => entry.before.map((row) => [row.id, row.sourceRow]));
  assert.deepEqual(sourceRows, [['2024-archive-row-1', 2], ['2024-archive-row-2', 4]]);
});

test('CSV is BOM-prefixed, formula-safe, flattened once per source row, and deterministic', () => {
  const before = [record('中正區', '=2+2', '121.5', '25.0')];
  const fixture = makeFixture(before, before);
  const first = run(fixture.root);
  assert.equal(first.status, 0, first.stderr);
  const jsonPath = path.join(fixture.root, 'dist/data/comparison-2024-2026.json');
  const csvPath = path.join(fixture.root, 'dist/data/comparison-2024-2026.csv');
  const jsonFirst = readFileSync(jsonPath);
  const csvFirst = readFileSync(csvPath);
  assert.equal(csvFirst.subarray(0, 3).toString('hex'), 'efbbbf');
  const rows = parseCsv(csvFirst.toString('utf8'));
  assert.deepEqual(rows[0], [
    'comparisonid', 'category', 'categoryLabel', 'version', 'versiondate', 'sourcefilename',
    'sourceRow', 'id', 'district', 'address', 'rawlongitude', 'rawlatitude', 'quality', 'limitations',
  ]);
  assert.equal(rows.length - 1, before.length + before.length);
  assert.equal(rows[1][9], "'=2+2");
  assert.equal(rows[1][1], 'same_fields');
  assert.equal(rows[1][2], '地址及座標欄位相同');
  const second = run(fixture.root);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(readFileSync(jsonPath), jsonFirst);
  assert.deepEqual(readFileSync(csvPath), csvFirst);
});

test('rejects a source hash mismatch before generating an output', () => {
  const fixture = makeFixture([record('中正區', '原址', '121.5', '25.0')], []);
  writeFileSync(path.join(fixture.root, sourceDir, afterName), 'tampered');
  const result = run(fixture.root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /source hash mismatch/u);
});

test('rejects an expected row-count mismatch even when the source hash is current', () => {
  const fixture = makeFixture([record('中正區', '原址', '121.5', '25.0')], []);
  fixture.protocol.before.expectedRows += 1;
  writeFileSync(path.join(fixture.root, protocolPath), `${JSON.stringify(fixture.protocol, null, 2)}\n`);
  const result = run(fixture.root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /source row count mismatch/u);
});
