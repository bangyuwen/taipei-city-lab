# 模型指標與來源定義

以下定義適用於目前的合成情境比較，不能直接當作實際政策成效。各題的原始觀測與限制見[資料查核](data-review.md)。

## 指標定義

| 指標 | 分子／計算 | 分母／時窗 | 解讀限制 |
|---|---|---|---|
| 合成需求服務率 | 距離門檻內的需求權重 | 同範圍全部合成需求權重 | 不是實測人流、樹蔭或真實步行可達率 |
| 新增桶每日清運工時 | 新增桶數 × 每次分鐘 × 每日次數 / 60 | 每日；僅新增桶 | 不含既有設施工時、溢滿或實際路線最佳化 |
| 車輛小時 | 每分鐘末排隊車數加總 / 60 | 到達開始至佇列清空 | 分鐘離散模型的延滯，非總行車時間 |
| 排隊持續時間 | 分鐘末排隊 > 0 的分鐘數 | 同上 | 不表示路口實測壅塞或物理隊長 |
| 全體累積候車 | 每分鐘末留站人數加總 / 60 | 08:00（含）至 10:00（不含） | 含未上車者時窗內等待，未含時窗後等待 |
| 10:00 留站 | 時窗末尚未搭載的人數 | 同一批合成需求 | 和已搭載者平均等待一起看，避免忽略服務缺口 |
| 逾期追蹤 | 狀態為待複查／追蹤且期限早於基準日 | 24 個合成個案 | 本機流程提示，不是官方治理成效 |

沒有實測試辦基準，故未任意承諾降溫、鼠患下降、減少塞車或安全改善目標。下一步應先取得題目對應的觀测粒度與現勘資料，再校準模型及預先定義試辦觀測方式。

## 查閱過的官方案例與標準

- [American Forests Tree Equity Score](https://www.americanforests.org/tools-research-reports-and-guides/tree-equity-score/)：公平規劃須包含社會需求與環境資料；本版沒有直接移植其權重。
- [NYC DSNY 公共垃圾桶](https://www.nyc.gov/site/dsny/what-we-do/cleaning/litter-baskets.page)：配置須與清運服務一起考量；非台北設置規則。
- [NYC 衛生局鼠患通報資料故事](https://a816-dohbesp.nyc.gov/IndicatorPublic/data-stories/rat-complaints/)：通報與檢查、治理追蹤應區分。
- [FHWA 交通分析績效指標](https://ops.fhwa.dot.gov/publications/fhwahop18013/chap5.htm)：總延滯與佇列需補充單一平均數。
- [GTFS 頻率班表範例](https://gtfs.org/documentation/schedule/examples/frequencies/)：頻率描述不等於已驗證現場營運。
- [國震中心 TEASPA](https://teaspa.ncree.org.tw/Home/Download)：專業評估需要結構資料與評估程序；本版不做安全評級。
- [W3C PROV Data Model](https://www.w3.org/TR/prov-dm/)：保存來源、轉換、時間與條件以利追溯；本版不宣稱完整 PROV 相容。

原始數據與來源粒度見[資料查核](data-review.md)，各題方法與證據缺口見[研究對照](research-review.md)。
