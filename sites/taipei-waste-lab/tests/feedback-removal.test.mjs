import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
function python(code) {
  const result=spawnSync(process.env.PYTHON_BIN || 'python3',['-c',code],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr || result.stdout);
}
const setup=String.raw`
import copy,json,runpy,tempfile
from pathlib import Path
m=runpy.run_path('scripts/feedback_removal.py')
def fails(fn):
 try:fn()
 except (ValueError,TypeError,KeyError):pass
 else:raise AssertionError('Invalid evidence accepted')
def item(r,status='reported',effects=None,requests=None,places=None,time=None):
 return dict(r=r,status=status,effects=effects or [],requests=requests or [],places=copy.deepcopy(places or []),time=time,meaning='Synthetic individual semantic judgment')
rows=[['a','松山','','','duplicate'],['b','松山','','','duplicate'],['c','北投','','','unchanged'],['d','北投','','','unchanged']]
prior={1:{'difficulties':['D3']},2:{'difficulties':['D3']},3:{'difficulties':['D2']},4:{'difficulties':['D3']}}
place={'name':'Example road','kind':'road','role':'affected'}
initial={1:item(1,effects=['E1','E2'],requests=['R1'],places=[place]),2:item(2,'restore_only',requests=['R1'],places=[place]),4:item(4,'anticipated',requests=['R8'])}
sample=[1,2,4]
assignments=[{'r':1,'index':0,'placeId':'p1','reason':'Manual reconciliation'},{'r':2,'index':0,'placeId':'p1','reason':'Manual reconciliation'}]
comparisons={'places':[{'id':'p1'}]}
prior_summary={'districts':{'松山':{'difficulties':{'D3':2}},'北投':{'difficulties':{'D3':1}}},'overall':{'difficulties':{'D3':3}},'source':{'sourceSha256':'a'*64,'finalSha256':'b'*64}}
def fixture():
 d=m['summarize'](rows,prior,initial,initial,initial,sample,[],assignments,comparisons)
 d['source']={'sourceSha256':'a'*64,'accessFinalSha256':'b'*64}
 return d
`;
test('manual removal judgments preserve duplicate texts, empty effects, opposing requests and nested denominators',()=>python(setup+String.raw`
d=fixture();m['validate'](d,prior_summary)
assert d['overall']['selectedRecords']==3 and d['overall']['noEffect']==2
assert d['overall']['requests']['R8']==1 and d['places'][0]['mentions']==2
changed=copy.deepcopy(rows)
for row in changed:row[-1]='removed removed removed 垃圾桶撤除'
assert m['summarize'](changed,prior,initial,initial,initial,sample,[],assignments,comparisons)==m['summarize'](rows,prior,initial,initial,initial,sample,[],assignments,comparisons)
for mutate in [lambda x:x['overall'].__setitem__('selectedRecords',4),lambda x:x['districts']['松山']['effects'].__setitem__('E1',2),lambda x:x['source'].__setitem__('accessFinalSha256','c'*64)]:
 bad=copy.deepcopy(d);mutate(bad);fails(lambda:m['validate'](bad,prior_summary))
`));
test('annotation coverage, exact schema, exclusive general effect and named-place schema fail closed',()=>python(setup+String.raw`
with tempfile.TemporaryDirectory() as directory:
 p=Path(directory)/'labels.jsonl'
 def read(values):
  p.write_text(''.join(json.dumps(x)+'\n' for x in values));return m['read_annotations'](p,set(initial))
 assert read(list(initial.values()))==initial
 for values in [list(initial.values())[:-1],list(initial.values())+[initial[1]],[dict(x,effects=['E1','E6']) for x in initial.values()],[dict(x,requests=['R9']) for x in initial.values()],[dict(x,status='confirmed') for x in initial.values()],[dict(x,places=[dict(place,coordinate=1)]) for x in initial.values()]]:
  fails(lambda:read(values))
`));
test('blind place differences and corrections require retained adjudication; place assignment is complete and explicit',()=>python(setup+String.raw`
secondary=copy.deepcopy(initial);secondary[1]['places'][0]['role']='alternative'
final=copy.deepcopy(initial);final[2]['time']='last October'
for decisions in [[],[{'r':1,'reason':'retain original'}],[{'r':1,'reason':'retain original'},{'r':2,'reason':''}]]:
 fails(lambda:m['summarize'](rows,prior,initial,secondary,final,sample,decisions,assignments,comparisons))
d=m['summarize'](rows,prior,initial,secondary,final,sample,[{'r':1,'reason':'retain original'},{'r':2,'reason':'correct time'}],assignments,comparisons)
assert d['audit']['initialAgreement']['places']==2 and d['audit']['disagreementRows']==1 and d['audit']['changedRows']==1
for bad in [assignments[:-1],assignments+[assignments[0]],[dict(x,placeId='unknown') for x in assignments]]:
 fails(lambda:m['summarize'](rows,prior,initial,initial,initial,sample,[],bad,comparisons))
`));
test('inventory candidates preserve exact source rows and cannot assert an event without dated evidence',()=>python(setup+String.raw`
with tempfile.TemporaryDirectory() as directory:
 root=Path(directory);(root/'stock.csv').write_text('location,count\nExample road,1\n')
 source={'path':'stock.csv','sha256':m['digest'](root/'stock.csv'),'format':'csv','encoding':'utf-8','rows':1}
 p={'id':'p1','scale':'corridor','reading':'Only a road-level lead','nextCheck':'Locate former bin and date','inventoryRefs':[{'source':'street','row':1,'values':['Example road','1']}],'eventRefs':[],'eventMatch':'unresolved'}
 c={'sources':{'street':source},'events':[],'places':[p]}
 m['validate_comparisons'](root,c,fixture())
 bad=copy.deepcopy(c);bad['places'][0]['inventoryRefs'][0]['values']=['Other road','1'];fails(lambda:m['validate_comparisons'](root,bad,fixture()))
 bad=copy.deepcopy(c);bad['places'][0]['eventMatch']='confirmed';fails(lambda:m['validate_comparisons'](root,bad,fixture()))
 (root/'stock.csv').write_text('location,count\nOther road,1\n');fails(lambda:m['validate_comparisons'](root,c,fixture()))
`));

