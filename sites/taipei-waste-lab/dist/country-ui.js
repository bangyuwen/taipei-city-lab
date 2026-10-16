import {COUNTRY_MODELS} from './country-model-data.js';
import {initializeCountryComparison} from './country-comparison.js';

export function initializeCountryExperience(){
  const panel=document.getElementById('panel-countries');
  const launch=document.getElementById('country-playground');
  const reader=document.getElementById('country-reader-select');
  const articles=[...panel.querySelectorAll('.country-case')];
  const ids=articles.map(article=>article.getAttribute('aria-labelledby').replace('country-',''));
  const viewer=document.createElement('section');
  viewer.id='country-viewer';viewer.className='country-viewer';
  viewer.setAttribute('aria-labelledby','country-model-title');
  viewer.innerHTML=`<header class="country-viewer-header"><div><h3 id="country-model-title" tabindex="-1"></h3><p class="country-model-badge">3D 簡化示意・非實測模型</p></div><label class="country-model-picker">換一國試玩<select id="country-model-select"></select></label><button type="button" data-action="close" aria-label="收起 3D 展示">收起</button></header>
    <div class="country-viewer-body"><div class="country-model-visual"><div class="country-model-stage"></div><div class="country-inline-photo" tabindex="-1" hidden></div>
    <p class="country-model-status" role="status" aria-live="polite"></p><button type="button" class="country-model-retry" hidden>重試 3D</button>
    <div class="country-play-actions"><button type="button" data-play="toggle" class="country-play-primary" hidden></button><button type="button" class="country-model-photo-link" aria-pressed="false">對照實拍</button></div>
    <div class="country-model-play" hidden><p class="country-play-description"></p><div class="country-play-timeline"><label for="country-play-progress">慢慢看動作</label><input id="country-play-progress" type="range" min="0" max="100" value="0" step="1" aria-valuetext="尚未開始"><button type="button" data-play="reset">重來</button></div><p class="country-play-state" role="status" aria-live="polite"></p>
    <div class="country-part-picker" role="group" aria-label="試玩模型部件"><p>點部件，看看怎麼動</p><div class="country-part-buttons"></div></div></div>
    <details class="country-model-tools" hidden><summary>檢視工具</summary><div class="country-model-controls"><div class="country-model-view-label">視角 <span class="country-model-view-state">全景</span></div><div class="country-model-views" role="group" aria-label="模型視角"><button type="button" data-view="overview" aria-pressed="true">全景</button><button type="button" data-view="front" aria-pressed="false">正面</button><button type="button" data-view="side" aria-pressed="false">側面</button><button type="button" data-view="back" aria-pressed="false">背面</button></div><div class="country-model-zoom" role="group" aria-label="模型縮放"><button type="button" data-zoom="-1" aria-label="縮小模型">縮小</button><button type="button" data-zoom="1" aria-label="放大模型">放大</button><button type="button" data-play="rotate" aria-pressed="false">自動旋轉</button></div></div>
    <p class="country-model-help"><span class="country-pointer-help">拖曳旋轉・Ctrl＋滾輪縮放</span><span class="country-touch-help">拖曳旋轉・雙指縮放；在模型外滑動頁面</span><span class="country-keyboard-help">方向鍵旋轉、＋／− 縮放、Home 回到全景；Enter 播放或暫停。</span></p></details></div>
    <div class="country-model-copy"><p class="country-model-description"></p><ul class="country-model-features"></ul><p class="country-model-limitation"></p><p class="country-model-note">背面、內部、比例與動作為簡化推定；不表示現場尺寸、實際操作方式或設備效能。</p><button type="button" class="country-model-evidence">看完整案例與來源</button></div></div>`;
  const stage=viewer.querySelector('.country-model-stage'),status=viewer.querySelector('.country-model-status');
  const retry=viewer.querySelector('.country-model-retry'),tools=viewer.querySelector('.country-model-tools');
  const controls=viewer.querySelector('.country-model-controls'),picker=viewer.querySelector('select');
  const title=viewer.querySelector('h3'),photoLink=viewer.querySelector('.country-model-photo-link');
  const photoRegion=viewer.querySelector('.country-inline-photo'),playControls=viewer.querySelector('.country-model-play');
  const playButton=viewer.querySelector('[data-play="toggle"]'),rotationButton=viewer.querySelector('[data-play="rotate"]');
  const timeline=viewer.querySelector('#country-play-progress'),playState=viewer.querySelector('.country-play-state');
  const partButtons=viewer.querySelector('.country-part-buttons');
  const buttons=new Map(),photos=new Map(),returns=new Map();
  let scene,sceneLoading,sceneFactory,selected='japan',rendered,opener,active=true,opened=true,failed=false,showingPhoto=false,parts=[],scrollFrame=0;

  function updateView({view,canZoomIn,canZoomOut}){
    const labels={overview:'全景',front:'正面',side:'側面',back:'背面'};
    for(const button of controls.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===view));
    viewer.querySelector('.country-model-view-state').textContent=labels[view]||'自由視角';
    controls.querySelector('[data-zoom="1"]').disabled=!canZoomIn;
    controls.querySelector('[data-zoom="-1"]').disabled=!canZoomOut;
  }
  function updatePlayback({state,progress,rotating,reducedMotion,suspended,partId=null}){
    const part=parts.find(item=>item.id===partId),data=COUNTRY_MODELS[selected];
    const labels={ready:part?'試試'+part.label:data.playLabel,playing:'暫停示意',paused:'繼續示意',complete:'再玩一次'};
    playButton.textContent=labels[state];playControls.dataset.state=state;
    viewer.querySelector('.country-play-description').textContent=part?.description||data.playDescription;
    for(const button of partButtons.children)button.setAttribute('aria-pressed',String(button.dataset.part===(partId||'')));
    rotationButton.setAttribute('aria-pressed',String(rotating));
    rotationButton.textContent=rotating?'停止旋轉':'自動旋轉';rotationButton.disabled=reducedMotion;
    const percent=Math.round(progress*100);timeline.value=percent;
    timeline.setAttribute('aria-valuetext',percent===0?'尚未開始':percent===100?'演示完成':`動作 ${percent}%`);
    const message=reducedMotion?'已減少動態效果；拖動進度可逐格看動作。':state==='playing'?(suspended?'暫停顯示時保留進度。':'示意播放中；可按暫停或拖動進度。'):state==='paused'?'停在這一刻，拖動進度看看構造。':state==='complete'?'再點一個部件，或換一國玩玩。':'點模型的部件，或按按鈕開始示意。';
    if(playState.textContent!==message)playState.textContent=message;
  }
  function renderParts(){
    parts=scene.getParts();
    partButtons.replaceChildren(...[{id:'',label:'完整示意'},...parts].map(part=>{
      const button=document.createElement('button');button.type='button';button.dataset.part=part.id;
      button.textContent=part.label;button.setAttribute('aria-pressed',String(!part.id));return button;
    }));
  }
  function syncVisibility(){
    stage.hidden=showingPhoto||failed;photoRegion.hidden=!showingPhoto;
    const ready=Boolean(scene&&rendered===selected&&!failed&&!showingPhoto);
    playControls.hidden=!ready;playButton.hidden=!ready;tools.hidden=!ready;
    scene?.setActive(active&&opened&&!failed&&!showingPhoto);
    photoLink.textContent=showingPhoto?'返回 3D 試玩':selected==='australia'?'查看官方照片來源':'對照實拍';
    photoLink.setAttribute('aria-pressed',String(showingPhoto));
  }
  function failure(){
    failed=true;syncVisibility();retry.hidden=false;
    retry.textContent=sceneFactory?'重試 3D':'重新載入頁面';
    status.textContent='3D 暫時無法顯示。可對照實拍、閱讀來源，或重試載入。';
  }
  function showModel(){
    if(!scene||!opened||failed)return;
    try{
      if(rendered!==selected){parts=[];scene.setModel(selected);rendered=selected;renderParts()}
      syncVisibility();retry.hidden=true;
      status.textContent='';
    }catch{failure()}
  }
  async function loadScene(){
    if(sceneLoading)return sceneLoading;
    status.textContent='正在載入可玩的 3D 示意…';retry.hidden=true;
    sceneLoading=import('./country-scene.js').then(module=>{
      sceneFactory=module.createCountryScene;
      scene=sceneFactory(stage,{onFailure:failure,onChange:updateView,onPlayback:updatePlayback});
      if(opened)showModel();else scene.setActive(false);
    }).catch(()=>{stage.replaceChildren();failure()}).finally(()=>{sceneLoading=null});
    return sceneLoading;
  }
  function reveal(element){element.focus({preventScroll:true});element.scrollIntoView({block:'start',behavior:'instant'})}
  function setCurrent(id){
    reader.value=id;
    for(const button of panel.querySelectorAll('.country-index [data-country-target]')){
      if(button.dataset.countryTarget==='country-'+id)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');
    }
  }
  function setPhoto(id){
    const photo=photos.get(id).cloneNode(true);
    photo.removeAttribute('tabindex');photo.querySelector('.country-model-return')?.remove();
    const img=photo.querySelector('img');
    if(img){
      img.loading='eager';
      const fail=()=>{img.hidden=true;photo.querySelector('.country-photo-error').hidden=false};
      img.addEventListener('error',fail,{once:true});if(img.complete&&!img.naturalWidth)fail();
    }
    photoRegion.replaceChildren(photo);
  }
  function open(id,{focus=true,origin=buttons.get(id)}={}){
    if(!COUNTRY_MODELS[id])return;
    const changed=selected!==id;selected=id;opener=origin;opened=true;showingPhoto=false;
    const data=COUNTRY_MODELS[id];
    for(const [key,button] of buttons){button.setAttribute('aria-expanded',String(key===id));returns.get(key).hidden=key!==id}
    viewer.hidden=false;document.getElementById('country-reopen').hidden=true;picker.value=id;
    title.textContent=data.title;viewer.querySelector('.country-play-description').textContent=data.playDescription;
    viewer.querySelector('.country-model-description').textContent=data.description;
    viewer.querySelector('.country-model-limitation').textContent=data.limitation;
    viewer.querySelector('.country-model-features').replaceChildren(...data.features.map(text=>{const li=document.createElement('li');li.textContent=text;return li}));
    if(changed||!photoRegion.childElementCount)setPhoto(id);
    if(scene&&!failed)showModel();else if(failed)failure();else loadScene();
    syncVisibility();setCurrent(id);
    if(focus)reveal(title);
  }
  function navigate(target,origin){
    const id=target.id.replace('country-','');
    if(COUNTRY_MODELS[id]){open(id,{focus:false,origin});setCurrent(id)}
    if(window.innerWidth<640)document.querySelector('.country-index-disclosure').open=false;
    reveal(target);
  }
  for(const id of ids){
    const heading=document.getElementById('country-'+id),article=heading.closest('article');
    const label=heading.firstChild.textContent.trim(),photo=article.querySelector('.country-photo');
    for(const select of [picker,reader]){const option=document.createElement('option');option.value=id;option.textContent=label;select.append(option)}
    const button=document.createElement('button');button.type='button';button.className='country-model-open';
    button.textContent=['india','australia'].includes(id)?'試玩這個收運示意':'試玩這個 3D 垃圾桶';
    button.setAttribute('aria-label',label+'：'+button.textContent);button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',viewer.id);
    heading.after(button);buttons.set(id,button);button.addEventListener('click',()=>open(id,{origin:button}));
    photos.set(id,photo);photo.tabIndex=-1;
    const back=document.createElement('button');back.type='button';back.className='country-model-return';back.textContent='返回 3D 試玩';back.hidden=true;
    back.addEventListener('click',()=>open(id,{origin:back}));photo.prepend(back);returns.set(id,back);
  }
  const indexLayout=window.matchMedia('(min-width:640px)');
  const adaptIndex=()=>{panel.querySelector('.country-index-disclosure').open=indexLayout.matches};
  adaptIndex();indexLayout.addEventListener('change',adaptIndex);
  launch.replaceChildren(viewer);
  initializeCountryComparison(document.getElementById('country-comparison-list'),{onSelect:id=>navigate(document.getElementById(id))});
  picker.addEventListener('change',()=>{open(picker.value,{focus:false,origin:picker});picker.focus({preventScroll:true})});
  reader.addEventListener('change',()=>navigate(document.getElementById('country-'+reader.value),reader));
  photoLink.addEventListener('click',()=>{showingPhoto=!showingPhoto;syncVisibility();if(showingPhoto)reveal(photoRegion);else reveal(title)});
  viewer.querySelector('.country-model-evidence').addEventListener('click',()=>navigate(document.getElementById('country-'+selected)));
  viewer.querySelector('[data-action="close"]').addEventListener('click',()=>{
    opened=false;viewer.hidden=true;scene?.setActive(false);returns.get(selected).hidden=true;buttons.get(selected).setAttribute('aria-expanded','false');
    const reopen=document.getElementById('country-reopen');reopen.hidden=false;
    reveal(opener&&!viewer.contains(opener)&&!opener.hidden?opener:reopen);
  });
  document.getElementById('country-reopen').addEventListener('click',event=>open(selected,{origin:event.currentTarget}));
  viewer.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||!scene)return;
    if(button.dataset.view)scene.setView(button.dataset.view);
    if(button.dataset.zoom)scene.zoom(Number(button.dataset.zoom));
    if(button.dataset.play==='toggle')scene.play();
    if(button.dataset.play==='rotate')scene.toggleRotation();
    if(button.dataset.play==='reset')scene.reset();
    if(button.dataset.part!==undefined)scene.selectPart(button.dataset.part||null);
  });
  timeline.addEventListener('input',()=>scene?.seek(Number(timeline.value)/100));
  retry.addEventListener('click',()=>{
    if(!sceneFactory){location.reload();return}
    scene?.dispose();scene=null;rendered=null;failed=false;showingPhoto=false;syncVisibility();loadScene();
  });
  function trackReading(){
    scrollFrame=0;if(!active)return;
    const line=window.innerWidth<960?145:80;
    const article=articles.find(item=>{const rect=item.getBoundingClientRect();return rect.top<=line&&rect.bottom>line});
    if(article)setCurrent(article.getAttribute('aria-labelledby').replace('country-',''));
  }
  function scheduleReading(){if(active&&!scrollFrame)scrollFrame=requestAnimationFrame(trackReading)}
  window.addEventListener('scroll',scheduleReading,{passive:true});window.addEventListener('resize',scheduleReading);
  open(selected,{focus:false,origin:document.getElementById('country-reopen')});
  return {navigate,setActive(value){active=Boolean(value);syncVisibility();scheduleReading()}};
}
