# 0.1.24 外部拖入與 NOTE 標籤

## 操作

Finder／系統檔案管理器的檔案拖入右側視覺圖庫：

- 空白處、空資料夾的提示、一般檔案卡片／標題：匯入目前資料夾。
- 資料夾卡片，包括封面、圖示、標題等子元素：匯入該資料夾。
- 麵包屑：匯入點到的那層資料夾。

多個檔案與資料夾沿用 Obsidian 原生匯入；同名檔案使用原生另名規則，
不覆寫原檔，不移除外部來源。新檔案依原有檔案類型篩選顯示；圖庫不支援
顯示的類型仍會匯入並可在左側瀏覽器看到。

原生 importer 與 Electron 取檔案路徑位於 ExternalDrop.ts 的能力檢查邊界。
只接收 Files payload，不把網址或文字轉成任意本機檔案路徑。drop 當下擷取
File／目錄描述，批次排隊匯入。過期資料夾拒絕，不退回另一個目的地。
子目標先 preventDefault 取得處理權，父層略過，整段都不停止事件傳播。
庫內拖移仍走原有 CardDrag/FileManager 流程，外部 importer 不接管。

左側 Markdown 檔案右側新增 NOTE，直接使用原生 nav-file-tag。
新增檔案、md 大小寫、改名／更換副檔名會刷新，移除 NOTE 不影響其他類型。
沒有修改卡片 DOM、CSS、圖示、漸層、選取、工具列或既有原生歷史。

## 驗證

- Production build：357 個 Gallery 測試／532 個整體工作區測試通過。
- check-external-drop-024-native.mjs：真實 macOS Obsidian 1.14.4，可信任 Chromium
  外部 Files 拖放輸入，包含真正的磁碟 File、資料夾、二進位位元組、來源保持、
  同名另名、空白／空資料夾、筆記卡片、資料夾子元素及麵包屑；NOTE 新增與改類型。
  可用 0.1.23 加 --baseline 重現先前沒有外部匯入；--keep 可保留腳本建立的 QA024。
- 既有側欄可信任指標／鍵盤回歸、原生拖曳 ghost 追蹤及清理通過。
  卡片幾何 648 情境通過；明／暗色截圖已查看。
- 是實際應用程式／檔案系統整合，沒有以實體滑鼠從 Finder 執行手勢；
  尚未驗證 Windows Explorer 或 Android/iOS 外部拖入。原生 importer 能力仍
  依 Obsidian 版本而定，不宣稱任何未驗證平台的完整 E2E。
