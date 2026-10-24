// 把 wiring3.js 掛進頁面與打包清單
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let html = fs.readFileSync(path.join(ROOT, 'ui', 'index.html'), 'utf8');
if (!html.includes('wiring3.js')) {
  html = html.replace(
    '<script src="wiring2.js"></script>',
    '<script src="wiring2.js"></script>\n<script src="wiring3.js"></script>',
  );
  fs.writeFileSync(path.join(ROOT, 'ui', 'index.html'), html, 'utf8');
  console.log('+ index.html 掛上 wiring3.js');
} else {
  console.log('index.html 已有 wiring3.js');
}

const packPath = path.join(ROOT, 'tools', 'pack4.js');
let pack = fs.readFileSync(packPath, 'utf8');
if (!pack.includes('wiring3')) {
  pack = pack.replace("'ui/wiring2.js',", "'ui/wiring2.js', 'ui/wiring3.js',");
  fs.writeFileSync(packPath, pack, 'utf8');
  console.log('+ pack4.js 加入 wiring3.js');
} else {
  console.log('pack4.js 已有 wiring3.js');
}
