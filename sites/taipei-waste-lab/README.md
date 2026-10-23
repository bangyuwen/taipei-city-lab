# 台北垃圾箱研究

本期聚焦台北行人專用清潔箱的設置、清運與維護。家戶服務不列入百日工作、預算及驗收；相關研究與早期分布、撤除歷程保留作背景。這是獨立的靜態站，資料與程式都由本站提供。

正式站：[youtong](https://youtong.bangyuwen.chatgpt.site)，只發布 GitHub `main`。原[台北垃圾箱研究](https://taipei-waste-lab.bangyuwen.chatgpt.site)保留為測試站。發布流程與五分鐘自動檢查見[正式站部署](docs/production-deployment.md)。網站程式與部署產物位於 `sites/taipei-waste-lab/`；本題資料、模型與研究入口見[垃圾箱題目目錄](../../topics/bins/README.md)。Sites 部署使用本站自己的 Git 與 `.openai/hosting.json`。

## Combined publication

The homepage has equal entrances for residents and research readers. `/research/`
keeps the research interface; `/demo/` opens the pedestrian prototype, with role
links to planning and simulated collection. Old root hash/query links redirect to
`/research/` while preserving both values. Historical standalone HTML links also
redirect to their research paths.

Use Python 3.12 or newer. `npm run prepare-data` and `npm run check` build the
combined `public/` output; `npm run preview` serves that directory. To assemble
already-generated research without regenerating retained research packages, run
`python scripts/prepare-public.py` followed by `python scripts/prepare-portal.py`.
The hosting project identity is unchanged; its static directory is `public`.

The demo uses `有桶demo_v1_` local storage and makes no Firebase requests. Reports
and collection actions remain browser-local simulations. The displayed plan
version is generated from the canonical decision-check source. See
[demo scope](../youtong/README.md) and `tests/portal.test.mjs`.

## 閱讀入口與資訊歸屬

2026-10-19 依團隊推進專案的情境整理為「工作總覽／熱點研究／方案比較／執行分工／資料庫」五個工作區。摘要頁連到各區、證據與工作包；歷史材料集中於資料庫。既有錨點、`#map`、`#comparison`、`#history`、`#siting` 與資料版本 query 保持有效。

- `#research`：工作總覽，列出已交付、下一步與待確認承接；不預填組員、人力或日期。
- `#analysis`：全臺北市12區熱點分析摘要；`#districts` 查各區錨點，`#methods` 查資料與規則，`#evidence` 查28則評論摘要。全部1,821站、12區首輪36處與校區另3處均保留；實地垃圾需求仍待查核。
- `#ideas`：已採納的配置比較方向、A現況／B資訊改善／C等總量移位三方案、未來構想與本期不做項目。
- `#plan`：執行分工摘要；`#team` 區分團隊任務，`#work` 查政府工作包與現勘計畫。PRD v0.4及驗收條件位於方案比較的 `#spec`；機關承接、實際現勘與成效仍待確認。
- `#library`：台北歷史、各國案例、來源、舊研究與決策的共同索引；原百日計畫位於 `#archive`。
- `#countries`：單一國家案例選單、預設實拍，在同一影像區切換 3D 示意。照片、署名、地點對應限制、證據及成本直接呈現；`?country=japan#countries` 與 `#country-japan` 可直接指定案例。
- `#definition`：D01–D18決策與改寫紀錄，以及PRD v0.1／v0.2封存。原始全文與逐則分析保留於私人研究資料。
- `design-thinking/index.html` 與 `prd/index.html`：保留舊網址與錨點，轉至分析、發想或計劃中的對應內容。
- `#design`：既有 T1 概念與四種用途引導示範，從材料頁的舊研究判讀進入。固定尺寸與示例不代表本期已選定方案或實測結果。
- `#sources`：六份清冊來源、13 篇文獻、4 則實務與比較方法。每則完整紀錄只維護一份，`#reference-L01` 等引用可直接定位。
- `#materials`：保留舊研究判讀、公開位置資料摘要、分區長表、模擬原型與未執行測試計畫，以及原有預算、費率、候選街道與現勘協定。由首頁深入閱讀或頁尾進入；`#conclusion-siting`、`#current-evidence-heading`、`#problem-map-heading`、`#service-prototype` 等舊錨點直接開啟對應材料。

模型資料、照片原檔、T1 提案、候選疊圖與公開附件界線保留。以下為各題內容與原資料脈絡。

目前保留：

- 「既有研究判讀」：原有配置、清運與維護建議移至材料頁供回查；家戶分流仍標為本期不推進。這些材料供回查；本期採用範圍以 PRD v0.4 為準。

- 2015、2022、2024、2026 四個年份、六份位置資料切換；2024、2026 預設採新主版本，原缺頁版與示範區版仍可選取。
- 點位地圖預設使用 CARTO Positron 淡色底圖，右上方可切換原 OpenStreetMap 街道底圖；CARTO 連線失敗時自動使用淡色街道備援，點位、篩選與目前視角不變。
- 「台北的變化」整合歷程、分布與清冊差異，以二級導覽切換；原有 `#map`、`#comparison`、`#history` 深連結保持有效。
- 「各國垃圾桶」以 `#countries` 獨立呈現十二國實物照片、桶型、滿度感測、清運與成本案例；圖說標示拍攝地點、日期及與案例的對應限制，照片、功能與價格各自附來源；付費服務與台北方案保留於材料頁的舊研究判讀，既有引用連結仍可回查。
- 有來源的撤除時間線，區分政策理由、官方存量與具日期的撤除個案。
- 用途設計體驗：街角隨手投、回收分流、高使用量管理與家戶收受；角色、投放規則、滿載／離線與清運流程各有操作回饋，3D 反映設備狀態。
- 各版本日期、完整性、原始來源與頁面研究說明。
- 「版本比較」：2024 封存版與 2026 官方主檔的各區列數、比對分類、未再出現地址、原始列與座標，以及分類與各區統計。
- 75 對同址座標不同的距離分析：球面座標差距、前十名、全部排序與原始座標；不直接判定遷移。

- 「研究與實作」：18 個桌面候選、75 對及全部比較群組核驗表、13 篇文獻；現勘試辦材料保留在私人專案，新增 1996–2025 官方年統計，分開保留計數口徑。現場量測與成效仍待取得。

## 資料範圍

| 版本 | 保存資料列 | 可繪製紀錄 | 限制 |
| --- | ---: | ---: | --- |
| 2015 | 2,517 | 2,505 | 12 區保存資料，未核實完整性；12 筆座標待核對 |
| 2022 | 1,799 | 1,799 | 12 區保存資料，原調查日期與完整性未核實 |
| 2024 年 10 月封存版（主版本） | 1,971 | 1,969 | 12 區；台北時間 2024-10-19 封存，原調查／更新日期未知；全市現場完整性未核實 |
| 2024 年 5 月缺頁版（舊版） | 1,000 | 1,000 | 原 API 回報 1,991 筆，僅保存第一頁；缺的 991 筆仍未找回同日期副本 |
| 2026 官方公開主檔（主版本） | 681 | 680 | 來源更新 2026-09-30、下載 2026-10-15；主檔北投 0 筆，目錄仍列 2,009 筆；全市現場完整性未核實 |
| 2026 中心示範區（舊版） | 294 | 294 | 既有中心示範框，並非全市 |

保存日期不等於設置／撤除日期，本站列號不是官方箱號。不同版本缺列不直接視為撤除。完整來源與限制見 [歷史分布與撤除紀錄](../../topics/bins/docs/bin-removal-history.md)、`dist/data/datasets.json` 及各版來源說明。

2024 封存版與 5 月版為不同快照，不拼接成同日期清冊。2026 主檔保留全部 681 列，CSV 與 API 筆數一致，並非分頁漏抓；取得完整下載檔不代表已核實全市設施都列入。130 筆景點商圈場所資料僅保存於補查紀錄，不與垃圾箱逐列相加。

2026 舊版中心示範框為經度 121.51–121.57、緯度 25.02–25.08。原始重疊及異常座標全數保留，粗篩未通過者不繪製；原 CSV、各版 provenance、補查原始檔及離線匯出工具保留在私人專案，不隨公開站發布。

分享連結的 `year=2024`、`year=2026` 保留原舊版意義；新主版本為 `year=2024-archive`、`year=2026-main`。六份版本合併為一個選單；地圖初始選取 2026 官方主檔，網站首頁為研究摘要。

## 研究筆記

- [中山站配置決策案例](dist/cases/zhongshan.html)：以既有站內服務與街道清冊走過保留、指引、清運、移位與增設的判斷；預算與現場缺口維持未知。正式來源在 `topics/bins/research/placement-case-2026-10-23/`，由 `scripts/prepare-placement-case.py` 重建，網站路徑為 `/research/cases/zhongshan.html`。

- [服務預算概估](research/budget-2026-10-15/README.md)：30 處／180 日及 100 處／365 日的設備、清運與家戶分流費用；保留假設、公式、來源與 CSV。由 `python3 scripts/estimate-budget.py` 重算，再以 `python3 scripts/package-research.py` 更新私人離線研究包；發布前須執行完整 `npm run prepare-data`。

- [配置、清運與家戶垃圾分流的資料判斷](research/service-strategy-2026-10-15/README.md)：既有判讀文件，分開事實、建議與未知效果。入口 `#conclusion-siting`，位於材料頁。

研究正文集中於[本題文件目錄](../../topics/bins/docs/README.md)，新版研究包的唯一編輯來源為 `topics/bins/research/`（[來源維護說明](../../topics/bins/research-source.md)）；本站 `research/` 是獨立網站副本。修改正文後，執行 `npm run prepare-data` 會更新 `data/research/` 的獨立原始碼副本及 `dist/research/` 的私人離線產物，請勿直接修改這兩份衍生副本。

- [垃圾箱減少的研究脈絡](../../topics/bins/docs/bin-reduction.md)：歷史背景、政策理由與待驗證問題。
- [歷史分布與撤除紀錄](../../topics/bins/docs/bin-removal-history.md)：各版資料、撤除時間線與來源限制。
- [用途體驗的設計假設](../../topics/bins/docs/bin-design.md)：四種用途的操作、尺寸與示意界線。
- [全球公共垃圾箱設計與治理比較及台北應用](../../topics/bins/docs/global-bin-practices.md)：五大洲16個案例，涵蓋桶型、配置、清運、撤除、回收與台北可借鏡的條件。

- [2024 與 2026 清冊補查](research/source-recovery-2026-10-15/README.md)：另存 2024 年 10 月官方封存版 1,971 列、2026 年官方主檔完整下載 681 列及景點商圈 130 筆；附來源、品質限制與離線核對程式。
- [2024／2026 版本比較](research/comparison-2024-2026/README.md)：固定配對規則、各區分類統計與完整來源列。入口 `#comparison`；未再出現不等於撤除，只在新版出現也不等於新設。

- [75 對同址座標差距分析](research/coordinate-distances-2024-2026/README.md)：固定距離計算規則、品質限制、各區摘要及全部配對距離。

- [公共垃圾箱研究文獻與應用筆記](research/literature-2026-10-15/README.md)：保存 13 篇相關論文的書目、來源、查閱範圍、專案用途與證據限制，涵蓋撤桶、設計、選址及跨版座標配對。
- [公共垃圾箱研究與試辦計畫](research/research-plan-2026-10-15/README.md)：資料查核、街段診斷、量測協定、試辦設計、人力估算及階段完成條件。
- [研究執行成果與現場包](research/execution-2026-10-15/README.md)：桌面查核成果、18 個候選錨點、48 個預排訪次及 30 個任務槽、診斷卡與試辦協定。入口 `#research-candidates-heading`，位於材料頁。

## 公開瀏覽與附件範圍

公開部署目錄為 `public/`，由 `scripts/prepare-portal.py` 組合首頁、`research/` 與 `demo/`。研究站先由 `scripts/prepare-public.py` 產生白名單中介目錄 `out/`，再放入 `public/research/`；有桶只發布必要的畫面、程式與地圖資料。私人研究原始檔、計算協定、Markdown、ZIP 與 Firebase 管理工具不公開；不得把 `dist/` 或專案根目錄當公開服務目錄。

這是取消直接下載與公開附件，不是禁止擷取已顯示的資料。地圖和比較頁需要的地址、座標與分析 JSON 仍送到訪客瀏覽器；來源引用的外部網站由原發布者管理。原始證據保留在私人專案，不做刪除或公開權限變更。

照片保留來源影像，僅由版面縮放顯示；照片授權及異地、原型限制標在圖說。私人來源清單 `dist/images/countries/sources.json` 保存影像網址、尺寸及 SHA-256，不列入公開輸出。

## 開發與驗證

無需安裝前端依賴。Node.js 22 以上：

```sh
npm run prepare-data
npm test
npm run check
npm run preview
```

已保存的 CSV、來源紀錄與前端資產均在本專案。`npm run prepare-data` 從本站保存檔案及 `research/source-recovery-2026-10-15/` 固定資料包重建展示資料，核對新輸入雜湊並保留離線來源。不依賴其他專案，不會自動下載新版本或補齊歷史缺頁。

此命令也會呼叫 `scripts/compare-snapshots.py`，依 `research/comparison-2024-2026/protocol.json` 重建比較 JSON／CSV。比較只用行政區、完整地址與座標欄位，不使用模糊地址或最近距離推定實體身分；同址多筆的剩餘列保留為未配對。分類結果及各區列數遵守逐列守恆。原檔實體起始行與本站資料筆序分開記錄，以保留含換行地址的追溯資訊。

`python scripts/check-browser.py` 使用環境既有的 Playwright 與 Chromium 檢查桌機／手機、版本切換、篩選、無下載入口與撤除歷程操作。畫面證據寫入忽略的 `qa/`。

`python scripts/check-design-browser.py` 使用 Node.js Playwright 驗證四種用途的訪客與清運流程、分流與家戶確認、滿載／感測離線／清運操作、固定規格與鍵盤操作、1440／720／390／320 px 版面、減少動態效果、位置資料 503 與 WebGL 失效時的文字流程。執行前請將已建置網站提供在 `http://127.0.0.1:4177/#design`；可用 `DESIGN_QA_URL` 覆寫網址、`PLAYWRIGHT_MODULE` 指定 Playwright 模組、`CHROME_PATH` 指定 Chrome。OpenStreetMap 圖磚由本機測試回傳 1×1 PNG；桌機四種用途、手機高使用量及 WebGL 備援截圖與 `design-browser-results.json` 寫入忽略的 `qa/`。Three.js 0.180.0 與 OrbitControls 自行託管，按需載入，版本與檔案雜湊見 `dist/vendor/three/manifest.json`。3D 體驗不依賴位置資料請求成功。

概念設計入口為 `#design`，從材料頁的舊研究判讀進入。四款均為本站概念；選用途後，依固定投放／清運步驟查看分流、滿載、感測離線與家戶確認的示意，尺寸與物件不另提供自訂。WebGL 失效時文字流程仍可完整操作。沒有實際感測、身分辨識、付款或成效預測；假設見[用途體驗文件](../../topics/bins/docs/bin-design.md)。

The project workspace has five stable areas: `#research` (work overview), `#analysis` (hotspot research), `#ideas` (scenario comparison), `#plan` (execution responsibilities), and `#library` (reference library). The home page links completed desktop deliverables to planned next steps and unresolved ownership, without inventing task assignments, deadlines or completion percentages. Each page belongs to exactly one workspace through `workspacePages` in `dist/data-utils.js`; the main navigation highlights that workspace, and static breadcrumbs plus local navigation show the page's location even for direct links.

Team responsibilities and the development handoff live at `#team` under execution, separate from government work packages at `#work`. Methods and shared requirements use continuous documents with section indexes. Districts, evidence records, government work packages and historical chapters retain native selectors. All former fragments remain addressable; old PRD responsibility links now open their team-owned destination. Historical Taipei records, country cases, source documents and older decisions are found through the library.

The existing source and materials pages retain their full references, earlier prototypes and unexecuted estimates. `package-research.py` generates the historical plan in `#archive`; the citywide publisher writes separate summary and reader regions. Research runtime assets remain protected by the `out/` allowlist and are published under `public/research/`, with no private attachments or download entry points.

版本比較 `#comparison` 共用行政區與地址範圍，範圍摘要、五類組數及距離分布隨之連動。分類選擇只縮小結果清單，不改寫範圍分母。預設顯示全部分類；同址座標差距納入同一清單排序，不另重複前十名。完整全市行政區表放在清單之後直接閱讀，明示不受篩選影響；完整配對及距離方法歸來源頁。追加結果、距離延遲載入及從來源地圖返回會保留已展開證據；主資料與距離資料各有重試入口。

距離分析由 `scripts/analyze-coordinate-distances.py` 重建，亦整合於 `prepare-data.py`。它先核對固定比較 JSON 與兩份來源 CSV 雜湊，只分析原有的 75 對分類；新結果另存，不改寫原配對或缺列分類。距離採 Haversine 球面近似，半徑 6,371,000 公尺，保留未通過台北粗篩的有效經緯度並標示品質；無法計算時保留空值，排序用未四捨五入數值。

`npm run check` 會先由固定清單重建公開 `out/`，再驗證私有來源及公開檔案，支援未建立輸出目錄的全新 checkout。

私人離線 ZIP 包含預算重算與重新封裝所需的文件、網頁輸入和腳本；解壓後可在包根目錄執行 `python3 scripts/estimate-budget.py` 與 `python3 scripts/package-research.py`。研究副本由來源完整替換，避免保留已撤回或重新命名的檔案；實際填報結果仍須另存工作副本。

`npm run prepare-data` 依序重建清冊比較、距離、研究執行材料、預算表、私人離線 ZIP 及公開 `out/`；在 monorepo 中，研究寫入 `topics/bins/research/` 後同步本站副本，獨立 Sites checkout 則使用站內 `research/`。人工核驗請另存工作副本，避免重建覆寫。

## 結構

- `dist/`：網頁來源與完整私人衍生產物，含原始附件；不可直接對外提供此目錄。
- `out/`：研究站的白名單中介產物；不納入版本控制。
- `public/`：首頁、研究與有桶的整合發布產物；預覽與 Sites 部署只使用此目錄，不納入版本控制。
- `dist/history.js`：有來源的政策與撤除歷程。
- `dist/bin-scene.js`：Three.js 概念街角；`design-model.js`：尺寸與試投規則；`design-ui.js`：操作介面。
- `../../topics/bins/docs/` 與 `../../topics/bins/research/`：研究正文、固定來源與分析協定；本站 `research/` 為獨立部署副本。
- `dist/research/`：私人研究文件與離線 ZIP；公開輸出只保留候選清單顯示所需的 `desk-results.json`。
- `.openai/hosting.json`：本站部署身分與靜態目錄。

### Redesign checks

The standalone visual system is recorded in [DESIGN.md](DESIGN.md) and
`.impeccable/design.json`. Its scope is this site, not the shared topic template.

With `out/` served at `http://127.0.0.1:4174/`, run:

```sh
node scripts/check-redesign-browser.mjs
```

Use `REDESIGN_QA_URL` to change the URL, `PLAYWRIGHT_MODULE` for an existing
Playwright module, and `CHROME_PATH` for an installed browser. The check covers
nine routes at 320, 390, 720 and 1440 px; both sides of the 640 and 960 px
breakpoints; menu focus; map keyboard order; route scroll and filter retention;
comparison retry; image fallback; and the absence of download controls.
Viewport and full-page evidence is generated in ignored `.impeccable/review/`.
External map tiles require network access; this check does not certify the
availability of the tile provider. The separate design browser check covers
the four simulation purposes and WebGL fallback.

## 授權

自寫程式採 MIT。Leaflet 與 Three.js 保留原 MIT 授權；字型保留 OFL 授權；政府資料及歷史副本依各來源條款使用。OpenStreetMap 底圖保留出處，按瀏覽範圍載入。

## Country 3D viewer

The country reader shows one selected case, using a single native selector grouped by service purpose. Real photos are the default; photo and 3D share one media area. All captions, attribution, licenses, identity limitations, operational evidence and costs remain readable. Australia explicitly has no embedded redistributable photo. Three.js loads only on the first model request and reuses its canvas. The viewer offers play/pause/replay, reset and zoom, with drag and keyboard camera controls. Switching to the photo, leaving the viewport, hiding the tab or changing routes suspends rendering. Reduced motion displays the completed action without animation. Timeline, turntable, preset-view menus, quizzes and layered disclosures are removed. Taipei's two official recycling notes have one readable home in Sources and Methods.

The authored Three.js meshes and their actions are photo-reference illustrations, not measured or manufacturer models. Hidden surfaces, proportions and movement paths are inferred; animated flaps, lids, items and collection steps do not establish the real equipment's operating mechanism. Case-specific photo mismatches appear alongside each model. India depicts a collection service; Australia uses a generic receiving-station concept because no redistributable equipment photo is embedded. These models do not establish dimensions, capacity or performance.

The metadata lives in `dist/country-model-data.js`; geometry lives in `dist/country-models.js`. Keep these distinct from the purpose simulator. Add any runtime file to `scripts/prepare-public.py`. Run `npm test`, `npm run check`, `node scripts/check-country-browser.mjs`, and `node scripts/check-country-play-browser.mjs` against the preview (optional `COUNTRY_QA_URL`, `PLAYWRIGHT_MODULE`, `CHROME_PATH`). The browser checks cover all twelve cases and their photo/source preservation; representative opening, deposit and collection sequences cover play/pause/replay/reset, tap versus drag, reduced motion and suspended rendering on desktop and mobile. All twelve model action poses also have deterministic unit coverage. Screenshots and browser evidence are generated under ignored `.impeccable/review/`. Rebuild the private research ZIP with `npm run prepare-data` after editing HTML.

## 設點與歷史疊圖

「研究與執行材料 → 候選街道」（`#siting`）把 425 組條件式寬度候選街段與 2015、2022、2024 年 5 月缺頁版、2024 年 10 月封存版及 2026 年 9 月主檔疊圖。設計頁亦有入口。圖層與行政區／地址篩選可獨立操作，點擊圖形或鍵盤清單可查看來源。跨年缺列不等於撤除，候選街段不代表核准設點。寬度單位暫按公尺解讀，現場及管理權責仍待查核。

公開的 `siting-overlay.html` 只內嵌瀏覽所需的點位、街段圖形與來源說明。來源 CSV／GeoJSON、完整盤點清單、重建輸入與溯源檔不加入公開資產清單。`data/siting-overlay.json` 保存這次研究的展示快照，`data/siting-overlay.provenance.json` 只記錄此保存快照的雜湊、內容數量及研究出處；這兩檔留在私有原始碼。完整上游輸入與原始溯源紀錄保留在 monorepo 的 `topics/bins/research/siting-inventory-2026-10-17/` 及其引用來源，不包含在獨立 Sites 原始碼。本網站可重建保存快照的展示頁，不能從本站檔案重做完整上游盤點。

`python scripts/prepare-siting-overlay.py` 由保存快照、`templates/siting-overlay.html` 與既有 Leaflet 重建互動頁，不重新下載或推論資料。這個步驟已接入 `npm run prepare-data` 與 `npm run check`。疊圖頁首次進入才載入；回到此頁保留篩選，嵌入頁高度跟隨內容，亦可另開完整頁面。底圖仍需 OpenStreetMap 連線，失敗時顯示提示並保留資料操作。

預覽 `out/` 後，以 `SITING_QA_URL` 指定網址，執行 `node scripts/check-siting-browser.mjs`。可沿用 `PLAYWRIGHT_MODULE` 與 `CHROME_PATH`；檢查延後載入、頁籤與設計入口、返回時篩選保留、桌機／手機尺寸、點選定位、載入重試與私人輸入路徑，畫面證據留在忽略的 `.impeccable/review/siting/`。

Use `--functional-only` with `check-redesign-browser.mjs` or `check-browser.py` to rerun behavior and responsive bounds without writing screenshots.

### Desktop assessments for ten retained sites

The siting overlay and printable `field-checklist.html` now present desktop-only judgments from the same curated `data/field-priorities.json`. The existing `#siting` path remains addressable under Research results. The old field-visit P1/P2 assignments are replaced by two explicit dimensions: addition-evaluation priority (one review, five lower, four hold) and evidence confidence (seven medium, three low). Confidence describes consistency of the saved evidence, not field accuracy or a probability. Shilin deliberately combines medium confidence with hold priority: consistent scene/record evidence does not establish spatial feasibility.

Each map marker, shortlist entry, popup and printable sheet identifies both dimensions. Details explain the priority and confidence reasons, retained evidence, limits and current recommendation. The source snapshot remains dated 2026-10-17; no new observations, demand measurements, weighted score or citywide ranking were created. The 425 polygons and five historical snapshots remain unchanged. Private research inputs and attachments remain excluded from the 56-file public allowlist.

The existing map priority filter uses the new categories and retains its district/search intersections. The printable data-reading table has its own category filter; visible sheets, index, page count and sequential page numbers update together, while source site IDs stay fixed. Printing uses the selected sheets. No field visit tasks, record uploads or stored form data are introduced. Browser checks cover content parity, filters, printing, responsive layout and private attachment exclusions.

## 百日計畫

`#plan` 提供完整的百日建置與營運交接提案，研究與執行材料及頁尾皆有入口。`package-research.py` 由 canonical `topics/bins/research/hundred-day-plan-2026-10-17/README.md`（獨立 checkout 使用 `research/` 副本）產生正文、章節連結與表格。第 100 天須完成行人服務的設備、人員與實際服務驗收；家戶服務不列入本期工作、預算或驗收。30 處、備援、預算及權責仍待承接單位確認。舊估算與 180 日營運材料保留並註明與百日建置的關係。僅公開 HTML 正文，不公開 Markdown、參數附件或離線 ZIP。

## Preserved location evidence summary

The materials page retains the dated 2026 public location records and 2025 annual statistics at `#current-evidence-heading`. The homepage now leads with the current problem conclusions and their comment evidence; it links to the preserved records for deeper reading. The summary uses the retained 2026-10-15 source recovery and source audit under `topics/bins/research/`; it is not a live inventory. Record counts, statistical units, source dates and unresolved coverage stay together. Field confirmation and the unstarted hundred-day proposal have separate labels. The summary is maintained in `dist/index.html` outside generated research markers, so the existing package rebuild preserves it. No route, runtime asset or public attachment was added.

### Problem definition audit

`#definition-audit-heading` records the 2026-10-18 retrospective analysis summary.
The canonical public record is authored in `dist/index.html`: five grouping logs,
four original-to-draft problem explanations, six attributed user decisions, and
28 anonymized evidence paraphrases with bidirectional links. E identifiers are
stable lookup keys, not frequency or priority ranks. Original comments and the
E-to-source-row crosswalk remain in the private research workspace; do not add
them to the public asset allowlist. Publication does not confirm the hypotheses.

Run `scripts/check-definition-browser.mjs` against a prepared local preview to
check deep links, evidence round trips, attribution counts and mobile bounds.

先前局部案例（已由D18更正為全市範圍）：`research/gongguan-hotspots-2026-10-19/README.md`，含可重跑 notebook、完整來源／結果、五處觀察錨點、政府分工與交接方案。公開摘要位於 `#hotspot-heading`；原始附件仍不公開。

範圍修正：使用者要求全臺北市規劃，D18取代公館單一生活圈作為研究邊界。全市成果：`research/taipei-citywide-2026-10-19/README.md`，Notebook、全站表與12區政府分工均保留；公館舊版只作歷史案例。


### Citywide handoff and first-round field plan

`research/taipei-citywide-2026-10-19/delivery/` contains the hotspot and government handoffs, 39 anchor records, 13 area readiness rows, 234 unexecuted visit templates, scope setup, per-service-point form, three-wave plan and capacity scenarios. All rows remain planned or unknown until fieldwork. The public site presents summaries under analysis, district checks and execution work records; raw tables and attachments remain private. `delivery/build_handoff.py` regenerates templates from fixed analysis results without changing the analysis protocol. Copy templates before entering real observations.

`npm run prepare-data` refreshes the citywide publisher from canonical topic inputs (or the standalone source package) before packaging private research and staging public assets. Source changes therefore update the derived field records and public summary together.

## Research synchronization (2026-10-22)

The research pages now cover personas and disposal journeys, quantitative citywide evidence, the current problem definition, PRD v0.5 and blank field records. Canonical evidence and generators remain in `topics/bins/research/`; `npm run build` refreshes the standalone copies and private offline archive. The citywide publisher retains its historical layout and is not replayed during normal builds. Field handoffs and blank forms are regenerated without replacing the current research pages.

The 12-district venue rechecks, proposed fieldwork order, MRT top-10 comparison, and Zhongshan / Zhongxiao Xinsheng follow-up retain separate dates, source rows and unknowns. Venue place counts are never converted to usable bin counts. The September OD raw file is too large for Git; its official URL, retrieval receipts and compact station/day extract are retained in the MRT study. Public output remains restricted by the existing runtime asset allowlist.

## Transport and bin cross-check

The `#map` page joins retained July YouBike endpoint activity, the official bus snapshot updated on 2026-10-22, and the 2026 bin inventory. Run `npm run prepare-cross-analysis` to regenerate the runtime data. See [cross-analysis.md](docs/cross-analysis.md) for scope, provenance and limitations. Raw inputs stay private; only the required map data is staged.


The map now also compares July MRT OD activity with the union of station-exit buffers, nearby YouBike activity and retained bus stops. Citywide complaint acceptance-hour charts are kept separate because the official case file has no locations. Run `npm run prepare-transport-time` to regenerate the retained raw-source aggregates, then `npm run prepare-cross-analysis`. See [cross-analysis methodology](docs/cross-analysis.md) for source custody, period exclusions, unmatched stations and interpretation limits.
