// 共用：導覽列、資料、localStorage、距離、填充度
const TPE_MAIN=(window.CONFIG&&CONFIG.fallbackLocation.latlng)||[25.013993,121.535185];
const TPE_NAME=(window.CONFIG&&CONFIG.fallbackLocation.name)||'捷運公館站公車站';
const LS_EVENTS=(window.CONFIG&&CONFIG.storageKeys.events)||KP+'events_v1';
// 共用收合箭頭（行人／清潔隊／設點規劃三頁同一元件）：收合時 ^、展開時 v；點擊範圍 44px 整列
function togHTML(col,id='cardTog',cls='tog'){return `<button class="${cls}" id="${id}" aria-expanded="${!col}" aria-label="${col?'展開卡片':'收合卡片'}"><svg width="20" height="12" viewBox="0 0 20 12"><path d="${col?'M3 9l7-6 7 6':'M3 3l7 6 7-6'}" fill="none" stroke="#9aa0a4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`}
function togSet(b,col){if(!b)return;b.outerHTML=togHTML(col,b.id,b.className)}
function sheet(){ // 手機底部面板：點把手切換大小
  const p=document.querySelector('.panel');if(!p||!p.querySelector('.handle'))return;const h=()=>p.querySelector('.handle');
  // 點把手（或收合時點面板）：收合 ↔ 展開（和行人頁一樣；原本三段循環，第一下是「放大」不是收合）。切換後地圖重新量尺寸
  const tog=()=>{p.classList.remove('exp');p.classList.toggle('min');togSet(h(),p.classList.contains('min'));requestAnimationFrame(()=>{if(typeof map!=='undefined'&&map.invalidateSize){map.invalidateSize();if(typeof window.sheetFit==='function')window.sheetFit()}})};
  p.addEventListener('click',e=>{if(e.target.closest('.handle')){e.stopPropagation();tog();return}if(p.classList.contains('min')&&!e.target.closest('button,a,input,select,label'))tog()});
}
function baseMap(center,zoom){ // 優先使用 ui.js 的去飽和底圖
  if(typeof quietMap==='function'){const m=quietMap(center,zoom);L.control.zoom({position:'topright'}).addTo(m);return m}
  const m=L.map('map',{preferCanvas:true,zoomControl:false}).setView(center,zoom);
  L.control.zoom({position:'topright'}).addTo(m);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
  return m;
}
const loadJSON=n=>fetch(n).then(r=>{if(!r.ok)throw new Error(n+' '+r.status);return r.json()});
function hav(a,b,c,d){const R=6371000,r=x=>x*Math.PI/180;return 2*R*Math.asin(Math.sqrt(Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2))}
const ll=f=>[f.geometry.coordinates[1],f.geometry.coordinates[0]];
const fmtM=m=>m<1000?Math.round(m)+' 公尺':(m/1000).toFixed(1)+' 公里';
const walkMin=m=>Math.max(1,Math.round(m*1.3/80)); // 直線×1.3 繞行係數，步速 80m/分
const gmapWalk=(la,lo)=>`https://www.google.com/maps/dir/?api=1&destination=${la},${lo}&travelmode=walking`;
function toast(t){let e=document.querySelector('.toast');if(!e){e=document.createElement('div');e.className='toast';document.body.appendChild(e)}e.textContent=t;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),2200)}
// 事件：{bin, kind:'full'|'level'|'clear', level(0-100), by:'行人'|'清潔隊', ts}
const getEvents=()=>{try{const v=JSON.parse(localStorage.getItem(LS_EVENTS));return Array.isArray(v)?v.filter(e=>e&&typeof e==='object'&&typeof e.bin==='string'):[]}catch(e){return[]}}; // 舊版／壞掉的存檔不會讓頁面掛掉
// 「這裡需要垃圾桶」民眾回報：本機示範紀錄，不送往機關；本機快取在 localStorage（KP 前綴，見 config.js），重設／?reset=1 只清示範空間，沒有預設資料
const LS_NEEDS=KP+'needs_v1',NEED_DEDUP_M=50;
// 同一瀏覽器跨分頁即時同步（模擬）：只在回報事件或需求回報的鍵改變時呼叫 fn；跨裝置不同步。
// 正在輸入（焦點在 input/textarea/select）時延後到離開輸入框再套用，不打斷使用者
const SYNC_FNS=[];function appSyncNotify(k){SYNC_FNS.forEach(f=>f(k))}
function onAppSync(fn){let pend=false;const busy=()=>{const a=document.activeElement;return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))};
  const run=k=>{if(busy()){pend=k||true;return}pend=false;try{fn(k)}catch(e){console.error('[有桶] 同步失敗',e)}};
  SYNC_FNS.push(run);addEventListener('storage',e=>{if(e.key===LS_EVENTS||e.key===LS_NEEDS)run(e.key)});
  document.addEventListener('focusout',()=>setTimeout(()=>{if(pend&&!busy())run(pend===true?null:pend)},0))}
