---
version: 1
slug: "dist-index-html"
primary_target: "dist/index.html"
related_targets: ["dist/app.js","dist/styles.css","dist/workspace.css"]
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
Code-led；沒有 approved comp 或新增裝飾圖片。現有地圖、模型圖及 Three.js 是內容本身。Browser js 工具與受支援的遠端預覽未暴露，無法取得桌機／手機截圖；完成原始碼、行為、資產與宣告色彩驗證，不將它們宣稱為視覺驗收。
