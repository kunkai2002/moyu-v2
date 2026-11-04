// 把 ui/index.html 的介面文字改成工具語彙（disguise-gate 會擋）
//   node tools/patch-ui-disguise.js
const fs = require('fs');
const path = require('path');

const P = path.join(__dirname, '..', 'ui', 'index.html');
let s = fs.readFileSync(P, 'utf8');

const SUBS = [
  ['<b>目錄</b>', '<b>文件</b>'],
  ['title="收合目錄"', 'title="收合文件"'],
  ['title="閱讀器設置"', 'title="設置"'],
  ['停尸房兼职，搬出了前女友？ / <b>第 3 章 信手拈来</b>', '~/work/api-server / <b>src/gateway/report.ts</b>'],
  ['<span class="sb-item" id="sbChapter">第 3 / 611 章</span>', '<span class="sb-item" id="sbChapter">614 / 1359</span>'],
  ['<span class="me-txt" id="meTxt">第 3 / 611 章</span>', '<span class="me-txt" id="meTxt">614 / 1359</span>'],
  ['placeholder="篩選…"', 'placeholder="篩選檔案…"'],
  ['停尸房兼职，搬出了前女友？', 'api-server'],
];

let n = 0;
for (const [a, b] of SUBS) {
  if (!s.includes(a)) { console.log('skip（沒有這個字串）：' + a.slice(0, 44)); continue; }
  s = s.split(a).join(b);
  n++;
}
fs.writeFileSync(P, s, 'utf8');
console.log('✅ ui/index.html 改了 ' + n + ' 處介面文字');
