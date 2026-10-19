"""Keep observed totals intact; add explicit date-quality sensitivity."""
import csv
import io
import json
import statistics
import zipfile
from collections import Counter
from datetime import datetime
from pathlib import Path
import shapefile
from analyze import ROOT, CENTER, distance, digest, write_csv, write_json


def main():
    summary=json.loads((ROOT/'results/summary.json').read_text())
    def rows(name):
        with (ROOT/'results'/name).open(encoding='utf-8-sig') as f:return list(csv.DictReader(f))
    days=[f'2026-07-{d:02d}' for d in range(1,32)]
    daily={r['date']:int(r['events']) for r in rows('source-daily.csv') if r['side']=='borrow'}
    median=statistics.median(daily.get(d,0) for d in days)
    flagged=[d for d in days if daily.get(d,0)<median*0.1]
    stations=rows('stations.csv')
    eligible={r['station_id']:r for r in stations if r['within_500m']=='True' and r['campus']=='False'}
    hourly=rows('hourly.csv')
    counter=Counter()
    for r in hourly:
        if r['date'] not in flagged and r['station_id'] in eligible:counter[r['station_id']]+=int(r['events'])
    top=sorted(eligible,key=lambda sid:(-counter[sid],sid))[:5]
    fixed={r['station_id'] for r in summary['shortlist']}
    profiles=[]
    for kind in ('weekday','weekend'):
        kept=[d for d in days if d not in flagged and (datetime.fromisoformat(d).weekday()<5)==(kind=='weekday')]
        for h in range(24):
            n=sum(int(r['events']) for r in hourly if r['station_id'] in fixed and r['date'] in kept and int(r['hour'])==h)
            profiles.append({'day_type':kind,'hour':h,'events':n,'days':len(kept),'average_per_day':round(n/len(kept),3)})
    quality={'amendment_sha256':digest(ROOT/'quality-amendment.md'),'daily_borrow_median':median,'threshold_fraction':0.1,
        'flagged_dates':flagged,'primary_top5':[r['station_id'] for r in summary['shortlist']],
        'excluding_flagged_top5':top,'same_top5_members':set(top)==fixed,
        'ranked_excluding_flagged':[{'station_id':sid,'name':eligible[sid]['name'],'events':counter[sid]} for sid in top],
        'profile_denominators':{kind:next(x['days'] for x in profiles if x['day_type']==kind) for kind in ('weekday','weekend')},
        'profile_peaks':{kind:max([r for r in profiles if r['day_type']==kind],key=lambda r:r['average_per_day']) for kind in ('weekday','weekend')},
        'zero_snapshot_station_is_unknown':summary['no_observation_500m']}
    write_json('quality.json',quality)
    write_csv('quality-hourly.csv',profiles)
    # Source label says TWD97; actual SHP stores degree-like X/Y and lacks .prj.
    # Preserve values as a historical positional clue; never rank by bus distance.
    bus=[]
    with zipfile.ZipFile(ROOT/'inputs/bus-stops-2021.zip') as z:
        r=shapefile.Reader(shp=io.BytesIO(z.read('busstop/busstop.shp')),shx=io.BytesIO(z.read('busstop/busstop.shx')),dbf=io.BytesIO(z.read('busstop/busstop.dbf')),encoding='utf-8')
        for index,record in enumerate(r.iterShapeRecords(),1):
            lon,lat=record.shape.points[0]
            assert 120<lon<123 and 24<lat<26, 'Unexpected source coordinate units'
            if distance(CENTER,(lon,lat))<=700:
                bus.append({'source_row':index,'stop_id':record.record[0],'name':record.record[1],'raw_x':lon,'raw_y':lat,
                    'approximate_500m_selection':distance(CENTER,(lon,lat))<=500})
        write_json('bus-context.json',{'source_rows':len(r),'source_date':'2021-04-11','missing_prj':not any(n.endswith('.prj') for n in z.namelist()),
            'coordinate_caveat':'目錄標 TWD97；檔案 X/Y 為經緯度範圍且未附投影定義。未換算為公車可達距離，不作排名。','rows':bus})
    print(json.dumps(quality,ensure_ascii=False))
    print('Historical bus rows in approximate 500m:',sum(r['approximate_500m_selection'] for r in bus))


if __name__=='__main__':main()
