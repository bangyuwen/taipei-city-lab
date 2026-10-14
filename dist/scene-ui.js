import {createBasemap} from './basemap3d.js';
import * as THREE from './vendor/three/three.module.min.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {sceneSpec} from './scene-data.js';
import {createSceneModel} from './scene-builder.js';

export function mountScene(host,payload,onFailure){
  host.innerHTML=`<div class="scene-toolbar"><div><span class="scene-kicker">THREE.JS / 決策空間</span><h2 id="scene-title">探索情境</h2></div><div class="scene-views"><button data-view="angle">斜視</button><button data-view="top">俯視</button><button data-view="reset">全域</button><button data-zoom="in" aria-label="放大">＋</button><button data-zoom="out" aria-label="縮小">−</button></div></div><div class="scene-viewport"><canvas aria-label="3D 情境；拖曳旋轉，滾輪縮放，方向鍵平移" tabindex="0"></canvas><div class="scene-labels" aria-hidden="true"></div><div class="scene-overlay"><span id="scene-badge">位置與造型示意</span><span class="scene-north">N ↑</span></div><div class="scene-tooltip" hidden></div><a class="scene-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" hidden>© OpenStreetMap contributors</a></div><div class="scene-controls"><div id="scene-layers"></div><div id="scene-comparison"></div><div id="scene-time" hidden><button id="scene-play" aria-label="播放逐分鐘情境">播放</button><label for="scene-scrub">時間軸</label><input id="scene-scrub" type="range" min="0" max="120" step="1" value="0"><output id="scene-clock" for="scene-scrub"></output></div><div class="scene-select"><label for="scene-pick">選取位置／項目</label><select id="scene-pick"></select><button id="scene-focus">聚焦</button></div></div><div class="scene-readout"><p id="scene-summary" aria-live="polite"></p><p id="scene-details"></p><p id="scene-inspector" aria-live="polite"></p></div><div class="scene-caption"><p id="scene-basemap-status"></p><p id="scene-note"></p><span>拖曳旋轉 · 滾輪／雙指縮放 · 方向鍵平移 · 可用按鈕調整視角</span></div>`;
  const $=selector=>host.querySelector(selector),canvas=$('canvas'),viewport=$('.scene-viewport');
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});}
  catch(error){host.innerHTML='';throw error;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#202c45');
  const camera=new THREE.PerspectiveCamera(42,1,.1,1800);
  scene.add(new THREE.HemisphereLight('#eaf3e1','#183029',2.3));
  const sunlight=new THREE.DirectionalLight('#fff0cb',3);sunlight.position.set(-70,140,90);scene.add(sunlight);
  const fill=new THREE.DirectionalLight('#9ec3d7',1.5);fill.position.set(70,70,-100);scene.add(fill);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.485;
  controls.minDistance=8;controls.listenToKeyEvents(canvas);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let currentPayload=payload,basemap=null,basemapKey=null;
  let spec,model,labels=[],disposed=false,frameId=null,elapsed=0,playing=false,lastTime=0;
  let planned=true,layers={},selected=null,lastWidth=0,lastHeight=0;
  const events=[];
  const listen=(target,event,callback)=>{target.addEventListener(event,callback);events.push(()=>target.removeEventListener(event,callback));};
  const request=()=>{if(!disposed&&frameId===null&&!document.hidden)frameId=requestAnimationFrame(tick);};
  function tick(time){
    frameId=null;if(disposed||document.hidden)return;
    if(playing){elapsed=Math.min(spec.duration,elapsed+(lastTime?Math.min(.1,(time-lastTime)/1000):0)*12);lastTime=time;if(elapsed>=spec.duration){playing=false;$('#scene-play').textContent='播放';}}
    const width=viewport.clientWidth,height=viewport.clientHeight;
    if(width>0&&height>0){
      if(width!==lastWidth||height!==lastHeight){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();lastWidth=width;lastHeight=height;}
      try{controls.update();const view=model.update(elapsed);
      $('#scene-summary').textContent=view.summary;$('#scene-details').textContent=view.details||'';
      $('#scene-scrub').value=String(Math.floor(elapsed));$('#scene-clock').textContent=view.frame?.time||'';
      renderer.render(scene,camera);placeLabels(width,height);
      }catch{onFailure('3D 繪圖未完成，已切換 2D。');return;}
    }
    if(playing)request();
  }
  function placeLabels(width,height){
    for(const item of labels){const v=new THREE.Vector3(...item.position).project(camera);
      item.node.hidden=v.z>1||v.z< -1||Math.abs(v.x)>1||Math.abs(v.y)>1;
      item.node.style.transform=`translate(${(v.x+1)*width/2}px,${(1-v.y)*height/2}px) translate(-50%,-50%)`;}
  }
  function cameraView(view){
    const e=spec.extent;controls.target.set(0,0,0);
    camera.position.set(view==='top'?0:e*.9,view==='top'?e*1.55:e*.85,view==='top' ? .01 : e*1.05);
    controls.maxDistance=e*4;controls.update();request();
  }
  function applyLayers(){
    model.setPlanned?.(planned);
    for(const [name,g] of Object.entries(model.layers))g.visible=layers[name]!==false&&(name!=='recommended'||planned);
    request();
  }
  function inspect(point,focus=false,notify=true){
    selected=point;const coords=point.latitude!==undefined?` · 緯度 ${point.latitude.toFixed(6)}／經度 ${point.longitude.toFixed(6)}`:'';
    $('#scene-inspector').textContent=(point.label||point.id)+' · '+(point.detail||'')+coords;
    if(focus&&spec.kind==='spatial'){
      const distance=Math.max(12,Math.min(65,4*spec.radius+18));controls.target.set(point.x,0,point.z);
      camera.position.set(point.x+distance*.6,distance*.75,point.z+distance*.75);controls.update();
    }else if(focus&&spec.kind==='bus'){
      elapsed=point.minute+1;playing=false;$('#scene-play').textContent='播放';
    }else if(focus&&spec.kind==='audit'){
      const index=spec.focus.findIndex(p=>p.id===point.id),x=(index%5-2)*20,z=(Math.floor(index/5)-1.5)*22;
      controls.target.set(x,6,z);camera.position.set(x+26,40,z+38);controls.update();
    }
    if(notify)currentPayload.onPointSelected?.(point);request();
  }
  function controlsUI(){
    const name={existing:'既有點位',demand:'需求',candidate:'候選',recommended:'推薦',coverage:'假設範圍'};
    const layersHost=$('#scene-layers');layersHost.replaceChildren();
    for(const key of Object.keys(model.layers)){
      const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=layers[key]!==false;
      input.onchange=()=>{layers[key]=input.checked;applyLayers();};label.append(input,document.createTextNode(name[key]));layersHost.append(label);
    }
    const comparison=$('#scene-comparison');comparison.replaceChildren();
    if(spec.kind==='spatial'&&['shade','bins'].includes(spec.id))for(const [text,value] of [['既有基準',false],['推薦方案',true]]){
      const button=document.createElement('button');button.textContent=text;button.setAttribute('aria-pressed',String(planned===value));
      button.dataset.planned=String(value);button.onclick=()=>{setPlanned(value);currentPayload.onPlanChanged?.(value);};comparison.append(button);
    }
    $('#scene-time').hidden=!spec.duration;$('#scene-scrub').max=String(spec.duration||0);
    const select=$('#scene-pick');select.replaceChildren();
    for(const point of spec.focus){const option=document.createElement('option');option.value=String(point.id);option.textContent=(point.selected?'推薦 · ':'')+(point.label||point.id);select.append(option);}
    $('.scene-select').hidden=!spec.focus.length;
    if(spec.focus.length){select.value=String(spec.focus[0].id);inspect(spec.focus[0],false,false);}
  }
  function setPlanned(value){
    planned=Boolean(value);for(const b of $('#scene-comparison').children)b.setAttribute('aria-pressed',String(b.dataset.planned===String(planned)));applyLayers();
  }
  function focusPoint(id,{notify=false}={}){
    if(spec.kind!=='spatial')return false;
    const point=[...spec.focus,...spec.existing,...spec.demand].find(p=>String(p.id)===String(id));
    if(!point)return false;inspect(point,true,notify);return true;
  }
  function update(next){
    const previousKind=spec?.kind,previousId=spec?.id;
    const nextSpec=sceneSpec(next),nextModel=createSceneModel(nextSpec);
    currentPayload=next;
    const nextKey=nextSpec.kind==='spatial'?nextSpec.project.bbox.join(','):null;
    basemap?.root.removeFromParent();
    if(nextKey!==basemapKey){basemap?.dispose();basemap=null;basemapKey=nextKey;}
    model?.dispose();spec=nextSpec;model=nextModel;scene.add(model.root);
    if(nextKey&&!basemap)basemap=createBasemap(spec,{onChange:request,onStatus:status=>{
      $('#scene-basemap-status').textContent=status.failed?'部分 3D 底圖未載入；可使用上方街道地圖。':status.loaded===status.total?'3D 地面已對齊 OpenStreetMap 街道。':'正在載入 3D 街道底圖…';
    }});
    if(basemap)model.root.add(basemap.root);
    $('.scene-attribution').hidden=!nextKey;if(!nextKey)$('#scene-basemap-status').textContent='';
    elapsed=Math.min(elapsed,spec.duration||0);playing=false;lastTime=0;$('#scene-play').textContent='播放';selected=null;
    $('#scene-inspector').textContent='';$('#scene-title').textContent=next.title;
    $('#scene-note').textContent=spec.note;$('#scene-badge').textContent=spec.kind==='spatial'?'座標定位 · 造型示意':spec.kind==='audit'?'資料狀態 · 精確值另列':'合成情境 · 空間示意';
    $('.scene-north').hidden=spec.kind!=='spatial';$('.scene-labels').replaceChildren();
    labels=model.labels.map(item=>{const node=document.createElement('span');node.className='scene-label';node.textContent=item.text;$('.scene-labels').append(node);return {...item,node};});
    if(previousKind!==spec.kind||previousId!==spec.id){elapsed=0;layers={};planned=true;cameraView('angle');}
    if(typeof next.planned==='boolean')planned=next.planned;controlsUI();applyLayers();request();
  }
  listen(controls,'change',request);
  listen(canvas,'pointermove',event=>{
    if(event.buttons)return;
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const visible=object=>{for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;};
    const hit=raycaster.intersectObjects(model.picks.filter(visible),false)[0];
    const point=hit&&(hit.object.userData.point||hit.object.userData.records?.[hit.instanceId]);
    const tooltip=$('.scene-tooltip');tooltip.hidden=!point;
    if(point){tooltip.textContent=(point.label||point.id)+(point.latitude!==undefined?` · ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`:'');canvas.style.cursor='pointer';selected=point;}
    else{canvas.style.cursor='grab';selected=null;}
  });
  let down;
  listen(canvas,'pointerdown',e=>{down=[e.clientX,e.clientY];});
  listen(canvas,'pointerup',e=>{if(selected&&down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<6)inspect(selected);down=null;});
  listen(canvas,'pointerleave',()=>{$('.scene-tooltip').hidden=true;selected=null;});
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();onFailure('3D 繪圖連線中斷，已切換 2D。');});
  listen(document,'visibilitychange',()=>{lastTime=0;if(document.hidden){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;}else request();});
  listen(window,'resize',request);
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(request):null;observer?.observe(viewport);
  host.onclick=e=>{const button=e.target.closest('button');if(!button)return;
    if(button.dataset.view)cameraView(button.dataset.view);
    if(button.dataset.zoom){const offset=camera.position.clone().sub(controls.target).multiplyScalar(button.dataset.zoom==='in' ? .75 : 1.35);camera.position.copy(controls.target).add(offset);controls.update();request();}
  };
  $('#scene-play').onclick=()=>{playing=!playing;if(playing&&elapsed>=spec.duration)elapsed=0;lastTime=0;$('#scene-play').textContent=playing?'暫停':'播放';request();};
  $('#scene-scrub').oninput=e=>{elapsed=Number(e.target.value);playing=false;$('#scene-play').textContent='播放';request();};
  $('#scene-pick').onchange=e=>{const point=spec.focus.find(p=>String(p.id)===e.target.value);if(point)inspect(point);};
  $('#scene-focus').onclick=()=>{const point=spec.focus.find(p=>String(p.id)===$('#scene-pick').value);if(point)inspect(point,true);};
  function dispose(){
    if(disposed)return;disposed=true;if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;
    observer?.disconnect();for(const remove of events)remove();controls.dispose();basemap?.dispose();model?.dispose();
    renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();host.onclick=null;host.innerHTML='';
  }
  try{update(payload);}catch(error){dispose();throw error;}
  return {update,dispose,focusPoint,setPlanned};
}
