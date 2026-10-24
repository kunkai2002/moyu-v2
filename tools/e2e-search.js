// 手機版搜尋 E2E：真的打字、按 Enter、截圖
const path = require('path');
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');


/* 重要：E2E 用隔離資料目錄 _probe/e2e-data，不寫進 %LOCALAPPDATA% 的真實 profile */
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:47821';
const OUT = process.argv[3] || path.join(__dirname, '..', '_probe', 'out', 'm-search.png');
const Q = process.argv[4] || '十日终焉';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad',
      '--no-first-run', `--user-data-dir=${path.join(process.env.TEMP || '.', 'moyu-s-' + Date.now())}`],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE + '/m/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 600));

  // 切到搜尋頁籤
  await page.click('.tab[data-tab="search"]');
  await new Promise((r) => setTimeout(r, 300));
  await page.click('#q');
  await page.type('#q', Q, { delay: 40 });
  await page.keyboard.press('Enter');
  // 等結果出現（最多 20 秒），而不是固定睡
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const done = await page.evaluate(() => {
      const st = document.querySelector('#searchState')?.textContent || '';
      return document.querySelectorAll('#searchList .li').length > 0 || /找不到|失敗/.test(st);
    });
    if (done) break;
  }

  const info = await page.evaluate(() => ({
    state: document.querySelector('#searchState')?.textContent || '',
    items: [...document.querySelectorAll('#searchList .li')].map((e) => e.innerText.split('\n')[0]).slice(0, 5),
    count: document.querySelectorAll('#searchList .li').length,
  }));

  await page.screenshot({ path: OUT });
  console.log('關鍵字:', Q);
  console.log('狀態列:', info.state);
  console.log('結果數:', info.count);
  info.items.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
  console.log('pageerror:', errors.length ? errors.join(' | ') : '（無）');
  console.log('screenshot:', OUT);

  // 點第一個結果，確認能進閱讀器
  if (info.count) {
    await page.click('#searchList .li');
    await new Promise((r) => setTimeout(r, 3000));
    const r = await page.evaluate(() => ({
      reader: !document.querySelector('#reader')?.hidden,
      title: document.querySelector('#rTitle')?.textContent || '',
      paras: document.querySelectorAll('#rBody p').length,
      pos: document.querySelector('#rPos')?.textContent || '',
    }));
    console.log('--- 點第一本後 ---');
    console.log('  進入閱讀器:', r.reader, '| 章節:', r.title, '| 段落:', r.paras, '| 位置:', r.pos);
  }

  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
