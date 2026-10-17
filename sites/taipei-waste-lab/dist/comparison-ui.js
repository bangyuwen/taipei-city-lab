import {escapeHTML as esc} from './data-utils.js';
import {categories,filterComparison,comparisonCounts,mapURL,formatCoordinateDistance as gap,sortByCoordinateDistance,getComparisonScope,summarizeCoordinateDistances} from './comparison-utils.js';

const $=id=>document.getElementById(id),num=n=>new Intl.NumberFormat('zh-TW').format(n);
const signed=n=>(n>0?'+':'')+num(n);
function sourceRows(records,label,version){
  if(!records.length)return `<div class="comparison-no-row"><h4>${label}</h4><p>此比對組無資料列；不代表現場不存在。</p></div>`;
  return `<div class="comparison-source-rows"><h4>${label}・${num(records.length)} 筆來源列</h4>${records.map(r=>`<div class="comparison-source-row"><p>${esc(r.district)} ${esc(r.address)}</p><p>原始經緯度：${esc(r.rawX)}，${esc(r.rawY)}</p><small>${esc(r.quality)}<br>原檔實體起始行 ${num(r.sourceRow)}（含標頭）・本站 ${esc(r.id)}，非官方箱號</small><a data-source-key="${esc(r.id)}" href="${esc(mapURL(r,version))}">${r.plottable?'在此版本地圖搜尋地址':'在此版本清單查詢（座標待核對）'}</a></div>`).join('')}</div>`;
}
export async function initializeComparisonExperience(){
  const response=await fetch('data/comparison-2024-2026.json');
  if(!response.ok)throw Error('Comparison unavailable');
  const comparisonBytes=await response.arrayBuffer();
  const data=JSON.parse(new TextDecoder().decode(comparisonBytes));
  if(data.meta?.protocolVersion!=='1.0.0'||!Array.isArray(data.entries)||data.districts?.length!==12)throw Error('Comparison format unavailable');
  const state={district:'',category:'',search:'',sort:'source-order'};
  let filtered=[],scope,shown=20,distanceAnalysis=null,distanceByID=new Map(),distanceFailed=false,returnPosition=null;
  $('comparison-districts').innerHTML=data.districts.map(d=>`<tr><th scope="row"><button type="button" data-comparison-district="${esc(d.district)}">${esc(d.district)}</button></th><td>${num(d.beforeRows)}</td><td>${num(d.afterRows)}</td><td>${signed(d.deltaRows)}</td><td>${num(d.exactPairs)}</td><td>${num(d.sameAddressPairs)}</td><td>${num(d.ambiguousBeforeRows)}／${num(d.ambiguousAfterRows)}</td><td>${num(d.notReappearedRows)} <small>筆／${num(d.notReappearedAddresses)} 址</small></td><td>${num(d.only2026Rows)} <small>筆／${num(d.only2026Addresses)} 址</small></td></tr>`).join('');
  for(const d of data.districts){const option=document.createElement('option');option.value=d.district;option.textContent=d.district;$('comparison-district').append(option)}
  const categoryOptions=[['','全部分類'],...Object.entries(categories).map(([key,value])=>[key,value.label])];
  $('comparison-categories').innerHTML=categoryOptions.map(([key])=>`<option value="${key}"></option>`).join('');
  function distanceText(entry){
    if(entry.category!=='same_address_changed')return '';
    const pair=distanceByID.get(entry.id);
    return pair?`座標差距 ${esc(gap(pair.distanceMeters))}${pair.rank!==null?` · 全市 75 對排名 ${num(pair.rank)}`:''}`:distanceFailed?'座標距離暫時無法載入':'座標距離載入中…';
  }
  function entryHTML(entry,open=false){
    const pair=distanceByID.get(entry.id);
    return `<details class="comparison-entry" name="comparison-evidence" data-comparison-id="${esc(entry.id)}"${open?' open':''}><summary><span class="comparison-entry-main"><span class="comparison-entry-district">${esc(entry.district)} · ${esc(categories[entry.category].label)}</span><strong>${esc(entry.address||'地址未記錄')}</strong><span class="coordinate-entry-gap">${distanceText(entry)}</span></span><span class="comparison-entry-count">2024 ${num(entry.before.length)} 筆<br>2026 ${num(entry.after.length)} 筆</span><span class="comparison-entry-toggle"><span class="when-closed">查看兩版證據</span><span class="when-open">收合證據</span></span></summary><div class="comparison-entry-evidence"><p class="comparison-help">${esc(categories[entry.category].note)}${pair?` ${esc(pair.qualityNote)}`:''}</p><div class="comparison-entry-sources">${sourceRows(entry.before,'2024 封存版',data.meta.before.key)}${sourceRows(entry.after,'2026 官方主檔',data.meta.after.key)}</div></div></details>`;
  }
  function renderList(append=false){
    const list=$('comparison-list');
    if(append){
      list.insertAdjacentHTML('beforeend',filtered.slice(list.children.length,shown).map(e=>entryHTML(e)).join(''));
    }else{
      const opened=new Set([...list.querySelectorAll('details[open]')].map(el=>el.dataset.comparisonId));
      const active=document.activeElement,entry=active?.closest('[data-comparison-id]');
      const focus=entry&&list.contains(active)?{id:entry.dataset.comparisonId,key:active.dataset.sourceKey,top:active.getBoundingClientRect().top}:null;
      list.innerHTML=filtered.slice(0,shown).map(e=>entryHTML(e,opened.has(e.id))).join('');
      if(focus){
        const replacement=list.querySelector(`[data-comparison-id="${CSS.escape(focus.id)}"] ${focus.key?`[data-source-key="${CSS.escape(focus.key)}"]`:'summary'}`);
        if(replacement){replacement.focus({preventScroll:true});window.scrollBy({top:replacement.getBoundingClientRect().top-focus.top,behavior:'instant'});}
      }
    }
    const count=comparisonCounts(filtered);
    $('comparison-result-count').textContent=`${num(count.groups)} 組 · 2024 ${num(count.beforeRows)} 筆／2026 ${num(count.afterRows)} 筆來源列 · 已顯示 ${num(Math.min(shown,filtered.length))} 組`;
    $('comparison-empty').hidden=filtered.length>0;
    $('comparison-clear-search').hidden=!state.search;
    $('comparison-all-categories').hidden=!state.category;
    $('comparison-more').hidden=filtered.length<=shown;
    $('comparison-more').textContent=`再顯示 ${num(Math.max(0,Math.min(20,filtered.length-shown)))} 組比對結果`;
  }
  function renderDistances(){
    $('coordinate-distance-section').hidden=state.category!=='same_address_changed';
    $('comparison-distance-sort').value=state.sort;
    if(!distanceAnalysis)return;
    const summary=summarizeCoordinateDistances(scope.entries,distanceAnalysis.pairs);
    const range=state.district||'全市';
    $('coordinate-distance-summary').textContent=`目前範圍（${range}${state.search?'・含地址搜尋':''}）${num(summary.pairCount)} 對：${num(summary.calculatedPairs)} 對可計算，${num(summary.unavailablePairs)} 對無法計算。${summary.calculatedPairs?`差距中位數 ${gap(summary.medianMeters)}，最小 ${gap(summary.minMeters)}，最大 ${gap(summary.maxMeters)}。`:''}${num(summary.coarseFlaggedPairs)} 對至少一側未通過台北座標粗篩；通過粗篩也不代表已核實。`;
    $('coordinate-distance-buckets').textContent=`距離分布：${summary.buckets.map(b=>`${b.label} ${num(b.count)} 對`).join('；')}。`;
  }
  function render({reset=true}={}){
    if(reset)shown=20;
    scope=getComparisonScope(data.entries,state);
    filtered=filterComparison(scope.entries,{category:state.category});
    if(state.category==='same_address_changed'&&distanceAnalysis&&state.sort==='distance-desc')filtered=sortByCoordinateDistance(filtered,distanceAnalysis.pairs);
    $('comparison-scope-heading').textContent=`目前範圍：${state.district||'全市'}${state.search?` · 地址含「${state.search}」`:''}`;
    const c=scope.counts;
    $('comparison-scope-totals').innerHTML=`2024 <strong>${num(c.beforeRows)}</strong> 筆 <span aria-hidden="true">→</span> 2026 <strong>${num(c.afterRows)}</strong> 筆 <span class="comparison-scope-delta">來源列差額 ${signed(c.afterRows-c.beforeRows)} 筆</span>`;
    for(const [index,[category,label]] of categoryOptions.entries())$('comparison-categories').options[index].textContent=`${label}（${num(category?scope.categoryCounts[category]:c.groups)} 組）`;
    $('comparison-categories').value=state.category;
    $('comparison-list-heading').textContent=state.category?categories[state.category].label:'全部比對結果';
    $('comparison-category-note').textContent=state.category?categories[state.category].note:'點選地址查看兩版原始列與座標。每組可能含多筆來源列，組數並非實體垃圾桶數。';
    renderDistances();renderList();
  }
  function chooseCategory(value){state.category=value;if(value==='same_address_changed'&&distanceAnalysis)state.sort='distance-desc';render();}
  $('comparison-district').addEventListener('change',event=>{state.district=event.target.value;render();});
  $('comparison-search').addEventListener('input',event=>{state.search=event.target.value;render();});
  $('comparison-categories').addEventListener('change',event=>chooseCategory(event.target.value));
  $('comparison-reset').addEventListener('click',()=>{Object.assign(state,{district:'',category:'',search:'',sort:'source-order'});$('comparison-district').value='';$('comparison-search').value='';render();});
  $('comparison-clear-search').addEventListener('click',()=>{state.search='';$('comparison-search').value='';render();$('comparison-search').focus({preventScroll:true});});
  $('comparison-all-categories').addEventListener('click',()=>{chooseCategory('');$('comparison-categories').focus({preventScroll:true});});
  $('comparison-districts').addEventListener('click',event=>{
    const button=event.target.closest('[data-comparison-district]');if(!button)return;
    state.district=button.dataset.comparisonDistrict;$('comparison-district').value=state.district;render();
    $('comparison-district').focus({preventScroll:true});$('comparison-scope-heading').scrollIntoView({block:'center',behavior:'instant'});
  });
  $('comparison-more').addEventListener('click',()=>{shown+=20;renderList(true);});
  $('comparison-distance-sort').addEventListener('change',event=>{state.sort=event.target.value;render();});
  $('comparison-list').addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    returnPosition={y:window.scrollY,key:link.dataset.sourceKey};
    event.preventDefault();history.pushState(null,'',link.href);window.dispatchEvent(new PopStateEvent('popstate'));$('panel-map').scrollIntoView({block:'start',behavior:'instant'});
  });
  window.addEventListener('popstate',()=>{
    if(location.hash!=='#comparison'||!returnPosition)return;
    const saved=returnPosition;returnPosition=null;
    requestAnimationFrame(()=>{$('comparison-list').querySelector(`[data-source-key="${CSS.escape(saved.key)}"]`)?.focus({preventScroll:true});window.scrollTo({top:saved.y,behavior:'instant'});});
  });
  $('coordinate-distance-retry').addEventListener('click',requestDistances);
  render();$('comparison-status').hidden=true;$('comparison-content').hidden=false;
  requestDistances();
  async function requestDistances(){
    distanceFailed=false;$('coordinate-distance-status').hidden=false;$('coordinate-distance-status').textContent='正在載入座標差距…';$('coordinate-distance-retry').hidden=true;
    try{await loadDistances();}catch{
      distanceFailed=true;$('coordinate-distance-status').textContent='座標距離暫時無法載入；來源比較仍可使用，清單保留原資料順序。';
      $('coordinate-distance-retry').hidden=false;$('comparison-distance-sort-note').textContent='距離未載入，依原資料順序顯示。';renderList();
    }
  }
  async function loadDistances(){
    const response=await fetch('data/comparison-coordinate-distances.json');
    if(!response.ok)throw Error('Coordinate distance unavailable');
    const analysis=await response.json(),selected=data.entries.filter(e=>e.category==='same_address_changed');
    const digest=await crypto.subtle.digest('SHA-256',comparisonBytes);
    const comparisonSHA256=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    if(analysis.meta?.comparisonSHA256!==comparisonSHA256)throw Error('Coordinate comparison digest mismatch');
    const byID=new Map(selected.map(e=>[e.id,e]));
    if(analysis.meta?.analysisVersion!=='1.0.1'||analysis.meta.comparisonProtocolVersion!==data.meta.protocolVersion||!Array.isArray(analysis.pairs)||analysis.pairs.length!==selected.length||new Set(analysis.pairs.map(p=>p.comparisonId)).size!==selected.length)throw Error('Coordinate distance version mismatch');
    for(const side of ['before','after'])if(analysis.meta.sources?.[side]?.sha256!==data.meta[side].sha256)throw Error('Coordinate source mismatch');
    for(const pair of analysis.pairs){
      const entry=byID.get(pair.comparisonId);
      if(!entry||pair.address!==entry.address||pair.district!==entry.district)throw Error('Coordinate pair mismatch');
      for(const side of ['before','after'])for(const key of ['id','rawX','rawY','sourceRow'])if(pair[side]?.[key]!==entry[side][0][key])throw Error('Coordinate lineage mismatch');
      if(pair.distanceMeters!==null&&(typeof pair.distanceMeters!=='number'||!Number.isFinite(pair.distanceMeters)||pair.distanceMeters<0))throw Error('Invalid coordinate distance');
    }

    distanceAnalysis=analysis;distanceByID=new Map(analysis.pairs.map(pair=>[pair.comparisonId,pair]));
    $('comparison-distance-sort').disabled=false;$('comparison-distance-sort-note').textContent='選擇座標差距排序時，以未四捨五入值比較，無法計算者置後。距離約至 0.1 公尺，不代表定位精度，也不是步行或遷移距離。';
    $('coordinate-distance-status').hidden=true;$('coordinate-distance-content').hidden=false;
    render({reset:false});
  }
}
