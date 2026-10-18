import {COUNTRY_MODELS} from './country-model-data.js';

// Enhance the published articles without abbreviating their photos, costs or evidence.
export function initializeCountryExperience(){
  const panel=document.getElementById('panel-countries');
  const reader=document.getElementById('country-reader-select');
  const articles=[...panel.querySelectorAll('.country-case')],cases=new Map();
  const index=panel.querySelector('.country-index');
  const viewer=document.createElement('section');
  viewer.id='country-viewer';viewer.className='country-viewer';viewer.setAttribute('aria-label','案例影像');
  viewer.innerHTML=`<div class="country-media-switch" role="group" aria-label="案例影像"><button type="button" data-mode="photo" aria-pressed="true">實拍照片</button><button type="button" data-mode="model" aria-pressed="false">3D 示意</button></div>
    <div class="country-viewer-media"><div class="country-photo-column"><div class="country-inline-photo"></div></div>
    <div class="country-model-visual" hidden><div class="country-model-stage"></div><p class="country-model-status" role="status" aria-live="polite"></p><button type="button" class="country-model-retry" hidden>重試 3D</button>
    <div class="country-model-controls" role="group" aria-label="3D 操作" hidden><button type="button" data-play="toggle">播放示意</button><button type="button" data-play="reset">重設</button><button type="button" data-zoom="-1" aria-label="縮小模型">縮小</button><button type="button" data-zoom="1" aria-label="放大模型">放大</button></div>
    <p class="country-play-state" role="status" aria-live="polite"></p><p class="country-model-help">拖曳旋轉；方向鍵旋轉、＋／− 縮放、Home 重設視角、Enter 播放或暫停。在模型外滑動可捲動頁面。</p>
    <p class="country-model-limitation"></p><p class="country-model-note">背面、內部、比例與動作為簡化推定，不表示實際尺寸、操作方式或設備效能。動畫物件不是分類指引。</p></div></div>`;
  const stage=viewer.querySelector('.country-model-stage'),status=viewer.querySelector('.country-model-status');
  const retry=viewer.querySelector('.country-model-retry'),controls=viewer.querySelector('.country-model-controls');
  const photoRegion=viewer.querySelector('.country-inline-photo'),photoColumn=viewer.querySelector('.country-photo-column');
  const modelColumn=viewer.querySelector('.country-model-visual'),playButton=viewer.querySelector('[data-play="toggle"]');
  const playState=viewer.querySelector('.country-play-state');
  let selected,scene,sceneLoading,sceneFactory,rendered,active=false,failed=false,mode='photo',playbackSignature='';
  for(const article of articles){
    const heading=article.querySelector(':scope > h3'),id=heading.id.replace('country-','');
    const supplement=article.querySelector('.country-media-supplement');
    const grid=supplement?.querySelector('.country-case-grid');
    let photo;
    if(grid){
      photo=grid.querySelector('.country-photo');
      const facts=grid.querySelector('.country-facts:not(.country-cost)'),cost=supplement.querySelector('.country-cost');
      const [appearance,audience,collection,evidence]=[...facts.children],takeaway=cost.children[1];
      const design=document.createElement('div'),term=document.createElement('dt'),text=document.createElement('dd');
      term.textContent='設計與使用';
      for(const field of [appearance,audience]){
        const paragraph=document.createElement('p');paragraph.append(...field.querySelector('dd').childNodes);text.append(paragraph);
      }
      design.append(term,text);collection.querySelector('dt').textContent='設備清運與維護';facts.replaceChildren(design,collection,takeaway);
      const evidenceSection=document.createElement('section');evidenceSection.className='country-case-evidence';
      const evidenceHeading=document.createElement('h5');evidenceHeading.textContent='設備證據與公開成本';
      const evidenceFacts=document.createElement('dl');evidenceFacts.className='country-facts';evidenceFacts.append(evidence);
      photo.remove();cost.remove();grid.replaceChildren(facts);
      evidenceSection.append(evidenceHeading,evidenceFacts,cost);supplement.append(evidenceSection);
      for(const button of supplement.querySelectorAll('.country-return,.country-model-open'))button.remove();
    }
    cases.set(id,{article,heading,grid,photo});
  }
  function updateView({canZoomIn,canZoomOut}){
    controls.querySelector('[data-zoom="1"]').disabled=!canZoomIn;
    controls.querySelector('[data-zoom="-1"]').disabled=!canZoomOut;
  }
  function updatePlayback({state,reducedMotion,suspended,partId=null}){
    const signature=[state,reducedMotion,suspended,partId].join('|');if(signature===playbackSignature)return;
    playbackSignature=signature;controls.dataset.state=state;
    playButton.textContent={ready:'播放示意',playing:'暫停',paused:'繼續播放',complete:'重播'}[state];
    playState.textContent=reducedMotion?'已減少動態效果；播放會直接顯示動作終點。':state==='playing'?(suspended?'已暫停，回到模型後繼續。':'示意播放中。'):'';
  }
  function syncVisibility(){
    photoColumn.hidden=mode!=='photo';modelColumn.hidden=mode!=='model';viewer.dataset.media=mode;
    for(const button of viewer.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
    stage.hidden=failed;controls.hidden=!scene||rendered!==selected||failed;
    scene?.setActive(active&&Boolean(cases.get(selected)?.grid)&&mode==='model'&&!failed);
  }
  function failure(){
    failed=true;retry.hidden=false;retry.textContent=sceneFactory?'重試 3D':'重新載入頁面';
    status.textContent='3D 暫時無法顯示。可重試，或切換實拍照片；本國策略、來源與設備成本仍可閱讀。';syncVisibility();
  }
  function showModel(){
    if(!scene||failed||!COUNTRY_MODELS[selected])return;
    try{
      if(rendered!==selected){playbackSignature='';scene.setModel(selected);rendered=selected}
      retry.hidden=true;status.textContent='';syncVisibility();
    }catch{failure()}
  }
  async function loadScene(){
    if(sceneLoading)return sceneLoading;
    status.textContent='正在載入 3D 示意…';retry.hidden=true;
    sceneLoading=import('./country-scene.js').then(module=>{
      sceneFactory=module.createCountryScene;
      scene=sceneFactory(stage,{onFailure:failure,onChange:updateView,onPlayback:updatePlayback});showModel();syncVisibility();
    }).catch(()=>{stage.replaceChildren();failure()}).finally(()=>{sceneLoading=null});
    return sceneLoading;
  }
  function requestedCountry(){
    const url=new URL(location.href);
    const target=document.getElementById(url.hash.slice(1));
    const article=target?.closest('.country-case');
    if(article)return article.getAttribute('aria-labelledby').replace('country-','');
    const id=url.searchParams.get('country');return cases.has(id)?id:null;
  }
  function selectCase(id,{updateURL=true,focus=false}={}){
    if(!cases.has(id))return;
    const changed=selected!==id;selected=id;reader.value=id;
    for(const [key,item] of cases)item.article.parentElement.hidden=key!==id;
    for(const link of index.querySelectorAll('[data-country-target]')){
      if(link.dataset.countryTarget==='country-'+id)link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    }
    const current=cases.get(id);
    if(changed){
      mode='photo';playbackSignature='';
      if(current.grid){
        current.grid.prepend(viewer);photoRegion.replaceChildren(current.photo);
        const img=current.photo.querySelector('img');if(img)img.loading='eager';
        viewer.querySelector('.country-model-limitation').textContent=COUNTRY_MODELS[id].limitation;
        viewer.querySelector('[data-mode="photo"]').textContent=id==='australia'?'實拍來源':'實拍照片';
      }else viewer.remove();
      document.getElementById('country-selection-status').textContent='正在閱讀'+current.article.dataset.countryName+'的策略與來源。';
    }
    syncVisibility();
    if(updateURL){
      const url=new URL(location.href);url.searchParams.set('country',id);url.hash='countries';
      if(url.href!==location.href)history.pushState(history.state,'',url);
    }
    if(focus){current.heading.focus({preventScroll:true});current.heading.scrollIntoView({block:'start',behavior:'instant'})}
  }
  function navigate(target){
    const article=target?.closest('.country-case');
    if(article)selectCase(article.getAttribute('aria-labelledby').replace('country-',''),{updateURL:false});
    else reader.focus({preventScroll:true});
  }
  reader.addEventListener('change',()=>selectCase(reader.value));
  panel.addEventListener('click',event=>{
    const link=event.target.closest('a[data-country-target]');
    if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();selectCase(link.dataset.countryTarget.replace('country-',''),{focus:true});
  });
  viewer.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.mode){
      mode=button.dataset.mode;syncVisibility();
      if(mode==='model'){if(scene&&!failed)showModel();else if(!failed)loadScene()}
    }
    if(!scene||failed)return;
    if(button.dataset.zoom)scene.zoom(Number(button.dataset.zoom));
    if(button.dataset.play==='toggle')scene.play();
    if(button.dataset.play==='reset'){scene.selectPart(null,{play:false});scene.setView()}
  });
  retry.addEventListener('click',()=>{
    if(!sceneFactory){location.reload();return}
    scene?.dispose();scene=null;rendered=null;failed=false;syncVisibility();loadScene();
  });
  function restoreSelection(){if(active)selectCase(requestedCountry()||cases.keys().next().value,{updateURL:false})}
  window.addEventListener('popstate',restoreSelection);
  window.addEventListener('hashchange',restoreSelection);
  panel.classList.add('country-reading-ready');
  selectCase(requestedCountry()||cases.keys().next().value,{updateURL:false});
  return {navigate,setActive(value){
    active=Boolean(value);const requested=requestedCountry();
    if(active&&requested&&requested!==selected)selectCase(requested,{updateURL:false});syncVisibility();
  }};
}
