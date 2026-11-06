// 測試配合 2 秒節奏：等動畫跑完再量（原本只等 700ms）
//   node tools/patch-test-timing.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'test-pagedown.js');
let s = fs.readFileSync(p, 'utf8');
let n = 0;
const subs = [
  ['  await page.keyboard.press(\'Enter\');\n  await sleep(700);', '  await page.keyboard.press(\'Enter\');\n  await sleep(2600);'],
  ['    await page.keyboard.press(\'Enter\');\n    await sleep(120);', '    await page.keyboard.press(\'Enter\');\n    await sleep(2300);'],
];
for (const [a, b] of subs) {
  if (s.includes(a)) { s = s.split(a).join(b); n++; }
  else console.log('  ! 找不到：' + a.slice(0, 40).replace(/\n/g, '\\n'));
}
fs.writeFileSync(p, s, 'utf8');
console.log(n ? '✅ 等動畫時間改成 2.6s / 2.3s（' + n + ' 處）' : '沒有需要改的');
