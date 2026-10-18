import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {pageFromHash,allowedPages} from '../dist/data-utils.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const base=process.env.RESEARCH_QA_URL||'http://127.0.0.1:4174/';
const qa=resolve('qa/research-overview');await mkdir(qa,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'#research');await page.locator('#panel-research').waitFor({state:'visible'});
 const home=page.locator('#panel-research');
 assert.equal(await home.locator('details,iframe').count(),0);
 assert.equal(await home.locator('#research-overview-conclusions article').count(),3);
 assert.equal(await home.locator('#conclusion-household,#service-prototype,#problem-map-heading').count(),0);
 assert.match(await home.innerText(),/進入 MVP 原型階段.*效果待驗證.*尚未進行真人研究.*家戶本期不做/s);
 assert.equal(await page.locator('#research-navigation a[href="#siting"]').count(),0);
 const ids=await page.locator('[id]').evaluateAll(xs=>xs.map(x=>x.id));assert.equal(ids.length,new Set(ids).size);
 const links=await home.locator('a[href^="#"]').evaluateAll(xs=>xs.map(x=>x.hash));
 for(const hash of links){
  const target=hash.slice(1);const selector=allowedPages.includes(target)?'#panel-'+target:'#'+target;
  const panel=await page.locator(selector).evaluate(el=>el.closest('.page-panel')?.id);
  assert.equal(panel,'panel-'+pageFromHash(hash),hash);
 }
 // An overview claim reaches its supporting text, exact evidence, and current definition.
 await home.locator('a[href="#research-overview-evidence-youbike"]').click();
 await page.waitForFunction(()=>document.activeElement.id==='research-overview-evidence-youbike');
 await home.locator('a[href="#definition-evidence-E06"]').click();
 await page.waitForFunction(()=>document.activeElement.id==='definition-evidence-E06');
 assert.ok(await page.locator('#definition-evidence-E06-S2').isVisible());
 await page.goBack();await page.waitForFunction(()=>document.activeElement.id==='research-overview-evidence-youbike');
 // Old public fragments reach preserved material, never an unrelated current conclusion.
 const legacy=['research-synthesis','conclusion-siting','conclusion-household','current-evidence-heading','problem-map-heading','district-service-heading','service-method','service-prototype','service-scenarios','service-measures'];
 for(const id of legacy){
  await page.goto(base+'#'+id);await page.locator('#panel-materials').waitFor({state:'visible'});
  await page.waitForFunction(id=>document.activeElement.id===id,id);
  assert.ok(await page.locator('#'+id).isVisible(),id);
 }
 assert.equal(await page.locator('#panel-materials [data-service-district]').count(),12);
 assert.equal(await page.locator('#panel-materials #research-synthesis>article').count(),3);
 // Candidate streets remain accessible from the historical materials entry.
 await page.goto(base+'#materials');await page.locator('#panel-materials a[href="#siting"][data-page]').click();
 await page.locator('#panel-siting').waitFor({state:'visible'});
 await page.goto(base+'#research');
 await home.locator('a[href="#definition-not-doing-heading"]').click();
 await page.waitForFunction(()=>document.activeElement.id==='definition-not-doing-heading');
 assert.match(await page.locator('#definition-scope-heading').innerText(),/家戶/);
 for(const width of [1440,720,390,320]){
  const height=width<640?844:1000;
  const screen=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  screen.on('pageerror',error=>errors.push(error.message));
  await screen.goto(base+'#research');
  await screen.waitForFunction(()=>document.body.dataset.page==='research'&&scrollY===0);
  assert.ok(await screen.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);
  const entry=await screen.locator('.research-overview-header a[href="#definition-prd-heading"]').boundingBox();
  assert.ok(entry.y>=0&&entry.y+entry.height<=height,'decision and PRD entry in first viewport '+width+' '+JSON.stringify(entry));
  if([1440,390].includes(width)){
   await screen.screenshot({path:resolve(qa,`summary-${width}.png`)});
   await screen.goto(base+'#research-overview-evidence');
   await screen.waitForFunction(()=>document.activeElement.id==='research-overview-evidence');
   await screen.screenshot({path:resolve(qa,`evidence-${width}.png`)});
  }
  await screen.close();
 }
 const plain=await browser.newContext({javaScriptEnabled:false,reducedMotion:'reduce',viewport:{width:390,height:844}});
 const nojs=await plain.newPage();await nojs.goto(base+'#research');
 assert.equal(await nojs.locator('#research-overview-conclusions article:visible').count(),3);
 await nojs.locator('a[href="#research-overview-evidence-youbike"]').click();
 assert.ok(await nojs.locator('#research-overview-evidence-youbike').isVisible());await plain.close();
 assert.deepEqual(errors,[]);
 const result={passed:true,homeLinks:links.length,legacyFragments:legacy.length,conclusions:3,widths:[1440,720,390,320],no_js_summary:true,errors};
 await writeFile(resolve(qa,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
