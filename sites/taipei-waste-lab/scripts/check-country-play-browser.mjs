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
async function loaded(page){await page.waitForFunction(()=>document.querySelector('.country-model-status')?.textContent.includes('外觀示意已載入。'));await page.waitForTimeout(150)}
const progress=page=>page.locator('#country-play-progress').inputValue().then(Number);
const state=page=>page.locator('.country-model-play').getAttribute('data-state');
async function seek(page,value){await page.locator('#country-play-progress').evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}))},value);await page.waitForTimeout(100)}
async function stable(page){await page.waitForTimeout(100);const before=await page.evaluate(()=>window.countryDraws);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.countryDraws),before,'No country draw calls while inactive or resting')}
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width===390,reducedMotion:'no-preference'});
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.countryDraws=0;
      const clear=WebGL2RenderingContext.prototype.clear;
      WebGL2RenderingContext.prototype.clear=function(...args){if(this.canvas.closest('.country-model-stage'))window.countryDraws++;return clear.apply(this,args)};
    });
    await page.goto(url);await page.click('#country-japan + .country-model-open');await loaded(page);
    const canvas=page.locator('.country-model-stage canvas');
    for(const id of width===1440?ids:['japan','korea','india']){
      await page.selectOption('#country-model-select',id);await loaded(page);
      assert.equal(await state(page),'ready');await stable(page);
      const before=await canvas.screenshot();
      await page.click('[data-play="toggle"]');await page.waitForFunction(()=>Number(document.querySelector('#country-play-progress').value)>5);
      assert.equal(await state(page),'playing');
      await page.click('[data-play="toggle"]');assert.equal(await state(page),'paused');
      const paused=await progress(page);await page.waitForTimeout(150);assert.equal(await progress(page),paused);await stable(page);
      await seek(page,32);assert.equal(await state(page),'paused');
      assert.notDeepEqual(await canvas.screenshot(),before,id+' action must visibly change the model');
      if(width===1440||id==='japan'){
        await page.locator('#country-viewer').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
        await page.screenshot({path:resolve(qa,`country-play-${width}-${id}.png`)});
      }
      await seek(page,99);await page.click('[data-play="toggle"]');
      await page.waitForFunction(()=>document.querySelector('.country-model-play').dataset.state==='complete');
      assert.equal(await progress(page),100);await stable(page);
      await page.click('[data-play="reset"]');assert.equal(await state(page),'ready');assert.equal(await progress(page),0);
      results.push({width,id,motion:true,pause:true,seek:true,complete:true,reset:true});
    }
    await page.selectOption('#country-model-select','japan');await loaded(page);
    // Turntable moves the camera, then direct manipulation stops it.
    await page.click('[data-play="rotate"]');await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-play="rotate"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(),0);
    await canvas.focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-play="rotate"]').getAttribute('aria-pressed'),'false');await stable(page);
    // Dragging must not also trigger a throw; a deliberate tap does.
    await page.click('[data-view="front"]');
    const box=await canvas.boundingBox(),x=box.x+box.width/2,y=box.y+box.height*.5;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y,{steps:5});await page.mouse.up();
    assert.equal(await state(page),'ready');
    for(const distance of [6,7]){
      await page.click('[data-play="reset"]');await page.click('[data-view="front"]');
      const area=await canvas.boundingBox(),startX=area.x+area.width*.42,startY=area.y+area.height*.5;
      await page.mouse.move(startX,startY);await page.mouse.down();await page.mouse.move(startX+distance,startY);await page.mouse.up();
      assert.equal(await state(page),distance===6?'playing':'ready',`Tap/drag boundary at ${distance}px`);
    }
    await canvas.focus();await page.keyboard.press('Enter');assert.equal(await state(page),'playing');
    await page.keyboard.press('Space');assert.equal(await state(page),'paused');
    await page.click('[data-play="reset"]');await page.click('[data-view="front"]');
    const tap=await canvas.boundingBox(),tapX=tap.x+tap.width/2,tapY=tap.y+tap.height*.5;
    if(width===390)await page.touchscreen.tap(tapX,tapY);else await page.mouse.click(tapX,tapY);
    await page.waitForFunction(()=>document.querySelector('.country-model-play').dataset.state==='playing');
    // Real scrolling out of view suspends both progress and GPU work, then resumes.
    await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await page.waitForTimeout(150);
    assert.ok((await canvas.boundingBox()).y+ (await canvas.boundingBox()).height<0,'Canvas must actually be outside the viewport');
    const outside=await progress(page);await stable(page);assert.equal(await progress(page),outside);
    await page.locator('#country-viewer').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
    await page.waitForFunction(value=>Number(document.querySelector('#country-play-progress').value)>value,outside);
    // Controlled visibility event exercises hidden-tab suspension with no elapsed-time jump.
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
    const hidden=await progress(page);await stable(page);assert.equal(await progress(page),hidden);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
    await page.waitForFunction(value=>Number(document.querySelector('#country-play-progress').value)>value,hidden);
    // Route/close suspend the same renderer; country replacement cancels the old action.
    await page.evaluate(()=>location.hash='history');await page.waitForTimeout(100);await stable(page);
    await page.evaluate(()=>location.hash='countries');await loaded(page);
    await page.selectOption('#country-model-select','uk');await loaded(page);assert.equal(await state(page),'ready');
    await page.click('[data-play="toggle"]');await page.click('[data-action="close"]');await page.waitForTimeout(100);await stable(page);
    await page.click('#country-uk + .country-model-open');await loaded(page);
    // A live preference change cancels ongoing motion; the slider remains inspectable.
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
    assert.equal(await state(page),'complete');assert.equal(await page.locator('[data-play="rotate"]').isDisabled(),true);await stable(page);
    await seek(page,40);assert.equal(await state(page),'paused');await stable(page);
    await page.click('[data-play="toggle"]');assert.equal(await state(page),'complete');await stable(page);
    assert.ok((await page.locator('.country-play-state').innerText()).includes('已減少動態效果'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(resolve(qa,'country-play-browser.json'),JSON.stringify({results,errors,offscreen:true,visibility:true,reducedMotion:true},null,2));
  console.log('Country play browser checks passed: 12 actions, pause/seek/reset/finish, tap versus drag, turntable, reduced motion, offscreen/hidden/route/close suspension at desktop and mobile widths.');
}finally{await browser.close()}
