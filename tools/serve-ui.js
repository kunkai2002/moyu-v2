'use strict';

/* ══════════════════════════════════════════════════════════════
   鏡像站的本機驗證：只讀 ui/ 的靜態伺服器 + 無頭 390×844 檢查
   ─────────────────────────────────────────────────────────────
     node tools/serve-ui.js                 只起伺服器（127.0.0.1:47830）
     node tools/serve-ui.js --port=47831    換 port
     node tools/serve-ui.js --verify        起伺服器 → 無頭 Electron 載入 →
                                            量 390×844 版面 → 截圖 _probe/ → 退出

   為什麼不用 server.js：server.js 會把本機 data/、API、Electron 一起帶進來，
   這支只做「雲端鏡像站會送出去的那一份 ui/」，量到的才是手機真的會看到的版面。
   沒有 /api/* → bridge-http.js 的請求會失敗，ui 必須接住（這點也一起驗）。

   截圖：_probe/mirror-390x844.png（DSH 外殼，含 rail 收合）
        _probe/mirror-390x844-clean.png（全新訪客，沒有 localStorage）
        _probe/mirror-1280x720.png
   報告：_probe/mirror-web.json
   ══════════════════════════════════════════════════════════════ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const UI = path.join(ROOT, 'ui');
const PROBE = path.join(ROOT, '_probe');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const PUPPETEER = 'D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core';
const appEnv = require('./app-env');

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const PORT = Number(arg('port', 47830));
const DEBUG_PORT = Number(arg('debug-port', 9361));
const VERIFY = process.argv.includes('--verify');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveStatic(urlPath) {
  let rel = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  rel = rel.replace(/^\/+/, '');
  if (!rel) rel = 'index.html';
  if (rel.split('/').some((s) => s === '..' || s === '.')) return null;
  const full = path.normalize(path.join(UI, rel));
  if (!full.startsWith(UI + path.sep) && full !== path.join(UI, 'index.html')) return null;
  return full;
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
      return res.end('method not allowed');
    }
    const full = resolveStatic(req.url);
    if (!full) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('forbidden');
    }
    fs.readFile(full, (err, buf) => {
      if (err) {
        /* 只讀 ui/：沒有 /api、沒有代理，跟雲端靜態站一樣，打不到就 404 */
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('not found: ' + req.url);
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Mirror-Serve': 'tools/serve-ui.js',
      });
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

/* ── Electron 的臨時啟動器：只開一個隱藏視窗載入網址，什麼都不做 ── */
function writeBootstrap() {
  const file = path.join(PROBE, 'electron-web-main.js');
  fs.mkdirSync(PROBE, { recursive: true });
  fs.writeFileSync(file, `'use strict';
const { app, BrowserWindow } = require('electron');
const url = process.env.MOYU_WEB_URL || 'http://127.0.0.1:${PORT}/';
app.disableHardwareAcceleration();
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 390, height: 844, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.loadURL(url);
  win.webContents.on('did-fail-load', (e, code, desc) => console.error('did-fail-load', code, desc, url));
});
`, 'utf8');
  return file;
}

