import test from 'node:test';
import assert from 'node:assert/strict';
import {access, cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const site = new URL('../', import.meta.url);
const history = new URL('data/history/', site);
const research = new URL('data/research/', site);
const expectedCatalog = JSON.parse(await readFile(new URL('dist/data/datasets.json', site)));
const expectedComparison = JSON.parse(await readFile(new URL('dist/data/comparison-2024-2026.json', site)));
const expectedDistances = JSON.parse(await readFile(new URL('dist/data/comparison-coordinate-distances.json', site)));

for (const monorepo of [true, false]) {
  test(`rebuilds preserved downloads and research from ${monorepo ? 'canonical topic' : 'standalone source package'}`, async t => {
    const fixture = await mkdtemp(join(tmpdir(), 'taipei-history-build-'));
    t.after(() => rm(fixture, {recursive: true, force: true}));
    const output = join(fixture, 'sites/taipei-waste-lab');
    await mkdir(join(output, 'scripts'), {recursive: true});
    for (const script of ['cross_transport.py', 'prepare-cross-analysis.py', 'prepare-data.py', 'prepare-portal.py', 'prepare-hotspots.py', 'prepare-public.py', 'prepare-siting-overlay.py', 'compare-snapshots.py', 'analyze-coordinate-distances.py',
                          'prepare-research-execution.py', 'prepare-placement-case.py', 'estimate-budget.py', 'package-research.py', 'analyze-feedback.py', 'feedback_access.py', 'feedback_removal.py']) {
      await cp(new URL('scripts/'+script, site), join(output, 'scripts', script));
    }
    await cp(new URL('../youtong/', site), join(fixture, 'sites/youtong'), {recursive:true});
    await cp(new URL('templates/', site), join(output, 'templates'), {recursive:true});
    await mkdir(join(output, 'data'), {recursive:true});
    await cp(new URL('data/cross-analysis-inputs/', site), join(output, 'data/cross-analysis-inputs'), {recursive:true});
    for(const name of ['siting-overlay.json','siting-overlay.provenance.json','field-priorities.json'])await cp(new URL('data/'+name,site),join(output,'data',name));
    await mkdir(join(output, 'dist'), {recursive: true});
    await cp(new URL('dist/', site), join(output, 'dist'), {recursive: true, filter: source => !/[\\/]dist[\\/](data|research)([\\/]|$)/.test(source)});
    const bundle = monorepo ? join(fixture, 'topics/bins/research') : join(output, 'research');
    await cp(new URL('research/', site), bundle, {recursive: true});
    const inputs = monorepo ? join(fixture, 'topics/bins') : join(output, 'data');
    const inputHistory = monorepo ? join(inputs, 'data/history') : join(inputs, 'history');
    const inputResearch = monorepo ? join(inputs, 'docs') : join(inputs, 'research');
    await cp(history, inputHistory, {recursive: true});
    await cp(research, inputResearch, {recursive: true});
    if (monorepo) {
      // Stale packaged files must never override the repository's source data.
      await mkdir(join(output, 'data/history'), {recursive: true});
      await writeFile(join(output, 'data/history/taipei-bins-2015.csv'), 'stale package');
      await writeFile(join(bundle, 'coordinate-distances-2024-2026/README.md'), 'stale derived notes');
      await mkdir(join(output, 'research/budget-2026-10-15'), {recursive: true});
      await writeFile(join(output, 'research/budget-2026-10-15/inputs.json'), 'stale research');
    }
    const stalePaths=['dist/research/retired-study/old.md', 'dist/research/source-recovery-2026-10-15/retired.txt'];
    if(monorepo)stalePaths.push('research/retired-study/old.md', 'research/budget-2026-10-15/retired.txt');
    for(const name of stalePaths){await mkdir(join(output,name,'..'),{recursive:true});await writeFile(join(output,name),'retired generated copy');}
    const result = spawnSync(process.env.PYTHON_BIN || 'python3', [join(output, 'scripts/prepare-data.py')], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    for(const name of stalePaths)await assert.rejects(access(join(output,name)),{code:'ENOENT'});
    for (const name of ['README.md', 'inputs.json', 'estimate.csv']) {
      const expected = await readFile(new URL('research/budget-2026-10-15/'+name, site));
      assert.deepEqual(await readFile(join(output, 'research/budget-2026-10-15', name)), expected);
      assert.deepEqual(await readFile(join(output, 'dist/research/budget-2026-10-15', name)), expected);
    }
    assert.deepEqual(await readFile(join(output,'dist/siting-overlay.html')),await readFile(new URL('dist/siting-overlay.html',site)));
    const rebuilt = JSON.parse(await readFile(join(output, 'dist/data/datasets.json')));
    assert.deepEqual(rebuilt, expectedCatalog);
    assert.deepEqual(JSON.parse(await readFile(join(output, 'dist/data/comparison-2024-2026.json'))), expectedComparison);
    assert.deepEqual(JSON.parse(await readFile(join(output, 'dist/data/comparison-coordinate-distances.json'))), expectedDistances);
    for (const name of ['README.md', 'protocol.json']) {
      const original = await readFile(new URL('research/comparison-2024-2026/' + name, site), 'utf8');
      const deployed = await readFile(join(output, 'dist/research/comparison-2024-2026', name), 'utf8');
      assert.equal(deployed, name === 'README.md' ? original.replaceAll('../../dist/data/', '../../data/') : original);
      for (const [, target] of deployed.matchAll(/\]\(([^()\s]+)\)/g)) {
        if (/^[a-z]+:|^#|^\//i.test(target)) continue;
        assert.ok((await readFile(join(output, 'dist/research/comparison-2024-2026', target))).length, `comparison link: ${target}`);
      }
    }
    for (const name of ['README.md', 'protocol.json']) {
      const original = await readFile(new URL('research/coordinate-distances-2024-2026/' + name, site), 'utf8');
      const deployed = await readFile(join(output, 'dist/research/coordinate-distances-2024-2026', name), 'utf8');
      assert.equal(deployed, name === 'README.md' ? original.replaceAll('../../dist/data/', '../../data/') : original);
      for (const [, target] of deployed.matchAll(/\]\(([^()\s]+)\)/g)) {
        if (/^[a-z]+:|^#|^\//i.test(target)) continue;
        assert.ok((await readFile(join(output, 'dist/research/coordinate-distances-2024-2026', target))).length, `distance link: ${target}`);
      }
    }
    const names = await readdir(history);
    assert.equal(names.length, 9);
    for (const name of names) {
      const original = await readFile(new URL(name, history));
      assert.deepEqual(await readFile(join(output, 'dist/data', name)), original, `download bytes: ${name}`);
      assert.deepEqual(await readFile(join(output, 'data/history', name)), original, `packaged bytes: ${name}`);
    }
    const researchNames = await readdir(research);
    assert.equal(researchNames.length, 4);
    for (const name of researchNames) {
      const original = await readFile(new URL(name, research));
      assert.deepEqual(await readFile(join(output, 'data/research', name)), original);
      const deployed = await readFile(join(output, 'dist/research', name), 'utf8');
      assert.ok(deployed.startsWith('# '), `full research body: ${name}`);
      assert.ok(!deployed.includes('../data/history/'), `download URL rewrite: ${name}`);
      for (const [, target] of deployed.matchAll(/\]\(([^()\s]+)\)/g)) {
        if (/^[a-z]+:|^#|^\//i.test(target)) continue;
        assert.ok((await readFile(join(output, 'dist/research', target))).length, `local link: ${name} → ${target}`);
      }
    }
  });
}


test('venue generator matches retained rows and rejects source drift before returning a new layer',()=>{
  const code=String.raw`
import csv,io,json,runpy,tempfile,shutil
from pathlib import Path
m=runpy.run_path('scripts/prepare-data.py');research=Path('research')
d=m['venue_leads'](research)
raw=(research/'source-recovery-2026-10-15/raw/official-tourist.csv').read_bytes()
rows=list(csv.DictReader(io.StringIO(raw.decode('cp950'))))
assert len(rows)==130
assert [p['id'] for p in d['points']]==[f'venue-row-{i+1}' for i in range(len(rows))]
assert [(p['district'],p['address'],p['rawX'],p['rawY']) for p in d['points']]==[(r['行政區'],r['地址'],r['經度'],r['緯度']) for r in rows]
with tempfile.TemporaryDirectory() as directory:
 target=Path(directory)
 for name in ['bin-coverage-2026-10-18','feedback-distribution-2026-10-18','source-recovery-2026-10-15']:
  shutil.copytree(research/name,target/name)
 source=target/'source-recovery-2026-10-15/raw/official-tourist.csv'
 source.write_bytes(raw+b'\n')
 try:m['venue_leads'](target)
 except ValueError as e:assert 'Venue source hash mismatch' in str(e)
 else:raise AssertionError('Changed venue source was accepted')
`;
  const result=spawnSync(process.env.PYTHON_BIN||'python3',['-c',code],{cwd:site,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
