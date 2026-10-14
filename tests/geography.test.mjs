import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three/three.module.min.js';
import {mercator,unproject,projection,worldPoint,tilePlan,tileURL,TILE_PROVIDER} from '../dist/geo.js';
import {mapSpec,mapPointIndex} from '../dist/map-data.js';
import {createBasemap,visibleTilePlan} from '../dist/basemap3d.js';
import {modules} from '../dist/registry.js';
import {sceneSpec} from '../dist/scene-data.js';
import {boot} from './helpers/app-harness.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../dist/data/snapshot.json',import.meta.url)));
const payload=id=>{const m=modules.find(m=>m.id===id);return {id,title:m.title,params:m.defaults,result:m.evaluate(m.defaults,data),data};};
class FakeLoader{
  requests=[];
  setCrossOrigin(value){this.crossOrigin=value;return this;}
  load(url,ok,progress,error){const texture=new THREE.Texture();this.requests.push({url,texture,ok:()=>ok(texture),error});return texture;}
}

test('Leaflet fixed module, CSS, image and source-map bytes match the provenance manifest',()=>{
  const root=new URL('../dist/vendor/leaflet/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
  assert.equal(manifest.version,'1.9.4');for(const [file,hash] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),hash);
});
test('Web Mercator matches the standard axis values and roundtrips the entire demo boundary',()=>{
  const origin=mercator(0,0);assert.equal(origin.x,0);assert.ok(Math.abs(origin.y)<1e-8);
  assert.ok(Math.abs(mercator(180,0).x-20037508.342789244)<1e-6);
  for(const longitude of [121.51,121.54,121.57])for(const latitude of [25.02,25.05,25.08]){
    const p=mercator(longitude,latitude),back=unproject(p.x,p.y);
    assert.ok(Math.abs(back.longitude-longitude)<1e-10);assert.ok(Math.abs(back.latitude-latitude)<1e-10);
  }
});
test('tile clipping covers the exact bbox once and keeps north/up UV orientation',()=>{
  const bbox=data.meta.bbox,plan=tilePlan(bbox),project=projection(bbox);
  assert.ok(plan.tiles.length>0&&plan.tiles.length<=24);
  const area=plan.tiles.reduce((sum,t)=>sum+(t.world.right-t.world.left)*(t.world.south-t.world.north),0);
  assert.ok(Math.abs(area-project.width*project.depth)<1e-6);
  for(const t of plan.tiles){for(const v of Object.values(t.uv))assert.ok(v>=0&&v<=1);
    assert.ok(t.world.south>t.world.north);assert.ok(t.uv.top>t.uv.bottom);assert.equal(new URL(tileURL(t)).hostname,'tile.openstreetmap.org');}
  const point={x:bbox[0],y:bbox[3]},world=worldPoint(point,project),tile=plan.tiles.find(t=>Math.abs(t.world.left-world.x)<1e-7&&Math.abs(t.world.north-world.z)<1e-7);
  assert.ok(tile);
  const n=2**plan.zoom,pixelX=(point.x+180)/360*n*256,pixelY=(1-Math.asinh(Math.tan(point.y*Math.PI/180))/Math.PI)/2*n*256;
  assert.ok(Math.abs(pixelX-tile.x*256-tile.uv.left*256)<1e-7);
  assert.ok(Math.abs(pixelY-tile.y*256-(1-tile.uv.top)*256)<1e-7);
});
test('large map extents lower the current-view tile zoom instead of requesting a bulk pyramid',()=>{
  const plan=tilePlan([120,23,122,26],18,24);assert.ok(plan.tiles.length<=24);assert.ok(plan.zoom<18);
  assert.equal(new Set(plan.tiles.map(t=>t.z)).size,1);assert.equal(TILE_PROVIDER.url,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
});
test('street-map layers retain actual coordinates, selected IDs and honest provenance',()=>{
  for(const id of ['shade','bins','rat','buildings']){
    const p=payload(id),spec=mapSpec(p),index=mapPointIndex(spec);
    assert.equal(spec.selected.length,p.result.map.points.filter(point=>point.selected).length);
    for(const point of index.values()){assert.ok(Number.isFinite(point.lat)&&Number.isFinite(point.lng));assert.ok(point.lat>=data.meta.bbox[1]&&point.lat<=data.meta.bbox[3]);}
    for(const point of spec.selected){const original=p.result.map.points.find(v=>v.id===point.id);assert.equal(point.lat,original.y);assert.equal(point.lng,original.x);assert.match(point.provenance,/合成/);}
    if(id==='bins'){assert.equal(spec.existing.length,294);assert.ok(spec.existing.every(p=>p.provenance==='真實觀測快照'));}
    if(id==='shade')assert.equal(spec.existing.length,3000);
    if(id==='rat'||id==='buildings')assert.equal(spec.existing.length,0);
  }
});
test('2D metre radii and 3D ground-scaled radii use the same scenario threshold',()=>{
  const p=payload('bins');p.params={...p.params,detour:2};p.result=modules[1].evaluate(p.params,data);
  const map=mapSpec(p),scene=sceneSpec(p);assert.equal(map.newRadius,150);assert.equal(map.radius,150);
  assert.ok(Math.abs(map.newRadius*scene.project.scale-scene.newRadius)<1e-10);
});
test('transport maps are geographic context and do not fabricate actual route or flow locations',()=>{
  for(const id of ['traffic','bus']){const spec=mapSpec(payload(id));assert.equal(spec.kind,'reference');assert.equal(mapPointIndex(spec).size,0);assert.match(spec.note,/尚未對應實際/);}
  assert.equal(mapSpec(payload('audit')),null);
});
test('3D tiles become visible only after load, have matching UVs, and retain failures as fallback',()=>{
  const spec=sceneSpec(payload('bins')),loader=new FakeLoader(),statuses=[],base=createBasemap(spec,{loader,onStatus:s=>statuses.push(s)});
  assert.equal(loader.crossOrigin,'anonymous');assert.equal(loader.requests.length,base.plan.tiles.length);
  assert.ok(base.root.children.every(plane=>!plane.visible));loader.requests[0].ok();loader.requests[1].error();
  const plane=base.root.children[0],tile=base.plan.tiles[0];assert.equal(plane.visible,true);assert.equal(base.root.children[1].visible,false);
  assert.equal(plane.material.map.offset.x,tile.uv.left);assert.equal(plane.material.map.offset.y,tile.uv.bottom);
  assert.equal(statuses.at(-1).loaded,1);assert.equal(statuses.at(-1).failed,1);
  plane.updateMatrixWorld();const northwest=new THREE.Vector3(-plane.geometry.parameters.width/2,plane.geometry.parameters.height/2,0).applyMatrix4(plane.matrixWorld);
  assert.ok(Math.abs(northwest.x-tile.world.left)<1e-8);assert.ok(Math.abs(northwest.z-tile.world.north)<1e-8);
  base.dispose();assert.equal(base.bag.items.size,0);
});
test('late image completions cannot revive disposed map planes or double-dispose resources',()=>{
  const spec=sceneSpec(payload('shade')),loader=new FakeLoader(),statuses=[],base=createBasemap(spec,{loader,onStatus:s=>statuses.push(s)});
  const counts=new Map();for(const item of base.bag.items){counts.set(item,0);item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));}
  base.dispose();const before=statuses.length;for(const request of loader.requests)request.ok();base.dispose();
  assert.equal(statuses.length,before);assert.equal(base.root.children.length,0);assert.ok([...counts.values()].every(n=>n===1));
});
test('visible city tiles cover every camera corner beyond the study area at a fixed data scale',()=>{
  const project=projection(data.meta.bbox);
  for(const [width,height] of [[790,420],[353,360],[284,360]])for(const view of ['angle','top','edge']){
    const camera=new THREE.PerspectiveCamera(42,width/height,.1,1800);
    if(view==='top')camera.position.set(0,260,.01);
    else if(view==='edge')camera.position.set(110,150,210);
    else camera.position.set(0,129.6,90);
    camera.lookAt(view==='edge'?new THREE.Vector3(110,0,80):new THREE.Vector3());camera.updateMatrixWorld();
    const plan=visibleTilePlan(camera,project,{width,height});
    assert.equal(plan.project,project);assert.ok(plan.tiles.length>0&&plan.tiles.length<=24);
    assert.equal(new Set(plan.tiles.map(t=>t.z)).size,1);
    for(const x of [-1,1])for(const y of [-1,1]){
      const direction=new THREE.Vector3(x,y,.5).unproject(camera).sub(camera.position).normalize();
      const point=new THREE.Ray(camera.position,direction).intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.085),new THREE.Vector3());
      assert.ok(plan.tiles.some(t=>point.x>=t.world.left&&point.x<=t.world.right&&point.z>=t.world.north&&point.z<=t.world.south));
    }
    const before=worldPoint({x:121.55,y:25.04},project),after=worldPoint({x:121.55,y:25.04},plan.project);
    assert.deepEqual(after,before);
    assert.ok(plan.tiles.some(t=>t.world.left< -project.width/2||t.world.right>project.width/2||t.world.north< -project.depth/2||t.world.south>project.depth/2));
  }
});
test('panning replaces city tiles without accumulating resources or accepting evicted completions',()=>{
  const spec=sceneSpec(payload('bins')),loader=new FakeLoader(),statuses=[];
  const camera=new THREE.PerspectiveCamera(42,1,.1,1800);camera.position.set(0,130,90);camera.lookAt(0,0,0);
  const base=createBasemap(spec,{loader,camera,viewport:{width:390,height:360},onStatus:s=>statuses.push(s)});
  const initial=[...base.root.children],requests=[...loader.requests];
  const counts=new Map();for(const resource of base.bag.items){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}
  assert.equal(base.updateView(camera,{width:390,height:360}),false);
  for(const x of [400,-400,0,400]){
    camera.position.set(x,130,90);camera.lookAt(x,0,0);base.updateView(camera,{width:390,height:360});
    assert.ok(base.root.children.length<=24);assert.equal(base.bag.items.size,base.root.children.length*3);
  }
  const before=statuses.length;for(const request of requests)request.ok();
  assert.equal(statuses.length,before);assert.ok(initial.every(plane=>!plane.parent&&!plane.visible));
  assert.ok([...counts.values()].every(n=>n===1));
  base.dispose();for(const request of loader.requests)request.ok();assert.equal(base.bag.items.size,0);
});
test('geographic views stay available without WebGL while only the chosen working view is visible',async()=>{
  const h=await boot(null,'#bins');assert.equal(h.nodes.get('geographic-panel').hidden,false);assert.equal(h.nodes.get('scene-panel').hidden,true);
  assert.equal(h.nodes.get('visualization').hidden,true);
  h.go('traffic');assert.equal(h.nodes.get('visualization').hidden,false);h.nodes.get('viewmode-map').onclick();assert.equal(h.nodes.get('geographic-panel').hidden,false);
  assert.equal(h.nodes.get('visualization').hidden,true);
  h.go('audit');assert.equal(h.nodes.get('geographic-panel').hidden,true);assert.equal(h.nodes.get('viewmode-map').hidden,true);
  h.go('shade');assert.equal(h.nodes.get('geographic-panel').hidden,false);assert.equal(h.nodes.get('visualization').hidden,true);
});