async function verify() {
  const puppeteer = require(PUPPETEER);
  const results = [];
  const ok = (n, e = '') => results.push({ pass: true, n, e });
  const bad = (n, e = '') => results.push({ pass: false, n, e });
  const check = (cond, n, e = '') => (cond ? ok(n) : bad(n, e));

  if (!fs.existsSync(ELECTRON)) {
    console.error('❌ 找不到 Electron：' + ELECTRON);
    process.exit(2);
  }

  const server = await startServer();
  const origin = `http://127.0.0.1:${PORT}`;
  const bootstrap = writeBootstrap();
  const userData = path.join(PROBE, 'electron-web-userdata');
  fs.rmSync(userData, { recursive: true, force: true });

  const log = fs.openSync(path.join(PROBE, 'electron-web.log'), 'w');
  const child = spawn(ELECTRON, [
    bootstrap,
    '--hidden',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userData}`,
    /* 隱藏視窗在 Windows 會被當成「被遮住」而降頻，截圖會卡在 Page.captureScreenshot */
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-features=CalculateNativeWinOcclusion',
  ], {
    stdio: ['ignore', log, log],
    env: appEnv({ MOYU_WEB_URL: origin + '/' }),
  });

  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(300);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${DEBUG_PORT}`, defaultViewport: null }); } catch {}
  }
  if (!browser) {
    console.error('❌ 連不上 Electron 偵錯埠 ' + DEBUG_PORT + '（看 _probe/electron-web.log）');
    try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
    server.close();
    process.exit(2);
  }

  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    const pages = await browser.pages().catch(() => []);
    page = pages.find((p) => p.url().startsWith(origin));
    if (!page) await sleep(250);
  }
  if (!page) {
    console.error('❌ 找不到載入 ' + origin + ' 的頁面');
    try { browser.disconnect(); } catch {}
    try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
    server.close();
    process.exit(2);
  }

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));

  await page.waitForSelector('.app', { timeout: 15000 }).catch(() => {});
  await sleep(1400);

  const measure = () => page.evaluate(() => {
    const de = document.documentElement;
    const app = document.querySelector('.app');
    const side = document.querySelector('.side');
    const main = document.querySelector('.main');
    const right = document.querySelector('.dsh-right');
    const statusbar = document.querySelector('.statusbar');
    const topbar = document.querySelector('.topbar');
    const box = document.querySelector('.composer .box');
    const titlebar = document.querySelector('.titlebar');
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: +r.left.toFixed(1), top: +r.top.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    const scrollx = (el) => (el ? { sw: el.scrollWidth, cw: el.clientWidth } : null);
    const overflowEls = [];
    const leftClipEls = [];
    /* 被「比視窗窄」的容器裁掉（例如 .crumb 的 ellipsis）不算橫向溢出；
       被跟視窗同寬的容器（.app/.main）裁掉才算，因為那是真的把內容切掉。 */
    const clippedBySmallAncestor = (el) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        const cs2 = getComputedStyle(p);
        const pr = p.getBoundingClientRect();
        if (/(hidden|clip)/.test(cs2.overflowX) && pr.width > 0 && pr.right < de.clientWidth - 1) return true;
        p = p.parentElement;
      }
      return false;
    };
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      /* 右緣超出＝真的橫向溢出（會被切掉或拉出捲軸） */
      if (r.right > de.clientWidth + 1) {
        if (clippedBySmallAncestor(el)) continue;
        overflowEls.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 48), left: Math.round(r.left), right: Math.round(r.right) });
        if (overflowEls.length >= 8) break;
      }
      /* 左緣只在「不是被 overflow:hidden 容器裁掉的裝飾」時才有意義；這裡只記錄不判紅，
         側欄有沒有跑出畫面由 .side 的 rect 單獨判 */
      if (r.left < -1 && leftClipEls.length < 4) {
        leftClipEls.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 48), left: Math.round(r.left), right: Math.round(r.right) });
      }
    }
    return {
      title: document.title,
      mode: window.moyuMode || '',
      shell: de.getAttribute('data-shell'),
      theme: de.getAttribute('data-theme'),
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      docScrollWidth: de.scrollWidth,
      docClientWidth: de.clientWidth,
      docScrollHeight: de.scrollHeight,
      appRect: rect(app),
      titlebar: rect(titlebar),
      statusbarRect: rect(statusbar),
      appClass: app ? String(app.className) : '',
      appDisplay: app ? getComputedStyle(app).display : 'missing',
      appScrollWidth: app ? app.scrollWidth : 0,
      appClientWidth: app ? app.clientWidth : 0,
      side: rect(side),
      main: rect(main),
      right: right ? Object.assign(rect(right), { display: getComputedStyle(right).display }) : null,
      statusbar: scrollx(statusbar),
      topbar: scrollx(topbar),
      box: scrollx(box),
      stream: scrollx(document.querySelector('.stream')),
      composeVisible: !!document.querySelector('.composer .box'),
      streamLines: document.querySelectorAll('#stream .p').length,
      overflowEls,
      leftClipEls,
    };
  });

  /* 隱藏視窗的 Electron 在 Windows 不進 compositor，Page.captureScreenshot 會卡死
     （實測 8s timeout 也拿不到畫面），所以截圖改由 Chrome headless 拍同一份 ui/；
     版面數字仍然由上面的 Electron 量。 */
  const CHROME_CANDIDATES = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ];

  async function chromeShots() {
    const exe = CHROME_CANDIDATES.find((f) => fs.existsSync(f));
    if (!exe) return { error: '找不到 Chrome/Edge，無法截圖' };
    const chrome = await puppeteer.launch({
      executablePath: exe,
      headless: 'new',
      args: ['--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-gpu'],
    });
    const out = { engine: exe };
    try {
      const p = await chrome.newPage();
      const grab = async (name) => { const f = path.join(PROBE, name); await p.screenshot({ path: f }); return f; };
      const chromeMetrics = () => p.evaluate(() => {
        const de = document.documentElement;
        const app = document.querySelector('.app');
        const side = document.querySelector('.side');
        const statusbar = document.querySelector('.statusbar');
        const r = side ? side.getBoundingClientRect() : null;
        const sr = statusbar ? statusbar.getBoundingClientRect() : null;
        const ar = app ? app.getBoundingClientRect() : null;
        return {
          title: document.title,
          mode: window.moyuMode || '',
          shell: de.getAttribute('data-shell'),
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          docScrollWidth: de.scrollWidth,
          docClientWidth: de.clientWidth,
          appClass: app ? String(app.className) : '',
          appDisplay: app ? getComputedStyle(app).display : 'missing',
          appHeight: ar ? +ar.height.toFixed(1) : null,
          sideWidth: r ? +r.width.toFixed(1) : null,
          sideLeft: r ? +r.left.toFixed(1) : null,
          statusbar: statusbar ? { sw: statusbar.scrollWidth, cw: statusbar.clientWidth, bottom: sr ? +sr.bottom.toFixed(1) : null } : null,
        };
      });
      await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      await p.goto(origin + '/', { waitUntil: 'load', timeout: 30000 });
      await sleep(1300);
      out.clean = { shot: await grab('mirror-390x844-clean.png'), metrics: await chromeMetrics() };
      await p.evaluate(() => {
        try {
          localStorage.setItem('moyu.shell', 'dsh');
          localStorage.setItem('moyu.theme', 'dsh');
        } catch {}
      });
      await p.reload({ waitUntil: 'load' });
      await sleep(1500);
      out.dsh390 = { shot: await grab('mirror-390x844.png'), metrics: await chromeMetrics() };
      await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
      await sleep(900);
      out.dsh1280 = { shot: await grab('mirror-1280x720.png'), metrics: await chromeMetrics() };
    } finally {
      try { await chrome.close(); } catch {}
    }
    return out;
  }

  const scenarios = [];

  /* ① 全新訪客：手機第一次打開（沒有 localStorage，沒有 #t） */
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await sleep(700);
  let m = await measure();
  scenarios.push({ name: 'clean', m });
  check(m.mode === 'http', '[clean 390] window.moyuMode = http', m.mode || '(空)');
  check(!!String(m.title || '').trim(), '[clean 390] document.title 有內容', JSON.stringify(m.title));
  check(m.appDisplay !== 'none' && m.appDisplay !== 'missing', '[clean 390] .app 有顯示（不是 display:none）', String(m.appDisplay));
  check(m.docScrollWidth <= m.docClientWidth, '[clean 390] 頁面不橫向溢出', `${m.docScrollWidth} > ${m.docClientWidth}`);
  check(m.appScrollWidth <= m.appClientWidth, '[clean 390] .app 不橫向溢出', `${m.appScrollWidth} > ${m.appClientWidth}`);
  check(m.side && m.side.left >= -1 && Math.abs(m.side.width - 56) <= 1, '[clean 390] 側欄 56px 且在畫面內', m.side ? `left=${m.side.left} w=${m.side.width}` : '(找不到 .side)');
  check(m.statusbar && m.statusbar.sw <= m.statusbar.cw + 1, '[clean 390] 底部狀態列沒有被切掉', m.statusbar ? `${m.statusbar.sw} > ${m.statusbar.cw}` : '(找不到 .statusbar)');
  check(m.statusbarRect && m.statusbarRect.right <= m.innerWidth + 1 && m.statusbarRect.width > 100,
    '[clean 390] 狀態列整條在畫面內', m.statusbarRect ? `right=${m.statusbarRect.right} w=${m.statusbarRect.width}` : '(none)');
  check(m.statusbarRect && m.statusbarRect.bottom <= m.innerHeight + 1,
    '[clean 390] 狀態列底邊 ≤ 視窗高（沒被推出畫面）', m.statusbarRect ? `bottom=${m.statusbarRect.bottom} > ${m.innerHeight}` : '(none)');
  check(m.titlebar === null, '[clean 390] 瀏覽器模式沒有 .titlebar（不會多佔 30px）', m.titlebar ? `h=${m.titlebar.height}` : '');
  check(m.appRect && Math.abs(m.appRect.height - m.innerHeight) <= 2,
    '[clean 390] .app 吃滿視窗高（沒有 titlebar 時 = innerHeight）', m.appRect ? `app=${m.appRect.height} win=${m.innerHeight}` : '(none)');
  check(m.overflowEls.length === 0, '[clean 390] 沒有元素超出視窗右緣', JSON.stringify(m.overflowEls.slice(0, 4)));

  /* ② 用手機讀者的正常狀態：shell=dsh（存過一次設定），重新載入 */
  await page.evaluate(() => {
    try {
      localStorage.setItem('moyu.shell', 'dsh');
      localStorage.setItem('moyu.theme', 'dsh');
    } catch {}
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.app', { timeout: 15000 }).catch(() => {});
  await sleep(1400);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await sleep(700);
  m = await measure();
  scenarios.push({ name: 'dsh-390', m });
  check(m.mode === 'http', '[dsh 390] window.moyuMode = http', m.mode || '(空)');
  check(!!String(m.title || '').trim(), '[dsh 390] document.title 有內容', JSON.stringify(m.title));
  check(m.shell === 'dsh', '[dsh 390] html[data-shell=dsh]', String(m.shell));
  check(m.appDisplay !== 'none' && m.appDisplay !== 'missing', '[dsh 390] .app 有顯示（不是 display:none）', String(m.appDisplay));
  check(/side-rail/.test(m.appClass), '[dsh 390] .app 加上 side-rail（<1024 收合）', m.appClass);
  check(m.side && Math.abs(m.side.width - 56) <= 1, '[dsh 390] 側欄收成 56px 圖示軌', m.side ? String(m.side.width) : '(找不到 .side)');
  check(m.side && m.side.left >= -1, '[dsh 390] 側欄在畫面內（不是被抽屜推到左邊外）', m.side ? `left=${m.side.left}` : '(找不到 .side)');
  check(m.statusbar && m.statusbar.sw <= m.statusbar.cw + 1, '[dsh 390] 底部狀態列沒有被切掉', m.statusbar ? `${m.statusbar.sw} > ${m.statusbar.cw}` : '(找不到 .statusbar)');
  check(m.statusbarRect && m.statusbarRect.bottom <= m.innerHeight + 1,
    '[dsh 390] 狀態列底邊 ≤ 視窗高（沒被推出畫面）', m.statusbarRect ? `bottom=${m.statusbarRect.bottom} > ${m.innerHeight}` : '(none)');
  check(m.titlebar === null, '[dsh 390] 瀏覽器模式沒有 .titlebar', m.titlebar ? `h=${m.titlebar.height}` : '');
  check(m.appRect && Math.abs(m.appRect.height - (m.innerHeight - (m.titlebar ? m.titlebar.height : 0))) <= 2,
    '[dsh 390] .app 高度 = 視窗高 − titlebar', m.appRect ? `app=${m.appRect.height} win=${m.innerHeight} tb=${m.titlebar ? m.titlebar.height : 0}` : '(none)');
  check(m.topbar && m.topbar.sw <= m.topbar.cw + 1, '[dsh 390] 頂欄沒有被切掉', m.topbar ? `${m.topbar.sw} > ${m.topbar.cw}` : '(找不到 .topbar)');
  check(m.docScrollWidth <= m.docClientWidth, '[dsh 390] 頁面不橫向溢出', `${m.docScrollWidth} > ${m.docClientWidth}`);
  check(m.appScrollWidth <= m.appClientWidth, '[dsh 390] .app 不橫向溢出', `${m.appScrollWidth} > ${m.appClientWidth}`);
  check(m.main && m.main.right <= m.innerWidth + 1, '[dsh 390] 主欄沒有超出視窗右緣', m.main ? `${m.main.right} > ${m.innerWidth}` : '(找不到 .main)');
  check(m.overflowEls.length === 0, '[dsh 390] 沒有元素超出視窗右緣', JSON.stringify(m.overflowEls.slice(0, 4)));
  check(m.composeVisible, '[dsh 390] 輸入卡片有渲染');

  /* ③ 桌機寬度：重新載入一次（讓 shell-dsh 在 1280 下重新算欄寬），桌面不能被收合 */
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.app', { timeout: 15000 }).catch(() => {});
  await sleep(1400);
  m = await measure();
  scenarios.push({ name: 'dsh-1280', m });
  check(!/side-rail/.test(m.appClass), '[dsh 1280] 桌面不收合', m.appClass);
  check(m.side && m.side.width >= 264 && m.side.width <= 420, '[dsh 1280] 側欄回到 264–420 區間', m.side ? String(m.side.width) : '(none)');
  check(m.docScrollWidth <= m.docClientWidth, '[dsh 1280] 頁面不橫向溢出', `${m.docScrollWidth} > ${m.docClientWidth}`);
  check(m.statusbar && m.statusbar.sw <= m.statusbar.cw + 1, '[dsh 1280] 狀態列沒有被切掉', m.statusbar ? `${m.statusbar.sw} > ${m.statusbar.cw}` : '(none)');
  check(m.statusbarRect && m.statusbarRect.bottom <= m.innerHeight + 1,
    '[dsh 1280] 狀態列底邊 ≤ 視窗高', m.statusbarRect ? `bottom=${m.statusbarRect.bottom} > ${m.innerHeight}` : '(none)');

  check(pageErrors.length === 0, '沒有 pageerror（/api/* 缺席被 ui 接住）', pageErrors.slice(0, 3).join(' | '));

  /* 截圖（Chrome headless，同一份 ui/；只當人看的證據，數字以上面 Electron 為準） */
  const shots = await chromeShots();
  check(!shots.error, '截圖引擎可用（Chrome/Edge headless）', shots.error || shots.engine);
  if (shots.dsh390) {
    check(shots.dsh390.metrics.appDisplay !== 'none', '[截圖頁] .app 有顯示', String(shots.dsh390.metrics.appDisplay));
    check(shots.dsh390.metrics.sideWidth !== null && Math.abs(shots.dsh390.metrics.sideWidth - 56) <= 1,
      '[截圖頁] 側欄 56px', String(shots.dsh390.metrics.sideWidth));
    check(shots.dsh390.metrics.sideLeft !== null && shots.dsh390.metrics.sideLeft >= -1,
      '[截圖頁] 側欄在畫面內', String(shots.dsh390.metrics.sideLeft));
    check(shots.dsh390.metrics.docScrollWidth <= shots.dsh390.metrics.docClientWidth,
      '[截圖頁] 390 頁面不橫向溢出', `${shots.dsh390.metrics.docScrollWidth} > ${shots.dsh390.metrics.docClientWidth}`);
    check(shots.dsh390.metrics.statusbar && shots.dsh390.metrics.statusbar.sw <= shots.dsh390.metrics.statusbar.cw + 1,
      '[截圖頁] 狀態列沒有被切掉', JSON.stringify(shots.dsh390.metrics.statusbar));
    check(shots.dsh390.metrics.statusbar && shots.dsh390.metrics.statusbar.bottom <= shots.dsh390.metrics.innerHeight + 1,
      '[截圖頁] 狀態列底邊 ≤ 視窗高', JSON.stringify({ bottom: shots.dsh390.metrics.statusbar && shots.dsh390.metrics.statusbar.bottom, winH: shots.dsh390.metrics.innerHeight }));
    check(shots.dsh390.metrics.appHeight !== null && Math.abs(shots.dsh390.metrics.appHeight - shots.dsh390.metrics.innerHeight) <= 2,
      '[截圖頁] .app 吃滿視窗高', `${shots.dsh390.metrics.appHeight} vs ${shots.dsh390.metrics.innerHeight}`);
  }

  /* ── 報告 ── */
  const fails = results.filter((r) => !r.pass).length;
  const shotFiles = [shots.clean && shots.clean.shot, shots.dsh390 && shots.dsh390.shot, shots.dsh1280 && shots.dsh1280.shot].filter(Boolean);
  console.log('\n===== 鏡像站本機驗證（' + origin + '，無頭 Electron 量測 + Chrome headless 截圖） =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);
  if (shotFiles.length) console.log('截圖：' + shotFiles.map((f) => path.relative(ROOT, f)).join('、'));

  fs.writeFileSync(path.join(PROBE, 'mirror-web.json'), JSON.stringify({
    at: new Date().toISOString(),
    origin,
    pass: fails === 0,
    total: results.length,
    fails,
    scenarios,
    shots: {
      engine: shots.engine || null,
      error: shots.error || null,
      clean: shots.clean ? { shot: path.relative(ROOT, shots.clean.shot), metrics: shots.clean.metrics } : null,
      dsh390: shots.dsh390 ? { shot: path.relative(ROOT, shots.dsh390.shot), metrics: shots.dsh390.metrics } : null,
      dsh1280: shots.dsh1280 ? { shot: path.relative(ROOT, shots.dsh1280.shot), metrics: shots.dsh1280.metrics } : null,
    },
    pageErrors,
    results,
  }, null, 2), 'utf8');
  console.log('報告：_probe/mirror-web.json');

  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  try { fs.closeSync(log); } catch {}
  server.close();
  process.exit(fails === 0 ? 0 : 1);
}

/* ── 入口 ── */
(async () => {
  if (VERIFY) return verify();

  const server = await startServer();
  console.log(`魔芋一夏 · 鏡像站靜態伺服器（只讀 ui/）`);
  console.log(`  ${`http://127.0.0.1:${PORT}/`}`);
  console.log(`  驗證：node tools/serve-ui.js --verify`);
  const stop = () => { server.close(() => process.exit(0)); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})();
