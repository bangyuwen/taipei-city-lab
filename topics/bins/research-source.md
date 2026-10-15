# 垃圾箱研究包來源

本目錄是 2026-10-15 垃圾箱清冊補查、版本比較、距離分析、文獻、服務策略與預算的唯一編輯來源。`sites/taipei-waste-lab/research/` 是獨立網站副本，由重建流程同步，不另行手動維護。

資料包保留獨立網站的相對路徑契約；包內 `../../dist/data/` 下載連結以站內副本為閱讀位置。可從[網站研究入口](https://taipei-waste-lab.bangyuwen.chatgpt.site/#research)閱讀，或查看[站內研究包](../../sites/taipei-waste-lab/research/)。來源查核腳本也應在站內副本執行。

修改本文來源、預算參數或分析協定後，在儲存庫根目錄執行：

```sh
npm --prefix sites/taipei-waste-lab run prepare-data
npm --prefix sites/taipei-waste-lab test
npm --prefix sites/taipei-waste-lab run check
```

重建會使用固定原始資料，更新可重算的分析結果、站內副本、網站下載與離線 ZIP，不向網路取得新資料。現場查核模板尚未執行，請將實際填報結果另存，避免覆寫空白模板。清冊缺列不代表撤除，座標差異不代表遷移，預算假設不代表報價。
