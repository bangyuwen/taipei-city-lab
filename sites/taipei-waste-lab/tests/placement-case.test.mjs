import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pageFromHash} from '../dist/data-utils.js';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

test('case preserves dated evidence, unknowns and working public navigation', () => {
  const path = 'dist/cases/zhongshan.html';
  const page = read(path);
  const index = read('dist/index.html');
  const result = JSON.parse(read('research/station-venue-recheck-2026-10-22/results.json'));
  const station = result.stations.find(row => row.station === '中山');
  assert.ok(page.includes(station.nearest_street_record.distance_m.toFixed(1)));
  assert.ok(page.includes(station.nearest_street_record['地址']));
  assert.equal(result.usable_bin_count['中山'], null);
  assert.ok(page.includes('不是已核實的 10 個可用垃圾桶'));
  assert.ok(page.includes('不是已觀察到的人物或事件'));
  assert.ok(page.includes('三項目前都未知'));
  assert.ok(!page.includes('{{'));
  for (const match of page.matchAll(/(?:href|src)="([^"\s]+)"/g)) {
    const url = match[1];
    if (url.startsWith('https://')) continue;
    const [file, fragment] = url.split('#');
    const destination = file ? resolve(root, dirname(path), file) : resolve(root, path);
    const target = file?.endsWith('/') ? resolve(destination, 'index.html') : destination;
    assert.ok(existsSync(target), url);
    if (fragment) {
      const html = readFileSync(target, 'utf8');
      assert.ok(html.includes(`id="${fragment}"`), `Missing target: ${url}`);
      if (file) assert.ok(pageFromHash('#' + fragment), `Missing route: ${url}`);
    }
  }
  assert.equal((index.match(/<!-- zhongshan-placement-case:start -->/g) || []).length, 1);
  assert.ok(index.includes('href="cases/zhongshan.html"'));
  assert.equal(read('out/cases/zhongshan.html'), page);
  assert.equal(read('public/research/cases/zhongshan.html'), page);
  assert.ok(!existsSync(resolve(root, 'public/research/research/placement-case-2026-10-23/inputs.json')));
});

test('standalone rendering is repeatable and rejects changed evidence before writing', () => {
  const code = String.raw`
import pathlib, shutil, subprocess, sys, tempfile
root = pathlib.Path.cwd()
with tempfile.TemporaryDirectory() as folder:
    site = pathlib.Path(folder) / 'site'
    case = site / 'research/placement-case-2026-10-23'
    shutil.copytree(root / 'research/placement-case-2026-10-23', case)
    shutil.copytree(root / 'research/station-venue-recheck-2026-10-22', case.parent / 'station-venue-recheck-2026-10-22')
    (site / 'dist').mkdir()
    index = site / 'dist/index.html'
    index.write_text('<h4 id="method-venue-zhongshan">中山</h4><p>Keep existing content.</p>')
    command = [sys.executable, str(case / 'render.py')]
    subprocess.run(command, check=True, capture_output=True)
    page = site / 'dist/cases/zhongshan.html'
    expected = (page.read_bytes(), index.read_bytes())
    subprocess.run(command, check=True, capture_output=True)
    assert expected == (page.read_bytes(), index.read_bytes()), 'Render must be idempotent'
    assert b'Keep existing content.' in index.read_bytes()
    source = case.parent / 'station-venue-recheck-2026-10-22/results.json'
    source.write_bytes(source.read_bytes() + b' ')
    result = subprocess.run(command, capture_output=True)
    assert result.returncode != 0, 'Modified evidence must fail closed'
    assert b'Case input changed' in result.stderr
    assert expected == (page.read_bytes(), index.read_bytes()), 'No output should change on invalid evidence'
`;
  const result = spawnSync('python3', ['-c', code], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
});
