// 外殼快照 + 幾何自檢（無頭）：量 DSH 外殼的關鍵 box，並輸出截圖
//   node tools/shot-shell.js [寬x高 ...]
// 只讀安裝目錄的資料，寫到 _probe/shell-*，不會動到 JOJO 的書
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUT = path.join(ROOT, '_probe');
const DATA = path.join(OUT, 'shell-data');
const PORT = 9367;

const SIZES = (process.argv.slice(2).filter((a) => /^\d+x\d+$/.test(a)).length
  ? process.argv.slice(2).filter((a) => /^\d+x\d+$/.test(a))
  : ['1440x900', '1024x768', '390x844']).map((s) => s.split('x').map(Number));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.mkdirSync(DATA, { recursive: true });
  const REAL = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');
  for (const f of ['prefs.json', 'settings.json', 'progress.json', 'shelf.json', 'cookie.txt']) {
    const src = path.join(REAL, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DATA, f));
  }
  // 章節快取照抄，這樣才有真內容可看（只讀，不重抓）
  const cacheSrc = path.join(REAL, 'chapters');
  if (fs.existsSync(cacheSrc)) {
    fs.mkdirSync(path.join(DATA, 'chapters'), { recursive: true });
    for (const f of fs.readdirSync(cacheSrc)) {
      if (f.endsWith('.json')) fs.copyFileSync(path.join(cacheSrc, f), path.join(DATA, 'chapters', f));
    }
  }
  fs.writeFileSync(path.join(DATA, 'window.json'),
    JSON.stringify({ width: 1440, height: 900, x: 60, y: 40, maximized: false }), 'utf8');
  fs.mkdirSync(OUT, { recursive: true });
  const log = fs.openSync(path.join(OUT, 'shell.log'), 'w');

  const child = spawn(ELECTRON, [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });

  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {}
  }
  if (!browser) { console.error('❌ 連不上 '+PORT); process.exit(2); }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://'));
    if (!page) await sleep(300);
  }
  if (!page) { console.error('❌ 找不到頁面'); process.exit(2); }

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await sleep(1500);

  await page.evaluate(() => {
    try { window.__moyuDebug.setShell('dsh'); window.__moyuDebug.setTheme('dsh'); } catch (e) {}
  });
  await sleep(600);
  // 開真書（只讀快取，不重抓）：沒有這步就只會拍到空狀態，看不到正文與目錄
  if (!process.argv.includes('--empty')) {
    await page.evaluate(async () => {
      try { await window.__moyuDebug.openBook('7143038691944959011'); } catch (e) {}
    });
    for (let i = 0; i < 30; i++) {
      if (await page.evaluate(() => document.querySelectorAll('#stream .p').length > 5)) break;
      await sleep(400);
    }
    await sleep(800);
  }

  const measure = () => {
    const out = {};
    const box = (k, sel) => {
      const el = document.querySelector(sel);
      if (!el) { out[k] = null; return; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      out[k] = {
        w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10,
        x: Math.round(r.left), y: Math.round(r.top),
        radius: cs.borderTopLeftRadius, fs: cs.fontSize, lh: cs.lineHeight,
        display: cs.display, vis: cs.visibility,
      };
    };
    box('side', '.side');
    box('sideBrand', '.side-brand');
    box('saNew', '#saNew');
    box('saRow', '.side-actions .sa');
    box('icon', '#themeBtn');
    box('topbar', '.topbar');
    box('nav', '.tb-nav');
    box('crumb', '.crumb');
    box('topbarR', '.topbar-r');
    box('tabs', '.head-tabs');
    box('right', '.dsh-right');
    box('tree', '#tree');
    box('composerBox', '.composer .box');
    box('input', '#input');
    box('p', '.p');
    box('main', '.main');
    box('stream', '#stream');
    box('thread', '.thread');
    box('turn', '.turn');
    box('b', '.turn .b');
    out.shell = document.documentElement.getAttribute('data-shell');
    out.theme = document.documentElement.getAttribute('data-theme');
    out.rail = document.querySelector('.app').classList.contains('rail');
    out.cols = {
      side: getComputedStyle(document.querySelector('.app')).getPropertyValue('--dsh-col-side').trim(),
      right: getComputedStyle(document.querySelector('.app')).getPropertyValue('--dsh-col-right').trim(),
      content: getComputedStyle(document.querySelector('.app')).getPropertyValue('--dsh-content-w').trim(),
    };
    const appEl = document.querySelector('.app');
    const cs = getComputedStyle(appEl);
    out.app = { w: Math.round(appEl.getBoundingClientRect().width), display: cs.display, dir: cs.flexDirection, wrap: cs.flexWrap };
    out.win = { iw: innerWidth, ih: innerHeight, dw: document.documentElement.clientWidth };
    out.rightBox = (() => { const e = document.querySelector('.dsh-right'); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.left), display: getComputedStyle(e).display }; })();
    out.overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    out.recent = document.querySelectorAll('#sideRecent .sr-row').length;
    out.chapters = document.querySelectorAll('#tree .ch').length;
    out.topbarKids = [...(document.querySelector('.topbar')?.children || [])].map((c) => ({
      cls: c.className, h: Math.round(c.getBoundingClientRect().height), top: Math.round(c.getBoundingClientRect().top),
    }));
    const inp = document.querySelector('#input');
    if (inp) {
      const cs = getComputedStyle(inp);
      out.inputBox = { pad: cs.padding, rows: inp.rows, h: inp.getBoundingClientRect().height,
        lh: cs.lineHeight, minH: cs.minHeight, height: cs.height, border: cs.borderWidth };
    }
    return out;
  };

  const report = {};
  for (const [w, h] of SIZES) {
    await page.evaluate((s) => window.moyu?.win?.setState?.(s), { width: w, height: h });
    await sleep(900);
    report[w + 'x' + h] = await page.evaluate(measure);
    await page.screenshot({ path: path.join(OUT, `shell-${w}x${h}.png`) });
  }
  report.errors = errors.slice(0, 12);
  fs.writeFileSync(path.join(OUT, 'shell-geometry.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));

  browser.disconnect();
  try { child.kill(); } catch {}
  setTimeout(() => process.exit(0), 600);
})();
