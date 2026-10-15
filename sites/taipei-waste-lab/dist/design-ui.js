import {designs,items,defaultParameters,getDesign,normalizeParameters,getReadout,evaluateItem} from './design-model.js';
import {escapeHTML as esc} from './data-utils.js';

const $=id=>document.getElementById(id);
const marks={
  pair:'<rect x="10" y="15" width="18" height="31" rx="7"/><rect x="34" y="15" width="18" height="31" rx="7"/><ellipse cx="19" cy="16" rx="9" ry="4"/><ellipse cx="43" cy="16" rx="9" ry="4"/>',
  hood:'<path d="M6 14h50l-6-8H12z"/><path d="M11 14v9m40-9v9"/><rect x="10" y="23" width="18" height="23" rx="2"/><rect x="34" y="23" width="18" height="23" rx="2"/>',
  slot:'<rect x="16" y="6" width="30" height="40" rx="3"/><path d="M22 17h18v5H22z"/><path d="M22 34h18"/>',
  service:'<rect x="6" y="9" width="50" height="37" rx="3"/><path d="M31 9v37M13 17h11v5H13zM38 17h11v5H38zM25 30v6M37 30v6"/>',
};
const itemMarks={cup:'◡',bottle:'♧',bag:'▱'};

export function initializeDesignExperience(){
  let design=getDesign('pair'),params=normalizeParameters(design,defaultParameters);
  let selectedItem=items[0],view='overview',active=false,scene,sceneLoading,serviceOpen=false,throwTimer;
  const status=message=>{$('design-status').textContent=message;};

  $('design-options').innerHTML=designs.map((d,i)=>`<button type="button" class="design-option" data-design="${esc(d.id)}" aria-pressed="${d.id===design.id}"><svg viewBox="0 0 62 54" aria-hidden="true">${marks[d.id]}</svg><span><small>0${i+1} / CONCEPT</small><strong>${esc(d.name)}</strong><em>${esc(d.tagline)}</em></span></button>`).join('');
  $('design-item-buttons').innerHTML=items.map(item=>`<button type="button" data-design-item="${esc(item.id)}" aria-pressed="${item.id===selectedItem.id}"><span aria-hidden="true">${itemMarks[item.id]}</span><strong>${esc(item.label)}</strong><small>截面 ${item.widthCm} cm</small></button>`).join('');

  function cancelThrow(){
    clearTimeout(throwTimer);
    $('design-throw').disabled=!scene;
  }
  function closeService(){
    serviceOpen=false;
    $('design-service').setAttribute('aria-pressed','false');
    const lid=design.id==='pair'||design.id==='hood';
    $('design-service').innerHTML=(lid?'打開上蓋／取出內桶':'打開清運門／取出內桶')+' <span aria-hidden="true">↗</span>';
  }
  function revealScene(){
    const viewport=$('design-viewport'),bounds=viewport.getBoundingClientRect();
    if(innerWidth<=760&&(bounds.top<0||bounds.bottom>innerHeight)){
      viewport.scrollIntoView({behavior:'instant',block:'center'});
    }
  }
  function render(){
    params=normalizeParameters(design,params);
    const readout=getReadout(design,params);
    $('design-name').textContent=design.name;
    $('design-description').textContent=design.description;
    $('design-tradeoff').textContent=design.tradeoff;
    $('design-index').textContent=`0${designs.findIndex(d=>d.id===design.id)+1} / 04`;
    $('design-scene-label').textContent=design.name;
    for(const button of document.querySelectorAll('[data-design]'))button.setAttribute('aria-pressed',String(button.dataset.design===design.id));
    $('design-opening').max=design.maxOpeningCm;
    $('design-opening-max').textContent=design.maxOpeningCm+' cm';
    for(const [control,key,unit] of [['height','heightCm',' cm'],['opening','openingCm',' cm'],['sidewalk','sidewalkCm',' cm'],['fill','fillPercent','%']]){
      $(`design-${control}`).value=params[key];
      $(`design-${control}-value`).textContent=params[key]+unit;
    }
    $('design-opening-height').textContent=Math.round(readout.openingHeightCm);
    $('design-clearance').textContent=Math.round(readout.remainingWidthCm);
    $('design-fill-readout').textContent=params.fillPercent;
    $('design-notes').textContent='四種桶型都是本站概念設計，並非台北現役產品規格。'+(readout.notes??[]).slice(0,1).join(' ');
    scene?.update(design,params);
    closeService();cancelThrow();
  }

  async function loadScene(){
    if(scene)return scene;
    if(sceneLoading)return sceneLoading;
    sceneLoading=(async()=>{
      try{
        const {createBinScene}=await import('./bin-scene.js');
        scene=createBinScene($('design-viewport'),{onStatus:message=>{
          // Preserve the stated trial reason, including a full-bin veto.
          if(!message.startsWith('已完成'))status(message);
        }});
        scene.update(design,params);scene.setView(view);scene.setActive(active);
        $('design-fallback').hidden=true;
        $('design-throw').disabled=false;
        $('design-viewport').dataset.ready='true';
        status('選一個物件試投，或切換視角看看投入口與清運空間。');
        return scene;
      }catch{
        $('design-fallback').hidden=false;
        $('design-fallback').querySelector('strong').textContent='目前裝置無法開啟 3D 場景';
        $('design-fallback').querySelector('p').textContent='仍可切換桶型、調整尺寸，閱讀數值與設計取捨。';
        $('design-retry').hidden=false;
        $('design-throw').disabled=true;
        status('3D 場景未能載入；尺寸比較仍可使用，亦可按「重新開啟 3D」再試。');
        return null;
      }finally{sceneLoading=null;}
    })();
    return sceneLoading;
  }

  for(const button of document.querySelectorAll('[data-design]'))button.addEventListener('click',()=>{
    design=getDesign(button.dataset.design);
    render();
    status(`${design.name}：${design.tradeoff}`);
  });
  for(const [control,key] of [['height','heightCm'],['opening','openingCm'],['sidewalk','sidewalkCm'],['fill','fillPercent']]){
    $(`design-${control}`).addEventListener('input',event=>{
      params={...params,[key]:Number(event.target.value)};
      render();
      const result=evaluateItem(design,params,selectedItem);
      status(`${selectedItem.label}：${result.reason}`);
    });
  }
  function selectView(next){
    view=next;
    for(const button of document.querySelectorAll('[data-design-view]'))button.setAttribute('aria-pressed',String(button.dataset.designView===view));
    scene?.setView(view);
  }
  for(const button of document.querySelectorAll('[data-design-view]'))button.addEventListener('click',()=>selectView(button.dataset.designView));
  for(const button of document.querySelectorAll('[data-design-item]'))button.addEventListener('click',()=>{
    selectedItem=items.find(item=>item.id===button.dataset.designItem);
    for(const other of document.querySelectorAll('[data-design-item]'))other.setAttribute('aria-pressed',String(other===button));
    const result=evaluateItem(design,params,selectedItem);
    status(`${selectedItem.label}：${result.reason}`);
  });
  $('design-throw').addEventListener('click',()=>{
    if(!scene)return;
    if(serviceOpen){status('請先關閉清運門，再試投物件。');return;}
    const result=evaluateItem(design,params,selectedItem);
    status(`${selectedItem.label}：${result.reason}`);
    revealScene();
    scene.throwItem(selectedItem,result.allowed);
    $('design-throw').disabled=true;
    clearTimeout(throwTimer);
    throwTimer=setTimeout(()=>{$('design-throw').disabled=!scene;},1800);
  });
  $('design-service').addEventListener('click',()=>{
    if(!scene){status('3D 場景尚未開啟；清運取捨可參考右側說明。');return;}
    revealScene();
    selectView('worker');
    scene.toggleService();serviceOpen=!serviceOpen;
    $('design-service').setAttribute('aria-pressed',String(serviceOpen));
    const lid=design.id==='pair'||design.id==='hood';
    $('design-service').innerHTML=(serviceOpen?(lid?'關閉上蓋／收回內桶':'關閉清運門／收回內桶'):(lid?'打開上蓋／取出內桶':'打開清運門／取出內桶'))+' <span aria-hidden="true">↗</span>';
    status(serviceOpen?'清運模式：觀察門片與內桶取出的空間。再按一次收回。':'已關閉清運門，可以繼續試投。');
  });
  $('design-reset-view').addEventListener('click',()=>{selectView('overview');scene?.resetView();});
  $('design-reset').addEventListener('click',()=>{
    params=normalizeParameters(design,defaultParameters);render();
    status('已恢復這個桶型的預設尺寸。');
  });
  $('design-retry').addEventListener('click',()=>{
    $('design-retry').hidden=true;
    $('design-fallback').querySelector('strong').textContent='正在重新準備街角場景';
    loadScene();
  });
  render();
  return {
    setActive(value){active=value;scene?.setActive(value);if(value)loadScene();},
  };
}
