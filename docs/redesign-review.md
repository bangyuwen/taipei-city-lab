# 2026-10-14 市民探索重新設計

使用者確認主要受眾為一般市民，並選擇城市專刊方向：深藍、暖白、朱橘；保留七題模型、真實來源與合成情境界線。

## Impeccable

使用專案安裝的官方 4.5.2 技能。context 啟動第一次因預設快取不可寫而未執行，依技能 fallback 直接讀取現有專案脈絡；改用工作區快取載入 engine 0.1.14。concept-seed 產生 seed 0f3e9d23，第五個自建方向為城市專刊。線上 roll 與參考庫無法連線，網路啟用後重試仍退化，因此没有 catalog challengers 或 quality boards；使用者透過結構化問題明確選定方向。Operate 使用 code-led。

## 單次 detector

在 UI 完整實作後，對 index.html、app.js、styles.css、workspace.css 執行一次官方 detect --json。初始輸出包含 hover 文字對比 4.1:1、與舊 DESIGN.md 不同的字體／配色／圓角／字級，以及暖白底色警告。輸出在工具中被截斷，未保留完整 JSON；此記錄不宣稱完整機械清單。朱橘互動 token 已調深為 #ae432c：對 hover 底色 #ece9e2 為 4.76:1，白字對按鈕為 5.77:1。暖白與字體是使用者確認的重新設計方向；新 DESIGN.md 由最後的 documenter 記錄。依技能不重跑 detector。

## 字體

Google Fonts 官方 Noto Serif TC 以 SIL OFL 1.1 授權。將 weight 700 的當前中文 display 標題字形轉為 16 KB 的自託管 WOFF，OFL 與來源 SHA 另附於 dist/fonts。不是遠端 stylesheet 或系统字體替代品。

## 驗證界線

首次設計交付只有 Node DOM stub、靜態及資產檢查，缺少桌機／手機截圖，獨立 finish reviewer 回覆 recapture；該次結果不是視覺出貨判定。

後續 PR 驗收已使用本機 Chromium 捕捉真實桌機、平板、手機畫面，完成九組互動、鍵盤、合成觸控及軟體 WebGL 檢查；已修復表格焦點、手機欄位／點擊尺寸與 Leaflet 卸載後 callback。結果與圖磚驗收工具修正見 `docs/acceptance.md`，最新獨立判定見 `docs/citizen-finish-review.md`。此證據不代表實體手機、Safari／Firefox、硬體幀率或完整 WCAG 認證。

## 行為與來源檢查

更新後 14 個 Node 測試檔通過，包含兩項新增的市民情境／導覽回歸。npm run check 通過七題模型的預設、上下界、來源、產生圖表與靜態資產檢查。宣告 CSS 的所有 URL 均有本機資產，當前 display 標題未缺字。

整合測試原本仍預期 fallback 為 shade，但既有公開版本已以 bins 為預設；此次将斷言對齊已存在的入口約束。響應式檢查也改讀實際載入的兩份樣式表，使用新的手機 breakpoint。沒有改寫資料計算測試來遷就新介面。

## 發布工作流

選定既有公開 Site，保留 project_id 與觀眾。此環境未掛載 Sites source helper；以受控的等效 Git 流程從原 Site source repository 取得精確 checkout。短效寫入 credential 只在記憶體與隱藏 stdin 傳遞，未放入來源、命令參數或檔案。部署封裝只包含 hosting manifest 與 dist；公開原始碼 ZIP 排除內部 surface direction contract、選擇頁狀態及 finish review。
