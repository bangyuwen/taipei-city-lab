import * as THREE from './vendor/three/three.module.min.js';
import {EARTH_RADIUS,tilePlan,tileURL,unproject} from './geo.js';
import {ResourceBag} from './scene-builder.js';

// Request the visible ground at one tile level, keeping the study projection
// fixed so markers and metre radii never rescale when the camera moves.
export function visibleTilePlan(camera,project,{width=800,height=400,maxTiles=24}={}){
  camera.updateMatrixWorld();
  const ground=new THREE.Plane(new THREE.Vector3(0,1,0),-.085),points=[];
  for(const x of [-1,1])for(const y of [-1,1]){
    const direction=new THREE.Vector3(x,y,.5).unproject(camera).sub(camera.position).normalize();
    const point=new THREE.Ray(camera.position,direction).intersectPlane(ground,new THREE.Vector3());
    if(point)points.push(point);
  }
  if(points.length!==4)return tilePlan(project.bbox,14,maxTiles,{project,clip:false});
  const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),
    north=Math.min(...points.map(p=>p.z)),south=Math.max(...points.map(p=>p.z));
  const padding=Math.max(right-left,south-north)*.08;
  const sw=unproject(project.centerMercatorX+(left-padding)/project.mercatorScale,project.centerMercatorY-(south+padding)/project.mercatorScale);
  const ne=unproject(project.centerMercatorX+(right+padding)/project.mercatorScale,project.centerMercatorY-(north-padding)/project.mercatorScale);
  const metresPerPixel=Math.max((right-left)/Math.max(1,width),(south-north)/Math.max(1,height))/project.mercatorScale;
  const zoom=Math.min(18,Math.max(0,Math.round(Math.log2(2*Math.PI*EARTH_RADIUS/(256*metresPerPixel)))));
  return tilePlan([sw.longitude,sw.latitude,ne.longitude,ne.latitude],zoom,maxTiles,{project,clip:false});
}

export function createBasemap(spec,{onChange=()=>{},onStatus=()=>{},loader=new THREE.TextureLoader(),camera,viewport}={}){
  const root=new THREE.Group(),bag=new ResourceBag(),records=new Map();
  root.name='street-basemap';let disposed=false,plan;
  loader.setCrossOrigin('anonymous');
  const status=()=>{
    if(disposed)return;
    const values=[...records.values()];
    onStatus({loaded:values.filter(r=>r.state==='loaded').length,failed:values.filter(r=>r.state==='failed').length,total:values.length,zoom:plan.zoom});onChange();
  };
  const key=tile=>`${tile.z}/${tile.x}/${tile.y}`;
  function replace(next){
    plan=next;
    const wanted=new Set(plan.tiles.map(key));
    for(const [id,record] of records)if(!wanted.has(id)){
      records.delete(id);record.plane.removeFromParent();
      for(const resource of record.resources){resource.dispose();bag.items.delete(resource);}
    }
    for(const tile of plan.tiles){
      const id=key(tile);if(records.has(id))continue;
      const {world:w,uv}=tile;
      const geometry=bag.track(new THREE.PlaneGeometry(w.right-w.left,w.south-w.north));
      const material=bag.track(new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false}));
      const plane=new THREE.Mesh(geometry,material);plane.rotation.x=-Math.PI/2;
      plane.position.set((w.left+w.right)/2,.085,(w.north+w.south)/2);plane.visible=false;root.add(plane);
      const record={plane,resources:[geometry,material],state:'loading'};records.set(id,record);
      const texture=loader.load(tileURL(tile),value=>{
        if(disposed||records.get(id)!==record)return;value.colorSpace=THREE.SRGBColorSpace;value.offset.set(uv.left,uv.bottom);value.repeat.set(uv.right-uv.left,uv.top-uv.bottom);
        material.map=value;material.needsUpdate=true;plane.visible=true;record.state='loaded';status();
      },undefined,()=>{if(!disposed&&records.get(id)===record){record.state='failed';status();}});
      record.resources.push(bag.track(texture));
    }
    status();
  }
  replace(camera?visibleTilePlan(camera,spec.project,viewport):tilePlan(spec.project.bbox,14,24,{project:spec.project,clip:false}));
  return {root,bag,get plan(){return plan;},updateView(nextCamera,nextViewport){
    if(disposed)return false;
    const next=visibleTilePlan(nextCamera,spec.project,nextViewport);
    if(next.tiles.length===records.size&&next.tiles.every(t=>records.has(key(t))))return false;
    replace(next);return true;
  },dispose(){if(disposed)return;disposed=true;root.removeFromParent();bag.dispose();root.clear();records.clear();}};
}
