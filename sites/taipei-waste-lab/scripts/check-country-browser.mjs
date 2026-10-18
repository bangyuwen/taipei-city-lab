import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:resolve(process.env.CHROME_PATH)}:{})});
const base=(process.env.COUNTRY_QA_URL||'http://127.0.0.1:4174/').replace(/#.*$/,'');
const qa=fileURLToPath(new URL('../.impeccable/review/',import.meta.url));
const ids=['japan','uk','denmark','us','finland','korea','france','netherlands','singapore','india','australia','south-africa'];
const errors=[],results=[];await mkdir(qa,{recursive:true});
const urlFor=(id='us')=>{const url=new URL(base);url.searchParams.set('country',id);url.hash='countries';return url.href};
async function ready(page){await page.locator('.country-reading-ready').waitFor();await page.locator('#country-reader-select').waitFor({state:'attached'})}
async function loaded(page){
  await page.waitForFunction(()=>{
    const controls=document.querySelector('.country-model-controls');
    return document.querySelector('.country-model-stage canvas')&&controls&&!controls.hidden&&document.querySelector('.country-model-status')?.textContent==='';
  });
}
async function model(page){await page.click('[data-mode="model"]');await loaded(page)}
async function readCase(page,id){
  const entry=page.locator(`.country-index [data-country-target="country-${id}"]`);
  if(await entry.isVisible())await entry.click();
  else await page.selectOption('#country-reader-select',id);
  await page.waitForFunction(id=>document.querySelector(`.country-case[aria-labelledby="country-${id}"]`)?.parentElement.hidden===false,id);
}
async function bounds(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page must not overflow')}
async function sourcePhotos(page){
  return page.evaluate(async()=>{
    const source=new DOMParser().parseFromString(await (await fetch(location.pathname)).text(),'text/html');
    return Object.fromEntries([...source.querySelectorAll('.country-case[data-media-case="true"]')].map(article=>{
      const figure=article.querySelector('.country-photo');
      return [article.getAttribute('aria-labelledby').replace('country-',''),{caption:figure.querySelector('figcaption').textContent,links:[...figure.querySelectorAll('a')].map(link=>link.getAttribute('href')),image:figure.querySelector('img')?.getAttribute('src')||null}];
    }));
  });
}
async function assertPhoto(page,id,photos){
  const actual=await page.locator('.country-inline-photo > .country-photo').evaluate(figure=>({caption:figure.querySelector('figcaption').textContent,links:[...figure.querySelectorAll('a')].map(link=>link.getAttribute('href')),image:figure.querySelector('img')?.getAttribute('src')||null}));
  assert.deepEqual(actual,photos[id],id+' keeps its complete original photo, caption, attribution and links');
  if(id==='australia'){
    assert.equal(await page.locator('.country-inline-photo img').count(),0);
    assert.match(await page.locator('.country-inline-photo').innerText(),/授權未確認/);
  }else{
    assert.ok(await page.locator('.country-inline-photo img').getAttribute('alt'));
    assert.equal(await page.locator('.country-inline-photo img').evaluate(image=>getComputedStyle(image).objectFit),'contain');
  }
}
try{
  for(const width of [1440,720,390,320]){
    const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<720,reducedMotion:'reduce'});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    const requests=[];page.on('request',request=>requests.push(request.url()));
    await page.goto(urlFor());await ready(page);const photos=await sourcePhotos(page);
    assert.equal(requests.some(request=>request.includes('/vendor/three/')),false,'Photo-first reading keeps Three lazy');
    assert.equal(await page.locator('#panel-countries select').count(),1);
    assert.equal(await page.locator('#country-reader-select option').count(),14);
    assert.equal(await page.locator('#country-reader-select optgroup').count(),3);
    assert.equal(await page.locator('#panel-countries details').count(),0,'Case reading needs no disclosures');
    assert.equal(await page.locator('.country-return,.country-model-open,.country-guide,.country-question,.country-part-buttons,#country-play-progress,[data-view],[data-play="rotate"],#country-comparison').count(),0);
    assert.equal(await page.locator('.country-index').isVisible(),width>=1160);
    assert.equal(await page.locator('#country-reader-select').isVisible(),width<1160);
    await model(page);const original=await page.locator('.country-model-stage canvas').elementHandle();
    for(const id of width===1440?ids:['japan','india','australia']){
      await readCase(page,id);await bounds(page);
      assert.equal(await page.locator('.country-cases > li:visible').count(),1);
      assert.equal(await page.locator('#country-viewer').getAttribute('data-media'),'photo','Changing case starts from its photo');
      assert.equal(await page.locator('.country-model-visual').isVisible(),false);
      await assertPhoto(page,id,photos);
      const article=page.locator(`.country-case[aria-labelledby="country-${id}"]`);
      assert.equal(await article.locator('.country-case-grid > .country-facts > div').count(),3);
      assert.ok(await article.locator('.country-case-evidence').innerText());
      await model(page);
      assert.equal(await page.locator('.country-model-controls > button').count(),4);
      assert.equal(await original.evaluate(canvas=>canvas===document.querySelector('.country-model-stage canvas')),true,'Reuse one canvas across all cases');
      assert.ok(await page.locator('.country-model-limitation').innerText());
    }
    for(const id of ['hong-kong','uruguay']){
      await readCase(page,id);await bounds(page);
      const article=page.locator('.country-case:visible');
      assert.equal(await article.locator('.strategy-flow li').count(),4);
      assert.ok(await article.locator('.strategy-sources').innerText());
      assert.equal(await article.locator('.strategy-media-absence').count(),1);
      assert.equal(await page.locator('#country-viewer').count(),0);
    }
    await readCase(page,'japan');await model(page);
    const canvas=page.locator('.country-model-stage canvas');await canvas.focus();
    const before=await canvas.screenshot();await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);
    assert.notDeepEqual(await canvas.screenshot(),before,'Keyboard rotation changes the model');
    await page.keyboard.press('+');await page.keyboard.press('Home');
    for(let i=0;i<12;i++)await page.locator('[data-zoom="1"]').evaluate(button=>button.click());
    assert.equal(await page.locator('[data-zoom="1"]').isDisabled(),true);
    for(let i=0;i<12;i++)await page.locator('[data-zoom="-1"]').evaluate(button=>button.click());
    assert.equal(await page.locator('[data-zoom="-1"]').isDisabled(),true);
    await page.click('[data-play="reset"]');
    assert.equal(await page.locator('.country-model-controls').getAttribute('data-state'),'ready');
    await page.click('[data-mode="photo"]');assert.equal(await page.locator('.country-model-visual').isVisible(),false);
    await model(page);assert.equal(await original.evaluate(canvas=>canvas===document.querySelector('.country-model-stage canvas')),true);
    if(width===1440){
      await canvas.evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
      await page.locator('.country-model-retry:not([hidden])').waitFor();await page.click('.country-model-retry');await loaded(page);
      assert.equal(await page.locator('.country-model-stage canvas').count(),1);
      assert.equal(await original.evaluate(canvas=>canvas.isConnected),false);
      // Hash case links override an old query; selector changes retain unrelated parameters.
      await page.goto(urlFor('uk').replace('#countries','&keep=1#country-finland'));await ready(page);
      assert.equal(await page.locator('#country-reader-select').inputValue(),'finland');
      await readCase(page,'korea');assert.equal(new URL(page.url()).searchParams.get('keep'),'1');assert.equal(new URL(page.url()).hash,'#countries');
    }
    if([1440,390].includes(width)){
      await readCase(page,'us');await page.screenshot({path:resolve(qa,`country-clean-${width}.png`),fullPage:true});
    }
    results.push({width,countries:width===1440?14:5,mediaCases:width===1440?12:3,strategyFirst:true,keyboard:true,reuse:true});await context.close();
  }
  // GPU failure leaves the selected case's photographs, limitations and costs readable.
  const fallback=await browser.newPage();
  await fallback.addInitScript(()=>{window.block3D=true;const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return window.block3D&&/webgl/.test(type)?null:get.call(this,type,...args)}});
  await fallback.goto(urlFor('uk'));await ready(fallback);await fallback.click('[data-mode="model"]');
  await fallback.locator('.country-model-retry:not([hidden])').waitFor();
  assert.ok(await fallback.locator('.country-case:visible .country-case-evidence').innerText());
  await fallback.click('[data-mode="photo"]');assert.equal(await fallback.locator('.country-inline-photo img').isVisible(),true);
  await fallback.click('[data-mode="model"]');await fallback.evaluate(()=>window.block3D=false);await fallback.click('.country-model-retry');await loaded(fallback);await fallback.close();
  const network=await browser.newPage();let block=true;
  await network.route('**/country-scene.js',route=>block?route.abort():route.continue());
  await network.goto(urlFor('uk'));await ready(network);await network.click('[data-mode="model"]');
  await network.locator('.country-model-retry:not([hidden])').waitFor();assert.equal(await network.locator('.country-model-retry').innerText(),'重新載入頁面');
  block=false;await network.click('.country-model-retry');await ready(network);
  assert.equal(await network.locator('#country-reader-select').inputValue(),'uk');await model(network);await network.close();
  const delayed=await browser.newPage();let release;const gate=new Promise(resolve=>{release=resolve});
  await delayed.route('**/country-scene.js',async route=>{await gate;await route.continue()});
  await delayed.goto(urlFor());await ready(delayed);await delayed.click('[data-mode="model"]');
  await delayed.click('[data-mode="photo"]');release();await delayed.waitForFunction(()=>document.querySelector('.country-model-stage canvas'));
  assert.equal(await delayed.locator('#country-viewer').getAttribute('data-media'),'photo');assert.equal(await delayed.locator('.country-model-visual').isVisible(),false);await delayed.close();
  assert.deepEqual(errors,[]);await writeFile(resolve(qa,'country-browser.json'),JSON.stringify({results,errors,fallback:true,networkRetry:true,hiddenDuringLoad:true},null,2));
  console.log('Country browser checks passed: 14 strategy entries, 12 photo supplements, desktop index/mobile select, complete attribution and costs, 4 widths, keyboard/zoom, renderer reuse, context loss and lazy-loading fallbacks.');
}finally{await browser.close()}
