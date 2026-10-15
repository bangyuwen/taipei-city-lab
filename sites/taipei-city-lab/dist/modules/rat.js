const FIELD_NAMES = {
  food: '食物殘渣', waste: '垃圾累積', drain: '排水阻隔', signs: '現勘鼠跡線索',
};
const FOCUS = {
  balanced: { weights: [0.25, 0.25, 0.2, 0.3], action: '環境線索與源頭查核' },
  sanitation: { weights: [0.4, 0.4, 0.05, 0.15], action: '食物與垃圾源頭查核' },
  drainage: { weights: [0.1, 0.1, 0.5, 0.3], action: '排水阻隔與鼠跡查核' },
};

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function records() {
  const next = random(310324);
  return Array.from({ length: 24 }, (_, index) => {
    const features = Object.fromEntries(Object.keys(FIELD_NAMES).map((key, offset) => [
      key, (index + offset * 3) % 11 === 0 ? null : Math.floor(next() * 6),
    ]));
    return {
      id: `R-${String(index + 1).padStart(2, '0')}`, label: `模擬街廓 ${index + 1}`,
      x: 121.516 + (index % 6) * 0.008 + next() * 0.001,
      y: 25.026 + Math.floor(index / 6) * 0.013 + next() * 0.001,
      reports: Math.floor(next() * 25), ...features,
    };
  });
}

function number(value, fallback, low, high) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(high, Math.max(low, parsed)) : fallback;
}

function parameters(input) {
  const value = input && typeof input === 'object' ? input : {};
  return {
    budget: Math.floor(number(value.budget ?? 48, 48, 0, 160)),
    focus: Object.hasOwn(FOCUS, value.focus) ? value.focus : 'balanced',
    reportWeight: number(value.reportWeight ?? 10, 10, 0, 40) / 100,
    gapWeight: number(value.gapWeight ?? 15, 15, 0, 40) / 100,
  };
}

function prepare(record, params) {
  const policy = FOCUS[params.focus];
  const keys = Object.keys(FIELD_NAMES);
  const missing = keys.filter(key => record[key] === null);
  const weight = keys.reduce((sum, key, i) => sum + (record[key] === null ? 0 : policy.weights[i]), 0);
  const numerator = keys.reduce((sum, key, i) => sum + (record[key] ?? 0) / 5 * policy.weights[i], 0);
  const observed = weight > 0 ? numerator / weight : 0;
  const report = Math.min(record.reports / 20, 1);
  const gap = missing.length / keys.length;
  const score = Math.round(100 * ((1 - params.reportWeight - params.gapWeight) * observed
    + params.reportWeight * report + params.gapWeight * gap));
  const hours = (params.focus === 'drainage' ? 6 : 4) + missing.length * 2
    + (params.focus === 'balanced' ? 2 : 0);
  const clues = keys.filter(key => record[key] !== null).sort((a, b) => record[b] - record[a]);
  return {
    ...record, score, hours, missing, action: policy.action,
    reason: clues.slice(0, 2).map(key => `${FIELD_NAMES[key]} ${record[key]}/5`).join('；')
      + `；模擬通報 ${record.reports} 件；缺 ${missing.length} 項`,
  };
}

function optimal(items, budget) {
  const states = Array.from({ length: budget + 1 }, () => ({ score: 0, ids: [] }));
  for (const item of items) {
    for (let capacity = budget; capacity >= item.hours; capacity -= 1) {
      const previous = states[capacity - item.hours];
      const candidate = previous.score + item.score;
      if (candidate > states[capacity].score) {
        states[capacity] = { score: candidate, ids: [...previous.ids, item.id] };
      }
    }
  }
  return new Set(states[budget].ids);
}

function rotation(items, budget) {
  const ids = new Set();
  let used = 0;
  for (const item of items) {
    if (used + item.hours <= budget) {
      ids.add(item.id);
      used += item.hours;
    }
  }
  return ids;
}

function totals(items, ids) {
  return items.filter(item => ids.has(item.id)).reduce((sum, item) => ({
    count: sum.count + 1, hours: sum.hours + item.hours,
    score: sum.score + item.score, gaps: sum.gaps + item.missing.length,
  }), { count: 0, hours: 0, score: 0, gaps: 0 });
}

