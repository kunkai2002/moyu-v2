const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'e2e-search.js');
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
  `  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 2500));`,
  `  await page.keyboard.press('Enter');
  // 等結果出現（最多 20 秒），而不是固定睡
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const done = await page.evaluate(() => {
      const st = document.querySelector('#searchState')?.textContent || '';
      return document.querySelectorAll('#searchList .li').length > 0 || /找不到|失敗/.test(st);
    });
    if (done) break;
  }`,
);

fs.writeFileSync(p, s, 'utf8');
console.log('+ E2E 改為輪詢等待結果');
