const FIELD_NAMES = {
  age: '屋齡文件', drawings: '原始圖說', inspection: '歷次健檢', repairs: '修繕紀錄', contact: '社區聯絡資料',
  liquefaction: '液化潛勢查核資料', rescue: '救援通道查核資料', elderly: '高齡住戶需求資料',
};
const NEED_KEYS = ['maintenance', 'accessibility', 'coordination', 'liquefaction', 'rescue', 'elderly'];
const PURPOSES = {
  disaster: { label: '防災健檢準備', weights: [0.05, 0.05, 0.1, 0.3, 0.3, 0.2], hours: 6 },
  liquefaction: { label: '優先補查地盤液化線索', weights: [0.05, 0.05, 0.1, 0.6, 0.1, 0.1], hours: 6 },
  rescue: { label: '優先補查救援通道', weights: [0.05, 0.05, 0.1, 0.1, 0.6, 0.1], hours: 6 },
  elderly: { label: '優先了解高齡住戶需求', weights: [0.05, 0.1, 0.1, 0.1, 0.1, 0.55], hours: 6 },
  documents: { label: '文件準備與健檢動員', weights: [0.15, 0.15, 0.7, 0, 0, 0], hours: 4 },
  maintenance: { label: '維護需求訪談', weights: [0.7, 0.15, 0.15, 0, 0, 0], hours: 6 },
  accessibility: { label: '無障礙需求訪談', weights: [0.15, 0.7, 0.15, 0, 0, 0], hours: 6 },
};

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function records() {
  const next = random(620326);
  return Array.from({ length: 24 }, (_, index) => {
    const available = Object.fromEntries(Object.keys(FIELD_NAMES).map((key, offset) => [
      key, (index + offset * 5) % 7 !== 0 && next() > 0.12,
    ]));
    const age = 15 + Math.floor(next() * 46);
    const disaster = Object.fromEntries(['liquefaction', 'rescue', 'elderly'].map(key => [
      key, available[key] ? 1 + Math.floor(next() * 5) : null,
    ]));
    return {
      id: `B-${String(index + 1).padStart(2, '0')}`, label: `模擬社區 ${index + 1}`,
      x: 121.517 + (index % 6) * 0.008 + next() * 0.001,
      y: 25.025 + Math.floor(index / 6) * 0.014 + next() * 0.001,
      age: available.age ? age : null, available,
      maintenance: 1 + Math.floor(next() * 5), accessibility: 1 + Math.floor(next() * 5),
      coordination: 1 + Math.floor(next() * 5), ...disaster,
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
    purpose: Object.hasOwn(PURPOSES, value.purpose) ? value.purpose : 'disaster',
    ageWeight: number(value.ageWeight ?? 15, 15, 0, 40) / 100,
    gapWeight: number(value.gapWeight ?? 30, 30, 0, 60) / 100,
  };
}

function prepare(record, params) {
  const purpose = PURPOSES[params.purpose];
  const missing = Object.keys(FIELD_NAMES).filter(key => !record.available[key]);
  const knownWeight = NEED_KEYS.reduce((sum, key, i) => sum + (record[key] === null ? 0 : purpose.weights[i]), 0);
  const needSum = NEED_KEYS.reduce((sum, key, i) => sum + (record[key] ?? 0) / 5 * purpose.weights[i], 0);
  const need = knownWeight > 0 ? needSum / knownWeight : 0;
  const ageReference = record.age === null ? 0 : Math.min(record.age / 60, 1);
  const gap = missing.length / Object.keys(FIELD_NAMES).length;
  const score = Math.round(100 * ((1 - params.ageWeight - params.gapWeight) * need
    + params.ageWeight * ageReference + params.gapWeight * gap));
  return {
    ...record, missing, score, hours: purpose.hours + missing.length * 2,
    action: purpose.label,
    reason: `維護需求 ${record.maintenance}/5；無障礙 ${record.accessibility}/5；動員需要 ${record.coordination}/5；`
      + `屋齡${record.age === null ? '未知' : ` ${record.age} 年`}；缺 ${missing.length} 項資料`,
    disasterClues: ['liquefaction', 'rescue', 'elderly'].map((key, i) =>
      `${['液化潛勢', '救援通道受限', '高齡住戶需求'][i]} ${record[key] === null ? '未知' : `${record[key]}/5`}`
    ).join('；'),
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
  const result = totals(items, selected);
  const baseline = totals(items, rotation(items, params.budget));
  const ranked = [...items].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {
    metrics: [
      { label: '安排社區訪查', value: result.count, unit: '處', detail: '全部為合成社區' },
      { label: '使用訪查工時', value: result.hours, unit: '人時', detail: `上限 ${params.budget} 人時` },
      { label: '納入訪查需求總分', value: result.score, unit: '點', detail: '本情境排程目標；不是耐震能力' },
      { label: '較同預算編號訪查多納入', value: result.score - baseline.score, unit: '點', detail: `編號訪查 ${baseline.score} 點／${baseline.hours} 人時` },
      { label: '需補齊的查勘資料', value: result.gaps, unit: '項', detail: '僅計已安排社區；含文件與防災線索' },
    ],
    map: {
      points: items.map(item => ({ id: item.id, x: item.x, y: item.y,
        label: `${item.label}（虛構點位）`, value: item.score,
        kind: selected.has(item.id) ? 'selected' : 'candidate', selected: selected.has(item.id) })),
      caption: '所有社區與座標均為模擬，不對真實建物評級，也不代表危險位置。',
    },
    chart: {
      labels: ['同預算編號訪查', '本情境最佳配置'], unit: '點',
      series: [{ label: '納入訪查需求總分', color: '#506c9d', values: [baseline.score, result.score] }],
      caption: '同一權重與工時限制下比較；總點數表示排程需求，不表示安全改善。',
    },
    table: {
      columns: [
        { key: 'rank', label: '順位' }, { key: 'label', label: '模擬社區' },
        { key: 'score', label: '健檢安排優先指數' }, { key: 'hours', label: '所需人時' },
        { key: 'allocation', label: '本次配置' }, { key: 'action', label: '訪查工作' },
        { key: 'disasterClues', label: '防災查勘線索（全合成）' },
        { key: 'reason', label: '排序依據' }, { key: 'incomplete', label: '待補資料' },
      ],
      rows: ranked.map((item, index) => ({ ...item, rank: index + 1,
        allocation: selected.has(item.id) ? '已安排' : '候補',
        incomplete: item.missing.length ? item.missing.map(key => FIELD_NAMES[key]).join('、') : '模擬欄位完整；仍需專業結構健檢',
      })),
    },
    explanation: `本次訪查目的為「${PURPOSES[params.purpose].label}」。需求權重 ${Math.round((1 - params.ageWeight - params.gapWeight) * 100)}%、屋齡文件參考 ${Math.round(params.ageWeight * 100)}%、缺漏補查 ${Math.round(params.gapWeight * 100)}%。防災選項會改變合成液化潛勢、救援通道受限與高齡住戶需求的權重；以 ${params.budget} 人時內最大化納入訪查需求總分，列出應補資料及工作。液化級、通道受限與高齡需求只是合成查勘線索；缺資料不表示無需求。所有指數都是健檢前置安排規則，不能推論耐震能力、倒塌機率或真實結構安全。`,
    assumptions: [
      '24 個社區、屋齡、維護／無障礙／動員需要、液化潛勢級、救援通道受限級、高齡住戶需求級、資料缺漏與座標，全部由固定種子產生；非觀測資料。',
      '官網提供的屋齡資料是全市總計，只有未滿 30 年與 30 年以上兩類；缺少逐棟屋齡、位置、構造與檢查資料，不能下推到真實社區。',
      '液化（soil）、消防（fire）及人口（population）來源只列來源資訊；本展示未使用其觀測值，也未以官方圖資套疊合成社區。導入時必須確認位置、日期與資料粒度。',
      '本工具沒有使用全市屋齡比例填補社區資料；實際導入需要社區同意、完整建物文件與專業結構健檢。地盤潛勢也不能替代建物耐震評估。',
      '需求及防災線索以 1–5 級、屋齡以 60 年達到正規化上限；5 級為本展示自訂尺度，不是官方液化分級。前置訪查工時不包含專業結構評估。',
      '防災準備的需求分項權重依序為維護／無障礙／動員／液化／救援／高齡：5/5/10/30/30/20%；液化優先為5/5/10/60/10/10%；救援優先為5/5/10/10/60/10%；高齡優先為5/10/10/10/10/55%。',
      '文件準備的需求分項權重為維護 15%、無障礙 15%、動員 70%；維護訪談為70/15/15%；無障礙訪談為15/70/15%。',
      '屋齡未知時不增加屋齡參考分數；其他查勘線索只在已知欄位間重新分配權重，缺漏另列補查工作。調高缺漏權重可檢視資料不足的社區是否被優先協助。',
      '基準依固定社區編號訪查，逐一安排可容納的社區；最佳配置使用相同工時估計與指數。跨不同權重的總點數不可直接比較。',
    ],
    sources: ['buildings', 'soil', 'fire', 'population', 'puma'],
  };
}

export const buildings = {
  id: 'buildings', number: 6, title: '先健檢哪裡？',
  subtitle: '整合防災查勘線索與文件缺口，安排專業健檢的準備工作。',
  defaults: { budget: 48, purpose: 'disaster', ageWeight: 15, gapWeight: 30 },
  controls: [
    { key: 'budget', label: '訪查工時預算', type: 'range', min: 0, max: 160, step: 4, unit: '人時' },
    { key: 'purpose', label: '社區訪查目的', type: 'select', options: [
      { value: 'disaster', label: '防災健檢準備' }, { value: 'liquefaction', label: '液化線索優先' },
      { value: 'rescue', label: '救援通道優先' }, { value: 'elderly', label: '高齡需求優先' },
      { value: 'documents', label: '文件與動員' }, { value: 'maintenance', label: '維護需求' },
      { value: 'accessibility', label: '無障礙需求' },
    ] },
    { key: 'ageWeight', label: '屋齡參考敏感度', type: 'range', min: 0, max: 40, step: 5, unit: '%' },
    { key: 'gapWeight', label: '缺漏補查權重', type: 'range', min: 0, max: 60, step: 5, unit: '%' },
  ],
  evaluate,
};
