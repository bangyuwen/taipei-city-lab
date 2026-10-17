import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pageFromHash} from '../dist/data-utils.js';

const site = new URL('../', import.meta.url);
function python(code) {
  const result = spawnSync(process.env.PYTHON_BIN || 'python3', ['-c', code], {cwd: site, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('feedback links and chapter deep links resolve without changing existing destinations', () => {
  for (const hash of ['#feedback', '#feedback-signals', '#feedback-moods', '#feedback-method', '#feedback-overlap', '#feedback-loop', '#feedback-mechanism-sorting', '#feedback-validation']) {
    assert.equal(pageFromHash(hash), 'feedback');
  }
  assert.equal(pageFromHash('#main', 'feedback'), 'feedback');
  assert.equal(pageFromHash('#reference-L01'), 'sources');
  assert.equal(pageFromHash('#plan-scope'), 'plan');
  assert.equal(pageFromHash('#unknown'), 'research');
});

test('feedback parsing preserves quoted multiline records and identical texts with distinct IDs', () => python(String.raw`
import csv, runpy, tempfile
from pathlib import Path
m=runpy.run_path('scripts/analyze-feedback.py')
with tempfile.TemporaryDirectory() as directory:
 p=Path(directory)/'input.tsv'
 rows=[['a','中正','環境','在意','垃圾桶\n與垃圾車'],['b','大同','環境','無奈','相同留言'],['c','大同','環境','無奈','相同留言']]
 rows[0][4]=rows[0][4].replace('\\n','\n')
 with p.open('w',newline='',encoding='utf-8-sig') as f:
  w=csv.writer(f,delimiter='\t');w.writerow(m['FIELDS']);w.writerows(rows)
 result=m['analyze'](p)
 assert result['records']==3
 assert result['quality']=={'uniqueIds':3,'missingCells':0,'multilineRecords':1,'duplicateTextGroups':1,'duplicateTextExtraRows':1},result
 assert result['binAndTruck']==1
 assert result['noIndicatorMatch']==2
 assert sum(result['districts'].values())==3
`));

test('feedback parser fails closed on missing fields, malformed rows, duplicate IDs and empty data', () => python(String.raw`
import csv, runpy, tempfile
from pathlib import Path
m=runpy.run_path('scripts/analyze-feedback.py')
valid=['a','中正','環境','在意','垃圾桶']
with tempfile.TemporaryDirectory() as directory:
 p=Path(directory)/'input.tsv'
 for rows in ([],[valid[:-1]],[valid+['extra']],[valid,valid],[['a','中正','環境','在意',' ']]):
  with p.open('w',newline='') as f:
   w=csv.writer(f,delimiter='\t');w.writerow(m['FIELDS']);w.writerows(rows)
  try: m['analyze'](p)
  except ValueError: pass
  else: raise AssertionError(rows)
 p.write_text('wrong\theader\n')
 try: m['analyze'](p)
 except ValueError: pass
 else: raise AssertionError('header accepted')
`));

test('literal indicators allow overlap and negation without treating hits as support votes', () => python(String.raw`
import runpy
m=runpy.run_path('scripts/analyze-feedback.py')
assert m['indicators']('不需要垃圾桶，垃圾桶會被丟家庭垃圾；垃圾車可否２４ 小時服務？')=={'bins','household','truck','dropoff'}
assert m['indicators']('公車時段不便')==set()
assert m['indicators']('煙蒂與菸蒂')=={'cigarettes'}
assert m['indicators']('垃圾桶垃圾桶垃圾桶')=={'bins'}
`));

test('saved aggregates, Markdown and generated public page agree without individual records', () => python(String.raw`
import json,re,runpy,zipfile,shutil,tempfile
from pathlib import Path
m=runpy.run_path('scripts/analyze-feedback.py')
data=json.loads(Path('research/feedback-2026-10-17/summary.json').read_text())
assert data['records']==2663
assert data['quality']['multilineRecords']==232
assert sum(data['moods'][key] for key in ('生氣','無奈','擔心'))==2253
for key in ('districts','moods','originalTopics'): assert sum(data[key].values())==2663
markdown,content=m['render'](data)
assert markdown==Path('research/feedback-2026-10-17/README.md').read_text()
assert markdown==Path('dist/research/feedback-2026-10-17/README.md').read_text()
page=Path('dist/index.html').read_text()
assert content in page
# Exercise public staging in a clean fixture; npm test also runs before out/ exists.
public=runpy.run_path('scripts/prepare-public.py')
with tempfile.TemporaryDirectory() as directory:
 root=Path(directory).resolve()
 for name in public['ASSETS']:
  target=root/'dist'/name
  target.parent.mkdir(parents=True,exist_ok=True)
  shutil.copyfile(Path('dist')/name,target)
 (root/'dist/private-feedback.tsv').write_text('private input must not be staged')
 public['prepare'].__globals__['ROOT']=root
 public['prepare']()
 assert content in (root/'out/index.html').read_text()
 assert not (root/'out/private-feedback.tsv').exists()
for body in (json.dumps(data),markdown,content):
 assert not re.search(r'HK-\d+|去識別內容|匿名編號\s*行政區',body)
assert '比例不能相加' in content and '不是逐則語意分類' in content
assert '未量化各立場人數' in content and '收集期間' in content
assert len(re.findall('class="feedback-bar-track"',content))==14
for item in data['indicators']:
 assert f"{item['count']:,}" in markdown
 assert 0<=item['count']<=2663
assets=runpy.run_path('scripts/prepare-public.py')['ASSETS']
assert not any(name.endswith(('summary.json','.tsv','.md')) for name in assets)
with zipfile.ZipFile('dist/research/research-execution-2026-10-15.zip') as bundle:
 assert 'scripts/analyze-feedback.py' in bundle.namelist()
 assert not any('private' in name or name.endswith('.tsv') for name in bundle.namelist())
`));

test('overlap diagram partitions messages and rejects inconsistent aggregates', () => python(String.raw`
import csv,runpy,tempfile,copy
from pathlib import Path
m=runpy.run_path('scripts/analyze-feedback.py')
with tempfile.TemporaryDirectory() as directory:
 p=Path(directory)/'input.tsv'
 texts=['垃圾桶與垃圾車','垃圾筒','清潔箱','垃圾車','無相關詞']
 with p.open('w',newline='') as f:
  w=csv.writer(f,delimiter='\t');w.writerow(m['FIELDS'])
  w.writerows([[str(i),'中正','環境','在意',text] for i,text in enumerate(texts)])
 data=m['analyze'](p)
 md,page=m['render_overlap'](data)
 md='\n'.join(md);page='\n'.join(page)
 assert '| 有桶詞 | 1 | 2 |' in md
 assert '| 無桶詞 | 1 | 1 |' in md
 assert '兩者皆未命中' in page and '不是需求分群' in page
 for valid in (0,2):
  adjacent=copy.deepcopy(data);adjacent['binAndTruck']=valid
  m['render_overlap'](adjacent)
 for broken in (3,-1):
  invalid=copy.deepcopy(data);invalid['binAndTruck']=broken
  try:m['render_overlap'](invalid)
  except ValueError:pass
  else:raise AssertionError('Impossible overlap accepted')
`));
