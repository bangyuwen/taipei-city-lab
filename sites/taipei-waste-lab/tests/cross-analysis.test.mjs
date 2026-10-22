import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {selectStations} from '../dist/cross-analysis.js';
const data=JSON.parse(await readFile(new URL('../dist/data/cross-analysis.json',import.meta.url)));
const catalog=JSON.parse(await readFile(new URL('../dist/data/datasets.json',import.meta.url)));

test('retained cross-analysis inputs match their provenance',async()=>{
  for(const input of data.meta.inputs){
    const bytes=await readFile(new URL('../'+input.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),input.sha256,input.path);
  }
});
test('unknown activity is excluded from priority; scope filters never change distances',()=>{
  const sample={meta:{highActivityThreshold:10},stations:[
    {id:'1',district:'北投區',name:'測試站',address:'路口',events:null,nearestBin:{distanceM:300},buses:[{}]},
    {id:'2',district:'中山區',name:'測試站',address:'路口',events:10,nearestBin:{distanceM:101},buses:[{}]},
    {id:'3',district:'中山區',name:'對照站',address:'路口',events:11,nearestBin:{distanceM:100},buses:[{}]},
    {id:'4',district:'中山區',name:'無公車',address:'路口',events:12,nearestBin:{distanceM:500},buses:[]}]};
  assert.deepEqual(selectStations(sample).map(p=>p.id),['2']);
  assert.equal(selectStations(sample,{radius:200}).length,0);
  assert.equal(selectStations(sample,{mode:'all'}).length,4);
  assert.equal(selectStations(sample,{district:'中山區',search:'測試'} )[0].nearestBin.distanceM,101);
});
test('real data keeps missing pedestrian/passenger counts, deduplicated buses and stable radius nesting',()=>{
  assert.equal(data.stations.length,1790);
  assert.ok(data.stations.every(p=>p.pedestrianCount===null&&p.busPassengerCount===null));
  const ids=new Set(data.buses.map(p=>p.id));assert.equal(ids.size,data.buses.length);
  for(const p of data.stations)for(const bus of p.buses){assert.ok(ids.has(bus.id));assert.ok(bus.distanceM<=300);}
  const a=new Set(selectStations(data,{radius:100}).map(p=>p.id));
  for(const p of selectStations(data,{radius:200}))assert.ok(a.has(p.id));
  const b=new Set(selectStations(data,{radius:200}).map(p=>p.id));
  for(const p of selectStations(data,{radius:300}))assert.ok(b.has(p.id));
});
test('independent spherical cosine agrees with nearest-bin join at dispersed real stations',()=>{
  const bins=catalog.datasets.find(p=>p.key==='2026-main').points.filter(p=>p.plottable);
  const rad=x=>x*Math.PI/180;
  const dist=(a,b)=>6371000*Math.acos(Math.min(1,Math.max(-1,Math.sin(rad(a.y))*Math.sin(rad(b.y))+Math.cos(rad(a.y))*Math.cos(rad(b.y))*Math.cos(rad(a.x-b.x)))));
  for(const point of [...data.stations.filter((_,i)=>i%111===0),...data.buses.filter((_,i)=>i%173===0)]){
    const nearest=Math.min(...bins.map(bin=>dist(point,bin)));
    assert.ok(Math.abs(nearest-point.nearestBin.distanceM)<.2,point.name);
  }
});

const {summarizeComparison}=await import('../dist/cross-analysis.js');
test('comparison keeps zero bins and unknown activity separate and deduplicates shared bus buffers',()=>{
  const stations=[
    {id:'a',events:290,binCounts:{'300':2},buses:[{id:'one'},{id:'two'}]},
    {id:'b',events:580,binCounts:{'300':0},buses:[{id:'one'}]},
    {id:'c',events:null,binCounts:{'300':2},buses:[]}];
  const sample={meta:{activityDays:29},buses:[{id:'one',nearestBin:{distanceM:301}},{id:'two',nearestBin:{distanceM:300}}]};
  const result=summarizeComparison(sample,stations,300);
  assert.equal(result.ranked.length,1);assert.equal(result.ranked[0].eventsPerBin,5);
  assert.deepEqual(result.zero.map(p=>p.id),['b']);assert.equal(result.unknown,1);
  assert.equal(result.busTotal,2);assert.equal(result.busUncovered,1);assert.equal(result.busPercent,50);
  assert.equal(summarizeComparison(sample,[],300).busPercent,null);
});
test('independent bin counts and district day types retain the correct denominator',()=>{
  const bins=catalog.datasets.find(p=>p.key==='2026-main').points.filter(p=>p.plottable);
  const rad=x=>x*Math.PI/180;
  const dist=(a,b)=>6371000*Math.acos(Math.min(1,Math.max(-1,Math.sin(rad(a.y))*Math.sin(rad(b.y))+Math.cos(rad(a.y))*Math.cos(rad(b.y))*Math.cos(rad(a.x-b.x)))));
  for(const p of data.stations.filter((_,i)=>i%171===0))for(const radius of [100,200,300]){
    const near=bins.filter(b=>dist(p,b)<=radius);
    assert.equal(p.binRows[radius],near.length);
    assert.equal(p.binCounts[radius],new Set(near.map(b=>`${b.x},${b.y}`)).size);
  }
  assert.equal(Object.keys(data.areaProfiles).length,13);
  for(const profile of Object.values(data.areaProfiles)){
    assert.equal(profile.weekday.days,22);assert.equal(profile.weekend.days,7);
    for(const p of Object.values(profile)){assert.ok(Number.isFinite(p.dailyEvents));assert.ok(p.peakHour>=0&&p.peakHour<24);}
  }
});

