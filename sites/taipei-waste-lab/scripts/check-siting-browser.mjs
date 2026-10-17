import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const base=process.env.SITING_QA_URL||'http://127.0.0.1:4174/';
const output=resolve('.impeccable/review/siting');
await mkdir(output,{recursive:true});
const errors=[];
async function ready(page){
  const frame=page.frameLocator('#siting-frame');
  await frame.locator('#candidate-count').filter({hasText:'425'}).waitFor();
  await page.locator('#siting-status[hidden]').waitFor({state:'attached'});
  return frame;
}
async function bounds(page,frame){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const size=await frame.locator('body').evaluate(()=>({body:document.body.getBoundingClientRect().height,viewport:innerHeight}));
  assert.ok(Math.abs(size.body-size.viewport)<3,JSON.stringify(size));
}
try{
  for(const width of [1440,390,320]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    let overlayRequests=0;
    page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/siting-overlay.html'))overlayRequests++});
    await page.goto(base+'#design');
    await page.locator('#panel-design').waitFor({state:'visible'});
    assert.equal(await page.locator('#siting-frame').getAttribute('src'),null);
    assert.equal(overlayRequests,0);
    await page.locator('#panel-design a[href="#siting"]').click();
    const frame=await ready(page);
    assert.equal(overlayRequests,1);
    assert.equal(await page.locator('.history-subnav [data-page="siting"]').getAttribute('aria-current'),'page');
    assert.equal(await page.locator('[data-section="history"]').getAttribute('aria-current'),'page');
    assert.equal(await frame.locator('.top').isVisible(),false);
    await bounds(page,frame);
    await page.locator('#siting-heading').scrollIntoViewIfNeeded();
    await page.screenshot({path:resolve(output,`${width}-overlay.png`)});
    const oldHeight=await page.locator('#siting-frame').evaluate(e=>e.style.height);
    await page.evaluate(()=>window.postMessage({type:'taipei-siting-size',height:9999},location.origin));
    await page.waitForTimeout(50);
    assert.equal(await page.locator('#siting-frame').evaluate(e=>e.style.height),oldHeight);
    await frame.locator('#district').selectOption('北投區');
    await frame.locator('#search').fill('不可能存在測試字串');
    await frame.locator('#candidate-empty').waitFor({state:'visible'});
    await page.waitForTimeout(150);
    await bounds(page,frame);
    assert.notEqual(await page.locator('#siting-frame').evaluate(e=>e.style.height),oldHeight);
    await page.locator('.history-subnav [data-page="history"]').click();
    await page.goBack();
    await page.locator('#panel-siting').waitFor({state:'visible'});
    assert.equal(await frame.locator('#district').inputValue(),'北投區');
    assert.equal(await frame.locator('#search').inputValue(),'不可能存在測試字串');
    assert.equal(overlayRequests,1);
    await frame.locator('#reset').click();
    await frame.locator('#shortlist button').first().click();
    await frame.locator('.leaflet-popup-content').waitFor();
    await page.waitForTimeout(100);
    const mapY=await frame.locator('#map').evaluate(e=>e.getBoundingClientRect().top);
    const frameY=(await page.locator('#siting-frame').boundingBox()).y;
    assert.ok(mapY+frameY>=0&&mapY+frameY<400,`Map selection not visible: ${mapY+frameY}`);
    await bounds(page,frame);
    await page.screenshot({path:resolve(output,`${width}-selection.png`)});
    await page.close();
  }
  const failed=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  failed.on('pageerror',e=>errors.push(e.message));
  let failFrame=true;
  await failed.route('**/siting-overlay.html',r=>failFrame?r.fulfill({status:503,contentType:'text/html',body:'Temporarily unavailable'}):r.continue());
  await failed.goto(base+'#siting');
  await failed.locator('#siting-retry').waitFor({state:'visible',timeout:20000});
  failFrame=false;
  await failed.locator('#siting-retry').click();
  await ready(failed);
  await failed.close();
  const independent=await browser.newPage();
  independent.on('pageerror',e=>errors.push(e.message));
  await independent.route('**/data/datasets.json',r=>r.fulfill({status:503,body:'unavailable'}));
  await independent.goto(base+'#siting');
  await ready(independent);
  await independent.goto(base+'siting-overlay.html');
  await independent.locator('#candidate-count').filter({hasText:'425'}).waitFor();
  assert.equal(await independent.locator('.top').isVisible(),true);
  await independent.locator('.top a').click();
  assert.equal(new URL(independent.url()).hash,'#siting');
  await ready(independent);
  for(const path of ['inventory.html','data/siting-overlay.json','data/siting-overlay.provenance.json','data/taipei-bins-2015.csv']){
    const response=await independent.request.get(base+path);
    assert.equal(response.status(),404,path);
  }
  await independent.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: lazy route, design entry, history navigation, state/back, responsive sizing, map focus, message source boundary, iframe retry, independent data failure, standalone return, private source exclusions.');
} finally {await browser.close()}
