// 手機版：卡片帶 data-book；自檢改成先跳第 1 章（避免剛好開在付費章節）
const fs = require('fs');

{
  const f = 'sync/m/app.js';
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('data-book')) {
    s = s.replace(
      "      var card = document.createElement('button');\n      card.className = 'card';",
      "      var card = document.createElement('button');\n      card.className = 'card';\n      card.setAttribute('data-book', b.id);"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('app.js: data-book');
  } else console.log('app.js 已有 data-book');
}

{
  const f = 'tools/e2e-mobile.js';
  let s = fs.readFileSync(f, 'utf8');

  // 開書後先跳到第 1 章（免費範圍），再接章
  const old = `  await page.evaluate(() => document.querySelector('.shelf .card').click());
  let paras = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    paras = await page.evaluate(() => document.querySelectorAll('.read .p').length);
    if (paras > 5) break;
  }`;
  const neu = `  await page.evaluate(() => document.querySelector('.shelf .card').click());
  await sleep(2600);
  // 有些書的進度停在付費章節（只有試讀），先跳到第 1 章再驗閱讀與接章
  await page.evaluate(async () => {
    document.getElementById('btnToc').click();
    await new Promise((r) => setTimeout(r, 400));
    const first = document.querySelector('.toc-r');
    if (first) first.click();
  });
  let paras = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    paras = await page.evaluate(() => document.querySelectorAll('.read .p').length);
    if (paras > 5) break;
  }`;

  if (s.includes(old)) {
    s = s.replace(old, neu);
    fs.writeFileSync(f, s, 'utf8');
    console.log('e2e-mobile.js: 先跳第 1 章');
  } else console.log('e2e-mobile.js 錨點不同');
}
