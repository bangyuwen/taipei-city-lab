import * as L from './vendor/leaflet/leaflet-src.esm.js';
import {mapSpec,mapPointIndex} from './map-data.js';
import {TILE_PROVIDER} from './geo.js';

const LifecycleCanvas=L.Canvas.extend({
  _redraw(){
    // Leaflet 1.9.4 may enqueue another redraw while map layers are removed.
    if(!this._ctx){this._redrawRequest=null;return;}
    L.Canvas.prototype._redraw.call(this);
  },
});

export function mountMap(host,payload,actions={}){
  host.innerHTML=`<div class="geo-heading"><div><span class="geo-kicker">地理位置 / OPENSTREETMAP</span><h2 id="geo-title">街道底圖與方案位置</h2></div><button id="geo-reset" class="outline-button">全域</button></div><div class="street-map" role="region" aria-label="可縮放與平移的街道地圖"></div><div class="geo-options"><div id="geo-layers"></div><div id="geo-comparison"></div><div class="geo-select"><label for="geo-pick">選取候選／個案</label><select id="geo-pick"></select><button id="geo-focus" class="outline-button">地圖聚焦</button><button id="geo-3d" class="primary-button">3D 聚焦</button></div></div><div class="geo-readout"><p id="geo-details" aria-live="polite"></p><p id="geo-status" role="status">載入街道底圖…</p><p id="geo-note"></p><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">回報底圖問題 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-9 9M19 14v5H5V5h5"/></svg></a></div>`;
  const $=selector=>host.querySelector(selector),container=$('.street-map');
  const map=L.map(container,{preferCanvas:true,renderer:new LifecycleCanvas(),zoomControl:true,minZoom:11,maxZoom:19});
  const tiles=L.tileLayer(TILE_PROVIDER.url,{maxZoom:TILE_PROVIDER.maxZoom,keepBuffer:0,updateWhenIdle:true,detectRetina:false,
    attribution:`© <a href="${TILE_PROVIDER.copyright}" target="_blank" rel="noopener">OpenStreetMap</a> contributors`}).addTo(map);
  L.control.scale({imperial:false}).addTo(map);
  let spec,index,disposed=false,planned=true,groups={},demandMarkers=[],flags={},highlight=null,scope=null,tileFailures=0;
  const defaults={existing:true,demand:false,candidates:false,selected:true,coverage:true,existingCoverage:false};
  const names={existing:'既有快照',demand:'合成需求',candidates:'候選',selected:'推薦',coverage:'推薦範圍',existingCoverage:'既有範圍'};
  const colors={existing:'#236749',demand:'#557ca4',candidates:'#737d79',selected:'#b67608'};
  const recordElement=(point,withAction=true)=>{
    const box=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('p');
    title.textContent=point.label||point.id;
    detail.textContent=`${point.provenance} · 緯度 ${point.lat.toFixed(6)}／經度 ${point.lng.toFixed(6)}${point.detail?' · '+point.detail:''}`;
    box.append(title,detail);
    if(withAction){const button=document.createElement('button');button.className='primary-button';button.textContent='在 3D 聚焦';button.onclick=()=>actions.onFocus?.(point);box.append(button);}
    return box;
  };
  function select(id,{pan=false,emit=false}={}){
    const point=index.get(String(id));if(!point||disposed)return;
    highlight?.remove();highlight=L.circleMarker([point.lat,point.lng],{radius:11,color:'#352f23',weight:3,fill:false,interactive:false}).addTo(map);
    $('#geo-details').textContent=`${point.label||point.id} · ${point.provenance} · ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
    if(spec.focus.some(p=>p.id===point.id))$('#geo-pick').value=String(point.id);
    if(pan)map.setView([point.lat,point.lng],Math.max(map.getZoom(),16),{animate:false});
    L.popup({maxWidth:300,autoPan:pan}).setLatLng([point.lat,point.lng]).setContent(recordElement(point)).openOn(map);
    if(emit)actions.onSelect?.(point);
  }
  function marker(point,kind){
    const value=L.circleMarker([point.lat,point.lng],{radius:kind==='selected'?7:kind==='existing'?3:kind==='demand'?3:4,
      color:colors[kind],fillColor:colors[kind],weight:kind==='selected'?2:1,fillOpacity:kind==='selected' ? .9 : .6,
      dashArray:kind==='candidates'?'2 2':null});
    const tooltip=document.createElement('span');tooltip.textContent=(point.label||point.id)+' · '+point.provenance;
    if(kind==='demand')demandMarkers.push({point,marker:value});
    value.bindTooltip(tooltip);value.on('click',()=>select(point.id,{emit:true}));return value;
  }
  function setPlanned(value){planned=Boolean(value);for(const b of $('#geo-comparison').children)b.setAttribute('aria-pressed',String(b.dataset.planned===String(planned)));apply();}
  function apply(){
    for(const {point,marker} of demandMarkers){const color=point.baseline?colors.existing:planned&&point.planned?colors.selected:colors.demand;marker.setStyle({color,fillColor:color});}
    for(const [name,g] of Object.entries(groups)){
      const enabled=flags[name]&&(name!=='selected'&&name!=='coverage'||planned);
      if(enabled&&!map.hasLayer(g))g.addTo(map);if(!enabled&&map.hasLayer(g))g.remove();
    }
  }
  function buildLayers(){
    for(const g of Object.values(groups))g.remove();groups={};demandMarkers=[];
    for(const name of Object.keys(defaults))groups[name]=L.layerGroup();
    for(const name of ['existing','demand','candidates','selected'])for(const point of spec[name])marker(point,name).addTo(groups[name]);
    if(spec.newRadius>0)for(const p of spec.selected)L.circle([p.lat,p.lng],{radius:spec.newRadius,color:colors.selected,weight:1,fillOpacity:.07,interactive:false}).addTo(groups.coverage);
    if(spec.radius>0)for(const p of spec.existing)L.circle([p.lat,p.lng],{radius:spec.radius,color:colors.existing,weight:.7,fillOpacity:.03,interactive:false}).addTo(groups.existingCoverage);
    apply();
    const options=$('#geo-layers');options.replaceChildren();
    if(spec.kind==='spatial')for(const name of Object.keys(defaults)){
      const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=!!flags[name];
      input.onchange=()=>{flags[name]=input.checked;apply();};label.append(input,document.createTextNode(names[name]));options.append(label);
    }
    const comparison=$('#geo-comparison');comparison.replaceChildren();
    if(['shade','bins'].includes(spec.id))for(const [text,value] of [['既有基準',false],['推薦方案',true]]){
      const button=document.createElement('button');button.className='outline-button';button.textContent=text;button.setAttribute('aria-pressed',String(planned===value));
      button.dataset.planned=String(value);button.onclick=()=>{setPlanned(value);actions.onPlan?.(value);};comparison.append(button);
    }
  }
  function fit(){const [w,s,e,n]=spec.bbox;map.fitBounds([[s,w],[n,e]],{padding:[20,20],animate:false});}
  function update(next){
    const previous=spec?.id,nextSpec=mapSpec(next);if(!nextSpec)throw new Error('此題沒有地理位置可顯示');
    spec=nextSpec;index=mapPointIndex(spec);highlight?.remove();highlight=null;map.closePopup();
    $('#geo-title').textContent=spec.kind==='spatial'?'街道底圖與方案位置':'內湖地理位置參考';$('#geo-note').textContent=spec.note;$('#geo-details').textContent='';
    if(previous!==spec.id){flags={...defaults};planned=true;}if(typeof next.planned==='boolean')planned=next.planned;buildLayers();
    scope?.remove();const [w,s,e,n]=spec.bbox;scope=L.rectangle([[s,w],[n,e]],{color:'#566751',weight:1.5,dashArray:'6 5',fill:false,interactive:false}).addTo(map);
    map.setMaxBounds(L.latLngBounds([[s,w],[n,e]]).pad(1));if(previous!==spec.id)fit();
    const selectNode=$('#geo-pick');selectNode.replaceChildren();
    for(const p of spec.focus){const option=document.createElement('option');option.value=String(p.id);option.textContent=(p.selected?'推薦 · ':'')+(p.label||p.id);selectNode.append(option);}
    $('.geo-select').hidden=!spec.focus.length;map.invalidateSize({animate:false});
  }
  tiles.on('loading',()=>{tileFailures=0;});
  tiles.on('tileerror',()=>{tileFailures++;if(!disposed)$('#geo-status').textContent='部分底圖未載入；標記與模型仍可查看，可稍後重新整理。';});
  tiles.on('load',()=>{if(!disposed)$('#geo-status').textContent=tileFailures?'部分底圖未載入；標記與模型仍可查看，可稍後重新整理。':'OpenStreetMap 街道底圖 · 即時載入，不代表設施快照的調查日期。';});
  $('#geo-reset').onclick=fit;
  $('#geo-pick').onchange=e=>select(e.target.value,{emit:true});
  $('#geo-focus').onclick=()=>select($('#geo-pick').value,{pan:true,emit:true});
  $('#geo-3d').onclick=()=>{const p=index.get($('#geo-pick').value);if(p)actions.onFocus?.(p);};
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(!disposed)map.invalidateSize({animate:false});}):null;observer?.observe(container);
  function dispose(){if(disposed)return;disposed=true;observer?.disconnect();tiles.off();map.remove();host.innerHTML='';}
  try{update(payload);}catch(error){dispose();throw error;}
  return {update,select,dispose,setPlanned};
}
