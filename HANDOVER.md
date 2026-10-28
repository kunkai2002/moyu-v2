# 魔芋一夏 · 交接文件

## 這是什麼
Windows 桌面番茄小說閱讀器 + 手機 PWA，偽裝成程式編輯器（Claude Code 風）。同步、手機版、**程式熱更新**都放在 Cloudflare。

## 位置
- 專案：`D:\kun-workspace\moyu-v2`（git，remote `github.com/kunkai2002/moyu-v2`，public）
- 安裝：`C:\Users\Admin\AppData\Local\Programs\魔芋一夏`（啟動捷徑 → `wscript tools\launch.vbs`，無黑窗）
- 使用者資料：安裝目錄下 `data\`（progress / marks / stats / prefs / sync / window.json、chapters 快取、update.log）
- 雲端：Worker `https://moyu-sync.qiaoyuhua2002.workers.dev`，D1 `moyu-sync`，金鑰在 `sync/.token`（gitignored）

## 架構
- 桌機：`main.js`（Electron，IPC 為主）＋ `server.js`（僅給瀏覽器/除錯用）＋ `ui\*.js`（無框架，模組式注入）
- 抓取：`src/fanqie.js`（網頁 + PUA 解碼）、`src/shelf.js`（書架官方 API）
- 手機：`sync/m/`（純 HTML/CSS/JS）由 Worker 供應 `/m/`，讀寫同一組 API
- 同步：`src/sync.js` ↔ `sync/worker.mjs`（LWW；`force:true` 可強制覆蓋）
- **熱更新**：`src/updater.js` ↔ Worker `/app/manifest`、`/app/file`、`/app/publish`（D1 `app_files` / `app_meta`）

## 常用指令
```powershell
node tools/check-all.js            # 全套 11 套檢查（隱藏視窗，不彈窗）
node tools/check-all.js --quick    # 跳過雲端三套
node tools/pack4.js                # 打包到 dist\魔芋一夏
node tools/publish-app.js          # 發佈到雲端（桌面版＋手機版，改完就該跑）
node tools/publish-app.js --dry    # 只看會傳幾個檔案
node tools/build-mobile-assets.js  # 改完 sync/m/* 後跑（Worker 靜態備援用）
cd sync; npx wrangler deploy       # 只有改 Worker 本身才需要
```

## 更新怎麼走（2026-10-28 起）
1. 改完 → `node tools/pack4.js` → 複製到安裝目錄（`ui\*`、`src\*`、`tools\*`、`main.js` 等）
2. `node tools/publish-app.js` → 推到 Cloudflare
3. 桌面版開機 5 秒後、之後每 30 分鐘自己比對雜湊，只抓不一樣的檔案
   - 只有 `ui\*.js|css` 變 → 視窗 reload，**程式不用關**
   - `main.js` / `src\*` 也變 → 檔案先落地，下次開啟就是新版
4. 手機版 `/m/` 直接吃雲端那份，重新整理就是新版（不用再 wrangler deploy）

## 目前狀態
可用：掃碼登入、書架、閱讀、章節自動連讀（**一次滑動只接一章**）、右鍵選單（記住進度/劃線/筆記/複製/搜尋）、
首頁、歷史、標記、統計、全書搜尋、匯出、老闆鍵 `Alt+Q`、六套主題、四處可拖、視窗狀態記憶、
雲端同步、雲端熱更新、手機 PWA（書架/閱讀/接章/劃線/進度/字級 A−A+/離線快取）。

限制：
- 番茄 APP 網關（`/reader/full/v`）已失效，付費章節只有約 150 字試讀（兩端一致）
- 手機憑證在網址 fragment（`#t=`），不要貼給別人
- `tools/update.cmd`（git pull + xcopy）留著當備援，xcopy 那句的資料夾名是壞的，實際上不太會動

## 下一步（優先）
1. 手機離線快取要在真手機上驗一次（Service Worker 只能在 https/localhost 註冊，Worker 是 https 沒問題）
2. 手機接章的手勢判斷還是舊寫法（`userGesture`），可以照桌機 v5 那套收斂
3. `tbDetail` 已移出頂欄；書架卡片的「書籍詳情」只給卡片上看得到的資料，要不要顯示章節數再想
4. 本機 `data\progress.json` 還留著測試書 `7373660003258862617`（第 7 章），要不要清掉由 JOJO 決定
5. 雲端 `玄阙尘光` 那本書有 2 筆真人劃線（device=phone），沒動
