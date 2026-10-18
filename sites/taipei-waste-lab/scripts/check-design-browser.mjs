import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const SITE_ROOT=resolve(fileURLToPath(new URL('.',import.meta.url)),'..');
const QA_DIR=resolve(SITE_ROOT,'qa');
const TARGET_URL=new URL(process.env.DESIGN_QA_URL||'http://127.0.0.1:4177/#design');
if(!TARGET_URL.hash||TARGET_URL.hash==='#')TARGET_URL.hash='design';
const TIMEOUT=20_000;
const NAMES={street:'街角隨手投',sorting:'回收分流站',hotspot:'高使用量管理',household:'家戶收受站'};
const ONE_PIXEL_PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
if(process.argv.includes('--help')){
  console.log('Serve the built site, then run node scripts/check-design-browser.mjs.\nSet DESIGN_QA_URL, PLAYWRIGHT_MODULE and CHROME_PATH as needed. Results go to ignored qa/.');
  process.exit(0);
}
function playwrightModule(){
  const value=process.env.PLAYWRIGHT_MODULE?.trim();
  return !value?'playwright':value.startsWith('file:')?value:isAbsolute(value)?pathToFileURL(value).href:value;
}
async function textContains(page,selector,value){
  await page.waitForFunction(({selector,value})=>document.querySelector(selector)?.textContent.includes(value),{selector,value},{timeout:TIMEOUT});
}
async function status(page,value){await textContains(page,'#design-status',value);}
async function newPage(browser,{width=1440,reducedMotion='no-preference',webglFailure=false,datasetFailure=false}={}){
  const context=await browser.newContext({viewport:{width,height:width<600?844:1000},isMobile:width<600,hasTouch:width<600,reducedMotion});
  if(webglFailure)await context.addInitScript(()=>{
    const native=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).toLowerCase().startsWith('webgl')?null:native.call(this,type,...args);};
  });
  const page=await context.newPage(),diagnostics={pageErrors:[],consoleErrors:[],failedRequests:[]};
  page.on('pageerror',error=>diagnostics.pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')diagnostics.consoleErrors.push(message.text());});
  page.on('requestfailed',request=>diagnostics.failedRequests.push(request.url()));
  await page.route('https://{tile.openstreetmap.org,basemaps.cartocdn.com}/**',route=>route.fulfill({status:200,contentType:'image/png',body:ONE_PIXEL_PNG}));
  if(datasetFailure)await page.route('**/data/datasets.json',route=>route.fulfill({status:503,contentType:'text/plain',body:'unavailable'}));
  await page.goto(TARGET_URL.href,{waitUntil:'domcontentloaded'});
  await page.locator('#panel-design').waitFor({state:'visible',timeout:TIMEOUT});
  await page.locator('#design-options option').nth(3).waitFor({state:'attached',timeout:TIMEOUT});
  if(webglFailure){
    await page.locator('#design-retry').waitFor({state:'visible',timeout:TIMEOUT});
    await textContains(page,'#design-fallback strong','無法顯示 3D');
    assert.equal(await page.locator('#design-viewport canvas').count(),0);
  }else await page.waitForFunction(()=>document.querySelector('#design-viewport')?.dataset.ready==='true',null,{timeout:TIMEOUT});
  return {page,context,diagnostics};
}
function healthy(diagnostics,{webglFailure=false,datasetFailure=false}={}){
  assert.deepEqual(diagnostics.pageErrors,[],'no uncaught errors');
  assert.deepEqual(diagnostics.failedRequests,[],'no failed requests');
  const allowed=[...(webglFailure?[/webgl/i]:[]),...(datasetFailure?[/503/,/Site initialization failed:.*Data response unavailable/]:[])];
  assert.deepEqual(diagnostics.consoleErrors.filter(text=>!allowed.some(pattern=>pattern.test(text))),[],'no unexpected console errors');
}
async function select(page,id,mode='deposit'){
  await page.selectOption('#design-options',id);
  await page.locator(`[data-design-demo="${mode}"]`).click();
  await textContains(page,'#design-name',NAMES[id]);
  assert.equal(await page.locator('#design-options').inputValue(),id);
  assert.equal(await page.locator('[data-design-demo][aria-pressed="true"]').count(),1);
  assert.equal(await page.locator('#design-workspace').getAttribute('data-mode'),mode);
  assert.equal(await page.locator('#design-workspace').getAttribute('data-complete'),'false');
}
async function next(page,message){await page.locator('#design-next').click();await status(page,message);}
async function complete(page){
  assert.equal(await page.locator('#design-workspace').getAttribute('data-complete'),'true');
  assert.equal(await page.locator('#design-next').innerText(),'重新示範');
  assert.equal(await page.locator('#design-demo-steps [aria-current]').count(),0);
}
async function deposit(page,id){
  await select(page,id);
  if(id==='street'){
    await next(page,'完成概念投放');
    await next(page,'這站不收家戶垃圾');
  }else if(id==='sorting'){
    await next(page,'進入回收槽');await next(page,'進入一般垃圾槽');
  }else if(id==='hotspot'){
    await next(page,'完成概念投放');await next(page,'容器已滿');
    await textContains(page,'#design-service-state','已滿');
  }else{
    await next(page,'住戶確認示意完成');
    await next(page,'示意袋已放入封閉投放艙');
    await next(page,'示意投放已確認');
  }
  await complete(page);
  await page.locator('#design-next').click();
  assert.equal(await page.locator('#design-workspace').getAttribute('data-complete'),'false','replay returns to first step');
  assert.equal(await page.locator('#design-demo-steps [aria-current="step"]').count(),1);
}
async function collection(page,id){
  await select(page,id,'collection');
  if(id==='hotspot'){
    await textContains(page,'#design-service-state','接近滿載');
    await next(page,'已安排收運示意，容器還沒有清空');
    await textContains(page,'#design-service-state','已安排收運');
  }
  await next(page,'清運門已開');
  await textContains(page,'#design-service-state','清運中・暫停投放');
  await next(page,'已完成清空示意');
  await textContains(page,'#design-fill-readout','0%');
  await next(page,'清運門已關');
  if(id==='hotspot'){
    await next(page,'感測離線，無法依讀值派收');
    await textContains(page,'#design-service-state','容量未知・需現場確認');
    await textContains(page,'#design-fill-readout','容量未知');
  }
  await complete(page);
}
async function allFlows(page){for(const id of Object.keys(NAMES)){await deposit(page,id);await collection(page,id);}}
async function noOverflow(page){
  const metrics=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,panel:document.querySelector('#panel-design').scrollWidth,panelWidth:document.querySelector('#panel-design').clientWidth}));
  assert.ok(metrics.document<=metrics.width+1&&metrics.body<=metrics.width+1&&metrics.panel<=metrics.panelWidth+1,JSON.stringify(metrics));
}
async function cleanInterface(page){
  assert.equal(await page.locator('#design-options').evaluate(element=>element.tagName),'SELECT','one native purpose selector');
  assert.equal(await page.locator('#design-options option').count(),4);
  assert.equal(await page.locator('[data-design-demo]').count(),2);
  assert.equal(await page.locator('#panel-design input[type="range"],#panel-design [data-scenario],#panel-design [data-design-role],#panel-design [data-design-item],#panel-design [data-design-view]').count(),0,'no parameter/role/object/scenario menus');
  assert.equal(await page.locator('#panel-design details').count(),0,'fixed proposal and process are directly readable');
  assert.equal(await page.locator('#panel-design .design-primary:visible').count(),1,'one next action');
}
async function proposal(page){
  await page.locator('[data-design-jump="t1-specification"]').first().click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'t1-specification');
  await page.locator('.t1-drawings img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  assert.equal(await page.locator('.t1-drawings img').count(),2);
  const fixed=await page.locator('.t1-specs').innerText();
  await select(page,'household');
  assert.equal(await page.locator('.t1-specs').innerText(),fixed,'service concepts do not rewrite fixed T1 proposal');
  await page.locator('[data-design-jump="t1-product-process-heading"]').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'t1-product-process-heading');
  await textContains(page,'.t1-process-status','尚未定案');
}
async function keyboard(page,{webglFailure=false}={}){
  await select(page,'household');
  await page.locator('#design-next').focus();
  await page.keyboard.press('Enter');await status(page,'住戶確認示意完成');
  await page.keyboard.press('Space');await status(page,'示意袋已放入封閉投放艙');
  await page.keyboard.press('Enter');await status(page,'示意投放已確認');
  if(!webglFailure){
    const canvas=page.locator('#design-viewport canvas');
    assert.equal(await canvas.getAttribute('tabindex'),'0');
    await canvas.focus();
    for(const key of ['ArrowLeft','ArrowUp','+','-','Home'])await canvas.press(key);
    assert.equal(await canvas.evaluate(element=>element===document.activeElement),true);
  }
}
async function navigation(page){
  await select(page,'street');
  const canvas=await page.locator('#design-viewport canvas').elementHandle();
  await page.evaluate(element=>{window.__designQaCanvas=element;},canvas);
  for(const name of ['countries','research','sources','map','design']){
    await page.evaluate(value=>{location.hash=value;},name);
    await page.locator(`#panel-${name}`).waitFor({state:'visible',timeout:TIMEOUT});
  }
  assert.equal(await page.locator('#design-viewport canvas').count(),1);
  assert.equal(await page.evaluate(()=>window.__designQaCanvas===document.querySelector('#design-viewport canvas')),true,'navigation reuses canvas');
}
async function main(){
  await mkdir(QA_DIR,{recursive:true});
  const result={status:'running',url:TARGET_URL.href,checks:{},screenshots:[]};
  let browser;
  try{
    const {chromium}=await import(playwrightModule());
    browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:resolve(process.env.CHROME_PATH)}:{})});
    result.browser_version=browser.version();
    const desktop=await newPage(browser);
    try{
      await cleanInterface(desktop.page);await allFlows(desktop.page);await keyboard(desktop.page);await proposal(desktop.page);await navigation(desktop.page);await noOverflow(desktop.page);
      await select(desktop.page,'street');await desktop.page.locator('#design-workspace').scrollIntoViewIfNeeded();
      await desktop.page.screenshot({path:resolve(QA_DIR,'desktop-design-guided.png')});
      result.screenshots.push('desktop-design-guided.png');healthy(desktop.diagnostics);result.checks.desktop_all_flows='passed';
    }finally{await desktop.context.close();}
    for(const width of [720,390,320]){
      const sample=await newPage(browser,{width});
      try{
        for(const id of Object.keys(NAMES)){await select(sample.page,id);await noOverflow(sample.page);}
        await keyboard(sample.page);await collection(sample.page,'hotspot');await noOverflow(sample.page);
        if(width===390){await sample.page.locator('#design-workspace').scrollIntoViewIfNeeded();await sample.page.screenshot({path:resolve(QA_DIR,'mobile-design-guided.png')});result.screenshots.push('mobile-design-guided.png');}
        healthy(sample.diagnostics);result.checks[`width_${width}`]='passed';
      }finally{await sample.context.close();}
    }
    for(const options of [{reducedMotion:'reduce'},{datasetFailure:true},{webglFailure:true,width:390}]){
      const sample=await newPage(browser,options);
      try{
        await allFlows(sample.page);await keyboard(sample.page,options);await noOverflow(sample.page);
        if(options.webglFailure){
          await sample.page.locator('#design-retry').click();await sample.page.locator('#design-retry').waitFor({state:'visible',timeout:TIMEOUT});
          assert.equal(await sample.page.locator('#design-viewport canvas').count(),0);
          await textContains(sample.page,'#design-fallback p','文字會說明每次操作結果');
        }
        healthy(sample.diagnostics,options);
        result.checks[options.webglFailure?'webgl_failure_all_flows':options.datasetFailure?'dataset_failure_independence':'reduced_motion_all_flows']='passed';
      }finally{await sample.context.close();}
    }
    result.status='passed';
  }catch(error){result.status='failed';result.error=error.stack||String(error);process.exitCode=1;}
  finally{await browser?.close();await writeFile(resolve(QA_DIR,'design-browser-results.json'),JSON.stringify(result,null,2)+'\n');}
  console.log(JSON.stringify(result,null,2));
}
await main();
