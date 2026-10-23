import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pageFromHash,workspaceForPage} from '../dist/data-utils.js';

test('persona and core-problem deep links retain research ownership without capturing historical problem maps',()=>{
  for(const anchor of ['personas','personas-heading','persona-meal','persona-dog','persona-basket','persona-walking','persona-crew','persona-journey','journey-reading-note']){
    assert.equal(pageFromHash('#'+anchor),'personas',anchor);
  }
  for(const anchor of ['problem','problem-heading','problem-known','problem-contrast','problem-unknown','problem-boundary']){
    assert.equal(pageFromHash('#'+anchor),'problem',anchor);
  }
  assert.equal(workspaceForPage('personas'),'personas');
  assert.equal(workspaceForPage('problem'),'personas');
  assert.equal(pageFromHash('#problem-map-heading'),'materials');
  assert.equal(pageFromHash('#definition-evidence-E01'),'evidence');
  assert.equal(pageFromHash('#demand-evidence'),'evidence');
});

test('problem reading starts with personas and keeps the current definition nearby',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const navigation=html.match(/<nav id="site-navigation"[\s\S]*?<\/nav>/)[0];
  assert.match(navigation,/<a href="#personas" data-page="personas">理解問題<\/a>/);
  for(const nav of html.matchAll(/<nav class="project-subnav" aria-label="理解問題內頁">([\s\S]*?)<\/nav>/g)){
    assert.ok(nav[1].indexOf('href="#personas"') < nav[1].indexOf('href="#problem"'));
    assert.ok(!nav[1].includes('href="#analysis"'));
  }
});
