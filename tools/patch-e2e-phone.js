// 自檢：頂欄多一顆手機，並檢查手機面板的網址
const fs = require('fs');
const f = 'tools/e2e-buttons.js';
let s = fs.readFileSync(f, 'utf8');

s = s.replace(
  "const EXPECT = ['tbBack', 'tbFwd', 'tbShelf', 'tbList', 'tbMark', 'tbStat', 'tbHome', 'tbHistory', 'tbSettings', 'tbMore'];",
  "const EXPECT = ['tbBack', 'tbFwd', 'tbShelf', 'tbList', 'tbMark', 'tbStat', 'tbHome', 'tbHistory', 'tbPhone', 'tbSettings', 'tbMore'];"
);

if (!s.includes('手機面板')) {
  s = s.replace(
    "  /* ── 3. 首頁 ── */",
    `  /* 手機面板 */
  const phone = await page.evaluate(async () => {
    document.querySelector('#tbPhone').click();
    await new Promise((r) => setTimeout(r, 900));
    const panel = document.querySelector('.phone-panel');
    const url = panel ? panel.querySelector('#phUrl').value : '';
    const open = !!panel && !panel.hidden;
    if (panel) panel.hidden = true;
    return { open, url };
  });
  phone.open ? ok('手機面板：打得開') : bad('手機面板：打不開');
  /\\/m\\/$/.test(phone.url) ? ok(`手機面板：網址 ${phone.url}`) : bad('手機面板：網址不對', phone.url);
  console.log('· 手機面板 ' + phone.url);

  /* ── 3. 首頁 ── */`
  );
}

fs.writeFileSync(f, s, 'utf8');
console.log('e2e-buttons 已加入手機面板檢查');
