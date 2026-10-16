export const COUNTRY_COMPARISONS = Object.freeze([
  {
    id: "country-us",
    country: "美國",
    group: "daily",
    audience: "一般行人",
    collection: "帶輪內桶配合清運車；清運方另負責周邊撿拾與通報損壞，應分開計清運、清洗和維修。",
    digital: "可裝感測器；來源未證實已安裝。",
    costBasis: "2026 大量採購單價（3,000 桶以上）：US$1,591／桶含內桶；另列關稅 US$158，可能變動。未列運送、安裝與感測服務完整費用。",
    evidence: "2026-03 簡報稱首 10 桶進入測試，街頭部署其後進行；沒有依預定上線時間推定全市換裝。"
  },
  {
    id: "country-france",
    country: "法國",
    group: "daily",
    audience: "行人投放小型垃圾",
    collection: "市府每天清空 1–3 次，依人流與活動調整清潔；民眾可透過 DansMaRue 回報。",
    digital: "DansMaRue 用於民眾回報；所查資料未確認普通街桶有滿度感測。",
    costBasis: "所查市府資料未列單桶價格、感測費或完整維護費；防護設計與日清頻率不代表已證實較省錢。",
    evidence: "清潔頁更新於 2026-09-16，可核對服務做法；沒有足以將垃圾量或鼠害改善單獨歸因桶型的評估。"
  },
  {
    id: "country-netherlands",
    country: "荷蘭",
    group: "daily",
    audience: "行人；設自閉桶門及獨立押金瓶罐取用",
    collection: "優先設於常被翻桶、散落較多的地點；清潔員與回收者參與設計。來源未列固定清空頻率。",
    digital: "來源未確認滿度感測；試辦觀察桶門關閉狀態，這不是垃圾減量率。",
    costBasis: "2026-04 市府估重要點位改造約 €800 萬，另列需改造 8,000 桶；這不是先行 200 桶採購額或逐桶價，且不含破壞與額外清潔成本。",
    evidence: "2026-10-05 公告稱 9 月 28 日開始裝設 200 桶，目標 10 月底完成，清潔效果仍待追蹤。4 月試辦桶門保持關閉 83% 對 38%，不是垃圾減少率。"
  },
  {
    id: "country-singapore",
    country: "新加坡",
    group: "daily",
    audience: "行人，優先設於公車站與繁忙步道",
    collection: "依現場評估與民眾回饋增設或移位，同時考量清空所需資源；所查來源未列逐點清運頻率。",
    digital: "熱點 CCTV 用於巡查，不等於桶內感測；來源未確認街桶滿度感測。",
    costBasis: "所查 NEA 資料未列單價、維護合約或每次清運費；園區照片不提供 NEA 街桶規格、價格或成效證據。",
    evidence: "NEA 於 2023-12-08 列逾 11,000 桶；2025 回顧報告熱點垃圾計數降 36%，但同時有巡查、執法與宣導，不能歸因於增桶。"
  },
  {
    id: "country-south-africa",
    country: "南非",
    group: "daily",
    audience: "商場與通勤路線行人；不是家戶或商業垃圾收集站",
    collection: "公告由區域清潔隊每日清空；市府指出其他點位曾因家戶或商家混倒而滿溢。",
    digital: "來源未提感測器。",
    costBasis: "設置公告未列單價、採購總額或維護費；每日清運仍是持續支出。",
    evidence: "2022-12-07 公告列 28 桶、分布三條道路；這是行政設置數，未獨立盤點完成數，也沒有後續清潔或防洪成效。"
  },
  {
    id: "country-japan",
    country: "日本",
    group: "collection",
    audience: "商圈行人與觀光客",
    collection: "商店會主導、合同衛生負責回收；有人接收滿溢前通知並安排清運，固定頻率及逐次費用未列。",
    digital: "SmaGO 自動壓縮、雲端監測並在滿溢前通知。",
    costBasis: "來源未列單價與完整維護費。",
    evidence: "2023-11-16 聯合公告稱 1 月試驗附近散落垃圾約減四成；這是營運方前後觀察，沒有同期對照，不能把效果只歸因設備。"
  },
  {
    id: "country-uk",
    country: "英國",
    group: "collection",
    audience: "交通與夜生活熱點",
    collection: "2015 試辦平均每天清空略多於一次，沿用既有承包人力；未證明減少人員或車次。",
    digital: "Bigbelly 以太陽能壓縮，回報滿度及清空次數。",
    costBasis: "2016 歷史採購價：£4,300／桶，含啟用與軟體；整批年維護約 £1,500。",
    evidence: "2015 年試辦 9 桶，2016 年報告清潔分級改善；未證實省下人力或車次。"
  },
  {
    id: "country-denmark",
    country: "丹麥",
    group: "collection",
    audience: "高垃圾量街區",
    collection: "可沿用大型帶輪桶清運作業；2025-12-04 備忘錄列 16 處、規劃測試 16 個月，時程不等於已完成成效。",
    digital: "CitySolar 以太陽能壓縮並提供滿度通知。",
    costBasis: "市府列 2025 年起每年 DKK 550,000 計畫額度；這是年度預算，不是單桶價或完整成本。",
    evidence: "2025 方案規劃試 16 桶；早期 2018–2023 智慧桶預期效率未實現。尚未找到新版完成評估。"
  },
  {
    id: "country-australia",
    country: "澳洲",
    group: "collection",
    audience: "中央商業區店家與居民",
    collection: "監測共用壓縮站故障、巷道棄置與車輛阻塞，以通知清運承包商；普通行人桶另須配合內桶、車輛與行人空間。",
    digital: "2021 試點以 CCTV 與影像分析觀察壓縮站使用及阻塞；不能推成所有街桶都有滿度感測。",
    costBasis: "所查資料未列站體單價、安裝與影像服務完整費用；2022 行人桶規範未確認為 2026 最新版，巷道站也不能和單座行人桶直接比價。",
    evidence: "2015–18 行政紀錄記有 4 座壓縮站、6 處回收站，服務約 400 家店家與居民；未取得有對照的清潔或工時效果。"
  },
  {
    id: "country-finland",
    country: "芬蘭",
    group: "household",
    audience: "市有物業集中收集；不是行人小型箱",
    collection: "即時滿度協助安排清運，取代依清運秤重估算下次收運；節省空車與成本仍是待驗證目標。",
    digital: "Molok 深埋式桶搭配 Futuren 滿度感測及 Wastebook 平台。",
    costBasis: "來源未列感測、平台、維護或土建完整費用。",
    evidence: "2024-09 公告列 26 處市有物業、117 桶，原訂 2025 年夏季結束；本輪未找到最終節省評估，不能視為仍在試辦或已成功。"
  },
  {
    id: "country-korea",
    country: "韓國",
    group: "household",
    audience: "已登錄共同住宅住戶的廚餘",
    collection: "RFID 辨識、逐次秤重與計費後，仍須安排收運、清洗和維護；首爾說明每台約供 60 戶、每日處理容量 120 L。",
    digital: "RFID 將住戶識別、投放重量與時間接入管理及計費；秤重與滿度偵測是不同功能。",
    costBasis: "首爾東大門區安裝補助說明約 KRW 2,000,000（頁面更新於 2026-02-02）；這是地方補助資訊，非全韓統一機價，也未列完整維護費或每公斤投放費。",
    evidence: "官方列 2025 年 186 個自治體、約 861 萬公寓住戶；這是家戶廚餘服務，不能視為匿名街頭行人箱的減量成效。"
  },
  {
    id: "country-india",
    country: "印度",
    group: "household",
    audience: "家戶到戶收運；商業區行人投放仍須另處理",
    collection: "到戶收運分流濕、乾及家戶危險垃圾；車隊以 GPS 追蹤路線，再送轉運站。",
    digital: "GPS 追蹤收運車路線，不是桶內滿度感測。",
    costBasis: "官方案例未列公用桶單價或完整到戶收運成本；車隊、轉運站與家戶服務費用不能當成行人桶價格。",
    evidence: "官方歷史紀錄描述 2016 年先在 2 區試行，再擴大到全市；城市排名與行政成果不能證明撤除行人桶有效。"
  }
].map((comparison) => Object.freeze(comparison)));

