// Regenerate the offline research materials from the preserved prototype.
// Usage: NODE_PATH=<bundled node_modules> node build-test-pack.cjs
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = __dirname;
const source = fs.readFileSync(path.join(root, 'source/prototype-v0.1.html'), 'utf8');
const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
assert.equal(sourceHash, 'b5441b14486c65926532c2ae20da26c3d8b2cb1960cb4d23331452bf4c242439');
const paper = new Set([1, 2, 4, 7, 10, 11]);
const groups = [['M0-X', 'M1-Y'], ['M1-X', 'M0-Y'], ['M0-Y', 'M1-X'], ['M1-Y', 'M0-X']];
const participants = Array.from({ length: 12 }, (_, i) => {
  const sequence = groups[Math.floor(i / 3)];
  const core = sequence.map(m => `S1-${m}`).concat([...sequence].reverse().map(m => `S2-${m}`));
  const exceptions = Array.from({ length: 5 }, (_, n) => `S${3 + (n + i) % 5}-M1-X`);
  return {
    slot: `P${String(i + 1).padStart(2, '0')}`,
    planned_medium: paper.has(i + 1) ? 'paper' : 'mobile',
    recruitment_status: 'not_recruited',
    consent: null, familiarity: null, low_digital: null, step_free_need: null,
    tasks: core.concat(exceptions).map((card, n) => ({
      order: n + 1, card_id: card, status: 'not_started',
      timed_card_id: card.startsWith('S3-') ? `${card}-overflow` : card,
      started_at: null, confirmed_at: null, ended_at: null,
      raw_seconds: null, decision_correct: null, prompted: null,
      critical_error: null, confirmed_action: null, failure_reason: null,
      notes: null
    }))
  };
});
assert.equal(participants.flatMap(p => p.tasks).length, 108);
for (const medium of ['paper', 'mobile']) {
  const subset = participants.filter(p => p.planned_medium === medium);
  assert.equal(subset.length, 6);
  assert.equal(subset.filter(p => p.tasks[0].card_id.includes('M0')).length, 3);
}
const cards = [];
for (const s of ['S1', 'S2']) for (const m of ['M0', 'M1']) for (const l of ['X', 'Y']) cards.push(`${s}-${m}-${l}`);
// Both landmarks are preserved for every scenario; the planned exception tasks use X.
for (const s of ['S3', 'S4', 'S5', 'S6', 'S7']) for (const l of ['X', 'Y']) {
  cards.push(`${s}-M1-${l}`);
  if (s === 'S3') cards.push(`${s}-M1-${l}-overflow`);
}
const wrap = body => '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>投放資訊演練</title></head><body style="margin:12px">' + body + '</body></html>';
// Read-only participant mode. The query chooses a frozen card, never stored answers.
const participantScript = `<style>#disposal-continuity .dc-moderator,#dc-overflow{display:none!important}</style><script>
(() => {
 const valid=${JSON.stringify(cards)};
 const card=new URLSearchParams(location.search).get('card');
 const root=document.getElementById('disposal-continuity');
 if(!valid.includes(card)){root.replaceChildren();const p=document.createElement('p');p.textContent='請由主持人開啟指定材料。';root.append(p);return;}
 const [scenario, material, landmarks, overflow]=card.split('-');
 for(const [id,value] of [['dc-scenario',scenario],['dc-material',material],['dc-landmarks',landmarks]]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change'));}
 document.getElementById('dc-mobile').click();
 if(overflow)document.getElementById('dc-overflow').click();
 // The moderator reveals the updated S3 card after announcing the arrival event.
 const reveal=document.getElementById('dc-overflow');if(reveal)reveal.remove();
 document.body.dataset.card=card;
})();<\/script>`;
fs.writeFileSync(path.join(root, 'participant-mobile.html'), wrap(source + participantScript));
fs.writeFileSync(path.join(root, 'planned-sessions.json'), JSON.stringify({
  schema_version: 1, protocol_version: '0.1', material_bundle: '0.1.0',
  status: 'planned_only', human_started: 0, source_sha256: sourceHash, participants
}, null, 2) + '\n');

const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const indexRows = participants.map(p => `<tr><th>${p.slot}</th><td>${p.planned_medium === 'paper' ? '紙本' : '手機'}</td><td>${p.tasks.map(t => {
  const basic = `<a href="participant-mobile.html?card=${t.card_id}" target="_blank" rel="noopener">${t.order}. ${t.card_id}</a>`;
  return t.timed_card_id !== t.card_id ? basic + ` → <a href="participant-mobile.html?card=${t.timed_card_id}" target="_blank" rel="noopener">更新卡</a>` : basic;
}).join('<br>')}</td></tr>`).join('');
fs.writeFileSync(path.join(root, 'start.html'), wrap(`<style>body{font:17px/1.65 system-ui,sans-serif;color:#20382e;max-width:980px;margin:28px auto!important;padding:16px}h1{font-size:28px}a{color:#165d43}table{border-collapse:collapse;width:100%}th,td{vertical-align:top;text-align:left;border-bottom:1px solid #bacbc1;padding:12px}aside{padding:16px;background:#fff4e6}li{margin-bottom:8px}</style><h1>投放服務銜接 · 測試材料入口</h1><p>材料包 0.1.0 / 協定 0.1。七情境為虛構桌面演練。以下 P01-P12 是預排槽位，尚未招募、取得同意或收集結果。</p><aside>目前可進行主持人準備。先完成兩位同事預試，再固定正式材料與研究責任人；不得把原型操作當作真人測試。</aside><ol><li><a href="README.md">驗證計畫</a>、<a href="test-kit.md">主持腳本</a>與<a href="execution-status.md">執行狀態</a>。</li><li><a href="output/pdf/participant-cards.pdf">參與者列印卡</a>：依卡號取用，單面列印、多頁卡一起交付，其他題目收起。</li><li><a href="output/pdf/facilitator-sheets.pdf">主持記錄表</a>：12 人各兩頁；完成後逐情境計算分母。</li><li>手機任務：先由主持人在受測裝置上開啟下表指定連結，只展示新開啟的卡片。此入口不能交給參與者。S3 先展示初始卡，再宣讀抵達滿溢，開啟更新卡才重新計時。</li></ol><p>手機卡不儲存回答，也不發送請求。將整個資料夾留在測試裝置，可離線使用。所有空白記錄維持未知，不補零；暫停條件見記錄包首頁。</p><table><thead><tr><th>預排槽位</th><th>媒介</th><th>固定順序 / 手機材料</th></tr></thead><tbody>${indexRows}</tbody></table>`));

