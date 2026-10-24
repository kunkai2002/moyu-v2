// 註冊 wiring7 + bridge.stats
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* bridge.stats */
const bp = path.join(ROOT, 'ui', 'bridge-http.js');
let b = fs.readFileSync(bp, 'utf8');
if (!b.includes('stats:')) {
  const a1 = '    marks: {';
  const add = [
    '    stats: {',
    "      get: () => api('/api/stats'),",
    "      add: (d) => post('/api/stats', d),",
    '    },',
    a1,
  ].join('\n');
  if (b.includes(a1)) { b = b.replace(a1, add); fs.writeFileSync(bp, b, 'utf8'); console.log('+ bridge.stats'); }
  else console.log('! bridge 錨點沒中');
} else console.log('= bridge.stats 已存在');

/* index.html */
const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('wiring7.js')) {
  h = h.replace('<script src="wiring6.js"></script>',
    '<script src="wiring6.js"></script>\n<script src="wiring7.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 wiring7');
}

/* pack4 */
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('wiring7')) {
  p = p.replace("'ui/wiring6.js',", "'ui/wiring6.js', 'ui/wiring7.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 wiring7');
}
