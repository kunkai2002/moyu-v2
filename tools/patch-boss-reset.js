// ① 連讀：本章還沒渲染完不許接下一章
// ② 自檢：按完老闆鍵要退出假畫面；EXPECT 移除已合併的 tbShelf
const fs = require('fs');

/* ── flow.js ── */
{
  const f = 'ui/flow.js';
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('function rendered()')) {
    if (!s.includes('  function canAdvance() {')) { console.error('❌ flow 錨點失效'); process.exit(1); }
    s = s.replace(
      '  function canAdvance() {',
      `  function rendered() {
    var b = lastBody();
    return !!b && !/讀取中/.test(b.textContent) && b.querySelectorAll('.p').length > 1;
  }

  function canAdvance() {`
    );
    s = s.replace(
      `    var body = lastBody();
    if (body && /讀取中/.test(body.textContent)) return false;
    return true;`,
      `    if (!rendered()) return false;   // 本章還沒畫出來，先等
    return true;`
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('flow.js: 渲染閘');
  } else console.log('flow.js 已有渲染閘');
}

/* ── e2e-buttons.js ── */
{
  const f = 'tools/e2e-buttons.js';
  let s = fs.readFileSync(f, 'utf8');

  // 1) EXPECT：tbShelf 已移除，補 tbBoss
  s = s.replace(
    "const EXPECT = ['tbBack', 'tbFwd', 'tbShelf', 'tbList', 'tbMark', 'tbStat', 'tbHome', 'tbHistory', 'tbPhone', 'tbSettings', 'tbMore'];",
    "const EXPECT = ['tbBack', 'tbFwd', 'tbList', 'tbMark', 'tbStat', 'tbHome', 'tbHistory', 'tbBoss', 'tbPhone', 'tbSettings', 'tbMore'];"
  );

  // 2) 每次按完都退出假畫面，並關閉所有面板
  const oldReset = `    await page.evaluate(() => {
      document.querySelectorAll('.panel, .marks-panel, .stats-panel, .detail, .hist-panel')
        .forEach((p) => { p.hidden = true; });
    });`;
  const newReset = `    await page.evaluate(() => {
      // 老闆鍵按下去之後一定要退出假畫面，否則後面的量測全在假畫面裡
      try { window.__moyuDebug.boss(false); } catch (e) {}
      document.body.classList.remove('bossing');
      document.querySelectorAll('.panel, .marks-panel, .stats-panel, .detail, .hist-panel, .phone-panel')
        .forEach((p) => { p.hidden = true; });
    });`;
  if (s.includes(oldReset)) {
    s = s.replace(oldReset, newReset);
    console.log('e2e-buttons: 退出假畫面');
  } else console.log('e2e-buttons: reset 區塊不同（略過）');

  // 3) 進到拖拽/連讀前，確保不在假畫面、且有書
  if (!s.includes('確保沒在假畫面')) {
    s = s.replace(
      "  /* ── 6. 拖拽 ── */",
      `  /* 確保沒在假畫面、正文在 */
  await page.evaluate(async () => {
    try { window.__moyuDebug.boss(false); } catch (e) {}
    document.body.classList.remove('bossing');
    if (!window.__moyuDebug.state.book) await window.__moyuDebug.openBook('7373660003258862617');
  });
  await sleep(1800);

  /* ── 6. 拖拽 ── */`
    );
    console.log('e2e-buttons: 拖拽前暖場');
  }

  fs.writeFileSync(f, s, 'utf8');
}
