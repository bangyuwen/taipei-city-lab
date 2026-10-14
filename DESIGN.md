---
name: 台北城市實驗室
description: 城市專刊：從生活提問探索地圖與情境比較
colors:
  ink: '#202c45'
  muted: '#60697a'
  paper: '#f3f1eb'
  panel: '#ffffff'
  line: '#d3d7de'
  signal: '#ae432c'
  signal-soft: '#f5e4db'
  nav: '#202c45'
  nav-muted: '#c5cbd7'
  nav-hover: '#303d57'
  focus: '#a23d27'
  focus-on-navy: '#f5b591'
  primary-hover: '#a63e28'
  primary-active: '#893322'
  outline-border: '#aab1bf'
  outline-hover-border: '#8893a6'
  subtle-hover: '#e8e6df'
  text-hover: '#ece9e2'
  evidence-bg: '#e5e9ee'
  evidence-text: '#485671'
  guide-bg: '#e7ebf0'
  control-bg: '#e9edf2'
  scene-border: '#45516a'
  scene-control-border: '#7e8ba4'
  scene-control-bg: '#28364f'
  scene-hover: '#465371'
  scene-muted: '#d4dbe8'
  scene-selected: '#f6c58b'
  csv-paper: '#f4f5f7'
  map-existing: '#236749'
  map-demand: '#557ca4'
  map-candidate: '#737d79'
  map-recommended: '#b67608'
typography:
  display:
    fontFamily: '"City Serif","Noto Serif TC",serif'
    fontSize: 42px
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: -.02em
  headline:
    fontFamily: '"City Serif","Noto Serif TC",serif'
    fontSize: 34px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: -.02em
  title:
    fontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.7
  visual-title:
    fontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.7
  body:
    fontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.9
  question:
    fontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.8
  action:
    fontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'
    fontSize: 13px
    lineHeight: 1.6
  field:
    fontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'
    fontSize: 13px
  label:
    fontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'
    fontSize: 12px
    lineHeight: 1.8
  metric:
    fontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'
    fontSize: 28px
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: -.02em
  csv:
    fontFamily: ui-monospace,monospace
    fontSize: 13px
    lineHeight: 1.8
rounded:
  flat: '0'
  marker: 4px
  badge: 6px
  control: 8px
  callout: 12px
  panel: 14px
  dialog: 16px
spacing:
  compact: 8px
  small: 12px
  medium: 16px
  inset: 18px
  large: 20px
  section: 24px
  workspace-gap: 28px
  wide: 32px
components:
  button-primary:
    backgroundColor: '{colors.signal}'
    textColor: '{colors.panel}'
    rounded: '{rounded.control}'
    padding: 10px 14px
    typography: '{typography.action}'
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-primary-active:
    backgroundColor: '{colors.primary-active}'
  button-outline:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: 10px 14px
    typography: '{typography.action}'
  button-outline-hover:
    backgroundColor: '{colors.subtle-hover}'
  button-text:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: 10px 14px
    typography: '{typography.action}'
  button-text-hover:
    backgroundColor: '{colors.text-hover}'
    textColor: '{colors.signal}'
  select:
    backgroundColor: '{colors.panel}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: 10px
    typography: '{typography.field}'
  csv-input:
    backgroundColor: '{colors.csv-paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: 12px
    typography: '{typography.csv}'
  navigation-active:
    backgroundColor: '{colors.signal-soft}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: 12px 10px
  evidence-badge:
    backgroundColor: '{colors.evidence-bg}'
    textColor: '{colors.evidence-text}'
    rounded: '{rounded.badge}'
    padding: 9px 12px
  view-selected:
    backgroundColor: '{colors.signal-soft}'
    textColor: '{colors.ink}'
    rounded: '{rounded.flat}'
    padding: 10px 12px
  visual-panel:
    backgroundColor: '{colors.panel}'
    textColor: '{colors.ink}'
    rounded: '{rounded.panel}'
  control-panel:
    backgroundColor: '{colors.control-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.panel}'
    padding: 24px 22px
  exploration-guide:
    backgroundColor: '{colors.guide-bg}'
    textColor: '{colors.evidence-text}'
    rounded: '{rounded.callout}'
    padding: 16px 20px
