"""Validate units, original inputs, aggregation, independent distances and cohort."""
import collections, csv, hashlib, json, math, runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def validate():
    d=json.loads((ROOT/'results/comparison.json').read_text())
    receipt=json.loads((ROOT/'inputs/od-receipt.json').read_text())
    rows=list(csv.DictReader((ROOT/'inputs/station-day-202609.csv').open()))
    entries=collections.Counter(); exits=collections.Counter()
    for r in rows:
        if r['entries']!='':entries[r['date']]+=int(r['entries'])
        if r['exits']!='':exits[r['date']]+=int(r['exits'])
    assert sum(entries.values())==sum(exits.values())==receipt['journeys']==64273963
    assert len(entries)==len(exits)==30
    assert receipt['raw_rows']==8240400 and receipt['raw_bytes']==302444881
    assert len(receipt['blocks'])==630 and set(receipt['blocks'].values())=={13080}
    source=list(csv.DictReader((ROOT/'inputs/system-daily-202609.csv').open(encoding='cp950')))
    check=[]
    for r in source:
        date=f"{r['西元年']}-{int(r['月']):02}-{int(r['日']):02}"
        check.append({'date':date,'official_system_journeys':int(r['人次']),'od_journeys':entries[date],'difference':int(r['人次'])-entries[date]})
    system_total=sum(x['official_system_journeys'] for x in check)
    assert system_total==64319630
    # Preserve the discrepancy; do not rescale station counts or invent its cause.
    report={'status':'OD totals internally consistent; system total mismatch retained', 'system_journeys':system_total,'od_journeys':receipt['journeys'],'difference':system_total-receipt['journeys'],'difference_pct_system':100*(system_total-receipt['journeys'])/system_total,'daily':check}
    m=runpy.run_path(str(ROOT/'analyze.py'))
    street=m['read_csv'](m['STREET'])
    for r in d['results']:
        assert r['days']==30 and r['exit_count']>0
        assert list(r['street_rows'].values())==sorted(r['street_rows'].values())
        assert all(int(r['street_rows'][k])>=int(r['distinct_street_coordinates'][k]) for k in r['street_rows'])
        # Independent spherical-cosine calculation for every selected station and valid street row.
        counts={str(radius):0 for radius in d['radii_m']}
        for b in street:
            point=m['coordinate'](b)
            if point is None:continue
            lon,lat=map(math.radians,point)
            distances=[]
            for e in r['exits']:
                elon,elat=map(math.radians,e['coordinate'])
                cos=math.sin(lat)*math.sin(elat)+math.cos(lat)*math.cos(elat)*math.cos(lon-elon)
                distances.append(6371000*math.acos(max(-1,min(1,cos))))
            for radius in d['radii_m']:
                counts[str(radius)]+=min(distances)<=radius
        assert counts==r['street_rows'],(r['station'],counts)
    ranking=list(csv.DictReader((ROOT/'results/station-ranking.csv').open()))
    assert len(ranking)==74 and not d['excluded_missing_od']
    assert [r['station'] for r in ranking[:10]]==[r['station'] for r in d['results']]
    assert d['street_source_rows']==681 and d['street_valid_rows']==680 and d['venue_source_rows']==130
    assert [r['station'] for r in d['results'] if r['street_rows']['300']==0]==['中山','忠孝新生']
    assert all(r['street_rows']==r['distinct_street_coordinates'] for r in d['results'])
    (ROOT/'results/validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='daily'},ensure_ascii=False))
    return report
if __name__=='__main__':validate()
