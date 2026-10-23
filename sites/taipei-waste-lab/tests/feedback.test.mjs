import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pageFromHash} from '../dist/data-utils.js';

const site = new URL('../', import.meta.url);
function python(code) {
  const result = spawnSync(process.env.PYTHON_BIN || 'python3', ['-c', code], {cwd: site, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

const fixture = String.raw`
import copy,csv,hashlib,json,runpy,tempfile
from pathlib import Path
m=runpy.run_path('scripts/analyze-feedback.py')
def fails(call):
 try: call()
 except (ValueError,KeyError,TypeError): pass
 else: raise AssertionError('Invalid input was accepted')
def save_lines(path,items):
 path.write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in items))
def make_fixture(root,rows,labels):
 source=root/'input.tsv'
 with source.open('w',newline='',encoding='utf-8-sig') as f:
  w=csv.writer(f,delimiter='\t');w.writerow(m['FIELDS']);w.writerows(rows)
 initial=root/'initial.jsonl';final=root/'final.jsonl';blind=root/'blind.jsonl'
 save_lines(initial,labels);save_lines(final,labels)
 digest=hashlib.sha256(source.read_bytes()).hexdigest()
 sample=m['blind_sample'](rows,digest)
 save_lines(blind,[x for x in labels if x['r'] in sample])
 resolutions=root/'resolutions.json';resolutions.write_text(json.dumps({'decisions':[],'reviewedRows':list(range(1,len(rows)+1)),'notesSha256':'a'*64}))
 protocol=root/'protocol.md';protocol.write_text('Synthetic manually authored coding protocol')
 manifest=root/'manifest.json'
 manifest.write_text(json.dumps({'source_sha256':digest,'records':len(rows),'protocol_sha256':hashlib.sha256(protocol.read_bytes()).hexdigest()}))
 return source,final,initial,blind,resolutions,protocol,manifest
rows=[['a','中正','環境','在意','不想在這裡放垃圾桶，會被塞滿家戶垃圾'],
      ['b','中正','環境','無奈','其他意見'],
      ['c','大同','環境','在意','下班趕不上收運時段'],
      ['d','大同','環境','在意','街道投放不方便，希望保留現有設施']]
labels=[{'r':1,'themes':['A','D'],'stance':'less','clarity':'clear','meaning':'反對此處設置公共桶並擔心家戶混投'},
        {'r':2,'themes':[],'stance':'none','clarity':'unclear','meaning':'意見過於籠統，無法判定具體困擾'},
        {'r':3,'themes':['B'],'stance':'none','clarity':'clear','meaning':'工作時間與家戶垃圾收運時段衝突'},
        {'r':4,'themes':['A'],'stance':'more','clarity':'clear','meaning':'街道投放不便，希望保留既有設施'}]
`;

test('feedback chapter links resolve without changing other destinations', () => {
  for (const hash of ['#feedback', '#feedback-signals', '#feedback-cross', '#feedback-stances', '#feedback-moods', '#feedback-method', '#feedback-overlap', '#feedback-loop', '#feedback-mechanism-sorting', '#feedback-validation']) {
    assert.equal(pageFromHash(hash), 'feedback');
  }
  assert.equal(pageFromHash('#main', 'feedback'), 'feedback');
  assert.equal(pageFromHash('#reference-L01'), 'sources');
  assert.equal(pageFromHash('#plan-scope'), 'archive');
  assert.equal(pageFromHash('#unknown'), 'research');
});

test('strict TSV preserves multiline messages and distinct IDs with identical text', () => python(fixture + String.raw`
with tempfile.TemporaryDirectory() as directory:
 root=Path(directory)
 source_rows=copy.deepcopy(rows);source_rows[0][4]='第一行\n第二行';source_rows[2][4]=source_rows[3][4]
 args=make_fixture(root,source_rows,labels);data=m['analyze'](*args)
 assert data['records']==4
 assert data['quality']=={'uniqueIds':4,'missingCells':0,'multilineRecords':1,'duplicateTextGroups':1,'duplicateTextExtraRows':1}
 p=args[0]
 for bad in ([],[rows[0][:-1]],[rows[0]+['extra']],[rows[0],rows[0]],[['a','中正','環境','在意',' ']]):
  with p.open('w',newline='') as f:
   w=csv.writer(f,delimiter='\t');w.writerow(m['FIELDS']);w.writerows(bad)
  fails(lambda:m['read_feedback'](p))
 p.write_text('wrong\theader\n');fails(lambda:m['read_feedback'](p))
`));

test('only authored semantics determine counts, retaining negation, overlap and all denominators', () => python(fixture + String.raw`
with tempfile.TemporaryDirectory() as directory:
 args=make_fixture(Path(directory),rows,labels);d=m['analyze'](*args)
 assert d['districts']=={'中正':2,'大同':2}
 assert d['districtAnalysis']['中正']['themes']['A']==1
 assert d['districtAnalysis']['中正']['themes']['D']==1
 assert d['districtAnalysis']['中正']['unclassified']==1
 assert d['districtAnalysis']['中正']['stances']['less']==1
 assert d['districtAnalysis']['大同']['stances']['more']==1
 assert d['unclassified']==1 and d['unclear']==1
 assert m['district_comparison'](d,'中正','A')==(1,2,1,2,0.0)
 assert m['district_comparison'](d,'中正','D')==(1,2,0,2,50.0)
 md,page=m['render_districts'](d);md='\n'.join(md);page='\n'.join(page)
 assert page.count('data-theme=')==14
 assert '1（50.0%）' in md and '0（0.0%）' in md
 # Different text must not silently generate different labels.
 changed=copy.deepcopy(rows)
 for row in changed: row[4]='垃圾桶 垃圾車 廚餘 鼠蟲'
 args=make_fixture(Path(directory),changed,labels);other=m['analyze'](*args)
 assert other['themes']==d['themes'] and other['stances']==d['stances']
`));

test('annotation import rejects missing rows, duplicates and unrecognized or malformed judgments', () => python(fixture + String.raw`
with tempfile.TemporaryDirectory() as directory:
 p=Path(directory)/'annotations.jsonl'
 for bad in (labels[:-1],labels+[labels[0]]):
  save_lines(p,bad);fails(lambda:m['read_annotations'](p,4))
 mutations=[lambda x:x.update(r=0),lambda x:x.update(r=5),lambda x:x.update(r=True),
  lambda x:x.update(themes=['Z']),lambda x:x.update(themes=['A','A']),lambda x:x.update(themes=['D','A']),
  lambda x:x.update(stance='support'),lambda x:x.update(clarity='certain'),lambda x:x.update(meaning=' '),
  lambda x:x.update(extra='raw text')]
 for mutate in mutations:
  bad=copy.deepcopy(labels);mutate(bad[0]);save_lines(p,bad);fails(lambda:m['read_annotations'](p,4))
 save_lines(p,labels);assert len(m['read_annotations'](p,4))==4
`));

test('blind coding uses a deterministic stratified sample and requires every disagreement to be resolved', () => python(fixture + String.raw`
sample_rows=[[str(i),'甲' if i<20 else '乙','環境','在意','測試'] for i in range(40)]
sample=m['blind_sample'](sample_rows,'frozen-source')
assert sample==m['blind_sample'](sample_rows,'frozen-source') and len(sample)==24
assert sum(r<=20 for r in sample)==12
with tempfile.TemporaryDirectory() as directory:
 args=make_fixture(Path(directory),rows,labels)
 blind=copy.deepcopy(labels);blind[0]['themes']=['D'];save_lines(args[3],blind)
 fails(lambda:m['analyze'](*args))
 args[4].write_text(json.dumps({'decisions':[{'r':1,'reason':'重新閱讀原文，保留對設桶位置的反對與混投顧慮'}],'reviewedRows':[1,2,3,4],'notesSha256':'a'*64}))
 data=m['analyze'](*args);audit=data['semantic']['audit']
 assert audit['initialAgreement']=={'themes':3,'stance':4,'clarity':4}
 assert audit['disagreementRows']==audit['adjudicatedRows']==1 and audit['changedRows']==0
 save_lines(args[3],blind[:-1]);fails(lambda:m['analyze'](*args))
`));

test('changes outside original sample disagreements need reasons and reread coverage', () => python(fixture + String.raw`
with tempfile.TemporaryDirectory() as directory:
 args=make_fixture(Path(directory),rows,labels)
 changed=copy.deepcopy(labels);changed[0]['themes']=['D'];save_lines(args[1],changed)
 fails(lambda:m['analyze'](*args))
 evidence={'decisions':[{'r':1,'reason':'回讀後修正判斷'}],'reviewedRows':[1,2,3,4],'notesSha256':'a'*64}
 args[4].write_text(json.dumps(evidence));data=m['analyze'](*args)
 assert data['semantic']['audit']['disagreementRows']==0
 assert data['semantic']['audit']['changedRows']==1
 evidence['reviewedRows']=[1,2,3];args[4].write_text(json.dumps(evidence));fails(lambda:m['analyze'](*args))
`));

test('source and protocol bindings reject changed input before analysis', () => python(fixture + String.raw`
with tempfile.TemporaryDirectory() as directory:
 root=Path(directory);args=make_fixture(root,rows,labels)
 args[5].write_text('changed protocol');fails(lambda:m['analyze'](*args))
 args=make_fixture(root,rows,labels)
 args[0].write_bytes(args[0].read_bytes()+b'\n');fails(lambda:m['analyze'](*args))
`));

test('aggregate validation rejects impossible district counts and stale word-count schemas', () => python(fixture + String.raw`
with tempfile.TemporaryDirectory() as directory:
 args=make_fixture(Path(directory),rows,labels);data=m['analyze'](*args)
 mutations=[lambda d:d.update(schemaVersion=2),lambda d:d['districtAnalysis'].pop('中正'),
  lambda d:d['districtAnalysis']['中正']['themes'].pop('A'),
  lambda d:d['districtAnalysis']['中正']['themes'].update(A=-1),
  lambda d:d['districtAnalysis']['中正']['themes'].update(A=3),
  lambda d:d['districtAnalysis']['中正']['themes'].update(A=1.0),
  lambda d:d['districtAnalysis']['中正']['stances'].update(less=2),
  lambda d:d['districtAnalysis']['中正'].update(unclassified=2),
  lambda d:d['semantic']['audit'].update(adjudicatedRows=1),
  lambda d:d['semantic']['audit'].update(consistencyReviewedRows=3),
  lambda d:d['semantic']['audit']['initialAgreement'].pop('themes')]
 for mutate in mutations:
  broken=copy.deepcopy(data);mutate(broken);fails(lambda:m['validate'](broken))
 one=make_fixture(Path(directory),[rows[0]],[labels[0]]);single=m['analyze'](*one)
 assert m['district_comparison'](single,'中正','A')==(1,1,0,0,None)
 m['render_districts'](single)
 single['districtAnalysis']['中正']['themes']['A']=2;fails(lambda:m['validate'](single))
`));

test('saved semantic results, report and public page agree without exposing individual annotations', () => python(String.raw`
import hashlib,json,re,runpy,shutil,tempfile,zipfile
from pathlib import Path
m=runpy.run_path('scripts/analyze-feedback.py')
folder=Path('research/feedback-2026-10-17');data=json.loads((folder/'summary.json').read_text());m['validate'](data)
assert data['records']==2663 and data['schemaVersion']==3
assert data['quality']['multilineRecords']==232
assert sum(data['stances'].values())==2663
assert data['semantic']['audit']['sampleSize']==144
assert hashlib.sha256((folder/'semantic-protocol.md').read_bytes()).hexdigest()==data['semantic']['protocolSha256']
for key in ('districts','moods','originalTopics'):assert sum(data[key].values())==2663
markdown,content,_,detail_markdown=m['render_with_detail'](data,m['load_distribution'](data),folder.parent)
assert detail_markdown==Path('research/feedback-access-2026-10-18/README.md').read_text()
assert markdown==(folder/'README.md').read_text()==Path('dist/research/feedback-2026-10-17/README.md').read_text()
assert content in Path('dist/index.html').read_text()
assert content.count('data-theme=')==84
assert m['render'](data,m['load_distribution'](data))[1].count('class="feedback-bar-track"')==7
assert content.count('class="feedback-bar-track"')==22
assert '不使用關鍵字規則分類' in content and '比例不能相加' in content
assert '不是分類正確率' in content and '收集期間' in content
assert '已撤回' in content and '其餘各區' in content
for body in (json.dumps(data),markdown,content):assert not re.search(r'HK-\d+|"meaning"|"r"\s*:',body)
public=runpy.run_path('scripts/prepare-public.py');assert len(public['ASSETS'])==77 and 'service-continuity.css' in public['ASSETS']
assert 'cases/zhongshan.html' in public['ASSETS']
assert {'images/hotspots/activity-ranking.png','images/hotspots/activity-hours.png','images/hotspots/station-context.png'}.issubset(public['ASSETS'])
assert {'prd/index.html','prd/style.css'}.issubset(public['ASSETS'])
assert not any(name.endswith(('summary.json','.tsv','.md','.jsonl')) for name in public['ASSETS'])
with tempfile.TemporaryDirectory() as directory:
 root=Path(directory).resolve()
 for name in public['ASSETS']:
  target=root/'dist'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(Path('dist')/name,target)
 (root/'dist/private-feedback.jsonl').write_text('private interpretation')
 public['prepare'].__globals__['ROOT']=root;public['prepare']()
 assert content in (root/'out/index.html').read_text()
 assert not (root/'out/private-feedback.jsonl').exists()
with zipfile.ZipFile('dist/research/research-execution-2026-10-15.zip') as bundle:
 assert 'scripts/analyze-feedback.py' in bundle.namelist()
 assert 'scripts/feedback_access.py' in bundle.namelist()
 assert any(name.endswith('feedback-2026-10-17/semantic-protocol.md') for name in bundle.namelist())
 assert not any('private' in name or name.endswith(('.tsv','.jsonl')) for name in bundle.namelist())
`));

test('aggregate-only portable regeneration is stable and partial private input fails closed', () => python(String.raw`
import runpy,shutil,subprocess,sys,tempfile
from pathlib import Path
with tempfile.TemporaryDirectory() as directory:
 root=Path(directory)
 (root/'scripts').mkdir();(root/'dist').mkdir()
 for name in ('analyze-feedback.py','feedback_access.py','feedback_removal.py'):
  shutil.copy(Path('scripts')/name,root/'scripts'/name)
 for name in ['feedback-removal-2026-10-18','feedback-access-2026-10-18','feedback-2026-10-17','feedback-distribution-2026-10-18','bin-coverage-2026-10-18','source-recovery-2026-10-15']:
  shutil.copytree(Path('research')/name,root/'research'/name)
 shutil.copy('dist/index.html',root/'dist/index.html')
 result=subprocess.run([sys.executable,'scripts/analyze-feedback.py'],cwd=root,capture_output=True,text=True)
 assert result.returncode==0,result.stderr
 assert (root/'dist/index.html').read_bytes()==Path('dist/index.html').read_bytes()
 before=(root/'dist/index.html').read_bytes()
 result=subprocess.run([sys.executable,'scripts/analyze-feedback.py','--input','missing.tsv'],cwd=root,capture_output=True,text=True)
 assert result.returncode!=0 and 'Recalculation requires' in result.stderr
 assert (root/'dist/index.html').read_bytes()==before
`));


test('district diagram keeps tied main issues and separates relative differences from untested directions', () => python(String.raw`
import copy,json,runpy
from pathlib import Path
m=runpy.run_path('scripts/analyze-feedback.py')
d=json.loads(Path('research/feedback-2026-10-17/summary.json').read_text())
before=copy.deepcopy(d)
assert m['district_profile'](d,'南港')==(['A','D','G'],'D')
assert m['district_profile'](d,'文山')==(['A','C'],'B')
assert m['district_profile'](d,'萬華')==(['C','A'],'C')
# At a tie include every second-place issue; one fewer remains outside.
tie=copy.deepcopy(d)
c=tie['districtAnalysis']['南港']['themes']
c['G']=22
assert m['district_profile'](tie,'南港')[0]==['A','D']
c['G']=23
assert m['district_profile'](tie,'南港')[0]==['A','D','G']
# Equal district compositions must not manufacture a positive contrast.
equal=copy.deepcopy(d)
equal['districts']={'甲':10,'乙':10};equal['records']=20
counts={k:0 for k in m['THEMES']};counts['A']=5
for item in equal['themes']: item['count']=2*counts[item['id']]
equal['districtAnalysis']={k:{'themes':dict(counts)} for k in equal['districts']}
assert m['district_profile'](equal,'甲')==(['A'],None)
single=copy.deepcopy(equal);single['districts']={'甲':10}
assert m['district_profile'](single,'甲')==(['A'],None)
md,page=m['render_district_diagram'](d);page='\n'.join(page)
assert d==before
assert page.count('class="district-row"')==12
assert page.count('data-contrast-theme=')==12
assert '先查' in page and '再試' in page and '待驗證' in page
assert '25／135 則' in page and '240／2528 則' in page
assert '沒有比例較高的類別' in '\n'.join(m['render_district_diagram'](equal)[1])
assert '無可比較的其他區' in '\n'.join(m['render_district_diagram'](single)[1])
markdown,content=m['render'](d)
assert content.index('id="feedback-cross"') < content.index('id="feedback-signals"')
assert '<details class="feedback-codebook district-full-data">' in content
assert '十二區問題與改善方向' in markdown
`));

test('visible heat matrix retains all district denominators and links to explanations below', () => python(String.raw`
import json,runpy
from pathlib import Path
from html.parser import HTMLParser
m=runpy.run_path('scripts/analyze-feedback.py')
d=json.loads(Path('research/feedback-2026-10-17/summary.json').read_text())
class Matrix(HTMLParser):
 def __init__(self):super().__init__();self.details=0;self.matrix=False;self.cells={};self.current=None;self.links=[];self.ids=set();self.headers=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='details':self.details+=1
  if 'id' in a:self.ids.add(a['id'])
  if tag=='table' and a.get('class')=='feedback-matrix':
   assert self.details==0,'Main comparison must not be collapsed';self.matrix=True
  if self.matrix and tag=='th':self.headers.append(a.get('scope'))
  if self.matrix and tag=='a':self.links.append(a['href'])
  if 'data-theme' in a:
   self.current=(a['data-district'],a['data-theme']);self.cells[self.current]={'style':a['style'],'text':''}
 def handle_data(self,text):
  if self.current:self.cells[self.current]['text']+=text
 def handle_endtag(self,tag):
  if tag=='td':self.current=None
  if tag=='table':self.matrix=False
  if tag=='details':self.details-=1
md,parts=m['render_districts'](d,m['load_distribution'](d));body='\n'.join(parts)
p=Matrix();p.feed(body)
assert len(p.cells)==84 and p.headers==['col']*8+['row']*12
assert len(p.links)==12 and all(url[1:] in p.ids for url in p.links)
for district,n in d['districts'].items():
 for theme,count in d['districtAnalysis'][district]['themes'].items():
  cell=p.cells[district,theme]
  assert cell['text']==f'{count/n*100:.1f}%{count}／{n} 則'
assert body.index('class="feedback-matrix"')<body.index('id="feedback-district-details"')<body.index('data-profile=')
assert body.index('data-profile=')<body.index('district-full-data')
_,page=m['render'](d,m['load_distribution'](d))
assert page.index('id="feedback-cross"')<page.index('id="feedback-findings"')
assert '不是問題嚴重程度' in body and '比例不能相加' in body
assert '全表固定為 0–100%' in '\n'.join(md)
`));

test('one percentage color scale stays monotonic, denominator-independent and readable', () => python(String.raw`
import math,runpy
m=runpy.run_path('scripts/analyze-feedback.py')
def rgb(code):return [int(code[i:i+2],16)/255 for i in (1,3,5)]
def luminance(code):
 values=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in rgb(code)]
 return sum(a*b for a,b in zip(values,[.2126,.7152,.0722]))
previous=2
for step in range(1001):
 background,ink=m['heat_colors'](step/1000)
 light=luminance(background);foreground=luminance(ink)
 assert light<=previous;previous=light
 assert (max(light,foreground)+.05)/(min(light,foreground)+.05)>=4.5
assert m['heat_colors'](41/82)==m['heat_colors'](246/492)
assert m['heat_colors'](0)!=m['heat_colors'](1)
for bad in [-.001,1.001,math.nan,math.inf]:
 try:m['heat_colors'](bad)
 except ValueError:pass
 else:raise AssertionError('Out-of-range share accepted')
`));
