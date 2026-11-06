// 驗「按一次 Enter：一行一行往上滑半屏、整批字在 2 秒內出完、一次只有一段在長」
// 用 Node 端每 100ms 輪詢（不在頁內塞沙盒計時器，避免觀測本身干擾畫面）
//   node tools/test-reveal.js
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DATA = path.join(ROOT, '_probe', 'reveal-data');
const PORT = 9385;
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
  const log = fs.openSync(path.join(ROOT, '_probe', 'reveal.log'), 'w');
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

  // 先量一次最大長度（當最終值）
  await page.evaluate(() => { document.querySelector('#stream').scrollTop = 300; });
  await sleep(150);
  await page.click('#input');
  await sleep(150);
  const maxLen = await page.evaluate(() => {
    const m = {};
    document.querySelectorAll('#stream .p').forEach((p) => { m[p.dataset.pi] = p.textContent.length; });
    return m;
  });

  const samples = [];
  const t0 = Date.now();
  await page.keyboard.press('Enter');
  const firstScrolled = await page.evaluate(() => Math.round(document.querySelector('#stream').scrollTop));
  while (Date.now() - t0 < 3400) {
    await sleep(100);
    samples.push(await page.evaluate((ms) => {
      const ps = [...document.querySelectorAll('#stream .p')];
      const m = {};
      ps.forEach((p) => { m[p.dataset.pi] = p.textContent.length; });
      const st = document.querySelector('#stream');
      const sr = st.getBoundingClientRect();
      const visibleBlank = ps.filter((p) => { const r = p.getBoundingClientRect(); return p.textContent.length === 0 && r.bottom > sr.top && r.top < sr.bottom; }).length;
      return { t: ms, scrollTop: Math.round(st.scrollTop), m, visibleBlank };
    }, Date.now() - t0));
  }

  // ① 有「被清空」→ 逐段出現（用先前的最大長度當期望）
  let startAt = null; let doneAt = null;
  for (const s of samples) {
    const blanks = s.visibleBlank;
    if (startAt == null && blanks > 0) startAt = s.t;
    if (startAt != null) {
      const left = s.visibleBlank;
      if (left === 0) { doneAt = s.t - startAt; break; }
    }
  }
  (startAt != null) ? ok('按 Enter 後真的有段落被清空重打（逐段出現）', `第一次清空於 +${startAt}ms`)
    : bad('按 Enter 後沒有任何段落重打', JSON.stringify(samples.slice(0, 3).map((s) => Object.keys(s.m).length)));
  (doneAt != null && doneAt <= 2600) ? ok('整批字在 2 秒上下出完', `+${doneAt}ms（預算 2000ms）`)
    : bad('整批出字超過 2 秒太多', doneAt == null ? '3.4 秒內還有空白段' : `+${doneAt}ms`);
  (doneAt != null && doneAt >= 700) ? ok('也不是瞬間全出（看得出來）', `+${doneAt}ms`)
    : bad('太快，看不出來', `+${doneAt}ms`);

  // ② 同一時間最多一段在長
  let maxParallel = 0; let worst = null;
  for (const s of samples) {
    const partial = Object.keys(s.m).filter((pi) => s.m[pi] > 0 && maxLen[pi] > 0 && s.m[pi] < maxLen[pi]);
    if (partial.length > maxParallel) { maxParallel = partial.length; worst = partial.map((pi) => `${pi}:${s.m[pi]}/${maxLen[pi]}`); }
  }
  maxParallel <= 1 ? ok('同一時間最多一段在長（嚴格排隊）', `最多 ${maxParallel} 段`)
    : bad('有段落同時在長', `${maxParallel} 段：${(worst || []).join(', ')}`);

  // ③ 有往上滑（不是原地）
  const moved = samples[samples.length - 1].scrollTop - firstScrolled;
  (moved >= 150) ? ok('畫面有往上滑（半屏級）', `+${moved}px`)
    : bad('沒有往上滑', `+${moved}px`);

  errors.length === 0 ? ok('沒有 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  const pass = results.filter((r) => r.pass).length;
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  console.log(`\n${pass}/${results.length} 通過`);
  fs.writeFileSync(path.join(ROOT, '_probe', 'reveal.json'), JSON.stringify({ results, startAt, doneAt, maxParallel, moved, errors }, null, 2), 'utf8');
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(pass === results.length ? 0 : 1), 500);
})();
