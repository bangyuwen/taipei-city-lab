# Build merged data for the MVP. Run with /tmp/pwv/bin/python (needs shapely, pyproj)
import csv,json,gzip,math,collections,re
from shapely.geometry import shape,Point,Polygon,MultiPolygon,mapping
from shapely.ops import transform
from pyproj import Transformer
def hav(a,b,c,d):
    R=6371000;r=math.radians
    return 2*R*math.asin(math.sqrt(math.sin(r(c-a)/2)**2+math.cos(r(a))*math.cos(r(c))*math.sin(r(d-b)/2)**2))
def save(feats,fn): json.dump({"type":"FeatureCollection","features":feats},open(fn,"w"),ensure_ascii=False,separators=(',',':'))
F=lambda lon,lat,p:{"type":"Feature","geometry":{"type":"Point","coordinates":[round(lon,6),round(lat,6)]},"properties":p}
# --- districts from TopoJSON (MOI boundaries via taiwan-atlas)
t=json.load(open('towns-10t_raw.json'));sc,tr=t['transform']['scale'],t['transform']['translate']
arcs=[]
for a in t['arcs']:
    x=y=0;pts=[]
    for dx,dy in a: x+=dx;y+=dy;pts.append((x*sc[0]+tr[0],y*sc[1]+tr[1]))
    arcs.append(pts)
def ring(ix):
    out=[]
    for i in ix:
        p=arcs[i] if i>=0 else arcs[~i][::-1]
        out+= p if not out else p[1:]
    return out
dists={}
for g in t['objects']['towns']['geometries']:
    pr=g['properties']
    if pr['COUNTYNAME'].replace('台','臺')!='臺北市':continue
    polys=[g['arcs']] if g['type']=='Polygon' else g['arcs']
    geom=MultiPolygon([Polygon(ring(p[0]),[ring(h) for h in p[1:]]) for p in polys]).buffer(0)
    dists[pr['TOWNNAME']]=geom
print("districts",len(dists),list(dists))
tm=Transformer.from_crs(4326,3826,always_xy=True).transform
area={k:transform(tm,v).area/1e6 for k,v in dists.items()}
def dist_of(lon,lat):
    p=Point(lon,lat)
    for k,v in dists.items():
        if v.contains(p): return k
    return None
save([{"type":"Feature","geometry":mapping(v.simplify(0.0003)),"properties":{"name":k,"area_km2":round(area[k],2)}} for k,v in dists.items()],'districts.geojson')
# --- bins: merge two resources
bins=[];stat=collections.Counter()
def addbin(r,src):
    raw=r['經度'].strip()+r['緯度'].strip();bad=raw!=raw.replace('?','').replace('？','')
    # 與研究 repo（taipei-city-lab youbike-bin-screening invalid-records.csv）一致：座標含 '?' 的列視為無效、不使用
    try: lon,lat=float(r['經度'].strip().lstrip('?？')),float(r['緯度'].strip().lstrip('?？'))
    except: stat['bad_'+src]+=1;return
    if not(24.9<lat<25.25 and 121.4<lon<121.7): stat['bad_'+src]+=1;return
    late=False
    for b in bins:
        bl,ba=b['geometry']['coordinates']
        if abs(ba-lat)<1e-4 and hav(lat,lon,ba,bl)<5:
            if src=='main' and b['properties']['source'].startswith('main'):
                # 街道清冊每一列都保留（地址不同的重疊點）；只標記重疊
                stat['colocated_main']+=1;late=True;break
            stat['dup_'+src]+=1
            if src not in b['properties']['source']: b['properties']['source']+='+'+src
            return
    note=r['備註'].strip();m=re.match(r'(\d+)處',note)
    bins.append(F(lon,lat,{"id":"","district":r['行政區'].strip().replace('台','臺'),"address":r['地址'].strip(),"note":note,"count":int(m.group(1)) if m else 1,"source":src,"_late":late,"_bad":bad}))
for r in csv.DictReader(open('bins_raw.csv',encoding='big5',errors='replace')): addbin(r,'main')
for r in csv.DictReader(open('bins130_raw.csv',encoding='big5',errors='replace')): addbin(r,'scenic130')
# id 保持舊版穩定：原本保留的列依序 B0000…，原本被 5m 去重吃掉的 17 列接在最後
order=[b for b in bins if not b['properties']['_late']]+[b for b in bins if b['properties']['_late']]
for i,b in enumerate(order):
    b['properties']['id']='B%04d'%i;del b['properties']['_late']
    d=dist_of(*b['geometry']['coordinates'])
    if d and d!=b['properties']['district']: stat['district_mismatch']+=1
