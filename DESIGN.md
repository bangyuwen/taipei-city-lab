---
name: "台北城市實驗室"
description: "七題市政研究原型的綠色操作工作台"
colors:
  ink: "#213b33"
  muted: "#526359"
  paper: "#f7f9f7"
  line: "#cbd5c9"
  accent: "#39835f"
  nav-bg: "#19382f"
  nav-text: "#bdd0c4"
  nav-active: "#e3ebdc"
  nav-hover: "#27493d"
  panel: "#fffefa"
  white: "white"
  primary-hover: "#36654f"
  outline-border: "#cdd7cb"
  subtle-hover: "#e9ede3"
  evidence-bg: "#eaf0e1"
  evidence-text: "#486244"
  scene-bg: "#102f2c"
  scene-text: "#e4efe4"
  scene-control: "#24493e"
  scene-hover: "#375d4d"
  scene-gold: "#ffcc70"
  source-link: "#286047"
  focus: "#d5a450"
  selection: "#d8e6ce"
  csv-paper: "#f9faf5"
  topic-bins: "#a57524"
  topic-rat: "#a05d51"
  topic-traffic: "#527f9a"
  topic-bus: "#70668c"
  topic-buildings: "#a36537"
  topic-audit: "#447d79"
  map-existing: "#236749"
  map-demand: "#557ca4"
  map-candidate: "#737d79"
  map-recommended: "#b67608"
typography:
  display:
    fontSize: "clamp(28px,2.5vw,42px)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-.02em"
  body:
    fontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'
    fontSize: "14px"
    lineHeight: 1.8
  title:
    fontSize: "18px"
    fontWeight: 600
  visual-title:
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.5
  scene-title:
    fontSize: "17px"
    fontWeight: 550
    lineHeight: 1.5
  action:
    fontSize: "13px"
    lineHeight: 1.5
  field:
    fontSize: "14px"
  metric:
    fontSize: "28px"
    fontWeight: 620
    letterSpacing: "-.02em"
  note:
    fontSize: "12px"
    lineHeight: 1.7
  csv:
    fontFamily: "ui-monospace,monospace"
    fontSize: "14px"
    lineHeight: 1.7
rounded:
  flat: "0"
  control: "3px"
  panel: "4px"
spacing:
  compact: "8px"
  small: "12px"
  medium: "16px"
  panel: "18px"
  large: "20px"
  section: "24px"
  wide: "30px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-outline-hover:
    backgroundColor: "{colors.subtle-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  select:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.control}"
    padding: "10px 8px"
  csv-input:
    backgroundColor: "{colors.csv-paper}"
    typography: "{typography.csv}"
    rounded: "{rounded.control}"
    padding: "12px"
  navigation-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 10px"
  evidence-badge:
    backgroundColor: "{colors.evidence-bg}"
    textColor: "{colors.evidence-text}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  visual-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
  scene-panel:
    backgroundColor: "{colors.scene-bg}"
    textColor: "{colors.scene-text}"
    rounded: "{rounded.panel}"
---

# Design System: 台北城市實驗室

## Overview

**Creative North Star: "綠色市政工作台"**

延續既有深綠導覽、帶綠白底與綠色選取訊號。畫面是檢查七題研究原型的操作空間：主要視角有細框，指標、參數與證據以留白和分隔線建立層次。這是既有識別的整理，不是新的品牌提案。

本文件從目前原始碼的樣式順序與動態內容推導。`dist/index.html` 先載入 Leaflet 樣式，再載入 `dist/styles.css`，最後載入 `dist/workspace.css`；後兩層刻意保留，新增表面須一起讀取。沒有實際瀏覽器 computed-style 取樣、桌機／手機畫面或 GPU 視覺驗證。字體解析、換行與對比不能視為已驗收。

**Key Characteristics:**
- 深綠導覽固定識別，題目色服務參數與資料辨識。
- 緊湊指標列、單一主要視角、清楚可見的保存與匯出操作。
- 主要畫面細框、小圓角；方法與明細直接放在頁面底色上。
- 真實來源、合成情境與假設範圍以文字持續揭露。

## Colors

色彩以沉穩綠色及冷白底為主；前置 tokens 保留實際 CSS 值。

