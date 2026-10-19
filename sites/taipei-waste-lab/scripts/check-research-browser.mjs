import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {allowedPages} from '../dist/data-utils.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const base=process.env.RESEARCH_QA_URL||'http://127.0.0.1:4174/';
const qa=resolve('qa/research-pages');await mkdir(qa,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await page.locator('#panel-research').waitFor({state:'visible'});
 assert.equal(await page.locator('#panel-research article').count(),3);
 assert.equal(await page.locator('#panel-research table,#panel-research details,#panel-research iframe').count(),0);
 assert.match(await page.locator('#panel-research').innerText(),/12 區.*尚未進行真人研究.*家戶本期不做/s);
 const ids=await page.locator('[id]').evaluateAll(xs=>xs.map(x=>x.id));assert.equal(ids.length,new Set(ids).size);
 const links=await page.locator('#panel-research a[href^="#"],#panel-analysis a[href^="#"],#panel-ideas a[href^="#"],#panel-plan a[href^="#"]').evaluateAll(xs=>[...new Set(xs.map(x=>x.hash))]);
 for(const hash of links)assert.ok(ids.includes(hash.slice(1))||allowedPages.includes(hash.slice(1)),hash);
 assert.equal(await page.locator('#panel-analysis .citywide-district').count(),13);
 assert.equal(await page.locator('#panel-plan [id^="plan-area-"]').count(),13);
 assert.equal(await page.locator('#panel-analysis .definition-evidence-list>article').count(),28);
 assert.equal(await page.locator('#panel-analysis #hotspot-government,#panel-plan #hotspot-heading').count(),0);
 // Follow an actual overview → analysis → idea → work-plan journey.
 await page.locator('#panel-research h3 a[href="#analysis"]').click();
 await page.locator('#panel-analysis').waitFor({state:'visible'});
 await page.locator('#panel-analysis a[href="#ideas"]').click();await page.locator('#panel-ideas').waitFor({state:'visible'});
 await page.locator('#panel-ideas a[href="#definition-prd-validation"]').click();
 await page.waitForFunction(()=>document.activeElement.id==='definition-prd-validation');
 assert.ok(await page.locator('#panel-plan').isVisible());
 await page.goBack();await page.locator('#panel-ideas').waitFor({state:'visible'});
 await page.goForward();await page.waitForFunction(()=>document.activeElement.id==='definition-prd-validation');
 // Retained fragments resolve from their content owner, including moved evidence and government sources.
 const targets={
  analysis:['hotspot-heading','hotspot-quality','citywide-area-12','definition-focus-P01','definition-evidence-E06-S2','research-overview-evidence-youbike'],
  ideas:['definition-evidence-heading','definition-prd-risks-heading','definition-not-doing-heading','research-overview-scope','t1-process-heading'],
  plan:['hotspot-government','hotspot-times','hotspot-handoff','definition-prd-heading','t1-thinking-heading','plan-budget'],
  definition:['definition-decision-D18','definition-prd-v02-heading','definition-history-heading'],
  materials:['research-synthesis','conclusion-siting','conclusion-household','current-evidence-heading','problem-map-heading','district-service-heading','service-method','service-prototype','service-scenarios','service-measures']
 };
 for(const [owner,anchors] of Object.entries(targets))for(const id of anchors){
  await page.goto(base+'#'+id);await page.waitForFunction(id=>document.activeElement.id===id,id);
  assert.ok(await page.locator('#panel-'+owner).isVisible(),id);
  assert.equal(await page.locator('.page-panel:visible').count(),1,id);
 }
 for(const width of [1440,720,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const route of ['research','analysis','ideas','plan']){
   await page.goto(base+'#'+route);await page.waitForFunction(route=>document.body.dataset.page===route,route);
   assert.equal(await page.locator('.page-panel:visible').count(),1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+route+' '+width);
   assert.equal(await page.locator('#site-navigation [aria-current="page"]').getAttribute('data-page'),route);
   if(width<960){
    await page.locator('#site-menu-toggle').click();assert.equal(await page.locator('#site-menu-toggle').getAttribute('aria-expanded'),'true');
    const next=route==='analysis'?'ideas':'analysis';await page.locator('#site-navigation a[data-page="'+next+'"]').click();
    await page.waitForFunction(next=>document.body.dataset.page===next,next);
    assert.equal(await page.locator('#site-menu-toggle').getAttribute('aria-expanded'),'false');
    await page.goto(base+'#'+route);
   }
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   if([1440,390].includes(width))await page.screenshot({path:resolve(qa,route+'-'+width+'.png')});
  }
 }
 // No-script readers can switch all four pages and follow moved exact evidence.
 const plain=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:1000}});const nojs=await plain.newPage();
 await nojs.goto(base);
 for(const route of ['analysis','ideas','plan','research']){
  await nojs.locator('#site-navigation a[href="#'+route+'"]').click();
  assert.ok(await nojs.locator('#panel-'+route).isVisible(),route+' no-js');
  assert.equal(await nojs.locator('.page-panel:visible').count(),1);
 }
 await nojs.goto(base+'#definition-evidence-E06-S2');assert.ok(await nojs.locator('#definition-evidence-E06-S2').isVisible());
 await plain.close();assert.deepEqual(errors,[]);
 const result={passed:true,pages:['research','analysis','ideas','plan'],links:links.length,legacy:Object.values(targets).flat().length,widths:[1440,720,390,320],no_js:true,errors};
 await writeFile(resolve(qa,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
