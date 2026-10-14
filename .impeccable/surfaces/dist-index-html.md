# 台北城市實驗室 — 操作介面整理

## Visitor mode
Operate。參賽者以垃圾桶／清潔箱配置為主線，調整情境、比對基準與匯出可重現資料；其餘六題保留作研究參考。首頁與品牌連結進入 bins，導覽將此題放在首位並標示參賽主題。使用者已說明參賽版本會另行重寫。

## Scope
沿用既有綠色城市實驗室識別，整理目前操作介面的層次與重複展示。這是既有表面的 distill／polish，不建立新的品牌或視覺世界。新增 workspace.css 作為有界的操作樣式層。

## Direction contract
- THESIS：一題、一組參數、一個主要視角；讓人先理解結果所在位置，再改條件。
- OWN-WORLD：既有深綠導覽、帶綠白底、綠色選取訊號。主要畫面有細框，指標與明細用留白和分隔線，不再各自包成大卡。
- STORY：選七題之一 → 查看街道位置或動態情境 → 調整方案 → 查比較、推薦依據與來源 → 儲存或匯出。
- FIRST VIEWPORT：左側七題導覽、上方問題與證據分類、緊湊指標列；下方左側為可切換的主要視角，右側是參數和儲存。手機依閱讀順序排列，先畫面後參數。
- FORM：既有操作工作區的 scoped refinement，沒有替換視覺世界或概念抽籤。簽名互動是地圖點位可切換到同一個 3D 位置；視角切換不改參數或指標。
- FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## States and evidence
空間題預設地圖，交通／接駁預設 3D，CSV 健檢預設圖表。每題在本次頁面生命週期記住視角。WebGL 2 不可用時退回圖表，地圖按鈕仍可使用；健檢沒有街道地圖入口。來源、合成情境與假設範圍保持可辨識。

## Verification boundary
Managed Linux 沒有 control-browser 技能。依 Sites 預覽規則，不啟動 preview server、不安裝瀏覽器、不改走其他瀏覽器 QA。實際桌機、手機與 GPU 畫面尚未驗證；Node 的 DOM stub 只驗證行為，不構成視覺通過。
