import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const root = new URL('../', import.meta.url);
function check(code) {
  const result = spawnSync('python3', ['-c', code], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
}

test('budget charges two-person crews, each route overhead, and only recurring work for extra rounds', () => {
  check(`
import json, runpy
from decimal import Decimal as D
from pathlib import Path
estimate=runpy.run_path('scripts/estimate-budget.py')['estimate']
m=json.loads(Path('research/budget-2026-10-15/inputs.json').read_text())
start,expand=m['cases']
a=estimate(m,start,1)
assert a['hours_per_day']==D('5.5')
assert a['once']==465000 and a['operations']==1560300
assert a['total']==2329095
b=estimate(m,start,1,rounds=2)
assert b['once']==a['once']
assert b['total']-a['total']==1472805
one_route=estimate(m,dict(expand,routes=1),1)
four_routes=estimate(m,expand,1)
assert abs(four_routes['total']-one_route['total']-D('2361093.75'))<D('0.000001')
for case in m['cases']:
 values=[estimate(m,case,i)['total'] for i in range(3)]
 assert 0<values[0]<values[1]<values[2]
`);
});

test('budget document, site tables and downloads reproduce from the same saved assumptions', () => {
  check(`
import runpy, tempfile, shutil, zipfile
from pathlib import Path
root=Path.cwd()
paths=['research/budget-2026-10-15/README.md','research/budget-2026-10-15/inputs.json',
       'research/budget-2026-10-15/estimate.csv','dist/index.html','scripts/estimate-budget.py']
with tempfile.TemporaryDirectory() as d:
 target=Path(d)
 for path in paths:
  dest=target/path; dest.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(root/path,dest)
 runpy.run_path(str(target/'scripts/estimate-budget.py'),run_name='__main__')
 for path in paths: assert (target/path).read_bytes()==(root/path).read_bytes(),path
with zipfile.ZipFile('dist/research/research-execution-2026-10-15.zip') as z:
 for path in paths[:3]:
  assert z.read(path)==(root/path).read_bytes(),path
  assert (root/'dist'/path).read_bytes()==(root/path).read_bytes(),path
 assert z.read('scripts/estimate-budget.py')==(root/'scripts/estimate-budget.py').read_bytes()
`);
});
