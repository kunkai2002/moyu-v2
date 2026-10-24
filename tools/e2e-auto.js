// 自動閱讀 E2E：開書 → 開 auto → 等 → 看章節有沒有自己前進
const path = require('path');
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:47911';
const BOOK = process.argv[3] || '7373660003258862617';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad',
      '--no-first-run', `--user-data-dir=${path.join(process.env.TEMP || '.', 'moyu-a-' + Date.now())}`],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on('pageerror', (e) => errs.push((e.stack || e.message || '').split('\n').slice(0, 3).join(' | ')));

  await page.goto(BASE + '/index.html?open=' + BOOK, { waitUntil: 'networkidle2' });
  // 等章節載入
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const n = await page.evaluate(() => document.querySelectorAll('#stream .p').length);
    if (n > 3) break;
  }

  const before = await page.evaluate(() => ({
    titles: [...document.querySelectorAll('.chap')].map((e) => e.textContent.trim()),
    pos: document.querySelector('#sbChapter')?.textContent || '',
    auto: document.querySelector('#modeTag')?.textContent || '',
  }));
  console.log('開書後章節數:', before.titles.length, '| 位置:', before.pos, '| 按鈕:', before.auto);

  // 開啟 auto-read
  await page.click('#modeTag');
  await new Promise((r) => setTimeout(r, 400));
  const afterToggle = await page.evaluate(() => ({
    btn: document.querySelector('#modeTag')?.textContent || '',
    state: window.__moyuDebug?.state?.autoRead,
  }));
  console.log('點擊後 按鈕:', afterToggle.btn, '| state.autoRead:', afterToggle.state);

  // 等自動翻章（instant 渲染 + 1.4s 延遲）
  await new Promise((r) => setTimeout(r, 9000));

  const after = await page.evaluate(() => ({
    titles: [...document.querySelectorAll('.chap')].map((e) => e.textContent.trim()),
    pos: document.querySelector('#sbChapter')?.textContent || '',
  }));
  console.log('等待後章節數:', after.titles.length, '| 位置:', after.pos);
  console.log('章節列表:', after.titles.join(' / '));
  console.log('是否自動前進:', after.titles.length > before.titles.length ? '✅ 是' : '❌ 否');
  console.log('pageerror:', errs.length ? errs.join(' | ') : '（無）');

  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
