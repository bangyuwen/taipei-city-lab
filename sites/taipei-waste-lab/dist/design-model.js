// All dimensions, service rules and states below are authored concepts, not product specifications.
export const defaultParameters = Object.freeze({heightCm:110,openingCm:22,sidewalkCm:200,fillPercent:30});
export const designs = Object.freeze([
  {id:'street',name:'街角隨手投',tagline:'短暫停留，也能好好投放',description:'T1 街角桶：內縮遮雨入口、可換外板與帶輪內桶，服務步行途中的小型一般垃圾。',tradeoff:'便利投放要配合巡收；縮口不能辨識垃圾來源，也不能替代家戶收運。',collection:'先暫停投放，開門後向前移出帶輪內桶，再換袋、清潔並收回上鎖。實體重量、門檻與拉力待打樣確認。',widthCm:48,depthCm:42,openingRatio:.75,maxOpeningCm:26,openingAspectRatio:.65,defaultOpeningCm:22,colors:{body:'#d7e1e3',recycle:'#3c7d68',accent:'#16566a'}},
  {id:'sorting',name:'回收分流站',tagline:'選對入口，清運也分開',description:'一般垃圾與回收各有投入口、標示及內桶，讓投放到清運保持分流。',tradeoff:'入口形狀只是提示；仍需清楚標示、清潔與後端分開收運，不代表會自動辨識。',collection:'兩槽分開檢查與清運；本體驗以整站暫停示範安全作業。',widthCm:112,depthCm:50,openingRatio:.82,maxOpeningCm:30,openingAspectRatio:.75,defaultOpeningCm:22,colors:{body:'#667d86',recycle:'#39735f',accent:'#e4bd77'}},
  {id:'hotspot',name:'高使用量管理',tagline:'知道滿了，也要收得走',description:'太陽能壓縮機櫃搭配滿度通知。用不同情境體驗回報、派收與維修。',tradeoff:'感測、壓縮與清運是三件事。失聯要現場確認；壓縮不減少垃圾重量，也不保證省人力。',collection:'收到通知後安排巡收；先停止機構再開門取桶，清空後關門恢復服務。',widthCm:76,depthCm:72,openingRatio:.72,maxOpeningCm:32,openingAspectRatio:.65,defaultOpeningCm:26,colors:{body:'#3f625b',recycle:'#437d6b',accent:'#e1b564'}},
  {id:'household',name:'家戶收受站',tagline:'讓家戶垃圾有自己的去處',description:'封閉投放艙與確認面板，示範住戶服務的進站、放袋及計費確認流程。',tradeoff:'需另有營運者、費率、清運與故障替代管道。此處沒有真實住戶辨識、付款或台北設站承諾。',collection:'停用投放艙再清運；故障或暫停時須告知可使用的家戶收運管道。',widthCm:110,depthCm:80,openingRatio:.72,maxOpeningCm:44,openingAspectRatio:.9,defaultOpeningCm:38,colors:{body:'#7a7465',recycle:'#526f60',accent:'#e8bd76'}},
].map(d=>Object.freeze({...d,openingShape:'rect',colors:Object.freeze(d.colors)})));
export const items=Object.freeze([
  {id:'litter',label:'用過的面紙',widthCm:6,heightCm:8,stream:'general'},
  {id:'bottle',label:'已清空的寶特瓶',widthCm:7,heightCm:23,stream:'recycle'},
  {id:'bag',label:'小袋家戶垃圾',widthCm:12,heightCm:26,stream:'household'},
].map(item=>Object.freeze(item)));
export const getDesign=id=>designs.find(d=>d.id===(typeof id==='string'?id:id?.id))||designs[0];
const finite=(value,fallback)=>((typeof value==='number'||typeof value==='string')&&String(value).trim()!==''&&Number.isFinite(Number(value)))?Number(value):fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export function normalizeParameters(design,values={}){
  const d=getDesign(design),p=values&&typeof values==='object'?values:{};
  return {heightCm:clamp(finite(p.heightCm,110),85,130),openingCm:clamp(finite(p.openingCm,d.defaultOpeningCm),8,d.maxOpeningCm),sidewalkCm:clamp(finite(p.sidewalkCm,200),120,320),fillPercent:clamp(finite(p.fillPercent,30),0,100)};
}
export function getReadout(design,params){
  const d=getDesign(design),p=normalizeParameters(d,params);
  return {openingHeightCm:Math.round(p.heightCm*d.openingRatio*10)/10,remainingWidthCm:p.sidewalkCm-d.depthCm,notes:['剩餘空間為人行道寬減桶深，未計門片、退縮與清運作業；不是無障礙合格判定。']};
}
export function evaluateItem(design,params,itemOrId){
  const d=getDesign(design),p=normalizeParameters(d,params),item=items.find(i=>i.id===(typeof itemOrId==='string'?itemOrId:itemOrId?.id));
  if(!item)return {allowed:false,reason:'請先選一個示意物件。'};
  if(p.fillPercent>=100)return {allowed:false,reason:'容器已滿，請帶走垃圾，等待清運或使用其他合適收受點。'};
  const allowed=item.widthCm<=p.openingCm&&item.widthCm<=p.openingCm*d.openingAspectRatio;
  return {allowed,reason:allowed?'示意截面可通過；仍須符合本站設定的服務範圍。':'這個設定的開口太小，請調整尺寸或選擇合適收受方式；不要放在桶旁。'};
}
export function createExperience(designId='street'){
  return {designId:getDesign(designId).id,role:'visitor',itemId:null,channel:'general',fillPercent:30,sensorOnline:true,serviceRequested:false,serviceOpen:false,authenticated:false,staged:false,compactionShown:false,message:'先選一個物件，再試試這站的投放流程。',tone:'neutral'};
}
export function evaluateDeposit(state,params={}){
  const item=items.find(i=>i.id===state.itemId);
  if(state.serviceOpen)return {allowed:false,reason:'清運門開啟中，暫停投放。請先完成清運並關門。'};
  if(!item)return {allowed:false,reason:'請先選一個示意物件。'};
  if(state.designId==='hotspot'&&!state.sensorOnline)return {allowed:false,reason:'感測離線，容量未知。本情境暫停投放，需由人員現場確認。'};
  if(state.designId!=='household'&&item.stream==='household')return {allowed:false,reason:'這站不收家戶垃圾，即使小袋放得下也不改變服務範圍。可切換「家戶收受站」了解另一種服務，實際仍依所在地收運公告辦理。'};
  if(state.designId==='household'){
    if(item.stream!=='household')return {allowed:false,reason:'本情境示範家戶垃圾袋收受；寶特瓶請分流，用過的面紙可回街角一般垃圾服務。'};
    if(!state.authenticated)return {allowed:false,reason:'請先按「模擬住戶確認」。這只是操作示意，沒有辨識真實身分。'};
    if(state.staged)return {allowed:false,reason:'投放艙已有示意袋，請先確認這次投放。'};
  }else if(state.designId==='sorting'){
    if(item.stream!==state.channel)return {allowed:false,reason:item.stream==='recycle'?'這個示例請選「資源回收」入口，再確認投放。':'這個示例請選「一般垃圾」入口，再確認投放。'};
  }else if(item.stream==='recycle')return {allowed:false,reason:'這站示範一般垃圾服務；已清空的寶特瓶請送回收分流站。'};
  return evaluateItem(state.designId,{...params,fillPercent:state.fillPercent},item);
}
export function transitionExperience(state,action,params={}){
  const next={...state};
  const reply=(message,tone='neutral')=>({...next,message,tone});
  if(action.type==='role'&&['visitor','worker'].includes(action.value)){next.role=action.value;return reply(action.value==='worker'?'清運人員：先確認狀態，再開門、清空及恢復服務。':'投放者：選擇物件並依這站的服務流程操作。');}
  if(action.type==='item'){next.itemId=items.some(i=>i.id===action.value)?action.value:null;return reply(next.itemId?'已選擇物件，請確認服務範圍與投入口。':'請選擇有效物件。');}
  if(action.type==='channel'&&['general','recycle'].includes(action.value)){next.channel=action.value;return reply(`已選擇${action.value==='recycle'?'資源回收':'一般垃圾'}入口。`);}
  if(action.type==='scenario'){
    if(!['space','near','full','offline'].includes(action.value))return reply('請選擇有效情境。','warning');
    if(action.value==='offline'&&state.designId!=='hotspot')return reply('這個概念沒有感測情境。','warning');
    next.fillPercent={space:30,near:85,full:100,offline:30}[action.value];next.sensorOnline=action.value!=='offline';next.serviceRequested=false;next.compactionShown=false;next.staged=false;next.authenticated=false;
    return reply(action.value==='offline'?'已設定感測離線：容量未知，改由人員現場確認。':`已設定${action.value==='full'?'已滿':action.value==='near'?'接近滿載':'尚有空間'}情境；這是示意值，沒有讀取真實感測器。`);
  }
  if(['service','empty','request','compress'].includes(action.type)&&state.role!=='worker')return reply('請切換「清運人員」再操作。','warning');
  if(['deposit','authenticate','confirm'].includes(action.type)&&state.role!=='visitor')return reply('請切換「投放者」再操作。','warning');
  if(action.type==='service'){next.serviceOpen=!state.serviceOpen;next.authenticated=false;next.staged=false;next.compactionShown=false;return reply(next.serviceOpen?'清運門已開，投放與壓縮暫停。請清空後關門。':'清運門已關。請依容量與設備狀態確認能否恢復服務。');}
  if(action.type==='empty'){
    if(!state.serviceOpen)return reply('請先開啟清運門，再示範清空。','warning');
    next.fillPercent=0;next.serviceRequested=false;next.compactionShown=false;next.staged=false;
    return reply(state.sensorOnline?'已完成清空示意，請關門恢復服務。':'已由人員完成清空示意；感測仍離線，需要修復後才能恢復本情境。','success');
  }
  if(action.type==='request'||action.type==='compress'){
    if(state.designId!=='hotspot')return reply('這站沒有感測或壓縮機構。','warning');
    if(state.serviceOpen)return reply('請先關閉維修門；開門時禁止壓縮。','warning');
    if(!state.sensorOnline)return reply('感測離線，無法依讀值派收或執行本情境壓縮；請現場確認。','warning');
    if(action.type==='request'){
      if(state.fillPercent<80)return reply('目前示意滿度未達通知情境；衛生需求仍可能需要提早清運。');
      next.serviceRequested=true;return reply('已安排收運示意，容器還沒有清空。通知不會自動完成清運。','success');
    }
    next.compactionShown=!state.compactionShown;return reply('已切換壓縮機構示意。未計算可用容量、垃圾減量或節省車次；滿桶仍需清運。');
  }
  if(action.type==='authenticate'){
    if(state.designId!=='household')return reply('這站不需要住戶確認。');
    if(state.serviceOpen||state.fillPercent>=100)return reply('目前暫停受理，請依所在地公告的家戶垃圾收運方式處理。','warning');
    next.authenticated=true;return reply('住戶確認示意完成。可選擇家戶垃圾袋放入投放艙；沒有使用真實身分資料。','success');
  }
  if(action.type==='confirm'){
    if(state.designId!=='household'||!state.authenticated||!state.staged)return reply('請先完成模擬住戶確認並放入示意垃圾袋。','warning');
    if(state.serviceOpen||state.fillPercent>=100)return reply('目前暫停受理，請先完成清運。','warning');
    next.staged=false;next.authenticated=false;return reply('示意投放已確認。實際營運須先公告費率與替代管道；本頁沒有計費、扣款或付款。','success');
  }
  if(action.type==='deposit'){
    const result=evaluateDeposit(state,params);if(!result.allowed)return reply(result.reason,'warning');
    if(state.designId==='household'){next.staged=true;return reply('示意袋已放入封閉投放艙，請按「確認示意投放」完成流程。','success');}
    return reply(`完成概念投放${state.designId==='sorting'?`：進入${state.channel==='recycle'?'回收':'一般垃圾'}槽`:''}。填滿程度仍是情境設定，未模擬真實容量。`,'success');
  }
  return reply('請選擇頁面提供的操作。');
}
export function getServiceStatus(state){
  if(state.serviceOpen)return {label:'清運中・暫停投放',detail:'關門後再確認容量與設備狀態。'};
  if(state.designId==='hotspot'&&!state.sensorOnline)return {label:'容量未知・需現場確認',detail:'感測離線；畫面不顯示舊讀值為即時容量。'};
  if(state.fillPercent>=100)return {label:'已滿・暫停投放',detail:'請帶走垃圾，使用合適收受點；不要放在桶旁。'};
  if(state.serviceRequested)return {label:'已安排收運・尚未清空',detail:'人員仍須到場執行並回報完成。'};
  if(state.designId==='hotspot'&&state.fillPercent>=80)return {label:'接近滿載・待安排收運',detail:'80% 是本體驗的通知門檻假設，並非產品或台北設定。'};
  if(state.designId==='household')return {label:state.staged?'投放艙待確認':state.authenticated?'可放入示意垃圾袋':'等待住戶確認示意',detail:'只示範服務流程；沒有真實付款或住戶資料。'};
  return {label:'可以投放',detail:'先確認本站概念的服務範圍與物件示例。'};
}
