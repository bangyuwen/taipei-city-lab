# 管理員清空雲端（模擬器）：兩個在線設定檔＋一個離線且有待上傳 → wipe → 全部乾淨、不重新上傳
import sys,os,time,json,subprocess,urllib.request
from playwright.sync_api import sync_playwright
B=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8765/'
INIT="window.FB_TEST={emu:'127.0.0.1:9000',config:{projectId:'demo-youtong',databaseURL:'http://127.0.0.1:9000?ns=demo-youtong-default-rtdb'}}"
ENV={**os.environ,'FIREBASE_DATABASE_EMULATOR_HOST':'127.0.0.1:9000','DB_URL':'http://127.0.0.1:9000?ns=demo-youtong-default-rtdb'}
def wipe():r=subprocess.run(['node','scripts/wipe-cloud.mjs','--yes'],env=ENV,capture_output=True,text=True);assert r.returncode==0,r.stderr;return r.stdout.strip().replace('\n',' ')
def cloud(n):return json.load(urllib.request.urlopen(f'http://127.0.0.1:9000/{n}.json?ns=demo-youtong-default-rtdb'))
errs=[];ok=True
def page(c,url,sel):
  p=c.new_page();p.on('pageerror',lambda e:errs.append(str(e)));p.goto(B+url);p.wait_for_selector(sel,timeout=20000);p.wait_for_function("document.documentElement.dataset.sync==='live'",timeout=15000);return p
def exp(p):
  if p.evaluate("typeof collapsed!=='undefined'&&collapsed"):p.click('#cardTog');p.wait_for_timeout(300)
S="[getEvents().length,getNeeds().length,cloudQ().length]"
with sync_playwright() as pw:
  br=pw.chromium.launch();mk=lambda **o:(lambda c:(c.add_init_script(INIT),c)[1])(br.new_context(locale='zh-TW',**o))
  print('初始清空',wipe())
  A=mk(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);Bc=mk(viewport={'width':1280,'height':800});Cc=mk(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  ped=page(A,'pedestrian.html','#list .card');crew=page(Bc,'crew.html?fc=1&day=we&t=15:30','#card[data-state=A] #startBtn');off=page(Cc,'pedestrian.html','#list .card')
  ped.wait_for_timeout(3000);exp(ped);ped.click('[data-full]');ped.wait_for_timeout(1700);ped.click('#needBtn');ped.wait_for_timeout(1700)
  crew.click('#startBtn');crew.wait_for_selector('#card[data-state=B] [data-amt]');crew.click('#card [data-amt=half]');crew.wait_for_timeout(1500)
  off.wait_for_timeout(1500);exp(off)
  Cc.set_offline(True);off.evaluate("Cloud._off()");off.wait_for_function("document.documentElement.dataset.sync==='local'",timeout=8000)
  oid=off.evaluate("nearestN(shown(),3)[1].f.id");off.evaluate(f"focusBin(shown().find(b=>b.id==='{oid}'))");off.wait_for_timeout(400);exp(off);off.click('[data-full]');off.wait_for_timeout(300);off.click('#needBtn');off.wait_for_timeout(500)
  before={'行人':ped.evaluate(S),'清潔隊':crew.evaluate(S),'離線':off.evaluate(S),'雲端 events':len(cloud('events') or {}),'雲端 needs':len(cloud('needs') or {})};print('清空前 [事件,需求,待上傳]',before)
  assert before['行人'][0]>=2 and before['離線'][2]>=1 and before['雲端 events']>=2
  ped.screenshot(path='/workspace/wipe_ped_before.png');crew.screenshot(path='/workspace/wipe_crew_before.png');off.screenshot(path='/workspace/wipe_offline_before.png')
  t0=time.time();print('管理員清空',wipe())
  ped.wait_for_function(f"(()=>{{const s={S};return s[0]===0&&s[1]===0&&s[2]===0}})()",timeout=8000);crew.wait_for_function(f"getEvents().length===0&&!document.querySelector('.repby')",timeout=8000);tW=time.time()-t0
  ped.wait_for_timeout(800);exp(ped)
  pa=ped.evaluate("[!!document.querySelector('[data-full]'),document.querySelectorAll('.binmk.rep').length,document.querySelector('#list').textContent.includes('有人回報滿了')]");print(f'在線兩個設定檔清乾淨 {tW*1000:.0f}ms；行人卡片又可回報、紅桶數、回報字樣',pa,'清潔隊',crew.evaluate(S),crew.get_attribute('#card','data-state'))
  ped.screenshot(path='/workspace/wipe_ped_after.png');crew.screenshot(path='/workspace/wipe_crew_after.png')
  Cc.set_offline(False);off.evaluate("Cloud._on()");off.wait_for_timeout(5000);print("DBG",off.evaluate(S),off.evaluate("[localStorage.getItem(\"有桶tcl_epoch_v1\"),document.documentElement.dataset.sync,JSON.stringify(cloudQ()),JSON.stringify(getEvents())]"),cloud("events"));off.wait_for_function(f"(()=>{{const s={S};return s[0]===0&&s[1]===0&&s[2]===0}})()",timeout=10000);off.wait_for_timeout(4000)
  ce,cn=cloud('events'),cloud('needs');print('離線設定檔重連後',off.evaluate(S),'雲端 events',ce,'needs',cn,'meta',cloud('meta'))
  off.screenshot(path='/workspace/wipe_offline_after_reconnect.png')
  assert pa[0] and pa[1]==0 and not pa[2] and not ce and not cn
  # 清空後仍可正常回報
  ped.click('[data-full]');crew.wait_for_function("getEvents().length===1",timeout=6000);print('清空後新回報同步 OK',cloud('events') and len(cloud('events')))
  print('ERRORS',errs);ok&=not errs;br.close()
print('PASS' if ok else 'FAIL')
