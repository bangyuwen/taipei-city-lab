import {annualCounts,events} from './history.js';
import {filterPoints,recordStats,pageFromHash,allowedPages,historyPages,escapeHTML as esc} from './data-utils.js';

const $=id=>document.getElementById(id),num=n=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:1}).format(n);
const colors={'2015':'#986838','2022':'#30694e','2024':'#396e88','2026':'#244d43'};
let catalog,map,L,layers,markers=new Map(),filtered=[],shown=40,currentPage=null,lastHash;
let basemap;
let state={year:'2015',district:'',search:''},mapStarting=false;
let designExperience,designLoading;
let comparisonLoading;
let sitingExperience,sitingLoading;
let researchLoading;
let countryExperience,countryLoading;
const pageScroll = new Map();

function ensureSiting(){
  if(!sitingLoading)sitingLoading=import('./siting-ui.js').then(module=>{
    sitingExperience=module.initializeSitingExperience();
    sitingExperience.setActive(currentPage==='siting');
  }).catch(()=>{
    sitingLoading=null;
    $('siting-status').hidden=false;
    $('siting-status').textContent='疊圖暫時無法載入，可重試或開啟完整頁面。';
    $('siting-retry').hidden=false;
  });
  return sitingLoading;
}

function ensureResearch(){
  if(!researchLoading)researchLoading=import('./research-ui.js').then(module=>module.initializeResearch()).catch(()=>{
    researchLoading=null;
    $('research-status').hidden=false;
    $('research-status').textContent='候選清單暫時無法載入，請重新整理；本頁的研究說明仍可閱讀。';
  });
  return researchLoading;
}

function ensureComparison(){
  if(!comparisonLoading){
    $('comparison-status').hidden=false;$('comparison-status').textContent='正在載入版本比較…';$('comparison-retry').hidden=true;
    comparisonLoading=import('./comparison-ui.js').then(module=>module.initializeComparisonExperience()).catch(()=>{
    comparisonLoading=null;
    $('comparison-status').textContent='版本比較暫時無法載入，請重試。來源日期與限制仍可閱讀。';
    $('comparison-retry').hidden=false;
  });}

  return comparisonLoading;
}

async function ensureDesign(){
  if(!designLoading)designLoading=import('./design-ui.js').then(module=>{
    designExperience=module.initializeDesignExperience();
    designExperience.setActive(currentPage==='design');
  }).catch(()=>{
    designLoading=null;
    $('design-status').textContent='用途設計暫時無法載入，請重新整理再試。';
    $('design-fallback').hidden=false;
  });
  return designLoading;
}

