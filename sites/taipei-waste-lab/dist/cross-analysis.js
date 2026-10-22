import {escapeHTML as esc, normalizeSearch} from './data-utils.js';

export function selectStations(data, {district='', search='', radius=100, mode='priority'}={}) {
  const q=normalizeSearch(search);
  return data.stations.filter(p=>(!district||p.district===district)
    && (!q||normalizeSearch(p.name+p.address+p.district).includes(q))
    && (mode==='all'||(p.events!==null&&p.events>=data.meta.highActivityThreshold&&p.nearestBin.distanceM>radius&&p.buses.length>0)))
    .sort((a,b)=>(b.events??-1)-(a.events??-1)||a.id.localeCompare(b.id));
}

export function summarizeComparison(data, stations, radius=300) {
  const known=stations.filter(p=>p.events!==null);
  const ranked=known.filter(p=>p.binCounts[String(radius)]>0).map(p=>({...p,
    binCount:p.binCounts[String(radius)], dailyEvents:p.events/data.meta.activityDays,
    eventsPerBin:p.events/data.meta.activityDays/p.binCounts[String(radius)]}))
    .sort((a,b)=>b.eventsPerBin-a.eventsPerBin||a.id.localeCompare(b.id));
  const zero=known.filter(p=>p.binCounts[String(radius)]===0).sort((a,b)=>b.events-a.events||a.id.localeCompare(b.id));
  const busIds=new Set(stations.flatMap(p=>p.buses.map(b=>b.id)));
  const buses=data.buses.filter(p=>busIds.has(p.id));
  const uncovered=buses.filter(p=>p.nearestBin.distanceM>radius);
  return {ranked,zero,unknown:stations.length-known.length,busTotal:buses.length,busUncovered:uncovered.length,
    busPercent:buses.length?100*uncovered.length/buses.length:null};
}

export function selectMrtStations(data,{district='',search=''}={}) {
  const q=normalizeSearch(search), bikes=new Map(data.stations.map(p=>[p.id,p]));
  return data.transport.stations.filter(p=>(!district||p.areas.includes(district))&&(!q||normalizeSearch(p.name+p.areas.join('')+p.bikeIds.map(id=>{const b=bikes.get(id);return b.name+b.address}).join('')).includes(q)));
}

export function summarizeMrt(data,stations,radius) {
  const bikes=new Map(data.stations.map(p=>[p.id,p])), buses=new Map(data.buses.map(p=>[p.id,p]));
  const rows=stations.map(p=>{
    const nearby=p.bikeIds.map(id=>bikes.get(id)), count=p.binCounts[radius], daily=(p.entries+p.exits)/data.transport.meta.days;
    return {...p,daily,binCount:count,ratio:count?daily/count:null,
      bikeDaily:nearby.filter(b=>b.events!==null).reduce((sum,b)=>sum+b.events,0)/data.meta.activityDays,
      bikeUnknown:nearby.filter(b=>b.events===null).length,
      busUncovered:p.busIds.filter(id=>buses.get(id).nearestBin.distanceM>radius).length};
  });
  return {ranked:rows.filter(p=>p.ratio!==null).sort((a,b)=>b.ratio-a.ratio||a.name.localeCompare(b.name)),
    zero:rows.filter(p=>p.ratio===null).sort((a,b)=>b.daily-a.daily||a.name.localeCompare(b.name))};
}

export function hourlySeries(data,kind='hourly') {
  const sum=rows=>Array.from({length:24},(_,h)=>rows.reduce((total,row)=>total+row[h],0));
  const mrt=data.transport.stations;
  const bike=Object.values(data.areaProfiles).flatMap(p=>kind==='hourly'?[p.weekday.hourly,p.weekend.hourly]:[p[kind].hourly]);
  const groups=data.transport.complaints.groups;
  return [
    {name:'捷運進站紀錄',unit:'人次',values:sum(mrt.map(p=>p[kind])),missing:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].filter(h=>!data.transport.meta.observedHours.includes(h))},
    {name:'YouBike 借還',unit:'端點事件',values:sum(bike),missing:[]},
    ...Object.entries(groups).map(([name,p])=>({name,unit:'件',values:p[kind],missing:[]}))
  ].map(p=>{const total=p.values.reduce((a,b)=>a+b,0);return {...p,total,peaks:p.values.flatMap((v,h)=>v===Math.max(...p.values)?[h]:[]),shares:p.values.map(v=>total?v/total*100:0)}});
}

