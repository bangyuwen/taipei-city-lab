import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context={Intl,Date};context.window=context;
vm.runInNewContext(await readFile(new URL('../../youtong/crew-list.js',import.meta.url),'utf8'),context);
const model=context.CrewList;

test('assigned inventory keeps source order and every fullness class, regardless of forecast ranking',()=>{
  const fills=[0,50,69,70,71,99,100,101,120];
  const assigned=fills.map((fill,i)=>({id:'B'+i}));
  const forecasts=assigned.map((b,i)=>({b,fill:fills[i]})).reverse();
  forecasts.push({b:{id:'unassigned'},fill:150});
  const rows=model.entries(assigned,forecasts);
  assert.deepEqual(Array.from(rows,x=>x.b.id),assigned.map(x=>x.id));
  assert.deepEqual(Array.from(rows,x=>x.fill),fills);
  assert.equal(model.entries(assigned,[]).length,assigned.length);
  assert.equal(model.entries([],forecasts).length,0);
});

test('today status requires an observed crew amount; missing, prior-day and bare completion remain unreported',()=>{
  const assigned=['empty','half','full','overflow','missing','bare','yesterday','pedestrian','future','invalid'].map(id=>({id}));
  const now=Date.parse('2026-10-23T00:00:00+08:00');
  const event=(bin,extra={})=>({bin,kind:'clear',by:'清潔隊',amount:'empty',ts:now,...extra});
  const events=[...['empty','half','full','overflow'].map(amount=>event(amount,{amount})),event('bare',{amount:undefined}),event('yesterday',{ts:now-1}),event('pedestrian',{kind:'full',by:'行人'}),event('future',{ts:now+1}),event('invalid',{ts:NaN}),event('invalid',{ts:1e25}),event('unassigned')];
  assert.deepEqual(Array.from(model.reports(assigned,events,now).keys()),['empty','half','full','overflow']);
  assert.equal(model.reports(assigned,events,now+86400000).size,0);
});

test('latest observation and undo follow retained records, not route completion keys',()=>{
  const now=Date.parse('2026-10-23T12:00:00+08:00'),assigned=[{id:'B1'}];
  const earlier={id:'first',bin:'B1',kind:'clear',by:'清潔隊',amount:'half',ts:now-1000};
  const later={...earlier,id:'second',amount:'empty',ts:now};
  assert.equal(model.reports(assigned,[later,earlier],now).get('B1').amount,'empty');
  assert.equal(model.reports(assigned,[earlier],now).get('B1').amount,'half');
  assert.equal(model.reports(assigned,[],now).size,0);
});
