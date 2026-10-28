// 手機頁現況：把畫面文字、API 回應、錯誤都抓出來
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const TOKEN = fs.readFileSync(path.join(__dirname, '..', 'sync', '.token'), 'utf8').trim();

(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-first-run'],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 140)); });
  p.on('response', async (r) => {
    const u = r.url();
    if (u.includes('/api/')) console.log('API', r.status(), u.replace(/^https:\/\/[^/]+/, '').slice(0, 70));
  });
  await p.goto('https://moyu-sync.qiaoyuhua2002.workers.dev/m/#t=' + encodeURIComponent(TOKEN), { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 3000));
  const info = await p.evaluate(() => ({
    cards: document.querySelectorAll('.card').length,
    dataBooks: [...document.querySelectorAll('.card')].slice(0, 3).map((c) => c.dataset.book),
    text: document.body.innerText.slice(0, 240),
    token: (localStorage.getItem('moyu.token') || '').slice(0, 8),
    hashTok: (location.hash || '').slice(0, 12),
  }));
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
