// 改動後自檢：語法 / DOM id / 內部函式 / 載入順序 / 伺服器端點 / 章節抓取
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync, spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('ui/index.html');
const appJs = read('ui/app.js');
const wiring = read('ui/wiring.js');
const bridge = read('ui/bridge-http.js');

let fail = 0;
const ok = (m) => console.log('  ✅ ' + m);
const bad = (m) => { fail++; console.log('  ❌ ' + m); };

/* ── 1. 語法 ── */
console.log('\n[1] 語法');
for (const f of ['server.js', 'src/fanqie.js', 'src/appapi.js', 'src/shelf.js', 'src/login.js',
  'src/comments.js', 'src/store.js', 'src/sign/index.js', 'ui/app.js', 'ui/wiring.js', 'ui/bridge-http.js']) {
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'ignore' }); }
  catch { bad(f + ' 語法錯誤'); }
}
if (!fail) ok('11 個檔案全部通過');

/* ── 2. DOM id：靜態 + 動態樣板 ── */
const staticIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const tplIds = new Set([...appJs.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1])
  .concat([...wiring.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1])));
console.log(`\n[2] DOM：靜態 ${staticIds.size} 個、樣板 ${tplIds.size} 個`);

function checkSelectors(name, src) {
  const used = new Set();
  for (const re of [/\$\('#([\w-]+)'\)/g, /getElementById\('([\w-]+)'\)/g, /querySelector\('#([\w-]+)'\)/g]) {
    for (const m of src.matchAll(re)) used.add(m[1]);
  }
  const missing = [...used].filter((x) => !staticIds.has(x) && !tplIds.has(x));
  if (missing.length) bad(`${name} 找不到: ${missing.join(', ')}`);
  else ok(`${name} 查詢 ${used.size} 個 id 都存在`);
}
checkSelectors('app.js', appJs);
checkSelectors('wiring.js', wiring);

/* ── 3. __moyuDebug 匯出 vs wiring 呼叫 ── */
const exportBlock = appJs.match(/window\.__moyuDebug\s*=\s*\{([\s\S]*?)\n\};/);
const exported = new Set();
if (exportBlock) {
  for (const m of exportBlock[1].matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*[:(]/gm)) exported.add(m[1]);
  for (const m of exportBlock[1].matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*,/gm)) exported.add(m[1]);
}
const called = new Set([...wiring.matchAll(/\bD\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
console.log('\n[3] 內部函式');
const missFn = [...called].filter((x) => !exported.has(x));
if (missFn.length) bad('wiring 呼叫但沒匯出: ' + missFn.join(', '));
else ok(`wiring 用到 ${called.size} 個，全部有匯出`);

/* ── 4. bridge 方法 ── */
const bBlock = bridge.match(/window\.moyu = \{([\s\S]*?)\n  \};/);
const bKeys = bBlock ? new Set([...bBlock[1].matchAll(/^\s{4}([A-Za-z_$][\w$]*):/gm)].map((m) => m[1])) : new Set();
const bUsed = new Set([...wiring.matchAll(/window\.moyu\??\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
console.log('\n[4] bridge');
const missB = [...bUsed].filter((x) => !bKeys.has(x));
if (missB.length) bad('bridge 缺: ' + missB.join(', '));
else ok(`wiring 用到 ${[...bUsed].join(', ') || '無'}，都存在`);

/* ── 5. 腳本順序 ── */
const order = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
console.log('\n[5] 載入順序：' + order.join(' → '));
if (order.indexOf('bridge-http.js') < order.indexOf('app.js') && order.indexOf('app.js') < order.indexOf('wiring.js')) ok('正確');
else bad('順序不對');

/* ── 6. 伺服器實跑 ── */
const PORT = 47991;
const DATA = path.join(ROOT, 'data');
const call = (method, p, body) => new Promise((resolve, reject) => {
  const d = body ? JSON.stringify(body) : null;
  const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method,
    headers: d ? { 'Content-Type': 'application/json' } : {} }, (res) => {
    const c = []; res.on('data', (z) => c.push(z));
    res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString())); } catch { resolve(null); } });
  });
  r.on('error', reject); if (d) r.write(d); r.end();
});

(async () => {
  console.log('\n[6] 伺服器實跑');
  const srv = spawn(process.execPath, ['server.js', `--port=${PORT}`, `--data=${DATA}`], { cwd: ROOT, stdio: 'ignore' });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let up = false;
  for (let i = 0; i < 50; i++) { try { const h = await call('GET', '/api/health'); if (h?.ok) { up = true; break; } } catch {} await sleep(300); }
  if (!up) { bad('伺服器起不來'); srv.kill(); process.exit(1); }
  ok('健康檢查');

  for (const f of ['/', '/theme.css', '/app.js', '/wiring.js', '/bridge-http.js']) {
    const r = await new Promise((res) => http.get({ host: '127.0.0.1', port: PORT, path: f }, (x) => { x.resume(); res(x.statusCode); }).on('error', () => res(0)));
    if (r === 200) ok(`靜態 ${f}`);
    else bad(`靜態 ${f} → HTTP ${r}`);
  }

  const book = await call('POST', '/api/open', { input: '7373660003258862617' });
  if (book?.book?.total > 500) ok(`開書 ${book.book.total} 章`);
  else bad('開書失敗');

  if (book?.book) {
    const ch = await call('GET', `/api/chapter?book=${book.book.id}&id=${book.book.chapters[40].id}`);
    if (ch?.chars > 500) ok(`章節 ${ch.chars} 字`);
    else bad('章節抓取失敗');

    const cm = await call('GET', `/api/comments?book=${book.book.id}`);
    if ((cm?.total || 0) > 100) ok(`書評 ${cm.total} 條`);
    else bad('書評失敗');
  }

  const shelf = await call('GET', '/api/shelf');
  if (shelf && shelf.ok === false && shelf.error) ok(`未登入書架正確回錯：${shelf.error.slice(0, 16)}…`);
  else if (shelf?.ok) ok(`書架 ${shelf.total} 本`);
  else bad('書架端點異常');

  const qr = await call('POST', '/api/qr/start', {});
  if (qr?.ok && qr.image) ok('掃碼 QR 產生');
  else bad('掃碼失敗');

  /* ── 7. 打包完整性：server 的 require 在 dist 裡都要有 ── */
  console.log('\n[7] 打包完整性');
  {
    const dist = path.join(ROOT, 'dist', '魔芋一夏');
    const srvSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const reqs = [...srvSrc.matchAll(/require\('\.\/([^']+)'\)/g)].map((m) => m[1]);
    const missing = reqs.filter((r) => !fs.existsSync(path.join(dist, r)) && !fs.existsSync(path.join(dist, r + '.js')));
    if (missing.length) bad('dist 缺少: ' + missing.join(', '));
    else ok('server.js 的 ' + reqs.length + ' 個 require 在 dist 都在');
    const uiSrc = fs.readFileSync(path.join(ROOT, 'ui', 'index.html'), 'utf8');
    const scripts = [...uiSrc.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
    const uiMiss = scripts.filter((f) => !fs.existsSync(path.join(dist, 'ui', f)));
    if (uiMiss.length) bad('dist/ui 缺少: ' + uiMiss.join(', '));
    else ok('index.html 的 ' + scripts.length + ' 個 script 在 dist 都在');
  }

  srv.kill();
  await sleep(300);
  console.log(`\n${fail ? '❌ ' + fail + ' 個問題' : '✅ 全部通過'}`);
  process.exit(fail ? 1 : 0);
})();
