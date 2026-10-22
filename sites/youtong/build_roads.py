# OSM 路網（示範區外擴 300m），離線前處理。來源：Geofabrik taiwan-261018.osm.pbf（單次下載；Overpass 從此環境連線失敗）
# osmium extract -b 121.52103,25.00480,121.55897,25.04270 → tags-filter 成 drive.osm / walk.osm（見 README）
import osmnx as ox, json, datetime
S,W,N,E=25.0075,121.5240,25.0400,121.5560; dla=300/111320; dlo=300/(111320*0.9063)
bbox=(W-dlo,S-dla,E+dlo,N+dla)
ox.settings.useful_tags_way=list(ox.settings.useful_tags_way)+['foot','access','motor_vehicle']
import networkx as nx
bad=lambda d,kind:(str(d.get('access'))in('private','no')and not(kind=='walk'and str(d.get('foot'))in('yes','designated')))or(kind=='walk'and str(d.get('foot'))=='no')or(kind=='drive'and str(d.get('motor_vehicle'))=='no')
for kind,geom in (('drive',True),):  # 步行路網改由 build_walk_city.py 產生（全臺北市）
    G=ox.graph_from_xml(f'/workspace/raw/{kind}.osm',bidirectional=(kind=='walk'),simplify=False,retain_all=True)
    G.remove_edges_from([(u,v,k) for u,v,k,d in G.edges(keys=True,data=True) if bad(d,kind)])
    G=ox.truncate.truncate_graph_bbox(G,bbox)
    cc=max((nx.strongly_connected_components if kind=='drive' else nx.weakly_connected_components)(G),key=len)
    G=ox.simplify_graph(G.subgraph(cc).copy())
    ids={n:i for i,n in enumerate(G.nodes)}
    nodes=[[round(G.nodes[n]['y'],6),round(G.nodes[n]['x'],6)] for n in G.nodes]
    best={}
    for u,v,d in G.edges(data=True):
        k=(ids[u],ids[v]);L=d['length']
        if k[0]==k[1]: continue
        if k not in best or L<best[k][0]:
            g=[[round(y,5),round(x,5)] for x,y in list(d['geometry'].coords)[1:-1]] if geom and 'geometry' in d else None
            best[k]=(L,g)
    adj=[[] for _ in nodes]; gm={}
    for (a,b),(L,g) in best.items():
        if kind=='walk' and a>b and (b,a) in best: continue  # 步行路網雙向：只存一次
        adj[a].append([b,round(L,1)])
        if g: gm[f'{a},{b}']=g
    out={'kind':kind,'date':'2026-10-18','built':datetime.date.today().isoformat(),'bbox':bbox,'source':'© OpenStreetMap contributors (ODbL)','oneway':kind=='drive','undirected':kind=='walk','nodes':nodes,'adj':adj}
    if geom: out['geom']=gm
    json.dump(out,open(f'roads_{kind}.json','w'),separators=(',',':'),ensure_ascii=False)
    print(kind,len(nodes),'nodes',len(best),'edges')
