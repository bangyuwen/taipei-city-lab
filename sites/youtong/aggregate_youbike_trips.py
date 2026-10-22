# 彙整 2026-07 YouBike2.0 租借紀錄 → 每站借+還次數（原始 ZIP 不入庫）
import zipfile,io,csv,json,collections
z=zipfile.ZipFile('/workspace/raw/yb202607.zip');f=z.open(z.infolist()[0])
ALL=collections.Counter();EX=collections.Counter();n=0;skip=0
for r in csv.reader(io.TextIOWrapper(f,encoding='utf-8')):
    if r[0]=='rent_time':continue
    n+=1
    for t,s in ((r[0],r[1]),(r[2],r[3])):
        ALL[s]+=1
        if t[:10] in('2026-07-10','2026-07-11'): skip+=1
        else: EX[s]+=1
yb=json.load(open('youbike_raw.json'));out=[];unm=0
for s in yb:
    k=s['sna'].replace('YouBike2.0_','')
    out.append({"sno":s['sno'],"name":k,"activity_all":ALL.get(k,0),"activity_excl_0710_0711":EX.get(k,0),"matched":k in ALL})
names={s['sna'].replace('YouBike2.0_','') for s in yb}
print("rows",n,"endpoints skipped(7/10,7/11)",skip,"stations matched",sum(o['matched'] for o in out),"/",len(out),"trip-station names not in snapshot",sum(1 for k in ALL if k not in names))
json.dump(out,open('youbike_activity_202607.json','w'),ensure_ascii=False)
w=csv.DictWriter(open('youbike_activity_202607.csv','w',newline='',encoding='utf-8-sig'),fieldnames=list(out[0]));w.writeheader();w.writerows(out)
for o in out:
    if o['name'] in('捷運公館站(2號出口)','捷運科技大樓站','捷運東門站(5號出口)'):print(o)
