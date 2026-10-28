// ① 接章測試：先回到頁首再滑到底（才會有「往下」的手勢）
// ② 測試結束把被改動的雲端進度還原
const fs = require('fs');
const f = 'tools/e2e-mobile.js';
let s = fs.readFileSync(f, 'utf8');

/* 1) 記下原始進度 */
s = s.replace(
  "  await setProgress({ book_id: bookId, chapter_id: target.id, chapter_no: target.no, title: target.title });\n  const before = (await getProgress()).find((p) => p.book_id === bookId);",
  "  const orig = (await getProgress()).find((p) => p.book_id === bookId);\n"
  + "  await setProgress({ book_id: bookId, chapter_id: target.id, chapter_no: target.no, title: target.title });\n"
  + "  const before = (await getProgress()).find((p) => p.book_id === bookId);"
);

/* 2) 手勢測試：先回頁首 */
s = s.replace(
  `  await page.evaluate(() => {
    window.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
    window.dispatchEvent(new TouchEvent('touchmove', { bubbles: true }));
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true }));
    window.scrollTo(0, document.body.scrollHeight);
  });`,
  `  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  await page.evaluate(() => {
    window.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
    window.dispatchEvent(new TouchEvent('touchmove', { bubbles: true }));
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true }));
    window.scrollTo(0, document.body.scrollHeight);
  });`
);

/* 3) 結尾還原 */
s = s.replace(
  "  await page.screenshot({ path: path.join(__dirname, '..', '_probe', 'mobile-e2e.png') });",
  `  /* 還原測試書原本的雲端進度，不要留測試痕跡 */
  if (orig) {
    await setProgress({ book_id: bookId, chapter_id: orig.chapter_id, chapter_no: orig.chapter_no, title: orig.title });
  } else {
    await fetch(BASE + '/api/progress', {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ book_id: bookId, chapter_id: '', chapter_no: '', title: '' }),
    });
  }

  await page.screenshot({ path: path.join(__dirname, '..', '_probe', 'mobile-e2e.png') });`
);

fs.writeFileSync(f, s, 'utf8');
console.log('e2e-mobile: 手勢與清理已修');
