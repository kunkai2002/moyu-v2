// 驗「一段打完才開始下一段」：頁內每 20ms 取樣，任一瞬間「半成品段落」最多 1 段
//   node tools/test-sequential.js
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DATA = path.join(ROOT, '_probe', 'seq-data');
const PORT = 9383;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });

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
  const log = fs.openSync(path.join(ROOT, '_probe', 'seq.log'), 'w');
  const child = spawn(ELECTRON, [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) { await sleep(400); try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {} }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://')); if (!page) await sleep(300); }
  const errors = []; page.on('pageerror', (e) => errors.push(String(e.message)));
  await sleep(1600);
  await page.evaluate(() => { try { window.__moyuDebug.setShell('dsh'); window.__moyuDebug.setTheme('dsh'); } catch (e) {} });
  await page.evaluate((b) => window.__moyuDebug.openBook(b), '7143038691944959011');
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => document.querySelectorAll('#stream .p').length > 8)) break; await sleep(400); }
  await sleep(1200);
  await page.evaluate(() => { document.querySelector('#stream').scrollTop = 400; document.querySelector('#input').focus(); });
  await sleep(200);

  // 頁內取樣：記下每個 pi 的長度，用來判斷「同時有幾段正在長」
  await page.evaluate(() => {
    window.__seq = [];
    clearInterval(window.__seqTimer);
    window.__seqTimer = setInterval(() => {
      const m = {};
      document.querySelectorAll('#stream .p').forEach((p) => { m[p.dataset.pi] = p.textContent.length; });
      window.__seq.push(m);
    }, 20);
  });
  // 連按三次 Enter，讓佇列裡有多段要打
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await sleep(2200); }

  const samples = await page.evaluate(() => { clearInterval(window.__seqTimer); return window.__seq || []; });
  // 對每個 pi 求「最終長度」，再逐個時刻算「半成品」段數
  const finals = {};
  for (const m of samples) for (const pi of Object.keys(m)) finals[pi] = Math.max(finals[pi] || 0, m[pi]);
  let maxParallel = 0;
  let worst = null;
  for (const m of samples) {
    const partial = Object.keys(m).filter((pi) => m[pi] > 0 && m[pi] < finals[pi]);
    if (partial.length > maxParallel) { maxParallel = partial.length; worst = partial.map((pi) => `${pi}:${m[pi]}/${finals[pi]}`); }
  }
  maxParallel <= 1
    ? ok('同一時間最多只有一段在長（嚴格排隊）', `最多 ${maxParallel} 段`)
    : bad('有段落同時在長（沒有排隊）', `最多 ${maxParallel} 段同時：${(worst || []).join(', ')}`);

  const typedCount = Object.keys(finals).filter((pi) => {
    const arr = samples.map((m) => m[pi]).filter((x) => x !== undefined);
    return arr.some((x) => x === 0) && finals[pi] > 0;
  }).length;
  typedCount > 0 ? ok('確實有逐段出字（有段落從空白長到完整）', `${typedCount} 段`) : bad('沒有任何段落出字', '');

  errors.length === 0 ? ok('沒有 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  const pass = results.filter((r) => r.pass).length;
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  console.log(`\n${pass}/${results.length} 通過`);
  fs.writeFileSync(path.join(ROOT, '_probe', 'sequential.json'), JSON.stringify({ results, samples: samples.length, maxParallel, errors }, null, 2), 'utf8');
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(pass === results.length ? 0 : 1), 500);
})();
