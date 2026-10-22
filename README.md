# 魔芋一夏 v2

長得像 Claude Code / VS Code / Excel 的番茄小說桌面閱讀器。
電腦上直接開書、抓真文字、接著上次讀、一鍵切換偽裝主題。

> 上一版（`phone-cast-shell`）是把投屏視窗塞進假對話框；
> 這一版是**真的讀到文字**，所以能串流、能選取、能搜尋、能記進度。
> 全文走 APP 網關，**不用登入、不用 SVIP、沒有廣告**。

## 拿到什麼就跑

```
dist\魔芋一夏-v2.zip          ← 解壓，雙擊「啟動.cmd」
```

需求：Windows 10/11 ＋ Node.js 18+ ＋ Chrome 或 Edge。**不需要安裝任何 npm 套件**（41.8 KB，零相依）。

驗收紀錄（`tools/test-server.js`，16/16 通過）：

```
✅ 開書        停尸房兼职，搬出了前女友？ · 611 章 · 938ms
✅ 章節第1章    1683 字
✅ 章節第39章   2199 字 · app          ← 網頁版只給 162 字
✅ 章節第301章  2058 字 · app
✅ 書評        4366 條 · 1.8万人点评
✅ 進度 / 續讀 / 匯出 / 錯誤處理
```


---

## 現在能做什麼

| 功能 | 狀態 |
|---|---|
| 貼書頁網址或書號直接讀 | ✅ 實測 611 章全目錄 |
| 字體混淆還原（PUA → 真字） | ✅ 零殘留，實測整章 1,683 字 |
| 章節樹、跳章、跳章號 | ✅ |
| 串流閱讀（速度可調） | ✅ |
| 進度記憶 / 續讀 | ✅ |
| 六種主題即時切換 | ✅ `Alt+1～6` |
| 老闆鍵（假 git diff） | ✅ `Alt+Q` |
| 離線快取（讀過的章節） | ✅ 存在 `data/chapters/` |
| 匯出 TXT | ✅ 預覽片段會自動略過 |
| 自動閱讀（讀完接下一章） | ✅ `/auto` |
| 官方書架 | ⚠️ 需要登入態（貼 cookie），未登入時自動降級 |
| **完整章節（APP 網關）** | ✅ 實測 7/7 章全文，2,000+ 字，不需 SVIP |
| **書評** | ✅ 實測 4,366 條，含評分、讚數 |
| 段評 | ❌ 章節維度回的是書評，真正的段評接口還沒找到 |
| 鎖章偵測 | ✅ 網關失敗時退回網頁版並標示 |
| 匯出 TXT | ✅ 預覽片段會自動略過 |
| 自動閱讀（讀完接下一章） | ✅ `/auto` |

---

## 完整章節是怎麼拿到的（已移植簽名堆疊）

網頁版沒 SVIP 只給 ~150 字預覽。真正的全文在 APP 網關，需要三個簽名標頭：

```
x-argus   = protobuf → SM3 → Simon-128/256 → XOR → AES-128-CBC → Base64
x-ladon   = Speck-128/128
x-khronos = 時間戳
```

已完整移植到 `src/sign/`（純 Node，零相依）：

| 檔案 | 內容 |
|---|---|
| `sm3.js` | SM3 雜湊 |
| `cipher.js` | Simon / Speck 區塊加密 |
| `protobuf.js` | 極簡 protobuf 編碼器 |
| `index.js` | argus / ladon / 簽名組裝 |

再經 `src/appapi.js`：匿名裝置 → `/reading/crypt/registerkey` 取解密金鑰 →
`/reading/reader/full/v` 取密文 → AES-128-CBC 解密。

### 你的帳號安全嗎

**完全沒關係，因為我們從頭到尾不登入。**

- 走的是一個本機生成的**匿名虛擬裝置**（`data/device.json`），不是你手機、也不是你的帳號
- 所有網關請求都不帶任何 cookie（`credentials: omit`）
- 全局限速：每 350ms 最多一個請求
- 沒有廣告、不需要 SVIP、不花錢
- 就算這個虛擬裝置被平台作廢，換一個就行，**動不到你的帳號**

代價是：付費章節仍然讀不到（那是購買關係，不是裝置問題）。

### 段評為什麼還是沒有

`comment/list` 拿章節 id 去查，回來的還是這本書的書評（兩章結果一模一樣）。
段評應該是另一組 `comment_type` / `group_type` 或另一個端點，試過的組合都回
`103001 參數錯誤`。接口基礎設施已經通了，補上只是再找參數，但我不想瞎猜浪費你時間。

**現實對照**：

| 做法 | 成本 | 效果 |
|---|---|---|
| APP 網關（已做） | 已完成 | ✅ 全文 + 書評，免費無廣告 |
| 貼 SVIP cookie | 零 | 網頁端也能全文 |
| 找段評參數 | 未知 | 需要再逆向 App |

---

## 怎麼跑

### 雙擊（推薦）

```
啟動.cmd
```

它會做兩件事：
1. 背景起本機服務 → 用 Chrome 應用程式模式開一個**沒有網址欄**的視窗
2. 起搭檔程式 `companion\MoyuCompanion.exe` → **全域老闆鍵 + 防截圖**

### 手機掃碼登入（書架同步）

在輸入框打 `/login`，畫面會出一張 QR：

