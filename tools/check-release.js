// 驗「桌面版正式發佈」：雲端 manifest 有沒有新版、新檔案在不在、位元組對不對
//   node tools/check-release.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://moyu-sync.qiaoyuhua2002.workers.dev';
const TOKEN = fs.readFileSync(path.join(ROOT, 'sync', '.token'), 'utf8').trim();
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');

const WANT = ['ui/index.html', 'ui/theme.css', 'ui/dsh-tokens.css', 'ui/shell-dsh.js', 'ui/layout.js', 'ui/bridge-http.js'];

(async () => {
  let bad = 0;
  const r = await fetch(BASE + '/app/manifest', { headers: { Authorization: 'Bearer ' + TOKEN } });
  const m = await r.json();
  const files = m.files || {};
  console.log('版本：' + (m.version || '?') + ' · 檔案 ' + Object.keys(files).length + ' 個');

  for (const f of WANT) {
    const cloud = files[f];               // manifest 的檔案表是「路徑 → sha1」
    const local = fs.readFileSync(path.join(ROOT, f));
    const localHash = sha1(local);
    const hit = cloud === localHash;
    if (!hit) bad++;
    console.log(
      (hit ? '✅' : '❌') + ' ' + f.padEnd(22) +
      (cloud ? String(cloud).slice(0, 8) : '（雲端沒有）') + ' · 本機 ' + localHash.slice(0, 8)
    );
  }

  // 真的抓一份回來比位元組（manifest 對不代表 /app/file 對）
  for (const f of ['ui/shell-dsh.js', 'ui/dsh-tokens.css']) {
    const res = await fetch(BASE + '/app/file?p=' + encodeURIComponent(f), { headers: { Authorization: 'Bearer ' + TOKEN } });
    const buf = Buffer.from(await res.arrayBuffer());
    const local = fs.readFileSync(path.join(ROOT, f));
    const ok = res.status === 200 && buf.equals(local);
    if (!ok) bad++;
    console.log((ok ? '✅' : '❌') + ' /app/file ' + f + ' · ' + res.status + ' · ' + buf.length + ' bytes');
  }

  console.log(bad ? '❌ ' + bad + ' 項對不上' : '✅ 正式版雲端與本機一致');
  process.exitCode = bad ? 1 : 0;
})();
