"""Recompute a bounded station-activity study from preserved official inputs."""
import argparse
import calendar
import csv
import hashlib
import io
import json
import math
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
PRIOR = ROOT.parent / 'youbike-bin-screening-2026-10-18'
CENTER = (121.53438, 25.01491)
MONTH = '2026-07'


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def normalize(name):
    return name.removeprefix('YouBike2.0_').replace('（', '(').replace('）', ')').strip()


def distance(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, (*a, *b))
    value = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 2 * 6371000 * math.asin(math.sqrt(min(1, max(0, value))))


def point(lon, lat):
    try:
        value = float(lon), float(lat)
    except (ValueError, TypeError):
        return None
    return value if 121.4 <= value[0] <= 121.7 and 24.9 <= value[1] <= 25.25 else None


def write_json(name, data):
    (ROOT / 'results' / name).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')


def write_csv(name, rows):
    with (ROOT / 'results' / name).open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def load_facilities(filename):
    rows = []
    with (PRIOR / 'inputs' / filename).open(encoding='utf-8-sig', newline='') as f:
        for rownum, row in enumerate(csv.DictReader(f), 2):
            xy = point(row['經度'], row['緯度'])
            if xy:
                rows.append({'source_row': rownum, 'name': row['地址'], 'area': row['行政區'], 'lon': xy[0], 'lat': xy[1]})
    return rows


def service(station, rows, prefix):
    pairs = sorted((distance((station['lon'], station['lat']), (r['lon'], r['lat'])), r['source_row'], r) for r in rows)
    d, _, r = pairs[0]
    return {prefix+'_nearest_m': round(d, 2), prefix+'_nearest_name': r['name'], prefix+'_source_row': r['source_row'],
            **{prefix+f'_rows_{radius}m': sum(x[0] <= radius for x in pairs) for radius in (50,100,150)}}


