// 雲端同步層：Firebase Realtime Database（CDN 模組版 SDK，動態載入）
// - config.js 的 firebaseConfig 留空、SDK 載不到、或離線 → 什麼都不做，網站照常用 localStorage（＋分頁同步）
// - 寫入：common.js 的 addEvent／removeEvent／addNeed／setNeedReason／setNeedNote／removeNeed 先寫本機，再排進佇列由這裡上傳
// - 讀取：onValue 監聽 events、needs → 併回本機快取 → 通知各頁重畫（只重畫資料，不 fit 地圖）
// - 刪除＝寫 del:true（墓碑）；只有持有該筆 owner 密鑰的瀏覽器能刪／改（規則見 database.rules.json）
(function(){
const FBV='12.4.0',T=window.FB_TEST||{},cfg=T.config||((window.CONFIG&&CONFIG.firebaseConfig)||{});
const on=!!(cfg&&cfg.databaseURL&&(cfg.apiKey||T.emu));window.CLOUD_ON=on;
let st='local',everLive=false,bootAt=Date.now();const listeners=[];
// ===== 連線狀態（設計稿 v1）=====
// 在線：平常什麼都不顯示；別台裝置的更新到達／自己上傳成功 → 「已同步」短暫提示（150ms 淡入、停 1.6s、200ms 淡出；連續觸發合併）
// 離線：常駐「離線・本機（N 筆待上傳）」，灰點；點一下多一行「恢復連線後會自動上傳」。重新連線上傳完 → 「已同步 N 筆」一次
// 位置：卡片上緣上方 12px、水平置中（清潔隊的「復原」提示在時放在它上方）；規劃頁沒有卡片 → 地圖底部置中 16px
let el,hideT=0,showing=false,open=false;
function mountStatus(){if(el)return;el=document.createElement('div');el.id='syncSt';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.innerHTML='<div class="r"><i></i><b></b></div><small>恢復連線後會自動上傳</small>';
  const css=document.createElement('style');css.textContent='#syncSt{position:fixed;z-index:2900;left:0;top:0;display:none;flex-direction:column;align-items:center;justify-content:center;min-height:28px;padding:0 12px;border-radius:14px;background:#fff;box-shadow:0 1px 3px #0000001f;color:#2b3333;font:600 13px/1 var(--font,system-ui);white-space:nowrap;opacity:0;transition:opacity 200ms;cursor:default;-webkit-tap-highlight-color:transparent}#syncSt.on{opacity:1;transition:opacity 150ms}#syncSt .r{display:flex;align-items:center;gap:6px;height:28px}#syncSt i{width:9px;height:9px;border-radius:50%;background:#0f9d76;flex:none}#syncSt[data-s=off] i{background:#7d8b8b}#syncSt small{display:none;font:500 12px/1 var(--font,system-ui);color:#5f6a6a;padding:0 0 8px}#syncSt[data-s=off].open small{display:block}#syncSt[data-s=off]{cursor:pointer}';
  document.head.appendChild(css);document.body.appendChild(el);el.onclick=()=>{if(el.dataset.s==='off'){open=!open;el.classList.toggle('open',open);place();dispatchEvent(new Event('syncpill'))}};
  addEventListener('resize',place);new MutationObserver(()=>{if(showing)place()}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});setInterval(()=>{if(showing)place()},500);render()}
function vis(e){if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return r.width&&r.height&&r.bottom>0&&r.top<innerHeight?r:null}
function place(){if(!el||!showing)return;const h=el.offsetHeight||28,w=el.offsetWidth;let cx,top;
  const card=vis(document.querySelector('#list'))||vis(document.querySelector('#card'));
  const ft=document.querySelector('.ftop'),mp=vis(document.querySelector('#map'));
  if(card){cx=card.left+card.width/2;top=card.top-12-h}else if(innerWidth>760&&ft&&mp){const f=ft.getBoundingClientRect();cx=mp.left+mp.width/2;top=f.bottom+12}else{const m=vis(document.querySelector('#map'))||{left:0,width:innerWidth,bottom:innerHeight};cx=m.left+m.width/2;top=Math.min(m.bottom,innerHeight)-16-h}
  const u=[...document.querySelectorAll('.undo')].map(vis).find(Boolean);if(u&&top+h>u.top-12&&top<u.bottom+12)top=u.top-12-h; // 不蓋住「復原」
  el.style.left=Math.max(8,Math.min(innerWidth-w-8,cx-w/2))+'px';el.style.top=Math.max(8,top)+'px'}
let offShown=false;function offPill(v){if(v!==offShown){offShown=v;dispatchEvent(new Event('syncpill'))}}
function show(text,state){el.dataset.s=state;el.querySelector('b').textContent=text;if(state!=='off'){open=false;el.classList.remove('open')}const was=el.classList.contains('on');el.style.display='flex';showing=true;place();if(!was){el.classList.remove('on');void el.offsetWidth}el.style.transition='opacity 150ms ease-out';el.classList.add('on')}
function hide(){if(!el)return;el.style.transition='opacity 200ms ease-in';el.classList.remove('on');clearTimeout(el._h);el._h=setTimeout(()=>{if(!el.classList.contains('on')){el.style.display='none';showing=false}},200)}
function render(){if(!el)return;if(!on)return; // 沒設定雲端 → 不顯示
  if(st!=='live'){if(!everLive&&Date.now()-bootAt<4000){setTimeout(render,4100-(Date.now()-bootAt));return}clearTimeout(hideT);hideT=0;const n=cloudQ().length;show(n?`離線・本機（${n} 筆待上傳）`:'離線・本機','off');offPill(true)}
  else{offPill(false);if(!hideT)hide()}}
let noteUntil=0;function toast(n){if(!el||st!=='live'||Date.now()<noteUntil)return; // 自訂提示（例：謝謝！已更新）顯示中不被同步提示蓋掉
 clearTimeout(hideT);show(n>0?`已同步 ${n} 筆`:'已同步','ok');hideT=setTimeout(()=>{hideT=0;hide()},150+1600)} // 連續觸發只延長同一個提示
function setStatus(s){const was=st;st=s;if(s==='live')everLive=true;document.documentElement.dataset.sync=s;if(el)el.dataset.conn=s;if(was!==s||s!=='live')render();listeners.forEach(f=>f(s))}
const own=()=>{try{return JSON.parse(localStorage.getItem(LS_OWN))||{}}catch(e){return{}}};
const setOwn=o=>{try{localStorage.setItem(LS_OWN,JSON.stringify(o))}catch(e){}};
function cid(){let c=localStorage.getItem(KP+'cid_v1');if(!c||!/^c[0-9a-z]{8,24}$/.test(c)){c='c'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);localStorage.setItem(KP+'cid_v1',c)}return c}
const rnd=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>(b%36).toString(36)).join('');
const EV_KEYS=['bin','kind','by','ot','level','amount','amountPct','predPct','calib','fcDay','fcMin'],ND_KEYS=['la','lo','reason','note'];
const pick=(r,ks)=>{const o={};for(const k of ks)if(r[k]!=null&&r[k]!=='')o[k]=r[k];return o};
function dropStale(it){const q=cloudQ().filter(x=>x.rec.id!==it.rec.id);localStorage.setItem(LS_CQ,JSON.stringify(q));const key=it.node==='events'?LS_EVENTS:LS_NEEDS;try{const a=JSON.parse(localStorage.getItem(key)||'[]');const b=a.filter(r=>r.id!==it.rec.id);if(b.length!==a.length){localStorage.setItem(key,JSON.stringify(b));appSyncNotify(key)}}catch(e){}}
let evOK=false,evT0=0,noOt=false,epochRules=false,api=null,db=null,busy=false,denied=false,epochOK=false,wasOff=false,selfAck=0;const cloudIds={events:new Set(),needs:new Set()};
async function flush(){if(!api||busy||st!=='live'||denied||!epochOK||!evOK)return;busy=true;let sent=0;const backlog=cloudQ().length>1||wasOff;wasOff=false;try{
  for(;;){const q=cloudQ();if(!q.length)break;const it=q[0],O=own(),id=it.rec.id,up={};
    const curEp=+(localStorage.getItem(KP+'epoch_v1')||0);if(it.ep!=null&&it.ep!==curEp){dropStale(it);continue} // 清空前排進來的動作：丟掉，不上傳
    if(it.op==='put'&&it.node==='events'&&it.rec.kind!=='clear'&&evT(it.rec)<lastClearTs(it.rec.bin)){const q3=cloudQ();q3.shift();localStorage.setItem(LS_CQ,JSON.stringify(q3));continue} // 排隊中的回報比該桶最近清運早 → 不上傳（不會讓桶又變紅）
    if(it.op==='put'){const sec=O[id]||(O[id]=rnd());setOwn(O);up[`${it.node}/${id}`]={...pick(it.rec,it.node==='events'?(noOt?EV_KEYS.filter(x=>x!=='ot'):EV_KEYS):ND_KEYS),ts:api.serverTimestamp(),c:cid(),...(epochRules?{e:curEp}:{})}; /* e：目前的清空世代（規則比對；舊版規則讀不到 meta 時不送） */up[`owners/${id}`]=sec;up[`last/${cid()}`]=api.serverTimestamp()}
    else if(O[id]){up[`proof/${id}`]=O[id];if(it.op==='del')up[`${it.node}/${id}/del`]=true;else for(const k of ['reason','note'])if(k in it.rec)up[`${it.node}/${id}/${k}`]=it.rec[k]??null}
    let wait=0;if(Object.keys(up).length)try{await api.update(api.ref(db),up);sent++}catch(e){const m=String(e&&e.message||e);if(/permission|PERMISSION/i.test(m)){if(it.op==='put'&&it.node==='events'&&!noOt&&it.rec.ot!=null&&!it.otTried){noOt=true;it.otTried=1;wait=1}else if(it.otTried===1&&noOt&&!it.retry){noOt=false;it.otTried=2;it.retry=1;wait=1700}else if(it.op==='put'&&!it.retry){it.retry=1;wait=1700}else if(it.op==='put'&&it.ep!=null&&it.ep!==+(localStorage.getItem(KP+'epoch_v1')||0)){dropStale(it);continue}else console.warn('[有桶] 雲端拒絕寫入，只保留在本機',it,m)}else{busy=false;return}} // 網路錯誤 → 留在佇列，下次連線再送
    const q2=cloudQ();if(q2[0]&&q2[0].rec.id!==it.rec.id)continue;if(wait){if(!q2.length)continue;q2[0]=it;localStorage.setItem(LS_CQ,JSON.stringify(q2));await new Promise(r=>setTimeout(r,wait));continue}q2.shift();localStorage.setItem(LS_CQ,JSON.stringify(q2))}
}finally{busy=false;if(sent){selfAck=Date.now();toast(backlog?sent:0)}}}
// 雲端快照 → 本機快取：雲端有的（未刪）＋本機還沒送出的；本機已送出但雲端沒有（被刪／被清空）就移除
const primed={};function merge(node,val){const key=node==='events'?LS_EVENTS:LS_NEEDS,q=cloudQ(),pend=new Set(q.filter(x=>x.node===node&&x.op==='put').map(x=>x.rec.id)),dels=new Set(q.filter(x=>x.node===node&&x.op==='del').map(x=>x.rec.id));
  const cl=Object.entries(val||{}).filter(([id,r])=>r&&!r.del&&!dels.has(id)).map(([id,r])=>{const o={...r,id};delete o.c;delete o.e;return o});
  const local=node==='events'?getEvents():getNeeds(),ids=new Set(cl.map(r=>r.id));
  // 本機 upd 還沒送出 → 保留本機欄位
  const lm=new Map(local.map(r=>[r.id,r]));for(const r of cl){const l=lm.get(r.id);if(l&&q.some(x=>x.node===node&&x.op==='upd'&&x.rec.id===r.id)){r.reason=l.reason;r.note=l.note}if(node==='needs'){r.reason=r.reason??null}}
  const keep=local.filter(r=>!ids.has(r.id)&&pend.has(r.id));const out=[...cl,...keep].sort((a,b)=>a.ts-b.ts).slice(-500);
  const before=localStorage.getItem(key),s=JSON.stringify(out);if(s!==before){localStorage.setItem(key,s);appSyncNotify(key);
    let ext=false;try{const B=new Map((JSON.parse(before)||[]).map(r=>[r.id,JSON.stringify(r)]));const mine=own();ext=out.some(r=>!mine[r.id]&&B.get(r.id)!==JSON.stringify(r))||[...B.keys()].some(id=>!mine[id]&&!ids.has(id)&&!pend.has(id))}catch(e){}
    if(ext&&primed[node])toast(0)}primed[node]=true}
