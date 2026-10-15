# 共用技能

`impeccable/` 是各網站共用的介面設計技能，維護一份完整來源、參考文件、launcher及授權。技能版本為4.5.2，launcher所固定的engine版本由 `impeccable/scripts/VERSION` 定義，目前為0.1.14。

`.agents/skills/impeccable` 是指向這裡的相對連結，供代理自動發現。產品、設計正文及有效sidecar集中於 `shared/docs/`；根目錄的 `PRODUCT.md`、`DESIGN.md` 與 `.impeccable/` 入口只作工具橋接，不另維護副本。`impeccable.config.json` 指定 `sites/*` 為網站工作區；共用表面的閱讀契約見[surface brief](../docs/surfaces/shared-web-template-index-html.md)。

Git checkout已附發現入口。可攜來源包只保存canonical來源，解壓後執行 `npm run setup-skills` 建立入口；此命令不覆寫既有檔案。`python scripts/setup-skills.py --check` 可檢查連結。

使用時保持工作目錄在repo根目錄，並指定實際修改的檔案或路由，例如：

```sh
shared/skills/impeccable/scripts/impeccable context --target shared/web/template/index.html
```

launcher使用指定的 `IMPECCABLE_BIN`、既有版本快取或下載經SHA-256驗證的固定版本engine；二進位不納入Git或下載包。只在介面設計任務使用此技能，搬移工具不代表完成設計驗收。舊QA、截圖及額外Git備份不屬於技能來源。

共用模板的設計規則適用於整合站及六個生成站；垃圾箱獨立站沿用自己的介面與導覽。技能授權及第三方參考出處見[LICENSE](impeccable/LICENSE)和[NOTICE](impeccable/NOTICE.md)。
