// 真的把 Electron 版跑起來測：掃碼登入、設定面板、圖標尺寸、指令
// 用獨立的 probe 資料夾，不碰使用者的真實進度
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || path.join('C:', 'Users', 'Admin', 'AppData', 'Local', 'Programs', '魔芋一夏');
const EXE = path.join(APP, 'electron', 'electron.exe');
const PROBE = path.join(__dirname, '..', '_probe', 'e2e-data-electron');
const PORT = 9334;

const results = [];
const ok = (name, extra = '') => results.push({ pass: true, name, extra });
const bad = (name, extra = '') => results.push({ pass: false, name, extra });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeCmd(page, text) {
  await page.evaluate((t) => {
    const i = document.querySelector('#input');
    i.value = t;
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, text);
}

(async () => {
  if (!fs.existsSync(EXE)) { console.error('找不到 electron.exe: ' + EXE); process.exit(2); }
  fs.rmSync(PROBE, { recursive: true, force: true });
  fs.mkdirSync(PROBE, { recursive: true });

  const logPath = path.join(__dirname, '..', '_probe', 'e2e-electron.log');
  const logFd = fs.openSync(logPath, 'w');
  const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'], {
    stdio: ['ignore', logFd, logFd], detached: false,
  });

  let browser = null;
  for (let i = 0; i < 40 && !browser; i++) {
    await sleep(400);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch {}
  }
  if (!browser) { console.error('❌ 連不上 Electron 偵錯埠'); child.kill(); process.exit(2); }

  let page = null;
  const seen = [];
  for (let i = 0; i < 40 && !page; i++) {
    const pages = await browser.pages().catch(() => []);
    seen.length = 0;
    for (const pp of pages) seen.push(pp.url().slice(0, 60));
    page = pages.find((p) => p.url().startsWith('file://'));
    if (!page) await sleep(400);
  }
  if (!page) {
    console.error('❌ 找不到 app 頁面；看到的頁面：', JSON.stringify(seen));
    console.error(fs.readFileSync(logPath, 'utf8').split('\n').slice(-8).join('\n'));
    browser.disconnect(); child.kill(); process.exit(2);
  }

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await sleep(1200);

  /* 1. 開機 */
  const boot = await page.evaluate(() => ({
    debug: !!window.__moyuDebug,
    ipc: !!(window.moyu && window.moyu.qr),
    title: document.title,
  }));
  boot.debug ? ok('開機：__moyuDebug 就緒') : bad('開機：__moyuDebug 缺失');
  boot.ipc ? ok('IPC：window.moyu.qr 已注入') : bad('IPC：window.moyu.qr 缺失');

  /* 2. 圖標尺寸 */
  const icons = await page.evaluate(() => {
    const big = [];
    document.querySelectorAll('svg').forEach((s) => {
      const r = s.getBoundingClientRect();
      if (r.width > 20 || r.height > 20) {
        big.push(`${Math.round(Math.max(r.width, r.height))}px @ ${(s.parentElement?.className || '?')}`);
      }
    });
    return big;
  });
  icons.length === 0 ? ok('圖標：全部 ≤20px') : bad('圖標過大', icons.join(' | '));

  /* 3. 頂欄齒輪 → 設定面板 */
  const gear = await page.$('#tbSettings');
  gear ? ok('頂欄：有設定齒輪按鈕') : bad('頂欄：沒有設定齒輪');
  if (gear) {
    await gear.click();
    await sleep(320);
  }
  const panel = await page.evaluate(() => {
    const p = document.querySelector('#panel');
    const sel = document.querySelector('#setTheme');
    return {
      open: !!p && !p.hidden,
      themes: sel ? sel.options.length : 0,
      hasFont: !!document.querySelector('#setFont'),
      hasLh: !!document.querySelector('#setLh'),
      hasSpeed: !!document.querySelector('#setSpeed'),
      loginBtn: !!document.querySelector('#setLogin'),
    };
  });
  panel.open ? ok('設定：齒輪能開面板') : bad('設定：齒輪打不開面板');
  panel.themes >= 6 ? ok(`設定：主題下拉 ${panel.themes} 項`) : bad('設定：主題下拉異常', String(panel.themes));
  panel.hasFont && panel.hasLh && panel.hasSpeed ? ok('設定：字級/行距/速度滑桿都在') : bad('設定：滑桿缺失');
  panel.loginBtn ? ok('設定：面板內有掃碼登入入口') : bad('設定：面板沒有登入入口');

  /* 4. 面板滑桿真的動 */
  await page.evaluate(() => document.querySelector('#panelClose')?.click());
  await sleep(200);
  await page.evaluate(() => {
    const el = document.querySelector('#setFont');
    el.value = '16';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const fs16 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fs').trim());
  fs16 === '16px' ? ok('設定：字級滑桿即刻生效 (16px)') : bad('設定：字級沒生效', fs16);

  /* 5. /settings 指令 */
  await typeCmd(page, '/settings');
  await sleep(320);
  const byCmd = await page.evaluate(() => !document.querySelector('#panel').hidden);
  byCmd ? ok('指令：/settings 開面板') : bad('指令：/settings 無反應');

  /* 6. /login → 掃碼 QR */
  await page.evaluate(() => document.querySelector('#panelClose')?.click());
  await typeCmd(page, '/login');
  let qr = { img: '', status: '', err: '' };
  for (let i = 0; i < 14; i++) {
    await sleep(500);
    qr = await page.evaluate(() => {
      const box = document.querySelector('#qrBox');
      const img = box?.querySelector('img');
      return {
        img: img ? img.src.slice(0, 30) : '',
        status: document.querySelector('#qrStatus')?.textContent || '',
        err: box ? box.textContent.trim().slice(0, 40) : 'no-box',
      };
    });
    if (qr.img.startsWith('data:image')) break;
  }
  qr.img.startsWith('data:image') ? ok('登入：/login 出 QR 圖（掃碼流程）') : bad('登入：/login 沒出 QR', JSON.stringify(qr));
  qr.status ? ok(`登入：狀態文字「${qr.status}」`) : bad('登入：沒有狀態文字');

  /* 7. 未登入時 /shelf 的錯誤處理 */
  await typeCmd(page, '/shelf');
  await sleep(2500);
  const shelf = await page.evaluate(() => document.body.innerText.includes('登入') || document.body.innerText.includes('書架'));
  shelf ? ok('書架：未登入有正確提示') : bad('書架：沒有提示');

  /* 8. /help 有設定那一行 */
  await typeCmd(page, '/help');
  await sleep(400);
  const help = await page.evaluate(() => document.querySelector('#helpList')?.innerText || '');
  help.includes('/settings') ? ok('/help：列出 /settings') : bad('/help：沒列 /settings');

  /* 9. 全程沒有 JS 例外 */
  errors.length === 0 ? ok('全程無 pageerror') : bad('有 pageerror', errors.slice(0, 3).join(' | '));

  await page.screenshot({ path: path.join(__dirname, '..', '_probe', 'electron-e2e.png') });

  console.log('\n===== Electron E2E =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.extra ? '  → ' + r.extra : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);

  browser.disconnect();
  child.kill();
  await sleep(600);
  process.exit(fails === 0 ? 0 : 1);
})();
