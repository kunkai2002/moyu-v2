// 診斷：輸入框高度 0 / 連讀爆走 是不是版面塌了
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || path.join('C:', 'Users', 'Admin', 'AppData', 'Local', 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const PROBE = path.join(__dirname, '..', '_probe', 'e2e-data-diag');
const PORT = 9342;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(path.join(PROBE, 'chapters'), { recursive: true });
  for (const f of ['cookie.txt', 'cookies.json', 'settings.json', 'prefs.json', 'sync.json']) {
    const src = path.join(APP, 'data', f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROBE, f));
  }
  const log = fs.openSync(path.join(__dirname, '..', '_probe', 'diag.log'), 'w');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'], { stdio: ['ignore', log, log] });

  let browser = null;
  for (let i = 0; i < 50 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 600000 }); } catch {}
  }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    const pages = await browser.pages().catch(() => []);
    page = pages.find((p) => p.url().startsWith('file://'));
    if (!page) await sleep(300);
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await sleep(1500);

  await page.evaluate(async () => { await window.__moyuDebug.openBook('7373660003258862617'); });
  await sleep(3000);

  const d = await page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), display: cs.display, vis: cs.visibility, overflow: cs.overflow };
    };
    return {
      win: [window.innerWidth, window.innerHeight],
      app: r('.app'), main: r('.main'), stream: r('#stream'),
      composer: r('.composer') || r('.box-line')?.parentElement && r('.box-line'),
      boxLine: r('.box-line'), input: r('#input'), inputRz: r('.input-rz'),
      flow: window.__moyuFlow ? window.__moyuFlow.state : null,
      index: window.__moyuDebug.state.index,
      chaps: document.querySelectorAll('#stream .chap').length,
      errors: null,
    };
  });
  console.log(JSON.stringify(d, null, 1));
  console.log('pageerrors:', errors.slice(0, 3));

  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(400);
})();
