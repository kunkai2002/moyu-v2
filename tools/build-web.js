'use strict';

/* ══════════════════════════════════════════════════════════════
   把桌面版 ui/ 打包成 Worker 可 import 的靜態資產模組
   ─────────────────────────────────────────────────────────────
   鏡像站（/m/、/staging/m/）跟桌面版吃同一份 ui/，不再維護第二套手機殼，
   所以這裡就是唯一入口：改完 ui/ 跑一次，Worker 才會拿到新檔。

     node tools/build-web.js

   輸出 sync/web-assets.mjs：
     ASSETS['/m/index.html'] = '<!doctype html>…'   ← key 對齊 ui/ 檔名
     ASSETS['/m/']           = 首頁（Worker 直接回，不用轉址）
     TYPES['.html']          = 'text/html; charset=utf-8'

   只收 .html/.css/.js/.svg/.webmanifest（Worker 會用到的靜態檔）。
   其他副檔名（png/woff2…）會被跳過並印出來：要用的話得先加進 TYPES，
   不然鏡像站會 404。
   ══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'ui');
const OUT = path.join(ROOT, 'sync', 'web-assets.mjs');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

/* 遞迴列出檔案（相對路徑一律用 /，Worker 的 key 也是 /）
   `_` 開頭是設計稿／截圖產物（ui/_shot），不是執行期檔案，不進 Worker。 */
function walk(dir, base = '') {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + ent.name : ent.name;
    if (ent.name.startsWith('_') || ent.name.startsWith('.')) continue;
    if (ent.isDirectory()) out.push(...walk(path.join(dir, ent.name), rel));
    else if (ent.isFile()) out.push(rel);
  }
  return out;
}

const all = walk(SRC).sort();
const skipped = all.filter((f) => !TYPES[path.extname(f).toLowerCase()]);
const files = all.filter((f) => TYPES[path.extname(f).toLowerCase()]);

if (!files.includes('index.html')) {
  console.error('❌ ui/index.html 不存在，鏡像站沒有首頁可送');
  process.exit(1);
}

const assets = {};
let bytes = 0;
for (const rel of files) {
  const body = fs.readFileSync(path.join(SRC, rel), 'utf8');
  bytes += Buffer.byteLength(body, 'utf8');
  assets['/m/' + rel] = body;
}
assets['/m/'] = assets['/m/index.html'];

/* 首頁引用的本地檔（src/href）都要在資產裡，不然上線才發現 404 */
function localRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const v = m[1].trim();
    if (!v || /^(?:[a-z]+:|\/\/|#|data:|mailto:)/i.test(v)) continue;
    refs.add(v.replace(/^\.\//, '').split(/[?#]/)[0]);
  }
  return [...refs];
}

const missing = localRefs(assets['/m/index.html']).filter((r) => !assets['/m/' + r]);
for (const s of files.filter((f) => f.endsWith('.js'))) {
  for (const m of assets['/m/' + s].matchAll(/\b(?:fetch|importScripts)\(\s*["']([^"']+)["']/g)) {
    const v = m[1].trim();
    if (v.startsWith('/api/') || /^[a-z]+:/i.test(v)) continue;
    if (v.startsWith('/m/') && !assets['/m/' + v.slice(3)]) missing.push(`${s} → ${v}`);
  }
}

const header = [
  '// 由 tools/build-web.js 產生，請勿手改。',
  '// 來源：ui/（桌面版同一份）；改完 ui/* 要重新執行 node tools/build-web.js。',
  '// 舊的 sync/m/ 手機殼已停用，不再被打包進 Worker。',
  '',
].join('\n');

const js = header
  + 'export const ASSETS = ' + JSON.stringify(assets) + ';\n'
  + 'export const TYPES = ' + JSON.stringify(TYPES) + ';\n'
  + 'export const META = ' + JSON.stringify({
    source: 'ui/',
    files: files.length,
    bytes,
    builtAt: new Date().toISOString(),
  }) + ';\n';

fs.writeFileSync(OUT, js, 'utf8');

/* ── 回報 ── */
console.log(`sync/web-assets.mjs  ${files.length} 檔 · ui ${(bytes / 1024).toFixed(1)} KB · 模組 ${(js.length / 1024).toFixed(1)} KB`);
for (const rel of files) console.log(`  /m/${rel}  ${(Buffer.byteLength(assets['/m/' + rel], 'utf8') / 1024).toFixed(1)} KB`);
if (skipped.length) {
  console.log(`\n略過 ${skipped.length} 個非白名單檔（不會被鏡像站供應）：${skipped.join(', ')}`);
}
if (missing.length) {
  console.log(`\n⚠ ui/index.html 或 js 引用了不存在的檔（鏡像站會 404）：${missing.join(', ')}`);
} else {
  console.log('\n✅ 首頁引用（src/href）全部在資產裡');
}
