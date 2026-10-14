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

最終原始操作結果在 [final-results.json](../.impeccable/review/final-results.json)，來源與 23 張截圖的 SHA-256 見 [capture-manifest.json](../.impeccable/review/capture-manifest.json)。畫面包括 [桌機入口](../.impeccable/review/desktop-first.png)、[手機入口](../.impeccable/review/mobile-first.png)、[桌機全頁](../.impeccable/review/desktop.png)、[手機全頁](../.impeccable/review/mobile.png)，以及同目錄中的清潔箱、3D、交通、健檢、選單、平板、320px、來源對話框及圖表局部 captures。驗收證據留在 GitHub 分支，原始碼下載 ZIP 不包含內部 review captures。

## 測試環境界線

瀏覽器使用 SwiftShader 軟體 WebGL；手機是 viewport／觸控模擬。未驗證實體 iOS／Android、Safari／Firefox、硬體幀率或正式站台的完整瀏覽器流程，也未將模型推估當成政策成效實證。

環境代理的 CA 無法直接由此 Chromium 初始化辨認，驗收用暫時 HTTPS 圖磚轉送保留 OS CA 與 TLS 憑證檢查，未修改持久憑證信任。最初轉送漏掉 browser Referer，OSM 回傳 HTTP 200 的「Access blocked / 418」圖片，因此僅檢查圖片載入會誤判。已保留瀏覽器真實 User-Agent、Referer（本機 origin）與 Accept，重新完成矩陣、目視確認真實臺北街道圖及方案點位；沒有合成替代底圖或假冒正式站台 origin。最終圖磚桌機 12/12、手機與平板 6/6 載入，320px capture 是保留的 3D 視角，沒有 2D tiles 屬預期。

## 合併前 GitHub 審查補修

入口可見時，歡迎標題是唯一可見 H1、題目標題是 H2；按「先看看垃圾桶怎麼放」或開啟題目深連結後，題目改為 H1，鍵盤焦點仍回到題目區。題目字體以 .topic-title 固定，語意層級不改變桌機 34px／手機 30px 的外觀。

最新瀏覽器回歸增加根頁、#explore、鍵盤 Enter 進入探索及題目深連結的唯一可見 H1／第一標題檢查。另在 1440px 與 390px 上完成 22 項狀態檢查，沒有執行錯誤或整頁水平溢出；14 個 Node 測試檔及靜態模型檢查通過。來源 SHA-256 與四張補修畫面見 [heading-results.json](../.impeccable/review/heading-results.json)。前述 23 張完整驗收畫面與 Impeccable Verdict Pass 是上一輪證據，本補修沒有宣稱新的全面視覺核准。
