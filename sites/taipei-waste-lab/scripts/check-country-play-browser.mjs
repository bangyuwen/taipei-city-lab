import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:resolve(process.env.CHROME_PATH)}:{})});
const url=(process.env.COUNTRY_QA_URL||'http://127.0.0.1:4174/').replace(/#.*$/,'')+'#countries';
const qa=fileURLToPath(new URL('../.impeccable/review/',import.meta.url));
const errors=[],results=[];await mkdir(qa,{recursive:true});
const state=page=>page.locator('.country-model-controls').getAttribute('data-state');
async function loaded(page){await page.waitForFunction(()=>document.querySelector('.country-model-controls')?.hidden===false&&document.querySelector('.country-model-status')?.textContent==='')}
async function openCase(page,id){await page.selectOption('#country-reader-select',id);await page.click('[data-mode="model"]');await loaded(page)}
async function stable(page){
  await page.waitForTimeout(100);const before=await page.evaluate(()=>window.countryDraws);await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>window.countryDraws),before,'No country draw calls while inactive or resting');
}
async function moving(page){const before=await page.evaluate(()=>window.countryDraws);await page.waitForFunction(before=>window.countryDraws>before,before)}
async function reset(page){await page.click('[data-play="reset"]');assert.equal(await state(page),'ready')}
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width===390,reducedMotion:'no-preference'});
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.countryDraws=0;const clear=WebGL2RenderingContext.prototype.clear;
      WebGL2RenderingContext.prototype.clear=function(...args){if(this.canvas.closest('.country-model-stage'))window.countryDraws++;return clear.apply(this,args)};
    });
    await page.goto(url);await page.locator('.country-reading-ready').waitFor();
    for(const id of ['japan','korea','india']){
      await openCase(page,id);assert.equal(await state(page),'ready');await stable(page);
      const canvas=page.locator('.country-model-stage canvas'),before=await canvas.screenshot();
      await page.click('[data-play="toggle"]');assert.equal(await state(page),'playing');await page.waitForTimeout(350);
      await page.click('[data-play="toggle"]');assert.equal(await state(page),'paused');await stable(page);
      assert.notDeepEqual(await canvas.screenshot(),before,id+' action visibly changes the model');
      await page.click('[data-play="toggle"]');await page.waitForFunction(()=>document.querySelector('.country-model-controls')?.dataset.state==='complete');
      assert.equal(await page.locator('[data-play="toggle"]').innerText(),'重播');await stable(page);await reset(page);
      results.push({width,id,play:true,pause:true,complete:true,reset:true});
    }
    await openCase(page,'japan');const canvas=page.locator('.country-model-stage canvas');
    await canvas.focus();await page.keyboard.press('Enter');assert.equal(await state(page),'playing');
    await page.keyboard.press('Space');assert.equal(await state(page),'paused');await stable(page);await reset(page);
    // Rotating beyond the pointer threshold does not trigger a part animation.
    await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();
    await page.mouse.move(box.x+box.width*.3,box.y+box.height*.5);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5,{steps:5});await page.mouse.up();assert.equal(await state(page),'ready');
    // Switching to the photo suspends the same model; returning resumes it.
    await page.click('[data-play="toggle"]');await moving(page);
    await page.click('[data-mode="photo"]');await stable(page);assert.equal(await state(page),'playing');
    await page.click('[data-mode="model"]');await moving(page);
    // Offscreen and hidden-tab suspension stop GPU work without losing the state.
    await page.evaluate(()=>{
      const spacer=document.createElement('div');spacer.id='country-qa-spacer';spacer.style.height='150vh';document.body.append(spacer);
      scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
    });
    await page.waitForTimeout(100);await stable(page);
    assert.ok((await canvas.boundingBox()).y+(await canvas.boundingBox()).height<0,'Model is outside the viewport');
    await canvas.scrollIntoViewIfNeeded();await moving(page);await page.evaluate(()=>document.getElementById('country-qa-spacer').remove());
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
    await stable(page);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});await moving(page);
    // Routing away suspends rendering; returning reuses the canvas.
    const original=await canvas.elementHandle();await page.evaluate(()=>location.hash='history');await page.waitForTimeout(100);await stable(page);
    await page.evaluate(()=>location.hash='countries');await loaded(page);
    assert.equal(await original.evaluate(canvas=>canvas===document.querySelector('.country-model-stage canvas')),true);
    await openCase(page,'uk');assert.equal(await state(page),'ready');await page.click('[data-play="toggle"]');
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.country-model-controls')?.dataset.state==='complete');await stable(page);
    await reset(page);await page.click('[data-play="toggle"]');assert.equal(await state(page),'complete');await stable(page);
    assert.match(await page.locator('.country-play-state').innerText(),/已減少動態效果/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.close();
  }
  assert.deepEqual(errors,[]);await writeFile(resolve(qa,'country-play-browser.json'),JSON.stringify({results,errors,photoSuspension:true,offscreen:true,visibility:true,route:true,reducedMotion:true},null,2));
  console.log('Country playback checks passed: play/pause/replay/reset, keyboard and drag, reduced motion, photo/offscreen/hidden/route suspension at desktop and mobile widths.');
}finally{await browser.close()}
