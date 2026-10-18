import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function python(code) {
  const result = spawnSync(process.env.PYTHON_BIN || 'python3', ['-c', code], {cwd: new URL('../', import.meta.url), encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
const setup = String.raw`
import copy,hashlib,json,runpy,tempfile
from pathlib import Path
m=runpy.run_path('scripts/feedback_access.py')
base=runpy.run_path('scripts/analyze-feedback.py')
def fails(fn):
 try:fn()
 except (ValueError,TypeError,KeyError):pass
 else:raise AssertionError('Invalid evidence accepted')
def item(r,ds,xs,stance,clarity='clear'):
 return {'r':r,'difficulties':ds,'contexts':xs,'stance':stance,'clarity':clarity,'meaning':'Synthetic authored judgment preserving the individual claim'}
rows=[['a','松山','環境','在意','same text'],['b','松山','環境','在意','same text'],
      ['c','松山','環境','在意','No text-based classification is allowed'],
      ['d','北投','環境','在意','unchanged text'],['e','北投','環境','在意','unchanged text']]
prior={1:{'themes':['A'],'stance':'more'},2:{'themes':['A'],'stance':'more'},3:{'themes':['B'],'stance':'none'},4:{'themes':['A'],'stance':'less'},5:{'themes':['A'],'stance':'unspecified'}}
initial={1:item(1,['D1'],[],'more'),2:item(2,['D2','D3'],['X1'],'more'),4:item(4,[],[],'less'),5:item(5,[],[],'unspecified','unclear')}
sample=[1,2,4,5]
prior_summary={'records':5,'source':{'sha256':'a'*64},'semantic':{'annotationSha256':'b'*64},'districts':{'松山':3,'北投':2},'districtAnalysis':{'松山':{'themes':{'A':2}},'北投':{'themes':{'A':2}}}}
def fixture():
 d=m['summarize'](rows,prior,initial,initial,initial,sample,[])
 d['source']={'sourceSha256':'a'*64,'priorAnnotationSha256':'b'*64}
 return d
`;

test('manual access labels alone drive nested counts with duplicates, overlap and opposing rows retained', () => python(setup + String.raw`
d=fixture();m['validate'](d,prior_summary)
assert d['allRecords']==5 and d['overall']['selectedRecords']==4
assert d['districts']['松山']['allRecords']==3 and d['districts']['松山']['selectedRecords']==2
assert d['overall']['difficulties']['D1']==1 and d['overall']['difficulties']['D2']==1 and d['overall']['difficulties']['D3']==1
assert d['overall']['noDifficulty']==2 and d['overall']['noContext']==3 and d['overall']['unclear']==1
assert d['overall']['stances']['less']==1
changed_rows=copy.deepcopy(rows)
for row in changed_rows:row[-1]='垃圾桶不夠 不夠 不夠'
assert m['summarize'](changed_rows,prior,initial,initial,initial,sample,[])==m['summarize'](rows,prior,initial,initial,initial,sample,[])
for district,g in d['districts'].items():assert sum(g['stances'].values())==g['selectedRecords']
`));

test('missing, duplicate, unsupported and padded detail annotations fail closed', () => python(setup + String.raw`
with tempfile.TemporaryDirectory() as directory:
 p=Path(directory)/'labels.jsonl'
 def save(values):p.write_text(''.join(json.dumps(x)+'\n' for x in values))
 save(list(initial.values()));assert m['read_annotations'](p,set(initial))==initial
 bad=copy.deepcopy(list(initial.values()));bad[0]['difficulties']=['D1','D2']
 for values in (list(initial.values())[:-1],list(initial.values())+[initial[1]],bad,[dict(x,contexts=['X99']) for x in initial.values()]):
  save(values);fails(lambda:m['read_annotations'](p,set(initial)))
 save([dict(x,meaning='') for x in initial.values()]);fails(lambda:m['read_annotations'](p,set(initial)))
 save([dict(x,contexts=['X1','X1']) for x in initial.values()]);fails(lambda:m['read_annotations'](p,set(initial)))
`));

test('blind disagreements and later corrections require retained reasons; agreement is counted before adjudication', () => python(setup + String.raw`
secondary=copy.deepcopy(initial);secondary[2]['contexts']=['X1','X2'];secondary[5]['stance']='more'
final=copy.deepcopy(initial);final[2]=secondary[2];final[1]['meaning']='Corrected meaning with labels unchanged'
for decisions in ([],[{'r':2,'reason':'context adjudication'}],[{'r':2,'reason':'context adjudication'},{'r':5,'reason':'retain initial'},{'r':1,'reason':''}]):
 fails(lambda:m['summarize'](rows,prior,initial,secondary,final,sample,decisions))
d=m['summarize'](rows,prior,initial,secondary,final,sample,[{'r':1,'reason':'meaning correction'},{'r':2,'reason':'context correction'},{'r':5,'reason':'retain initial stance'}])
assert d['audit']=={'sampleSize':4,'initialAgreement':{'difficulties':4,'contexts':3,'stance':3,'clarity':4},'disagreementRows':2,'adjudicatedRows':2,'changedRows':2,'decisionRecords':3}
assert d['overall']['priorStanceChanged']==0
final[4]['stance']='conditional'
d=m['summarize'](rows,prior,initial,secondary,final,sample,[{'r':1,'reason':'meaning'},{'r':2,'reason':'context'},{'r':4,'reason':'explicit condition'},{'r':5,'reason':'retain'}])
assert d['overall']['priorStanceChanged']==1
assert m['sample_rows'](rows,set(initial),'a'*64)==sample
`));

test('changed denominators, incompatible coverage and unaudited summaries cannot render as current evidence', () => python(setup + String.raw`
d=fixture()
mutations=[lambda x:x['districts']['松山'].update(selectedRecords=3),lambda x:x['overall']['stances'].update(more=4),lambda x:x['overall'].update(noDifficulty=0),lambda x:x['audit'].update(adjudicatedRows=1),lambda x:x['source'].update(sourceSha256='c'*64)]
for mutate in mutations:
 bad=copy.deepcopy(d);mutate(bad);fails(lambda:m['validate'](bad,prior_summary))
`));

test('retained district detail tables preserve every label, scope, denominator and private boundary', () => python(setup + String.raw`
from html.parser import HTMLParser
research=Path('research');prior=json.loads((research/'feedback-2026-10-17/summary.json').read_text())
data=m['load'](research,prior)
page,md=m['render'](data,base['heat_colors'])
class Tables(HTMLParser):
 def __init__(self):super().__init__();self.active=None;self.cells={};self.headers={};self.ids=set();self.links=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.add(a['id'])
  if tag=='a':self.links.append(a.get('href'))
  if tag=='table' and 'data-access-table' in a:self.active=a['data-access-table'];self.cells[self.active]=[];self.headers[self.active]=[]
  if self.active and tag=='td':self.cells[self.active].append(a)
  if self.active and tag=='th':self.headers[self.active].append(a.get('scope'))
 def handle_endtag(self,tag):
  if tag=='table':self.active=None
p=Tables();p.feed(page)
assert {k:len(v) for k,v in p.cells.items()}=={'difficulties':72,'contexts':84,'stances':72}
for key,labels in [('difficulties',m['DIFFICULTIES']),('contexts',m['CONTEXTS']),('stances',m['STANCES'])]:
 assert p.headers[key].count('row')==12 and p.headers[key].count('col')==len(labels)+1
 for cell in p.cells[key]:
  g=data['districts'][cell['data-district']];count=g[key][cell['data-code']];n=g['selectedRecords'];bg,fg=base['heat_colors'](count/n)
  assert cell['style']==f'--heat-bg:{bg};--heat-ink:{fg}'
for index in range(1,13):assert f'feedback-access-district-{index}' in p.ids
assert '分母改為各區這一類的全部留言' in page and '不是上方七大類表' in page
assert '不使用關鍵字分類' in page and '不是正確率' in page and '未重新細標' in page
assert 'HK-' not in page and '.jsonl' not in page and '/private/' not in page
assert '六種困難' in md and '使用情境' in md and '公共桶立場' in md
`));
