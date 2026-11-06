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
  // 接章是非同步 IPC：先等到「turns 變多」那一刻，再從那一刻開始取樣
  const tAppend = Date.now();
  let appended = false;
  for (let i = 0; i < 100; i++) {
    const t = await page.evaluate(() => document.querySelectorAll('#stream .turn.ai').length);
    if (t > before.turns) { appended = true; break; }
    await sleep(50);
  }
  console.log('append:', appended ? '偵測到新回覆' : '5 秒內沒接章', '(+' + (Date.now() - tAppend) + 'ms)');
  /* 逐字效果只有 ~200ms，MutationObserver 會把同一幀的多次寫入合併成一次，
     所以改成頁內每 20ms 自己取樣一次長度，捲動後再讀整條曲線。 */
  await page.evaluate(() => {
    window.__typeSamples = [];
    clearInterval(window.__typeTimer);
    window.__typeTimer = setInterval(() => {
      const m = {};
      document.querySelectorAll("#stream .p").forEach((p) => { m[p.dataset.pi] = p.textContent.length; });
      window.__typeSamples.push({ t: Date.now(), m });
    }, 20);
  });
  // 新章在畫面下方（看不到）。往下捲進新內容，這時才應該「快速出字」。
  const scrolledAt = Date.now();
  await page.evaluate(() => { const s = document.querySelector('#stream'); s.scrollTop = s.scrollHeight; });
  // 取樣：捲動後 0 / 100 / 300 / 900 / 1600ms。重點是「捲進來那段」在出字，
  // 而不是整章逐字（整章逐字會讓下面一大段先空白，JOJO 2026-11-06 明確排除）。
  const samples = [];
  const t0 = scrolledAt;
  for (const at of [0, 120, 300, 900, 1600, 2600]) {
    while (Date.now() - t0 < at) await sleep(10);
    samples.push(await page.evaluate((ms) => {
      const s = document.querySelector('#stream');
      const sr = s.getBoundingClientRect();
      const inView = (p) => {
        const r = p.getBoundingClientRect();
        return r.bottom > sr.top && r.top < sr.bottom;
      };
      const paras = [...document.querySelectorAll('#stream .p')];
      const vis = paras.filter(inView);
      const lens = {};
      vis.forEach((p) => { lens[p.dataset.pi] = p.textContent.length; });
      return {
        ms,
        turns: document.querySelectorAll('#stream .turn.ai').length,
        chars: paras.reduce((n, p) => n + p.textContent.length, 0),
        visibleChars: vis.reduce((n, p) => n + p.textContent.length, 0),
        emptyAll: paras.filter((p) => p.textContent.length === 0).length,
        emptyVisible: vis.filter((p) => p.textContent.length === 0).length,
        lens,
        pi: paras.map((p) => p.dataset.pi).slice(-6).join(','),
      };
    }, at));
  }
  console.log('before', JSON.stringify(before));
  for (const s of samples) {
    console.log(`  +${String(s.ms).padStart(4)}ms  turns=${s.turns} 全文字數=${s.chars} 畫面文字=${s.visibleChars} 空白(全/畫面)=${s.emptyAll}/${s.emptyVisible}`);
  }

  const last = samples[samples.length - 1];
  const grew = last.chars > before.chars + 100;
  grew ? ok('往下滑會自動接章（字數變多）', `${before.chars} → ${last.chars}`)
       : bad('往下滑沒有接到新章', JSON.stringify(samples.map((s) => s.chars)));

  // ① 逐字證據：同一段在輪詢序列裡出現「被清空（0）→ 變完整」的過渡
  const rows = await page.evaluate(() => { clearInterval(window.__typeTimer); return window.__typeSamples || []; });
  const per = {};
  for (const r of rows) for (const pi of Object.keys(r.m)) (per[pi] = per[pi] || []).push(r.m[pi]);
  let typed = 0; let sample = null;
  for (const pi of Object.keys(per)) {
    const arr = per[pi];
    const finalLen = arr.length ? arr[arr.length - 1] : 0;
    const zeroAt = arr.findIndex((L) => L === 0);
    if (finalLen > 0 && zeroAt >= 0 && arr.slice(zeroAt + 1).some((L) => L === finalLen)) {
      typed++; sample = sample || { pi, arr: arr.slice(0, 8), finalLen };
    }
  }
  typed > 0
    ? ok('捲進來那段是逐字長出來的', `${typed} 段出現「清空→完整」過渡（例：pi ${sample.pi} ${sample.arr.join("→")}）`)
    : bad('捲進來那段沒有逐字效果', JSON.stringify(Object.keys(per).slice(0, 5).map((k) => [k, per[k].slice(0, 8)])));

  // ② 不是整章打字：接章瞬間（0ms）大部分文字已經在 DOM 裡（只有畫面那段是空的）
  const early = samples[0];
  const instantRatio = early.chars / last.chars;
  instantRatio >= 0.85 ? ok('不是整章打字（接章瞬間已有 ≥85% 文字）', `0ms ${early.chars} / 最終 ${last.chars} = ${(instantRatio * 100).toFixed(0)}%`)
    : bad('整章都被清空重打（JOJO 要的是畫面那段）', `${(instantRatio * 100).toFixed(0)}%`);

  // ③ 很快跑完、不留空白
  const done = samples[samples.length - 1];
  (done && done.emptyAll === 0) ? ok('2.6 秒內全部補滿（沒有空白段落）', `空白 ${done.emptyAll}`)
    : bad('2.6 秒還有空白段落', JSON.stringify(done));
  errors.length === 0 ? ok('沒有 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  const pass = results.filter((r) => r.pass).length;
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  console.log(`\n${pass}/${results.length} 通過`);
  fs.writeFileSync(path.join(ROOT, '_probe', 'typing.json'), JSON.stringify({ results, before, samples, errors }, null, 2), 'utf8');
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(pass === results.length ? 0 : 1), 500);
})();
