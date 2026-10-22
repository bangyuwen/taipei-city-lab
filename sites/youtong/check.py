from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':1000,'height':900})  # no geolocation permission -> fallback
    pg=c.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(9000); print("status:",pg.inner_text("#status"), errs)
    pg.wait_for_timeout(2500)
    print(pg.inner_text('#panel')); print('errors:',errs)
    pg.screenshot(path='screenshot.png'); b.close()