(async () => {
 const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
 try {
  const page = await browser.newPage({viewport:{width:794,height:1123},colorScheme:'light'});
  const errors=[], requests=[];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
  const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
  const sheets=[];
  for (const card of cards) {
   await page.setContent(wrap(source));
   const [scenario, material, landmarks, overflow] = card.split('-');
   await page.locator('#dc-scenario').selectOption(scenario);
   await page.locator('#dc-material').selectOption(material);
   await page.locator('#dc-landmarks').selectOption(landmarks);
   await page.locator('#dc-paper').click();
   if (overflow) await page.locator('#dc-overflow').click();
   const markup = await page.locator('.dc-card').evaluate((el, id) => {
     const clone=el.cloneNode(true); clone.querySelectorAll('.dc-actions').forEach(e=>e.remove());
     const allPoints=clone.querySelector('.dc-all-points');
     if(allPoints){allPoints.querySelector('summary').remove();const label=document.createElement('p');label.className='card-id';label.textContent='材料 0.1.0 · '+id+' · 接續頁（與前頁一起交付）';allPoints.prepend(label);const section=document.createElement('section');section.className=allPoints.className;section.innerHTML=allPoints.innerHTML;allPoints.replaceWith(section);}
     return clone.outerHTML;
   },card);
   sheets.push(`<section class="print-card" data-card="${card}"><div class="card-id">材料 0.1.0 · ${escape(card)}</div><div id="disposal-continuity" data-view="paper" data-material="${material}">${markup}</div></section>`);
  }
  // Each card is a separate unit. Long cards may use a second sheet, with the same card ID.
  const printCss = `<style>${css}\n@page{size:A4;margin:12mm}body{margin:0!important}.print-card{break-before:page}.print-card:first-child{break-before:auto}.card-id{font:12px system-ui;margin:0 0 8px;color:#444}#disposal-continuity{max-width:none;color-scheme:light}#disposal-continuity[data-view="paper"] .dc-card{max-width:none}#disposal-continuity .dc-next,#disposal-continuity dl,#disposal-continuity li,#disposal-continuity p{break-inside:avoid}#disposal-continuity .dc-all-points{break-before:page}.dc-all-points:before{content:'所有點位資料（接續同一張卡）';display:block;font:13px system-ui}#disposal-continuity summary{display:none}.dc-actions{display:none!important}</style>`;
  // Avoid duplicate DOM IDs in the static deck; selectors remain scoped by the preserved root class.
  const staticDeck = (printCss + sheets.join('\n')).replaceAll('#disposal-continuity', '.disposal-continuity').replaceAll('id="disposal-continuity"', 'class="disposal-continuity"').replace(/ id="dc-[^"]+"/g,'');
  fs.writeFileSync(path.join(root, 'participant-cards.html'), wrap(staticDeck));
  await page.setContent(wrap(staticDeck));
  await page.emulateMedia({media:'print'});
  await page.evaluate(()=>document.fonts.ready);
  const pdfDir=path.join(root,'output/pdf');fs.mkdirSync(pdfDir,{recursive:true});
  await page.pdf({path:path.join(pdfDir,'participant-cards.pdf'),preferCSSPageSize:true,printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;width:100%;text-align:center;color:#555">桌面演練 · 虛構資料 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>'});
  if (fs.existsSync(path.join(root, 'facilitator-sheets.html'))) {
    await page.setContent(fs.readFileSync(path.join(root, 'facilitator-sheets.html'), 'utf8'));
    await page.evaluate(()=>document.fonts.ready);
    await page.pdf({path:path.join(pdfDir,'facilitator-sheets.pdf'),preferCSSPageSize:true,printBackground:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  fs.writeFileSync(path.join(root,'build-receipt.json'),JSON.stringify({
    material_bundle:'0.1.0',protocol_version:'0.1',source_sha256:sourceHash,
    unique_cards:cards.length,planned_participants:12,planned_tasks:108,
    generated_at:new Date().toISOString(),external_requests:requests.length,script_errors:errors.length,
    study_status:'NOT_STARTED',human_participants_tested:0,field_tasks_completed:0
  },null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',uniqueCards:cards.length,plannedSlots:12,plannedTasks:108,externalRequests:requests.length}));
 } finally { await browser.close(); }
})().catch(error=>{console.error(error.stack);process.exit(1);});
