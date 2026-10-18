import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const COUNTRY_ORDER = ['japan','korea','singapore','india','hong-kong','uk','france','netherlands','denmark','finland','us','australia','south-africa','uruguay'];
const ROOT = resolve(import.meta.dirname, '..');
const fields = [['problem','問題與服務對象'],['placement','在哪設點、何時調整'],['operation','清運與維護怎麼做'],['responsibility','誰負責執行'],['finance','誰付錢與成本範圍'],['separation','家戶、商業與回收分流'],['result','目前有什麼結果'],['limits','成效限制與待查事項']];
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const link = source => `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)}（${escape(source.date)}）</a>`;

export function validateCountries(countries) {
  if (countries.length !== COUNTRY_ORDER.length || new Set(countries.map(c => c.id)).size !== COUNTRY_ORDER.length) throw Error('Country coverage must contain 14 unique entries');
  for (const id of COUNTRY_ORDER) {
    const c = countries.find(item => item.id === id);
    if (!c) throw Error(`Missing country: ${id}`);
    for (const key of ['name','scope','thesis','summary']) if (!c[key]?.trim()) throw Error(`${id}: missing ${key}`);
    if (!c.cases?.length || c.flow?.steps?.length !== 4 || !c.takeaways?.length) throw Error(`${id}: incomplete strategy`);
    const sourceIds = new Set(c.sources.map(s => s.id));
    if (sourceIds.size !== c.sources.length) throw Error(`${id}: duplicate sources`);
    for (const source of c.sources) {
      if (!source.label || !source.date || !source.kind || !/^https:\/\//.test(source.url)) throw Error(`${id}: invalid source`);
    }
    for (const key of ['placement','collection','responsibility','separation','evidence']) if (!c.comparison[key]?.trim()) throw Error(`${id}: missing comparison ${key}`);
    for (const item of [...c.cases,c.flow,...(c.chart ? [c.chart] : [])]) {
      if (!item.sourceIds?.length || item.sourceIds.some(s => !sourceIds.has(s))) throw Error(`${id}: unresolved evidence source`);
    }
    if (new Set(c.cases.map(item => item.id)).size !== c.cases.length) throw Error(`${id}: duplicate cases`);
    for (const item of c.cases) {
      if (!/^[a-z0-9-]+$/.test(item.id) || ['media','taipei','sources'].includes(item.id)) throw Error(`${id}: invalid case id`);
      for (const key of ['title','place','period','status',...fields.map(([key]) => key)]) if (!item[key]?.trim()) throw Error(`${id}/${item.id}: missing ${key}`);
    }
    for (const step of c.flow.steps) if (!step.label || !step.text) throw Error(`${id}: incomplete flow`);
    if (c.chart && (!c.chart.denominator || !c.chart.note || !Number.isFinite(c.chart.max) || c.chart.max <= 0 || c.chart.bars.some(b => !b.label || !Number.isFinite(b.value) || b.value < 0 || b.value > c.chart.max))) throw Error(`${id}: invalid chart scale or evidence`);
  }
}

export async function loadCountries(root = ROOT) {
  const groups = await Promise.all(['asia','europe','other'].map(name => readFile(resolve(root,`research/country-strategies/${name}.json`),'utf8').then(JSON.parse)));
  const countries = groups.flat(); validateCountries(countries);
  return COUNTRY_ORDER.map(id => countries.find(c => c.id === id));
}

function citations(country, ids) {
  return `<p class="strategy-citations">依據：${ids.map(id => link(country.sources.find(s => s.id === id))).join(' · ')}</p>`;
}

function flow(country) {
  const item = country.flow;
  return `<figure class="strategy-flow"><figcaption>${escape(item.title)}</figcaption><ol>${item.steps.map(step => `<li><strong>${escape(step.label)}</strong><p>${escape(step.text)}</p></li>`).join('')}</ol><p class="strategy-diagram-note">${escape(item.note)} 流程箭頭表示作業順序，不表示垃圾量或成效。</p>${citations(country,item.sourceIds)}</figure>`;
}

function chart(country) {
  const item = country.chart;
  if (!item) return '';
  return `<figure class="strategy-chart"><figcaption>${escape(item.title)}</figcaption><p class="strategy-chart-scale">共同尺度：0–${escape(item.max)}${escape(item.unit)}</p><dl>${item.bars.map(bar => `<div><dt>${escape(bar.label)}</dt><dd><span class="strategy-bar-track" aria-hidden="true"><span style="width:${100*bar.value/item.max}%"></span></span><strong>${escape(bar.value)}${escape(item.unit)}</strong></dd></div>`).join('')}</dl><p>${escape(item.denominator)}</p><p class="strategy-limit">${escape(item.note)}</p>${citations(country,item.sourceIds)}</figure>`;
}

function caseStudy(country, item) {
  const id = `country-${country.id}-${item.id}`;
  return `<section class="strategy-case" aria-labelledby="${id}"><h4 id="${id}" tabindex="-1">${escape(item.title)}</h4><p class="strategy-case-meta">${escape(item.place)} · ${escape(item.period)} · ${escape(item.status)}</p><dl class="strategy-facts">${fields.map(([key,label]) => `<div${key==='limits'?' class="strategy-limit"':''}><dt>${label}</dt><dd>${escape(item[key])}</dd></div>`).join('')}</dl>${citations(country,item.sourceIds)}</section>`;
}

function mediaArticles(template) {
  return new Map([...template.matchAll(/<article class="country-case" aria-labelledby="country-([^"]+)">([\s\S]*?)<\/article>/g)].map(([,id,body]) => {
    const title = body.match(/<h4[^>]*>([\s\S]*?)<\/h4>/)?.[1];
    if (!title) throw Error(`Missing media heading: ${id}`);
    return [id,{title,body:body.replace(/<h4[^>]*>[\s\S]*?<\/h4>/,'').replace(/^[\t ]+$/gm,'')}];
  }));
}

