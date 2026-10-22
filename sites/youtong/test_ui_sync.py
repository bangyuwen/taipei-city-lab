# 連線狀態提示（模擬器）：淡入/停留/淡出時間、1 秒內 3 次只出現一個提示、行人 390 離線時目標在提示上方、規劃頁位置、已同步 N 筆
import sys,os,time,subprocess
from playwright.sync_api import sync_playwright
B=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8765/'
INIT="window.FB_TEST={emu:'127.0.0.1:9000',config:{projectId:'demo-youtong',databaseURL:'http://127.0.0.1:9000?ns=demo-youtong-default-rtdb'}}"
ENV={**os.environ,'FIREBASE_DATABASE_EMULATOR_HOST':'127.0.0.1:9000','DB_URL':'http://127.0.0.1:9000?ns=demo-youtong-default-rtdb'}
subprocess.run(['node','scripts/wipe-cloud.mjs','--yes'],env=ENV,check=True,capture_output=True)
errs=[];R={}
MOB=dict(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2);DK=dict(viewport={'width':1280,'height':800})
REC2="""(()=>{window.__E=[];const e=document.getElementById('syncSt');new MutationObserver(()=>__E.push([performance.now(),e.classList.contains('on')?'on':'off'])).observe(e,{attributes:true,attributeFilter:['class']});e.addEventListener('transitionstart',x=>{const a=e.getAnimations()[0];__E.push([performance.now(),'ts',a?a.effect.getTiming().duration:null])});e.addEventListener('transitionend',x=>__E.push([performance.now(),'te',getComputedStyle(e).opacity]))})()"""
REC="""(()=>{window.__T=[];const e=document.getElementById('syncSt');let last=-1,st=null;const tick=t=>{const o=getComputedStyle(e).display==='none'?0:+getComputedStyle(e).opacity;if(o!==last){__T.push([performance.now(),o]);last=o}requestAnimationFrame(tick)};requestAnimationFrame(tick)})()"""
def page(c,url,sel):
  p=c.new_page();p.on('pageerror',lambda e:errs.append(str(e)));p.goto(B+url);p.wait_for_selector(sel,timeout=20000);p.wait_for_function("document.documentElement.dataset.sync==='live'",timeout=15000);return p
def exp(p):
  if p.evaluate("typeof collapsed!=='undefined'&&collapsed"):p.click('#cardTog');p.wait_for_timeout(300)
def toasts(T):  # 從 0 變成 >0 的次數＝提示出現次數；並算時間
  n=0;segs=[];cur=None
  for t,o in T:
    if o>0 and (cur is None):cur={'start':t};n+=1
    if cur is not None:
      if o>=0.999 and 'full' not in cur:cur['full']=t
      if o<0.999 and 'full' in cur and 'down' not in cur:cur['down']=t
      if o==0:cur['end']=t;segs.append(cur);cur=None
  return n,segs
