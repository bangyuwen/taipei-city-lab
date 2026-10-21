"""Recheck two stations without replacing the frozen ten-station comparison."""
import csv, hashlib, importlib.util, io, json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SITE=ROOT.parents[1]
BASE=ROOT.parent/'mrt-bin-comparison-2026-10-22'
spec=importlib.util.spec_from_file_location('mrt',BASE/'analyze.py')
mrt=importlib.util.module_from_spec(spec);spec.loader.exec_module(mrt)

def read(path):
    data=path.read_bytes()
    try:text=data.decode('utf-8-sig')
    except UnicodeDecodeError:text=data.decode('cp950')
    return list(csv.DictReader(io.StringIO(text)))

def independent_distance(a,b):
    lon1,lat1,lon2,lat2=map(math.radians,(*a,*b))
    cosine=math.sin(lat1)*math.sin(lat2)+math.cos(lat1)*math.cos(lat2)*math.cos(lon1-lon2)
    return 6371000*math.acos(max(-1,min(1,cosine)))

def analyze():
    receipts=json.loads((ROOT/'retrieval.json').read_text())+json.loads((ROOT/'additional-retrieval.json').read_text())
    for r in receipts:
        assert hashlib.sha256((ROOT/r['file']).read_bytes()).hexdigest()==r['sha256'],r['file']
    venues=read(ROOT/'inputs/venues.csv')
    old_venues=read(mrt.VENUES)
    streets=read(ROOT/'inputs/streets-2026-10-21.csv')
    old_streets=read(mrt.STREET)
    selected=[{'source_csv_row':i+2,**r} for i,r in enumerate(venues) if r['地址'] in ('中山捷運站','忠孝新生捷運站')]
    assert len(selected)==3
    xinsheng=[r for r in selected if r['地址']=='忠孝新生捷運站']
    different_fields=[k for k in venues[0] if xinsheng[0][k]!=xinsheng[1][k]]
    assert different_fields==['行政區']
    assert venues==old_venues, 'Venue source changed; reassess all cited original rows.'
    stations=json.loads((BASE/'results/comparison.json').read_text())['results']
    comparisons=[]
    for station in stations:
        if station['station'] not in ('中山','忠孝新生'):continue
        valid=[(i+2,r,mrt.coordinate(r)) for i,r in enumerate(streets) if mrt.coordinate(r)]
        distances=[]
        for row,r,coord in valid:
            nearest=min(station['exits'],key=lambda e:mrt.distance(coord,e['coordinate']))
            distance=mrt.distance(coord,nearest['coordinate'])
            check=min(independent_distance(coord,e['coordinate']) for e in station['exits'])
            assert abs(distance-check)<0.01
            distances.append((distance,row,r,nearest['name']))
        counts={str(n):sum(d<=n for d,*_ in distances) for n in (100,200,300,500)}
        near=sorted(distances)[0]
        matched=[{'source_csv_row':row,'distance_m':round(d,3),'nearest_exit':ex,**r} for d,row,r,ex in sorted(distances) if d<=500]
        comparisons.append({'station':station['station'],'exit_count':len(station['exits']),'baseline_street_rows':station['street_rows'],'rechecked_street_rows':counts,'within_500m':matched,'nearest_street_record':{'source_csv_row':near[1],'distance_m':round(near[0],3),'nearest_exit':near[3],**near[2]}})
    result={'checked_on':'2026-10-22','venue_catalog_version':'2026-08-18','street_catalog_version':'2026-10-21','venue_parsed_rows_unchanged':venues==old_venues,'venue_source_rows':len(venues),'original_venue_records':selected,'xinsheng_differing_fields':different_fields,'physical_overlap_confirmed':None,'usable_bin_count':{'中山':None,'忠孝新生':None},'street_source_rows':len(streets),'street_valid_coordinate_rows':sum(bool(mrt.coordinate(r)) for r in streets),'invalid_street_csv_rows':[i+2 for i,r in enumerate(streets) if not mrt.coordinate(r)],'stations':comparisons,'limits':['Same retained 2026-08-04 exits; radii are straight-line unions, not walking distance.','Only these two stations recalculated. The ten-station comparison remains a 2026-09-30 street snapshot.','Changed records do not establish installations, removals, or currently usable bins.','Venue coordinates do not locate individual facilities; no sums of place counts.']}
    (ROOT/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'venue_rows':len(selected),'duplicate_fields_except':different_fields,'street_rows':len(streets),'invalid':result['invalid_street_csv_rows'],'stations':[{k:r[k] for k in ('station','rechecked_street_rows')} for r in comparisons]},ensure_ascii=False))
if __name__=='__main__':analyze()
