# 中山站設點決策案例

於 2026-10-23 編製，使用 2026-10-22 已查核並保存的證據。本案例套用使用者選定的規則：限制總營運成本，優先比較既有桶位調整，僅在確認未滿足需求後才考慮新增。

讀者沿著中山站詢問處及 1、4 號出口附近的一個未解服務問題閱讀。這是使用情境提案，不是已觀察旅程。未新增現勘、管理者回應、預算分配、移桶候選、成本估算、試行結果或核准設置。

`page.html` 維護案例正文及頁面呈現。`render.py` 驗證 `inputs.json`，由保存的兩站結果填入量化欄位，產生 `dist/cases/zhongshan.html`，並在既有中山證據旁加入一個限定範圍的連結。可由正式主題資料包或其獨立網站產生副本執行，不抓取最新來源、不改動歷史輸入。頁面保留日期及 null／未知的意義。

由網站目錄依序執行 `python3 scripts/prepare-placement-case.py`、`python3 scripts/prepare-public.py` 及 `python3 scripts/prepare-portal.py`。第一個命令產生案例；第二個僅輸出白名單執行檔。原始證據、來源清單與來源包保持私有。交付路徑為 `/research/cases/zhongshan.html`。

新頁沿用既有深藍綠導覽、冷色紙張背景、系統字體、低調分隔線與原生展開元件，不修改共用視覺系統。須驗證桌機／手機呈現、來源連結、展開操作、產生數值、冪等性及歷史輸入雜湊。

完整 `npm run prepare-data` 會先產生案例，再建立私人研究 ZIP。ZIP 包含 `dist/cases/zhongshan.html`；本機連結明列 `index.html`，解壓後也能解析。