---

# Design System: 台北城市實驗室

## Overview

**Creative North Star: "城市專刊"**

使用者於 2026-10-14 選定城市專刊，授權取代原有綠色工作台。深藍提供穩定導覽與文字，暖白承載閱讀，朱橘標出操作與選取。中文宋體標題配無襯線操作；繁體中文及「台北城市實驗室」名稱延續。

介面以平面分隔、留白與灰藍輔助面建立層次。圓角用於原生控制、提示及視覺容器；指標、方法與明細直接放在工作區。生活提問與可回復的情境操作相連，來源分類和推估限制持續可見。

本文件從最終原始碼擷取：Leaflet 樣式先載入，其後為 dist/styles.css、dist/workspace.css；動態內容來自 dist/app.js。模式為 code-led Operate，沒有 approved comp、quality boards 或桌機／手機截圖。Node 行為、靜態與資產檢查已通過；rendered visual、實際響應式排版、完整鍵盤巡覽、觸控及 WebGL 視覺驗證仍未完成。finish review 的 recapture 是缺少畫面證據的限制，並非視覺出貨判定；詳見 docs/redesign-review.md、docs/citizen-finish-review.md。

**Key Characteristics:**

- 深藍外殼、暖白閱讀面、朱橘互動訊號各有明確角色。
- 中文宋體標題配無襯線操作及等寬資料輸入。
- 細框、平面分隔與灰藍輔助面，控制使用圓角。
- 原生表單與漸進揭露保留研究能力和資料界線。

## Colors

配色像深藍油墨與暖白紙張，朱橘負責互動；精確色值以前置 tokens 為準。

### Primary

- **互動朱橘**（signal）：主要操作、文字 hover、視角底線及原生 range／checkbox；hover、按下有較深變體。最後值已按宣告色彩對比修正，不從標誌細線抽取操作色。
- **柔朱橘**（signal-soft）：當前題目與視角底色；前景仍為深藍。
- **鍵盤朱橘**（focus）：一般焦點；深藍導覽採亮色 focus-on-navy。

### Secondary

- **證據灰藍**（evidence-bg／evidence-text）：分類標示、表頭與健檢結果；guide-bg 為探索提示，control-bg 為參數及表格 hover。
- **情境琥珀**（scene-selected）：深藍 3D 控制的選取、時間值與方向，不取代主頁朱橘。
- **資料層色**（map-existing／map-demand／map-candidate／map-recommended）：Leaflet 的既有設施、合成需求、候選及推薦位置；保持原有圖例。

### Neutral

- **深藍油墨**（ink）：主要文字及深色狀態；同值 nav 專責導覽，場景沿用深藍。
- **暖白紙張／白色面板**（paper／panel）：頁面與地圖、圖表、欄位、對話框；白色也是主要按鈕文字。
- **次要油墨／細分隔線**（muted／line）：說明、單位、標籤與區域邊界。
- **局部深藍層**（nav-muted／nav-hover／scene-control-bg／scene-border／scene-control-border／scene-muted）：深色導覽及場景上的文字、hover 與邊界。
- **中性操作狀態**（outline-border／outline-hover-border／subtle-hover／text-hover）：描邊與文字操作；CSV 資料區另採 csv-paper。

**The Semantic Color Rule.** 外殼、互動選取與資料系列各自維持顏色角色；不要把朱橘套到所有點位或模型系列。其他圖表與座標圖系列仍以 dist/modules/、dist/viz.js 為準，不與 Leaflet 圖層色互換。

## Typography

**Display Font:** City Serif，fallback 為 Noto Serif TC、serif。本地 dist/fonts/city-serif.woff 是 Noto Serif TC 靜態粗體（700）當前標題子集（約 16 KB）；SIL OFL 1.1 授權與來源見同目錄的 OFL.txt、provenance.json。新增文字須重新查核字形並擴充子集。

