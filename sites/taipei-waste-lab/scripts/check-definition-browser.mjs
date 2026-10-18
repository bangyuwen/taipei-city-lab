import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const base=process.env.DEFINITION_QA_URL||process.env.THINKING_QA_URL||'http://127.0.0.1:4189/';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const qa=resolve('qa/single-page');await mkdir(qa,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'#t1-process-heading');await page.locator('#panel-definition').waitFor({state:'visible'});
 assert.equal(await page.locator('#panel-definition details,#panel-definition summary,#panel-definition iframe').count(),0);
 assert.equal(await page.locator('.definition-topic').count(),4);
 assert.match(await page.locator('#definition-evidence-heading').innerText(),/執行結論：主攻行人投放/);
 assert.match(await page.locator('#definition-current-P02').innerText(),/搭車前併入行人題.*暫不另立/s);
 assert.match(await page.locator('#panel-definition .definition-status').innerText(),/進入 MVP 原型階段.*效果待驗證.*家戶本期不做/);
 assert.equal(await page.locator('.definition-evidence-list>article').count(),28);
 assert.equal(await page.locator('[id^="definition-evidence-E"][id*="-S"]').count(),75);
 assert.equal(await page.locator('.definition-decisions>article').count(),14);
 // All reading destinations live in the main page; only method/source citations leave it.
 const links=await page.locator('#panel-definition a').evaluateAll(as=>as.map(a=>({href:a.href,id:a.hash.slice(1)})));
 const ids=await page.locator('[id]').evaluateAll(xs=>xs.map(x=>x.id));assert.equal(ids.length,new Set(ids).size);
 for(const a of links){if(new URL(a.href).origin!==new URL(base).origin)continue;assert.equal(new URL(a.href).pathname,new URL(base).pathname);assert.ok(ids.includes(a.id)||ids.includes('panel-'+a.id),a.href);}
 // Retained links still reach their exact evidence span, definition, PRD or history destination.
 let aliases=0;
 for(const file of ['design-thinking/index.html','prd/index.html']){
  const html=await (await page.request.get(new URL(file,base).href)).text();
  const map=JSON.parse(html.match(/id="definition-targets">(.*?)<\/script>/s)[1]);
  for(const target of Object.values(map)){assert.ok(ids.includes(target),file+' '+target);aliases++;}
  for(const key of ['P01','P02','P03','P04',...(file.startsWith('prd')?['validation','not-doing']:['P01-claim-2','P03-definition-history','define'])]){
   await page.goto(new URL(file+'#'+key,base).href);
   await page.waitForURL(u=>u.pathname===new URL(base).pathname&&u.hash==='#'+map[key]);
   await page.waitForFunction(id=>document.activeElement.id===id,map[key]);
   assert.ok(await page.locator('#'+map[key]).isVisible());
  }
  for(const bad of ['%ZZ','__proto__']){await page.goto(new URL(file+'#'+bad,base).href);await page.waitForURL(u=>u.pathname===new URL(base).pathname);assert.ok(await page.locator('#panel-definition').isVisible());}
 }
 await page.goto(base+'#definition-current-P01');await page.locator('#definition-current-P01 a').click();
 await page.waitForFunction(()=>document.activeElement.id==='definition-focus-P01');
 await page.locator('#definition-focus-P01').locator('..').locator('a[href="#definition-evidence-E06"]').click();
 await page.waitForFunction(()=>document.activeElement.id==='definition-evidence-E06');
 assert.ok(await page.locator('#definition-evidence-E06-S2').isVisible());
 await page.locator('#definition-evidence-E06 a[href="#definition-focus-P01"]').first().click();
 await page.waitForFunction(()=>document.activeElement.id==='definition-focus-P01');
 await page.goBack();await page.waitForFunction(()=>document.activeElement.id==='definition-evidence-E06');
 await page.goForward();await page.waitForFunction(()=>document.activeElement.id==='definition-focus-P01');
 // Same-hash links focus and scroll without a disclosure to reopen.
 await page.locator('#definition-current-P01 a').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.activeElement.id==='definition-focus-P01');
 for(const width of [1440,720,390,320]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'#definition-evidence-heading');
  await page.locator('#panel-definition').waitFor({state:'visible'});await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);
  const box=await page.locator('.definition-conclusions .hackathon-entry').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=1000,'decision and PRD entry fit '+width+' '+JSON.stringify(box));
  if([1440,390].includes(width)){
   await page.screenshot({path:resolve(qa,`conclusions-${width}.png`)});
   await page.goto(base+'#definition-focus-P01');await page.waitForTimeout(100);await page.screenshot({path:resolve(qa,`problem-${width}.png`)});
   await page.goto(base+'#definition-prd-needs');await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'PRD overflow '+width);await page.screenshot({path:resolve(qa,`prd-${width}.png`)});
  }
 }
 const plain=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:1000},reducedMotion:'reduce'});const nojs=await plain.newPage();
 await nojs.goto(new URL('prd/index.html#P01',base).href);await nojs.locator('#definition-destination').click();
 assert.ok(await nojs.locator('#panel-definition').isVisible());
 assert.equal(await nojs.locator('.page-panel:visible').count(),1);
 await nojs.locator('a[href="#definition-focus-P01"]').first().click();assert.ok(await nojs.locator('#definition-focus-P01').isVisible());
 assert.ok(await nojs.locator('#definition-evidence-E06-S2').isVisible());await plain.close();
 await page.goto(base+'#design');await page.locator('[data-design-jump="t1-product-process-heading"]').click();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'t1-product-process-heading');
 await page.goto(base+'#research');assert.ok(await page.locator('#panel-research').isVisible());
 assert.deepEqual(errors,[]);
 const result={passed:true,aliases,sections:4,evidence:28,spans:75,decisions:14,single_page:true,no_disclosures:true,no_js:true,widths:[1440,720,390,320],errors};
 await writeFile(resolve(qa,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
