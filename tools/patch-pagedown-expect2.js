// 修 pagedown 期望值：翻頁後內容高度會變（打字鎖高度），所以要用「翻頁後」的 scrollHeight 重算上限
//   node tools/patch-pagedown-expect2.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'test-pagedown.js');
let s = fs.readFileSync(p, 'utf8');

const a = "  const after = await page.evaluate(() => ({ top: Math.round(document.querySelector('#stream').scrollTop) }));";
const b = "  const after = await page.evaluate(() => { const s = document.querySelector('#stream'); return { top: Math.round(s.scrollTop), view: s.clientHeight, sh: s.scrollHeight }; });";
if (!s.includes(a)) { console.error('❌ 找不到 after 取樣'); process.exit(1); }
s = s.split(a).join(b);

const c = "  const maxScroll = Math.max(0, before.ih - before.view);\n  const want = Math.min(Math.round(before.view / 2), Math.max(0, maxScroll - before.top));";
const d = "  const maxScroll = Math.max(0, after.sh - after.view);   // 用翻頁後的高度算上限（打字會把段落高度鎖住）\n  const want = Math.min(Math.round(after.view / 2), Math.max(0, maxScroll - before.top));";
if (!s.includes(c)) { console.error('❌ 找不到 want 計算'); process.exit(1); }
s = s.split(c).join(d);

fs.writeFileSync(p, s, 'utf8');
console.log('✅ pagedown 期望值改用翻頁後的高度');
