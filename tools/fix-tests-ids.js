// 修兩個自檢腳本：EXPECT 改對、右鍵選單用新的 id
const fs = require('fs');

{
  const f = 'tools/e2e-buttons.js';
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(
    /const EXPECT = \[[^\]]*\];/,
    "const EXPECT = ['tbBack', 'tbFwd', 'tbList', 'tbMark', 'tbStat', 'tbHome', 'tbHistory', 'tbBoss', 'tbPhone', 'tbSettings', 'tbMore'];"
  );
  fs.writeFileSync(f, s, 'utf8');
  console.log('EXPECT:', (s.match(/const EXPECT = \[[^\]]*\]/) || ['?'])[0]);
}

{
  const f = 'tools/e2e-flow.js';
  let s = fs.readFileSync(f, 'utf8');

  // 右鍵選單：新結構
  const old = `  const menuText = await page.evaluate(() => document.querySelector('.rm-menu')?.innerText || '');
  /記住進度/.test(menuText) ? ok(\`右鍵：選單有「記住進度」（\${menuText.replace(/\\n+/g, ' / ').slice(0, 40)}）\`) : bad('右鍵：選單沒有記住進度', menuText);

  await page.evaluate(() => document.querySelector('#rmMenuSave').click());`;
  const neu = `  const menuText = await page.evaluate(() => document.querySelector('.rm-menu')?.innerText || '');
  /記住進度/.test(menuText) ? ok(\`右鍵：選單有「記住進度」（\${menuText.replace(/\\n+/g, ' / ').slice(0, 40)}）\`) : bad('右鍵：選單沒有記住進度', menuText);
  const menuItems = await page.evaluate(() => window.__moyuRemember.items);
  const wantItems = ['記住進度', '劃線', '寫筆記', '複製這段', '全書搜尋這段'];
  const missItems = wantItems.filter((w) => !menuItems.some((i) => i.includes(w.replace('…', ''))));
  missItems.length === 0 ? ok(\`右鍵：五項齊（\${menuItems.length}）\`) : bad('右鍵：缺項', missItems.join(','));

  await page.evaluate(() => document.querySelector('#rmSave').click());`;

  if (s.includes(old)) {
    s = s.replace(old, neu);
    console.log('e2e-flow: 右鍵選單 id 已更新');
  } else {
    console.log('e2e-flow: 找不到舊區塊，嘗試最小替換');
    s = s.replace("#rmMenuSave", "#rmSave");
  }
  fs.writeFileSync(f, s, 'utf8');
}