### Primary
- **墨綠文字 / ink**：主要文字與主操作按鈕。
- **導覽深綠 / nav-bg**：側欄、街道基準切換的選取態與 toast。
- **植栽綠 / accent**：初始 range 與 checkbox；主要視角的選取底線固定使用此綠。參數數值輸出固定使用 ink，不隨題目 accent 改色。
- **選取淺綠 / nav-active**：目前題目與目前視角的底色。

### Secondary
- **題目色**：`app.js` 依 `registry.js` 改寫 `--accent`。依七題順序使用 accent、topic-bins、topic-rat、topic-traffic、topic-bus、topic-buildings、topic-audit；不是七套獨立品牌。
- **場景金 / scene-gold**：3D 選取、推薦、時間與焦點；不是一般頁面主按鈕色。
- **街道資料色**：map-existing 表示既有快照，map-demand 表示合成需求，map-candidate 表示候選，map-recommended 表示推薦。3D、SVG 座標圖及比較圖各有來源定義的資料色；保留 `scene-data.js`、`viz.js` 和各模型的標籤與色彩對應，不把相近顏色合併成同一意義。
- **來源連結 / source-link**：來源 dialog 中可點選的來源網址。
- **鍵盤焦點 / focus**：全域可操作元素的外框；選取文字使用 selection，游標使用 nav-bg。

### Neutral
- **工作底 / paper**：全頁底色；panel 是街道圖、圖表與表單底。
- **次要文字 / muted**：說明、單位、限制與輔助資訊。
- **分隔 / line**：主要畫面細框及工作區分隔線；outline-border 是次操作按鈕的邊框。
- **證據淺綠 / evidence-bg、evidence-text**：題目旁的資料分類標示。
- **深色場景 / scene-bg、scene-text、scene-control**：3D 畫面及其局部控制區。

**The Semantic Color Rule.** 題目 accent、頁面選取、地圖點位與模型 series 分別保留其功能，不用同一個綠色取代所有資料語意。

Sidecar 的八階 OKLCH 色帶是由前置色值推導的預覽素材，不是網站新增的配色 tokens。

## Typography

**Body Font:** CJK 優先字體堆疊，見 body token。CSV 內容使用 csv token 的 monospace；不是整個研究介面的裝飾字體。

### Hierarchy
- **Display**：題目 h1 使用 display token，窄螢幕（≤650px）為 30px，並使用 balanced text wrapping。
- **Title**：參數、明細與方法標題使用 title；主要畫面標題使用 visual-title；3D 標題使用 scene-title。
- **Body**：方法與假設使用 body；題目摘要同為 14px，行高 1.75、最長 72ch。
- **Action / Field**：操作字級 13px；一般參數與欄位 14px。原始碼沒有設定全頁 body 的固定字級或行高。
- **Metric**：數值使用 metric，≤650px 為 26px；資料表、指標與時間數字使用 tabular numerals。
- **Note / CSV**：輔助文字與 CSV 分別使用 note、csv。

目前 h1 明確指定 `"Iowan Old Style","Noto Serif TC",Baskerville,serif`，但沒有自託管 display 字體。此堆疊只記錄為既有、尚未驗證的實作，不納入可繼承的 display 字體規則；實際 CJK／拉丁解析須另做渲染查核。

## Layout

主內容最大寬度 1680px。一般桌機側欄 210px，主內容水平 padding 30px，畫面／參數為 `minmax(0,1fr) 292px`、gap 24px。指標依題目採三或四欄，沒有各自的大卡背景。方法／明細為 1.3:1 雙欄，gap 30px；上方以分隔線和 24px padding 分開。

| 條件 | 最後有效的主要版面 |
| --- | --- |
| ≥1500px | 主內容水平 padding 44px；參數欄 320px。 |
| ≤1180px | 側欄 185px；主內容水平 padding 22px；參數欄 258px、gap 18px；證據單欄。 |
| ≤900px | 側欄轉上方題目列並水平捲動；指標兩欄、gap 12px；參數欄 264px，取消 sticky。 |
| ≤650px | 主內容水平 padding 16px；主要畫面、參數依 DOM 順序單欄排列；參數控制單欄；地圖及 3D 高度 360px。 |

一般地圖及 3D 高度為 `clamp(350px,48vh,560px)`。參數欄在較寬畫面 sticky top 20px，左側 1px 分隔。頁內目的地 scroll margin 使用 20px／24px。spacing tokens 摘錄重複的 px 間距，不宣稱整站服從等比尺度。