test('illustrative source references enforce the three-row boundary without deduplicating distinct rows',()=>python(setup+String.raw`
with tempfile.TemporaryDirectory() as directory:
 root=Path(directory);(root/'stock.csv').write_text('location,count\nA,1\nB,1\nC,1\nD,1\n')
 source={'path':'stock.csv','sha256':m['digest'](root/'stock.csv'),'format':'csv','encoding':'utf-8','rows':4}
 refs=[{'source':'street','row':i,'values':[letter,'1']} for i,letter in enumerate('ABCD',1)]
 p={'id':'p1','scale':'corridor','reading':'Illustrative road-level leads','nextCheck':'Locate and date','inventoryRefs':refs[:3],'eventRefs':[],'eventMatch':'unresolved'}
 c={'sources':{'street':source},'events':[],'places':[p]}
 m['validate_comparisons'](root,c,fixture())
 p['inventoryRefs']=refs;fails(lambda:m['validate_comparisons'](root,c,fixture()))
 p['inventoryRefs']=refs[:2]+refs[:1];fails(lambda:m['validate_comparisons'](root,c,fixture()))
`));
test('privacy-cleaned analysis preserves district aggregates and omits individual place links',()=>python(setup+String.raw`
from html.parser import HTMLParser
base=runpy.run_path('scripts/analyze-feedback.py')
research=Path('research');prior=json.loads((research/'feedback-access-2026-10-18/summary.json').read_text())
d,c=m['load'](research,prior);page,markdown=m['render'](d,c,base['heat_colors'])
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.places=[];self.cells=[];self.table=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if 'data-removal-place' in a:self.places.append(a['data-removal-place'])
  if tag=='table':self.table=a.get('data-removal-table')
  if tag=='td' and self.table:self.cells.append((self.table,a['data-district'],a['data-code']))
 def handle_endtag(self,tag):
  if tag=='table':self.table=None
p=Parser();p.feed(page)
assert len(p.ids)==len(set(p.ids)) and 'feedback-removal' in p.ids
assert d['places']==c['places']==c['examples']==c['featuredPlaces']==[]
missing=copy.deepcopy(d);missing.pop('privacyNotice');fails(lambda:m['validate'](missing,prior))
restored=copy.deepcopy(c);restored['examples']=[{'account':'Synthetic individual example'}];fails(lambda:m['validate_comparisons'](research,restored,d))
notice=copy.deepcopy(c);notice.pop('privacyNotice');fails(lambda:m['validate_comparisons'](research,notice,d))
assert p.places==[] and 'data-feedback-privacy="redacted"' in page
assert '不代表原始資料沒有地點或例子' in page
assert '本清理版不保存原文' in page and '本清理版不保留逐則裁決理由' in page
assert '--private-dir' not in markdown and '不代表原始內容可取回' in markdown
assert len(p.cells)==12*(len(m['EFFECTS'])+len(m['REQUESTS'])) and len(set(p.cells))==len(p.cells)
assert all(x['id'] in p.places for x in c['places'])
assert d['overall']['selectedRecords']==913 and d['audit']['sampleSize']==144
assert '<a href="#feedback-removal">' in m['home'](d)
index=Path('dist/index.html').read_text();assert page in index and m['home'](d) in index
assert markdown==(research/m['FOLDER']/'README.md').read_text()
`));

