// 直接下載 Electron 預編譯包（避開 npm postinstall 的 spawn 限制）
const https = require('https');
const fs = require('fs');
const path = require('path');

const UA = 'moyu-setup';

function getJson(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400) { r.resume(); return res(getJson(r.headers.location)); }
      const c = []; r.on('data', (d) => c.push(d));
      r.on('end', () => { try { res(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

function download(url, dest, redirects = 0) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && redirects < 8) {
        r.resume();
        return res(download(r.headers.location, dest, redirects + 1));
      }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode + ' ' + url)); }
      const total = Number(r.headers['content-length'] || 0);
      let got = 0, lastPct = -1;
      const tmp = dest + '.part';
      const out = fs.createWriteStream(tmp);
      r.on('data', (d) => {
        got += d.length;
        if (total) {
          const pct = Math.floor((got / total) * 100);
          if (pct !== lastPct && pct % 10 === 0) { lastPct = pct; process.stdout.write(`  ${pct}%\n`); }
        }
      });
      r.pipe(out);
      out.on('finish', () => { out.close(() => { fs.renameSync(tmp, dest); res({ bytes: got }); }); });
      out.on('error', rej);
    }).on('error', rej);
  });
}

(async () => {
  const meta = await getJson('https://registry.npmjs.org/electron/latest');
  const version = meta.version;
  console.log('Electron 最新版:', version);

  const vendor = path.join(__dirname, '..', 'vendor');
  fs.mkdirSync(vendor, { recursive: true });
  const zip = path.join(vendor, `electron-v${version}-win32-x64.zip`);

  if (!fs.existsSync(zip)) {
    const urls = [
      `https://github.com/electron/electron/releases/download/v${version}/electron-v${version}-win32-x64.zip`,
      `https://npmmirror.com/mirrors/electron/${version}/electron-v${version}-win32-x64.zip`,
    ];
    let ok = false;
    for (const u of urls) {
      try {
        console.log('下載', u);
        const r = await download(u, zip);
        console.log('  完成', (r.bytes / 1048576).toFixed(1), 'MB');
        ok = true; break;
      } catch (e) { console.log('  失敗', e.message); }
    }
    if (!ok) process.exit(1);
  } else {
    console.log('已有', zip);
  }
  fs.writeFileSync(path.join(vendor, 'version.txt'), version, 'utf8');
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
