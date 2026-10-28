// 驗證：① 章節自動連讀 + 章間細線 ② 記住進度（本機 + 雲端）
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || path.join('C:', 'Users', 'Admin', 'AppData', 'Local', 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const REAL = path.join(APP, 'data');
const PROBE = path.join(__dirname, '..', '_probe', 'e2e-data-flow');
const PORT = 9339;

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(PROBE, { recursive: true });
  for (const f of ['cookie.txt', 'cookies.json', 'settings.json', 'prefs.json']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROBE, f));
  }
  // 測試用的 sync.json：保留網址讓「已設定」成立，但金鑰換成假的，
  // 這樣測試按「記住進度」不會把測試書寫進 JOJO 真正的雲端。
  const realSync = path.join(REAL, 'sync.json');
  if (fs.existsSync(realSync)) {
    const s = JSON.parse(fs.readFileSync(realSync, 'utf8'));
    s.token = 'e2e-test-only-token';
    s.deviceId = 'dev-e2etest';
    fs.writeFileSync(path.join(PROBE, 'sync.json'), JSON.stringify(s, null, 1), 'utf8');
  }
  fs.mkdirSync(path.join(PROBE, 'chapters'), { recursive: true });

  const log = fs.openSync(path.join(__dirname, '..', '_probe', 'flow.log'), 'w');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'], { stdio: ['ignore', log, log] });

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
  await sleep(1400);

  /* 開一本免費書的第一章 */
  await page.evaluate(async () => { await window.__moyuDebug.openBook('7373660003258862617'); });
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    const n = await page.evaluate(() => document.querySelectorAll('#tree .ch').length);
    if (n > 10) break;
  }
  await page.evaluate(() => window.__moyuDebug.goChapter(0, { announce: false }));
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    const c = await page.evaluate(() => document.querySelectorAll('#stream .pb .p').length);
    if (c > 3) break;
  }

  const mods = await page.evaluate(() => ({
    flow: !!window.__moyuFlow,
    remember: !!window.__moyuRemember,
  }));
  mods.flow ? ok('模組：flow.js 已載入') : bad('模組：flow.js 沒載入');
  mods.remember ? ok('模組：remember.js 已載入') : bad('模組：remember.js 沒載入');

  const balls = await page.evaluate(() => document.querySelectorAll('.rm-ball').length);
  balls === 0 ? ok('UI：小圓球已移除（只剩右鍵選單）') : bad('UI：小圓球還在', String(balls));

  /* 滾到底 3 次，看會不會自動接章 */
  for (let round = 0; round < 4; round++) {
    await page.evaluate(() => {
    const s = document.querySelector('#stream');
    s.scrollTop = s.scrollHeight;
    s.dispatchEvent(new Event('scroll'));
    s.dispatchEvent(new WheelEvent('wheel', { deltaY: 240, bubbles: true }));
    s.dispatchEvent(new Event('scroll'));
    });
    await sleep(2800);
  }
  const flow = await page.evaluate(() => ({
    chaps: document.querySelectorAll('#stream .chap').length,
    seps: document.querySelectorAll('#stream .chap-sep').length,
    index: window.__moyuDebug.state.index,
    chars: [...document.querySelectorAll('#stream .pb .p')].reduce((n, p) => n + p.innerText.trim().length, 0),
  }));
  flow.chaps >= 2 ? ok(`連讀：一次滾到底讀了 ${flow.chaps} 章（state.index=${flow.index}）`) : bad('連讀：沒有自動接下一章', JSON.stringify(flow));
  flow.seps >= 1 ? ok(`連讀：章間細線 ${flow.seps} 條`) : bad('連讀：沒有細線');
  flow.chars > 1500 ? ok(`連讀：累積 ${flow.chars} 字`) : bad('連讀：內容太少', String(flow.chars));

  /* 記住進度：走真正的右鍵路徑 */
  const toastBefore = await page.evaluate(() => document.querySelector('.rm-toast')?.textContent || '');
  const menuOpened = await page.evaluate(() => {
    const para = document.querySelector('#stream .pb .p');
    const r = para.getBoundingClientRect();
    para.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: Math.round(r.left + 40), clientY: Math.round(r.top + 8),
    }));
    return window.__moyuRemember.menuOpen;
  });
  menuOpened ? ok('右鍵：段落上按右鍵出選單') : bad('右鍵：選單沒出來');

  const menuText = await page.evaluate(() => document.querySelector('.rm-menu')?.innerText || '');
  /記住進度/.test(menuText) ? ok(`右鍵：選單有「記住進度」（${menuText.replace(/\n+/g, ' / ').slice(0, 40)}）`) : bad('右鍵：選單沒有記住進度', menuText);
  const menuItems = await page.evaluate(() => window.__moyuRemember.items);
  const wantItems = ['記住進度', '劃線', '寫筆記', '複製這段', '全書搜尋這段'];
  const missItems = wantItems.filter((w) => !menuItems.some((i) => i.includes(w.replace('…', ''))));
  missItems.length === 0 ? ok(`右鍵：五項齊（${menuItems.length}）`) : bad('右鍵：缺項', missItems.join(','));

  await page.evaluate(() => document.querySelector('#rmSave').click());
  await sleep(1800);
  const after = await page.evaluate(() => document.querySelector('.rm-toast')?.textContent || '');
  /記住/.test(after) ? ok(`記住進度：提示「${after}」`) : bad('記住進度：沒有提示', after || toastBefore);

  const prog = JSON.parse(fs.readFileSync(path.join(PROBE, 'progress.json'), 'utf8'));
  const bookId = '7373660003258862617';
  const entry = prog.books && prog.books[bookId];
  entry && entry.para !== undefined ? ok(`記住進度：progress.json 記下第 ${entry.chapterNo} 章 para=${entry.para}`) : bad('記住進度：progress.json 沒寫入');
  const marksFile = path.join(PROBE, 'marks.json');
  const marks = fs.existsSync(marksFile) ? JSON.parse(fs.readFileSync(marksFile, 'utf8')) : {};
  const pos = (marks[bookId] || []).filter((m) => m.type === 'pos');
  pos.length ? ok(`記住進度：marks.json 有 ${pos.length} 筆位置標記`) : bad('記住進度：沒有位置標記');

  /* 雲端狀態（沒設定時要老實說） */
  const syncSt = await page.evaluate(async () => window.moyu.sync.status());
  syncSt && typeof syncSt.configured === 'boolean' ? ok(`雲端：狀態可讀（configured=${syncSt.configured}）`) : bad('雲端：狀態讀不到');
  /雲端/.test(after) ? ok('記住進度：提示含雲端結果') : bad('記住進度：沒說雲端結果', after);

  /* 標記刪除（用 (bookId, id) 這種舊簽名呼叫） */
  if (pos.length) {
    await page.evaluate((bid, id) => window.moyu.marks.remove(bid, id), bookId, pos[0].id);
    await sleep(500);
    const after2 = JSON.parse(fs.readFileSync(marksFile, 'utf8'));
    const left = (after2[bookId] || []).filter((m) => m.id === pos[0].id);
    left.length === 0 ? ok('標記：remove(bookId, id) 可正常刪除') : bad('標記：刪不掉', pos[0].id);
  }

  /* 統計 IPC */
  const stats = await page.evaluate(async () => {
    await window.moyu.stats.add({ chars: 123, seconds: 4 });
    return await window.moyu.stats.get();
  });
  stats && stats.today && stats.today.chars >= 123 ? ok(`統計：今日 ${stats.today.chars} 字`) : bad('統計：讀寫異常', JSON.stringify(stats && stats.today));

  errors.length === 0 ? ok('全程無 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  await page.screenshot({ path: path.join(__dirname, '..', '_probe', 'flow-e2e.png') });

  console.log('\n===== 連讀 + 記住進度 =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);

  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(600);
  process.exit(fails === 0 ? 0 : 1);
})();
