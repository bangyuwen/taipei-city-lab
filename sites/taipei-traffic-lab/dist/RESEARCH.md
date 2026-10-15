# 台北錯峰通勤研究｜內湖錯峰通勤

比較同一批合成車流的累積延誤與排隊，查核錯峰通勤假設及實際資料缺口。

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
  "topicId": "traffic",
  "observationStatus": "not-loaded"
}
```

## 本題來源

### 臺北市車輛偵測器(VD)靜態資料

- 來源：https://data.taipei/dataset/detail?id=47cb9090-e1c9-4b1d-b299-b11c375c5ee2
- 整合狀態：metadata-only
- 粒度：逐偵測器靜態位置、道路及車道屬性
- 限制：本版只查核靜態資料目錄，未累積尖峰歷史流量；錯峰曲線是模擬，沒有因果效果估計。

### 臺北捷運各站分時進出量統計

- 來源：https://data.taipei/dataset/detail?id=63f31c7e-7fc3-418b-bd82-b95158755b4d
- 整合狀態：metadata-only
- 粒度：此下載資源為每月資料連結清單；另連結每日分時各站 OD 統計
- 限制：尚未下載 OD 觀測檔；捷運進出量亦不能直接代表街道人流或公車站需求。

### 市政 debug松官方題目與規則

- 來源：https://puma.taipei/hackathon
- 整合狀態：metadata-only
- 粒度：7 項議題、資料入口與模擬資料規則
- 限制：題目敘述不是觀測資料；活動列出的資料入口仍需逐項確認欄位、粒度與授權。

## 維護方式

模型來源：`topics/traffic/model.js`；資料來源：`topics/traffic/data/`。
共用網頁目前取自根目錄 `dist/`；本站 `dist/` 為生成輸出，不直接維護分叉版本。
重建：`python scripts/build-topic-sites.py --topic traffic`。
