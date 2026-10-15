import test from 'node:test';
import assert from 'node:assert/strict';
import {cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const site = new URL('../', import.meta.url);
const history = new URL('data/history/', site);
const research = new URL('data/research/', site);
const expectedCatalog = JSON.parse(await readFile(new URL('dist/data/datasets.json', site)));

for (const monorepo of [true, false]) {
  test(`rebuilds preserved downloads and research from ${monorepo ? 'canonical topic' : 'standalone source package'}`, async t => {
    const fixture = await mkdtemp(join(tmpdir(), 'taipei-history-build-'));
    t.after(() => rm(fixture, {recursive: true, force: true}));
    const output = join(fixture, 'sites/taipei-waste-lab');
    await mkdir(join(output, 'scripts'), {recursive: true});
    await cp(new URL('scripts/prepare-data.py', site), join(output, 'scripts/prepare-data.py'));
    const inputs = monorepo ? join(fixture, 'topics/bins') : join(output, 'data');
    const inputHistory = monorepo ? join(inputs, 'data/history') : join(inputs, 'history');
    const inputResearch = monorepo ? join(inputs, 'docs') : join(inputs, 'research');
    await cp(history, inputHistory, {recursive: true});
    await cp(research, inputResearch, {recursive: true});
    if (monorepo) {
      // Stale packaged files must never override the repository's source data.
      await mkdir(join(output, 'data/history'), {recursive: true});
      await writeFile(join(output, 'data/history/taipei-bins-2015.csv'), 'stale package');
    }
    const result = spawnSync('python', [join(output, 'scripts/prepare-data.py')], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const rebuilt = JSON.parse(await readFile(join(output, 'dist/data/datasets.json')));
    assert.deepEqual(rebuilt, expectedCatalog);
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
