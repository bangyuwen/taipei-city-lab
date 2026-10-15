import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {binSnapshotFacts,binBenchmark,researchAnswer,answerSources} from '../sites/taipei-city-lab/dist/answers.js';
import {bins} from '../sites/taipei-city-lab/dist/modules/bins.js';
import {modules} from '../sites/taipei-city-lab/dist/registry.js';
import {boot} from './helpers/app-harness.mjs';
import {inspectCSV} from '../sites/taipei-city-lab/dist/modules/audit.js';
const data=JSON.parse(fs.readFileSync(new URL('../sites/taipei-city-lab/dist/data/snapshot.json',import.meta.url)));

test('observed district counts reconcile to the actual snapshot without adding synthetic sites',()=>{
  const facts=binSnapshotFacts(data);
  assert.equal(facts.count,294);assert.equal(facts.districts.reduce((n,d)=>n+d.count,0),294);
  const original=data.bins.filter(p=>p.district==='中正區');
  assert.equal(facts.districts.find(d=>d.name==='中正區').count,original.length);
  assert.equal(facts.districts.length,7);
});
test('quantity comparisons keep non-budget conditions and the labor limit fixed',()=>{
  const params={...bins.defaults,budget:17,laborHours:1,detour:2,fairness:80};
  const rows=binBenchmark(params,data);
  assert.ok(rows.some(r=>r.budget===17));assert.equal(rows[0].gain,0);
  for(const row of rows){
    const direct=bins.evaluate({...params,budget:row.budget},data);
    assert.equal(row.rate,direct.metrics.find(m=>m.label==='推薦方案需求服務率').value);
    assert.ok(row.selected<=5);assert.ok(row.labor<=1);assert.equal(row.baseline,rows[0].baseline);
  }
});
test('all seven answers expose a conclusion, evidence limits and reproducible model conditions',()=>{
  for(const m of modules){
    const result=m.evaluate(m.defaults,data),a=researchAnswer({id:m.id,result,data,params:m.defaults});
    assert.ok(a.headline&&a.conclusion&&a.gaps.length&&a.basis.length);assert.deepEqual(a.params,m.defaults);
    assert.equal(a.metrics,result.metrics);assert.equal(a.modelTable,result.table);assert.equal(a.snapshotMeta,data.meta);
    if(m.id==='bins')assert.ok(a.references.filter(s=>s.status.includes('未載入')).length>=3);
  }
  assert.ok(answerSources.siting.url.startsWith('https://www.dep.gov.taipei/'));
});
test('answer export uses changed conditions and includes the actual provenance and conditional table',async()=>{
  const h=await boot(null,'#bins');h.change('budget','0');
  h.nodes.get('research-answer').onclick({target:{closest:()=>({})}});
  const a=JSON.parse(await h.downloads.at(-1).blob.text());
  assert.equal(a.params.budget,0);assert.equal(a.modelTable.rows.length,0);
  assert.equal(a.benchmark.find(r=>r.budget===0).gain,0);assert.equal(a.snapshot.count,294);
  assert.ok(a.sources.find(s=>s.id==='bins').counts);assert.match(a.modelLabel,/並非實際政策成效/);
});
test('CSV answers report actual rule failures without claiming to answer the research question',()=>{
  const m=modules.find(m=>m.id==='audit'),report=inspectCSV('id,value\n1,\n1,',{question:'清洁箱需求',contract:{required:['value']}});
  const a=researchAnswer({id:'audit',result:m.evaluate(m.defaults,data),data,params:m.defaults,report});
  assert.match(a.status,/錯誤/);assert.match(a.conclusion,/不代表已回答/);
  assert.equal(a.csv.rows,2);assert.equal(a.csv.columns,2);assert.equal(a.csv.findings,report.findings);
});
test('editing each audited input withdraws the checked conclusion and matches the answer export',async()=>{
  for(const [id,changed] of [['csv-text','id\n1\n2'],['audit-question','新的研究問題'],['audit-date','2026-10-14'],['audit-timezone','UTC'],['audit-contract','{"required":["id"]}']]){
    const h=await boot(null,'#audit');h.nodes.get('csv-example').onclick();
    assert.match(h.nodes.get('research-answer').innerHTML,/已檢查 4 列/);
    const input=h.nodes.get(id);input.value=changed;input.oninput({target:input});
    assert.match(h.nodes.get('research-answer').innerHTML,/目前輸入尚未檢查/);
    assert.doesNotMatch(h.nodes.get('research-answer').innerHTML,/已檢查 4 列|發現 0 項錯誤與 5 項提醒/);
    h.nodes.get('research-answer').onclick({target:{closest:()=>({})}});
    const exported=JSON.parse(await h.downloads.at(-1).blob.text());
    assert.equal(exported.pendingAudit,true);assert.equal(exported.csv,undefined);assert.equal(exported.status,'目前輸入尚未檢查');
    h.nodes.get('run-audit').onclick();assert.doesNotMatch(h.nodes.get('research-answer').innerHTML,/目前輸入尚未檢查/);
  }
});