test('saved loader and page build cannot downgrade committed aggregate-only privacy',()=>python(setup+String.raw`
import hashlib,shutil,subprocess,sys
with tempfile.TemporaryDirectory() as directory:
 site=Path(directory)/'site';research=site/'research'
 shutil.copytree(Path('research'),research)
 (site/'scripts').mkdir();(site/'dist').mkdir()
 for name in ('analyze-feedback.py','feedback_access.py','feedback_removal.py'):
  shutil.copy(Path('scripts')/name,site/'scripts'/name)
 page=site/'dist/index.html';shutil.copy('dist/index.html',page);saved_page=page.read_bytes()
 folder=research/m['FOLDER'];summary=folder/'summary.json';comparison=folder/'comparisons.json'
 policy=research/'privacy-redaction-2026-10-24.json';saved_policy=policy.read_bytes()
 original_summary=summary.read_bytes();original_comparison=comparison.read_bytes()
 saved_prior=json.loads((research/'feedback-access-2026-10-18/summary.json').read_text())
 def reject_saved():
  fails(lambda:m['load'](research,saved_prior))
  result=subprocess.run([sys.executable,'scripts/analyze-feedback.py'],cwd=site,capture_output=True,text=True)
  assert result.returncode!=0 and ('privacy provenance' in result.stderr or 'committed cleaned input' in result.stderr or 'aggregate-only feedback' in result.stderr),result.stderr
  assert page.read_bytes()==saved_page
 d=json.loads(original_summary);c=json.loads(original_comparison)
 d.pop('privacyNotice');c.pop('privacyNotice')
 g=copy.deepcopy(d['overall']);n=g['selectedRecords']
 d['places']=[dict(g,id='synthetic-restored',mentions=n,roles={key:n if key=='affected' else 0 for key in m['ROLES']})]
 c['places']=[dict(id='synthetic-restored',label='Synthetic place',scale='coarse',inventoryRefs=[],eventRefs=[],eventMatch='unresolved',reading='Synthetic reading',nextCheck='Synthetic check')]
 c['featuredPlaces']=['synthetic-restored'];c['examples']=[dict(title='Synthetic example',account='SYNTHETIC_PRIVATE_ACCOUNT_DO_NOT_RENDER',action='Synthetic action')]
 comparison.write_text(json.dumps(c));d['source']['comparisonsSha256']=hashlib.sha256(comparison.read_bytes()).hexdigest();summary.write_text(json.dumps(d))
 # Self-declared artifact hashes cannot override the independently committed cleaned pin.
 reject_saved()
 # Even a maintained pin cannot downgrade the provenance's aggregate-only status.
 record=json.loads(saved_policy)
 next(row for row in record['input_rebindings'] if row['input']=='comparisons.json')['cleaned_sha256']=d['source']['comparisonsSha256']
 policy.write_text(json.dumps(record));reject_saved()
 # Current saved artifacts fail closed if provenance disappears or changes mode.
 summary.write_bytes(original_summary);comparison.write_bytes(original_comparison)
 policy.unlink();reject_saved()
 record=json.loads(saved_policy);record['status']='unredacted';policy.write_text(json.dumps(record));reject_saved()
 # Pure synthetic nonredacted validation retains its separate ordinary fixture contract.
 ordinary=fixture();assert 'privacyNotice' not in ordinary;m['validate'](ordinary,prior_summary)
`));
