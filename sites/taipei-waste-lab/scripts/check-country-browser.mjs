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
async function loaded(page){await page.waitForFunction(()=>document.querySelector('.country-model-status')?.textContent.includes('外觀示意已載入。'));await page.waitForTimeout(100)}
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
      await page.selectOption('#country-model-select',id);await loaded(page);await bounds(page);
      assert.equal(await page.locator('#country-model-select').evaluate(e=>e===document.activeElement),true,'Keep selector focus after moving the viewer');
      assert.equal(await page.locator(opener(id)).getAttribute('aria-expanded'),'true');
      assert.equal(await page.locator('.country-model-open[aria-expanded="true"]').count(),1);
      const viewer=await page.locator('#country-viewer').boundingBox();
      const headerBottom=await page.locator('.site-header').evaluate(e=>innerWidth<960?e.getBoundingClientRect().bottom:0);
      assert.ok(viewer.y>=headerBottom,'Viewer heading stays below sticky navigation');
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
    assert.equal(await page.locator('[data-view="overview"]').getAttribute('aria-pressed'),'true');
    await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(),0,'Manual rotation clears preset state');
    assert.notDeepEqual(await canvas.screenshot(),before,'Keyboard must change the rendered view');
    await page.keyboard.press('+');await page.keyboard.press('Home');
    for(const view of ['front','side','back','overview']){
      await page.click(`[data-view="${view}"]`);
      assert.equal(await page.locator(`[data-view="${view}"]`).getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(),1);
    }
    for(let i=0;i<12;i++)await page.locator('[data-zoom="1"]').evaluate(e=>e.click());
    assert.equal(await page.locator('[data-zoom="1"]').isDisabled(),true);
    assert.equal(await page.locator('[data-zoom="-1"]').isEnabled(),true);
    for(let i=0;i<12;i++)await page.locator('[data-zoom="-1"]').evaluate(e=>e.click());
    assert.equal(await page.locator('[data-zoom="-1"]').isDisabled(),true);
    assert.equal(await page.locator('[data-zoom="1"]').isEnabled(),true);
    await page.click('[data-view="side"]');
    await page.click('.country-model-photo-link');
    assert.equal(await page.locator('#country-japan').evaluate(e=>e.closest('article').querySelector('.country-photo')===document.activeElement),true);
    if(width===390)await page.screenshot({path:resolve(qa,'country-ux-mobile-photo.png')});
    await page.click('.country-model-return:not([hidden])');
    assert.equal(await page.locator('#country-model-title').evaluate(e=>e===document.activeElement),true);
    assert.equal(await page.locator('[data-view="side"]').getAttribute('aria-pressed'),'true','Photo round trip retains camera');
    if([1440,390].includes(width))await page.screenshot({path:resolve(qa,`country-ux-${width}.png`)});
    // Ordinary wheel scrolling is not consumed by OrbitControls.
    await page.locator('#country-viewer').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
    const wheelBox=await canvas.boundingBox();await page.mouse.move(wheelBox.x+wheelBox.width/2,wheelBox.y+wheelBox.height/2);
    const scrollBefore=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,180);await page.waitForTimeout(150);
    assert.ok(await page.evaluate(()=>scrollY)>scrollBefore+100,'Wheel over canvas scrolls the page');
    await page.locator('#country-viewer').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
    if(width===1440){
      const pointer=await canvas.boundingBox();await page.mouse.move(pointer.x+pointer.width/2,pointer.y+pointer.height/2);
      const cameraBefore=await canvas.screenshot(),scrollBeforeZoom=await page.evaluate(()=>scrollY);
      await page.keyboard.down('Control');await page.mouse.wheel(0,120);await page.keyboard.up('Control');await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>scrollY),scrollBeforeZoom,'Ctrl-wheel changes model zoom, not page scroll');
      assert.notDeepEqual(await canvas.screenshot(),cameraBefore);
    }
    if(width===390){
      const cdp=await context.newCDPSession(page);
      const touchBox=await canvas.boundingBox(),x=touchBox.x+touchBox.width/2,y=touchBox.y+touchBox.height/2;
      const beforePinch=await canvas.screenshot(),pageBeforePinch=await page.evaluate(()=>scrollY);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-35,y,id:1},{x:x+35,y,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-65,y,id:1},{x:x+65,y,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(100);
      assert.notDeepEqual(await canvas.screenshot(),beforePinch,'Two-finger pinch changes model zoom');
      assert.equal(await page.evaluate(()=>scrollY),pageBeforePinch);
      await page.click('[data-view="front"]');
      const dragBox=await canvas.boundingBox(),dx=dragBox.x+dragBox.width*.4,dy=dragBox.y+dragBox.height/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:dx,y:dy,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:dx+60,y:dy,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(),0,'Touch drag rotates model');
      await page.locator('.country-model-description').scrollIntoViewIfNeeded();
      const copy=await page.locator('.country-model-description').boundingBox(),tx=copy.x+copy.width/2,ty=Math.min(copy.y+copy.height/2,850);
      const pageBeforeSwipe=await page.evaluate(()=>scrollY);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty,id:1}]});
      for(let i=1;i<=5;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx,y:ty-i*30,id:1}]});await page.waitForTimeout(30)}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(150);
      assert.ok(await page.evaluate(()=>scrollY)>pageBeforeSwipe+80,'Swipe outside canvas scrolls page');
      await cdp.detach();
    }
    await page.click('[data-view="overview"]');
    const box=await canvas.boundingBox();
    await page.mouse.move(box.x+box.width*.4,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5,{steps:5});await page.mouse.up();
    assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(),0,'Drag updates preset state');
    await page.click('[data-action="close"]');
    assert.equal(await page.locator('#country-viewer').isVisible(),false);
    assert.equal(await page.locator(opener('japan')).evaluate(e=>e===document.activeElement),true);
    await page.click(opener('japan'));await loaded(page);
    assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(),0,'Reopening the same case retains view');
    await page.selectOption('#country-model-select','korea');await loaded(page);
    await page.click('[data-action="close"]');
    assert.equal(await page.locator(opener('korea')).evaluate(e=>e===document.activeElement),true,'Close returns to selected case');
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
  await fallback.selectOption('#country-model-select','australia');
  assert.ok((await fallback.locator('#country-model-title').innerText()).includes('澳洲'));
  await fallback.click('.country-model-photo-link');
  assert.equal(await fallback.locator('#country-australia').evaluate(e=>e.closest('article').querySelector('.country-photo')===document.activeElement),true);
  await fallback.click('.country-model-return:not([hidden])');
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
  console.log('Country browser checks passed: 12 models; 4 widths; case switching, photo round trips, view state, zoom limits, wheel scrolling, keyboard, drag, reuse, context loss, WebGL/module fallback and loading lifecycle.');
}finally{await browser.close()}
