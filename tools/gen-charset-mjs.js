// 產生 sync/charset.mjs（給 Worker 用的 PUA 碼表）
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'src', 'charset.json');
const out = path.join(root, 'sync', 'charset.mjs');

const raw = fs.readFileSync(src, 'utf8');
const tables = JSON.parse(raw);
const body = '// 由 tools/gen-charset-mjs.js 從 src/charset.json 產生，請勿手改\n'
  + 'export default ' + JSON.stringify(tables) + ';\n';
fs.writeFileSync(out, body, 'utf8');
console.log('sync/charset.mjs', (body.length / 1024).toFixed(1) + ' KB', 'tables=' + tables.length);
