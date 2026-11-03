'use strict';

/* 產生 App 圖示（一個來源，四種輸出）
   ─────────────────────────────────────────────────────────────
   node tools/make-icon.js
     → app/icon.svg      設計原始檔（可改）
     → app/icon-256.png  視窗圖示（Electron BrowserWindow icon）
     → app/tray-16.png   托盤圖示
     → app/icon.ico      任務欄／捷徑用（16~256 多尺寸）

   設計：暖陶土色圓角方塊 + 奶油白六芒星（Claude 系的形狀語言）。
   小尺寸只看得到「點 + 六道光」，所以星芒要粗、要捨細節。
   ══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const puppeteer = require('D:/dsh desktop/data/profiles/desktop/node_modules/puppeteer-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'app');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const TILE = { a: '#DE8462', b: '#C25B39' };   // 上亮下暗，16px 也看得出立體
const INK = '#FBF7F1';                          // 星芒

/** 六芒星（12 個頂點，外 96 / 內 34），中心 128,128 */
function starPath(cx = 128, cy = 128, rOut = 96, rIn = 34, points = 6, rot = -90) {
  const pts = [];
  for (let k = 0; k < points * 2; k++) {
    const r = k % 2 === 0 ? rOut : rIn;
    const a = ((rot + (k * 180) / points) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
}

const STAR = starPath();
const STAR_SOFT = starPath(128, 128, 62, 22);   // 小尺寸用（比較不容易糊成一團）

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${TILE.a}"/>
      <stop offset="1" stop-color="${TILE.b}"/>
    </linearGradient>
  </defs>
  <rect x="10" y="10" width="236" height="236" rx="54" fill="url(#tile)"/>
  <path d="${STAR}" fill="${INK}"/>
</svg>`;

/** 小尺寸專用：星芒放大到滿、圓角縮小，16px 還認得出形狀 */
function smallSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${TILE.a}"/>
      <stop offset="1" stop-color="${TILE.b}"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="252" height="252" rx="40" fill="url(#tile)"/>
  <path d="${STAR_SOFT}" fill="${INK}"/>
</svg>`;
}

function ico(bufs) {
  // ICO：6 bytes 檔頭 + 16 bytes 目錄 × n + PNG payload（Vista 以後可以塞 PNG）
  const count = bufs.length;
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(count, 4);
  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const body = [];
  bufs.forEach((b, i) => {
    const size = b.width;
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o + 0);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(b.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += b.length;
    body.push(b.data);
  });
  return Buffer.concat([head, dir, ...body]);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'icon.svg'), SVG, 'utf8');
  console.log('· icon.svg');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();

  async function render(svg, size) {
    const b64 = Buffer.from(svg, 'utf8').toString('base64');
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style>`
      + `<img src="data:image/svg+xml;base64,${b64}">`,
      { waitUntil: 'load' },
    );
    return await page.screenshot({ omitBackground: true, type: 'png' });
  }

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = [];
  for (const s of sizes) {
    const buf = await render(s <= 32 ? smallSvg() : SVG, s);
    pngs.push({ width: s, data: buf });
  }
  await browser.close();

  const get = (n) => pngs.find((p) => p.width === n).data;
  fs.writeFileSync(path.join(OUT, 'icon-256.png'), get(256));
  fs.writeFileSync(path.join(OUT, 'icon-64.png'), get(64));
  fs.writeFileSync(path.join(OUT, 'tray-16.png'), get(16));
  fs.writeFileSync(path.join(OUT, 'icon.ico'), ico(pngs));

  for (const f of ['icon.svg', 'icon-256.png', 'icon-64.png', 'tray-16.png', 'icon.ico']) {
    const st = fs.statSync(path.join(OUT, f));
    console.log(`· ${f}  ${(st.size / 1024).toFixed(1)} KB`);
  }
  console.log('完成 →', OUT);
})();
