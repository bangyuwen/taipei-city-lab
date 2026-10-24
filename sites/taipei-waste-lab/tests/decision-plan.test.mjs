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
 for(const route of ['ideas','ideas-options','ideas-heading','methods','field-priority','reader-field-forms','plan-check-Q01','plan-check-Q05','plan-crew-research','plan-crew-research-heading','plan-100day','plan-100day-heading','plan-overlay','plan-overlay-heading','plan-candidates','plan-candidates-heading','plan-schedule-details','plan-execution'])assert.equal(pageFromHash('#'+route),'plan');
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
