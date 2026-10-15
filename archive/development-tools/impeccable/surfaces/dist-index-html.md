---
version: 1
slug: "dist-index-html"
primary_target: "dist/index.html"
related_targets: ["dist/app.js","dist/answers.js","dist/styles.css","dist/workspace.css","dist/viz.js","dist/map-ui.js","dist/geo.js","dist/basemap3d.js","dist/scene-data.js","dist/scene-builder.js","dist/scene-ui.js","dist/fonts/provenance.json"]
---

# 台北城市實驗室 — 城市研究專刊

## Visitor mode
Read。一般市民閱讀城市研究答案；研究者提出可支持的結論、比較依據與證據缺口。使用者於 2026-10-14 澄清「不是要給他們體驗要設在哪，我們是要找答案的」，並授權實作。原生導覽、來源與研究工具供後續查核，沿用已選城市專刊。

## Scope
當前契約為答案優先延伸：七題結論 → 依據與缺口 → 條件式答案與同條件比較 → 折疊完整研究工具。保留七題模型、資料、有效深連結、本機保存、來源與匯出；參數調整供查核，不替代研究者回答。根目錄仍預設清潔箱題，#explore 顯示研究入口。這是既定世界的 code-led 延伸，沒有新訪談、世界替換、comp 或 QUALITY BAR。

## Direction contract
- THESIS：先交付支持得住的結論與證據缺口，再讓讀者查核模型；真實觀測、官方配置原則與條件式模型分開表達。
- OWN-WORLD：深藍導覽、暖白工作區、朱橘選取訊號；自託管思源宋體標題，中文無襯線操作文字。清楚的平面分隔、圓角原生控制。
- STORY：讀建議 → 查真實快照與官方依據 → 看尚缺證據 → 展開條件式比較 → 查地圖、參數、方法或匯出。
- FIRST VIEWPORT：桌機保留深藍題目導覽與暖白閱讀面；首頁短篇入口接目前題目、資料分類與研究結論，題目深連結直接接題目與結論。手機收合導覽、隱藏重複入口補述，結論標題位於首個視窗內。依據／缺口先雙欄後單欄；模型指標、地圖與參數放入預設關閉的原生研究工具 details。
- FORM：七個既定方向依序為臺北交通導引、里民公告、田野讀本、公園解說牌、城市專刊、展覽目錄、公共圖書館索引。沿用使用者於 2026-10-14 選定的第五項城市專刊及 seed 0f3e9d23；原輪線上服務無法連線，沒有 challengers。本次 signature interaction 是同條件新增數量比較，以及可匯出的結論／證據／目前參數；模型與實際建議保持分開。
- FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Build and verification
當前 code-led Read 完成品為 dist/index.html、dist/app.js、dist/answers.js、dist/styles.css 及字體 provenance；workspace 與地圖實作繼續沿用既定世界。沒有 approved comp、decision comp、外部 QUALITY BAR 或新增 shipping raster。

.impeccable/review/answers/results.json 記錄 1440／390／320px 共 28 張 exact PNG、六個 runtime／font／provenance 雜湊，文件同步時均已核對相符；23 項答案流程 checks、零 pageErrors。126 Node tests、靜態檢查與 legacy browser regression 已報告通過，documenter 未重跑。初輪完整 finish-review.md 的 disposition 為 fix；最新 verdict.md 為 ship，只把唯一「CSV 或查核條件變更後的主答案失效化」修正評為 resolved，remaining clear，並保留本批回歸範圍。這不是全站認證，也不是資料已能回答實際研究問題的認證。

本次只涵蓋本機 Chromium／SwiftShader、模擬觸控；外部圖磚被阻擋，workbench captures 是 2D 比較圖。不宣稱實體裝置、其他瀏覽器、效能或實際選址結論成立；不沿用歷史圖磚成功來宣稱本次畫面驗收。

## Historical citizen Operate build
最初 Operate 表面以生活提問、一鍵情境、地圖與參數同步為主；這段是歷史記錄，當前目的與閱讀次序以上方 Read 契約為準。該次 code-led 沒有 approved comp 或新增裝飾圖片。現有地圖、模型圖及 Three.js 是內容本身。後續 PR 驗收取得桌機1440、平板850、手機390／320的本機 Chromium captures 與九組實際操作檢查，包含鍵盤及合成觸控；有效街道底圖曾目視確認，結果見 docs/acceptance.md 與 .impeccable/review/final-results.json。SwiftShader 軟體 WebGL 與模擬手機不等於實體裝置／Safari／Firefox／硬體幀率驗證；該批獨立 finish reviewer 判定見 docs/citizen-finish-review.md。

