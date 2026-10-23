import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pageFromHash} from '../dist/data-utils.js';

const site = new URL('../', import.meta.url);
function python(code) {
  const result = spawnSync(process.env.PYTHON_BIN || 'python3', ['-c', code], {cwd:site, encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('desk cases preserve source outcomes and keep observed journeys unlinked', () => python(String.raw`
import json,runpy
from pathlib import Path
root=Path('research/next-decision-2026-10-24')
m=runpy.run_path(str(root/'analyze.py'))
r=m['analyze'](root)
assert r==json.loads((root/'results.json').read_text())
assert (r['source_personas'],r['verified_event_links'],r['proposed_desk_cases'])==(4,0,3)
assert r['source_disposal_completed_accounts']==1 and r['other_source_final_outcomes_unknown']==3
assert r['observed_events']==r['scheduled_visits']==[]
for case in r['scenarios']:
 assert case['verified_candidate_id'] is None and case['event_time'] is None
 assert case['link_status']=='unverified'
 lead=case['desk_lead']
 if lead:
  assert all(lead[k] is None for k in ('physical_identity','walkable_distance_m','usable_now'))
 if case['evidence_id']=='E06': assert '丟垃圾' in case['source_last_stage']
 else: assert case['source_last_stage'] is None
meal=r['scenarios'][0]['desk_lead'];basket=r['scenarios'][2]['desk_lead']
assert (meal['street_nearest_m'],meal['venue_nearest_m'])==(41.81,74.5)
assert (basket['street_nearest_m'],basket['venue_nearest_m'])==(40.89,12.4)
assert r['scenarios'][1]['desk_lead'] is None
assert r['scenarios'][3]['desk_lead']['venue_relation']=='不同場域'
`));

test('changed evidence, synthetic visits and unsupported field contracts stop the analysis', () => python(String.raw`
import hashlib,json,runpy,shutil,tempfile
from pathlib import Path
source=Path('research');module=runpy.run_path(str(source/'next-decision-2026-10-24/analyze.py'))
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp)/'research';shutil.copytree(source,root);target=root/'next-decision-2026-10-24'
 def rejected():
  try:module['analyze'](target)
  except ValueError:return
  raise AssertionError('Invalid evidence accepted')
 path=target/'assessment.json';original=path.read_bytes()
 path.write_bytes(original+b' ');rejected();path.write_bytes(original)
 manifest=target/'inputs.json';original_manifest=manifest.read_bytes()
 for mutation in ({'observed_events':[{'event_id':'invented'}]}, {'scheduled_visits':['invented']}, {'join_fields':['invented_field']}):
  value=json.loads(original);value.update(mutation);path.write_text(json.dumps(value))
  bound=json.loads(original_manifest)
  next(x for x in bound['sources'] if x['path']=='assessment.json')['sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
  manifest.write_text(json.dumps(bound));rejected()
`));

test('rendering is repeatable, preserves the surrounding research and resolves all source links', () => python(String.raw`
import re,runpy,tempfile
from html.parser import HTMLParser
from pathlib import Path
m=runpy.run_path('research/next-decision-2026-10-24/render.py')
source=Path('dist/index.html').read_text()
pattern=re.escape(m['START'])+r'.*?'+re.escape(m['END'])
with tempfile.TemporaryDirectory() as tmp:
 path=Path(tmp)/'index.html';path.write_text(source)
 m['build'](path);first=path.read_text();m['build'](path)
 assert first==path.read_text()==source
 assert re.sub(pattern,'',first,flags=re.S)==re.sub(pattern,'',source,flags=re.S)
 block=re.search(pattern,first,re.S).group(0)
 assert '2026-10-24' in block and '0／4' in block
 assert block.count('<details ')==6
 assert '不能當成投放失敗率' in block
 assert '不是10/24現場狀態' in block
 assert '原Persona的空白保留' in block
 for target in re.findall(r'href="#([^"]+)"',block): assert f'id="{target}"' in first,target
 for source in ('tcma.gov.taipei','dep.gov.taipei'): assert source in block
 assert 'assessment.json' not in block and 'results.json' not in block
`));

test('new decision evidence deep links retain analysis ownership', () => {
  for(const anchor of ['analysis-pending','decision-context-meal','decision-context-dog','decision-context-basket','decision-context-walking','decision-choice-rules','decision-event-link','decision-source-dates']) {
    assert.equal(pageFromHash('#'+anchor), 'analysis', anchor);
  }
});
