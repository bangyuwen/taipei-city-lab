import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../dist');
const html=await readFile(resolve(root,'index.html'),'utf8');
const hosting=JSON.parse(await readFile(resolve(root,'../.openai/hosting.json')));
if(!hosting.project_id||hosting.static?.directory!=='dist')throw Error('Hosting manifest incomplete');
const files=['app.js','history.js','data-utils.js','styles.css','mark.svg','data/datasets.json','data/taipei-bins-2026-study-area.provenance.json'];
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const url=match[1];if(!/^https?:/.test(url))files.push(url);
}
for(const file of new Set(files))await access(resolve(root,file));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw Error('Duplicate HTML IDs');
const css=await readFile(resolve(root,'styles.css'),'utf8');
for(const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))await access(resolve(root,match[1]));
const notes=await readFile(resolve(root,'research/bin-removal-history.md'),'utf8');
for(const match of notes.matchAll(/\]\(\.\.\/data\/([^\)]+)\)/g))await access(resolve(root,'data',match[1]));
console.log(`Static assets, research downloads, hosting identity and ${ids.length} unique HTML IDs verified.`);