def main(archive):
    manifest = json.loads((ROOT/'manifest.json').read_text())
    assert digest(archive) == manifest['trip_archive']['sha256'], 'Archive digest mismatch'
    assert digest(ROOT/'protocol.md') == manifest['protocol_sha256'], 'Protocol changed'
    for item in manifest['inputs']:
        assert digest(ROOT/item['path']) == item['sha256'], item['path']
    (ROOT/'results').mkdir(exist_ok=True)
    raw_stations = json.loads((PRIOR/'inputs/youbike.json').read_text())
    assert len({r['sno'] for r in raw_stations}) == len(raw_stations)
    by_name = defaultdict(list)
    local = {}
    for r in raw_stations:
        by_name[normalize(r['sna'])].append(r['sno'])
        xy = point(r['longitude'],r['latitude'])
        if xy and r['act']=='1' and distance(CENTER,xy)<=700:
            local[r['sno']] = {'station_id':r['sno'],'name':normalize(r['sna']),'source_area':r['sarea'],
                'address':r['ar'],'lon':xy[0],'lat':xy[1], 'center_distance_m':round(distance(CENTER,xy),3),
                'campus':r['sarea']=='臺大公館校區'}
    mapping = {name: ids[0] for name, ids in by_name.items() if len(ids)==1}
    totals = Counter()
    unmatched = Counter()
    global_names = Counter()
    days = Counter()
    hourly = Counter()
    timestamp_cache = {}
    local_rows = 0
    header_expected = ['rent_time','rent_station','return_time','return_station','rent','bike_type','infodate']
    with zipfile.ZipFile(archive) as z:
        files = [n for n in z.namelist() if n.lower().endswith('.csv')]
        assert len(files)==1, 'Expected exactly one monthly CSV'
        with z.open(files[0]) as stream:
            reader = csv.reader(io.TextIOWrapper(stream, encoding='utf-8-sig', newline=''))
            assert next(reader)==header_expected
            for row in reader:
                totals['raw_rows']+=1
                if len(row)!=7:
                    totals['malformed_rows']+=1
                    continue
                is_local = False
                if row[6]!=row[0][:10]: totals['infodate_rent_date_mismatch']+=1
                for side, time_index, name_index in [('borrow',0,1),('return',2,3)]:
                    timestamp = row[time_index]
                    if timestamp not in timestamp_cache:
                        try: timestamp_cache[timestamp]=datetime.fromisoformat(timestamp)
                        except ValueError: timestamp_cache[timestamp]=None
                    dt=timestamp_cache[timestamp]
                    if dt is None:
                        totals[side+'_invalid_time']+=1
                        continue
                    if timestamp[:7]!=MONTH:
                        totals[side+'_outside_month']+=1
                        continue
                    totals[side+'_in_month']+=1
                    if dt.minute or dt.second: totals['subhour_timestamps']+=1
                    days[(dt.date().isoformat(),side)]+=1
                    name=normalize(row[name_index])
                    global_names[(name,side)]+=1
                    sid=mapping.get(name)
                    if sid is None:
                        unmatched[(name,side)]+=1
                        totals[side+'_unmatched']+=1
                    else:
                        totals[side+'_matched']+=1
                    if sid in local:
                        hourly[(sid,dt.date().isoformat(),dt.hour,side)]+=1
                        is_local=True
                local_rows += is_local
    totals['rows_touching_local_700m']=local_rows
    bins=load_facilities('bins-2026.csv')
    venues=load_facilities('venues.csv')
    historic=load_facilities('bins-2024.csv')
    station_side=Counter()
    for (sid, day, hour, side), count in hourly.items(): station_side[(sid,side)]+=count
    for sid,r in local.items():
        r['borrow']=station_side[(sid,'borrow')]
        r['return']=station_side[(sid,'return')]
        r['events']=r['borrow']+r['return']
        r['within_500m']=r['center_distance_m']<=500
        r['activity_status']='observed' if r['events'] else 'no_matched_observation'
        r.update(service(r,bins,'bins2026'))
        r.update(service(r,venues,'venues'))
        r.update(service(r,historic,'bins2024'))
    by_rank=lambda r:(-r['events'],r['station_id'])
    local500=sorted([r for r in local.values() if r['within_500m']],key=by_rank)
    public500=[r for r in local500 if not r['campus']]
    shortlist=public500[:5]
    for i,r in enumerate(shortlist,1): r['candidate_id']='C'+str(i)
    selected={r['station_id'] for r in shortlist}
    series=[]
    for kind in ('weekday','weekend'):
        valid_days=[f'2026-07-{d:02d}' for d in range(1,32) if (datetime(2026,7,d).weekday()<5)==(kind=='weekday')]
        for hour in range(24):
            count=sum(n for (sid,day,h,side),n in hourly.items() if sid in selected and day in valid_days and h==hour)
            series.append({'day_type':kind,'hour':hour,'events':count,'days':len(valid_days),'average_per_day':round(count/len(valid_days),3)})
    sensitivity=[]
    for radius in (300,500,700):
        eligible=sorted([r for r in local.values() if not r['campus'] and r['center_distance_m']<=radius],key=by_rank)
        top=eligible[:5]
        sensitivity.append({'radius_m':radius,'eligible_stations':len(eligible),'observed_stations':sum(r['events']>0 for r in eligible),
            'events':sum(r['events'] for r in eligible),'top5_station_ids':[r['station_id'] for r in top], 'top5_names':[r['name'] for r in top],
            'top5_events':sum(r['events'] for r in top),'shared_with_500m':len({r['station_id'] for r in top}&selected)})
    summary={'month':MONTH,'center':CENTER,'radius_m':500,'source_station_snapshot':'2026-10-18',
        'all_stations_500m':len(local500),'noncampus_stations_500m':len(public500),'campus_stations_500m':sum(r['campus'] for r in local500),
        'all_events_500m':sum(r['events'] for r in local500),'noncampus_events_500m':sum(r['events'] for r in public500),
        'top5_events':sum(r['events'] for r in shortlist),'shortlist':shortlist,'sensitivity':sensitivity,
        'no_observation_500m':[r['name'] for r in local500 if not r['events']],
        'ambiguous_snapshot_names':{n:ids for n,ids in by_name.items() if len(ids)>1},'totals':dict(totals),
        'days_with_borrow':sorted(d for (d,side),n in days.items() if side=='borrow'),
        'days_with_return':sorted(d for (d,side),n in days.items() if side=='return')}
    assert totals['borrow_in_month']==totals['borrow_matched']+totals['borrow_unmatched']
    assert totals['return_in_month']==totals['return_matched']+totals['return_unmatched']
    assert sum(r['events'] for r in local.values())==sum(hourly.values())
    assert sum(x['events'] for x in series)==summary['top5_events']
    summary['missing_borrow_dates']=[f'2026-07-{d:02d}' for d in range(1,32) if f'2026-07-{d:02d}' not in summary['days_with_borrow']]
    summary['missing_return_dates']=[f'2026-07-{d:02d}' for d in range(1,32) if f'2026-07-{d:02d}' not in summary['days_with_return']]
    summary['complete_calendar_coverage']=not summary['missing_borrow_dates'] and not summary['missing_return_dates']
    write_json('summary.json',summary)
    # Fill the optional candidate ID consistently without creating a second data model.
    write_csv('stations.csv',[{**r,'candidate_id':r.get('candidate_id','')} for r in sorted(local.values(),key=by_rank)])
    write_csv('hourly.csv',[{'station_id':sid,'date':day,'hour':hour,'side':side,'events':n} for (sid,day,hour,side),n in sorted(hourly.items())])
    write_csv('day-type-hourly.csv',series)
    write_csv('source-daily.csv',[{'date':day,'side':side,'events':n} for (day,side),n in sorted(days.items())])
    write_csv('unmatched-names.csv',[{'station_name':name,'side':side,'events':n} for (name,side),n in unmatched.most_common()])
    write_csv('source-station-events.csv',[{'station_name':name,'side':side,'events':n} for (name,side),n in global_names.most_common()])
    print(json.dumps({k:v for k,v in summary.items() if k not in ('shortlist','days_with_borrow','days_with_return','sensitivity')},ensure_ascii=False))
    print(json.dumps([{'name':r['name'],'events':r['events'],'nearest_bin_m':r['bins2026_nearest_m']} for r in shortlist],ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--archive',type=Path,required=True)
    main(parser.parse_args().archive)
