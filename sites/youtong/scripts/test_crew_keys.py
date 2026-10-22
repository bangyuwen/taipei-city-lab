# localStorage 鍵名：taipei-city-lab 版（sites/youtong/）一律用「有桶tcl_」前綴，不會寫入正式站「有桶_」或 beta「有桶beta_」的鍵；
# ?reset=1 只清本站前綴，同網域其他版本的鍵保持不動。
# 用法（在 taipei-city-lab 根目錄起 static server）：python3 sites/youtong/scripts/test_crew_keys.py http://127.0.0.1:8765/sites/youtong/
from playwright.sync_api import sync_playwright
import json,sys,re
B=sys.argv[1].rstrip('/')+'/'
with sync_playwright() as pw:
  br=pw.chromium.launch();c=br.new_context(viewport={'width':390,'height':844});c.add_init_script("window.FB_TEST={config:{}}")
  p=c.new_page();e=[];p.on('pageerror',lambda x:e.append(str(x)))
  p.goto(B+'crew.html');p.evaluate("localStorage.setItem('有桶_crew_ui_v2','prod');localStorage.setItem('有桶beta_crew_ui_v2','beta')")
  p.reload();p.wait_for_selector('#startBtn',timeout=30000);p.wait_for_timeout(500);p.click('#startBtn');p.wait_for_timeout(300)
  p.evaluate("record(route[0].b.id,'full',100),0");p.wait_for_timeout(300)
  kp=p.evaluate("KP");keys=p.evaluate("Object.keys(localStorage).filter(k=>/crew/.test(k)).sort()")
  p.goto(B+'crew.html?reset=1');p.wait_for_timeout(1500)
  after=p.evaluate("Object.keys(localStorage).sort()");c.close()
  print(json.dumps({'kp':kp,'keys':keys,'after':after,'err':e},ensure_ascii=False))
  day=r'\d{4}-\d{2}-\d{2}'
  ok=(kp=='有桶tcl_' and '有桶tcl_crew_ui_v2' in keys and any(re.match(r'^有桶tcl_crewprog_v1\|'+day+r'\|B',k) for k in keys)
      and '有桶_crew_ui_v2' in after and '有桶beta_crew_ui_v2' in after and not any('crewprog' in k for k in after) and not e)
  print('KEYS','PASS' if ok else 'FAIL');sys.exit(0 if ok else 1)
