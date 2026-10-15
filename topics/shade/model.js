import { actionTable, bboxOf, bounded, comparisonChart, coverageBy, coverageStats,
  clusteredDemand, eligibleCandidates, greedyCoverage, mapPoints, regularCoverage, syntheticGrid, validFacilities } from '../../shared/lib/spatial.js';

export const shade = {
  id: 'shade', number: 1, title: '樹蔭公平',
  subtitle: '在局部距離假設下比較補樹位置，觀察需求覆蓋與分區公平的取捨。',
  defaults: { budget: 20, fairness: 50, radius: 20, years: 10, siting: 'all' },
  controls: [
    { key: 'budget', label: '新增假設樹木上限', type: 'range', min: 0, max: 100, step: 1, unit: '棵' },
    { key: 'fairness', label: '公平優先權重', type: 'range', min: 0, max: 100, step: 5, unit: '%' },
    { key: 'radius', label: '樹點影響半徑（局部假設）', type: 'range', min: 5, max: 100, step: 5, unit: '公尺' },
    { key: 'years', label: '新增樹木觀察年數（假設）', type: 'range', min: 0, max: 10, step: 1, unit: '年' },
    { key: 'siting', label: '候選可設置條件情境', type: 'select', options: [{ value: 'all', label: '全部候選（未現勘）' }, { value: 'constrained', label: '排除 25% 候選（合成限制）' }] },
  ],
  evaluate(params = {}, data = {}) {
    const input = params ?? {};
    const bbox = bboxOf(data);
    const budget = Math.floor(bounded(input.budget, 0, 100, shade.defaults.budget));
    const fairness = bounded(input.fairness, 0, 100, shade.defaults.fairness) / 100;
    const radius = bounded(input.radius, 5, 100, shade.defaults.radius);
    const facilities = validFacilities(data?.trees, bbox);
    const years = bounded(input.years, 0, 10, shade.defaults.years);
    const newRadius = radius * Math.sqrt(years / 10);
    const demand = clusteredDemand(bbox);
    const candidates = eligibleCandidates(syntheticGrid(bbox, 12, 'candidate', 0.5), input.siting);
    const baseline = coverageStats(coverageBy(facilities, demand, radius), demand);
    const regular = regularCoverage(facilities, candidates, demand, budget, radius, newRadius);
    const optimized = greedyCoverage(facilities, candidates, demand, budget, radius, fairness, newRadius);
    return {
      metrics: [
        { label: '快照內已知樹點', value: facilities.length, unit: '處', detail: '範圍內有效且去除重複座標的已知點位。' },
        { label: '建議新增假設樹點', value: optimized.selected.length, unit: '處', detail: `新增上限 ${budget} 棵；一處候選抽象一棵樹，沒有邊際增益時提前停止。` },
        { label: '已知樹點基準可及率', value: 100 * baseline.rate, unit: '%' },
        { label: '推薦方案需求可及率', value: 100 * optimized.stats.rate, unit: '%' },
        { label: '相對已知樹點基準增加', value: 100 * (optimized.stats.rate - baseline.rate), unit: '百分點' },
        { label: '最低模擬區可及率', value: 100 * optimized.stats.minimumRate, unit: '%' },
      ],
      model: { demandCount: demand.length, candidateCount: candidates.length, radius, newRadius, years },
      map: { points: mapPoints(facilities, demand, candidates, optimized.selected, '快照樹點'),
        caption: '樹點來自資料快照；1,296 個需求子點與最多 144 個候選點為合成；需求子點分散在每格中心周圍 30 公尺內。每個候選抽象一棵新增樹木，位置需現勘。地圖最多顯示 220 個樹點，計算使用全部有效點位。' },
      chart: comparisonChart(baseline, regular, optimized.stats),
      table: actionTable(optimized.selected, '現勘假設補樹位置'),
      explanation: `以 ${radius} 公尺作為局部樹點影響的假設門檻，對 1,296 個合成需求子點做配置。新增樹點在 ${years} 年時影響半徑假設為 ${newRadius.toFixed(1)} 公尺（成熟半徑 × √(年數/10)）。每輪選擇提升「${Math.round((1 - fairness) * 100)}% 效率＋${Math.round(fairness * 100)}% 公平效用」最多的候選點，上限 ${budget} 棵假設樹木。效率是需求權重可及率；公平效用是四區可及率平方根的平均。相同分數依候選編號決定。`,
      assumptions: [
        '樹點可及率是規劃代理指標，並非實測樹蔭面積、遮蔭率、降溫效果或因果預測。',
        '1,296 個需求子點的位置與權重、最多 144 個候選點、局部影響半徑與四區分界皆為固定合成假設；權重由網格位置計算。',
        '每處候選抽象一棵新增樹木，位置是矩形網格點，不代表既有樹穴或已驗證可種植；生長半徑為自訂敏感度假設，0 年新增點沒有覆蓋，不是任何樹種的實測成長曲線；不計樹冠、季節、日照角度或建築陰影。',
        '已知樹點依快照內容計算；快照可能只有樣本，不能把沒有樹點的範圍判為實際無樹。',
        '候選限制情境每四個候選排除一個，只用於演示可行性篩選，不代表官方人行道淨寬查核。',
        '未驗證人行道淨寬、地下管線、樹穴、所有權及植栽條件；需補齊資料與現勘才能形成施工建議。',
        ...(facilities.length ? [] : ['目前範圍沒有可用的真實樹點；基準僅代表零個已知點，並不表示實際沒有樹木。']),
      ],
      sources: ['trees', 'puma'],
    };
  },
};
