import {COUNTRY_MODELS} from './country-model-data.js';

export function initializeCountryExperience(){
  const panel=document.getElementById('panel-countries');
  const viewer=document.createElement('section');
  viewer.id='country-viewer';viewer.className='country-viewer';viewer.hidden=true;
  viewer.setAttribute('aria-labelledby','country-model-title');
  viewer.innerHTML=`<header class="country-viewer-header"><h5 id="country-model-title" tabindex="-1"></h5><label class="country-model-picker">切換案例<select id="country-model-select"></select></label><button type="button" data-action="close" aria-label="關閉 3D 展示">關閉</button></header>
    <div class="country-viewer-body"><div class="country-model-visual"><div class="country-model-stage"></div>
    <div class="country-model-play" hidden><p class="country-play-description"></p><div class="country-play-actions"><button type="button" data-play="toggle" class="country-play-primary"></button><button type="button" data-play="rotate" aria-pressed="false">自動旋轉</button></div>
    <div class="country-play-timeline"><label for="country-play-progress">慢慢看動作</label><input id="country-play-progress" type="range" min="0" max="100" value="0" step="1" aria-valuetext="尚未開始"><button type="button" data-play="reset">重來</button></div><p class="country-play-state" role="status" aria-live="polite"></p></div><p class="country-model-status" role="status" aria-live="polite"></p><button type="button" class="country-model-retry" hidden>重試 3D</button>
    <div class="country-model-controls" hidden><div class="country-model-view-label">視角 <span class="country-model-view-state">全景</span></div><div class="country-model-views" role="group" aria-label="模型視角"><button type="button" data-view="overview" aria-pressed="true">全景</button><button type="button" data-view="front" aria-pressed="false">正面</button><button type="button" data-view="side" aria-pressed="false">側面</button><button type="button" data-view="back" aria-pressed="false">背面</button></div>
    <div class="country-model-zoom" role="group" aria-label="模型縮放"><span>縮放</span><button type="button" data-zoom="-1" aria-label="縮小模型">縮小</button><button type="button" data-zoom="1" aria-label="放大模型">放大</button></div></div>
    <p class="country-model-help"><span class="country-pointer-help">拖曳旋轉・Ctrl＋滾輪縮放</span><span class="country-touch-help">拖曳旋轉・雙指縮放；在模型外滑動頁面</span><span class="country-keyboard-help">方向鍵旋轉、＋／− 縮放、Home 回到全景</span></p>
    <button type="button" class="country-model-photo-link">對照實拍與來源</button></div>
    <div class="country-model-copy"><p class="country-model-description"></p><ul class="country-model-features"></ul><p class="country-model-limitation"></p><p class="country-model-note">3D 示意，非實測、非原廠模型。背面、內部、比例與動作為簡化推定；不表示現場尺寸、實際操作方式或設備效能。</p></div></div>`;
  const stage=viewer.querySelector('.country-model-stage'),status=viewer.querySelector('.country-model-status');
  const retry=viewer.querySelector('.country-model-retry'),controls=viewer.querySelector('.country-model-controls');
  const picker=viewer.querySelector('select'),title=viewer.querySelector('h5'),photoLink=viewer.querySelector('.country-model-photo-link');
  const playControls=viewer.querySelector('.country-model-play'),playButton=viewer.querySelector('[data-play="toggle"]');
  const rotationButton=viewer.querySelector('[data-play="rotate"]'),timeline=viewer.querySelector('#country-play-progress'),playState=viewer.querySelector('.country-play-state');
  const buttons=new Map(),photos=new Map(),returns=new Map();
  let scene,sceneLoading,sceneFactory,selected,rendered,opener,active=true,opened=false,failed=false;
  function updateView({view,canZoomIn,canZoomOut}){
    const labels={overview:'全景',front:'正面',side:'側面',back:'背面'};
    for(const button of controls.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===view));
    viewer.querySelector('.country-model-view-state').textContent=labels[view]||'自由視角';
    controls.querySelector('[data-zoom="1"]').disabled=!canZoomIn;
    controls.querySelector('[data-zoom="-1"]').disabled=!canZoomOut;
  }
  function updatePlayback({state,progress,rotating,reducedMotion,suspended}){
    const labels={ready:COUNTRY_MODELS[selected]?.playLabel||'試玩一次',playing:'暫停示意',paused:'繼續示意',complete:'再玩一次'};
    playButton.textContent=labels[state];
    playControls.dataset.state=state;
    rotationButton.setAttribute('aria-pressed',String(rotating));
    rotationButton.textContent=rotating?'停止旋轉':'自動旋轉';rotationButton.disabled=reducedMotion;
    const percent=Math.round(progress*100);timeline.value=percent;
    timeline.setAttribute('aria-valuetext',percent===0?'尚未開始':percent===100?'演示完成':`動作 ${percent}%`);
    const message=reducedMotion?'已減少動態效果；拖動進度可逐格看動作。':state==='playing'?(suspended?'畫面外暫停，回來即可繼續。':'示意播放中；也可以拖曳模型換個角度。'):state==='paused'?'停在這一刻。拖動進度，看看構造怎麼動。':state==='complete'?'完成！換個角度，或選另一個國家再玩。':'點模型或按下按鈕，開始一次互動示意。';
    if(playState.textContent!==message)playState.textContent=message;
  }
  function failure(){
    failed=true;scene?.setActive(false);stage.hidden=true;controls.hidden=true;playControls.hidden=true;retry.hidden=false;
    retry.textContent=sceneFactory?'重試 3D':'重新載入頁面';
    status.textContent='3D 暫時無法顯示。仍可閱讀外觀說明與實拍來源，或重試載入。';
  }
  function showModel(){
    if(!scene||!opened||failed)return;
    try{
      stage.hidden=false;
      if(rendered!==selected){scene.setModel(selected);rendered=selected}
      scene.setActive(active);controls.hidden=false;playControls.hidden=false;retry.hidden=true;
      status.textContent=COUNTRY_MODELS[selected].title+'，外觀示意已載入。';
    }catch{failure()}
  }
  async function loadScene(){
    if(sceneLoading)return sceneLoading;
    status.textContent='正在載入 3D 外觀示意…';retry.hidden=true;controls.hidden=true;playControls.hidden=true;
    sceneLoading=import('./country-scene.js').then(module=>{
      sceneFactory=module.createCountryScene;
      scene=sceneFactory(stage,{onFailure:failure,onChange:updateView,onPlayback:updatePlayback});
      if(opened)showModel();else scene.setActive(false);
    }).catch(()=>{stage.replaceChildren();failure()}).finally(()=>{sceneLoading=null});
    return sceneLoading;
  }
  function reveal(element){element.focus({preventScroll:true});element.scrollIntoView({block:'start',behavior:'instant'})}
  function open(id,{keepPicker=false}={}){
    selected=id;opener=buttons.get(id);opened=true;const data=COUNTRY_MODELS[id];
    for(const [key,button] of buttons){button.setAttribute('aria-expanded',String(key===id));returns.get(key).hidden=key!==id}
    opener.after(viewer);viewer.hidden=false;picker.value=id;
    title.textContent=data.title;
    viewer.querySelector('.country-play-description').textContent=data.playDescription;
    playButton.textContent=data.playLabel;
    photoLink.textContent=id==='australia'?'查看官方照片來源':'對照實拍與來源';
    viewer.querySelector('.country-model-description').textContent=data.description;
    viewer.querySelector('.country-model-limitation').textContent=data.limitation;
    const features=viewer.querySelector('.country-model-features');features.replaceChildren(...data.features.map(text=>{const li=document.createElement('li');li.textContent=text;return li}));
    if(scene&&!failed)showModel();else if(failed)failure();else loadScene();
    (keepPicker?picker:title).focus({preventScroll:true});
    viewer.scrollIntoView({block:'start',behavior:'instant'});
  }
  for(const [id] of Object.entries(COUNTRY_MODELS)){
    const heading=document.getElementById('country-'+id);
    if(!heading)continue;
    const label=heading.firstChild.textContent.trim(),photo=heading.closest('article').querySelector('.country-photo');
    const option=document.createElement('option');option.value=id;option.textContent=label;picker.append(option);
    const button=document.createElement('button');button.type='button';button.className='country-model-open';
    button.textContent=['india','australia'].includes(id)?'玩玩 3D 收運示意':'玩玩 3D 垃圾桶';
    button.setAttribute('aria-label',label+'：'+button.textContent);
    button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',viewer.id);
    heading.after(button);buttons.set(id,button);button.addEventListener('click',()=>open(id));
    photo.tabIndex=-1;photos.set(id,photo);
    const back=document.createElement('button');back.type='button';back.className='country-model-return';back.textContent='返回 3D 示意';back.hidden=true;
    back.addEventListener('click',()=>reveal(title));photo.prepend(back);returns.set(id,back);
  }
  picker.addEventListener('change',()=>open(picker.value,{keepPicker:true}));
  photoLink.addEventListener('click',()=>reveal(photos.get(selected)));
  panel.append(viewer);
  viewer.querySelector('[data-action="close"]').addEventListener('click',()=>{
    opened=false;viewer.hidden=true;scene?.setActive(false);returns.get(selected).hidden=true;
    opener.setAttribute('aria-expanded','false');reveal(opener);
  });
  controls.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||!scene)return;
    if(button.dataset.view)scene.setView(button.dataset.view);
    if(button.dataset.zoom)scene.zoom(Number(button.dataset.zoom));
  });
  playControls.addEventListener('click',event=>{
    const action=event.target.closest('button')?.dataset.play;if(!scene||!action)return;
    if(action==='toggle')scene.play();
    if(action==='rotate')scene.toggleRotation();
    if(action==='reset')scene.reset();
  });
  timeline.addEventListener('input',()=>scene?.seek(Number(timeline.value)/100));
  retry.addEventListener('click',()=>{
    if(!sceneFactory){location.reload();return}
    scene?.dispose();scene=null;rendered=null;failed=false;stage.hidden=false;loadScene();
  });
  return {setActive(value){active=Boolean(value);scene?.setActive(active&&opened&&!failed)}};
}
