import {readFile,access,readdir,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../dist');
const html=await readFile(resolve(root,'index.html'),'utf8');
const hosting=JSON.parse(await readFile(resolve(root,'../.openai/hosting.json')));
if(hosting.project_id!=='appgprj_6acfae6c57308191a1c3f97a36d33b66'||hosting.static?.directory!=='out')throw Error('Hosting manifest incomplete');
const files=['siting-ui.js','siting-overlay.html','app.js','history.js','data-utils.js','styles.css','mark.svg','data/datasets.json','data/taipei-bins-2026-study-area.provenance.json',
  'comparison-ui.js','comparison-utils.js','comparison.css','data/comparison-2024-2026.json','data/comparison-2024-2026.csv',
  'research/comparison-2024-2026/README.md','research/comparison-2024-2026/protocol.json',
  'data/comparison-coordinate-distances.json','data/comparison-coordinate-distances.csv',
  'research/coordinate-distances-2024-2026/README.md','research/coordinate-distances-2024-2026/protocol.json',
  'country-ui.js', 'country-comparison.js', 'country-stories.js','country-scene.js','country-model-data.js','country-models.js','country.css',
  'design-ui.js','design-model.js','bin-scene.js','design.css','research/bin-design.md',
  'vendor/three/three.module.js','vendor/three/three.core.js','vendor/three/OrbitControls.js','vendor/three/LICENSE','vendor/three/manifest.json'];
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const url=match[1];if(!/^https?:/.test(url))files.push(url);
}
for(const file of new Set(files))await access(resolve(root,file));
const catalog=JSON.parse(await readFile(resolve(root,'data/datasets.json'),'utf8'));
const comparison=JSON.parse(await readFile(resolve(root,'data/comparison-2024-2026.json'),'utf8'));
const distances=JSON.parse(await readFile(resolve(root,'data/comparison-coordinate-distances.json'),'utf8'));
if(createHash('sha256').update(await readFile(resolve(root,'data/comparison-2024-2026.json'))).digest('hex')!==distances.meta.comparisonSHA256)throw Error('Coordinate analysis comparison hash mismatch');
for(const side of ['before','after']){
  const source=comparison.meta[side];
  const bytes=await readFile(resolve(root,'data',source.file));
  if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error(`Comparison source hash mismatch: ${side}`);
}
for(const dataset of catalog.datasets){
  await access(resolve(root,'data',dataset.file));
  if(dataset.provenanceFile){
    const provenance=JSON.parse(await readFile(resolve(root,'data',dataset.provenanceFile),'utf8'));
    if(provenance.sourceManifest)await access(resolve(root,'data',provenance.sourceManifest));
  }
}
const recovery=resolve(root,'research/source-recovery-2026-10-15');
const recoveryManifest=JSON.parse(await readFile(resolve(recovery,'manifest.json'),'utf8'));
for(const [file,entry] of Object.entries(recoveryManifest.files)){
  const bytes=await readFile(resolve(recovery,file));
  if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error(`Recovery input hash mismatch: ${file}`);
}
const three=JSON.parse(await readFile(resolve(root,'vendor/three/manifest.json'),'utf8'));
for(const [file,entry] of Object.entries(three.files)){
  const bytes=await readFile(resolve(root,'vendor/three',file));
  if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error(`Three.js asset hash mismatch: ${file}`);
}
const photos=JSON.parse(await readFile(resolve(root,'images/countries/sources.json'),'utf8')).photos;
const photoPaths=[...html.matchAll(/<img src="(images\/countries\/[^"]+)"/g)].map(match=>match[1]);
if(photos.length<6||new Set(photoPaths).size!==photos.length||photoPaths.length!==photos.length)throw Error('Country photo manifest must match unique displayed photos');
for(const photo of photos){
  const file='images/countries/'+photo.file;
  if(!photoPaths.includes(file)||!html.includes(photo.source_page.replaceAll('&','&amp;')))throw Error(`Missing photo or attribution: ${photo.id}`);
  const bytes=await readFile(resolve(root,file));
  if(createHash('sha256').update(bytes).digest('hex')!==photo.sha256)throw Error(`Photo source hash mismatch: ${photo.id}`);
}
for(const [,target] of html.matchAll(/data-country-target="([^"]+)"/g)){
  if(!html.includes(`id="${target}" tabindex="-1"`))throw Error(`Country navigation target missing: ${target}`);
}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw Error('Duplicate HTML IDs');
const css=await readFile(resolve(root,'styles.css'),'utf8');
for(const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))await access(resolve(root,match[1]));
const notes=await readFile(resolve(root,'research/bin-removal-history.md'),'utf8');
for(const match of notes.matchAll(/\]\(\.\.\/data\/([^\)]+)\)/g))await access(resolve(root,'data',match[1]));
const publicRoot=resolve(root,'../out');
// Read the fixed tuple through Python, so multiline entries have one canonical owner.
const {execFileSync}=await import('node:child_process');
const assets=JSON.parse(execFileSync(process.env.PYTHON_BIN||'python3',['-c',"import json, runpy; print(json.dumps(runpy.run_path('scripts/prepare-public.py')['ASSETS']))"],{cwd:resolve(root,'..'),encoding:'utf8'}));
async function walk(directory,prefix=''){
  const found=[];
  for(const name of await readdir(directory)){
    const relative=prefix+name;const path=resolve(directory,name);const stat=await lstat(path);
    if(stat.isSymbolicLink())throw Error(`Public symlink: ${relative}`);
    if(stat.isDirectory())found.push(...await walk(path,relative+'/'));
    else if(stat.isFile())found.push(relative);
    else throw Error(`Unexpected public entry: ${relative}`);
  }
  return found;
}
if((await lstat(publicRoot)).isSymbolicLink())throw Error('Public output root is a symlink');
const actual=await walk(publicRoot);
if(JSON.stringify(actual.sort())!==JSON.stringify([...assets].sort()))throw Error('Public asset allowlist mismatch');
for(const name of assets){
  if(!(await readFile(resolve(publicRoot,name))).equals(await readFile(resolve(root,name))))throw Error(`Public asset differs: ${name}`);
}
const publicHTML=await readFile(resolve(publicRoot,'index.html'),'utf8');
if(/\bdownload(?:\s|=|>)/i.test(publicHTML)||/id=["'](?:export-csv|comparison-export|comparison-district-export)["']/.test(publicHTML))throw Error('Public download control remains');
const districtMapLinks=new Set(catalog.districtOrder.map(district=>`?${new URLSearchParams({year:'2026-main',district})}#map`));
for(const [,href] of publicHTML.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)){
  if(!/^(?:https?:|#)/i.test(href)&&href!=='siting-overlay.html'&&!['design-thinking/index.html','prd/index.html'].includes(href.split('#')[0])&&!districtMapLinks.has(href.replaceAll('&amp;','&')))throw Error(`Local public attachment link: ${href}`);
}
for(const name of ['app.js','comparison-ui.js']){
  const code=await readFile(resolve(publicRoot,name),'utf8');
  if(/createObjectURL|\.download\s*=/.test(code))throw Error(`Public export handler remains: ${name}`);
}
console.log(`Private integrity, public runtime allowlist, hosting identity and ${ids.length} unique HTML IDs verified.`);

const overlay=await readFile(resolve(publicRoot,'siting-overlay.html'),'utf8');
const overlayInput=JSON.parse(await readFile(resolve(root,'../data/siting-overlay.json'),'utf8'));
overlayInput.fieldPriorities=JSON.parse(await readFile(resolve(root,'../data/field-priorities.json'),'utf8'));
const embedded=overlay.match(/<script type="application\/json" id="overlay-data">([\s\S]*?)<\/script>/);
if(!embedded||JSON.stringify(JSON.parse(embedded[1]))!==JSON.stringify(overlayInput))throw Error('Siting display snapshot differs from preserved source');
if(overlayInput.candidates.features.length!==425||JSON.stringify(overlayInput.layers.map(layer=>layer.mapped))!=='[2505,1799,1000,1969,680]')throw Error('Siting snapshot scope changed');
if(/\bdownload(?:\s|=|>)/i.test(overlay)||/href=["']inventory\.html/.test(overlay))throw Error('Siting attachment control remains');
for(const [,href] of overlay.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)){
  if(!/^(?:https?:|#)/i.test(href)&&!['./#siting','field-checklist.html'].includes(href))throw Error(`Siting attachment link: ${href}`);
}
const checklist=await readFile(resolve(publicRoot,'field-checklist.html'),'utf8');
if((checklist.match(/<article class="sheet"/g)||[]).length!==10)throw Error('Expected ten printable data assessments');
if(/<script[^>]*src=|<iframe|\bdownload(?:\s|=|>)/i.test(checklist))throw Error('Checklist must remain self-contained without attachment controls');
for(const [,href] of checklist.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)){
  if(!href.startsWith('#')&&href!=='./#siting'&&!overlayInput.fieldPriorities.sources.some(source=>source.url===href.replaceAll('&amp;','&')))throw Error(`Checklist attachment link: ${href}`);
}
console.log('Siting snapshot and interactive-page publication boundary verified.');

if(/現勘問題|現場共通紀錄|現勘優先序|P1／P2/.test(checklist))throw Error('Old field workflow remains in data-reading table');