function ensureCountries(){
  if(!countryLoading)countryLoading=import('./country-ui.js').then(module=>{
    countryExperience=module.initializeCountryExperience();
    countryExperience.setActive(currentPage==='countries');
    $('country-load-status').hidden=true;
  }).catch(()=>{
    countryLoading=null;
    $('country-load-status').hidden=false;
  });
  return countryLoading;
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
  const nextPage=pageFromHash(location.hash,currentPage);
  const moved=nextPage!==previousPage||lastHash!==location.hash;
  if(previousPage&&nextPage!==previousPage)pageScroll.set(previousPage,window.scrollY);
  currentPage=nextPage;
  lastHash=location.hash;
  for(const a of document.querySelectorAll('[data-page]')){
    if(a.dataset.page===currentPage)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  }
  document.body.dataset.page=currentPage;
  if(moved){
    document.querySelector('.site-header').classList.remove('menu-open');
    $('site-menu-toggle').setAttribute('aria-expanded','false');
    requestAnimationFrame(()=>{
      const target=document.getElementById(location.hash.slice(1));
      const anchor=!allowedPages.includes(location.hash.slice(1))&&target?.closest('.page-panel')?.id===`panel-${currentPage}`?target:null;
      const mainTarget=target?.id==='main'?target:null;
      const heading=mainTarget||anchor||document.querySelector(`#panel-${currentPage} h2`);
      for(let parent=heading?.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
      heading?.setAttribute('tabindex','-1');
      if(previousPage||anchor||mainTarget)heading?.focus({preventScroll:true});
      if(mainTarget||anchor)heading.scrollIntoView({block:'start',behavior:'instant'});
      else window.scrollTo({top:pageScroll.get(currentPage)??0,behavior:'instant'});
    });
  }
  const inHistory=historyPages.includes(currentPage);
  $('history-navigation').hidden=!inHistory;
  const historyLink=document.querySelector('[data-section="history"]');
  historyLink.toggleAttribute('data-section-active',inHistory);
  if(currentPage==='history')historyLink.setAttribute('aria-current','page');else historyLink.removeAttribute('aria-current');
  const researchLink=document.querySelector('#site-navigation [data-page="research"]');
  researchLink.toggleAttribute('data-section-active',['research','design','materials','plan'].includes(currentPage));
  for(const p of allowedPages)if($(`panel-${p}`))$(`panel-${p}`).hidden=p!==currentPage;
  $('load-status').hidden=Boolean(catalog)||currentPage!=='map';
  document.body.classList.toggle('design-mode',currentPage==='design');
  document.body.classList.toggle('comparison-mode',currentPage==='comparison');
  document.body.classList.toggle('research-mode',currentPage==='research');
  if(currentPage==='design')ensureDesign();
  if(currentPage==='siting')ensureSiting();
  sitingExperience?.setActive(currentPage==='siting');
  if(currentPage==='comparison')ensureComparison();
  if(currentPage==='materials')ensureResearch();
  if(currentPage==='countries')ensureCountries();
  countryExperience?.setActive(currentPage==='countries');
  designExperience?.setActive(currentPage==='design');
  if(currentPage==='map'&&catalog)ensureMap().then(()=>requestAnimationFrame(()=>{
    if(!map)return;
    map.invalidateSize({pan:false});
    if(previousPage!=='map')fitMap();
  }));
}
function renderVersions(){
  $('dataset-version').innerHTML=catalog.datasets.map(d=>`<option value="${esc(d.key)}">${esc(d.label)} · ${num(d.rows)} 筆</option>`).join('');
}
function renderDataset(){
  const d=dataset();shown=40;
  document.documentElement.style.setProperty('--point-color',colors[d.year]);
  $('dataset-version').value=d.key;
  $('dataset-completeness').textContent=d.coverageLabel+'；保存列數不等於已核實的全市存量。';
  $('dataset-date').textContent=d.dateLabel;
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
    setBasemap();
    layers=L.layerGroup().addTo(map);renderMap();
  }catch(error){
    $('map-status').textContent='地圖暫時無法載入；仍可搜尋位置與查看清單。';
    console.error('Map initialization failed:',error.message);
  }finally{mapStarting=false}
}
function setBasemap(fallback=false){
  if(!map)return;
  const light=$('map-basemap').value==='light';
  const carto=light&&!fallback;
  if(basemap){basemap.off('tileerror load');map.removeLayer(basemap)}
  $('map-status').textContent=fallback?'簡潔底圖暫時無法載入，已改用淡色街道底圖。':'';
  const attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
  const tiles=L.tileLayer(carto?'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png':'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,keepBuffer:1,updateWhenIdle:true,
    className:light&&!carto?'map-tiles-muted':'',opacity:light&&!carto?.55:1,
    attribution:attribution+(carto?' &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>':'')
  });
  basemap=tiles;
  let failures=0;
  tiles.on('tileerror',()=>{
    if(basemap!==tiles)return;
    if(carto){setBasemap(true);return}
    if(++failures>=4)$('map-status').textContent='底圖連線暫時不穩；位置與清單仍可查詢。';
  });
  tiles.on('load',()=>{
    if(basemap===tiles&&!failures&&!fallback)$('map-status').textContent='';
  });
  tiles.addTo(map);
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
  $('source-cards').innerHTML='<div class="source-table-wrap" role="region" aria-label="歷史清冊來源，可左右捲動" tabindex="0"><table class="source-table"><caption>六份保存版本；資料列不是已核實的設施存量。</caption><thead><tr><th scope="col">資料版本與日期</th><th scope="col">保存／可繪製</th><th scope="col">範圍與限制</th></tr></thead><tbody>'+catalog.datasets.map(d=>`<tr><th scope="row"><a href="${esc(d.source)}" target="_blank" rel="noopener noreferrer">${esc(d.label)}</a><small>${esc(d.dateLabel)}</small></th><td>${num(d.rows)}／${num(d.plottableRows)} 筆<small>${num(d.distinctCoordinates)} 組不同座標</small></td><td>${esc(d.coverageLabel)}<p>${esc(d.note)}</p></td></tr>`).join('')+'</tbody></table></div>';
}
function renderHistory(){
  $('annual-counts').innerHTML=annualCounts.map(a=>`<div class="annual-row"><span title="${a.year===2025?'2025 年底':a.year}">${a.year}</span><div class="bar" aria-hidden="true"><span style="width:${100*a.count/2000}%"></span></div><strong>${num(a.count)} 組</strong></div>`).join('');
  renderTimeline();
}
function renderTimeline(){
  const visible=events;
  $('timeline').innerHTML=visible.map(e=>`<article class="timeline-event"><div class="timeline-date">${esc(e.date)}<small>${esc(e.tag)}</small></div><div class="timeline-body"><h4>${esc(e.title)}</h4><p>${esc(e.text)}</p>${e.steps?'<div class="case-steps">'+e.steps.map(([date,text])=>`<div class="case-step"><strong>${esc(date)}</strong><span>${esc(text)}</span></div>`).join('')+'</div>':''}<div class="event-sources">${e.sources.map(([label,url])=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`).join('')}</div><p class="event-limit">${esc(e.limit)}</p></div></article>`).join('');
}
async function start(){
  document.body.classList.add('enhanced');
  document.querySelector('.skip-link').addEventListener('click',event=>{
    event.preventDefault();
    const main=$('main');
    main.setAttribute('tabindex','-1');
    main.focus({preventScroll:true});
    main.scrollIntoView({block:'start',behavior:'instant'});
  });
  $('site-menu-toggle').hidden=false;
  $('site-menu-toggle').addEventListener('click',()=>{
    const open=document.querySelector('.site-header').classList.toggle('menu-open');
    $('site-menu-toggle').setAttribute('aria-expanded',String(open));
  });
  document.querySelector('#site-navigation').addEventListener('click',event=>{
    const link=event.target.closest('a');
    if(!link)return;
    if(pageFromHash(link.hash)===currentPage){
      const heading=document.querySelector(`#panel-${currentPage} h2`);
      heading?.setAttribute('tabindex','-1');
      heading?.focus({preventScroll:true});
      window.scrollTo({top:0,behavior:'instant'});
    }
    document.querySelector('.site-header').classList.remove('menu-open');
    $('site-menu-toggle').setAttribute('aria-expanded','false');
  });
  document.querySelector('.site-header').addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.querySelector('.site-header').classList.contains('menu-open')){
      document.querySelector('.site-header').classList.remove('menu-open');
      $('site-menu-toggle').setAttribute('aria-expanded','false');
      $('site-menu-toggle').focus();
    }
  });
  renderHistory();
  for(const img of document.querySelectorAll('.country-photo img')){
    const showPhotoError=()=>{img.hidden=true;img.nextElementSibling.hidden=false};
    img.addEventListener('error',showPhotoError,{once:true});
    if(img.complete&&!img.naturalWidth)showPhotoError();
  }
  document.querySelector('main').addEventListener('click',event=>{
    const button=event.target.closest('[data-research-target]');
    if(!button)return;
    const target=$(button.dataset.researchTarget);
    if(!target)return;
    event.preventDefault();
    if(location.hash!==`#${target.id}`){location.hash=target.id;return}
    for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
    target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});
  });
  $('comparison-retry').addEventListener('click',ensureComparison);
  $('siting-retry').addEventListener('click',()=>sitingExperience?sitingExperience.reload():ensureSiting());
  $('map-basemap').addEventListener('change',()=>setBasemap());
  window.addEventListener('hashchange',panel);
  window.addEventListener('popstate',()=>{
    if(catalog){
      const before=JSON.stringify(state);readURL();
      if(JSON.stringify(state)!==before)renderDataset();
    }
    panel();
  });
  for(const id of ['dataset-version','district','search','reset-filters','fit-map'])$(id).disabled=true;
  $('source-cards').innerHTML='<p role="status">正在載入六份保存版本的來源與範圍…</p>';
  panel();
  try{
    const response=await fetch('data/datasets.json');
    if(!response.ok)throw new Error('Data response unavailable');
    catalog=await response.json();
    for(const district of catalog.districtOrder){const o=document.createElement('option');o.value=district;o.textContent=district;$('district').append(o)}
    readURL();renderVersions();renderSources();renderDataset();
    $('dataset-version').addEventListener('change',e=>{state.year=e.target.value;syncURL();renderDataset()});
    for(const id of ['dataset-version','district','search','reset-filters','fit-map'])$(id).disabled=false;
    $('load-status').hidden=true;panel();
    const anchor=document.getElementById(location.hash.slice(1));
    if(!allowedPages.includes(location.hash.slice(1))&&anchor?.closest('.page-panel')?.id===`panel-${currentPage}`)anchor.scrollIntoView({block:'start',behavior:'instant'});
    $('district').addEventListener('change',e=>{state.district=e.target.value;shown=40;syncURL();renderResults()});
    $('search').addEventListener('input',e=>{state.search=e.target.value;shown=40;syncURL();renderResults()});
    $('reset-filters').addEventListener('click',()=>{state.district='';state.search='';$('district').value='';$('search').value='';shown=40;syncURL();renderResults()});
    $('load-more').addEventListener('click',()=>{shown+=40;renderList()});
    $('fit-map').addEventListener('click',()=>fitMap(true));
  }catch(error){
    $('load-status').textContent='位置資料暫時無法載入，請重新整理再試。';
    $('load-status').classList.add('error');
    $('source-cards').innerHTML='<p role="status">資料版本表暫時無法載入，請重新整理再試。下方研究文獻、實務紀錄與方法仍可閱讀。</p>';
    console.error('Site initialization failed:',error.message);
  }
}
start();
