import csv,json,gzip,math,collections
def gj(feats,fn): json.dump({"type":"FeatureCollection","features":feats},open(fn,"w"),ensure_ascii=False)
def F(lon,lat,p): return {"type":"Feature","geometry":{"type":"Point","coordinates":[lon,lat]},"properties":p}
inb=lambda lat,lon: 24.9<lat<25.25 and 121.4<lon<121.7
# bins
rows=list(csv.DictReader(open('bins_raw.csv',encoding='big5',errors='replace')))
bins=[];seen=set();bad=dup=0
for r in rows:
    try: lon,lat=float(r['經度']),float(r['緯度'])
    except: bad+=1;continue
    if not inb(lat,lon): bad+=1;continue
    k=(round(lon,6),round(lat,6))
    if k in seen: dup+=1;continue
    seen.add(k);bins.append(F(lon,lat,{"district":r['行政區'].strip(),"address":r['地址'].strip(),"note":r['備註'].strip()}))
print("bins raw",len(rows),"bad",bad,"dupcoord",dup,"kept",len(bins))
gj(bins,'bins.geojson')
# youbike
yb=json.load(open('youbike_raw.json'));ybf=[]
for s in yb:
    lat,lon=float(s['latitude']),float(s['longitude'])
    if not inb(lat,lon): continue
    ybf.append(F(lon,lat,{"sno":s['sno'],"name":s['sna'].replace('YouBike2.0_',''),"district":s['sarea'],"address":s['ar'],"total":s.get('Quantity') or s.get('total'),"available_rent":s.get('available_rent_bikes'),"available_return":s.get('available_return_bikes'),"updated":s['updateTime'],"active":s['act']}))
print("youbike raw",len(yb),"kept",len(ybf))
gj(ybf,'youbike.geojson')
# bus stops: dedupe by stopLocationId
d=json.loads(gzip.open('busstop_raw.gz').read().decode('utf-8-sig'))['BusInfo']
g=collections.OrderedDict();badb=0
for s in d:
    try: lat,lon=float(s['latitude']),float(s['longitude'])
    except: badb+=1;continue
    if not inb(lat,lon): badb+=1;continue
    k=s['stopLocationId']
    if k not in g: g[k]=F(lon,lat,{"stopLocationId":k,"name":s['nameZh'],"address":s['address'],"routes":0})
    g[k]['properties']['routes']+=1
# approx district = nearest YouBike station's district if within 1km, else 'outside/unknown'
def hav(a,b,c,e):
    R=6371000;p=math.radians;dl=p(c-a);dn=p(e-b)
    return 2*R*math.asin(math.sqrt(math.sin(dl/2)**2+math.cos(p(a))*math.cos(p(c))*math.sin(dn/2)**2))
ypts=[(f['geometry']['coordinates'][1],f['geometry']['coordinates'][0],f['properties']['district']) for f in ybf]
bs=[]
for f in g.values():
    lon,lat=f['geometry']['coordinates']
    dd,dist=min((hav(lat,lon,a,b),c) for a,b,c in ypts if abs(a-lat)<0.02 and abs(b-lon)<0.02) if any(abs(a-lat)<0.02 and abs(b-lon)<0.02 for a,b,c in ypts) else (9e9,None)
    f['properties']['district_approx']=dist if dd<1000 else 'outside_taipei?'
    bs.append(f)
print("bus raw route-stops",len(d),"bad",badb,"unique stopLocationId",len(bs),"approx in Taipei",sum(f['properties']['district_approx']!='outside_taipei?' for f in bs))
gj(bs,'busstops.geojson')
# hotspot
bpts=[(f['geometry']['coordinates'][1],f['geometry']['coordinates'][0]) for f in bins]
def nearest(lat,lon): return min(hav(lat,lon,a,b) for a,b in bpts)
out=[]
for f in ybf: 
    lon,lat=f['geometry']['coordinates'];out.append(("youbike",f['properties']['name'],f['properties']['district'],lat,lon,nearest(lat,lon)))
for f in bs:
    if f['properties']['district_approx']=='outside_taipei?': continue
    lon,lat=f['geometry']['coordinates'];out.append(("bus",f['properties']['name'],f['properties']['district_approx'],lat,lon,nearest(lat,lon)))
with open('hotspot_points.csv','w',newline='',encoding='utf-8-sig') as fh:
    w=csv.writer(fh);w.writerow(["type","name","district","lat","lon","nearest_bin_m"])
    for o in sorted(out,key=lambda x:-x[5]): w.writerow(list(o[:5])+[round(o[5])])
agg=collections.defaultdict(lambda:[0,0,0])
for t,n,dis,*_,m in out:
    a=agg[(t,dis)];a[0]+=1;a[1]+=m>100;a[2]+=m>200
with open('hotspot_by_district.csv','w',newline='',encoding='utf-8-sig') as fh:
    w=csv.writer(fh);w.writerow(["type","district","total","no_bin_within_100m","no_bin_within_200m","pct_no_bin_200m"])
    for (t,dis),a in sorted(agg.items(),key=lambda x:-x[1][2]): w.writerow([t,dis,*a,round(100*a[2]/a[0],1)])
for t in("youbike","bus"):
    L=[o for o in out if o[0]==t];print(t,"n",len(L),">100m",sum(o[5]>100 for o in L),">200m",sum(o[5]>200 for o in L))
