# 七題研究對照與審查修訂

研究日期：2026-10-13。以下以官方文件及工具作者資訊為依據；國外制度與資料不能直接移植成台北的政策成效。本版仍是研究原型。

| 題目 | 來源與實務觀察 | 對我們設計的判斷 | 正式版先補什麼 |
|---|---|---|---|
| 樹蔭公平 | [American Forests Tree Equity Score](https://www.americanforests.org/tools-research-reports-and-guides/tree-equity-score/) 使用樹冠、地表溫度與人口社經條件 | 樹點可及代理適合展示配置，不足以宣稱遮蔭公平 | 樹冠／影像、熱暴露、需求、可施工候選及生長期 |
| 清潔箱 | [NYC DSNY](https://www.nyc.gov/site/dsny/what-we-do/cleaning/litter-baskets.page) 把商業／混合區、交通節點與清運路線納入設置考量 | 配置與維運應共同評估；只最大化覆蓋會漏掉收運負擔 | 步行路網、人流代理、滿溢時間、候選限制與清運成本 |
| 鼠患 | [NYC Health 通報與現勘流程](https://a816-dohbesp.nyc.gov/IndicatorPublic/data-stories/rat-complaints/) 查近期現勘、鼠跡與棲地條件，並做改善後複查 | 重點應是工作流程與現勘證據；通報件數可能受回報習慣與重複通報影響 | 通報定位／去重、現勘結果、源頭改善工作、複查時限 |
| 內湖交通 | [FHWA 瓶頸分析](https://ops.fhwa.dot.gov/publications/fhwahop18013/chap5.htm) 納入延誤、排隊、旅行時間、上下游與可靠度 | 錯峰模擬需保留尾段與排隊；不能只看較低的尖峰 | 歷史 VD、旅行時間、企業試辦、對照日與路網回堵 |
| 公車 | [GTFS 班距型服務](https://gtfs.org/documentation/schedule/examples/frequencies/) 描述服務頻率與站間相對時間 | 時刻／班距是供給，不是需求；單站模型只能作局部排程研究 | 實際班表、站點 OD、旅行時間、車輛勤務與轉乘限制 |
| 危老健檢 | [NCREE TEASPA](https://teaspa.ncree.org.tw/Home/Download) 提供專業技術文件、輸入樣板及詳細評估報告 | 查勘排序與結構安全判定是不同工作，分數只用於安排資源 | 逐棟構造與文件、專業現勘、檢測及後續處理紀錄 |
| 資料健檢 | [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) 說明資料實體、活動、衍生與責任追溯 | 可追溯且能重做的報告比單一品質分數有用 | 來源版本、問題、轉換、粒度、時區及檢查條件 |

額外實作參考：[Google Routes 路線矩陣](https://developers.google.com/maps/documentation/routes/compute_route_matrix) 支援起迄點路線距離與時間矩陣；需保留配對索引及逐路線錯誤，不能把無路線當成距離零。[TDX 官方 API 文件](https://tdx.transportdata.tw/api-service/swagger) 可作交通資料入口，仍要核對授權、可取欄位與歷史覆蓋；本版沒有新增金鑰、付費 API 或即時資料呼叫。

## 三輪審查的結果

第一輪檢查事件時序與報告狀態。新增測試重現：參數尚未重算就匯出舊 CSV、快速切題後參數未保存、重設後延遲工作未取消，以及健檢切頁失去問題／日期、修改資料仍能匯出舊報告。已修正同步與失效處理。

第二輪對照官方方法及追溯要求。CSV 報告補存原問題、基準日、日期欄、時區與新鮮度門檻。台北時間與 UTC 可各自用日曆日比較；未標時區的時間字串依選定時區解讀，屬明示假設，不替來源補上已確認時區。

第三輪核對資料呈現、回歸與發佈。公車圖表標示需求／搭載比較，避免被解讀成不存在的政策基準；模型資料缺口保留，未套用國外工具的評分或聲稱實證成效。原始碼包及來源目錄與本次修訂同步。

## 仍需實際驗證的部分

沒有進行實際瀏覽器／手機渲染或截圖驗收。所有模型的現地適用性仍需真實需求、候選限制、專家校準及試辦觀測。這些不是增加程式測試就能補足的證據。
