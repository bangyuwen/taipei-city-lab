"""Compare a fixed high-ridership cohort with street records; never sum venue places."""
import collections, csv, hashlib, io, json, math, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STREET = ROOT.parent/'youbike-bin-screening-2026-10-18/inputs/bins-2026.csv'
VENUES = ROOT.parent/'youbike-bin-screening-2026-10-18/inputs/venues.csv'
RADII = (100, 200, 300, 500)

def read_csv(path, encoding='utf-8-sig'):
    with path.open(encoding=encoding,newline='') as stream: return list(csv.DictReader(stream))

def normalize(s):
    value = s.strip().replace('臺','台')
    return {'大橋頭站':'大橋頭'}.get(value,value)

def coordinate(row):
    try:
        lon,lat = float(row['經度']),float(row['緯度'])
        return (lon,lat) if math.isfinite(lon) and math.isfinite(lat) and -180<=lon<=180 and -90<=lat<=90 else None
    except (ValueError,TypeError):return None

def distance(a,b):
    lon1,lat1,lon2,lat2=map(math.radians,(*a,*b))
    h=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371000*2*math.asin(min(1,math.sqrt(h)))

def calculate():
    stations=read_csv(ROOT/'inputs/stations-2026-09-04.csv')
    city=collections.defaultdict(list)
    for rownum,r in enumerate(stations,2):
        if '臺北市' not in r['StationAddress']:continue
        name=normalize(r['StationName'].strip("'{}").split(',')[0])
        city[name].append({'source_record':rownum-1,'station_id':r['StationID'],'address':r['StationAddress']})
    daily=read_csv(ROOT/'inputs/station-day-202609.csv')
    totals=collections.Counter();dates=collections.defaultdict(set)
    for r in daily:
        name=normalize(r['station'])
        if name not in city: continue
        assert r['entries'] != '' and r['exits'] != '', f'Missing direction in Taipei: {name}'
        totals[name]+=int(r['entries'])+int(r['exits']);dates[name].add(r['date'])
    eligible=sorted(set(city)&set(totals),key=lambda n:(-totals[n],n))
    selected=eligible[:10]
    exits=collections.defaultdict(list)
    unmatched=[]
    for rownum,r in enumerate(read_csv(ROOT/'inputs/exits-2026-08-04.csv','cp950'),2):
        name=normalize(re.sub(r'(?:站出口.*|M[1-8])$','',r['出入口名稱']))
        # The source names Taipei Main's exits as 台北車站M1 through M8.
        point=coordinate(r)
        if name in city and point:
            exits[name].append({'source_csv_row':rownum,'name':r['出入口名稱'],'coordinate':point})
        elif name in city:unmatched.append({'row':rownum,'name':name,'reason':'invalid coordinate'})
    street=read_csv(STREET);valid=[(i+2,r,coordinate(r)) for i,r in enumerate(street) if coordinate(r)]
    venues=read_csv(VENUES)
    venue_alias={'101站/世貿捷運站':'台北101/世貿'}
    grouped_venues=collections.defaultdict(list)
    for rownum,r in enumerate(venues,2):
        address=normalize(r['地址'])
        if address in venue_alias:name=venue_alias[address]
        elif address.endswith('捷運站'):name=address[:-3]
        else:continue
        grouped_venues[name].append({'source_csv_row':rownum,**r})
    results=[];matches=[]
    for rank,name in enumerate(selected,1):
        assert len(dates[name])==30, (name,dates[name])
        points=exits[name]
        assert points, f'Missing selected station exits: {name}'
        distances=[]
        for rownum,r,point in valid:
            nearest=min(points,key=lambda e:distance(point,e['coordinate']))
            dist=distance(point,nearest['coordinate'])
            distances.append((dist,rownum,r,point))
            if dist<=500:matches.append({'station':name,'source_csv_row':rownum,'district':r['行政區'],'address':r['地址'],'longitude':point[0],'latitude':point[1],'nearest_exit':nearest['name'],'distance_m':round(dist,3)})
        counts={str(radius):sum(d<=radius for d,*_ in distances) for radius in RADII}
        coords={str(radius):len({point for d,_,_,point in distances if d<=radius}) for radius in RADII}
        results.append({'rank':rank,'station':name,'monthly_gate_passages':totals[name],'daily_gate_passages':totals[name]/30,'days':30,'exit_count':len(points),'exits':points,'street_rows':counts,'distinct_street_coordinates':coords,'venues':grouped_venues[name]})
    receipt=json.loads((ROOT/'inputs/od-receipt.json').read_text())
    summary={'period':'2026-09','days':30,'taipei_station_names_in_catalog':len(city),'eligible_station_count':len(eligible),'excluded_missing_od':sorted(set(city)-set(totals)),'station_names_in_od':len(receipt['station_names']),'street_source_rows':len(street),'street_valid_rows':len(valid),'invalid_street_rows':[i+2 for i,r in enumerate(street) if not coordinate(r)],'venue_source_rows':len(venues),'exit_source_rows':len(read_csv(ROOT/'inputs/exits-2026-08-04.csv','cp950')),'radii_m':RADII,'primary_radius_m':300,'cohort_size':10,'od_journeys':receipt['journeys'],'results':results}
    output=ROOT/'results';output.mkdir(exist_ok=True)
    (output/'comparison.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    with (output/'street-matches.csv').open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(matches[0]));w.writeheader();w.writerows(matches)
    with (output/'station-ranking.csv').open('w',encoding='utf-8',newline='') as f:
        w=csv.writer(f);w.writerow(['rank','station','monthly_gate_passages','daily_gate_passages','selected'])
        for i,n in enumerate(eligible,1):w.writerow([i,n,totals[n],totals[n]/30,i<=10])
    print('eligible',len(eligible),'missing OD',summary['excluded_missing_od'])
    for r in results:print(r['rank'],r['station'],round(r['daily_gate_passages']),r['street_rows'],r['distinct_street_coordinates'],[(x['行政區'],x['備註']) for x in r['venues']])
    return summary

if __name__=='__main__':calculate()
