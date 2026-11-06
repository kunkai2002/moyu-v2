// 驗「Enter 往下翻半屏 ＋ 新出現那半屏逐字出字」與「Alt+Enter 送出」、輸入卡高度
//   node tools/test-pagedown.js
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const appEnv = require('./app-env');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DATA = path.join(ROOT, '_probe', 'pagedown-data');
const PORT = 9381;
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
  const log = fs.openSync(path.join(ROOT, '_probe', 'pagedown.log'), 'w');
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

  // ① 輸入卡高度
  const box = await page.evaluate(() => {
    const b = document.querySelector('.composer .box');
    return { h: Math.round(b.getBoundingClientRect().height), foot: !!document.querySelector('.box-foot'), enterBtn: !!document.querySelector('#enterBtn') };
  });
  (box.h <= 64 && !box.foot && box.enterBtn) ? ok('輸入卡收斂成單列（≤64px、沒有舊提示列、有 ⏎）', `高 ${box.h}px`)
    : bad('輸入卡還是太高或舊提示列還在', JSON.stringify(box));

  // ② Enter 往下翻半屏
  await page.evaluate(() => { const s = document.querySelector('#stream'); s.scrollTop = 600; document.querySelector('#input').focus(); });
  await sleep(200);
  const before = await page.evaluate(() => {
    const s = document.querySelector('#stream');
    return { top: Math.round(s.scrollTop), view: s.clientHeight, ih: s.scrollHeight };
  });
  // 在頁內記錄「這段期間各段落長度」的曲線（逐字證據）
  await page.evaluate(() => {
    window.__pd = [];
    clearInterval(window.__pdTimer);
    window.__pdTimer = setInterval(() => {
      const m = {};
      document.querySelectorAll('#stream .p').forEach((p) => { m[p.dataset.pi] = p.textContent.length; });
      window.__pd.push(m);
    }, 20);
  });
  await page.keyboard.press('Enter');
  await sleep(2600);
  const after = await page.evaluate(() => ({ top: Math.round(document.querySelector('#stream').scrollTop) }));
  const delta = after.top - before.top;
  const want = Math.round(before.view / 2);
  (delta > 0 && Math.abs(delta - want) <= 60)
    ? ok('按一次 Enter 往下翻約半屏', `+${delta}px（目標 ${want}px）`)
    : bad('Enter 沒有翻半屏', `+${delta}px（目標 ${want}px）`);

  const curve = await page.evaluate(() => { clearInterval(window.__pdTimer); return window.__pd || []; });
  const per = {};
  curve.forEach((m) => Object.keys(m).forEach((pi) => { (per[pi] = per[pi] || []).push(m[pi]); }));
  let typed = 0; let sample = null;
  for (const pi of Object.keys(per)) {
    const arr = per[pi];
    const fin = arr[arr.length - 1];
    const zero = arr.findIndex((L) => L === 0);
    if (fin > 0 && zero >= 0 && arr.slice(zero + 1).some((L) => L === fin)) { typed++; sample = sample || { pi, arr: arr.slice(0, 8) }; }
  }
  typed > 0 ? ok('翻頁後那半屏是逐字出現', `${typed} 段出現「清空→長回來」（例：pi ${sample.pi} ${sample.arr.join('→')}）`)
            : bad('翻頁後沒有逐字效果', JSON.stringify(Object.keys(per).slice(0, 4).map((k) => [k, per[k].slice(0, 8)])));

  // ③ 連續按到最底 → 再按一次會接下一章
  const turns0 = await page.evaluate(() => document.querySelectorAll('#stream .turn.ai').length);
  for (let i = 0; i < 40; i++) {
    const atBottom = await page.evaluate(() => {
      const s = document.querySelector('#stream');
      return s.scrollTop >= s.scrollHeight - s.clientHeight - 4;
    });
    if (atBottom) break;
    await page.keyboard.press('Enter');
    await sleep(2300);
  }
  await page.keyboard.press('Enter');
  await sleep(2600);
  const turns1 = await page.evaluate(() => document.querySelectorAll('#stream .turn.ai').length);
  turns1 > turns0 ? ok('到底再按 Enter 會接下一章', `${turns0} → ${turns1}`)
                  : bad('到底再按 Enter 沒接章', `${turns0} → ${turns1}`);

  // ④ Alt+Enter 才是送出指令
  const idx0 = await page.evaluate(() => window.__moyuDebug.state.index);
  await page.evaluate(() => { const i = document.querySelector('#input'); i.value = '12'; i.focus(); });
  await page.keyboard.down('Alt'); await page.keyboard.press('Enter'); await page.keyboard.up('Alt');
  await sleep(2500);
  const idx1 = await page.evaluate(() => window.__moyuDebug.state.index);
  (idx1 === 11 && idx1 !== idx0) ? ok('Alt+Enter 送出指令（跳到第 12 章）', `index ${idx0} → ${idx1}`)
    : bad('Alt+Enter 沒有送出指令', `index ${idx0} → ${idx1}`);

  errors.length === 0 ? ok('沒有 pageerror') : bad('有 pageerror', errors.slice(0, 2).join(' | '));

  const pass = results.filter((r) => r.pass).length;
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  console.log(`\n${pass}/${results.length} 通過`);
  fs.writeFileSync(path.join(ROOT, '_probe', 'pagedown.json'), JSON.stringify({ results, box, before, after, typed, errors }, null, 2), 'utf8');
  browser.disconnect(); try { child.kill(); } catch {}
  setTimeout(() => process.exit(pass === results.length ? 0 : 1), 500);
})();
