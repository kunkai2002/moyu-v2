// 視窗狀態記憶驗證：改大小 → 關掉 → 重開 → 尺寸要一樣；最大化也要記得
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || path.join('C:', 'Users', 'Admin', 'AppData', 'Local', 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const PROBE = path.join(__dirname, '..', '_probe', 'e2e-data-window');
const PORT = 9343;

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const log = fs.openSync(path.join(__dirname, '..', '_probe', 'window.log'), 'a');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'], { stdio: ['ignore', log, log] });
  let browser = null;
  for (let i = 0; i < 50 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 600000 }); } catch {}
  }
  if (!browser) throw new Error('連不上偵錯埠');
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    const pages = await browser.pages().catch(() => []);
    page = pages.find((p) => p.url().startsWith('file://'));
    if (!page) await sleep(300);
  }
  if (!page) throw new Error('找不到 app 頁面');
  await sleep(1200);
  return { child, browser, page };
}

async function winInfo(page) {
  const st = await page.evaluate(async () => await window.moyu.win.state());
  return { bounds: st || {} };
}

async function setBounds(page, bounds) {
  await page.evaluate(async (b) => { await window.moyu.win.setState(b); }, bounds);
}

async function shutdown(app) {
  try { app.browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${app.child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(1800);
}

(async () => {
  if (!fs.existsSync(EXE)) { console.error('找不到 electron.exe'); process.exit(2); }
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(path.join(PROBE, 'chapters'), { recursive: true });
  for (const f of ['cookie.txt', 'cookies.json', 'settings.json', 'prefs.json', 'sync.json']) {
    const src = path.join(APP, 'data', f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROBE, f));
  }

  /* 第一次：改成 980×620，移到 (140, 90) */
  let app = await launch();
  await setBounds(app.page, { width: 980, height: 620, left: 140, top: 90 });
  await sleep(1200);
  const first = await winInfo(app.page);
  await shutdown(app);

  const stateFile = path.join(PROBE, 'window.json');
  const saved = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
  saved ? ok(`記錄：window.json 已寫出（${saved.width}×${saved.height} @ ${saved.x},${saved.y}）`) : bad('記錄：沒有 window.json');
  saved && Math.abs(saved.width - first.bounds.width) <= 2
    ? ok(`記錄：寬度與實際一致（${saved.width}）`) : bad('記錄：寬度不一致', JSON.stringify({ saved: saved && saved.width, actual: first.bounds.width }));
  saved && saved.width >= 420 && saved.height >= 320 ? ok('記錄：尺寸不小於最小值') : bad('記錄：尺寸被寫壞');

  /* 第二次：重開，尺寸要還原 */
  app = await launch();
  const second = await winInfo(app.page);
  Math.abs(second.bounds.width - first.bounds.width) <= 2 && Math.abs(second.bounds.height - first.bounds.height) <= 2
    ? ok(`還原：${second.bounds.width}×${second.bounds.height}（與上次一致）`)
    : bad('還原：尺寸沒還原', JSON.stringify({ first: first.bounds, second: second.bounds }));
  Math.abs((second.bounds.x ?? 0) - (first.bounds.x ?? 0)) <= 4
    ? ok(`還原：位置 ${second.bounds.x},${second.bounds.y}`) : bad('還原：位置沒還原', JSON.stringify({ first: first.bounds, second: second.bounds }));

  /* 第三次：最大化 → 重開仍最大化 */
  await setBounds(app.page, { maximized: true });
  await sleep(900);
  const max1 = await winInfo(app.page);
  await shutdown(app);

  app = await launch();
  const max2 = await winInfo(app.page);
  (max2.bounds.maximized === true || max1.bounds.maximized === true)
    ? ok(`最大化：重開後仍是 ${max2.bounds.maximized}`) : bad('最大化：沒有記住', JSON.stringify(max2.bounds));
  await shutdown(app);

  console.log('\n===== 視窗狀態記憶 =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);
  process.exit(fails === 0 ? 0 : 1);
})();
