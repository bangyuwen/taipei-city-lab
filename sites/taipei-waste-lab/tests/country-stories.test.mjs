import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COUNTRY_STORIES,
  TAIPEI_SCENARIOS,
} from '../dist/country-stories.js';
import { COUNTRY_MODELS } from '../dist/country-model-data.js';
import { buildCountryModel } from '../dist/country-models.js';

const COUNTRY_IDS = Object.keys(COUNTRY_MODELS);
const VIEWS = new Set(['overview', 'front', 'side', 'back']);
const STOP_KINDS = new Set(['photo', 'illustration', 'document']);
const EVIDENCE_KINDS = new Set(['photo', 'document', 'illustration', 'unknown']);

function assertKeys(value, keys, label) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), label);
}

function assertSource(value, label) {
  assertKeys(value, ['label', 'url'], label);
  assert.equal(typeof value.label, 'string', label + ' label must be text');
  assert.ok(value.label.trim(), label + ' label must not be empty');
  assert.equal(typeof value.url, 'string', label + ' URL must be text');
  assert.match(value.url, /^https:\/\//, label + ' URL must use HTTPS');
}

function assertDeepFrozen(value, path = 'export') {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value), path + ' must be frozen');
  for (const [key, nested] of Object.entries(value)) {
    assertDeepFrozen(nested, path + '.' + key);
  }
}

test('country stories cover exactly the canonical model ids', () => {
  assert.deepEqual(Object.keys(COUNTRY_STORIES).sort(), [...COUNTRY_IDS].sort());
  assert.equal(COUNTRY_IDS.length, 12);
});

test('each story has three grounded stops, one valid question, and notes for every built part', () => {
  for (const id of COUNTRY_IDS) {
    const story = COUNTRY_STORIES[id];
    assertKeys(story, ['intro', 'takeaway', 'stops', 'question', 'evidence', 'partNotes'], id + ' story');
    assert.ok(story.intro.trim(), id + ' intro');
    assert.ok(story.takeaway.trim(), id + ' takeaway');
    assert.equal(story.stops.length, 3, id + ' must have three journey stops');

    const modelPartIds = buildCountryModel(id).userData.parts.map((part) => part.id);
    assert.equal(story.stops[0].partId, null, id + ' first stop is the outer shape');
    assert.ok(['photo', 'illustration'].includes(story.stops[0].kind), id + ' first stop must show a photo or concept');
    assert.ok(story.stops[0].source, id + ' outer shape must link to its source or context');
    assert.equal(story.stops[1].partId !== null, true, id + ' second stop must select a model part');
    assert.ok(modelPartIds.includes(story.stops[1].partId), id + ' selected stop must use a built part');
    assert.equal(story.stops[2].partId, null, id + ' third stop is service context');

    for (const [index, stop] of story.stops.entries()) {
      assertKeys(stop, ['title', 'text', 'view', 'partId', 'kind', 'source'], id + ' stop ' + (index + 1));
      assert.ok(stop.title.trim(), id + ' stop ' + (index + 1) + ' title');
      assert.ok(stop.text.trim(), id + ' stop ' + (index + 1) + ' text');
      assert.ok(VIEWS.has(stop.view), id + ' stop ' + (index + 1) + ' view');
      assert.ok(STOP_KINDS.has(stop.kind), id + ' stop ' + (index + 1) + ' kind');
      if (index === 2) assert.equal(stop.kind, 'document', id + ' service stop cites a document');
      if (index === 2) assert.ok(stop.source, id + ' service stop must link to its source');
      if (stop.source !== null) assertSource(stop.source, id + ' stop ' + (index + 1) + ' source');
    }

    const noteIds = Object.keys(story.partNotes).sort();
    assert.deepEqual(noteIds, [...modelPartIds].sort(), id + ' notes must match every built part');
    for (const [partId, note] of Object.entries(story.partNotes)) {
      assertKeys(note, ['observation', 'inference'], id + '.' + partId + ' note');
      assert.ok(note.observation.trim(), id + '.' + partId + ' observation');
      assert.ok(note.inference.trim(), id + '.' + partId + ' inference');
    }
  }
});

test('questions have distinct choices, exactly one keyed answer, and an HTTPS source', () => {
  for (const [id, story] of Object.entries(COUNTRY_STORIES)) {
    const question = story.question;
    assertKeys(question, ['prompt', 'options', 'answerId', 'explanation', 'source'], id + ' question');
    assert.ok(question.prompt.trim(), id + ' question prompt');
    assert.ok(question.explanation.trim(), id + ' explanation');
    assert.ok(question.options.length >= 2 && question.options.length <= 3, id + ' must have 2-3 choices');
    const optionIds = question.options.map((option) => option.id);
    const labels = question.options.map((option) => option.label);
    assert.equal(new Set(optionIds).size, optionIds.length, id + ' choice ids must be unique');
    assert.equal(new Set(labels).size, labels.length, id + ' choice labels must be unique');
    assert.equal(optionIds.filter((optionId) => optionId === question.answerId).length, 1, id + ' must key one answer');
    for (const option of question.options) {
      assertKeys(option, ['id', 'label'], id + ' option');
      assert.ok(option.id.trim(), id + ' option id');
      assert.ok(option.label.trim(), id + ' option label');
    }
    assertSource(question.source, id + ' question source');
  }
});

