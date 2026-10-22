# 2026-07 YouBike2.0 租借紀錄 → 示範區（含外擴 250m）站點 × 平日/週末 × 24 小時「每日平均借＋還次數」
# 來源：data.taipei c5924c17-25db-4f1e-99c4-f8ada40f2445（2026-07 ZIP，已於 2026-10-19 單次下載至 /workspace/raw/）
# 排除 7/10、7/11（官方資料缺口）。只輸出小型彙總 JSON。
import zipfile,io,csv,json,datetime,collections,re
cfg=open('config.js',encoding='utf-8').read()
m=re.search(r"bounds:\[\[([\d.]+),([\d.]+)\],\[([\d.]+),([\d.]+)\]\]",cfg);a,b,c,d=map(float,m.groups());pad=0.0025
yb=json.load(open('youbike_raw.json'));byname={}
for s in yb:
    la,lo=float(s['latitude']),float(s['longitude'])
    if a-pad<=la<=c+pad and b-pad<=lo<=d+pad: byname[s['sna'].replace('YouBike2.0_','')]=s
EX={'2026-07-10','2026-07-11'}
def dt(t):
    y,mo,dd=map(int,t[:10].split('-'));return 'we' if datetime.date(y,mo,dd).weekday()>=5 else 'wk'
days={'wk':set(),'we':set()};H=collections.defaultdict(lambda:{'wk':[0]*24,'we':[0]*24});tot={'wk':[0]*24,'we':[0]*24}
z=zipfile.ZipFile('/workspace/raw/yb202607.zip')
for r in csv.reader(io.TextIOWrapper(z.open(z.infolist()[0]),encoding='utf-8')):
    if r[0]=='rent_time':continue
    for t,s in ((r[0],r[1]),(r[2],r[3])):
        day=t[:10]
        if day in EX or not day.startswith('2026-07'):continue
        k=dt(t);h=int(t[11:13]);days[k].add(day);tot[k][h]+=1
        if s in byname:H[s][k][h]+=1
nd={k:len(v) for k,v in days.items()}
out={'source':'臺北市公共自行車2.0租借紀錄 2026-07（排除 7/10、7/11）','unit':'每日平均借＋還次數（該小時）','days':nd,
  'profile':{k:[round(x/sum(tot[k]),5) for x in tot[k]] for k in tot},'stations':{}}
for name,s in byname.items():
    h=H.get(name)
    if not h:continue
    out['stations'][s['sno']]={'name':name,'la':float(s['latitude']),'lo':float(s['longitude']),'wk':[round(x/nd['wk'],1) for x in h['wk']],'we':[round(x/nd['we'],1) for x in h['we']]}
json.dump(out,open('footfall_hourly.json','w'),ensure_ascii=False,separators=(',',':'))
print('days',nd,'stations in padded demo area',len(byname),'with data',len(out['stations']))
