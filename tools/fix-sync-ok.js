// 修 sync.js：http 回應沒有 .ok，要用 statusCode
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'src', 'sync.js');
let s = fs.readFileSync(p, 'utf8');
const before = s;
s = s.replace('if (!res.ok) return reject(new Error(`同步失敗 HTTP ${res.statusCode}`));',
  'if (res.statusCode >= 400) return reject(new Error(`同步失敗 HTTP ${res.statusCode}`));');
if (s !== before) { fs.writeFileSync(p, s, 'utf8'); console.log('+ 修正 statusCode 判斷'); }
else console.log('= 沒找到該行');

// .gitignore 加 sync/.token
const g = path.join(__dirname, '..', '.gitignore');
let gi = fs.readFileSync(g, 'utf8');
if (!gi.includes('sync/.token')) {
  gi += '\n# 同步金鑰（絕不進版控）\nsync/.token\n';
  fs.writeFileSync(g, gi, 'utf8');
  console.log('+ .gitignore 加入 sync/.token');
}