// 原因存穩定的 key；顯示文字另查。舊資料（存顯示文字）讀取時遷移：飲料杯／外帶餐盒／household（家用垃圾）→ general，其他 → other，無法辨識 → null（未選）
const NEED_REASON={general:'一般垃圾',other:'其他'},NEED_REASON_KEYS=Object.keys(NEED_REASON);
const NEED_LEGACY={'飲料杯':'general','外帶餐盒':'general','其他':'other','一般垃圾':'general','家用垃圾':'general',household:'general'};
const migrateReason=r=>r==null?null:NEED_REASON[r]?r:(NEED_LEGACY[r]||null);
const getNeeds=()=>{try{const v=JSON.parse(localStorage.getItem(LS_NEEDS));if(!Array.isArray(v))return[];let ch=false;
  const a=v.filter(n=>n&&typeof n.la==='number'&&typeof n.lo==='number').map(n=>{const r=migrateReason(n.reason??null);if(r!==(n.reason??null)){ch=true;return{...n,reason:r}}return n});
  if(ch)try{localStorage.setItem(LS_NEEDS,JSON.stringify(a))}catch(e){}return a}catch(e){return[]}};
// 200 m 內等統計：總數＋各類（含「未選」），只列 ≥1 的類別
const needBreakdown=A=>{const c={};for(const n of A){const k=n.reason||'none';c[k]=(c[k]||0)+1}return[...NEED_REASON_KEYS,'none'].filter(k=>c[k]).map(k=>[k,k==='none'?'未選':NEED_REASON[k],c[k]])};
// 50 m 內已有回報 → 不重複計數，回傳既有那筆
function addNeed(la,lo){const a=getNeeds(),d=a.find(n=>hav(la,lo,n.la,n.lo)<=NEED_DEDUP_M);if(d)return{rec:d,dup:true};
  const rec={id:'N'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),la,lo,ts:Date.now(),reason:null};a.push(rec);localStorage.setItem(LS_NEEDS,JSON.stringify(a.slice(-500)));cloudOp('put','needs',rec);return{rec,dup:false}}
function removeNeed(id){localStorage.setItem(LS_NEEDS,JSON.stringify(getNeeds().filter(x=>x.id!==id)));cloudOp('del','needs',{id})}
const NEED_NOTE_MAX=40;function setNeedNote(id,t){const a=getNeeds(),n=a.find(x=>x.id===id);if(!n)return;n.note=String(t||'').trim().slice(0,NEED_NOTE_MAX)||null;localStorage.setItem(LS_NEEDS,JSON.stringify(a));cloudOp('upd','needs',{id,note:n.note})} // 「其他」的說明文字：存檔前裁到 40 字，同步到雲端
function setNeedReason(id,reason){if(!NEED_REASON[reason])return;const a=getNeeds(),n=a.find(x=>x.id===id);if(!n)return;n.reason=reason;localStorage.setItem(LS_NEEDS,JSON.stringify(a));cloudOp('upd','needs',{id,reason})}
function addEvent(e){const a=getEvents(),r={...e,id:e.id||('ev'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),ts:Date.now()};r.ot=r.ts; // ot：原始回報時間（上傳後 ts 會變成伺服器時間）
 a.push(r);localStorage.setItem(LS_EVENTS,JSON.stringify(a.slice(-500)));cloudOp('put','events',r);return r}
// 依 id 撤回一筆事件（行人「取消」自己剛送出的回報）
function removeEvent(id){localStorage.setItem(LS_EVENTS,JSON.stringify(getEvents().filter(e=>e.id!==id)));cloudOp('del','events',{id})}
// ===== 雲端同步（Firebase Realtime Database，見 cloud.js）=====
// localStorage 永遠是本機快取；設定好且在線 → cloud.js 上傳並把雲端資料併回快取。沒設定／離線 → 只用本機（＋同瀏覽器分頁同步）。
// 待上傳的動作存在 KP+'cloudq_v1'，重新連線後依序送出
const LS_CQ=KP+'cloudq_v1',LS_OWN=KP+'owners_v1';
const cloudQ=()=>{try{const v=JSON.parse(localStorage.getItem(LS_CQ));return Array.isArray(v)?v:[]}catch(e){return[]}};
function cloudOp(op,node,rec){if(window.CONFIG?.demo||!window.CLOUD_ON)return;const q=cloudQ();q.push({op,node,rec,t:Date.now(),ep:(v=>v==null?null:+v)(localStorage.getItem(KP+'epoch_v1'))});try{localStorage.setItem(LS_CQ,JSON.stringify(q.slice(-300)))}catch(e){}if(window.Cloud){Cloud.flush();Cloud.refresh&&Cloud.refresh()}}
function seedFill(id){let h=2166136261;for(const c of id){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)%101} // 模擬：依 id 固定
// 清運規則：某桶最近一次「清運完成」之後，比它早的回報（滿了／滿度）不算。比較用回報的原始時間 ot（離線排隊、晚上傳也一樣），沒有 ot 時用 ts
const evT=e=>e.ot??e.ts;
function lastClearTs(id,ev=getEvents()){let t=-Infinity;for(const e of ev)if(e.bin===id&&e.kind==='clear'&&e.ts>t)t=e.ts;return t}
function binEvents(id,ev=getEvents()){const c=lastClearTs(id,ev);return ev.filter(e=>e.bin===id&&(e.kind==='clear'||evT(e)>=c)).sort((a,b)=>evT(a)-evT(b))}
function fillOf(id,ev=getEvents()){let f=seedFill(id);for(const e of binEvents(id,ev)){f=e.kind==='full'?100:e.kind==='clear'?0:e.level}return f}
const fillColor=f=>typeof rampColor==='function'?rampColor(f):(f>=100?'#d9731f':f>=70?'#e8b931':'#8cc9a8'); // 色階定義在 ui.js
const fillPill=f=>`<span class="pill ${f>=100?'full':f>=70?'mid':'ok'}">${typeof rampState==='function'?rampState(f).t:f>=100?'滿溢':f>=70?'快滿了':'還有空間'}</span>`;
const timeStr=ts=>new Date(ts).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});

