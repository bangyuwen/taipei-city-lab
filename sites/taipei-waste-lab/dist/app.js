import {annualCounts,events} from './history.js';
import {filterPoints,filterVenuePoints,recordStats,pageFromHash,allowedPages,workspaceForPage,escapeHTML as esc} from './data-utils.js';

const $=id=>document.getElementById(id),num=n=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:1}).format(n);
const colors={'2015':'#986838','2022':'#30694e','2024':'#396e88','2026':'#244d43'};
let catalog,map,L,layers,venueLayers,markers=new Map(),venueMarkers=new Map(),venueFiltered=[],filtered=[],shown=40,currentPage=null,lastHash;
let basemap;
let state={year:'2015',district:'',search:'',showVenues:true},mapStarting=false;
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
  state.showVenues=url.searchParams.get('venues')!=='0';
  $('district').value=state.district;$('search').value=state.search;
}
function syncURL(){
  const url=new URL(location.href);
  url.searchParams.set('year',state.year);
  for(const [key,value] of [['district',state.district],['q',state.search]]){
    if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
  }
  if(state.showVenues)url.searchParams.delete('venues');else url.searchParams.set('venues','0');
  history.replaceState(null,'',url);
}
function dataset(){return catalog.datasets.find(d=>d.key===state.year)}
function initReaders(){
  for(const reader of document.querySelectorAll('[data-reader]')){
    if(reader.dataset.readerMode==='document')continue;
    const select=reader.querySelector('select');
    const items=[...reader.querySelector('.reader-items').children].filter(item=>item.hasAttribute('data-reader-item'));
    for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.dataset.readerItem;select.append(option);}
    select.addEventListener('change',()=>{location.hash=select.value;});
    reader.querySelector('[data-reader-controls]').hidden=false;
    for(const index of reader.querySelectorAll('.reader-index'))index.hidden=true;
  }
}
function syncReader(page,target){
  const reader=page?.querySelector('[data-reader]');if(!reader||reader.dataset.readerMode==='document')return;
  const items=[...reader.querySelector('.reader-items').children].filter(item=>item.hasAttribute('data-reader-item'));
  const selected=target?.closest('[data-reader-item]');
  const index=selected&&items.includes(selected)?items.indexOf(selected):0;
  items.forEach((item,i)=>{item.hidden=i!==index;});
  reader.querySelector('select').value=items[index].id;
  reader.querySelector('.reader-position').textContent=`第 ${index+1} 項，共 ${items.length} 項`;
  for(const [attribute,offset] of [['prev',-1],['next',1]]){
    const link=reader.querySelector(`[data-reader-${attribute}]`);const next=items[index+offset];
    link.hidden=!next;
    if(next){link.href='#'+next.id;link.setAttribute('aria-label',(offset<0?'上一項：':'下一項：')+next.dataset.readerItem);}
    else link.removeAttribute('href');
  }
}

