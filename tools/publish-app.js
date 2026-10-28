'use strict';

/* 把這個 app 發佈到雲端（Cloudflare Worker + D1），桌面版自己會抓新版本，
   程式不用關、也不用重開；手機版 /m/ 也一起吃這份（改完 m/* 不用再 wrangler deploy）。

   用法：
     node tools/publish-app.js            # 發佈桌面版 + 手機版
     node tools/publish-app.js --dry      # 只算雜湊、看要傳幾個檔案

   金鑰沿用 sync/.token（跟 Worker 的 SYNC_TOKEN 同一把）。
*/
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { FILES } = require('./app-files');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://moyu-sync.qiaoyuhua2002.workers.dev';
const DRY = process.argv.includes('--dry');

function token() {
  const p = path.join(ROOT, 'sync', '.token');
  if (!fs.existsSync(p)) throw new Error('找不到 sync/.token');
  return fs.readFileSync(p, 'utf8').trim();
}

function sha1(buf) { return crypto.createHash('sha1').update(buf).digest('hex'); }

function shortSha() {
  try { return require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); }
  catch { return 'nogit'; }
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function collect() {
  const out = [];
  /* 一律用原始位元組 + base64 傳輸。
     update.cmd 這種老檔案裡有非 UTF-8 位元組，用 utf8 讀寫會偷偷改掉內容，
     雜湊就永遠對不上（而且會把檔案寫壞）。 */
  const add = (rel, src) => {
    const raw = fs.readFileSync(src);
    out.push({ path: rel.split(path.sep).join('/'), hash: sha1(raw), body: raw.toString('base64') });
  };
  for (const f of FILES) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) { console.log('  缺少', f); continue; }
    add(f, src);
  }
  /* 手機版：sync/m/* 發佈成 m/*，Worker 會優先吃雲端這一份 */
  const mdir = path.join(ROOT, 'sync', 'm');
  for (const f of fs.readdirSync(mdir)) {
    const src = path.join(mdir, f);
    if (!fs.statSync(src).isFile()) continue;
    add('m/' + f, src);
  }
  return out;
}

function post(p, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + p);
    const data = Buffer.from(JSON.stringify(body));
    const req = https.request({
      host: u.hostname, port: 443, path: u.pathname + u.search, method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token(),
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    }, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => {
        const t = Buffer.concat(c).toString('utf8');
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode + ' ' + t.slice(0, 200)));
        try { resolve(JSON.parse(t)); } catch { reject(new Error('回應不是 JSON：' + t.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('發佈逾時')));
    req.write(data);
    req.end();
  });
}

/* 一次把整包推上去（沒列的檔案會被清掉，所以 collect() 一定要含全部） */
async function publish(files, version) {
  return post('/app/publish', { version, files, keep: files.map((f) => f.path) });
}

(async () => {
  if (require.main !== module) return;
  const files = collect();
  const version = `${stamp()}-${shortSha()}`;
  const bytes = files.reduce((n, f) => n + f.body.length, 0);
  console.log(`檔案 ${files.length} 個 · ${(bytes / 1024).toFixed(0)} KB(base64) · 版本 ${version}`);
  if (DRY) {
    for (const f of files) console.log('  ', f.path, f.hash.slice(0, 8), (f.body.length / 1024).toFixed(1) + 'K');
    return;
  }
  const r = await publish(files, version);
  console.log('發佈結果：', JSON.stringify(r));
  console.log('\n桌面版下次檢查（開機 5 秒後、每 30 分鐘）就會自己更新；');
  console.log('手機版重新整理 https://moyu-sync.qiaoyuhua2002.workers.dev/m/ 就是新版。');
})();

module.exports = { collect, post, publish, stamp, shortSha };

