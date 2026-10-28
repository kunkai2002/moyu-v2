// 列出所有入口：頂欄按鈕、溢出選單、面板，並找出重複
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || path.join('C:', 'Users', 'Admin', 'AppData', 'Local', 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const PROBE = path.join(__dirname, '..', '_probe', 'e2e-data-ia');
const PORT = 9341;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(path.join(PROBE, 'chapters'), { recursive: true });
  for (const f of ['cookie.txt', 'cookies.json', 'settings.json', 'prefs.json', 'sync.json']) {
    const src = path.join(APP, 'data', f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROBE, f));
  }
  const log = fs.openSync(path.join(__dirname, '..', '_probe', 'ia.log'), 'w');
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
  await sleep(1500);

  const info = await page.evaluate(async () => {
    const top = [...document.querySelectorAll('.topbar .tb-btn')].map((b) => ({
      id: b.id, title: b.title || '', html: b.innerHTML.length,
    }));
    document.querySelector('#tbMore')?.click();
    await new Promise((r) => setTimeout(r, 300));
    const ov = document.querySelector('.overflow');
    const rows = ov ? [...ov.querySelectorAll('.ov-row')].map((r) => r.textContent.trim()) : [];
    if (ov) ov.hidden = true;
    // 舊膠囊還在不在
    const legacy = ['pillChapters', 'pillReviews', 'bossBtn', 'helpBtn', 'modeTag', 'themeBtn', 'meRow']
      .map((id) => ({ id, exists: !!document.getElementById(id), hidden: document.getElementById(id)?.hidden }));
    return { top, rows, legacy };
  });

  console.log('頂欄按鈕:');
  for (const b of info.top) console.log('  ' + b.id + '  title=' + b.title);
  console.log('溢出選單:');
  for (const r of info.rows) console.log('  ' + r);
  console.log('舊元素:');
  for (const l of info.legacy) console.log('  ' + l.id + ' exists=' + l.exists);

  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(500);
})();
