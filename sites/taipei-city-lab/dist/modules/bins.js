import { actionTable, bboxOf, bounded, comparisonChart, coverageBy, coverageStats,
  eligibleCandidates, greedyCoverage, mapPoints, regularCoverage, syntheticGrid, validFacilities } from './spatial.js';

export const bins = {
  id: 'bins', number: 2, title: '垃圾桶配置',
  subtitle: '同一個新增預算，比較均分位置與需求優先位置的步行服務範圍。',
  defaults: { budget: 20, fairness: 35, radius: 300, siting: 'all', detour: 1, laborHours: 8, serviceMinutes: 6, collections: 2 },
  controls: [
    { key: 'budget', label: '新增垃圾桶上限', type: 'range', min: 0, max: 100, step: 1, unit: '個' },
    { key: 'fairness', label: '公平優先權重', type: 'range', min: 0, max: 100, step: 5, unit: '%' },
    { key: 'radius', label: '步行服務半徑（假設）', type: 'range', min: 100, max: 1200, step: 50, unit: '公尺' },
    { key: 'siting', label: '候選可設置條件情境', type: 'select', options: [{ value: 'all', label: '全部候選（未現勘）' }, { value: 'constrained', label: '排除 25% 候選（合成限制）' }] },
    { key: 'detour', label: '步行繞行倍數（假設）', type: 'range', min: 1, max: 3, step: 0.25, unit: '倍' },
    { key: 'laborHours', label: '新增桶每日清運工時上限', type: 'range', min: 0, max: 24, step: 1, unit: '人時' },
    { key: 'serviceMinutes', label: '每次清運含行程工時（假設）', type: 'range', min: 1, max: 30, step: 1, unit: '分鐘／桶' },
    { key: 'collections', label: '每日清運次數（假設）', type: 'range', min: 1, max: 8, step: 1, unit: '次' },
  ],
  evaluate(params = {}, data = {}) {
    const input = params ?? {};
    const bbox = bboxOf(data);
    const budget = Math.floor(bounded(input.budget, 0, 100, bins.defaults.budget));
    const fairness = bounded(input.fairness, 0, 100, bins.defaults.fairness) / 100;
    const radius = bounded(input.radius, 100, 1200, bins.defaults.radius);
    const detour = bounded(input.detour, 1, 3, bins.defaults.detour);
    const effectiveRadius = radius / detour;
    const laborHours = bounded(input.laborHours, 0, 24, bins.defaults.laborHours);
    const minutes = bounded(input.serviceMinutes, 1, 30, bins.defaults.serviceMinutes);
    const collections = Math.floor(bounded(input.collections, 1, 8, bins.defaults.collections));
    const effectiveBudget = Math.min(budget, Math.floor(laborHours * 60 / (minutes * collections)));
    const facilities = validFacilities(data?.bins, bbox);
    const demand = syntheticGrid(bbox, 12, 'demand');
    const candidates = eligibleCandidates(syntheticGrid(bbox, 12, 'candidate', 0.5), input.siting);
    const baseline = coverageStats(coverageBy(facilities, demand, effectiveRadius), demand);
    const regular = regularCoverage(facilities, candidates, demand, effectiveBudget, effectiveRadius);
    const optimized = greedyCoverage(facilities, candidates, demand, effectiveBudget, effectiveRadius, fairness);
    return {
      metrics: [
        { label: '快照內已知垃圾桶', value: facilities.length, unit: '個', detail: '範圍內有效且去除重複座標的已知點位。' },
        { label: '建議新增數量', value: optimized.selected.length, unit: '個', detail: `新增上限 ${budget} 個；沒有邊際增益時提前停止。` },
        { label: '已知垃圾桶基準服務率', value: 100 * baseline.rate, unit: '%' },
        { label: '推薦方案需求服務率', value: 100 * optimized.stats.rate, unit: '%' },
        { label: '相對已知垃圾桶基準增加', value: 100 * (optimized.stats.rate - baseline.rate), unit: '百分點' },
        { label: '最低模擬區服務率', value: 100 * optimized.stats.minimumRate, unit: '%' },
        { label: '新增桶每日清運工時', value: optimized.selected.length * minutes * collections / 60, unit: '人時', detail: `工時上限 ${laborHours} 人時；同質工時假設，不含既有桶` },
      ],
      model: { effectiveRadius, candidateCount: candidates.length, effectiveBudget, laborHours, minutes, collections },
      map: { points: mapPoints(facilities, demand, candidates, optimized.selected, '快照垃圾桶'),
        caption: '垃圾桶位置來自資料快照；144 個需求點與 144 個候選位置為合成且相互對齊。地圖最多顯示 220 個已知垃圾桶，計算使用全部有效點位。' },
      chart: comparisonChart(baseline, regular, optimized.stats),
      table: actionTable(optimized.selected, '現勘新增垃圾桶位置'),
      explanation: `固定 ${radius} 公尺服務門檻／${detour} 倍繞行假設（直線門檻 ${effectiveRadius.toFixed(0)} 公尺），以現有快照垃圾桶為基準，對 144 個合成需求點選擇最多 ${effectiveBudget} 個新增位置（設置預算 ${budget} 個、每日清運工時 ${laborHours} 人時雙重限制）。每輪以 ${Math.round((1 - fairness) * 100)}% 效率與 ${Math.round(fairness * 100)}% 公平效用比較邊際增益；效率為服務需求權重比例，公平效用為四區服務率平方根平均。`,
      assumptions: [
        '144 個需求點與權重、144 個候選位置與四區分界皆為固定合成假設，並非實測人流、垃圾量或陳情熱點。',
        '限制情境每四個候選排除一個，是合成可行性遮罩，未代表真實人行道、土地權或收運路線。',
        '距離採地理座標近似直線距離，未考慮道路、河川、出入口及步行路網；繞行倍數只是敏感度假設，服務率不可視為真實步行可達率。',
        '每次新增一個假設垃圾桶；每桶每日清運工時＝每次分鐘 × 次數；此同質工時是自訂情境，未最佳化路線。桶容量、垃圾量及滿溢率未納入。',
        '已知垃圾桶依快照內容計算；資料缺漏可能造成服務缺口被高估，沒有點位不等於實際沒有垃圾桶。',
        '推薦位置需驗證土地與人行空間、商家需求與清運可行性，才能轉為設置方案。',
        ...(facilities.length ? [] : ['目前範圍沒有可用的真實垃圾桶點位；基準僅代表零個已知點。']),
      ],
      sources: ['bins', 'puma'],
    };
  },
};
