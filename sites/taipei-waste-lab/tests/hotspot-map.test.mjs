import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {activityStyle,selectActivityStations,activitySummary} from '../dist/hotspot-utils.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const data=JSON.parse(read('dist/data/activity-hotspots.json'));
test('public activity map reconciles retained analysis and represents unmatched observations as null',()=>{
 const s=JSON.parse(read('research/taipei-citywide-2026-10-19/results/summary.json'));
 assert.equal(data.stations.length,1790);assert.equal(data.meta.sourceRows,1821);
 assert.equal(data.meta.excludedStations,31);
 assert.deepEqual(activitySummary(data.stations),{count:1790,observed:1743,unknown:47,events:s.totals.eligible_events});
 for(const [name,sha] of Object.entries(data.meta.sourceSHA256))assert.equal(createHash('sha256').update(read('research/taipei-citywide-2026-10-19/results/'+name)).digest('hex'),sha);
 for(const row of s.districts){const selected=selectActivityStations(data.stations,{area:row.source_area});assert.equal(selected.length,row.eligible_stations);assert.equal(activitySummary(selected).events,row.events);}
 assert.equal(data.street.length,680);assert.equal(data.venues.length,130);
 for(const s of data.stations){assert.ok(Number.isFinite(s.lat)&&Number.isFinite(s.lon));if(s.events===null){assert.equal(s.borrow,null);assert.equal(s.returns,null);}else assert.equal(s.events,s.borrow+s.returns);}
});
test('filters preserve unknowns and absolute color scales; sorting never invents a zero observation',()=>{
 const unknown=selectActivityStations(data.stations,{query:'龍江平面停車場'});assert.equal(unknown.length,1);assert.equal(unknown[0].events,null);assert.equal(activitySummary(unknown).unknown,1);
 assert.deepEqual(selectActivityStations(data.stations,{area:'北投區',query:'NOT_A_STATION'}),[]);
 assert.equal(selectActivityStations(data.stations)[0].name,'捷運公館站(2號出口)');
 assert.equal(activityStyle(9999).fillColor,'#e9bb65');assert.equal(activityStyle(10000).fillColor,'#ca792e');assert.equal(activityStyle(30000).fillColor,'#963b13');
 assert.notEqual(activityStyle(null).fillColor,activityStyle(0).fillColor);
 assert.ok(activityStyle(40000).radius>activityStyle(10000).radius);
 const ids=selectActivityStations(data.stations,{area:'中山區',query:' 中山國中 '}).map(s=>s.id);assert.deepEqual(ids,['500107024']);
});

test('compact markers retain fixed activity bands at boundaries and remain bounded across zoom levels',()=>{
 for(const [events,color] of [[9999,'#e9bb65'],[10000,'#ca792e'],[10001,'#ca792e'],[29999,'#ca792e'],[30000,'#963b13'],[30001,'#963b13']]){
  for(const zoom of [10,11,12,16,17,19])assert.equal(activityStyle(events,zoom).fillColor,color);
 }
 for(const s of data.stations){
  assert.ok(activityStyle(s.events,11).radius<=2,'city overview must not obscure nearby stations');
  assert.ok(activityStyle(s.events,19).radius<=6,'street view size remains capped');
 }
 assert.equal(activityStyle(100000,19).radius,activityStyle(100001,19).radius);
 assert.ok(activityStyle(40000,16).radius>activityStyle(40000,11).radius);
 assert.equal(activityStyle(null,11).fillColor,'#ffffff');
 assert.equal(activityStyle(0,11).fillColor,'#e9bb65');
 const campus=selectActivityStations(data.stations,{area:'臺大公館校區'});
 assert.equal(campus.length,64);assert.ok(campus.every(s=>s.area==='臺大公館校區'));
});
