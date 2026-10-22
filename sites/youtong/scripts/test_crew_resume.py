# 清潔隊路線進度：完成 1、2 → 導航到 3；3 回報後復原；再回報 → 4；重新整理仍在 4（含手機時鐘比伺服器快 2 分鐘）。需要 Firebase emulator。用法：python3 scripts/test_crew_resume.py http://127.0.0.1:8765/ /tmp/ [skew_ms]
from playwright.sync_api import sync_playwright
import json,sys
B=sys.argv[1];O=sys.argv[2];SKEW=int(sys.argv[3]) if len(sys.argv)>3 else 120000
EMU="window.FB_TEST={emu:'127.0.0.1:9000',config:{projectId:'demo-youtong',databaseURL:'http://127.0.0.1:9000?ns=demo-youtong-default-rtdb'}}"
if 'github.io' in B: EMU="window.FB_TEST={config:{}}"
SK="(()=>{const n=Date.now.bind(Date);Date.now=()=>n()+%d})()"%SKEW  # 手機時鐘比伺服器快
with sync_playwright() as pw:
  br=pw.chromium.launch();c=br.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,geolocation={'latitude':25.0149,'longitude':121.5344,'accuracy':10},permissions=['geolocation'])
  c.add_init_script(SK);c.add_init_script(EMU);c.add_init_script("if(!sessionStorage.getItem('t0')){localStorage.clear();sessionStorage.setItem('t0','1')}")
  p=c.new_page();e=[];p.on('pageerror',lambda x:e.append(str(x)));p.on('console',lambda m:m.type=='error' and e.append(m.text))
  p.goto(B+'crew.html');p.wait_for_selector('#startBtn',timeout=30000);p.wait_for_timeout(800);p.tap('#startBtn');p.wait_for_timeout(500)
  p.evaluate("card.classList.contains('collapsed')||document.getElementById('grab').click(),0");p.tap('#navPri');p.wait_for_function("NAV&&!NAV.loading",timeout=15000)
  R={};st=lambda:p.evaluate("({nav:NAV&&NAV.idx,mode:NAV&&NAV.mode,ci:curIdx(),prog:prog.querySelector('.no')&&prog.querySelector('.no').innerText,bar:(document.getElementById('navBar')||{}).innerText})")
  def rep(k=2):
    b=p.evaluate("[NAV.bin.la,NAV.bin.lo]");c.set_geolocation({'latitude':b[0]+0.00005,'longitude':b[1],'accuracy':8});p.evaluate("NAV.acc=8,navArrOpen(),0");p.wait_for_timeout(200);p.tap(f'#navArr [data-amt]:nth-child({k})');p.wait_for_timeout(2500)
  rep();p.wait_for_function("NAV&&!NAV.loading",timeout=15000);rep();p.wait_for_function("NAV&&!NAV.loading",timeout=15000);p.wait_for_timeout(1500)
  R['at3']=st();p.screenshot(path=O+'crew_390_resume_at3.png')
  rep();p.tap('.undo button');p.wait_for_timeout(2500);R['afterUndo']=st();p.screenshot(path=O+'crew_390_resume_after_undo.png')
  p.tap('#navArr [data-amt]:nth-child(2)');p.wait_for_timeout(600);p.wait_for_function("NAV&&!NAV.loading",timeout=15000);p.wait_for_timeout(2500)
  R['at4']=st();p.screenshot(path=O+'crew_390_resume_at4.png')
  p.reload();p.wait_for_function("route.length&&typeof curIdx==='function'",timeout=30000);p.wait_for_timeout(2500)
  R['reloadCard']=p.evaluate("cardBody.innerText.slice(0,40)");p.evaluate("card.classList.contains('collapsed')||document.getElementById('grab').click(),0");p.wait_for_timeout(300)
  p.tap('#navPri');p.wait_for_function("NAV&&!NAV.loading",timeout=15000);p.wait_for_timeout(800)
  R['afterReload']=st();p.screenshot(path=O+'crew_390_resume_after_reload.png')
  p.tap('#navEnd');p.wait_for_timeout(500);p.tap('#navPri');p.wait_for_function("NAV&&!NAV.loading",timeout=15000);R['endRestart']=st()
  R['tapDoneStop']=p.evaluate("(()=>{let m=null;rtL.eachLayer(l=>{if(l.getPopup&&l.getPopup()&&/已完成/.test(l.getPopup().getContent()))m=m||l});if(!m)return 'no popup';m.fire('click');return [NAV&&NAV.idx,!!document.querySelector('.leaflet-popup')]})()")
  R['errs']=e;print(json.dumps(R,ensure_ascii=False))
  ok=R['at3']['nav']==2 and R['afterUndo']['nav']==2 and R['afterUndo']['mode']=='arrive' and R['at4']['nav']==3 and R['afterReload']['nav']==3 and R['endRestart']['nav']==3 and not e
  print('RESUME', 'PASS' if ok else 'FAIL');sys.exit(0 if ok else 1)
