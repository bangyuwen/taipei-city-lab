// Build public/ first. External services are blocked; this checks local demo behavior.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.PORTAL_QA_URL||'http://127.0.0.1:4198/';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Asia/Taipei'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  await page.goto(new URL('demo/crew.html',base).href);
  await page.locator('[data-zone]').first().waitFor();
  const id=await page.evaluate(()=>{
   const id=P[0].id;addEvent({bin:id,kind:'clear',level:0,by:'清潔隊'});syncStatus();return id;
  });
  const status=()=>page.evaluate(id=>({other:!!refreshOC()[id],today:!!todayCrew()[id],who:!!crewWho()[id]}),id);
  assert.deepEqual(await status(),{other:false,today:false,who:false});
  // The old completion event must not remove the real amount-report entry.
  await page.getByRole('tab',{name:'全部桶',exact:true}).click();
  const tab=await page.evaluate(id=>apRows().find(r=>r.id===id).tab,id);
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.locator(`[data-bin="${id}"]`).click();
  await page.getByRole('button',{name:'導航到這桶',exact:true}).click();
  await page.getByRole('button',{name:'收運量：半',exact:true}).click();
  assert.equal((await status()).today,true);
  await page.getByRole('button',{name:'復原',exact:true}).click();
  assert.equal((await status()).today,false);
  await page.reload();await page.locator('#card[data-state="B"]').waitFor();
  assert.deepEqual(await status(),{other:false,today:false,who:false});
  // Bulk progress changes must never create observations or empty a bin.
  const before=await page.evaluate(()=>({events:getEvents(),forecast:FC.state()}));
  await page.locator('#menu').click();
  page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'將剩餘站點全部略過（不回報）…',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>({events:getEvents(),forecast:FC.state()})),before);
  assert.ok(await page.evaluate(()=>progLoad().skip.size>0));
  assert.deepEqual(await status(),{other:false,today:false,who:false});
  // An observed amount in another role tab still reaches the current page.
  const other=await context.newPage();await other.goto(new URL('demo/crew.html',base).href);
  await other.waitForFunction(()=>P.length>0);
  await other.evaluate(id=>addEvent({bin:id,kind:'clear',by:'清潔隊',amount:'half'}),id);
  await page.waitForFunction(id=>!!todayCrew()[id],id);
  assert.deepEqual(await status(),{other:true,today:true,who:true});
  await other.close();
  await page.goto(new URL('demo/planning.html',base).href);
  await page.waitForFunction(()=>currentPlan.textContent.includes('計畫尚未啟動'));
  assert.equal(await page.locator('#pbar .nowb,#pcur .now').count(),0);
  for(let i=0;i<5;i++){
   await page.locator(`[data-st="${i}"]`).click();
   assert.match(await page.locator('#pcur').innerText(),/（提案）/);
   assert.match(await page.locator(`[data-st="${i}"]`).getAttribute('aria-label'),/（提案）/);
  }
  await page.route('**/current-plan.json',r=>r.abort());await page.reload();
  await page.waitForFunction(()=>currentPlan.textContent.includes('版本暫時無法讀取'));
  assert.equal(await page.locator('#pbar .nowb,#pcur .now').count(),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,legacyCompletionReportable:true,reportUndoReload:true,bulkSkipNoObservation:true,crossTab:true,proposalStages:true,sourceFailure:true,errors}));
  await context.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
