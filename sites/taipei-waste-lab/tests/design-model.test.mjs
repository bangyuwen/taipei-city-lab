import test from 'node:test';
import assert from 'node:assert/strict';
import {designs,getDesign,normalizeParameters,getReadout,createExperience,transitionExperience as step,evaluateItem,evaluateDeposit,getServiceStatus} from '../dist/design-model.js';
const choose=(id,item)=>step(createExperience(id),{type:'item',value:item});
const worker=id=>step(createExperience(id),{type:'role',value:'worker'});

test('purpose concepts have distinct geometry and finite bounded controls',()=>{
  assert.deepEqual(designs.map(d=>d.id),['street','sorting','hotspot','household']);
  assert.equal(getDesign('missing').id,'street');
  const supplied={heightCm:NaN,openingCm:Infinity,sidewalkCm:'',fillPercent:null};
  assert.deepEqual(normalizeParameters('street',supplied),{heightCm:110,openingCm:22,sidewalkCm:200,fillPercent:30});
  assert.equal(supplied.openingCm,Infinity);
  assert.deepEqual(normalizeParameters('household',{heightCm:999,openingCm:999,sidewalkCm:-2,fillPercent:999}),{heightCm:130,openingCm:44,sidewalkCm:120,fillPercent:100});
  assert.equal(normalizeParameters('household').openingCm,38);
  assert.equal(getReadout('street',{}).remainingWidthCm,158);
  assert.equal(getReadout('household',{}).remainingWidthCm,120);
});

test('household bag can physically fit but street service still rejects it',()=>{
  assert.equal(evaluateItem('street',{},'bag').allowed,true);
  const state=choose('street','bag');
  assert.equal(evaluateDeposit(state).allowed,false);
  assert.match(step(state,{type:'deposit'}).message,/不收家戶垃圾/);
  assert.equal(evaluateDeposit(choose('street','litter')).allowed,true);
  assert.equal(evaluateDeposit(choose('street','bottle')).allowed,false);
});

test('sorting checks selected stream and never claims automatic recognition',()=>{
  const bottle=choose('sorting','bottle');
  assert.equal(evaluateDeposit(bottle).allowed,false);
  assert.equal(evaluateDeposit(step(bottle,{type:'channel',value:'recycle'})).allowed,true);
  const tissue=step(choose('sorting','litter'),{type:'channel',value:'recycle'});
  assert.equal(evaluateDeposit(tissue).allowed,false);
  assert.equal(evaluateDeposit(step(tissue,{type:'channel',value:'general'})).allowed,true);
});

test('empty selection, small openings and full containers block deposits',()=>{
  assert.equal(evaluateDeposit(createExperience()).allowed,false);
  const state=choose('sorting','bottle'),recycle=step(state,{type:'channel',value:'recycle'});
  assert.equal(evaluateDeposit(recycle,{openingCm:8}).allowed,false);
  assert.equal(evaluateDeposit(recycle,{openingCm:10}).allowed,true);
  const litter=choose('street','litter');
  assert.equal(evaluateDeposit({...litter,fillPercent:99}).allowed,true);
  assert.equal(evaluateDeposit({...litter,fillPercent:100}).allowed,false);
  assert.match(evaluateDeposit({...litter,fillPercent:100}).reason,/帶走垃圾/);
});

test('notification boundary is 80 and scheduling does not empty the bin',()=>{
  const state=worker('hotspot');
  assert.equal(step({...state,fillPercent:79},{type:'request'}).serviceRequested,false);
  const requested=step({...state,fillPercent:80},{type:'request'});
  assert.equal(requested.serviceRequested,true);
  assert.equal(requested.fillPercent,80);
  assert.match(getServiceStatus(requested).label,/尚未清空/);
  assert.match(getServiceStatus({...state,fillPercent:80}).label,/待安排/);
});

test('offline capacity is unknown and normal collection never repairs a sensor',()=>{
  let state=step(worker('hotspot'),{type:'scenario',value:'offline'});
  assert.match(getServiceStatus(state).label,/容量未知/);
  assert.equal(step(state,{type:'request'}).serviceRequested,false);
  assert.equal(step(state,{type:'compress'}).compactionShown,false);
  assert.equal(evaluateDeposit({...state,itemId:'litter'}).allowed,false);
  state=step(step(state,{type:'service'}),{type:'empty'});
  assert.equal(state.sensorOnline,false);assert.equal(state.fillPercent,0);
  state=step(state,{type:'service'});assert.match(getServiceStatus(state).label,/容量未知/);
});

test('maintenance interlocks stop deposit and compaction; closing alone does not empty',()=>{
  let state={...worker('hotspot'),fillPercent:100,itemId:'litter'};
  assert.equal(step(state,{type:'empty'}).fillPercent,100);
  state=step(state,{type:'service'});
  assert.equal(evaluateDeposit(state).allowed,false);
  assert.equal(step(state,{type:'compress'}).compactionShown,false);
  const closed=step(state,{type:'service'});assert.equal(closed.fillPercent,100);
  state=step(state,{type:'empty'});assert.equal(state.fillPercent,0);assert.equal(state.serviceOpen,true);
  assert.equal(evaluateDeposit(state).allowed,false);
  state=step(state,{type:'service'});assert.equal(evaluateDeposit(state).allowed,true);
});

test('compaction is a visual state, not an invented volume or savings calculation',()=>{
  const state={...worker('hotspot'),fillPercent:100};
  const result=step(state,{type:'compress'});
  assert.equal(result.compactionShown,true);assert.equal(result.fillPercent,100);
  assert.match(result.message,/未計算/);
  assert.equal(evaluateDeposit({...result,itemId:'litter'}).allowed,false);
});

test('household intake needs demonstration confirmation, staging, then final confirmation',()=>{
  let state=choose('household','bag');
  assert.equal(evaluateDeposit(state).allowed,false);
  assert.equal(step(state,{type:'confirm'}).authenticated,false);
  state=step(state,{type:'authenticate'});assert.equal(state.authenticated,true);
  assert.equal(step(state,{type:'confirm'}).staged,false);
  state=step(state,{type:'deposit'});assert.equal(state.staged,true);
  assert.equal(evaluateDeposit(state).allowed,false);
  state=step(state,{type:'confirm'});
  assert.equal(state.staged,false);assert.equal(state.authenticated,false);
  assert.match(state.message,/沒有計費、扣款或付款/);
});

test('service or scenario changes invalidate pending household intake',()=>{
  let state=step(choose('household','bag'),{type:'authenticate'});
  state=step(state,{type:'deposit'});
  const full=step(state,{type:'scenario',value:'full'});
  assert.equal(full.staged,false);assert.equal(full.authenticated,false);
  assert.equal(step(full,{type:'authenticate'}).authenticated,false);
  state=step(step(state,{type:'role',value:'worker'}),{type:'service'});
  assert.equal(state.staged,false);assert.equal(state.authenticated,false);
});

test('role boundaries, reset and pure transitions prevent stale actions',()=>{
  const initial=createExperience('hotspot'),copy=structuredClone(initial);
  assert.equal(step(initial,{type:'service'}).serviceOpen,false);
  assert.equal(step(worker('hotspot'),{type:'deposit'}).tone,'warning');
  assert.deepEqual(initial,copy);
  const newPurpose=createExperience('sorting');
  assert.equal(newPurpose.itemId,null);assert.equal(newPurpose.serviceOpen,false);assert.equal(newPurpose.serviceRequested,false);
});
