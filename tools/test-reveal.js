// 驗翻頁閱讀：Enter（空白）→ 字先出來、頁被一點點往上頂、半屏就停；一段打完才下一段
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

  // 停在中段，才有空間往上頂
  await page.evaluate(() => {
    const s = document.querySelector('#stream');
    s.scrollTop = Math.round(s.scrollHeight * 0.35);
    document.querySelector('#input').value = '';
    document.querySelector('#input').focus();
  });
  await sleep(200);
  const snap = () => page.evaluate(() => {
    const s = document.querySelector('#stream');
    const sr = s.getBoundingClientRect();
    const ps = [...document.querySelectorAll('#stream .p')];
    const visibleBlank = ps.filter((p) => { const r = p.getBoundingClientRect(); return !p.textContent && r.bottom > sr.top && r.top < sr.bottom; }).length;
    const partial = ps.filter((p) => p.textContent && p.dataset.full != null).length;
    return {
      top: Math.round(s.scrollTop), sh: s.scrollHeight, view: s.clientHeight,
      visibleBlank, partial,
      typed: ps.filter((p) => p.dataset.typed === '1').length,
      lens: ps.map((p) => p.textContent.length),
    };
  });

  const before = await snap();
  await page.keyboard.press('Enter');
  const samples = [];
  for (let i = 0; i < 45; i++) { await sleep(80); samples.push(await snap()); }
  const after = samples[samples.length - 1];
  const pd = await page.evaluate(() => window.__pd || null);
  if (pd) console.log('pageDownHalf 內部：', JSON.stringify(pd).slice(0, 400));

  // ① 有出字（有段落被清空重打）
  const blanksSeen = samples.some((s) => s.visibleBlank > 0 || s.partial > 0);
  blanksSeen ? ok('按 Enter 後真的逐段出字', `樣本裡看到空白/半成品`) : bad('按 Enter 沒有出字', JSON.stringify(samples.slice(0, 3).map((s) => s.lens.slice(-4))));

  // ② 空白在半屏節奏內補滿
  let lastBlankAt = null;
  samples.forEach((s, i) => { if (s.visibleBlank > 0) lastBlankAt = i * 80; });
  (lastBlankAt != null && lastBlankAt <= 2600) ? ok('字在 2 秒上下出完（沒有殘留空白段）', `最後一次空白於 +${lastBlankAt}ms`)
    : (lastBlankAt == null ? ok('沒有殘留空白段', '全程沒有可見空白') : bad('空白段停留超過 2.6 秒', `+${lastBlankAt}ms`));

  // ③ 頁被往上頂（不是先滑再出字，也不是不動）
  const moved = after.top - before.top;
  const room = Math.max(0, before.sh - before.view - before.top);
  const want = Math.min(Math.round(before.view / 2), room);
  (moved > 20 && Math.abs(moved - want) <= 80) ? ok('字出來把頁往上頂了約半屏', `+${moved}px（目標 ${want}px）`)
    : bad('頁面沒有跟著往上頂', `+${moved}px（目標 ${want}px、可捲 ${room}px）`);

  // ④ 一段打完才下一段（同一時間最多一段半成品）
  let maxPartial = 0;
  for (const s of samples) maxPartial = Math.max(maxPartial, s.partial);
  maxPartial <= 1 ? ok('同一時間最多一段在長（嚴格排隊）', `最多 ${maxPartial} 段`)
    : bad('多段同時在長', `最多 ${maxPartial} 段`);

  errors.length === 0 ? ok('沒有 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  const pass = results.filter((r) => r.pass).length;
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  console.log(`\n${pass}/${results.length} 通過`);
  fs.writeFileSync(path.join(ROOT, '_probe', 'reveal.json'), JSON.stringify({ results, before, after, moved, pd, errors }, null, 2), 'utf8');
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(pass === results.length ? 0 : 1), 500);
})();
