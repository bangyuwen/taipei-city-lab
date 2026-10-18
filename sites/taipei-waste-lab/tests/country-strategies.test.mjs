import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {loadCountries, renderPanel, validateCountries} from '../scripts/prepare-country-strategies.mjs';

const countries=await loadCountries();
const template=await readFile(new URL('../templates/country-media.html',import.meta.url),'utf8');
const panel=renderPanel(countries,template);

test('strategy publication is reproducible and retains all original media provenance',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.ok(html.includes(panel),'rerun npm run prepare-countries after editing research inputs');
  assert.equal((panel.match(/<article class="country-case"/g)||[]).length,14);
  assert.equal((panel.match(/data-media-case="true"/g)||[]).length,12);
  assert.equal((panel.match(/class="strategy-flow"/g)||[]).length,14);
  for(const [photo] of template.matchAll(/<figure class="country-photo">[\s\S]*?<\/figure>/g))assert.ok(panel.includes(photo));
  const ids=[...panel.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'all country and chapter anchors must be unique');
  for(const [,id] of panel.matchAll(/href="#(country-[^"]+)"/g))assert.ok(ids.includes(id),id);
});

test('a strategy or diagram cannot lose its evidence source, limits or denominator',()=>{
  for(const mutate of [
    data=>data[0].cases[0].sourceIds=['missing-source'],
    data=>data[0].cases[0].limits='',
    data=>data[0].cases[0].id='media',
    data=>data[0].flow.sourceIds=[],
    data=>{const c=data.find(c=>c.chart);c.chart.denominator=''},
    data=>{const c=data.find(c=>c.chart);c.chart.bars[0].value=101}
  ]){const copy=structuredClone(countries);mutate(copy);assert.throws(()=>validateCountries(copy));}
});

test('authored source text is escaped and unsupported media are not fabricated',()=>{
  const copy=structuredClone(countries);copy[0].cases[0].result='<script>alert("x")</script>';
  const html=renderPanel(copy,template);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
  for(const id of ['hong-kong','uruguay']){
    const article=html.match(new RegExp(`<article class="country-case" aria-labelledby="country-${id}"[\\s\\S]*?</article>`))[0];
    assert.ok(article.includes('strategy-media-absence'));assert.ok(!article.includes('country-model-open'));
  }
});

 test('percentage chart boundaries retain zero and one hundred, rejecting out-of-range values',()=>{
  for(const value of [0,100]){const copy=structuredClone(countries);copy.find(c=>c.chart).chart.bars[0].value=value;assert.doesNotThrow(()=>validateCountries(copy));}
  for(const value of [-1,101]){const copy=structuredClone(countries);copy.find(c=>c.chart).chart.bars[0].value=value;assert.throws(()=>validateCountries(copy));}
 });
