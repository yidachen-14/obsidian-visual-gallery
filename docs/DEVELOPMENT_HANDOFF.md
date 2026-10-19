# Visual Gallery 開發交接

更新日期：2026-10-20。交接發行基準：**0.1.25**。

## 換一台電腦繼續

GitHub：https://github.com/yidachen-14/obsidian-visual-gallery

安裝 Git、Node.js 22、pnpm 10.12.1，然後：

```sh
git clone https://github.com/yidachen-14/obsidian-visual-gallery.git
cd obsidian-visual-gallery
pnpm install --frozen-lockfile
pnpm run build
```

在 Codex 加入這個資料夾，開新對話，貼上下面的接手提示即可。
不需要搬移整個 Codex 歷史資料庫，也不需要複製 node_modules。
程式碼／文件由 Git 保存；對話、帳戶登入、工具與本機測試環境另行管理。
日後兩台輪流開發，換機前提交並推送；另一台先檢查本機修改，再拉取遠端更新。
若 main 已比 0.1.25 新，先讀差異，不要為了本交接檔重設或覆寫後續工作。

## 可貼到新對話的提示

> 請接續開發目前資料夾中的 Visual Gallery Obsidian 外掛。
> 先讀 AGENTS.md、README.md、RELEASE_NOTES.md 和本交接檔，然後讀
> docs/EXPLORER_021.md、EXPLORER_022.md、EXPLORER_023.md、EXPLORER_024.md、CRAFT_025.md。
> 先確認 git 狀態、manifest 版本與最新遠端提交，保留既有本機修改。
> 本交接發行基準為 0.1.25；不要覆寫任何已發布版本。
> 保留已定稿的三模式、格式化預覽、三段切換與三個動作按鈕、互動及 18 語言，不重設無關外觀。
> 修改卡片 DOM/CSS 前必須先讀 docs/CARD_GEOMETRY.md 並遵守驗證契約。
> 先建立可重現問題，在一次性 Obsidian 測試庫驗證修正；不要動正式筆記庫。
> 請先完成我接下來指定的修改。發布則依當次使用者指示執行。

## 已確定的操作

- 左側是外掛自己的原生 Files view 實例，可看到 Obsidian 已載入的所有檔案。
  原生 Files 頁籤、設定及其折疊狀態保持獨立。
- 資料夾一般左鍵點擊（名稱、數量、列空白）選取並跳轉既有右側圖庫，不切換展開。
  滑鼠只有點左側 disclosure 圖示／箭頭才收合／展開，且不跳轉；保留原生鍵盤操作。
- 靜止顯示關閉／開啟資料夾圖示；hover 顯示向右／向下箭頭。右側是遞迴檔案總數。
- 檔案單擊選取；雙擊或 Enter 開新分頁；修飾鍵選取、原生右鍵選單和拖放保留。
  Markdown（md 不分大小寫）列右側顯示 **NOTE**，沿用 CANVAS 等原生類型標籤樣式。
- 頂部主庫 Home 回到頂層。資料夾可用原生右鍵釘選，首頁下方提供常用資料夾捷徑。
- Finder／系統外部 Files 拖到圖庫空白、空資料夾提示、一般檔案卡片，匯入目前資料夾；
  拖到資料夾卡片或麵包屑（含子元素）則匯入該資料夾。使用原生另名規則、保留來源，
  同一個 drop 只匯入一次。圖庫未支援顯示的檔案仍可匯入，於左側瀏覽。
- 庫內拖移使用既有原生 drag manager + FileManager，外部匯入不接管內部 drag。
  dragover/drop 可以 preventDefault，但絕不停止傳播，確保原生 ghost 追蹤與清理。
- 資料夾卡片、麵包屑使用相同 leaf 的公開 setViewState 與原生歷史。沒有自建歷史堆疊，
  不攔截滑鼠側鍵，不在 production 呼叫私有歷史方法。
- 工具列為瀑布／網格／列表三段切換，後接三個動作：新增、排序、篩選。新增的選單順序為筆記、Canvas、資料夾。
  卡片是一個裁切表面加一層外側描邊；既有圖示、獨立明暗漸層與選取樣式已有契約。

## 設定與本機狀態

共享：語言、標題、圖示、顏色、metadata、預設排序／篩選、收藏。
本機：每資料夾顯示模式、各模式捲動與上次瀏覽、目前資料夾與當頁排序／篩選、捲動、卡片寬度、側欄偏好、目錄展開／捲動、收藏區收合。

data.json 含共享設定與版本化合併狀態；sync-state/<device>.json 是各裝置的共享快照；
另有 App local storage 副本及本機瀏覽狀態。外掛沒有新增自己的雲端同步服務，仍需
原有 vault 同步工具傳輸外掛設定。欄位分開合併，取消釘選有刪除紀錄，詳見 EXPLORER_022。
安裝包與 GitHub 不包含使用者的 data.json、快照、本機狀態或筆記庫。

## 程式位置與相容邊界

