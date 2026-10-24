// ??嚗??瑁???甇??閬?瑼?銴ˊ??dist/擳?銝憭?const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', '擳?銝憭?);

const FILES = [
  'server.js',
  'README.md',
  '??.cmd',
  'src/fanqie.js',
  'src/store.js',
  'src/appapi.js',
  'src/comments.js',
  'src/login.js',
  'src/shelf.js',
  'src/charset.json',
  'src/sign/index.js',
  'src/sign/sm3.js',
  'src/sign/cipher.js',
  'src/sign/protobuf.js',
  'ui/index.html',
  'ui/theme.css',
  'ui/app.js',
  'ui/bridge-http.js',
  'tools/start.vbs',
];

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });

let bytes = 0;
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { console.log('  蝻箏?', f); continue; }
  const dst = path.join(OUT, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  bytes += fs.statSync(dst).size;
  console.log('  +', f);
}

// 蝛箄??冗嚗銵??神?伐???銝?撣嗡遙雿葫閰行???fs.mkdirSync(path.join(OUT, 'data', 'chapters'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'data', '.gitkeep'), '');

// ??敺?皜?甈∴?銝撽?頝??店??銝翰??for (const junk of ['last-book.json', 'progress.json', 'chapters', 'settings.json', 'device.json']) {
  const p = path.join(OUT, 'data', junk);
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
fs.mkdirSync(path.join(OUT, 'data', 'chapters'), { recursive: true });

// ?剜?蝔?嚗# 撱箇蔭?Ｙ嚗?const COMP = path.join(ROOT, 'dist_moyu_companion');
if (fs.existsSync(path.join(COMP, 'MoyuCompanion.exe'))) {
  const dst = path.join(OUT, 'companion');
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(COMP)) {
    if (f.endsWith('.pdb')) continue;
    fs.copyFileSync(path.join(COMP, f), path.join(dst, f));
  }
  console.log('  + companion/ (MoyuCompanion.exe)');
} else {
  console.log('  ! ?曆???companion 撱箇蔭?Ｙ嚗歲???? dotnet build嚗?);
}

// ?鞈?
fs.writeFileSync(path.join(OUT, 'VERSION.txt'), [
  '擳?銝憭?v2',
  'build ' + new Date().toISOString().slice(0, 10),
  '',
  '??嚗?????cmd??,
  '?瘙?Windows 10/11 + Node.js 18+ + Chrome ??Edge',
  '      嚗?.NET 8 獢?瑁??挾嚗瑼?撘嚗in10/11 憭撌脣撱綽?',
  '',
  '銝?閬?鋆遙雿?npm 憟辣??,
  '?典? Alt+Q ??芸???companion\\MoyuCompanion.exe ????,
].join('\n'), 'utf8');

console.log(`\n摰? ??${OUT}`);
console.log(`  ${FILES.length} ??獢?${(bytes / 1024).toFixed(1)} KB`);

