// ① worker：/favicon.ico 轉到 icon.svg（避免 401 噪音）
// ② e2e-mobile：等卡片真的出現再點
const fs = require('fs');

{
  const f = 'sync/worker.mjs';
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes("p === '/favicon.ico'")) {
    s = s.replace(
      "    if (p === '/m') return Response.redirect(url.origin + '/m/', 302);",
      "    if (p === '/favicon.ico') return Response.redirect(url.origin + '/m/icon.svg', 302);\n"
      + "    if (p === '/m') return Response.redirect(url.origin + '/m/', 302);"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('worker: favicon');
  } else console.log('worker 已有 favicon');
}

{
  const f = 'tools/e2e-mobile.js';
  let s = fs.readFileSync(f, 'utf8');
  const old = `  const cardText = await page.evaluate((id) => {
    const c = document.querySelector(\`.card[data-book="\${id}"]\`);
    return c ? c.innerText.replace(/\\n/g, ' | ') : '';
  }, TEST_BOOK);`;
  const neu = `  /* 等到測試書的卡片真的出現（雲端冷啟動有時要幾秒） */
  let cardText = '';
  for (let i = 0; i < 40; i++) {
    cardText = await page.evaluate((id) => {
      const c = document.querySelector('.card[data-book="' + id + '"]');
      return c ? c.innerText.replace(/\\n/g, ' | ') : '';
    }, TEST_BOOK);
    if (cardText) break;
    await sleep(400);
  }`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    fs.writeFileSync(f, s, 'utf8');
    console.log('e2e-mobile: 等卡片');
  } else console.log('e2e-mobile: 錨點不同');
}