**Body Font:** Noto Sans TC、PingFang TC、Microsoft JhengHei、sans-serif；無襯線字體未自託管，解析由裝置決定。

**Label/Mono Font:** 標籤沿用正文；CSV／JSON 用 ui-monospace、monospace。宋體建立刊物感，無襯線保持操作及資料清楚，數值與時間採 tabular-nums。

### Hierarchy

- **Display:** 入口大標題；42px、700、1.45。1200／980／760／480 邊界依序為 36／34／36／32px，並非單調縮放。
- **Headline:** 目前題目；34px、700、1.5；760px 以下為 30px。
- **Title／Visual Title:** 操作與證據標題為 18px；地圖／場景／圖表標題為 16px，皆無襯線、600、1.7。
- **Body／Question:** 方法與來源為 14px、1.9，最長 72ch；生活提問為 16px、1.8。480px 以下入口說明為 13px，生活提問為 15px。
- **Action／Field／Label:** 操作與欄位為 13px，輔助標籤為 12px；分類和部分補述行高為 1.7，其餘按來源角色維持。
- **Metric:** 28px、650、1.5、-.02em；1200px 以下為 26px，480px 以下為 25px。單位是較小的正常字重次要文字。
- **CSV:** 13px、1.8、等寬；保留多行和可調整高度。

**The Two Voices Rule.** 宋體用於入口與題目標題；控制、區域標題及資料保持無襯線。新增標題須補齊本地字形，不能把 fallback 渲染視為字體驗收。

## Layout

基底為 242px 固定題目導覽加流動工作區；sidebar 在 viewport 頂部 sticky 且可垂直捲動。main 最大寬度 1760px、兩側 padding 38px。主要工作區為「內容 + 304px 參數」（間距 28px），證據區為 1.25fr／1fr（間距 32px）。地圖／場景基底高 420px。

| 邊界 | 來源所宣告的排列 |
| --- | --- |
| ≥1500px | main 兩側 50px；參數 320px、間距 32px；viewport 高 480px。 |
| ≤1200px | 導覽 214px；main 兩側 26px；參數 270px、間距 20px；提示及題目標頭堆疊，證據單欄。 |
| ≤980px | 導覽 190px；main 兩側 22px；入口單欄、提問列表隱藏；工作區單欄、畫面先於參數；控制及指標雙欄；viewport 高 440px。 |
| ≤760px | 導覽成頂部預設收合選單，展開題目為兩欄；入口提問列表恢復；viewport 高 390px。 |
| ≤480px | main 兩側 18px；控制回到單欄、保存／匯出全寬；局部 padding、字級縮小；viewport 高 360px。 |

間距沿用前置 scale 與元件 padding；上述響應式排列是原始碼規則，尚待實際桌機／手機畫面驗證。

**The Cascade Rule.** 按 Leaflet、基底、workspace 的實際載入順序延伸樣式，維持主要畫面先於參數的 DOM 閱讀順序。

## Elevation & Depth

自寫介面未宣告卡片或按鈕陰影，以底色、細框與留白建立層次；對話框用半透明深藍 backdrop。Leaflet 保留功能陰影：zoom bar 為 `0 1px 5px rgba(0,0,0,0.65)`，圖層控制為 `0 1px 5px rgba(0,0,0,0.4)`，popup 為 `0 3px 14px rgba(0,0,0,0.4)`，tooltip 為 `0 1px 3px rgba(0,0,0,0.4)`。

Toast 是唯一自寫 transition（opacity .2s ease-out）；控制直接切換狀態，Leaflet 保留 vendor opacity／zoom 動效。prefers-reduced-motion 關閉 transition 並採 auto 捲動。

**The Flat Shell Rule.** 主要介面以平面分隔與色調層次表現深度；地圖 vendor 的功能陰影留在地圖局部，不擴張為卡片裝飾。

## Shapes

