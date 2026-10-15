# 原始 Git 提交紀錄備份

本 repository 的主分支透過 GitHub MCP 匯入專案。原始七次提交的完整 Git 物件保存在 `taipei-city-lab.bundle`；它們不會因此成為 GitHub 主分支的原生提交紀錄。

- 原始分支：`main`
- 原始 HEAD：`0f11bd802de014c509242f6035f43909e9f33945`
- 原始提交數：7
- bundle SHA-256：`39c76e3a35e8b36d7a6c443d0e544026e336819ed3fb68d50d73866e4f48e225`

## 還原與驗證

在本 repository 的根目錄執行：

```bash
git bundle verify archive/git-history/taipei-city-lab.bundle
git clone --branch main archive/git-history/taipei-city-lab.bundle ../taipei-city-lab-history
git -C ../taipei-city-lab-history log --oneline
git -C ../taipei-city-lab-history rev-parse HEAD
```

還原目錄包含原始七次提交，最後 HEAD 應與上面的 SHA 相同。這份備份已以獨立 clone 驗證提交數、HEAD 及完整檔案樹。

歸檔日期：2026-10-15。本次保留 bundle 原始 bytes 與 SHA-256；上列獨立 clone 的驗證敘述屬建立備份時的紀錄，不表示目錄搬移後重新執行 clone。可攜網站原始碼下載包不含此 bundle，需要原始 Git 歷史時請從 repository 另取。
