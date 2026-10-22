// ===== 有桶・設計共用（design-owned；common.js 由工程維護，這裡只做視覺層）=====
// 滿度色階：一條固定冷→暖色階，三個角色頁面共用（值見 tokens.css）
const RAMP={low:'#8cc9a8',mid:'#e8b931',high:'#d9731f',over:'#d9731f'};
const REPORTED='#e2574c'; // 只用於「被回報滿了」
// 地圖不再有「溢出」狀態：<70% low、70–99% mid、≥100% high；over 參數保留相容但忽略。RAMP.over 只給收運量按鈕等非地圖用途。
const rampColor=(f,over)=>f>=100?RAMP.high:f>=70?RAMP.mid:RAMP.low;
// 對使用者只顯示 4 種狀態字，不顯示 %（門檻只在內部）
const STATE_LABEL={low:'還有空間',mid:'快滿了',high:'滿溢',reported:'已回報滿'};
const rampState=(f,reported)=>{const k=reported?'reported':f>=100?'high':f>=70?'mid':'low';return{k,t:STATE_LABEL[k],c:k==='reported'?REPORTED:RAMP[k]}};
const stateChip=(f,reported,sim)=>{const s=rampState(f,reported);return `<span class="stchip st-${s.k}"><i style="background:${s.c}"></i>${s.t}${sim?'<span class="sim" title="模擬值"></span>':''}</span>`};
const rampLabel=(f,over)=>f>=100?'已滿':f>=70?'將滿':'尚有空間';
// 安靜底圖：OSM 圖磚＋CSS 去飽和（CARTO 需 API key）
function quietMap(center,zoom,opt={}){
  const m=L.map('map',{zoomControl:false,preferCanvas:true,...opt}).setView(center,zoom);
  m.attributionControl.setPrefix(false);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
  document.getElementById('map').classList.add('quiet');return m}
// 精簡圖例：items=[{c:顏色,t:文字,shape:'dot'|'line'|'ring'|'diamond'|'html',html}]
function legend(map,items,pos='bottomleft'){
  const C=L.control({position:pos});C.onAdd=()=>{const d=L.DomUtil.create('div','lgd');
    d.innerHTML=items.map(i=>`<span>${i.html||`<i class="${i.shape||'dot'}" style="--c:${i.c}"></i>`}${i.t}</span>`).join('');
    L.DomEvent.disableClickPropagation(d);return d};C.addTo(map);return C}
// 底部抽屜（sheet）：開/關；點背景關閉
function sheetOpen(id){const s=document.getElementById(id);s.hidden=false;s.onclick=e=>{if(e.target===s)s.hidden=true};s.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>s.hidden=true)}
const RAMP_LEGEND=[{c:RAMP.low,t:STATE_LABEL.low},{c:RAMP.mid,t:STATE_LABEL.mid},{c:RAMP.high,t:STATE_LABEL.high+'（估計）'}];
const REPORTED_LEGEND={c:REPORTED,t:'紅色＝已被回報滿了'};
// 角色切換（示範導覽）：常駐分段控制「行人｜清潔隊｜設點規劃」；host 給定時放進該容器，否則固定在左上
const ROLES=[['pedestrian.html','行人'],['crew.html','清潔隊'],['planning.html','設點規劃']];
function roleSwitch(active,host){const n=document.createElement('nav');n.className='roles'+(host?'':' fixed');n.setAttribute('aria-label','切換角色（示範導覽）');
  n.innerHTML='<a class="wm" href="../" aria-label="返回網站首頁"><img src="assets/logo.svg?v=20261021h" alt="有桶" width="40" height="40"></a><span class="seg3">'+ROLES.map(r=>`<a href="${r[0]}"${r[0]===active?' class="on" aria-current="page"':''}>${r[1]}</a>`).join('')+'</span>';
  n.insertAdjacentHTML('beforeend','<span class="demo-note">本機示範・不會通知機關 <a href="../research/">研究與證據</a></span>');
  host?host.prepend(n):document.body.appendChild(n);
  const size=()=>{const bottom=n.getBoundingClientRect().bottom;document.documentElement.style.setProperty('--demo-header-bottom',bottom+'px');document.documentElement.style.setProperty('--row2',(bottom+8)+'px')};
  new ResizeObserver(size).observe(n);size();return n}
// 圖例：完整版放在「資料說明」抽屜頂端；地圖上只留一行提示
const legendHTML=items=>`<div class="lgd static">${items.map(i=>`<span>${i.html||`<i class="${i.shape||'dot'}" style="--c:${i.c}"></i>`}${i.t}</span>`).join('')}</div>`;
function legendIntoSheet(sheetId,items){const sh=document.querySelector('#'+sheetId+' .sh'),hd=sh&&sh.querySelector('.hd');if(!hd)return;
  const d=document.createElement('div');d.innerHTML='<h3>圖例</h3>'+legendHTML(items);hd.after(...d.childNodes)}
const REPORTED_HINT=()=>[{html:`<i style="--c:${REPORTED}"></i>`,t:'已回報滿'}];
// 上方浮動 UI 的底部位置（地圖 padding 用，確保最近的桶與光圈不被遮住）
function topUIBottom(){let b=0;document.querySelectorAll('.roles,.top>*,.infochip,.leaflet-top .lgd,.prog,.tchip').forEach(e=>{const r=e.getBoundingClientRect();if(r.height&&r.bottom<innerHeight/2)b=Math.max(b,r.bottom)});return b}

// 交通站點標記（無外框實心小圖示，16px，比垃圾桶小，不搶焦點）：YouBike＝赭黃圓底單車、公車站＝石板藍圓角方底公車
const ST_COLOR={yb:'#a07d3e',bus:'#5b6f9c'};
const _stIco={};
function stationIcon(k){if(_stIco[k])return _stIco[k];const c=ST_COLOR[k],s=16;
  const g=k==='yb'?`<circle cx="8" cy="8" r="8" fill="${c}"/><circle cx="5" cy="9.6" r="2.2" fill="none" stroke="#fff" stroke-width="1.3"/><circle cx="11" cy="9.6" r="2.2" fill="none" stroke="#fff" stroke-width="1.3"/><path d="M5 9.6L7.2 6.2H10L11 9.6M7.2 6.2L8.4 9.6" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>`
    :`<rect x="0" y="0" width="16" height="16" rx="4.5" fill="${c}"/><rect x="4" y="3.4" width="8" height="8" rx="1.8" fill="#fff"/><rect x="5.1" y="4.6" width="5.8" height="2.6" rx=".6" fill="${c}"/><rect x="4.8" y="11.6" width="1.8" height="1.6" rx=".6" fill="#fff"/><rect x="9.4" y="11.6" width="1.8" height="1.6" rx=".6" fill="#fff"/>`;
  return _stIco[k]=L.divIcon({className:'stico',iconSize:[s,s],iconAnchor:[s/2,s/2],html:`<svg width="${s}" height="${s}" viewBox="0 0 16 16" aria-hidden="true">${g}</svg>`})}
