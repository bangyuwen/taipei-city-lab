// 行人頁 App 內步行導航（beta）：點「步行導航」不跳 Google 地圖，卡片變成導航列（沿用收合箭頭）
// 路線：OSRM foot（routing.openstreetmap.de，免費）；失敗 → 虛線直線＋「直線距離 X 公尺」＋「用 Google 地圖開啟」升為主要按鈕
// 抵達：≤30 m 連續 3 秒（每次導航一次）；定位精度 >30 m 不自動，改顯示「到了嗎？」
// 「丟好了」不寫入；「桶子滿了」＝既有滿了流程（events）；「這裡沒有桶」＝既有需求回報（needs），兩者不混用
var NAV=null,NAVNEXT=null; // var：讓頁面 inline 程式用 window.NAV 判斷
// 參數化：頁面可在載入本檔前設定 window.NAVH 覆寫下列項目（清潔隊頁用行車路線＋收運量回報）；沒設定＝行人頁原本行為
const NH=Object.assign({
  osrm:'https://routing.openstreetmap.de/routed-foot/route/v1/foot/',speed:75,label:'步行',
  gmap:(la,lo)=>gmapWalk(la,lo),
  box:()=>list,                       // 卡片元素（算 fit 留白、監聽點擊）
  togSel:'#cardTog',
  getCol:()=>collapsed,setCol:v=>{collapsed=v},
  getPos:()=>pos,getAcc:()=>acc,
  setPos:(q,a)=>{pos=q;acc=a>0?a:acc;if(me)me.setLatLng(q);if(accC){accC.setLatLng(q);accC.setRadius(acc)}},
  paint:(html,col)=>{list.classList.toggle('col',col);list.innerHTML=togHTML(col)+html},
  left:null,                          // (N,rem,col)=>導航列左側 HTML；null＝距離・時間
  nbin:N=>{const b=N.bin,ev=getEvents(),st=binState(b.id,ev);return `<div class="nbin"><b>${b.addr}</b>${stateChip(fillOf(b.id,ev),st==='reported',!st)}</div>`},
  arrHTML:N=>`<div class="narr" id="navArr"><button class="nx" id="navX" aria-label="關閉，不回報">✕</button><h2>丟好了嗎？</h2><p class="ns">${N.bin.addr}</p>
    <div class="nb"><button class="ok" id="arrOk">丟好了</button><button class="ol" id="arrFull">桶子滿了</button><button class="ol" id="arrNone">這裡沒有桶</button></div></div>`,
  fitFail:N=>{if(typeof fitTarget!=='function')return false;routeInfo={bin:N.bin.id,pts:[pos,[N.bin.la,N.bin.lo]],snapped:false};fitTarget();return true},
  clearOther:()=>{if(typeof routeL!=='undefined')routeL.clearLayers()},
  after:()=>{kbFit();if(typeof redraw==='function')redraw()},
  onEnd:()=>{collapsed=true;render(true)},
  idleClick:null,arrClick:null
},window.NAVH||{});
const NAV_OSRM=NH.osrm,NAV_ARR_M=30,NAV_ARR_MS=3000,NAV_ACC_MAX=30,NAV_IDLE_MS=20000,NAV_FOLLOW_MS=3000,NAV_UPD_M=10,NAV_UPD_MS=5000,NAV_SPEED=NH.speed; // 每分鐘公尺數（行人 75，同卡片）
const navL=L.layerGroup().addTo(map);
const navBrand=()=>getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()||'#0f9d76';
const navFmt=m=>m>=1000?(m/1000).toFixed(1)+' 公里':Math.round(m)+' 公尺';
const navMin=m=>Math.max(1,Math.round(m/NAV_SPEED));
// 剩餘距離：沿路線，從最近的線段點算到終點
function navRemain(){const b=NAV.bin,pos=NH.getPos();if(!NAV.pts)return hav(pos[0],pos[1],b.la,b.lo);const P=NAV.pts;let bi=0,bd=1e18;
  for(let i=0;i<P.length;i++){const d=hav(pos[0],pos[1],P[i][0],P[i][1]);if(d<bd){bd=d;bi=i}}
  let s=bd;for(let i=bi;i<P.length-1;i++)s+=hav(P[i][0],P[i][1],P[i+1][0],P[i+1][1]);return s}
