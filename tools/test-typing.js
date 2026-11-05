// 驗「往下滑自動接章 → 正文快速打字」：無頭 Electron 裡真的發一次滾輪，
// 量新段落文字在 0/120/300/800ms 的長度，證明是「一個字一個字長出來，但很快跑完」。
//   node tools/test-typing.js
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DATA = path.join(ROOT, '_probe', 'typing-data');
const PORT = 9377;
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
  const log = fs.openSync(path.join(ROOT, '_probe', 'typing.log'), 'w');
  const child = spawn(ELECTRON, [ROOT, `--data-dir=${DATA}`, `--remote-debugging-port=${PORT}`, '--hidden',
    // 隱藏視窗會被 Chromium 背景節流（計時器壓到 1 秒），打字效果量不到中間幀；
    // 這三個旗標只影響測試程序的節流，不改產品行為
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    { stdio: ['ignore', log, log], env: appEnv(), cwd: ROOT });
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) { await sleep(400); try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {} }
  if (!browser) { console.error('❌ 連不上 ' + PORT); process.exit(2); }
  let page = null;
  for (let i = 0; i < 40 && !page; i++) { page = (await browser.pages().catch(() => [])).find((p) => p.url().startsWith('file://')); if (!page) await sleep(300); }
  const errors = []; page.on('pageerror', (e) => errors.push(String(e.message)));
  await sleep(1600);
  await page.evaluate(() => { try { window.__moyuDebug.setShell('dsh'); window.__moyuDebug.setTheme('dsh'); } catch (e) {} });
  // 開一本書（第一章），確保有內容可接
  await page.evaluate((b) => window.__moyuDebug.openBook(b), '7143038691944959011');
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => document.querySelectorAll('#stream .p').length > 3)) break; await sleep(400); }
  // 跳到一章「正文夠長」的，然後把捲軸拉到最底觸發自動接章
  await page.evaluate(() => { const D = window.__moyuDebug; if (D.state.chapters.length > 5) D.goChapter(2); });
  await sleep(1500);
  const before = await page.evaluate(() => ({
    turns: document.querySelectorAll('#stream .turn.ai').length,
    chars: [...document.querySelectorAll('#stream .p')].reduce((n, p) => n + p.textContent.length, 0),
  }));
  // 用哨兵（.flow-more）手動接章：走 advance(true)，跳過手勢門檻，測的是「接章後的打字效果」
  await page.evaluate(() => { const s = document.querySelector('#stream'); s.scrollTop = s.scrollHeight; });
  await sleep(300);
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('.flow-more');
    if (!el) return 'no-sentinel';
    el.click();
    return 'clicked';
  });
  console.log('sentinel:', clicked);
  // 取樣：0 / 120 / 300 / 800ms 的文字長度
  const samples = [];
  const t0 = Date.now();
  for (const at of [0, 120, 300, 800, 1500]) {
    while (Date.now() - t0 < at) await sleep(10);
    samples.push(await page.evaluate((ms) => ({
      ms,
      turns: document.querySelectorAll('#stream .turn.ai').length,
      chars: [...document.querySelectorAll('#stream .p')].reduce((n, p) => n + p.textContent.length, 0),
      emptyParas: [...document.querySelectorAll('#stream .p')].filter((p) => p.textContent.length === 0).length,
      pi: [...document.querySelectorAll('#stream .p')].map((p) => p.dataset.pi).slice(-6).join(','),
    }), at));
  }
  console.log('before', JSON.stringify(before));
  for (const s of samples) console.log(`  +${String(s.ms).padStart(4)}ms  turns=${s.turns} chars=${s.chars} 空段=${s.emptyParas} pi=${s.pi}`);

  const grew = samples[samples.length - 1].chars > before.chars + 100;
  grew ? ok('往下滑會自動接章（字數變多）', `${before.chars} → ${samples[samples.length - 1].chars}`)
       : bad('往下滑沒有接到新章', JSON.stringify(samples.map((s) => s.chars)));
  const mid = samples.find((s) => s.ms === 120) || samples[1];
  const early = samples[0];
  const typing = mid.chars > before.chars && mid.chars < samples[samples.length - 1].chars;
  typing ? ok('是逐字長出來（中途字數介於起點與完成之間）', `${before.chars} → ${mid.chars} → ${samples[samples.length - 1].chars}`)
         : bad('沒有觀察到逐字效果（可能一次畫完）', JSON.stringify(samples.map((s) => s.chars)));
  const fastDone = samples.find((s) => s.ms === 800);
  (fastDone && (fastDone.emptyParas === 0)) ? ok('0.8 秒內跑完（沒有留下空段落）', `空段 ${fastDone.emptyParas}`)
    : bad('0.8 秒還沒跑完', JSON.stringify(fastDone));
  errors.length === 0 ? ok('沒有 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  const pass = results.filter((r) => r.pass).length;
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  console.log(`\n${pass}/${results.length} 通過`);
  fs.writeFileSync(path.join(ROOT, '_probe', 'typing.json'), JSON.stringify({ results, before, samples, errors }, null, 2), 'utf8');
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(pass === results.length ? 0 : 1), 500);
})();
