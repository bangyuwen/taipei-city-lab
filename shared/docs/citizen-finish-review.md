disposition: ship

範圍：本次是同一審查的 Verdict Pass，僅評分初輪的兩項 material fixes，並檢查該修正批次引入的回歸；本次 ship 僅涵蓋已評分的兩項修正，不是全表面的重新核准。初輪完整五節保留於下方歷史區，當時的 contradicted／fix 不代表修正後仍未解決。

合併前後續 GitHub P2 標題層級補修另由 docs/acceptance.md 與 .impeccable/review/heading-results.json 記錄；下列 Impeccable Verdict Pass 保留為前一輪的兩項修正結論，不涵蓋該後續語意補修。

## verdict

| 原 material fix | 評分 | 本次直接檢視的證據 |
| --- | --- | --- |
| 1. 手機結果圖的軸值、分區／時間標籤過小 | resolved | desktop-chart.png、mobile-chart.png、mobile-320-chart.png 的軸值與四分區標籤清楚可讀，手機採換行而未重疊或裁切；mobile-traffic-chart.png 的 320px 折線圖保留完整首尾時間及可讀軸值。原同名 mobile.png、mobile-bins.png、mobile-3d.png、mobile-320.png 全頁也實際呈現修正，沒有僅在補充 crop 放大。desktop-traffic.png 的折線圖與桌面／平板柱狀圖標籤亦未重疊或裁切。源碼依 container 寬度重建 viewBox 並回應 ResizeObserver；final-results.json 的實際字級為 desktop 14px、390px 約 13.91px、850px 約 13.95px、320px 約 13.89px，與直接目視一致。 |
| 2. 來源／外連使用字形箭頭且站內來源按鈕誤示外連 | resolved | desktop-sources.png 與 mobile-sources.png 的「開啟原始來源」顯示一致的 SVG 外連圖示；原桌面／手機全頁的來源按鈕已沒有外連箭頭，底圖回報使用相同 SVG 語彙。app.js 使用 topicIcon('external') 於真正原始來源／案例外連，data-source 按鈕保留文字；map-ui.js 回報底圖問題採相同 24-unit SVG path。原列項的 Unicode「↗」已移除，未用其他字形替代。 |

Check 0：已重新逐張開啟原 17 張同名捕捉及六張補充捕捉，共 23 張。檔案皆可解碼、尺寸符合完整頁面／viewport／補充 crop 的用途，完整頁面頂端可見；真實台北底圖及 3D 情境有效，未再出現拒絕圖片、缺圖或黑屏。此步只驗證證據與修正保留，不新增完整表面審查項目。

修正批次的回歸：未見。完整捕捉仍保留入口、導覽、地圖／3D、參數、比較、明細及方法閱讀順序，圖表增加可讀高度後沒有覆蓋相鄰內容。

## remaining

clear（僅上述兩項修正及該批次的回歸範圍）。

本機 PR dist build、Headless Chromium 154、SwiftShader 軟體 WebGL 與模擬手機／CDP touch 的原限制維持。final-results.json 的九組操作通過且 page errors、failed requests、HTTP errors 為零；aXe 兩個頁面零 violations，仍有 incomplete。這不涵蓋實體 iOS／Android、Safari／Firefox、硬體 FPS、生產遠端完整操作或全站 WCAG 認證；reviewer 未啟動 browser 或自行重跑測試。DESIGN.md／design.json 的驗證敘述應由 documenter 同步本次局部 verdict 及初輪完整審查範圍。

<details>
<summary>初輪完整五節審查（歷史判定：fix；兩項列項已由上方 verdict 評分）</summary>

disposition: fix

輸入／未讀：本案是使用者明確選定城市專刊的 code-led Operate；沒有 approved comp、decision comp 或 QUALITY BAR boards，屬已記錄的降級範圍，不構成缺失。已逐張開啟全部 17 張新捕捉；程式只抽查主要樣式、圖表、導覽、情境、來源與生命週期，未逐行讀完 app.js、styles.css、workspace.css、map-ui.js、scene-ui.js 或 design.json 的全部衍生資料。

## persistence

pass（產品與視覺持久化）；最終視覺出貨仍受 material_fixes 阻擋。

