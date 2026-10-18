import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('private archive has readable links and can rerun its documented budget and package commands', () => {
  const result=spawnSync(process.env.PYTHON_BIN||'python3',['-c',String.raw`
import html, json, re, subprocess, sys, tempfile, zipfile
from pathlib import Path
from urllib.parse import unquote
site=Path.cwd()
archive=site/'dist/research/research-execution-2026-10-15.zip'
with tempfile.TemporaryDirectory() as directory:
 root=Path(directory)
 with zipfile.ZipFile(archive) as bundle:
  assert not any('retired' in name for name in bundle.namelist())
  bundle.extractall(root)
 for directory in ('research','dist/research'):
  for note in (root/directory).rglob('*.md'):
   for href in re.findall(r'\]\(([^()\s]+)\)',note.read_text()):
    if re.match(r'^[a-z]+:|^#|^/',href,re.I): continue
    target=note.parent/unquote(href.split('#')[0])
    assert target.exists(),f'{note.relative_to(root)} -> {href}'
 # A removed canonical file cannot persist when the standalone package is rebuilt.
 stale=root/'dist/research/literature-2026-10-15/retired.md'
 stale.parent.mkdir(parents=True,exist_ok=True);stale.write_text('obsolete')
 for script in ('estimate-budget.py','package-research.py'):
  run=subprocess.run([sys.executable,str(root/'scripts'/script)],cwd=root,capture_output=True,text=True)
  assert run.returncode==0,run.stderr
 assert not stale.exists()
 # The standalone rebuild retains reference claims, source links and navigable evidence.
 catalog=json.loads((root/'research/reference-guide-2026-10-16/catalog.json').read_text())
 page=(root/'dist/index.html').read_text()
 for item in catalog['items']:
  assert page.count('id="reference-'+item['id']+'"')==1
  for field in ('finding','lesson','limitation','readingScope'):
   assert html.escape(item[field]) in page, (item['id'],field)
  for source in item.get('sources') or [{'url':item['url']}]:
   assert 'href="'+html.escape(source['url'],quote=True)+'"' in page
 for synthesis in catalog['synthesis']:
  for key in synthesis['references']:
   assert 'data-research-target="reference-'+key+'"' in page
 literature=re.search(r'<!-- research-literature-start -->(.*?)<!-- research-literature-end -->',page,re.S).group(1)
 assert len(re.findall(r'<article class="research-reference"',literature))==13
 assert not '<details' in literature
 for number in range(1,14):
  assert page.count(f'id="reference-L{number:02}"')==1
 for marker,owner in [('research-synthesis','panel-research'),('research-paper-records','panel-sources'),('research-literature','panel-sources'),('research-practice-records','panel-sources')]:
  assert page.count(f'<!-- {marker}-start -->')==1
  before=page.split(f'<!-- {marker}-start -->')[0]
  assert re.findall(r'<section\b[^>]*\bid="(panel-[^"]+)"',before)[-1]==owner
 for name in ('README.md','inputs.json','estimate.csv'):
  assert (root/'research/budget-2026-10-15'/name).read_bytes()==(site/'research/budget-2026-10-15'/name).read_bytes()
 rebuilt=root/'dist/research/research-execution-2026-10-15.zip'
 first=rebuilt.read_bytes()
 subprocess.run([sys.executable,str(root/'scripts/package-research.py')],cwd=root,check=True,capture_output=True)
 assert rebuilt.read_bytes()==first,'Repeated offline package changed bytes'
`],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});

test('conclusions, evidence and unexecuted planning have separate readable destinations', () => {
  const result=spawnSync(process.env.PYTHON_BIN||'python3',['-c',String.raw`
from html.parser import HTMLParser
from pathlib import Path

class Layout(HTMLParser):
 def __init__(self):
  super().__init__(); self.stack=[]; self.panel=None; self.panels={}; self.references={}
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='section':
   self.stack.append(self.panel)
   if attrs.get('id','').startswith('panel-'):
    self.panel=attrs['id']; self.panels[self.panel]={'details':0,'articles':0,'ids':set(),'links':set(),'text':[]}
  if self.panel:
   view=self.panels[self.panel]
   if tag=='details': view['details']+=1
   if tag=='article': view['articles']+=1
   if 'id' in attrs:
    view['ids'].add(attrs['id'])
    if attrs['id'].startswith('reference-'):
     assert attrs['id'] not in self.references
     self.references[attrs['id']]=self.panel
   if tag=='a': view['links'].add(attrs.get('href'))
 def handle_endtag(self,tag):
  if tag=='section': self.panel=self.stack.pop()
 def handle_data(self,data):
  if self.panel: self.panels[self.panel]['text'].append(data)

layout=Layout(); layout.feed(Path('dist/index.html').read_text())
home=layout.panels['panel-research']; materials=layout.panels['panel-materials']
assert home['details']==1 and 'service-method' in home['ids'] and home['articles']==3
assert all(key in home['ids'] for key in ['conclusion-siting','conclusion-collection','conclusion-household'])
assert {'#siting','#history','#countries','#design','#sources','#materials'}<=home['links']
assert len(layout.references)==17 and set(layout.references.values())=={'panel-sources'}
assert layout.panels['panel-sources']['details']==0
for key in ['budget-heading','paid-disposal-heading','implementation-heading','research-field-tools','research-candidates','research-context','research-district','research-exclusions']:
 assert key in materials['ids']
text=''.join(materials['text'])
for limitation in ['尚未選點、詢價或啟動試辦','全部單價與工時仍是假設','不是報價或市府核定預算','尚未執行','48','30']:
 assert limitation in text,limitation
`],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});

test('public hundred-day plan retains the complete proposal with navigable tables and no attachments', () => {
  const result=spawnSync(process.env.PYTHON_BIN||'python3',['-c',String.raw`
import html,re,runpy
from html.parser import HTMLParser
from pathlib import Path
source=Path('research/hundred-day-plan-2026-10-17/README.md').read_text()
page=Path('dist/index.html').read_text()
plan=re.search(r'<!-- hundred-day-plan-start -->(.*?)<!-- hundred-day-plan-end -->',page,re.S).group(1)
class Text(HTMLParser):
 def __init__(self): super().__init__(); self.parts=[]; self.ids=set(); self.links=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if 'id' in attrs: self.ids.add(attrs['id'])
  if tag=='a': self.links.append(attrs['href'])
 def handle_data(self,data): self.parts.append(data)
p=Text();p.feed(plan)
normalize=lambda s: re.sub(r'\s+','',''.join(s))
visible=normalize(p.parts)
for line in source.splitlines():
 if not line.strip(): continue
 if re.fullmatch(r'[| :\-]+',line): continue
 cells=line.strip('|').split('|') if line.startswith('|') else [line]
 for cell in cells:
  cell=re.sub(r'\[([^\]]+)\]\([^\s)]+\)',r'\1',cell)
  cell=cell.replace('**','').removeprefix('# ')
  assert normalize(cell) in visible,cell
assert plan.count('<table ')==sum(1 for line in source.splitlines() if re.fullmatch(r'[| :\-]+',line))
for href in p.links:
 assert href.startswith(('https://','#')),href
 if href.startswith('#plan-'): assert href[1:] in p.ids,href
assert len(p.ids)==12
assert '尚未啟動' in plan and '仍待確認' in plan
assert 'href="#plan"' in page.split('id="panel-research"')[1].split('id="panel-plan"')[0]
assert 'href="#plan"' in page.split('<footer>')[1]
assert '180 日是各點從開放日起的營運期' in page
assert '原估約 250 萬元不是新計畫上限' in page
module=runpy.run_path('scripts/package-research.py')
assert '<script>' not in module['plan_inline']('<script>bad</script>')
try: module['plan_inline']('[private](../private.csv)')
except ValueError: pass
else: raise AssertionError('Unmapped local attachment accepted')
`],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
