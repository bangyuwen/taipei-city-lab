// Demo state is local-only and never reads or migrates existing live/beta keys.
window.KP='有桶demo_v1_';
// ===== 可編輯設定檔：開場數字、示範區、方案參數 =====
// 開場數字（headline）計數定義待與資料工程師對齊，改這裡即可，頁面不寫死數字。
window.CONFIG={
  brand:'有桶',
  demo:true,
  headline:{
    title:'有桶｜台北行人垃圾桶：從近 3,000 組到約 800 組',titleNote:'「近 3,000 組減到約 800 組」是官方題目的問題陳述，不是本工具的計算',
    items:[
      {value:'681',label:'街道清冊列數（2026-09-30）',note:'資料：臺北市行人專用清潔箱主檔；1 列座標含「?」無法使用，有效 680 列（與研究 repo 一致）'},
      {value:'120',label:'景點商圈備用垃圾桶（另列，不可相加）',note:'2026-08-18'},
      {value:'1,644',label:'YouBike 站 步行 100m 內無清冊垃圾桶',note:'共 1,821 站（90.3%；含 29 個未營運站）；全臺北市步行路網距離（OSM）；只用街道清冊 680 列有效座標。直線距離時為 1,546 站（84.9%；研究 repo 只計 1,790 個營運站：1,519 站）'},
      {value:'3,129',label:'公車站 步行 100m 內無清冊垃圾桶',note:'共 3,460 站位（臺北市，90.4%）；全臺北市步行路網距離（OSM）；只用街道清冊 680 列有效座標。直線距離時為 2,983 站（86.2%）'}
    ],
    caveat:'清冊不等於現場完整現況；北投 0 列、南港 4 列為資料缺漏。「近 3,000 組減到約 800 組」是官方題目的問題陳述。'
  },
  demoArea:{name:'公館–大安',bounds:[[25.0075,121.5240],[25.0400,121.5560]],center:[25.0215,121.5380],zoom:15},
  fallbackLocation:{name:'捷運公館站公車站',latlng:[25.013993,121.535185]}, // 行人頁定位失敗時的示範位置
  hotspot:{gapThresholdM:100, maxList:8},          // 查核優先序：最近街道清潔箱（步行；無法對應路網時用直線）> 100m
  scenarioB:{ // B 原位改善：模擬參數（假設，可調整）
    baseCapacityL:80, newCapacityL:120,            // 容量（公升）
    baseCollectionsPerDay:2, newCollectionsPerDay:3,
    litersPer1000Trips:5, nearRadiusM:150        // 假設：每月每 1,000 次借還 → 每日產生 5 公升（假設，可調整）
  },
  scenarioC:{donorRadiusM:1000, demandRadiusM:200, noNewGapM:200, checkRadiusM:600},
  // C：只從熱點 1km 內挑桶；移走後原位置附近（600m 內）不得有站點新增「200m 內無桶」；符合者中挑周邊 200m 活動量最低者
  suggestion:{bIfBinWithinM:100, cMinReduction100:1}, // 建議規則（假設，可調整）：熱點 ≤100m 有桶→B；C 可行且減少 ≥1 個 100m 無桶站→C；否則 A
  compare:[{name:'捷運公館站(2號出口)',label:'人流最高',short:'公館'},{name:'捷運大安站(4號出口)',label:'查核優先序第 1',short:'大安 4 號出口'}], // 「人流最高 ≠ 最優先」比較卡
  // ===== 清潔隊「預測調度」（示範區）=====
  // 每桶每小時人流 = 200m 內 YouBike 站該小時「每日平均借＋還次數」的平均（2026-07 實際紀錄；人流由交通活動推估）
  // 每小時產生量(L) = 人流 × litersPerRide × 該桶校正係數；填充度 = 自上次（例行或手動）清運起累積量 / capacityL
  // litersPerRide 用官方公開的每日清運頻率校準，仍是假設（calibrate_rate.py）：
  //   環保局：每箱約 120 公升、每日巡查清運約 3–6 次（聯合報 2025-08-17／經濟日報轉載）
  //   假設示範區「人流中位數」的桶平日一天裝滿 3 次（官方下限）；中位數桶平日每日人流 361.1
  //   litersPerRide = 3 × 120 / 361.1 = 0.997
  forecast:{
    radiusM:200,
    litersPerRide:0.997,
    calibration:{fillsPerDay:3,capacityL:120,dayType:'wk',basis:'示範區人流中位數桶的平日每日人流',refRidesPerDay:361.1,
      source:'https://money.udn.com/money/story/7307/8944421',label:'用官方公開的每日清運頻率校準，仍是假設'},
    capacityL:120,
    emaAlpha:0.3,                // 校正：實際回報滿度 ÷ 預測滿度，指數移動平均
    shiftStart:'08:00', shiftEnd:'16:30',
    routineClears:['05:00','08:00','12:00','16:00'], // 例行清運時間 05:00／08:00／12:00／16:00 為假設；官方公開資料只提到一天 3–6 次，沒有公布時間；預測從最近一次例行清運起累積
    depot:null,                  // 清潔隊出發點 [lat,lng]；null = 示範區中心
    threshold:70, routeOrder:'tiered', // 'tiered'＝第 1 層必清（下次例行清運或收班前會滿）→ 第 2 層其餘達門檻，層內行車路網最近鄰；'drive-nn'；'priority'
    demoTime:{day:'we',time:'15:30'}, // 示範：週六 15:30（對照平日 10:00）
    demoLinks:[{day:'wk',time:'10:00',label:'平日 10:00'},{day:'we',time:'15:30',label:'週六 15:30'}] // 抽屜預設：示範對照 ≥100% 桶數（平日 10:00＝2、週六 15:30＝6）
  },
  // Demo publication must remain local-only; cloud.js also enforces CONFIG.demo.
  firebaseConfig:{},
  storageKeys:{scenario:KP+'scenario_v2',events:KP+'events_v1',forecast:KP+'forecast_v1'}
};