function panel(){
  const previousPage=currentPage;
  const targetPanel=document.getElementById(location.hash.slice(1))?.closest('.page-panel');
  const nextPage=targetPanel?.id.slice('panel-'.length)||pageFromHash(location.hash,currentPage);
  syncReader($('panel-'+nextPage),document.getElementById(location.hash.slice(1)));
  const moved=nextPage!==previousPage||lastHash!==location.hash;
  if(previousPage&&nextPage!==previousPage)pageScroll.set(previousPage,window.scrollY);
  currentPage=nextPage;
  lastHash=location.hash;
  for(const a of document.querySelectorAll('[data-page]')){
    const selected=a.closest('.site-header')?a.dataset.page===workspaceForPage(currentPage):a.dataset.page===currentPage;
    if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
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
      for(let parent=heading;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
      heading?.setAttribute('tabindex','-1');
      if(previousPage||anchor||mainTarget)heading?.focus({preventScroll:true});
      if(mainTarget||anchor){
        const scrollTarget=anchor?.matches('[data-reader-item]')&&anchor.closest('[data-reader]').dataset.readerMode!=='document'?anchor.closest('[data-reader]').querySelector('[data-reader-controls]'):heading;
        scrollTarget.scrollIntoView({block:'start',behavior:'instant'});
      }
      else window.scrollTo({top:pageScroll.get(currentPage)??0,behavior:'instant'});
    });
  }
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
  filtered=filterPoints(dataset(),state);venueFiltered=filterVenuePoints(catalog,state);const stats=recordStats(filtered);
  $('result-count').textContent=num(stats.rows);
  $('result-map-count').textContent=`${num(stats.mapRows)} 筆可繪製${stats.rows>stats.mapRows?'・'+num(stats.rows-stats.mapRows)+' 筆座標待核對':''}`;
  $('map-caption').textContent=`${num(stats.mapRows)} 筆可繪製紀錄；相同座標保留。`;
  renderVenues();renderList();
  if(map)renderMap();else if(currentPage==='map')ensureMap();
}
function renderVenues(){
  const visible=state.year==='2026-main',data=catalog.venueLeads;
  $('venue-layer').hidden=!visible;$('venue-results').hidden=!visible;
  $('venue-legend').hidden=!visible||!state.showVenues;
  $('show-venues').checked=state.showVenues;
  $('venue-count').textContent=num(venueFiltered.length);
  $('venue-source').href=data.source;
  $('venue-date').textContent=`來源更新 ${data.sourceUpdatedAt.slice(0,10)}；${data.checkedDate} 複查`;
  $('venue-status').textContent=!state.showVenues?'場域圖層已隱藏。':
    venueFiltered.length?'場域線索與街頭紀錄分開計數，不能相加；重複名稱及座標保留。':
    '沒有符合篩選的場域線索；不代表沒有可用投放點。';
  $('venue-list').innerHTML=venueFiltered.map(p=>`<div class="point-row venue-row"><button type="button" data-venue="${esc(p.id)}"><span>${esc(p.address)}</span><small>${esc(p.district)} · 原表備註：${esc(p.sourceRemark||'未提供')} · 約略位置，待核實</small></button></div>`).join('');
  for(const button of $('venue-list').querySelectorAll('[data-venue]'))button.addEventListener('click',()=>focusVenue(button.dataset.venue));
  if(visible&&state.showVenues)$('map-caption').textContent+=` 另顯示 ${num(venueFiltered.length)} 筆場域線索（約略位置）；不是已核實桶位。`;
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
    layers=L.layerGroup().addTo(map);venueLayers=L.layerGroup().addTo(map);renderMap();
  }catch(error){
    $('map-status').textContent='地圖暫時無法載入；仍可搜尋位置與查看清單。';
    console.error('Map initialization failed:',error.message);
  }finally{mapStarting=false}
}
function setBasemap(){
  if(!map)return;
  const light=$('map-basemap').value==='light';
  if(basemap){basemap.off('tileerror load');map.removeLayer(basemap)}
  $('map-status').textContent='';
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,keepBuffer:1,updateWhenIdle:true,
    className:light?'map-tiles-muted':'',opacity:light?.55:1,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  });
  basemap=tiles;
  let failures=0;
  tiles.on('tileerror',()=>{
    if(basemap===tiles&&++failures>=4)$('map-status').textContent='底圖連線暫時不穩；位置與清單仍可查詢。';
  });
  tiles.on('load',()=>{
    if(basemap===tiles&&!failures)$('map-status').textContent='';
  });
  tiles.addTo(map);
}
function popup(p){
  const el=document.createElement('div'),strong=document.createElement('strong'),addr=document.createElement('div'),small=document.createElement('small');
  strong.textContent=p.district;addr.textContent=p.address||'地址未記錄';small.textContent=dataset().label+'・保存位置';
  el.append(strong,addr,small);return el;
}
function venuePopup(p){
  const el=document.createElement('div');el.className='venue-popup';
  const title=document.createElement('strong');title.textContent=p.address;
  const note=document.createElement('p');note.textContent=p.district+' · '+p.quality;
  const remark=document.createElement('p');remark.textContent=`官方原表備註：${p.sourceRemark||'未提供'}。來源標示的處數未逐點核實，不與街道列數相加。`;
  const coordinates=document.createElement('p');coordinates.textContent=`原檔座標：${p.rawY}, ${p.rawX}。${catalog.venueLeads.coordinateNote}`;
  const status=document.createElement('p');status.textContent=catalog.venueLeads.availabilityNote;
  const source=document.createElement('a');source.href=catalog.venueLeads.source;source.target='_blank';source.rel='noopener noreferrer';source.textContent=`官方場域清單（${catalog.venueLeads.sourceUpdatedAt.slice(0,10)}）`;
  el.append(title,note,remark,coordinates,status,source);return el;
}
async function focusVenue(id){
  if(!map)await ensureMap();
  const p=venueFiltered.find(p=>p.id===id),marker=venueMarkers.get(id);
  if(map&&p){map.setView([p.y,p.x],15,{animate:false});marker?.openPopup()}
}
function renderMap(){
  layers.clearLayers();venueLayers.clearLayers();markers=new Map();venueMarkers=new Map();
  for(const p of filtered.filter(p=>p.plottable)){
    const marker=L.circleMarker([p.y,p.x],{radius:4,weight:1,color:colors[dataset().year],fillColor:colors[dataset().year],fillOpacity:.7}).bindPopup(()=>popup(p)).addTo(layers);
    markers.set(p.id,marker);
  }
  for(const p of venueFiltered){
    const label=p.address+'・場域約略位置，待核實';
    const icon=L.divIcon({className:'venue-marker',html:'<span aria-hidden="true"></span>',iconSize:[28,28],iconAnchor:[14,14]});
    const marker=L.marker([p.y,p.x],{icon,title:label,keyboard:true}).bindPopup(()=>venuePopup(p),{maxWidth:220,maxHeight:180,autoPanPaddingTopLeft:[5,110]}).addTo(venueLayers);
    marker.getElement()?.setAttribute('aria-label',label);venueMarkers.set(p.id,marker);
  }
  fitMap();
}
function fitMap(allCoordinates=false){
  if(!map||$('panel-map').hidden||!map.getContainer().clientWidth)return;
  if(!allCoordinates&&!state.district&&!state.search){
    map.setView([25.055,121.54],12,{animate:false});
    return;
  }
  const points=[...filtered.filter(p=>p.plottable),...venueFiltered];
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
  document.querySelector('.site-header').addEventListener('click',event=>{
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
  initReaders();
  window.addEventListener('hashchange',panel);
  $('main').addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#"]');
    if(!link||link.hash!==location.hash||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const target=$(link.hash.slice(1));
    if(!target||!target.closest('.page-panel'))return;
    target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});
  });
  window.addEventListener('popstate',()=>{
    if(catalog){
      const before=JSON.stringify(state);readURL();
      if(JSON.stringify(state)!==before)renderDataset();
    }
    panel();
  });
  for(const id of ['dataset-version','district','search','reset-filters','fit-map','show-venues'])$(id).disabled=true;
  $('source-cards').innerHTML='<p role="status">正在載入六份保存版本的來源與範圍…</p>';
  panel();
  try{
    const response=await fetch('data/datasets.json');
    if(!response.ok)throw new Error('Data response unavailable');
    catalog=await response.json();
    for(const district of catalog.districtOrder){const o=document.createElement('option');o.value=district;o.textContent=district;$('district').append(o)}
    readURL();renderVersions();renderSources();renderDataset();
    $('dataset-version').addEventListener('change',e=>{state.year=e.target.value;syncURL();renderDataset()});
    for(const id of ['dataset-version','district','search','reset-filters','fit-map','show-venues'])$(id).disabled=false;
    $('load-status').hidden=true;panel();
    const anchor=document.getElementById(location.hash.slice(1));
    if(!allowedPages.includes(location.hash.slice(1))&&anchor?.closest('.page-panel')?.id===`panel-${currentPage}`)anchor.scrollIntoView({block:'start',behavior:'instant'});
    $('district').addEventListener('change',e=>{state.district=e.target.value;shown=40;syncURL();renderResults()});
    $('search').addEventListener('input',e=>{state.search=e.target.value;shown=40;syncURL();renderResults()});
    $('reset-filters').addEventListener('click',()=>{state.district='';state.search='';$('district').value='';$('search').value='';shown=40;syncURL();renderResults()});
    $('show-venues').addEventListener('change',e=>{state.showVenues=e.target.checked;syncURL();renderResults()});
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
