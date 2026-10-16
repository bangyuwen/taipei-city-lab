import {COUNTRY_MODELS} from './country-model-data.js';

export function initializeCountryExperience(){
  const panel=document.getElementById('panel-countries');
  const viewer=document.createElement('section');
  viewer.id='country-viewer';viewer.className='country-viewer';viewer.hidden=true;
  viewer.setAttribute('aria-labelledby','country-model-title');
  viewer.innerHTML=`<header class="country-viewer-header"><div><p class="country-model-kicker">3D 外觀示意</p><h5 id="country-model-title"></h5></div><button type="button" data-action="close" aria-label="關閉 3D 展示">關閉 ×</button></header>
    <div class="country-viewer-body"><div class="country-model-visual"><div class="country-model-stage"></div><p class="country-model-status" role="status" aria-live="polite"></p><button type="button" class="country-model-retry" hidden>重試 3D</button>
    <div class="country-model-controls" role="group" aria-label="模型視角" hidden><button type="button" data-view="overview">全景</button><button type="button" data-view="front">正面</button><button type="button" data-view="side">側面</button><button type="button" data-view="back">背面</button><button type="button" data-zoom="1" aria-label="放大模型">＋</button><button type="button" data-zoom="-1" aria-label="縮小模型">−</button></div>
    <p class="country-model-help">拖曳旋轉・雙指縮放<br>鍵盤：方向鍵旋轉、＋／− 縮放、Home 全景</p></div>
    <div class="country-model-copy"><p class="country-model-description"></p><ul class="country-model-features"></ul><p class="country-model-limitation"></p><p class="country-model-note">非實測、非原廠模型。背面、內部與比例為簡化推定；不表示現場尺寸或設備效能。請對照下方照片與來源。</p></div></div>`;
  const stage=viewer.querySelector('.country-model-stage'),status=viewer.querySelector('.country-model-status');
  const retry=viewer.querySelector('.country-model-retry'),controls=viewer.querySelector('.country-model-controls');
  const buttons=new Map();
  let scene,sceneLoading,sceneFactory,selected,opener,active=true,opened=false,failed=false;
  function failure(){
    failed=true;scene?.setActive(false);stage.hidden=true;controls.hidden=true;retry.hidden=false;
    retry.textContent=sceneFactory?'重試 3D':'重新載入頁面';
    status.textContent='3D 暫時無法顯示。仍可閱讀外觀說明與下方照片，或重試載入。';
  }
  function showModel(){
    if(!scene||!opened||failed)return;
    try{stage.hidden=false;scene.setModel(selected);scene.setActive(active);controls.hidden=false;retry.hidden=true;status.textContent='外觀示意已載入。'}catch{failure()}
  }
  async function loadScene(){
    if(sceneLoading)return sceneLoading;
    status.textContent='正在載入 3D 外觀示意…';retry.hidden=true;controls.hidden=true;
    sceneLoading=import('./country-scene.js').then(module=>{
      sceneFactory=module.createCountryScene;
      scene=sceneFactory(stage,{onFailure:failure});
      if(opened)showModel();else scene.setActive(false);
    }).catch(()=>{stage.replaceChildren();failure()}).finally(()=>{sceneLoading=null});
    return sceneLoading;
  }
  function open(id,button){
    selected=id;opener=button;opened=true;const data=COUNTRY_MODELS[id];
    for(const item of buttons.values())item.setAttribute('aria-expanded',String(item===button));
    button.after(viewer);viewer.hidden=false;
    viewer.querySelector('h5').textContent=data.title;
    viewer.querySelector('.country-model-description').textContent=data.description;
    viewer.querySelector('.country-model-limitation').textContent=data.limitation;
    const features=viewer.querySelector('.country-model-features');features.replaceChildren(...data.features.map(text=>{const li=document.createElement('li');li.textContent=text;return li}));
    if(scene&&!failed)showModel();else if(failed)failure();else loadScene();
    viewer.querySelector('[data-action="close"]').focus({preventScroll:true});
    viewer.scrollIntoView({block:'nearest',behavior:'instant'});
  }
  for(const [id] of Object.entries(COUNTRY_MODELS)){
    const heading=document.getElementById('country-'+id);
    if(!heading)continue;
    const button=document.createElement('button');button.type='button';button.className='country-model-open';
    button.textContent=['india','australia'].includes(id)?'查看 3D 收運示意':'查看 3D 外觀示意';
    button.setAttribute('aria-label',heading.firstChild.textContent.trim()+'：'+button.textContent);
    button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',viewer.id);
    heading.after(button);buttons.set(id,button);button.addEventListener('click',()=>open(id,button));
  }
  panel.append(viewer);
  viewer.querySelector('[data-action="close"]').addEventListener('click',()=>{
    opened=false;viewer.hidden=true;scene?.setActive(false);opener?.setAttribute('aria-expanded','false');opener?.focus({preventScroll:true});
  });
  controls.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||!scene)return;
    if(button.dataset.view)scene.setView(button.dataset.view);
    if(button.dataset.zoom)scene.zoom(Number(button.dataset.zoom));
  });
  retry.addEventListener('click',()=>{
    if(!sceneFactory){location.reload();return}
    scene?.dispose();scene=null;failed=false;stage.hidden=false;loadScene();
  });
  return {setActive(value){active=Boolean(value);scene?.setActive(active&&opened&&!failed)}};
}
