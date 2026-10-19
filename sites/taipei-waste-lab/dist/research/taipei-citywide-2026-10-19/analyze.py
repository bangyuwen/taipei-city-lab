"""Reproduce all-city activity screening from fixed source bytes; no garbage inference."""
import argparse,csv,hashlib,io,json,math,zipfile
from collections import Counter,defaultdict
from datetime import datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parent
DISTRICTS=['松山區','信義區','大安區','中山區','中正區','大同區','萬華區','文山區','南港區','內湖區','士林區','北投區']
CAMPUS='臺大公館校區'; AREAS=DISTRICTS+[CAMPUS]; FLAGS={'2026-07-10','2026-07-11'}

def digest(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def norm(s):return s.removeprefix('YouBike2.0_').replace('（','(').replace('）',')').strip()
def point(x,y):
 try:x,y=float(x),float(y)
 except (ValueError,TypeError):return None
 return (x,y) if 121.4<=x<=121.7 and 24.9<=y<=25.25 else None
def distance(a,b):
 x,y,u,v=map(math.radians,(*a,*b)); h=math.sin((v-y)/2)**2+math.cos(y)*math.cos(v)*math.sin((u-x)/2)**2
 return 12742000*math.asin(math.sqrt(min(1,max(0,h))))
def read_csv(p):
 with Path(p).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def write_csv(name,rows):
 with (ROOT/'results'/name).open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)
