import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../dist');
const html=await readFile(resolve(root,'index.html'),'utf8');
let hosting;
try{hosting=JSON.parse(await readFile(resolve(root,'../.openai/hosting.json')));}
catch(error){if(error.code!=='ENOENT'||process.argv.includes('--require-hosting'))throw error;}
if(hosting&&(!hosting.project_id||hosting.static?.directory!=='dist'))throw Error('Hosting manifest incomplete');
const files=['app.js','history.js','data-utils.js','styles.css','mark.svg','data/datasets.json','data/taipei-bins-2026-study-area.provenance.json',
  'design-ui.js','design-model.js','bin-scene.js','design.css','research/bin-design.md',
  'vendor/three/three.module.js','vendor/three/three.core.js','vendor/three/OrbitControls.js','vendor/three/LICENSE','vendor/three/manifest.json'];
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const url=match[1];if(!/^https?:/.test(url))files.push(url);
}
for(const file of new Set(files))await access(resolve(root,file));
const three=JSON.parse(await readFile(resolve(root,'vendor/three/manifest.json'),'utf8'));
for(const [file,entry] of Object.entries(three.files)){
  const bytes=await readFile(resolve(root,'vendor/three',file));
  if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error(`Three.js asset hash mismatch: ${file}`);
}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw Error('Duplicate HTML IDs');
const css=await readFile(resolve(root,'styles.css'),'utf8');
for(const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))await access(resolve(root,match[1]));
const notes=await readFile(resolve(root,'research/bin-removal-history.md'),'utf8');
for(const match of notes.matchAll(/\]\(\.\.\/data\/([^\)]+)\)/g))await access(resolve(root,'data',match[1]));
console.log(`Static assets, research downloads${hosting?', hosting identity':''} and ${ids.length} unique HTML IDs verified.`);
