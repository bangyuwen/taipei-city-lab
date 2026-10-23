import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, cp, mkdir, mkdtemp, rm, unlink, writeFile, readdir, symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync, spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const site = new URL('../', import.meta.url);
const demo = new URL('../../youtong/', import.meta.url);
const python = process.env.PYTHON_BIN || 'python3';
const read = path => readFile(new URL(path, site), 'utf8');

test('publication connects both entrances and preserves private boundaries and plan identity', async t => {
  const fixture = await mkdtemp(join(tmpdir(), 'waste-portal-'));
  t.after(() => rm(fixture, {recursive:true, force:true}));
  const root = join(fixture, 'sites/taipei-waste-lab');
  await mkdir(join(root, 'scripts'), {recursive:true});
  for (const name of ['prepare-public.py', 'prepare-portal.py']) await cp(new URL('scripts/'+name,site), join(root,'scripts',name));
  await cp(new URL('templates/portal/',site),join(root,'templates/portal'),{recursive:true});
  const assets = JSON.parse(execFileSync(python, ['-c', "import runpy,json;print(json.dumps(runpy.run_path('scripts/prepare-public.py')['ASSETS']))"], {cwd:site,encoding:'utf8'}));
  for(const name of assets){await mkdir(join(root,'out',name,'..'),{recursive:true});await cp(new URL('dist/'+name,site),join(root,'out',name));}
  await cp(demo,join(fixture,'sites/youtong'),{recursive:true});
  const plan='research/decision-checks-2026-10-22/checks.json';
  await mkdir(join(root,plan,'..'),{recursive:true});await cp(new URL(plan,site),join(root,plan));
  const stage=()=>spawnSync(python,[join(root,'scripts/prepare-portal.py')],{encoding:'utf8'});
  let result=stage();assert.equal(result.status,0,result.stderr);
  const output=join(root,'public');
  const casePage=await read('dist/cases/zhongshan.html');
  assert.equal(await readFile(join(root,'out/cases/zhongshan.html'),'utf8'),casePage);
  assert.equal(await readFile(join(output,'research/cases/zhongshan.html'),'utf8'),casePage);
  await assert.rejects(readFile(join(output,'research/research/placement-case-2026-10-23/inputs.json')),{code:'ENOENT'});
  const html=await readFile(join(output,'index.html'),'utf8');
  assert.match(html,/href="demo\/"/);assert.match(html,/href="research\/"/);
  assert.match(await readFile(join(output,'demo/index.html'),'utf8'),/pedestrian\.html/);
  assert.match(await readFile(join(output,'research/index.html'),'utf8'),/research-nav\.js/);
  const current=JSON.parse(await readFile(join(output,'demo/current-plan.json')));
  assert.equal(current.sourceSHA256,createHash('sha256').update(await readFile(new URL(plan,site))).digest('hex'));
  assert.deepEqual(current.scheduled_visits,[]);assert.equal(current.district_quota,null);
  // No database administration or research input is published with the prototype.
  const names=[];
  async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory())await walk(join(dir,e.name),prefix+e.name+'/');else names.push(prefix+e.name);}}
  await walk(output);
  assert.ok(!names.some(p=>/\.py$|\.csv$|\.zip$|\.md$|database\.rules|firebase\.json|source\.tsv|wipe-cloud/.test(p)));
  for(const page of ['demo/pedestrian.html','demo/planning.html','demo/crew.html','research/index.html','research/cases/zhongshan.html']){
    const body=await readFile(join(output,page),'utf8');
    for(const [,url] of body.matchAll(/(?:src|href)="([^"#]+)"/g)){
      if(/^(https?:|data:)|\$\{/.test(url)||url.startsWith('?'))continue;
      const dest=new URL(url,'https://portal.test/'+page).pathname;
      if(dest.endsWith('/'))continue;
      assert.ok((await readFile(join(output,dest))).length,`${page}: ${url}`);
    }
  }
  await writeFile(join(output,'stale-private.csv'),'private');
  result=stage();assert.equal(result.status,0,result.stderr);
  await assert.rejects(readFile(join(output,'stale-private.csv')),{code:'ENOENT'});
  await writeFile(join(output,'sentinel'),'preserved');
  const originalPlan = await readFile(join(root,plan),'utf8');
  for (const changedPlan of [{status:'in_progress'}, {district_quota:1}, {scheduled_visits:['candidate']}]) {
    await writeFile(join(root,plan),JSON.stringify({...JSON.parse(originalPlan),...changedPlan}));
    result=stage();assert.notEqual(result.status,0);assert.match(result.stderr,/changed field-plan status/);
    assert.equal(await readFile(join(output,'sentinel'),'utf8'),'preserved');
  }
  await writeFile(join(root,plan),originalPlan);
  await unlink(join(fixture,'sites/youtong/config.js'));
  result=stage();assert.notEqual(result.status,0);assert.match(result.stderr,/Missing portal input/);
  assert.equal(await readFile(join(output,'sentinel'),'utf8'),'preserved');
  await symlink(join(root,plan),join(fixture,'sites/youtong/config.js'));
  result=stage();assert.notEqual(result.status,0);assert.match(result.stderr,/must not be a symlink/);
});

test('old research fragments and query parameters survive the homepage move', async()=>{
  const code=await read('templates/portal/portal.js');
  for(const [search,hash,expected] of [['?year=2024-archive&district=中山區','#map','research/?year=2024-archive&district=中山區#map'],['','#plan','research/#plan'],['?year=2015','','research/?year=2015'],['','',''],['','#main','']]){
    let target='';vm.runInNewContext(code,{URLSearchParams,location:{search,hash,replace:v=>target=v}});assert.equal(target,expected);
  }
});

function storage(seed={}){const values=new Map(Object.entries(seed));return {get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
test('demo events stay isolated even with a cloud override and reset preserves live and research data',async()=>{
  const localStorage=storage({'有桶_events_v1':'[{"bin":"live"}]','有桶beta_events_v1':'beta','有桶tcl_events_v1':'previous','research-state':'research'});
  const context={localStorage,sessionStorage:storage({'research':'keep'}),URLSearchParams,location:{pathname:'/demo/pedestrian.html',search:''},document:{readyState:'loading',addEventListener(){}},addEventListener(){},setTimeout(){},console};
  context.window=context;
  context.FB_TEST={config:{databaseURL:'https://must-not-connect.invalid',apiKey:'test'}};
  vm.createContext(context);
  for(const name of ['config.js','common.js','cloud.js'])vm.runInContext(await readFile(new URL(name,demo),'utf8'),context,{filename:name});
  assert.equal(context.CLOUD_ON,false);assert.equal(context.Cloud.on,false);
  vm.runInContext("addEvent({bin:'B0001',kind:'full',by:'demo'}); addNeed(25.02,121.54)",context);
  assert.equal(JSON.parse(localStorage.getItem('有桶demo_v1_events_v1')).length,1);
  assert.equal(JSON.parse(localStorage.getItem('有桶demo_v1_needs_v1')).length,1);
  assert.equal(vm.runInContext('cloudQ().length',context),0);
  vm.runInContext('resetAppState()',context);
  assert.equal(localStorage.getItem('有桶demo_v1_events_v1'),null);
  assert.equal(localStorage.getItem('有桶_events_v1'),'[{"bin":"live"}]');
  assert.equal(localStorage.getItem('有桶beta_events_v1'),'beta');assert.equal(localStorage.getItem('有桶tcl_events_v1'),'previous');
  assert.equal(localStorage.getItem('research-state'),'research');assert.equal(context.sessionStorage.getItem('research'),'keep');
});