function navDraw(){navL.clearLayers();NH.clearOther();const pos=NH.getPos(),b=[NAV.bin.la,NAV.bin.lo];
  if(NAV.pts){L.polyline(NAV.pts,{color:'#fff',weight:9,opacity:1,interactive:false,className:'navcase'}).addTo(navL);L.polyline(NAV.pts,{color:navBrand(),weight:5,opacity:1,interactive:false,className:'navroute'}).addTo(navL)} // 5px 品牌綠＋2px 白邊
  else if(NAV.fail)L.polyline([pos,b],{color:navBrand(),weight:4,opacity:.9,dashArray:'6 8',interactive:false,className:'navroute dashed'}).addTo(navL)}
const navCardTop=()=>NH.box().getBoundingClientRect().top,navSideW=()=>NH.box().getBoundingClientRect().width;
function navFit(){if(NAV.fail&&NH.fitFail(NAV))return; // 路線失敗：用一般 fit 規則（你的位置＋目標，padding 計入卡片高）
  const pos=NH.getPos(),b=[NAV.bin.la,NAV.bin.lo],pts=[pos,b,...(NAV.pts||[])],mob=isMobile();
  map.fitBounds(L.latLngBounds(pts),{paddingTopLeft:[mob?40:48,topUIBottom()+60],paddingBottomRight:[mob?40:navSideW()+64,mob?innerHeight-navCardTop()+24:44],maxZoom:18,animate:false})}
function navFollow(){if(!NAV||NAV.mode!=='nav'||Date.now()-NAV.dragAt<NAV_FOLLOW_MS)return; // 抵達後不跟隨（避免地圖往一側漂）
const pos=NH.getPos();if(!pos)return;const c=map.latLngToContainerPoint(pos),cy=(topUIBottom()+(isMobile()?navCardTop():innerHeight))/2,cx=isMobile()?innerWidth/2:(innerWidth-navSideW()-16)/2;
  if(Math.abs(c.x-cx)>2||Math.abs(c.y-cy)>2)map.panBy([c.x-cx,c.y-cy],{animate:true,duration:.4})}
