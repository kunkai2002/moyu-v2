// 修 patch-shell.js 的路徑用法：rd/wr 收相對路徑，這裡一律用絕對路徑
const fs = require('fs');
let s = fs.readFileSync('tools/patch-shell.js', 'utf8');
s = s.split('let s = rd(f);').join("let s = fs.readFileSync(f, 'utf8');");
s = s.split('wr(f, s);').join("fs.writeFileSync(f, s, 'utf8');");
fs.writeFileSync('tools/patch-shell.js', s, 'utf8');
console.log('helpers fixed');