test('model-radius circles align with Leaflet sphere distances after Web Mercator display scaling',()=>{
  const project=projection(data.meta.bbox),center={x:project.centerX,y:project.centerY};
  const shifted={x:center.x,y:center.y+300/6371000*180/Math.PI};
  const a=worldPoint(center,project),b=worldPoint(shifted,project);
  assert.ok(Math.abs(Math.hypot(b.x-a.x,b.z-a.z)/(project.scale*300)-1)<.0001);
});

test('actual app linkage synchronizes plan state and selection IDs without changing model metrics',async()=>{
  const h=await boot(null,'#bins'),calls=[],before=h.nodes.get('metrics').innerHTML;
  h.context.geoStub={setPlanned:value=>calls.push(['map-plan',value]),select:(id,options)=>calls.push(['map-select',id,options.pan])};
  h.context.sceneStub={setPlanned:value=>calls.push(['3d-plan',value]),focusPoint:id=>calls.push(['3d-focus',id])};
  vm.runInContext("geoSession=geoStub;sceneSession=sceneStub;syncPlan(false);scenePayload().onPointSelected({id:'candidate-7'});focusGeography({id:'candidate-7'});",h.context);
  assert.deepEqual(calls,[['map-plan',false],['3d-plan',false],['map-select','candidate-7',true],['3d-focus','candidate-7']]);
  assert.equal(h.nodes.get('metrics').innerHTML,before);assert.equal(vm.runInContext('scenePayload().planned',h.context),false);
});