export function renderCountry(country, media) {
  const id = `country-${country.id}`;
  const chapterLinks = country.cases.length > 1 ? `<nav class="strategy-case-nav" aria-label="${escape(country.name)}地方案例">${country.cases.map(item => `<a href="#${id}-${item.id}">${escape(item.title)}</a>`).join('')}</nav>` : '';
  const equipment = media ? `<section class="country-media-supplement" aria-labelledby="${id}-media"><h4 id="${id}-media" tabindex="-1">外觀與 3D 補充</h4><p class="country-media-place">${media.title}</p><p>以下照片與模型只對應這個設備或收運案例，不代表同國所有政策。設備價格依原年份與範圍閱讀。</p>${media.body}</section>` : `<p class="strategy-media-absence">本案例目前提供策略與研究證據，尚未收錄可對應的實拍或 3D 模型。</p>`;
  return `<li><article class="country-case" aria-labelledby="${id}" data-country-name="${escape(country.name)}"${media?' data-media-case="true"':''}><h3 id="${id}" tabindex="-1">${escape(country.name)}<span>${escape(country.scope)}</span></h3><div class="country-strategy"><p class="strategy-thesis">${escape(country.thesis)}</p><p class="strategy-summary">${escape(country.summary)}</p>${chapterLinks}${flow(country)}${chart(country)}${country.cases.map(item => caseStudy(country,item)).join('')}<section class="strategy-takeaways" aria-labelledby="${id}-taipei"><h4 id="${id}-taipei" tabindex="-1">台北可以借鏡的條件</h4><p>以下是研究判斷，尚未在台北驗證。</p><ul>${country.takeaways.map(text => `<li>${escape(text)}</li>`).join('')}</ul></section><section class="strategy-sources" aria-labelledby="${id}-sources"><h4 id="${id}-sources" tabindex="-1">來源與查閱範圍</h4><ol>${country.sources.map(source => `<li>${link(source)}<span>${escape(source.kind)}</span></li>`).join('')}</ol></section></div>${equipment}<p class="strategy-return"><a href="#country-index-heading">回到國家索引</a> · <a href="#country-strategy-comparison">查看跨國策略表</a></p></article></li>`;
}

