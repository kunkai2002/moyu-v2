// 在「全按鈕自檢」裡加上：頂欄與溢出選單不得重複
const fs = require('fs');
const f = 'tools/e2e-buttons.js';
let s = fs.readFileSync(f, 'utf8');

if (!s.includes('資訊架構')) {
  const block = [
    '  /* 資訊架構：頂欄與溢出不得重複 */',
    '  const ia = await page.evaluate(async () => {',
    "    const top = [...document.querySelectorAll('.topbar .tb-btn')].map((b) => (b.title || '').trim());",
    "    document.querySelector('#tbMore')?.click();",
    '    await new Promise((r) => setTimeout(r, 260));',
    "    const ov = document.querySelector('.overflow');",
    "    const rows = ov ? [...ov.querySelectorAll('.ov-row')].map((r) => r.textContent.trim()) : [];",
    '    if (ov) ov.hidden = true;',
    '    return { top, rows };',
    '  });',
    "  const DUP = ['最近', '歷史', '統計', '標記', '章節', '書架', '首頁', '手機', '設定', '目錄', '老闆鍵'];",
    '  const dupHit = ia.rows.filter((row) => DUP.some((k) => row.startsWith(k)));',
    "  dupHit.length === 0 ? ok(`資訊架構：溢出沒有重複項（${ia.rows.join(' / ') || '空'}）`) : bad('資訊架構：溢出有重複', dupHit.join(','));",
    '  const noTitle = ia.top.filter((t) => !t);',
    "  noTitle.length === 0 ? ok(`資訊架構：頂欄 ${ia.top.length} 顆都有標題`) : bad('資訊架構：有按鈕沒有標題');",
    '',
    '',
  ].join('\n');
  s = s.replace('  /* ── 3. 首頁 ── */', block + '  /* ── 3. 首頁 ── */');
  fs.writeFileSync(f, s, 'utf8');
  console.log('e2e-buttons：加入資訊架構檢查');
} else console.log('已含資訊架構檢查');