// 示範資料：街道清冊垃圾桶（不含場域線索）、示範區站點
async function loadCore(opt={}){const st=opt.stations!==false,E={features:[]};const [b,y,s]=await Promise.all([loadJSON('bins.geojson'),st?loadJSON('youbike.geojson'):E,st?loadJSON('busstops_taipei.geojson'):E]); // 行人頁 {stations:false}：不載入 YouBike／公車站
  const street=b.features.filter(f=>f.properties.source.startsWith('main')).map(f=>({id:f.properties.id,la:ll(f)[0],lo:ll(f)[1],addr:f.properties.address,d:f.properties.district,c:f.properties.colocated||1}));
  const venue=b.features.filter(f=>f.properties.source==='scenic130').map(f=>({id:f.properties.id,la:ll(f)[0],lo:ll(f)[1],addr:f.properties.address,d:f.properties.district,count:f.properties.count}));
  const yb=y.features.map(f=>({t:'yb',id:f.properties.id,name:f.properties.name,la:ll(f)[0],lo:ll(f)[1],act:f.properties.act,dock:f.properties.total,d:f.properties.district,addr:f.properties.address}));
  const bus=s.features.map(f=>({t:'bus',id:f.properties.id,name:f.properties.name,la:ll(f)[0],lo:ll(f)[1],routes:f.properties.routes,d:f.properties.district,addr:f.properties.address}));
  return{raw:b,street,venue,yb,bus}}
const OPT_NAME={A:'A 維持現況',B1:'B1 原位改善指引',B2:'B2 容量／頻率（模擬）',B:'B1 原位改善指引',C:'C 同桶數挪一處'}; // B＝舊存檔相容

// 手機底部面板會蓋住地圖下半部：把焦點往上偏移
const isMobile=()=>matchMedia('(max-width:760px)').matches;
function sheetH(){const p=document.querySelector('.panel');return isMobile()&&p?p.getBoundingClientRect().height:0}
function focusAt(map,latlng,zoom){map.setView(latlng,zoom,{animate:false});const h=sheetH();if(h)map.panBy([0,h/2],{animate:false})}
function fitTo(map,pts,maxZoom){map.fitBounds(pts,{paddingTopLeft:[40,40],paddingBottomRight:[40,40+sheetH()],maxZoom})}
// ===== 重設成原始狀態：只清這台裝置（本站寫入的 localStorage／sessionStorage），不會清雲端 =====
// 明確列表（config.storageKeys＋清潔隊頁 UI 狀態），另外清掉所有 KP（config.js）開頭的鍵
const APP_KEYS=[...Object.values((window.CONFIG&&CONFIG.storageKeys)||{}),KP+'crew_ui_v2',KP+'fc_ui'];
const APP_PREFIXES=[KP]; // 只清本站前綴，不動同網域其他版本（有桶_／有桶beta_）的資料
function resetAppState(){for(const S of [localStorage,sessionStorage]){const ks=[];for(let i=0;i<S.length;i++)ks.push(S.key(i));
  for(const k of ks)if(APP_KEYS.includes(k)||APP_PREFIXES.some(p=>k.startsWith(p)))S.removeItem(k)}}
const resetToDefault=()=>{resetAppState();location.replace(location.pathname)}; // 回到不帶參數的預設網址
if(new URLSearchParams(location.search).get('reset')==='1')resetToDefault(); // ?reset=1：不跳確認，直接清除（示範前用）
// （資料說明裡的「重設成原始狀態」按鈕已移除；開發用隱藏網址 ?reset=1 仍可清本機）
