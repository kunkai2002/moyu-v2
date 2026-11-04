// 【legacy，2026-11-04 起不再使用】把 sync/m/* 打包成 Worker 可 import 的靜態資產模組
// 鏡像站已經改掛桌面版同一份 ui/：請改用 `node tools/build-web.js`（輸出 sync/web-assets.mjs）。
// sync/worker.mjs 已經不 import 這支的產物；sync/m/ 只剩歷史紀錄、沒有路由。
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'sync', 'm');
const out = path.join(root, 'sync', 'm-assets.mjs');

const files = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile());
const map = {};
for (const f of files) {
  const body = fs.readFileSync(path.join(dir, f), 'utf8');
  map['/m/' + f] = body;
}
map['/m'] = null; // 由 Worker 轉址
map['/m/'] = map['/m/index.html'];

const js = '// 由 tools/build-mobile-assets.js 產生，請勿手改\n'
  + 'export const ASSETS = ' + JSON.stringify(map, null, 0) + ';\n'
  + 'export const TYPES = ' + JSON.stringify({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
  }) + ';\n';
fs.writeFileSync(out, js, 'utf8');
console.log('sync/m-assets.mjs', files.length, 'files ·', (js.length / 1024).toFixed(1) + ' KB');
