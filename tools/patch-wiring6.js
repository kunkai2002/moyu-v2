// 註冊 wiring6.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('wiring6.js')) {
  h = h.replace('<script src="wiring5.js"></script>',
    '<script src="wiring5.js"></script>\n<script src="wiring6.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 wiring6');
}

const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('wiring6')) {
  p = p.replace("'ui/wiring5.js',", "'ui/wiring5.js', 'ui/wiring6.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 wiring6');
}
