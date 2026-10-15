# 台北城市研究專案

七個題目各自管理資料、模型與研究筆記，並由同一個 repo 維護七個可獨立部署的靜態網站。共用工具集中管理，各站的部署目錄只載入本題資料與必要元件。

## 題目與網站

| 題目 | 資料 模型 研究 | 網站原始碼 | 網址 |
| --- | --- | --- | --- |
| 樹蔭公平 | [shade](topics/shade/README.md) | [taipei-shade-lab](sites/taipei-shade-lab/README.md) | [開啟](https://taipei-shade-lab.bangyuwen.chatgpt.site) |
| 垃圾箱分布 撤除與設計 | [bins](topics/bins/README.md) | [taipei-waste-lab](sites/taipei-waste-lab/README.md) | [開啟](https://taipei-waste-lab.bangyuwen.chatgpt.site) |
| 鼠患源頭治理 | [rat](topics/rat/README.md) | [taipei-rat-lab](sites/taipei-rat-lab/README.md) | [開啟](https://taipei-rat-lab.bangyuwen.chatgpt.site) |
| 內湖錯峰通勤 | [traffic](topics/traffic/README.md) | [taipei-traffic-lab](sites/taipei-traffic-lab/README.md) | [開啟](https://taipei-traffic-lab.bangyuwen.chatgpt.site) |
| 公車接駁與休息 | [bus](topics/bus/README.md) | [taipei-bus-lab](sites/taipei-bus-lab/README.md) | [開啟](https://taipei-bus-lab.bangyuwen.chatgpt.site) |
| 社區健檢準備 | [buildings](topics/buildings/README.md) | [taipei-building-lab](sites/taipei-building-lab/README.md) | [開啟](https://taipei-building-lab.bangyuwen.chatgpt.site) |
| 市政資料健檢 | [audit](topics/audit/README.md) | [taipei-data-lab](sites/taipei-data-lab/README.md) | [開啟](https://taipei-data-lab.bangyuwen.chatgpt.site) |

各站維持自己的託管身分與網址。新站以私人存取發布；既有垃圾箱站沿用原本存取範圍。

## 資料與程式放置方式

- `topics/<題目>/data/`：該題保存的觀測、品質資訊或來源定義。垃圾箱歷史 CSV、GeoJSON 與 provenance 在 `topics/bins/data/history/`。
- `topics/<題目>/model.js`：該題模型的唯一維護來源。
- `topics/<題目>/docs/`：該題研究筆記；垃圾箱的撤除背景、歷史、全球案例與桶型研究集中在此。
- [shared](shared/README.md)：共用純函式、跨題來源定義及研究／品質規範。跨題歷史驗收紀錄集中在 [shared/docs](shared/docs/README.md)。
- `sites/<站名>/dist/`：可單獨部署的網站，包含自己的入口、資料、字型與必要程式；不跨站讀檔。
- 根目錄 `dist/`：共用呈現模板及原整合站的相容產物。資料與模型副本由分題來源重建。

各題的來源、模型、資料及文件只有一份人工維護來源。網站內的資料與研究下載是建置副本；重建會同步更新，避免分叉編輯。舊研究文件路徑保留導覽至新位置。

## 真實觀測與模型界線

目前保存的已載入觀測為中心示範範圍的39,451筆樹木與294筆清潔箱。垃圾箱另保存2015、2022、2024、2026四份歷史位置資料，日期、完整度與範圍各不相同；缺列不能直接解讀為撤除。

其餘題目保留各自的官方來源目錄或未載入狀態，模型以明確標示的合成情境比較。沒有補造實際鼠患、車流、公車需求或建物風險資料。資料健檢站帶來源目錄及本機CSV工具，不帶其他題目的觀測陣列，也不保存使用者上傳內容。

單站資料只含本題需要的來源及觀測。共用捷運與原市政題目等來源定義集中管理，各站建置時帶入需要的部分。所有來源的原始日期、欄位限制、品質及保存值均保留。

## 修改與重建

使用Python 3.11以上及Node.js 22以上。一般重建與測試不需下載資料或安裝前端依賴：

```sh
npm run build
npm test
npm run check
npm --prefix sites/taipei-waste-lab test
npm --prefix sites/taipei-waste-lab run check
```

`npm run build`依序重建模型副本、整合站資料、六個單題站及垃圾箱站的資料與研究下載。每個單題站使用自己的題目入口、資料快照、瀏覽器儲存鍵與匯出研究包。

若只改某題，可從repo根目錄執行：

```sh
python scripts/build-topic-sites.py --topic shade
python scripts/build-topic-sites.py --check --topic shade
```

垃圾箱站的地圖、撤除歷程及Three.js桶型體驗沿用既有獨立實作，使用：

```sh
npm --prefix sites/taipei-waste-lab run prepare-data
```

原始下載快取未隨repo保存。重新下載官方來源是獨立操作，需要網路與pyproj；`python scripts/prepare-data.py --refresh`會在取得及驗證全部來源後更新分題保存資料。一般離線建置不刷新來源日期，不冒充重新取得原始下載。

## 單獨預覽與部署

各站的`dist/`均可由一般靜態主機提供。例如：

```sh
python -m http.server 8000 --directory sites/taipei-traffic-lab/dist
```

開啟`http://localhost:8000/`，不要使用`file://`。模型、圖表、資料與固定版本套件由本站提供；街道底圖需要網路。各站自己的`.openai/hosting.json`保留部署身分，不能複製其他站的project_id。

GitHub Actions會檢查模型、單站資料隔離、靜態依賴及離線重建一致性。實際瀏覽器操作可執行`python scripts/check-topic-sites-browser.py`；垃圾箱站另有原本的地圖及設計回歸腳本。

## 研究與歷史紀錄

各題研究入口見[題目索引](topics/README.md)。[拆分前的整合站說明](shared/docs/integrated-site.md)保留原有功能與驗證背景；歷史驗收範圍以各文件日期及方法為準。

`scripts/package-source.py`會將分題來源、共用工具、網站及測試封裝成可攜原始碼下載包，排除託管身分、Git狀態與本機執行資料。

下載包不會把`source.zip`包在自己裡面。解壓後先執行`python scripts/package-source.py`，產生整合站使用的原始碼下載檔，再執行`npm run check`。靜態檢查不需要託管身分；部署時另驗證各站自己的設定。

## 授權

自寫程式採MIT。Three.js、Leaflet與字型保留各自授權；政府資料及歷史副本依原來源條款使用。OpenStreetMap底圖保留來源標示。程式授權不改變來源資料授權。
