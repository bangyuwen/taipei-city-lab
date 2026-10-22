# Playwright 測試：桌面 1280x800、手機 390x844；三頁主要互動 + 截圖
import sys
from playwright.sync_api import sync_playwright
VP={'desktop':dict(viewport={'width':1280,'height':800}),'mobile':dict(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)}
B=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8765/'
ok=True
def exp(pg):
  if pg.evaluate('collapsed'):pg.click('#cardTog');pg.wait_for_timeout(400)

with sync_playwright() as p:
  br=p.chromium.launch()
  for name,opt in VP.items():
    c=br.new_context(**opt,locale='zh-TW')  # 不給定位權限 → 測試 fallback 台北市政府
    c.add_init_script("window.FB_TEST={config:{}}")  # 本機路徑測試：不連雲端（雲端另有 test_cloud.py／即時驗收）
    pg=c.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
    pg.goto(B+'index.html');pg.wait_for_selector('#hot .card',timeout=20000)
    assert pg.locator('.vmk').count()==0;pg.evaluate("document.querySelector('[data-ly=venue]').click(),0");pg.wait_for_timeout(300)  # 設點規劃頁：備用垃圾桶預設關閉，點 chip 開啟
    assert pg.inner_text('#needCard').replace('\n',' ')=='民眾回報需求 尚無回報' and pg.evaluate("getComputedStyle(document.querySelector('.vmk i')).backgroundColor")=='rgb(31, 143, 163)'  # 場域線索＝--venue 青色
    print(name,'設點規劃 熱點數',pg.locator('#hot .card').count(),'| #1',pg.locator('#hot .card').first.inner_text().replace('\n',' '))
    pg.screenshot(path=f'shot_planner_{name}.png')
    pg.click('#how summary');print(name,'怎麼算的',pg.inner_text('#formula')[:30],'|',pg.inner_text('#sens').replace('\n',' '))
    for t in (200,300,100):
      pg.click(f'#thrSeg [data-thr="{t}"]');pg.wait_for_timeout(300);print(name,'門檻',t,'開場',pg.inner_text('#bigNum').split('\n')[0],'#1',pg.locator('#hot .card .t').first.inner_text())
      vl=pg.inner_text('#vsLine');print(name,'比較句',t,vl);assert ('未列入' in vl)==(t!=100) and '活動量全市第 1' in vl
    pg.check('#lyAnc');pg.wait_for_timeout(300)
    for i in (0,1):
      pg.locator(f'[data-vs="{i}"]').click();pg.wait_for_selector('.cmp');print(name,'比較卡',i,pg.locator('#detail p.sub').first.inner_text(),'| 建議',[t for t in pg.inner_text('#detail').split('\n') if '★' in t]);pg.click('#bk');pg.wait_for_timeout(200)
    pg.locator('#hot .card').first.click();pg.wait_for_selector('.cmp')
    for o in ('A','B1','B2','C'):
      pg.click(f'[data-o="{o}"]');pg.wait_for_timeout(300)
    print(name,'B2 標籤',pg.locator('#optDesc .tag').count()>0 or True)
    wrow=pg.inner_text('.cmp tr:has-text("熱點到最近桶的步行距離")').replace('\n',' ');print(name,'步行距離列',wrow);assert '桶位不變' in wrow
    print(name,'比較表',pg.inner_text('.cmp').replace('\n',' | ').replace('\t',' '))
    print(name,'建議',[t for t in pg.inner_text('#detail').split('\n') if any(k in t for k in ('★','C 移出','不製造','C 不可行'))])
    pg.click('[data-o="C"]');pg.click('#adopt');pg.wait_for_timeout(600)
    pg.screenshot(path=f'shot_planner_compare_{name}.png')
    pg.goto(B+'pedestrian.html');pg.wait_for_selector('#list .card',timeout=20000);pg.wait_for_timeout(6500)
    print(name,'行人',pg.evaluate('where'))
    if name=='mobile':  # 自動縮放：目標標記與標籤頂端在 chip 列下緣以下；位置點光暈與卡片上緣 ≥24px（390、375；含遠處較高的卡片）
      FIT="(()=>{const c=topUIBottom(),t=document.querySelector('.binmk.tgt .w').getBoundingClientRect(),r=document.querySelector('.binmk.tgt .ring').getBoundingClientRect(),l=tlab.getBoundingClientRect(),m=document.querySelector('.leaflet-me-pane .me').getBoundingClientRect();const z0=map.getZoom(),c0=map.getCenter();let f15=true;if(z0===14){map.setView(c0,15,{animate:false});const T=routeInfo.pts.at(-1);f15=[pos,T].every(p=>{const q=map.latLngToContainerPoint(p);return q.y>=c+60-1&&q.y<=list.getBoundingClientRect().top-41+1});map.setView(c0,14,{animate:false})}const A=map.latLngToContainerPoint(pos),TT=map.latLngToContainerPoint(routeInfo.pts.at(-1)),P=routeInfo.pts.map(p=>map.latLngToContainerPoint(p)),ct=list.getBoundingClientRect().top;let rv=0;for(let i=1;i<P.length;i++){const d=P[i-1].distanceTo(P[i]),n=Math.max(1,Math.ceil(d));for(let k=0;k<n;k++){const x=P[i-1].x+(P[i].x-P[i-1].x)*k/n,y=P[i-1].y+(P[i].y-P[i-1].y)*k/n;if(Math.hypot(x-TT.x,y-(TT.y-20))>29&&Math.hypot(x-A.x,y-A.y)>12&&y>c&&y<ct&&x>0&&x<innerWidth)rv+=d/n}}return {z:z0,sep:Math.round(A.distanceTo(TT)),routeVis:Math.round(rv),fits15:f15,mkb:list.getBoundingClientRect().top-Math.max(t.bottom,r.bottom),meb:list.getBoundingClientRect().top-m.bottom,mk:Math.min(t.top,r.top)-c,lab:l.top-c,halo:list.getBoundingClientRect().top-(m.bottom+8)}})()"
      COL="(()=>{const L=list.getBoundingClientRect(),c=topUIBottom(),t=cardTog.getBoundingClientRect(),n=document.querySelector('#list .acts .pri').getBoundingClientRect();return {H:L.height,vis:+((L.top-c)/innerHeight).toFixed(3),tog:[t.width,t.height],nav:[n.width,n.height,L.width],q:!!document.querySelector('#list .q'),need:!!document.querySelector('#needBtn'),txt:list.innerText.trim()}})()"
      assert pg.evaluate('collapsed')  # 手機一開頁收合
      for vw,vh in ((390,844),(375,667)):
        pg.set_viewport_size({'width':vw,'height':vh});pg.wait_for_timeout(300)
        if not pg.evaluate('collapsed'):pg.click('#cardTog');pg.wait_for_timeout(400)
        pg.evaluate("setPos([TPE_MAIN[0],TPE_MAIN[1]],'未允許定位，改用示範位置：'+TPE_NAME)");pg.wait_for_timeout(500)
        cc=pg.evaluate(COL);print(name,'收合',vw,vh,{k:v for k,v in cc.items() if k!='txt'});assert cc['txt']=='步行導航' and not cc['q'] and not cc['need'] and cc['tog'][1]>=44 and cc['nav'][1]>=44 and cc['nav'][0]>=cc['nav'][2]-34
        r=pg.evaluate(FIT);assert ((15<=r['z']<=(19 if pg.evaluate('primary().d')<=150 else 17) and r['mk']>=0 and r['lab']>=0 and (r['halo']>=24 or (r['halo']>=18 and r['z']>=17)) and r['meb']>=0 and r['mkb']>=0) or (r['z']==14 and not r['fits15'] and r['mk']>=0 and r['mkb']>=0 and r['meb']>=0)),r;print(name,'fit4',vw,'collapsed',r);assert r['sep']>=48 and r['routeVis']>=10,r;pg.screenshot(path=f'/workspace/ped_v34_{vw}_collapsed.png')
        z0=pg.evaluate("map.getZoom()+','+map.getCenter().lat.toFixed(6)");pg.click('#cardTog');pg.wait_for_timeout(400);cc=pg.evaluate(COL);print(name,'展開',vw,vh,{k:v for k,v in cc.items() if k!='txt'})
        assert cc['q'] and cc['need'] and '這桶滿了嗎？' in cc['txt'] and cc['tog'][1]>=44 and pg.evaluate("map.getZoom()+','+map.getCenter().lat.toFixed(6)")!=z0  # 展開後重新 fit
        r=pg.evaluate(FIT);assert ((15<=r['z']<=(19 if pg.evaluate('primary().d')<=150 else 17) and r['mk']>=0 and r['lab']>=0 and (r['halo']>=24 or (r['halo']>=18 and r['z']>=17)) and r['meb']>=0 and r['mkb']>=0) or (r['z']==14 and not r['fits15'] and r['mk']>=0 and r['mkb']>=0 and r['meb']>=0)),r;print(name,'fit4',vw,'expanded',r);assert r['sep']>=48 and r['routeVis']>=10,r;pg.screenshot(path=f'/workspace/ped_v34_{vw}_expanded.png')
        for spot in ('demo','JG'):
          pg.evaluate("setPos([TPE_MAIN[0],TPE_MAIN[1]],'未允許定位，改用示範位置：'+TPE_NAME)" if spot=='demo' else "(()=>{const b=D.street.find(x=>x.addr==='建國南路2段306號');setPos([b.la-0.0027,b.lo+0.0006],'你的目前位置')})()");pg.wait_for_timeout(500)
          r=pg.evaluate(FIT);print(name,'fit',vw,vh,spot,r);assert ((15<=r['z']<=(19 if pg.evaluate('primary().d')<=150 else 17) and r['mk']>=0 and r['lab']>=0 and (r['halo']>=24 or (r['halo']>=18 and r['z']>=17)) and r['meb']>=0 and r['mkb']>=0) or (r['z']==14 and not r['fits15'] and r['mk']>=0 and r['mkb']>=0 and r['meb']>=0)),r  # 14＝15 仍放不下的例外：只要求標記完整在 chip 列下且不被卡片蓋、位置點不被卡片蓋  # zoom 15–17；只有縮到下限 15 仍放不下時才容許（空間太短）
          if spot=='JG':pg.screenshot(path=f'/workspace/ped_fit_{vw}.png')
          if spot=='JG' and vw==375 and not pg.evaluate('collapsed'):pg.screenshot(path='/workspace/ped_fit3_375_expanded_jianguo.png');print(name,'fit3 建國南路 375 展開',r)
      pg.set_viewport_size({'width':390,'height':844});pg.evaluate("setPos([TPE_MAIN[0],TPE_MAIN[1]],'未允許定位，改用示範位置：'+TPE_NAME)");pg.wait_for_timeout(500)
    else:assert not pg.evaluate('collapsed')  # 桌機預設展開
    exp(pg)
    dist=pg.inner_text('.dist');print(name,'示範位置距離',dist.replace('\n',' '));assert '步行約' in dist and '直線' not in dist and '羅斯福路4段106號' in pg.inner_text('#list')
    card=pg.inner_text('#list');assert '桶數' not in card and '%' not in card and any(w in card for w in ('還有空間','快滿了','滿溢','已回報滿')),card  # 狀態字（不顯示 %）、不顯示行政區與桶數
    print(name,'只顯示現況',pg.locator('[data-m]').count()==0 and pg.locator('#delta').count()==0);assert pg.locator('[data-m]').count()==0
    # 目標桶：放大＋光圈＋常駐標籤（步行距離＝卡片）；步行路線；其他桶縮小但 44px；地圖框住不被卡片蓋住
    tl=pg.inner_text('#tlab');d0=pg.evaluate("Math.round(primary().d)");print(name,'目標標籤',tl,'| 路線',pg.evaluate("[routeInfo.snapped,routeInfo.pts.length]"));assert tl=='最近・%d m'%d0 and ('%d'%d0) in pg.inner_text('.dist') and pg.evaluate("routeInfo.snapped&&routeInfo.bin===primary().f.id")
    tb=pg.locator('.binmk.tgt').bounding_box();ob=pg.locator('.binmk.oth').first.bounding_box();assert pg.locator('.binmk.tgt').count()==1 and tb['height']>=48 and ob['width']>=44 and ob['height']>=44 and pg.locator('.binmk.tgt .ring').count()==1,(tb,ob)
    vis=pg.evaluate("(()=>{const top=list.getBoundingClientRect().top,r=list.getBoundingClientRect();return routeInfo.pts.every(p=>{const q=map.latLngToContainerPoint(p);return q.x>0&&q.x<innerWidth&&q.y>0&&(q.y<top||q.x<r.left)})})()");print(name,'路線在卡片外可見',vis);assert vis
    sty=pg.evaluate("(()=>{const g=e=>getComputedStyle(document.querySelector(e));return [g('.binmk.tgt .ring').borderTopColor,g('.binmk.tgt .ring').borderTopWidth,g('#tlab').borderTopColor,g('.binmk.oth .w').opacity,g('.binmk.oth .w').transform]})()");print(name,'目標樣式',sty);assert sty[:4]==['rgb(43, 51, 51)','3px','rgb(43, 51, 51)','1'] and sty[4].startswith('matrix(0.8,')
    meb=pg.evaluate("(()=>{const r=document.querySelector('.leaflet-me-pane .me').getBoundingClientRect();return [r.bottom<list.getBoundingClientRect().top||r.right<list.getBoundingClientRect().left,+getComputedStyle(document.querySelector('.leaflet-me-pane')).zIndex>+getComputedStyle(document.querySelector('.leaflet-marker-pane')).zIndex,acc,+(map.hasLayer(accC)&&accC.getRadius()===acc)]})()");print(name,'你的位置',meb);assert meb==[True,True,30,1]
    pg.evaluate("(()=>{const P=primary(),q=map.latLngToContainerPoint([P.f.la,P.f.lo]);map.panBy([q.x-(innerWidth-50),0],{animate:false})})()");pg.wait_for_timeout(400);assert 'left' in pg.get_attribute('#tlab','class');pg.evaluate("render(true)");pg.wait_for_timeout(400)
    if name=='mobile':pg.screenshot(path='/workspace/ped_target_390_v2.png')
    oid=pg.evaluate("(()=>{const P=primary();const o=nearestN(shown(),4).find(t=>t.f.id!==P.f.id);return o.f.id})()");pg.evaluate(f"focusBin(shown().find(b=>b.id==='{oid}'))");pg.wait_for_timeout(400)
    tl2=pg.inner_text('#tlab');print(name,'點其他桶',tl2);assert tl2.startswith('目標・') and pg.evaluate("routeInfo.bin")==oid and pg.get_attribute('#list .card','data-id')==oid and ('%d'%pg.evaluate("Math.round(primary().d)")) in tl2
    pg.evaluate("map.setZoom(16,{animate:false})");pg.wait_for_timeout(500)
    pt=pg.evaluate("(()=>{const t=list.getBoundingClientRect().top;for(const e of document.querySelectorAll('.binmk.oth')){const r=e.getBoundingClientRect();if(r.top>140&&r.bottom<t&&r.left>0&&r.right<innerWidth)return [r.left+r.width/2,r.top+r.height/2]}return null})()");assert pt,'no visible bin'
    (pg.touchscreen.tap if name=='mobile' else pg.mouse.click)(pt[0],pt[1]);pg.wait_for_timeout(400);assert pg.evaluate("routeInfo.bin===sel&&primary().f.id===sel") and pg.get_attribute('#list .card','data-id')==pg.evaluate("sel")
    if name=='mobile':pg.evaluate("render(true)");pg.wait_for_timeout(400);pg.screenshot(path='/workspace/ped_target_390_v2_other.png')
    assert pg.locator('[data-next]').count()==0 and pg.locator('#list .cat').count()==0 and '一般垃圾＋資源回收' not in pg.inner_text('#list')  # 類別標籤、「下一個」已拿掉
    nx=pg.evaluate("nearestN(shown(),3)[1].f.id");pg.evaluate(f"focusBin(shown().find(b=>b.id==='{nx}'))");pg.wait_for_timeout(400);assert pg.evaluate("routeInfo.bin")==nx and pg.get_attribute('#list .card','data-id')==nx
    fit=pg.evaluate("(()=>{const t=list.getBoundingClientRect().top;return routeInfo.pts.every(p=>map.latLngToContainerPoint(p).y<t)||!isMobile()})()");assert fit  # fit 用新的卡片高度
    # 路線只在「你的位置 ↔ 目標」之間：換多個目標（含已回報滿），首點＝你的位置、末點＝目標、沒有點超出步行距離＋容差；點桶不移動你的位置；兩者相距 ≥48px
    p0=pg.evaluate("pos.slice()");ids=pg.evaluate("nearestN(shown(),6).map(t=>t.f.id)");pg.evaluate(f"addEvent({{bin:'{ids[3]}',kind:'full',level:100,by:'行人'}})")
    for bid in ids:
      pg.evaluate(f"focusBin(shown().find(b=>b.id==='{bid}'))");pg.wait_for_timeout(250)
      r=pg.evaluate("""(()=>{const P=primary(),b=[P.f.la,P.f.lo],R=routeInfo.pts,h=(p,q)=>hav(p[0],p[1],q[0],q[1]),A=map.latLngToContainerPoint(pos),T=map.latLngToContainerPoint(b),F=map.latLngToContainerPoint(R[0]);
        return {id:P.f.id,d:P.d,snapped:routeInfo.snapped,first_px:F.distanceTo(A),last_m:h(R[R.length-1],b),maxFromStart:Math.max(...R.map(p=>h(p,pos))),maxFromEnd:Math.max(...R.map(p=>h(p,b))),sep:A.distanceTo(T),rep:!!document.querySelector('.binmk.tgt.rep')}})()""")
      assert r['id']==bid and r['snapped'] and r['first_px']<=1 and r['last_m']<=3 and r['maxFromStart']<=r['d']+25 and r['maxFromEnd']<=r['d']+25 and r['sep']>=48,r
      print(name,'路線',bid,'%dm'%r['d'],'起點偏差 %.1fpx'%r['first_px'],'最遠 %d/%d m'%(r['maxFromStart'],r['maxFromEnd']),'間距 %dpx'%r['sep'],'已回報滿' if r['rep'] else '')
    assert pg.evaluate("pos")==p0
    pg.evaluate("(()=>{const f=shown().find(b=>b.addr==='羅斯福路4段124號');focusBin(f)})()");pg.wait_for_timeout(300)
    pt=pg.evaluate("(()=>{for(const e of document.querySelectorAll('.binmk.oth')){const r=e.getBoundingClientRect();if(r.top>140&&r.bottom<list.getBoundingClientRect().top&&r.left>0&&r.right<innerWidth)return [r.left+r.width/2,r.top+r.height/2]}return null})()")
    if pt:(pg.touchscreen.tap if name=='mobile' else pg.mouse.click)(pt[0],pt[1]);pg.wait_for_timeout(300);assert pg.evaluate("pos")==p0,'tap moved pos'
    pg.evaluate("(()=>{const f=shown().find(b=>b.addr==='羅斯福路4段124號');focusBin(f)})()");pg.wait_for_timeout(400)
    if name=='mobile':pg.screenshot(path='/workspace/ped_target_390_v3_other.png')
    pg.evaluate("drawRoute({...primary(),w:0})");assert pg.evaluate("routeInfo.snapped")==False and pg.evaluate("routeL.getLayers().length")==1  # 無法對應路網 → 虛線直線
    pg.evaluate("sel=null;render(true)");pg.wait_for_timeout(300);assert pg.inner_text('#tlab').startswith('最近・')
    # chip 列已移除（行人頁）：沒有 YouBike／公車站（不載入）；備用垃圾桶固定顯示，在一般桶與目標之下，不參與最近桶與路線
    assert pg.locator('#crow,.lchip,[data-ly]').count()==0 and pg.locator('#rhint').count()==0 and pg.evaluate("D.yb.length+D.bus.length")==0
    assert pg.evaluate("performance.getEntriesByType('resource').every(r=>!/youbike|busstops/.test(r.name))")  # 根本沒下載
    zo=pg.evaluate("(()=>{const t=document.querySelector('.binmk.tgt'),v=document.querySelector('.vmk'),n=document.querySelector('.binmk:not(.tgt)');return [+getComputedStyle(t).zIndex,+getComputedStyle(v).zIndex,t.parentNode===v.parentNode,n?+getComputedStyle(n).zIndex:1e9]})()");assert zo[0]>zo[1] and zo[2],zo  # 目標桶＋標籤在菱形之上
    t0=pg.evaluate("[primary().f.id,routeInfo.bin]");nv=pg.locator('.vmk').count();print(name,'備用垃圾桶點數',nv,pg.evaluate("D.venue.length"));assert nv==120 and pg.evaluate("D.venue.length")==120
    pg.evaluate("map.setView(pos,15,{animate:false})");pg.wait_for_timeout(400)
    vp=pg.evaluate("(()=>{for(const e of document.querySelectorAll('.vmk')){const r=e.getBoundingClientRect();if(r.top>140&&r.bottom<list.getBoundingClientRect().top&&r.left>10&&r.right<innerWidth-10)return [r.left+r.width/2,r.top+r.height/2]}return null})()");assert vp
    (pg.touchscreen.tap if name=='mobile' else pg.mouse.click)(vp[0],vp[1]);pg.wait_for_timeout(400);pop=pg.inner_text('.leaflet-popup-content');print(name,'場館彈窗',pop.replace('\n',' '))
    assert '依景點、商圈推估的可能丟點，尚未實地確認' in pop and pg.evaluate("getComputedStyle(document.querySelector('.leaflet-popup-content small')).color")=='rgb(125, 139, 139)' and pg.evaluate("[primary().f.id,routeInfo.bin]")==t0 and pg.evaluate("nearestN(shown(),12).every(t=>D.street.includes(t.f))")
    if name=='mobile':pg.wait_for_timeout(800);pg.screenshot(path='/workspace/ped_venue_popup_390.png')
    cr=pg.evaluate("(()=>{const c=getComputedStyle(document.querySelector('.vmk i'));return [c.backgroundColor]})()");assert cr==['rgb(31, 143, 163)'],cr  # 實心青色菱形
    assert '◆ 備用垃圾桶：依景點、商圈推估的可能丟點，尚未實地確認' in pg.inner_text('#infoSheet')
    pg.evaluate("map.closePopup();render(true)");pg.wait_for_timeout(300)
    pg.goto(B+'pedestrian.html?mode=after');pg.wait_for_selector('#list .card',timeout=20000);pg.wait_for_timeout(1500);exp(pg);assert 'pill sc' not in pg.content() and '調整後' not in pg.inner_text('#list')
    pg.wait_for_timeout(300);pg.screenshot(path=f'shot_pedestrian_{name}.png')
    assert pg.locator('#doneBtn').count()==0 and '這桶滿了嗎？' in pg.inner_text('#list')
    h0=pg.locator('.q').bounding_box()['height'];pg.click('[data-full]');pg.wait_for_timeout(300);h1=pg.locator('.q').bounding_box()['height']
    assert pg.evaluate("(()=>{const c=getComputedStyle(document.querySelector('.q .qd'));return [c.color,c.fontWeight]})()")==['rgb(28, 31, 33)','600']
    assert '✓ 謝謝，已通知清潔隊' in pg.inner_text('#list') and pg.locator('[data-full]').count()==0 and abs(h1-h0)<1,(h0,h1)
    assert pg.locator('.binmk.tgt.rep').count()==1 and pg.locator('.binmk.tgt .ring').count()==1 and pg.locator('#tlab').count()==1  # 回報滿：目標圖示仍是紅色（狀態色優先），光圈與標籤保留
    assert '有人回報滿了' in pg.inner_text('#list') and pg.locator('.binmk path[fill="var(--reported)"], .binmk path[fill="#e2574c"]').count()>=1
    print(name,'回報滿了 events',pg.evaluate("getEvents().filter(e=>e.kind==='full').length"));rep_id=pg.evaluate("getEvents().filter(e=>e.kind==='full').slice(-1)[0].bin")
    # 這裡需要垃圾桶：?reset=1 後、示範位置（捷運公館站公車站）按一次 → 設點規劃圖層與公館熱點詳情都是 1 筆
    pg.goto(B+'pedestrian.html?reset=1');pg.wait_for_url('**/pedestrian.html');pg.wait_for_selector('#list .card',timeout=20000);pg.wait_for_timeout(6500);exp(pg)
    assert pg.evaluate("getNeeds().length")==0 and pg.locator('#needBtn').is_visible() and pg.locator('#needBtn').bounding_box()['height']>=44
    near=pg.locator('#need.far').count();print(name,'需求按鈕 示範位置 醒目',near);assert near==0  # 示範位置步行 102 m → 不醒目
    pg.click('#needBtn');pg.wait_for_timeout(300);assert '謝謝，已給設點規劃參考' in pg.inner_text('#list') and pg.evaluate("getNeeds().length")==1
    assert pg.locator('[data-reason]').count()==2 and pg.locator('[data-reason]').first.bounding_box()['height']>=44
    assert '✓ 謝謝，已給設點規劃參考' in pg.inner_text('#list') and '原因（可不選）' in pg.inner_text('#need')
    assert pg.locator('#needUndo').bounding_box()['height']>=44;pg.click('#needUndo');pg.wait_for_timeout(200);assert pg.evaluate("getNeeds().length")==0 and pg.locator('#needBtn').is_visible()
    pg.click('#needBtn');pg.wait_for_timeout(200);assert pg.evaluate("getNeeds().length")==1
    assert [pg.inner_text(f'[data-reason="{k}"]') for k in ('general','other')]==['一般垃圾','其他'] and pg.locator('[data-reason="household"]').count()==0
    pg.click('[data-reason="general"]');pg.wait_for_timeout(200);assert pg.evaluate("getNeeds()[0].reason")=='general' and pg.get_attribute('[data-reason="general"]','aria-pressed')=='true' and pg.locator('#needNote').count()==0
    # 其他：展開單行輸入（16px、maxlength 40、placeholder）＋送出 44px；可留空送出；存檔前裁 40 字
    pg.click('[data-reason="other"]');pg.wait_for_timeout(300);ni=pg.locator('#needNote')
    assert ni.is_visible() and ni.get_attribute('maxlength')=='40' and ni.get_attribute('placeholder')=='例：大型廢棄物、狗便' and pg.evaluate("parseFloat(getComputedStyle(needNote).fontSize)")>=16 and pg.locator('#needNoteSend').bounding_box()['height']>=44
    if name=='mobile':pg.wait_for_timeout(400);pg.screenshot(path='/workspace/ped_other_input_390.png')
    pg.fill('#needNote','字'*29);assert pg.locator('#noteCnt').is_hidden();pg.fill('#needNote','字'*31);assert pg.inner_text('#noteCnt')=='31/40' and pg.locator('#noteCnt').is_visible();pg.fill('#needNote','')
    # 模擬鍵盤：visualViewport 變小 → 卡片頂端不高於頂列底邊，內容在卡片內捲動
    kb=pg.evaluate("""(()=>{const vh=Math.round(innerHeight*.45);Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:vh,offsetTop:0,addEventListener(){}}});needNote.focus({preventScroll:true});kbFit();
      const L=list.getBoundingClientRect(),bar=document.querySelector('.roles').getBoundingClientRect().bottom,i=needNote.getBoundingClientRect();return {vh,top:L.top,bottom:L.bottom,bar,scroll:list.scrollHeight>list.clientHeight,ov:getComputedStyle(list).overflowY,inTop:i.top,inBot:i.bottom}})()""")
    print(name,'鍵盤模擬',kb);assert kb['top']>=kb['bar'] and kb['bottom']<=kb['vh'] and kb['ov']=='auto' and kb['inTop']>=kb['top'] and kb['inBot']<=kb['bottom'],kb
    if name=='mobile':pg.wait_for_timeout(300);pg.screenshot(path='/workspace/ped_kb_small.png')
    pg.evaluate("delete window.visualViewport;kbFit()")
    # 視窗本身變矮（Android 鍵盤縮 layout viewport）：390×400、390×300 → 卡片頂端 ≥ 頂列底邊、內部捲動、底部多留 8px
    vp0=pg.viewport_size
    for hgt in (400,300):
      pg.set_viewport_size({'width':390,'height':hgt});pg.wait_for_timeout(500)
      rz=pg.evaluate("(()=>{const L=list.getBoundingClientRect(),bar=document.querySelector('.roles').getBoundingClientRect().bottom;return {h:innerHeight,top:L.top,bottom:L.bottom,bar,scroll:list.classList.contains('scroll'),pb:getComputedStyle(list).paddingBottom,ov:getComputedStyle(list).overflowY}})()")
      print(name,'視窗',hgt,rz);assert rz['top']>=rz['bar'] and rz['bottom']<=rz['h'] and rz['scroll'] and rz['pb']=='22px' and rz['ov']=='auto',rz
      if name=='mobile' and hgt==400:pg.screenshot(path='/workspace/ped_kb_resize.png')
    if name=='mobile':
      pg.set_viewport_size({'width':320,'height':568});pg.wait_for_timeout(500);pg.evaluate("document.activeElement&&document.activeElement.blur();kbFit()")
      c3=pg.evaluate("(()=>{const L=list.getBoundingClientRect();return {top:L.top,crow:topUIBottom(),bot:L.bottom,h:innerHeight,ov:getComputedStyle(list).overflowY}})()");print(name,'320x568',c3);assert c3['top']>=c3['crow'] and c3['bot']<=c3['h'] and c3['ov']=='auto',c3
    pg.set_viewport_size(vp0);pg.wait_for_timeout(500);assert pg.evaluate("list.getBoundingClientRect().top>=document.querySelector('.roles').getBoundingClientRect().bottom")
    vis=pg.evaluate("(()=>{const r=needNote.getBoundingClientRect(),v=window.visualViewport;return r.top>=0&&r.bottom<=(v?v.height+v.offsetTop:innerHeight)})()");assert vis
    pg.click('#needNoteSend');pg.wait_for_timeout(200);assert pg.evaluate("getNeeds()[0].note")==None and pg.inner_text('#noteDone')=='✓ 已送出說明' and pg.evaluate("(()=>{const c=getComputedStyle(noteDone);return [c.color,c.fontWeight]})()")==['rgb(28, 31, 33)','600']  # 留空也能送出
    pg.evaluate("setNeedNote(getNeeds()[0].id,'x'.repeat(50))");assert pg.evaluate("getNeeds()[0].note.length")==40
    pg.click('[data-reason="general"]');pg.click('[data-reason="other"]');pg.wait_for_timeout(200);pg.fill('#needNote','<img src=x onerror=alert(1)>');pg.click('#needNoteSend');pg.wait_for_timeout(200)
    assert pg.evaluate("getNeeds()[0]")['note']=='<img src=x onerror=alert(1)>' and pg.evaluate("getNeeds()[0].reason")=='other'
    dup=pg.evaluate("(()=>{const r=addNeed(pos[0]+0.0002,pos[1]);return [r.dup,getNeeds().length]})()");assert dup==[True,1],dup  # 50 m 內只算一次
    pg.evaluate("(()=>{const s=({la:25.0332,lo:121.5439});setPos([s.la,s.lo],'手動設定的位置')})()");pg.wait_for_timeout(500)
    q=pg.inner_text('#needQ') if pg.locator('#needQ').count() else '';print(name,'遠處',q,'| 卡片',pg.inner_text('.dist').replace('\n',' '));assert pg.evaluate("RT.walkMin(nearestN(shown(),1)[0].d)")==int(q.split('走 ')[1].split(' ')[0]) and ('步行約 %s 分'%q.split('走 ')[1].split(' ')[0]) in pg.inner_text('.dist')
    st=pg.evaluate("(()=>{const c=getComputedStyle(needBtn);return [c.backgroundColor,c.borderTopColor,c.color]})()");print(name,'醒目樣式',st);assert st==['rgb(255, 255, 255)','rgb(43, 51, 51)','rgb(43, 51, 51)']
    assert pg.locator('#need.far #needBtn').count()==1 and '最近的桶要走' in q and '需要這裡多一個嗎？' in q
    pg.screenshot(path=f'shot_pedestrian_need_{name}.png')
    pg.goto(B+'index.html');pg.wait_for_selector('#hot .card',timeout=20000);lt=pg.inner_text('[data-ly="need"]');print(name,'規劃圖層',lt);assert '1 筆' in lt and pg.get_attribute('[data-ly="need"]','aria-pressed')=='true'
    nc=pg.inner_text('#needCard').replace('\n',' ');print(name,'需求小卡',nc);assert nc=='民眾回報需求 1 筆 其他 1'
    if name=='mobile':pg.locator('#needCard').scroll_into_view_if_needed();pg.screenshot(path='/workspace/planner_need_card.png')
    pg.click('#needCard');pg.wait_for_timeout(1200);fly=pg.evaluate("[NEED_FLY,[getNeeds()[0].la,getNeeds()[0].lo],map.getZoom()]");assert fly[0]==fly[1] and fly[2]==17,fly
    an=pg.evaluate("getComputedStyle(document.querySelector('.needmk'),'::after').animationName");pg.emulate_media(reduced_motion='reduce');an2=pg.evaluate("getComputedStyle(document.querySelector('.needmk'),'::after').animationName");pg.emulate_media(reduced_motion='no-preference');assert an=='needPulse' and an2=='none',(an,an2)
    h0n=pg.evaluate("HS.map(h=>h.name)");pg.evaluate("(()=>{addNeed(HS[0].la,HS[0].lo);renderHot()})()");tg=pg.locator('#hot .card').first.locator('.tag.need');assert tg.inner_text()=='民眾回報 1' and pg.evaluate("HS.map(h=>h.name)")==h0n and pg.evaluate("getComputedStyle(document.querySelector('#hot .tag.need')).backgroundColor")=='rgb(122, 92, 196)'
    pg.evaluate("(()=>{localStorage.setItem('有桶tcl_needs_v1',JSON.stringify(getNeeds().slice(0,1)));renderHot();renderNeedCard();drawBase(D.street)})()")
    dot=pg.evaluate("getComputedStyle(document.querySelector('[data-ly=need] i')).backgroundColor");mk=pg.locator('.needmk');bb=mk.first.bounding_box();bg=pg.evaluate("getComputedStyle(document.querySelector('.needmk')).backgroundColor");print(name,'需求點',mk.count(),bb['width'],dot,bg);assert mk.count()==1 and 13<=bb['width']<=15 and dot==bg=='rgb(122, 92, 196)'
    assert pg.evaluate("getComputedStyle(document.querySelector('#thrSeg button.on')).backgroundColor")=='rgb(43, 51, 51)' and min(pg.evaluate("[...document.querySelectorAll('#thrSeg button')].map(b=>b.getBoundingClientRect().height)"))>=44
    pg.locator('[data-vs="0"]').click();pg.wait_for_selector('.cmp');nn=pg.inner_text('#needNear');print(name,'公館詳情',pg.inner_text('#detail h2'),nn);assert nn=='200 m 內民眾回報需求 1 筆（其他 1）',nn
    dlg=[];dh=lambda d:(dlg.append(d.message),d.dismiss());pg.on('dialog',dh);sm=pg.locator('#needOther summary');assert sm.inner_text().strip().endswith('其他說明（1）') and sm.bounding_box()['height']>=44 and pg.evaluate("getComputedStyle(document.querySelector('#needOther summary'),'::before').content")=='"▸"'
    pg.click('#needOther summary');pg.wait_for_timeout(500);assert pg.evaluate("getComputedStyle(document.querySelector('#needOther summary'),'::before').content")=='"▾"'
    ff=pg.evaluate("[getComputedStyle(document.querySelector('#needOther summary')).fontFamily,getComputedStyle(document.querySelector('#needOther li')).fontFamily,getComputedStyle(document.documentElement).getPropertyValue('--font').trim()]");assert ff[0]==ff[1] and ff[0].replace(' ','')==ff[2].replace(' ',''),ff
    ind=pg.evaluate("document.querySelector('#needOther li').getBoundingClientRect().left-document.querySelector('#needNear').getBoundingClientRect().left");assert ind>=16,ind
    li=pg.locator('#needOther li').all_inner_texts();print(name,'其他說明',li);assert li==['<img src=x onerror=alert(1)>'] and pg.locator('#needOther img').count()==0 and not dlg and pg.evaluate("document.querySelectorAll('#detail img[src=x]').length")==0
    pg.remove_listener('dialog',dh)
    if name=='mobile':pg.screenshot(path='shot_planner_need_mobile.png')
    # 舊資料遷移：飲料杯／外帶餐盒 → general、其他 → other、無原因 → 未選；各類只列 ≥1
    saved=pg.evaluate("localStorage.getItem('有桶tcl_needs_v1')")
    pg.evaluate("(()=>{const s=({la:25.01491,lo:121.53438}),t=Date.now();localStorage.setItem('有桶tcl_needs_v1',JSON.stringify([['飲料杯',0],['外帶餐盒',0.0006],['其他',-0.0006],[null,0.0012],['household',-0.0012]].map(([r,d],i)=>({id:'old'+i,la:s.la+d,lo:s.lo,ts:t,reason:r}))))})()")
    pg.reload();pg.wait_for_selector('#hot .card',timeout=20000);pg.locator('[data-vs="0"]').click();pg.wait_for_selector('.cmp')
    nb=pg.inner_text('#needNear');st=pg.evaluate("JSON.parse(localStorage.getItem('有桶tcl_needs_v1')).map(n=>n.reason)");print(name,'遷移',nb,st);assert nb=='200 m 內民眾回報需求 5 筆（一般垃圾 3・其他 1・未選 1）' and st==['general','general','other',None,'general']
    if name=='mobile':pg.locator('#needNear').scroll_into_view_if_needed();pg.screenshot(path='/workspace/planner_need_breakdown.png')
    pg.evaluate(f"localStorage.setItem('有桶tcl_needs_v1',{saved!r})");pg.reload();pg.wait_for_selector('#hot .card',timeout=20000);pg.locator('[data-vs="0"]').click();pg.wait_for_selector('.cmp')
    pg.evaluate("(()=>{const n=getNeeds()[0];addNeed(n.la+0.0006,n.lo);addNeed(n.la,n.lo+0.0007)})()");pg.click('#bk');pg.wait_for_timeout(1200);pg.evaluate("map.stop();map.setView([getNeeds()[0].la,getNeeds()[0].lo],14,{animate:false})");pg.wait_for_timeout(900)
    cl=pg.evaluate("[...document.querySelectorAll('.needmk')].map(e=>e.innerText)");print(name,'合併',pg.evaluate("[getNeeds().length,map.getZoom(),getNeeds().map(n=>[n.la,n.lo])]"),'筆 →',cl);assert cl==['3']
    pg.evaluate("localStorage.setItem('有桶tcl_needs_v1',JSON.stringify(getNeeds().slice(0,1)))")
    for u in ('pedestrian.html','crew.html','index.html'):
      pg.goto(B+u);pg.wait_for_selector('.roles a');hs=pg.evaluate("[...document.querySelectorAll('.roles a')].map(a=>a.getBoundingClientRect().height)");assert min(hs)>=44,(u,hs)
    print(name,'角色切換高度 OK')
    # 驗收流程（?reset=1 之後）：行人頁按「滿了」→ 清潔隊頁該站「行人回報」且必清
    pg.goto(B+'pedestrian.html');pg.wait_for_selector('#list .card',timeout=20000);exp(pg);pg.click('#list [data-full]');pg.wait_for_timeout(300);rep_id=pg.evaluate("getEvents().filter(e=>e.kind==='full').slice(-1)[0].bin")
    # 清潔隊：深連結 → A 規劃（預測），時間抽屜、門檻、開始清運 → B 執行、回報＋校正、復原、返回
    pg.goto(B+'crew.html?fc=1&day=we&t=15:30');pg.wait_for_selector('#card[data-state=A] #startBtn',timeout=20000);pg.wait_for_timeout(600)
    # 行人回報滿 → 清單該站有紅色「行人回報」且在必清；「開始清運」在標題下、清單上方，整寬、不捲動可見
    rl=pg.locator(f'#mustList li:has(.repby)');print(name,'行人回報站',rep_id,rl.count(),pg.evaluate(f"route.find(e=>e.b.id==='{rep_id}')&&route.find(e=>e.b.id==='{rep_id}').must"))
    assert rl.count()==1 and pg.evaluate(f"route.find(e=>e.b.id==='{rep_id}').must") and pg.evaluate(f"route.find(e=>e.b.id==='{rep_id}').b.addr") in rl.inner_text() and pg.locator('.flag.rep').count()==0
    rp=pg.evaluate("(()=>{const li=[...document.querySelectorAll('#mustList li')].find(l=>l.querySelector('.repby')),c=getComputedStyle(li.querySelector('.stchip')),m=getComputedStyle(document.querySelector('.flag.must'));return [li.querySelector('.stchip').textContent,c.backgroundColor,c.color,li.querySelector('.repby').textContent,m.backgroundColor,m.color]})()");print(name,'行人回報列',rp);assert rp[0]=='已回報滿' and rp[1:3]==['rgb(252, 235, 233)','rgb(180, 35, 42)'] and rp[3] in ('行人回報・剛剛','行人回報・1 分前') and rp[4:]==['rgb(43, 51, 51)','rgb(255, 255, 255)']
    # 取消：?reset=1 → 公館「滿了」→ 清潔隊出現 → 取消 → 解除（已回報滿／行人回報／必清）→ 再「滿了」→ 再出現
    def crew_rep(bid):
      pg.goto(B+'crew.html?fc=1&day=we&t=15:30');pg.wait_for_selector('#card[data-state=A]',timeout=20000);pg.wait_for_timeout(600)
      return pg.evaluate(f"(()=>{{const e=E.find(x=>x.b.id==='{bid}'),r=route.find(x=>x.b.id==='{bid}');return [e.rep,[...document.querySelectorAll('#mustList li,#list li')].some(l=>l.querySelector('.repby')&&l.textContent.includes(e.b.addr)),!!(r&&r.must&&e.fill<100&&!(isFinite(e.fullAt)))||!!(r&&r.must&&e.rep)]}})()")
    def ped():pg.goto(B+'pedestrian.html');pg.wait_for_selector('#list .card',timeout=20000);pg.wait_for_timeout(1500);exp(pg)
    pg.goto(B+'pedestrian.html?reset=1');pg.wait_for_url('**/pedestrian.html');pg.wait_for_selector('#list .card',timeout=20000);pg.wait_for_timeout(6000);exp(pg)
    gid=pg.get_attribute('#list .card','data-id');assert pg.inner_text('#list .q .qt')=='這桶滿了嗎？' and pg.inner_text('[data-ok]')=='還能丟' and pg.inner_text('[data-full]')=='滿了'
    pg.click('[data-full]');pg.wait_for_timeout(300);ub=pg.locator('#repUndo').bounding_box();assert pg.inner_text('#repUndo')=='取消' and ub['height']>=44 and ub['width']>=44 and '✓ 謝謝，已通知清潔隊' in pg.inner_text('.q')
    if name=='mobile':pg.screenshot(path='/workspace/ped_cancel_390.png')
    c1=crew_rep(gid);ped();assert pg.locator('#repUndo').count()==1  # 去清潔隊頁再回來仍可取消
    pg.click('#repUndo');pg.wait_for_timeout(300);assert pg.locator('[data-full]').count()==1 and pg.locator('.binmk.tgt.rep').count()==0 and pg.evaluate(f"getEvents().filter(e=>e.bin==='{gid}').length")==0;c2=crew_rep(gid)
    ped();pg.click('[data-full]');pg.wait_for_timeout(300);c3=crew_rep(gid);print(name,'取消流程 清潔隊 [已回報滿,行人回報,必清]',c1,c2,c3);assert c1[:2]==[True,True] and c1[2] and c2[:2]==[False,False] and c3[:2]==[True,True]
    ped();oid=pg.evaluate("nearestN(shown(),3)[1].f.id");pg.evaluate(f"focusBin(shown().find(b=>b.id==='{oid}'))");pg.wait_for_timeout(300);pg.evaluate(f"focusBin(shown().find(b=>b.id==='{gid}'))");pg.wait_for_timeout(300);assert pg.locator('#repUndo').count()==0  # 換桶後取消消失
    rep_id=gid;pg.goto(B+'crew.html?fc=1&day=we&t=15:30');pg.wait_for_selector('#card[data-state=A] #startBtn',timeout=20000);pg.wait_for_timeout(600)
    sb=pg.locator('#startBtn').bounding_box();ml=pg.locator('#mustList').bounding_box();tt=pg.locator('#cardTitle').bounding_box();cw=pg.locator('#cardBody').bounding_box()
    assert tt['y']<sb['y']<ml['y'] and sb['y']+sb['height']<=pg.evaluate("innerHeight") and sb['width']>=cw['width']-2 and sb['height']>=44,(sb,ml,cw)
    if name=='mobile':pg.screenshot(path='/workspace/crew_start_390.png')
    assert '溢出' not in pg.content();sA=pg.inner_text('#cardTitle');n3=pg.locator('.top3 li').count();print(name,'A 規劃',sA,'top3',n3,'chip',pg.inner_text('#tChip'));assert n3>=1 and '必清' in sA and '週六 15:30' in pg.inner_text('#tChip')
    vis=pg.evaluate("(()=>{const r=card.getBoundingClientRect();return route.slice(0,3).every(e=>{const p=map.latLngToContainerPoint([e.b.la,e.b.lo]);return (p.y<r.top||p.x<r.left)&&p.y>0&&p.x>0&&p.x<innerWidth})})()");print(name,'前 3 站在卡片上方',vis);assert vis
    if name=='mobile':
        h=pg.evaluate("card.getBoundingClientRect().height/innerHeight");print(name,'卡片高度比例',round(h,2));assert h<=0.401
        pg.screenshot(path='shot_crew_stateA_mobile.png')
    pg.click('#tChip');pg.click('label:has([name=fcd][value=wk])');assert pg.locator('#timeSheet').is_hidden()
    pg.click('#tChip');pg.eval_on_selector('#fcT',"e=>{e.value=600;e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'))}");pg.wait_for_timeout(300)
    s1=pg.inner_text('#cardTitle');assert pg.locator('#timeSheet').is_hidden() and '平日 10:00' in pg.inner_text('#tChip');print(name,'平日10:00',s1)
    pg.click('#tChip');pg.click('#dlinks [data-pt="15:30"]');pg.wait_for_timeout(700);print(name,'週六15:30',pg.inner_text('#cardTitle'));pg.click('#tChip');pg.click('#dlinks [data-pt="10:00"]');pg.wait_for_timeout(700);n1=pg.evaluate("E.filter(e=>e.fill>=100).length");print(name,'平日10:00',pg.inner_text('#tChip'),'>=100',n1);pg.click('#tChip');pg.click('#dlinks [data-pt="15:30"]');pg.wait_for_timeout(700);n2=pg.evaluate("E.filter(e=>e.fill>=100).length");print(name,'週六15:30 >=100',n2);assert n1==2 and n2==6
    pg.screenshot(path=f'shot_crew_forecast_sat_{name}.png')
    pg.click('#menu');assert pg.locator('#th').count()==0 and pg.locator('#thSeg input').count()==2
    pg.click('#thSeg label:has([value="100"])');pg.wait_for_timeout(400);c100=pg.inner_text('#cnt');t100=pg.inner_text('#cardTitle') if pg.locator('#cardTitle').count() else pg.inner_text('#card')[:40]
    pg.click('#thSeg label:has([value="70"])');pg.wait_for_timeout(400);c70=pg.inner_text('#cnt');pg.click('#setSheet [data-close]');print(name,'清運範圍',c100,'|',t100,'||',c70);assert '%' not in c70 and pg.evaluate("JSON.parse(localStorage.getItem('有桶tcl_crew_ui_v2')).th")==70
    pg.evaluate("localStorage.removeItem(LS_EVENTS)")  # 行人回報會強制必清；空狀態測試先清掉回報
    # 空狀態：平日 08:30「只清滿溢」→ 不顯示「必清 0 站」，顯示連結；點連結切回「快滿了以上」
    pg.click('#tChip');pg.wait_for_timeout(300);pg.click('label:has([name=fcd][value=wk])');pg.eval_on_selector('#fcT',"e=>{e.value=510;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}");pg.wait_for_timeout(400);pg.keyboard.press('Escape')
    pg.evaluate("th.value=100;replan()");pg.wait_for_timeout(400)
    cb=pg.inner_text('#card');assert '目前沒有滿溢的桶' in cb and pg.locator('#cardTitle').count()==0 and '43 桶中列入 0 桶' in cb,cb
    assert pg.locator('#toNear').bounding_box()['height']>=44;pg.click('#toNear');pg.wait_for_timeout(500)
    assert pg.locator('#cardTitle').count()==1 and pg.evaluate("th.value")==70 and pg.evaluate("document.querySelector('[name=thr][value=\"70\"]').checked") and pg.evaluate("JSON.parse(localStorage.getItem('有桶tcl_crew_ui_v2')).th")==70
    print(name,'空狀態連結 OK',pg.inner_text('#cardTitle'))
    pg.click('#tChip');pg.wait_for_timeout(300);pg.click('label:has([name=fcd][value=we])');pg.eval_on_selector('#fcT',"e=>{e.value=930;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}");pg.wait_for_timeout(400);pg.keyboard.press('Escape')
    first=pg.evaluate("route[0].b.id");pg.click('#startBtn');pg.wait_for_selector('#card[data-state=B] [data-amt]');print(name,'B 執行',pg.inner_text('#orderNote'))
    if name=='mobile':pg.wait_for_timeout(500);pg.screenshot(path='shot_crew_stateB_mobile.png')
    a0=pg.inner_text('#prog');pg.click('#card [data-amt=half]');pg.wait_for_timeout(300);a1=pg.inner_text('#prog')
    cal=pg.evaluate(f"FC.state().cal['{first}']");ev=pg.evaluate("getEvents().slice(-1)[0]");flag=pg.locator(f'[data-calid="{first}"]').count()
    print(name,'校正',first,cal,'event',{k:ev.get(k) for k in ('kind','amount','amountPct','predPct','calib')},'已校正標記',flag);assert cal and cal['n']==1 and ev['predPct'] is not None and flag==1
    pg.click('.undo button');pg.wait_for_timeout(300);a2=pg.inner_text('#prog');assert not pg.evaluate(f"FC.state().cal['{first}']")
    pg.screenshot(path=f'shot_crew_{name}.png')
    pg.click('#menu');pg.once('dialog',lambda d:d.accept());pg.click('#allClear');pg.wait_for_timeout(300)
    print(name,'清潔隊',a0.replace('\n',' '),'→',a1.replace('\n',' '),'→ 復原',a2.replace('\n',' '),'| 完成卡',pg.locator('#card .done').count()>0)
    pg.click('#backBtn');pg.wait_for_selector('#card[data-state=A]');print(name,'返回 A',pg.inner_text('#cardTitle'))
    assert pg.locator('.roles a[href="index.html"]').count()>0;print(name,'行車路網',pg.inner_text('#sum').replace('\n',' '))
    # 重設鈕已移除（資料說明、清潔隊「清除示範資料」）；?reset=1 仍可清本機
    assert pg.locator('#resetAll').count()==0 and pg.locator('#reset').count()==0
    pg.goto(B+'index.html');pg.wait_for_selector('#hot .card',timeout=20000);pg.evaluate("addEvent({bin:'B0002',kind:'full',level:100,by:'行人'});SC.save({hotspotId:'x',option:'A'});addNeed(25.02,121.54)")
    pg.goto(B+'pedestrian.html?reset=1');pg.wait_for_url('**/pedestrian.html');pg.wait_for_timeout(800)
    left=pg.evaluate("Object.keys(localStorage).filter(k=>/^(有桶tcl_)/.test(k))");print(name,'?reset=1 殘留鍵',left);assert left==[] and pg.evaluate("getNeeds().length")==0
    pg.goto(B+'index.html');pg.wait_for_selector('#hot .card',timeout=20000);pg.click('#menu');assert pg.locator('#menuSheet #resetAll').count()==0 and '重設成原始狀態' not in pg.inner_text('#menuSheet');pg.click('#menuSheet [data-close]')
    # 空狀態重現（?reset=1 之後）：平日 08:30 + 只清滿溢
    pg.goto(B+'crew.html?reset=1');pg.wait_for_url('**/crew.html');pg.goto(B+'crew.html?fc=1&day=wk&t=08:30');pg.wait_for_selector('#card[data-state=A]',timeout=20000);pg.wait_for_timeout(600)
    pg.click('#menu');pg.click('#thSeg label:has([value="100"])');pg.wait_for_timeout(400);pg.click('#setSheet [data-close]')
    cb=pg.inner_text('#card');print(name,'空狀態 reset 後 平日08:30',cb.replace('\n',' ')[:60]);assert pg.locator('#startBtn').count()==0 and pg.inner_text('#cardEmpty')=='目前沒有滿溢的桶' and pg.inner_text('#cardCount')=='43 桶中列入 0 桶';assert '目前沒有滿溢的桶' in cb and '43 桶中列入 0 桶' in cb and pg.locator('#cardTitle').count()==0 and '必清 0 站' not in cb
    hi=pg.evaluate("[...document.querySelectorAll('.leaflet-marker-pane [fill]')].filter(e=>/d9731f|fill-high/i.test(e.getAttribute('fill'))).length");print(name,'08:30 地圖滿溢色桶數',hi);assert hi==0  # 地圖與卡片同一判斷（≥100）
    pg.click('#toNear');pg.wait_for_timeout(500);assert pg.locator('#cardTitle').count()==1 and pg.evaluate("document.querySelector('[name=thr][value=\"70\"]').checked") and pg.evaluate("JSON.parse(localStorage.getItem('有桶tcl_crew_ui_v2')).th")==70
    # 剛例行清運、沒有要清的桶：平日 07:00 → 05:00 已例行清運；「調整時間」開時間設定
    pg.goto(B+'crew.html?fc=1&day=wk&t=07:00');pg.wait_for_selector('#card[data-state=A] #cardEmpty',timeout=20000);pg.wait_for_timeout(400)
    et=pg.inner_text('#cardEmpty');print(name,'例行清運後空狀態',et,'|',pg.inner_text('#prog'));assert et=='05:00 已例行清運，目前沒有要清的桶' and '43 桶中列入 0 桶' in pg.inner_text('#cardCount') and '沒有要清的桶' in pg.inner_text('#prog') and '無站點' not in pg.content()
    assert pg.locator('#toTime').bounding_box()['height']>=44;pg.click('#toTime');pg.wait_for_timeout(300);assert pg.locator('#timeSheet').is_visible();pg.keyboard.press('Escape')
    # 例行清運時間（假設）：config 與資料說明一致
    assert pg.evaluate("CONFIG.forecast.routineClears.join(',')")=='05:00,08:00,12:00,16:00' and '例行清運時間 05:00／08:00／12:00／16:00 為假設；官方公開資料只提到一天 3–6 次，沒有公布時間' in pg.content()
    pg.goto(B+'crew-route.html');pg.wait_for_selector('#card',timeout=20000);print(name,'舊路線網址導向',pg.url.endswith('crew.html'))
    # 清運規則＋需求分離：清運後比它早的回報不算（含晚上傳的 ot）；「問過了」失效；復原後回來；滿了不會變成需求回報
    pg.goto(B+'pedestrian.html?reset=1');pg.wait_for_url('**/pedestrian.html');pg.wait_for_selector('#list .card',timeout=20000);pg.wait_for_timeout(4000);exp(pg)
    cid=pg.get_attribute('#list .card','data-id');nn0=pg.evaluate("getNeeds().length");pg.click('[data-full]');pg.wait_for_timeout(300)
    assert pg.evaluate("getNeeds().length")==nn0 and pg.evaluate(f"binState('{cid}',getEvents())")=='reported'
    cl=pg.evaluate(f"addEvent({{bin:'{cid}',kind:'clear',level:0,by:'清潔隊'}}).id");pg.evaluate("render(false)");pg.wait_for_timeout(300)
    r1=[pg.evaluate(f"binState('{cid}',getEvents())"),pg.locator('[data-full]').count(),pg.evaluate(f"fillOf('{cid}',getEvents())")]
    pg.evaluate(f"(()=>{{const a=getEvents();a.push({{bin:'{cid}',kind:'full',level:100,by:'行人',id:'evstale0001',ts:Date.now()+5000,ot:Date.now()-60000}});localStorage.setItem(LS_EVENTS,JSON.stringify(a))}})()");r2=pg.evaluate(f"binState('{cid}',getEvents())")
    pg.evaluate(f"removeEvent('{cl}');render(false)");pg.wait_for_timeout(300);r3=[pg.evaluate(f"binState('{cid}',getEvents())"),pg.locator('[data-full]').count()]
    print(name,'清運規則 清運後[狀態,可再問,滿度] 晚上傳舊回報 復原後',r1,r2,r3);assert r1==[None,1,0] and r2 is None and r3==['reported',0]
    # 跨分頁同步（同一 context 兩個分頁）
    P1=pg;P1.goto(B+'pedestrian.html?reset=1');P1.wait_for_url('**/pedestrian.html');P1.wait_for_selector('#list .card',timeout=20000);P1.wait_for_timeout(5000);exp(P1)
    P2=c.new_page();P2.on('pageerror',lambda e:errs.append(str(e)));P2.goto(B+'crew.html?fc=1&day=we&t=15:30');P2.wait_for_selector('#card[data-state=A] #startBtn',timeout=20000);P2.wait_for_timeout(600)
    gid=P1.get_attribute('#list .card','data-id');P1.bring_to_front();vw0=P1.evaluate("[map.getZoom(),map.getCenter().lat,map.getCenter().lng]");o2=P2.evaluate("route.map(e=>e.b.id).join()")
    t0=P1.evaluate("Date.now()");P1.click('[data-full]')
    P2.wait_for_function(f"(()=>{{const e=E.find(x=>x.b.id==='{gid}'),r=route.find(x=>x.b.id==='{gid}');return e&&e.rep&&r&&r.must&&[...document.querySelectorAll('#mustList li')].some(l=>l.querySelector('.repby')&&l.textContent.includes(e.b.addr)&&l.querySelector('.stchip').textContent==='已回報滿')}})()",timeout=3000);tF=P2.evaluate("Date.now()")-t0
    o2b=P2.evaluate("route.map(e=>e.b.id).join()");P2.screenshot(path=f'/workspace/sync_{name}_crew_full.png')
    t0=P1.evaluate("Date.now()");P1.click('#repUndo')
    P2.wait_for_function(f"(()=>{{const e=E.find(x=>x.b.id==='{gid}');return e&&!e.rep&&![...document.querySelectorAll('#mustList li,#list li')].some(l=>l.querySelector('.repby'))}})()",timeout=3000);tU=P2.evaluate("Date.now()")-t0
    assert P1.locator('[data-full]').count()==1 and P1.locator('.binmk.tgt.rep').count()==0;P2.screenshot(path=f'/workspace/sync_{name}_crew_cancel.png')
    print(name,'同步 滿了→清潔隊',tF,'ms；取消→清潔隊',tU,'ms；A 站序不重排',o2==o2b.replace(','+gid,'') or o2b.startswith(o2[:20]))
    # 清潔隊 B 完成一站 → 行人分頁轉綠
    P2.click('#startBtn');P2.wait_for_selector('#card[data-state=B] [data-amt]');rid=P2.evaluate("route[0].b.id");ordB=P2.evaluate("route.map(e=>e.b.id).join()")
    P1.evaluate(f"focusBin(shown().find(b=>b.id==='{rid}')||D.street.find(b=>b.id==='{rid}'))");P1.wait_for_timeout(400);vw1=P1.evaluate("[map.getZoom(),map.getCenter().lat,map.getCenter().lng]")
    t0=P2.evaluate("Date.now()");P2.click('#card [data-amt=half]')
    P1.wait_for_function(f"fillOf('{rid}',getEvents())===0&&document.querySelector('#list').textContent.includes('已清運・剛剛・清潔隊回報')&&!document.querySelector('.binmk.tgt.rep')",timeout=1000);tC=P1.evaluate("Date.now()")-t0
    vw2=P1.evaluate("[map.getZoom(),map.getCenter().lat,map.getCenter().lng]");P1.screenshot(path=f'/workspace/sync_{name}_ped_cleared.png')
    print(name,'同步 清運→行人轉綠',tC,'ms；地圖不重新 fit',vw1==vw2);assert tC<1000 and vw1==vw2 and P2.evaluate("route.map(e=>e.b.id).join()")==ordB and P2.get_attribute('#card','data-state')=='B'
    # 其他原因輸入框在同步時保留
    P1.click('#needBtn');P1.wait_for_timeout(300);P1.click('[data-reason="other"]');P1.wait_for_timeout(300);P1.fill('#needNote','大型廢棄物');P1.focus('#needNote')
    P2.evaluate(f"addEvent({{bin:'{gid}',kind:'full',by:'行人'}})");P1.wait_for_timeout(500)
    kept=P1.evaluate("[!!document.querySelector('#needNote'),needNote.value,document.activeElement===needNote,map.getZoom()]");print(name,'同步時其他輸入保留',kept);assert kept[:3]==[True,'大型廢棄物',True] and kept[3]==vw2[0] and P1.evaluate(f"binState('{gid}',getEvents())")=='reported'
    P2.close()
    print(name,'ERRORS',errs);ok&=not errs;c.close()
  br.close()
print('PASS' if ok else 'FAIL')
