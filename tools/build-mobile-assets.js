// 把 sync/m/* 打包成 Worker 可 import 的靜態資產模組
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
