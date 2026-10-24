'use strict';
/* ??嚗??瑁???閬?瑼?銴ˊ??dist/擳?銝憭?*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', '擳?銝憭?);

const FILES = [
  'server.js', 'README.md', '??.cmd',
  'src/fanqie.js', 'src/store.js', 'src/appapi.js', 'src/comments.js',
  'src/login.js', 'src/shelf.js', 'src/charset.json',
  'src/sign/index.js', 'src/sign/sm3.js', 'src/sign/cipher.js', 'src/sign/protobuf.js',
  'ui/index.html', 'ui/theme.css', 'ui/app.js', 'ui/bridge-http.js', 'ui/wiring.js',
  'tools/start.vbs',
];

if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let n = 0;
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { console.log('  蝻箏?', f); continue; }
  const dst = path.join(OUT, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  n++;
}

const COMP = path.join(ROOT, 'dist_moyu_companion');
if (fs.existsSync(path.join(COMP, 'MoyuCompanion.exe'))) {
  const dst = path.join(OUT, 'companion');
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(COMP)) {
    if (f.endsWith('.pdb')) continue;
    fs.copyFileSync(path.join(COMP, f), path.join(dst, f));
  }
  console.log('  + companion/');
}

fs.mkdirSync(path.join(OUT, 'data', 'chapters'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'data', '.gitkeep'), '');
fs.writeFileSync(path.join(OUT, 'VERSION.txt'), [
  '擳?銝憭?v2', 'build ' + new Date().toISOString().slice(0, 10), '',
  '??嚗?????cmd??,
  '?瘙?Windows 10/11 + Node.js 18+ + Chrome/Edge + .NET 8 獢?瑁??挾',
].join('\n'), 'utf8');

console.log(`摰? ??${OUT}  (${n} ??獢?`);

