import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const base=process.env.SITING_QA_URL||'http://127.0.0.1:4174/';
const output=resolve('.impeccable/review/checklist');
const priorities=JSON.parse(await readFile(new URL('../data/field-priorities.json',import.meta.url),'utf8'));
const priorityLabels=new Map(priorities.classification.priorityLevels.map(p=>[p.id,p.label]));
const confidenceLabels=new Map(priorities.classification.confidenceLevels.map(p=>[p.id,p.label]));
await mkdir(output,{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#siting');
  const frame=page.frameLocator('#siting-frame');
  await frame.locator('#priority-filter').selectOption('hold');
  const opened=page.waitForEvent('popup');
  await frame.locator('.checklist-link').click();
  const checklist=await opened;
  await checklist.waitForLoadState('load');
  assert.equal(new URL(checklist.url()).pathname,'/field-checklist.html');
  assert.equal(await checklist.locator('.sheet').count(),10,'Print all ten even when map is filtered');
  for(const site of priorities.sites){
    const sheet=checklist.locator('#'+site.id);
    assert.equal(await sheet.locator('h2').textContent(),site.name);
    assert.equal(await sheet.locator('.badge').textContent(),priorityLabels.get(site.priority));
    assert.equal(await sheet.locator('.confidence').textContent(),confidenceLabels.get(site.confidence));
    assert.equal(await sheet.locator('.confidence-reason').textContent(),site.confidenceReason);
    assert.equal(await sheet.locator('.reason').textContent(),site.priorityReason);
    assert.deepEqual(await sheet.locator('.evidence li').allTextContents(),site.evidence);
    assert.equal(await sheet.locator('.uncertainty').textContent(),site.uncertainty);
    assert.equal(await sheet.locator('.decision').textContent(),site.decision);
    assert.equal(await sheet.locator('.answer-line,.record-table').count(),0);
    for(const label of ['新增評估優先度','資料可信度','推薦理由','資料依據','判讀限制','目前建議','不代表今日現況或核准設置'])assert.ok((await sheet.textContent()).includes(label));
  }
  assert.ok(!/現勘檢查表|現勘問題|現場共通紀錄|P1／P2/.test(await checklist.locator('body').textContent()));
  await checklist.evaluate(()=>{window.print=()=>{window.printRequested=true}});
  await checklist.locator('#print-checklist').focus();
  await checklist.keyboard.press('Enter');
  assert.equal(await checklist.evaluate(()=>window.printRequested),true);
  for(const width of [1440,390,320]){
    await checklist.setViewportSize({width,height:1000});
    assert.equal(await checklist.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await checklist.screenshot({path:resolve(output,`${width}-screen.png`)});
  }
  await checklist.setViewportSize({width:1440,height:1000});
  for(const level of ['', 'review', 'lower', 'hold', '']){
    await checklist.locator('#assessment-filter').selectOption(level);
    const expected=priorities.sites.filter(site=>!level||site.priority===level);
    assert.deepEqual(await checklist.locator('.sheet:visible').evaluateAll(nodes=>nodes.map(n=>n.id)),expected.map(site=>site.id));
    assert.deepEqual(await checklist.locator('.index li:not([hidden])').evaluateAll(nodes=>nodes.map(n=>n.dataset.site)),expected.map(site=>site.id));
    assert.deepEqual(await checklist.locator('.sheet:visible .page-number').allTextContents(),expected.map((_,i)=>String(i+1).padStart(2,'0')+' / '+expected.length));
    assert.equal(await checklist.locator('#print-status').textContent(),'目前顯示 '+expected.length+' 處 · 列印共 '+expected.length+' 頁');
    assert.ok((await checklist.locator('#print-checklist').textContent()).endsWith(expected.length+' 處'));
    await checklist.emulateMedia({media:'print'});
    assert.equal(await checklist.locator('.toolbar').isVisible(),false);
    assert.equal(await checklist.locator('.sheet:visible').count(),expected.length);
    await checklist.pdf({path:resolve(output,'data-assessment-'+(level||'all')+'.pdf'),preferCSSPageSize:true,displayHeaderFooter:false,printBackground:false});
    await checklist.emulateMedia({media:'screen'});
  }
  await checklist.getByRole('link',{name:'返回網站疊圖'}).click();
  assert.equal(new URL(checklist.url()).hash,'#siting');
  for(const path of ['data/field-priorities.json','inventory.html','research/field-priority-2026-10-17/protocol.md','research/field-priority-2026-10-17/report.md'])assert.equal((await page.request.get(base+path)).status(),404,path);
  assert.deepEqual(errors,[]);
  console.log('PASS: overlay print entry, all ten priority/confidence reasons and evidence, selected print sheets and dynamic numbering, keyboard print action, mobile widths, print toolbar exclusion, return navigation and private attachment exclusions. PDF ready for pagination and visual checks.');
}finally{await browser.close()}
