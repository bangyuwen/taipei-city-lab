# 台北城市研究專案

同一個 repo 維護七個獨立靜態網站。每題各自管理資料、模型與研究；共用呈現程式及工具只維護一份，網站內的副本由建置產生。

## 題目與網站

| 題目 | 資料、模型與研究 | 網站程式 |
| --- | --- | --- |
| 樹蔭公平 | [shade](topics/shade/README.md) | [台北樹蔭研究](sites/taipei-shade-lab/README.md) |
| 垃圾箱分布、撤除與設計 | [bins](topics/bins/README.md) | [台北垃圾箱研究](sites/taipei-waste-lab/README.md) |
| 鼠患源頭治理 | [rat](topics/rat/README.md) | [台北鼠患源頭研究](sites/taipei-rat-lab/README.md) |
| 內湖錯峰通勤 | [traffic](topics/traffic/README.md) | [台北錯峰通勤研究](sites/taipei-traffic-lab/README.md) |
| 公車接駁與休息 | [bus](topics/bus/README.md) | [台北公車接駁研究](sites/taipei-bus-lab/README.md) |
| 社區健檢準備 | [buildings](topics/buildings/README.md) | [台北社區健檢研究](sites/taipei-building-lab/README.md) |
| 市政資料健檢 | [audit](topics/audit/README.md) | [台北資料健檢研究](sites/taipei-data-lab/README.md) |

[原整合站](sites/taipei-city-lab/README.md)另保留既有七題入口與深連結；各站維持自己的託管身分與存取範圍。

## 目錄

- [topics](topics/README.md)：各題 `data/`、`model.js` 與 `docs/` 的維護來源。
- [shared](shared/README.md)：共用純函式、來源定義、`web/template/` 呈現模板及[研究與規範](shared/docs/README.md)。
- `sites/<站名>/`：各站設定與 `dist/` 部署產物；網站不跨站讀檔。
- `scripts/`、`tests/`：離線建置、檢查及測試。

產品、設計與模型契約分別見 [product](shared/docs/product.md)、[design](shared/docs/design.md)、[contract](shared/docs/contract.md)。請修改維護來源後重建，避免直接編輯網站生成副本。

## 開發

使用 Python 3.11以上、Node.js 22以上；一般建置不需下載資料或安裝前端依賴。

```sh
npm run build
npm test
npm run check
npm --prefix sites/taipei-waste-lab test
npm --prefix sites/taipei-waste-lab run check
```

預覽單站，例如 `python -m http.server 8000 --directory sites/taipei-traffic-lab/dist`。開啟 `http://localhost:8000/`；街道底圖需要網路。各站的部署設定留在自己的 `.openai/hosting.json`，不共用 project_id。

可攜原始碼包保存可重建網站的來源，不包含託管身分或Git狀態。下載包不包含自身的 `source.zip`；解壓後先執行 `python scripts/package-source.py` 生成下載資產，再執行 `npm run check`。

## 證據與範圍

已載入的中心示範框觀測為39,451筆樹木與294筆清潔箱；垃圾箱另有四份不同年代及範圍的位置副本。其餘題目以來源目錄與明示的合成情境為主，資料健檢只在瀏覽器處理 CSV。資料缺列不等於撤除，模型分數不等於實際政策或安全成效。

研究方法、資料品質與現行規範見[共用文件](shared/docs/README.md)。自寫程式採 [MIT](LICENSE)，第三方套件、字型、政府資料與歷史副本保留各自授權及出處。
