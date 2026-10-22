import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {filterPoints,filterVenuePoints,recordStats,csvForPoints,pageFromHash} from '../dist/data-utils.js';

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
  for(const hash of ['#definition','#definition-needs-heading','#t1-problems-heading'])assert.equal(pageFromHash(hash),'definition');
  for(const hash of ['#ideas','#t1-process-heading'])assert.equal(pageFromHash(hash),'plan');
  for(const hash of ['#analysis','#analysis-findings','#hotspot-candidates'])assert.equal(pageFromHash(hash),'analysis');
  for(const hash of ['#plan'])assert.equal(pageFromHash(hash),'plan');
  for(const hash of ['#design','#t1-specification','#t1-product-process-heading'])assert.equal(pageFromHash(hash),'design');
  for(const [owner,hashes] of Object.entries({
    'data-methods':['hotspot-heading','hotspot-quality','reader-method-scope','method-mrt-table','method-venue-street-update'],
    plan:['methods','methods-heading','field-priority','reader-field-forms','plan-check-Q01','plan-100day'],
    districts:['citywide-area-12','plan-area-13','reader-district-01'],
    evidence:['definition-evidence-E06-S2','definition-focus-P01','reader-definition-evidence-E01'],
    work:['work-current-questions','work-current-handoff'],
    spec:['definition-prd-current','definition-prd-current-needs','definition-prd-current-validation'],
    archive:['plan-budget','reader-archive-intro','hotspot-times','field-schedule','definition-scope-heading','definition-prd-risks-heading','definition-prd-heading','hotspot-government','work-WP01','reader-work-duties']
  }))for(const hash of hashes)assert.equal(pageFromHash('#'+hash),owner,hash);
  assert.equal(pageFromHash('#country-japan'),'countries');
});

test('the main landmark fragment keeps the active route',()=>{
  for(const page of ['map','comparison','history','siting','countries','design','definition','research','sources','materials','analysis','plan','districts','evidence','work','spec','archive']){
    assert.equal(pageFromHash('#main',page),page);
    assert.equal(pageFromHash('#unknown',page),'research');
  }
  assert.equal(pageFromHash('#main'),'research');
  assert.equal(pageFromHash('#main',null),'research');
});

test('hundred-day plan and its source links open the owning readable panel', () => {
  for(const hash of ['#plan','#plan-heading','#plan-validation','#plan-resources'])assert.equal(pageFromHash(hash),'plan');
  for(const hash of ['#plan-schedule','#plan-budget','#plan-responsibilities','#plan-acceptance'])assert.equal(pageFromHash(hash),'archive');
  for(const hash of ['#budget-heading','#implementation-heading'])assert.equal(pageFromHash(hash),'materials');
  assert.equal(pageFromHash('#main','plan'),'plan');
  assert.equal(pageFromHash('#planning'),'research');
  assert.equal(pageFromHash('#reference-L01'),'sources');
});


test('venue leads stay separate from street inventories and obey year, toggle and search scope',()=>{
  const before=JSON.stringify(catalog.datasets),state={year:'2026-main'};
  assert.equal(filterVenuePoints(catalog,state).length,130);
  const counts={'中正區':16,'大同區':14,'中山區':16,'松山區':7,'大安區':18,'萬華區':3,'信義區':18,'士林區':7,'北投區':10,'內湖區':7,'南港區':5,'文山區':9};
  for(const [district,count] of Object.entries(counts)){
    const points=filterVenuePoints(catalog,{...state,district});
    assert.equal(points.length,count,district);
    assert.ok(points.every(p=>p.district===district));
  }
  assert.equal(filterVenuePoints(catalog,{...state,district:'未收錄區'}).length,0);
  assert.equal(filterVenuePoints(catalog,{...state,district:'北投區',search:'新 北 投'}).length,1);
  assert.equal(filterVenuePoints(catalog,{...state,district:'南港區',search:'ＬＡＬＡＰＯＲＴ'}).length,1);
  assert.equal(filterVenuePoints(catalog,{...state,district:'大安區',search:'國父紀念館'}).length,1);
  assert.equal(filterVenuePoints(catalog,{...state,district:'信義區',search:'國父紀念館'}).length,2);
  assert.equal(filterVenuePoints(catalog,{...state,district:'大安區',search:'ＬＡＬＡＰＯＲＴ'}).length,0);
  assert.equal(filterVenuePoints(catalog,{...state,search:'未收錄的場域'}).length,0);
  assert.equal(filterVenuePoints(catalog,{...state,showVenues:false}).length,0);
  for(const d of catalog.datasets.filter(d=>d.key!=='2026-main'))assert.equal(filterVenuePoints(catalog,{year:d.key}).length,0);
  const current=catalog.datasets.find(d=>d.key==='2026-main');
  assert.equal(filterPoints(current,{district:'北投區'}).length,0);
  assert.equal(filterPoints(current,{district:'南港區'}).length,4);
  assert.equal(JSON.stringify(catalog.datasets),before);
  assert.ok(!csvForPoints(current.points,current).includes('venue-row-'));
});

