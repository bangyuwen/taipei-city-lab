import test from 'node:test';
import assert from 'node:assert/strict';
import {shade} from '../dist/modules/shade.js';
import {bins} from '../dist/modules/bins.js';
import {traffic,simulateQueue} from '../dist/modules/traffic.js';
import {bus,simulateShuttle} from '../dist/modules/bus.js';
import {clusteredDemand,syntheticGrid,bboxOf,greedyCoverage,coverageBy,coverageStats} from '../dist/modules/spatial.js';
import {workflowDefs,caseView,advanceCase} from '../dist/workflows.js';
import {inspectCSV} from '../dist/modules/audit.js';
import {boot} from './helpers/app-harness.mjs';
const metric=(r,label)=>r.metrics.find(m=>m.label===label).value;

test('clustered demand conserves coarse weights without co-locating all demand with candidates',()=>{
  const bbox=bboxOf({}),coarse=syntheticGrid(bbox,12,'demand'),demand=clusteredDemand(bbox);
  assert.equal(demand.length,1296);
  assert.ok(Math.abs(coarse.reduce((s,p)=>s+p.weight,0)-demand.reduce((s,p)=>s+p.weight,0))<1e-8);
  assert.equal(new Set(demand.map(p=>p.x+','+p.y)).size,1296);
});
test('zero growth gives no benefit while existing-tree baseline remains unchanged',()=>{
  const data={trees:[{x:121.5675,y:25.0775}]};
  const zero=shade.evaluate({years:0,budget:20},data),mature=shade.evaluate({years:10,budget:20},data);
  assert.equal(zero.table.rows.length,0);assert.equal(metric(zero,'相對已知樹點基準增加'),0);
  assert.equal(metric(zero,'已知樹點基準可及率'),metric(mature,'已知樹點基準可及率'));
  assert.ok(metric(mature,'推薦方案需求可及率')>metric(zero,'推薦方案需求可及率'));
});
test('sparse greedy objective matches an independently recomputed first choice',()=>{
  const demand=[{x:0,y:0,zone:0,weight:4},{x:.002,y:0,zone:1,weight:2},{x:.004,y:0,zone:2,weight:3}];
  const candidates=[{id:'A',x:0,y:0},{id:'B',x:.002,y:0},{id:'C',x:.004,y:0}];
  for(const fairness of [0,.4,1]){
    const scores=candidates.map(p=>{const s=coverageStats(coverageBy([p],demand,150),demand);return (1-fairness)*s.rate+fairness*s.fairnessUtility;});
    const expected=candidates[scores.indexOf(Math.max(...scores))].id;
    assert.equal(greedyCoverage([],candidates,demand,1,150,fairness).selected[0].id,expected);
  }
});
test('siting mask excludes candidates from both allocation and map',()=>{
  for(const module of [shade,bins]){
    const r=module.evaluate({siting:'constrained',budget:100});
    assert.equal(r.model.candidateCount,108);
    assert.ok(r.map.points.filter(p=>p.kind==='candidate'||p.selected).every(p=>(Number(p.id.split('-')[1])-1)%4!==0));
  }
});
test('maintenance hours constrain additions, including zero labor capacity',()=>{
  const r=bins.evaluate({budget:100,laborHours:1,serviceMinutes:10,collections:3});
  assert.equal(r.model.effectiveBudget,2);assert.ok(r.table.rows.length<=2);
  assert.ok(metric(r,'新增桶每日清運工時')<=1);
  assert.equal(bins.evaluate({laborHours:0,budget:100}).table.rows.length,0);
});
test('detour lowers straight-distance threshold and cannot improve unchanged baseline',()=>{
  const data={bins:[{x:121.566,y:25.0775}]};
  const direct=bins.evaluate({detour:1,budget:0},data),detour=bins.evaluate({detour:3,budget:0},data);
  assert.equal(detour.model.effectiveRadius,100);
  assert.ok(metric(detour,'已知垃圾桶基準服務率')<=metric(direct,'已知垃圾桶基準服務率'));
});
test('two-arrival hand calculation reconciles vehicle-hour delay and queue conservation',()=>{
  const p=simulateQueue([4,0],2);
  assert.deepEqual(p.queue,[2,0]);assert.equal(p.waitingArea,2);assert.equal(p.meanWait,.5);
  assert.equal(p.served.reduce((s,n)=>s+n,0),4);
  const r=traffic.evaluate({shift:0});
  assert.equal(metric(r,'情境總延滯')*60,r.model.scenarioWaitingArea);
  assert.equal(metric(r,'等待變化（相對未錯峰）'),0);
  assert.equal(r.secondaryChart.series[0].values.length,r.secondaryChart.labels.length);
});
test('shuttle comparison uses the same arrivals and includes left-behind waiting',()=>{
  const r=bus.evaluate({fleet:1,headway:3,demand:600,breakMinutes:30});
  assert.equal(r.comparison.demand,r.comparison.baselineDemand);
  assert.ok(r.comparison.remaining>r.comparison.baselineRemaining);
  assert.ok(r.comparison.waitingArea>r.comparison.baselineWaitingArea);
  const p=simulateShuttle({demand:600,fleet:1});assert.equal(p.boarded+p.remaining,p.total);
  assert.equal(p.waitingArea,p.queue.reduce((s,n)=>s+n,0));
});
test('both follow-up workflows require confirmation before completion and preserve dated history',()=>{
  for(const id of ['rat','buildings']){
    let value;
    for(let i=0;i<3;i++)value=advanceCase(id,value,'2026-10-13');
    assert.equal(value.stage,3);assert.throws(()=>advanceCase(id,value,'2026-10-14'),/確認/);
    assert.equal(caseView(id,value,'2026-11-01').overdue,true);
    value=advanceCase(id,value,'2026-11-01',true);
    assert.equal(value.stage,4);assert.equal(value.history.length,4);
    assert.equal(caseView(id,value,'2026-11-02').overdue,false);
    assert.throws(()=>advanceCase(id,value,'2026-11-02',true),/完成/);
  }
  assert.throws(()=>advanceCase('rat',null,'2026-02-30'),/有效/);
  assert.equal(caseView('rat',{stage:3,due:'2026-99-01'},'2026-10-13').due,'');
});
test('workflow state updates through real app handlers and remains separate from scores',async()=>{
  const h=await boot(null,'#rat');
  const before=h.nodes.get('metrics').innerHTML;
  h.nodes.get('workflow').onclick({target:{dataset:{advance:'R-01'}}});
  assert.equal(h.api.getState().workflows.rat['R-01'].stage,1);
  assert.equal(h.nodes.get('metrics').innerHTML,before);
  h.go('buildings');assert.match(h.nodes.get('workflow').innerHTML,/不表示建物安全/);
  h.go('bus');assert.equal(h.nodes.get('workflow').innerHTML,'');
});
test('contract checks composite keys, null codes and numeric ranges without modifying input',()=>{
  const text='id,day,lat\n1,A,25\n1,B,NA\n1,A,100';
  const r=inspectCSV(text,{contract:{required:['lat'],key:['id','day'],ranges:{lat:[-90,90]}}});
  assert.equal(r.valid,false);assert.equal(r.contract.violationCount,3);
  assert.ok(['CONTRACT_NULL','CONTRACT_KEY','CONTRACT_RANGE'].every(code=>r.findings.some(f=>f.code===code)));
  const good=inspectCSV('id,day,lat\n1,A,25\n1,B,26',{contract:{key:['id','day'],ranges:{lat:[-90,90]}}});
  assert.equal(good.contract.valid,true);assert.deepEqual(good.request.contract.key,['id','day']);
});
test('invalid contracts and absent columns fail visibly instead of silently skipping rules',()=>{
  for(const contract of ['{bad',[],{ranges:{lat:[90,-90]}},{require:['id']}]){
    const r=inspectCSV('id\n1',{contract});assert.equal(r.valid,false);assert.ok(r.findings.some(f=>f.code==='CONTRACT_SYNTAX'));
  }
  const absent=inspectCSV('id\n1',{contract:{required:['missing']}});
  assert.equal(absent.valid,false);assert.ok(absent.findings.some(f=>f.code==='CONTRACT_COLUMN'));
});
test('contract editing invalidates the old audit and records the new contract on export',async()=>{
  const h=await boot(null,'#audit');
  h.nodes.get('csv-text').value='id\n1\n1';h.nodes.get('run-audit').onclick();
  h.nodes.get('audit-contract').value='{"key":["id"]}';
  h.nodes.get('audit-contract').oninput();const before=h.downloads.length;h.nodes.get('export-audit').onclick();
  assert.equal(h.downloads.length,before);
  h.nodes.get('run-audit').onclick();h.nodes.get('export-audit').onclick();
  const r=JSON.parse(await h.downloads.at(-1).blob.text());assert.equal(r.contract.valid,false);
  assert.deepEqual(r.request.contract.key,['id']);
});
test('shared parameters roundtrip while unknown fields and local content are excluded',async()=>{
  const h=await boot(null,'#bus?fleet=1&headway=3&breakMinutes=20&demand=600&csv=secret');
  assert.equal(h.api.paramsFor(bus).fleet,1);assert.equal(h.api.paramsFor(bus).demand,600);
  assert.equal(h.api.paramsFor(bus).csv,undefined);
  h.nodes.get('share-scenario').onclick();const url=h.nodes.get('scenario-url').value;
  assert.ok(!url.includes('secret'));const second=await boot(null,url);
  assert.equal(JSON.stringify(second.api.paramsFor(bus)),JSON.stringify(h.api.paramsFor(bus)));
});
test('unsafe shared values fall back, clamp and snap to the control contract',async()=>{
  const h=await boot(null,'#traffic?shift=999&delay=53&capacity=nope');
  const p=h.api.paramsFor(traffic);assert.equal(p.shift,80);assert.equal(p.delay,55);assert.equal(p.capacity,1500);
});
