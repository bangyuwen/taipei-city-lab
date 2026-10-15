import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {modules} from '../sites/taipei-city-lab/dist/registry.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const legacy=read('sites/taipei-city-lab/dist/data/snapshot.json');
const ids=['shade','bins','rat','traffic','bus','buildings','audit'];
const work=fs.mkdtempSync(path.join(os.tmpdir(),'taipei-topic-data-test-'));
after(()=>fs.rmSync(work,{recursive:true,force:true}));

// Import the same standard-library builder used by source refresh and the
// standalone-site generator, rather than reimplementing its assembly in JS.
const build=spawnSync('python',['-c',`
import importlib.util,json,sys
from pathlib import Path
root,out=map(Path,sys.argv[1:])
spec=importlib.util.spec_from_file_location('topic_data',root/'scripts/build-topic-data.py')
builder=importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
builder.build_deployment_data(root,out/'aggregate')
for topic in builder.TOPIC_IDS:
    builder.write_json(out/f'{topic}.json',builder.per_topic_snapshot(topic,root))
try:
    builder.per_topic_snapshot('unknown-topic',root)
except ValueError:
    pass
else:
    raise AssertionError('unknown topic must not fall back to another site')
`,root,work],{encoding:'utf8'});
assert.equal(build.status,0,build.stderr);
const topicData=Object.fromEntries(ids.map(id=>[id,JSON.parse(fs.readFileSync(path.join(work,id+'.json'),'utf8'))]));

test('canonical sources have one owner and audit references every original source exactly once',()=>{
  const owners=[read('shared/data/sources.json'),...ids.filter(id=>id!=='audit').map(id=>read(`topics/${id}/data/sources.json`))];
  const owned=owners.flatMap(source=>Object.keys(source));
  assert.equal(new Set(owned).size,owned.length,'canonical sources are not duplicated across owners');
  assert.deepEqual([...owned].sort(),Object.keys(legacy.sources).sort());
  const catalog=read('topics/audit/data/catalog.json');
  assert.deepEqual(catalog.sourceIds,Object.keys(legacy.sources));
  assert.equal(catalog.observationStatus,'user-input-only');
  for(const source of owners)for(const [key,value] of Object.entries(source))assert.deepEqual(value,legacy.sources[key]);
});

test('canonical observations and quality preserve every reviewed value and source boundary',()=>{
  assert.equal(legacy.trees.length,39451);
  assert.equal(legacy.bins.length,294);
  assert.deepEqual(read('topics/shade/data/observations.json'),{trees:legacy.trees});
  assert.deepEqual(read('topics/bins/data/observations.json'),{bins:legacy.bins});
  assert.deepEqual(read('topics/shade/data/quality.json'),{trees:legacy.quality.trees});
  assert.deepEqual(read('topics/bins/data/quality.json'),{bins:legacy.quality.bins});
  assert.deepEqual(read('shared/data/snapshot-meta.json'),legacy.meta);
  assert.equal(legacy.quality.trees.duplicateCoordinateCount,3);
  assert.equal(legacy.quality.trees.outlierCounts.surveyDate1900,1);
  assert.equal(legacy.quality.bins.catalogCountMismatch,true);
});

test('offline assembly reproduces both legacy deployment files byte for byte without refreshing dates',()=>{
  for(const filename of ['snapshot.json','source-catalog.json']){
    assert.deepEqual(fs.readFileSync(path.join(work,'aggregate',filename)),fs.readFileSync(path.join(root,'sites/taipei-city-lab/dist/data',filename)));
  }
  const checked=spawnSync('python',['scripts/build-topic-data.py','--check'],{cwd:root,encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);
  assert.match(checked.stdout,/"status": "checked"/);
});

test('check mode detects deployment drift and leaves the modified deployment untouched',()=>{
  const filename=path.join(work,'aggregate/snapshot.json');
  const changed=fs.readFileSync(filename,'utf8')+'\n';
  fs.writeFileSync(filename,changed);
  const checked=spawnSync('python',['scripts/build-topic-data.py','--check','--output-dir',path.join(work,'aggregate')],{cwd:root,encoding:'utf8'});
  assert.notEqual(checked.status,0);
  assert.match(checked.stderr,/differs from canonical/);
  assert.equal(fs.readFileSync(filename,'utf8'),changed,'check mode is read-only');
});

test('standalone topic inputs contain only their own reviewed observation arrays',()=>{
  for(const id of ids){
    const data=topicData[id];
    assert.equal(data.meta.topicId,id);
    assert.equal(data.meta.retrievedAt,legacy.meta.retrievedAt);
    assert.equal(data.meta.builtAt,legacy.meta.builtAt);
    assert.equal(Object.hasOwn(data,'trees'),id==='shade',id);
    assert.equal(Object.hasOwn(data,'bins'),id==='bins',id);
    assert.equal(Object.hasOwn(data,'quality'),id==='shade'||id==='bins',id);
    for(const key of Object.keys(data.sources))assert.deepEqual(data.sources[key],legacy.sources[key]);
    if(!['shade','bins'].includes(id)){
      assert.equal(Object.values(data).some(Array.isArray),false,'do not manufacture zero-row observation tables');
      assert.equal(data.meta.observationStatus,id==='audit'?'catalog-only':'not-loaded');
    }
  }
  assert.deepEqual(topicData.shade.trees,legacy.trees);
  assert.deepEqual(topicData.bins.bins,legacy.bins);
  assert.equal(Object.keys(topicData.audit.sources).length,13);
});

test('each standalone input resolves every model source reference without borrowing other observations',()=>{
  for(const module of modules){
    const data=topicData[module.id];
    const variants=module.id==='audit'?['shade','bins','rat','traffic','bus','buildings'].map(question=>({question})):[module.defaults];
    for(const params of variants){
      const result=module.evaluate(params,data);
      assert.ok(result.sources.length,module.id);
      for(const key of result.sources)assert.ok(data.sources[key],`${module.id} requires source ${key}`);
      for(const metric of result.metrics)if(typeof metric.value==='number')assert.ok(Number.isFinite(metric.value));
      if(module.id==='audit')for(const row of result.table.rows)assert.equal(row.records,'未載入原始資料');
    }
  }
});

test('missing raw cache fails without replacing canonical data or pretending a source refresh succeeded',()=>{
  const before=fs.readFileSync(path.join(root,'shared/data/snapshot-meta.json'));
  const missing=spawnSync('python',['scripts/prepare-data.py','--offline','--cache-dir',path.join(work,'missing-raw-cache')],{cwd:root,encoding:'utf8'});
  assert.notEqual(missing.status,0);
  assert.match(missing.stderr,/Offline cache missing/);
  assert.deepEqual(fs.readFileSync(path.join(root,'shared/data/snapshot-meta.json')),before);
});
