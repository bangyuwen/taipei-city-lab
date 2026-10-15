import test from 'node:test';
import assert from 'node:assert/strict';
import {boot} from './helpers/app-harness.mjs';
import {inspectCSV} from '../sites/taipei-city-lab/dist/modules/audit.js';
import fs from 'node:fs';

test('export flushes a pending parameter calculation before downloading CSV', async()=>{
  const h=await boot(null,'#shade');
  h.nodes.get('controls').oninput({target:{dataset:{key:'budget'},value:'0'}});
  h.nodes.get('export-csv').onclick();
  const csv=await h.downloads.at(-1).blob.text();
  assert.equal(csv.split('\r\n').length,1,'zero budget must export only headers, not old 20 rows');
});

test('fast navigation preserves newly changed parameters across reload', async()=>{
  const h=await boot(null,'#traffic');
  h.nodes.get('controls').oninput({target:{dataset:{key:'shift'},value:'55'}});
  h.go('shade');
  const stored=JSON.parse(h.storage.get('taipei-city-lab-v1')||'{}');
  assert.equal(stored.params?.traffic?.shift,55);
});

test('reset cancels pending calculation and leaves no stale timer',async()=>{
  const h=await boot(null,'#traffic');
  h.nodes.get('controls').oninput({target:{dataset:{key:'shift'},value:'55'}});
  h.nodes.get('reset').onclick();
  assert.equal([...h.timers.values()].filter(t=>t.delay===80).length,0);
});

test('audit preserves its question and reference date when navigating away and back',async()=>{
  const h=await boot(null,'#audit');
  h.nodes.get('csv-text').value='id,updated_at\n1,2026-10-13';
  h.nodes.get('audit-question').value='確認資料格式';
  h.nodes.get('audit-date').value='2026-10-14';
  h.nodes.get('run-audit').onclick();h.go('shade');h.go('audit');
  assert.equal(h.nodes.get('audit-question').value,'確認資料格式');
  assert.equal(h.nodes.get('audit-date').value,'2026-10-14');
});

test('editing audited CSV invalidates export until a new audit is run',async()=>{
  const h=await boot(null,'#audit');
  h.nodes.get('csv-text').value='id\n1';h.nodes.get('run-audit').onclick();
  h.nodes.get('csv-text').value='id\n2\n3';
  h.nodes.get('csv-text').oninput({target:h.nodes.get('csv-text')});
  const before=h.downloads.length;h.nodes.get('export-audit').onclick();
  assert.equal(h.downloads.length,before,'cannot export the previous one-row report for new data');
});

test('audit output records question and options for reproducible review',()=>{
  const r=inspectCSV('id,updated_at\n1,2026-10-13',{question:'確認資料格式',referenceDate:'2026-10-13',timezone:'Asia/Taipei',maxAgeDays:90});
  assert.equal(r.request.question,'確認資料格式');assert.equal(r.request.timezone,'Asia/Taipei');
  assert.equal(r.request.referenceDate,'2026-10-13');assert.equal(r.request.maxAgeDays,90);
});

test('timestamp freshness compares calendar dates in the selected timezone',()=>{
  const text='id,updated_at\n1,2026-10-13T00:30:00+08:00';
  const local=inspectCSV(text,{referenceDate:'2026-10-13',timezone:'Asia/Taipei'});
  const utc=inspectCSV(text,{referenceDate:'2026-10-13',timezone:'UTC'});
  assert.equal(local.freshness.ageDays,0);assert.equal(utc.freshness.ageDays,1);
  assert.equal(local.freshness.timezone,'Asia/Taipei');
});

test('changing only audit conditions invalidates the old report for export',async()=>{
  const h=await boot(null,'#audit');
  h.nodes.get('csv-text').value='id,updated_at\n1,2026-10-13';h.nodes.get('run-audit').onclick();
  h.nodes.get('audit-question').value='哪裡有熱點？';
  const before=h.downloads.length;h.nodes.get('export-audit').onclick();
  assert.equal(h.downloads.length,before);
  h.nodes.get('run-audit').onclick();h.nodes.get('export-audit').onclick();
  const report=JSON.parse(await h.downloads.at(-1).blob.text());
  assert.equal(report.request.question,'哪裡有熱點？');assert.equal(report.suitability.status,'unsuitable');
});

test('naive timestamps use the declared timezone and invalid timezones fail visibly',()=>{
  const text='日期\n2026-10-13 00:30:00';
  assert.equal(inspectCSV(text,{timezone:'Asia/Taipei'}).freshness.newest,'2026-10-12T16:30:00.000Z');
  const invalid=inspectCSV(text,{timezone:'invalid'});
  assert.equal(invalid.valid,false);assert.ok(invalid.findings.some(f=>f.code==='TIMEZONE'));
});

test('public source catalogue and data snapshot agree on publication state',()=>{
  const read=name=>JSON.parse(fs.readFileSync(new URL('../sites/taipei-city-lab/dist/data/'+name,import.meta.url),'utf8'));
  const snapshot=read('snapshot.json'),catalogue=read('source-catalog.json');
  assert.equal(catalogue.meta.buildStatus,snapshot.meta.buildStatus);
  assert.equal(catalogue.meta.retrievedAt,snapshot.meta.retrievedAt);
  assert.deepEqual(catalogue.sources,snapshot.sources);
});
