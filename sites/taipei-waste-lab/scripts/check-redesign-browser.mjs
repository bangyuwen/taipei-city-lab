import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const site=fileURLToPath(new URL('..',import.meta.url));
const qa=resolve(site,'.impeccable/review');
const modulePath=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(modulePath?pathToFileURL(resolve(modulePath)).href:'playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROME_PATH?{executablePath:resolve(process.env.CHROME_PATH)}:{})});
const baseURL=new URL(process.env.REDESIGN_QA_URL||'http://127.0.0.1:4174/');
const errors=[],screens=[],measurements=[];
const historyPages=['map','comparison','history','siting'];
const widths=[320,390,720,1440];
const captureScreens=!process.argv.includes('--functional-only');
await mkdir(qa,{recursive:true});

function urlFor(hash=''){
  const target=new URL(baseURL);target.hash=hash;return target.href;
}
function observe(page,label){
  page.on('pageerror',error=>errors.push(`${label}: ${error.message}`));
  // Map markers and source records must remain useful without external tiles.
  return page.route('https://tile.openstreetmap.org/**',route=>route.abort());
}
async function checkBounds(page,label){
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,bad:[...document.querySelectorAll('main *')].filter(element=>{
    const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
    return rect.width&&style.position!=='absolute'&&rect.right>innerWidth+2&&!element.closest('.comparison-table-wrap,.source-table-wrap,.leaflet-pane,.point-list,.country-photo-frame');
  }).slice(0,8).map(element=>element.tagName+'.'+element.className)}));
  assert.ok(overflow.scroll<=overflow.width,`${label}: ${JSON.stringify(overflow)}`);
}
async function focused(page,id){
  await page.waitForFunction(expected=>document.activeElement?.id===expected,id);
}
async function primary(page,target){
  const menu=page.locator('#site-menu-toggle');
  if(await menu.isVisible()&&!await page.locator('#site-navigation').isVisible())await menu.click();
  await page.locator(target==='history'?'#site-navigation [data-section="history"]':`#site-navigation [data-page="${target}"]`).click();
}
async function nav(page,target){
  const before=await page.evaluate(()=>location.hash);
  if(historyPages.includes(target)){
    await primary(page,'history');
    if(target!=='history')await page.locator(`.history-subnav [data-page="${target}"]`).click();
  }else if(['research','countries'].includes(target))await primary(page,target);
  else if(target==='design'){
    await primary(page,'research');
    await page.locator('#panel-research a[href="#design"]').first().click();
  }else await page.locator(`footer a[href="#${target}"]`).click();
  const panel=page.locator(`#panel-${target}`);
  await panel.waitFor({state:'visible'});
  await page.waitForFunction(expected=>document.body.dataset.page===expected,target);
  if(before!==`#${target}`)await focused(page,await panel.getAttribute('aria-labelledby'));
}
async function ready(page,hash=''){
  await page.goto(urlFor(hash));
  await page.waitForFunction(()=>Boolean(document.body.dataset.page));
  // The homepage intentionally hides map loading status before the catalog loads.
  await page.locator('#dataset-version:not([disabled])').waitFor({state:'attached'});
}
async function checkHome(page){
  assert.equal(await page.locator('#panel-research').isVisible(),true);
  assert.equal(await page.locator('#panel-research details').count(),0);
  assert.equal(await page.locator('#research-synthesis > .research-synthesis-item').count(),3);
  assert.match(await page.locator('#panel-research').innerText(),/尚無台北試辦成效/);
  for(const article of await page.locator('#research-synthesis > article').all()){
    assert.match(await article.innerText(),/成立條件/);
    assert.match(await article.innerText(),/仍未知/);
  }
  assert.deepEqual(await page.locator('#site-navigation a').evaluateAll(links=>links.map(link=>link.hash)),['#research','#history','#countries']);
  assert.equal(await page.locator('#site-navigation [data-page="research"]').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('#history-navigation').isVisible(),false);
}
async function checkCurrentNavigation(page,target){
  const current=await page.locator('a[aria-current="page"]').evaluateAll(links=>links.map(link=>({hash:link.hash,text:link.textContent.trim()})));
  assert.ok(current.every(link=>link.hash===`#${target}`),`${target}: current-page links must identify the displayed route: ${JSON.stringify(current)}`);
  assert.equal(await page.locator('#site-navigation [data-page="research"]').getAttribute('aria-current'),target==='research'?'page':null);
  assert.equal(await page.locator('#site-navigation [data-section="history"]').getAttribute('aria-current'),target==='history'?'page':null);
  if(target==='design')assert.deepEqual(current,[],'The design route has no current-page link in the navigation');
  else assert.ok(current.length>0,`${target}: its navigation link must identify the current page`);
  if(target==='materials')assert.equal(current.length,1,'Only the materials footer link identifies the current page');
}
async function checkSkipLink(page){
  await nav(page,'map');
  await page.selectOption('#dataset-version','2026-main');
  await page.selectOption('#district','中山區');
  await page.fill('#search','中山');
  for(const target of ['map','materials']){
    if(target!=='map')await nav(page,target);
    // Reload starts keyboard navigation at the document, as on a direct visit.
    await page.reload();
    await page.waitForFunction(expected=>document.body.dataset.page===expected,target);
    await page.locator('#dataset-version:not([disabled])').waitFor({state:'attached'});
    const before=page.url();
    const filters=await page.locator('#dataset-version,#district,#search').evaluateAll(controls=>controls.map(control=>control.value));
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip-link').evaluate(link=>link===document.activeElement),true,`${target}: the first Tab must reach the skip link`);
    await page.keyboard.press('Enter');
    await focused(page,'main');
    assert.equal(page.url(),before,`${target}: skipping navigation must preserve the route and query`);
    assert.equal(await page.locator('body').getAttribute('data-page'),target);
    assert.equal(await page.locator(`#panel-${target}`).isVisible(),true);
    assert.deepEqual(await page.locator('#dataset-version,#district,#search').evaluateAll(controls=>controls.map(control=>control.value)),filters);
    await checkCurrentNavigation(page,target);
  }
}
async function checkCountryReader(page){
  await page.locator('#panel-countries.country-reading-ready').waitFor();
  assert.equal(await page.locator('#country-reader-select').count(),1);
  assert.equal(await page.locator('#country-reader-select option').count(),12);
  assert.equal(await page.locator('.country-case:visible').count(),1);
  assert.equal(await page.locator('#country-viewer').getAttribute('data-media'),'photo');
  assert.equal(await page.locator('#country-viewer .country-photo-column').isVisible(),true);
  assert.equal(await page.locator('#country-viewer .country-model-visual').isVisible(),false);
  // Photo and model occupy the same reusable viewer; detailed 3D checks live in
  // check-country-browser.mjs and check-country-play-browser.mjs.
  assert.equal(await page.locator('#country-viewer .country-viewer-media > div').count(),2);
  assert.equal(await page.locator('.country-return,.country-model-open').count(),0);
  await page.selectOption('#country-reader-select','korea');
  assert.equal(await page.locator('.country-case:visible h4').getAttribute('id'),'country-korea');
  assert.equal(await page.locator('#country-viewer').getAttribute('data-media'),'photo');
  assert.equal(await page.locator('.country-case:visible').count(),1);
  await page.selectOption('#country-reader-select','us');
}
async function checkDesign(page){
  await page.waitForFunction(()=>document.querySelector('#design-options')?.options.length===4);
  assert.equal(await page.locator('#design-options').evaluate(element=>element.tagName),'SELECT');
  assert.equal(await page.locator('#panel-design [data-design-demo]').count(),2);
  assert.equal(await page.locator('#panel-design input[type="range"]').count(),0);
  await page.selectOption('#design-options','household');
  await page.locator('[data-design-demo="deposit"]').click();
  // Complete the actual three-step flow, rather than inspecting only labels.
  for(let step=0;step<3;step++)await page.locator('#design-next').click();
  assert.equal(await page.locator('#design-workspace').getAttribute('data-complete'),'true');
  assert.equal(await page.locator('#design-step-title').innerText(),'示範完成');
  await page.locator('#design-next').click();
  assert.equal(await page.locator('#design-workspace').getAttribute('data-complete'),'false');
  await page.locator('[data-design-demo="collection"]').click();
  assert.equal(await page.locator('[data-design-demo="collection"]').getAttribute('aria-pressed'),'true');
  await page.locator('#design-next').click();
  assert.match(await page.locator('#design-status').innerText(),/清運|開|服務/);
}
async function checkMapState(page){
  await nav(page,'map');
  await page.locator('#map.leaflet-container').waitFor();
  assert.equal(await page.locator('#dataset-version').count(),1);
  assert.deepEqual((await page.locator('#dataset-version option').evaluateAll(options=>options.map(option=>option.value))).sort(),['2015','2022','2024','2024-archive','2026','2026-main']);
  assert.equal(await page.locator('[data-year]').count(),0);
  await page.locator('#search').focus();await page.keyboard.press('Tab');
  assert.equal(await page.locator('#fit-map').evaluate(element=>element===document.activeElement),true);
  await page.selectOption('#dataset-version','2024-archive');
  await page.locator('#reset-filters').click();
  assert.equal(await page.locator('#result-count').innerText(),'1,971');
  await page.selectOption('#district','大安區');await page.fill('#search','敦化');
  const count=await page.locator('#result-count').innerText();
  await nav(page,'countries');await nav(page,'map');
  assert.equal(await page.locator('#dataset-version').inputValue(),'2024-archive');
  assert.equal(await page.locator('#district').inputValue(),'大安區');
  assert.equal(await page.locator('#search').inputValue(),'敦化');
  assert.equal(await page.locator('#result-count').innerText(),count);
  assert.ok(await page.locator('#map').evaluate(element=>element.getBoundingClientRect().width>100));
  await nav(page,'countries');await page.goBack();await page.locator('#panel-map').waitFor({state:'visible'});
  await focused(page,'map-heading');
  assert.equal(await page.locator('#district').inputValue(),'大安區');
  assert.equal(await page.locator('#search').inputValue(),'敦化');
  await page.locator('#reset-filters').click();await page.selectOption('#dataset-version','2026-main');
  assert.equal(await page.locator('#result-count').innerText(),'681');
}
async function checkReferences(page){
  for(const id of ['reference-L02','reference-P02']){
    await nav(page,'research');
    await page.locator(`#panel-research a[href="#${id}"]`).first().click();
    await page.locator('#panel-sources').waitFor({state:'visible'});
    await focused(page,id);
    assert.equal(await page.locator(`#${id}`).isVisible(),true);
    assert.equal(await page.locator('#history-navigation').isVisible(),false);
  }
  for(const id of ['reference-L13','reference-P03']){
    await page.goto(urlFor(id));await page.locator('#panel-sources').waitFor({state:'visible'});
    await focused(page,id);assert.equal(await page.locator(`#${id}`).isVisible(),true);
  }
}
async function screenshot(page,width,target){
  if(!captureScreens)return;
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  if([1440,390].includes(width)||target==='research'){
    const filename=`${width}-${target}.png`;
    await page.screenshot({path:resolve(qa,filename),fullPage:false});screens.push(filename);
    if([1440,390].includes(width)&&['research','map','countries','design'].includes(target)){
      const full=filename.replace('.png','-full.png');
      await page.screenshot({path:resolve(qa,full),fullPage:true});screens.push(full);
    }
  }
}

