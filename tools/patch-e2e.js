const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'e2e.js');
let s = fs.readFileSync(p, 'utf8');
if (!s.includes("moyu-pptr-' + Date.now()")) {
  s = s.replace("'moyu-pptr'", "'moyu-pptr-' + Date.now()");
  fs.writeFileSync(p, s, 'utf8');
  console.log('+ e2e 每次使用全新 profile（避免 service worker 快取）');
} else {
  console.log('= 已使用動態 profile');
}
