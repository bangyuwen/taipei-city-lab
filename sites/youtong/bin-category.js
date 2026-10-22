// ===== 垃圾桶收受類別（有桶・行人頁） =====
// 資料現況（2026-10-19 查證）：臺北市行人專用清潔箱開放資料只有「行政區、地址、經度、緯度、備註」，沒有逐桶類別欄位。
// 全市性官方說明：環保局（截至 2025 年 2 月）「全市共設有1943組行人專用清潔箱，每組包含一般垃圾箱與資源回收箱各1個」。
// → 沒有逐桶欄位時，一律依此全市說明視為「一般＋回收」（basis:'citywide'），不是模擬。
// 之後若資料有逐桶欄位：在 loadCore() 把它放進 bin.category（'general' | 'recycle' | 'both'），這裡會優先使用（basis:'field'）。
const BIN_CAT={
  general:{label:'一般垃圾',color:'#3b3734'},
  recycle:{label:'資源回收',color:'#2f6fde'},
  both:{label:'一般垃圾＋資源回收',color:null}
};
const BIN_CAT_SOURCE={
  basis:'citywide',
  quote:'全市共設有1943組「行人專用清潔箱」，每組包含一般垃圾箱與資源回收箱各1個，每個容量約為120公升',
  who:'臺北市環保局說明（資料截至 2025 年 2 月）',
  links:[{t:'聯合報 2025-08-18',u:'https://udn.com/news/story/7266/8945553'},{t:'中國時報 2025-08-17',u:'https://www.chinatimes.com/realtimenews/20250817001619-260405'}]
};
function binCategory(bin){
  if(bin&&BIN_CAT[bin.category])return{cat:bin.category,simulated:false,basis:'field'};
  return{cat:'both',simulated:false,basis:'citywide'};
}
// 篩選：'all' | 'general' | 'recycle'；成對桶兩種篩選都會出現
const binAccepts=(bin,filter)=>{if(filter==='all')return true;const c=binCategory(bin).cat;return c==='both'||c===filter};
// 類別是否真的有差異（全部同類時，篩選列沒有意義 → 頁面隱藏）
const binCatsVaried=bins=>new Set(bins.map(b=>binCategory(b).cat)).size>1;