- GalleryView.ts：圖庫、原生歷史、卡片事件、目標註冊、捲動錨點。
- DisplayMode.ts：三段切換、瀑布定位與幾何方向鍵。NotePreview.ts：有界格式化預覽與卸載。
- state/DisplayPreferences.ts：每資料夾模式／捲動與最近瀏覽，只存本機。
- ExternalDrop.ts：外部拖入。能力檢查後使用 host 的 importAttachments，桌面上按需取
  Electron webUtils 的 File 路徑，目錄由原生 importer 處理；不解析文字／網址為本機路徑。
  同步擷取 drop 資料、保留資料夾物件身分、匯入批次排隊；失敗可恢復後續批次。
- GalleryExplorer.ts：獨立原生 Files view 的 API adapter。ExplorerAppearance.ts：首頁、
  開關圖示、總數與 NOTE。ExplorerFavorites.ts：收藏。CardDrag.ts：庫內拖移與預檢。
- state/SettingsSync.ts、SharedState.ts、LocalState.ts：共享合併與本機狀態。
- canvas/、thumbnails/、cache/：整張 Canvas、圖片／Markdown／PDF 縮圖與可丟棄快取。

上述私有 host API 都需能力檢查及實際 Obsidian 驗證；不可把它們當作穩定公開 API。

## 測試與證據界線

0.1.25 新驗證與腳本見 **CRAFT_025.md**：三模式、格式化預覽、本機模式／重載、
捲動錨點、六按鈕窄面板、三模式外部拖放、明暗所有狀態截圖通過。
幾何為 648 個既有情境＋1,944 個 Craft 情境，全部零失敗；保留小數尺寸與 zoom 矩陣。
新的側欄與三模式尚未通過 iOS/Android Obsidian 實機驗證，不能宣稱手機完整 E2E。
以下為 0.1.24 功能的歷史驗證紀錄；歷史腳本不改寫成新版本證據。

0.1.25：公開 Gallery 專案 **382 測試／26 suites** 通過 production build。
舊電腦混合工作區有 557 測試（含另一個外掛），不要要求單獨 clone 得到該總數。

真實 macOS Obsidian 1.14.4、一次性庫驗證：

- Chromium 的可信任外部 Files 拖放輸入，使用磁碟上的真正 File／目錄，驗證多檔、
  二進位完整性、來源不變、同名另名、空白／空資料夾、筆記卡片、資料夾子元素、麵包屑。
- NOTE 新建／改類型；既有指標／鍵盤、收藏、第三方選單、原生來源、單擊／雙擊、
  文件夾列不切換及箭頭切換。明暗截圖已查看；648 個卡片幾何情境通過。
- 0.1.23／0.1.24 前後原生 ghost：各 12 圖庫＋6 側欄檢查，零凍結、零清理失敗。

外部拖入測試工具已納入 repository：

```sh
node scripts/check-external-drop-024-native.mjs 9237
```

前提：桌面 Obsidian 在獨立 user-data-dir 的一次性庫執行、啟用外掛與 Files 核心外掛，
並以 --remote-debugging-port=9237 開啟測試 renderer。測試庫名稱／路徑需含
visual-gallery-qa、visual-gallery-drag 或 visual-gallery-explorer- 識別。
腳本拒絕覆寫已存在的 QA024，建立自己的測試內容，結束後刪除；--keep 可保留它，
--baseline 可在 0.1.23 重現舊問題。截圖／結果寫入忽略的 artifacts/。
僅在隔離本機測試 profile 開啟偵錯埠。這是實際應用整合，沒有以實體滑鼠從 Finder 執行。

新增側欄／外部拖入未完成 Windows Explorer、Android/iOS 實機 Obsidian 驗證。
跨裝置合併有自動化模擬，未使用兩台實體裝置與真實雲端帳戶完成同步驗證。
不要把這些未驗證事項寫成已驗證的 E2E。

部分 AGENTS.md 提及的歷史 QA 腳本、畫面與發布工作紀錄只保存在舊電腦。
缺少的測試需重建相應驗證或明說界線，不能假裝已跑；單元／browser fixture 不能代替
原生應用驗證。新的程式碼、測試、核心契約及本文件都可從 GitHub 取得。

## 再次發布

依當次指示遞增 patch；0.1.25 後通常是 0.1.26，先查遠端避免撞版。
更新 package.json、manifest.json、versions.json、版本斷言與 RELEASE_NOTES。
完整 build、必要原生驗證，提交／推送；GitHub CI 必須通過。
發布精確對應來源的 main.js、manifest.json、styles.css 三檔，核對 SHA256。
已發布版本不可覆寫。安裝 ZIP 是 runtime 發行包；開發仍以 GitHub source 為準。

GitHub 與 Obsidian Community 管理頁需在新電腦重新登入／配置自己的權限。
GitHub Release 完成後檢查官方新版本，等 review Completed 與 build reproduction Pass，
再確認公開 https://community.obsidian.md/plugins/visual-gallery 的版本號。
不要把公開頁更新宣稱為已在每台裝置原生更新器安裝驗證；不要把帳密或 token 寫入來源。
