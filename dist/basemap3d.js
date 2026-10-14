import * as THREE from './vendor/three/three.module.min.js';
import {tilePlan,tileURL} from './geo.js';
import {ResourceBag} from './scene-builder.js';

export function createBasemap(spec,{onChange=()=>{},onStatus=()=>{},loader=new THREE.TextureLoader()}={}){
  const root=new THREE.Group(),bag=new ResourceBag(),plan=tilePlan(spec.project.bbox);
  root.name='street-basemap';let disposed=false,loaded=0,failed=0;
  loader.setCrossOrigin('anonymous');
  const status=()=>{if(disposed)return;onStatus({loaded,failed,total:plan.tiles.length,zoom:plan.zoom});onChange();};
  for(const tile of plan.tiles){
    const {world:w,uv}=tile;
    const geometry=bag.track(new THREE.PlaneGeometry(w.right-w.left,w.south-w.north));
    const material=bag.track(new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false}));
    const plane=new THREE.Mesh(geometry,material);plane.rotation.x=-Math.PI/2;
    plane.position.set((w.left+w.right)/2,.085,(w.north+w.south)/2);plane.visible=false;root.add(plane);
    const texture=loader.load(tileURL(tile),value=>{
      if(disposed)return;value.colorSpace=THREE.SRGBColorSpace;value.offset.set(uv.left,uv.bottom);value.repeat.set(uv.right-uv.left,uv.top-uv.bottom);
      material.map=value;material.needsUpdate=true;plane.visible=true;loaded++;status();
    },undefined,()=>{if(!disposed){failed++;status();}});
    bag.track(texture);
  }
  status();
  return {root,bag,plan,dispose(){if(disposed)return;disposed=true;root.removeFromParent();bag.dispose();root.clear();}};
}
