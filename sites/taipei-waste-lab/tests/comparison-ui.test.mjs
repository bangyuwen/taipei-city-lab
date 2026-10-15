import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {categories,filterComparison,comparisonCounts,getComparisonScope,summarizeCoordinateDistances,comparisonCSV,districtCSV,mapURL,formatCoordinateDistance,sortByCoordinateDistance} from '../dist/comparison-utils.js';
import {pageFromHash} from '../dist/data-utils.js';

const record={id:'2024-archive-row-1',sourceRow:2,district:'中正區',address:'臺北路 1 號',rawX:'?121.595369',rawY:'24.968972',quality:'座標待核對'};
const entries=[{id:'a',category:'not_reappeared',district:record.district,address:record.address,before:[record,{...record,id:'2024-archive-row-2',sourceRow:3}],after:[]},
  {id:'b',category:'ambiguous',district:'中正區',address:'其他路',before:[],after:[{...record,id:'2026-main-row-1'}]}];
const meta={protocolVersion:'1.0.0',before:{key:'2024-archive',file:'archive.csv',sha256:'abc',date:'2024-10-19 封存；非調查日'},after:{key:'2026-main',file:'main.csv',sha256:'def',date:'2026-09-30 更新；2026-10-15 下載'}};

test('comparison filters do not discard unplottable or co-located source records',()=>{
  const selected=filterComparison(entries,{district:'中正區',search:'台北路1號'});
  assert.equal(selected.length,1);
  assert.deepEqual(comparisonCounts(selected),{groups:1,beforeRows:2,afterRows:0});
  assert.equal(filterComparison(entries,{category:'ambiguous'}).length,1);
  assert.equal(filterComparison(entries,{category:''}).length,2);
  assert.equal(filterComparison(entries,{district:'北投區'}).length,0);
});
test('comparison scope keeps group counts independent of category and preserves every source row',()=>{
  const all=getComparisonScope(entries);
  assert.deepEqual(all.entries,entries);
  assert.deepEqual(all.counts,{groups:2,beforeRows:2,afterRows:1});
  assert.deepEqual(all.categoryCounts,{not_reappeared:1,only_2026:0,same_address_changed:0,ambiguous:1,same_fields:0});
  assert.deepEqual(Object.keys(all.categoryCounts),Object.keys(categories));

  const scoped=getComparisonScope(entries,{district:'中正區',search:'台北路1號'});
  assert.deepEqual(scoped.entries,entries);
  assert.deepEqual(scoped.counts,{groups:2,beforeRows:2,afterRows:1});
  assert.equal(scoped.categoryCounts.not_reappeared,1);
  assert.equal(scoped.categoryCounts.ambiguous,1);

  assert.deepEqual(getComparisonScope(entries,{search:'其他路'}).entries,[entries[1]]);
  const empty=getComparisonScope(entries,{district:'北投區'});
  assert.deepEqual(empty.entries,[]);
  assert.deepEqual(empty.counts,{groups:0,beforeRows:0,afterRows:0});
  assert.deepEqual(empty.categoryCounts,Object.fromEntries(Object.keys(categories).map(category=>[category,0])));
});
test('scoped coordinate summaries preserve boundaries, unavailable values and unknown quality flags',()=>{
  const values=[0,0.999,1,9.999,10,49.999,50,99.999,100,499.999,500,null,undefined,NaN,Infinity,-1,'0'];
  const scopedEntries=values.map((_,index)=>({id:'pair-'+index,category:'same_address_changed'}));
  scopedEntries.push({id:'missing-pair',category:'same_address_changed'});
  const pairs=values.map((value,index)=>{
    const pair={
      comparisonId:'pair-'+index,
      before:{plottable:index===1?false:true},
      after:index===2?{}:{plottable:true}
    };
    if(value!==undefined)pair.distanceMeters=value;
    return pair;
  });
  const originalEntries=structuredClone(scopedEntries);
  const originalPairs=structuredClone(pairs);

  const summary=summarizeCoordinateDistances(scopedEntries,pairs);
  assert.deepEqual(summary,{
    pairCount:18,calculatedPairs:11,unavailablePairs:7,coarseFlaggedPairs:3,
    minMeters:0,medianMeters:49.999,maxMeters:500,
    buckets:[
      {key:'lt1',label:'小於 1 公尺',count:2},
      {key:'1to10',label:'1 至未滿 10 公尺',count:2},
      {key:'10to50',label:'10 至未滿 50 公尺',count:2},
      {key:'50to100',label:'50 至未滿 100 公尺',count:2},
      {key:'100to500',label:'100 至未滿 500 公尺',count:2},
      {key:'ge500',label:'500 公尺以上',count:1}
    ]
  });
  assert.deepEqual(scopedEntries,originalEntries);
  assert.deepEqual(pairs,originalPairs);

  const empty=summarizeCoordinateDistances([],pairs);
  assert.equal(empty.pairCount,0);
  assert.equal(empty.calculatedPairs,0);
  assert.equal(empty.unavailablePairs,0);
  assert.equal(empty.coarseFlaggedPairs,0);
  assert.equal(empty.minMeters,null);
  assert.equal(empty.medianMeters,null);
  assert.equal(empty.maxMeters,null);
  assert.ok(empty.buckets.every(bucket=>bucket.count===0));
});
test('scoped coordinate summaries match the saved whole-scope and district analysis',async()=>{
  const comparison=JSON.parse(await readFile(new URL('../dist/data/comparison-2024-2026.json',import.meta.url)));
  const analysis=JSON.parse(await readFile(new URL('../dist/data/comparison-coordinate-distances.json',import.meta.url)));
  const wholeScope=getComparisonScope(comparison.entries);
  assert.deepEqual(summarizeCoordinateDistances(wholeScope.entries,analysis.pairs),analysis.summary);

  const districtScope=getComparisonScope(comparison.entries,{district:'中正區'});
  const {district,...districtSummary}=analysis.districts.find(item=>item.district==='中正區');
  assert.equal(district,'中正區');
  assert.deepEqual(summarizeCoordinateDistances(districtScope.entries,analysis.pairs),districtSummary);
});
test('comparison export retains every raw source row, dates, lineage and cautious classification',()=>{
  const csv=comparisonCSV(entries,meta);
  assert.ok(csv.startsWith('\uFEFF'));
  for(const text of ['?121.595369','2024-archive-row-1','2024-archive-row-2','2026-main-row-1','原檔實體起始行','非官方箱號','2024 地址未再出現','同址多筆，未能配對',meta.before.date,meta.after.date,'不代表撤除或新設'])assert.ok(csv.includes(text),text);
  const dangerous={...record,address:' \t=HYPERLINK("https://example.invalid")\n測試'};
  const escaped=comparisonCSV([{...entries[0],address:dangerous.address,before:[dangerous]}],meta);
  assert.ok(escaped.includes('"\' \t=HYPERLINK(""https://example.invalid"")\n測試"'));
});
test('map links retain exact source version and encode source text without injecting navigation',()=>{
  const url=new URL(mapURL({...record,address:'測試路&year=2015#<字>'},'2024-archive'),'https://example.invalid/');
  assert.equal(url.searchParams.get('year'),'2024-archive');
  assert.equal(url.searchParams.get('q'),'測試路&year=2015#<字>');
  assert.equal(url.hash,'#map');assert.equal(pageFromHash('#comparison'),'comparison');
});
test('district download distinguishes addresses from rows and supplies both snapshot dates',()=>{
  const csv=districtCSV([{district:'北投區',beforeRows:100,afterRows:0,deltaRows:-100,exactPairs:0,sameAddressPairs:0,ambiguousBeforeRows:0,ambiguousAfterRows:0,notReappearedRows:100,notReappearedAddresses:98,only2026Rows:0,only2026Addresses:0}],meta);
  assert.ok(csv.includes('非撤除數'));assert.ok(csv.includes('地址數'));
  assert.ok(csv.includes('"100","98"'));assert.ok(csv.includes(meta.after.date));
});
test('production comparison preserves every map source record and conserves all district rows',async()=>{
  const comparison=JSON.parse(await readFile(new URL('../dist/data/comparison-2024-2026.json',import.meta.url)));
  const catalog=JSON.parse(await readFile(new URL('../dist/data/datasets.json',import.meta.url)));
  for(const side of ['before','after']){
    const records=comparison.entries.flatMap(e=>e[side]);
    const byID=new Map(records.map(r=>[r.id,r]));
    assert.equal(byID.size,records.length,'no repeated source IDs');
    const snapshot=catalog.datasets.find(d=>d.key===comparison.meta[side].key);
    assert.equal(records.length,snapshot.rows);
    assert.equal(comparison.meta[side].sha256,snapshot.sha256);
    for(const point of snapshot.points){
      const row=byID.get(point.id);
      assert.deepEqual(Object.fromEntries(Object.keys(point).map(k=>[k,row[k]])),point);
    }
  }
  assert.equal(comparison.districts.length,12);
  for(const d of [comparison.totals,...comparison.districts]){
    assert.equal(d.beforeRows,d.exactPairs+d.sameAddressPairs+d.ambiguousBeforeRows+d.notReappearedRows);
    assert.equal(d.afterRows,d.exactPairs+d.sameAddressPairs+d.ambiguousAfterRows+d.only2026Rows);
    assert.equal(d.deltaRows,d.afterRows-d.beforeRows);
  }
});
test('distance display preserves sub-decimeter differences and does not substitute zero for unavailable values',()=>{
  assert.equal(formatCoordinateDistance(0.00001),'<0.1 公尺');
  assert.equal(formatCoordinateDistance(0.1),'0.1 公尺');
  assert.equal(formatCoordinateDistance(1000.04),'1,000.0 公尺');
  for(const value of [null,NaN,Infinity,-1,'2'])assert.equal(formatCoordinateDistance(value),'無法計算');
});
test('distance sorting uses unrounded values, retains unavailable pairs and does not mutate source order',()=>{
  const original=['b','a','c','d'].map(id=>({id}));
  const pairs=[{comparisonId:'a',distanceMeters:10.01},{comparisonId:'b',distanceMeters:10.04},{comparisonId:'c',distanceMeters:null},{comparisonId:'d',distanceMeters:10.04}];
  assert.deepEqual(sortByCoordinateDistance(original,pairs).map(e=>e.id),['b','d','a','c']);
  assert.deepEqual(original.map(e=>e.id),['b','a','c','d']);
});
test('filtered source-row export attaches numeric pair distance and explicit non-relocation limits',()=>{
  const analysis={meta:{analysisVersion:'1.0.0',method:{name:'Haversine',radiusMeters:6371000}},pairs:[{comparisonId:'a',distanceMeters:0.0001,rank:75,qualityNote:'仍待核對'}]};
  const text=comparisonCSV(entries,meta,analysis);
  assert.ok(text.includes('非遷移距離'));assert.ok(text.includes('"0.0001","75","仍待核對","Haversine","6371000"'));
  assert.ok(text.includes('座標差距不代表遷移'));
  const unavailable=comparisonCSV(entries,meta,{...analysis,pairs:[{...analysis.pairs[0],distanceMeters:null,rank:null}]});
  assert.ok(unavailable.includes('"","","仍待核對","Haversine"'));
  assert.ok(!comparisonCSV(entries,meta).includes('全 75 對距離排序'));
});
test('production distance records preserve the original 75 pairs, lineage, unrounded order and count totals',async()=>{
  const comparison=JSON.parse(await readFile(new URL('../dist/data/comparison-2024-2026.json',import.meta.url)));
  const analysis=JSON.parse(await readFile(new URL('../dist/data/comparison-coordinate-distances.json',import.meta.url)));
  const selected=new Map(comparison.entries.filter(e=>e.category==='same_address_changed').map(e=>[e.id,e]));
  assert.equal(selected.size,75);assert.equal(analysis.pairs.length,75);
  assert.equal(new Set(analysis.pairs.map(p=>p.comparisonId)).size,75);
  for(const pair of analysis.pairs){
    const original=selected.get(pair.comparisonId);
    assert.deepEqual(pair.before,original.before[0]);assert.deepEqual(pair.after,original.after[0]);
    assert.equal(pair.address,original.address);assert.equal(pair.district,original.district);
  }
  const measured=analysis.pairs.filter(p=>p.distanceMeters!==null);
  for(let i=0;i<measured.length;i++){
    assert.equal(measured[i].rank,i+1);
    assert.ok(Number.isFinite(measured[i].distanceMeters)&&measured[i].distanceMeters>=0);
    if(i)assert.ok(measured[i-1].distanceMeters>=measured[i].distanceMeters);
  }
  assert.equal(analysis.summary.calculatedPairs+analysis.summary.unavailablePairs,75);
  assert.equal(analysis.summary.buckets.reduce((sum,b)=>sum+b.count,0),measured.length);
  assert.equal(analysis.districts.reduce((sum,d)=>sum+d.pairCount,0),75);
  assert.equal(analysis.districts.length,12);
});

test('distance sorting preserves raw-value rank when serialized distances tie',()=>{
  const entries=['a','b','c'].map(id=>({id}));
  const pairs=[{comparisonId:'a',distanceMeters:1,rank:2},{comparisonId:'b',distanceMeters:1,rank:1},{comparisonId:'c',distanceMeters:null,rank:null}];
  assert.deepEqual(sortByCoordinateDistance(entries,pairs).map(e=>e.id),['b','a','c']);
});
