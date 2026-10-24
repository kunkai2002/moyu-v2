// 註冊 wiring5.js 到頁面與打包清單
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('wiring5.js')) {
  h = h.replace('<script src="wiring4.js"></script>',
    '<script src="wiring4.js"></script>\n<script src="wiring5.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 wiring5');
} else console.log('= index.html 已有 wiring5');

const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('wiring5')) {
  p = p.replace("'ui/wiring4.js',", "'ui/wiring4.js', 'ui/wiring5.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 wiring5');
} else console.log('= pack4 已有 wiring5');
