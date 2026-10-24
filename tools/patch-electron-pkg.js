// 打包補上 Electron 需要的檔案；並把 electron dist 複製到安裝目錄
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* 1. pack4 補 main.js / package.json / preload.js */
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes("'main.js'")) {
  p = p.replace("'server.js',", "'server.js', 'main.js', 'package.json', 'ui/preload.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 main.js / package.json / ui/preload.js');
} else console.log('= pack4 已有');

/* 2. dist 補 Electron 執行檔（若尚未複製） */
const SRC = path.join(ROOT, 'node_modules', 'electron', 'dist');
const DST = path.join(ROOT, 'dist', '魔芋一夏', 'electron');
if (fs.existsSync(path.join(SRC, 'electron.exe'))) {
  if (!fs.existsSync(path.join(DST, 'electron.exe'))) {
    console.log('複製 Electron 到 dist（約 250MB，稍等）…');
    fs.mkdirSync(DST, { recursive: true });
    for (const f of fs.readdirSync(SRC)) {
      const s = path.join(SRC, f);
      const d = path.join(DST, f);
      const st = fs.statSync(s);
      if (st.isDirectory()) {
        fs.cpSync(s, d, { recursive: true });
      } else {
        fs.copyFileSync(s, d);
      }
    }
    console.log('+ dist\\electron 完成');
  } else console.log('= dist 已有 electron');
} else {
  console.log('! 找不到 node_modules/electron/dist/electron.exe');
}

/* 3. dist 根目錄寫一個 package.json（Electron 需要 main 欄位） */
const appPkg = {
  name: 'moyu',
  productName: '魔芋一夏',
  version: '0.2.0',
  main: 'main.js',
  private: true,
};
fs.writeFileSync(path.join(ROOT, 'dist', '魔芋一夏', 'package.json'), JSON.stringify(appPkg, null, 2), 'utf8');
console.log('+ dist/package.json');
