import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {filterPoints,recordStats,csvForPoints,pageFromHash} from '../dist/data-utils.js';

const catalog=JSON.parse(await readFile(new URL('../dist/data/datasets.json',import.meta.url)));

test('all snapshots preserve source rows and match their downloadable CSV hashes',async()=>{
  assert.deepEqual(catalog.datasets.map(d=>d.rows),[2517,1799,1000,294]);
  for(const d of catalog.datasets){
    assert.equal(d.points.length,d.rows);
    assert.equal(Object.values(d.districts).reduce((a,b)=>a+b,0),d.rows);
    assert.equal(recordStats(d.points).mapRows,d.plottableRows);
    const bytes=await readFile(new URL('../dist/data/'+d.file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),d.sha256);
  }
});
test('questionable coordinates remain available while map records exclude them',()=>{
  const d=catalog.datasets[0];
  assert.equal(d.points.filter(p=>!p.plottable).length,12);
  assert.equal(d.distinctCoordinates,2276);
  const p=filterPoints(d,{search:'武昌街4號'});
  assert.equal(p.length,1);
  assert.equal(p[0].plottable,false);
  assert.match(csvForPoints(p),/121\.0508453/);
});
test('partial 2024 data stays partial when an absent district is selected',()=>{
  const d=catalog.datasets.find(d=>d.key==='2024');
  assert.equal(d.complete,false);assert.equal(d.reportedTotal,1991);
  assert.equal(filterPoints(d,{district:'信義區'}).length,0);
  assert.equal(recordStats(d.points).coordinates,995);
});
test('search accepts spacing and preserves repeated coordinate records',()=>{
  const d=catalog.datasets[0];
  const first=filterPoints(d,{search:'中山北路'}),second=filterPoints(d,{search:'中山 北路'});
  assert.deepEqual(second,first);
  assert.ok(first.length>0);
  assert.equal(filterPoints(d,{district:'中正區'}).length,369);
});
test('export safely quotes text and labels row IDs as local identifiers',()=>{
  const csv=csvForPoints([{id:'row-1',district:'中正區',address:'=1+1,"測試"',x:121.5,y:25.05,quality:'待核對'}]);
  assert.match(csv,/非官方箱號/);assert.match(csv,/"'=1\+1,""測試"""/);
  assert.equal(pageFromHash('#sources'),'sources');assert.equal(pageFromHash('#unknown'),'map');
});
