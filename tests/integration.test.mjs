import {workflowDefs,caseView,advanceCase} from '../dist/workflows.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {modules, tones, topics} from '../dist/registry.js';
import {escapeHTML, format, mapSVG, chartSVG, tableHTML} from '../dist/viz.js';
import {research} from '../dist/research.js';
import {inspectCSV} from '../dist/modules/audit.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const snapshot = JSON.parse(read('dist/data/snapshot.json'));
const html = read('dist/index.html');
const app = read('dist/app.js');
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

async function boot(saved = null, hash = '#shade') {
  const dom=makeDOM(), fetches=[], storage=new Map();
  if(saved!==null)storage.set('taipei-city-lab-v1',typeof saved==='string'?saved:JSON.stringify(saved));
  const context=vm.createContext({...dom,Blob,URLSearchParams,TextDecoder,TextEncoder,workflowDefs,caseView,advanceCase,modules,tones,topics,research,
    esc:escapeHTML,format,mapSVG,chartSVG,tableHTML,inspectCSV,location:{hash},
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

test('seven modules obey controls, result, deterministic and extreme-input contracts',()=>{
  assert.deepEqual(modules.map(module=>module.id),['shade','bins','rat','traffic','bus','buildings','audit']);
  const before=JSON.stringify(snapshot);
  for(const [index,module] of modules.entries()) {
    assert.equal(module.number,index+1);assert.ok(module.title&&module.subtitle);
    assert.deepEqual(Object.keys(module.defaults).sort(),module.controls.map(control=>control.key).sort());
    for(const control of module.controls) {
      assert.ok(['range','select'].includes(control.type));assert.ok(control.label);
      if(control.type==='select')assert.ok(control.options.some(option=>option.value===module.defaults[control.key]));
      else {
        const value=module.defaults[control.key];
        assert.ok(value>=control.min&&value<=control.max);
        assert.ok(Math.abs((value-control.min)/control.step-Math.round((value-control.min)/control.step))<1e-9);
      }
    }
    const expected=module.evaluate(module.defaults,snapshot);
    verifyResult(module,expected);assert.deepEqual(module.evaluate(module.defaults,snapshot),expected);
    for(const value of [null,NaN,Infinity,-Infinity,-1e12,1e12]) {
      const params=Object.fromEntries(module.controls.map(control=>[control.key,control.type==='select'?'__invalid':value]));
      verifyResult(module,module.evaluate(params,{}));
    }
    verifyResult(module,module.evaluate(null,null));
  }
  assert.equal(JSON.stringify(snapshot),before,'model evaluation leaves observed snapshot unchanged');
});

test('all source references disclose their true grain and observed loading status',()=>{
  assert.ok(snapshot.meta.bbox.length===4&&snapshot.meta.bbox.every(Number.isFinite));
  assert.match(snapshot.meta.scope,/並非全市|示範/);
  for(const [id,source] of Object.entries(snapshot.sources)) {
    assert.ok(source.title&&source.grain&&source.limitations,id);
    assert.ok(['loaded','metadata-only','not-loaded'].includes(source.integrationStatus),id);
    assert.equal(new URL(source.url).protocol,'https:',id);
    if(source.integrationStatus==='loaded')assert.equal(snapshot[id].length,source.counts.filteredCount,id);
  }
  assert.deepEqual(Object.keys(snapshot.sources).filter(id=>snapshot.sources[id].integrationStatus==='loaded').sort(),['bins','trees']);
  assert.match(snapshot.sources.complaints.grain,/無地址|無.*經緯度/);
  assert.match(snapshot.sources.bus.grain,/全市/);assert.match(snapshot.sources.buildings.grain,/彙總/);
  assert.match(snapshot.sources.vd.grain,/靜態/);assert.match(snapshot.sources.metro.grain,/連結清單/);
});

test('static HTML has every shell event target, safe local assets and mobile layout rules',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length,'no duplicate shell IDs');
  for(const id of ['navigation','workspace','module-head','controls','metrics','visualization','chart-secondary',
    'results','method','saved-scenarios','source-dialog','source-body','reset','save-scenario','export-csv',
    'all-export','sources-button','close-sources','audit-input','audit-report','loading','toast'])assert.ok(ids.includes(id),id);
  assert.match(html,/<html lang="zh-Hant">/);assert.match(html,/name="viewport"/);assert.match(html,/aria-live="polite"/);
  for(const [,target] of html.matchAll(/\b(?:src|href)="(\.\/[^"#]+)"/g))
    assert.ok(fs.existsSync(path.join(root,'dist',target.slice(2))),target);
  assert.deepEqual([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match=>match[1]),['./app.js']);
  const css=read('dist/styles.css');
  assert.match(css,/@media\(max-width:650px\)/);assert.match(css,/\.work-grid\{grid-template-columns:1fr\}/);
  assert.match(css,/\.table-scroll\{overflow:auto/);assert.match(css,/prefers-reduced-motion/);
  assert.doesNotMatch(css,/@import|url\(\s*["']?https?:/i);
});

test('SVG and tables escape content, keep finite coordinates, and distinguish map point kinds',()=>{
  const payload='<script>alert("x")</script>';
  const result=mapSVG({points:[{id:'chosen',x:1,y:1,label:payload,kind:'recommended'},
    {id:'known',x:1,y:1,kind:'existing'},{id:'need',x:1.2,y:1.1,kind:'demand'},
    {id:'candidate',x:1.1,y:1.2,kind:'candidate'},{id:'invalid',x:Infinity,y:NaN}],
    lines:[{points:[{x:1,y:1},{x:NaN,y:1},{x:1.2,y:1.2}],label:payload}]},[NaN,0,1,1]);
  assert.doesNotMatch(result,/NaN|Infinity|<script>/);assert.match(result,/&lt;script&gt;/);
  assert.match(result,/合成需求/);assert.match(result,/合成候選/);assert.match(result,/role="button"/);
  assert.ok(result.indexOf('data-point-id="chosen"')>result.indexOf('data-point-id="candidate"'));
  assert.doesNotMatch(mapSVG({points:[]},[1,1,0,0]),/NaN|Infinity/);
  assert.doesNotMatch(tableHTML({columns:[{key:'x',label:payload}],rows:[{x:payload}]}),/<script>/);
  for(const type of ['line','bar']) {
    const chart=chartSVG({type,labels:[payload,'正值','空值'],series:[{label:payload,values:[-3,4,NaN]}]});
    assert.doesNotMatch(chart,/NaN|Infinity|<script>/);assert.match(chart,/&lt;script&gt;/);
    if(type==='bar')assert.equal((chart.match(/<rect /g)||[]).length,2);
    else assert.match(chart,/<path d="M/);
  }
});

test('actual app handlers navigate, update controls, persist, load, delete and reset scenarios',async()=>{
  const h=await boot();
  for(const module of modules){h.go(module.id);assert.equal(h.api.getActive().id,module.id);assert.match(h.nodes.get('module-head').innerHTML,new RegExp(module.title));}
  h.go('traffic');h.change('shift','80');assert.equal(h.api.paramsFor(modules[3]).shift,80);
  h.nodes.get('save-scenario').onclick();h.change('shift','0');assert.equal(h.api.paramsFor(modules[3]).shift,0);
  h.nodes.get('saved-scenarios').onclick({target:{dataset:{load:'0'}}});assert.equal(h.api.paramsFor(modules[3]).shift,80);
  h.nodes.get('reset').onclick();assert.equal(h.api.paramsFor(modules[3]).shift,modules[3].defaults.shift);
  h.nodes.get('saved-scenarios').onclick({target:{dataset:{delete:'0'}}});assert.equal(h.api.getState().saved.traffic.length,0);
  assert.equal(JSON.parse(h.storage.get('taipei-city-lab-v1')).params.traffic.shift,modules[3].defaults.shift);
  h.go('unknown-hash');assert.equal(h.api.getActive().id,'bins');
  h.go('audit');h.change('question','bus');assert.equal(h.api.paramsFor(modules[6]).question,'bus');
  h.go('bus');assert.equal(h.nodes.get('audit-input').hidden,true);
});

test('malformed storage and invalid saved entries cannot disable controls',async()=>{
  for(const saved of ['{bad json', {params:'bad',saved:[]},{params:{traffic:null},saved:{traffic:[null,'x',{name:'bad',params:5}]}}]) {
    const h=await boot(saved,'#traffic');h.change('shift','55');h.nodes.get('save-scenario').onclick();
    assert.equal(h.api.paramsFor(modules[3]).shift,55);assert.doesNotMatch(h.nodes.get('visualization').innerHTML,/fatal-error/);
  }
  const h=await boot({params:{traffic:{shift:999},rat:{focus:'invalid'}},saved:{}},'#traffic');
  assert.equal(h.api.paramsFor(modules[3]).shift,80);h.go('rat');assert.equal(h.api.paramsFor(modules[2]).focus,'balanced');
  const injected=await boot({params:{traffic:{shift:'" onfocus="alert(1)',delay:53,capacity:null}},saved:{}},'#traffic');
  assert.equal(injected.api.paramsFor(modules[3]).shift,modules[3].defaults.shift);
  assert.equal(injected.api.paramsFor(modules[3]).delay,55);
  assert.equal(injected.api.paramsFor(modules[3]).capacity,modules[3].defaults.capacity);
  assert.doesNotMatch(injected.nodes.get('controls').innerHTML,/onfocus|alert\(/);
});

test('CSV export mitigates spreadsheet formula prefixes without changing numeric negatives',async()=>{
  const h=await boot();
  for(const value of ['=1+1',' +SUM(1,2)','\u00a0@SUM(1,2)',' -5','\tformula','\rvalue','\nvalue'])
    assert.ok(h.api.csvCell(value).startsWith('"\''),JSON.stringify(value));
  assert.equal(h.api.csvCell(-5),'"-5"');assert.equal(h.api.csvCell('a,"b"'),'"a,""b"""');
  h.go('traffic');h.nodes.get('export-csv').onclick();
  const exported=await h.downloads.at(-1).blob.text();
  assert.equal(h.downloads.at(-1).filename,'traffic-scenario.csv');assert.match(exported,/情境到達/);
  h.nodes.get('all-export').onclick();const research=JSON.parse(await h.downloads.at(-1).blob.text());
  assert.equal(research.scenarios.length,7);assert.equal(research.scenarios[3].params.shift,modules[3].defaults.shift);
  assert.ok(research.scenarios.every(item=>item.assumptions.length&&item.sources.length));
  assert.equal(h.api.safeURL('javascript:alert(1)'),'#');assert.equal(h.api.safeURL('http://example.org'),'#');
});

test('local CSV audit renders one copy of errors, enforces upload limit and never persists CSV',async()=>{
  const h=await boot(null,'#audit');
  const marker='LOCAL_PRIVATE_SENTINEL';
  h.nodes.get('csv-text').value=`id,note\n1,${marker}\n2`;
  h.nodes.get('run-audit').onclick();
  assert.equal((h.nodes.get('audit-report').innerHTML.match(/此列有 1 欄/g)||[]).length,1);
  h.nodes.get('save-scenario').onclick();assert.ok(!h.storage.get('taipei-city-lab-v1').includes(marker));
  h.nodes.get('export-audit').onclick();const report=JSON.parse(await h.downloads.at(-1).blob.text());
  assert.equal(report.rowCount,1);assert.equal(report.valid,false);
  await h.nodes.get('csv-file').onchange({target:{files:[{size:2*1024*1024+1,arrayBuffer(){throw Error('must not read');}}]}});
  assert.match(h.nodes.get('toast').textContent,/超過 2 MB/);
  h.nodes.get('csv-text').value=`id,note\n1,<img src=x onerror=alert(1)>`;
  h.nodes.get('run-audit').onclick();assert.doesNotMatch(h.nodes.get('audit-report').innerHTML,/<img/);
  h.go('traffic');h.change('shift','55');h.nodes.get('all-export').onclick();
  assert.ok(!(await h.downloads.at(-1).blob.text()).includes(marker));
  assert.deepEqual(h.fetches,['./data/snapshot.json'],'only the packaged snapshot is fetched');
  assert.doesNotMatch(app,/sendBeacon|XMLHttpRequest|WebSocket|https?:\/\/|\.post\(/);
});
