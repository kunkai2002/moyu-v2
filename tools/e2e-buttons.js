// 全按鈕自檢：頂欄、溢出、面板、右鍵選單、首頁、歷史、拖拽、小視窗、連讀
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || path.join('C:', 'Users', 'Admin', 'AppData', 'Local', 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const REAL = path.join(APP, 'data');
const PROBE = path.join(__dirname, '..', '_probe', 'e2e-data-buttons');
const PORT = 9340;

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });
const warn = (n, e = '') => results.push({ pass: null, n, e });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(PROBE, { recursive: true });
  for (const f of ['cookie.txt', 'cookies.json', 'settings.json', 'prefs.json', 'sync.json']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROBE, f));
  }
  fs.mkdirSync(path.join(PROBE, 'chapters'), { recursive: true });

  const log = fs.openSync(path.join(__dirname, '..', '_probe', 'buttons.log'), 'w');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'], { stdio: ['ignore', log, log] });

  let browser = null;
  for (let i = 0; i < 50 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 600000 }); } catch {}
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

  /* 先開一本書，讓正文有內容 */
  await page.evaluate(async () => { await window.__moyuDebug.openBook('7373660003258862617'); });
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    const n = await page.evaluate(() => document.querySelectorAll('#tree .ch').length);
    if (n > 10) break;
  }
  const ready = await page.evaluate(() => document.querySelectorAll('#stream .pb .p').length);
  ready > 0 ? ok(`準備：正文已載入 ${ready} 段`) : bad('準備：正文沒載入');

  console.log('· [1] 頂欄');
  /* ── 1. 頂欄每一顆 ── */
  const topbar = await page.evaluate(() => [...document.querySelectorAll('.topbar .tb-btn')].map((b) => b.id));
  const EXPECT = ['tbBack', 'tbFwd', 'tbList', 'tbMark', 'tbStat', 'tbHome', 'tbHistory', 'tbBoss', 'tbPhone', 'tbSettings', 'tbMore'];
  const missing = EXPECT.filter((id) => !topbar.includes(id));
  missing.length === 0 ? ok(`頂欄：${topbar.length} 顆齊全`) : bad('頂欄：缺按鈕', missing.join(','));

  for (const id of topbar) {
    const before = errors.length;
    const r = await page.evaluate(async (bid) => {
      const el = document.getElementById(bid);
      if (!el) return { ok: false, why: '找不到' };
      const html = document.body.innerHTML.length;
      el.click();
      await new Promise((res) => setTimeout(res, 320));
      const panels = [...document.querySelectorAll('.panel, .marks-panel, .stats-panel, .detail, .hist-panel')]
        .filter((p) => !p.hidden).length;
      const focused = document.activeElement ? document.activeElement.id : '';
      return { ok: true, changed: document.body.innerHTML.length !== html, panels, focused };
    }, id);
    const newErr = errors.slice(before);
    if (!r.ok) bad(`按鈕 ${id}：${r.why}`);
    else if (newErr.length) bad(`按鈕 ${id}：拋錯 ${newErr[0].slice(0, 60)}`);
    else if (!r.changed && r.panels === 0 && !r.focused) warn(`按鈕 ${id}：按了沒有可見變化`);
    else ok(`按鈕 ${id}：有反應`);
    // 關掉可能開起來的面板
    await page.evaluate(() => {
      // 老闆鍵按下去之後一定要退出假畫面，否則後面的量測全在假畫面裡
      try { window.__moyuDebug.boss(false); } catch (e) {}
      document.body.classList.remove('bossing');
      document.querySelectorAll('.panel, .marks-panel, .stats-panel, .detail, .hist-panel, .phone-panel')
        .forEach((p) => { p.hidden = true; });
    });
    await sleep(120);
  }

  console.log('· [2] 溢出');
  /* ── 2. 溢出選單 ── */
  const ovRows = await page.evaluate(async () => {
    document.querySelector('#tbMore')?.click();
    await new Promise((r) => setTimeout(r, 260));
    const ov = document.querySelector('.overflow');
    const rows = ov ? [...ov.querySelectorAll('.ov-row')].map((r) => r.textContent.trim()) : [];
    if (ov) ov.hidden = true;
    return rows;
  });
  ovRows.length ? ok(`溢出：${ovRows.length} 項（${ovRows.join(' / ')}）`) : warn('溢出：沒有項目');

  console.log('· [3] 首頁');
  /* 手機面板 */
  const phone = await page.evaluate(async () => {
    document.querySelector('#tbPhone').click();
    await new Promise((r) => setTimeout(r, 1000));
    const panel = document.querySelector('.phone-panel');
    const url = panel ? panel.querySelector('#phUrl').value : '';
    const open = !!panel && !panel.hidden;
    if (panel) panel.hidden = true;
    return { open, url };
  });
  phone.open ? ok('手機面板：打得開') : bad('手機面板：打不開');
  /\/m\/#t=.+/.test(phone.url) ? ok('手機面板：網址帶金鑰') : bad('手機面板：網址不對', phone.url);

  /* 資訊架構：頂欄與溢出不得重複 */
  const ia = await page.evaluate(async () => {
    const top = [...document.querySelectorAll('.topbar .tb-btn')].map((b) => (b.title || '').trim());
    document.querySelector('#tbMore')?.click();
    await new Promise((r) => setTimeout(r, 260));
    const ov = document.querySelector('.overflow');
    const rows = ov ? [...ov.querySelectorAll('.ov-row')].map((r) => r.textContent.trim()) : [];
    if (ov) ov.hidden = true;
    return { top, rows };
  });
  const DUP = ['最近', '歷史', '統計', '標記', '章節', '書架', '首頁', '手機', '設定', '目錄', '老闆鍵'];
  const dupHit = ia.rows.filter((row) => DUP.some((k) => row.startsWith(k)));
  dupHit.length === 0 ? ok(`資訊架構：溢出沒有重複項（${ia.rows.join(' / ') || '空'}）`) : bad('資訊架構：溢出有重複', dupHit.join(','));
  const noTitle = ia.top.filter((t) => !t);
  noTitle.length === 0 ? ok(`資訊架構：頂欄 ${ia.top.length} 顆都有標題`) : bad('資訊架構：有按鈕沒有標題');

  /* ── 3. 首頁 ── */
  await page.evaluate(() => document.querySelector('#tbHome').click());
  await sleep(1500);
  const home = await page.evaluate(() => ({
    visible: !!document.querySelector('.home'),
    books: document.querySelectorAll('.home-book').length,
    rows: document.querySelectorAll('.home-row').length,
    cont: !!document.querySelector('#homeContinue'),
  }));
  home.visible ? ok('首頁：畫面出現') : bad('首頁：沒出現');
  home.books > 0 ? ok(`首頁：書架 ${home.books} 本`) : bad('首頁：書架空的');
  home.cont ? ok('首頁：有「繼續閱讀」卡片') : warn('首頁：沒有繼續閱讀卡片');

  console.log('· [4] 歷史');
  /* ── 4. 歷史 ── */
  await page.evaluate(() => document.querySelector('#tbHistory').click());
  await sleep(400);
  const hist = await page.evaluate(() => ({
    open: !!document.querySelector('.hist-panel') && !document.querySelector('.hist-panel').hidden,
    rows: document.querySelectorAll('.hist-row').length,
  }));
  hist.open ? ok('歷史：抽屜打開') : bad('歷史：打不開');
  hist.rows > 0 ? ok(`歷史：${hist.rows} 筆`) : warn('歷史：沒有記錄');
  await page.evaluate(() => { const p = document.querySelector('.hist-panel'); if (p) p.hidden = true; });

  console.log('· [5] 右鍵');
  /* ── 5. 右鍵選單 ── */
  await page.evaluate(() => document.querySelector('#tbHome').click());
  await sleep(300);
  await page.evaluate(async () => { await window.__moyuDebug.openBook('7373660003258862617'); });
  await sleep(2600);
  const ctx = await page.evaluate(() => {
    const p = document.querySelector('#stream .pb .p');
    if (!p) return { items: [], opened: false };
    p.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 300 }));
    return {
      opened: window.__moyuRemember.menuOpen,
      items: window.__moyuRemember.items,
    };
  });
  ctx.opened ? ok('右鍵：選單可開') : bad('右鍵：選單打不開');
  const wantCtx = ['記住進度', '劃線', '寫筆記…', '複製這段', '全書搜尋這段'];
  const missCtx = wantCtx.filter((w) => !ctx.items.some((i) => i.includes(w.replace('…', ''))));
  missCtx.length === 0 ? ok(`右鍵：五項齊（${ctx.items.length}）`) : bad('右鍵：缺項', missCtx.join(','));

  /* 複製 */
  await page.evaluate(() => { window.__moyuRemember.menuOpen; document.querySelector('#rmCopy').click(); });
  await sleep(400);
  const toast1 = await page.evaluate(() => document.querySelector('.rm-toast')?.textContent || '');
  /複製/.test(toast1) ? ok(`右鍵：複製回應「${toast1}」`) : bad('右鍵：複製沒反應', toast1);

  /* 劃線 */
  const markOn = await page.evaluate(async () => {
    const p = document.querySelector('#stream .pb .p');
    window.__moyuRemember.openWith(p);
    document.querySelector('#rmMark').click();
    await new Promise((r) => setTimeout(r, 500));
    return document.querySelectorAll('#stream .p.marked').length;
  });
  markOn > 0 ? ok('右鍵：劃線生效') : bad('右鍵：劃線沒生效');

  /* 搜尋 */
  await page.evaluate(() => {
    const p = document.querySelectorAll('#stream .pb .p')[2];
    window.__moyuRemember.openWith(p);
    document.querySelector('#rmSearch').click();
  });
  await sleep(1200);
  const searched = await page.evaluate(() => document.body.innerText.includes('搜尋'));
  searched ? ok('右鍵：全書搜尋有輸出') : warn('右鍵：搜尋沒有明顯輸出');

  console.log('· [6] 拖拽');
  /* 確保沒在假畫面、正文在 */
  await page.evaluate(async () => {
    try { window.__moyuDebug.boss(false); } catch (e) {}
    document.body.classList.remove('bossing');
    if (!window.__moyuDebug.state.book) await window.__moyuDebug.openBook('7373660003258862617');
  });
  await sleep(1800);

  /* ── 6. 拖拽 ── */
  const sideDrag = await page.evaluate(async () => {
    const rz = document.querySelector('.side .rz');
    if (!rz) return { ok: false };
    const before = getComputedStyle(document.documentElement).getPropertyValue('--side-w').trim();
    const r = rz.getBoundingClientRect();
    rz.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + 2, clientY: r.top + 40 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 330, clientY: r.top + 40 }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 120));
    return { ok: true, before, after: getComputedStyle(document.documentElement).getPropertyValue('--side-w').trim(), saved: localStorage.getItem('moyu.sideW') };
  });
  sideDrag.ok && sideDrag.before !== sideDrag.after ? ok(`拖拽：目錄寬 ${sideDrag.before} → ${sideDrag.after}（已記住 ${sideDrag.saved}）`) : bad('拖拽：目錄拖不動', JSON.stringify(sideDrag));

  const panelDrag = await page.evaluate(async () => {
    document.querySelector('#tbSettings').click();
    await new Promise((r) => setTimeout(r, 300));
    const panel = document.querySelector('.panel');
    const rz = panel?.querySelector('.panel-rz');
    if (!rz) return { ok: false };
    const before = panel.getBoundingClientRect().width;
    const r = rz.getBoundingClientRect();
    rz.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + 2, clientY: r.top + 40 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: window.innerWidth - 420, clientY: r.top + 40 }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 120));
    const after = panel.getBoundingClientRect().width;
    panel.hidden = true;
    return { ok: true, before, after };
  });
  panelDrag.ok && Math.abs(panelDrag.after - panelDrag.before) > 8 ? ok(`拖拽：面板寬 ${Math.round(panelDrag.before)} → ${Math.round(panelDrag.after)}`) : bad('拖拽：面板拖不動', JSON.stringify(panelDrag));

  const inputDrag = await page.evaluate(async () => {
    const h = document.querySelector('.input-rz');
    const input = document.querySelector('#input');
    if (!h || !input) return { ok: false };
    const before = input.getBoundingClientRect().height;
    const r = h.getBoundingClientRect();
    h.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + 40, clientY: r.top }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + 40, clientY: r.top - 60 }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 120));
    return { ok: true, before, after: input.getBoundingClientRect().height };
  });
  inputDrag.ok && inputDrag.after > inputDrag.before + 10 ? ok(`拖拽：輸入框 ${Math.round(inputDrag.before)} → ${Math.round(inputDrag.after)}px`) : bad('拖拽：輸入框拖不動', JSON.stringify(inputDrag));

  console.log('· [7] 小窗');
  /* ── 7. 小視窗 ── */
  await page.setViewport({ width: 420, height: 320 });
  await sleep(700);
  const small = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    toggleVisible: getComputedStyle(document.querySelector('.side-toggle')).display !== 'none',
    inputVisible: !!document.querySelector('#input') && document.querySelector('#input').getBoundingClientRect().height > 20,
  }));
  small.overflowX <= 2 ? ok('小窗：沒有橫向溢出') : bad('小窗：橫向溢出', String(small.overflowX));
  small.toggleVisible ? ok('小窗：目錄抽屜按鈕出現') : bad('小窗：沒有目錄按鈕');
  small.inputVisible ? ok('小窗：輸入框還在') : bad('小窗：輸入框被擠掉');
  await page.setViewport({ width: 1440, height: 900 });
  await sleep(400);

  console.log('· [8] 連讀');
  /* ── 8. 連讀 ── */
  let flow = { sentinel: false, index: 0 };
  for (let i = 0; i < 20; i++) {
    flow = await page.evaluate(() => ({
      sentinel: !!document.querySelector('.flow-more'),
      index: window.__moyuDebug.state.index,
    }));
    if (flow.sentinel) break;
    await sleep(400);
  }
  flow.sentinel ? ok('連讀：底部哨兵存在') : bad('連讀：沒有哨兵');
  let perRound = [];
  for (let i = 0; i < 3; i++) {
    const before = await page.evaluate(() => window.__moyuDebug.state.index);
    await page.evaluate(() => {
    const s = document.querySelector('#stream');
    s.scrollTop = s.scrollHeight;
    s.dispatchEvent(new Event('scroll'));
    s.dispatchEvent(new WheelEvent('wheel', { deltaY: 240, bubbles: true }));
    s.dispatchEvent(new Event('scroll'));
    });
    await sleep(2600);
    const after = await page.evaluate(() => window.__moyuDebug.state.index);
    perRound.push(after - before);
  }
  const after = await page.evaluate(() => ({
    index: window.__moyuDebug.state.index,
    chaps: document.querySelectorAll('#stream .chap').length,
    seps: document.querySelectorAll('#stream .chap-sep').length,
  }));
  after.index > flow.index ? ok(`連讀：${flow.index} → ${after.index} 章（細線 ${after.seps}）`) : bad('連讀：沒有自動接章', JSON.stringify(after));
  const runaway = perRound.some((n) => n > 1);
  runaway ? bad('連讀：一輪接了多章（會自己往前衝）', JSON.stringify(perRound)) : ok(`連讀：每輪最多一章 ${JSON.stringify(perRound)}`);

  errors.length === 0 ? ok('全程無 pageerror') : bad('有 pageerror', errors.slice(0, 3).join(' | '));

  await page.screenshot({ path: path.join(__dirname, '..', '_probe', 'buttons-e2e.png') });

  console.log('\n===== 全按鈕自檢 =====');
  for (const r of results) console.log(`${r.pass === null ? '⚠️' : (r.pass ? '✅' : '❌')} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => r.pass === false).length;
  const warns = results.filter((r) => r.pass === null).length;
  console.log(`\n通過 ${results.length - fails - warns} · 警告 ${warns} · 失敗 ${fails}`);

  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(600);
  process.exit(fails === 0 ? 0 : 1);
})();