with sync_playwright() as pw:
  br=pw.chromium.launch();mk=lambda o:(lambda c:(c.add_init_script(INIT),c)[1])(br.new_context(locale='zh-TW',**o))
  P=mk(MOB);ped=page(P,'pedestrian.html','#list .card');ped.wait_for_timeout(3000);exp(ped)
  W=[mk(DK) for _ in range(3)];ws=[page(c,'crew.html?fc=1&day=we&t=15:30','#card[data-state=A]') for c in W]
  ids=ws[0].evaluate("route.slice(0,3).map(e=>e.b.id)")
  # 單一提示時間
  ped.evaluate(REC);ped.evaluate(REC2);ws[0].evaluate(f"addEvent({{bin:'{ids[0]}',kind:'full',level:100,by:'行人'}})");ped.wait_for_timeout(3600)
  T1=ped.evaluate("__T");print('T1',[(round(t-T1[0][0]),round(o,3)) for t,o in T1][:30]);n,s=toasts(T1);E1=ped.evaluate('__E');print('E1',[(round(t-E1[0][0]),k) for t,k,*_ in E1]);ev=[(t,k) for t,k,*_ in E1];on0=[t for t,k in ev if k=='on'][0];te=[t for t,k in ev if k=='te'];off0=[t for t,k in ev if k=='off'][0];R['事件 淡入 ms']=round(te[0]-on0);R['事件 停留 ms']=round(off0-te[0]);R['事件 淡出 ms']=round(te[1]-off0) if len(te)>1 else None;R['CSS 動畫長度 淡入/淡出']=[x[2] for x in E1 if x[1]=='ts'];g=s[0];R['單次提示數']=n;R['淡入 ms']=round(g['full']-g['start']);R['停留 ms']=round(g['down']-g['full']);R['淡出 ms']=round(g['end']-g['down'])
  # 1 秒內 3 次（3 個不同裝置）
  ped.evaluate("__T.length=0");t0=time.time()
  for i,w in enumerate(ws):w.evaluate(f"addEvent({{bin:'{ids[i]}',kind:'clear',level:0,by:'清潔隊'}})");ped.wait_for_timeout(250)
  R['3 次觸發耗時 ms']=int((time.time()-t0)*1000);ped.wait_for_timeout(3500);n3,s3=toasts(ped.evaluate("__T"));R['1 秒內 3 次 → 提示數']=n3;R['合併後總顯示 ms']=round(s3[0]['end']-s3[0]['start']) if s3 else None
  # 行人 390 離線＋回報流程展開：目標與標籤在提示上方
  P.set_offline(True);ped.evaluate("Cloud._off()");ped.wait_for_function("getComputedStyle(syncSt).display!=='none'",timeout=8000)
  exp(ped);ped.click('[data-full]');ped.wait_for_timeout(300);ped.click('#needBtn');ped.wait_for_timeout(300);ped.click('[data-reason="other"]');ped.wait_for_timeout(900)
  geo=ped.evaluate("(()=>{const me=document.querySelector('.me').getBoundingClientRect(),tg=document.querySelector('.binmk.tgt').getBoundingClientRect(),mc=map.latLngToContainerPoint(pos),tc=map.latLngToContainerPoint(routeInfo.pts[routeInfo.pts.length-1]);const w=document.querySelector('.binmk.tgt .w').getBoundingClientRect();window.__ME={sepVisual:Math.round(Math.hypot(me.left+me.width/2-(w.left+w.width/2),me.top+me.height/2-(w.top+w.height/2))),sepAnchor:Math.round(mc.distanceTo(tc)),zoom:map.getZoom(),mePane:document.querySelector('.me').parentElement.className}})()");geo=ped.evaluate("(()=>{const p=syncSt.getBoundingClientRect(),m=document.querySelector('.binmk.tgt').getBoundingClientRect(),l=document.querySelector('.binmk.tgt .tlab'),lb=l?l.getBoundingClientRect():m;return{pillTop:p.top|0,pillBottom:p.bottom|0,markerBottom:m.bottom|0,labelBottom:lb.bottom|0,label:l?l.textContent:'',pill:syncSt.querySelector('.r').textContent,cardTop:list.getBoundingClientRect().top|0,...__ME}})()")
  R['行人390 離線＋展開']=geo;print(R);ped.screenshot(path='/workspace/tmp/dbg.png');assert geo['markerBottom']<=geo['pillTop'] and geo['labelBottom']<=geo['pillTop']
  ped.screenshot(path='/workspace/review_ped_390_offline_expanded.png')
  # 重連 → 已同步 N 筆（行人）
  ped.evaluate("__T.length=0");P.set_offline(False);ped.evaluate("Cloud._on()");ped.wait_for_function("syncSt.classList.contains('on')&&/^已同步 \\d+ 筆/.test(syncSt.textContent)",timeout=15000);R['行人重連']=ped.inner_text('#syncSt .r');ped.screenshot(path='/workspace/review_ped_390_synced_n.png')
  ped.wait_for_timeout(400);R['提示消失後重新 fit 不再預留']=ped.evaluate("Cloud.pillH()")
  # 清潔隊 390：離線完成一站 → 重連 已同步 N 筆
  C=mk(MOB);cr=page(C,'crew.html?fc=1&day=we&t=15:30','#card[data-state=A] #startBtn');cr.click('#startBtn');cr.wait_for_selector('#card[data-state=B] [data-amt]')
  C.set_offline(True);cr.evaluate("Cloud._off()");cr.wait_for_timeout(800);cr.click('#card [data-amt=half]');cr.wait_for_timeout(2000);cr.click('#card [data-amt=full]');cr.wait_for_timeout(600)
  R['清潔隊離線']=cr.inner_text('#syncSt .r');cr.wait_for_timeout(5500)
  C.set_offline(False);cr.evaluate("Cloud._on()");cr.wait_for_function("syncSt.classList.contains('on')&&/^已同步 \\d+ 筆/.test(syncSt.textContent)",timeout=15000);R['清潔隊重連']=cr.inner_text('#syncSt .r');cr.screenshot(path='/workspace/review_crew_390_synced_n.png')
  # 規劃頁桌機
  L=mk(DK);pl=page(L,'index.html','#needCard');pl.wait_for_timeout(1500);ws[1].evaluate("addNeed(25.0301,121.5402)")
  pl.wait_for_function("syncSt.classList.contains('on')",timeout=6000);pl.wait_for_timeout(500);R['規劃頁截圖時不透明度']=pl.evaluate('getComputedStyle(syncSt).opacity');pg=pl.evaluate("(()=>{const r=syncSt.getBoundingClientRect(),f=document.querySelector('.ftop').getBoundingClientRect(),m=map.getContainer().getBoundingClientRect(),g=document.querySelector('.lgd').getBoundingClientRect();return{pill:[r.left|0,r.top|0,r.width|0,r.height|0],gapBelowTopbar:(r.top-f.bottom)|0,centerOffset:Math.round(r.left+r.width/2-(m.left+m.width/2)),overlapLegend:!(r.bottom<=g.top||r.top>=g.bottom||r.right<=g.left||r.left>=g.right),text:syncSt.textContent}})()")
  R['規劃頁 提示']=pg;pl.screenshot(path='/workspace/review_planner_desktop_toast.png')
  L.set_offline(True);pl.evaluate("Cloud._off()");pl.wait_for_function("getComputedStyle(syncSt).display!=='none'&&syncSt.dataset.s==='off'",timeout=8000);pl.wait_for_timeout(300)
  R['規劃頁 離線']=pl.evaluate("(()=>{const r=syncSt.getBoundingClientRect(),f=document.querySelector('.ftop').getBoundingClientRect(),m=map.getContainer().getBoundingClientRect();return{text:syncSt.querySelector('.r').textContent,gap:(r.top-f.bottom)|0,centerOffset:Math.round(r.left+r.width/2-(m.left+m.width/2))}})()");pl.screenshot(path='/workspace/review_planner_desktop_offline.png')
  R['規劃頁圖例']=pl.evaluate("document.querySelector('.lgd').textContent.includes('備用垃圾桶')&&!document.querySelector('.lgd').textContent.includes('場域線索')")
  R['ERRORS']=[e for e in errs if 'INTERNET' not in e];br.close()
for k,v in R.items():print(k,':',v)