const FILTERS = [
  { id: "all", label: "全部" },
  { id: "daily", label: "日常投放" },
  { id: "collection", label: "滿溢與收運" },
  { id: "household", label: "家戶與集中" }
];

const COMPARISON_FIELDS = [
  ["collection", "收運與維護"],
  ["digital", "數位工具"],
  ["costBasis", "成本口徑"],
  ["evidence", "已有證據"]
];

export function initializeCountryComparison(container, { onSelect, onPlay } = {}) {
  if (!container || typeof container.replaceChildren !== "function") {
    throw new TypeError("A country comparison container is required.");
  }

  const root = document.createElement("div");
  root.className = "country-compare";

  const filters = document.createElement("div");
  filters.className = "country-compare-filters";
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "依用途篩選案例");

  const resultCount = document.createElement("p");
  resultCount.className = "country-compare-result-count";
  resultCount.setAttribute("role", "status");
  resultCount.setAttribute("aria-live", "polite");

  const list = document.createElement("ul");
  list.className = "country-compare-list";

  const rows = COUNTRY_COMPARISONS.map((comparison) => {
    const item = document.createElement("li");
    item.className = "country-compare-item";
    item.setAttribute("data-country-compare-id", comparison.id);

    const details = document.createElement("details");
    details.className = "country-compare-details";

    const summary = document.createElement("summary");
    summary.className = "country-compare-summary";

    const country = document.createElement("span");
    country.className = "country-compare-country";
    country.textContent = comparison.country;

    const audience = document.createElement("span");
    audience.className = "country-compare-audience";
    audience.textContent = comparison.audience;

    summary.append(country, audience);

    const fields = document.createElement("dl");
    fields.className = "country-compare-fields";
    for (const [key, label] of COMPARISON_FIELDS) {
      const field = document.createElement("div");
      field.className = "country-compare-field";

      const term = document.createElement("dt");
      term.textContent = label;

      const description = document.createElement("dd");
      description.textContent = comparison[key];

      field.append(term, description);
      fields.append(field);
    }

    const select = document.createElement("button");
    select.className = "country-compare-select";
    select.type = "button";
    select.textContent = "看案例與來源";
    select.addEventListener("click", () => {
      if (typeof onSelect === "function") onSelect(comparison.id);
    });

    select.setAttribute("aria-label", comparison.country + "：看案例與來源");
    const actions = document.createElement("div");
    actions.className = "country-compare-actions";
    actions.append(select);
    if (typeof onPlay === "function") {
      const play = document.createElement("button");
      play.type = "button";
      play.className = "country-compare-play";
      play.textContent = "試玩 3D 示意";
      play.setAttribute("aria-label", comparison.country + "：試玩 3D 示意");
      play.addEventListener("click", () => onPlay(comparison.id, play));
      actions.append(play);
    }
    details.append(summary, fields, actions);
    item.append(details);
    list.append(item);
    return { item, comparison };
  });

  for (const filter of FILTERS) {
    const button = document.createElement("button");
    button.className = "country-compare-filter";
    button.type = "button";
    button.textContent = filter.label;
    button.setAttribute("data-country-compare-filter", filter.id);
    button.setAttribute("aria-pressed", filter.id === "all" ? "true" : "false");
    button.addEventListener("click", () => {
      for (const otherButton of filters.children) {
        otherButton.setAttribute(
          "aria-pressed",
          otherButton === button ? "true" : "false"
        );
      }

      let visibleCount = 0;
      for (const { item, comparison } of rows) {
        const visible = filter.id === "all" || comparison.group === filter.id;
        item.hidden = !visible;
        if (visible) visibleCount += 1;
      }
      resultCount.textContent = `${visibleCount} 個案例`;
    });
    filters.append(button);
  }

  resultCount.textContent = `${COUNTRY_COMPARISONS.length} 個案例`;
  root.append(filters, resultCount, list);
  container.replaceChildren(root);
  return root;
}
