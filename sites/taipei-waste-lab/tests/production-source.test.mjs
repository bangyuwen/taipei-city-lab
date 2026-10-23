import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Exercise real Git worktrees; only the GitHub CI response is supplied as data.
test('production rejects dirty and non-main sources and failed or unrelated CI',()=>{
  const result=spawnSync(process.env.PYTHON_BIN||'python3',['-c',String.raw`
import runpy, subprocess, tempfile
from pathlib import Path
m=runpy.run_path('scripts/prepare-production.py')
check=m['require_clean_main']; ci=m['require_ci']
def rejected(fn):
    try: fn()
    except ValueError: return
    raise AssertionError('Expected production gate to reject')
with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp)
    def git(*args):
        return subprocess.check_output(['git','-C',tmp,*args],text=True).strip()
    git('init','-b','main'); git('config','user.email','test@example.invalid'); git('config','user.name','Test')
    (root/'file').write_text('main'); git('add','file'); git('commit','-m','main')
    main=git('rev-parse','HEAD'); check(root,main)
    git('checkout','-b','feature'); check(root,main) # Same immutable main content is valid.
    (root/'file').write_text('dirty'); rejected(lambda:check(root,main))
    git('add','file'); rejected(lambda:check(root,main))
    git('commit','-m','feature'); rejected(lambda:check(root,main))
    git('checkout','--detach',main); check(root,main)
    (root/'untracked').write_text('dirty'); rejected(lambda:check(root,main))
    git('remote','add','origin','https://example.invalid/wrong/repo')
    rejected(lambda:m['remote_main'](root))
    rejected(lambda:m['prepare'](root)) # Existing output is never overwritten.
run={'id':1,'head_sha':'abc','head_branch':'main','event':'push','status':'completed','conclusion':'success'}
assert ci('abc',[{'workflow_runs':[run]}])==1
rejected(lambda:ci('abc',[{'workflow_runs':[]}]))
for key,value in [('head_sha','other'),('head_branch','feature'),('event','pull_request'),('status','in_progress'),('conclusion','failure')]:
    bad=dict(run,**{key:value}); rejected(lambda:ci('abc',[{'workflow_runs':[bad]}]))
new=dict(run,id=2,conclusion='failure')
rejected(lambda:ci('abc',[{'workflow_runs':[run,new]}]))
print('main source and CI gates passed')
`],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/main source and CI gates passed/);
});