test('evidence separates the photo or concept, model inference, documents, and unknowns', () => {
  for (const [id, story] of Object.entries(COUNTRY_STORIES)) {
    assert.ok(Array.isArray(story.evidence) && story.evidence.length >= 4, id + ' has evidence entries');
    const kinds = story.evidence.map((item) => item.kind);
    assert.ok(kinds.includes('photo') || kinds.includes('illustration'), id + ' states photo or concept basis');
    assert.ok(kinds.includes('illustration'), id + ' states model-action inference');
    assert.ok(kinds.includes('document'), id + ' includes operational documents');
    assert.ok(kinds.includes('unknown'), id + ' names a material unknown');
    for (const [index, item] of story.evidence.entries()) {
      assertKeys(item, ['kind', 'text', 'source'], id + ' evidence ' + (index + 1));
      assert.ok(EVIDENCE_KINDS.has(item.kind), id + ' evidence kind');
      assert.ok(item.text.trim(), id + ' evidence text');
      if (item.kind === 'photo' || item.kind === 'document') {
        assert.ok(item.source, id + ' ' + item.kind + ' evidence must link to its source');
      }
      if (item.source !== null) assertSource(item.source, id + ' evidence ' + (index + 1) + ' source');
    }
  }
});

test('the country notes preserve the documented identity and photo limits', () => {
  const finland = JSON.stringify(COUNTRY_STORIES.finland);
  assert.match(finland, /Oulu/);
  assert.match(finland, /2009/);
  assert.match(finland, /不是赫爾辛基 2024 年試驗照片/);
  assert.match(finland, /不畫也不推測地下構造/);

  const australia = JSON.stringify(COUNTRY_STORIES.australia);
  assert.match(australia, /沒有可在本站重新散布的實物照片/);
  assert.match(australia, /通用概念圖/);
  assert.match(australia, /不對應墨爾本設備型號/);

  const korea = JSON.stringify(COUNTRY_STORIES.korea);
  assert.match(korea, /九里市/);
  assert.match(korea, /不是首爾設備照片/);
  assert.match(korea, /不能把不同城市的設備當成同一型號/);

  const uk = JSON.stringify(COUNTRY_STORIES.uk);
  assert.match(uk, /Belgrave Square/);
  assert.match(uk, /Bishopsgate/);
  assert.match(uk, /不是 Bishopsgate 試辦現場/);

  const netherlands = JSON.stringify(COUNTRY_STORIES.netherlands);
  assert.match(netherlands, /舊式獨立取用箱/);
  assert.match(netherlands, /不是 2026 年新公共垃圾桶/);
});

test('Taipei scenarios retain the two official facts, dates, and comparison-only links', () => {
  assert.equal(TAIPEI_SCENARIOS.length, 2);
  const [cup, cartons] = TAIPEI_SCENARIOS;
  assertKeys(cup, ['id', 'title', 'question', 'answer', 'source', 'relatedIds'], 'cup scenario');
  assertKeys(cartons, ['id', 'title', 'question', 'answer', 'source', 'relatedIds'], 'carton scenario');

  assert.equal(cup.id, 'empty-drink-cup');
  assert.match(cup.source.label, /更新 2026-09-03/);
  assert.equal(cup.source.url, 'https://www.dep.gov.taipei/News_Content.aspx?n=D6521D207DE817C2&s=83534F468DAF3FF0&sms=53780C1906F94AB4');
  assert.match(cup.answer, /連鎖飲料店、便利商店、速食店或超級市場/);
  assert.match(cup.answer, /不限品牌/);
  assert.match(cup.answer, /不代表外地規則適用於台北/);

  assert.equal(cartons.id, 'paper-container-shape');
  assert.match(cartons.source.label, /更新 2026-09-24/);
  assert.equal(cartons.source.url, 'https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&s=252B16B10D3CA3F9');
  assert.match(cartons.answer, /紙餐盒、牛奶盒與鋁箔包屬立體類/);
  assert.match(cartons.answer, /報紙、雜誌屬平面類/);
  assert.match(cartons.answer, /不代表外地分類規則適用於台北/);

  for (const scenario of TAIPEI_SCENARIOS) {
    assert.ok(scenario.title.trim());
    assert.ok(scenario.question.trim());
    assert.ok(scenario.answer.trim());
    assertSource(scenario.source, scenario.id + ' source');
    assert.ok(scenario.relatedIds.length > 0);
    assert.ok(scenario.relatedIds.every((id) => COUNTRY_IDS.includes(id)), scenario.id + ' comparisons use canonical country ids');
  }
});

test('exports are deeply frozen', () => {
  assertDeepFrozen(COUNTRY_STORIES, 'COUNTRY_STORIES');
  assertDeepFrozen(TAIPEI_SCENARIOS, 'TAIPEI_SCENARIOS');
});
