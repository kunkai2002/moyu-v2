// 查「按鈕被誰蓋住」：無頭載入 ui/，在指定視窗尺寸下對每個按鈕取 elementFromPoint
//   node tools/probe-cover.js 820x620
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DATA = path.join(ROOT, '_probe', 'cover-data');
const PORT = 9375;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [w, h] = (process.argv[2] || '820x620').split('x').map(Number);

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
  const log = fs.openSync(path.join(ROOT, '_probe', 'cover.log'), 'w');
  const child = spawn(ELECTRON, [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) { await sleep(400); try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {} }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://')); if (!page) await sleep(300); }
  await sleep(1500);
  await page.evaluate(() => { try { window.__moyuDebug.setShell('dsh'); window.__moyuDebug.setTheme('dsh'); } catch (e) {} });
  await page.evaluate((b) => window.__moyuDebug.openBook(b), '7143038691944959011');
  await sleep(3000);
  // 跟 audit 一樣：先在大尺寸開好，再縮到目標尺寸（模擬「使用者拉小視窗」）
  await page.evaluate((s) => window.moyu?.win?.setState?.(s), { width: w, height: h });
  await sleep(1200);
  const out = await page.evaluate(() => {
    const res = [];
    const btns = [...document.querySelectorAll('.topbar .tb-btn, .topbar .ghost.icon, .chapter-nav .cn-btn, #tocBtn, .composer .hint-btn')];
    for (const b of btns) {
      const r = b.getBoundingClientRect();
      if (r.width < 4) continue;
      const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      if (hit && hit !== b && !b.contains(hit)) {
        const desc = (hit.id ? '#' + hit.id : '') + (hit.className && typeof hit.className === 'string' ? '.' + hit.className.split(/\s+/).join('.') : '');
        res.push({ btn: (b.id || b.className), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], hit: desc });
      }
    }
    return {
      covered: res,
      right: (() => { const e = document.querySelector('.dsh-right'); if (!e) return null; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], vis: c.visibility, pe: c.pointerEvents, z: c.zIndex, transform: c.transform }; })(),
      app: document.querySelector('.app').className,
    };
  });
  console.log(JSON.stringify(out, null, 1));
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(0), 500);
})();