- PRODUCT.md 存在，記錄一般市民、七題、清潔箱預設入口、繁體中文、深連結、本機 CSV／保存／分享，以及真實快照和合成推估的界線。
- DESIGN.md 與 .impeccable/design.json 的城市專刊、字體、配色、控制及資料系列語意符合目前畫面；其中「尚無 captures／仍 recapture」等驗證文句尚未更新，依交付安排由 documenter 在此次審查及後續 verdict 後同步。Code-led 不要求 comp-led 的 state、spec 或 comp-diff。
- Check 0 通過：desktop.png、mobile.png、desktop-first.png、mobile-first.png、desktop-bins.png、desktop-bins-first.png、mobile-bins.png、mobile-bins-first.png、desktop-3d.png、desktop-3d-first.png、mobile-3d.png、desktop-traffic.png、desktop-audit.png、mobile-audit.png、tablet-bins.png、mobile-menu.png、mobile-320.png 全部存在且已目視檢查。各 full-page 頂端可見；寬度 1440／850／390／320 符合命名及測試裝置。地圖顯示真實台北街道、地名與模型點位，未再出現 OSM「Access blocked / 418」。3D 的深藍背景及交通早時段的零排隊是有效內容，並非黑屏或缺圖。
- 驗收範圍是目前本機 PR dist build。final-results.json 的九組 Chromium 功能檢查通過，errors、failed_requests、http_errors 為空；四寬度沒有文件水平溢出，自託管標題字體已載入。aXe 僅涵蓋 desktop root 及 mobile bins，零 violations 但仍有 incomplete，不代表全站 WCAG 認證。本 reviewer 未啟動瀏覽器或自行重跑功能測試。
- Headless Chromium 154、SwiftShader 軟體 WebGL、模擬手機／CDP touch 的證據不涵蓋實體 iOS／Android、Safari／Firefox、硬體 FPS 或生產遠端完整操作。QA HTTPS relay 保留實際瀏覽器 User-Agent、localhost Referer 與 Accept；維持 OS CA／TLS 驗證，未冒用 production origin 或改持久信任。

## fidelity

依 OWN-WORLD、使用者答案及產品事實審查；沒有 comp 的像素重現或資產承諾。

| 元素 | 判定 | 可見證據與依據 |
| --- | --- | --- |
| TYPE：display 字體 | match | 入口與題目為粗宋體，字形筆畫有襯線及粗細反差；無襯線負責操作與資料。標題與正文的尺度明確，自託管字體載入證據與畫面一致。 |
| MATERIAL | match | 工作區及導覽採平面色塊、細分隔；實際 OSM 圖磚與 Three.js 幾何承載產品內容。沒有用 CSS 浮雕、紙紋或假材質冒充實物。 |
| GROUND | match | desktop-first.png 與 mobile-first.png 的空白頁面區實際像素皆為 RGB 243,241,235（#f3f1eb），符合使用者選定暖白與契約；未把資料底圖本身的綠色誤判成背景偏移。 |
| 主結構與閱讀順序 | match | 桌面左側七題導覽；正文先生活問題、探索提示、指標，再進入畫面及右側參數；比較、明細與方法接續其後。 |
| 手機／平板重排 | adaptation | FIRST VIEWPORT 明定手機折疊導覽、畫面先於參數。390／320px 為單欄，850px 保留題目索引並將參數移至畫面後；手機選單為可讀的兩欄七題，沒有覆蓋正文。 |
| 入口標題與主動作 | match | 「台北的日常，還有別的可能。」的深藍／朱橘雙行標題、生活提問與朱橘「先看看垃圾桶怎麼放」建立第一屏的可記憶內容；主動作可辨認。 |
| 情境提示與 signature move | match | 生活問題下直接提供「先增設 5 個」「多顧服務缺口」等情境，並提示推薦仍須現勘；「回到起點」保留恢復方式。動態更新及重設以九組操作證據支持。 |
| 指標與漸進揭露 | match | 四項主指標以規線分組，不再包成重複卡片；其餘指標及進階參數可展開。數值、單位、真實快照／需求服務率標籤均可分辨。四指標是 FIRST VIEWPORT 的明確產品要求。 |
| 視角與原生控制 | match | 街道地圖／3D／比較圖表的目前狀態以朱橘底線及底色標示；select、checkbox、range、CSV 與日期欄位維持熟悉操作。手機欄位 16px，圖層 label 及地圖 zoom 的觸控區為 44px。 |
| 地圖資料系列與 3D 控制色 | adaptation | 綠／琥珀點位、OSM 多色底圖及深藍場景的琥珀選取保留資料語意及深色對比，依 PRODUCT 的真實／合成分類及 DESIGN 的 Semantic Color Rule，不將主品牌朱橘覆蓋所有系列。 |
| 比較圖的手機軸值與分區標籤 | contradicted | mobile.png、mobile-bins.png、mobile-3d.png、mobile-320.png 的結果圖軸值與分區名已縮至無法正常閱讀。chartSVG 固定 760-unit viewBox，styles.css:67 的 11px SVG text 隨圖寬一起縮放，390px 下約 4–5px，320px 更小；14px 圖例與說明沒有恢復軸標籤。 |
| 明細表 | adaptation | 手機明細在局部捲動容器中保留欄位而非造成整頁溢出，依完整研究功能及鍵盤使用需求；tableHTML 有 tabindex、region label 與可見 focus 樣式，鍵盤捲動有真實操作證據。 |
| 來源／外連圖示 | contradicted | app.js:107、210 與 map-ui.js:14 使用字形「↗」作來源／外連圖示，未延續導覽的 SVG 系統；data-source 按鈕實際開啟站內來源 dialog，箭頭卻提示外連。違反 craft-floor 的 glyph-icon 拒絕項與操作提示一致性。 |
| 方法、限制及空狀態 | match | 垃圾桶的合成需求、直線半徑及現勘限制，交通的固定合成到達量與非實際預測，CSV 的本機處理、資料粒度、缺漏與重複均有明示。Audit 的無圖表狀態提供下一步；不冒稱現場成效或安全評級。 |

