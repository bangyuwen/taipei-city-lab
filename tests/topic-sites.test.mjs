import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// These are the product boundaries, deliberately independent of the generator.
const sites = [
  {id:'shade', directory:'taipei-shade-lab', title:'樹蔭公平', sources:['trees','sidewalks','puma'], observed:'trees'},
  {id:'rat', directory:'taipei-rat-lab', title:'鼠患源頭治理', sources:['complaints','rat','puma']},
  {id:'traffic', directory:'taipei-traffic-lab', title:'內湖錯峰通勤', sources:['vd','metro','puma']},
  {id:'bus', directory:'taipei-bus-lab', title:'公車接駁與休息', sources:['bus','metro','puma']},
  {id:'buildings', directory:'taipei-building-lab', title:'社區健檢排序', sources:['buildings','soil','fire','population','puma']},
  {id:'audit', directory:'taipei-data-lab', title:'市政資料健檢', sources:['trees','rat','puma','bins','sidewalks','complaints','metro','vd','bus','buildings','population','soil','fire']},
];
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const sorted = values => [...values].sort();
const metric = (result, label) => result.metrics.find(item => item.label === label)?.value;

function finite(value, label = 'result') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${label} must be finite`);
  else if (Array.isArray(value)) value.forEach((item, index) => finite(item, `${label}[${index}]`));
  else if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value)) finite(item, `${label}.${key}`);
}

function verifyResult(result, snapshot, label) {
  finite(result, label);
  assert.ok(result.metrics.length && result.table.columns.length, `${label}: results are usable`);
  assert.ok(result.explanation && result.assumptions.length, `${label}: disclose method and assumptions`);
  for (const item of result.metrics) assert.equal(typeof item.value, 'number', `${label}: numeric metric`);
  for (const source of result.sources) assert.ok(snapshot.sources[source], `${label}: missing source ${source}`);
  for (const row of result.table.rows)
    for (const column of result.table.columns) assert.ok(Object.hasOwn(row, column.key), `${label}: missing table cell ${column.key}`);
  for (const chart of [result.chart, result.secondaryChart].filter(Boolean))
    for (const series of chart.series) assert.equal(series.values.length, chart.labels.length, `${label}: chart dimensions`);
}

function files(directory) {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

function localTarget(dist, owner, reference) {
  if (!reference || reference.startsWith('#') || /^(?:data:|https?:|mailto:|tel:)/i.test(reference)) return;
  assert.ok(!reference.startsWith('/') && !reference.startsWith('//'), `${owner}: root-relative asset ${reference}`);
  const target = path.resolve(path.dirname(owner), decodeURIComponent(reference.split(/[?#]/)[0]));
  assert.ok(target.startsWith(dist + path.sep), `${owner}: asset escapes standalone dist: ${reference}`);
  assert.ok(fs.statSync(target, {throwIfNoEntry:false})?.isFile(), `${owner}: missing asset ${reference}`);
  assert.ok(fs.realpathSync(target).startsWith(fs.realpathSync(dist) + path.sep), `${owner}: asset symlink escapes dist`);
}

for (const site of sites) {
  const dist = path.join(root, 'sites', site.directory, 'dist');
  test(`${site.directory}: standalone registry, observations and sources stay within the topic`, async () => {
    const registry = await import(pathToFileURL(path.join(dist, 'registry.js')));
    assert.deepEqual(registry.modules.map(module => module.id), [site.id]);
    assert.deepEqual(registry.topics, [site.title]);
    assert.equal(registry.tones.length, 1);
    const canonicalModule = await import(pathToFileURL(path.join(root, 'topics', site.id, 'model.js')));
    assert.equal(registry.modules[0].title, canonicalModule[site.id].title);
    const snapshot = json(path.join(dist, 'data/snapshot.json'));
    const catalogue = json(path.join(root, 'dist/data/source-catalog.json'));
    assert.equal(snapshot.meta.topicId, site.id);
    assert.deepEqual(sorted(Object.keys(snapshot.sources)), sorted(site.sources));
    for (const source of site.sources) assert.deepEqual(snapshot.sources[source], catalogue.sources[source], `preserve source ${source}`);
    for (const field of ['retrievedAt','builtAt','buildStatus','bbox','coordinateSystem'])
      assert.deepEqual(snapshot.meta[field], catalogue.meta[field], `preserve original metadata ${field}`);
    assert.deepEqual(sorted(Object.keys(snapshot)), sorted(['meta','sources', ...(site.observed ? [site.observed,'quality'] : [])]));
    if (site.observed) {
      const canonical = json(path.join(root, 'topics', site.id, 'data/observations.json'));
      assert.deepEqual(snapshot[site.observed], canonical[site.observed], 'preserve every reviewed observation');
      assert.deepEqual(Object.keys(snapshot.quality), [site.observed]);
      assert.equal(snapshot.sources[site.observed].counts.filteredCount, snapshot[site.observed].length);
      assert.equal(snapshot.meta.observationStatus, 'loaded');
      assert.ok(snapshot[site.observed].length > 0);
    } else assert.equal(snapshot.meta.observationStatus, site.id === 'audit' ? 'catalog-only' : 'not-loaded');
    for (const [id, source] of Object.entries(snapshot.sources)) {
      assert.equal(new URL(source.url).protocol, 'https:', id);
      assert.ok(source.grain && source.limitations, `${id}: retain limitations`);
    }
  });

  test(`${site.directory}: shipped model evaluates defaults and boundary controls without importing other observations`, async () => {
    const {modules:[module]} = await import(pathToFileURL(path.join(dist, 'registry.js')));
    const canonical = await import(pathToFileURL(path.join(root, 'topics', site.id, 'model.js')));
    const snapshot = json(path.join(dist, 'data/snapshot.json'));
    const original = JSON.stringify(snapshot);
    const defaults = JSON.stringify(module.defaults);
    const expected = module.evaluate(module.defaults, snapshot);
    verifyResult(expected, snapshot, site.id);
    assert.deepEqual(expected, canonical[site.id].evaluate(module.defaults, snapshot), 'deployment preserves canonical model behavior');
    assert.deepEqual(module.evaluate(module.defaults, snapshot), expected, 'deterministic default');
    for (const boundary of ['min','max']) {
      const params = Object.fromEntries(module.controls.map(control => [control.key, control.type === 'range'
        ? control[boundary] : control.options[boundary === 'min' ? 0 : control.options.length - 1].value]));
      verifyResult(module.evaluate(params, snapshot), snapshot, `${site.id}/${boundary}`);
    }
    const invalid = Object.fromEntries(module.controls.map(control => [control.key, control.type === 'range' ? Infinity : '__invalid__']));
    verifyResult(module.evaluate(invalid, snapshot), snapshot, `${site.id}/invalid`);
    verifyResult(module.evaluate(null, null), snapshot, `${site.id}/missing-input`);
    assert.equal(JSON.stringify(snapshot), original, 'evaluation must not mutate source observations');
    assert.equal(JSON.stringify(module.defaults), defaults, 'evaluation must not mutate defaults');

    // Independently meaningful limiting cases, not snapshots of arbitrary output.
    if (site.id === 'shade') {
      const zero = module.evaluate({...module.defaults, budget:0}, snapshot);
      assert.equal(metric(zero, '建議新增假設樹點'), 0);
      assert.equal(metric(zero, '相對已知樹點基準增加'), 0);
      assert.equal(zero.table.rows.length, 0);
      assert.equal(metric(module.evaluate(module.defaults, {}), '快照內已知樹點'), 0, 'never fabricate missing observed trees');
    } else if (['rat','buildings'].includes(site.id)) {
      const zero = module.evaluate({...module.defaults, budget:0}, snapshot);
      assert.equal(zero.table.rows.filter(row => row.allocation === '已安排').length, 0);
      assert.ok(zero.assumptions.some(text => /模擬|合成|虛構/.test(text)), 'synthetic records remain disclosed');
    } else if (site.id === 'traffic') {
      const zero = module.evaluate({...module.defaults, shift:0}, snapshot);
      assert.equal(zero.model.scenarioWaitingArea, zero.model.baselineWaitingArea, 'moving no vehicles leaves queue unchanged');
      assert.equal(metric(zero, '等待變化（相對未錯峰）'), 0);
    } else if (site.id === 'bus') {
      const zero = module.evaluate({...module.defaults, demand:0}, snapshot);
      assert.ok(zero.table.rows.every(row => row.boarded === 0), 'zero demand cannot generate riders');
      for (const row of expected.table.rows) assert.ok(row.boarded >= 0, 'no negative passenger count');
    } else {
      for (const option of module.controls[0].options) {
        const result = module.evaluate({question:option.value}, snapshot);
        verifyResult(result, snapshot, `audit/${option.value}`);
        assert.ok(result.table.rows.every(row => row.records === '未載入原始資料'), 'catalogue entries cannot become observed rows');
      }
      const report = canonical.inspectCSV('id,updated_at\nA,2026-10-13\nA,2026-10-13', {referenceDate:'2026-10-13', timezone:'Asia/Taipei'});
      assert.equal(report.rowCount, 2);
      assert.equal(report.duplicateCount, 1);
    }
  });

  test(`${site.directory}: HTML, ESM dependencies and CSS assets resolve entirely within its deployment`, () => {
    const html = read(path.join(dist, 'index.html'));
    assert.match(html, /<html lang="zh-Hant">/);
    assert.match(html, /name="viewport"/);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'unique DOM targets');
    for (const id of ['controls','results','research-answer','all-export','export-csv','source-dialog']) assert.ok(ids.includes(id), id);
    const topicLinks = [...html.matchAll(/\bhref="#([^"?]+)(?:\?[^" ]*)?"/g)].map(match => match[1]);
    for (const other of ['shade','bins','rat','traffic','bus','buildings','audit'].filter(id => id !== site.id))
      assert.ok(!topicLinks.includes(other), `no navigation to another topic: ${other}`);
    assert.doesNotMatch(html, /七題|七個城市問題|source\.zip/);
    const storage = read(path.join(dist, 'app.js')).match(/const storageKey\s*=\s*(['"])([^'"]+)\1/);
    assert.equal(storage?.[2], site.directory + '-v1', 'separate browser storage namespace');
    for (const owner of files(dist)) {
      const extension = path.extname(owner);
      if (!['.js','.css','.html'].includes(extension)) continue;
      const text = read(owner);
      if (extension === '.html') for (const match of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) localTarget(dist, owner, match[1]);
      if (extension === '.css') for (const match of text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) localTarget(dist, owner, match[1]);
      if (extension === '.js') {
        // Vendored documentation includes npm import examples that are not
        // executable dependencies. The browser check additionally resolves the
        // actual module graph using Chromium's JavaScript parser.
        const code = text.replace(/\/\*[\s\S]*?\*\//g, '');
        const references = [
          ...code.matchAll(/\b(?:import|export)\s*(?:\{[^}]*\}|\*\s*(?:as\s+\w+)?|[A-Za-z_$][\w$]*(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+))?)\s*from\s*(['"])([^'"]+)\1/g),
          ...code.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g),
          ...code.matchAll(/\bimport\s*(['"])([^'"]+)\1/g),
        ];
        for (const match of references) {
          assert.ok(match[2].startsWith('./') || match[2].startsWith('../'), `${owner}: non-local ESM import ${match[2]}`);
          localTarget(dist, owner, match[2]);
        }
        for (const match of text.matchAll(/\bfetch\(\s*(['"])(\.\.?\/[^'"]+)\1/g)) localTarget(dist, owner, match[2]);
      }
    }
  });
}

test('audit catalogue distinguishes another topic’s loaded observations from locally available data in 3D', async () => {
  const dist = path.join(root, 'sites/taipei-data-lab/dist');
  const snapshot = json(path.join(dist, 'data/snapshot.json'));
  const {modules:[audit]} = await import(pathToFileURL(path.join(dist, 'registry.js')));
  const {sceneSpec} = await import(pathToFileURL(path.join(dist, 'scene-data.js')));
  assert.equal(snapshot.meta.observationStatus, 'catalog-only');
  assert.ok(!Object.hasOwn(snapshot, 'trees') && !Object.hasOwn(snapshot, 'bins'));
  const loaded = Object.entries(snapshot.sources).filter(([, source]) => source.integrationStatus === 'loaded');
  assert.deepEqual(sorted(loaded.map(([id]) => id)), ['bins','trees'], 'retain the original topics’ provenance');
  const result = audit.evaluate(audit.defaults, snapshot);
  const scene = sceneSpec({id:'audit', result, data:snapshot, params:audit.defaults});
  assert.equal(scene.profiled, false, 'no user CSV has been inspected');
  assert.equal(scene.columns.length, Object.keys(snapshot.sources).length);
  assert.ok(scene.columns.every(column => column.value === 0), 'catalogue metadata is not a local observation count');
  for (const [id] of loaded) {
    const column = scene.columns.find(item => item.id === id);
    assert.match(column.detail, /原題已載入觀測；本站僅保存目錄/);
    assert.doesNotMatch(column.detail, /已載入觀測快照/);
  }
  // A real CSV profile must still replace the catalogue with its measured gaps.
  const profiled = sceneSpec({id:'audit', result, data:snapshot, params:audit.defaults,
    report:{rowCount:2, profiles:[{name:'lat', missingRate:0.5, missingCount:1, type:'number'}]}});
  assert.equal(profiled.profiled, true);
  assert.equal(profiled.columns[0].value, 50);
});
