'use strict';
const $=id=>document.getElementById(id);
const tracks=window.DIRECTION_DATA;
const requested=new URLSearchParams(location.search).get('direction');
const track=tracks.find(x=>x.id===requested)||tracks[0];
const records=[];
let selected=null;
let startedAt;
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
$('title').textContent=track.title;document.title=track.title+'｜概念草模';$('back').href='index.html#'+track.id;
for(const c of track.cases){const o=el('option',c.id+' · '+c.title);o.value=c.id;$('scenario').append(o);}
function current(){return track.cases.find(x=>x.id===$('scenario').value);}
function choose(id){
 selected=id;
 document.querySelectorAll('[data-action]').forEach(b=>{const active=b.dataset.action===id;b.setAttribute('aria-pressed',String(active));b.classList.toggle('selected',active);});
 $('record').disabled=false;$('result').hidden=true;$('selection').textContent='已選擇：'+current().actions.find(x=>x[0]===id)[1];
}
function render(){
 const c=current();selected=null;startedAt=new Date().toISOString();
 $('task-code').textContent=c.id+' · '+track.id;$('case-title').textContent=c.title;$('scene').textContent=c.scene;
 $('facts').replaceChildren();for(const [k,v] of c.facts)$('facts').append(el('dt',k),el('dd',v));
 $('choices').replaceChildren();
 for(const [id,label] of c.actions){const b=el('button',label,'choice');b.type='button';b.dataset.action=id;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>choose(id));$('choices').append(b);}
 $('reason').value='';$('result').hidden=true;$('record').disabled=true;$('selection').textContent='尚未選擇';
}
$('scenario').addEventListener('change',render);
$('record').addEventListener('click',()=>{
 if(!selected)return;
 const c=current(),a=c.actions.find(x=>x[0]===selected);
 const row={id:'DESK-'+String(records.length+1).padStart(2,'0'),direction:track.id,task:c.id,prototype_version:'v1',sequence:records.length+1,choice:a[0],choice_label:a[1],reason:$('reason').value.trim(),started_at:startedAt,recorded_at:new Date().toISOString(),provenance:'Fictional concept exploration. Actor unverified; may be analyst or software QA.',participant_verified:false,real_service_outcome:null};
 records.push(row);
 $('result').replaceChildren(el('h3','選擇已記錄'),el('p',a[2]),el('p','這是劇本中的選擇與解釋。沒有聯繫他人、完成真實投放、處理案件或改動班表。','quiet'));
 $('result').hidden=false;$('result').focus();$('record').disabled=true;selected=null;
 $('record-count').textContent='目前 '+records.length+' 筆。';
 const card=el('article',undefined,'card');card.append(el('h3',row.id+' · '+row.task),el('p',row.choice_label),el('p',row.reason||'沒有填寫理由。'));$('log').append(card);
});
render();
