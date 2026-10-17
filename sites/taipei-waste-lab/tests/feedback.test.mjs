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

test('district cross-tabs count each message once per signal and retain unmatched denominators', () => python(String.raw`
import csv,runpy,tempfile
from pathlib import Path
m=runpy.run_path('scripts/analyze-feedback.py')
with tempfile.TemporaryDirectory() as directory:
 p=Path(directory)/'input.tsv'
 rows=[['a','中正','環境','在意','垃圾桶垃圾桶與垃圾車'],['b','中正','環境','在意','無詞表文字'],['c','大同','環境','在意','垃圾車'],['d','大同','環境','在意','不要家庭垃圾']]
 with p.open('w',newline='',encoding='utf-8') as f:
  w=csv.writer(f,delimiter='\t');w.writerow(m['FIELDS']);w.writerows(rows)
 data=m['analyze'](p);m['validate_districts'](data)
 assert data['districts']=={'中正':2,'大同':2}
 assert data['districtIndicators']['中正']['counts']['bins']==1
 assert data['districtIndicators']['中正']['noIndicatorMatch']==1
 assert data['districtIndicators']['大同']['counts']['household']==1
 assert m['district_comparison'](data,'中正','bins')==(1,2,0,2,50.0)
 assert m['district_comparison'](data,'中正','truck')==(1,2,1,2,0.0)
 md,page=m['render_districts'](data)
 assert '1（50.0%）' in '\n'.join(md)
 assert '0（0.0%）' in '\n'.join(md)
 assert '\n'.join(page).count('data-indicator=')==16
 single=m['analyze'](p)
 single['districts']={'中正':4}
 single['districtIndicators']={'中正':{'counts':{i['id']:i['count'] for i in single['indicators']},'noIndicatorMatch':1}}
 m['validate_districts'](single)
 assert m['district_comparison'](single,'中正','bins')==(1,4,0,0,None)
`));

test('district rendering rejects missing or inconsistent cross-tabs instead of inventing cells', () => python(String.raw`
import copy,json,runpy
from pathlib import Path
m=runpy.run_path('scripts/analyze-feedback.py')
data=json.loads(Path('research/feedback-2026-10-17/summary.json').read_text())
mutations=[
 lambda d:d.pop('districtIndicators'),
 lambda d:d.update(schemaVersion=1),
 lambda d:d['districtIndicators'].pop('北投'),
 lambda d:d['districtIndicators']['北投']['counts'].pop('bins'),
 lambda d:d['districtIndicators']['北投']['counts'].update(bins=-1),
 lambda d:d['districtIndicators']['北投']['counts'].update(bins=140),
 lambda d:d['districtIndicators']['北投']['counts'].update(bins=78),
 lambda d:d['districtIndicators']['北投']['counts'].update(bins=79.0),
 lambda d:d['districtIndicators']['北投'].update(noIndicatorMatch=139),
 lambda d:d['districts'].update(北投=0),
]
for mutate in mutations:
 broken=copy.deepcopy(data);mutate(broken)
 try:m['render_districts'](broken)
 except ValueError:pass
 else:raise AssertionError('Invalid cross-tab accepted')
# At the denominator is allowed; denominator+1 was rejected above.
single=copy.deepcopy(data)
single['records']=1;single['districts']={'中正':1};single['noIndicatorMatch']=0
single['indicators']=[dict(item,count=int(item['id']=='bins')) for item in data['indicators']]
single['districtIndicators']={'中正':{'counts':{i['id']:i['count'] for i in single['indicators']},'noIndicatorMatch':0}}
m['validate_districts'](single)
single['districtIndicators']['中正']['counts']['bins']=2
try:m['validate_districts'](single)
except ValueError:pass
else:raise AssertionError('n+1 accepted')
`));

test('district report preserves known cross-cells and excluded-district baselines in both formats', () => python(String.raw`
import json,runpy
from pathlib import Path
m=runpy.run_path('scripts/analyze-feedback.py')
d=json.loads(Path('research/feedback-2026-10-17/summary.json').read_text())
m['validate_districts'](d)
assert len(d['districtIndicators'])==12
assert d['districtIndicators']['北投']['counts']['cigarettes']==0
assert d['districtIndicators']['大安']['counts']['bins']==379
count,n,rest,rn,delta=m['district_comparison'](d,'北投','dropoff')
assert (count,n,rest,rn)==(11,139,41,2524)
assert round(delta,1)==6.3
md,page=m['render_districts'](d);md='\n'.join(md);page='\n'.join(page)
assert page.count('data-indicator=')==96
assert '11／139（7.9%）' in md and '41／2524（1.6%）' in page
assert '其餘各區' in page and '百分點' in md
assert '行政區標記尚未確認為居住地或事件所在地' in page
assert '橫列比例不能相加' in md
`));
