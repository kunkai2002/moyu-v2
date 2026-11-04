// 打真的雲端，確認 /m/ 與 /staging/m/ 送的是新的 DSH 殼（部署後跑一次）
//   node tools/check-live.js
const BASE = 'https://moyu-sync.qiaoyuhua2002.workers.dev';

const WANT = ['data-shell="dsh"', 'dsh-tokens.css', 'shell-dsh.js', 'side-brand'];

(async () => {
  let bad = 0;
  for (const p of ['/m/', '/staging/m/']) {
    const r = await fetch(BASE + p);
    const t = await r.text();
    const title = (/<title>(.*?)<\/title>/.exec(t) || [])[1] || '';
    const missing = WANT.filter((w) => !t.includes(w));
    const ok = r.status === 200 && missing.length === 0;
    if (!ok) bad++;
    console.log(
      (ok ? '✅' : '❌') + ' ' + p.padEnd(14) + r.status + ' · ' + t.length + ' bytes · ' + title +
      (missing.length ? ' · 缺：' + missing.join(',') : '')
    );
  }
  // 舊手機殼檔名要 404
  for (const p of ['/m/app.css', '/m/manifest.webmanifest', '/m/icon.svg']) {
    const r = await fetch(BASE + p);
    const ok = r.status === 404;
    if (!ok) bad++;
    console.log((ok ? '✅' : '❌') + ' ' + p.padEnd(26) + ' ' + r.status + '（舊殼退場）');
  }
  console.log(bad ? '❌ ' + bad + ' 項' : '✅ 雲端已是新殼');
  process.exit(bad ? 1 : 0);
})();
