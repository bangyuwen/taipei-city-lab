import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three/three.module.min.js';
import {modules} from '../dist/registry.js';
import {sceneSpec,projection,worldPoint,samplePoints,trafficFrame,busFrame,vehicleFrame} from '../dist/scene-data.js';
import {createSceneModel} from '../dist/scene-builder.js';
import {simulateShuttle} from '../dist/modules/bus.js';
import {inspectCSV} from '../dist/modules/audit.js';
import {boot} from './helpers/app-harness.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../dist/data/snapshot.json',import.meta.url)));
const fixture=id=>{const m=modules.find(m=>m.id===id),result=m.evaluate(m.defaults,data);return {m,result,spec:sceneSpec({id,result,data,params:m.defaults})};};
const finite=value=>{if(typeof value==='number')assert.ok(Number.isFinite(value));else if(Array.isArray(value))value.forEach(finite);else if(value&&typeof value==='object')Object.values(value).forEach(finite);};

test('Three.js dependency is pinned and every vendored byte matches its recorded SHA',()=>{
  assert.equal(THREE.REVISION,'180');
  const root=new URL('../dist/vendor/three/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
  assert.equal(manifest.version,'0.180.0');
  for(const [file,hash] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),hash);
  const controls=fs.readFileSync(new URL('OrbitControls.js',root),'utf8');
  assert.match(controls,/from '\.\/three.module.min.js'/);assert.doesNotMatch(controls,/from 'three'/);
});
test('local projection preserves north and distance scale without swapping coordinates',()=>{
  const p=projection([121.51,25.02,121.57,25.08]),center={x:p.centerX,y:p.centerY};
  assert.deepEqual(worldPoint(center,p),{x:0,z:-0});
  const east=worldPoint({x:center.x+.001,y:center.y},p),north=worldPoint({x:center.x,y:center.y+.001},p);
  assert.ok(east.x>0);assert.ok(north.z<0);
  assert.ok(Math.abs(east.x/p.scale-.001*6371000*Math.PI/180*Math.cos(center.y*Math.PI/180))<1e-6);
  assert.ok(Math.abs(north.z/p.scale+.001*6371000*Math.PI/180)<.01);
});
test('render sampling is deterministic, bounded and leaves source records untouched',()=>{
  const points=Array.from({length:4001},(_,id)=>({id})),before=JSON.stringify(points);
  assert.equal(samplePoints(points).length,3000);assert.deepEqual(samplePoints(points),samplePoints(points));
  assert.equal(JSON.stringify(points),before);assert.equal(samplePoints(points,100).length,100);
});
test('all seven real Three.js scene graphs have finite geometry, matrices and time updates',()=>{
  for(const m of modules){
    const result=m.evaluate(m.defaults,data),spec=sceneSpec({id:m.id,result,data,params:m.defaults});finite(spec);
    const model=createSceneModel(spec);assert.ok(model.root.children.length>0,m.id);
    for(const t of [0,30,spec.duration||60])finite(model.update(t));
    model.root.traverse(object=>{
      finite(object.position.toArray());finite(object.scale.toArray());
      if(object.geometry?.attributes.position)for(const v of object.geometry.attributes.position.array)assert.ok(Number.isFinite(v),m.id);
      if(object.isInstancedMesh)for(const v of object.instanceMatrix.array)assert.ok(Number.isFinite(v),m.id);
    });model.dispose();assert.equal(model.bag.items.size,0);
  }
});
test('3D coverage colors reconcile with model rates despite rendering only a sample of facilities',()=>{
  for(const id of ['shade','bins']){
    const {result,spec}=fixture(id);const total=spec.demand.reduce((s,p)=>s+p.weight,0);
    const baseline=spec.demand.reduce((s,p)=>s+(p.baseline?p.weight:0),0)/total*100;
    const planned=spec.demand.reduce((s,p)=>s+(p.planned?p.weight:0),0)/total*100;
    assert.ok(Math.abs(baseline-result.metrics[2].value)<1e-8);
    assert.ok(Math.abs(planned-result.metrics[3].value)<1e-8);
    assert.equal(spec.points.filter(p=>p.selected).length,result.table.rows.length);
    if(id==='shade'){assert.equal(spec.existing.length,3000);assert.match(spec.note,/39,448/);}
  }
});
test('zero-year growth cannot create a proposed coverage disk or selected 3D marker',()=>{
  const m=modules[0],params={...m.defaults,years:0},result=m.evaluate(params,data);
  const spec=sceneSpec({id:m.id,result,data,params});assert.equal(spec.newRadius,0);assert.equal(spec.points.filter(p=>p.selected).length,0);
  assert.ok(spec.demand.every(p=>p.baseline===p.planned));const model=createSceneModel(spec);
  assert.equal(model.layers.recommended.children.length,0);model.setPlanned(false);assert.equal(model.layers.recommended.visible,false);model.dispose();
});
test('traffic animation shows the exact minute-end queues and drains both tails',()=>{
  const {spec}=fixture('traffic'),frame=trafficFrame(spec,117);
  assert.equal(frame.baseline.queue,spec.baseline.queue[116]);assert.equal(frame.scenario.queue,spec.scenario.queue[116]);
  assert.equal(frame.scenario.arrivals,spec.scenario.arrivals[116]);assert.equal(trafficFrame(spec,0).scenario.queue,0);
  assert.equal(trafficFrame(spec,spec.duration).scenario.queue,0);assert.equal(trafficFrame(spec,spec.duration).baseline.queue,0);
  const model=createSceneModel(spec);model.update(117);model.root.traverse(object=>{if(object.isInstancedMesh)assert.ok(object.count<=160);});model.dispose();
});
test('bus geometry timing respects every scheduled rest period and passenger totals',()=>{
  const p=simulateShuttle({fleet:1,headway:10,breakMinutes:15,demand:600});
  assert.equal(vehicleFrame(p,1,14).state,'往園區');assert.equal(vehicleFrame(p,1,15).state,'返回接駁站');
  assert.equal(vehicleFrame(p,1,30).state,'休息');assert.equal(vehicleFrame(p,1,44).state,'休息');assert.equal(vehicleFrame(p,1,45).state,'往園區');
  for(const trip of p.schedule)for(let t=trip.returned;t<Math.min(120,trip.ready);t++)assert.equal(vehicleFrame(p,trip.vehicle,t).state,'休息');
  const {spec}=fixture('bus'),end=busFrame(spec,120);
  assert.equal(end.arrived,spec.scenario.total);assert.equal(end.boarded+end.queue,end.arrived);
  assert.equal(busFrame(spec,10).queue,spec.scenario.queue[9]);
});
test('CSV 3D columns retain exact missing percentages and disclose the displayed subset',()=>{
  const report=inspectCSV('a,b,c\n1,,0\n2,x,0'),m=modules[6],result=m.evaluate(m.defaults,data);
  const spec=sceneSpec({id:'audit',data,result,params:m.defaults,report});
  assert.equal(spec.profiled,true);assert.equal(spec.columns.find(p=>p.id==='b').value,50);assert.equal(spec.columns.find(p=>p.id==='c').value,0);
  assert.match(spec.note,/空值代碼.*另行檢查/);
  const catalogue=sceneSpec({id:'audit',data,result,params:m.defaults});assert.equal(catalogue.columns.filter(p=>p.value).length,2);assert.match(catalogue.note,/等高卡片/);
});
test('scene disposal releases each registered resource once and detaches the scene graph',()=>{
  const {spec}=fixture('bus'),model=createSceneModel(spec),parent=new THREE.Scene();parent.add(model.root);
  const counts=new Map();for(const item of model.bag.items){counts.set(item,0);item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));}
  model.dispose();model.dispose();assert.equal(parent.children.length,0);assert.equal(model.root.children.length,0);
  assert.ok([...counts.values()].every(n=>n===1));
});
test('repeated module changes do not retain old scene graphs or tracked resources',()=>{
  const parent=new THREE.Scene();for(let i=0;i<14;i++){
    const m=modules[i%7],result=m.evaluate(m.defaults,data),model=createSceneModel(sceneSpec({id:m.id,result,data,params:m.defaults}));
    parent.add(model.root);model.update(50);model.dispose();assert.equal(parent.children.length,0);assert.equal(model.bag.items.size,0);
  }
});
test('no-WebGL fallback keeps original model, controls and exports usable',async()=>{
  const h=await boot(null,'#bus');assert.equal(h.nodes.get('scene-panel').hidden,true);assert.equal(h.nodes.get('visualization').hidden,false);
  assert.match(h.nodes.get('scene-status').textContent,/2D/);h.nodes.get('viewmode-3d').onclick();
  assert.equal(h.nodes.get('visualization').hidden,false);h.change('fleet','1');h.nodes.get('export-csv').onclick();
  assert.equal(h.downloads.at(-1).filename,'bus-scenario.csv');assert.ok(h.listeners.has('pagehide')&&h.listeners.has('pageshow'));
});

test('baseline and planned selected glyphs are mutually exclusive, preventing overlapping surfaces',()=>{
  const {spec}=fixture('shade'),model=createSceneModel(spec),base=model.layers.candidate.getObjectByName('selected-base');
  model.setPlanned(true);assert.equal(base.visible,false);assert.equal(model.layers.recommended.visible,true);
  model.setPlanned(false);assert.equal(base.visible,true);assert.equal(model.layers.recommended.visible,false);
  model.dispose();
});
test('a selected geographic location persists when the plan or marker viewport changes',()=>{
  const {spec}=fixture('bins'),model=createSceneModel(spec),point=spec.focus[0],selection=model.root.getObjectByName('selected-location');
  model.setSelected(point);model.setMarkerViewport(360,42);model.setPlanned(false);
  assert.equal(selection.visible,true);assert.equal(selection.position.x,point.x);assert.equal(selection.position.z,point.z);
  const coords=selection.position.toArray();model.setMarkerViewport(420,42);assert.deepEqual(selection.position.toArray(),coords);
  assert.ok(model.picks.filter(p=>p.isSprite).every(p=>p.position.x===p.userData.point.x&&p.position.z===p.userData.point.z));
  model.setSelected(null);assert.equal(selection.visible,false);model.dispose();
});
