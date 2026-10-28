'use strict';
const fs = require('fs');
const path = require('path');
const { FILES } = require('./app-files');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', '魔芋一夏');

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