async function start(){
  try{const base=`https://www.gstatic.com/firebasejs/${FBV}/`;const [A,D]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-database.js')]);
    const app=A.initializeApp(cfg,'youtong');db=D.getDatabase(app,cfg.databaseURL);if(T.emu){const [h,p]=T.emu.split(':');D.connectDatabaseEmulator(db,h,+p)}api=D;
    // 雲端拒絕讀取（例如規則還沒部署、資料庫在鎖定模式）→ 維持「離線・本機」，動作留在佇列，規則上線後重新整理即上傳
    let conn=false;const upd=()=>{if(st==='live'&&!(conn&&!denied))wasOff=true;setStatus(conn&&!denied?'live':'local');if(conn&&!denied)flush()};
    
    // 管理員清空雲端（scripts/wipe-cloud.mjs）會改寫 meta/epoch；和本機記錄不同 → 清掉本機事件、需求、待上傳佇列，避免舊資料被重新上傳。
    // 收到 epoch 之前不上傳（flush 被擋住）
    const onEpoch=s=>{const e=+(s.val()||0),k=KP+'epoch_v1',mine=localStorage.getItem(k);
      if(mine!==null&&+mine!==e){for(const x of [LS_EVENTS,LS_NEEDS,LS_CQ,LS_OWN,KP+'asked_v1',CONFIG.storageKeys.forecast])localStorage.removeItem(x);try{sessionStorage.removeItem(KP+'myrep')}catch(_){};console.info('[有桶] 雲端已清空，本機資料一併清除');appSyncNotify('wipe');appSyncNotify(LS_EVENTS)}
      localStorage.setItem(k,String(e));epochRules=true;epochOK=true;upd()},epErr=e=>{console.warn('[有桶] 讀不到 meta/epoch（規則未更新？），略過清空偵測');epochOK=true;upd()};
    D.onValue(D.ref(db,'meta/epoch'),onEpoch,epErr);
    D.onValue(D.ref(db,'.info/connected'),s=>{conn=!!s.val();if(conn){epochOK=false;evOK=false;clearTimeout(evT0);evT0=setTimeout(()=>{evOK=true;flush()},2500);D.get(D.ref(db,'meta/epoch')).then(onEpoch,epErr)}upd()});
    // 每次（重新）連線先向伺服器確認 epoch 才上傳：離線期間被清空的話，待上傳佇列會先被清掉

    for(const node of ['events','needs'])D.onValue(D.query(D.ref(db,node),D.orderByChild('ts'),D.limitToLast(500)),s=>{merge(node,s.val());if(node==='events'&&!evOK){evOK=true;clearTimeout(evT0);flush()}},e=>{denied=true;console.warn('[有桶] 雲端讀取被拒，改用本機',e&&e.code||e);upd()});
  }catch(e){console.warn('[有桶] 雲端同步無法啟動，改用本機',e);setStatus('local')}}
window.Cloud={note:(t,ms=1200)=>{mountStatus();noteUntil=Date.now()+ms+300;clearTimeout(hideT);show(t,'ok');hideT=setTimeout(()=>{hideT=0;hide();setTimeout(render,260)},ms)},pillH:()=>offShown&&el?el.offsetHeight+12:0,refresh:()=>render(),_off:()=>api&&api.goOffline(db),_on:()=>api&&api.goOnline(db),flush,status:()=>st,onStatus:f=>listeners.push(f),on};
addEventListener('online',()=>flush());window.addEventListener('storage',e=>{if(e.key===LS_CQ)render()});
const boot=()=>{mountStatus();if(on)start()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));else setTimeout(boot,0);
})();
