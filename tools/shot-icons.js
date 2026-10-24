// 圖標驗證：3x 頂欄裁切 + 全圖標總表
const path = require('path');
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:47832';
const OUT = path.join(__dirname, '..', '_probe', 'out');
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad',
      '--no-first-run', `--user-data-dir=${path.join(process.env.TEMP || '.', 'ic-' + Date.now())}`],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 3 });
  await page.goto(BASE + '/index.html?open=7373660003258862617', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2500));

  // 頂欄右側 3x 裁切
  await page.screenshot({
    path: path.join(OUT, 'topbar3x.png'),
    clip: { x: 1240, y: 0, width: 200, height: 48 },
  });

  // 全圖標總表（48px 顯示）
  await page.evaluate(() => {
    document.body.innerHTML = '';
    const s = document.createElement('div');
    s.style.cssText = 'padding:18px;display:flex;flex-wrap:wrap;gap:18px 22px;background:#1a1915;';
    document.body.appendChild(s);
    const names = Object.keys(window.MOYU_ICONS.set);
    for (const k of names) {
      const d = document.createElement('div');
      d.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;width:86px;color:#d97757';
      d.innerHTML = window.MOYU_ICONS.svg(k, 48);
      const lab = document.createElement('span');
      lab.style.cssText = 'font:10px/1 monospace;color:#8a8578';
      lab.textContent = k;
      d.appendChild(lab);
      s.appendChild(d);
    }
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.setViewport({ width: 980, height: 420, deviceScaleFactor: 2 });
  await page.screenshot({ path: path.join(OUT, 'iconsheet.png'), fullPage: true });

  console.log('ok:', path.join(OUT, 'topbar3x.png'), path.join(OUT, 'iconsheet.png'));
  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
