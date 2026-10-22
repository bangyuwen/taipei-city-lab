# 兩個瀏覽器：A 完成 1、2 站，B 仍從第 1 站開始（進度只在本機）。需要 Firebase emulator。用法：python3 scripts/test_crew_progress_local.py http://127.0.0.1:8765/
from playwright.sync_api import sync_playwright
import json,sys
B=sys.argv[1]
EMU="window.FB_TEST={emu:'127.0.0.1:9000',config:{projectId:'demo-youtong',databaseURL:'http://127.0.0.1:9000?ns=demo-youtong-default-rtdb'}}"
if 'github.io' in B: EMU="window.FB_TEST={config:{}}"
with sync_playwright() as pw:
  br=pw.chromium.launch();R={};errs=[]
  def mk():
    c=br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);c.add_init_script(EMU);c.add_init_script("localStorage.clear()")
    p=c.new_page();p.on('pageerror',lambda x:errs.append(str(x)));p.goto(B+'crew.html');p.wait_for_selector('#startBtn',timeout=30000);p.wait_for_timeout(800);p.tap('#startBtn');p.wait_for_timeout(500);return c,p
  ca,a=mk();cb,b=mk()
  R['B_route0']=b.evaluate("route.slice(0,3).map(e=>e.b.id)")
  a.evaluate("record(route[0].b.id,'full',100),record(route[1].b.id,'half',50),0");a.wait_for_timeout(3000)
  R['A']=a.evaluate("({ci:curIdx(),prog:prog.querySelector('.no').innerText,cloud:getEvents().filter(e=>e.kind==='clear').length})")
  b.wait_for_timeout(1500)
  R['B_sawA_events']=b.evaluate("getEvents().filter(e=>e.kind==='clear').length")
  R['B']=b.evaluate("({ci:curIdx(),prog:prog.querySelector('.no').innerText,route0:route.slice(0,3).map(e=>e.b.id)})")
  b.reload();b.wait_for_function("route.length",timeout=30000);b.wait_for_timeout(1500)
  R['B_reload']=b.evaluate("({ci:curIdx(),prog:(prog.querySelector('.no')||{}).innerText,keys:Object.keys(localStorage).filter(k=>k.includes('crewprog'))})")
  R['errs']=errs;print(json.dumps(R,ensure_ascii=False))
  ok=R['A']['ci']==2 and R['B']['ci']==0 and R['B_reload']['ci']==0 and R['B_sawA_events']>=2 and not errs
  print('TWOCTX','PASS' if ok else 'FAIL');sys.exit(0 if ok else 1)
