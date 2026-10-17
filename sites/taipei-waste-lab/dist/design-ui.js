import {designs,items,getDesign,normalizeParameters,createExperience,transitionExperience,evaluateDeposit,getServiceStatus} from './design-model.js';
import {escapeHTML as esc} from './data-utils.js';
const $=id=>document.getElementById(id);

// Each demonstration fixes its role, object, dimensions and service conditions.
// The underlying model remains available for authored scenarios and validation.
function demonstration(designId,mode){
  if(mode==='collection'){
    const steps=[];
    if(designId==='hotspot')steps.push({title:'通知與派收',label:'安排收運',description:'滿度達 85% 的示意情境先發出通知。安排人員後，垃圾仍留在容器裡。80% 通知門檻只是本頁假設。',actions:[{type:'request'}]});
    steps.push(
      {title:'暫停投放，開啟清運門',label:'開門，暫停投放',description:getDesign(designId).collection,actions:[{type:'service'}]},
      {title:'移出內桶，完成清空',label:'移出並清空內桶',description:'依現場清運設備移出內桶，換袋並清潔。模型只表達動作，滿載重量、拉力與作業空間仍待實體驗證。',actions:[{type:'empty'}]},
      {title:'關門，確認恢復服務',label:'關門，恢復服務',description:'收回內桶並關門，再確認容量與機構狀態。清運記錄與異常處理需要由實際營運者承接。',actions:[{type:'service'}]},
    );
    if(designId==='hotspot')steps.push({title:'離線時改由人員確認',label:'看看感測離線時',description:'失去訊號時，不能把舊讀值當作目前容量。即使剛清空，也須確認與修復設備，才能恢復這個情境的服務。',actions:[{type:'scenario',value:'offline'},{type:'request'}]});
    return steps;
  }
  if(designId==='household')return [
    {title:'確認住戶服務',label:'模擬住戶確認',description:'這是獨立的家戶收受服務。先示意確認使用資格；沒有真實身分辨識或付款。',actions:[{type:'authenticate'}]},
    {title:'放入家戶垃圾袋',label:'放入示意垃圾袋',description:'使用固定的小袋家戶垃圾示例，放進封閉投放艙。物件與開口大小只用來表達操作。',actions:[{type:'deposit'}]},
    {title:'確認這次投放',label:'確認示意投放',description:'使用者確認後完成流程。實際服務須另訂費率、清運、維修與故障替代管道。',actions:[{type:'confirm'}]},
  ];
  if(designId==='sorting')return [
    {title:'空瓶進資源回收',label:'將空瓶投入回收槽',description:'已清空的寶特瓶使用回收入口。入口與內桶分開，後端仍須安排分開清運。',actions:[{type:'item',value:'bottle'},{type:'channel',value:'recycle'},{type:'deposit'}]},
    {title:'面紙進一般垃圾',label:'將面紙投入一般垃圾槽',description:'用過的面紙改用一般垃圾入口。固定示例只解釋兩槽差異，不是完整分類指引。',actions:[{type:'item',value:'litter'},{type:'channel',value:'general'},{type:'deposit'}]},
  ];
  if(designId==='hotspot')return [
    {title:'有空間時投放面紙',label:'投放用過的面紙',description:'先示範一般垃圾投放。感測、壓縮與實際清運是不同工作，容量仍是固定情境值。',actions:[{type:'deposit'}]},
    {title:'滿載時暫停投放',label:'看看已滿時怎麼做',description:'容器已滿就帶走垃圾，使用其他合適收受點，並安排清運；不要放在桶旁。',actions:[{type:'scenario',value:'full'},{type:'deposit'}]},
  ];
  return [
    {title:'投放步行途中的小垃圾',label:'投放用過的面紙',description:'T1 預設收受行人隨手產生的小型一般垃圾。正面直接投放，不需碰翻蓋或踩踏板。',actions:[{type:'deposit'}]},
    {title:'確認這款桶的服務範圍',label:'看看家戶垃圾的去向',description:'把固定示例換成小袋家戶垃圾。袋子放得下，也不代表這款街角桶收受它。',actions:[{type:'item',value:'bag'},{type:'deposit'}]},
  ];
}