export async function initializeCrossAnalysis({map,L,getState,catalog}) {
  const response=await fetch('data/cross-analysis.json');
  if(!response.ok)throw new Error('Cross-analysis data unavailable');
  const data=await response.json(), meta=data.meta;
  const $=id=>document.getElementById(id), n=value=>new Intl.NumberFormat('zh-TW').format(value);
  const bikeLayer=L.layerGroup().addTo(map), busLayer=L.layerGroup().addTo(map), linkLayer=L.layerGroup().addTo(map);
  const busById=new Map(data.buses.map(p=>[p.id,p])), markers=new Map();
  let selected=[],shown=30,busIds=new Set();
  const baseline=catalog.datasets.find(p=>p.key===meta.binKey);
  $('cross-method').textContent=`全市 ${n(meta.stationRows)} 站中，本頁分析 ${n(meta.activeCoordinateStations)} 個啟用且座標有效的站；${n(meta.observedStations)} 站有可用活動紀錄。高活動定義為有活動站的前四分之一（至少 ${n(meta.highActivityThreshold)} 次借還端點事件），不是人數。公車以 stopLocationId 合併路線列，排除 ${meta.excludedBusIds.length} 個座標衝突或無效站位群；只顯示距 YouBike 站 300 公尺內的站位，跨市邊界仍可能出現。`;
  $('cross-sources').innerHTML=`<a href="${esc(meta.activitySource)}" target="_blank" rel="noopener noreferrer">YouBike 借還：${esc(meta.activityPeriod)}</a>；<a href="${esc(meta.stationSource)}" target="_blank" rel="noopener noreferrer">站點：${esc(meta.stationSnapshot)}</a>；<a href="${esc(meta.busSource)}" target="_blank" rel="noopener noreferrer">公車站牌：${esc(meta.busUpdatedAt)}</a>；<a href="${esc(meta.binSource)}" target="_blank" rel="noopener noreferrer">垃圾桶：${esc(meta.binDate)}</a>。跨期桌面比對，不能視為同時觀測。`;
  function reason(p,radius){
    if(!baseline.districts[p.district]||p.district==='南港區')return '先補查清冊覆蓋，再判斷服務缺口';
    return p.nearestBin.distanceM>radius?'距清冊桶位較遠：查漏列、替代點與步行路線':'附近有清冊桶位：查可見性、可用性與維護';
  }
  function focus(p){
    linkLayer.clearLayers();
    const bin=p.nearestBin;
    L.polyline([[p.y,p.x],[bin.y,bin.x]],{color:'#734917',weight:3,dashArray:'6 5'}).addTo(linkLayer);
    L.circleMarker([bin.y,bin.x],{radius:9,color:'#244d43',fillOpacity:.3}).bindPopup(`最近清冊桶位：${esc(bin.address)}<br>直線 ${n(Math.round(bin.distanceM))} 公尺；未確認現場可用`).addTo(linkLayer);
    map.fitBounds([[p.y,p.x],[bin.y,bin.x]],{padding:[40,40],maxZoom:17,animate:false});
    const nearby=p.buses.map(ref=>busById.get(ref.id));
    const radius=Number($('cross-radius').value);
    $('cross-detail').innerHTML=`<h4>${esc(p.name)}：${esc(reason(p,radius))}</h4><p>最近清冊桶位：${esc(bin.district)} ${esc(bin.address)}（${n(Math.round(bin.distanceM))} 公尺直線距離）。此 YouBike 站周邊 300 公尺內，有 ${n(nearby.filter(b=>b.nearestBin.distanceM>radius).length)} 個站位距最近桶位超過 ${radius} 公尺。</p><p>${nearby.length?nearby.map(b=>`${esc(b.name)}：距桶 ${n(Math.round(b.nearestBin.distanceM))} 公尺`).join('；'):'300 公尺內沒有本次保留的公車站位。'}</p><p>站外行人人流、公車上下車量、垃圾量與實際步行路徑尚未量測。先現場確認清冊是否漏列、是否需過街及桶況，再決定是否需要配置調整。</p>`;
    $('cross-detail').hidden=false;
    L.circleMarker([p.y,p.x],{radius:8,color:'#16566a',fillColor:'#e2eff3',fillOpacity:1}).bindPopup(`${esc(p.name)}<br>${p.events===null?'活動量未知':n(p.events)+' 次借還端點事件'}<br>距最近清冊桶位 ${n(Math.round(bin.distanceM))} 公尺`).addTo(linkLayer).openPopup();
  }
  function renderRows(){
    const radius=Number($('cross-radius').value);
    $('cross-rows').innerHTML=selected.slice(0,shown).map(p=>`<tr><th scope="row"><button type="button" data-cross-station="${esc(p.id)}">${esc(p.name)}</button><small>${esc(p.district)} · ${esc(p.address)}</small></th><td>${p.events===null?'未配對／未知':n(p.events)}<small>借還端點事件</small></td><td>${n(Math.round(p.nearestBin.distanceM))} 公尺<small>${esc(p.nearestBin.address)}</small></td><td>${p.buses.length} 個站位<small>300 公尺內；非上下車人數</small></td><td>${esc(reason(p,radius))}<small>站外人流與垃圾需求待驗證</small></td></tr>`).join('');
    $('cross-more').hidden=shown>=selected.length;
    $('cross-rows').querySelectorAll('[data-cross-station]').forEach(button=>button.addEventListener('click',()=>{focus(selected.find(p=>p.id===button.dataset.crossStation));map.getContainer().scrollIntoView({block:'center',behavior:'instant'});}));
  }
  function renderComparison(scoped,radius,state){
    const summary=summarizeComparison(data,scoped,radius);
    const rounded=value=>n(Math.round(value));
    const max=summary.ranked[0]?.eventsPerBin||1;
    const values=summary.ranked.map(p=>p.eventsPerBin).sort((a,b)=>a-b),mid=Math.floor(values.length/2);
    const median=values.length?(values.length%2?values[mid]:(values[mid-1]+values[mid])/2):null;
    $('cross-comparison-title').textContent=`${radius} 公尺內，活動量與清冊桶位怎麼對照？`;
    $('cross-ratio-note').textContent=`${scoped.length} 個範圍內站點中，${summary.ranked.length} 站可計算，${summary.zero.length} 站周邊未見清冊桶位，${summary.unknown} 站活動量未知。以七月保留 29 日的日均借還端點事件 ÷ 半徑內清冊桶位數；同座標合併。${median===null?'':`可計算站的中位數為 ${rounded(median)}、最高 ${rounded(max)} 次／日／桶位。`}這是配置查核指標，不能當成人均服務量或桶的實際負荷。`;
    $('cross-ratio-chart').innerHTML=summary.ranked.slice(0,10).map(p=>`<li><button type="button" data-comparison-station="${esc(p.id)}">${esc(p.name)}<small>${esc(p.district)} · ${rounded(p.dailyEvents)} 次／日 · ${p.binCount} 個清冊桶位</small></button><span class="cross-bar-track" aria-hidden="true"><span style="width:${100*p.eventsPerBin/max}%"></span></span><strong>${rounded(p.eventsPerBin)}<small>次／日／桶位</small></strong></li>`).join('')||'<li>目前沒有可計算的站點；周邊零桶位與活動量未知另列。</li>';
    $('cross-zero-note').textContent=`${summary.zero.length} 站周邊未見清冊桶位，先按已觀測活動量列前 5 站。零桶位不計比值，也不能當成現場無桶。`;
    $('cross-zero-list').innerHTML=summary.zero.slice(0,5).map(p=>`<li><button type="button" data-comparison-station="${esc(p.id)}">${esc(p.name)}</button> · ${esc(p.district)} · ${rounded(p.events/data.meta.activityDays)} 次／日 · 最近清冊桶位 ${rounded(p.nearestBin.distanceM)} 公尺</li>`).join('');
    $('cross-bus-summary').textContent=summary.busPercent===null?'目前範圍沒有保留公車站位，比例無法計算。':`${summary.busUncovered}／${summary.busTotal} 個公車站位（${summary.busPercent.toFixed(1)}%），${radius} 公尺內未見清冊桶位。`;
    const areas=[...new Set(scoped.map(p=>p.district))];
    const byArea=areas.map(area=>({area,...summarizeComparison(data,scoped.filter(p=>p.district===area),radius)}))
      .sort((a,b)=>(b.busPercent??-1)-(a.busPercent??-1)||a.area.localeCompare(b.area));
    $('cross-bus-areas').innerHTML=byArea.map(p=>`<tr><th scope="row">${esc(p.area)}站點周邊${!baseline.districts[p.area]||p.area==='南港區'?'<small>清冊覆蓋須先補查</small>':''}</th><td>${p.busUncovered}／${p.busTotal}</td><td>${p.busPercent===null?'無法計算':p.busPercent.toFixed(1)+'%'}</td></tr>`).join('');
    const profiles=Object.entries(data.areaProfiles).filter(([area])=>!state.district||area===state.district);
    $('cross-time-scope').textContent=`${state.district||'各區及臺大校區'}全區 YouBike 彙總；不隨站名搜尋或候選模式篩選。七月排除 7/10、7/11 後，以 22 個平日、7 個週末日平均；週末不等於全部國定假日。`;
    $('cross-time-rows').innerHTML=profiles.map(([area,p])=>`<tr><th scope="row">${esc(area)}</th><td>${rounded(p.weekday.dailyEvents)}／${rounded(p.weekend.dailyEvents)}</td><td>${p.weekday.dailyEvents?(p.weekend.dailyEvents/p.weekday.dailyEvents).toFixed(2):'無法計算'}</td><td>${p.weekday.peakHour}–${p.weekday.peakHour+1} 時／${p.weekend.peakHour}–${p.weekend.peakHour+1} 時</td></tr>`).join('');
    $('cross-comparison').querySelectorAll('[data-comparison-station]').forEach(button=>button.addEventListener('click',()=>{
      focus(scoped.find(p=>p.id===button.dataset.comparisonStation));map.getContainer().scrollIntoView({block:'center',behavior:'instant'});
    }));
  }
  function focusMrt(p){
    linkLayer.clearLayers();
    const radius=Number($('cross-radius').value),bin=p.nearestBin;
    for(const e of p.exitLocations)L.circle([e.y,e.x],{radius,color:'#16566a',weight:1,fillOpacity:.05}).bindPopup(esc(e.name)).addTo(linkLayer);
    L.circleMarker([bin.y,bin.x],{radius:9,color:'#244d43',fillOpacity:.5}).bindPopup(`最近清冊桶位：${esc(bin.address)}`).addTo(linkLayer);
    const nearby=data.stations.filter(b=>p.bikeIds.includes(b.id));
    for(const b of nearby)L.circleMarker([b.y,b.x],{radius:4,color:'#16566a'}).bindPopup(`YouBike ${esc(b.name)}`).addTo(linkLayer);
    for(const id of p.busIds){const b=busById.get(id);L.circleMarker([b.y,b.x],{radius:4,color:'#bd5c16'}).bindPopup(`公車 ${esc(b.name)}：距清冊桶位 ${n(Math.round(b.nearestBin.distanceM))} 公尺`).addTo(linkLayer);}
    map.fitBounds(p.exitLocations.map(e=>[e.y,e.x]),{padding:[70,70],maxZoom:16,animate:false});
    const peak=p.hourly.indexOf(Math.max(...p.hourly));
    $('cross-detail').hidden=false;
    $('cross-detail').innerHTML=`<h4>${esc(p.name)}：按出口逐段查核</h4><p>${p.exitLocations.length} 個來源出口，日均進出站 ${n(Math.round(p.daily))} 人次；出口 ${radius} 公尺聯集內 ${p.binCount} 個清冊桶位。最近桶位 ${esc(bin.address)}，距任一出口最短 ${n(Math.round(bin.distanceM))} 公尺。</p><p>周邊 ${p.bikeIds.length} 個 YouBike 站、${p.busIds.length} 個公車站位；公車中 ${p.busUncovered} 個在 ${radius} 公尺內未見清冊桶位。捷運進站紀錄尖峰 ${peak}–${peak+1} 時，可作初始觀察線索；實際時段依本站活動、投放與清運紀錄調整。</p><p>先核對各出口方向、轉乘動線、清冊漏列、站內外替代桶位與桶況；整站流量不能證明每個出口同樣繁忙。全市陳情未定位到此站，不能當作本站問題證據。</p>`;
    map.getContainer().scrollIntoView({block:'center',behavior:'instant'});
  }
  function renderMrt(state,radius){
    const transport=data.transport,scope=selectMrtStations(data,state),summary=summarizeMrt(data,scope,radius);
    $('cross-mrt-scope').textContent=`本次配對 ${transport.stations.length} 站：至少一個出口在臺北 YouBike 站 300 公尺內；不是行政界線。上方行政區依周邊 YouBike 所屬區篩選，搜尋涵蓋捷運站名與周邊 YouBike 站名／地址。目前 ${scope.length} 站，${summary.ranked.length} 站可計比值、${summary.zero.length} 站周邊零清冊桶位。出口名錄 ${transport.meta.outsideScope.length} 站在範圍外；範圍內 ${transport.meta.unmatchedInScope.join('、')||'無'} 未配對七月流量，另列未知。`;
    const top=summary.ranked[0],zero=summary.zero[0];
    $('cross-mrt-finding').textContent=top?`${top.name}：日均 ${n(Math.round(top.daily))} 進出站人次，出口 ${radius} 公尺內 ${top.binCount} 個桶位，約 ${n(Math.round(top.ratio))} 人次／日／桶位。附近 YouBike 日均 ${n(Math.round(top.bikeDaily))} 次已觀測事件、公車 ${top.busUncovered}／${top.busIds.length} 站位未見桶位，值得逐出口核對轉乘路徑與配置。${zero?`${zero.name}則日均 ${n(Math.round(zero.daily))} 人次、周邊未配到桶位，須先確認清冊及現場。`:''}`:scope.length?'目前範圍的車站周邊都未配到清冊桶位；先核對資料覆蓋，不能用零桶位算負荷。':'目前篩選沒有配對捷運站。';
    $('cross-mrt-rows').innerHTML=summary.ranked.slice(0,10).map(p=>`<tr><th scope="row"><button type="button" data-mrt="${esc(p.id)}">${esc(p.name)}</button><small>${p.exitLocations.length} 個出口</small></th><td>${n(Math.round(p.daily))}</td><td>${p.binCount}</td><td>${n(Math.round(p.ratio))}</td><td>${n(Math.round(p.bikeDaily))}<small>${p.bikeIds.length} 站；${p.bikeUnknown} 站活動未知</small></td><td>${p.busUncovered}／${p.busIds.length}</td></tr>`).join('')||'<tr><td colspan="6">沒有可計比值的站點。</td></tr>';
    $('cross-mrt-zero').innerHTML=summary.zero.slice(0,10).map(p=>`<li><button type="button" data-mrt="${esc(p.id)}">${esc(p.name)}</button>：日均 ${n(Math.round(p.daily))} 人次 · ${p.bikeIds.length} 個 YouBike 站 · ${p.busIds.length} 個公車站位 · 最近清冊桶位 ${n(Math.round(p.nearestBin.distanceM))} 公尺</li>`).join('')||'<li>目前範圍沒有零桶位站。</li>';
    $('cross-mrt').querySelectorAll('[data-mrt]').forEach(button=>button.addEventListener('click',()=>focusMrt([...summary.ranked,...summary.zero].find(p=>p.id===button.dataset.mrt))));
  }
  function renderHourly(){
    const kind=$('cross-day-type').value,series=hourlySeries(data,kind),days=kind==='weekday'?22:kind==='weekend'?7:29;
    const hour=p=>p.peaks.map(h=>`${h}–${h+1} 時`).join('、');
    const max=Math.max(...series.flatMap(p=>p.shares));
    $('cross-hourly-finding').textContent=`${days} 日觀測：捷運進站紀錄與 YouBike 尖峰分別為 ${hour(series[0])}、${hour(series[1])}；路面清潔陳情 ${n(series[2].total)} 件，尖峰 ${hour(series[2])}；垃圾車服務陳情 ${n(series[3].total)} 件，尖峰 ${hour(series[3])}。這些分布可作初始觀察假設；實際時段依場址活動、投放及清運紀錄調整，陳情受理尖峰不直接指定現場時段。`;
    $('cross-hourly-charts').innerHTML=series.map((p,i)=>`<section><h4>${esc(p.name)}</h4><p>共 ${n(p.total)} ${p.unit} · 日均 ${n(Math.round(p.total/days))} · 尖峰 ${hour(p)}</p><div class="cross-hour-bars" role="img" aria-label="${esc(p.name)}各小時占比；最高 ${Math.max(...p.shares).toFixed(1)}%，尖峰 ${hour(p)}。完整數值見下表。">${p.values.map((v,h)=>`<span class="cross-hour-slot" title="${h}–${h+1} 時：${p.missing.includes(h)?'來源未提供':n(v)+' '+p.unit+'，'+p.shares[h].toFixed(2)+'%'}"><i class="${p.missing.includes(h)?'cross-hour-missing':''}" style="height:${p.missing.includes(h)?4:100*p.shares[h]/max}%"></i><small>${h%3===0?h:''}</small></span>`).join('')}</div></section>`).join('');
    $('cross-hour-head').innerHTML=`<tr><th scope="col">時段</th>${series.map(p=>`<th scope="col">${esc(p.name)}<small>數量／占比</small></th>`).join('')}</tr>`;
    $('cross-hour-rows').innerHTML=Array.from({length:24},(_,h)=>`<tr><th scope="row">${h}–${h+1}</th>${series.map(p=>`<td>${p.missing.includes(h)?'未提供':n(p.values[h])+'／'+p.shares[h].toFixed(2)+'%'}</td>`).join('')}</tr>`).join('');
    const c=data.transport.complaints,groups=Object.values(c.groups);
    $('cross-complaint-audit').textContent=`來源檔 ${n(c.sourceRows)} 列、${n(c.uniqueCases)} 個不同案件編號，其中 ${c.outsideMonth} 件受理日期不在七月。路面清潔：${groups[0].sourceRows} 列，扣除跨月 ${groups[0].outsideMonth} 件與排除日 ${groups[0].excludedDays} 件後 ${groups[0].hourly.reduce((a,b)=>a+b,0)} 件；垃圾車服務同樣為 ${groups[1].sourceRows} − ${groups[1].outsideMonth} − ${groups[1].excludedDays} = ${groups[1].hourly.reduce((a,b)=>a+b,0)} 件。保留整月敏感度：兩類全月受理分別 ${groups[0].fullMonthHourly.reduce((a,b)=>a+b,0)}／${groups[1].fullMonthHourly.reduce((a,b)=>a+b,0)} 件，尖峰分別 ${groups[0].fullMonthHourly.indexOf(Math.max(...groups[0].fullMonthHourly))}／${groups[1].fullMonthHourly.indexOf(Math.max(...groups[1].fullMonthHourly))} 時。`;
    const m=data.transport.meta;
    $('cross-transport-sources').innerHTML=`來源：<a href="${esc(m.odSource)}" target="_blank" rel="noopener noreferrer">捷運逐時 OD（2026/07）</a>、<a href="${esc(m.exitSource)}" target="_blank" rel="noopener noreferrer">出入口座標（2026/08 更新）</a>、<a href="${esc(m.complaintSource)}" target="_blank" rel="noopener noreferrer">陳情類別明細（11507）</a>。圖高統一使用各序列自身總量占比，四圖共用 0–${max.toFixed(1)}% 尺度；不能以圖高比較人次與案件的絕對數量。原始檔及重算紀錄保留在本機。`;
  }
  function update(){
    bikeLayer.clearLayers();busLayer.clearLayers();linkLayer.clearLayers();markers.clear();busIds.clear();shown=30;
    $('cross-detail').hidden=true;
    const state=getState(),active=state.year===meta.binKey;
    $('cross-mrt').hidden=!active;$('cross-hourly').hidden=!active;$('cross-content').hidden=!active;$('cross-comparison').hidden=!active;$('cross-results').hidden=!active;$('cross-start').hidden=active;
    $('cross-status').textContent=active?'已使用 2026 官方主檔交叉比對。':'歷史版本只供查核舊位置。按「比對 2026 固定主檔」切換至 2026 主檔。';
    if(!active)return;
    const radius=Number($('cross-radius').value),mode=$('cross-mode').value;
    const scoped=selectStations(data,{...state,radius,mode:'all'});
    selected=selectStations(data,{...state,radius,mode});
    const priorities=selectStations(data,{...state,radius,mode:'priority'});
    renderComparison(scoped,radius,state);
    renderMrt(state,radius);
    $('cross-summary').textContent=`目前範圍 ${n(scoped.length)} 站中，${n(priorities.length)} 站同時符合「高 YouBike 活動、距清冊桶位超過 ${radius} 公尺、300 公尺內有公車站位」。這些是初始配置比較的候選參考，後續依現場證據調整，不是固定出勤或設桶安排；尚不能據此判定缺桶。${selected.length?'下表按活動量排序。':'目前沒有符合條件的站點，可切換全部站點或清除搜尋。'}`;
    busIds=new Set();
    for(const p of selected){
      p.buses.forEach(b=>busIds.add(b.id));
      if(!$('cross-bikes').checked)continue;
      const marker=L.circleMarker([p.y,p.x],{radius:p.events!==null&&p.events>=meta.highActivityThreshold?7:4,color:'#16566a',weight:2,fillColor:'#e2eff3',fillOpacity:.85})
        .bindPopup(`${esc(p.name)}<br>${p.events===null?'活動量未知':n(p.events)+' 次借還端點事件'}<br>距最近清冊桶位 ${n(Math.round(p.nearestBin.distanceM))} 公尺`).addTo(bikeLayer);
      marker.on('click',()=>focus(p));markers.set(p.id,marker);
    }
    renderBuses();
    renderRows();
  }
  function renderBuses(){
    busLayer.clearLayers();
    if(map.getZoom()<14)return;
    if($('cross-buses').checked)for(const id of busIds){
      const b=busById.get(id);
      const icon=L.divIcon({className:'cross-bus-marker',html:'<span aria-hidden="true"></span>',iconSize:[14,14],iconAnchor:[7,7]});
      L.marker([b.y,b.x],{icon,title:`公車 ${b.name}`,keyboard:true}).bindPopup(`公車 ${esc(b.name)}<br>${b.routeCount} 條路線（不是班次或人次）<br>距最近清冊桶位 ${n(Math.round(b.nearestBin.distanceM))} 公尺<br>${esc(b.nearestBin.address)}`).addTo(busLayer);
    }
  }
  map.on('zoomend',renderBuses);
  for(const id of ['cross-radius','cross-mode','cross-bikes','cross-buses'])$(id).addEventListener('change',update);
  $('cross-more').addEventListener('click',()=>{shown+=30;renderRows()});
  $('cross-day-type').addEventListener('change',renderHourly);
  renderHourly();
  update();
  return {update};
}
