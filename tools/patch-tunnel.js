const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// pack4 加入 隧道.cmd（cloudflared.exe 55MB 不進版控、不進安裝包，用時再下載）
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');
if (!p.includes('隧道.cmd')) {
  p = p.replace("'更新.cmd',", "'更新.cmd', '隧道.cmd',");
  fs.writeFileSync(pp, p, 'utf8');
  console.log('+ pack4 加入 隧道.cmd');
} else console.log('= 已在');

// .gitignore 排除二進位
const gp = path.join(ROOT, '.gitignore');
let g = fs.readFileSync(gp, 'utf8');
if (!g.includes('tools/bin/')) {
  g += '\n# cloudflared 二進位（用 tools/get-cloudflared.js 下載）\ntools/bin/\n';
  fs.writeFileSync(gp, g, 'utf8');
  console.log('+ .gitignore 排除 tools/bin/');
}
