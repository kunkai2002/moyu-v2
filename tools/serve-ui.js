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
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: +r.left.toFixed(1), top: +r.top.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1), right: +r.right.toFixed(1) };
    };
    const overflowEls = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right > de.clientWidth + 1 || r.left < -1) {
        overflowEls.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 48), left: Math.round(r.left), right: Math.round(r.right) });
        if (overflowEls.length >= 8) break;
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
      appClass: app ? String(app.className) : '',
      appScrollWidth: app ? app.scrollWidth : 0,
      appClientWidth: app ? app.clientWidth : 0,
      side: rect(side),
      main: rect(main),
      right: right ? Object.assign(rect(right), { display: getComputedStyle(right).display }) : null,
      composeVisible: !!document.querySelector('.composer .box'),
      streamLines: document.querySelectorAll('#stream .p').length,
      overflowEls,
    };
  });

  const shot = async (file) => {
    const p = path.join(PROBE, file);
    await page.screenshot({ path: p });
    return p;
  };

  const scenarios = [];

  /* ① 全新訪客：手機第一次打開（沒有 localStorage，沒有 #t） */
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await sleep(700);
  let m = await measure();
  scenarios.push({ name: 'clean', shot: await shot('mirror-390x844-clean.png'), m });
  check(m.mode === 'http', '[clean 390] window.moyuMode = http', m.mode || '(空)');
  check(!!String(m.title || '').trim(), '[clean 390] document.title 有內容', JSON.stringify(m.title));
  check(m.docScrollWidth <= m.docClientWidth, '[clean 390] 頁面不橫向溢出', `${m.docScrollWidth} > ${m.docClientWidth}`);
  check(m.appScrollWidth <= m.appClientWidth, '[clean 390] .app 不橫向溢出', `${m.appScrollWidth} > ${m.appClientWidth}`);
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
  scenarios.push({ name: 'dsh-390', shot: await shot('mirror-390x844.png'), m });
  check(m.mode === 'http', '[dsh 390] window.moyuMode = http', m.mode || '(空)');
  check(!!String(m.title || '').trim(), '[dsh 390] document.title 有內容', JSON.stringify(m.title));
  check(m.shell === 'dsh', '[dsh 390] html[data-shell=dsh]', String(m.shell));
  check(/rail/.test(m.appClass), '[dsh 390] .app 加上 rail（<1024 收合）', m.appClass);
  check(m.side && Math.abs(m.side.width - 56) <= 1, '[dsh 390] 側欄收成 56px 圖示軌', m.side ? String(m.side.width) : '(找不到 .side)');
  check(m.docScrollWidth <= m.docClientWidth, '[dsh 390] 頁面不橫向溢出', `${m.docScrollWidth} > ${m.docClientWidth}`);
  check(m.appScrollWidth <= m.appClientWidth, '[dsh 390] .app 不橫向溢出', `${m.appScrollWidth} > ${m.appClientWidth}`);
  check(m.main && m.main.right <= m.innerWidth + 1, '[dsh 390] 主欄沒有超出視窗右緣', m.main ? `${m.main.right} > ${m.innerWidth}` : '(找不到 .main)');
  check(m.overflowEls.length === 0, '[dsh 390] 沒有元素超出視窗右緣', JSON.stringify(m.overflowEls.slice(0, 4)));
  check(m.composeVisible, '[dsh 390] 輸入卡片有渲染');

  /* ③ 桌機寬度：不能因為手機的 rail 邏輯把桌面也收掉 */
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await sleep(800);
  m = await measure();
  scenarios.push({ name: 'dsh-1280', shot: await shot('mirror-1280x720.png'), m });
  check(!/rail/.test(m.appClass), '[dsh 1280] 桌面不收合', m.appClass);
  check(m.side && m.side.width >= 264 && m.side.width <= 420, '[dsh 1280] 側欄回到 264–420 區間', m.side ? String(m.side.width) : '(none)');
  check(m.docScrollWidth <= m.docClientWidth, '[dsh 1280] 頁面不橫向溢出', `${m.docScrollWidth} > ${m.docClientWidth}`);

  check(pageErrors.length === 0, '沒有 pageerror（/api/* 缺席被 ui 接住）', pageErrors.slice(0, 3).join(' | '));

  /* ── 報告 ── */
  const fails = results.filter((r) => !r.pass).length;
  console.log('\n===== 鏡像站本機驗證（' + origin + '，無頭 Electron） =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);
  console.log('截圖：' + scenarios.map((s) => path.relative(ROOT, s.shot)).join('、'));

  fs.writeFileSync(path.join(PROBE, 'mirror-web.json'), JSON.stringify({
    at: new Date().toISOString(),
    origin,
    pass: fails === 0,
    total: results.length,
    fails,
    scenarios,
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
