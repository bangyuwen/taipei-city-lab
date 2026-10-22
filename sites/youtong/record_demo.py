# 錄製 2 分鐘 Demo 備援影片（1280x800）：設點規劃熱點 → A/B/C → 行人前後 → 清潔隊告警與清運
import shutil,glob,os
from playwright.sync_api import sync_playwright
B='http://localhost:8765/';W=lambda pg,ms:pg.wait_for_timeout(ms)
with sync_playwright() as p:
  br=p.chromium.launch();c=br.new_context(viewport={'width':1280,'height':800},record_video_dir='/tmp/vid',record_video_size={'width':1280,'height':800},locale='zh-TW')
  pg=c.new_page()
  pg.goto(B+'index.html');pg.evaluate("localStorage.clear()");pg.reload();pg.wait_for_selector('#hot .card');W(pg,9000)
  pg.mouse.wheel(0,0);pg.locator('.panel').evaluate("e=>e.scrollTo({top:260,behavior:'smooth'})");W(pg,7000)
  pg.locator('[data-vs="0"]').click();W(pg,9000);pg.click('#bk');W(pg,2000)
  pg.check('#lyAnc');W(pg,4000)
  pg.locator('[data-vs="1"]').click();W(pg,7000)
  for o in 'ABC': pg.click(f'[data-o="{o}"]');W(pg,9000)
  pg.locator('.panel').evaluate("e=>e.scrollTo({top:400,behavior:'smooth'})");W(pg,8000)
  pg.click('#adopt');W(pg,5000)
  pg.click('.roles a[href="pedestrian.html"]');pg.wait_for_selector('#list .card');W(pg,8000)
  W(pg,3000)  # 行人頁只顯示現況；示範位置捷運公館站公車站（示範區內，最近桶是清潔隊頁 43 桶之一）
  pg.click('[data-full]');W(pg,5000)
  pg.click('.roles a[href="crew.html"]');pg.wait_for_selector('#next [data-amt]');W(pg,8000)
  pg.click('#next [data-amt=full]');W(pg,4000);pg.click('#next [data-amt=half]');W(pg,4000);pg.click('#menu');W(pg,5000)
  pg.click('#thSeg label:has([value="100"])');W(pg,3000);pg.click('#thSeg label:has([value="70"])');W(pg,3000)  # 清運範圍：只清滿溢 ↔ 快滿了以上
  v=pg.video.path();c.close();br.close()
shutil.copy(v,'/workspace/demo-backup.webm');print('saved',os.path.getsize('/workspace/demo-backup.webm'))
