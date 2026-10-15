# 台北樹蔭研究

從行道樹快照、熱暴露與步行需求的證據缺口，研究補樹順序與公平取捨。

這是 `shade` 的獨立靜態網站。`dist/` 包含本站使用的程式、模型、字型、供應商套件與專屬資料快照，不讀取其他站的檔案。

## 單獨啟動

```sh
cd sites/taipei-shade-lab
python -m http.server 8000 --directory dist
```

開啟 `http://localhost:8000/`。模型、圖表、來源與匯出功能不需要 CDN；街道底圖是 OpenStreetMap 連網服務，無網路仍可使用模型與圖表。

## 修改與重建

- 題目模型：`topics/shade/model.js`。
- 題目資料與證據：`topics/shade/data/`。
- 共用模型工具：`shared/lib/`。
- 共用網頁模板：`shared/web/template/`；本站入口與品牌配置在 `shared/web/topic-sites.json`。
- 生成器：`scripts/build-topic-sites.py`。本站 `dist/` 是生成輸出，請修改來源後重建。

從 repository 根目錄執行：

```sh
python scripts/build-topic-sites.py --topic shade
python scripts/build-topic-sites.py --check --topic shade
```

只有本題註冊在 `dist/registry.js`。每站使用自己的 localStorage key、資料快照與研究包；不含七題首頁、跨題導覽或其他題目的下載包。通用 CSV 與 3D 動畫可能共用演算法 helper，但不註冊其他題目或載入其觀測資料。

`.openai/` 是此站自己的託管設定；生成器不會改寫它，也不會自動部署。
