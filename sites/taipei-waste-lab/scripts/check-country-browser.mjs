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
  const reader=page.locator('#country-reader-select');
  if(await reader.isVisible())await page.selectOption('#country-reader-select',id);
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
  await page.waitForTimeout(100);
}
async function openCase(page,id,width){await readCase(page,id,width);await page.click(opener(id));await loaded(page)}
async function openDetails(page,selector){const details=page.locator(selector);if(!await details.evaluate(e=>e.open))await details.locator('summary').click()}
async function photoRoundTrip(page,width){
  const photo=page.locator('.country-inline-photo img');
  assert.equal(await photo.count(),1,'Selected case photo remains available in the exhibit');
  assert.ok(await photo.getAttribute('alt'),'Photo retains descriptive alternative text');
  if(width<=760){
    await page.click('[data-mode="photo"]');
    assert.equal(await page.locator('[data-mode="photo"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#country-viewer').getAttribute('data-media'),'photo');
    assert.equal(await page.locator('.country-model-visual').evaluate(e=>e.hidden),true);
    assert.equal(await page.locator('.country-photo-column').evaluate(e=>e.hidden),false);
    if(width===390)await page.screenshot({path:resolve(qa,'country-ux-mobile-photo.png')});
    await page.click('[data-mode="model"]');
    assert.equal(await page.locator('[data-mode="model"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.country-model-stage canvas').count(),1,'Switching media retains the renderer');
  }else{
    assert.equal(await page.locator('.country-model-visual').isVisible(),true);
    assert.equal(await page.locator('.country-photo-column').isVisible(),true);
  }
}
async function assertPhotoSourceMatches(page,id){
  const source=page.locator(`.country-case[aria-labelledby="country-${id}"] .country-case-grid > .country-photo`);
  const exhibit=page.locator('#country-viewer .country-inline-photo > .country-photo');
  assert.equal(await source.count(),1,`Source article photo exists for ${id}`);
  assert.equal(await exhibit.count(),1,`Exhibit preserves the selected photo figure for ${id}`);
  const links=figure=>figure.locator('a.country-source').evaluateAll(anchors=>anchors.map(anchor=>anchor.href));
  assert.deepEqual(await links(exhibit),await links(source),`Exhibit preserves source links for ${id}`);
  assert.equal(await exhibit.locator('.country-photo-frame').innerText(),await source.locator('.country-photo-frame').innerText());
  assert.equal(await exhibit.locator('figcaption').innerText(),await source.locator('figcaption').innerText());
}
async function bounds(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page must not overflow')}
async function visiblePoint(page,element,selector){
  await element.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  const box=await element.boundingBox();
  const viewport=await page.evaluate(()=>{
    const header=document.querySelector('.site-header')?.getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,header:header?{left:header.left,right:header.right,bottom:header.bottom}:null};
  });
  const left=Math.max(box.x+2,2),right=Math.min(box.x+box.width-2,viewport.width-2);
  const headerOverlaps=viewport.header&&viewport.header.left<box.x+box.width&&viewport.header.right>box.x;
  const top=Math.max(box.y+2,headerOverlaps?viewport.header.bottom+2:2),bottom=Math.min(box.y+box.height-2,viewport.height-2);
  assert.ok(right>left&&bottom>top,`No viewport-safe hit area for ${selector}: ${JSON.stringify({box,viewport})}`);
  const point={x:left+(right-left)/2,y:top+(bottom-top)/2};
  assert.equal(await page.evaluate(({x,y,selector})=>{
    const target=document.querySelector(selector),hit=document.elementFromPoint(x,y);
    return Boolean(target&&hit&&(hit===target||target.contains(hit)));
  },{...point,selector}),true,`Gesture point for ${selector} must be visible and unobscured`);
  return {...point,left,right,top,bottom};
}
try{
  for(const width of [1440,720,390,320]){
    console.log(`Country browser width=${width}`);
    const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<720,reducedMotion:'reduce'});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    const requests=[];page.on('request',r=>requests.push(r.url()));
    await page.goto(url);await ready(page);
    assert.equal(await page.locator('.country-model-open').count(),12);
    assert.equal(requests.some(r=>r.includes('/vendor/three/')),false,'Three must remain lazy');
    await page.click(opener('japan'));await loaded(page);
    const original=await page.locator('.country-model-stage canvas').elementHandle();
    for(const id of width===1440?ids:['japan','india','australia']){
      await openCase(page,id,width);await bounds(page);
      assert.equal(await page.locator('#country-model-title').evaluate(e=>e===document.activeElement),true,'Opening a case moves focus to its exhibit heading');
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
    await openCase(page,'japan',width);
    await openDetails(page,'.country-model-tools');
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
    await photoRoundTrip(page,width);
    assert.equal(await page.locator('[data-view="side"]').getAttribute('aria-pressed'),'true','Photo round trip retains camera');
    await page.click('.country-model-evidence');
    assert.equal(await page.locator('#country-japan').evaluate(e=>e===document.activeElement),true,'The exhibit shortcut returns focus to case reading');
    assert.equal(await page.locator('#country-play-disclosure').evaluate(e=>e.open),false,'Returning to reading collapses the exhibit');
    if([1440,390].includes(width))await page.screenshot({path:resolve(qa,`country-ux-${width}.png`)});
    await openCase(page,'japan',width);
    await openDetails(page,'.country-model-tools');
    // Ordinary wheel scrolling is not consumed by OrbitControls.
    await page.locator('#country-viewer').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
    const wheelPoint=await visiblePoint(page,canvas,'.country-model-stage canvas');await page.mouse.move(wheelPoint.x,wheelPoint.y);
    const scrollBefore=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,180);await page.waitForTimeout(150);
    assert.ok(await page.evaluate(()=>scrollY)>scrollBefore+100,'Wheel over canvas scrolls the page');
    await page.locator('#country-viewer').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
    if(width===1440){
      const pointer=await visiblePoint(page,canvas,'.country-model-stage canvas');await page.mouse.move(pointer.x,pointer.y);
      const cameraBefore=await canvas.screenshot(),scrollBeforeZoom=await page.evaluate(()=>scrollY);
      await page.keyboard.down('Control');await page.mouse.wheel(0,120);await page.keyboard.up('Control');await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>scrollY),scrollBeforeZoom,'Ctrl-wheel changes model zoom, not page scroll');
      assert.notDeepEqual(await canvas.screenshot(),cameraBefore);
    }
    if(width===390){
      const cdp=await context.newCDPSession(page);
      const touchPoint=await visiblePoint(page,canvas,'.country-model-stage canvas'),{x,y}=touchPoint;
      const pinchRadius=Math.min(35,(x-touchPoint.left)*.7,(touchPoint.right-x)*.7);
      assert.ok(pinchRadius>=18,'Pinch points fit inside the visible canvas area');
      const beforePinch=await canvas.screenshot(),pageBeforePinch=await page.evaluate(()=>scrollY);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-pinchRadius*.6,y,id:1},{x:x+pinchRadius*.6,y,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-pinchRadius,y,id:1},{x:x+pinchRadius,y,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(100);
      assert.notDeepEqual(await canvas.screenshot(),beforePinch,'Two-finger pinch changes model zoom');
      assert.equal(await page.evaluate(()=>scrollY),pageBeforePinch);
      await page.click('[data-view="front"]');
      const dragPoint=await visiblePoint(page,canvas,'.country-model-stage canvas');
      const dx=dragPoint.left+(dragPoint.right-dragPoint.left)*.25,dy=dragPoint.y;
      const dragEndX=Math.min(dx+60,dragPoint.right);
      assert.ok(dragEndX-dx>6,'Touch rotation exceeds the gesture threshold');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:dx,y:dy,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:dragEndX,y:dy,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(),0,'Touch drag rotates model');
      const copyPoint=await visiblePoint(page,page.locator('.country-model-copy'),'.country-model-copy'),{x:tx,y:ty}=copyPoint;
      const pageBeforeSwipe=await page.evaluate(()=>scrollY);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty,id:1}]});
      for(let i=1;i<=5;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx,y:ty-i*30,id:1}]});await page.waitForTimeout(30)}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(150);
      assert.ok(await page.evaluate(()=>scrollY)>pageBeforeSwipe+80,'Swipe outside canvas scrolls page');
      await cdp.detach();
    }
    await page.click('[data-view="overview"]');
    const dragPoint=await visiblePoint(page,canvas,'.country-model-stage canvas');
    const startX=dragPoint.left+(dragPoint.right-dragPoint.left)*.25,endX=dragPoint.left+(dragPoint.right-dragPoint.left)*.75;
    assert.ok(endX-startX>6,'Rotation drag exceeds the gesture threshold');
    await page.mouse.move(startX,dragPoint.y);await page.mouse.down();await page.mouse.move(endX,dragPoint.y,{steps:5});await page.mouse.up();
    assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(),0,'Drag updates preset state');
    await page.locator('#country-play-disclosure > summary').click();
    await page.waitForFunction(()=>document.querySelector('#country-japan + .country-model-open')?.getAttribute('aria-expanded')==='false');
    assert.equal(await page.locator('#country-viewer').isVisible(),false);
    assert.equal(await page.locator(opener('japan')).getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#country-play-disclosure > summary').evaluate(e=>e===document.activeElement),true);
    await page.click(opener('japan'));await loaded(page);
    assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(),0,'Reopening the same case retains view');
    await openCase(page,'korea',width);
    await page.locator('#country-play-disclosure > summary').click();
    await page.waitForFunction(()=>document.querySelector('#country-korea + .country-model-open')?.getAttribute('aria-expanded')==='false');
    assert.equal(await page.locator('#country-reader-select').inputValue(),'korea','Closing preserves the selected reading case');
    assert.equal(await page.locator(opener('korea')).getAttribute('aria-expanded'),'false');
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
  assert.ok(await fallback.locator('.country-observation-text').innerText(),'Evidence summary remains readable after WebGL failure');
  assert.ok(await fallback.locator('.country-evidence-list li').count());
  assert.equal(await fallback.locator('#panel-countries .country-case-grid > .country-photo').count(),12,'The twelve source articles keep their original photo cards');
  assert.equal(await fallback.locator('#country-viewer .country-inline-photo img').count(),1,'The exhibit separately shows its selected article photo');
  await fallback.setViewportSize({width:390,height:1000});
  await fallback.selectOption('#country-reader-select','australia');
  await fallback.click(opener('australia'));
  assert.ok((await fallback.locator('#country-model-title').innerText()).includes('澳洲'));
  await fallback.click('[data-mode="photo"]');
  assert.equal(await fallback.locator('#country-viewer').getAttribute('data-media'),'photo');
  await assertPhotoSourceMatches(fallback,'australia');
  await fallback.click('[data-mode="model"]');
  await fallback.evaluate(()=>window.block3D=false);await fallback.click('.country-model-retry');await loaded(fallback);await fallback.close();
  // Module fetch failures are recoverable by a full page reload (module failures cache).
  const network=await browser.newPage();let block=true;
  await network.route('**/country-scene.js',r=>block?r.abort():r.continue());
  await network.goto(url);await ready(network);await network.locator(indexTarget('uk')).click();await network.click(opener('uk'));
  await network.locator('.country-model-retry:not([hidden])').waitFor();
  assert.equal(await network.locator('.country-model-retry').innerText(),'重新載入頁面');
  block=false;await network.click('.country-model-retry');await ready(network);await network.locator(indexTarget('uk')).click();await network.click(opener('uk'));await loaded(network);await network.close();
  // Closing during an in-flight load must not reopen the viewer.
  const delayed=await browser.newPage();let release;
  const gate=new Promise(resolve=>{release=resolve});
  await delayed.route('**/country-scene.js',async r=>{await gate;await r.continue()});
  await delayed.goto(url);await ready(delayed);await delayed.click(opener('japan'));await delayed.locator('#country-play-disclosure > summary').click();
  release();await delayed.waitForFunction(()=>document.querySelector('.country-model-stage canvas'));
  assert.equal(await delayed.locator('#country-viewer').isVisible(),false);
  await openCase(delayed,'denmark',1280);await delayed.close();
  assert.deepEqual(errors,[]);
  await writeFile(resolve(qa,'country-browser.json'),JSON.stringify({results,errors,fallback:true,networkRetry:true,closedDuringLoad:true},null,2));
  console.log('Country browser checks passed: 12 models; 4 widths; case switching, photo round trips, view state, zoom limits, wheel scrolling, keyboard, drag, reuse, context loss, WebGL/module fallback and loading lifecycle.');
}finally{await browser.close()}