契約逐項：THESIS 的日常提問與可操作題目清楚；OWN-WORLD 的深藍、暖白、朱橘、宋體與平面分隔成立；STORY 的選題→提示→畫面→條件→比較→方法／来源／匯出成立，但手機比較閱讀受上述圖表問題阻擋；FIRST VIEWPORT 的題目索引、入口、資料分類、主要指標及工作區順序成立，根頁第一屏的實際地圖在下方，工作區入口在桌面首屏底緣，手機以單欄及三個跳轉提供導引，沒有把「首屏已見完整地圖」當作驗證結論；FORM 含 seed 0f3e9d23，與原 packet 及 redesign-review 的概念產生記錄相符，使用者已明確採第五項城市專刊。

Truth／floor：未發現未標示合成的商業或政策成效宣稱；沒有新增裝飾 raster、被埋藏素材或應製作而未製作的 plate。畫面沒有可見 kicker／eyebrow、漸層文字、側邊粗彩條、硬偏移陰影、系統 display face 或假手繪圖片；來源箭頭字形是仍需修正的明確 floor 項。原 detector 的 hover contrast 已修為 4.76:1，白字朱橘按鈕為 5.77:1；暖白與舊綠色系統的 drift 是使用者授權方向。官方 detector 完整輸出未保存，本 reviewer 不宣稱機械清單完整，亦未重跑 detector。

## ceiling

城市專刊的宋體標題、薄規線、索引導覽、主／輔色分工及方法長文已投入使用；未使用跨欄攝影、紙面質感或高密度裝飾，契約沒有要求這些素材。沒有可用 QUALITY BAR card，不能宣稱達到外部 board 的品質上限；目前阻擋完成度的是手機結果圖的字級與來源圖示，無須改換視覺方向或重建頁面。

## material_fixes

1. Check 2／STORY／手機閱讀：修正 chartSVG 的響應式繪圖與標籤配置，讓 390px 及 320px 的實際軸值、時間／分區標籤保持可讀（以至少約 12px 實際顯示字級驗收），必要時減少時間刻度或換行；維持同模型及同尺度比較。不能只放大圖例／caption。重拍原路徑 mobile.png、mobile-bins.png、mobile-3d.png、mobile-320.png 並確認 desktop 的 bar／line chart 沒有標籤重疊或裁切。
2. Check 6／操作真實性：將 app.js:107、210 與 map-ui.js:14 的「↗」圖示字形改為一致的 SVG；開啟來源 dialog 的 data-source 按鈕移除外連提示或使用正確來源圖示，真正外連使用現有 SVG 外連語彙。確認桌面／手機來源入口、底圖回報及方法外連的文字與圖示行為一致；不需產生新 raster。

## keep

保留生活提問、醒目宋體與朱橘主動作、平面閱讀層次、七題／深連結／原生控制，以及持續可見的真實快照、合成情境與推估限制。

</details>

disposition: ship
