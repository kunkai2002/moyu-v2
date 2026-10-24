// 設定持久化驗證：改設定 → 關掉 → 重開（含清掉 localStorage）→ 看有沒有回來
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || path.join('C:', 'Users', 'Admin', 'AppData', 'Local', 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const PROBE = path.join(__dirname, '..', '_probe', 'e2e-data-persist');
const PORT = 9337;

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const log = fs.openSync(path.join(__dirname, '..', '_probe', 'persist.log'), 'a');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`], {
    stdio: ['ignore', log, log],
  });
  let browser = null;
  for (let i = 0; i < 50 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {}
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

async function shutdown({ child, browser }) {
  try { browser.disconnect(); } catch {}
  try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch {}
  await sleep(1800);
}

async function typeCmd(page, text) {
  await page.evaluate((t) => {
    const i = document.querySelector('#input');
    i.value = t;
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, text);
}

(async () => {
  if (!fs.existsSync(EXE)) { console.error('找不到 electron.exe'); process.exit(2); }
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(PROBE, { recursive: true });

  /* ── 第一次：改設定 ── */
  let app = await launch();
  await typeCmd(app.page, '/theme vscode');
  await sleep(600);
  await app.page.evaluate(() => {
    const set = (id, v) => {
      const el = document.querySelector(id);
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('#setFont', 17);
    set('#setLh', 2.2);
    set('#setSpeed', 90);
  });
  await sleep(900);
  const before = await app.page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    fs: getComputedStyle(document.documentElement).getPropertyValue('--fs').trim(),
    lh: getComputedStyle(document.documentElement).getPropertyValue('--lh').trim(),
  }));
  before.theme === 'vscode' ? ok('改設定：主題已切到 vscode') : bad('改設定：主題沒切', before.theme);
  await shutdown(app);

  /* ── 檔案落地 ── */
  const prefsFile = path.join(PROBE, 'prefs.json');
  const settingsFile = path.join(PROBE, 'settings.json');
  const prefs = fs.existsSync(prefsFile) ? JSON.parse(fs.readFileSync(prefsFile, 'utf8')) : null;
  prefs ? ok('落地：data/prefs.json 已寫出') : bad('落地：沒有 prefs.json');
  if (prefs) {
    const keys = Object.keys(prefs);
    keys.includes('moyu.theme') ? ok('落地：prefs.json 記住主題') : bad('落地：prefs.json 沒主題', keys.join(','));
    keys.includes('moyu.font') ? ok('落地：prefs.json 記住字級') : bad('落地：prefs.json 沒字級', keys.join(','));
    keys.includes('moyu.lh') ? ok('落地：prefs.json 記住行距') : bad('落地：prefs.json 沒行距', keys.join(','));
  }
  const cfg = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : null;
  cfg && cfg.theme === 'vscode' ? ok('落地：settings.json 記住主題') : bad('落地：settings.json 沒主題', JSON.stringify(cfg && cfg.theme));

  /* ── 第二次：單純重開 ── */
  app = await launch();
  const again = await app.page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    fs: getComputedStyle(document.documentElement).getPropertyValue('--fs').trim(),
    lh: getComputedStyle(document.documentElement).getPropertyValue('--lh').trim(),
    font: document.querySelector('#setFont')?.value,
    speed: document.querySelector('#setSpeed')?.value,
  }));
  again.theme === 'vscode' ? ok('重開：主題還原') : bad('重開：主題掉了', again.theme);
  again.fs === '17px' ? ok('重開：字級還原 17px') : bad('重開：字級掉了', again.fs);
  again.lh === '2.2' ? ok('重開：行距還原 2.2') : bad('重開：行距掉了', again.lh);
  again.font === '17' && again.speed === '90' ? ok('重開：滑桿位置還原') : bad('重開：滑桿位置掉了', JSON.stringify(again));
  await shutdown(app);

  /* ── 第三次：模擬「更新把本機 localStorage 清掉」── */
  const lsDir = path.join(PROBE, 'Local Storage');
  if (fs.existsSync(lsDir)) { fs.rmSync(lsDir, { recursive: true, force: true }); ok('模擬：已刪除 Local Storage'); }
  app = await launch();
  const restored = await app.page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    fs: getComputedStyle(document.documentElement).getPropertyValue('--fs').trim(),
    lh: getComputedStyle(document.documentElement).getPropertyValue('--lh').trim(),
  }));
  restored.theme === 'vscode' ? ok('清空後：主題從 prefs.json 還原') : bad('清空後：主題沒還原', restored.theme);
  restored.fs === '17px' ? ok('清空後：字級從 prefs.json 還原') : bad('清空後：字級沒還原', restored.fs);
  restored.lh === '2.2' ? ok('清空後：行距從 prefs.json 還原') : bad('清空後：行距沒還原', restored.lh);
  await shutdown(app);

  console.log('\n===== 設定持久化 =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);
  process.exit(fails === 0 ? 0 : 1);
})();