for b in bins:  # 5m 內同清冊列數（地圖重疊點顯示「此處 N 列」）
    bl,ba=b['geometry']['coordinates']
    if b['properties']['source'].startswith('main'):
        b['properties']['colocated']=sum(1 for o in bins if o['properties']['source'].startswith('main') and abs(o['geometry']['coordinates'][1]-ba)<1e-4 and hav(ba,bl,o['geometry']['coordinates'][1],o['geometry']['coordinates'][0])<5)
bins=[b for b in order if not b['properties'].pop('_bad')]  # 先編 id 再剔除，id 保持穩定
stat['invalid_coord_dropped']=len(order)-len(bins)
print("bins",len(bins),dict(stat),collections.Counter(b['properties']['source'] for b in bins))
save(bins,'bins.geojson')
# --- youbike
act={o['sno']:o for o in json.load(open('youbike_activity_202607.json'))}
yb=[]
for s in json.load(open('youbike_raw.json')):
    lat,lon=float(s['latitude']),float(s['longitude'])
    yb.append(F(lon,lat,{"id":s['sno'],"name":s['sna'].replace('YouBike2.0_',''),"district":dist_of(lon,lat) or s['sarea'],"address":s['ar'],"total":s.get('Quantity'),"rent":s.get('available_rent_bikes'),"ret":s.get('available_return_bikes'),"act":act[s['sno']]['activity_all'] if act[s['sno']]['matched'] else None}))
save(yb,'youbike.geojson')
# --- bus stops (unique stopLocationId), district by polygon
d=json.loads(gzip.open('busstop_raw.gz').read().decode('utf-8-sig'))['BusInfo'];g={}
for s in d:
    try: lat,lon=float(s['latitude']),float(s['longitude'])
    except: continue
    if not(24.9<lat<25.25 and 121.4<lon<121.7): continue
    k=s['stopLocationId']
    if k not in g: g[k]=F(lon,lat,{"id":k,"name":s['nameZh'],"address":s['address'],"routes":0,"district":None})
    g[k]['properties']['routes']+=1
bs=list(g.values())
for f in bs: f['properties']['district']=dist_of(*f['geometry']['coordinates'])
save(bs,'busstops.geojson')  # all (incl. New Taipei, district=null)
tp=[f for f in bs if f['properties']['district']];save(tp,'busstops_taipei.geojson')
print("bus unique",len(bs),"in Taipei polygon",len(tp))
# --- hotspot stats
bp=[(b['geometry']['coordinates'][1],b['geometry']['coordinates'][0]) for b in bins if b['properties']['source'].startswith('main')]  # 只用 681 列街道清冊，不與 130 合併
near=lambda la,lo:min(hav(la,lo,a,b) for a,b in bp)
rows=[("youbike",f['properties']['name'],f['properties']['district'],*f['geometry']['coordinates'][::-1]) for f in yb]+[("bus",f['properties']['name'],f['properties']['district'],*f['geometry']['coordinates'][::-1]) for f in tp]
rows=[r+(near(r[3],r[4]),) for r in rows]
with open('hotspot_points.csv','w',newline='',encoding='utf-8-sig') as fh:
    w=csv.writer(fh);w.writerow(["type","name","district","lat","lon","nearest_bin_m"])
    for r in sorted(rows,key=lambda x:-x[5]): w.writerow(list(r[:5])+[round(r[5])])
agg=collections.defaultdict(lambda:[0,0,0])
for r in rows: a=agg[(r[0],r[2])];a[0]+=1;a[1]+=r[5]>100;a[2]+=r[5]>200
bc=collections.Counter(b['properties']['district'] for b in bins)
with open('hotspot_by_district.csv','w',newline='',encoding='utf-8-sig') as fh:
    w=csv.writer(fh);w.writerow(["type","district","total","no_bin_within_100m","no_bin_within_200m","pct_no_bin_200m","bins_in_district"])
    for (ty,ds),a in sorted(agg.items(),key=lambda x:-x[1][2]): w.writerow([ty,ds,*a,round(100*a[2]/a[0],1),bc.get(ds,0)])
for ty in("youbike","bus"):
    L=[r for r in rows if r[0]==ty];print(ty,len(L),">100",sum(r[5]>100 for r in L),">200",sum(r[5]>200 for r in L))
print("bins by district",dict(bc))
