// 診斷：翻頁後出字到底跑到哪（每 200ms 印一次「有幾個段落未完成、當前段落字數」）
//   node tools/diag-reveal.js
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DATA = path.join(ROOT, '_probe', 'diag-reveal-data');
const PORT = 9387;
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
  const log = fs.openSync(path.join(ROOT, '_probe', 'diag-reveal.log'), 'w');
  const child = spawn(ELECTRON, [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) { await sleep(400); try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {} }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://')); if (!page) await sleep(300); }
  await sleep(1600);
  await page.evaluate(() => { try { window.__moyuDebug.setShell('dsh'); window.__moyuDebug.setTheme('dsh'); } catch (e) {} });
  await page.evaluate((b) => window.__moyuDebug.openBook(b), '7143038691944959011');
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => document.querySelectorAll('#stream .p').length > 8)) break; await sleep(400); }
  await sleep(1200);
  await page.evaluate(() => { document.querySelector('#stream').scrollTop = 300; document.querySelector('#input').focus(); });
  await sleep(200);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 14; i++) {
    await sleep(200);
    const st = await page.evaluate(() => {
      const ps = [...document.querySelectorAll('#stream .p')];
      const lens = ps.map((p) => p.textContent.length);
      const zero = lens.filter((n) => n === 0).length;
      const short = ps.filter((p) => p.textContent.length > 0 && p.textContent.length < 20).length;
      return { total: ps.length, zero, short, sample: lens.slice(-8).join(','), typed: ps.filter((p) => p.dataset.typed === '1').length };
    });
    console.log(`+${(i + 1) * 200}ms  p=${st.total} 空白=${st.zero} 短段=${st.short} typed=${st.typed} 尾段長度=[${st.sample}]`);
  }
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(0), 500);
})();
