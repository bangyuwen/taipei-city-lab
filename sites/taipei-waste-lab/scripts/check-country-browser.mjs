import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:resolve(process.env.CHROME_PATH)}:{})});
const url=(process.env.COUNTRY_QA_URL||'http://127.0.0.1:4174/').replace(/#.*$/,'')+'#countries';
const qa=fileURLToPath(new URL('../.impeccable/review/',import.meta.url));
const ids=['japan','uk','denmark','us','finland','korea','france','netherlands','singapore','india','australia','south-africa'];
const errors=[],results=[];await mkdir(qa,{recursive:true});
const opener=id=>`#country-${id} + .country-model-open`;
async function ready(page){await page.locator(opener('japan')).waitFor()}
async function loaded(page){await page.waitForFunction(()=>document.querySelector('.country-model-status')?.textContent==='外觀示意已載入。');await page.waitForTimeout(100)}
async function bounds(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page must not overflow')}
try{
  for(const width of [1440,720,390,320]){
    const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<720,reducedMotion:'reduce'});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    const requests=[];page.on('request',r=>requests.push(r.url()));
    await page.goto(url);await ready(page);
    assert.equal(await page.locator('.country-model-open').count(),12);
    assert.equal(requests.some(r=>r.includes('/vendor/three/')),false,'Three must remain lazy');
    await page.click(opener('japan'));await loaded(page);
    const original=await page.locator('.country-model-stage canvas').elementHandle();
    for(const id of width===1440?ids:['japan','india','australia']){
      await page.click(opener(id));await loaded(page);await bounds(page);
      assert.equal(await page.locator('.country-model-stage canvas').count(),1);
      assert.equal(await original.evaluate(c=>c===document.querySelector('.country-model-stage canvas')),true,'Reuse one canvas');
      if(width===1440||width===390){
        // Keep the complete viewer in the raster viewport, including mobile notes.
        const height=Math.ceil((await page.locator('#country-viewer').boundingBox()).height)+160;
        await page.setViewportSize({width,height:Math.max(1000,height)});
        await page.locator('#country-viewer').scrollIntoViewIfNeeded();await page.waitForTimeout(100);
        await page.locator('#country-viewer').screenshot({path:resolve(qa,`country-${width}-${id}.png`)});
        await page.setViewportSize({width,height:1000});
      }
    }
    await page.click(opener('japan'));await loaded(page);
    const canvas=page.locator('.country-model-stage canvas');
    await canvas.focus();const before=await canvas.screenshot();
    await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);
    assert.notDeepEqual(await canvas.screenshot(),before,'Keyboard must change the rendered view');
    await page.keyboard.press('+');await page.keyboard.press('Home');
    for(const view of ['front','side','back','overview'])await page.click(`[data-view="${view}"]`);
    const box=await canvas.boundingBox();
    await page.mouse.move(box.x+box.width*.4,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5,{steps:5});await page.mouse.up();
    await page.click('[data-action="close"]');
    assert.equal(await page.locator('#country-viewer').isVisible(),false);
    assert.equal(await page.locator(opener('japan')).evaluate(e=>e===document.activeElement),true);
    await page.click(opener('korea'));await loaded(page);
    await page.evaluate(()=>location.hash='history');await page.locator('#panel-history').waitFor({state:'visible'});
    await page.evaluate(()=>location.hash='countries');await page.locator('#panel-countries').waitFor({state:'visible'});await loaded(page);
    assert.equal(await original.evaluate(c=>c===document.querySelector('.country-model-stage canvas')),true);
    if(width===1440){
      await canvas.evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
      await page.locator('.country-model-retry:not([hidden])').waitFor();
      await page.click('.country-model-retry');await loaded(page);
      assert.equal(await page.locator('.country-model-stage canvas').count(),1);
      assert.equal(await original.evaluate(c=>c.isConnected),false,'Lost context is disposed on retry');
    }
    results.push({width,countries:width===1440?12:3,keyboard:true,reuse:true});await context.close();
  }
  // WebGL failure keeps the evidence readable, then retries with a new renderer.
  const fallback=await browser.newPage();
  await fallback.addInitScript(()=>{window.block3D=true;const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return window.block3D&&/webgl/.test(type)?null:get.call(this,type,...args)}});
  await fallback.goto(url);await ready(fallback);await fallback.click(opener('japan'));
  await fallback.locator('.country-model-retry:not([hidden])').waitFor();
  assert.ok(await fallback.locator('.country-model-description').innerText());
  assert.equal(await fallback.locator('.country-photo').count(),12);
  await fallback.evaluate(()=>window.block3D=false);await fallback.click('.country-model-retry');await loaded(fallback);await fallback.close();
  // Module fetch failures are recoverable by a full page reload (module failures cache).
  const network=await browser.newPage();let block=true;
  await network.route('**/country-scene.js',r=>block?r.abort():r.continue());
  await network.goto(url);await ready(network);await network.click(opener('uk'));
  await network.locator('.country-model-retry:not([hidden])').waitFor();
  assert.equal(await network.locator('.country-model-retry').innerText(),'重新載入頁面');
  block=false;await network.click('.country-model-retry');await ready(network);await network.click(opener('uk'));await loaded(network);await network.close();
  // Closing during an in-flight load must not reopen the viewer.
  const delayed=await browser.newPage();let release;
  const gate=new Promise(resolve=>{release=resolve});
  await delayed.route('**/country-scene.js',async r=>{await gate;await r.continue()});
  await delayed.goto(url);await ready(delayed);await delayed.click(opener('japan'));await delayed.click('[data-action="close"]');
  release();await delayed.waitForFunction(()=>document.querySelector('.country-model-stage canvas'));
  assert.equal(await delayed.locator('#country-viewer').isVisible(),false);
  await delayed.click(opener('denmark'));await loaded(delayed);await delayed.close();
  assert.deepEqual(errors,[]);
  await writeFile(resolve(qa,'country-browser.json'),JSON.stringify({results,errors,fallback:true,networkRetry:true,closedDuringLoad:true},null,2));
  console.log('Country browser checks passed: 12 models; 4 widths; keyboard, drag, reuse, context loss, WebGL/module fallback and loading lifecycle.');
}finally{await browser.close()}
