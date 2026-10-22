// Focused crew-entry acceptance: existing Chrome/Playwright, local publication.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.PORTAL_QA_URL||'http://127.0.0.1:4187/';
const output=path.resolve(__dirname,'../qa/crew-list');
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const results=[];
  try{
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      const context=await browser.newContext({viewport,timezoneId:'Asia/Taipei'});
      const page=await context.newPage(),errors=[];context.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        localStorage.setItem('有桶demo_v1_crew_ui_v2',JSON.stringify({state:'B',route:['B0001'],th:100,gen:1}));
      });
      await page.goto(new URL('demo/crew.html',base).href);
      await page.locator('[data-bin]').first().waitFor();
      const expected=await page.evaluate(async()=>{
        const b=await (await fetch('bins.geojson')).json(),[[south,west],[north,east]]=CONFIG.demoArea.bounds;
        return b.features.filter(f=>f.properties.source.startsWith('main')&&f.geometry.coordinates[1]>=south&&f.geometry.coordinates[1]<=north&&f.geometry.coordinates[0]>=west&&f.geometry.coordinates[0]<=east).map(f=>f.properties.id);
      });
      const list=()=>page.locator('[data-bin]').evaluateAll(nodes=>nodes.map(n=>n.dataset.bin));
      assert.deepEqual(await list(),expected);assert.ok(expected.length>12);
      assert.equal(await page.locator('#mapToggle').getAttribute('aria-pressed'),'false');
      assert.equal(await page.locator('.report-status').filter({hasText:'今日未回報'}).count(),expected.length);
      const low=await page.evaluate(()=>route.find(e=>e.fill<70).b.id);
      await page.screenshot({path:path.join(output,`${viewport.width}-list.png`),fullPage:true});
      await page.locator(`[data-bin="${low}"]`).click();
      await page.getByRole('button',{name:'在地圖確認位置',exact:true}).click();
      assert.equal(await page.locator('#mapToggle').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#map').evaluate(node=>node.inert),false);
      await page.screenshot({path:path.join(output,`${viewport.width}-map-detail.png`),fullPage:true});console.log(viewport.width,'map-detail');
      await page.getByRole('button',{name:'收運量：空',exact:true}).click();
      await page.locator(`[data-bin="${low}"]`).waitFor();console.log(viewport.width,'amount reported');
      assert.match(await page.locator(`[data-bin="${low}"]`).innerText(),/今日已回報 · 空/);
      assert.equal(await page.locator('.report-status').filter({hasText:'今日未回報'}).count(),expected.length-1);
      await page.getByRole('button',{name:'復原',exact:true}).click();
      assert.match(await page.locator(`[data-bin="${low}"]`).innerText(),/今日未回報/);
      assert.equal(await page.evaluate(id=>getEvents().filter(e=>e.bin===id).length,low),0);
      await page.locator(`[data-bin="${low}"]`).click();
      await page.getByRole('button',{name:'收運量：半',exact:true}).click();
      await page.reload();await page.locator('[data-bin]').first().waitFor();console.log(viewport.width,'reloaded');
      assert.deepEqual(await list(),expected);
      assert.match(await page.locator(`[data-bin="${low}"]`).innerText(),/今日已回報 · 半/);
      // Simulated forecast time must not affect assignment or observed daily status.
      await page.goto(new URL('demo/crew.html?fc=1&day=wk&t=08:00',base).href);
      await page.locator('[data-bin]').first().waitFor();assert.deepEqual(await list(),expected);
      assert.match(await page.locator(`[data-bin="${low}"]`).innerText(),/今日已回報 · 半/);
      const other=await context.newPage();await other.goto(new URL('demo/crew.html',base).href);
      await other.locator('[data-bin]').first().waitFor();
      await other.locator(`[data-bin="${expected[0]}"]`).click();
      await other.getByRole('button',{name:'收運量：滿',exact:true}).click();
      await page.locator(`[data-bin="${expected[0]}"] .report-status`).filter({hasText:'今日已回報'}).waitFor();
      await other.close();console.log(viewport.width,'cross-tab');
      // The map selects the same assigned bin and returns to its amount controls.
      await page.getByRole('button',{name:'顯示地圖',exact:true}).click();
      await page.locator('#map .leaflet-marker-icon').last().click();
      assert.match(await page.locator('#cardBody .bin-id').innerText(),new RegExp(expected.at(-1)));
      // Existing optional navigation must return to the selected report, not a collapsed blank card.
      await page.route('https://routing.openstreetmap.de/**',route=>route.abort());
      await page.locator('.forecast-detail summary').click();
      await page.getByRole('button',{name:'導航到這個桶位',exact:true}).click();
      await page.waitForFunction(()=>window.NAV!=null);
      await page.evaluate(()=>navEnd());
      await page.getByRole('button',{name:'收運量：空',exact:true}).waitFor({state:'visible'});
      assert.equal(await page.locator('#card').evaluate(el=>el.classList.contains('collapsed')),false);
      await page.getByRole('button',{name:'回到負責桶位清單',exact:true}).click();
      await page.getByRole('button',{name:'隱藏地圖',exact:true}).click();
      assert.equal(await page.locator('#map').evaluate(node=>node.inert),true);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(errors,[]);
      results.push({viewport,assigned:expected.length,lowFullnessReport:true,undo:true,reload:true,forecastIndependence:true,crossTab:true,mapSelection:true,errors});
      await context.close();
    }
    for(const failure of ['empty','error']){
      const context=await browser.newContext();const page=await context.newPage();
      await page.route('**/bins.geojson',route=>failure==='empty'?route.fulfill({contentType:'application/json',body:'{"type":"FeatureCollection","features":[]}'}):route.abort());
      await page.goto(new URL('demo/crew.html',base).href);
      if(failure==='empty')await page.getByText('目前示範範圍沒有桶位，請先確認負責清單。',{exact:true}).waitFor();
      else await page.getByRole('button',{name:'重新載入',exact:true}).waitFor();
      assert.equal(await page.locator('[data-bin]').count(),0);await context.close();
    }
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify(results,null,2)+'\n');
    console.log(JSON.stringify(results));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
