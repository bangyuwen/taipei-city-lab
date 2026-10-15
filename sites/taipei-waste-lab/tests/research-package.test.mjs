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
 assert len(re.findall(r'<summary>L\d{2} ',literature))==13
 for name in ('README.md','inputs.json','estimate.csv'):
  assert (root/'research/budget-2026-10-15'/name).read_bytes()==(site/'research/budget-2026-10-15'/name).read_bytes()
 rebuilt=root/'dist/research/research-execution-2026-10-15.zip'
 first=rebuilt.read_bytes()
 subprocess.run([sys.executable,str(root/'scripts/package-research.py')],cwd=root,check=True,capture_output=True)
 assert rebuilt.read_bytes()==first,'Repeated offline package changed bytes'
`],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
