// Run against the combined publication with an existing Playwright installation.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.PORTAL_QA_URL||'http://127.0.0.1:4186/';
const output=path.resolve(__dirname,'../qa/portal');
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const results=[];
  try{
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      const context=await browser.newContext({viewport});
      const errors=[],cloud=[],missing=[];
      await context.route('**/*',route=>{
        if(/firebase|gstatic\.com\/firebase|firebasedatabase/.test(route.request().url())){cloud.push(route.request().url());return route.abort();}
        return route.continue();
      });
      await context.addInitScript(()=>{
        if(location.protocol.startsWith('http')&&!localStorage.getItem('portal-test-seeded')){
          localStorage.setItem('有桶_events_v1','[{"bin":"live-sentinel"}]');
          localStorage.setItem('research-state','preserved');
          localStorage.setItem('portal-test-seeded','1');
        }
      });
      const page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)missing.push(r.url());});
      async function capture(name){
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow: '+name);
        await page.screenshot({path:path.join(output,`${viewport.width}-${name}.png`),fullPage:true});
      }
      await page.goto(base);await page.getByRole('heading',{level:1}).waitFor();await capture('home');
      await page.getByRole('link',{name:'進入有桶體驗'}).click();
      await page.locator('#cardTog').waitFor({state:'attached'});
      if(await page.locator('#list.col').count())await page.locator('#cardTog').click();
      await page.locator('#list [data-full]').waitFor({state:'attached'});
      await page.locator('#list [data-full]').click();
      await page.getByText('已記錄於本機示範，未通知機關',{exact:true}).waitFor();
      const recorded=await page.evaluate(()=>JSON.parse(localStorage.getItem('有桶demo_v1_events_v1')));
      assert.equal(recorded.length,1);
      await capture('pedestrian');
      const crew=await context.newPage();
      crew.on('pageerror',e=>errors.push(e.message));
      await crew.goto(new URL('demo/crew.html',base).href);await crew.locator('[data-bin]').first().waitFor({state:'visible'});
      assert.equal(await crew.evaluate(()=>getEvents().some(e=>e.kind==='full')),true);
      await crew.screenshot({path:path.join(output,`${viewport.width}-crew.png`),fullPage:true});
      await crew.close();
      await page.locator('#repUndo').click();
      assert.equal(await page.evaluate(()=>getEvents().length),0);
      await page.locator('.roles a[href="planning.html"]').click();
      await page.locator('#hot .card').first().waitFor();
      await page.waitForFunction(()=>document.getElementById('currentPlan').textContent.includes('計畫尚未啟動'));
      assert.ok(!(await page.locator('body').innerText()).includes('已排入第 1 批現勘'));
      await capture('planning');
      await page.locator('.demo-note a').click();await page.locator('#panel-research:not([hidden])').waitFor();
      await capture('research');
      await page.goto(base+'?year=2024-archive#map');
      await page.waitForURL('**/research/?year=2024-archive#map');
      await page.locator('#panel-map:not([hidden])').waitFor();
      assert.equal(new URL(page.url()).searchParams.get('year'),'2024-archive');
      await page.goto(base+'demo/pedestrian.html?reset=1');
      await page.waitForURL('**/demo/pedestrian.html');
      assert.equal(await page.evaluate(()=>localStorage.getItem('有桶_events_v1')),'[{"bin":"live-sentinel"}]');
      assert.equal(await page.evaluate(()=>localStorage.getItem('research-state')),'preserved');
      assert.equal(cloud.length,0,'demo attempted a Firebase request');
      assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
      results.push({viewport,errors,cloudRequests:cloud,missing,reportAndUndo:true,crewReadsLocalReport:true,legacyLink:true,resetIsolated:true});
      await context.close();
    }
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify(results,null,2)+'\n');
    console.log(JSON.stringify(results));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
