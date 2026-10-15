# 台北城市實驗室整合站

這是原本七題整合網站的部署目錄，保留既有 Site 身分及操作。各題獨立網站位於其他 `sites/taipei-*-lab/` 目錄；搬移不會建立新網站或改變存取權限。

## 本機啟動

```sh
cd sites/taipei-city-lab
python -m http.server 8000 --directory dist
```

開啟 `http://localhost:8000/`。套件、模型、觀測快照與字型都由本站提供；OpenStreetMap 街道圖磚需要網路。

## 來源與重建

- `shared/web/template/`：手工維護的共用 UI、品牌元件與靜態資產。
- `shared/lib/`：共用地理、資料契約與空間模型工具。
- `topics/<id>/model.js` 與 `topics/<id>/data/`：各題模型與資料的 canonical 來源。
- `shared/data/`：共用快照中繼資料與來源。
- 本站 `dist/`：部署產物，不作為單題站的建置輸入。
- 本站 `.openai/hosting.json`：從舊位置原樣搬入的 Site 設定；建置不會修改它。

模板內既有的 Markdown 研究下載檔保留歷史版本內容，讓既有下載網址及內容維持一致；研究文件的維護來源以 `shared/docs/` 與各題 `topics/<id>/docs/` 為準。

從 repository 根目錄執行：

```sh
python scripts/build-integrated-site.py
python scripts/build-integrated-site.py --check
```

生成器只使用 Python 標準函式庫與 repository 內已保存的來源，離線重建不需下載資料。`npm run build` 會重建整合站、六個單題站及垃圾箱獨立站。完整原始碼下載包由 `scripts/package-source.py` 另外產生，`source.zip` 不屬於模板來源。
