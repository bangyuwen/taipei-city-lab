import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
test('historical handoff retains all anchors and its superseded unexecuted schedule',()=>{
 execFileSync(process.env.PYTHON_BIN||'python3',['-c',String.raw`
import csv, json, hashlib, runpy
from pathlib import Path
from collections import Counter
root=Path('research/taipei-citywide-2026-10-19');delivery=root/'delivery'
priority_root=Path('research/field-priority-2026-10-20')
saved_priority=(priority_root/'priority.json').read_bytes()
priority=runpy.run_path(str(priority_root/'build.py'))['build']()
assert (priority_root/'priority.json').read_bytes()==saved_priority
runpy.run_path(str(delivery/'build_handoff.py'))['build']()
def rows(name):
 with (delivery/name).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
s=json.loads((root/'results/summary.json').read_text());p=json.loads((delivery/'field-plan.json').read_text())
v=rows('planned-visits.csv');h=rows('hotspot-candidates-handoff.csv');d=rows('district-readiness.csv')
assert len(v)==234 and len({r['visit_id'] for r in v})==234
assert Counter(r['stream'] for r in v)=={'city':216,'campus':18}
assert Counter(r['wave'] for r in v)=={'W1':72,'W2':72,'W3':72,'U':18}
first={'D01-2','D02-3','D03-1','D04-3','D05-1','D06-2','D07-2','D08-2','D09-3','D10-3','D11-2','D12-3'}
assert {r['candidate_id'] for r in h if r['wave']=='W1'}==first
assert len({r['area'] for r in h if r['wave']=='W1'})==12
for district in priority['districts']:
 original=[c['candidate_id'] for c in s['candidates'] if c['source_area']==district['area']]
 order=district['candidate_ids']
 assert order[0] in first and order[1:]==[cid for cid in original if cid not in first]
 assert next(r['candidate_ids'] for r in d if r['area']==district['area'])=='|'.join(order)
 for i,cid in enumerate(order,1):
  assert {r['wave'] for r in v if r['candidate_id']==cid}=={f'W{i}'}
assert all(r['wave']=='U' for r in h if r['stream']=='campus')
for point in priority['candidates']:
 assert all(value is None for value in point['field_status'].values())
 row=next(r for r in h if r['candidate_id']==point['candidate_id'])
 assert row['venue_original_remark']==point['venue']['remark']
 assert row['next_check']==point['field_check'] and row['ready_for_siting']=='False'
assert {r['candidate_id'] for r in h}=={r['candidate_id'] for r in s['candidates']}
assert len(d)==13 and sum(int(r['eligible_stations']) for r in d)==1790
assert sum(int(r['unknown_stations']) for r in d)==47
assert sum(int(r['planned_minutes']) for r in v if r['stream']=='city')/60==54
byarea={r['source_area']:r for r in s['districts']}
for c in s['candidates']:
 hrow=next(r for r in h if r['candidate_id']==c['candidate_id'])
 assert float(hrow['observed_events'])==c['events'] and float(hrow['lat'])==c['lat']
 visits=[r for r in v if r['candidate_id']==c['candidate_id']]
 assert {(r['day_slot'],r['window_kind']) for r in visits}=={(day,kind) for day in ['WD1','WD2','WE1'] for kind in ['control','activity']}
 for r in visits:
  key=r['day_type']+('_baseline_hour' if r['window_kind']=='control' else '_peak_hour')
  assert int(r['suggested_start'].split(':')[0])==byarea[r['area']][key]
  assert r['suggested_start'].endswith(':15') and r['suggested_end'].endswith(':30')
  assert r['status']=='未排日期' and all(r[k]=='' for k in ['actual_date','team','actual_start','actual_end','effective_minutes','litter_start_count','observed_disposal_attempts','observed_successes','observed_blocked_attempts','observed_unresolved_attempts'])
assert [r['city_observation_dates'] for r in p['capacity_scenarios']]==[108,54,36]
assert p['city']['person_observation_hours']==108 and p['campus']['person_observation_hours']==9
assert len(rows('anchor-scope-setup.csv'))==39 and all(r['status']=='未查核' for r in rows('anchor-scope-setup.csv'))
assert len(rows('service-point-records.csv'))==0
m=json.loads((delivery/'handoff-manifest.json').read_text())
for item in m['source_files']+m['generated_files']:
 assert hashlib.sha256((delivery/item['path']).read_bytes()).hexdigest()==item['sha256']
assert p['status']=='historical_superseded_not_executed'
assert m['current_plan'].endswith('decision-checks-2026-10-22/checks.json')
assert m['field_visits_completed']==0 and m['agency_commitments_confirmed']==0
before={f:hashlib.sha256((delivery/f).read_bytes()).hexdigest() for f in ['hotspot-handoff.md','field-plan.md','field-plan.json','planned-visits.csv','district-readiness.csv','handoff-manifest.json']}
runpy.run_path(str(delivery/'build_handoff.py'))['build']()
assert before=={f:hashlib.sha256((delivery/f).read_bytes()).hexdigest() for f in before}
page=Path('dist/index.html')
saved_page=page.read_bytes()
runpy.run_path(str(priority_root/'update_site.py'))['update']()
assert page.read_bytes()==saved_page
import re
text=page.read_text()
assert set(re.findall(r'data-priority-id="([^"]+)"',text))==first
for point in priority['candidates']:
 code=point['candidate_id'][1:3]
 article=re.search(r'<article[^>]+id="reader-district-'+code+r'".*?</article>',text,re.S).group()
 label=f'<strong>{point["candidate_id"]} {point["name"]}</strong><br><small>歷史第{point["wave"][1]}輪安排，已取代</small>'
 assert label in article
`],{cwd:root,stdio:'pipe'});
});