**The Cascade Rule.** workspace.css 是有界的整理層，不是 styles.css 的替代品。基底在 1100px／850px 的部分排列與行高仍生效；上表不代表其他 media rules 已刪除。

## Elevation & Depth

自寫主要畫面和 toast 的 box-shadow 最後為 none；深度由底色、細框、區域分隔與深色 3D 內容建立。dialog backdrop 保留半透明深綠，但最終沒有 blur。Leaflet 的 zoom toolbar、popup 與 tooltip 仍保留 vendor 陰影，不能把主要表面的平面化解讀成全站陰影禁令。

Toast 僅以 opacity .2s 切換；一般按鈕沒有新增過場。`prefers-reduced-motion:reduce` 對所有元素停用 transition 並使用 auto scroll behavior。3D 播放是模型操作，不能當作裝飾進場動效。

## Shapes

主要畫面、dialog、audit 表面與 toast 使用 panel 圓角；導覽、按鈕、select 和 CSV 欄位使用 control 圓角。指標、參數、結果與方法區為平面。主要視角是 2px 底線的按鈕組，不是 pill；證據分類標示也使用小圓角。

## Components

### Buttons
主操作墨綠底白字；次操作透明底、細框；文字操作有底線。共同 padding 為 button tokens，min-height 44px。Hover 依 variant 使用 primary-hover 或 subtle-hover；文字按鈕沒有另設 hover 色。全域 focus-visible 是 3px focus 色外框、offset 4px；disabled 的 opacity .55、cursor not-allowed。3D 按鈕使用局部深綠底，選取時轉場景金。

### Chips
資料分類是非互動的 evidence-badge；字級 12px、行高 1.6、最大寬度 270px，可換行。它揭露真實點位與假設情境的關係，不當作宣傳標語。

### Cards / Containers
地圖、3D、比較圖是細框主要容器，heading padding 16px 18px；3D 使用自己的深色邊框。結果與方法區無卡片背景。CSV 健檢仍保留平面小圓角表面。

### Inputs / Fields
select 最小高度 44px；CSV textarea 可垂直調整、最小高度 145px（契約欄 95px）。參數 range 使用當題 accent、最小高度 30px，配合 ink 色數值與上下界。Checkbox 為 16px。焦點沿用全域外框；沒有建立新的錯誤或 disabled 欄位視覺 variant。

### Navigation
桌機題目連結 min-height 48px、字級 14px、小圓角；當前題目淺綠底、墨綠字、weight 600，並保留 aria-current。≤900px 改成水平題目列、min-height 44px、字級 13px。頁內操作捷徑使用底線文字按鈕，只移動閱讀位置。

### Main View Switch
以 aria-pressed 表達地圖／3D／圖表，min-height 48px；選取淺綠底、固定綠色底線。一次呈現一個主要視角，切換共用參數與結果。地圖可把同一點位送往 3D；資料健檢不提供街道地圖。WebGL 2 不可用時退回圖表，街道入口仍依題目能力保留。

## Do's and Don'ts

### Do:
- **Do** 同時讀取基底與 workspace 整理層，依實際 cascade 延伸樣式。
- **Do** 保留資料分類、來源、基準與假設文字，以及每個資料色的既有語意。
- **Do** 使用可見鍵盤焦點與原生語意控制，讓保存、重設與匯出保持可辨識。
- **Do** 在窄螢幕保持主要畫面先於參數的閱讀順序。

### Don't:
- **Don't** 把指標、方法與明細重新包成重複的大卡片。
- **Don't** 將 preview tonal ramps 當作已部署的配色或已驗證的對比組合。
- **Don't** 把 source-derived CSS 值、DOM stub 或自動測試當成桌機／手機／GPU 視覺驗收。

**Not canonized:** 基底仍含隱藏 kicker／eyebrow 樣式、部分 Unicode 操作／方向 glyph、9–10px 場景標籤及未自託管的 display 字體堆疊。這些是既有實作與待驗證項，不是未來表面的建議；本次僅記錄，沒有越界修復。

## 參賽主線入口
2026-10-14，使用者確認以第二題垃圾桶／清潔箱配置為主要比賽題目。無有效題目 hash 的首頁與品牌連結預設進入 `#bins`。導覽先呈現此題並加上「參賽主題」文字；原題號 02 保留，其餘六題的有效深連結仍可開啟。字級與綠色識別延續既有系統，模型數值與合成／實測來源界線不因入口調整而改變。
