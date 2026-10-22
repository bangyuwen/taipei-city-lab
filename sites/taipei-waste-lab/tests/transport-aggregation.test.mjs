import test from 'node:test';
import {execFileSync} from 'node:child_process';

test('complaint aggregation preserves month, excluded days, category and duplicate boundaries',()=>{
  execFileSync('python3',['-c',`
import csv,gzip,importlib.util,tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('aggregation','scripts/aggregate-mrt-complaints.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 p=Path(d)/'cases.csv.gz'
 rows=[('1','20260630T230000',m.CATEGORIES[0]),('2','20260701T090000',m.CATEGORIES[0]),('3','20260710T090000',m.CATEGORIES[0]),('4','20260711T090000',m.CATEGORIES[0]),('5','20260712T090000',m.CATEGORIES[0]),('6','20260801T000000',m.CATEGORIES[0]),('7','20260701T210000',m.CATEGORIES[1]),('8','20260701T090000','其他')]
 def write(values):
  with gzip.open(p,'wt',encoding='utf-8',newline='') as f:
   w=csv.writer(f);w.writerow(['案件編號','受理日期','案件次類別']);w.writerows(values)
 write(rows);r=m.aggregate_complaints(p);g=r['groups'][m.CATEGORIES[0]]
 assert r['sourceRows']==8 and r['uniqueCases']==8 and r['outsideMonth']==2
 assert g['sourceRows']==6 and g['outsideMonth']==2 and g['excludedDays']==2
 assert sum(g['fullMonthHourly'])==4 and g['hourly'][9]==2
 assert g['weekday'][9]==1 and g['weekend'][9]==1
 assert r['groups'][m.CATEGORIES[1]]['hourly'][21]==1
 write(rows+[rows[1]])
 try: m.aggregate_complaints(p)
 except AssertionError: pass
 else: raise AssertionError('duplicate case was accepted')
`],{cwd:new URL('..',import.meta.url)});
});

test('field-visit proposal is reproducible and separates coverage checks from ranked candidates',()=>{
 execFileSync('python3',['-c',`
import importlib.util,json
from pathlib import Path
spec=importlib.util.spec_from_file_location('visits','scripts/prepare-field-visit-list.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
data=json.loads(m.SOURCE.read_text());groups=m.build(data)
assert [[p['name'] for p in rows] for _,_,rows in groups]==[['中山','忠孝新生','龍山寺'],['台北車站','東門','行天宮'],['南港展覽館','石牌']]
assert m.render(data,groups)==m.TARGET.read_text()
assert all(p['binCounts']['300']==0 for p in groups[0][2])
assert all(p['binCounts']['300']>0 for p in groups[1][2])
assert all(not {'北投區','南港區'}.intersection(p['areas']) for _,_,rows in groups[:2] for p in rows)
`],{cwd:new URL('..',import.meta.url)});
});
