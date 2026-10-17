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
const indexTarget=id=>`.country-index [data-country-target="country-${id}"]`;
async function ready(page){await page.locator(opener('japan')).waitFor()}
async function readCase(page,id,width){
  if(width<=639)await page.selectOption('#country-reader-select',id);
  else await page.locator(indexTarget(id)).click();
  await page.waitForFunction(id=>document.querySelector('#country-reader-select')?.value===id,id);
  await page.locator(opener(id)).waitFor({state:'visible'});
}
async function loaded(page){
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('.country-model-stage canvas');
    const play=document.querySelector('.country-model-play'),status=document.querySelector('.country-model-status');
    return canvas?.isConnected&&play&&!play.hidden&&status?.textContent==='';
  });
  await page.waitForTimeout(150);
}
async function openCase(page,id,width){await readCase(page,id,width);await page.click(opener(id));await loaded(page)}
async function openDetails(page,selector){const details=page.locator(selector);if(!await details.evaluate(e=>e.open))await details.locator('summary').click()}
const progress=page=>page.locator('#country-play-progress').inputValue().then(Number);
const state=page=>page.locator('.country-model-play').getAttribute('data-state');
async function seek(page,value){await openDetails(page,'.country-timeline-tools');await page.locator('#country-play-progress').evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}))},value);await page.waitForTimeout(100)}
async function findPartPoint(page,canvas){
  const box=await canvas.boundingBox();
  for(const y of [.2,.3,.4,.5,.6,.7,.8])for(const x of [.2,.3,.4,.5,.6,.7,.8]){
    await page.mouse.click(box.x+box.width*x,box.y+box.height*y);
    const selected=await page.locator('.country-part-buttons button[aria-pressed="true"]').getAttribute('data-part');
    if(selected){
      if(await state(page)==='playing'){
        await page.click('[data-play="reset"]');
        await page.waitForFunction(()=>document.querySelector('.country-model-play').dataset.state==='ready');
      }
      assert.equal(await state(page),'ready');
      return {x,y,part:selected};
    }
    if(await state(page)==='playing'){
      await page.click('[data-play="reset"]');
      await page.waitForFunction(()=>document.querySelector('.country-model-play').dataset.state==='ready');
    }
  }
  assert.fail('Could not find a visible model part that responds to a canvas tap');
}
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
    await page.goto(url);await ready(page);await openCase(page,'japan',width);
    const canvas=page.locator('.country-model-stage canvas');
    for(const id of width===1440?ids:['japan','korea','india']){
      await openCase(page,id,width);
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
    await openCase(page,'japan',width);
    // Turntable moves the camera, then direct manipulation stops it.
    await openDetails(page,'.country-model-tools');
    await page.click('[data-play="rotate"]');await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-play="rotate"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(),0);
    await canvas.focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-play="rotate"]').getAttribute('aria-pressed'),'false');await stable(page);
    // A drag past the threshold rotates without selecting or playing a part.
    await page.click('[data-view="front"]');
    const box=await canvas.boundingBox(),x=box.x+box.width/2,y=box.y+box.height*.5;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y,{steps:5});await page.mouse.up();
    assert.equal(await state(page),'ready');
    assert.equal(await page.locator('.country-part-buttons button[aria-pressed="true"]').getAttribute('data-part'),'','A drag does not select a model part');
    await page.click('[data-view="front"]');
    const target=await findPartPoint(page,canvas);
    assert.equal(await page.locator(`.country-part-buttons button[data-part="${target.part}"]`).getAttribute('aria-pressed'),'true','A short tap selects the hit model part');
    for(const distance of [6,7]){
      await page.click('[data-play="reset"]');await page.click('[data-view="front"]');
      const area=await canvas.boundingBox(),startX=area.x+area.width*target.x,startY=area.y+area.height*target.y;
      await page.mouse.move(startX,startY);await page.mouse.down();await page.mouse.move(startX+distance,startY);await page.mouse.up();
      assert.equal(await state(page),distance===6?'playing':'ready',`Tap/drag boundary at ${distance}px`);
      assert.equal(await page.locator(`.country-part-buttons button[data-part="${target.part}"]`).getAttribute('aria-pressed'),'true',`Part selection remains stable at ${distance}px`);
    }
    await canvas.focus();await page.keyboard.press('Enter');assert.equal(await state(page),'playing');
    await page.keyboard.press('Space');assert.equal(await state(page),'paused');
    await page.click('[data-play="reset"]');await page.click('[data-view="front"]');
    const tap=await canvas.boundingBox(),tapX=tap.x+tap.width*target.x,tapY=tap.y+tap.height*target.y;
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
    await openCase(page,'uk',width);assert.equal(await state(page),'ready');
    await page.click('[data-play="toggle"]');
    await page.locator('#country-play-disclosure > summary').click();
    const closed=await progress(page);await stable(page);assert.equal(await progress(page),closed,'Closing the exhibit suspends playback progress');
    await page.click(opener('uk'));await loaded(page);
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
