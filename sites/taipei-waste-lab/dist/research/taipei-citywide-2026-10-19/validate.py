"""Independently reconcile citywide outputs to retained full-source aggregates."""
import csv,json,math
from collections import Counter,defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def read(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def arc(a,b):
 x,y,u,v=map(math.radians,(*a,*b));return 6371000*math.acos(min(1,max(-1,math.sin(y)*math.sin(v)+math.cos(y)*math.cos(v)*math.cos(x-u))))
def validate():
 rows=read(ROOT/'results/stations.csv');summary=json.loads((ROOT/'results/summary.json').read_text());prior=ROOT.parent/'youbike-bin-screening-2026-10-18/inputs'
 raw=json.loads((prior/'youbike.json').read_text());names=defaultdict(list)
 for r in raw:names[r['sna'].replace('YouBike2.0_','',1).replace('（','(').replace('）',')').strip()].append(r['sno'])
 counts=Counter()
 for r in read(ROOT.parent/'gongguan-hotspots-2026-10-19/results/source-station-events.csv'):
  if len(names.get(r['station_name'],[]))==1:counts[(names[r['station_name']][0],r['side'])]+=int(r['events'])
 assert len(rows)==len(raw)==1821
 for r in rows:
  assert int(r['borrow'])==counts[(r['station_id'],'borrow')]
  assert int(r['return_events'])==counts[(r['station_id'],'return')]
  assert int(r['events'])==int(r['borrow'])+int(r['return_events'])
  assert 0<=int(r['events_excluding_flags'])<=int(r['events'])
 assert read(ROOT/'results/source-daily.csv')==read(ROOT.parent/'gongguan-hotspots-2026-10-19/results/source-daily.csv')
 for side in ['borrow','return']:
  assert summary['totals'][side+'_in_month']==7596992
 assert len(summary['districts'])==13
 assert sum(d['eligible_stations'] for d in summary['districts'])==1790
 assert len(summary['candidates'])==39
 max_error=0
 for c in summary['candidates']:
  a=(c['lon'],c['lat'])
  for key,filename in [('street','bins-2026.csv'),('venue','venues.csv'),('historical','bins-2024.csv')]:
   candidates=[]
   for i,r in enumerate(read(prior/filename),2):
    try:b=(float(r['經度']),float(r['緯度']))
    except ValueError:continue
    if 121.4<=b[0]<=121.7 and 24.9<=b[1]<=25.25:candidates.append((arc(a,b),i))
   d,i=min(candidates);assert i==c[key+'_source_row'];max_error=max(max_error,abs(d-c[key+'_nearest_m']));assert abs(d-c[key+'_nearest_m'])<.02
 for area in summary['districts']:
  pool=[r for r in rows if r['source_area']==area['source_area'] and r['eligible']=='True' and int(r['events'])>0]
  chosen=[]
  for r in sorted(pool,key=lambda r:(-int(r['events']),r['station_id'])):
   a=(float(r['lon']),float(r['lat']))
   if all(arc(a,(float(c['lon']),float(c['lat'])))>=300 for c in chosen):chosen.append(r)
   if len(chosen)==3:break
  actual=[c['station_id'] for c in summary['candidates'] if c['source_area']==area['source_area']]
  assert actual==[r['station_id'] for r in chosen]
 receipt={'all_station_counts_reconciled':len(rows),'independent_reference':'previous full raw-archive station aggregate, fixed SHA in manifest','daily_counts_reconciled':True,'area_totals_reconciled':13,'candidate_selection_reconciled':39,'nearest_distances_independent_formula':True,'max_distance_error_m':max_error,'field_conditions_verified':False}
 (ROOT/'validation.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));return receipt
if __name__=='__main__':validate()
