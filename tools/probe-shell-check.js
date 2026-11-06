// 版面自檢：欄位、側欄文字、目錄是否可見、翻頁列是否移除
//   node tools/probe-shell-check.js [寬x高]
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DATA = path.join(ROOT, '_probe', 'shellcheck-data');
const PORT = 9389;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [w, h] = (process.argv[2] || '1440x900').split('x').map(Number);

(async () => {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.mkdirSync(DATA, { recursive: true });
  const REAL = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');
  for (const f of ['prefs.json', 'settings.json', 'progress.json', 'shelf.json', 'cookie.txt']) {
    const s = path.join(REAL, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(DATA, f));
  }
  const cs = path.join(REAL, 'chapters');
  if (fs.existsSync(cs)) { fs.mkdirSync(path.join(DATA, 'chapters'), { recursive: true }); for (const f of fs.readdirSync(cs)) if (f.endsWith('.json')) fs.copyFileSync(path.join(cs, f), path.join(DATA, 'chapters', f)); }
  fs.writeFileSync(path.join(DATA, 'window.json'), JSON.stringify({ width: w, height: h, x: 40, y: 40 }), 'utf8');
  const log = fs.openSync(path.join(ROOT, '_probe', 'shellcheck.log'), 'w');
  const child = spawn(ELECTRON, [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) { await sleep(400); try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {} }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://')); if (!page) await sleep(300); }
  await sleep(1500);
  await page.evaluate(() => { try { window.__moyuDebug.setShell('dsh'); window.__moyuDebug.setTheme('dsh'); } catch (e) {} });
  await page.evaluate((b) => window.__moyuDebug.openBook(b), '7143038691944959011');
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => document.querySelectorAll('#stream .p').length > 5)) break; await sleep(400); }
  await sleep(1000);
  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (s) => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { w: Math.round(r.width), x: Math.round(r.left), vis: c.visibility, disp: c.display }; };
    const app = q('.app');
    const labels = [...document.querySelectorAll('.side-actions .sa span, .brand-name, .side-region-head span')].map((e) => e.textContent.trim()).filter(Boolean);
    return {
      iw: innerWidth,
      appClass: app.className,
      side: box('.side'),
      labels,
      toc: box('.dsh-right'),
      tocRows: document.querySelectorAll('.dsh-right .ch').length,
      chapterNav: !!q('.chapter-nav'),
      status: (q('.statusbar') || {}).textContent ? q('.statusbar').textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : null,
      composerH: box('.composer .box') ? box('.composer .box').w : null,
      enterBtn: !!q('#enterBtn'),
      inputPlaceholder: (q('#input') || {}).placeholder,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(0), 500);
})();
