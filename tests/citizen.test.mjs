import test from 'node:test';
import assert from 'node:assert/strict';
import {boot} from './helpers/app-harness.mjs';

test('a citizen experiment preserves unrelated conditions and exports its current result',async()=>{
  const h=await boot(null,'#bins');h.change('radius','500');
  h.nodes.get('exploration-guide').onclick({target:{dataset:{experiment:'0'}}});
  assert.equal(h.api.paramsFor(h.api.getActive()).budget,5);
  assert.equal(h.api.paramsFor(h.api.getActive()).radius,500);
  assert.equal(JSON.parse(h.storage.get('taipei-city-lab-v1')).params.bins.budget,5);
  h.nodes.get('export-csv').onclick();
  const csv=await h.downloads.at(-1).blob.text();
  assert.ok(csv.split('\r\n').length<=6,'five-bin experiment exports at most five recommended rows');
  h.nodes.get('reset').onclick();assert.equal(h.api.paramsFor(h.api.getActive()).budget,20);
});

test('exploration entry and mobile navigation do not alter saved topic parameters or view',async()=>{
  const h=await boot(null,'#bins');h.change('budget','8');h.nodes.get('viewmode-2d').onclick();
  h.go('explore');assert.equal(h.api.getActive().id,'bins');assert.equal(h.nodes.get('city-intro').hidden,false);
  h.nodes.get('topic-menu-toggle').onclick();assert.equal(h.nodes.get('topic-menu-toggle')['aria-expanded'],'true');
  h.go('bus');assert.equal(h.nodes.get('city-intro').hidden,true);assert.equal(h.nodes.get('topic-menu-toggle')['aria-expanded'],'false');
  h.go('bins');assert.equal(h.api.paramsFor(h.api.getActive()).budget,8);assert.equal(h.nodes.get('visualization').hidden,false);
});
