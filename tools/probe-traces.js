// 快速檢查：畫面上「像工具」的痕跡各有幾個（思考塊／步進列／工具列／假 diff）
//   node tools/probe-traces.js
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DATA = path.join(ROOT, '_probe', 'traces-data');
const PORT = 9379;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.mkdirSync(DATA, { recursive: true });
  const REAL = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');
  for (const f of ['prefs.json', 'settings.json', 'progress.json', 'shelf.json', 'cookie.txt']) {
    const s = path.join(REAL, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(DATA, f));
  }
  const cs = path.join(REAL, 'chapters');
  if (fs.existsSync(cs)) { fs.mkdirSync(path.join(DATA, 'chapters'), { recursive: true }); for (const f of fs.readdirSync(cs)) if (f.endsWith('.json')) fs.copyFileSync(path.join(cs, f), path.join(DATA, 'chapters', f)); }
  fs.writeFileSync(path.join(DATA, 'window.json'), JSON.stringify({ width: 1440, height: 900, x: 40, y: 40 }), 'utf8');
  const log = fs.openSync(path.join(ROOT, '_probe', 'traces.log'), 'w');
  const child = spawn(ELECTRON, [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) { await sleep(400); try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {} }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://')); if (!page) await sleep(300); }
  await sleep(1500);
  await page.evaluate(() => { try { window.__moyuDebug.setShell('dsh'); window.__moyuDebug.setTheme('dsh'); } catch (e) {} });
  await page.evaluate((b) => window.__moyuDebug.openBook(b), '7143038691944959011');
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => document.querySelectorAll('#stream .p').length > 8)) break; await sleep(400); }
  await sleep(1200);
  const info = await page.evaluate(() => {
    const s = document.querySelector('#stream');
    const sr = s.getBoundingClientRect();
    const box = (sel) => {
      const list = [...document.querySelectorAll(sel)];
      const vis = list.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > sr.top && r.top < sr.bottom; });
      return { total: list.length, visible: vis.length, sample: vis[0] ? vis[0].textContent.trim().slice(0, 46) : null };
    };
    return {
      p: document.querySelectorAll('#stream .p').length,
      think: box('#stream .think'),
      step: box('#stream .step'),
      toolrow: box('#stream .toolrow'),
      diff: box('#stream .cc-diff'),
      topbar: document.querySelectorAll('.topbar .tb-btn').length,
      status: (document.querySelector('.statusbar') || {}).textContent.trim().slice(0, 40),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(0), 500);
})();
