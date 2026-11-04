// 列出／抽取 E:\DeepSeek\resources\app.asar 內的檔案
// 用法：
//   node tools/probe-asar.js list <regex>       列出符合的檔案與大小
//   node tools/probe-asar.js get <asar路徑>...  抽出到 _probe/dsh/<路徑>
const fs = require('fs');
const path = require('path');
const ASAR = process.env.DSH_ASAR || 'E:/DeepSeek/resources/app.asar';

function openAsar() {
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
  return { fd, headerSize, files };
}

function readFile(a, key) {
  const f = a.files.get(key);
  if (!f) throw new Error('MISSING ' + key);
  const b = Buffer.alloc(f.size);
  fs.readSync(a.fd, b, 0, f.size, 16 + a.headerSize + f.offset);
  return b;
}

const cmd = process.argv[2];
const a = openAsar();

if (cmd === 'list') {
  const pat = new RegExp(process.argv[3] || '.', 'i');
  const hits = [...a.files.entries()].filter(([k]) => pat.test(k));
  console.log('total files:', a.files.size, ' matched:', hits.length);
  for (const [k, v] of hits.slice(0, 800)) console.log(String(v.size).padStart(9), k);
} else if (cmd === 'get') {
  for (const key of process.argv.slice(3)) {
    const b = readFile(a, key);
    const out = path.join(__dirname, '..', '_probe', 'dsh', key.replace(/^\//, ''));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, b);
    console.log('OK', out, b.length);
  }
} else if (cmd === 'cat') {
  for (const key of process.argv.slice(3)) process.stdout.write(readFile(a, key).toString('utf8'));
} else {
  console.log('用法：node tools/probe-asar.js list <regex> | get <path>... | cat <path>');
}

fs.closeSync(a.fd);
