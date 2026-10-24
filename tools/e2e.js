// 用 profile 內建的 puppeteer-core 驅動 Chrome，真實載入頁面
const path = require('path');
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.argv[2] || 'http://127.0.0.1:47821/m/';
const OUT = process.argv[3] || path.join(__dirname, '..', '_probe', 'out', 'm.png');
const W = Number(process.argv[4] || 390);
const H = Number(process.argv[5] || 844);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-crash-reporter',
      '--disable-breakpad',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${path.join(process.env.TEMP || '.', 'moyu-pptr-' + Date.now())}`,
      `--window-size=${W},${H}`,
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('requestfailed', (r) => logs.push('[reqfail] ' + r.url() + ' ' + (r.failure()?.errorText || '')));

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));

  const title = await page.title();
  const text = await page.evaluate(() => document.body.innerText.slice(0, 300));
  await page.screenshot({ path: OUT });

  console.log('title:', title);
  console.log('url:', page.url());
  console.log('--- 畫面文字 ---');
  console.log(text.replace(/\n{2,}/g, '\n'));
  console.log('--- console (' + logs.length + ') ---');
  logs.slice(0, 10).forEach((l) => console.log('  ' + l));
  console.log('screenshot:', OUT);

  await browser.close();
})().catch((e) => { console.error('LAUNCH FAIL:', e.message); process.exit(1); });
