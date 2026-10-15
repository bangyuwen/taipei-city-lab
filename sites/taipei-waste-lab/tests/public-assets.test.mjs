import test from 'node:test';
import assert from 'node:assert/strict';
import {cp, mkdtemp, mkdir, readFile, readdir, rm, symlink, unlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const site = new URL('../', import.meta.url);
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'waste-public-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  await mkdir(join(root, 'scripts'));
  await cp(new URL('scripts/prepare-public.py', site), join(root, 'scripts/prepare-public.py'));
  await cp(new URL('dist/', site), join(root, 'dist'), {recursive:true});
  return root;
}
function stage(root) {
  return spawnSync(process.env.PYTHON_BIN || 'python3', [join(root, 'scripts/prepare-public.py')], {encoding:'utf8'});
}
async function files(root, prefix='') {
  const result=[];
  for(const entry of await readdir(root, {withFileTypes:true})) {
    const name=prefix+entry.name;
    if(entry.isDirectory())result.push(...await files(join(root,entry.name),name+'/'));
    else result.push(name);
  }
  return result;
}

test('public staging removes stale attachments, preserves originals and copies only runtime data', async t => {
  const root=await fixture(t);
  const privateFile=join(root,'dist/data/taipei-bins-2015.csv');
  const original=await readFile(privateFile);
  await mkdir(join(root,'out/research/nested'),{recursive:true});
  for(const name of ['stale.zip','stale.csv','research/nested/protocol.json'])await writeFile(join(root,'out',name),'private');
  let result=stage(root);
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(await readFile(privateFile),original);
  const names=await files(join(root,'out'));
  assert.ok(!names.some(name=>/\.(?:zip|csv|geojson|md)$/.test(name)));
  assert.deepEqual(names.filter(name=>name.endsWith('.json')).sort(),[
    'data/comparison-2024-2026.json','data/comparison-coordinate-distances.json',
    'data/datasets.json','research/execution-2026-10-15/desk-results.json'
  ]);
  for(const name of names)assert.deepEqual(await readFile(join(root,'out',name)),await readFile(join(root,'dist',name)),name);
  result=stage(root);assert.equal(result.status,0,result.stderr);
});

test('missing required input fails before replacing existing output', async t => {
  const root=await fixture(t);
  await mkdir(join(root,'out'));await writeFile(join(root,'out/sentinel'),'preserved');
  await unlink(join(root,'dist/app.js'));
  const result=stage(root);
  assert.notEqual(result.status,0);assert.match(result.stderr,/Missing required public input: app.js/);
  assert.equal(await readFile(join(root,'out/sentinel'),'utf8'),'preserved');
});

test('source and stale output symlinks are rejected without leaking their target', async t => {
  const root=await fixture(t);
  const source=join(root,'dist/app.js');await unlink(source);
  await symlink(join(root,'dist/data/taipei-bins-2015.csv'),source);
  let result=stage(root);assert.notEqual(result.status,0);assert.match(result.stderr,/must not be a symlink/);
  await unlink(source);await writeFile(source,'// runtime');
  await mkdir(join(root,'out'));await symlink(join(root,'dist'),join(root,'out/escape'));
  result=stage(root);assert.notEqual(result.status,0);assert.match(result.stderr,/output contains a symlink/);
  assert.ok((await readFile(join(root,'dist/data/taipei-bins-2015.csv'))).length);
});

test('an output root symlink cannot replace or modify the source tree', async t => {
  const root=await fixture(t);const original=await readFile(join(root,'dist/app.js'));
  await symlink(join(root,'dist'),join(root,'out'));
  const result=stage(root);assert.notEqual(result.status,0);assert.match(result.stderr,/Unsafe public output root/);
  assert.deepEqual(await readFile(join(root,'dist/app.js')),original);
});
