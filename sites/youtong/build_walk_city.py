# 全臺北市步行路網（離線前處理）。來源：Geofabrik taiwan-261018.osm.pbf（同 build_roads.py 的單次下載）
# osmium extract -p tpe.geojson（districts.geojson 聯集外擴約 300m）→ tags-filter w/highway=…（見 README）→ walk.osm
# 輸出 roads_walk.json（取代 build_roads.py 的示範區步行路網）：精簡格式（度-2 節點已併入邊長、座標 1e-5 整數差分、邊長整數公尺、雙向只存一次）
import osmnx as ox, networkx as nx, json, datetime, sys
src=sys.argv[1] if len(sys.argv)>1 else '/workspace/raw/city/walk.osm'
ox.settings.useful_tags_way=list(ox.settings.useful_tags_way)+['foot','access']
G=ox.graph_from_xml(src,bidirectional=True,simplify=False,retain_all=True)
bad=lambda d:(str(d.get('access'))in('private','no')and str(d.get('foot'))not in('yes','designated'))or str(d.get('foot'))=='no'
G.remove_edges_from([(u,v,k) for u,v,k,d in G.edges(keys=True,data=True) if bad(d)])
cc=max(nx.weakly_connected_components(G),key=len)
G=ox.simplify_graph(G.subgraph(cc).copy())
# 依格網排序節點（鄰近節點編號相近 → 差分小、壓縮好）
ns=sorted(G.nodes,key=lambda n:(round(G.nodes[n]['y']/0.01),G.nodes[n]['x']))
ids={n:i for i,n in enumerate(ns)}
best={}
for u,v,d in G.edges(data=True):
    a,b=sorted((ids[u],ids[v]))
    if a==b: continue
    L=d['length']
    if (a,b) not in best or L<best[(a,b)]: best[(a,b)]=L
N=[];pla=plo=0
for n in ns:
    la,lo=round(G.nodes[n]['y']*1e5),round(G.nodes[n]['x']*1e5);N+=[la-pla,lo-plo];pla,plo=la,lo
E=[];pa=0
for (a,b) in sorted(best):
    E+=[a-pa,b-a,max(1,round(best[(a,b)]))];pa=a
lats=[G.nodes[n]['y'] for n in ns];lons=[G.nodes[n]['x'] for n in ns]
out={'kind':'walk','fmt':'delta1e5','date':'2026-10-18','built':datetime.date.today().isoformat(),
 'bbox':[min(lons),min(lats),max(lons),max(lats)],'source':'© OpenStreetMap contributors (ODbL)','undirected':True,'n':N,'e':E}
json.dump(out,open('roads_walk.json','w'),separators=(',',':'))
print(len(ns),'nodes',len(best),'edges')
