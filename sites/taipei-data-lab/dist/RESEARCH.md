# 台北資料健檢研究｜市政資料健檢

先確認資料用途、粒度與日期，再於瀏覽器本機檢查 CSV 缺漏、重複及資料契約。

## 使用與資料界線

- 先讀研究結論、依據與缺口，再展開模型、參數、地圖及明細。
- 真實快照與合成情境分開標示；模型結果不代表實際政策成效或核准方案。
- 本站只載入本題資料。資料健檢站僅帶來源目錄，不附其他題目的觀測陣列。
- 參數方案儲存在本站專屬的瀏覽器儲存空間；CSV 僅在本機處理。
- 模型、圖表與來源說明可離線使用；街道底圖需要連網，底圖失敗不改寫觀測資料。

## 快照資訊

```json
{
  "retrievedAt": "2026-10-13T12:18:35Z",
  "builtAt": "2026-10-13T12:25:27Z",
  "buildStatus": "complete",
  "bbox": [
    121.51,
    25.02,
    121.57,
    25.08
  ],
  "scope": "跨題來源目錄與本機 CSV 健檢；本站未載入其他題的樹木、清潔箱或其他觀測列。",
  "coordinateSystem": "EPSG:4326; x=longitude, y=latitude",
  "sampled": false,
  "topicId": "audit",
  "observationStatus": "catalog-only"
}
```

## 本題來源

### 臺北市行道樹及公園樹木分布圖

- 來源：https://data.gov.tw/dataset/128274
- 整合狀態：原題已載入觀測；本站僅保存目錄
- 粒度：一列一棵樹；逐樹調查日期與系統更新時間分開保存
- 限制：沒有樹冠輪廓、遮蔭量、移除履歷或可施工樹穴。樹高有極端值，調查日有缺漏與 1900 年值；更新時間不代表重新量測。

### 見鼠地圖 Rat Radar（題目列出的民間來源）

- 來源：https://ratdar.taipei/reports
- 整合狀態：not-loaded
- 粒度：民眾自行通報；本版未下載
- 限制：未驗證來源、授權、座標及去重；不得將模擬鼠患點說成民間或官方實際通報。

### 市政 debug松官方題目與規則

- 來源：https://puma.taipei/hackathon
- 整合狀態：metadata-only
- 粒度：7 項議題、資料入口與模擬資料規則
- 限制：題目敘述不是觀測資料；活動列出的資料入口仍需逐項確認欄位、粒度與授權。

### 臺北市行人專用清潔箱

- 來源：https://data.taipei/dataset/detail?id=a835f3ba-7f50-4b0d-91a6-9df128632d1c
- 整合狀態：原題已載入觀測；本站僅保存目錄
- 粒度：一列一個行人專用清潔箱位置；來源無唯一設施編號
- 限制：只有位置，沒有容量、滿溢、清運頻率或行人需求；位置距離不等於可達步行距離。

### 臺北市人行道固定設施物_人行道範圍圖

- 來源：https://data.taipei/dataset/detail?id=715d3a83-8445-4496-b6bf-b0900538b7e7
- 整合狀態：metadata-only
- 粒度：人行道範圍幾何及其寬度、淨寬屬性
- 限制：僅查核資料目錄與欄位，尚未整合幾何；不得據此宣稱候選點可施工或已符合淨寬。

### 臺北市陳情系統類別資料

- 來源：https://data.taipei/dataset/detail?id=cb423c17-88eb-4231-a725-f1b93247d1bf
- 整合狀態：metadata-only
- 粒度：逐案分類、受理與結案日期；無地址或經緯度
- 限制：欄位沒有地址或座標，無法直接製作通報熱點；通報量也不等於實際事件發生率。

### 臺北捷運各站分時進出量統計

- 來源：https://data.taipei/dataset/detail?id=63f31c7e-7fc3-418b-bd82-b95158755b4d
- 整合狀態：metadata-only
- 粒度：此下載資源為每月資料連結清單；另連結每日分時各站 OD 統計
- 限制：尚未下載 OD 觀測檔；捷運進出量亦不能直接代表街道人流或公車站需求。

### 臺北市車輛偵測器(VD)靜態資料

- 來源：https://data.taipei/dataset/detail?id=47cb9090-e1c9-4b1d-b299-b11c375c5ee2
- 整合狀態：metadata-only
- 粒度：逐偵測器靜態位置、道路及車道屬性
- 限制：本版只查核靜態資料目錄，未累積尖峰歷史流量；錯峰曲線是模擬，沒有因果效果估計。

### 臺北市聯營公共汽車客運業務

- 來源：https://data.taipei/dataset/detail?id=90dd063e-2aca-49aa-a7fb-73130610313c
- 整合狀態：metadata-only
- 粒度：全市公車客運業務按統計期彙總；非逐站刷卡資料
- 限制：不能由全市年度／統計期總量推回各站需求；缺逐站上下車 OD 與駕駛實際勤務。

### 臺北市現有營造建築物棟數

- 來源：https://data.taipei/dataset/detail?id=7889e8a0-a71e-44e0-95c7-2213a7db1474
- 整合狀態：metadata-only
- 粒度：全市建築物按統計期、樓層及兩種屋齡類別彙總
- 限制：沒有逐棟地址、屋齡、結構或耐震檢測；屋齡僅未滿 30 年／30 年以上，不能推論逐棟安全。

### 臺北市各里人口數按年齡分

- 來源：https://data.taipei/dataset/detail?id=a6394e3f-3514-4542-87bd-de4310a40db3
- 整合狀態：metadata-only
- 粒度：年月 × 里 × 性別 × 單歲年齡人口統計
- 限制：只查核資料目錄，尚未整合統計或里界；人口不能直接當建築物住戶。

### 臺北市土壤液化潛勢圖

- 來源：https://data.taipei/dataset/detail?id=ec40e067-930f-4058-b7dc-71399d5f3147
- 整合狀態：metadata-only
- 粒度：土壤液化潛勢區域幾何與類別
- 限制：只查核資料目錄，未疊合幾何；液化潛勢不等於建築物損壞機率或鑑定結果。

### 臺北市政府消防局消防通道清冊

- 來源：https://data.taipei/dataset/detail?id=7a800e92-eb22-461f-b29d-8def2127a1bc
- 整合狀態：metadata-only
- 粒度：列管消防通道與搶救困難地區清冊
- 限制：只查核資料目錄，未下載或地理定位清冊；列管地區不等於逐棟搶救風險。

## 維護方式

模型來源：`topics/audit/model.js`；資料來源：`topics/audit/data/`。
共用網頁來源為 `shared/web/template/`；本站 `dist/` 為生成輸出，不直接維護分叉版本。
重建：`python scripts/build-topic-sites.py --topic audit`。
