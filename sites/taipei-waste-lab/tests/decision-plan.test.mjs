import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pageFromHash,workspaceForPage,allowedPages} from '../dist/data-utils.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('current checks are conditional decisions with frozen inputs and no field outcomes or quota',()=>{
 const dir='research/decision-checks-2026-10-22/';
 const plan=JSON.parse(read(dir+'checks.json'));
 assert.equal(plan.district_quota,null);assert.deepEqual(plan.scheduled_visits,[]);
 for(const c of plan.checks){assert.equal(c.outcome,null);for(const key of ['decision','known','desk','trigger','yes','no','unknown'])assert.ok(c[key]?.trim(),`${c.id}: ${key}`);}
 for(const s of JSON.parse(read(dir+'inputs.json')).sources)assert.equal(createHash('sha256').update(read(dir+s.path)).digest('hex'),s.sha256,s.path);
 const page=read('dist/index.html');
 assert.ok(!allowedPages.includes('methods'));assert.equal(workspaceForPage('team'),'plan');
 for(const route of ['ideas','ideas-options','ideas-heading','methods','field-priority','reader-field-forms','plan-check-Q01','plan-check-Q05','plan-crew-research','plan-crew-research-heading','plan-overlay','plan-overlay-heading','plan-candidates','plan-candidates-heading','plan-execution'])assert.equal(pageFromHash('#'+route),'plan-tools');
 assert.equal(pageFromHash('#plan-schedule-summary'),'plan');
 for(const route of ['plan-crew-research-history','plan-prior-field-plan'])assert.equal(pageFromHash('#'+route),'archive');
 assert.ok(!page.includes('id="panel-methods"'));
 assert.ok(!page.includes('id="panel-ideas"'));assert.ok(!page.includes('先前方案'));
 assert.equal(workspaceForPage('spec'),'plan');
 const primary=page.match(/<nav id="site-navigation".*?<\/nav>/s)[0];
 assert.equal((primary.match(/data-page=/g)||[]).length,4);assert.ok(!primary.includes('#ideas'));
 assert.match(page,/<details[^>]+id="plan-prior-field-plan"[^>]*><summary>歷史排程/);
 const current=page.split('<!-- decision-checks-start -->')[1].split('<!-- decision-checks-end -->')[0];
 assert.equal((current.match(/data-decision-check=/g)||[]).length,plan.checks.length);
 assert.ok(current.includes('取消每區一點與固定三輪配額'));
});

test('schedule deep links belong to a dedicated page with one generated chart',()=>{
 const page=read('dist/index.html');
 assert.ok(allowedPages.includes('plan-timeline'));
 assert.equal(workspaceForPage('plan-timeline'),'plan');
 for(const id of ['plan-timeline','plan-timeline-heading','plan-100day','plan-100day-heading'])assert.equal(pageFromHash('#'+id),'plan-timeline');
 const schedule=page.split('id="panel-plan-timeline"')[1].split('<section id="panel-')[0];
 const overview=page.split('id="panel-plan"')[1].split('<section id="panel-')[0];
 assert.ok(schedule.includes('id="plan-100day"'));
 assert.equal(pageFromHash('#plan-schedule-details'),'plan-readiness');
 assert.ok(schedule.includes('href="#plan-resources"'));
 assert.ok(overview.includes('href="#plan-timeline"'));
 assert.ok(!overview.includes('class="plan-timeline"'));
 assert.equal((page.match(/class="plan-timeline"/g)||[]).length,2);
 assert.equal((schedule.match(/class="plan-timeline-label"/g)||[]).length,6);
 const ids=[...page.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'New route must not shadow historical timeline IDs');
});

test('Gantt exposes task outputs and proposed roles in separate before/after phases',()=>{
 const page=read('dist/index.html');
 const chart=[...page.matchAll(/<figure class="plan-timeline">(.*?)<\/figure>/gs)].map(m=>m[1]).join('');
 assert.ok(!chart.includes('<details'));
 assert.equal((chart.match(/class="plan-gantt-mobile-label"/g)||[]).length,20);
 assert.ok(!chart.includes('class="plan-gantt-mobile-label" aria-hidden'));
 const phases=[...chart.matchAll(/<tbody data-phase="(before|after)">(.*?)<\/tbody>/gs)];
 assert.deepEqual(phases.map(m=>m[1]),['after','before']);
 assert.deepEqual(phases.map(m=>(m[2].match(/class="plan-gantt-task"/g)||[]).length),[6,4]);
 const rows=[...chart.matchAll(/<tr class="plan-gantt-task">(.*?)<\/tr>/gs)].map(m=>m[1]);
 for(const row of rows){
  assert.match(row,/class="plan-timeline-label"/);
  assert.match(row,/class="plan-gantt-output"/);
  assert.match(row,/class="plan-gantt-owner"/);
 }
 for(const [task,output,owner] of [
  ['試用與候選覆核','初步基線或待辦缺口','清潔／管理者＋分析者'],
  ['配對與方案比較','配置提案或維持現況理由','規劃者＋覆核者'],
  ['核准後小範圍試調','未執行原因','管理者＋執行者'],
  ['成效判讀與交接','後續責任','覆核者＋管理者']
 ]){const row=rows.find(r=>r.includes(task));assert.ok(row?.includes(output));assert.ok(row?.includes(owner));}
 assert.ok(page.includes('未核准不搬'));
 assert.ok(page.includes('未取得同意就維持模擬與資料準備'));
});

test('plan hub is short and all moved deep links resolve to the panel containing them',()=>{
 const page=read('dist/index.html');
 const hub=page.split('<section id="panel-plan"')[1].split('<section id="panel-')[0];
 assert.ok(!hub.includes('id="plan-resources"'));
 assert.ok(!hub.includes('id="plan-validation"'));
 assert.ok(!hub.includes('id="plan-execution"'));
 assert.ok(hub.replace(/<[^>]+>/g,'').length<1800);
 for(const route of ['plan-preparation','plan-resourcing','plan-readiness','plan-tools']){
  assert.equal(workspaceForPage(route),'plan');
  const block=page.split('<section id="panel-'+route+'"')[1].split('<section id="panel-')[0];
  for(const id of [...block.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]))assert.equal(pageFromHash('#'+id),route,id);
 }
 assert.equal(pageFromHash('#plan-acceptance'),'archive');
});
