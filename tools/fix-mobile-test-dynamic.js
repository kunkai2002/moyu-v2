// 手機自檢：書與章節改成從雲端書架動態挑選，不再硬寫書號
const fs = require('fs');
const f = 'tools/e2e-mobile.js';
let s = fs.readFileSync(f, 'utf8');
const must = (a, t) => { if (!s.includes(a)) { console.error('❌ 錨點失敗: ' + t); process.exit(1); } };

/* 1) 準備段：改成挑書架上第一本，取第 7 章（不足則取最後一章） */
must(`  const TEST_BOOK = '7373660003258862617';`, 'const test book');
s = s.replace(`  const TEST_BOOK = '7373660003258862617';`, `  let TEST_BOOK = '';`);

must(`  /* 準備：把測試書的雲端進度設成第 7 章（模擬桌面同步上來的位置） */
  const opened = await (await fetch(\`\${BASE}/api/open?input=\${TEST_BOOK}\`, { headers: AUTH })).json();
  const chapters = opened.book && opened.book.chapters ? opened.book.chapters : [];
  if (!chapters.length) { console.error('❌ 拿不到目錄'); process.exit(2); }
  const target = chapters[6];
  await setProgress({ book_id: TEST_BOOK, chapter_id: target.id, chapter_no: target.no, title: target.title });
  const before = (await getProgress()).find((p) => p.book_id === TEST_BOOK);`,
`  /* 準備：從書架挑第一本有目錄的書，把進度設在它的第 7 章 */
  const shelfRes = await (await fetch(BASE + '/api/shelf', { headers: AUTH })).json();
  const shelfBooks = shelfRes.books || [];
  if (!shelfBooks.length) { console.error('❌ 書架空的'); process.exit(2); }

  let opened = null, chapters = [], target = null;
  for (const b of shelfBooks.slice(0, 5)) {
    const r = await (await fetch(\`\${BASE}/api/open?input=\${b.id}\`, { headers: AUTH })).json();
    if (r.ok && r.book && (r.book.chapters || []).length) {
      TEST_BOOK = b.id; opened = r; chapters = r.book.chapters;
      target = chapters[Math.min(6, chapters.length - 1)];
      break;
    }
  }
  if (!target) { console.error('❌ 找不到可測的書'); process.exit(2); }
  await setProgress({ book_id: TEST_BOOK, chapter_id: target.id, chapter_no: target.no, title: target.title });
  const before = (await getProgress()).find((p) => p.book_id === TEST_BOOK);`);

/* 2) 卡片進度斷言：用 target.no */
must("  /第 7 章/.test(cardText) ? ok(`書架：卡片顯示「${cardText}」`) : bad('書架：卡片沒有進度', cardText);", 'card assert');
s = s.replace(
  "  /第 7 章/.test(cardText) ? ok(`書架：卡片顯示「${cardText}」`) : bad('書架：卡片沒有進度', cardText);",
  "  cardText.indexOf('第 ' + target.no + ' 章') >= 0\n    ? ok(`書架：卡片顯示「${cardText}」`) : bad('書架：卡片進度不對', cardText + ' 期待第' + target.no + '章');"
);

/* 3) 續讀斷言：比對 target.no */
must("  /第7章|第 7 章/.test(openedAt.firstChap + openedAt.title)", 'resume assert');
s = s.replace(
  "  /第7章|第 7 章/.test(openedAt.firstChap + openedAt.title)",
  "  (openedAt.firstChap + openedAt.title).indexOf('第' + target.no + '章') >= 0\n    || (openedAt.firstChap + openedAt.title).indexOf('第 ' + target.no + ' 章') >= 0"
);

fs.writeFileSync(f, s, 'utf8');
console.log('e2e-mobile: 改成動態挑書');
