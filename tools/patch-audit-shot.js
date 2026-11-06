// audit 的截圖在「隱藏視窗」偶爾會卡死（Page.captureScreenshot timeout）：
// 加上 captureBeyondViewport:false 與單張重試，避免整份驗收被一張圖拖垮。
//   node tools/patch-audit-shot.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'audit-chat-ui.js');
let s = fs.readFileSync(p, 'utf8');
const a = "    await page.screenshot({ path: file });";
const b = [
  "    try {",
  "      await page.screenshot({ path: file, captureBeyondViewport: false });",
  "    } catch (e) {",
  "      // 隱藏視窗偶爾抓不到幀：退一步只記錄、不讓整份驗收掛掉",
  "      console.log('  ⚠ 截圖失敗（' + w + '×' + h + '）：' + (e && e.message ? e.message.slice(0, 60) : e));",
  "      try { await page.screenshot({ path: file, captureBeyondViewport: false, fromSurface: false }); } catch {}",
  "    }",
].join('\n');
if (!s.includes(a)) { console.error('❌ 找不到 screenshot 呼叫'); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ audit 截圖加重試');
