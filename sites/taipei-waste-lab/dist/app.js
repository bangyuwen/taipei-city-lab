import {annualCounts,events} from './history.js';
import {filterPoints,recordStats,pageFromHash,allowedPages,historyPages,escapeHTML as esc} from './data-utils.js';

const $=id=>document.getElementById(id),num=n=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:1}).format(n);
const colors={'2015':'#986838','2022':'#30694e','2024':'#396e88','2026':'#244d43'};
let catalog,map,L,layers,markers=new Map(),filtered=[],shown=40,currentPage='map';
let state={year:'2015',district:'',search:''},mapStarting=false,eventFilter='all';
let designExperience,designLoading;
let comparisonLoading;
let researchLoading;

function ensureResearch(){
  if(!researchLoading)researchLoading=import('./research-ui.js').then(module=>module.initializeResearch()).catch(()=>{
    researchLoading=null;
    $('research-status').hidden=false;
    $('research-status').textContent='候選清單暫時無法載入，請重新整理；本頁的研究說明仍可閱讀。';
  });
  return researchLoading;
}

function ensureComparison(){
  if(!comparisonLoading)comparisonLoading=import('./comparison-ui.js').then(module=>module.initializeComparisonExperience()).catch(()=>{
    comparisonLoading=null;
    $('comparison-status').textContent='版本比較暫時無法載入，請重新整理再試。';
  });
  return comparisonLoading;
}

async function ensureDesign(){
  if(!designLoading)designLoading=import('./design-ui.js').then(module=>{
    designExperience=module.initializeDesignExperience();
    designExperience.setActive(currentPage==='design');
  }).catch(()=>{
    designLoading=null;
    $('design-status').textContent='桶型體驗暫時無法載入，請重新整理再試。';
    $('design-fallback').hidden=false;
  });
  return designLoading;
}

