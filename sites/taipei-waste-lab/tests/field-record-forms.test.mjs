import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const run=code=>execFileSync(process.env.PYTHON_BIN||'python3',['-c',code],{cwd:root,stdio:'pipe'});

test('field sheets stay blank and retain the visit, event and basket counting boundaries',()=>run(String.raw`
import csv, json, runpy
from pathlib import Path
from html.parser import HTMLParser
d=Path('research/taipei-citywide-2026-10-19/delivery')
m=runpy.run_path(str(d/'build_field_records.py'))
schema=m['load_schema']()
forms={f['id']:{x['key'] for x in f['fields']} for f in schema['forms']}
assert {'event_id','visit_id','scope_version','evidence_kind','source_ref','attempt_in_window','outcome','outcome_basis','dedup_status','canonical_event_id','missing_reason'} <= forms['journey']
assert {'survey_id','visit_id','started_at','ended_at','status','checked_baskets','with_litter','without_litter','unclassifiable','coverage_and_missing'} <= forms['basket-survey']
assert {'observation_id','survey_id','basket_local_id','identity_status','visible_waste_state','related_observation_id'} <= forms['basket-observations']
assert {'handling_event_id','visit_id','observation_id','handling_outcome','disposal_event_id','participation_quote','impact_quote','dedup_status'} <= forms['basket-handling']
for form in schema['forms']:
 with (d/'templates'/form['file']).open(encoding='utf-8-sig',newline='') as stream:
  rows=list(csv.reader(stream))
 assert rows==[[f['key'] for f in form['fields']]],form['file']
class BlankCells(HTMLParser):
 def __init__(self): super().__init__();self.inside=False;self.cells=[]
 def handle_starttag(self,t,a):
  if t=='div' and dict(a).get('class')=='field-record-blank':self.inside=True;self.cells.append('')
 def handle_data(self,data):
  if self.inside:self.cells[-1]+=data
 def handle_endtag(self,t):
  if t=='div':self.inside=False
page=Path('dist/index.html').read_text();article=m['render'](schema)
assert article in page
cells=BlankCells();cells.feed(article)
assert len(cells.cells)==sum(len(f['fields']) for f in schema['forms'])==71
assert all(not value.strip() for value in cells.cells)
assert len(schema['cases'])==12
assert '示例不是現場結果' in (d/'field-record-forms.md').read_text()
visits=list(csv.DictReader((d/'planned-visits.csv').open(encoding='utf-8-sig')))
assert len(visits)==234
assert all(r['actual_date']==r['actual_start']==r['observed_disposal_attempts']=='' for r in visits)
assets=runpy.run_path('scripts/prepare-public.py')['ASSETS']
assert not any('templates/' in a or 'field-record-forms.json' in a for a in assets)
`));

test('regeneration is stable and refuses to erase filled fieldwork before writing anything',()=>run(String.raw`
import csv, runpy, tempfile, shutil
from pathlib import Path
d=Path('research/taipei-citywide-2026-10-19/delivery')
m=runpy.run_path(str(d/'build_field_records.py'))
with tempfile.TemporaryDirectory() as tmp:
 folder=Path(tmp);shutil.copy(d/'field-record-forms.json',folder)
 page=folder/'index.html';page.write_bytes(Path('dist/index.html').read_bytes())
 m['build'](folder,page)
 before={str(p.relative_to(folder)):p.read_bytes() for p in folder.rglob('*') if p.is_file()}
 m['build'](folder,page)
 assert before=={str(p.relative_to(folder)):p.read_bytes() for p in folder.rglob('*') if p.is_file()}
 # Fill a late template to prove preflight protects every output, including earlier files.
 path=folder/'templates/basket-handling-events.csv'
 with path.open('a',encoding='utf-8',newline='') as stream:csv.writer(stream).writerow(['PRIVATE-FIELD-RECORD'])
 before={str(p.relative_to(folder)):p.read_bytes() for p in folder.rglob('*') if p.is_file()}
 try:m['build'](folder,page)
 except ValueError as error:assert 'Refusing to overwrite filled records' in str(error)
 else:raise AssertionError('Filled records must never be overwritten')
 assert before=={str(p.relative_to(folder)):p.read_bytes() for p in folder.rglob('*') if p.is_file()}
 assert b'PRIVATE-FIELD-RECORD' not in page.read_bytes()
`));
