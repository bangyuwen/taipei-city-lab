import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COUNTRY_COMPARISONS,
  initializeCountryComparison
} from "../dist/country-comparison.js";

const indexPath = new URL("../dist/index.html", import.meta.url);
const countryGroups = {
  daily: [
    "country-us",
    "country-france",
    "country-netherlands",
    "country-singapore",
    "country-south-africa"
  ],
  collection: [
    "country-japan",
    "country-uk",
    "country-denmark",
    "country-australia"
  ],
  household: ["country-finland", "country-korea", "country-india"]
};

test("comparison IDs match the twelve preserved equipment supplements", async () => {
  const html = await readFile(indexPath, "utf8");
  const articleTags = [...html.matchAll(/<article\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => /data-media-case="true"/.test(tag))
    .filter((tag) => /\bclass="[^"]*\bcountry-case\b[^"]*"/.test(tag));
  const articleIds = articleTags.map((tag) =>
    tag.match(/\baria-labelledby="([^"]+)"/)?.[1]
  );
  const ids = COUNTRY_COMPARISONS.map(({ id }) => id);

  assert.equal(articleIds.length, 12);
  assert.deepEqual(ids, [
    "country-us",
    "country-france",
    "country-netherlands",
    "country-singapore",
    "country-south-africa",
    "country-japan",
    "country-uk",
    "country-denmark",
    "country-australia",
    "country-finland",
    "country-korea",
    "country-india"
  ]);
  assert.deepEqual([...ids].sort(), [...articleIds].sort());
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(Object.isFrozen(COUNTRY_COMPARISONS));
  assert.ok(COUNTRY_COMPARISONS.every(Object.isFrozen));
});

test("filter groups preserve the existing purpose grouping", () => {
  for (const [group, expectedIds] of Object.entries(countryGroups)) {
    assert.deepEqual(
      COUNTRY_COMPARISONS.filter((item) => item.group === group).map(({ id }) => id),
      expectedIds
    );
  }
  assert.equal(COUNTRY_COMPARISONS.every(({ group }) => group in countryGroups), true);
});

test("cost and evidence summaries retain material source limits", () => {
  const byId = new Map(COUNTRY_COMPARISONS.map((item) => [item.id, item]));

  assert.match(byId.get("country-denmark").costBasis, /2025.*DKK 550,000/s);
  assert.match(byId.get("country-denmark").costBasis, /每年 DKK 550,000 計畫額度/);
  assert.match(byId.get("country-denmark").costBasis, /年度預算/);
  assert.match(byId.get("country-denmark").costBasis, /不是單桶價/);

  assert.match(byId.get("country-korea").costBasis, /首爾東大門區/);
  assert.match(byId.get("country-korea").costBasis, /KRW 2,000,000/);
  assert.match(byId.get("country-korea").costBasis, /地方補助/);
  assert.match(byId.get("country-korea").costBasis, /非全韓統一機價/);

  assert.match(byId.get("country-finland").evidence, /未找到最終節省評估/);
  assert.match(byId.get("country-finland").evidence, /不能視為仍在試辦或已成功/);
});

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.className = "";
    this.type = "";
    this._textContent = "";
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  click() {
    for (const handler of this.listeners.get("click") ?? []) {
      handler({ currentTarget: this });
    }
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }
}

function findAll(root, predicate) {
  const matches = [];
  const visit = (current) => {
    if (predicate(current)) matches.push(current);
    for (const child of current.children) visit(child);
  };
  visit(root);
  return matches;
}

test("UI starts collapsed and filters results accessibly before invoking case selection", () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName)
  };

  try {
    const container = new FakeElement("div");
    const selectedIds = [];
    const playedIds = [];
    const root = initializeCountryComparison(container, {
      onSelect: (id) => selectedIds.push(id),
      onPlay: (id, origin) => playedIds.push([id, origin])
    });
    const buttons = findAll(root, (node) => node.className === "country-compare-filter");
    const rows = findAll(root, (node) => node.className === "country-compare-item");
    const details = findAll(root, (node) => node.tagName === "details");
    const resultCount = findAll(
      root,
      (node) => node.className === "country-compare-result-count"
    )[0];

    assert.equal(container.children[0], root);
    assert.equal(buttons.length, 4);
    assert.equal(buttons[0].textContent, "全部");
    assert.equal(buttons[0].getAttribute("aria-pressed"), "true");
    assert.equal(rows.length, 12);
    assert.equal(details.length, 12);
    assert.ok(details.every((node) => node.getAttribute("open") === null));
    assert.equal(resultCount.getAttribute("aria-live"), "polite");
    assert.equal(resultCount.textContent, "12 個案例");

    const dailyButton = buttons.find(
      (button) => button.getAttribute("data-country-compare-filter") === "daily"
    );
    dailyButton.click();

    assert.equal(dailyButton.getAttribute("aria-pressed"), "true");
    assert.equal(resultCount.textContent, "5 個案例");
    assert.equal(
      rows.filter(({ hidden }) => !hidden).length,
      5
    );

    const selectButton = findAll(
      root,
      (node) => node.className === "country-compare-select"
    )[0];
    selectButton.click();
    assert.deepEqual(selectedIds, ["country-us"]);
    assert.deepEqual(playedIds, []);
    const playButton = findAll(root, (node) => node.className === "country-compare-play")[0];
    playButton.click();
    assert.deepEqual(playedIds, [["country-us", playButton]]);
    assert.deepEqual(selectedIds, ["country-us"]);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
