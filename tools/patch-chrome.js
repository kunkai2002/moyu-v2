// 註冊 icons.js / chrome.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');

if (!h.includes('icons.js')) {
  h = h.replace('<script src="bridge-http.js"></script>',
    '<script src="icons.js"></script>\n<script src="bridge-http.js"></script>');
  console.log('+ icons.js（最先載入）');
}
if (!h.includes('chrome.js')) {
  h = h.replace('<script src="wiring12.js"></script>',
    '<script src="wiring12.js"></script>\n<script src="chrome.js"></script>');
  console.log('+ chrome.js（最後載入）');
}
fs.writeFileSync(hp, h, 'utf8');

const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('icons.js')) {
  p = p.replace("'ui/index.html',", "'ui/index.html', 'ui/icons.js', 'ui/chrome.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 icons/chrome');
}

console.log('scripts 順序：', [...h.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).join(' → '));
