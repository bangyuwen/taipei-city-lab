---
version: 1
slug: "dist-index-html"
primary_target: "dist/index.html"
related_targets: ["dist/app.js","dist/styles.css","dist/workspace.css","dist/map-ui.js","dist/geo.js","dist/basemap3d.js","dist/scene-data.js","dist/scene-builder.js","dist/scene-ui.js"]
---

# 台北城市實驗室 — 市民探索介面

## Visitor mode
Operate。一般市民從生活問題探索情境；原生導覽、視角切換與表單維持熟悉的操作方式。使用者確認重新設計整套視覺，選擇城市專刊方向。

## Scope
重做整站視覺與資訊層次，加入生活化入口、情境提示與漸進揭露。保留七題模型、資料、深連結、本機保存、來源及匯出。根目錄仍預設清潔箱題；新增 #explore 只提供公眾入口。

## Direction contract
- THESIS：用日常提問引導市民比較城市方案，第一眼辨認探索題目與可操作的地圖。
- OWN-WORLD：深藍導覽、暖白工作區、朱橘選取訊號；自託管思源宋體標題，中文無襯線操作文字。清楚的平面分隔、圓角原生控制。
- STORY：選一個生活問題 → 讀探索提示 → 查看地圖 → 試改條件 → 看同條件比較 → 查方法、來源或匯出。
- FIRST VIEWPORT：左側題目導覽，上方短篇市民入口；目前題目、資料分類與四項主要指標接續出現。下方地圖與右側方案參數構成主要工作區，其他指標与進階參數可展開。手機將導覽折疊，工作區先畫面後參數。
- FORM：七個方向依序為臺北交通導引、里民公告、田野讀本、公園解說牌、城市專刊、展覽目錄、公共圖書館索引。採第五項城市專刊；seed 0f3e9d23，線上服務無法連線，沒有 challengers。使用者於 2026-10-14 明確選擇此方向。signature move 是生活問題旁直接試一種情境，地圖、指標與控制同時更新，保留可回復起點。
- FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Build and verification
Code-led；沒有 approved comp 或新增裝飾圖片。現有地圖、模型圖及 Three.js 是內容本身。後續 PR 驗收已取得桌機1440、平板850、手機390／320的本機 Chromium captures 與九組實際操作檢查，包含鍵盤及合成觸控；有效街道底圖已目視確認，結果見 docs/acceptance.md 與 .impeccable/review/final-results.json。SwiftShader 軟體 WebGL 與模擬手機不等於實體裝置／Safari／Firefox／硬體幀率驗證；最新獨立finish reviewer判定見 docs/citizen-finish-review.md。

## Continuous city map extension
使用者指出「為什麼你一直給我方的地圖」。2026-10-14 的延伸沿用一般市民、城市專刊、code-led Operate 與 seed 0f3e9d23 的既定方向；不重選 OWN-WORLD 或 FORM，也沒有可用的外部 comp／QUALITY BAR。

街道地圖與四個地理題的 3D 以具 attribution 的 OSM 街道持續延伸。3D 按相機可見地面載入圖磚，移除地理厚底座、格線與四區標籤；背景的取景邊緣不再代表資料邊界。模型 bbox、推薦座標、公尺半徑及全部計算保持原值。原始範圍持續列於說明，「模型計算範圍」是預設關閉的獨立圖層；3D 啟用時立即切到依目前視窗長寬比容納全範圍的俯視。北向 SVG 隨相機旋轉，文字標示以暖白底與深藍字保持可讀。

清潔箱 3D 的既有／候選／推薦採固定螢幕尺寸、白色外緣的 Sprite 圓點，延用現有 map-existing／map-candidate／map-recommended 層色；控制列提供對應圓形圖例。四個地理題的目前記錄共用持續的朱橘選取環，獨立於資料圖層；聚焦、平移、縮放與 resize 不改變資料座標。context-ground 是地理 3D 載入空隙的中性底，map-selection 沿用互動朱橘值並獨立標示選取語意。32×32 DataTexture 是原始碼程序產生的標記幾何，沒有新增 shipping raster 檔案。交通、公車及資料健檢保持示意圖，研究模型與原始資料未變。

初輪完整獨立審查保留於 .impeccable/review/city-map/finish-review.md，兩項 material fixes（點位層次／選取、手機範圍呈現）的獨立 Verdict Pass 見同目錄 verdict.md：1440／390／320px 共 36 張最新 captures 與七個 runtime 雜湊均符合目前 results.json，兩項均 resolved、remaining clear、disposition ship，未發現本批補修造成的 material regression。此 ship 僅涵蓋兩項補修及該批受測回歸，不是新的全表面審查；前次 citizen ship 與本次判定分別保留各自範圍。實作與驗證紀錄見 docs/city-map-acceptance.md；仍限本機 Chromium 154／SwiftShader 與模擬觸控，不涵蓋其他瀏覽器、實體裝置或硬體效能。原有 map-detect.json 的 16 項 advisory-only 色彩／字級偏離保留，未重跑 detector 或修正無關偏離。
