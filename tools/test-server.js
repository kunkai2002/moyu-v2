// 全端點驗收：起服務 → 打每一支 API → 檢查結果
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const PORT = 47901;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      { host: '127.0.0.1', port: PORT, path: p, method, headers: data ? { 'Content-Type': 'application/json' } : {} },
      (res) => {
        const c = [];
        res.on('data', (d) => c.push(d));
        res.on('end', () => {
          const t = Buffer.concat(c).toString('utf8');
          try { resolve({ status: res.statusCode, json: JSON.parse(t) }); }
          catch { resolve({ status: res.statusCode, text: t }); }
        });
      },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? '  ' + detail : ''}`);
};

(async () => {
  const srv = spawn(process.execPath, ['server.js', `--port=${PORT}`, `--data=${DATA}`], {
    cwd: ROOT, detached: false, stdio: 'ignore',
  });

  // 等服務起來
  let up = false;
  for (let i = 0; i < 40; i++) {
    try { const h = await req('GET', '/api/health'); if (h.json?.ok) { up = true; break; } } catch {}
    await sleep(300);
  }
  if (!up) { console.log('❌ 服務起不來'); srv.kill(); process.exit(1); }
  console.log('\n=== 服務已啟動 ===\n');

  // 1. 靜態檔
  for (const f of ['/', '/theme.css', '/app.js', '/bridge-http.js']) {
    const r = await req('GET', f);
    check(`靜態 ${f}`, r.status === 200, `HTTP ${r.status}`);
  }

  // 2. 設定
  const cfg = await req('GET', '/api/config');
  check('/api/config', cfg.json && cfg.json.theme !== undefined, `theme=${cfg.json?.theme}`);

  // 3. 開書
  const t0 = Date.now();
  const open = await req('POST', '/api/open', { input: '7373660003258862617' });
  check('/api/open', open.json?.book?.total > 500,
    `${open.json?.book?.title} · ${open.json?.book?.total} 章 · ${Date.now() - t0}ms`);

  const book = open.json.book;

  // 4. 章節（走 APP 網關）
  const chs = [book.chapters[0], book.chapters[38], book.chapters[300]];
  let fullCount = 0;
  for (const c of chs) {
    const r = await req('GET', `/api/chapter?book=${book.id}&id=${c.id}`);
    const ok = r.json && !r.json.error && r.json.chars > 500 && !r.json.previewOnly;
    if (ok) fullCount++;
    check(`章節 第${c.no}章`, ok, `${r.json?.chars}字 · ${r.json?.source || 'web'}`);
  }
  check('全文比例', fullCount === chs.length, `${fullCount}/${chs.length}`);

  // 5. 書評
  const cm = await req('GET', `/api/comments?book=${book.id}&sort=1`);
  check('/api/comments', (cm.json?.total || 0) > 100,
    `${cm.json?.total} 條 · ${cm.json?.comments?.length} 則 · ${cm.json?.scoreText}`);

  // 6. 進度
  await req('POST', '/api/progress', { lastBook: book.id, books: { [book.id]: { chapterNo: '39' } } });
  const pr = await req('GET', '/api/progress');
  check('/api/progress', pr.json?.books?.[book.id]?.chapterNo === '39', '寫入後讀回一致');

  // 7. 最後一本
  const lb = await req('GET', '/api/last-book');
  check('/api/last-book', lb.json?.id === book.id, lb.json?.title);

  // 8. 匯出
  const ex = await req('GET', `/api/export?book=${book.id}&limit=3`);
  const fileOk = ex.json?.file && fs.existsSync(ex.json.file);
  check('/api/export', fileOk, `${ex.json?.chapters} 章 · ${ex.json?.chars} 字`);
  if (fileOk) {
    const txt = fs.readFileSync(ex.json.file, 'utf8');
    check('匯出檔 UTF-8', !txt.includes('\uFFFD'), `${txt.length} 字元`);
  }

  // 9. 錯誤處理
  const bad = await req('POST', '/api/open', { input: 'abc' });
  check('錯誤處理', bad.status >= 400 || bad.json?.error, bad.json?.error?.slice(0, 24));

  srv.kill();
  await sleep(300);

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass === results.length ? '✅ 全部通過' : '❌ 有失敗'}  ${pass}/${results.length}`);
  process.exit(pass === results.length ? 0 : 1);
})();
