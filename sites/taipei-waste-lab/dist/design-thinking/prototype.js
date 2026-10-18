'use strict';
// All values below are fictional research fixtures, never live service data.
const scenarios = {
 T01: {text:'你外出吃完東西，手上有一個空紙包裝，接著要繼續步行。畫面提供兩個位置；請決定你會怎麼做。',item:'空紙包裝',limit:null,sites:[['A','路口甲',40,'open',['空紙包裝'],'剛由模擬管理者確認'],['B','通道乙',120,'open',['空紙包裝'],'剛由模擬管理者確認']]},
 T02: {text:'你外出吃完東西，手上有一個空紙包裝，接著要繼續步行。請依你看到的資訊決定下一步。',item:'空紙包裝',limit:null,sites:[['A','路口甲',40,'closed',['空紙包裝'],'剛由模擬管理者確認關閉'],['B','通道乙',120,'open',['空紙包裝'],'剛由模擬管理者確認']]},
 T03: {text:'你剛撿起並包好寵物排泄物，準備繼續走。這是獨立情境，不能用來代替一般飲食包裝的需求。請決定下一步。',item:'包好的寵物排泄物',limit:null,sites:[['A','路口甲',40,'open',['空紙包裝'],'剛由模擬管理者確認'],['B','通道乙',120,'open',['空紙包裝'],'剛由模擬管理者確認']]},
 T04: {text:'你外出時手上有一個空紙包裝，正考慮下一步。畫面中的位置資訊可能不完整；請依你看到的資訊決定。',item:'空紙包裝',limit:null,sites:[['A','路口甲',40,'unknown',null,'沒有目前可核實的狀態'],['B','通道乙',120,'unknown',null,'沒有目前可核實的狀態']]},
 T05: {text:'你手上有一個空紙包裝。在這次虛構情境中，你只能再走 80 公尺，之後必須停下。請依此條件決定下一步；80 公尺不是通用標準。',item:'空紙包裝',limit:80,sites:[['A','路口甲',40,'closed',['空紙包裝'],'剛由模擬管理者確認關閉'],['B','通道乙',120,'open',['空紙包裝'],'剛由模擬管理者確認']]}
};
const $ = id => document.getElementById(id);
const records = [];
let selected = null;
let startedAt;
const statusText = {open:'模擬狀態：開放',closed:'模擬狀態：關閉',unknown:'模擬狀態：未知'};
const params = new URLSearchParams(location.search);
if (['A','B'].includes(params.get('variant'))) $('variant').value=params.get('variant');
if (Object.hasOwn(scenarios,params.get('task'))) $('scenario').value=params.get('task');
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function choose(id){
 selected=id;
 document.querySelectorAll('.choice').forEach(b=>{const active=b.dataset.site===id||(id==='hold'&&b.id==='hold');b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 $('selection').textContent=id==='hold'?'已選擇：先不前往':`已選擇：模擬位置 ${id}`;
 $('record').disabled=false;$('result').hidden=true;
}
function render(){
 const task=$('scenario').value,variant=$('variant').value,s=scenarios[task];
 selected=null;startedAt=new Date().toISOString();
 $('task-code').textContent=`${task} · 資訊版本 ${variant}`;$('task-text').textContent=s.text;
 $('reason').value='';$('record').disabled=true;$('result').hidden=true;$('selection').textContent='尚未選擇';
 $('hold').classList.remove('selected');$('hold').setAttribute('aria-pressed','false');$('choices').replaceChildren();
 for(const [id,name,distance,status,items,verified] of s.sites){
  const b=el('button',undefined,'choice');b.type='button';b.dataset.site=id;b.setAttribute('aria-pressed','false');
  b.append(el('span',`${name} · ${distance} 公尺`,'choice-title'),el('span',`模擬位置 ${id}｜步行路程`,'choice-info'));
  if(variant==='B'){
   b.append(el('span',statusText[status],'choice-info choice-status'));
   b.append(el('span',items?`本劇本收受：${items.join('、')}；未列物品不收受。`:'收受條件未知，無法確認你的物品是否適用。','choice-info'));
   b.append(el('span',verified,'choice-info'));
  }
  b.append(el('span','我會先去這裡 →','choice-info'));b.addEventListener('click',()=>choose(id));$('choices').append(b);
 }
}
function record(){
 if(!selected)return;
 const task=$('scenario').value,variant=$('variant').value,s=scenarios[task];
 const row={id:`LOCAL-${String(records.length+1).padStart(2,'0')}`,task,variant,sequence:records.length+1,selected,reason:$('reason').value.trim(),started_at:startedAt,recorded_at:new Date().toISOString(),participant_verified:false,provenance:'Unverified local prototype interaction; may be participant, researcher, or software QA.',field_disposal_completed:null};
 records.push(row);
 $('result').replaceChildren(el('h3','選擇已記錄'),el('p',selected==='hold'?'你選擇先不前往任何一處。這是一個決策紀錄，沒有完成現場投放。':`你選擇先去模擬位置 ${selected}。這只記錄行動意向，沒有完成現場投放。`));
 const d=el('details');d.append(el('summary','選擇後查看劇本條件（研究用途）'));
 for(const [id,name,distance,status,items] of s.sites){
  const accepted=items?items.includes(s.item):null;
  d.append(el('p',`${name}：${statusText[status]}；${accepted===null?'收受條件未知':accepted?'劇本包含你手上的物品':'劇本不收你手上的物品'}${s.limit!==null?`；${distance>s.limit?'超過':'未超過'}本情境可走距離`:''}。`));
 }
 d.append(el('p','先記理由，再看條件。看過劇本後再次試用，會受到學習影響；不要把重複選對當成效果證據。','quiet'));
 $('result').append(d);$('result').hidden=false;$('result').focus();$('record').disabled=true;
 // A new deliberate choice is required before another record can be added.
 selected=null;
 $('record-count').textContent=`本頁已記錄 ${records.length} 次試用。`;
 const card=el('article',undefined,'card');card.append(el('h3',`${row.id} · ${task} · ${variant}`),el('p',`選擇：${row.selected==='hold'?'先不前往':row.selected}`),el('p',row.reason||'沒有填寫理由。'));$('log').append(card);
}
$('variant').addEventListener('change',render);$('scenario').addEventListener('change',render);$('hold').addEventListener('click',()=>choose('hold'));$('record').addEventListener('click',record);
render();
