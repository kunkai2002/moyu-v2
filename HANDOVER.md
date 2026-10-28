# 魔芋一夏 · 交接文件

## 這是什麼
Windows 桌面番茄小說閱讀器 + 手機 PWA，偽裝成程式編輯器（Claude Code 風）。同步與手機版都放在 Cloudflare。

## 位置
- 專案：`D:\kun-workspace\moyu-v2`（git，remote `github.com/kunkai2002/moyu-v2`，public，已推 `55581f6`）
- 安裝：`C:\Users\Admin\AppData\Local\Programs\魔芋一夏`（啟動捷徑 → `wscript tools\launch.vbs`，無黑窗）
- 使用者資料：安裝目錄下 `data\`（progress / marks / stats / prefs / sync / window.json、chapters 快取）
- 雲端：Worker `https://moyu-sync.qiaoyuhua2002.workers.dev`，D1 `moyu-sync`，金鑰在 `sync/.token`（gitignored）

## 架構
- 桌機：`main.js`（Electron，IPC 為主）＋ `server.js`（僅給瀏覽器/除錯用）＋ `ui\*.js`（無框架，模組式注入）
- 抓取：`src/fanqie.js`（網頁 + PUA 解碼）、`src/shelf.js`（書架官方 API）
- 手機：`sync/m/`（純 HTML/CSS/JS）由 Worker 供應 `/m/`，讀寫同一組 API
- 同步：`src/sync.js` ↔ `sync/worker.mjs`（LWW；`force:true` 可強制覆蓋）

## 常用指令
```powershell
node tools/check-all.js          # 全套 10 套檢查（隱藏視窗，不彈窗）
node tools/check-all.js --quick  # 跳過雲端兩套
node tools/pack4.js              # 打包到 dist\魔芋一夏
cd sync; npx wrangler deploy     # 部署 Worker
node tools/build-mobile-assets.js  # 改完 sync/m/* 後必跑，否則 Worker 拿到舊版
```

## 目前狀態
可用：掃碼登入、書架、閱讀、章節自動連讀、右鍵選單（記住進度/劃線/筆記/複製/搜尋）、
首頁、歷史、標記、統計、全書搜尋、匯出、老闆鍵 `Alt+Q`、六套主題、四處可拖、視窗狀態記憶、
雲端同步、手機 PWA（書架/閱讀/接章/劃線/進度）。

限制：
- 番茄 APP 網關（`/reader/full/v`）已失效，付費章節只有約 150 字試讀（兩端一致）
- 手機憑證在網址 fragment（`#t=`），不要貼給別人

## 下一步（優先）
1. 手機：字級 A-/A+ 按鈕、離線快取（Service Worker）
2. 桌機：`tbDetail`（書籍詳情）是否併入首頁
3. 清掉雲端幾筆測試留下的 `device=phone` 進度（`聽师兄下山`、`停尸房` 等）
