import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {allowedPages,workspaceForPage} from '../dist/data-utils.js';
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
 assert.deepEqual(await page.locator('#site-navigation a').allTextContents(),['熱點研究','政府分工','決策過程','參考資料']);
 for(const route of allowedPages){
  await page.goto(base+'#'+route);await page.waitForFunction(route=>document.body.dataset.page===route,route);
  assert.equal(await page.locator('.site-header [data-page][aria-current="page"]').getAttribute('data-page'),workspaceForPage(route),route);
  if(route!=='research')assert.ok(await page.locator('#panel-'+route+' .project-breadcrumb').isVisible(),route);
 }
 for(const route of ['methods','spec']){
  await page.goto(base+'#'+route);const reader=page.locator('#panel-'+route+' [data-reader]');
  assert.equal(await reader.locator('select:visible').count(),0);
  assert.equal(await reader.locator('[data-reader-item]:visible').count(),await reader.locator('[data-reader-item]').count());
 }
 await page.goto(base+'#research');
 assert.match(await page.locator('#panel-research').innerText(),/12 區.*尚未進行真人研究.*家戶本期不做/s);
 for(const route of ['analysis','plan','ideas'])assert.deepEqual(await page.locator('#panel-'+route+' > [data-reading-stage]').evaluateAll(xs=>xs.map(x=>x.dataset.readingStage)),['conclusion','details','pending','next']);
 const ids=await page.locator('[id]').evaluateAll(xs=>xs.map(x=>x.id));assert.equal(ids.length,new Set(ids).size);
 const links=await page.locator('#panel-research a[href^="#"],#panel-analysis a[href^="#"],#panel-ideas a[href^="#"],#panel-plan a[href^="#"]').evaluateAll(xs=>[...new Set(xs.map(x=>x.hash))]);
 for(const hash of links)assert.ok(ids.includes(hash.slice(1))||allowedPages.includes(hash.slice(1)),hash);
 assert.equal(await page.locator('#panel-districts [id^="citywide-area-"]').count(),13);
 assert.equal(await page.locator('#panel-districts [id^="plan-area-"]').count(),13);
 assert.equal(await page.locator('#panel-evidence .definition-evidence-list>article').count(),28);
 assert.equal(await page.locator('#panel-analysis #hotspot-government,#panel-plan #hotspot-heading').count(),0);
 // Follow an actual overview → analysis → idea → work-plan journey.
 await page.locator('#panel-research a[href="#analysis"]').first().click();
 await page.locator('#panel-analysis').waitFor({state:'visible'});
 await page.locator('#panel-analysis a[href="#ideas"]').click();await page.locator('#panel-ideas').waitFor({state:'visible'});
 await page.locator('#ideas-prd a[href="#definition-prd-validation"]').click();
 await page.waitForFunction(()=>document.activeElement.id==='definition-prd-validation');
 assert.ok(await page.locator('#panel-spec').isVisible());
 await page.goBack();await page.locator('#panel-ideas').waitFor({state:'visible'});
 await page.goForward();await page.waitForFunction(()=>document.activeElement.id==='definition-prd-validation');
 // Retained fragments resolve from their content owner, including moved evidence and government sources.
 const targets={
  analysis:['hotspot-candidates','analysis-findings'],
  team:['definition-prd-roles','definition-prd-next'],
  methods:['hotspot-heading','hotspot-quality','hotspot-times','field-schedule','field-capacity','field-record'],
  districts:['citywide-area-12','plan-area-13'],
  evidence:['definition-focus-P01','definition-evidence-E06-S2','research-overview-evidence-youbike'],
  ideas:['definition-evidence-heading','t1-process-heading','t1-thinking-heading'],
  work:['hotspot-government','hotspot-handoff','government-handoff','government-inquiry'],
  spec:['definition-prd-heading','definition-prd-risks-heading','definition-not-doing-heading','research-overview-scope'],
  plan:['plan-work-heading'],
  archive:['plan-budget'],
  definition:['definition-decision-D18','definition-prd-v02-heading','definition-history-heading'],
  materials:['research-synthesis','conclusion-siting','conclusion-household','current-evidence-heading','problem-map-heading','district-service-heading','service-method','service-prototype','service-scenarios','service-measures']
 };
 for(const [owner,anchors] of Object.entries(targets))for(const id of anchors){
  await page.goto(base+'#'+id);await page.waitForFunction(id=>document.activeElement.id===id,id);
  assert.ok(await page.locator('#panel-'+owner).isVisible(),id);
  assert.equal(await page.locator('.page-panel:visible').count(),1,id);
 }
 // Every reader item is reachable by the selector and exposes only one item.
 let readerItems=0;
 for(const route of ['districts','evidence','work','archive','definition']){
  await page.goto(base+'#'+route);const reader=page.locator('#panel-'+route+' [data-reader]');
  const options=await reader.locator('select option').evaluateAll(xs=>xs.map(x=>x.value));
  assert.ok(options.length>0,route);
  for(const id of options){
   await reader.locator('select').selectOption(id);
   await page.waitForFunction(id=>location.hash==='#'+id,id);
   assert.equal(await reader.locator('[data-reader-item]:visible').count(),1,id);
   assert.ok(await page.locator('#'+id).isVisible());readerItems++;
  }
  assert.equal(await reader.locator('[data-reader-next]:visible').count(),0);
  await reader.locator('[data-reader-prev]').click();
  assert.equal(await reader.locator('select').inputValue(),options.at(-2));
  await reader.locator('select').selectOption(options[0]);
  await page.waitForFunction(id=>location.hash==='#'+id,options[0]);
  assert.equal(await reader.locator('[data-reader-prev]:visible').count(),0);
 }
 const lengths={};
 for(const width of [1440,720,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const route of ['research','analysis','ideas','plan','library','team','districts','methods','evidence','work','spec','archive']){
   await page.goto(base+'#'+route);await page.waitForFunction(route=>document.body.dataset.page===route,route);
   assert.equal(await page.locator('.page-panel:visible').count(),1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+route+' '+width);
   assert.equal(await page.locator('.site-header [data-page][aria-current="page"]').getAttribute('data-page'),workspaceForPage(route));
   if(['analysis','ideas','plan'].includes(route))lengths[route]=(await page.locator('#panel-'+route).innerText()).replace(/\s/g,'').length;
   if(width<960){
    await page.locator('#site-menu-toggle').click();assert.equal(await page.locator('#site-menu-toggle').getAttribute('aria-expanded'),'true');
    const next=route==='analysis'?'ideas':'analysis';await page.locator('#site-navigation a[data-page="'+next+'"]').click();
    await page.waitForFunction(next=>document.body.dataset.page===next,next);
    assert.equal(await page.locator('#site-menu-toggle').getAttribute('aria-expanded'),'false');
    await page.goto(base+'#'+route);
   }
   await page.waitForTimeout(100);await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   if([1440,390].includes(width))await page.screenshot({path:resolve(qa,route+'-'+width+'.png')});
  }
 }
 // Selector changes keep the control available below the mobile header.
 for(const width of [390,320]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'#districts');
  await page.locator('#reader-select-districts').selectOption('reader-district-12');
  await page.waitForFunction(()=>document.activeElement.id==='reader-district-12');await page.waitForTimeout(100);
  const box=await page.locator('#reader-select-districts').boundingBox();
  const header=await page.locator('.site-header').boundingBox();
  assert.ok(box.y>=header.y+header.height&&box.y+box.height<=1000,'selector visible '+width);
  if(width===390)await page.screenshot({path:resolve(qa,'district-selected-390.png')});
 }
 // No-script readers can switch all four pages and follow moved exact evidence.
 const plain=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:1000},reducedMotion:'reduce'});const nojs=await plain.newPage();
 await nojs.goto(base);
 for(const route of ['analysis','ideas','plan','research']){
  await nojs.locator('.site-header a[href="#'+route+'"]').click();
  assert.ok(await nojs.locator('#panel-'+route).isVisible(),route+' no-js');
  assert.equal(await nojs.locator('.page-panel:visible').count(),1);
 }
 await nojs.goto(base+'#definition-evidence-E06-S2');assert.ok(await nojs.locator('#definition-evidence-E06-S2').isVisible());
 for(const [route,target] of [['districts','citywide-area-12'],['work','work-WP01'],['archive','plan-budget'],['spec','definition-prd-validation']]){
  await nojs.goto(base+'#'+target);
  assert.ok(await nojs.locator('#'+target).isVisible());
  assert.ok((await nojs.locator('#panel-'+route+' [data-reader-item]:visible').count())>=(route==='spec'?9:1));
  await nojs.locator('#panel-'+route+' .reader-index a').first().click();
  assert.ok((await nojs.locator('#panel-'+route+' [data-reader-item]:visible').count())>=(route==='spec'?9:1));
 }
 await plain.close();assert.deepEqual(errors,[]);
 const result={passed:true,pages:['research','analysis','ideas','plan'],links:links.length,legacy:Object.values(targets).flat().length,widths:[1440,720,390,320],no_js:true,readerItems,lengths,errors};
 await writeFile(resolve(qa,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
