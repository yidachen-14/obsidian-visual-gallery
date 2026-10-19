# Craft 式三模式顯示 — 0.1.25

日期：2026-10-20。使用者批准復現 Craft 的卡片呈現，並加入三段式圖示切換器。
觀察來源見 CRAFT_DISPLAY_RESEARCH.md；是獨立實作，未複製 Craft 程式碼或素材。

## 定稿與行為

- 工具列在新增／排序／篩選之前，增加瀑布／網格／列表三段切換。預設網格。
  保留原三個動作、原生選單與既有順序。切換是可用方向鍵／Home／End 操作的 radio group。
- 網格統一 5:4；瀑布等欄寬、以最短欄放置下一筆，依內容量／媒體比例限高。
  DOM 與 Shift 範圍選取維持排序順序；方向鍵依實際卡片位置移動。
  使用小數寬度計算欄數，避免 clientWidth 四捨五入造成少一欄。
- 筆記上方標題、分隔線、縮小的格式化 Markdown，下緣漸隱。保留標題／清單／表格／
  程式碼／本機圖片；明確 cover 優先，未指定時不再將第一張圖單獨抽作封面。
  Canvas 保留整張 contain，圖片保留比例，PDF 保留第一頁。資料夾置中顯示圖示、名稱與數量。
- 列表為小預覽、名稱、單行摘要，上次瀏覽／修改／建立日期。metadata 關閉時隱藏日期。
  窄面板逐步省略日期欄。上次瀏覽由 file-open 實際紀錄，沒有紀錄時顯示破折號。
- 每資料夾的模式、各模式捲動位置與上次瀏覽只存在 App local storage，不寫入共享 data.json。
  切換保留選取／排序／篩選；跨模式以可見檔案作錨點，在非同步預覽重排時持續固定，
  開始新捲動／指標／鍵盤手勢才釋放。重開恢復本機當頁捲動。
  資料夾切換走原生歷史；無平行歷史堆疊。重新命名／刪除同步整理本機路徑索引。
- 18 語言包含全部切換與日期標籤，圖示 aria-hidden、工具提示與 accessible name 完整。
  外側描邊契約未變，焦點使用同一描邊層；既有自訂漸層設定仍保留。

## 結構與限制

DisplayMode.ts 提供切換器、瀑布與幾何鄰居；DisplayPreferences.ts 管理本機狀態，
保留最多 500 資料夾與 2,000 瀏覽項目。多 leaf 寫入前重讀並合併。
NotePreview.ts 使用公開 MarkdownRenderer/Component，最多同時 2 個工作、前 100 行／
8,000 字元，跨 render generation 取消舊工作並卸載 Component。預覽 inert，不接受連結或表單操作。
禁止展開筆記 transclusion、移除常見 dataview/tasks/query fence 與直接遠端圖片。
這不是任意第三方 Markdown postprocessor 的沙箱；重型插件、特殊語法或特殊外部引用
不保證完全還原。大圖／大量筆記的真機效能仍需按使用者資料量觀察。

## 可重現驗證

Production build：公開 Gallery 382 測試／26 suites；混合工作區 557／42 suites。
單元涵蓋瀑布無重疊／小數尺寸、鄰居定位、18 語言、本機合併／重命名、預覽限制。

真實 macOS Obsidian 1.14.4 隔離 profile：

- check-craft-025-native.mjs：Showcase 38 項（三十四筆記、兩圖、一畫布、一資料夾），
  三模式等高／變高／無重疊、保留選取、格式化表格與清單、每資料夾模式、plugin reload、
  真實 file-open 時間與 radio 鍵盤切換。180/250/360/720/980 viewport 控制不溢出。
- check-craft-025-states.mjs：中段捲動切換錨點、排序與篩選保留；三模式明暗色的
  normal/selected/hover/focus/drop 畫面已人工查看，包括四角與下方圓角。
- check-craft-025-geometry.mjs：原始 check-card-geometry.js 648/0；Craft 三模式各 648/0。
  明暗、180/190/210/220/250/360 寬、125%/150% zoom、metadata 開關、混合標題，
  小數高度與普通／選取／拖入狀態。是實際 host CSS 的離屏 fixture，不能稱為應用 E2E。
- check-external-drop-025-native.mjs：VG_QA_MODE=grid/masonry/list 各通過多檔、目錄、
  同名另名、來源／位元完整性、筆記卡片、資料夾子元素、麵包屑與 NOTE 改類型。
  check-explorer-025-pointer.mjs：既有側欄、釘選、原生／第三方選單、雙擊新分頁通過。
- 本機 native ghost 前後檢查通過；0.1.25 為 21 圖庫＋9 側欄，零停滯、零清理失敗。

腳本參數為獨立 Obsidian 的 CDP 埠（預設 9237），只在一次性庫執行。
Craft native/states 腳本需預先準備上述 Showcase 與 Projects 測試內容，庫路徑含
visual-gallery-explorer-；geometry 只需啟用外掛。external-drop 自建／刪除 QA025，
拒絕覆寫已存在資料夾。結果寫入忽略的 artifacts/，不隨 source 發布。

可信任 Chromium 外部拖放使用磁碟上真實檔案；focus/viewport 有模擬，ghost/state 部分
採合成 DragEvent。未用實體滑鼠由 Finder 操作。Windows、Android/iOS Obsidian 的新三模式
尚未實測，不將桌面結果等同手機相容性證明。
