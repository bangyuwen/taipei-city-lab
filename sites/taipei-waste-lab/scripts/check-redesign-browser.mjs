import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const site=fileURLToPath(new URL('..',import.meta.url));
const qa=resolve(site,'.impeccable/review');
const modulePath=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(modulePath?pathToFileURL(resolve(modulePath)).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:resolve(process.env.CHROME_PATH)}:{})});
const url=process.env.REDESIGN_QA_URL||'http://127.0.0.1:4174/';
const errors=[],screens=[],measurements=[];
await mkdir(qa,{recursive:true});
async function checkBounds(page,label){
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,bad:[...document.querySelectorAll('main *')].filter(e=>{let r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&s.position!=='absolute'&&r.right>innerWidth+2&&!e.closest('.comparison-table-wrap,.leaflet-pane,.point-list,.country-photo-frame')}).slice(0,8).map(e=>e.tagName+'.'+e.className)}));
  assert.ok(overflow.scroll<=overflow.width,`${label}: ${JSON.stringify(overflow)}`);
}
async function nav(page,target){
  const mobile=await page.locator('#site-menu-toggle').isVisible();
  if(mobile&&!await page.locator('#site-navigation').isVisible()){
    // Use a real click on the visible sticky control; locator.click may scroll it first.
    const box=await page.locator('#site-menu-toggle').boundingBox();
    await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  }
  const selector=['map','comparison','history','siting'].includes(target)?'[data-section="history"]':`#site-navigation [data-page="${target}"]`;
  await page.click(selector);
  if(['comparison','history','siting'].includes(target))await page.click(`.history-subnav [data-page="${target}"]`);
  await page.locator(`#panel-${target}`).waitFor({state:'visible'});
  await page.waitForTimeout(100);
}
try{
  for(const width of [1440,720,390,320]){
    const context=await browser.newContext({viewport:{width,height:width>=720?1000:844},reducedMotion:'reduce',hasTouch:width<720});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    // Keep a real map in screenshots; interaction checks also tolerate tile failure.
    await page.goto(url);await page.locator('#load-status[hidden]').waitFor({state:'attached'});
    for(const target of ['map','comparison','history','siting','countries','design','research','sources']){
      if(target!=='map')await nav(page,target);
      if(target==='comparison')await page.locator('#comparison-content:not([hidden])').waitFor();
      if(target==='design')await page.waitForTimeout(800);
      await checkBounds(page,`${width}/${target}`);
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      const filename=`${width}-${target}.png`;
      if([1440,390].includes(width)||target==='map'){
        await page.screenshot({path:resolve(qa,filename),fullPage:false});screens.push(filename);
        if([1440,390].includes(width)){
          const full=filename.replace('.png','-full.png');
          await page.screenshot({path:resolve(qa,full),fullPage:true});screens.push(full);
        }
      }
      measurements.push({width,target,body:await page.locator('body').evaluate(e=>getComputedStyle(e).fontSize)});
    }
    await nav(page,'map');
    await page.locator('#search').focus();await page.keyboard.press('Tab');
    assert.equal(await page.locator('#fit-map').evaluate(e=>e===document.activeElement),true);
    await page.selectOption('#district','大安區');await page.fill('#search','敦化');
    const count=await page.locator('#result-count').innerText();assert.notEqual(count,'2,517');
    await nav(page,'countries');await page.click('[data-country-target="country-korea"]');
    assert.equal(await page.locator('#country-korea').evaluate(e=>e===document.activeElement),true);
    await page.locator('.country-case').filter({has:page.locator('#country-korea')}).locator('.country-return').click();
    assert.equal(await page.locator('#countries-heading').evaluate(e=>e===document.activeElement),true);
    await nav(page,'map');assert.equal(await page.locator('#district').inputValue(),'大安區');assert.equal(await page.locator('#search').inputValue(),'敦化');assert.equal(await page.locator('#result-count').innerText(),count);
    assert.ok(await page.locator('#map').evaluate(e=>e.getBoundingClientRect().width>100));
    // A browser back transition preserves the selected map filters.
    await nav(page,'countries');await page.goBack();await page.locator('#panel-map').waitFor({state:'visible'});
    assert.equal(await page.locator('#district').inputValue(),'大安區');assert.equal(await page.locator('#search').inputValue(),'敦化');
    await page.click('#reset-filters');await page.click('[data-year="2024-archive"]');assert.equal(await page.locator('#result-count').innerText(),'1,971');
    await page.click('[data-year="2026-main"]');assert.equal(await page.locator('#result-count').innerText(),'681');
    await nav(page,'comparison');await page.click('[data-comparison-category="same_address_changed"]');
    await page.locator('#coordinate-distance-content:not([hidden])').waitFor();
    assert.match(await page.locator('#comparison-result-count').innerText(),/75/);
    await page.selectOption('#comparison-district','大安區');await page.fill('#comparison-search','不存在的地址');
    assert.equal(await page.locator('#comparison-empty').isVisible(),true);
    await page.click('#comparison-reset');
    await nav(page,'research');await page.click('.research-start [data-research-target="research-materials-heading"]');
    assert.equal(await page.locator('#research-materials-heading').evaluate(e=>e===document.activeElement),true);
    assert.equal(await page.locator('[download],#export-csv,#comparison-export').count(),0);
    if(width<960){
      await page.click('#site-menu-toggle');await page.click('#site-navigation [data-page="research"]');
      assert.equal(await page.locator('#research-heading').evaluate(e=>e===document.activeElement),true);
      assert.equal(await page.locator('#site-menu-toggle').getAttribute('aria-expanded'),'false');
      await page.click('#site-menu-toggle');assert.equal(await page.locator('#site-menu-toggle').getAttribute('aria-expanded'),'true');
      await page.keyboard.press('Escape');assert.equal(await page.locator('#site-menu-toggle').getAttribute('aria-expanded'),'false');
      assert.equal(await page.locator('#site-menu-toggle').evaluate(e=>e===document.activeElement),true);
    }
    await context.close();
  }
  // Test both sides of the layout and navigation breakpoints.
  for(const width of [639,640,959,960]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto(url);await page.locator('#load-status[hidden]').waitFor({state:'attached'});
    assert.equal(await page.locator('#site-menu-toggle').isVisible(),width<960);
    assert.equal(await page.locator('.map-layout').evaluate(e=>getComputedStyle(e).display),width<640?'flex':'grid');
    await checkBounds(page,`${width}/breakpoint`);
    await nav(page,'research');await page.evaluate(()=>scrollTo({top:600,behavior:'instant'}));
    const saved=await page.evaluate(()=>scrollY);
    await nav(page,'sources');await nav(page,'research');
    assert.equal(await page.evaluate(()=>scrollY),saved);
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const failed=await context.newPage();failed.on('pageerror',e=>errors.push(e.message));
  await failed.route('**/images/countries/*',r=>r.abort());
  let comparisonFailed=true;
  await failed.route('**/data/comparison-2024-2026.json',r=>comparisonFailed?r.fulfill({status:503,body:'unavailable'}):r.continue());
  await failed.goto(url+'#countries');await failed.locator('#panel-countries').waitFor({state:'visible'});
  await failed.locator('.country-photo-error:not([hidden])').first().waitFor();
  await nav(failed,'comparison');await failed.locator('#comparison-retry:not([hidden])').waitFor();
  comparisonFailed=false;await failed.click('#comparison-retry');await failed.locator('#comparison-content:not([hidden])').waitFor();
  await nav(failed,'history');await failed.click('[data-event-filter="removal"]');assert.equal(await failed.locator('.timeline-event').count(),2);
  await context.close();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',widths:[320,390,720,1440],screens,measurements,checks:'navigation, overflow, map state, dataset counts, coordinate classification, comparison empty/retry, photo fallback, country return, research tools, keyboard menu, no downloads'}));
}finally{await browser.close()}
