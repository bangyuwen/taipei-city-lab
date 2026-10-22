import {activityStyle,selectActivityStations,activitySummary} from './hotspot-utils.js';
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('zh-TW').format(n);
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
export async function initializeHotspots() {
  const response=await fetch('./data/activity-hotspots.json');
  if(!response.ok)throw Error('Activity data unavailable');
  const data=await response.json();
  let map,L,activityLayer,streetLayer,venueLayer,tiles,selectedId=null,shown=8,hasFit=false;
  const markers=new Map();
  const state={area:'',query:''};
  $('hotspot-controls').hidden=false;
  for(const area of data.meta.areas){const option=el('option',area);option.value=area;$('hotspot-area').append(option);}
  function resizeMarkers() {
    if(!map)return;
    const zoom=map.getZoom();
    for(const s of data.stations){
      const marker=markers.get(s.id);if(!marker)continue;
      const style=activityStyle(s.events,zoom);
      marker.setRadius(style.radius).setStyle({...style,weight:s.id===selectedId?1.5:style.weight});
    }
    streetLayer.eachLayer(marker=>marker.setRadius(Math.min(3,Math.max(1.25,1.25+(zoom-11)*.3))));
    venueLayer.eachLayer(marker=>marker.setRadius(Math.min(4,Math.max(1.75,1.75+(zoom-11)*.4))));
  }
  function detail(s) {
    selectedId=s.id;
    const section=$('hotspot-selection');section.replaceChildren();
    section.append(el('h4',s.name),el('p',s.area+' · '+s.address,'hotspot-address'));
    const activity=s.events===null?'未匹配到觀測紀錄：活動量未知，不是零活動。':`已觀測借還端點 ${fmt(s.events)} 次：借出 ${fmt(s.borrow)} 次、歸還 ${fmt(s.returns)} 次。不是獨立人數。`;
    section.append(el('p',activity,'hotspot-selected-value'));
    const dl=el('dl');
    for(const [label,record] of [['最近街道清冊紀錄',s.street],['最近場所線索',s.venue]]){
      const row=el('div');row.append(el('dt',label),el('dd',`${record.name}（${record.area}），直線約 ${fmt(Math.round(record.distance))} 公尺。`));dl.append(row);
    }
    section.append(dl,el('p','距離是保存座標間的直線，不是步行路線；最近一筆也不代表可使用或有足夠服務。','hotspot-note'));
    const link=el('a','查看會影響決定的查核疑點');link.href='#plan-checks-heading';section.append(link);section.hidden=false;
    resizeMarkers();
  }
  function focus(s) {
    detail(s);if(map){map.setView([s.lat,s.lon],16,{animate:false});markers.get(s.id)?.openPopup();}
    $('hotspot-selection').focus({preventScroll:true});$('hotspot-selection').scrollIntoView({block:'nearest',behavior:'instant'});
  }
  function drawList(rows) {
    const list=$('hotspot-ranking');list.replaceChildren();
    for(const s of rows.slice(0,shown)){
      const item=el('li'),button=el('button');button.type='button';button.dataset.station=s.id;
      button.append(el('span',s.name),el('small',s.area),el('strong',s.events===null?'未知':fmt(s.events)+' 次'));
      button.addEventListener('click',()=>focus(s));item.append(button);list.append(item);
    }
    $('hotspot-more').hidden=shown>=rows.length;
    $('hotspot-empty').hidden=rows.length>0;
  }
  function update({fit=true}={}) {
    const rows=selectActivityStations(data.stations,state),summary=activitySummary(rows);
    $('hotspot-summary').textContent=`${state.area||'全市含校區'}${state.query?' · 搜尋結果':''}：${fmt(summary.count)} 個啟用有效站；${fmt(summary.observed)} 站有觀測、${summary.unknown} 站未知。已觀測借還端點共 ${fmt(summary.events)} 次。`;
    drawList(rows);
    if(selectedId&&!rows.some(s=>s.id===selectedId)){$('hotspot-selection').hidden=true;selectedId=null;}
    if(!map)return;
    activityLayer.clearLayers();markers.clear();
    // Larger stations are added last so small low-activity circles do not cover them.
    for(const s of [...rows].reverse()){
      const marker=L.circleMarker([s.lat,s.lon],{pane:'activity',...activityStyle(s.events,map.getZoom())});
      const popup=el('div');popup.append(el('strong',s.name),el('p',s.events===null?'借還活動未知':`借還端點 ${fmt(s.events)} 次`));
      const button=el('button','查看活動與附近設施');button.type='button';button.addEventListener('click',()=>focus(s));popup.append(button);
      marker.bindPopup(popup);marker.on('click',()=>detail(s));marker.addTo(activityLayer);markers.set(s.id,marker);
      if(selectedId===s.id)marker.setStyle({weight:1.5});
    }
    if(fit&&rows.length&&map.getContainer().clientWidth){map.fitBounds(rows.map(s=>[s.lat,s.lon]),{padding:[24,24],maxZoom:15,animate:false});hasFit=true;}
    resizeMarkers();
  }
  function facilityPopup(p,kind) {
    const box=el('div');box.append(el('strong',p.name),el('p',p.area+' · '+kind));
    if(p.remark)box.append(el('p','官方原表備註：'+p.remark));
    box.append(el('p','保存清冊線索；位置、收受及現場可用性仍待確認。'));return box;
  }
  function toggleLayers(){
    if(!map)return;
    for(const [id,layer] of [['hotspot-street',streetLayer],['hotspot-venues',venueLayer]]){
      if($(id).checked)layer.addTo(map);else map.removeLayer(layer);
    }
  }
  async function startMap(){
    try{
      L=await import('./vendor/leaflet/leaflet-src.esm.js');
      map=L.map('hotspot-map',{preferCanvas:true,scrollWheelZoom:false}).setView([25.06,121.54],12);
      map.createPane('activity');map.getPane('activity').style.zIndex=410;
      map.createPane('facilities');map.getPane('facilities').style.zIndex=420;
      activityLayer=L.layerGroup().addTo(map);streetLayer=L.layerGroup();venueLayer=L.layerGroup();
      map.on('zoomend',resizeMarkers);
      // Facilities stay citywide so nearby cross-district records are not hidden by an area filter.
      for(const p of data.street)L.circleMarker([p.lat,p.lon],{pane:'facilities',radius:3,color:'#14526c',fillColor:'#14526c',fillOpacity:1,weight:.6}).bindPopup(facilityPopup(p,'街道清冊紀錄')).addTo(streetLayer);
      for(const p of data.venues)L.circleMarker([p.lat,p.lon],{pane:'facilities',radius:5,color:'#365a58',fillColor:'#ffffff',fillOpacity:1,weight:1}).bindPopup(facilityPopup(p,'場所線索；非逐桶位置')).addTo(venueLayer);
      tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,keepBuffer:1,updateWhenIdle:true,opacity:.65,
        attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map);
      let failed=false;
      tiles.on('tileerror',()=>{failed=true;$('hotspot-map-status').textContent='道路底圖暫時無法完整載入；站點與清冊座標仍可查看，勿據此判讀實際路線。';});
      tiles.on('load',()=>{if(!failed)$('hotspot-map-status').textContent='';});
      $('hotspot-street').disabled=false;$('hotspot-venues').disabled=false;
      toggleLayers();requestAnimationFrame(()=>{map.invalidateSize({pan:false});update();});
    }catch{
      $('hotspot-map-status').textContent='互動地圖暫時無法載入；下方站點清單與數值仍可查閱。';
      $('hotspot-map').hidden=true;
    }
  }
  $('hotspot-area').addEventListener('change',()=>{state.area=$('hotspot-area').value;shown=8;update();});
  $('hotspot-search').addEventListener('input',()=>{state.query=$('hotspot-search').value;shown=8;update();});
  $('hotspot-reset').addEventListener('click',()=>{state.area='';state.query='';selectedId=null;shown=8;$('hotspot-area').value='';$('hotspot-search').value='';$('hotspot-selection').hidden=true;update();});
  $('hotspot-street').addEventListener('change',toggleLayers);$('hotspot-venues').addEventListener('change',toggleLayers);
  $('hotspot-more').addEventListener('click',()=>{shown+=8;drawList(selectActivityStations(data.stations,state));});
  update();await startMap();
  $('hotspot-status').hidden=true;
  return {setActive(active){if(active&&map)requestAnimationFrame(()=>{map.invalidateSize({pan:false});if(!hasFit)update();});}};
}