export function initializeDesignExperience(){
  let state=createExperience(),design=getDesign(state.designId),params=normalizeParameters(design),mode='deposit',stepIndex=0,active=false,scene,sceneLoading;
  $('design-options').innerHTML=designs.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');

  function render(){
    design=getDesign(state.designId);
    const steps=demonstration(state.designId,mode),complete=stepIndex>=steps.length,step=steps[stepIndex],service=getServiceStatus(state);
    $('design-options').value=state.designId;
    $('design-name').textContent=design.name;
    $('design-description').textContent=design.description;
    $('design-tradeoff').textContent=design.tradeoff;
    $('design-scene-label').textContent=design.name;
    $('design-viewport').dataset.design=state.designId;
    $('design-workspace').dataset.mode=mode;
    $('design-workspace').dataset.complete=String(complete);
    for(const button of document.querySelectorAll('[data-design-demo]'))button.setAttribute('aria-pressed',String(button.dataset.designDemo===mode));
    $('design-demo-steps').innerHTML=steps.map((entry,index)=>`<li${index===stepIndex?' aria-current="step"':''}${index<stepIndex?' data-complete="true"':''}>${esc(entry.title)}</li>`).join('');
    $('design-step-title').textContent=complete?'示範完成':step.title;
    $('design-step-description').textContent=complete?design.tradeoff:step.description;
    $('design-next').textContent=complete?'重新示範':step.label;
    $('design-reset').hidden=stepIndex===0||complete;
    $('design-status').textContent=state.message;
    $('design-status').parentElement.dataset.tone=state.tone;
    $('design-service-state').textContent=service.label;
    $('design-fill-readout').textContent=state.designId==='hotspot'&&!state.sensorOnline?'感測離線 · 容量未知':`示意滿度 ${state.fillPercent}% · 非感測讀值`;
    scene?.update(design,{...params,...state});
  }

  function act(action){
    const item=items.find(i=>i.id===state.itemId),trial=action.type==='deposit'?evaluateDeposit(state,params):null;
    state=transitionExperience(state,action,params);
    return trial&&item&&state.role==='visitor'&&!state.serviceOpen&&!(state.designId==='household'&&trial.allowed)?{item,allowed:trial.allowed,channel:state.channel}:null;
  }

  function start(designId=state.designId,nextMode=mode){
    mode=nextMode;stepIndex=0;state=createExperience(designId);design=getDesign(designId);params=normalizeParameters(designId);
    if(mode==='collection'){
      act({type:'role',value:'worker'});
      act({type:'scenario',value:designId==='hotspot'?'near':'full'});
    }else act({type:'item',value:designId==='household'?'bag':designId==='sorting'?'bottle':'litter'});
    state.message=mode==='collection'?'依序開門、清空與恢復服務，看看清運需要哪些工作。':'物件、尺寸與情境已設定好，按下方按鈕開始示範。';
    state.tone='neutral';
    render();
    scene?.setView(mode==='collection'?'worker':'overview');
  }

  async function loadScene(){
    if(scene)return scene;if(sceneLoading)return sceneLoading;
    sceneLoading=(async()=>{
      try{
        const {createBinScene}=await import('./bin-scene.js');
        scene=createBinScene($('design-viewport'));
        scene.update(design,{...params,...state});scene.setView(mode==='collection'?'worker':'overview');scene.setActive(active);
        $('design-fallback').hidden=true;$('design-viewport').dataset.ready='true';return scene;
      }catch{
        $('design-fallback').hidden=false;$('design-fallback').querySelector('strong').textContent='目前裝置無法顯示 3D';
        $('design-fallback').querySelector('p').textContent='仍可按步驟完成投放與清運示範，文字會說明每次操作結果。';$('design-retry').hidden=false;return null;
      }finally{sceneLoading=null;}
    })();return sceneLoading;
  }

  $('design-options').addEventListener('change',event=>start(event.target.value));
  for(const button of document.querySelectorAll('[data-design-demo]'))button.addEventListener('click',()=>start(state.designId,button.dataset.designDemo));
  $('design-next').addEventListener('click',()=>{
    const steps=demonstration(state.designId,mode);
    if(stepIndex>=steps.length){start();return;}
    let projection=null;
    for(const action of steps[stepIndex].actions)projection=act(action)||projection;
    stepIndex++;render();
    if(projection)scene?.throwItem(projection.item,projection.allowed,projection.channel);
  });
  $('design-reset').addEventListener('click',()=>start());
  $('design-reset-view').addEventListener('click',()=>scene?.setView(mode==='collection'?'worker':'overview'));
  for(const button of document.querySelectorAll('[data-design-jump]'))button.addEventListener('click',()=>{
    const target=$(button.dataset.designJump);if(!target)return;
    target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});
  });
  $('design-retry').addEventListener('click',()=>{$('design-retry').hidden=true;loadScene();});
  start();
  return {setActive(value){active=value;scene?.setActive(value);if(value)loadScene();}};
}
