// 註冊 wiring8 + bridge.version
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const bp = path.join(ROOT, 'ui', 'bridge-http.js');
let b = fs.readFileSync(bp, 'utf8');
if (!b.includes('version:')) {
  const a1 = '    stats: {';
  const add = ['    version: () => api(\'/api/version\'),', a1].join('\n');
  if (b.includes(a1)) { b = b.replace(a1, add); fs.writeFileSync(bp, b, 'utf8'); console.log('+ bridge.version'); }
  else console.log('! 錨點沒中');
} else console.log('= 已有 version');

const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('wiring8.js')) {
  h = h.replace('<script src="wiring7.js"></script>',
    '<script src="wiring7.js"></script>\n<script src="wiring8.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 wiring8');
}

const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('wiring8')) {
  p = p.replace("'ui/wiring7.js',", "'ui/wiring7.js', 'ui/wiring8.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 wiring8');
}
