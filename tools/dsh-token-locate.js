// 把 DSH 各 client-ui 套件的 CSS 全抽出來，找某個 token 定義在哪個套件
// 用法：node tools/dsh-token-locate.js "--dsh-composer-card-max-width"
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const needle = process.argv[2];
if (!needle) {
  console.log('用法：node tools/dsh-token-locate.js <子字串>');
  process.exit(2);
}

const ASAR = process.env.DSH_ASAR || 'E:/DeepSeek/resources/app.asar';
const fd = fs.openSync(ASAR, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const headerSize = head.readUInt32LE(12);
const jsonLen = head.readUInt32LE(4);
const buf = Buffer.alloc(headerSize);
fs.readSync(fd, buf, 0, headerSize, 16);
const json = JSON.parse(buf.toString('utf8', 0, jsonLen));
const files = new Map();
(function walk(node, base) {
  for (const [k, v] of Object.entries(node.files || {})) {
    if (v.files) walk(v, base + '/' + k);
    else files.set(base + '/' + k, { size: v.size, offset: Number(v.offset) });
  }
})(json, '');

function read(key) {
  const f = files.get(key);
  const b = Buffer.alloc(f.size);
  fs.readSync(fd, b, 0, f.size, 16 + headerSize + f.offset);
  return b.toString('utf8');
}

const targets = [...files.keys()].filter(
  (k) => /dsh-(client|experimental-client)-ui-[a-z0-9-]+\/lib\/client\.js$/.test(k) && files.get(k).size < 3_000_000
);
console.log('掃描', targets.length, '個 client.js');

for (const k of targets) {
  const src = read(k);
  let idx = -1;
  const hits = [];
  while ((idx = src.indexOf(needle, idx + 1)) !== -1) hits.push(idx);
  if (!hits.length) continue;
  console.log('\n=== ' + k.replace('/dsh/node_modules/@deepseek-ai/', '') + '  (' + hits.length + ' 次) ===');
  for (const h of hits.slice(0, 4)) {
    console.log('  …' + src.slice(Math.max(0, h - 120), h + 200).replace(/\s+/g, ' ') + '…');
  }
}
fs.closeSync(fd);
