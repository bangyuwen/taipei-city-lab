import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {modules} from '../dist/registry.js';
import {mapSVG,chartSVG,tableHTML} from '../dist/viz.js';

const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const data=JSON.parse(read('dist/data/snapshot.json'));
const assert=(test,message)=>{if(!test)throw new Error(message);};
for(const script of ['build-topic-models.py','build-topic-data.py','build-topic-sites.py']){
  const check=spawnSync('python',[path.join(root,'scripts',script),'--check'],{cwd:root,encoding:'utf8'});
  assert(check.status===0,check.stdout+check.stderr);
}
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of files(path.join(root,'dist')).filter(f=>f.endsWith('.js'))){const c=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert(c.status===0,c.stderr);assert(file.includes(path.sep+'vendor'+path.sep)||read(path.relative(root,file)).split('\n').length<=500,'File exceeds 500 LOC: '+file);}
assert(modules.length===7,'Must have seven modules');
assert(new Set(modules.map(m=>m.id)).size===7,'Module identities must be unique');
for(const m of modules){
  assert(m.number>=1&&m.number<=7,'Invalid issue number');
  for(const c of m.controls)assert(c.key in m.defaults,'Missing default '+m.id+'/'+c.key);
  const variants=[m.defaults,{},Object.fromEntries(m.controls.map(c=>[c.key,c.type==='range'?c.min:c.options[0].value])),Object.fromEntries(m.controls.map(c=>[c.key,c.type==='range'?c.max:c.options.at(-1).value]))];
  for(const params of variants){
    const r=m.evaluate(params,data);
    for(const metric of r.metrics)assert(typeof metric.value!=='number'||Number.isFinite(metric.value),m.id+' nonfinite metric');
    for(const id of r.sources)assert(data.sources[id],m.id+' unknown source '+id);
    assert(r.assumptions?.length>0,m.id+' missing assumptions');
    assert(r.table?.columns?.length>0,m.id+' missing result table');
    for(const chart of [r.chart,r.secondaryChart].filter(Boolean))for(const series of chart.series)assert(series.values.length===chart.labels.length,m.id+' inconsistent chart length');
    const html=(r.secondaryChart?chartSVG(r.secondaryChart):'')+(r.map?mapSVG(r.map,data.meta.bbox):'')+(r.chart?chartSVG(r.chart):'')+tableHTML(r.table);
    assert(!html.includes('NaN')&&!html.includes('Infinity'),m.id+' invalid generated SVG or table');
    assert(html.length>30,m.id+' empty visual result');
  }
  console.log(m.id+': defaults, zero/low, high, sources and generated views checked');
}
const index=read('dist/index.html');
assert(index.includes('lang="zh-Hant"'),'Missing Traditional Chinese language');
for(const ref of [...index.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(m=>m[1]))assert(fs.existsSync(path.resolve(root,'dist',ref)),'Missing asset '+ref);
for(const source of Object.values(data.sources))assert(/^https:\/\//.test(source.url),'Sources require HTTPS');
console.log('Seven-module static asset, syntax, data and generated-view checks passed.');
