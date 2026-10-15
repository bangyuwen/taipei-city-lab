# 台北社區健檢研究｜社區健檢排序

研究社區文件補查、專業轉介與追蹤順序；模型排序不代表建物安全評級。

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
  "scope": "僅載入本題已查核的來源目錄，尚未整合觀測資料；互動情境不得視為真實通報、車流、需求或逐棟紀錄。",
  "coordinateSystem": "EPSG:4326; x=longitude, y=latitude",
  "sampled": false,
  "topicId": "buildings",
  "observationStatus": "not-loaded"
}
```

## 本題來源

### 臺北市現有營造建築物棟數

- 來源：https://data.taipei/dataset/detail?id=7889e8a0-a71e-44e0-95c7-2213a7db1474
- 整合狀態：metadata-only
- 粒度：全市建築物按統計期、樓層及兩種屋齡類別彙總
- 限制：沒有逐棟地址、屋齡、結構或耐震檢測；屋齡僅未滿 30 年／30 年以上，不能推論逐棟安全。

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

### 臺北市各里人口數按年齡分

- 來源：https://data.taipei/dataset/detail?id=a6394e3f-3514-4542-87bd-de4310a40db3
- 整合狀態：metadata-only
- 粒度：年月 × 里 × 性別 × 單歲年齡人口統計
- 限制：只查核資料目錄，尚未整合統計或里界；人口不能直接當建築物住戶。

### 市政 debug松官方題目與規則

- 來源：https://puma.taipei/hackathon
- 整合狀態：metadata-only
- 粒度：7 項議題、資料入口與模擬資料規則
- 限制：題目敘述不是觀測資料；活動列出的資料入口仍需逐項確認欄位、粒度與授權。

## 維護方式

模型來源：`topics/buildings/model.js`；資料來源：`topics/buildings/data/`。
共用網頁目前取自根目錄 `dist/`；本站 `dist/` 為生成輸出，不直接維護分叉版本。
重建：`python scripts/build-topic-sites.py --topic buildings`。
