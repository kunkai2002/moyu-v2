const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('motion.js')) {
  h = h.replace('<script src="chrome.js"></script>',
    '<script src="chrome.js"></script>\n<script src="motion.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 motion.js');
} else console.log('= motion.js 已在');

const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('motion.js')) {
  p = p.replace("'ui/chrome.js',", "'ui/chrome.js', 'ui/motion.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 motion.js');
} else console.log('= pack4 已有 motion.js');

const scripts = [...h.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
console.log('載入順序尾段：' + scripts.slice(-5).join(' → '));
