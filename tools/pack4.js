'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', '魔芋一夏');

const FILES = [
  'server.js', 'main.js', 'package.json', 'ui/preload.js', 'README.md', '啟動.cmd',
  'src/fanqie.js', 'src/store.js', 'src/appapi.js', 'src/comments.js',
  'src/login.js', 'src/shelf.js', 'src/sync.js', 'src/prefetch.js', 'src/booksearch.js', 'src/charset.json',
  'src/sign/index.js', 'src/sign/sm3.js', 'src/sign/cipher.js', 'src/sign/protobuf.js',
  'ui/index.html', 'ui/m/index.html', 'ui/m/m.css', 'ui/m/m.js', 'ui/m/manifest.webmanifest', 'ui/m/sw.js', 'ui/icons.js', 'ui/chrome.js', 'ui/motion.js', 'ui/polish.js', '更新.cmd', '隧道.cmd', '開機自動啟動.cmd', 'tools/tunnel-daemon.ps1', 'tools/tunnel-launch.vbs', 'ui/theme.css', 'ui/app.js', 'ui/bridge-http.js',
  'ui/wiring.js', 'ui/wiring2.js', 'ui/wiring3.js', 'ui/wiring4.js', 'ui/wiring5.js', 'ui/wiring6.js', 'ui/wiring7.js', 'ui/wiring8.js', 'ui/wiring9.js', 'ui/wiring10.js', 'ui/wiring11.js', 'ui/wiring12.js', 'ui/wiring13.js',
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
// 帶上 Electron 執行檔（不入版控，但安裝包需要）
{
  const SRC = path.join(ROOT, 'node_modules', 'electron', 'dist');
  const DST = path.join(OUT, 'electron');
  if (fs.existsSync(path.join(SRC, 'electron.exe'))) {
    fs.mkdirSync(DST, { recursive: true });
    fs.cpSync(SRC, DST, { recursive: true });
    console.log('  + electron/');
  } else {
    console.log('  ! 找不到 node_modules/electron/dist（略過 Electron）');
  }
}

console.log(`完成 ${n} 個檔案 → ${OUT}`);
