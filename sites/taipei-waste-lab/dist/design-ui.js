import {designs,items,getDesign,normalizeParameters,getReadout,createExperience,transitionExperience,evaluateDeposit,getServiceStatus} from './design-model.js';
import {escapeHTML as esc} from './data-utils.js';
const $=id=>document.getElementById(id);
const marks={street:'<path d="M18 14h26v34H18zM14 14l4-8h26l4 8M24 23h14v6H24zM23 37h16"/>',sorting:'<path d="M5 12h52v36H5zM31 12v36M11 21h14v6H11zM37 21h14v6H37zM12 37h11M38 37h11"/>',hotspot:'<path d="M15 16h32v32H15zM11 13l5-8h30l5 8zM23 5l-2 8M36 5l2 8M22 23h18v7H22zM22 39h18M25 34v9M37 34v9"/>',household:'<path d="M8 11h46v37H8zM14 21h22v11H14zM42 20h6v8h-6zM13 40h24M42 36h6M25 21v11"/>'};
export function initializeDesignExperience(){
  let state=createExperience(),design=getDesign(state.designId),params=normalizeParameters(design),view='overview',active=false,scene,sceneLoading;
  $('design-options').innerHTML=designs.map(d=>`<button type="button" class="design-option" data-design="${d.id}" aria-pressed="${d.id===state.designId}"><svg viewBox="0 0 62 54" aria-hidden="true">${marks[d.id]}</svg><span><strong>${esc(d.name)}</strong><small>${esc(d.tagline)}</small></span></button>`).join('');
  $('design-item-buttons').innerHTML=items.map(item=>`<button type="button" data-design-item="${item.id}" aria-pressed="false">${esc(item.label)}</button>`).join('');
  function render(){
    design=getDesign(state.designId);params=normalizeParameters(design,{...params,fillPercent:state.fillPercent});
    const readout=getReadout(design,params),service=getServiceStatus(state),smart=state.designId==='hotspot',home=state.designId==='household';
    $('design-name').textContent=design.name;$('design-description').textContent=design.description;$('design-tradeoff').textContent=design.tradeoff;$('design-collection').textContent=design.collection;
    $('design-scene-label').textContent=design.name;
    for(const button of document.querySelectorAll('[data-design]'))button.setAttribute('aria-pressed',String(button.dataset.design===state.designId));
    for(const [attribute,value] of [['designRole',state.role],['designItem',state.itemId],['designChannel',state.channel]]){
      const selector=attribute.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
      for(const button of document.querySelectorAll(`[data-${selector}]`))button.setAttribute('aria-pressed',String(button.dataset[attribute]===value));
    }
    for(const button of document.querySelectorAll('[data-scenario]')){
      const value=button.dataset.scenario;
      button.hidden=['near','offline'].includes(value)&&!smart;
      button.setAttribute('aria-pressed',String(value===(state.sensorOnline?(state.fillPercent>=100?'full':state.fillPercent>=80?'near':'space'):'offline')));
    }
    $('design-visitor-actions').hidden=state.role!=='visitor';$('design-worker-actions').hidden=state.role!=='worker';
    $('design-channel-controls').hidden=state.designId!=='sorting';$('design-household-intro').hidden=!home;$('design-confirm').hidden=!home;$('design-smart-actions').hidden=!smart;
    $('design-authenticate').textContent=state.authenticated?'住戶確認已完成（示意）':'模擬住戶確認';
    $('design-throw').textContent=home?'放入示意垃圾袋':'確認投放';
    $('design-service').textContent=state.serviceOpen?'關閉清運門':'開啟清運門';$('design-service').setAttribute('aria-pressed',String(state.serviceOpen));
    $('design-service-state').textContent=service.label;$('design-service-detail').textContent=service.detail;
    $('design-fill-readout').textContent=smart&&!state.sensorOnline?'滿度：未知（離線情境）':`體驗設定：填滿 ${state.fillPercent}% · 非感測讀值`;
    $('design-status').textContent=state.message;$('design-status').parentElement.dataset.tone=state.tone;
    $('design-opening').max=design.maxOpeningCm;
    for(const [control,key] of [['height','heightCm'],['opening','openingCm'],['sidewalk','sidewalkCm']]){$(`design-${control}`).value=params[key];$(`design-${control}-value`).textContent=params[key]+' cm';}
    $('design-opening-height').textContent=readout.openingHeightCm;$('design-clearance').textContent=readout.remainingWidthCm;
    scene?.update(design,{...params,...state});
  }
  function act(action){
    const item=items.find(i=>i.id===state.itemId),trial=action.type==='deposit'?evaluateDeposit(state,params):null;
    state=transitionExperience(state,action,params);render();
    if(trial&&item&&state.role==='visitor'&&!state.serviceOpen&&!(state.designId==='household'&&trial.allowed))scene?.throwItem(item,trial.allowed,state.channel);
  }
  async function loadScene(){
    if(scene)return scene;if(sceneLoading)return sceneLoading;
    sceneLoading=(async()=>{
      try{
        const {createBinScene}=await import('./bin-scene.js');
        scene=createBinScene($('design-viewport'));
        scene.update(design,{...params,...state});scene.setView(view);scene.setActive(active);
        $('design-fallback').hidden=true;$('design-viewport').dataset.ready='true';return scene;
      }catch{
        $('design-fallback').hidden=false;$('design-fallback').querySelector('strong').textContent='目前裝置無法顯示 3D';
        $('design-fallback').querySelector('p').textContent='投放、清運與情境切換仍可完整操作。你也可以重新開啟場景。';$('design-retry').hidden=false;return null;
      }finally{sceneLoading=null;}
    })();return sceneLoading;
  }
  for(const button of document.querySelectorAll('[data-design]'))button.addEventListener('click',()=>{state=createExperience(button.dataset.design);params=normalizeParameters(state.designId);render();});
  for(const [attribute,type] of [['design-role','role'],['design-item','item'],['design-channel','channel'],['scenario','scenario']])for(const button of document.querySelectorAll(`[data-${attribute}]`))button.addEventListener('click',()=>act({type,value:button.getAttribute('data-'+attribute)}));
  for(const [id,type] of [['throw','deposit'],['service','service'],['empty','empty'],['authenticate','authenticate'],['confirm','confirm'],['request','request'],['compress','compress']])$(`design-${id}`).addEventListener('click',()=>act({type}));
  for(const [control,key] of [['height','heightCm'],['opening','openingCm'],['sidewalk','sidewalkCm']])$(`design-${control}`).addEventListener('input',event=>{params={...params,[key]:Number(event.target.value)};render();});
  function selectView(next){view=next;for(const button of document.querySelectorAll('[data-design-view]'))button.setAttribute('aria-pressed',String(button.dataset.designView===view));scene?.setView(view);}
  for(const button of document.querySelectorAll('[data-design-view]'))button.addEventListener('click',()=>selectView(button.dataset.designView));
  $('design-reset-view').addEventListener('click',()=>{selectView('overview');scene?.resetView();});
  $('design-reset').addEventListener('click',()=>{state=createExperience(state.designId);params=normalizeParameters(state.designId);render();});
  $('design-try-cleaning').addEventListener('click',()=>{
    state=createExperience('street');params=normalizeParameters('street');
    state=transitionExperience(state,{type:'role',value:'worker'},params);render();selectView('worker');
    act({type:'service'});
    $('design-workspace').scrollIntoView({block:'start',behavior:'instant'});
    $('design-service').focus({preventScroll:true});
  });
  $('design-read-proposal').addEventListener('click',()=>{
    $('t1-specification').open=true;
    const summary=$('t1-specification').querySelector('summary');
    summary.focus({preventScroll:true});summary.scrollIntoView({block:'start',behavior:'instant'});
  });
  $('design-retry').addEventListener('click',()=>{$('design-retry').hidden=true;loadScene();});
  render();return {setActive(value){active=value;scene?.setActive(value);if(value)loadScene();}};
}