function readURL(){
  const url=new URL(location.href),year=url.searchParams.get('year'),district=url.searchParams.get('district');
  state.year=catalog.datasets.some(d=>d.key===year)?year:'2015';
  state.district=catalog.districtOrder.includes(district)?district:'';
  state.search=(url.searchParams.get('q')??'').slice(0,100);
  $('district').value=state.district;$('search').value=state.search;
}
function syncURL(){
  const url=new URL(location.href);
  url.searchParams.set('year',state.year);
  for(const [key,value] of [['district',state.district],['q',state.search]]){
    if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
  }
  history.replaceState(null,'',url);
}
function dataset(){return catalog.datasets.find(d=>d.key===state.year)}
function panel(){
  const previousPage=currentPage;
  currentPage=pageFromHash(location.hash);
  for(const a of document.querySelectorAll('[data-page]')){
    if(a.dataset.page===currentPage)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  }
  const inHistory=historyPages.includes(currentPage);
  $('history-navigation').hidden=!inHistory;
  const historyLink=document.querySelector('[data-section="history"]');
  if(inHistory)historyLink.setAttribute('aria-current','page');else historyLink.removeAttribute('aria-current');
  for(const p of allowedPages)$(`panel-${p}`).hidden=p!==currentPage;
  document.body.classList.toggle('design-mode',currentPage==='design');
  if(currentPage==='design')ensureDesign();
  if(currentPage==='comparison')ensureComparison();
  if(currentPage==='research')ensureResearch();
  designExperience?.setActive(currentPage==='design');
  if(currentPage==='map'&&catalog)ensureMap().then(()=>requestAnimationFrame(()=>{
    if(!map)return;
    map.invalidateSize({pan:false});
    if(previousPage!=='map')fitMap();
  }));
}
function renderVersions(){
  $('dataset-buttons').innerHTML=catalog.datasets.filter(d=>d.preferred).map(d=>`<button type="button" data-year="${d.key}" aria-pressed="false" aria-label="${esc(d.label)}"><span><strong>${d.year}</strong><small>${esc(d.short)}</small></span><span class="switch-count">${num(d.rows)} 筆</span></button>`).join('');
  for(const button of $('dataset-buttons').querySelectorAll('button'))button.addEventListener('click',()=>{
    state.year=button.dataset.year;syncURL();renderDataset();
  });
}
function renderDataset(){
  const d=dataset();shown=40;
  document.documentElement.style.setProperty('--point-color',colors[d.year]);
  for(const b of document.querySelectorAll('[data-year]')){
    const preferred=catalog.datasets.find(item=>item.key===b.dataset.year);
    const active=preferred.year===d.year,display=active?d:preferred;
    b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',display.label);
    b.querySelector('small').textContent=display.short;
    b.querySelector('.switch-count').textContent=num(display.rows)+' 筆';
  }
  const versions=catalog.datasets.filter(item=>item.year===d.year);
  $('dataset-version-field').hidden=versions.length<2;
  $('dataset-version').innerHTML=versions.map(item=>`<option value="${esc(item.key)}">${esc(item.label)}・${num(item.rows)} 筆</option>`).join('');
  $('dataset-version').value=d.key;
  $('dataset-completeness').textContent=d.coverageLabel+'；保存列數不等於已核實的全市存量。';
  $('dataset-date').textContent=d.dateLabel;$('dataset-note').textContent=d.note;
  $('dataset-source').href=d.source;$('dataset-source').textContent=d.sourceLabel+' ↗';
  $('map-legend').textContent=d.label+'的位置';
  renderDistricts(d);renderResults();
}
function renderDistricts(d){
  const max=Math.max(...Object.values(d.districts),1);
  $('district-table').innerHTML='<div class="district-grid">'+catalog.districtOrder.map(name=>`<div class="district-cell"><span>${name}</span><strong>${num(d.districts[name])} 筆</strong><div class="bar" aria-hidden="true"><span style="width:${100*d.districts[name]/max}%"></span></div></div>`).join('')+'</div>';
}
function renderResults(){
  filtered=filterPoints(dataset(),state);const stats=recordStats(filtered);
  $('result-count').textContent=num(stats.rows);
  $('result-map-count').textContent=`${num(stats.mapRows)} 筆可繪製${stats.rows>stats.mapRows?'・'+num(stats.rows-stats.mapRows)+' 筆座標待核對':''}`;
  $('map-caption').textContent=`${num(stats.mapRows)} 筆可繪製紀錄；相同座標保留。`;
  renderList();
  if(map)renderMap();else if(currentPage==='map')ensureMap();
}
function renderList(){
  const d=dataset();
  if(!filtered.length){
    const absentDistrict=state.district&&!d.districts[state.district];
    $('point-list').innerHTML=`<p class="empty-state">${absentDistrict?'這份資料沒有保存此行政區的紀錄；不能視為當地沒有垃圾箱。':'沒有符合條件的保存紀錄。試試其他路名或清除篩選。'}</p>`;
  }else{
    $('point-list').innerHTML=filtered.slice(0,shown).map((p,i)=>`<div class="point-row"><span class="row-index">${String(i+1).padStart(2,'0')}</span><button type="button" data-point="${esc(p.id)}" ${p.plottable?'':'disabled'}><span>${esc(p.address||'地址未記錄')}</span><small>${esc(p.district)}${p.plottable?'':'・座標待核對'}</small></button></div>`).join('');
    for(const b of $('point-list').querySelectorAll('[data-point]'))b.addEventListener('click',()=>focusPoint(b.dataset.point));
  }
  $('load-more').hidden=filtered.length<=shown;
}
async function ensureMap(){
  if(map||mapStarting||!catalog)return;
  mapStarting=true;
  try{
    L=await import('./vendor/leaflet/leaflet-src.esm.js');
    map=L.map('map',{preferCanvas:true,scrollWheelZoom:false}).setView([25.045,121.535],12);
    let failures=0;
    const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map);
    tiles.on('tileerror',()=>{if(++failures>=4)$('map-status').textContent='底圖連線暫時不穩；位置與清單仍可查詢。'});
    tiles.on('load',()=>{if(!failures)$('map-status').textContent=''});
    layers=L.layerGroup().addTo(map);renderMap();
  }catch(error){
    $('map-status').textContent='地圖暫時無法載入；仍可搜尋位置與查看清單。';
    console.error('Map initialization failed:',error.message);
  }finally{mapStarting=false}
}
function popup(p){
  const el=document.createElement('div'),strong=document.createElement('strong'),addr=document.createElement('div'),small=document.createElement('small');
  strong.textContent=p.district;addr.textContent=p.address||'地址未記錄';small.textContent=dataset().label+'・保存位置';
  el.append(strong,addr,small);return el;
}
function renderMap(){
  layers.clearLayers();markers=new Map();
  for(const p of filtered.filter(p=>p.plottable)){
    const marker=L.circleMarker([p.y,p.x],{radius:4,weight:1,color:colors[dataset().year],fillColor:colors[dataset().year],fillOpacity:.7}).bindPopup(()=>popup(p)).addTo(layers);
    markers.set(p.id,marker);
  }
  fitMap();
}
function fitMap(allCoordinates=false){
  if(!map||$('panel-map').hidden||!map.getContainer().clientWidth)return;
  if(!allCoordinates&&!state.district&&!state.search){
    map.setView([25.055,121.54],12,{animate:false});
    return;
  }
  const points=filtered.filter(p=>p.plottable);
  if(points.length)map.fitBounds(L.latLngBounds(points.map(p=>[p.y,p.x])),{padding:[24,24],maxZoom:16,animate:false});
}
async function focusPoint(id){
  if(!map)await ensureMap();
  const p=filtered.find(p=>p.id===id),marker=markers.get(id);
  if(map&&p?.plottable){map.setView([p.y,p.x],16,{animate:false});marker?.openPopup()}
}
function renderSources(){
  $('source-cards').innerHTML=catalog.datasets.map(d=>`<article class="source-card"><div class="source-label"><span class="source-year">${d.year}</span><span class="outline-tag">${esc(d.short)}</span></div><h3>${esc(d.label)}</h3><span class="source-date">${esc(d.dateLabel)}</span><p class="source-coverage">${esc(d.coverageLabel)}</p><dl><div><dt>保存資料列</dt><dd>${num(d.rows)}</dd></div><div><dt>不同座標</dt><dd>${num(d.distinctCoordinates)}</dd></div><div><dt>可繪製紀錄</dt><dd>${num(d.plottableRows)}</dd></div></dl><p>${esc(d.note)}</p><div class="source-actions"><a href="${esc(d.source)}" target="_blank" rel="noopener noreferrer">原始來源 ↗</a></div></article>`).join('');
}
function renderHistory(){
  $('annual-counts').innerHTML=annualCounts.map(a=>`<div class="annual-row"><span title="${a.year===2025?'2025 年底':a.year}">${a.year}</span><div class="bar" aria-hidden="true"><span style="width:${100*a.count/2000}%"></span></div><strong>${num(a.count)} 組</strong></div>`).join('');
  renderTimeline();
}
function renderTimeline(){
  const visible=events.filter(e=>eventFilter==='all'||e.kind===eventFilter);
  $('timeline').innerHTML=visible.map(e=>`<article class="timeline-event"><div class="timeline-date">${esc(e.date)}<small>${esc(e.tag)}</small></div><div class="timeline-body"><h4>${esc(e.title)}</h4><p>${esc(e.text)}</p>${e.steps?'<div class="case-steps">'+e.steps.map(([date,text])=>`<div class="case-step"><strong>${esc(date)}</strong><span>${esc(text)}</span></div>`).join('')+'</div>':''}<div class="event-sources">${e.sources.map(([label,url])=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`).join('')}</div><p class="event-limit">${esc(e.limit)}</p></div></article>`).join('');
}
async function start(){
  renderHistory();
  for(const img of document.querySelectorAll('.country-photo img')){
    const showPhotoError=()=>{img.hidden=true;img.nextElementSibling.hidden=false};
    img.addEventListener('error',showPhotoError,{once:true});
    if(img.complete&&!img.naturalWidth)showPhotoError();
  }
  window.addEventListener('hashchange',panel);
  window.addEventListener('popstate',()=>{
    if(catalog){
      const before=JSON.stringify(state);readURL();
      if(JSON.stringify(state)!==before)renderDataset();
    }
    panel();
  });
  for(const b of document.querySelectorAll('[data-event-filter]'))b.addEventListener('click',()=>{
    eventFilter=b.dataset.eventFilter;
    for(const other of document.querySelectorAll('[data-event-filter]'))other.setAttribute('aria-pressed',String(other===b));
    renderTimeline();
  });
  for(const id of ['district','search','reset-filters','fit-map'])$(id).disabled=true;
  panel();
  try{
    const response=await fetch('data/datasets.json');
    if(!response.ok)throw new Error('Data response unavailable');
    catalog=await response.json();
    for(const district of catalog.districtOrder){const o=document.createElement('option');o.value=district;o.textContent=district;$('district').append(o)}
    readURL();renderVersions();renderSources();renderDataset();
    $('dataset-version').addEventListener('change',e=>{state.year=e.target.value;syncURL();renderDataset()});
    for(const id of ['district','search','reset-filters','fit-map'])$(id).disabled=false;
    $('load-status').hidden=true;panel();
    $('district').addEventListener('change',e=>{state.district=e.target.value;shown=40;syncURL();renderResults()});
    $('search').addEventListener('input',e=>{state.search=e.target.value;shown=40;syncURL();renderResults()});
    $('reset-filters').addEventListener('click',()=>{state.district='';state.search='';$('district').value='';$('search').value='';shown=40;syncURL();renderResults()});
    $('load-more').addEventListener('click',()=>{shown+=40;renderList()});
    $('fit-map').addEventListener('click',()=>fitMap(true));
  }catch(error){
    $('load-status').textContent='位置資料暫時無法載入，請重新整理再試。';
    $('load-status').classList.add('error');
    console.error('Site initialization failed:',error.message);
  }
}
start();
