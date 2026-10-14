import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {boot} from './helpers/app-harness.mjs';

test('switching between a map and comparison preserves parameters, metrics and CSV export',async()=>{
  const h=await boot(null,'#bins');h.change('budget','200000');
  const before=h.nodes.get('metrics').innerHTML;
  h.nodes.get('viewmode-2d').onclick();
  assert.equal(h.nodes.get('geographic-panel').hidden,true);
  assert.equal(h.nodes.get('visualization').hidden,false);
  assert.equal(h.nodes.get('viewmode-2d')['aria-pressed'],'true');
  assert.equal(h.nodes.get('chart-secondary').hidden,true);
  h.nodes.get('viewmode-map').onclick();
  assert.equal(h.nodes.get('visualization').hidden,true);
  assert.equal(h.nodes.get('chart-secondary').hidden,false);
  assert.equal(h.nodes.get('metrics').innerHTML,before);
  h.nodes.get('export-csv').onclick();
  assert.equal(h.downloads.at(-1).filename,'bins-scenario.csv');
});

test('each issue retains its chosen view without offering a street map for CSV audit',async()=>{
  const h=await boot(null,'#bins');h.nodes.get('viewmode-2d').onclick();
  h.go('shade');assert.equal(h.nodes.get('geographic-panel').hidden,false);
  h.go('bins');assert.equal(h.nodes.get('visualization').hidden,false);
  assert.equal(h.nodes.get('geographic-panel').hidden,true);
  h.go('audit');h.nodes.get('viewmode-map').onclick();
  assert.equal(h.nodes.get('geographic-panel').hidden,true);
  assert.equal(h.nodes.get('visualization').hidden,false);
  assert.equal(h.nodes.get('viewmode-map').hidden,true);
});

test('in-page workflow shortcuts focus their target without changing the active issue route',async()=>{
  const h=await boot(null,'#bus'),calls=[];
  const node=h.nodes.get('control-panel');
  node.scrollIntoView=()=>calls.push('scroll');node.focus=()=>calls.push('focus');
  h.nodes.get('task-route').onclick({target:{dataset:{jump:'control-panel'}}});
  assert.deepEqual(calls,['scroll','focus']);assert.equal(h.api.getActive().id,'bus');
  assert.equal(h.context.location.hash,'#bus');
});

test('topic navigation disposes a mounted 3D session before showing a map or CSV audit',async()=>{
  const h=await boot(null,'#bus'),calls=[];
  h.context.sceneStub={dispose:()=>calls.push('disposed')};
  vm.runInContext('sceneSession=sceneStub;',h.context);
  h.go('audit');assert.deepEqual(calls,['disposed']);
  assert.equal(vm.runInContext('sceneSession',h.context),null);
  vm.runInContext('sceneSession=sceneStub;',h.context);
  h.go('bins');assert.deepEqual(calls,['disposed','disposed']);
});

test('selected points survive single-view map disposal and are restored on remount only for that issue',async()=>{
  const h=await boot(null,'#bins'),calls=[];
  h.context.fakeMapModule={mountMap:()=>({
    update(){},dispose:()=>calls.push('disposed'),
    select:id=>calls.push(id),
  })};
  vm.runInContext('window.document={};geoModulePromise=Promise.resolve(fakeMapModule);',h.context);
  h.nodes.get('viewmode-2d').onclick();
  vm.runInContext("scenePayload().onPointSelected({id:'candidate-7'});",h.context);
  h.nodes.get('viewmode-map').onclick();await new Promise(r=>setImmediate(r));
  assert.deepEqual(calls,['candidate-7']);
  h.nodes.get('viewmode-2d').onclick();h.nodes.get('viewmode-map').onclick();
  await new Promise(r=>setImmediate(r));assert.deepEqual(calls,['candidate-7','disposed','candidate-7']);
  h.go('rat');await new Promise(r=>setImmediate(r));
  assert.equal(calls.filter(id=>id==='candidate-7').length,2);
  assert.equal(vm.runInContext('selectedPoint',h.context),null);
});