function evaluate(input = {}) {
  const params = parameters(input);
  const items = records().map(record => prepare(record, params));
  const selected = optimal(items, params.budget);
  const baselineIds = rotation(items, params.budget);
  const result = totals(items, selected);
  const baseline = totals(items, baselineIds);
  const ranked = [...items].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {
    metrics: [
      { label: '安排查核街廓', value: result.count, unit: '處', detail: '全部為合成街廓' },
      { label: '使用巡查工時', value: result.hours, unit: '人時', detail: `上限 ${params.budget} 人時` },
      { label: '納入查核線索總分', value: result.score, unit: '點', detail: '本情境的配置目標；不是鼠患率' },
      { label: '較同預算編號輪巡多納入', value: result.score - baseline.score, unit: '點', detail: `編號輪巡 ${baseline.score} 點／${baseline.hours} 人時` },
      { label: '待補查欄位', value: result.gaps, unit: '項', detail: '僅計已安排街廓' },
    ],
    map: {
      points: items.map(item => ({ id: item.id, x: item.x, y: item.y,
        label: `${item.label}（虛構點位）`, value: item.score,
        kind: selected.has(item.id) ? 'selected' : 'candidate', selected: selected.has(item.id) })),
      caption: '所有街廓與座標均為模擬，不代表這些位置的實際鼠患或通報。',
    },
    chart: {
      labels: ['同預算編號輪巡', '本情境最佳配置'], unit: '點',
      series: [{ label: '納入查核線索總分', color: '#2e8060', values: [baseline.score, result.score] }],
      caption: '同一權重與工時限制下比較；總點數不是治理效果或傳播機率。',
    },
    table: {
      columns: [
        { key: 'rank', label: '順位' }, { key: 'label', label: '模擬街廓' },
        { key: 'score', label: '查核優先指數' }, { key: 'hours', label: '所需人時' },
        { key: 'allocation', label: '本次配置' }, { key: 'action', label: '查核工作' },
        { key: 'reason', label: '排序依據' }, { key: 'incomplete', label: '待補資料' },
      ],
      rows: ranked.map((item, index) => ({ ...item, rank: index + 1,
        allocation: selected.has(item.id) ? '已安排' : '候補',
        incomplete: item.missing.length ? item.missing.map(key => FIELD_NAMES[key]).join('、') : '模擬欄位完整；仍需真實現勘',
      })),
    },
    explanation: `以 ${FOCUS[params.focus].action} 的環境權重計分，再加入模擬通報 ${Math.round(params.reportWeight * 100)}% 與缺漏補查 ${Math.round(params.gapWeight * 100)}%。通報量可能受民眾通報習慣影響；調整權重可檢視排序敏感度。配置器在 ${params.budget} 人時內最大化納入線索總分，故高分但工時較長的街廓可能候補。這是巡查與源頭查核安排，不是滅鼠成效預測。`,
    assumptions: [
      '24 個街廓、0–5 級環境線索、通報件數、缺漏欄位與座標，全部由固定種子產生；非觀測資料。',
      '官網提供的陳情資料只有類別、機關與日期，缺少地址或座標；不能直接建立鼠患熱點，也未將其套到模擬街廓。',
      '通報以 20 件達到正規化上限，環境 0–5 級、查核工時與權重均為展示假設，不代表實證門檻。',
      '環境分數只在有值的欄位間重新分配權重；缺漏不被當成已確認安全或零線索，另列補查工作。',
      '均衡環境權重：食物 25%、垃圾 25%、排水 20%、鼠跡 30%；清潔：40/40/5/15%；排水：10/10/50/30%。',
      '基準依固定街廓編號輪巡，逐一安排可容納的街廓；最佳配置使用相同工時估計與指數。跨不同權重的總點數不可直接比較。',
      '實際治理需現勘、查核食物與棲地來源及後續追蹤；本工具不估計鼠隻數、傳播機率或治理後減少比例。',
    ],
    sources: ['complaints', 'rat', 'puma'],
  };
}

export const rat = {
  id: 'rat', number: 3, title: '鼠患巡查與源頭查核',
  subtitle: '同樣的巡查工時，先查哪些環境線索？',
  defaults: { budget: 48, focus: 'balanced', reportWeight: 10, gapWeight: 15 },
  controls: [
    { key: 'budget', label: '巡查工時預算', type: 'range', min: 0, max: 160, step: 4, unit: '人時' },
    { key: 'focus', label: '源頭查核重點', type: 'select', options: [
      { value: 'balanced', label: '均衡查核' }, { value: 'sanitation', label: '食物與垃圾' },
      { value: 'drainage', label: '排水與阻隔' },
    ] },
    { key: 'reportWeight', label: '通報權重敏感度', type: 'range', min: 0, max: 40, step: 5, unit: '%' },
    { key: 'gapWeight', label: '缺漏補查權重', type: 'range', min: 0, max: 40, step: 5, unit: '%' },
  ],
  evaluate,
};