// 「回到我」：手動拖曳地圖後出現；3 秒內不自動回到你的位置
const navMe=document.createElement('button');navMe.id='navMe';navMe.type='button';navMe.textContent='回到我';navMe.hidden=true;navMe.setAttribute('aria-label','回到我的位置');document.body.appendChild(navMe);
{const s=document.createElement('style');s.textContent=`body.navon .binmk.tgt .tlab{display:none} /* 導航中隱藏「最近・X m」 */
#navMe{position:fixed;right:12px;z-index:1001;height:36px;min-width:44px;padding:0 14px;border:0;border-radius:18px;background:#fff;color:#2b3333;font:600 13px var(--font,system-ui);box-shadow:0 2px 8px #00000026;cursor:pointer}#navMe::after{content:"";position:absolute;inset:-4px}
.nbar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px}.nbar .nd{font:600 15px/1.3 var(--font,system-ui);color:#2b3333;white-space:nowrap}.nbar .nt{font:400 13px var(--font,system-ui);color:#7d8b8b;white-space:nowrap}
.nbar .nr{display:flex;gap:4px;flex:none}.ntx{min-width:44px;height:44px;padding:0 6px;border:0;background:none;color:#7d8b8b;font:400 13px var(--font,system-ui);cursor:pointer}
.nbin{display:flex;align-items:center;gap:8px;margin:2px 0 6px;flex-wrap:wrap}.nbin b{font:600 15px var(--font,system-ui);color:#2b3333}
.ngm{display:inline-block;margin:2px 0 2px;font:400 13px var(--font,system-ui);color:var(--brand);text-decoration:underline;text-underline-offset:3px;min-height:32px;line-height:32px}
.narr{position:relative}.narr .nx{position:absolute;top:-12px;right:-12px;width:44px;height:44px;border:0;background:none;color:#7d8b8b;font:400 18px/1 var(--font,system-ui);cursor:pointer}
.narr h2{margin:0 40px 2px 0;font:600 17px/1.35 var(--font,system-ui);color:#2b3333}.narr .ns{margin:0 0 12px;font:400 13px var(--font,system-ui);color:#7d8b8b}
.narr .nb{display:flex;flex-direction:column;gap:8px}.narr .nb button{height:48px;width:100%;border-radius:12px;font:600 15px var(--font,system-ui);cursor:pointer}
.narr .nb .ok{background:var(--brand);color:#fff;border:0}.narr .nb .ol{background:#fff;color:#2b3333;border:1.5px solid #d6dadc}
.nbar .ngs{display:inline-flex;align-items:center;justify-content:center;width:auto;min-height:44px;height:44px;padding:0 14px;margin:0;font-size:14px;white-space:nowrap;flex:none}
.nnext{display:block;margin:8px auto 0;min-height:44px;border:0;background:none;color:var(--brand);font:600 14px var(--font,system-ui);cursor:pointer}`;document.head.appendChild(s)}
function navMePlace(){if(navMe.hidden)return;navMe.style.bottom=(isMobile()?innerHeight-navCardTop()+12:16)+'px'}
navMe.onclick=()=>{if(!NAV)return;NAV.dragAt=0;navMe.hidden=true;navFollow()};
map.on('dragstart',()=>{if(!NAV)return;NAV.dragAt=Date.now();navMe.hidden=false;navMePlace()});
// ---- 開始／結束 ----
function navStart(b,extra){NAVNEXT=null;const pos=NH.getPos(),acc=NH.getAcc();
  NAV={...(extra||{}),bin:b,pts:null,fail:false,loading:true,dragAt:0,shownD:null,shownAt:0,lastPos:pos.slice(),near0:null,arrShown:false,mode:'nav',idleT:0,acc:acc,startAt:Date.now()};
  document.body.classList.add('navon');navDraw();navRender();navFit();navWatch();
  const ac=new AbortController(),to=setTimeout(()=>ac.abort(),6000),me0=NAV;
  fetch(`${NAV_OSRM}${pos[1]},${pos[0]};${b.lo},${b.la}?overview=full&geometries=geojson`,{signal:ac.signal}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .then(j=>{const c=j&&j.routes&&j.routes[0]&&j.routes[0].geometry&&j.routes[0].geometry.coordinates;if(!c||c.length<2)throw new Error('no route');if(NAV!==me0)return;
      NAV.pts=[pos.slice(),...c.map(x=>[x[1],x[0]]),[b.la,b.lo]];NAV.loading=false;navDraw();navRender();navFit()})
    .catch(e=>{console.warn('[有桶] '+NH.label+'路線失敗，改用直線',e&&e.message);if(NAV!==me0)return;NAV.fail=true;NAV.loading=false;navDraw();navRender();navFit()})
    .finally(()=>clearTimeout(to))}
function navEnd(){if(!NAV)return;clearTimeout(NAV.idleT);if(NAV.wid!=null&&navigator.geolocation)navigator.geolocation.clearWatch(NAV.wid);NAV=null;document.body.classList.remove('navon');navL.clearLayers();navMe.hidden=true;NH.onEnd()}
// ---- 定位追蹤：每 10 m 或 5 秒更新距離／時間 ----
function navWatch(){if(!navigator.geolocation)return;try{NAV.wid=navigator.geolocation.watchPosition(p=>navPos([p.coords.latitude,p.coords.longitude],p.coords.accuracy),()=>{},{enableHighAccuracy:true,maximumAge:2000,timeout:15000})}catch(e){}}
function navPos(q,a){if(!NAV)return;NH.setPos(q,a);NAV.acc=NH.getAcc();
  if(NAV.fail&&NAV.mode==='nav')navDraw();if(NAV.mode==='nav'&&(hav(q[0],q[1],NAV.lastPos[0],NAV.lastPos[1])>=NAV_UPD_M||Date.now()-NAV.shownAt>=NAV_UPD_MS)){NAV.lastPos=q.slice();navRender()}
  navArrive();navFollow()}
setInterval(()=>{if(!NAV)return;navArrive();if(NAV.mode==='nav'&&Date.now()-NAV.shownAt>=NAV_UPD_MS)navRender()},1000);
function navArrive(){const pos=NH.getPos();if(!NAV||NAV.arrShown||!pos)return;const d=hav(pos[0],pos[1],NAV.bin.la,NAV.bin.lo),good=NAV.acc<=NAV_ACC_MAX;
  if(!good){NAV.near0=null;if(!NAV.askShown){NAV.askShown=true;navRender()}return}
  if(NAV.askShown){NAV.askShown=false;navRender()}
  if(d<=NAV_ARR_M){if(NAV.near0==null)NAV.near0=Date.now();if(Date.now()-NAV.near0>=NAV_ARR_MS)navArrOpen()}else NAV.near0=null}
function navArrOpen(){if(!NAV||NAV.arrShown)return;NAV.arrShown=true;NAV.mode='arrive';NH.setCol(false);navL.clearLayers();navMe.hidden=true;navRender();navCenterBin();navIdle()}
// 抵達：拿掉路線，地圖以目標桶為中心（頁首下緣到卡片上緣之間），挑能同時看到你的位置的最大縮放
function navCenterBin(){const pos=NH.getPos(),b=[NAV.bin.la,NAV.bin.lo],top=topUIBottom()+12,bot=isMobile()?navCardTop()-12:innerHeight-12,left=12,right=isMobile()?innerWidth-12:innerWidth-navSideW()-28,M=28;
  for(let z=18;z>=14;z--){map.setView(b,z,{animate:false});const c=map.latLngToContainerPoint(b);map.panBy([c.x-(left+right)/2,c.y-(top+bot)/2],{animate:false});const q=map.latLngToContainerPoint(pos);if(q.x>=left+M&&q.x<=right-M&&q.y>=top+M&&q.y<=bot-M)break}}
function navIdle(){clearTimeout(NAV.idleT);if(NAV.mode!=='arrive')return;const n=NAV;NAV.idleT=setTimeout(()=>{if(NAV!==n||NAV.mode!=='arrive')return;NAV.mode='arrived';NH.setCol(true);navRender()},NAV_IDLE_MS)}
// ---- 畫面 ----
function navRender(){if(!NAV)return;const N=NAV,b=N.bin,collapsed=NH.getCol();
  if(N.mode==='arrive'&&!collapsed){NH.paint(NH.arrHTML(N),false);navAfter();return}
  const rem=navRemain();N.shownD=rem;N.shownAt=Date.now();
  const left=NH.left?NH.left(N,rem,collapsed):N.mode==='arrived'?`<span class="nd">已抵達</span>`:N.fail?`<span class="nd">直線距離 ${navFmt(rem)}</span>`:`<span><span class="nd">${navFmt(rem)}</span><span class="nt">・約 ${navMin(rem)} 分鐘</span></span>`;
  const ask=N.mode==='nav'&&N.askShown?'<button class="ntx" id="navAsk">到了嗎？</button>':'';
  const bar=`<div class="nbar" id="navBar">${left}<span class="nr">${ask}<button class="ntx" id="navEnd">結束</button></span></div>`;
  const gm=N.fail?`<div class="acts" style="margin-top:4px"><a class="b pri" id="navGm" target="_blank" rel="noopener" href="${NH.gmap(b.la,b.lo)}">用 Google 地圖開啟</a></div>`:'';
  if(collapsed&&N.fail){NH.paint(`<div class="nbar" id="navBar">${left}<span class="nr">${ask}<a class="b pri ngs" id="navGm" target="_blank" rel="noopener" href="${NH.gmap(b.la,b.lo)}">Google 地圖</a></span></div>`,true);navAfter();return} // 路線失敗＋收合：右側小主要按鈕（取代「結束」；「結束」在展開區）
  if(collapsed){NH.paint(bar+gm,true);navAfter();return}
  NH.paint(bar+NH.nbin(N)+(N.fail?gm:`<a class="ngm" id="navGm" target="_blank" rel="noopener" href="${NH.gmap(b.la,b.lo)}">用 Google 地圖開啟</a>`),false);navAfter()}
function navAfter(){NH.after();navMePlace()}
function navThanks(after){if(window.Cloud&&Cloud.note)Cloud.note('謝謝！已更新',1200);setTimeout(after,1200)}
// 點擊：回傳 true 表示已處理
function navClick(e){const t=e.target;
  if(!NAV){if(NH.idleClick)return NH.idleClick(t);if(t.closest('#navGo')){const P=primary();if(P&&pos){sel=P.f.id;navStart(P.f)}return true}
    if(t.closest('#navNext')){const x=NAVNEXT;NAVNEXT=null;const ev=getEvents(),c=nearestN(shown().filter(b=>b.id!==x&&binState(b.id,ev)!=='reported'),1)[0];if(c)sel=c.f.id;render(true);return true}return false}
  if(NAV.mode==='arrive')navIdle();
  if(t.closest(NH.togSel)){if(NAV.mode==='arrive'&&!NH.getCol()){navEnd();return true}NH.setCol(!NH.getCol());navRender();navFit();return true} // 抵達卡收合＝關閉（不回報、結束導航）
  if(t.closest('#navX')){navEnd();return true}
  if(t.closest('#navEnd')){navEnd();return true}
  if(t.closest('#navAsk')){navArrOpen();return true}
  if(NH.arrClick&&NAV.mode==='arrive'){const r=NH.arrClick(t,NAV);if(r!=null)return r}
  if(t.closest('#arrOk')){NAV.mode='sent';list.querySelectorAll('.nb button').forEach(x=>x.disabled=true);if(window.Cloud&&Cloud.note)Cloud.note('謝謝！',1200);setTimeout(navEnd,1200);return true} // 丟好了：只說謝謝！，不寫入、不顯示「已更新」、不觸發同步
  if(t.closest('#arrFull')){const id=NAV.bin.id,r=addEvent({bin:id,kind:'full',level:100,by:'行人'});setAsked(id,'full');myRep={bin:id,kind:'full',id:r.id};saveRep();NAV.mode='sent';list.querySelectorAll('.nb button').forEach(x=>x.disabled=true);navThanks(()=>{navEnd();NAVNEXT=id;render(false)});return true} // events
  if(t.closest('#arrNone')){addNeed(pos[0],pos[1]);NAV.mode='sent';list.querySelectorAll('.nb button').forEach(x=>x.disabled=true);navThanks(()=>navEnd());return true} // needs（直接送出，不問原因）
  return t.closest('#navGm')?false:true}
NH.box().addEventListener('click',e=>{if(navClick(e)){e.stopImmediatePropagation();e.preventDefault&&!e.target.closest('a')&&e.preventDefault()}},true);
// 抵達卡：往下滑＝關閉
{let y0=null;NH.box().addEventListener('touchstart',e=>{y0=NAV&&NAV.mode==='arrive'?e.touches[0].clientY:null},{passive:true});NH.box().addEventListener('touchend',e=>{if(y0!=null&&NAV&&NAV.mode==='arrive'&&e.changedTouches[0].clientY-y0>48)navEnd();y0=null},{passive:true})}
addEventListener('resize',()=>{if(NAV)navMePlace()});
