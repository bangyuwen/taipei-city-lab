import {COUNTRY_MODELS} from './country-model-data.js';
import {COUNTRY_STORIES, TAIPEI_SCENARIOS} from './country-stories.js';
import {initializeCountryComparison} from './country-comparison.js';

const evidenceLabels={photo:'照片可見',document:'文件記載',illustration:'模型推定',unknown:'尚未確認'};

function sourceLink(source){
  const link=document.createElement('a');
  link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
  link.className='country-source';link.textContent=source.label+' ↗';
  return link;
}

export function initializeCountryExperience(){
  const panel=document.getElementById('panel-countries');
  const launch=document.getElementById('country-playground');
  const reader=document.getElementById('country-reader-select');
  const articles=[...panel.querySelectorAll('.country-case')];
  const ids=articles.map(article=>article.getAttribute('aria-labelledby').replace('country-',''));
  const viewer=document.createElement('section');
  viewer.id='country-viewer';viewer.className='country-viewer';
  viewer.setAttribute('aria-labelledby','country-model-title');
  viewer.innerHTML=`<header class="country-viewer-header"><div><p class="country-exhibit-kicker">正在試玩</p><h3 id="country-model-title" tabindex="-1"></h3><p class="country-model-badge">依照片製作的 3D 示意・非實測模型</p></div><label class="country-model-picker">換一國試玩<select id="country-model-select"></select></label></header>
    <p class="country-guide-notice country-screen-reader" role="status" aria-live="polite"></p>
    <div class="country-media-switch" role="group" aria-label="切換模型與照片"><button type="button" data-mode="model" aria-pressed="true">3D 示意</button><button type="button" data-mode="photo" aria-pressed="false">實拍對照</button></div>
    <div class="country-viewer-media"><div class="country-model-visual"><p class="country-media-label">可玩的外觀示意 <span>點部件，看看怎麼動</span></p><div class="country-model-stage"></div><p class="country-model-status" role="status" aria-live="polite"></p><button type="button" class="country-model-retry" hidden>重試 3D</button></div><div class="country-photo-column"><p class="country-media-label country-photo-label">實拍與出處 <span>保留完整照片</span></p><div class="country-inline-photo"></div></div></div>
    <div class="country-exhibit-shortcuts"><button type="button" class="country-model-evidence">看完整案例與來源</button><button type="button" data-jump="comparison">依用途比較各國</button><button type="button" class="country-reading-return" hidden>回到剛才閱讀位置</button></div>
    <div class="country-viewer-body"><div class="country-play-workspace">
      <div class="country-play-actions"><button type="button" data-play="toggle" class="country-play-primary" hidden></button><button type="button" class="country-guide-toggle" aria-expanded="false" aria-controls="country-guide">帶我看 3 個重點</button></div>
      <section id="country-guide" class="country-guide" aria-labelledby="country-guide-heading" hidden><p class="country-guide-count"></p><h4 id="country-guide-heading" tabindex="-1"></h4><p class="country-guide-text"></p><div class="country-guide-source"></div><div class="country-guide-navigation"><button type="button" data-guide="previous">上一個</button><button type="button" data-guide="next">下一個</button></div><details class="country-question"><summary>先猜一題，再看來源怎麼說</summary><form></form></details></section>
      <div class="country-model-play" hidden><p class="country-play-description"></p><p class="country-play-state" role="status" aria-live="polite"></p><div class="country-part-picker" role="group" aria-label="試玩模型部件"><p>也可以自由挑一個部件</p><div class="country-part-buttons"></div></div>
      <details class="country-timeline-tools"><summary>慢慢看動作</summary><div class="country-play-timeline"><label for="country-play-progress">動作進度</label><input id="country-play-progress" type="range" min="0" max="100" value="0" step="1" aria-valuetext="尚未開始"><button type="button" data-play="reset">重來</button></div></details></div>
      <details class="country-model-tools" hidden><summary>旋轉、縮放與視角</summary><div class="country-model-controls"><div class="country-model-view-label">目前視角 <span class="country-model-view-state">全景</span></div><div class="country-model-views" role="group" aria-label="模型視角"><button type="button" data-view="overview" aria-pressed="true">全景</button><button type="button" data-view="front" aria-pressed="false">正面</button><button type="button" data-view="side" aria-pressed="false">側面</button><button type="button" data-view="back" aria-pressed="false">背面</button></div><div class="country-model-zoom" role="group" aria-label="模型縮放"><button type="button" data-zoom="-1" aria-label="縮小模型">縮小</button><button type="button" data-zoom="1" aria-label="放大模型">放大</button><button type="button" data-play="rotate" aria-pressed="false">自動旋轉</button></div></div><p class="country-model-help"><span class="country-pointer-help">拖曳旋轉・Ctrl＋滾輪縮放</span><span class="country-touch-help">拖曳旋轉・雙指縮放；在模型外滑動頁面</span><span class="country-keyboard-help">方向鍵旋轉、＋／− 縮放、Home 回到全景；Enter 播放或暫停。</span></p></details>
    </div><div class="country-model-copy"><section class="country-observation" aria-labelledby="country-observation-heading"><p class="country-exhibit-kicker">這個部件告訴我們什麼</p><h4 id="country-observation-heading"></h4><p class="country-observation-text"></p><p class="country-observation-limit"></p><p class="country-takeaway" hidden></p></section><details class="country-evidence-details"><summary>照片、文件與推定，分開看</summary><ul class="country-evidence-list"></ul><p class="country-model-limitation"></p><p class="country-model-note">背面、內部、比例與動作為簡化推定；不表示現場尺寸、實際操作方式或設備效能。動畫物件也不是分類指引。</p></details></div></div>`;
  const stage=viewer.querySelector('.country-model-stage'),status=viewer.querySelector('.country-model-status');
  const retry=viewer.querySelector('.country-model-retry'),tools=viewer.querySelector('.country-model-tools');
  const controls=viewer.querySelector('.country-model-controls'),picker=viewer.querySelector('select');
  const title=viewer.querySelector('h3'),photoRegion=viewer.querySelector('.country-inline-photo');
  const photoColumn=viewer.querySelector('.country-photo-column'),modelColumn=viewer.querySelector('.country-model-visual');
  const playControls=viewer.querySelector('.country-model-play'),playButton=viewer.querySelector('[data-play="toggle"]');
  const rotationButton=viewer.querySelector('[data-play="rotate"]'),timeline=viewer.querySelector('#country-play-progress');
  const playState=viewer.querySelector('.country-play-state'),partButtons=viewer.querySelector('.country-part-buttons');
  const guide=viewer.querySelector('#country-guide'),guideToggle=viewer.querySelector('.country-guide-toggle');
  const guideHeading=viewer.querySelector('#country-guide-heading'),notice=viewer.querySelector('.country-guide-notice');
  const readingReturn=viewer.querySelector('.country-reading-return');
  const buttons=new Map(),photos=new Map(),returns=new Map();
  const compact=window.matchMedia('(max-width:760px)');
  // Keep the primary action beside the model, independent of photo-caption height.
  stage.after(guide,viewer.querySelector('.country-play-actions'));
  modelColumn.append(viewer.querySelector('.country-play-workspace'));
  let scene,sceneLoading,sceneFactory,selected='japan',rendered,active=true,failed=false,showingPhoto=false;
  let parts=[],scrollFrame=0,guideStep=null,readingOrigin=null,playbackSignature='',observedPart;

  function updateView({view,canZoomIn,canZoomOut}){
    const labels={overview:'全景',front:'正面',side:'側面',back:'背面'};
    for(const button of controls.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===view));
    viewer.querySelector('.country-model-view-state').textContent=labels[view]||'自由視角';
    controls.querySelector('[data-zoom="1"]').disabled=!canZoomIn;
    controls.querySelector('[data-zoom="-1"]').disabled=!canZoomOut;
  }
  function renderObservation(partId){
    const story=COUNTRY_STORIES[selected],part=parts.find(item=>item.id===partId),note=story.partNotes[partId];
    viewer.querySelector('#country-observation-heading').textContent=part?.label||'先認識它服務的情境';
    viewer.querySelector('.country-observation-text').textContent=note?.observation||story.intro;
    viewer.querySelector('.country-observation-limit').textContent=note?'模型推定：'+note.inference:'試玩用來看外觀與動作；營運方式請對照下方文件。';
  }
  function updatePlayback({state,progress,rotating,reducedMotion,suspended,partId=null}){
    const signature=[state,rotating,reducedMotion,suspended,partId].join('|');
    const percent=Math.round(progress*100);timeline.value=percent;
    timeline.setAttribute('aria-valuetext',percent===0?'尚未開始':percent===100?'演示完成':`動作 ${percent}%`);
    if(playbackSignature===signature)return;
    playbackSignature=signature;
    const part=parts.find(item=>item.id===partId),data=COUNTRY_MODELS[selected];
    const labels={ready:part?'試試'+part.label:data.playLabel,playing:'暫停示意',paused:'繼續示意',complete:'再玩一次'};
    playButton.textContent=labels[state];playControls.dataset.state=state;
    viewer.querySelector('.country-play-description').textContent=part?.description||data.playDescription;
    for(const button of partButtons.children)button.setAttribute('aria-pressed',String(button.dataset.part===(partId||'')));
    rotationButton.setAttribute('aria-pressed',String(rotating));
    rotationButton.textContent=rotating?'停止旋轉':'自動旋轉';rotationButton.disabled=reducedMotion;
    playState.textContent=reducedMotion?'已減少動態效果；可用進度控制逐格看。':state==='playing'?(suspended?'保留目前進度，回到模型即可繼續。':'示意播放中，可隨時暫停。'):state==='paused'?'停在這一刻，展開「慢慢看動作」可逐格查看。':state==='complete'?'示意完成，看看這個案例可以學到什麼。':'按播放，或點選模型上的部件。';
    viewer.querySelector('.country-takeaway').hidden=state!=='complete';
    if(observedPart!==partId){observedPart=partId;renderObservation(partId)}
  }
  function renderParts(){
    parts=scene.getParts();
    partButtons.replaceChildren(...[{id:'',label:'完整示意'},...parts].map(part=>{
      const button=document.createElement('button');button.type='button';button.dataset.part=part.id;
      button.textContent=part.label;button.setAttribute('aria-pressed',String(!part.id));return button;
    }));
  }
  function syncVisibility(){
    const photoOnly=compact.matches&&showingPhoto;
    modelColumn.hidden=photoOnly;photoColumn.hidden=compact.matches&&!showingPhoto;
    stage.hidden=failed;
    const ready=Boolean(scene&&rendered===selected&&!failed&&!photoOnly);
    playControls.hidden=!ready;playButton.hidden=!ready;tools.hidden=!ready;
    scene?.setActive(active&&!failed&&!photoOnly);
    viewer.dataset.media=showingPhoto?'photo':'model';
    for(const button of viewer.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String((button.dataset.mode==='photo')===showingPhoto));
  }
  function failure(){
    failed=true;syncVisibility();retry.hidden=false;
    retry.textContent=sceneFactory?'重試 3D':'重新載入頁面';
    status.textContent='3D 暫時無法顯示。仍可切換實拍、閱讀重點與來源，或重試載入。';
  }
  function showModel(){
    if(!scene||failed)return;
    try{
      if(rendered!==selected){
        parts=[];playbackSignature='';observedPart=undefined;
        scene.setModel(selected);rendered=selected;renderParts();
        if(guideStep!==null)selectGuideView();
      }
      syncVisibility();retry.hidden=true;status.textContent='';
    }catch{failure()}
  }
  async function loadScene(){
    if(sceneLoading)return sceneLoading;
    status.textContent='正在載入可玩的 3D 示意…';retry.hidden=true;
    sceneLoading=import('./country-scene.js').then(module=>{
      sceneFactory=module.createCountryScene;
      scene=sceneFactory(stage,{onFailure:failure,onChange:updateView,onPlayback:updatePlayback});
      showModel();
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
    viewer.querySelector('.country-photo-label').firstChild.textContent=id==='australia'?'官方照片來源 ':'實拍與出處 ';
  }
  function renderEvidence(){
    const story=COUNTRY_STORIES[selected];
    viewer.querySelector('.country-evidence-list').replaceChildren(...story.evidence.map(entry=>{
      const li=document.createElement('li'),label=document.createElement('strong'),text=document.createElement('p');
      label.className='country-evidence-kind';label.textContent=evidenceLabels[entry.kind];
      text.textContent=entry.text;li.append(label,text);if(entry.source)li.append(sourceLink(entry.source));return li;
    }));
    viewer.querySelector('.country-model-limitation').textContent=COUNTRY_MODELS[selected].limitation;
    viewer.querySelector('.country-takeaway').textContent=story.takeaway;
    viewer.querySelector('.country-takeaway').hidden=true;
  }
  function renderQuestion(){
    const question=COUNTRY_STORIES[selected].question,form=viewer.querySelector('.country-question form');
    const fieldset=document.createElement('fieldset'),legend=document.createElement('legend');
    legend.textContent=question.prompt;fieldset.append(legend);
    // Alternate the starting position without changing the authored answer or storing a score.
    const options=ids.indexOf(selected)%2?[...question.options].reverse():question.options;
    for(const option of options){
      const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
      input.type='radio';input.name='country-prediction';input.value=option.id;input.required=true;text.textContent=option.label;
      label.append(input,text);fieldset.append(label);
    }
    const submit=document.createElement('button');submit.type='submit';submit.textContent='看看說明';
    const feedback=document.createElement('div');feedback.className='country-question-feedback';feedback.setAttribute('role','status');
    form.replaceChildren(fieldset,submit,feedback);
    form.onsubmit=event=>{
      event.preventDefault();const answer=form.querySelector('input:checked');if(!answer)return;
      const text=document.createElement('p');text.textContent=(answer.value===question.answerId?'和來源一致。':'來源提供了另一個線索。')+question.explanation;
      feedback.replaceChildren(text,sourceLink(question.source));submit.textContent='再看看說明';
    };
    form.onchange=()=>{feedback.replaceChildren();submit.textContent='看看說明'};
    viewer.querySelector('.country-question').open=false;
  }
  function selectGuideView(){
    if(!scene||failed||rendered!==selected||guideStep===null)return;
    const stop=COUNTRY_STORIES[selected].stops[guideStep];
    scene.selectPart(stop.partId,{play:false});scene.setView(stop.view);
  }
  function showGuideStep(){
    const stop=COUNTRY_STORIES[selected].stops[guideStep];
    viewer.querySelector('.country-guide-count').textContent=`重點 ${guideStep+1} / 3 · ${evidenceLabels[stop.kind]}`;
    guideHeading.textContent=stop.title;viewer.querySelector('.country-guide-text').textContent=stop.text;
    const source=viewer.querySelector('.country-guide-source');source.replaceChildren();if(stop.source)source.append(sourceLink(stop.source));
    viewer.querySelector('[data-guide="previous"]').disabled=guideStep===0;
    viewer.querySelector('[data-guide="next"]').textContent=guideStep===2?'完成導覽':'下一個重點';
    notice.textContent=`重點 ${guideStep+1}，${stop.title}`;selectGuideView();
    if(!failed)stage.scrollIntoView({block:'start',behavior:'instant'});
  }
  function endGuide({focus=false,announce=true}={}){
    guideStep=null;guide.hidden=true;guideToggle.setAttribute('aria-expanded','false');guideToggle.textContent='帶我看 3 個重點';
    if(announce)notice.textContent='導覽結束，可以繼續自由探索。';
    if(focus)guideToggle.focus({preventScroll:true});
  }
  function open(id,{focus=true,origin=null}={}){
    if(!COUNTRY_MODELS[id])return;
    const changed=selected!==id;
    if(origin&&!viewer.contains(origin)){
      readingOrigin=origin.closest('.country-case')?.querySelector('h4')||origin.closest('details')?.querySelector('summary')||origin;
      readingReturn.hidden=false;
    }
    if(changed){
      const guided=guideStep!==null;endGuide({announce:false});selected=id;
      if(guided)notice.textContent='已切換國家並結束上一段導覽。';
      playbackSignature='';observedPart=undefined;
    }
    for(const [key,button] of buttons){button.setAttribute('aria-expanded',String(key===id));returns.get(key).hidden=key!==id}
    picker.value=id;title.textContent=COUNTRY_MODELS[id].title;
    if(changed||!photoRegion.childElementCount){setPhoto(id);renderEvidence();renderQuestion();renderObservation(null)}
    if(scene&&!failed)showModel();else if(failed)failure();else loadScene();
    syncVisibility();if(focus)reveal(title);
  }
  function navigate(target){
    if(!target)return;
    const id=target.id.replace('country-','');if(COUNTRY_MODELS[id])setCurrent(id);
    if(window.innerWidth<640&&target.id!=='country-index-heading')panel.querySelector('.country-index-disclosure').open=false;
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
    photos.set(id,photo);
    const back=document.createElement('button');back.type='button';back.className='country-model-return';back.textContent='返回 3D 試玩';back.hidden=true;
    back.addEventListener('click',()=>open(id,{origin:back}));photo.prepend(back);returns.set(id,back);
  }
  const indexLayout=window.matchMedia('(min-width:640px)');
  const adaptIndex=()=>{panel.querySelector('.country-index-disclosure').open=indexLayout.matches};
  adaptIndex();indexLayout.addEventListener('change',adaptIndex);
  launch.replaceChildren(viewer);
  initializeCountryComparison(document.getElementById('country-comparison-list'),{
    onSelect:id=>navigate(document.getElementById(id)),
    onPlay:(id,origin)=>open(id.replace('country-',''),{origin})
  });
  const scenarios=document.getElementById('country-taipei-scenarios');
  for(const scenario of TAIPEI_SCENARIOS){
    const details=document.createElement('details'),summary=document.createElement('summary'),question=document.createElement('p'),answer=document.createElement('p');
    summary.textContent=scenario.title;question.textContent=scenario.question;answer.textContent=scenario.answer;
    details.append(summary,question,answer,sourceLink(scenario.source));
    const related=document.createElement('div');related.className='country-scenario-related';
    const label=document.createElement('p');label.textContent='延伸比較服務情境';related.append(label);
    for(const id of scenario.relatedIds){
      const button=document.createElement('button');button.type='button';button.textContent='試玩'+buttons.get(id).getAttribute('aria-label').split('：')[0];
      button.addEventListener('click',()=>open(id,{origin:button}));related.append(button);
    }
    details.append(related);scenarios.append(details);
  }
  picker.addEventListener('change',()=>open(picker.value,{focus:false}));
  reader.addEventListener('change',()=>navigate(document.getElementById('country-'+reader.value)));
  compact.addEventListener('change',syncVisibility);
  viewer.querySelector('.country-model-evidence').addEventListener('click',()=>navigate(document.getElementById('country-'+selected)));
  viewer.querySelector('[data-jump="comparison"]').addEventListener('click',()=>navigate(document.getElementById('country-comparison-heading')));
  readingReturn.addEventListener('click',()=>{
    if(!readingOrigin?.isConnected)return;
    reveal(readingOrigin.getClientRects().length?readingOrigin:document.getElementById('country-comparison-heading'));
  });
  guideToggle.addEventListener('click',()=>{
    if(guideStep!==null){endGuide({focus:true});return}
    guideStep=0;guide.hidden=false;guideToggle.setAttribute('aria-expanded','true');guideToggle.textContent='結束導覽';
    showGuideStep();guideHeading.focus({preventScroll:true});
  });
  viewer.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.mode){showingPhoto=button.dataset.mode==='photo';syncVisibility()}
    if(button.dataset.guide==='previous'&&guideStep>0){guideStep--;showGuideStep()}
    if(button.dataset.guide==='next'&&guideStep!==null){if(guideStep===2)endGuide({focus:true});else{guideStep++;showGuideStep()}}
    if(!scene||failed)return;
    if(button.dataset.view)scene.setView(button.dataset.view);
    if(button.dataset.zoom)scene.zoom(Number(button.dataset.zoom));
    if(button.dataset.play==='toggle')scene.play();
    if(button.dataset.play==='rotate')scene.toggleRotation();
    if(button.dataset.play==='reset')scene.reset();
    if(button.dataset.part!==undefined){
      if(guideStep!==null)endGuide();
      scene.selectPart(button.dataset.part||null);
      stage.scrollIntoView({block:'start',behavior:'instant'});
    }
  });
  timeline.addEventListener('input',()=>scene?.seek(Number(timeline.value)/100));
  retry.addEventListener('click',()=>{
    if(!sceneFactory){location.reload();return}
    scene?.dispose();scene=null;rendered=null;failed=false;syncVisibility();loadScene();
  });
  function trackReading(){
    scrollFrame=0;if(!active)return;
    const line=window.innerWidth<960?145:80;
    const article=articles.find(item=>{const rect=item.getBoundingClientRect();return rect.top<=line&&rect.bottom>line});
    if(article)setCurrent(article.getAttribute('aria-labelledby').replace('country-',''));
  }
  function scheduleReading(){if(active&&!scrollFrame)scrollFrame=requestAnimationFrame(trackReading)}
  window.addEventListener('scroll',scheduleReading,{passive:true});window.addEventListener('resize',scheduleReading);
  open(selected,{focus:false});
  return {navigate,setActive(value){active=Boolean(value);syncVisibility();scheduleReading()}};
}