test('public venue data covers twelve districts and preserves coarse coordinates and overlapping rows',()=>{
  const d=catalog.venueLeads;
  assert.equal(d.rows,130);assert.equal(new Set(d.points.map(p=>p.id)).size,130);
  assert.equal(new Set(d.points.map(p=>`${p.x},${p.y}`)).size,120);
  assert.deepEqual(d.districts,catalog.districtOrder);
  assert.deepEqual([...new Set(d.points.map(p=>p.district))].sort(),[...catalog.districtOrder].sort());
  assert.equal(d.sourceSha256,'47b1ddfb4f0ab4d5e57afab538f71da3d41d22e59c984bdd9c10b4248223b066');
  assert.equal(d.sourceUpdatedAt,'2026-08-18 16:27:22');
  assert.ok(d.points.every(p=>p.plottable));
  const coarse=d.points.find(p=>p.address==='南港LALAPORT');
  assert.equal(coarse.rawX,'121.6');assert.equal(coarse.x,121.6);
  assert.equal(coarse.rawY,'25.05');assert.equal(coarse.y,25.05);
  assert.match(coarse.quality,/約略位置.*不是.*桶位或入口/);
  assert.match(d.availabilityNote,/開放時間.*接收規則.*待確認/);
  assert.match(d.note,/保留重複名稱及座標.*不代表.*不同場所/);
  // Preserve reported facility counts as source text, never as point multiplicity.
  assert.equal(d.points.find(p=>p.address==='北投捷運站').sourceRemark,'10處');
  assert.equal(coarse.sourceRemark,'18處');
  assert.equal(d.points.filter(p=>p.district==='北投區').length,10);
  assert.equal(d.points.filter(p=>p.district==='南港區').length,5);
  assert.ok(d.points.every(p=>typeof p.sourceRemark==='string'));
});


test('retained research fragments open their materials while summary and definition remain current',()=>{
  for(const hash of ['#research-synthesis','#conclusion-siting','#conclusion-collection','#conclusion-household','#current-evidence-heading','#problem-map-heading','#district-service-heading','#district-service-note','#service-method','#service-continuity-heading','#service-prototype','#service-scenarios','#service-measures','#disposal-continuity','#dc-scenario'])assert.equal(pageFromHash(hash),'materials',hash);
  for(const hash of ['#research-overview-conclusions','#research-overview-reading'])assert.equal(pageFromHash(hash),'research',hash);
  assert.equal(pageFromHash('#research-overview-evidence'),'evidence');
  assert.equal(pageFromHash('#research-overview-scope'),'archive');
  assert.equal(pageFromHash('#research-overview-unknowns'),'archive');
  assert.equal(pageFromHash('#definition-evidence-heading'),'plan');
});


test('each detail page belongs to one project workspace', async()=>{
 const {workspacePages,workspaceForPage,allowedPages}=await import('../dist/data-utils.js');
 const pages=Object.values(workspacePages).flat();assert.equal(pages.length,new Set(pages).size);
 assert.deepEqual([...pages].sort(),[...allowedPages].sort());
 for(const [page,owner] of [['districts','analysis'],['evidence','personas'],['work','plan'],['team','plan'],['data-methods','analysis'],['spec','plan'],['design','library'],['siting','library'],['definition','library'],['countries','library'],['archive','library'],['map','library']])assert.equal(workspaceForPage(page),owner,page);
 for(const fragment of ['definition-prd-roles','definition-prd-roles-heading','reader-definition-prd-next','definition-prd-next'])assert.equal(pageFromHash('#'+fragment),'team');
 assert.equal(pageFromHash('#definition-prd-validation'),'archive');
 for(const fragment of ['field-schedule','field-capacity','field-record','reader-field-schedule','reader-work-observation','hotspot-times','reader-field-priority'])assert.equal(pageFromHash('#'+fragment),'archive',fragment);
 for(const fragment of ['t1-thinking-heading','definition-cycle-heading','ideas-conclusion','ideas-details','ideas-pending','ideas-next'])assert.equal(pageFromHash('#'+fragment),'plan',fragment);
 for(const fragment of ['plan-conclusion','plan-details','plan-pending','plan-next'])assert.equal(pageFromHash('#'+fragment),'plan',fragment);
 assert.equal(pageFromHash('#plan-districts'),'analysis');
});


test('local navigation separates personal evidence, distribution and field preparation',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  for(const [label,expected,count] of [
    ['理解問題',['personas','problem','feedback','evidence'],4],
    ['資料分析',['analysis','districts','data-methods'],3],
    ['現勘準備',[],0],
    ['百日計畫',['plan','spec','work','team'],4],
    ['方案與需求',[],0],
  ]){
    const navs=[...html.matchAll(new RegExp('<nav class="project-subnav" aria-label="'+label+'內頁">(.*?)</nav>','g'))];
    assert.equal(navs.length,count,label);
    for(const [,nav] of navs)assert.deepEqual([...nav.matchAll(/data-page="([^"]+)"/g)].map(m=>m[1]),expected);
  }
});
