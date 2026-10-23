import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const demo=new URL('../../youtong/',import.meta.url);
const html=await readFile(new URL('crew.html',demo),'utf8');
const model=await readFile(new URL('crew-list.js',demo),'utf8');
// Run the actual page consumers, not copies of their reporting predicates.
const body=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
function fixture(events){
  const p={done:new Set(),skip:new Set()},mine=new Set();
  const c={Intl,Date,Set,Map,P:events.map(e=>({id:e.bin})),getEvents:()=>events,
    mineLoad:()=>mine,zone:'A',progLoad:()=>p,binState:()=>null,OC:{}};
  c.window=c;
  vm.createContext(c);vm.runInContext(model,c);
  vm.runInContext(body('function refreshOC()', '\nconst act='),c);
  for(const name of ['todayCrew','crewWho'])vm.runInContext(html.match(new RegExp('^function '+name+'\\(\\).*$', 'm'))[0],c);
  return {c,p,mine};
}

test('crew page loads the observed-report model used by all three status consumers',()=>{
  assert.match(html,/<script src="crew-list\.js[^\"]*"><\/script>/);
  const now=Date.now(),event=(bin,extra={})=>({bin,kind:'clear',by:'清潔隊',amount:'half',ts:now,...extra});
  const events=[...['empty','half','full','overflow'].map(amount=>event(amount,{amount})),
    event('bare',{amount:undefined}),event('level',{kind:'level'}),event('invalid-amount',{amount:'unknown'}),
    event('old',{ts:now-86400000}),event('future',{ts:now+60000}),event('invalid-time',{ts:NaN}),
    event('pedestrian',{by:'行人'}),event('legacy-time',{ts:undefined,ot:now})];
  const {c}=fixture(events),expected=['empty','full','half','overflow'];
  for(const name of ['todayCrew','crewWho','refreshOC'])assert.deepEqual(Object.keys(c[name]()).sort(),expected,name);
});

test('crew status follows the latest valid amount and distinguishes own reports',()=>{
  const now=Date.now(),events=[
    {id:'old',bin:'B1',kind:'clear',by:'清潔隊',amount:'half',ts:now-1000},
    {id:'new',bin:'B1',kind:'clear',by:'清潔隊',amount:'empty',ts:now},
    {id:'bare',bin:'B1',kind:'clear',by:'清潔隊',ts:now}];
  const {c,mine}=fixture(events);mine.add('new');
  assert.equal(c.todayCrew().B1,now);assert.equal(c.crewWho().B1.me,true);
  assert.deepEqual(Object.keys(c.refreshOC()),[]);
  events.splice(1,1);assert.equal(c.todayCrew().B1,now-1000);assert.equal(c.crewWho().B1.me,false);
  assert.equal(c.refreshOC().B1,now-1000);
});

test('bulk skip preserves observations and completed or externally reported stops',()=>{
  const p={done:new Set(['done']),skip:new Set(['skipped'])},events=[];
  const c={allClear:{},route:['pending','done','skipped','other'].map(id=>({b:{id}})),OC:{other:1},
    progLoad:()=>p,progSave:()=>{},confirm:()=>true,toast:()=>{},draw:()=>{},setSheet:{hidden:false},
    addEvent:e=>events.push(e)};
  vm.runInNewContext(body('allClear.onclick=', '\niLpr.textContent='),c);c.allClear.onclick();
  assert.deepEqual([...p.skip].sort(),['pending','skipped']);assert.deepEqual([...p.done],['done']);
  assert.deepEqual(events,[]);assert.equal(c.setSheet.hidden,true);
});

test('navigation undo resolves the original bin after a synchronized route insertion',()=>{
  for(const action of ['record','skipStop'])for(const removed of [false,true]){
    const route=['B1','B2'].map(id=>({b:{id}})),events=[],reopened=[],state={cal:{},clear:{}};
    const c={route,P:route.map(e=>e.b),FC:{state:()=>state,clearAndCalibrate:()=>({pred:50,k:1,old:1}),save:()=>{}},
      day:()=> 'we',T:()=>930,AMT:[['half','半',50]],rampState:()=>({t:'半'}),
      addEvent:e=>{const event={...e,id:'report',ts:1};events.push(event);return event},
      getEvents:()=>events,removeEvent:id=>events.splice(events.findIndex(e=>e.id===id),1),
      mineAdd:()=>{},progMark:()=>{},advSet:()=>{},advClear:()=>{},draw:()=>{},fitTop:()=>{},
      undoToast:(_,fn)=>{c.undo=fn},crewReopen:i=>reopened.push(route[i].b.id),
      crewSoftEnd:()=>{},NAVH:{setCol:()=>{}},navStart:b=>reopened.push(b.id),curIdx:()=>-1,
      navOff:()=>{},requestAnimationFrame:fn=>fn()};
    vm.runInNewContext(body('function record(', '\ncard.onclick='),c);
    if(action==='record')c.record('B2','half',50,{nav:true});else c.skipStop('B2',true);
    // A sync inserts a stop before the saved index while the undo toast is open.
    route.unshift({b:{id:'new-stop'}});
    if(removed)route.splice(route.findIndex(e=>e.b.id==='B2'),1);
    c.undo();
    assert.deepEqual(reopened,removed?[]:['B2'],`${action}, removed=${removed}`);
    assert.deepEqual(events,[]);
  }
});


test('crew startup recovers from malformed or null saved UI without discarding valid settings',()=>{
  const initialization=html.match(/^const q=new URLSearchParams.*$/m)[0];
  for(const [raw,expected] of [['{broken-json','{}'],['null','{}'],[null,'{}'],['{"zone":"B","t":930}','{"zone":"B","t":930}']]){
    const c={URLSearchParams,location:{search:''},LSU:'saved-ui',localStorage:{getItem:()=>raw}};
    vm.createContext(c);vm.runInContext(initialization,c);
    assert.equal(vm.runInContext('JSON.stringify(ui)',c),expected);
  }
});
