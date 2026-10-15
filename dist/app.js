import {workflowDefs,caseView,advanceCase} from './workflows.js';
import {research} from './research.js';
import {modules,tones,topics} from './registry.js';
import {escapeHTML as esc,format,mapSVG,chartSVG,tableHTML} from './viz.js';
import {inspectCSV} from './modules/audit.js';
import {researchAnswer} from './answers.js';

const $=id=>document.getElementById(id);
const storageKey='taipei-city-lab-v1';
const badgeText=['真實樹木點位 × 假設植栽情境','真實清潔箱點位 × 模擬需求','模擬街廓 × 治理優先排序','模擬車流 × 錯峰情境','模擬需求 × 休息約束','模擬社區 × 查勘排序','官方資料適用性 × 本機 CSV 健檢'];
const citizenContent={
  shade:{question:'夏天走路，哪裡最需要多一片樹蔭？',tip:'先比較補樹的位置，再調整公平權重。樹點影響半徑是局部假設，不能當作真實遮蔭面積。',experiments:[{label:'先補 5 棵',values:{budget:5}},{label:'多顧服務缺口',values:{fairness:80}}]},
  bins:{question:'清潔箱該如何配置，才能兼顧需求與維運？',tip:'比較同一批合成需求下的新增上限與公平取捨。這是方法查核，不是實際新增點位清單。',experiments:[{label:'比較 5 個上限（模型）',values:{budget:5}},{label:'公平權重 80%（模型）',values:{fairness:80}}]},
  rat:{question:'街角的環境線索，哪些值得先去確認？',tip:'用相同巡查工時比較查核順序。這些街廓與線索是模擬資料，不是真實鼠患評級。',experiments:[{label:'先用 24 人時',values:{budget:24}}]},
  traffic:{question:'如果一部分人晚點出門，塞車會有什麼不同？',tip:'改變延後出發比例，觀察排隊如何累積與消退。合成車流只用來比較假設，不能預測真實路況。',experiments:[{label:'看看沒有錯峰時',values:{shift:0}},{label:'一半的人晚點出門',values:{shift:50}}]},
  bus:{question:'少等一班車，也讓駕駛有時間休息，可以嗎？',tip:'比較不同車數與班距，留意休息約束和留站等待。單站模擬需求不代表真實旅運資料。',experiments:[{label:'增加到 6 組車輛',values:{fleet:6}}]},
  buildings:{question:'社區的健檢與補查，該從哪裡開始？',tip:'先比較訪查工時的分配，再查看文件缺口。排序是準備工作的先後，不是建物安全評級。',experiments:[{label:'先用 24 人時',values:{budget:24}}]},
  audit:{question:'手上的資料，真的能回答你想問的問題嗎？',tip:'載入範例或帶一份 CSV，看看缺值、重複列與日期。資料只在這個瀏覽器處理。',experiments:[]},
};
const topicPaths={
  shade:'M12 20v-7M7 20h10M12 3l-6 8h3l-4 5h14l-4-5h3z',
  bins:'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7',
  rat:'M4 20V9l8-5 8 5v11M8 20v-6h8v6M8 10h1m6 0h1',
  traffic:'M7 3v18M17 3v18M12 3v3m0 4v4m0 4v3',
  bus:'M6 17V6q0-3 6-3t6 3v11H6zM6 9h12M8 13h1m6 0h1M8 17v3m8-3v3',
  buildings:'M5 21V7h8v14M13 11h6v10M8 10h2m-2 4h2m-2 4h2m6-4h1m-1 4h1M3 21h18',
  audit:'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h3',
  close:'m7 7 10 10M17 7 7 17',
  external:'M14 5h5v5M19 5l-9 9M19 14v5H5V5h5',
};
function topicIcon(id){return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${topicPaths[id]}"/></svg>`;}
function drawGuide(){
  const content=citizenContent[active.id];
  $('exploration-guide').innerHTML=`<p><strong>模型對照與敏感度分析。</strong>${esc(content.tip)}</p><div class="experiment-actions">${content.experiments.map((item,index)=>`<button data-experiment="${index}">${esc(item.label)}</button>`).join('')}</div>`;
  $('exploration-guide').onclick=e=>{
    const target=e.target.closest?.('[data-experiment]')||e.target;
    const experiment=content.experiments[target.dataset.experiment];if(!experiment)return;
    cancelCalculation();state.params[active.id]={...paramsFor(active),...experiment.values};
    selectedPoint=null;drawControls();drawResult();persist();toast('已套用「'+experiment.label+'」。可調整條件，或回到起點。');
  };
}
let data,active,result,csvText='',auditReport=null,auditSignature=null,selectedPoint=null,toastTimer,inputTimer;
let auditState={question:'哪些地點需要優先改善？',referenceDate:'2026-10-13',timezone:'Asia/Taipei',contract:''};
let state={params:{},saved:{},workflows:{}};
let workflowDate='2026-10-13';
let viewMode='3d',sceneSession=null,sceneModulePromise=null,sceneEpoch=0;
const moduleViews={};
let geoSession=null,geoModulePromise=null,geoEpoch=0,geoActiveId=null,pendingGeoFocus=null,geographicPlanned=true;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(record(saved))state={params:record(saved.params)?saved.params:{},saved:record(saved.saved)?saved.saved:{},workflows:record(saved.workflows)?saved.workflows:{}};}catch{/* local browser storage is optional */}
for(const [moduleId,def] of Object.entries(workflowDefs)){
  const clean={};for(let i=1;i<=24;i++){const id=def.prefix+String(i).padStart(2,'0');const raw=state.workflows[moduleId]?.[id];if(raw){const view=caseView(moduleId,raw,workflowDate);clean[id]={stage:view.stage,due:view.due,history:view.history};}}
  state.workflows[moduleId]=clean;
}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{toast('瀏覽器無法儲存；仍可匯出方案。');}}
function cancelCalculation(){clearTimeout(inputTimer);inputTimer=undefined;}
function flushCalculation(){if(inputTimer!==undefined){cancelCalculation();drawResult();}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2500);}
function paramsFor(module){
  const p={...module.defaults};const saved=record(state.params[module.id])?state.params[module.id]:{};
  for(const c of module.controls||[]){
    let v=saved[c.key];
    if(c.type==='range'){
      v=(typeof v==='number'||typeof v==='string'&&v.trim()!=='')?Number(v):NaN;
      v=Number.isFinite(v)?Math.max(c.min,Math.min(c.max,c.min+Math.round((v-c.min)/(c.step||1))*(c.step||1))):undefined;
    }else if(c.type==='select'&&!(c.options||[]).some(o=>(o.value??o)===v))v=undefined;
    if(v!==undefined)p[c.key]=v;
  }
  return p;
}
function safeURL(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:'#';}catch{return '#';}}
function drawNavigation(){
  const ordered=[...modules.filter(m=>m.id==='bins'),...modules.filter(m=>m.id!=='bins')];
  $('navigation').innerHTML=ordered.map(m=>`<a href="#${esc(m.id)}" class="${m.id===active.id?'active':''}" ${m.id===active.id?'aria-current="page"':''}>${topicIcon(m.id)}<span>${esc(topics[modules.indexOf(m)])}</span></a>`).join('');
}
function drawControls(){
  $('share-link').innerHTML='';
  const p=paramsFor(active);
  const rendered=(active.controls||[]).map(c=>{
    const id='control-'+c.key;
    if(c.type==='select')return `<div class="control"><label for="${esc(id)}">${esc(c.label)}</label><select id="${esc(id)}" data-key="${esc(c.key)}">${(c.options||[]).map(o=>`<option value="${esc(o.value??o)}" ${(o.value??o)===p[c.key]?'selected':''}>${esc(o.label??o)}</option>`).join('')}</select></div>`;
    return `<div class="control"><label for="${esc(id)}">${esc(c.label)}<output id="value-${esc(c.key)}" for="${esc(id)}">${format(p[c.key])}${esc(c.unit||'')}</output></label><input id="${esc(id)}" data-key="${esc(c.key)}" type="range" min="${c.min}" max="${c.max}" step="${c.step||1}" value="${p[c.key]}"><div class="range-bounds"><span>${c.min}${esc(c.unit||'')}</span><span>${c.max}${esc(c.unit||'')}</span></div></div>`;
  });
  $('controls').innerHTML=rendered.slice(0,3).join('')+(rendered.length>3?`<details class="advanced-controls"><summary>更多條件與假設</summary><div>${rendered.slice(3).join('')}</div></details>`:'');
  $('controls').oninput=event=>{
    const el=event.target,c=active.controls.find(c=>c.key===el.dataset.key);if(!c)return;
    state.params[active.id]={...paramsFor(active),[c.key]:c.type==='range'?Number(el.value):el.value};
    if($('value-'+c.key))$('value-'+c.key).innerHTML=format(state.params[active.id][c.key])+esc(c.unit||'');
    $('share-link').innerHTML='';persist();cancelCalculation();inputTimer=setTimeout(()=>{inputTimer=undefined;selectedPoint=null;drawResult();},80);
  };
}
function drawSaved(){
  const entries=Array.isArray(state.saved[active.id])?state.saved[active.id].filter(s=>record(s)&&record(s.params)&&typeof s.name==='string').slice(-6):[];
  $('saved-scenarios').innerHTML=entries.map((s,i)=>`<div class="saved-item"><button data-load="${i}">${esc(s.name)}</button><button class="delete" data-delete="${i}" aria-label="刪除${esc(s.name)}">${topicIcon('close')}</button></div>`).join('');
  $('saved-scenarios').onclick=e=>{const target=e.target.closest?.('button')||e.target;const load=target.dataset.load,remove=target.dataset.delete;if(load!==undefined&&entries[load]){cancelCalculation();state.params[active.id]=entries[load].params;drawControls();drawResult();persist();toast('已套用 '+entries[load].name);}else if(remove!==undefined){entries.splice(Number(remove),1);state.saved[active.id]=entries;drawSaved();persist();}};
}
const chartWidths=new WeakMap();
function chartWidth(host){
  const width=Math.round(host.getBoundingClientRect?.().width||0);chartWidths.set(host,width);
  return width>24?width-24:760;
}
function drawCharts(){
  if(!result)return;
  const heading=`<div class="visual-heading"><h2>${active.id==='bus'?'需求與搭載比較':active.id==='audit'?'資料用途檢查':result.chart?'基準與方案比較':'方案位置與範圍'}</h2><span class="small-tag">相同情境參數</span></div>`;
  const main=$('visualization'),secondaryHost=$('chart-secondary');
  main.innerHTML=heading+(result.chart?chartSVG(result.chart,chartWidth(main)):result.map?mapSVG(result.map,data.meta.bbox):'<div class="empty-state">使用下方資料用途表與 CSV 健檢，確認資料能回答哪些問題。</div>');
  const secondary=result.secondaryChart||(result.map&&result.chart?result.chart:null);
  secondaryHost.innerHTML=secondary?`<section class="secondary-chart"><div class="visual-heading"><h2>${esc(secondary.title||'配置成效比較')}</h2><span class="small-tag">相同情境參數</span></div>${chartSVG(secondary,chartWidth(secondaryHost))}</section>`:'';
}
function currentAnswer(){
  const answer=researchAnswer({id:active.id,result,data,params:paramsFor(active),report:active.id==='audit'?auditReport:null});
  if(active.id==='audit'&&csvText.length&&!auditReport){
    answer.headline='資料或條件已變更，請重新執行健檢。';answer.status='目前輸入尚未檢查';answer.pendingAudit=true;
    answer.conclusion='目前 CSV 與檢查條件尚未取得有效結果；請重新執行資料健檢，再依新結果判讀。';
    answer.auditRequest={...auditState};
  }
  return answer;
}
function drawAnswer(){
  const a=currentAnswer(),list=items=>items.map(t=>`<li>${esc(t)}</li>`).join('');
  const facts=a.snapshot?`<div class="observed-facts"><h3>真實快照現況</h3><p><strong>${format(a.snapshot.count)} 個已知清潔箱</strong>，位於本次示範範圍；資料取得 ${esc(a.snapshot.retrievedAt?.slice(0,10)||'未提供')}。</p><p>${a.snapshot.districts.map(d=>esc(d.name)+' '+format(d.count)+' 個').join('；')}。</p><p class="local-note">經度 121.51–121.57、緯度 25.02–25.08；僅涵蓋範圍內快照，不是全市總數，也不代表所有既有回收據點。</p></div>`:a.observedCount!==undefined?`<p class="observed-facts">本範圍已載入 ${format(a.observedCount)} 個去重後有效樹點；資料不是即時觀測。</p>`:'';
  const references=a.references?`<details class="answer-references"><summary>來源與查核日期</summary><ul>${a.references.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ${topicIcon('external')}</a><span>${esc(s.status)} · 查核 ${esc(s.checkedAt)}${s.updatedAt?' · 來源更新 '+esc(s.updatedAt):''}</span></li>`).join('')}</ul></details>`:'';
  const benchmark=a.benchmark?`<h3>新增數量的同條件比較</h3><p class="local-note">僅改新增上限，其他條件保持目前值。需求是合成權重，清運為同質工時；各列不是已驗證的實際設置方案。比較表可左右捲動，查看增益與清運工時。</p>${tableHTML({columns:[{key:'budget',label:'新增上限（個）'},{key:'selected',label:'模型選出（個）'},{key:'rate',label:'模型服務率（%）'},{key:'gain',label:'模型增益（百分點）'},{key:'labor',label:'假設新增清運（人時／日）'}],rows:a.benchmark})}`:'';
  const csv=a.csv?`<p>本機 CSV：${format(a.csv.rows)} 列、${format(a.csv.columns||0)} 欄。完整問題見下方健檢報告；筆數不代表適合政策推論。</p>`:'';
  $('research-answer').innerHTML=`<div class="answer-lede"><h2 id="answer-title">${esc(a.headline)}</h2><p class="answer-conclusion">${esc(a.conclusion)}</p><p class="answer-status">${esc(a.status)}</p><button data-answer-export class="outline-button">匯出此題結論與證據</button></div><div id="answer-evidence" class="answer-evidence" tabindex="-1"><div><h3>這個判斷的依據</h3><ul>${list(a.basis)}</ul>${facts}${csv}${references}</div><div class="answer-gaps"><h3>形成實際方案，還缺什麼？</h3><ol>${list(a.gaps)}</ol><p class="local-note">完成這些查核，才能把研究方向轉成具體位置、班表或行動清單。</p></div></div><details class="model-answer"><summary>查看目前模型的條件式答案${a.benchmark?'與數量比較':''}</summary><p>${esc(a.modelLabel)}</p><ul>${list(a.metrics.slice(0,4).map(m=>m.label+'：'+format(m.value)+(m.unit||'')))}</ul>${benchmark}<p class="local-note">完整參數、假設與模型推薦座標在下方研究工具；模型推薦不是已核准或現勘可行的位置。</p></details>`;
  $('research-answer').onclick=e=>{if(e.target.closest?.('[data-answer-export]')){flushCalculation();download(active.id+'-answer.json',JSON.stringify(currentAnswer(),null,2),'application/json');toast('已匯出研究結論、資料界線與目前模型條件。');}};
}
function drawResult(){
  try{result=active.evaluate(paramsFor(active),data);}catch(error){$('visualization').innerHTML=`<div class="fatal-error">計算未完成：${esc(error.message)}。請重設方案再試。</div>`;return;}
  if(result.chart && ['shade','bins','rat','buildings'].includes(active.id))result.chart={...result.chart,type:'bar'};
  drawAnswer();
  $('metrics').style.setProperty('--metric-columns',(result.metrics?.length||0)>=4?'4':'3');
  const metricItems=(result.metrics||[]).map(m=>`<article class="metric"><div class="metric-label">${esc(m.label)}</div><div class="metric-value">${format(m.value)}<span class="metric-unit">${esc(m.unit||'')}</span></div>${m.detail?`<div class="metric-detail">${esc(m.detail)}</div>`:''}</article>`);
  $('metrics').innerHTML=`<div class="metric-grid">${metricItems.slice(0,4).join('')}</div>`+(metricItems.length>4?`<details class="more-metrics"><summary>查看其他 ${metricItems.length-4} 項模擬指標</summary><div class="metric-grid">${metricItems.slice(4).join('')}</div></details>`:'');
  drawCharts();
  $('results').innerHTML=`<div class="section-heading"><h2>${active.id==='audit'?'資料用途與缺口':'方案明細與推薦依據'}</h2><span>${result.table?.rows?.length||0} 筆</span></div>${tableHTML(result.table)}`;
  drawWorkflow();
  $('method').innerHTML=`<div class="section-heading"><h2>這個結果怎麼看</h2><span>方法與限制</span></div><p class="explanation">${esc(result.explanation||'')}</p><details open><summary>情境假設與資料限制</summary><ul class="assumptions">${(result.assumptions||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details><details><summary>實務案例與下一步</summary><p class="explanation">${esc(research[active.id].finding)}</p><p class="explanation">${esc(research[active.id].next)}</p><a class="local-note" href="${esc(research[active.id].url)}" target="_blank" rel="noopener noreferrer">${esc(research[active.id].title)} ${topicIcon('external')}</a></details><div class="source-links">${(result.sources||[]).map(id=>`<button data-source="${esc(id)}">${esc(data.sources?.[id]?.title||id)}</button>`).join('')}</div>`;
  $('method').onclick=e=>{if(e.target.dataset.source)showSources(e.target.dataset.source);};
  $('visualization').onclick=e=>{const mark=e.target.closest('[data-point-id]');if(!mark)return;const point=result.map.points.find(p=>String(p.id)===mark.dataset.pointId);if(!point)return;selectedPoint=point;$('visualization').querySelector('.record-note')?.remove();$('visualization').insertAdjacentHTML('beforeend',`<div class="record-note">${esc(point.label||point.id)}${point.value!==undefined?' · '+esc(point.value):''}<br>座標 ${point.y.toFixed(6)}, ${point.x.toFixed(6)}；完整推薦依據見方案明細。</div>`);};
  const showPoint=e=>{const mark=e.target.closest('[data-point-id]');if(!mark)return;const point=result.map?.points.find(p=>String(p.id)===mark.dataset.pointId);if(!point)return;const tip=$('visualization').querySelector('.point-tooltip');if(tip){tip.textContent=(point.label||point.id)+' · 緯度 '+point.y.toFixed(6)+'／經度 '+point.x.toFixed(6)+(point.value!==undefined?' · 需求權重／指數 '+format(point.value):'');tip.hidden=false;}};
  $('visualization').onmouseover=showPoint;$('visualization').onfocusin=showPoint;
  $('visualization').onmouseleave=()=>{const tip=$('visualization').querySelector('.point-tooltip');if(tip)tip.hidden=true;};
  $('visualization').onfocusout=()=>{const tip=$('visualization').querySelector('.point-tooltip');if(tip)tip.hidden=true;};
  $('visualization').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.dataset.pointId){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
  drawGeography();draw3D();
}
function scenePayload(){return {id:active.id,title:active.title,result,data,params:paramsFor(active),report:active.id==='audit'?auditReport:null,planned:geographicPlanned,
  onPointSelected:point=>{selectedPoint=point;geoSession?.select(point.id,{pan:true});},onPlanChanged:syncPlan};}
function syncPlan(value){geographicPlanned=Boolean(value);geoSession?.setPlanned(value);sceneSession?.setPlanned(value);}
function focusGeography(point,force3D=false){
  flushCalculation();selectedPoint=point;pendingGeoFocus=point.id;
  if(force3D&&viewMode!=='3d')setView('3d');
  else if(sceneSession){sceneSession.focusPoint(point.id);pendingGeoFocus=null;}
}
function drawGeography(){
  const epoch=++geoEpoch,show=hasGeography()&&viewMode==='map'&&$('research-workbench').open!==false;
  $('geographic-panel').hidden=!show;
  if(geoActiveId!==active.id){geographicPlanned=true;geoActiveId=active.id;pendingGeoFocus=null;}
  if(!show){geoSession?.dispose();geoSession=null;return;}
  if(typeof window.document==='undefined')return;
  const payload=scenePayload();geoModulePromise??=import('./map-ui.js');
  geoModulePromise.then(({mountMap})=>{
    if(epoch!==geoEpoch)return;
    if(geoSession)geoSession.update(payload);else geoSession=mountMap($('geographic-panel'),payload,{onSelect:point=>focusGeography(point),onFocus:point=>focusGeography(point,true),onPlan:syncPlan});
    if(selectedPoint)geoSession.select(selectedPoint.id,{pan:true});
  }).catch(()=>{if(epoch===geoEpoch){geoSession?.dispose();geoSession=null;$('geographic-panel').innerHTML='<div class="empty-state">街道地圖暫時無法載入，仍可使用座標圖、3D 與明細。請稍後重新整理。</div>';}});
}
function hasGeography(){return Boolean(result?.map)||['traffic','bus'].includes(active.id);}
function syncView(){
  $('workspace').dataset.view=viewMode;
  $('scene-panel').hidden=viewMode!=='3d';$('visualization').hidden=viewMode!=='2d';
  $('geographic-panel').hidden=viewMode!=='map'||!hasGeography();
  $('chart-secondary').hidden=viewMode==='2d'&&!result.secondaryChart&&Boolean(result.chart);
  $('viewmode-map').hidden=!hasGeography();
  for(const mode of ['map','3d','2d'])$('viewmode-'+mode).setAttribute('aria-pressed',String(viewMode===mode));
}
function fail3D(message){
  sceneEpoch++;sceneSession?.dispose();sceneSession=null;viewMode='2d';syncView();
  $('scene-status').textContent=message+' 可繼續使用圖表、參數與明細。';
}
function draw3D(){
  const epoch=++sceneEpoch;syncView();if(viewMode!=='3d'||$('research-workbench').open===false){sceneSession?.dispose();sceneSession=null;return;}
  if(typeof window.WebGL2RenderingContext==='undefined'){fail3D('這個環境無法啟用 WebGL 2，已使用 2D。');return;}
  $('scene-status').textContent='正在準備 3D 場景…';
  const payload=scenePayload();
  sceneModulePromise??=import('./scene-ui.js');
  sceneModulePromise.then(({mountScene})=>{
    if(epoch!==sceneEpoch||viewMode!=='3d')return;
    if(sceneSession)sceneSession.update(payload);else sceneSession=mountScene($('scene-panel'),payload,fail3D);
    if(pendingGeoFocus!==null){sceneSession.focusPoint(pendingGeoFocus);pendingGeoFocus=null;}
    $('scene-status').textContent='3D 可旋轉、縮放與選取；圖表／明細使用同一個模型結果。';
  }).catch(()=>{if(epoch===sceneEpoch)fail3D('3D 暫時無法載入，已切換 2D。');});
}
function setView(mode){
  if(mode==='map'&&!hasGeography())return;
  viewMode=mode;moduleViews[active.id]=mode;
  if(mode==='3d'&&selectedPoint)pendingGeoFocus=selectedPoint.id;
  if(mode!=='3d'){sceneEpoch++;sceneSession?.dispose();sceneSession=null;}
  drawGeography();draw3D();
  if(mode!=='3d')$('scene-status').textContent=mode==='map'?'拖曳或縮放地圖，點選位置查看來源與推薦依據。':'2D 圖表與完整明細，使用同一組情境參數。';
}
function drawWorkflow(){
  const def=workflowDefs[active.id];const target=$('workflow');
  if(!def){target.innerHTML='';return;}
  const cases=record(state.workflows[active.id])?state.workflows[active.id]:{};
  const rows=result.table.rows.map(row=>({...row,caseLabel:row.label,...caseView(active.id,cases[row.id],workflowDate)}));
  const overdue=rows.filter(r=>r.overdue).length;
  target.innerHTML=`<section class="results-card workflow-card"><div class="section-heading"><h2>${esc(def.title)}</h2><span>逾期 ${overdue} 筆</span></div><p class="local-note">${esc(def.disclaimer)} 複查／追蹤期限為自訂 ${def.days} 天假設。</p><label>追蹤基準日 <input id="workflow-date" type="date" value="${esc(workflowDate)}"></label><div class="table-scroll"><table><thead><tr><th>模擬個案</th><th>進度</th><th>追蹤期限</th><th>紀錄</th><th>下一步</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.caseLabel)}</td><td>${esc(row.label)}</td><td>${esc(row.due||'未排定')}${row.overdue?' · 逾期':''}</td><td>${row.history.length} 次</td><td>${row.stage===def.stages.length-1?'流程完成':`${row.stage===def.followupIndex?`<select id="verify-${esc(row.id)}" aria-label="${esc(row.id)}追蹤結果"><option value="pending">尚未確認</option><option value="verified">${esc(def.closeNote)}</option></select>`:''}<button data-advance="${esc(row.id)}">${esc(def.stages[row.stage+1])}</button>`}</td></tr>`).join('')}</tbody></table></div></section>`;
  $('workflow-date').oninput=e=>{workflowDate=e.target.value;drawWorkflow();};
  target.onclick=e=>{const id=e.target.dataset.advance;if(!id||!rows.some(r=>r.id===id))return;
    try{const current=caseView(active.id,cases[id],workflowDate);const verified=$('verify-'+id)?.value==='verified';
      const next=advanceCase(active.id,cases[id],workflowDate,verified);state.workflows[active.id]={...cases,[id]:next};persist();drawWorkflow();toast('已更新本機模擬進度。');
    }catch(error){toast(error.message);}
  };
}
function drawModuleHeading(){
  const heading=$('city-intro').hidden?'h1':'h2';
  $('module-head').innerHTML=`<div class="module-head"><div><div class="module-title"><${heading} class="topic-title">${esc(active.title)}</${heading}></div><p class="topic-question">${esc(citizenContent[active.id].question)}</p></div><span class="badge">${esc(badgeText[modules.indexOf(active)])}</span></div>`;
}
function activate(){
  cancelCalculation();if(active?.id==='audit')captureAuditInputs();const previous=active?.id,fragment=location.hash.slice(1),id=fragment.split('?')[0];active=modules.find(m=>m.id===id)||modules.find(m=>m.id==='bins');if(previous!==active.id)selectedPoint=null;
  const query=fragment.includes('?')?fragment.slice(fragment.indexOf('?')+1):'';
  if(query&&query.length<=4096){const shared=new URLSearchParams(query),values={};for(const c of active.controls){if(shared.has(c.key))values[c.key]=shared.get(c.key);}state.params[active.id]={...active.defaults,...values};state.params[active.id]=paramsFor(active);}
  const index=modules.indexOf(active);document.documentElement.style.setProperty('--accent',tones[index]);
  viewMode=moduleViews[active.id]||(['shade','bins','rat','buildings'].includes(active.id)?'map':active.id==='audit'?'2d':'3d');
  document.title=`${topics[index]} — 台北城市實驗室`;
  $('city-intro').hidden=Boolean(id&&id!=='explore');
  $('sidebar').dataset.menuOpen='false';$('topic-menu-toggle').setAttribute('aria-expanded','false');
  drawModuleHeading();
  drawNavigation();drawGuide();drawControls();drawSaved();drawResult();drawAuditInput();
  if(viewMode!=='3d')$('scene-status').textContent=viewMode==='map'?'拖曳或縮放地圖，點選位置查看來源與推薦依據。':'2D 圖表與完整明細，使用同一組情境參數。';
}
function shareScenario(){
  flushCalculation();const query=new URLSearchParams();const values=paramsFor(active);
  for(const c of active.controls)query.set(c.key,String(values[c.key]));
  const base=String(location.href||'').split(/[?#]/)[0];
  const link=base+'#'+active.id+'?'+query.toString();
  $('share-link').innerHTML=`<label class="local-note">此題參數連結（不含 CSV、健檢內容或追蹤紀錄）<input id="scenario-url" readonly aria-label="方案分享連結" value="${esc(link)}"></label>`;
  $('scenario-url').onclick=e=>e.target.select();toast('已產生參數連結，可選取複製。');
}
function showSources(id){
  const catalogOnly=data.meta?.observationStatus==='catalog-only';
  const ids=id?[id]:Object.keys(data.sources||{});
  const retrieved=data.meta.retrievedAt?new Date(data.meta.retrievedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'未提供';
  $('source-body').innerHTML=`<p class="subtitle">資料取得：${esc(retrieved)}（台北時間）。「資料目錄」表示已核對用途，未將該資料集的觀測值載入模型。</p>${ids.map(key=>{const s=data.sources?.[key];if(!s)return '';const limits=Array.isArray(s.limitations)?s.limitations:[s.limitations].filter(Boolean);return `<article class="source-entry"><h3>${esc(s.title)}<span class="classification">${esc(s.classification||'來源')}</span></h3><a href="${esc(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">開啟原始來源 ${topicIcon('external')}</a><p>粒度：${esc(s.grain||'未提供')}<br>整合狀態：${esc(s.integrationStatus==='loaded'?(catalogOnly?'原題已載入觀測；本站僅保存目錄':'已載入觀測快照'):s.integrationStatus==='metadata-only'?'已核對資料目錄，未載入觀測值':'未載入觀測值')}</p>${s.counts?`<p>${catalogOnly?'原題保存的來源':'下載來源'} ${format(s.counts.sourceCount)} 列；示範範圍 ${format(s.counts.filteredCount)} 列；無法解析座標 ${format(s.counts.invalidCoordinateCount)} 列。${s.counts.catalogCountMismatch?'目錄筆數與下載內容不一致，本版依下載內容計數。':''}</p>`:''}${s.fields?.length?`<p class="fields">欄位：${esc(s.fields.join('、'))}</p>`:''}<ul>${limits.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></article>`;}).join('')}`;
  const dialog=$('source-dialog');if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
}
function download(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function csvCell(value){const raw=typeof value==='number'?String(value):String(value??'');const safe=typeof value==='string'&&/^(?:\s*[=+@-]|[\t\r\n])/.test(raw)?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"';}
function exportCSV(){flushCalculation();const table=result?.table;if(!table?.columns?.length){toast('此方案沒有可匯出的明細。');return;}const rows=[table.columns.map(c=>c.label),...table.rows.map(r=>table.columns.map(c=>r[c.key]))];download(`${active.id}-scenario.csv`,'\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('已匯出目前方案明細。');}
function exportAll(){flushCalculation();const pack={title:'台北城市實驗室・七題研究包',generatedAt:new Date().toISOString(),snapshot:data.meta,sources:data.sources,scenarios:modules.map(m=>{const p=paramsFor(m),r=m.evaluate(p,data);return {id:m.id,title:m.title,params:p,answer:researchAnswer({id:m.id,result:r,data,params:p}),metrics:r.metrics,model:r.model,comparison:r.comparison,secondaryChart:r.secondaryChart,table:r.table,explanation:r.explanation,assumptions:r.assumptions,sources:r.sources};})};download('taipei-city-lab-research.json',JSON.stringify(pack,null,2),'application/json');toast('已匯出七題結論、方案、假設與資料來源。');}
function drawAuditInput(){
  const show=active.id==='audit';$('audit-input').hidden=!show;
  if(!show){$('audit-report').innerHTML='';return;}
  $('audit-input').innerHTML=`<div class="audit-card"><div class="panel-heading"><h2>帶一份 CSV，看看它能回答什麼</h2><span class="small-tag">僅在此瀏覽器處理</span></div><div class="audit-toolbar"><label class="outline-button" for="csv-file">選擇 CSV 檔</label><input id="csv-file" type="file" accept=".csv,text/csv" hidden><button id="csv-example" class="text-button">載入缺漏資料範例</button><span class="local-note">上限 2 MB · 10,000 列 · 不上傳伺服器</span></div><textarea id="csv-text" aria-label="CSV 資料內容" placeholder="貼上有標題列的 CSV…">${esc(csvText)}</textarea><div class="audit-question"><label>想用資料回答什麼？<input id="audit-question" value="${esc(auditState.question)}"></label><label>新鮮度檢查基準日<input id="audit-date" type="date" value="${esc(auditState.referenceDate)}"></label></div><label class="local-note">日期比較時區<select id="audit-timezone"><option value="Asia/Taipei" ${auditState.timezone==='Asia/Taipei'?'selected':''}>台北時間（UTC+8）</option><option value="UTC" ${auditState.timezone==='UTC'?'selected':''}>UTC</option></select></label><details><summary>自訂資料契約（選填）</summary><p class="local-note">required：不得缺值；key：組合主鍵；ranges：數值範圍；nullValues：空值代碼。僅檢查，不自動修正。</p><textarea id="audit-contract" aria-label="資料契約 JSON" placeholder='{"required":["id"],"key":["id"],"ranges":{"lat":[-90,90]}}'>${esc(auditState.contract)}</textarea></details><div class="audit-toolbar"><button id="run-audit" class="primary-button">執行資料健檢</button><button id="export-audit" class="outline-button">匯出健檢報告</button><span class="local-note">依欄位、缺漏、重複與日期規則檢查。</span></div></div>`;
  $('csv-text').oninput=e=>{csvText=e.target.value;invalidateAudit();};
  for(const id of ['audit-question','audit-date','audit-timezone','audit-contract'])$(id).oninput=()=>{captureAuditInputs();invalidateAudit();};
  $('csv-example').onclick=()=>{csvText='案件編號,案件主類別,受理日期\nA001,環境衛生,2024-01-10\nA001,環境衛生,2024-01-10\nA003,,2024-02-29\nA004,病媒防治,not-a-date';$('csv-text').value=csvText;runAudit();};
  $('csv-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>2*1024*1024){toast('檔案超過 2 MB，請先縮小資料範圍。');return;}try{const bytes=await f.arrayBuffer();let decoded=new TextDecoder('utf-8',{fatal:true});try{csvText=decoded.decode(bytes);}catch{decoded=new TextDecoder('big5');csvText=decoded.decode(bytes);} $('csv-text').value=csvText;runAudit();}catch{toast('無法讀取檔案，請貼上 CSV 內容。');}};
  $('run-audit').onclick=runAudit;
  $('export-audit').onclick=()=>{captureAuditInputs();if(auditSignature!==currentAuditSignature())invalidateAudit();if(!auditReport){toast('先執行資料健檢。');return;}download('data-audit-report.json',JSON.stringify(auditReport,null,2),'application/json');};
  if(auditReport)renderAuditReport();
}
function captureAuditInputs(){
  if(!$('csv-text'))return;csvText=$('csv-text').value;
  auditState={question:$('audit-question').value,referenceDate:$('audit-date').value,timezone:$('audit-timezone').value||auditState.timezone,contract:$('audit-contract').value};
}
function currentAuditSignature(){return JSON.stringify([csvText,auditState]);}
function invalidateAudit(){auditReport=null;auditSignature=null;$('audit-report').innerHTML='<div class="audit-report">資料或條件已變更，請重新執行健檢。</div>';if(active.id==='audit'){drawAnswer();draw3D();}}
function runAudit(){captureAuditInputs();auditReport=inspectCSV(csvText,{...auditState,maxAgeDays:90});auditSignature=currentAuditSignature();renderAuditReport();}
function renderAuditReport(){
  const r=auditReport,status={suitable:'可支持此用途',partial:'只能部分支持',unsuitable:'無法支持此用途',undetermined:'需要更多資料定義'};
  const findings=r.findings||[];
  const profiles={columns:[{key:'name',label:'欄位'},{key:'type',label:'推定類型'},{key:'missingCount',label:'缺漏筆數'},{key:'missingRate',label:'缺漏比例'},{key:'uniqueCount',label:'不同值數'}],rows:(r.profiles||[]).map(p=>({...p,missingRate:(100*p.missingRate).toFixed(1)+'%'}))};
  $('audit-report').innerHTML=`<div class="audit-report"><strong>健檢完成：${r.rowCount||0} 列 · ${r.columns?.length||0} 欄 · ${r.duplicateCount||0} 列完全重複</strong><p>${esc(status[r.suitability?.status]||'解析結果')}：${esc(r.suitability?.reason||'請檢查欄位與解析錯誤。')}</p><p>資料粒度：${esc(r.grain?.description||'未確認')}<br>日期新鮮度：${esc({current:'在門檻內',stale:'超過門檻',future:'晚於基準日',unknown:'無法確認'}[r.freshness?.status]||'未確認')}（${esc(r.freshness?.timezone||'UTC')}）${r.freshness?.newest?' · 最新日期 '+esc(new Date(r.freshness.newest).toLocaleString('zh-TW',{timeZone:r.freshness.timezone||'UTC'})):''}</p><ul class="audit-findings">${findings.map(f=>`<li><span class="severity">${esc({error:'錯誤',warning:'注意',info:'資訊',critical:'重大',high:'高',medium:'中',low:'低'}[f.severity]||f.severity)}</span>${esc(f.message)}</li>`).join('')}</ul>${tableHTML(profiles)}</div>`;
  if(active.id==='audit'){drawAnswer();draw3D();}
}
async function init(){
  const response=await fetch('./data/snapshot.json');if(!response.ok)throw new Error('資料快照讀取失敗 '+response.status);data=await response.json();if(!data.meta||!data.sources)throw new Error('資料快照缺少來源與範圍');
  $('loading').hidden=true;activate();window.addEventListener('hashchange',activate);
  if(typeof window.ResizeObserver==='function'){
    const observer=new window.ResizeObserver(entries=>{
      if(entries.some(({target})=>{const width=Math.round(target.getBoundingClientRect().width);return width>0&&chartWidths.get(target)!==width;}))drawCharts();
    });
    observer.observe($('visualization'));observer.observe($('chart-secondary'));
  }
  $('topic-menu-toggle').onclick=()=>{const open=$('sidebar').dataset.menuOpen!=='true';$('sidebar').dataset.menuOpen=String(open);$('topic-menu-toggle').setAttribute('aria-expanded',String(open));};
  $('begin-exploring').onclick=()=>{$('city-intro').hidden=true;drawModuleHeading();$('module-head').scrollIntoView?.({block:'start',behavior:'auto'});$('module-head').focus?.({preventScroll:true});};
  $('reset').onclick=()=>{cancelCalculation();state.params[active.id]={...active.defaults};selectedPoint=null;drawControls();drawResult();persist();toast('已回到預設方案。');};
  $('save-scenario').onclick=()=>{flushCalculation();const list=Array.isArray(state.saved[active.id])?state.saved[active.id]:[];if(list.length>=6)list.shift();const name='方案 '+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});list.push({name,params:{...paramsFor(active)}});state.saved[active.id]=list;persist();drawSaved();toast('已儲存目前參數。');};
  $('viewmode-map').onclick=()=>setView('map');$('viewmode-3d').onclick=()=>setView('3d');$('viewmode-2d').onclick=()=>setView('2d');
  $('task-route').onclick=e=>{const id=e.target.dataset.jump;if(['analysis','control-panel','results'].includes(id))$('research-workbench').open=true;const target=$(id);target?.scrollIntoView?.({block:'start',behavior:'auto'});target?.focus?.({preventScroll:true});};
  $('research-workbench').ontoggle=()=>{drawCharts();drawGeography();draw3D();};
  window.addEventListener('pagehide',()=>{sceneEpoch++;geoEpoch++;sceneSession?.dispose();sceneSession=null;geoSession?.dispose();geoSession=null;});
  window.addEventListener('pageshow',event=>{if(event.persisted){drawGeography();draw3D();}});
  $('share-scenario').onclick=shareScenario;
  $('export-csv').onclick=exportCSV;$('all-export').onclick=exportAll;$('sources-button').onclick=()=>showSources();
  $('close-sources').onclick=()=>{const d=$('source-dialog');if(d.close)d.close();else d.removeAttribute('open');};
  $('source-dialog').onclick=e=>{if(e.target===$('source-dialog'))$('source-dialog').close();};
}
init().catch(error=>{$('loading').innerHTML=`<div class="fatal-error">網站載入未完成：${esc(error.message)}。請重新整理；若仍發生，保留此訊息以便修正。</div>`;});
