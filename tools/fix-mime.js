// /m/ 這種以斜線結尾的路徑要當 HTML 回，不然瀏覽器把原始碼當文字顯示
const fs = require('fs');
const f = 'sync/worker.mjs';
let s = fs.readFileSync(f, 'utf8');

const oldLine = "      'content-type': TYPES[ext(pathname)] || 'text/plain; charset=utf-8',";
const newLine = "      'content-type': TYPES[ext(pathname)] || (pathname.charAt(pathname.length - 1) === '/' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'),";

if (!s.includes('pathname.charAt(pathname.length - 1)')) {
  if (!s.includes(oldLine)) { console.error('❌ 錨點失效'); process.exit(1); }
  s = s.replace(oldLine, newLine);
  fs.writeFileSync(f, s, 'utf8');
  console.log('worker content-type fixed');
} else console.log('已修過');
