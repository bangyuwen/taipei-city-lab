import argparse,functools,hashlib,json,threading
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,required=True);args=parser.parse_args()
root=args.root.resolve();out=root/'.impeccable/review/answers';out.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root/'dist')))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
origin=f'http://127.0.0.1:{server.server_port}/';errors=[];checks=[];captures={}
def capture(page,name):
    page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(out/name),full_page=True)
    captures[name]=hashlib.sha256((out/name).read_bytes()).hexdigest()
try:
  with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for device,width in [('desktop',1440),('mobile',390),('narrow',320)]:
      context=browser.new_context(viewport={'width':width,'height':1000 if width==1440 else 844},is_mobile=width<500,has_touch=width<500,accept_downloads=True)
      context.route('https://tile.openstreetmap.org/**',lambda r:r.abort())
      page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
      topics=['','bins','shade','rat','traffic','bus','buildings','audit'] if width!=320 else ['','bins']
      for topic in topics:
        page.goto(origin+('#'+topic if topic else ''),wait_until='domcontentloaded')
        page.wait_for_function("document.getElementById('loading').hidden && document.getElementById('answer-title')")
        page.evaluate('document.fonts.ready');page.wait_for_timeout(100)
        assert page.get_by_role('heading',level=1).count()==1
        assert page.locator('#answer-title').is_visible()
        assert page.locator('#answer-title').evaluate('e=>e.getBoundingClientRect().bottom<innerHeight'),(device,topic,'headline below viewport')
        assert not page.locator('#research-workbench').evaluate('e=>e.open')
        assert page.locator('#scene-panel canvas').count()==0
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(device,topic,'overflow')
        checks.append({'device':device,'topic':topic or 'home','conclusionVisible':True,'workbenchClosed':True,'noCanvasBeforeOpen':True,'noOverflow':True})
        capture(page,f'{device}-{topic or "home"}.png')
      page.goto(origin+'#bins',wait_until='domcontentloaded');page.wait_for_selector('#answer-title')
      page.locator('.model-answer>summary').click();page.wait_for_timeout(100)
      capture(page,f'{device}-bins-comparison.png')
      with page.expect_download() as download:
        page.get_by_role('button',name='匯出此題結論與證據',exact=True).click()
      exported=json.loads(Path(download.value.path()).read_text())
      assert exported['snapshot']['count']==294 and exported['params']['budget']==20
      page.locator('#research-workbench>summary').click();page.locator('#viewmode-2d').click()
      page.wait_for_selector('#visualization .chart-svg')
      page.locator('#control-budget').fill('5');page.wait_for_timeout(180)
      with page.expect_download() as download:
        page.get_by_role('button',name='匯出此題結論與證據',exact=True).click()
      changed=json.loads(Path(download.value.path()).read_text());assert changed['params']['budget']==5
      assert changed['metrics'][1]['value']==5
      checks.append({'device':device,'exportsReproducible':True,'changedConditionsReflected':True})
      page.wait_for_function("!document.getElementById('toast').classList.contains('visible')");page.wait_for_timeout(220)
      page.locator('#analysis').scroll_into_view_if_needed();page.screenshot(path=str(out/f'{device}-workbench.png'),full_page=False)
      captures[f'{device}-workbench.png']=hashlib.sha256((out/f'{device}-workbench.png').read_bytes()).hexdigest()
      page.locator('#research-workbench>summary').click();assert page.locator('#scene-panel canvas').count()==0
      if width!=320:
        page.goto(origin+'#audit',wait_until='domcontentloaded');page.wait_for_selector('#csv-example');page.locator('#csv-example').click()
        page.wait_for_function("document.getElementById('answer-title').textContent.includes('CSV')")
        assert page.locator('#research-answer').inner_text().find('不代表已回答')>=0
        page.wait_for_function("!document.getElementById('toast').classList.contains('visible')");page.wait_for_timeout(220)
        capture(page,f'{device}-csv-answer.png')
        page.locator('#audit-question').fill('新的研究問題')
        page.wait_for_function("document.querySelector('.answer-status').textContent==='目前輸入尚未檢查'")
        assert '已檢查 4 列' not in page.locator('#research-answer').inner_text()
        with page.expect_download() as download:
          page.get_by_role('button',name='匯出此題結論與證據',exact=True).click()
        pending=json.loads(Path(download.value.path()).read_text());assert pending['pendingAudit'] and 'csv' not in pending
        page.wait_for_function("!document.getElementById('toast').classList.contains('visible')");page.wait_for_timeout(220)
        capture(page,f'{device}-csv-pending.png')
        checks.append({'device':device,'pendingAuditWithdrawsCheckedAnswer':True,'pendingExportMatchesView':True})
      context.close()
    browser.close()
  assert not errors,errors
  sources=['dist/index.html','dist/app.js','dist/answers.js','dist/styles.css','dist/fonts/city-serif.woff','dist/fonts/provenance.json']
  manifest={'scope':'Answer-first research presentation; local Chromium, emulated touch; external tiles blocked.','checks':checks,'pageErrors':errors,'captures':captures,'sourceSHA256':{s:hashlib.sha256((root/s).read_bytes()).hexdigest() for s in sources}}
  (out/'results.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
  print(json.dumps({'checks':len(checks),'captures':len(captures),'pageErrors':errors}))
finally:
  server.shutdown();server.server_close();thread.join()
