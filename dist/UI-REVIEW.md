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

---

# 2026-10-14 市民介面驗收

驗收對象為 PR #1 的本機 `dist/`；沿用一般市民與城市專刊方向，檢查生活提問、七題導覽、街道地圖、3D、方案操作及資料健檢。初輪完整 Impeccable 審查找到圖表與外連圖示兩項問題；修正後的 Verdict Pass 均評為 resolved、remaining clear、disposition ship。該 ship 僅評分兩項修正，不是重新全面審查；完整紀錄見 `citizen-finish-review.md`。

## 已修正

- 推薦明細原本無法以鍵盤進入並捲動；捲動區現在有可聚焦的 region、名稱與可見焦點，ArrowDown 可捲動。
- 手機地圖縮放及圖層標籤改為至少 44px 高；選題／提問 16px、欄位 16px、輔助說明至少 14px，方法與來源正文 16px。
- 圖表依容器寬度重排，SVG 軸值／分區標籤為 14px；手機實際量測約 13.9px，長分區名換行，時間圖首尾留出標籤空間，支援視角顯示及 resize。
- 真正外連採同一套 SVG；開啟站內來源對話框的按鈕移除外連箭頭。
- Leaflet 1.9.4 在地圖卸載時可能留下 Canvas redraw callback，切換到交通 3D 曾讀取已銷毀的 `_ctx` 而拋出 TypeError。本機 renderer 對卸載後的 callback 加入生命週期防護；沒有修改 vendor。

## 功能結果

Headless Chromium 154.0.8037.57 上，下列九組檢查通過，沒有 page error、失敗 request 或 HTTP error：

| 檢查 | 結果與證據 |
| --- | --- |
| 情境操作 | 試增設 5 個、儲存／套用／重設、CSV 下載、參數分享及切換視角保留條件 |
| 推薦明細鍵盤捲動 | 聚焦後 ArrowDown 增加 scrollTop |
| 資料來源對話框 | Enter 開啟、Escape 關閉，焦點回到來源按鈕 |
| 空間 3D | WebGL2 實際繪圖、選取點位、聚焦及俯視／斜視 |
| 七題與播放控制 | 各題 deep link 正確，交通／公車拖曳時間及播放更新時鐘 |
| CSV 資料健檢 | 3 列輸入辨認 1 列重複，輸出 JSON 的筆數一致 |
| 手機選題 | 觸控開啟七題選單、選題後關閉 |
| 手機地圖 | CDP 合成觸控可平移地圖 |
| 手機 3D | 觸控、touchCancel 後可重設並繼續使用 |

`npm test` 的 14 個測試檔及 `npm run check` 通過。另新增可重跑的 `scripts/check-browser.py`，驗證鍵盤表格、對話框焦點／圖示、390／320px 圖表字級、窄螢幕時間標籤邊界與地圖／3D 題目切換生命週期；該回歸腳本刻意阻擋外部圖磚，檢查本機程式行為，不用來判斷底圖品質。 對照測試只將暫存副本的 map-ui.js 還原為修正前版本，同一腳本會以 `Cannot read properties of undefined (reading 'save')` 失敗；修正版通過。

## 畫面與無障礙證據

桌機 1440×1000、平板 850×1000、手機 390×844、窄螢幕 320×800 的受測頁面沒有整頁水平溢出；標題字體已載入。桌機根入口及手機清潔箱頁以 axe-core 4.10.3 檢查 WCAG 2 A/AA 與 2.1 AA tags，皆為零已判定 violations，但仍有 color-contrast 等 incomplete 項目；這不是完整 WCAG 認證或全站人工鍵盤巡覽。

最終原始操作結果在 final-results.json（GitHub 分支內），來源與 23 張截圖的 SHA-256 見 capture-manifest.json（GitHub 分支內）。畫面包括 桌機入口、手機入口、桌機全頁、手機全頁，以及同目錄中的清潔箱、3D、交通、健檢、選單、平板、320px、來源對話框及圖表局部 captures。驗收證據留在 GitHub 分支，原始碼下載 ZIP 不包含內部 review captures。

## 測試環境界線

瀏覽器使用 SwiftShader 軟體 WebGL；手機是 viewport／觸控模擬。未驗證實體 iOS／Android、Safari／Firefox、硬體幀率或正式站台的完整瀏覽器流程，也未將模型推估當成政策成效實證。

環境代理的 CA 無法直接由此 Chromium 初始化辨認，驗收用暫時 HTTPS 圖磚轉送保留 OS CA 與 TLS 憑證檢查，未修改持久憑證信任。最初轉送漏掉 browser Referer，OSM 回傳 HTTP 200 的「Access blocked / 418」圖片，因此僅檢查圖片載入會誤判。已保留瀏覽器真實 User-Agent、Referer（本機 origin）與 Accept，重新完成矩陣、目視確認真實臺北街道圖及方案點位；沒有合成替代底圖或假冒正式站台 origin。最終圖磚桌機 12/12、手機與平板 6/6 載入，320px capture 是保留的 3D 視角，沒有 2D tiles 屬預期。