function comparison(countries) {
  const columns = [['placement','設點與調整'],['collection','清運方式'],['responsibility','責任分工'],['separation','分流與替代服務'],['evidence','證據邊界']];
  return `<section class="strategy-comparison" aria-labelledby="country-strategy-comparison"><h3 id="country-strategy-comparison" tabindex="-1">跨國策略比較</h3><p>按本頁收錄的城市與制度比較，不代表各國完整政策。各地服務對象與指標不同，因此不做成效或價格排名。</p><table><caption>十四個國家與地區的策略摘要；選國名可回到完整案例。</caption><thead><tr><th scope="col">國家／地區</th>${columns.map(([,label])=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${countries.map(country => `<tr><th scope="row"><a href="#country-${country.id}" data-country-target="country-${country.id}">${escape(country.name)}</a><span>${escape(country.scope)}</span></th>${columns.map(([key,label])=>`<td data-label="${label}">${escape(country.comparison[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
}

export function renderPanel(countries, template) {
  const media = mediaArticles(template);
  if (media.size !== 12) throw Error('Preserve all twelve equipment cases');
  const regions = [['亞洲與地區',countries.slice(0,5)],['歐洲',countries.slice(5,10)],['美洲、非洲與大洋洲',countries.slice(10)]];
  return `<section id="panel-countries" class="page-panel" aria-labelledby="countries-heading" hidden>
  <div class="section-heading"><div><h2 id="countries-heading" tabindex="-1">各國垃圾桶</h2></div><p>從設點、清運到責任分工，看各地如何管理街道垃圾。</p></div>
  <p class="strategy-page-intro">先讀策略，再看設備。以十四個國家與地區為入口，完整列出本頁收錄案例的做法、流程、財源與成效限制；城市案例不等於全國政策。</p>
  <p class="strategy-update">策略整理：2026-10-18。來源年份與查閱範圍分案標示；歷史試辦、部署計畫與已觀測結果分開呈現。</p>
  <div class="country-browser"><aside class="country-reading-navigation"><h3 id="country-index-heading" tabindex="-1">選擇國家／地區</h3><label class="country-current">閱讀國家<select id="country-reader-select">${regions.map(([region,items])=>`<optgroup label="${region}">${items.map(c=>`<option value="${c.id}">${escape(c.name)}</option>`).join('')}</optgroup>`).join('')}</select></label><nav class="country-index" aria-label="國家與地區索引">${regions.map(([region,items])=>`<div><h4>${region}</h4><ul>${items.map(c=>`<li><a href="#country-${c.id}" data-country-target="country-${c.id}">${escape(c.name)}</a></li>`).join('')}</ul></div>`).join('')}</nav><a class="strategy-compare-link" href="#country-strategy-comparison">跨國策略比較</a><p id="country-selection-status" class="visually-hidden" role="status" aria-live="polite"></p></aside><ol class="country-cases">${countries.map(c=>renderCountry(c,media.get(c.id))).join('\n')}</ol></div>
  ${comparison(countries)}
  <p id="country-load-status" role="status" hidden>國家切換暫時無法載入；以下仍保留全部策略、來源與照片。重新整理可再試一次。</p>
  <p class="related-reading">把海外案例接回本地條件：<a href="#research">閱讀台北研究結論</a>。</p>
</section>`;
}

export async function prepare(root = ROOT) {
  const countries = await loadCountries(root);
  const template = await readFile(resolve(root,'templates/country-media.html'),'utf8');
  const path = resolve(root,'dist/index.html');
  const current = await readFile(path,'utf8');
  const start = current.indexOf('<section id="panel-countries"');
  const end = current.indexOf('<section id="panel-research"',start);
  if (start < 0 || end < 0) throw Error('Country panel boundaries missing');
  const updated = current.slice(0,start)+renderPanel(countries,template)+'\n\n    '+current.slice(end);
  await writeFile(path,updated.replace('data-page="countries">各地做法</a>','data-page="countries">各國垃圾桶</a>'));
  console.log(`Prepared ${countries.length} countries, ${countries.reduce((sum,c)=>sum+c.cases.length,0)} strategy cases and 12 preserved media cases.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await prepare();