test('unmatched source activity stays unknown instead of becoming zero demand',()=>{
  assert.equal(data.stations.filter(p=>p.events===null).length,47);
  assert.equal(data.stations.find(p=>p.name==='龍江平面停車場').events,null);
});

const {selectMrtStations,summarizeMrt,hourlySeries}=await import('../dist/cross-analysis.js');
test('MRT source custody, hourly conservation and unmatched stations stay explicit',async()=>{
  for(const input of data.transport.meta.inputs){
    const bytes=await readFile(new URL('../'+input.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),input.sha256,input.path);
  }
  const aggregate=JSON.parse(await readFile(new URL('../data/cross-analysis-inputs/transport-time-aggregate.json',import.meta.url)));
  const all=Object.values(aggregate.mrt.stations);
  assert.equal(all.reduce((n,p)=>n+p.entries,0),aggregate.mrt.trips);
  assert.equal(all.reduce((n,p)=>n+p.exits,0),aggregate.mrt.trips);
  assert.equal(all.reduce((n,p)=>n+p.fullMonthEntries,0),aggregate.mrt.fullMonthTrips);
  assert.equal(all.reduce((n,p)=>n+p.fullMonthExits,0),aggregate.mrt.fullMonthTrips);
  for(const p of all){assert.equal(p.hourly.reduce((a,b)=>a+b,0),p.entries);for(let h=0;h<24;h++)assert.equal(p.weekday[h]+p.weekend[h],p.hourly[h]);}
  assert.equal(data.transport.stations.length,73);
  assert.deepEqual(data.transport.meta.unmatchedInScope,['廣慈/奉天宮']);
  assert.equal(data.transport.meta.dateHourBlocks,31*21);
  assert.equal(data.transport.meta.rows,31*21*119*108);
  assert.ok(!JSON.stringify(data.transport).includes('T10-1150701-00437'),'public aggregate must not contain raw case IDs');
});
test('MRT exit unions count shared bins once and preserve nearest distances independent of filters',()=>{
  const bins=catalog.datasets.find(p=>p.key==='2026-main').points.filter(p=>p.plottable);
  const rad=x=>x*Math.PI/180;
  const dist=(a,b)=>6371000*Math.acos(Math.min(1,Math.max(-1,Math.sin(rad(a.y))*Math.sin(rad(b.y))+Math.cos(rad(a.y))*Math.cos(rad(b.y))*Math.cos(rad(a.x-b.x)))));
  for(const p of data.transport.stations.filter((_,i)=>i%7===0)){
    const distances=bins.map(b=>({b,d:Math.min(...p.exitLocations.map(e=>dist(e,b)))}));
    assert.ok(Math.abs(Math.min(...distances.map(x=>x.d))-p.nearestBin.distanceM)<.2);
    for(const radius of [100,200,300])assert.equal(p.binCounts[radius],new Set(distances.filter(x=>x.d<=radius).map(x=>`${x.b.x},${x.b.y}`)).size);
    assert.equal(new Set(p.bikeIds).size,p.bikeIds.length);assert.equal(new Set(p.busIds).size,p.busIds.length);
  }
  const result=summarizeMrt(data,selectMrtStations(data),300);
  assert.equal(result.ranked.length,40);assert.equal(result.zero.length,33);
  assert.equal(result.ranked[0].name,'台北車站');assert.equal(result.ranked[0].binCount,5);
  assert.ok(result.zero.every(p=>p.ratio===null));
  assert.equal(selectMrtStations(data,{search:'不存在站點'}).length,0);
  assert.equal(selectMrtStations(data,{district:'中正區',search:'台北車站'})[0].nearestBin.distanceM,result.ranked[0].nearestBin.distanceM);
});
test('complaint cohorts reconcile month exclusions and day types; absent MRT hours are not zero observations',()=>{
  const c=data.transport.complaints;
  assert.equal(c.sourceRows,c.uniqueCases);assert.equal(c.outsideMonth,698);
  const all=hourlySeries(data),wd=hourlySeries(data,'weekday'),we=hourlySeries(data,'weekend');
  assert.deepEqual(all[0].missing,[2,3,4]);
  assert.deepEqual(all.map(p=>p.peaks),[[18],[18],[9],[21]]);
  assert.equal(all[2].total,749);assert.equal(all[3].total,320);
  for(let i=0;i<all.length;i++){
    assert.equal(wd[i].total+we[i].total,all[i].total);
    assert.ok(Math.abs(all[i].shares.reduce((a,b)=>a+b,0)-100)<1e-10);
  }
  for(const p of Object.values(c.groups)){
    const total=p.hourly.reduce((a,b)=>a+b,0);
    assert.equal(p.sourceRows-p.outsideMonth-p.excludedDays,total);
    assert.equal(p.fullMonthHourly.reduce((a,b)=>a+b,0)-p.excludedDays,total);
  }
});
