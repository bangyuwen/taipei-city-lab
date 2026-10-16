import * as THREE from './vendor/three/three.module.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {buildCountryModel} from './country-models.js';

// Country shapes are illustrative. Normalize their bounds without implying scale.
export function createCountryScene(container,{onFailure=()=>{}}={}){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const canvas=renderer.domElement;
  canvas.tabIndex=0;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','可旋轉的 3D 外觀示意；方向鍵旋轉，加減鍵縮放，Home 回到全景');
  container.append(canvas);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#eaf0f2');
  const camera=new THREE.PerspectiveCamera(38,1,.05,40);
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;
  controls.enablePan=false;
  controls.minDistance=2.5;
  controls.maxDistance=8;
  controls.minPolarAngle=.15;
  controls.maxPolarAngle=Math.PI*.49;
  controls.target.set(0,.9,0);
  const ambient=new THREE.HemisphereLight(0xf4faff,0x7e8990,2.4);
  const key=new THREE.DirectionalLight(0xfff5e5,3.3);
  key.position.set(3,6,5);
  const fill=new THREE.DirectionalLight(0xd6eaff,1.3);
  fill.position.set(-4,3,-2);
  scene.add(ambient,key,fill);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(2.25,64),new THREE.MeshStandardMaterial({color:0xdce5e8,roughness:1}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.008;scene.add(floor);
  let model,active=false,frame=0,disposed=false,failed=false;

  function render(){
    if(!active||failed||disposed||document.hidden||frame)return;
    frame=requestAnimationFrame(()=>{frame=0;if(active&&!failed&&!disposed)renderer.render(scene,camera)});
  }
  function resize(){
    const {width,height}=container.getBoundingClientRect();
    if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();
  }
  function disposeObject(object){
    object.traverse(child=>{
      child.geometry?.dispose();
      const materials=Array.isArray(child.material)?child.material:[child.material];
      for(const material of materials){
        if(!material)continue;
        for(const value of Object.values(material))if(value?.isTexture)value.dispose();
        material.dispose();
      }
    });
  }
  function setView(name='overview'){
    const positions={overview:[3.5,2.8,4.2],front:[0,1.3,5.5],side:[5.5,1.3,0],back:[0,1.3,-5.5]};
    camera.position.set(...(positions[name]||positions.overview));
    controls.target.set(0,.9,0);controls.update();render();
  }
  function zoom(direction){
    const offset=camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length()*(direction>0?.8:1.25),controls.minDistance,controls.maxDistance));
    camera.position.copy(controls.target).add(offset);controls.update();render();
  }
  function keydown(event){
    if(!active||event.altKey||event.ctrlKey||event.metaKey)return;
    const angles={ArrowLeft:[-.18,0],ArrowRight:[.18,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]};
    if(angles[event.key]){
      const [theta,phi]=angles[event.key];
      const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      spherical.theta+=theta;spherical.phi=THREE.MathUtils.clamp(spherical.phi+phi,controls.minPolarAngle,controls.maxPolarAngle);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();render();
    }else if(event.key==='+'||event.key==='=')zoom(1);
    else if(event.key==='-')zoom(-1);
    else if(event.key==='Home')setView();
    else return;
    event.preventDefault();
  }
  function lost(event){
    event.preventDefault();failed=true;controls.enabled=false;
    cancelAnimationFrame(frame);frame=0;onFailure();
  }
  function visibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0}else render()}
  controls.addEventListener('change',render);
  canvas.addEventListener('keydown',keydown);
  canvas.addEventListener('webglcontextlost',lost);
  document.addEventListener('visibilitychange',visibility);
  const observer=new ResizeObserver(resize);observer.observe(container);
  setView();resize();
  return {
    setModel(id){
      const next=buildCountryModel(id);
      const bounds=new THREE.Box3().setFromObject(next),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      const scale=2/Math.max(size.x,size.y,size.z);
      next.scale.setScalar(scale);next.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
      if(model){scene.remove(model);disposeObject(model)}
      model=next;scene.add(model);setView();render();
    },
    setView,zoom,
    setActive(value){active=Boolean(value);controls.enabled=active&&!failed;if(active){resize();render()}else{cancelAnimationFrame(frame);frame=0}},
    dispose(){
      if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();
      document.removeEventListener('visibilitychange',visibility);
      canvas.removeEventListener('keydown',keydown);canvas.removeEventListener('webglcontextlost',lost);
      controls.removeEventListener('change',render);controls.dispose();
      if(model)disposeObject(model);disposeObject(floor);renderer.dispose();renderer.forceContextLoss();canvas.remove();
    }
  };
}
