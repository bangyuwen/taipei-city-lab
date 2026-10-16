import * as THREE from './vendor/three/three.module.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {buildCountryModel} from './country-models.js';

// Photo-based shapes and actions are illustrative, never measured equipment behavior.
export function createCountryScene(container,{onFailure=()=>{},onChange=()=>{},onPlayback=()=>{}}={}){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const canvas=renderer.domElement;
  canvas.tabIndex=0;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','可操作的 3D 外觀示意；點模型或按 Enter 播放與暫停，方向鍵旋轉，加減鍵縮放，Home 回到全景');
  container.append(canvas);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#eaf0f2');
  const camera=new THREE.PerspectiveCamera(38,1,.05,40);
  // Ordinary scrolling continues through the model; Ctrl/trackpad pinch opts into zoom.
  function wheel(event){if(!event.ctrlKey)event.stopImmediatePropagation()}
  canvas.addEventListener('wheel',wheel,{capture:true,passive:true});
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;
  controls.enablePan=false;
  controls.minDistance=2.5;
  controls.maxDistance=8;
  controls.minPolarAngle=.15;
  controls.maxPolarAngle=Math.PI*.49;
  controls.target.set(0,.9,0);
  const ambient=new THREE.HemisphereLight(0xf4faff,0x657e87,1.8);
  const key=new THREE.DirectionalLight(0xfff4e6,3.2);
  key.position.set(-3.5,6,4.5);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:15});
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias=.025;key.shadow.bias=-.0002;
  const fill=new THREE.DirectionalLight(0xd8edff,1.5);fill.position.set(4,3,-3);
  scene.add(ambient,key,fill);
  // A small studio reflection map gives metal a readable highlight without external assets.
  const studio=new THREE.Scene();studio.background=new THREE.Color('#9eafb6');
  const lights=[];
  for(const [position,scale,intensity] of [[[0,6,0],[6,.1,6],5],[[-5,2,3],[.1,4,3],3],[[4,2,-3],[.1,3,2],2]]){
    const panel=new THREE.Mesh(new THREE.BoxGeometry(...scale),new THREE.MeshBasicMaterial({color:new THREE.Color(intensity,intensity,intensity)}));
    panel.position.set(...position);studio.add(panel);lights.push(panel);
  }
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.04,.1,30);
  scene.environment=environment.texture;
  pmrem.dispose();for(const panel of lights){panel.geometry.dispose();panel.material.dispose()}
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:0x566e78,opacity:.22}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
  let model,active=false,inViewport=false,frame=0,disposed=false,failed=false,lastTime=0;
  let state='ready',progress=0,rotating=false,pointer=null;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const positions={overview:[3.2,2.5,4.5],front:[0,1.3,5.5],side:[5.5,1.3,0],back:[0,1.3,-5.5]};
  const canRender=()=>active&&inViewport&&!failed&&!disposed&&!document.hidden;
  function reportView(){
    const offset=camera.position.clone().sub(controls.target),distance=offset.length(),direction=offset.clone().normalize();
    const view=Object.entries(positions).find(([,position])=>direction.distanceTo(new THREE.Vector3(...position).sub(controls.target).normalize())<.00001)?.[0]??null;
    onChange({view,canZoomIn:distance>controls.minDistance+.001,canZoomOut:distance<controls.maxDistance-.001});
  }
  function reportPlayback(){onPlayback({state,progress,rotating,reducedMotion:motion.matches,suspended:!canRender()})}
  function changed(){render();reportView()}
  function stopFrame(){cancelAnimationFrame(frame);frame=0;lastTime=0}
  function render(){if(canRender()&&!frame)frame=requestAnimationFrame(tick)}
  function tick(time){
    frame=0;if(!canRender()){lastTime=0;return}
    const delta=lastTime?Math.min((time-lastTime)/1000,.05):0;lastTime=time;
    if(state==='playing'&&model){
      progress=Math.min(1,progress+delta/model.userData.play.duration);
      model.userData.play.update(progress);
      if(progress===1)state='complete';
      reportPlayback();
    }
    if(rotating){
      const offset=camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),delta*.25);
      camera.position.copy(controls.target).add(offset);controls.update();
    }
    renderer.render(scene,camera);
    if(state==='playing'||rotating)render();else lastTime=0;
  }
  function resize(){
    const {width,height}=container.getBoundingClientRect();if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();
  }
  function disposeObject(object){
    const geometries=new Set(),materials=new Set(),textures=new Set();
    object.traverse(child=>{
      if(child.geometry)geometries.add(child.geometry);
      for(const material of Array.isArray(child.material)?child.material:[child.material])if(material)materials.add(material);
    });
    for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose()}
    for(const geometry of geometries)geometry.dispose();for(const texture of textures)texture.dispose();
  }
  function stopRotation(){if(rotating){rotating=false;reportPlayback()}}
  function setView(name='overview'){
    stopRotation();camera.position.set(...(positions[name]||positions.overview));
    controls.target.set(0,.9,0);controls.update();render();reportView();
  }
  function zoom(direction){
    const offset=camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length()*(direction>0?.8:1.25),controls.minDistance,controls.maxDistance));
    camera.position.copy(controls.target).add(offset);controls.update();render();
  }
  function play(){
    if(!model||!active||failed||disposed)return;
    if(motion.matches){progress=1;state='complete';model.userData.play.update(1)}
    else if(state==='playing')state='paused';
    else{if(progress>=1){progress=0;model.userData.play.reset()}state='playing'}
    lastTime=0;reportPlayback();render();
  }
  function seek(value){
    if(!model||failed||disposed)return;
    progress=THREE.MathUtils.clamp(value,0,1);state=progress===0?'ready':progress===1?'complete':'paused';
    model.userData.play.update(progress);lastTime=0;reportPlayback();render();
  }
  function reset(){if(!model)return;model.userData.play.reset();progress=0;state='ready';rotating=false;lastTime=0;reportPlayback();render()}
  function keydown(event){
    if(!active||event.altKey||event.ctrlKey||event.metaKey)return;
    const angles={ArrowLeft:[-.18,0],ArrowRight:[.18,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]};
    if(angles[event.key]){
      stopRotation();const [theta,phi]=angles[event.key];
      const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      spherical.theta+=theta;spherical.phi=THREE.MathUtils.clamp(spherical.phi+phi,controls.minPolarAngle,controls.maxPolarAngle);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();render();
    }else if(event.key==='+'||event.key==='=')zoom(1);
    else if(event.key==='-')zoom(-1);
    else if(event.key==='Home')setView();
    else if(event.key==='Enter'||event.key===' '){if(!event.repeat)play()}
    else return;event.preventDefault();
  }
  function pointerdown(event){
    if(!event.isPrimary||event.button!==0){pointer=null;return}
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  }
  function pointermove(event){if(pointer&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>6)pointer.moved=true}
  function pointerup(event){
    const start=pointer;pointer=null;if(!start||start.moved||start.id!==event.pointerId||!model)return;
    const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
    camera.updateMatrixWorld();model.updateWorldMatrix(true,true);
    ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    const hit=ray.intersectObject(model,true).some(({object})=>{for(let node=object;node;node=node.parent)if(!node.visible)return false;return true});
    if(hit)play();
  }
  function pointercancel(){pointer=null}
  function lost(event){event.preventDefault();failed=true;controls.enabled=false;stopFrame();onFailure()}
  function visibility(){stopFrame();reportPlayback();render()}
  function motionChanged(){if(motion.matches){rotating=false;if(state==='playing'){progress=1;state='complete';model?.userData.play.update(1)}}stopFrame();reportPlayback();render()}
  controls.addEventListener('change',changed);controls.addEventListener('start',stopRotation);
  canvas.addEventListener('keydown',keydown);canvas.addEventListener('webglcontextlost',lost);
  canvas.addEventListener('pointerdown',pointerdown);canvas.addEventListener('pointermove',pointermove);
  canvas.addEventListener('pointerup',pointerup);canvas.addEventListener('pointercancel',pointercancel);
  document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',motionChanged);
  const observer=new ResizeObserver(resize);observer.observe(container);
  const intersection=new IntersectionObserver(entries=>{inViewport=entries.at(-1).isIntersecting;stopFrame();reportPlayback();render()},{threshold:0});intersection.observe(container);
  setView();resize();
  return {
    setModel(id){
      const next=buildCountryModel(id);next.userData.play.reset();
      const bounds=new THREE.Box3().setFromObject(next),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      const scale=2/Math.max(size.x,size.y,size.z);
      next.scale.setScalar(scale);next.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
      next.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true}});
      if(model){scene.remove(model);disposeObject(model)}
      model=next;scene.add(model);reset();setView();render();
    },
    setView,zoom,play,seek,reset,
    toggleRotation(){rotating=!rotating&&!motion.matches;lastTime=0;reportPlayback();render()},
    setActive(value){active=Boolean(value);controls.enabled=active&&!failed;stopFrame();reportPlayback();if(active){resize();render()}},
    dispose(){
      if(disposed)return;disposed=true;stopFrame();observer.disconnect();intersection.disconnect();
      document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',motionChanged);
      canvas.removeEventListener('keydown',keydown);canvas.removeEventListener('webglcontextlost',lost);
      canvas.removeEventListener('wheel',wheel,true);canvas.removeEventListener('pointerdown',pointerdown);
      canvas.removeEventListener('pointermove',pointermove);canvas.removeEventListener('pointerup',pointerup);canvas.removeEventListener('pointercancel',pointercancel);
      controls.removeEventListener('change',changed);controls.removeEventListener('start',stopRotation);controls.dispose();
      if(model)disposeObject(model);disposeObject(floor);key.shadow.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    }
  };
}
