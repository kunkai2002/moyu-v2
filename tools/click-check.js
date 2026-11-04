// 快速功能自檢（無頭）：把介面上「看起來能點」的東西點一遍，抓 JS 錯誤
//   node tools/click-check.js
// 這是 dev 版的 e2e-buttons：直接跑本專案的 ui/（不用先打包到安裝目錄）
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DATA = path.join(ROOT, '_probe', 'click-data');
const PORT = 9369;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TARGETS = [
  ['#saNew', 'side'], ['#saPlug', 'side'], ['#saAuto', 'side'], ['#saMore', 'side'],
  ['#bookName', 'side'], ['#themeBtn', 'side'], ['#brandToggle', 'side'], ['#meRow', 'side'],
  ['#tocBtn', 'toc'], ['#headTabs .head-tab[data-view=src]', 'tabs'],
  ['#headTabs .head-tab[data-view=chat]', 'tabs'],
  ['#helpBtn', 'composer'], ['#modeTag', 'composer'],
];

// 這兩顆開機時會被 chrome.js 的 sweep() 收進「更多」溢出選單（JOJO 要頂欄只留四顆），
// 所以不是「不見了」，要驗的是溢出選單裡有對應的列。
const IN_OVERFLOW = ['註解', '老闆鍵'];

(async () => {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.mkdirSync(DATA, { recursive: true });
  const REAL = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');
  for (const f of ['prefs.json', 'settings.json', 'progress.json', 'shelf.json', 'cookie.txt']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DATA, f));
  }
  fs.writeFileSync(path.join(DATA, 'window.json'), JSON.stringify({ width: 1440, height: 900, x: 60, y: 40 }), 'utf8');

  const log = fs.openSync(path.join(ROOT, '_probe', 'click.log'), 'w');
  const child = spawn(ELECTRON, [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });

  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {}
  }
  if (!browser) { console.error('❌ 連不上 ' + PORT); process.exit(2); }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://'));
    if (!page) await sleep(300);
  }
  if (!page) { console.error('❌ 找不到頁面'); process.exit(2); }

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await sleep(1600);
  await page.evaluate(() => { try { window.__moyuDebug.setShell('dsh'); window.__moyuDebug.setTheme('dsh'); } catch (e) {} });
  await sleep(500);

  const rows = [];
  for (const [sel, where] of TARGETS) {
    const before = errors.length;
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return { state: 'missing' };
      const rect = el.getBoundingClientRect();
      const vis = rect.width > 2 && rect.height > 2 && getComputedStyle(el).visibility !== 'hidden';
      try { el.click(); } catch (e) { return { state: 'throw', msg: String(e.message) }; }
      return { state: vis ? 'clicked' : 'hidden', w: Math.round(rect.width), h: Math.round(rect.height) };
    }, sel);
    await sleep(320);
    r.errors = errors.slice(before);
    r.topbarBtns = await page.evaluate(() => ({
      right: document.querySelectorAll('.topbar-r button').length,
      pill: !!document.querySelector('#pillReviews'),
      boss: !!document.querySelector('#bossBtn'),
    }));
    r.where = where;
    r.sel = sel;
    rows.push(r);
    // 點完把可能開起來的面板收掉，避免下一個被蓋住
    await page.evaluate(() => {
      document.querySelectorAll('.panel:not([hidden]), .marks-panel:not([hidden]), .stats-panel:not([hidden]), .hist-panel:not([hidden]), .phone-panel:not([hidden]), .overflow:not([hidden]), .theme-menu:not([hidden]), .ctx.on').forEach((el) => {
        if (el.classList.contains('ctx')) el.classList.remove('on'); else el.hidden = true;
      });
      document.body.classList.remove('bossing');
    });
    await sleep(150);
  }

  const bad = rows.filter((r) => r.state === 'missing' || r.state === 'throw' || r.errors.length);

  // 被收進「更多」的兩顆：驗溢出選單裡真的有點得到的列
  const overflow = await page.evaluate(() => {
    const btn = document.querySelector('#tbMore');
    if (btn) btn.click();
    return new Promise((res) => setTimeout(() => {
      res([...document.querySelectorAll('.overflow:not([hidden]) .ov-row')].map((r) => r.textContent.trim()));
    }, 300));
  });
  for (const want of IN_OVERFLOW) {
    const hit = overflow.some((t) => t.startsWith(want));
    rows.push({ sel: want, where: 'overflow', state: hit ? 'clicked' : 'missing', errors: [] });
    if (!hit) bad.push({ sel: want, state: 'missing' });
  }

  for (const r of rows) {
    console.log(`${r.state === 'clicked' ? '✅' : '❌'} ${(r.where + ' ' + r.sel).padEnd(42)} ${r.state}${r.w ? ' ' + r.w + '×' + r.h : ''}${r.errors.length ? '  ERR: ' + r.errors.join(' | ') : ''}`);
  }
  console.log(`\n${bad.length ? '❌ ' + bad.length + ' 個問題' : '✅ 全部可點、沒有 JS 錯誤'}`);
  fs.writeFileSync(path.join(ROOT, '_probe', 'click-check.json'), JSON.stringify({ rows, errors }, null, 2), 'utf8');
  browser.disconnect();
  try { child.kill(); } catch {}
  process.exit(bad.length ? 1 : 0);
})();
