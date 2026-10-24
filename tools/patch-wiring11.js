const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const hp = path.join(ROOT, 'ui', 'index.html');
let h = fs.readFileSync(hp, 'utf8');
if (!h.includes('wiring11.js')) {
  h = h.replace('<script src="wiring10.js"></script>',
    '<script src="wiring10.js"></script>\n<script src="wiring11.js"></script>');
  fs.writeFileSync(hp, h, 'utf8');
  console.log('+ index.html 掛 wiring11');
}

const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('wiring11')) {
  p = p.replace("'ui/wiring10.js',", "'ui/wiring10.js', 'ui/wiring11.js',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 wiring11');
}
