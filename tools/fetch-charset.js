// 把官方碼表抓下來存成 src/charset.json（多版本，執行時自動評分挑選）
const https = require('https');
const fs = require('fs');
const path = require('path');

const SRC = 'https://raw.githubusercontent.com/ying-ck/fanqienovel-downloader/main/src/charset.json';
const DEST = path.join(__dirname, '..', 'src', 'charset.json');

https.get(SRC, { headers: { 'User-Agent': 'moyu' } }, (r) => {
  const c = [];
  r.on('data', (d) => c.push(d));
  r.on('end', () => {
    const text = Buffer.concat(c).toString('utf8');
    const tables = JSON.parse(text);
    fs.mkdirSync(path.dirname(DEST), { recursive: true });
    fs.writeFileSync(DEST, JSON.stringify(tables), 'utf8');
    console.log('寫入', DEST, '版本數 =', tables.length, '長度 =', tables.map((t) => t.length).join(', '));
  });
}).on('error', (e) => { console.error(e); process.exit(1); });
