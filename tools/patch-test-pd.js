// test-reveal 收尾時把 window.__pd 一起寫進報告，方便看 pageDownHalf 內部數字
//   node tools/patch-test-pd.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'test-reveal.js');
let s = fs.readFileSync(p, 'utf8');
const a = "  const after = samples[samples.length - 1];";
const b = "  const after = samples[samples.length - 1];\n  const pd = await page.evaluate(() => window.__pd || null);\n  if (pd) console.log('pageDownHalf 內部：', JSON.stringify(pd).slice(0, 400));";
if (!s.includes(a)) { console.error('❌ 找不到 after 那行'); process.exit(1); }
s = s.split(a).join(b);
s = s.replace("fs.writeFileSync(path.join(ROOT, '_probe', 'reveal.json'), JSON.stringify({ results, before, after, moved, errors }, null, 2), 'utf8');",
  "fs.writeFileSync(path.join(ROOT, '_probe', 'reveal.json'), JSON.stringify({ results, before, after, moved, pd, errors }, null, 2), 'utf8');");
fs.writeFileSync(p, s, 'utf8');
console.log('✅ test-reveal 會印 pageDownHalf 內部數字');