1. 手機開**抖音**或**番茄小說 App** 掃碼
2. 手機上按確認
3. 畫面顯示「登入成功 ✓」，接著打 `/shelf` 讀你的書架

全程不用輸入帳密、不用貼 cookie。登入態存在 `data/cookie.txt`。

### 老闆鍵

- 視窗有焦點時：`Alt+Q`（頁面自己處理）
- 視窗沒焦點時：搭檔程式的全域熱鍵。**如果 `Alt+Q` 被別的程式佔用，會自動退到 `Ctrl+Alt+Q`，再不行退到 `Alt+Shift+Q`**，啟動時寫在 `%LOCALAPPDATA%\MoyuCompanion\companion.log`。

### 防截圖

搭檔程式對 Chrome 視窗套 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`：

- 螢幕截圖、錄影 → 只拍到一片黑
- Teams / 騰訊會議分享螢幕 → 對方看不到內容
- 托盤選單可以關掉

實測（`MoyuCompanion.exe --self-test`）：

```
SetWindowDisplayAffinity: 成功
GetWindowDisplayAffinity: 已排除截圖 ✅
```


---

## 怎麼用

在下面那個 `>` 輸入框打東西：

| 你打 | 會發生什麼 |
|---|---|
| `7373660003258862617` 或 `https://fanqienovel.com/page/7373...` | 開這本書 |
| `/shelf` | 讀官方書架（要先 `/login`） |
| `/login` | 貼 cookie，取得自己的書架與已購章節 |
| `n` / `下一章` / 直接按 Enter | 下一章 |
| `12` | 跳到第 12 章 |
| `/theme vscode` | 換皮 |
| `/boss` | 切到假畫面 |
| 其他任何句子 | 產生一段跟當前章節有關的假回覆 |

鍵盤：`Alt+1～6` 換主題、`Alt+Q` 老闆鍵、`Esc` 停止串流、`Alt+N` 下一章。

---

## 六種主題

| 鍵 | 主題 | 用途 |
|---|---|---|
| Alt+1 | Claude Code | 深色暖調，最像 Claude Code |
| Alt+2 | Claude 奶油白 | 官網配色，襯線正文，護眼 |
| Alt+3 | VS Code | 活動列 + 分頁 + 藍狀態列 |
| Alt+4 | Excel 報表 | 白底表格，最像在做正事 |
| Alt+5 | 終端機綠 | 復古 CRT |
| Alt+6 | Word 文件 | 白紙頁面，像在讀合約 |

---

## 原理

### 字體混淆是怎麼回事

網頁閱讀頁的正文是 SSR 的，但**常用字會被換成 PUA 碼點**（U+E000–U+F8FF），
再用一組自訂字體把字形畫回正確的字。直接抓 HTML 會得到一堆錯字。

解法是碼表：`charset[i]` ↔ `U+E3E8 + i`。官方會輪換碼表，所以程式裡存了多版，
執行時對每版做「解完像不像正常中文」的評分，挑最好的那版。

```
PUA 字元 → charset[cp - 0xE3E8] → 真字
```

### 為什麼寫成「本機服務 + Chrome 應用程式模式」

- 完全沒有 npm 相依，`node server.js` 就能跑
- Chrome 的 `--app` 模式沒有網址欄，視覺上就是桌面程式
- 之後要換成 Electron 殼只要改外殼，`src/` 和 `ui/` 都不用動

Electron 殼（`main.js` / `ui/preload.js`）已經寫好，多了全域熱鍵、托盤、防截圖
（`setContentProtection` → `WDA_EXCLUDEFROMCAPTURE`）。**但沒有實測**：建置環境的
Windows 沙箱不讓 Electron 啟動（Chromium 的安裝目錄 ACL 檢查會在啟動前就 FATAL）。
在你自己的電腦上應該正常，要試的話：

```powershell
# 先把 vendor\electron 的 ACL 補好，再
vendor\electron\electron.exe .
```

---

## 檔案

```
moyu-v2/
├─ 啟動.cmd                  雙擊啟動
├─ server.js                 本機服務（無相依）
├─ main.js                   Electron 殼（未實測）
├─ src/
│  ├─ fanqie.js              取數 + 字體還原
│  ├─ charset.json           碼表（多版本）
│  └─ store.js               JSON 存取
├─ ui/
│  ├─ index.html             版面
│  ├─ theme.css              六種主題
│  ├─ app.js                 串流、章節樹、指令
│  ├─ bridge-http.js         瀏覽器模式的橋接
│  └─ preload.js             Electron 模式的橋接
├─ tools/
│  ├─ fetch-charset.js       更新碼表
│  ├─ test-engine.js         引擎自測
│  ├─ snap.js                用真資料產生快照
│  └─ start.vbs              隱藏啟動
├─ data/                     執行時產生（設定、進度、章節快取）
└─ vendor/electron/          Electron 本體（可選）
```

---

## 免責

- 只給自己用。不要公開散布、不要建群、不要賣。
- 抓取內容違反番茄的服務條款，有封號風險（有前例：FQWeb 被警告後整包下架）。
- 付費章節必須在官方平台買過才讀得到，不繞。
- 快取只存在本機，不對外分享。
- 碼表來自開源專案 [ying-ck/fanqienovel-downloader](https://github.com/ying-ck/fanqienovel-downloader)（AGPL-3.0）。
