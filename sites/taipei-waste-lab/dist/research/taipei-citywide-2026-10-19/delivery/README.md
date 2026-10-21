# 全市研究交接與首輪現勘包

完成範圍：兩份桌面交付及可填寫的現勘排程。尚未完成：實際現勘、機關承接、組員指派、實際日期、配置比較或改善驗證。

## 開始使用

1. 先讀[熱點分析交接](hotspot-handoff.md)：全市分母、12區缺口、39個錨點與使用界線。
2. 再讀[政府工作交接](government-handoff.md)：9個工作包、12區建議窗口與逐點待核權責。
3. 依[三輪現勘計畫](field-plan.md)選可用人力情境，填寫真實日期及組別；沒有承接人就保持待排。
4. 用[現勘紀錄規則](field-record-guide.md)執行並複核，保留取消、缺測和反例。

## 檔案與分工

| 檔案 | 內容 | 現況 |
|---|---|---|
| hotspot-candidates-handoff.csv | 全市36點＋校區3點，含點名、座標、活動與未知現場條件 | 桌面交付 |
| district-readiness.csv | 12區＋校區分母、缺口與時窗 | 桌面交付 |
| government-actions.json | 9工作包、12區建議窗口、來源與詢問清單 | 提案交付，未送出／未承接 |
| planned-visits.csv | 市區216筆＋校區18筆訪次；日期、觀察與結果留空 | 待排日期、未執行 |
| anchor-scope-setup.csv | 39點的範圍、地標、側別、站位與管理條件 | 待現場確認 |
| service-point-records.csv | 逐桶／逐服務點的空白附表 | 只有欄名，尚無實測 |
| field-plan-config.json | 本輪輪次、分組、15分鐘偏移及人力假設 | 排程規則，不改原分析 |
| field-plan.json／handoff-manifest.json | 計算結果、輸入雜湊與既有驗證引用 | 可重建、非現場證據 |
| government-source-checks.json | 本次官方職掌查閱紀錄與限制 | 不等於機關同意 |

CSV可用試算表開啟。英文欄位定義見現勘紀錄規則；空白結果不是0。將原始空白模板複製成另一個工作檔再填寫，避免重建命令覆寫已填紀錄。已填資料及照片保持私有，公開網站只呈現無個資的摘要。

## 重建與版本

在完整網站source checkout執行：

```sh
python3 research/taipei-citywide-2026-10-19/delivery/build_handoff.py
node --test tests/citywide-handoff.test.mjs
```

重建會覆寫此資料夾的衍生CSV、field-plan.json、交接說明及manifest，不能在已填入現場結果的唯一副本上執行。`field-record-guide.md`、政府交接文件與原始分析規則由各自來源保留。

若只有私人研究交付包，在保留鄰接研究來源的原相對位置下，可執行`python3 build_handoff.py`重建模板；網站摘要仍需完整網站source。全站明細在`../results/stations.csv`，原分析規則在`../protocol.md`。提案的正式日期、人員、預算與必要核准未被本包代填。

## PRD v0.5 journey and basket forms (2026-10-22)

The [field guide](field-record-forms.md) contains four blank sheets, the CSV field dictionary, filling rules and twelve acceptance scenarios. `templates/` contains header-only CSV files, with no measured rows. `field-record-forms.json` is the authoring source; `build_field_records.py` regenerates the templates, guide and public blank sheets. No observation input is read or published by this generator.

```sh
python3 research/taipei-citywide-2026-10-19/delivery/build_field_records.py
node --test tests/field-record-forms.test.mjs
```

Copy templates before recording fieldwork. Regeneration refuses to overwrite a template containing nonblank data rows. Recorded copies and photos remain private; the public website provides reading/printing sheets, not online storage. The existing visit schedule, candidate priorities and service-point records are unchanged. Acceptance scenarios are exercises, not field results or completed staff training.
