import {escapeHTML as esc} from './data-utils.js';
import {categories,filterComparison,comparisonCounts,mapURL,comparisonCSV,districtCSV,formatCoordinateDistance as gap,sortByCoordinateDistance} from './comparison-utils.js';

const $=id=>document.getElementById(id),num=n=>new Intl.NumberFormat('zh-TW').format(n);
const signed=n=>(n>0?'+':'')+num(n);
function download(text,name){
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function sourceRows(records,label,version){
  if(!records.length)return `<p class="comparison-no-row">${label}：此比對組無資料列；不代表現場不存在。</p>`;
  return `<div class="comparison-source-rows"><h4>${label}・${num(records.length)} 筆來源列</h4>${records.map(r=>`<div class="comparison-source-row"><p>${esc(r.district)} ${esc(r.address)}</p><p>原始經緯度：${esc(r.rawX)}，${esc(r.rawY)}</p><small>${esc(r.quality)}<br>原檔實體起始行 ${num(r.sourceRow)}（含標頭）・本站 ${esc(r.id)}，非官方箱號</small><a href="${esc(mapURL(r,version))}">${r.plottable?'在此版本地圖搜尋地址 ↗':'在此版本清單查詢（座標待核對） ↗'}</a></div>`).join('')}</div>`;
}
export async function initializeComparisonExperience(){
  const response=await fetch('data/comparison-2024-2026.json');
  if(!response.ok)throw Error('Comparison unavailable');
  const comparisonBytes=await response.arrayBuffer();
  const data=JSON.parse(new TextDecoder().decode(comparisonBytes));
  if(data.meta?.protocolVersion!=='1.0.0'||!Array.isArray(data.entries)||data.districts?.length!==12)throw Error('Comparison format unavailable');
  const state={district:'',category:'not_reappeared',search:''};
  let filtered=[],shown=20,distanceAnalysis=null,distanceByID=new Map();
  const total=data.totals;
  $('comparison-totals').innerHTML=`<div><span>2024 封存版</span><strong>${num(total.beforeRows)}</strong><small>筆來源資料列</small></div><div><span>2026 官方主檔</span><strong>${num(total.afterRows)}</strong><small>筆來源資料列</small></div><div><span>主檔列數差額</span><strong>${signed(total.deltaRows)}</strong><small>筆資料列；不是撤除數</small></div>`;
  $('comparison-findings').textContent=`${num(total.notReappearedAddresses)} 個舊版地址群組（${num(total.notReappearedRows)} 筆資料列）未再出現在 2026 主檔。另有 ${num(total.exactPairs)} 對地址及座標欄位相同、${num(total.sameAddressPairs)} 對同址座標不同；同址多筆未配對保留 2024／2026 各 ${num(total.ambiguousBeforeRows)}／${num(total.ambiguousAfterRows)} 筆。只在 2026 出現的 ${num(total.only2026Addresses)} 個地址群組共 ${num(total.only2026Rows)} 筆。以上均為資料比對分類，不能據此確認撤除、新設或遷移。`;
  $('comparison-districts').innerHTML=data.districts.map(d=>`<tr><th scope="row"><button type="button" data-comparison-district="${esc(d.district)}">${esc(d.district)}</button></th><td>${num(d.beforeRows)}</td><td>${num(d.afterRows)}</td><td>${signed(d.deltaRows)}</td><td>${num(d.exactPairs)}</td><td>${num(d.sameAddressPairs)}</td><td>${num(d.ambiguousBeforeRows)}／${num(d.ambiguousAfterRows)}</td><td>${num(d.notReappearedRows)} <small>筆／${num(d.notReappearedAddresses)} 址</small></td><td>${num(d.only2026Rows)} <small>筆／${num(d.only2026Addresses)} 址</small></td></tr>`).join('');
  for(const d of data.districts){const option=document.createElement('option');option.value=d.district;option.textContent=d.district;$('comparison-district').append(option)}
  function renderList(){
    const count=comparisonCounts(filtered);
    $('comparison-result-count').textContent=`${num(count.groups)} 組比對結果・2024 ${num(count.beforeRows)} 筆／2026 ${num(count.afterRows)} 筆來源列`;
    $('comparison-category-note').textContent=state.category?categories[state.category].note:'全部分類都只是來源資料的比對結果。請依每項分類判讀，不能換算為撤除、新設或現場存量。';
    $('comparison-export').disabled=!filtered.length;
    $('comparison-distance-sort-field').hidden=state.category!=='same_address_changed';
    $('comparison-list').innerHTML=filtered.length?filtered.slice(0,shown).map(e=>{
      const pair=distanceByID.get(e.id);
      const distance=pair?`<p class="coordinate-entry-gap">座標差距 ${esc(gap(pair.distanceMeters))}${pair.rank!==null?`・全 75 對排序 ${num(pair.rank)}`:''}<small>${esc(pair.qualityNote)}；尚未確認遷移。</small></p>`:'';
      return `<article class="comparison-entry" data-comparison-id="${esc(e.id)}"><div class="comparison-entry-heading"><div><span class="comparison-entry-district">${esc(e.district)}・${esc(categories[e.category].label)}</span><h4>${esc(e.address||'地址未記錄')}</h4>${distance}</div><p>2024 ${num(e.before.length)} 筆<br>2026 ${num(e.after.length)} 筆</p></div><details><summary><span>查看原始列與座標</span><span aria-hidden="true">＋</span></summary><div class="comparison-entry-sources">${sourceRows(e.before,'2024 封存版',data.meta.before.key)}${sourceRows(e.after,'2026 官方主檔',data.meta.after.key)}</div></details></article>`;
    }).join(''):'<p class="empty-state">沒有符合條件的比對結果。可改選行政區、分類或清除地址搜尋；沒有結果不代表當地沒有垃圾箱。</p>';
    $('comparison-more').hidden=filtered.length<=shown;
  }
  function render(){
    shown=20;filtered=filterComparison(data.entries,state);
    if(state.category==='same_address_changed'&&distanceAnalysis&&$('comparison-distance-sort').value==='distance-desc')filtered=sortByCoordinateDistance(filtered,distanceAnalysis.pairs);
    renderList();
  }
  $('comparison-district').addEventListener('change',e=>{state.district=e.target.value;render()});
  $('comparison-category').addEventListener('change',e=>{state.category=e.target.value;render()});
  $('comparison-search').addEventListener('input',e=>{state.search=e.target.value;render()});
  $('comparison-reset').addEventListener('click',()=>{
    Object.assign(state,{district:'',category:'not_reappeared',search:''});
    $('comparison-district').value='';$('comparison-category').value='not_reappeared';$('comparison-search').value='';render();
  });
  for(const button of $('comparison-districts').querySelectorAll('button'))button.addEventListener('click',()=>{
    state.district=button.dataset.comparisonDistrict;$('comparison-district').value=state.district;render();
    $('comparison-district').focus({preventScroll:true});$('comparison-list-heading').scrollIntoView({block:'start'});
  });
  $('comparison-more').addEventListener('click',()=>{shown+=20;renderList()});
  $('comparison-distance-sort').addEventListener('change',render);
  $('coordinate-show-all').addEventListener('click',()=>{
    Object.assign(state,{district:'',category:'same_address_changed',search:''});
    $('comparison-district').value='';$('comparison-category').value=state.category;$('comparison-search').value='';$('comparison-distance-sort').value='distance-desc';
    render();$('comparison-category').focus({preventScroll:true});$('comparison-list-heading').scrollIntoView({block:'start'});
  });
  function navigateSourceMap(event){
    const link=event.target.closest('a[href]');
    if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();history.pushState(null,'',link.href);window.dispatchEvent(new PopStateEvent('popstate'));
    $('panel-map').scrollIntoView({block:'start'});
  }
  for(const id of ['comparison-list','coordinate-distance-top'])$(id).addEventListener('click',navigateSourceMap);
  $('comparison-export').addEventListener('click',()=>download(comparisonCSV(filtered,data.meta,distanceAnalysis),`taipei-bins-2024-2026-${state.category||'all'}-filtered.csv`));
  $('comparison-district-export').addEventListener('click',()=>download(districtCSV(data.districts,data.meta),'taipei-bins-2024-2026-districts.csv'));
  render();$('comparison-status').hidden=true;$('comparison-content').hidden=false;
  // The additive distance analysis must not block the existing comparison.
  loadDistances().catch(()=>{
    $('coordinate-distance-status').textContent='座標距離暫時無法載入，請重新整理再試；原比對清單與完整距離 CSV 仍可使用。';
    $('comparison-distance-sort-note').textContent='距離未載入，依原資料順序顯示。';
  });
  async function loadDistances(){
    const response=await fetch('data/comparison-coordinate-distances.json');
    if(!response.ok)throw Error('Coordinate distance unavailable');
    const analysis=await response.json(),selected=data.entries.filter(e=>e.category==='same_address_changed');
    const digest=await crypto.subtle.digest('SHA-256',comparisonBytes);
    const comparisonSHA256=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    if(analysis.meta?.comparisonSHA256!==comparisonSHA256)throw Error('Coordinate comparison digest mismatch');
    const byID=new Map(selected.map(e=>[e.id,e]));
    if(analysis.meta?.analysisVersion!=='1.0.0'||analysis.meta.comparisonProtocolVersion!==data.meta.protocolVersion||!Array.isArray(analysis.pairs)||analysis.pairs.length!==selected.length||new Set(analysis.pairs.map(p=>p.comparisonId)).size!==selected.length)throw Error('Coordinate distance version mismatch');
    for(const side of ['before','after'])if(analysis.meta.sources?.[side]?.sha256!==data.meta[side].sha256)throw Error('Coordinate source mismatch');
    for(const pair of analysis.pairs){
      const entry=byID.get(pair.comparisonId);
      if(!entry||pair.address!==entry.address||pair.district!==entry.district)throw Error('Coordinate pair mismatch');
      for(const side of ['before','after'])for(const key of ['id','rawX','rawY','sourceRow'])if(pair[side]?.[key]!==entry[side][0][key])throw Error('Coordinate lineage mismatch');
      if(pair.distanceMeters!==null&&(typeof pair.distanceMeters!=='number'||!Number.isFinite(pair.distanceMeters)||pair.distanceMeters<0))throw Error('Invalid coordinate distance');
    }
    distanceAnalysis=analysis;distanceByID=new Map(analysis.pairs.map(p=>[p.comparisonId,p]));
    const s=analysis.summary;
    $('coordinate-distance-summary').textContent=`共 ${num(s.pairCount)} 對；${num(s.calculatedPairs)} 對可計算、${num(s.unavailablePairs)} 對無法計算。可計算者的座標差距中位數為 ${gap(s.medianMeters)}，最小 ${gap(s.minMeters)}，最大 ${gap(s.maxMeters)}。有 ${num(s.coarseFlaggedPairs)} 對至少一版未通過台北座標粗篩，需另行核對；通過粗篩也不代表位置已確認。`;
    $('coordinate-distance-buckets').innerHTML=s.buckets.map(b=>`<li><span>${esc(b.label)}</span><strong>${num(b.count)} 對</strong></li>`).join('');
    $('coordinate-distance-top').innerHTML=analysis.pairs.filter(p=>p.distanceMeters!==null).slice(0,10).map(p=>`<tr><th scope="row">${num(p.rank)}</th><td><span>${esc(p.district)}</span><strong>${esc(p.address)}</strong><small>${esc(p.comparisonId)}・${esc(p.qualityNote)}</small></td><td>${esc(gap(p.distanceMeters))}</td><td><span>2024：${esc(p.before.rawX)}，${esc(p.before.rawY)}</span><span>2026：${esc(p.after.rawX)}，${esc(p.after.rawY)}</span><details><summary>查看來源列與地圖</summary>${sourceRows([p.before],'2024 封存版',data.meta.before.key)}${sourceRows([p.after],'2026 官方主檔',data.meta.after.key)}</details></td></tr>`).join('')||'<tr><td colspan="4">這批配對沒有可計算的距離，請在下方清單查看原始座標。</td></tr>';
    $('comparison-distance-sort').disabled=false;$('comparison-distance-sort-note').textContent='排序使用未四捨五入距離；無法計算者置於最後。排名不代表遷移。';
    $('coordinate-distance-status').hidden=true;$('coordinate-distance-content').hidden=false;
    render();
  }
}
