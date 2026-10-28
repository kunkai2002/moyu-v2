// 手機版自檢 v3
// 續讀（雲端章節 id）、開書不覆寫進度、目錄「上次讀到」+「最近讀過」、sticky 頂欄、接章要真手勢、劃線位置
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE = 'https://moyu-sync.qiaoyuhua2002.workers.dev';
const TOKEN = fs.readFileSync(path.join(__dirname, '..', 'sync', '.token'), 'utf8').trim();
const AUTH = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getProgress = async () => (await (await fetch(BASE + '/api/progress', { headers: AUTH })).json()).progress || [];
const setProgress = async (row) => fetch(BASE + '/api/progress', {
  method: 'POST', headers: AUTH, body: JSON.stringify(row),
});

(async () => {
  /* ── 準備：挑書架上第一本有目錄的書，把進度設在第 7 章 ── */
  const REAL_BOOK = '7143038691944959011';   // JOJO 真正的書（十日终焉），測試不准碰
  const shelfRes = await (await fetch(BASE + '/api/shelf', { headers: AUTH })).json();
  const shelfBooks = (shelfRes.books || []).filter((b) => b.id !== REAL_BOOK);
  if (!shelfBooks.length) { console.error('❌ 書架空的'); process.exit(2); }

  let bookId = '', chapters = [], target = null;
  for (const b of shelfBooks.slice(0, 5)) {
    const r = await (await fetch(`${BASE}/api/open?input=${b.id}`, { headers: AUTH })).json();
    if (r.ok && r.book && (r.book.chapters || []).length) {
      bookId = b.id;
      chapters = r.book.chapters;
      target = chapters[Math.min(6, chapters.length - 1)];
      break;
    }
  }
  if (!target) { console.error('❌ 找不到可測的書'); process.exit(2); }
  const orig = (await getProgress()).find((p) => p.book_id === bookId);
  await setProgress({ book_id: bookId, chapter_id: target.id, chapter_no: target.no, title: target.title });
  const before = (await getProgress()).find((p) => p.book_id === bookId);
  console.log(`· 測試書 ${bookId}，目標第 ${target.no} 章`);

  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${BASE}/m/#t=${encodeURIComponent(TOKEN)}`, { waitUntil: 'networkidle2' });
  await sleep(1200);

  /* 1. 書架 + 卡片進度 */
  let cards = 0;
  for (let i = 0; i < 40; i++) {
    cards = await page.evaluate(() => document.querySelectorAll('.shelf .card').length);
    if (cards > 0) break;
    await sleep(300);
  }
  cards > 5 ? ok(`書架：${cards} 本`) : bad('書架：沒出來');

  let cardText = '';
  for (let i = 0; i < 30; i++) {
    cardText = await page.evaluate((id) => {
      const c = document.querySelector('.card[data-book="' + id + '"]');
      return c ? c.innerText.replace(/\n/g, ' | ') : '';
    }, bookId);
    if (cardText) break;
    await sleep(300);
  }
  cardText.indexOf('第 ' + target.no + ' 章') >= 0
    ? ok(`書架：卡片顯示「${cardText}」`)
    : bad('書架：卡片進度不對', `${cardText}（期待第 ${target.no} 章）`);

  /* 2. 開書 → 回到 target 章 */
  await page.evaluate((id) => {
    const c = document.querySelector('.card[data-book="' + id + '"]');
    if (c) c.click();
  }, bookId);
  await sleep(3400);
  const openedAt = await page.evaluate(() => ({
    title: document.getElementById('title').textContent,
    firstChap: document.querySelector('.read .chap') ? document.querySelector('.read .chap').textContent : '',
    paras: document.querySelectorAll('.read .p').length,
  }));
  (openedAt.firstChap + ' ' + openedAt.title).indexOf('第 ' + target.no + ' 章') >= 0
    || (openedAt.firstChap + ' ' + openedAt.title).indexOf('第' + target.no + '章') >= 0
    ? ok(`續讀：開書直接到「${openedAt.firstChap || openedAt.title}」`)
    : bad('續讀：沒有回到上次的章節', JSON.stringify(openedAt));
  openedAt.paras > 3 ? ok(`續讀：正文 ${openedAt.paras} 段`) : bad('續讀：正文沒出來');

  /* 3. 只開書不能改動雲端進度 */
  const afterOpen = (await getProgress()).find((p) => p.book_id === bookId);
  afterOpen && afterOpen.chapter_id === before.chapter_id
    ? ok('不覆寫：開書後雲端進度沒變')
    : bad('不覆寫：開書把進度改掉了', `${before.chapter_no} → ${afterOpen && afterOpen.chapter_no}`);

  /* 4. 目錄：上次讀到 / 最近讀過 / 當前高亮 */
  const toc = await page.evaluate(() => {
    document.getElementById('btnToc').click();
    return {
      rows: document.querySelectorAll('.toc-r').length,
      badge: document.querySelectorAll('.toc-badge').length,
      recent: document.querySelectorAll('.toc-recent').length,
      onIdx: [...document.querySelectorAll('.toc-r')].findIndex((r) => r.classList.contains('on')),
      open: !document.getElementById('toc').hidden,
    };
  });
  toc.open && toc.rows > 100 ? ok(`目錄：${toc.rows} 列`) : bad('目錄：打不開', JSON.stringify(toc));
  toc.badge >= 1 ? ok('目錄：有「上次讀到」標記') : bad('目錄：沒有上次讀到的標記');
  toc.recent >= 1 ? ok(`目錄：有「最近讀過」${toc.recent} 筆`) : bad('目錄：沒有最近讀過');
  toc.onIdx >= 0 ? ok(`目錄：當前章節高亮（第 ${toc.onIdx + 1} 列）`) : bad('目錄：當前章節沒高亮');

  /* 5. 目錄跳章 → 第 1 章，並寫入雲端 */
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.toc-r')].filter((r) => !r.classList.contains('toc-recent'));
    if (rows[0]) rows[0].click();
  });
  await sleep(2800);
  const afterJump = await page.evaluate(() => ({
    firstChap: document.querySelector('.read .chap') ? document.querySelector('.read .chap').textContent : '',
    paras: document.querySelectorAll('.read .p').length,
  }));
  /第1章|第 1 章/.test(afterJump.firstChap) ? ok(`目錄跳章：到「${afterJump.firstChap}」`) : bad('目錄跳章：沒跳過去', JSON.stringify(afterJump));
  afterJump.paras > 3 ? ok(`目錄跳章：正文 ${afterJump.paras} 段`) : bad('目錄跳章：正文空白');
  const afterJumpCloud = (await getProgress()).find((p) => p.book_id === bookId);
  String(afterJumpCloud.chapter_no) === '1' ? ok('目錄跳章：進度已寫入雲端（第 1 章）') : bad('目錄跳章：進度沒更新', afterJumpCloud.chapter_no);

  /* 6. sticky 頂欄 */
  await page.evaluate(() => window.scrollTo(0, 600));
  await sleep(500);
  const sticky = await page.evaluate(() => ({
    topY: Math.round(document.querySelector('.top').getBoundingClientRect().y),
    scrollY: Math.round(window.scrollY),
  }));
  sticky.topY === 0 ? ok('頂欄：捲動時固定在頂端') : bad('頂欄：跟著捲走了', JSON.stringify(sticky));

  /* 7. 接章：先確認「沒有手勢不會亂跑」，再用手勢接一章 */
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(1500);
  const noGesture = await page.evaluate(() => document.querySelectorAll('.read .chap').length);
  await page.evaluate(() => { window.scrollTo(0, 0); window.scrollTo(0, document.body.scrollHeight); });
  await sleep(1500);
  const noGesture2 = await page.evaluate(() => document.querySelectorAll('.read .chap').length);
  noGesture === noGesture2 ? ok('接章：沒有手勢時不會自己往前跳') : bad('接章：沒手勢也跳章了', `${noGesture} → ${noGesture2}`);

  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  await page.evaluate(() => {
    window.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
    window.dispatchEvent(new TouchEvent('touchmove', { bubbles: true }));
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true }));
    window.scrollTo(0, document.body.scrollHeight);
  });
  await sleep(2800);
  const withGesture = await page.evaluate(() => document.querySelectorAll('.read .chap').length);
  withGesture > noGesture2 ? ok(`接章：手勢後接了 1 章（${noGesture2} → ${withGesture}）`) : bad('接章：手勢後沒接章', `${noGesture2} → ${withGesture}`);

  /* 8. 記住進度 */
  await page.evaluate(() => document.getElementById('remember').click());
  await sleep(900);
  const toastText = await page.evaluate(() => document.getElementById('toast').textContent);
  /記住/.test(toastText) ? ok(`記住進度：「${toastText}」`) : bad('記住進度：沒有提示', toastText);

  /* 9. 劃線位置（以雲端結果為準；UI 最多點兩次） */
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
  markInfo.marked > 0 ? ok(`劃線：頁面生效（${markInfo.toast}）`) : bad('劃線：頁面沒生效', JSON.stringify(markInfo));

  const markId = markInfo.ch + '-' + markInfo.para + '-highlight';
  let saved = false;
  for (let i = 0; i < 6; i++) {
    const marks = await (await fetch(`${BASE}/api/marks?book=${bookId}`, { headers: AUTH })).json();
    saved = (marks.marks || []).some((m) => m.id === markId && !m.deleted);
    if (saved) break;
    await sleep(400);
  }
  saved ? ok('劃線：雲端記在正確章節/段落') : bad('劃線：雲端位置不對', markId);

  /* 清掉這筆測試劃線，不要留在你的書上 */
  await fetch(BASE + '/api/marks', {
    method: 'POST', headers: AUTH,
    body: JSON.stringify({ action: 'remove', book_id: bookId, id: markId }),
  });

  /* 10. 換色 / 小屏 */
  const theme = await page.evaluate(() => {
    const b = document.documentElement.getAttribute('data-theme');
    document.getElementById('btnTheme').click();
    return { before: b, after: document.documentElement.getAttribute('data-theme') };
  });
  theme.before !== theme.after ? ok(`換色：${theme.before} → ${theme.after}`) : bad('換色：沒反應');

  await page.setViewport({ width: 320, height: 568, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await sleep(500);
  const small = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    pW: document.querySelector('.read .p') ? document.querySelector('.read .p').getBoundingClientRect().width : 0,
  }));
  small.overflow <= 0 ? ok(`小屏 320：無橫向溢出（正文寬 ${Math.round(small.pW)}）`) : bad('小屏 320：有橫向溢出', String(small.overflow));

  errors.length === 0 ? ok('全程無 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  /* 還原測試書原本的雲端進度，不要留測試痕跡（原本沒有就整筆刪掉） */
  if (orig) {
    await setProgress({ book_id: bookId, chapter_id: orig.chapter_id, chapter_no: orig.chapter_no, title: orig.title });
  } else {
    await fetch(BASE + '/api/progress', {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ action: 'remove', book_id: bookId }),
    });
  }

  await page.screenshot({ path: path.join(__dirname, '..', '_probe', 'mobile-e2e.png') });

  console.log('\n===== 手機 PWA =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);

  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})();
