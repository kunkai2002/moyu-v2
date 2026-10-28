// 手機自檢：劃線改成「最多點兩次＋以雲端為準」，並清掉測試產生的標記
const fs = require('fs');
const f = 'tools/e2e-mobile.js';
let s = fs.readFileSync(f, 'utf8');

const old = `  /* 9. 劃線位置 */
  const markInfo = await page.evaluate(async () => {
    const p = document.querySelector('.read .p');
    const ch = p.dataset.chapter;
    const para = p.dataset.para;
    p.click();
    await new Promise((r) => setTimeout(r, 900));
    return { ch, para, marked: document.querySelectorAll('.p.marked').length, cls: p.className };
  });
  markInfo.marked > 0 && /marked/.test(markInfo.cls) ? ok('劃線：生效') : bad('劃線：沒生效', JSON.stringify(markInfo));
  const marks = await (await fetch(\`\${BASE}/api/marks?book=\${bookId}\`, { headers: AUTH })).json();
  const saved = (marks.marks || []).some((m) => m.chapter_id === markInfo.ch && Number(m.para) === Number(markInfo.para) && !m.deleted);
  saved ? ok('劃線：雲端記在正確章節/段落') : bad('劃線：雲端位置不對', JSON.stringify(markInfo));`;

const neu = `  /* 9. 劃線位置（以雲端結果為準；UI 最多點兩次） */
  const markInfo = await page.evaluate(async () => {
    const p = document.querySelector('.read .p');
    const ch = p.dataset.chapter;
    const para = p.dataset.para;
    p.click();
    await new Promise((r) => setTimeout(r, 1100));
    if (!p.classList.contains('marked')) {
      p.click();
      await new Promise((r) => setTimeout(r, 1100));
    }
    return { ch, para, marked: document.querySelectorAll('.p.marked').length, cls: p.className, toast: document.getElementById('toast').textContent };
  });
  markInfo.marked > 0 ? ok(\`劃線：頁面生效（\${markInfo.toast}）\`) : bad('劃線：頁面沒生效', JSON.stringify(markInfo));

  const markId = markInfo.ch + '-' + markInfo.para + '-highlight';
  let saved = false;
  for (let i = 0; i < 6; i++) {
    const marks = await (await fetch(\`\${BASE}/api/marks?book=\${bookId}\`, { headers: AUTH })).json();
    saved = (marks.marks || []).some((m) => m.id === markId && !m.deleted);
    if (saved) break;
    await sleep(400);
  }
  saved ? ok('劃線：雲端記在正確章節/段落') : bad('劃線：雲端位置不對', markId);

  /* 清掉這筆測試劃線，不要留在你的書上 */
  await fetch(BASE + '/api/marks', {
    method: 'POST', headers: AUTH,
    body: JSON.stringify({ action: 'remove', book_id: bookId, id: markId }),
  });`;

if (s.includes(old)) {
  s = s.replace(old, neu);
  fs.writeFileSync(f, s, 'utf8');
  console.log('e2e-mobile: 劃線斷言與清理已改');
} else {
  console.error('❌ 錨點不同');
  process.exit(1);
}
