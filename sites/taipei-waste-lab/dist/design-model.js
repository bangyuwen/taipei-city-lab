// Concept dimensions are chosen for this experience, not surveyed product specs.
const defineDesign = (values) => Object.freeze({
  ...values,
  openingHeightCm: 110 * values.openingRatio,
  colors: Object.freeze(values.colors),
});

export const designs = Object.freeze([
  defineDesign({
    id: 'pair',
    name: '圓桶雙分類',
    tagline: '看見開口大小與分類配置',
    description: '一般垃圾與回收桶並排，從上方投入；以兩個圓形開口比較物件尺寸。',
    tradeoff: '放大開口方便投入，也可能讓較大物件通過；仍需實地觀察投放行為。',
    widthCm: 104, depthCm: 48, openingRatio: 1,
    maxOpeningCm: 36, openingShape: 'round', openingAspectRatio: 1,
    colors: {body: '#566773', recycle: '#3c7d68', accent: '#e9b65e'},
  }),
  defineDesign({
    id: 'hood',
    name: '雨遮雙桶',
    tagline: '加上遮罩，觀察入口與視線',
    description: '兩座圓桶上方加設遮罩，從罩下開口投入；示意遮罩與桶身的空間關係。',
    tradeoff: '遮罩可能改變雨水、視線與操作空間；本模型沒有測試防雨或清潔效果。',
    widthCm: 104, depthCm: 52, openingRatio: 0.88,
    maxOpeningCm: 32, openingShape: 'round', openingAspectRatio: 1,
    colors: {body: '#667d86', recycle: '#4c8d77', accent: '#e4bd77'},
  }),
  defineDesign({
    id: 'slot',
    name: '窄口直立桶',
    tagline: '用小開口比較可投物件',
    description: '單座一般垃圾桶使用正面窄口；入口高度為入口寬度的六成，便於觀察截面限制。',
    tradeoff: '縮小入口會同時限制部分隨手垃圾；不能由入口尺寸推定防止家戶垃圾的效果。',
    widthCm: 64, depthCm: 44, openingRatio: 0.79,
    maxOpeningCm: 18, openingShape: 'slot', openingAspectRatio: 0.6,
    colors: {body: '#586e77', recycle: '#4b8572', accent: '#e1b564'},
  }),
  defineDesign({
    id: 'service',
    name: '前門模組桶',
    tagline: '把日常投放與清運開門一起看',
    description: '一般垃圾與回收模組並排，正面設投入口與清運門；入口高度為入口寬度的四分之三。',
    tradeoff: '清運門需要額外操作空間；畫面中的剩餘寬度尚未扣除門片與清運作業範圍。',
    widthCm: 104, depthCm: 52, openingRatio: 0.81,
    maxOpeningCm: 30, openingShape: 'rect', openingAspectRatio: 0.75,
    colors: {body: '#687b82', recycle: '#4c806b', accent: '#ebbd6b'},
  }),
]);

export const defaultParameters = Object.freeze({
  heightCm: 110, openingCm: 22, sidewalkCm: 200, fillPercent: 30,
});

export function getDesign(id) {
  return designs.find((design) => design.id === id) || designs[0];
}

const resolveDesign = (design) => getDesign(typeof design === 'string' ? design : design?.id);
const finiteValue = (value, fallback) => {
  if (typeof value !== 'number' && typeof value !== 'string') return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeParameters(design, values = {}) {
  const current = resolveDesign(design);
  const source = values && typeof values === 'object' ? values : {};
  return {
    heightCm: clamp(finiteValue(source.heightCm, defaultParameters.heightCm), 85, 130),
    openingCm: clamp(finiteValue(source.openingCm, defaultParameters.openingCm), 8, current.maxOpeningCm),
    sidewalkCm: clamp(finiteValue(source.sidewalkCm, defaultParameters.sidewalkCm), 120, 320),
    fillPercent: clamp(finiteValue(source.fillPercent, defaultParameters.fillPercent), 0, 100),
  };
}

// All samples travel long-axis first. Their rigid leading face is deliberately
// simplified; the model does not squeeze bags, tilt objects, or calculate volume.
const defineItem = (item) => Object.freeze({
  ...item,
  crossSection: Object.freeze({
    shape: 'circle', widthCm: item.widthCm, heightCm: item.widthCm,
    orientation: '長軸先進入',
  }),
});

export const items = Object.freeze([
  defineItem({id: 'cup', label: '飲料杯', widthCm: 9, heightCm: 14}),
  defineItem({id: 'bottle', label: '寶特瓶', widthCm: 7, heightCm: 23}),
  defineItem({id: 'bag', label: '小袋家戶垃圾', widthCm: 28, heightCm: 32}),
]);

const format = (value) => String(Math.round(value * 10) / 10);

export function evaluateItem(design, params, itemOrId) {
  const current = resolveDesign(design);
  const values = normalizeParameters(current, params);
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return {allowed: false, reason: '找不到比較物件，請選擇飲料杯、寶特瓶或小袋家戶垃圾。'};
  if (values.fillPercent === 100) {
    return {allowed: false, reason: '目前設定為填滿，請先降低填滿程度再試投；這是操作設定，未計算實際容量。'};
  }
  const openingWidth = values.openingCm;
  const openingHeight = openingWidth * current.openingAspectRatio;
  const face = item.crossSection;
  const allowed = current.openingShape === 'round'
    ? Math.max(face.widthCm, face.heightCm) <= openingWidth
    : face.widthCm <= openingWidth && face.heightCm <= openingHeight;
  const aperture = current.openingShape === 'round'
    ? `直徑 ${format(openingWidth)} cm 的開口`
    : `${format(openingWidth)} × ${format(openingHeight)} cm 的開口`;
  return {
    allowed,
    reason: allowed
      ? `此物件的簡化剛性截面可穿過${aperture}；未計算實際容量或投放行為。`
      : `此物件的簡化剛性截面無法穿過${aperture}；袋子變形、斜放與其他尺寸不在比較範圍。`,
  };
}

export function getReadout(design, params) {
  const current = resolveDesign(design);
  const values = normalizeParameters(current, params);
  const fillLabel = values.fillPercent === 0 ? '空桶'
    : values.fillPercent < 50 ? '尚有空間'
    : values.fillPercent < 80 ? '逐漸填滿'
    : values.fillPercent < 100 ? '接近填滿' : '已填滿';
  return {
    openingHeightCm: Math.round(values.heightCm * current.openingRatio * 10) / 10,
    remainingWidthCm: values.sidewalkCm - current.depthCm,
    fillLabel,
    notes: [
      '假設桶背貼路緣、沿街並排；桶前剩餘空間以人行道寬減桶深估算，未計退縮與開門空間。',
      '四款為體驗用概念尺寸，不是台北現役產品規格；數值比較未經工程、無障礙或防濫倒效果驗證。',
      '試投只比較所選物件的剛性截面；未考慮變形、斜放、真實垃圾種類與清運需求。',
      current.tradeoff,
    ],
  };
}
