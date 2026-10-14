import test from 'node:test';
import assert from 'node:assert/strict';
import { audit, parseCSV, inspectCSV } from '../dist/modules/audit.js';

test('CSV preserves escaped quotes, commas, quoted CRLF, BOM, and trailing empty fields', () => {
  const result = parseCSV('\uFEFFid,note,optional\r\n1,"街道,右側",\r\n\r\n2,"說""你好""\r\n下一行",ok\r\n');
  assert.deepEqual(result.columns, ['id', 'note', 'optional']);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rowCount, 2);
  assert.deepEqual(result.records[0], { id: '1', note: '街道,右側', optional: '' });
  assert.equal(result.records[1].note, '說"你好"\r\n下一行');
});

test('empty fields are retained, blank physical lines are skipped, and a final row is read', () => {
  const result = parseCSV(' \na,b\n,\n"",\n  \n\n0,1');
  assert.equal(result.rowCount, 3);
  assert.deepEqual(result.records[0], { a: '', b: '' });
  assert.deepEqual(result.records[2], { a: '0', b: '1' });
});

test('malformed quoting fails instead of silently repairing the dataset', () => {
  for (const csv of ['a,b\n1,"未結束', 'a,b\n1,未"結束', 'a,b\n1,"a"oops']) {
    const result = parseCSV(csv);
    assert.equal(result.rowCount, 0);
    assert.equal(result.errors.length, 1);
  }
});

test('invalid-width rows are excluded and physical line numbers survive quoted newlines', () => {
  const result = parseCSV('a,b\n1,"foo\nbar"\n2\n3,4,5\n6,7');
  assert.equal(result.rowCount, 2);
  assert.deepEqual(result.errors.map(item => item.row), [4, 5]);
  assert.deepEqual(result.records[1], { a: '6', b: '7' });
  assert.equal(inspectCSV('a,b\n1\n2,3').valid, false);
});

test('bad headers, wrong types, and empty datasets get structured failures', () => {
  assert.equal(parseCSV('a,a\n1,2').errors[0].code, 'DUPLICATE_HEADER');
  assert.equal(parseCSV('a, \n1,2').errors[0].code, 'EMPTY_HEADER');
  assert.equal(parseCSV(null).errors[0].code, 'INPUT_TYPE');
  assert.equal(parseCSV('\n\r\n').errors[0].code, 'EMPTY_FILE');
  assert.equal(inspectCSV('id\n', { question: '總共有幾筆' }).suitability.status, 'unsuitable');
});

test('UTF-8 byte, data-row, and column limits are enforced', () => {
  assert.equal(parseCSV('a\n' + '樹'.repeat(700000)).errors[0].code, 'SIZE_LIMIT');
  assert.equal(parseCSV('a\n' + '1\n'.repeat(10001)).errors[0].code, 'ROW_LIMIT');
  assert.equal(parseCSV(Array.from({ length: 101 }, (_, index) => `c${index}`).join(',')).errors[0].code, 'COLUMN_LIMIT');
  assert.equal(parseCSV('a\n' + '1\n'.repeat(10000)).rowCount, 10000);
});

test('profiling measures blanks and exact duplicates without treating numeric zero as missing', () => {
  const report = inspectCSV('id,count,flag,note\n1,0,true,\n1,0,true,\n2,,false,文字');
  assert.equal(report.rowCount, 3);
  assert.equal(report.missingness.missingCells, 3);
  assert.equal(report.missingness.totalCells, 12);
  assert.equal(report.missingness.rate, 0.25);
  assert.equal(report.duplicateCount, 1);
  assert.equal(report.profiles.find(item => item.name === 'count').type, 'number');
  assert.equal(report.profiles.find(item => item.name === 'flag').type, 'boolean');
  assert.deepEqual(report.grain.candidateKeys, []);
});

test('coordinates require valid paired numbers; arbitrary x/y and addresses are not treated as verified coordinates', () => {
  const valid = inspectCSV('id,latitude,longitude\n1,25.03,121.56\n2,91,121\n3,,121');
  assert.equal(valid.geo.coordinatePairCount, 1);
  assert.equal(valid.geo.invalidCoordinateRows, 2);
  assert.equal(valid.geo.hasCoordinates, true);
  assert.equal(inspectCSV('x,y\n25,121').geo.hasCoordinates, false);
  assert.equal(inspectCSV('地址,count\n忠孝東路,3', { question: '熱點在哪裡' }).suitability.status, 'partial');
  assert.equal(inspectCSV('年度,count\n2024,3', { question: '鼠患熱點在哪裡' }).suitability.status, 'unsuitable');
});

test('freshness uses valid dates and explicit reference day, rejects impossible dates, and handles ROC dates', () => {
  const report = inspectCSV('id,updatedAt\n1,2026-09-01\n2,2026-10-13T23:59:00Z\n3,2026-02-30', { referenceDate: '2026-10-13' });
  assert.equal(report.freshness.ageDays, 0);
  assert.equal(report.freshness.status, 'current');
  assert.equal(report.freshness.invalidDateCount, 1);
  const roc = inspectCSV('id,日期\n1,115/10/13', { referenceDate: '2026-10-13' });
  assert.equal(roc.freshness.newest, '2026-10-13T00:00:00.000Z');
  assert.equal(inspectCSV('日期\n2026-01-01', { maxAgeDays: 30 }).freshness.status, 'stale');
  assert.equal(inspectCSV('日期\n2027-01-01').freshness.status, 'future');
});

test('invalid explicit date options are surfaced and date-like unnamed columns are discovered', () => {
  const wrong = inspectCSV('date\n2026-10-13', { dateColumn: 'missing' });
  assert.equal(wrong.valid, false);
  assert.ok(wrong.findings.some(item => item.code === 'DATE_COLUMN'));
  assert.equal(inspectCSV('date\n2026-10-13', { referenceDate: 'bad' }).valid, false);
  assert.equal(inspectCSV('event\n2026-10-12').freshness.dateColumn, 'event');
});

test('grain and question fit stay conservative; clean CSV never becomes proof of causal effect', () => {
  const csv = 'id,lat,lng,date\n1,25,121,2026-10-13\n2,25.1,121.2,2026-10-13';
  const report = inspectCSV(csv, { question: '加班次可以減少幾分鐘' });
  assert.deepEqual(report.grain.candidateKeys, ['id', 'lat', 'lng']);
  assert.equal(report.suitability.status, 'partial');
  assert.equal(inspectCSV(csv, { question: '共有幾筆紀錄' }).suitability.status, 'undetermined');
  assert.equal(inspectCSV(csv, { question: '' }).suitability.status, 'undetermined');
  assert.equal(inspectCSV(csv, { question: '哪棟建築耐震安全' }).suitability.status, 'partial');
});

test('official suitability works for empty data and all six themes without claiming observed source records', () => {
  for (const question of ['shade', 'bins', 'rat', 'traffic', 'bus', 'buildings', 'invalid']) {
    const result = audit.evaluate({ question }, {});
    assert.equal(result.metrics.find(item => item.label === '可直接回答').value, 0);
    assert.ok(result.metrics.every(item => Number.isFinite(item.value)));
    assert.ok(result.table.rows.every(row => row.records === '未載入原始資料'));
    assert.deepEqual(result, audit.evaluate({ question }, {}));
  }
  assert.equal(audit.evaluate({ question: 'bins' }, { bins: [{ id: 1 }], sources: {} }).table.rows[0].records, 1);
  assert.equal(audit.evaluate(null, null).metrics[0].value, 2);
});
