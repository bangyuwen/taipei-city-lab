import {workflowDefs,caseView,advanceCase} from '../../sites/taipei-city-lab/dist/workflows.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {modules, tones, topics} from '../../sites/taipei-city-lab/dist/registry.js';
import {escapeHTML, format, mapSVG, chartSVG, tableHTML} from '../../sites/taipei-city-lab/dist/viz.js';
import {research} from '../../sites/taipei-city-lab/dist/research.js';
import {inspectCSV} from '../../sites/taipei-city-lab/dist/modules/audit.js';
import {researchAnswer} from '../../sites/taipei-city-lab/dist/answers.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const snapshot = JSON.parse(read('sites/taipei-city-lab/dist/data/snapshot.json'));
const html = read('sites/taipei-city-lab/dist/index.html');
const app = read('sites/taipei-city-lab/dist/app.js');
const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39);/g, token =>
  ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[token]));

function assertFinite(value, label = 'result') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${label} is finite`);
  else if (Array.isArray(value)) value.forEach((item, index) => assertFinite(item, `${label}[${index}]`));
  else if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value)) assertFinite(item, `${label}.${key}`);
}

function verifyResult(module, result) {
  assert.ok(result.metrics.length > 0, module.id);
  for (const metric of result.metrics) {
    assert.equal(typeof metric.value, 'number', `${module.id}: numeric metric`);
    assert.ok(metric.label);
  }
  assertFinite(result, module.id);
  assert.ok(result.explanation && result.assumptions.length && result.sources.length);
  for (const id of result.sources) assert.ok(snapshot.sources[id], `${module.id}: source ${id}`);
  if (result.table) for (const row of result.table.rows)
    for (const column of result.table.columns) assert.ok(Object.hasOwn(row, column.key), `${module.id}: ${column.key}`);
  if (result.chart) for (const series of result.chart.series)
    assert.equal(series.values.length, result.chart.labels.length, `${module.id}: consistent chart categories`);
}

// This DOM is a unit-test stub, not a browser. It exercises the actual app event
// handlers and downloads; no geometry, screenshots or CSS rendering is inferred.
function makeDOM() {
  const nodes = new Map(), downloads = [], blobs = new Map(), listeners = new Map(), timers = new Map();
  let serial = 0;
  class Node {
    constructor(id = '') { this.id=id; this.value=''; this.hidden=false; this.dataset={}; this.content=''; }
    set innerHTML(value) {
      this.content=value;
      for (const match of value.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
        const node=new Node(match[2]), attribute=match[0].match(/\bvalue="([^"]*)"/);
        if(attribute)node.value=decode(attribute[1]);
        if(match[1]==='textarea')node.value=decode(value.slice(match.index+match[0].length).split('</textarea>')[0]);
        nodes.set(match[2],node);
      }
    }
    get innerHTML() { return this.content; }
    style={setProperty(){}};
    classList={add(){},remove(){}};
    querySelector(){return null;}
    insertAdjacentHTML(_, value){this.content+=value;}
    click(){downloads.push({filename:this.download,blob:blobs.get(this.href)});}
    showModal(){this.open=true;}
    close(){this.open=false;}
    setAttribute(name,value){this[name]=value;}
    removeAttribute(name){delete this[name];}
  }
  for(const id of html.matchAll(/\bid="([^"]+)"/g))nodes.set(id[1],new Node(id[1]));
  class TestURL extends URL {}
  TestURL.createObjectURL=blob=>{const id=`blob:test-${++serial}`;blobs.set(id,blob);return id;};
  TestURL.revokeObjectURL=id=>blobs.delete(id);
  return {nodes,downloads,listeners,timers,URL:TestURL,
    document:{getElementById:id=>nodes.get(id)||null,createElement:()=>new Node(),documentElement:{style:{setProperty(){}}}},
    window:{addEventListener:(type,callback)=>listeners.set(type,callback)},
    setTimeout:(callback,delay)=>{const id=++serial;timers.set(id,{callback,delay});return id;},
    clearTimeout:id=>timers.delete(id),
    flushInputs(){for(const [id,timer] of timers)if(timer.delay===80){timers.delete(id);timer.callback();}},
  };
}

export async function boot(saved = null, hash = '#shade') {
  const dom=makeDOM(), fetches=[], storage=new Map();
  if(saved!==null)storage.set('taipei-city-lab-v1',typeof saved==='string'?saved:JSON.stringify(saved));
  const context=vm.createContext({...dom,Blob,URLSearchParams,TextDecoder,TextEncoder,workflowDefs,caseView,advanceCase,modules,tones,topics,research,
    esc:escapeHTML,format,mapSVG,chartSVG,tableHTML,inspectCSV,researchAnswer,location:{hash},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    fetch:async url=>{fetches.push(url);return {ok:true,json:async()=>snapshot};},
  });
  vm.runInContext(app.replace(/^import .+;\n/gm,'')+
    '\n;globalThis.testAPI={paramsFor,csvCell,safeURL,activate,runAudit,getState:()=>state,getActive:()=>active};',context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(dom.nodes.get('loading').hidden,true,'snapshot loads and initialization completes');
  assert.ok(dom.listeners.has('hashchange'),'app activation completes and navigation is registered');
  return {...dom,context,storage,fetches,api:context.testAPI,
    go(id){context.location.hash=`#${id}`;dom.listeners.get('hashchange')();},
    change(key,value){dom.nodes.get('controls').oninput({target:{dataset:{key},value}});dom.flushInputs();},
  };
}

