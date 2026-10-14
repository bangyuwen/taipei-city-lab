import * as THREE from './vendor/three/three.module.min.js';
import {SCENE_COLORS,trafficFrame,busFrame} from './scene-data.js';

export class ResourceBag{
  constructor(){this.items=new Set();}
  track(item){if(item?.dispose)this.items.add(item);return item;}
  dispose(){for(const item of this.items)item.dispose();this.items.clear();}
}
const mat=(bag,color,extra={})=>bag.track(new THREE.MeshStandardMaterial({color,roughness:.85,metalness:.08,flatShading:true,...extra}));
function mesh(bag,geometry,material,parent,position=[0,0,0]){
  const item=new THREE.Mesh(bag.track(geometry),material);item.position.set(...position);parent.add(item);return item;
}
function box(bag,parent,size,position,color){return mesh(bag,new THREE.BoxGeometry(...size),mat(bag,color),parent,position);}
function instances(bag,parent,geometry,material,records,transform){
  if(!records.length)return null;
  const object=bag.track(new THREE.InstancedMesh(bag.track(geometry),material,records.length));
  const dummy=new THREE.Object3D();
  records.forEach((record,i)=>{dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);transform(dummy,record,i);dummy.updateMatrix();object.setMatrixAt(i,dummy.matrix);});
  object.instanceMatrix.needsUpdate=true;object.computeBoundingSphere();object.userData.records=records;parent.add(object);return object;
}
function group(root,name){const value=new THREE.Group();value.name=name;root.add(value);return value;}
function ground(bag,root,width,depth){
  box(bag,root,[width+8,2.4,depth+8],[0,-1.4,0],'#173e38');
  box(bag,root,[width, .2,depth],[0,-.1,0],'#244d44');
  const grid=new THREE.GridHelper(Math.max(width,depth),12,'#6d9383','#375e53');
  bag.track(grid.geometry);bag.track(grid.material);grid.position.y=.06;root.add(grid);
}
function discInstances(bag,parent,points,radius,color){
  if(radius<=0)return null;
  return instances(bag,parent,new THREE.CircleGeometry(radius,32),mat(bag,color,{transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}),points,(d,p)=>{d.position.set(p.x,.13,p.z);d.rotation.x=-Math.PI/2;});
}
function markerInstances(bag,parent,points,id,color,picks){
  const tree=id==='shade',building=['rat','buildings'].includes(id);
  const geometry=tree?new THREE.IcosahedronGeometry(1,1):new THREE.BoxGeometry(1,1,1);
  const item=instances(bag,parent,geometry,mat(bag,color),points,(d,p)=>{
    const height=building?Math.max(.4,(p.value||0)/100*25):tree?1.8:1.1;
    d.position.set(p.x,tree?1.6:height/2,p.z);d.scale.set(tree ? .85 : building ? 3 : 1.1,height,tree ? .85 : building ? 3 : 1.1);
  });
  if(item)picks.push(item);
  if(tree)instances(bag,parent,new THREE.CylinderGeometry(.13,.16,1.4,6),mat(bag,'#baad82'),points,(d,p)=>d.position.set(p.x,.7,p.z));
}
function buildSpatial(spec,bag,root){
  // Street tiles provide the ground. The scene background covers loading gaps
  // without a finite base or oversized geometry competing with marker depth.
  const layers={};for(const key of ['existing','demand','candidate','recommended','coverage'])layers[key]=group(root,key);
  layers.studyArea=group(root,'studyArea');
  const x=spec.project.width/2,z=spec.project.depth/2;
  const boundary=bag.track(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-x,.12,-z),new THREE.Vector3(x,.12,-z),
    new THREE.Vector3(x,.12,z),new THREE.Vector3(-x,.12,z),
  ]));
  layers.studyArea.add(new THREE.LineLoop(boundary,bag.track(new THREE.LineBasicMaterial({color:'#586477'}))));
  layers.studyArea.visible=false;
  const picks=[];
  markerInstances(bag,layers.existing,spec.existing,spec.id,SCENE_COLORS.existing,picks);
  markerInstances(bag,layers.candidate,spec.points.filter(p=>!p.selected),spec.id,SCENE_COLORS.candidate,picks);
  const selectedBase=group(layers.candidate,'selected-base');
  markerInstances(bag,selectedBase,spec.points.filter(p=>p.selected),spec.id,SCENE_COLORS.candidate,picks);
  markerInstances(bag,layers.recommended,spec.points.filter(p=>p.selected),spec.id,SCENE_COLORS.recommended,picks);
  discInstances(bag,layers.coverage,spec.existing,spec.radius,SCENE_COLORS.existing);
  const proposed=group(layers.coverage,'proposed');
  discInstances(bag,proposed,spec.points.filter(p=>p.selected),spec.newRadius,SCENE_COLORS.recommended);
  const demands=instances(bag,layers.demand,new THREE.CylinderGeometry(.48,.48,.25,8),mat(bag,'#ffffff'),spec.demand,(d,p)=>d.position.set(p.x,.22,p.z));
  if(demands)picks.push(demands);
  const setPlanned=planned=>{
    layers.recommended.visible=planned;proposed.visible=planned;selectedBase.visible=!planned;
    if(!demands)return;
    const color=new THREE.Color();
    spec.demand.forEach((p,i)=>demands.setColorAt(i,color.set(p.baseline?SCENE_COLORS.covered:planned&&p.planned?SCENE_COLORS.newlyCovered:SCENE_COLORS.demand)));
    if(demands.instanceColor)demands.instanceColor.needsUpdate=true;
  };
  setPlanned(true);
  return {layers,picks,setPlanned,labels:[],update:()=>({summary:'拖曳探索街道；點選標記檢視資料。'})};
}
function carBatch(bag,root,color,count){
  const body=bag.track(new THREE.InstancedMesh(bag.track(new THREE.BoxGeometry(1.8,.7,.9)),mat(bag,color),count));
  const roof=bag.track(new THREE.InstancedMesh(bag.track(new THREE.BoxGeometry(.95,.35,.8)),mat(bag,'#91b9c2'),count));
  body.count=0;roof.count=0;root.add(body,roof);
  const dummy=new THREE.Object3D();
  return (length,z)=>{body.count=length;roof.count=length;
    for(let i=0;i<length;i++){const x=35-(i%32)*2.4,offset=(Math.floor(i/32)-2)*2.1;
      dummy.position.set(x,.55,z+offset);dummy.updateMatrix();body.setMatrixAt(i,dummy.matrix);
      dummy.position.y=.95;dummy.updateMatrix();roof.setMatrixAt(i,dummy.matrix);}
    body.instanceMatrix.needsUpdate=true;roof.instanceMatrix.needsUpdate=true;body.computeBoundingSphere();roof.computeBoundingSphere();};
}
function buildTraffic(spec,bag,root){
  ground(bag,root,120,94);
  const labels=[];
  const batches=[['未錯峰基準',-20,'#84aaa9'],['錯峰情境',20,'#ffcc70']].map(([text,z,color])=>{
    box(bag,root,[98,.15,15],[0,.16,z],'#183c39');
    box(bag,root,[.65,7,15],[41,3.5,z],'#b79154');
    box(bag,root,[8,.17,15],[46,.21,z],'#416055');
    labels.push({text,position:[-14,1,z-10]},{text:'固定瓶頸',position:[42,9,z]});
    return carBatch(bag,root,color,160);
  });
  return {layers:{},picks:[],labels,update:elapsed=>{
    const frame=trafficFrame(spec,elapsed);
    batches[0](Math.min(160,Math.ceil(frame.baseline.queue/spec.represented)),-20);
    batches[1](Math.min(160,Math.ceil(frame.scenario.queue/spec.represented)),20);
    return {frame,summary:`${frame.time} · 基準排隊 ${frame.baseline.queue.toFixed(1)} 輛／情境 ${frame.scenario.queue.toFixed(1)} 輛`,details:`前一分鐘：情境到達 ${frame.scenario.arrivals.toFixed(1)}、通過 ${frame.scenario.served.toFixed(1)} 輛。每個車形最多代表 ${spec.represented} 輛。`};
  }};
}
function buildBus(spec,bag,root){
  ground(bag,root,145,95);
  box(bag,root,[102,.2,11],[0,.2,0],'#173b38');
  for(const x of [-48,48]){box(bag,root,[13,.6,14],[x,.3,0],'#557062');box(bag,root,[11,6,8],[x,3,-15],x<0?'#84aaa9':'#baad82');}
  const vehicles=Array.from({length:spec.scenario.config.fleet},(_,i)=>{
    const g=group(root,'vehicle-'+(i+1)),bodyMaterial=mat(bag,'#ffcc70');
    mesh(bag,new THREE.BoxGeometry(6,2,2.5),bodyMaterial,g,[0,1.6,0]);
    box(bag,g,[4.8,1.1,2.58],[.2,2.2,0],'#6f9fa8');
    box(bag,g,[6.2,.4,2.5],[0,2.8,0],'#f5ead4');
    for(const x of [-1.9,1.9])for(const z of [-1.3,1.3]){const wheel=mesh(bag,new THREE.CylinderGeometry(.55,.55,.35,8),mat(bag,'#102f2a'),g,[x,.6,z]);wheel.rotation.x=Math.PI/2;}
    return {g,bodyMaterial};
  });
  const people=instances(bag,root,new THREE.CylinderGeometry(.35,.45,1.2,6),mat(bag,'#a3c8b2'),Array(80).fill(null),(d,_,i)=>d.position.set(-65+(i%10)*1.7,.9,14+Math.floor(i/10)*1.7));
  const heads=instances(bag,root,new THREE.IcosahedronGeometry(.37,0),mat(bag,'#ebdac2'),Array(80).fill(null),(d,_,i)=>d.position.set(-65+(i%10)*1.7,1.7,14+Math.floor(i/10)*1.7));
  return {layers:{},picks:[],labels:[{text:'接駁站（示意）',position:[-48,8,-15]},{text:'園區（示意）',position:[48,8,-15]},
    {text:'留站人數',position:[-57,1,32]},{text:'休息／候班區',position:[-30,1,-30]}],update:elapsed=>{
    const frame=busFrame(spec,elapsed);
    frame.vehicles.forEach((v,i)=>{const {g,bodyMaterial}=vehicles[i];
      if(v.state==='往園區'){g.position.set(-48+96*v.progress,0,2.7);g.rotation.y=0;}
      else if(v.state==='返回接駁站'){g.position.set(48-96*v.progress,0,-2.7);g.rotation.y=Math.PI;}
      else{g.position.set(-52+(i%6)*8,0,-29-Math.floor(i/6)*7);g.rotation.y=0;}
      bodyMaterial.color.set(v.state==='休息'?'#b79154':v.state==='可發車'||v.state==='候班'?'#84aaa9':'#ffcc70');
    });
    people.count=Math.min(80,Math.ceil(frame.queue/spec.represented));heads.count=people.count;
    return {frame,summary:`${frame.time} · 留站 ${frame.queue} 人 · 已搭載 ${frame.boarded}／到達 ${frame.arrived} 人`,
      details:frame.vehicles.map(v=>`第 ${v.vehicle} 組：${v.state}`).join('；')+`。每個人形最多代表 ${spec.represented} 人。`};
  }};
}
function buildAudit(spec,bag,root){
  ground(bag,root,112,104);const picks=[],labels=[];
  spec.columns.forEach((p,i)=>{
    const x=(i%5-2)*20,z=(Math.floor(i/5)-1.5)*22,height=spec.profiled?Math.max(.15,p.value*.3):5;
    const color=spec.profiled?p.value>0?'#ffcc70':'#75bfa0':p.value?'#75bfa0':'#849fba';
    const object=box(bag,root,[9,height,9],[x,height/2,z],color);object.userData.point={...p,x,z};picks.push(object);
    labels.push({text:spec.profiled?p.value.toFixed(1)+'%':p.value?'已載入':'來源資訊',position:[x,height+2,z]},
      {text:p.label.length>10?p.label.slice(0,9)+'…':p.label,position:[x,.7,z+7]});
  });
  return {layers:{},picks,labels,update:()=>({summary:spec.profiled?'柱高＝該欄空白比例，完整數值見健檢表。':'綠色已載入觀測；藍色尚未載入觀測，不是品質分數。'})};
}
export function createSceneModel(spec){
  const root=new THREE.Group(),bag=new ResourceBag();
  let model;
  try{model=spec.kind==='spatial'?buildSpatial(spec,bag,root):spec.kind==='traffic'?buildTraffic(spec,bag,root):spec.kind==='bus'?buildBus(spec,bag,root):buildAudit(spec,bag,root);}
  catch(error){bag.dispose();throw error;}
  return {...model,root,bag,dispose(){root.removeFromParent();bag.dispose();root.clear();}};
}
