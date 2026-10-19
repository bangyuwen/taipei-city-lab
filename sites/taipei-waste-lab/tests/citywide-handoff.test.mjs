import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
test('citywide handoff preserves all anchors and produces a complete unexecuted field schedule',()=>{
 execFileSync(process.env.PYTHON_BIN||'python3',['-c',String.raw`
import csv, json, hashlib, runpy
from pathlib import Path
from collections import Counter
root=Path('research/taipei-citywide-2026-10-19');delivery=root/'delivery'
runpy.run_path(str(delivery/'build_handoff.py'))['build']()
def rows(name):
 with (delivery/name).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
s=json.loads((root/'results/summary.json').read_text());p=json.loads((delivery/'field-plan.json').read_text())
v=rows('planned-visits.csv');h=rows('hotspot-candidates-handoff.csv');d=rows('district-readiness.csv')
assert len(v)==234 and len({r['visit_id'] for r in v})==234
assert Counter(r['stream'] for r in v)=={'city':216,'campus':18}
assert Counter(r['wave'] for r in v)=={'W1':72,'W2':72,'W3':72,'U':18}
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
assert m['field_visits_completed']==0 and m['agency_commitments_confirmed']==0
before={f:hashlib.sha256((delivery/f).read_bytes()).hexdigest() for f in ['hotspot-handoff.md','field-plan.md','field-plan.json','planned-visits.csv','district-readiness.csv','handoff-manifest.json']}
runpy.run_path(str(delivery/'build_handoff.py'))['build']()
assert before=={f:hashlib.sha256((delivery/f).read_bytes()).hexdigest() for f in before}
`],{cwd:root,stdio:'pipe'});
});