控制與導覽用 control 圓角，分類用 badge，提示用 callout，地圖／圖表／參數用 panel，對話框用 dialog。視角切換為平直底邊，點位為圓形。邊界多為 1px，選取視角採 2px 底線；3D 標籤和嚴重度標示用 marker 小圓角。品牌記號以現有 dist/mark.svg 為準，其細線不是互動色 token。

## Components

### Buttons

原生控制，至少 44px 高、control 圓角、action 字級、10px 14px padding。Primary 為朱橘白字、600；hover／按下使用各自較深狀態。Outline 為透明底、深藍字及中性描邊；Text 有可見底線，hover 為朱橘文字和 text-hover 底色。焦點為 3px outline、offset 4px；深藍導覽改亮色。Disabled 採 opacity .55、not-allowed 游標。

### Chips / Classification

分類 badge 非互動：證據灰藍、badge 圓角、9px 12px padding、1.7 行高；桌機最多 270px，1200px 以下移至題目下方。真實、模擬與假設分類用文字持續揭露。

### Cards / Containers

地圖／圖表／場景採 panel 圓角、細框；標頭通常為 18px 20px padding。參數採 control-bg、24px 22px padding。指標以底線分隔；方法及結果直接放在頁面。來源 dialog 為 min(820px,92vw)、最大高 85vh。

### Inputs / Fields

Select 與文字欄位是白底、中性描邊、control 圓角、至少 44px 高；range 有 label、output 和 min／max，checkbox 和 range 為原生朱橘 accent。CSV／JSON textarea 用等寬、csv-paper、12px padding，可垂直 resize。焦點沿用一般 outline。3D 局部控制是深藍變體，選取採情境琥珀。

### Navigation

深藍導覽用次要亮文字及 inline SVG；hover 為 nav-hover，active 為柔朱橘與深藍文字，SVG 改朱橘，維持 aria-current。760px 以下 toggle 以 aria-controls／aria-expanded 同步展開；切題收合。

### Views and Progressive Disclosure

地圖／3D／比較圖表是原生 button group，aria-pressed 表示目前視角，選取採柔朱橘及朱橘底線，三者維持同一組模型參數。先顯示前四項指標，其餘放在 more-metrics details；先顯示前三項控制，其餘放在 advanced-controls details。這是當前介面模式，並非未來所有表面都必須採固定數量。

### Public Question and Experiment

生活提問接續題目標題，灰藍提示提供模型界線與一鍵情境；套用後同步重繪控制、指標及視角，可回到起點。#explore 顯示公眾入口，計算題目預設仍為 bins；原有題目和參數 hash 保留。無 WebGL 2 時轉圖表，地圖載入失敗時保留其他探索方式。

## Do's and Don'ts

### Do:

- Do 使用深藍、暖白和互動朱橘的既定角色，維持資料系列與圖例原有語意。
- Do 為新增宋體標題補齊本地字形，保留字體授權及來源。
- Do 使用原生控制、可見文字、焦點與目前狀態語意，保持畫面先於參數。
- Do 持續呈現來源、真實與合成分類、方法及推估限制。
- Do 取得有效桌機／手機畫面後完成 finish re-review。

### Don't:

- Don't 把互動朱橘或舊題目 accent 當成所有點位和模型系列的共同配色。
- Don't 把每個指標、方法與明細再包成重複的大卡片。
- Don't 以文字字形作新操作圖示；新圖示沿用 inline SVG。
- Don't 把 sidecar 合成 tonal ramps 當成已部署配色或已驗證的對比組合。
- Don't 把原始碼、Node DOM stub、宣告色彩及資產檢查當成 rendered visual、響應式、觸控或 WebGL 驗收。

未納入可繼承規則／未修復：動態方法與來源連結仍帶 ↗，座標圖保留方向字形；既有文字圖示缺陷不作為新元件標準，本次只更新文檔。單次 detector 完整輸出被截斷且未保存，不能宣稱所有機械發現均已解決；暖白警告是已選方向的保留，不是完整視覺驗收。