def write_json(name,data):(ROOT/'results'/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def select(rows,gap=300,metric='events'):
 selected=[]
 for r in sorted((r for r in rows if r['eligible'] and r[metric]>0),key=lambda r:(-r[metric],r['station_id'])):
  if all(distance((r['lon'],r['lat']),(s['lon'],s['lat']))>=gap for s in selected):selected.append(r)
  if len(selected)==3:break
 return selected

def main(archive):
 m=json.loads((ROOT/'manifest.json').read_text());assert digest(archive)==m['trip_archive']['sha256']
 assert digest(ROOT/'protocol.md')==m['protocol_sha256']
 for p in m['inputs']:assert digest(ROOT/p['path'])==p['sha256'],p['path']
 prior=ROOT.parent/'youbike-bin-screening-2026-10-18/inputs';raw=json.loads((prior/'youbike.json').read_text())
 assert len({r['sno'] for r in raw})==len(raw)
 byname=defaultdict(list);stations={}
 for r in raw:
  byname[norm(r['sna'])].append(r['sno']);xy=point(r['longitude'],r['latitude']);assert r['sarea'] in AREAS
  stations[r['sno']]={'station_id':r['sno'],'name':norm(r['sna']),'source_area':r['sarea'],'address':r['ar'],'lon':xy[0] if xy else '', 'lat':xy[1] if xy else '', 'active':r['act']=='1','coordinate_valid':bool(xy)}
 mapping={k:v[0] for k,v in byname.items() if len(v)==1}
 for r in stations.values():r['eligible']=r['active'] and r['coordinate_valid'] and mapping.get(r['name'])==r['station_id']
 counts=Counter();filtered=Counter();totals=Counter();dates=Counter();hours=Counter();unmatched=Counter();timecache={};namecache={}
 with zipfile.ZipFile(archive) as z:
  files=[n for n in z.namelist() if n.lower().endswith('.csv')];assert len(files)==1
  with z.open(files[0]) as f:
   reader=csv.reader(io.TextIOWrapper(f,encoding='utf-8-sig',newline=''))
   assert next(reader)==['rent_time','rent_station','return_time','return_station','rent','bike_type','infodate']
   for row in reader:
    totals['raw_rows']+=1
    if len(row)!=7:totals['malformed_rows']+=1;continue
    for side,ti,ni in [('borrow',0,1),('return',2,3)]:
     ts=row[ti]
     if ts not in timecache:
      try:
       dt=datetime.fromisoformat(ts);timecache[ts]=(dt.date().isoformat(),dt.hour,'weekday' if dt.weekday()<5 else 'weekend',dt.minute,dt.second)
      except ValueError:timecache[ts]=None
     t=timecache[ts]
     if not t:totals[side+'_invalid_time']+=1;continue
     day,hour,kind,minute,second=t
     if day[:7]!='2026-07':totals[side+'_outside_month']+=1;continue
     if minute or second:totals['subhour_timestamps']+=1
     totals[side+'_in_month']+=1;dates[(day,side)]+=1
     original=row[ni]
     if original not in namecache:namecache[original]=norm(original)
     name=namecache[original];sid=mapping.get(name)
     if sid is None:unmatched[(name,side)]+=1;totals[side+'_unmatched']+=1;continue
     totals[side+'_matched']+=1;counts[(sid,side)]+=1
     if day not in FLAGS:
      filtered[(sid,side)]+=1
      if stations[sid]['eligible']:hours[(stations[sid]['source_area'],kind,hour)]+=1
 sources={};source_counts={}
 for key,file in [('street','bins-2026.csv'),('venue','venues.csv'),('historical','bins-2024.csv')]:
  rr=read_csv(prior/file);source_counts[key]={'total':len(rr),'by_district':dict(Counter(r['行政區'] for r in rr))}
  sources[key]=[{'row':i,'name':r['地址'],'area':r['行政區'],'xy':point(r['經度'],r['緯度'])} for i,r in enumerate(rr,2) if point(r['經度'],r['緯度'])]
  source_counts[key]['valid_coordinates']=len(sources[key])
 for r in stations.values():
  r.update(borrow=counts[(r['station_id'],'borrow')],return_events=counts[(r['station_id'],'return')]);r['events']=r['borrow']+r['return_events'];r['events_excluding_flags']=sum(filtered[(r['station_id'],s)] for s in ('borrow','return'))
  r['activity_status']='observed' if r['events'] else 'no_matched_observation_UNKNOWN'
  for key,items in sources.items():
   if r['coordinate_valid']:
    d,_,p=min((distance((r['lon'],r['lat']),p['xy']),p['row'],p) for p in items)
    r.update({key+'_nearest_m':round(d,2),key+'_source_row':p['row'],key+'_name':p['name'],key+'_source_area':p['area']})
   else:r.update({key+'_nearest_m':'',key+'_source_row':'',key+'_name':'',key+'_source_area':''})
  r['next_check']='先核實既有街道紀錄的可用、步行與維護' if r['coordinate_valid'] and r['street_nearest_m']<=100 else '先補清冊、場所及實際路徑；不能判缺桶'
  r['city_rank']='';r['area_rank']='';r['candidate_id']=''
 ranked=sorted((r for r in stations.values() if r['eligible'] and r['events']>0),key=lambda r:(-r['events'],r['station_id']))
 for i,r in enumerate(ranked,1):r['city_rank']=i
 feedback=json.loads((ROOT.parent/'feedback-2026-10-17/summary.json').read_text());summary=[];candidates=[];sensitivity=[];profiles=[]
 for ai,area in enumerate(AREAS,1):
  rows=[r for r in stations.values() if r['source_area']==area];eligible=[r for r in rows if r['eligible']];rr=sorted((r for r in eligible if r['events']>0),key=lambda r:(-r['events'],r['station_id']))
  for i,r in enumerate(rr,1):r['area_rank']=i
  chosen=select(rows)
  for i,r in enumerate(chosen,1):r['candidate_id']=f'{"U" if area==CAMPUS else "D"+str(ai).zfill(2)}-{i}';candidates.append(r)
  peaks={}
  for kind,n in [('weekday',22),('weekend',7)]:
   peak=max(range(24),key=lambda h:(hours[(area,kind,h)],-h));peaks[kind+'_peak_hour']=peak;peaks[kind+'_baseline_hour']=14 if peak==10 else 10
   for h in range(24):profiles.append({'source_area':area,'day_type':kind,'hour':h,'events':hours[(area,kind,h)],'days':n,'average_per_day':round(hours[(area,kind,h)]/n,3)})
  fbkey=area.removesuffix('區');fb=feedback['districtAnalysis'].get(fbkey);nfb=feedback['districts'].get(fbkey,0)
  s={'source_area':area,'snapshot_stations':len(rows),'eligible_stations':len(eligible),'observed_stations':len(rr),'unknown_stations':sum(not r['events'] for r in eligible),'events':sum(r['events'] for r in eligible),'events_excluding_flags':sum(r['events_excluding_flags'] for r in eligible),'street_rows':source_counts['street']['by_district'].get(area,0) if area!=CAMPUS else None,'venue_rows':source_counts['venue']['by_district'].get(area,0) if area!=CAMPUS else None,'feedback_n':nfb if fb else None,'access_feedback':fb['themes']['A'] if fb else None,'maintenance_feedback':fb['themes']['C'] if fb else None,'candidate_ids':[r['candidate_id'] for r in chosen],'candidate_events':sum(r['events'] for r in chosen),**peaks}
  summary.append(s)
  for gap,metric in [(150,'events'),(300,'events_excluding_flags'),(500,'events')]:
   other=select(rows,gap,metric);oldids={r['station_id'] for r in chosen}
   sensitivity.append({'source_area':area,'minimum_separation_m':gap,'activity_basis':metric,'retained_of_primary3':len(oldids&{r['station_id'] for r in other}),'station_ids':'|'.join(r['station_id'] for r in other),'station_names':'|'.join(r['name'] for r in other)})
 # Flag nearby candidates from different area streams; these are not separate inferred service gaps.
 nearby=[]
 for i,a in enumerate(candidates):
  for b in candidates[i+1:]:
   if a['source_area']!=b['source_area']:
    d=distance((a['lon'],a['lat']),(b['lon'],b['lat']))
    if d<300:nearby.append({'candidate_a':a['candidate_id'],'candidate_b':b['candidate_id'],'distance_m':round(d,2)})
 totals['all_snapshot_matched_events']=sum(r['events'] for r in stations.values());totals['eligible_events']=sum(r['events'] for r in stations.values() if r['eligible']);totals['ineligible_matched_events']=sum(r['events'] for r in stations.values() if not r['eligible'])
 assert totals['all_snapshot_matched_events']==totals['borrow_matched']+totals['return_matched']
 assert sum(s['events'] for s in summary)==totals['eligible_events']
 for side in ('borrow','return'):assert totals[side+'_in_month']==totals[side+'_matched']+totals[side+'_unmatched']
 results={'scope':'12 districts plus NTU campus category','month':'2026-07','snapshot':'2026-10-18','totals':dict(totals),'source_counts':source_counts,'districts':summary,'candidates':candidates,'global_top10':ranked[:10],'sensitivity':sensitivity,'cross_area_nearby_candidates':nearby,'ambiguous_names':{n:v for n,v in byname.items() if len(v)>1},'flagged_dates':sorted(FLAGS)}
 write_json('summary.json',results);write_csv('stations.csv',sorted(stations.values(),key=lambda r:(r['source_area'],-r['events'],r['station_id'])));write_csv('districts.csv',[{**s,'candidate_ids':'|'.join(s['candidate_ids'])} for s in summary]);write_csv('candidates.csv',candidates);write_csv('sensitivity.csv',sensitivity);write_csv('hourly-profiles.csv',profiles);write_csv('source-daily.csv',[{'date':d,'side':s,'events':n} for (d,s),n in sorted(dates.items())]);write_csv('unmatched-names.csv',[{'name':n,'side':s,'events':v} for (n,s),v in unmatched.most_common()])
 print(json.dumps({'snapshot':len(stations),'eligible':sum(r['eligible'] for r in stations.values()),'candidates':len(candidates),'totals':dict(totals),'districts':[{k:s[k] for k in ['source_area','eligible_stations','events','candidate_ids']} for s in summary]},ensure_ascii=False))
 return results
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--archive',required=True,type=Path);main(p.parse_args().archive)
