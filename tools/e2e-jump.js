// 回歸測試：一次滑動只能接一章（121 → 123 那個老毛病）
//
// 舊版有兩個洞，這支測試各打一次：
//   ① 「程式化捲動」被當成手勢：App 畫完一章會自己 scrollBottom()，
//      那一刻舊版判定「使用者滑到底」→ 自己接下一章。
//   ② 章節快取命中（IPC < 10ms）時，一次滑動的十幾個滾輪事件各接一章。
// 所以這裡驗：開書不自己接、程式化捲動不接、一次真的滑動只 +1、往上滑 -0、
// 而且進度只記「視窗上緣那一章」。
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || path.join('C:', 'Users', 'Admin', 'AppData', 'Local', 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const REAL = path.join(APP, 'data');
const PROBE = path.join(__dirname, '..', '_probe', 'e2e-data-jump');
const PORT = 9341;
const BOOK = '7373660003258862617';   // 免費書，跟 e2e-flow 同一本

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(PROBE, { recursive: true });
  for (const f of ['cookie.txt', 'cookies.json', 'settings.json', 'prefs.json', 'sync.json']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROBE, f));
  }
  fs.mkdirSync(path.join(PROBE, 'chapters'), { recursive: true });
  // JOJO 的視窗就是小視窗（565x505），一定要在這個尺寸下驗
  fs.writeFileSync(path.join(PROBE, 'window.json'),
    JSON.stringify({ width: 565, height: 505, x: 120, y: 120, maximized: false }), 'utf8');

  const log = fs.openSync(path.join(__dirname, '..', '_probe', 'jump.log'), 'w');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'],
    { stdio: ['ignore', log, log] });

  let browser = null;
  for (let i = 0; i < 50 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {}
  }
  if (!browser) { console.error('❌ 連不上偵錯埠'); process.exit(2); }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    const pages = await browser.pages().catch(() => []);
    page = pages.find((p) => p.url().startsWith('file://'));
    if (!page) await sleep(300);
  }
  if (!page) { console.error('❌ 找不到 app 頁面'); browser.disconnect(); process.exit(2); }

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await sleep(1500);

  const chaps = () => page.evaluate(() => document.querySelectorAll('#stream .pb').length);
  const flowState = () => page.evaluate(() => (window.__moyuFlow ? window.__moyuFlow.state : null));
  const idle = async () => {
    for (let i = 0; i < 40; i++) {
      const s = await flowState();
      const streaming = await page.evaluate(() => !!window.__moyuDebug.state.streaming);
      if (s && !s.busy && !streaming) return;
      await sleep(250);
    }
  };

  /* 開書（openBook 自己就會開到續讀章，不要再喊一次 goChapter，
     喊兩次會畫出兩份同樣的章節，測起來像「自己多接一章」） */
  await page.evaluate(async (b) => { await window.__moyuDebug.openBook(b); }, BOOK);
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    if (await page.evaluate(() => document.querySelectorAll('#tree .ch').length > 3)) break;
  }
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    if (await page.evaluate(() => document.querySelectorAll('#stream .pb .p').length) > 3) break;
  }
  await idle();
  await sleep(2500);

  /* ① 光是「畫完一章自動捲到底」不准自己接章 */
  const afterRender = await chaps();
  afterRender === 1
    ? ok('畫完一章不會自己接下一章')
    : bad(`畫完一章就自己接了 ${afterRender - 1} 章`, String(afterRender));

  /* ② 程式化捲到底也不准接章 */
  await page.evaluate(() => { const s = document.querySelector('#stream'); s.scrollTop = s.scrollHeight; });
  await sleep(1800);
  const afterProg = await chaps();
  afterProg === 1
    ? ok('程式化捲到底不算手勢')
    : bad(`程式化捲動接了 ${afterProg - 1} 章`, String(afterProg));

  const box = await page.evaluate(() => {
    const r = document.querySelector('#stream').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });

  /* 一次滑動 = 12 個滾輪事件，每 15ms 一個（約 180ms）。
     一次滑動不管幾個事件，只能接 1 章。 */
  async function flick(times, deltaY) {
    for (let i = 0; i < times; i++) {
      await page.evaluate((d) => {
        const s = document.querySelector('#stream');
        s.dispatchEvent(new WheelEvent('wheel', { deltaY: d, bubbles: true, cancelable: true }));
      }, deltaY);
      await sleep(15);
    }
  }
  /* 真滾輪：從底部上方 150px 一路捲到底（每一格都會產生真的 scroll 事件，
     這才是 JOJO 實際踩到跳章的路徑） */
  async function scrollBurst(fromBottom, times, delta) {
    await page.evaluate((fb) => {
      const s = document.querySelector('#stream');
      s.scrollTop = Math.max(0, s.scrollHeight - s.clientHeight - fb);
    }, fromBottom);
    await sleep(1400);
    await page.mouse.move(box.x, box.y);
    for (let i = 0; i < times; i++) { await page.mouse.wheel({ deltaY: delta }); await sleep(30); }
  }

  const before1 = await chaps();
  await scrollBurst(150, 6, 60);          // 一路捲到底
  await sleep(2500);
  await idle();
  await sleep(700);
  const after1 = await chaps();
  after1 - before1 === 1
    ? ok('真的滑到底只接 1 章（6 格滾輪）')
    : bad(`一次滑動接了 ${after1 - before1} 章`, `before=${before1} after=${after1}`);

  /* 進度：只記視窗上緣那一章（第 1 章），不是剛接進來的第 2 章 ── */
  const progPath = path.join(PROBE, 'progress.json');
  const readProg = () => {
    try { return JSON.parse(fs.readFileSync(progPath, 'utf8')); } catch { return null; }
  };
  const firstId = await page.evaluate(() => {
    const d = window.__moyuDebug;
    return (d.state.chapters[0] || {}).id || '';
  });
  let prog = readProg();
  let entry = prog && prog.books && prog.books[BOOK];
  entry && entry.chapterId === firstId
    ? ok(`進度記在看的這一章（第 ${entry.chapterNo} 章），沒被連讀帶走`)
    : bad('進度被連讀帶走了', JSON.stringify(entry) + ' 應該要是 ' + firstId);

  /* 把新接進來那章讀到底，再一次滑動 → 只 +1 */
  const before2 = await chaps();
  await scrollBurst(150, 6, 60);
  await sleep(2500);
  await idle();
  await sleep(700);
  const after2 = await chaps();
  after2 - before2 === 1
    ? ok('第二次滑到底也只接 1 章')
    : bad(`第二次滑動接了 ${after2 - before2} 章`, `before=${before2} after=${after2}`);

  /* 一次滑動 12 個事件（合成），也只准 1 章 */
  await page.evaluate(() => { const s = document.querySelector('#stream'); s.scrollTop = s.scrollHeight; });
  await sleep(1400);
  const before2b = await chaps();
  await flick(12, 120);
  await sleep(2500);
  await idle();
  await sleep(700);
  const after2b = await chaps();
  after2b - before2b <= 1
    ? ok('12 個滾輪事件最多接 1 章')
    : bad(`12 個事件接了 ${after2b - before2b} 章`, `before=${before2b} after=${after2b}`);

  /* 往上滑：不准接章 */
  const before3 = await chaps();
  await flick(8, -120);
  await sleep(1500);
  const after3 = await chaps();
  after3 === before3 ? ok('往上滑不接章') : bad(`往上滑接了 ${after3 - before3} 章`);

  /* 真的捲進下一章 → 進度要跟著走 */
  const nextId = await page.evaluate(() => {
    const d = window.__moyuDebug;
    return (d.state.chapters[1] || {}).id || '';
  });
  await page.evaluate(() => {
    const b = document.querySelectorAll('#stream .pb')[1];
    if (b) b.scrollIntoView({ block: 'start' });
  });
  /* 捲動監看是「停下來 800ms 才寫」，所以用等的，不要用猜的 */
  let got = null;
  for (let i = 0; i < 12; i++) {
    await sleep(500);
    const p = readProg();
    const e = p && p.books && p.books[BOOK];
    if (e && e.chapterId === nextId) { got = e; break; }
    got = e;
  }
  nextId && got && got.chapterId === nextId
    ? ok(`捲進第 2 章後進度跟著更新（第 ${got.chapterNo} 章）`)
    : bad('捲到下一章進度沒更新', JSON.stringify(got) + ' 應該要是 ' + nextId);

  /* 小視窗收合目錄：左邊不准有陰影 */
  const shadow = await page.evaluate(() => {
    const app = document.querySelector('.app');
    const had = app.classList.contains('side-open');
    app.classList.remove('side-open');
    const closed = getComputedStyle(document.querySelector('.side')).boxShadow;
    app.classList.add('side-open');
    const open = getComputedStyle(document.querySelector('.side')).boxShadow;
    if (!had) app.classList.remove('side-open');
    return { closed, open, width: window.innerWidth };
  });
  shadow.width <= 760 ? ok(`小視窗（${shadow.width}px）確認走抽屜模式`) : bad(`視窗寬 ${shadow.width}px，沒進抽屜模式`);
  shadow.closed === 'none' ? ok('目錄收起來時沒有陰影') : bad('目錄收起來還有陰影', shadow.closed);
  shadow.open !== 'none' ? ok('目錄打開時保留陰影（有層次）') : bad('目錄打開時陰影不見了');

  errors.length === 0 ? ok('全程無 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  await page.screenshot({ path: path.join(__dirname, '..', '_probe', 'jump-e2e.png') });

  console.log('\n===== 一次滑動只接一章 =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);

  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(600);
  process.exit(fails === 0 ? 0 : 1);
})();
