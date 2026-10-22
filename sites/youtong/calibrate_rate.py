# 用官方公開清運頻率校準「每次借還產生公升數」（PM 決定 v2）
# 來源：環保局資料（聯合報 2025-08-17，經濟日報轉載 https://money.udn.com/money/story/7307/8944421）
#   每個清潔箱約 120 公升；清潔隊每日巡查清運約 3–6 次。
# 假設：示範區「人流中位數」的桶，在平日一天裝滿 3 次（取官方下限 3 次）。
#   litersPerRide = 3 × 120 / F50（中位數桶的平日每日人流）
import json,math,re,statistics
def hav(a,b,c,d):
    R=6371000;r=math.radians;return 2*R*math.asin(math.sqrt(math.sin(r(c-a)/2)**2+math.cos(r(a))*math.cos(r(c))*math.sin(r(d-b)/2)**2))
cfg=open('config.js',encoding='utf-8').read()
a,b,c,d=map(float,re.search(r"bounds:\[\[([\d.]+),([\d.]+)\],\[([\d.]+),([\d.]+)\]\]",cfg).groups())
H=json.load(open('footfall_hourly.json'));S=list(H['stations'].values())
bins=[f for f in json.load(open('bins.geojson'))['features'] if f['properties']['source'].startswith('main')]
F=[]
for f in bins:
    lo,la=f['geometry']['coordinates']
    if not(a<=la<=c and b<=lo<=d):continue
    ys=[s for s in S if hav(la,lo,s['la'],s['lo'])<=200]
    F.append(sum(sum(s['wk']) for s in ys)/len(ys) if ys else 0)
F50=statistics.median(F);lpr=3*120/F50
print(f"bins in demo area {len(F)}; weekday daily rides median F50 {F50:.1f} (min {min(F):.0f}, max {max(F):.0f})")
print(f"litersPerRide = 3*120/{F50:.1f} = {lpr:.4f}")
