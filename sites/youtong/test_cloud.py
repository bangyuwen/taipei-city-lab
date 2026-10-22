# 雲端路徑（Firebase 模擬器）：兩個獨立 context＝兩個瀏覽器設定檔
# 先：firebase emulators:start --only database --project demo-youtong；再：python3 test_cloud.py [baseURL]
import sys,time,json
from playwright.sync_api import sync_playwright
B=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8765/'
INIT="window.FB_TEST={emu:'127.0.0.1:9000',config:{projectId:'demo-youtong',databaseURL:'http://127.0.0.1:9000?ns=demo-youtong-default-rtdb'}}"
ok=True;errs=[]
import subprocess,os
w=subprocess.run(['node','scripts/wipe-cloud.mjs','--yes'],env={**os.environ,'FIREBASE_DATABASE_EMULATOR_HOST':'127.0.0.1:9000','DB_URL':'http://127.0.0.1:9000?ns=demo-youtong-default-rtdb'},capture_output=True,text=True);print('管理員清空',w.returncode,w.stdout.strip().replace('\n',' '));assert w.returncode==0
def exp(p):
  if p.evaluate("typeof collapsed!=='undefined'&&collapsed"):p.click('#cardTog');p.wait_for_timeout(300)
def ctx(br,**o):
  c=br.new_context(locale='zh-TW',**o);c.add_init_script(INIT);return c
def page(c,url,sel):
  p=c.new_page();p.on('pageerror',lambda e:errs.append(str(e)));p.goto(B+url);p.wait_for_selector(sel,timeout=20000);p.wait_for_function("document.documentElement.dataset.sync==='live'",timeout=15000);return p
with sync_playwright() as pw:
  br=pw.chromium.launch()
  A=ctx(br,viewport={'width':390,'height':844},is_mobile=True,has_touch=True);Bc=ctx(br,viewport={'width':1280,'height':800});Cc=ctx(br,viewport={'width':1280,'height':800})
  ped=page(A,'pedestrian.html','#list .card');ped.wait_for_timeout(4000);exp(ped)
  st=ped.evaluate("getComputedStyle(syncSt).display");print('在線狀態列 display',st);assert st=='none'
  crew=page(Bc,'crew.html?fc=1&day=we&t=15:30','#card[data-state=A] #startBtn');plan=page(Cc,'index.html','#needCard')
  gid=ped.get_attribute('#list .card','data-id');ped.click('[data-full]');t0=time.time()
  crew.wait_for_function(f"(()=>{{const e=E.find(x=>x.b.id==='{gid}'),r=route.find(x=>x.b.id==='{gid}');return e&&e.rep&&r&&r.must&&[...document.querySelectorAll('#mustList li')].some(l=>l.querySelector('.repby'))}})()",timeout=5000);tF=time.time()-t0
  crew.screenshot(path='/workspace/cloud_crew_full.png')
  ped.click('#repUndo');t0=time.time();crew.wait_for_function(f"!E.find(x=>x.b.id==='{gid}').rep&&![...document.querySelectorAll('#mustList li,#list li')].some(l=>l.querySelector('.repby'))",timeout=5000);tU=time.time()-t0
  print(f'雲端 滿了→清潔隊 {tF*1000:.0f}ms，取消→清潔隊 {tU*1000:.0f}ms')
  crew.click('#startBtn');crew.wait_for_selector('#card[data-state=B] [data-amt]');rid=crew.evaluate("route[0].b.id")
  ped.evaluate(f"focusBin(shown().find(b=>b.id==='{rid}')||D.street.find(b=>b.id==='{rid}'))");ped.wait_for_timeout(1700);v1=ped.evaluate("[map.getZoom(),map.getCenter().lat]")
  crew.click('#card [data-amt=half]');t0=time.time()
  ped.wait_for_function(f"fillOf('{rid}',getEvents())===0&&document.querySelector('#list').textContent.includes('已清運・剛剛・清潔隊回報')",timeout=2000);tC=time.time()-t0
  v2=ped.evaluate("[map.getZoom(),map.getCenter().lat]");ped.screenshot(path='/workspace/cloud_ped_cleared.png');print(f'雲端 清運→行人轉綠 {tC*1000:.0f}ms 不 fit',v1==v2);assert tC<2 and v1==v2
  n0=plan.evaluate("getNeeds().length");ped.wait_for_timeout(1600);ped.click('#needBtn');t0=time.time()
  plan.wait_for_function(f"getNeeds().length==={n0+1}&&document.querySelector('#needCard').textContent.includes('{n0+1}')",timeout=5000);tN=time.time()-t0
  plan.screenshot(path='/workspace/cloud_planner_need.png');print(f'雲端 需求→規劃頁 {tN*1000:.0f}ms',plan.inner_text('#needCard')[:40].replace('\n',' '))
  # 離線：清潔隊斷線 → 狀態「離線・本機」→ 本機照常；行人在線回報 → 清潔隊重新連線後補上；清潔隊離線時寫的事件重連後上傳
  Bc.set_offline(True);crew.evaluate("Cloud._off&&Cloud._off()");crew.wait_for_function("document.documentElement.dataset.sync==='local'",timeout=8000);so=crew.inner_text('#syncSt .r');print('離線狀態',so);assert so.startswith('離線・本機')
  rid2=crew.evaluate("route.find(e=>!getEvents().some(x=>x.bin===e.b.id&&x.kind==='clear')).b.id");crew.click('#card [data-amt=full]');crew.wait_for_timeout(500)
  assert crew.evaluate(f"getEvents().some(e=>e.bin==='{rid2}'&&e.kind==='clear')") and crew.evaluate("cloudQ().length")>=1
  ped.wait_for_timeout(1600);ped.evaluate(f"focusBin(shown().find(b=>b.id==='{gid}'))");ped.wait_for_timeout(300);exp(ped);ped.click('[data-full]');ped.wait_for_timeout(800)
  assert not crew.evaluate(f"E.find(x=>x.b.id==='{gid}').rep")
  Bc.set_offline(False);crew.evaluate("Cloud._on&&Cloud._on()");t0=time.time()
  crew.wait_for_function(f"document.documentElement.dataset.sync==='live'&&cloudQ().length===0&&E.find(x=>x.b.id==='{gid}').rep",timeout=15000);tR=time.time()-t0
  ped.wait_for_function(f"getEvents().some(e=>e.bin==='{rid2}'&&e.kind==='clear')",timeout=5000);print(f'重連後補齊 {tR*1000:.0f}ms；清潔隊 B 狀態',crew.get_attribute('#card','data-state'))
  crew.screenshot(path='/workspace/cloud_crew_reconnect.png')
  print('ERRORS',errs);ok&=not errs;br.close()
print('PASS' if ok else 'FAIL')
