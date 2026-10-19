"""Independent raw-file reconciliation and distance check for published claims."""
import csv
import io
import json
import math
import zipfile
from collections import Counter
from pathlib import Path
from analyze import ROOT, PRIOR, digest


def validate(archive):
    result=json.loads((ROOT/'results/summary.json').read_text())
    names={r['name'] for r in result['shortlist']}
    counter=Counter();dates=Counter();rows=0
    with zipfile.ZipFile(archive) as z:
        with z.open(next(n for n in z.namelist() if n.endswith('.csv'))) as stream:
            reader=csv.reader(io.TextIOWrapper(stream,encoding='utf-8-sig'))
            next(reader)
            for row in reader:
                rows+=1;dates[row[0][:10]]+=1
                for t,name,side in ((row[0],row[1],'borrow'),(row[2],row[3],'return')):
                    if name in names and t.startswith('2026-07-'):counter[(name,side)]+=1
    assert rows==result['totals']['raw_rows']
    for r in result['shortlist']:
        assert r['borrow']==counter[(r['name'],'borrow')]
        assert r['return']==counter[(r['name'],'return')]
    with (PRIOR/'inputs/bins-2026.csv').open(encoding='utf-8-sig') as f:bins=list(csv.DictReader(f))
    errors=[]
    for r in result['shortlist']:
        b=bins[r['bins2026_source_row']-2]
        a1,o1,a2,o2=map(math.radians,[r['lat'],r['lon'],float(b['緯度']),float(b['經度'])])
        cosine=math.sin(a1)*math.sin(a2)+math.cos(a1)*math.cos(a2)*math.cos(o1-o2)
        distance=6371000*math.acos(max(-1,min(1,cosine)))
        errors.append(abs(distance-r['bins2026_nearest_m']))
    assert max(errors)<0.02
    assert dates['2026-07-11']==0 and dates['2026-07-10']==13249
    quality=json.loads((ROOT/'results/quality.json').read_text())
    assert quality['profile_denominators']=={'weekday':22,'weekend':7}
    assert all(s['top5_station_ids']==quality['primary_top5'] for s in result['sensitivity'])
    assert quality['same_top5_members']
    receipt={'passed':True,'raw_rows_independently_counted':rows,'candidate_endpoints_reconciled':len(names),
        'max_nearest_distance_difference_m':max(errors),'date_gap_reproduced':True,'radius_and_date_sensitivity':'same five stations',
        'source_archive_sha256':digest(archive),'result_sha256':digest(ROOT/'results/summary.json'),
        'quality_sha256':digest(ROOT/'results/quality.json'),'excludes':'No field validation, no source completeness guarantee, no causality or agency consent.'}
    (ROOT/'validation.json').write_text(json.dumps(receipt,indent=2)+'\n')
    return receipt


if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--archive',type=Path,required=True)
    print(json.dumps(validate(p.parse_args().archive)))
