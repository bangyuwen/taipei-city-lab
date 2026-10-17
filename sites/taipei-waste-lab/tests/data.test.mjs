import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {filterPoints,recordStats,csvForPoints,pageFromHash} from '../dist/data-utils.js';

const catalog=JSON.parse(await readFile(new URL('../dist/data/datasets.json',import.meta.url)));

test('all snapshots preserve source rows and match their downloadable CSV hashes',async()=>{
  assert.deepEqual(catalog.datasets.map(d=>d.rows),[2517,1799,1971,1000,681,294]);
  assert.deepEqual(catalog.datasets.filter(d=>d.preferred).map(d=>d.key),['2015','2022','2024-archive','2026-main']);
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
test('new main versions retain uncertainty and keep prior deep-link versions separate',()=>{
  const archive=catalog.datasets.find(d=>d.key==='2024-archive');
  const current=catalog.datasets.find(d=>d.key==='2026-main');
  assert.equal(archive.complete,null);assert.equal(current.complete,null);
  assert.equal(archive.completeDownload,true);assert.equal(current.completeDownload,true);
  assert.equal(archive.plottableRows,1969);assert.equal(current.plottableRows,680);
  assert.match(archive.dateLabel,/2024-10-19.*台北時間.*UTC 10-18/);
  assert.match(archive.note,/991 筆仍未找回/);
  assert.match(current.dateLabel,/2026-09-30.*2026-10-15/);
  assert.match(current.note,/2,009/);
  assert.equal(filterPoints(current,{district:'北投區'}).length,0);
  assert.equal(catalog.datasets.find(d=>d.key==='2026').rows,294);
  assert.equal(catalog.datasets.find(d=>d.key==='2024').rows,1000);
});
test('filtered exports carry version context and preserve unparseable source coordinates',()=>{
  for(const key of ['2024-archive','2026-main']){
    const d=catalog.datasets.find(d=>d.key===key);
    const points=d.points.filter(p=>p.rawX.startsWith('?'));
    assert.equal(points.length,1);assert.equal(points[0].plottable,false);
    const csv=csvForPoints(points,d);
    assert.match(csv,/資料版本.*資料日期.*完整性限制/);
    assert.ok(csv.includes(d.label));assert.ok(csv.includes(d.dateLabel));
    assert.ok(csv.includes(d.note));assert.match(csv,/\?121\.595369/);
    assert.match(csv,/24\.968972/);
  }
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
  assert.equal(pageFromHash('#sources'),'sources');assert.equal(pageFromHash('#unknown'),'research');
});

test('history deep links and the independent country page remain addressable',()=>{
  for(const page of ['map','comparison','history','siting','countries'])assert.equal(pageFromHash('#'+page),page);
  assert.equal(pageFromHash('#unknown'),'research');
});

test('reader entry and evidence links resolve to their owning pages',()=>{
  for(const hash of ['', '#', '#research', '#unknown'])assert.equal(pageFromHash(hash),'research');
  for(const hash of ['#reference-L01','#reference-L13','#reference-P04','#research-literature-heading','#source-comparison-method','#research-audit-heading','#research-papers-heading'])assert.equal(pageFromHash(hash),'sources');
  for(const hash of ['#materials','#research-materials-heading','#research-candidates-heading'])assert.equal(pageFromHash(hash),'materials');
  assert.equal(pageFromHash('#t1-process-heading'),'design');
  assert.equal(pageFromHash('#country-japan'),'countries');
});

test('the main landmark fragment keeps the active route',()=>{
  for(const page of ['map','comparison','history','siting','countries','design','research','sources','materials']){
    assert.equal(pageFromHash('#main',page),page);
    assert.equal(pageFromHash('#unknown',page),'research');
  }
  assert.equal(pageFromHash('#main'),'research');
  assert.equal(pageFromHash('#main',null),'research');
});

test('hundred-day plan and its source links open the owning readable panel', () => {
  for(const hash of ['#plan','#plan-heading','#plan-schedule','#plan-budget','#plan-responsibilities','#plan-acceptance'])assert.equal(pageFromHash(hash),'plan');
  for(const hash of ['#budget-heading','#implementation-heading'])assert.equal(pageFromHash(hash),'materials');
  assert.equal(pageFromHash('#main','plan'),'plan');
  assert.equal(pageFromHash('#planning'),'research');
  assert.equal(pageFromHash('#reference-L01'),'sources');
});