try{
  for(const width of widths){
    const context=await browser.newContext({viewport:{width,height:width>=720?1000:844},reducedMotion:'reduce',hasTouch:width<720});
    const page=await context.newPage();await observe(page,String(width));
    const candidateRequests=[];
    page.on('request',request=>{if(/(?:research-ui\.js|desk-results\.json)(?:\?|$)/.test(request.url()))candidateRequests.push(request.url())});
    await ready(page);assert.equal(new URL(page.url()).hash,'');await checkHome(page);
    assert.deepEqual(candidateRequests,[],'Candidate tools must not load with the homepage');
    for(const target of ['research','map','comparison','history','siting','countries','design','materials','sources']){
      if(target!=='research')await nav(page,target);
      await checkCurrentNavigation(page,target);
      if(target==='comparison')await page.locator('#comparison-content:not([hidden])').waitFor();
      if(target==='countries')await checkCountryReader(page);
      if(target==='design')await checkDesign(page);
      if(target==='materials'){
        await page.locator('#research-context:not([disabled])').waitFor({state:'attached'});
        assert.equal(await page.locator('.research-candidate').count(),18);
        assert.ok(candidateRequests.some(request=>request.includes('desk-results.json')));
      }else if(!['sources'].includes(target))assert.deepEqual(candidateRequests,[],`${target} must not load candidate tools`);
      await checkBounds(page,`${width}/${target}`);await screenshot(page,width,target);
      measurements.push({width,target,body:await page.locator('body').evaluate(element=>getComputedStyle(element).fontSize)});
    }
    await checkMapState(page);
    await checkSkipLink(page);
    await nav(page,'comparison');await page.locator('#comparison-content:not([hidden])').waitFor();
    await page.selectOption('#comparison-categories','same_address_changed');
    await page.locator('#coordinate-distance-content:not([hidden])').waitFor();
    assert.match(await page.locator('#comparison-result-count').innerText(),/75/);
    await page.selectOption('#comparison-district','大安區');await page.fill('#comparison-search','不存在的地址');
    assert.equal(await page.locator('#comparison-empty').isVisible(),true);await page.locator('#comparison-reset').click();
    await checkReferences(page);
    assert.equal(await page.locator('[download],#export-csv,#comparison-export,#comparison-district-export').count(),0);
    if(width<960){
      await nav(page,'research');await page.locator('#site-menu-toggle').click();
      await page.locator('#site-navigation [data-page="countries"]').click();await focused(page,'countries-heading');
      assert.equal(await page.locator('#site-menu-toggle').getAttribute('aria-expanded'),'false');
      await page.locator('#site-menu-toggle').click();
      assert.equal(await page.locator('#site-menu-toggle').getAttribute('aria-expanded'),'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#site-menu-toggle').getAttribute('aria-expanded'),'false');await focused(page,'site-menu-toggle');
    }
    await context.close();
  }
  for(const width of [639,640,959,960]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
    const page=await context.newPage();await observe(page,`breakpoint/${width}`);await ready(page);await checkHome(page);
    assert.equal(await page.locator('#site-menu-toggle').isVisible(),width<960);await checkBounds(page,`${width}/home`);
    await nav(page,'map');
    assert.equal(await page.locator('.map-layout').evaluate(element=>getComputedStyle(element).display),width<640?'flex':'grid');
    await checkBounds(page,`${width}/map`);
    await nav(page,'research');await page.evaluate(()=>scrollTo({top:600,behavior:'instant'}));
    const saved=await page.evaluate(()=>scrollY);
    // A footer click scrolls to its link before leaving; use a route transition
    // here to isolate restoration of this exact saved reading position.
    await page.evaluate(()=>{location.hash='sources'});
    await page.locator('#panel-sources').waitFor({state:'visible'});await focused(page,'sources-heading');
    await nav(page,'research');
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-saved)<=1,`${width}: research scroll position must survive a source visit`);
    await context.close();
  }
  // Main data failure must not replace the static, cited homepage with an error.
  const failureContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const failed=await failureContext.newPage();await observe(failed,'data failure');
  await failed.route('**/data/datasets.json',route=>route.fulfill({status:503,body:'unavailable'}));
  await failed.route('**/research/execution-2026-10-15/desk-results.json',route=>route.fulfill({status:503,body:'unavailable'}));
  await failed.goto(urlFor());await failed.locator('#load-status.error').waitFor({state:'attached'});await checkHome(failed);
  await checkBounds(failed,'data failure/home');
  await nav(failed,'map');assert.equal(await failed.locator('#load-status.error').isVisible(),true);
  assert.equal(await failed.locator('#dataset-version').isDisabled(),true);assert.equal(await failed.locator('#district').isDisabled(),true);
  await nav(failed,'history');assert.equal(await failed.locator('.timeline-event').count(),11);
  assert.equal(await failed.locator('[data-event-filter]').count(),0);
  await nav(failed,'sources');assert.equal(await failed.locator('#reference-L02').isVisible(),true);
  assert.match(await failed.locator('#source-cards').innerText(),/版本表暫時無法載入/);
  await nav(failed,'materials');await failed.locator('#research-status').filter({hasText:'無法載入'}).waitFor();
  assert.match(await failed.locator('#panel-materials').innerText(),/估算|情境|規劃/);
  assert.equal(await failed.locator('[download]').count(),0);await failureContext.close();

  const retryContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const retry=await retryContext.newPage();await observe(retry,'retry');
  await retry.route('**/images/countries/*',route=>route.abort());let comparisonFailed=true;
  await retry.route('**/data/comparison-2024-2026.json',route=>comparisonFailed?route.fulfill({status:503,body:'unavailable'}):route.continue());
  await ready(retry,'countries');await retry.locator('#panel-countries.country-reading-ready').waitFor();
  await retry.locator('.country-case:visible .country-photo-error:not([hidden])').waitFor();
  assert.equal(await retry.locator('.country-case:visible .country-case-evidence').isVisible(),true);
  await nav(retry,'comparison');await retry.locator('#comparison-retry:not([hidden])').waitFor();
  comparisonFailed=false;await retry.locator('#comparison-retry').click();await retry.locator('#comparison-content:not([hidden])').waitFor();
  await retryContext.close();

  assert.deepEqual(errors,[]);
  const report={status:'passed',widths,breakpoints:[639,640,959,960],screenshots:captureScreens?'captured':'skipped',screens,measurements,checks:'three primary entrances, research default, cited conclusions, secondary routes, current-page navigation semantics, keyboard skip preserves route/query/filter state and focuses main, reference hash focus, lazy candidate tools, single dataset selector, single photo-first country reader, guided design, navigation focus, map state/back, overflow, comparison empty/retry, photo fallback, static homepage on data failure, no downloads'};
  await writeFile(resolve(qa,'redesign-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close()}