## Continuous city map extension（歷史與保留規則）
使用者指出「為什麼你一直給我方的地圖」。2026-10-14 的延伸沿用一般市民、城市專刊、code-led Operate 與 seed 0f3e9d23 的既定方向；不重選 OWN-WORLD 或 FORM，也沒有可用的外部 comp／QUALITY BAR。

街道地圖與四個地理題的 3D 以具 attribution 的 OSM 街道持續延伸。3D 按相機可見地面載入圖磚，移除地理厚底座、格線與四區標籤；背景的取景邊緣不再代表資料邊界。模型 bbox、推薦座標、公尺半徑及全部計算保持原值。原始範圍持續列於說明，「模型計算範圍」是預設關閉的獨立圖層；3D 啟用時立即切到依目前視窗長寬比容納全範圍的俯視。北向 SVG 隨相機旋轉，文字標示以暖白底與深藍字保持可讀。

清潔箱 3D 的既有／候選／推薦採固定螢幕尺寸、白色外緣的 Sprite 圓點，延用現有 map-existing／map-candidate／map-recommended 層色；控制列提供對應圓形圖例。四個地理題的目前記錄共用持續的朱橘選取環，獨立於資料圖層；聚焦、平移、縮放與 resize 不改變資料座標。context-ground 是地理 3D 載入空隙的中性底，map-selection 沿用互動朱橘值並獨立標示選取語意。32×32 DataTexture 是原始碼程序產生的標記幾何，沒有新增 shipping raster 檔案。交通、公車及資料健檢保持示意圖，研究模型與原始資料未變。

初輪完整獨立審查保留於 .impeccable/review/city-map/finish-review.md，兩項 material fixes（點位層次／選取、手機範圍呈現）的獨立 Verdict Pass 見同目錄 verdict.md：1440／390／320px 共 36 張最新 captures 與七個 runtime 雜湊均符合目前 results.json，兩項均 resolved、remaining clear、disposition ship，未發現本批補修造成的 material regression。此 ship 僅涵蓋兩項補修及該批受測回歸，不是新的全表面審查；前次 citizen ship 與本次判定分別保留各自範圍。實作與驗證紀錄見 docs/city-map-acceptance.md；仍限本機 Chromium 154／SwiftShader 與模擬觸控，不涵蓋其他瀏覽器、實體裝置或硬體效能。原有 map-detect.json 的 16 項 advisory-only 色彩／字級偏離保留，未重跑 detector 或修正無關偏離。


## Answer-first research extension（當前）
使用者於 2026-10-14 澄清：不是讓市民體驗選址，而是我們找答案。新版 mode 為 Read，沿用既定城市專刊、深藍／暖白／朱橘、seed 0f3e9d23 和 code-led；不重選視覺世界。

THESIS：先交付支持得住的結論與證據缺口，再讓讀者查核模型。STORY：讀建議 → 查真實快照與官方依據 → 看尚缺證據 → 展開條件式比較或研究工具。FIRST VIEWPORT：短篇入口、題目與研究結論；手機收短重複入口文字，結論標題在第一個視窗內。signature interaction 是同條件數量比較與可匯出的結論／證據／參數，模型與實際建議分開。

新的 dist/answers.js 保存經查核的官方配置說明、行政區快照加總與固定非預算條件的模型比較。外部資料目錄不當作已載入觀測。研究 workbench 為原生 details、預設關閉；全部原有研究功能保留。QUALITY BAR 與 approved comp 均無新增，本次不新增 shipping raster；新增字形沿用原本 Noto Serif TC 700 與 OFL。FINISH 延用獨立 reviewer 與 documenter；最新畫面證據置於 .impeccable/review/answers/，不擴張歷史 citizen／city-map ship 的範圍。

清潔箱在結論與缺口後提供 0／5／10／20 及目前上限的比較，只改新增數量，其他條件沿用目前值；合成需求與同質清運工時限制緊鄰表格。窄螢幕比較表保留局部左右捲動與說明。來源／日期、條件式答案與完整研究工具使用各自的 native details，不要求市民先操作才取得答案。此題 JSON 匯出讀取當前可見結論、資料界線及模型參數；七題研究包、CSV 明細與原有保存／分享繼續提供。

資料健檢已完成的主答案在 CSV、問題、基準日、時區或資料契約變更後，立即撤回舊計數與完成狀態，改為待重新檢查文字；此題匯出同步該待查狀態。這一項行為補修沒有引入新視覺 token，最新 ship 範圍見上方 Build and verification。既有 detector advisories 只保留證據，不重跑或提升為新規則。
