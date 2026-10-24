// 量所有 svg 的實際渲染尺寸，找出 >20px 的「大圖標」
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');
const fs = require('fs');
const os = require('os');
const path = require('path');

(async () => {
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'moyu-measure-'));
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    userDataDir: udd,
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://127.0.0.1:47821/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 900));
  const rows = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('svg').forEach((s) => {
      const r = s.getBoundingClientRect();
      if (r.width > 20 || r.height > 20) {
        const host = s.closest('[class]');
        out.push({
          size: Math.round(Math.max(r.width, r.height)),
          cls: (host && host.className) ? String(host.className).slice(0, 40) : '',
          attr: `${s.getAttribute('width') || '-'}x${s.getAttribute('height') || '-'}`,
          inTopbar: !!s.closest('.topbar'),
          inSide: !!s.closest('.side'),
          parent: (s.parentElement && s.parentElement.className) ? String(s.parentElement.className).slice(0, 30) : '',
        });
      }
    });
    return out;
  });
  console.log(JSON.stringify({ count: rows.length, rows, errs }, null, 1));
  await page.screenshot({ path: 'D:/kun-workspace/moyu-v2/_probe/icons-after.png' });
  await browser.close();
})();
