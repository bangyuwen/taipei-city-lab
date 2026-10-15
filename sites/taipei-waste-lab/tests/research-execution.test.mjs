import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {pageFromHash} from '../dist/data-utils.js';

const root = new URL('../', import.meta.url);
const readJSON = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('desk shortlist preserves source identity and leaves field results unknown', async () => {
  const desk = await readJSON('research/execution-2026-10-15/desk-results.json');
  const comparison = await readJSON('dist/data/comparison-2024-2026.json');
  const entries = new Map(comparison.entries.map(e => [e.id, e]));
  assert.equal(pageFromHash('#research'), 'research');
  assert.equal(desk.candidates.length, 18);
  assert.equal(new Set(desk.candidates.map(p => p.sourceId)).size, 18);
  assert.deepEqual(Object.values(Object.groupBy(desk.candidates, p => p.context)).map(g => g.length), [6,6,6]);
  for (const p of desk.candidates) {
    const e = entries.get(p.comparisonId);
    assert.equal(p.sourceId, e.after[0].id);
    assert.equal(p.address, e.address);
    assert.equal(p.longitude, e.after[0].rawX);
    assert.equal(p.latitude, e.after[0].rawY);
    for (const key of ['length_m','start_landmark','end_landmark','service_verified_at','manager']) assert.equal(p[key], null);
  }
  for (const key of ['completedFieldVisits','completedUserTasks','completedInterventions']) assert.equal(desk.counts[key], 0);
});

test('verification queues conserve both snapshots and do not claim observed events', () => {
  const result = spawnSync('python3', ['-c', `
import csv,json
from pathlib import Path
r=Path('research/execution-2026-10-15')
def rows(name):
 return list(csv.DictReader((r/name).open(encoding='utf-8-sig')))
queue=rows('all-comparison-verification.csv')
pairs=rows('coordinate-verification-75.csv')
assert len(queue)==2033 and len(pairs)==75
assert sum(int(v['before_rows']) for v in queue)==1971
assert sum(int(v['after_rows']) for v in queue)==681
assert all(not v['event_type'] and not v['event_date'] and not v['evidence_url'] for v in queue+pairs)
d=json.loads(Path('dist/data/comparison-coordinate-distances.json').read_text())
assert [v['comparison_id'] for v in pairs]==[v['comparisonId'] for v in d['pairs']]
assert [float(v['distance_m']) for v in pairs]==[v['distanceMeters'] for v in d['pairs']]
`], {cwd:root,encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
});

test('field templates and downloadable archive contain no invented observation results', () => {
  const result = spawnSync('python3', ['-c', `
import csv,io,zipfile
from pathlib import Path
r=Path('research/execution-2026-10-15/field-kit')
tables={p.name:list(csv.DictReader(p.open(encoding='utf-8-sig'))) for p in r.glob('*.csv')}
assert len(tables)==9
visits=tables['observation_visits.csv']; tasks=tables['user_task_slots.csv']
assert len(visits)==48 and len(tasks)==30 and len(tables['segments.csv'])==6
assert len({v['visit_id'] for v in visits})==48
for v in visits:
 assert v['status']=='planned'
 assert all(not v[k] for k in v if k.startswith(('actual_','ground_litter_','cigarette_','pedestrian_')))
 assert not v['planned_date'] and not v['planned_start_time']
for v in tasks:
 assert v['status']=='planned' and not v['success'] and not v['task_started'] and not v['participant_id']
 assert not v['task_date']
assert all(not rows for name,rows in tables.items() if name not in ['segments.csv','observation_visits.csv','user_task_slots.csv'])
with zipfile.ZipFile('dist/research/research-execution-2026-10-15.zip') as z:
 assert z.testzip() is None
 for p in r.glob('*'):
  if p.is_file(): assert z.read(p.as_posix())==p.read_bytes()
 for p in ['dist/data/comparison-2024-2026.json','scripts/prepare-research-execution.py']:
  assert z.read(p)==Path(p).read_bytes()
`], {cwd:root,encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
});
