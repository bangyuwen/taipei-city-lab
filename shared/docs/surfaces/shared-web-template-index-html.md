---
version: 1
slug: "shared-web-template-index-html"
primary_target: "shared/web/template/index.html"
related_targets: ["shared/web/template/app.js","shared/web/template/answers.js","shared/web/template/styles.css","shared/web/template/workspace.css","shared/web/template/viz.js","shared/web/template/map-ui.js","shared/lib/geo.js","shared/web/template/basemap3d.js","shared/web/template/scene-data.js","shared/web/template/scene-builder.js","shared/web/template/scene-ui.js","shared/web/template/fonts/provenance.json"]
---

# 台北城市實驗室 — 城市研究專刊

## Visitor mode

Read。一般市民閱讀城市研究答案；研究者提出可支持的結論、比較依據與證據缺口。使用者於 2026-10-14 澄清「不是要給他們體驗要設在哪，我們是要找答案的」。原生導覽、來源與研究工具供後續查核，沿用已選城市專刊。

## Scope

這份契約適用於 `shared/web/template/` 共用介面，以及由它生成的整合站與六個題目站。垃圾箱獨立站延續自己的地圖、撤除歷史與桶型體驗，不由此契約替換其介面。

閱讀順序為研究結論 → 依據與缺口 → 條件式答案與同條件比較 → 折疊完整研究工具。保留題目模型、資料、有效深連結、本機保存、來源與匯出；參數調整供查核，不替代研究者回答。整合站以清潔箱為預設題目，`#explore` 顯示研究入口；獨立題目站只呈現本題。

## Direction contract

- THESIS：先交付支持得住的結論與證據缺口，再讓讀者查核模型；真實觀測、官方配置原則與條件式模型分開表達。
- OWN-WORLD：深藍導覽、暖白工作區、朱橘選取訊號；自託管思源宋體標題，中文無襯線操作文字。清楚的平面分隔、圓角原生控制。
- STORY：讀建議 → 查真實快照與官方依據 → 看尚缺證據 → 展開條件式比較 → 查地圖、參數、方法或匯出。
- FIRST VIEWPORT：桌機保留深藍題目導覽與暖白閱讀面；首頁短篇入口接目前題目、資料分類與研究結論，題目深連結直接接題目與結論。手機收合導覽、隱藏重複入口補述，結論標題位於首個視窗內。依據／缺口先雙欄後單欄；模型指標、地圖與參數放入預設關閉的原生研究工具 details。
- FORM：沿用使用者於 2026-10-14 選定的城市專刊及 seed `0f3e9d23`。主要互動是同條件新增數量比較，以及可匯出的結論／證據／目前參數；模型與實際建議保持分開。Read 表面由程式實作其閱讀與查核功能。

## Research behavior

`shared/web/template/answers.js` 保存官方配置說明、行政區快照加總與固定非預算條件的模型比較。外部資料目錄不當作已載入觀測。研究工具使用預設關閉的原生 details，來源／日期、條件式答案及完整研究工具各自揭露；不要求市民先操作才取得答案。

清潔箱模型在結論與缺口後提供 0／5／10／20 及目前上限的比較，只改新增數量，其他條件沿用目前值；合成需求與同質清運工時限制緊鄰表格。窄螢幕比較表保留局部左右捲動與說明。此題 JSON 匯出讀取當前可見結論、資料界線及模型參數；研究包、CSV 明細與原有保存／分享繼續提供。

資料健檢的 CSV、問題、基準日、時區或資料契約變更後，立即撤回舊計數與完成狀態，改為待重新檢查文字；此題匯出同步該待查狀態。資料健檢站的跨題來源僅為目錄，原題已載入觀測不等於本站載入那些觀測。

地理背景連續延伸供定位，點位與公尺範圍固定於模型投影。資料層、目前選取及模型計算範圍各自保持語意；周邊街道不擴大研究資料。交通、公車及資料健檢的 3D 維持示意圖及其資料界線。

## Maintained sources

入口、樣式與互動由 `shared/web/template/index.html`、同目錄的 `app.js`、`answers.js`、`styles.css`、`workspace.css` 及相關場景檔案維護。地理投影由 `shared/lib/geo.js` 維護；各題模型在 `topics/<id>/model.js`。字體授權與來源保留於 `shared/web/template/fonts/`。本契約記錄目前介面意圖，不保存歷史畫面驗收或測試結果。
