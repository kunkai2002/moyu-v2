// 打包：把執行時真正需要的檔案複製到 dist/魔芋一夏
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', '魔芋一夏');

const FILES = [
  'server.js',
  'README.md',
  '啟動.cmd',
  'src/fanqie.js',
  'src/store.js',
  'src/appapi.js',
  'src/comments.js',
  'src/login.js',
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
  if (!fs.existsSync(src)) { console.log('  缺少', f); continue; }
  const dst = path.join(OUT, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  bytes += fs.statSync(dst).size;
  console.log('  +', f);
}

// 空資料夾（執行時會寫入）—— 不要帶任何測試殘留
fs.mkdirSync(path.join(OUT, 'data', 'chapters'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'data', '.gitkeep'), '');

// 打包後再清一次：上面驗證跑過的話會留下快取
for (const junk of ['last-book.json', 'progress.json', 'chapters', 'settings.json', 'device.json']) {
  const p = path.join(OUT, 'data', junk);
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
fs.mkdirSync(path.join(OUT, 'data', 'chapters'), { recursive: true });

// 搭檔程式（C# 建置產物）
const COMP = path.join(ROOT, 'dist_moyu_companion');
if (fs.existsSync(path.join(COMP, 'MoyuCompanion.exe'))) {
  const dst = path.join(OUT, 'companion');
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(COMP)) {
    if (f.endsWith('.pdb')) continue;
    fs.copyFileSync(path.join(COMP, f), path.join(dst, f));
  }
  console.log('  + companion/ (MoyuCompanion.exe)');
} else {
  console.log('  ! 找不到 companion 建置產物，跳過（先跑 dotnet build）');
}

// 版本資訊
fs.writeFileSync(path.join(OUT, 'VERSION.txt'), [
  '魔芋一夏 v2',
  'build ' + new Date().toISOString().slice(0, 10),
  '',
  '啟動：雙擊「啟動.cmd」',
  '需求：Windows 10/11 + Node.js 18+ + Chrome 或 Edge',
  '      ＋ .NET 8 桌面執行階段（搭檔程式用；Win10/11 多數已內建）',
  '',
  '不需要安裝任何 npm 套件。',
  '全域 Alt+Q 與防截圖由 companion\\MoyuCompanion.exe 提供。',
].join('\n'), 'utf8');

console.log(`\n完成 → ${OUT}`);
console.log(`  ${FILES.length} 個檔案，${(bytes / 1024).toFixed(1)} KB`);
