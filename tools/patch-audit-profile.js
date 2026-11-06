// audit 一直讀到「舊的 shell-dsh.js」：它跟 JOJO 的 app 共用同一個 Chromium profile，
// file:// 的 JS 會被 profile 快取住。給 audit 自己的 --user-data-dir（在 probe 目錄裡），
// 每次都是乾淨快取；JOJO 的資料（data-dir）不變。
//   node tools/patch-audit-profile.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tools', 'audit-chat-ui.js');
let s = fs.readFileSync(p, 'utf8');
const a = "const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--remote-debugging-port=${PORT}`, '--hidden'],";
const b = "const child = spawn(EXE, [APP, `--data-dir=${PROBE}`, `--user-data-dir=${path.join(PROBE, 'profile')}`, `--remote-debugging-port=${PORT}`, '--hidden'],";
if (!s.includes(a)) { console.error('❌ 找不到 spawn 參數'); process.exit(1); }
s = s.split(a).join(b);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ audit 用自己的 user-data-dir（不吃舊快取）');
