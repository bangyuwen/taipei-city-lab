# 從研究網站擷取檔 /workspace/context/research.md 解析 39 處觀察錨點（研究團隊定義：2026-07 YouBike 借還端點活動量，每區前 3、點間隔≥300m）
import re,json,csv
L=[l.strip() for l in open('/workspace/context/research.md',encoding='utf-8')][:2000]
yb={s['sna'].replace('YouBike2.0_',''):s for s in json.load(open('youbike_raw.json'))}
out=[];seen=set();dist=None
for i,l in enumerate(L):
    m=re.match(r'^(.+?) · (分區分析|校區另列.*)$',l)
    if m: dist=m.group(1)
    m=re.match(r'^(D\d\d-\d|C\d*-?\d+|[A-Z]\d\d-\d|U-\d) (.+)$',l)
    if m and L[i+1]=='站點位置' and m.group(1) not in seen:
        seen.add(m.group(1));name=m.group(2)
        act=int(L[i+2].replace(',',''));rank=int(re.sub(r'\D','',L[i+3]));nb=float(L[i+4].replace(' m',''))
        s=yb.get(name)
        out.append(dict(id=m.group(1),district=dist,name=name,activity_2026_07=act,city_rank=rank,research_nearest_bin_m=nb,research_nearest_bin_addr=L[i+5],research_next_step=L[i+6],venue_note=L[i+7],sno=s['sno'] if s else '',lat=float(s['latitude']) if s else '',lon=float(s['longitude']) if s else ''))
print(len(out),'unmatched',[o['name'] for o in out if not o['sno']])
json.dump(out,open('anchors.json','w'),ensure_ascii=False,indent=1)
w=csv.DictWriter(open('anchors.csv','w',newline='',encoding='utf-8-sig'),fieldnames=list(out[0]));w.writeheader();w.writerows(out)
for o in out: print(o['id'],o['district'],o['name'],o['activity_2026_07'],o['research_nearest_bin_m'])
