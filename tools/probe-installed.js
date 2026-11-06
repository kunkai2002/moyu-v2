// 直接開「安裝目錄的那份 app」，確認它實際載入的檔與 app class（排除快取／路徑搞錯）
//   node tools/probe-installed.js 820x620
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const PROBE = path.join(ROOT, '_probe', 'installed-data');
const PORT = 9391;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [w, h] = (process.argv[2] || '820x620').split('x').map(Number);

(async () => {
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(PROBE, { recursive: true });
  const log = fs.openSync(path.join(ROOT, '_probe', 'installed.log'), 'w');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--user-data-dir=${path.join(PROBE, 'profile')}`,
    `--remote-debugging-port=${PORT}`, '--hidden'], { stdio: ['ignore', log, log], env: appEnv(), cwd: APP });
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) { await sleep(400); try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {} }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://')); if (!page) await sleep(300); }
  await sleep(1500);
  await page.evaluate((sz) => window.moyu?.win?.setState?.(sz), { width: w, height: h });
  await sleep(800);
  const info = await page.evaluate(() => ({
    url: location.href,
    appClass: document.querySelector('.app').className,
    hasPg: typeof window.__moyuDebug?.pageDown === 'function',
    shell: (document.querySelector('script[src="shell-dsh.js"]') || {}).src,
  }));
  console.log(JSON.stringify(info, null, 1));
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(0), 400);
})();
