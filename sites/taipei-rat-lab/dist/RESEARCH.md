# 台北鼠患源頭研究｜鼠患源頭治理

區分通報、現勘與合成街廓，研究源頭查核、改善及複查的安排。

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
  "topicId": "rat",
  "observationStatus": "not-loaded"
}
```

## 本題來源

### 臺北市陳情系統類別資料

- 來源：https://data.taipei/dataset/detail?id=cb423c17-88eb-4231-a725-f1b93247d1bf
- 整合狀態：metadata-only
- 粒度：逐案分類、受理與結案日期；無地址或經緯度
- 限制：欄位沒有地址或座標，無法直接製作通報熱點；通報量也不等於實際事件發生率。

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

## 維護方式

模型來源：`topics/rat/model.js`；資料來源：`topics/rat/data/`。
共用網頁來源為 `shared/web/template/`；本站 `dist/` 為生成輸出，不直接維護分叉版本。
重建：`python scripts/build-topic-sites.py --topic rat`。
