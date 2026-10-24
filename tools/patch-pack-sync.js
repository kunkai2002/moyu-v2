const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* 1) pack4 加入 src/sync.js */
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('src/sync.js')) {
  p = p.replace("'src/shelf.js',", "'src/shelf.js', 'src/sync.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 src/sync.js');
} else console.log('= pack4 已有 src/sync.js');

/* 2) 安裝目錄若缺 src/sync.js 直接補（避免舊版崩） */
const inst = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'src', 'sync.js');
const srcSync = path.join(ROOT, 'src', 'sync.js');
if (!fs.existsSync(inst)) {
  fs.mkdirSync(path.dirname(inst), { recursive: true });
  fs.copyFileSync(srcSync, inst);
  console.log('+ 補進安裝目錄 src/sync.js');
} else console.log('= 安裝目錄已有');
