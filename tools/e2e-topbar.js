// 頂欄檢查：小視窗下每顆按鈕是不是真的看得到、點得到；歷史抽屜開不開得起來
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const REAL = path.join(APP, 'data');
const PROBE = path.join(__dirname, '..', '_probe', 'e2e-data-topbar');
const PORT = 9346;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });

(async () => {
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(PROBE, { recursive: true });
  for (const f of ['cookie.txt', 'cookies.json', 'settings.json', 'prefs.json', 'progress.json', 'shelf.json']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROBE, f));
  }
  fs.mkdirSync(path.join(PROBE, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(PROBE, 'window.json'),
    JSON.stringify({ width: 565, height: 505, x: 140, y: 140, maximized: false }), 'utf8');

  const log = fs.openSync(path.join(__dirname, '..', '_probe', 'topbar.log'), 'w');
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
  if (!page) { console.error('❌ 找不到頁面'); browser.disconnect(); process.exit(2); }
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await sleep(2000);

  /* 每顆頂欄按鈕：在不在框裡、看不看得到 */
  const bar = await page.evaluate(() => {
    const r = document.querySelector('.topbar-r');
    const barEl = document.querySelector('.topbar') || r.parentElement;
    const bx = barEl.getBoundingClientRect();
    return {
      winW: innerWidth,
      barScrollW: r.scrollWidth,
      barClientW: r.clientWidth,
      crumbW: Math.round((document.querySelector('.crumb') || {}).getBoundingClientRect?.().width || 0),
      buttons: [...r.querySelectorAll('.tb-btn')].map((b) => {
        const q = b.getBoundingClientRect();
        return {
          id: b.id,
          title: b.title,
          w: Math.round(q.width),
          visible: q.width > 0 && q.height > 0 && !b.hidden,
          insideBar: q.right <= bx.right + 1 && q.left >= bx.left - 1,
        };
      }),
    };
  });
  console.log('\n視窗寬', bar.winW, '/ 頂欄右側 scrollWidth', bar.barScrollW, 'clientWidth', bar.barClientW, '/ crumb', bar.crumbW);
  for (const b of bar.buttons) console.log(`  ${b.visible ? '看得到' : '看不到'}  ${b.insideBar ? '在框內' : '超出框外'}  ${b.id} (${b.title}) w=${b.w}`);

  const clipped = bar.buttons.filter((b) => !b.visible || !b.insideBar);
  clipped.length === 0 ? ok('頂欄按鈕全部在框內、看得到') : bad(`頂欄有 ${clipped.length} 顆被擠掉`, clipped.map((b) => b.title).join(','));

  /* 歷史：點下去要開得起來、要有資料 */
  const hist = await page.evaluate(async () => {
    const b = document.querySelector('#tbHistory');
    if (!b) return { err: '沒有 #tbHistory 按鈕' };
    b.click();
    await new Promise((r) => setTimeout(r, 300));
    const panel = document.querySelector('.hist-panel');
    return {
      hidden: panel ? panel.hidden : 'no panel',
      rows: panel ? panel.querySelectorAll('.hist-row').length : 0,
      empty: panel ? !!panel.querySelector('.hist-empty') : false,
    };
  });
  hist.err ? bad('歷史：按鈕不存在', hist.err)
    : (hist.hidden === false ? ok(`歷史：抽屜打開（${hist.rows} 筆）`) : bad('歷史：點了沒開', JSON.stringify(hist)));
  hist.rows > 0 ? ok('歷史：有資料') : bad('歷史：是空的', JSON.stringify(hist));

  /* 更多選單裡的每一項都要真的打得開（不能是死按鈕） */
  const more = await page.evaluate(async () => {
    const btn = document.querySelector('#tbMore');
    if (!btn) return { err: '沒有 #tbMore' };
    btn.click();
    await new Promise((r) => setTimeout(r, 200));
    const ov = document.querySelector('.overflow');
    const rows = [...(ov ? ov.querySelectorAll('.ov-row') : [])].map((r) => r.textContent.trim());
    return { open: ov ? !ov.hidden : false, rows };
  });
  more.err ? bad('更多：按鈕不存在', more.err)
    : (more.open ? ok(`更多：選單打開（${more.rows.length} 項：${more.rows.join(' / ')}）`) : bad('更多：選單沒開', JSON.stringify(more)));

  const wanted = ['首頁', '統計', '手機版', '設定', '老闆鍵'];
  const missing = wanted.filter((w) => !(more.rows || []).some((t) => t.startsWith(w)));
  missing.length === 0 ? ok('更多：五項齊') : bad('更多：缺項', missing.join(','));

  /* 一項一項點，看有沒有東西真的打開 */
  async function clickMore(label) {
    return await page.evaluate(async (lb) => {
      const btn = document.querySelector('#tbMore');
      btn.click();
      await new Promise((r) => setTimeout(r, 150));
      const row = [...document.querySelectorAll('.overflow .ov-row')].find((r) => r.textContent.trim().startsWith(lb));
      if (!row) return { err: '找不到 ' + lb };
      row.click();
      await new Promise((r) => setTimeout(r, 700));
      const vis = (sel) => !!document.querySelector(sel + ':not([hidden])');
      return {
        stats: vis('.stats-panel'),
        phone: vis('.phone-panel'),
        panel: vis('.panel'),
        boss: document.body.classList.contains('bossing'),
        home: !!document.querySelector('#stream .home'),
      };
    }, label);
  }

  const mStats = await clickMore('統計');
  mStats.stats ? ok('更多 → 統計：面板打開') : bad('更多 → 統計：沒反應', JSON.stringify(mStats));
  await page.evaluate(() => { const p = document.querySelector('.stats-panel'); if (p) p.hidden = true; });

  const mPhone = await clickMore('手機版');
  mPhone.phone ? ok('更多 → 手機版：面板打開') : bad('更多 → 手機版：沒反應', JSON.stringify(mPhone));
  await page.evaluate(() => { const p = document.querySelector('.phone-panel'); if (p) p.hidden = true; });

  const mSet = await clickMore('設定');
  mSet.panel ? ok('更多 → 設定：面板打開') : bad('更多 → 設定：沒反應', JSON.stringify(mSet));
  await page.evaluate(() => document.querySelectorAll('.panel').forEach((p) => { p.hidden = true; }));

  const mHome = await clickMore('首頁');
  mHome.home ? ok('更多 → 首頁：回到首頁') : bad('更多 → 首頁：沒反應', JSON.stringify(mHome));

  /* 標記面板（頂欄那顆）也要能開 */
  const marks = await page.evaluate(async () => {
    document.querySelector('#tbMark').click();
    await new Promise((r) => setTimeout(r, 600));
    const p = document.querySelector('.marks-panel');
    return { open: p ? !p.hidden : false };
  });
  marks.open ? ok('頂欄 → 標記：面板打開') : bad('頂欄 → 標記：沒反應', JSON.stringify(marks));

  /* 老闆鍵（點完立刻退出假畫面，不然後面全錯） */
  const mBoss = await clickMore('老闆鍵');
  mBoss.boss ? ok('更多 → 老闆鍵：進假畫面') : bad('更多 → 老闆鍵：沒反應', JSON.stringify(mBoss));
  await page.evaluate(() => { document.body.classList.remove('bossing'); window.__moyuDebug?.boss(false); });

  errors.length === 0 ? ok('全程無 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  await page.screenshot({ path: path.join(__dirname, '..', '_probe', 'topbar.png') });

  console.log('\n===== 頂欄與歷史 =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);

  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(500);
  process.exit(fails === 0 ? 0 : 1);
})();
