'use strict';
/* 打包：把執行時需要的檔案複製到 dist/魔芋一夏 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', '魔芋一夏');

const FILES = [
  'server.js', 'README.md', '啟動.cmd',
  'src/fanqie.js', 'src/store.js', 'src/appapi.js', 'src/comments.js',
  'src/login.js', 'src/shelf.js', 'src/charset.json',
  'src/sign/index.js', 'src/sign/sm3.js', 'src/sign/cipher.js', 'src/sign/protobuf.js',
  'ui/index.html', 'ui/theme.css', 'ui/app.js', 'ui/bridge-http.js',
  'tools/start.vbs',
];

if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let n = 0;
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { console.log('  缺少', f); continue; }
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
  '魔芋一夏 v2', 'build ' + new Date().toISOString().slice(0, 10), '',
  '啟動：雙擊「啟動.cmd」',
  '需求：Windows 10/11 + Node.js 18+ + Chrome/Edge + .NET 8 桌面執行階段',
].join('\n'), 'utf8');

console.log(`完成 → ${OUT}  (${n} 個檔案)`);
