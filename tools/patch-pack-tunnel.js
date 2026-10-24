const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');

for (const [needle, add] of [
  ['開機自動啟動.cmd', "'隧道.cmd', '開機自動啟動.cmd', 'tools/tunnel-daemon.ps1', 'tools/tunnel-launch.vbs',"],
]) {
  if (!p.includes(needle)) {
    p = p.replace("'隧道.cmd',", add);
    console.log('+ pack4 補上', needle);
  } else console.log('= pack4 已有', needle);
}
fs.writeFileSync(pp, p, 'utf8');
