'use strict';

/* ══════════════════════════════════════════════════════════════
   鏡像站路由驗證（不 deploy、不碰雲端）
   ─────────────────────────────────────────────────────────────
   直接 import sync/worker.mjs，呼叫它的 fetch handler，用假的 D1 當 env：

     node tools/test-mirror.js

   驗的是「人家載入鏡像站時真正會發生的事」：
     · /m/、/staging/m/ 送的是 ui/ 的同一份檔（逐位元組相同，不是近似）
     · Content-Type 正確（html/css/js）
     · 舊的 sync/m/ 手機殼檔名已經沒有路由（404）
     · 瀏覽器模式缺的 API 都有回應；桌面專屬的回 501 JSON 而不是 500
     · ui 傳的 camelCase（bookId/chapterId）與舊殼的 snake_case 都收

   報告寫到 _probe/mirror-routes.json。
   ══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const UI = path.join(ROOT, 'ui');
const OUT = path.join(ROOT, '_probe');

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });
const check = (cond, n, e = '') => (cond ? ok(n) : bad(n, e));

/* ── 假 D1：只回這幾支查詢需要的東西 ── */
function makeDB(seed = {}) {
  const db = { progress: [], marks: [], configRow: null, ...seed };
  const kindOf = (sql) => {
    const s = String(sql).replace(/\s+/g, ' ').toUpperCase();
    if (s.includes('FROM CONFIG')) return 'config';
    if (s.includes('FROM PROGRESS') && s.includes('LIMIT 1')) return 'progress1';
    if (s.includes('FROM PROGRESS')) return 'progressAll';
    if (s.includes('FROM MARKS')) return 'marks';
    if (s.includes('FROM APP_FILES')) return 'appFiles';
    if (s.includes('FROM APP_META')) return 'appMeta';
    return 'other';
  };
  const stmt = (sql) => {
    const kind = kindOf(sql);
    const first = async () => {
      if (kind === 'config') return db.configRow;
      if (kind === 'progress1') return db.progress[0] || null;
      if (kind === 'appFiles') return null;
      return null;
    };
    const all = async () => {
      if (kind === 'progressAll') return { results: db.progress };
      if (kind === 'marks') return { results: db.marks };
      if (kind === 'appFiles') return { results: [] };
      return { results: [] };
    };
    const run = async () => ({});
    const bound = { first, all, run };
    return { bind: () => bound, first, all, run };
  };
  return { prepare: stmt, batch: async () => [], __db: db };
}

const TOKEN = 'test-token';
const AUTH = { Authorization: 'Bearer ' + TOKEN };

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const worker = (await import(pathToFileURL(path.join(ROOT, 'sync', 'worker.mjs')).href)).default;
  const assets = await import(pathToFileURL(path.join(ROOT, 'sync', 'web-assets.mjs')).href);

  const env = { SYNC_TOKEN: TOKEN, DB: makeDB() };
  const call = (url, opts) => worker.fetch(new Request('https://mirror.test' + url, opts), env);
  const bodyText = async (r) => Buffer.from(await r.arrayBuffer());
  const uiFile = (rel) => fs.readFileSync(path.join(UI, rel));

  /* ── 1. 資產模組本身 ── */
  for (const t of ['.html', '.css', '.js', '.svg', '.webmanifest']) {
    check(!!assets.TYPES[t], `TYPES 有 ${t}`, 'TYPES 缺這個副檔名，鏡像站會用 text/plain 送');
  }
  check(typeof assets.ASSETS === 'object' && !!assets.ASSETS['/m/index.html'], 'ASSETS 有 /m/index.html');
  check(!!assets.ASSETS['/m/'], 'ASSETS 有 /m/（首頁別名）');

  /* ── 2. /m/ 與 /staging/m/ 送同一份 ui/ ── */
  const rM = await call('/m');
  check(rM.status === 302 && /\/m\/$/.test(rM.headers.get('location') || ''), '/m 轉址到 /m/', `${rM.status} ${rM.headers.get('location')}`);
  const rsM = await call('/staging/m');
  check(rsM.status === 302 && /\/staging\/m\/$/.test(rsM.headers.get('location') || ''), '/staging/m 轉址到 /staging/m/', `${rsM.status}`);

  const mounts = ['/m/', '/staging/m/'];
  for (const mount of mounts) {
    const r = await call(mount);
    const buf = await bodyText(r);
    check(r.status === 200, `${mount} 200`, String(r.status));
    check((r.headers.get('content-type') || '') === 'text/html; charset=utf-8', `${mount} Content-Type=html`, r.headers.get('content-type') || '(none)');
    check(buf.equals(uiFile('index.html')), `${mount} body 與 ui/index.html 相同`, `${buf.length} vs ${uiFile('index.html').length}`);
    check(buf.toString('utf8').includes('bridge-http.js'), `${mount} 載入 bridge-http.js（瀏覽器模式的 window.moyu）`);
  }

  /* 首頁引用的每一個本地檔都要 200 且跟 ui/ 一樣 */
  const html = fs.readFileSync(path.join(UI, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)]
    .map((m) => m[1].trim())
    .filter((v) => v && !/^(?:[a-z]+:|\/\/|#|data:)/i.test(v))
    .map((v) => v.replace(/^\.\//, '').split(/[?#]/)[0]);
  check(refs.length > 5, `首頁引用 ${refs.length} 個本地檔`);
  for (const rel of refs) {
    for (const mount of mounts) {
      const r = await call(mount + rel);
      const buf = await bodyText(r);
      const want = uiFile(rel);
      const type = r.headers.get('content-type') || '';
      const wantType = rel.endsWith('.css') ? 'text/css; charset=utf-8' : (rel.endsWith('.js') ? 'text/javascript; charset=utf-8' : '');
      check(r.status === 200 && buf.equals(want) && (!wantType || type === wantType),
        `${mount}${rel} 與 ui/${rel} 相同`,
        `${r.status} ${type} ${buf.length}/${want.length}`);
    }
  }

  /* ── 3. 舊手機殼不再被路由 ── */
  for (const old of ['/m/app.css', '/m/manifest.webmanifest', '/m/icon.svg', '/m/sw.js', '/staging/m/app.css']) {
    const r = await call(old);
    const buf = await bodyText(r);
    check(r.status === 404, `${old} 404（舊殼已停用）`, `status ${r.status} body ${buf.slice(0, 40)}`);
  }

  /* ── 4. 路徑穿越／壞編碼（不能 200、不能把 ui 檔洩出去） ── */
  for (const evil of ['/m/%2e%2e/index.html', '/m/%2e%2e%2fpackage.json', '/m/index.html%22', '/m/../../package.json']) {
    const r = await call(evil);
    const buf = await bodyText(r);
    const leaked = buf.toString('utf8').includes('"name": "moyu"') || buf.toString('utf8').includes('<div class="app">');
    check((r.status === 404 || r.status === 401) && !leaked, `拒絕 ${evil}`, `${r.status} leak=${leaked}`);
  }

  /* ── 5. API：沒 token 要 401 ── */
  const noauth = await call('/api/config');
  check(noauth.status === 401, '沒金鑰時 /api/config 401', String(noauth.status));

  /* ── 6. API：瀏覽器模式要有的唯讀端點 ── */
  const cfgR = await call('/api/config', { headers: AUTH });
  const cfg = await cfgR.json();
  check(cfgR.status === 200 && cfg.theme && cfg.mode === 'http', '/api/config 回預設主題', JSON.stringify(cfg).slice(0, 120));
  check(cfg.loggedIn === false, '/api/config 沒 cookie 時 loggedIn=false', String(cfg.loggedIn));

  const ver = await (await call('/api/version', { headers: AUTH })).json();
  check(ver.ok === true && !!ver.sha, '/api/version', JSON.stringify(ver).slice(0, 120));

  const lbR = await call('/api/last-book', { headers: AUTH });
  check(lbR.status === 200 && (await lbR.json()) === null, '/api/last-book 沒進度時回 null', String(lbR.status));

  const cm = await (await call('/api/comments?book=B1', { headers: AUTH })).json();
  check(cm.ok === true && Array.isArray(cm.comments) && cm.comments.length === 0, '/api/comments 回空', JSON.stringify(cm).slice(0, 120));

  const stR = await call('/api/stats', { headers: AUTH });
  const st = await stR.json();
  check(stR.status === 200 && st.ok === true && st.total && st.total.chars === 0, '/api/stats GET 回空表');
  const stPost = await call('/api/stats', { method: 'POST', headers: AUTH, body: JSON.stringify({ chars: 10 }) });
  check(stPost.status === 501, '/api/stats POST 回 501（桌面專屬）', String(stPost.status));

  /* ── 7. 桌面專屬：501 JSON（不是 500、不是 404） ── */
  const desktop = [
    ['/api/qr/start', 'POST'], ['/api/qr/poll?token=x', 'GET'], ['/api/cookie', 'GET'],
    ['/api/cookie', 'POST'], ['/api/export?book=B1', 'GET'], ['/api/search?book=B1&q=x', 'GET'],
    ['/api/events', 'GET'], ['/api/boss', 'POST'], ['/api/tunnel', 'GET'],
    ['/api/prefetch/status', 'GET'], ['/api/update', 'GET'], ['/api/sync/status', 'GET'],
    ['/api/sync/push', 'POST'],
  ];
  for (const [u, method] of desktop) {
    const r = await call(u, { method, headers: AUTH });
    let j = null;
    try { j = await r.json(); } catch {}
    check(r.status === 501 && j && j.ok === false && j.desktopOnly === true,
      `${method} ${u} → 501 JSON`, `${r.status} ${JSON.stringify(j).slice(0, 80)}`);
  }

  /* ── 8. 未知 API 是 404 JSON，不是 500 ── */
  const unk = await call('/api/不存在', { headers: AUTH });
  const unkJson = await unk.json().catch(() => null);
  check(unk.status === 404 && unkJson && unkJson.ok === false, '未知 /api/* 回 404 JSON', String(unk.status));

  /* ── 9. ui 的 camelCase 寫法（bridge-http.js）要收 ── */
  const mSave = await call('/api/marks', {
    method: 'POST', headers: AUTH,
    body: JSON.stringify({ bookId: 'B1', chapterId: 'c1', chapterTitle: '第一章', para: 3, text: '測試', type: 'pos' }),
  });
  const mSaveJson = await mSave.json();
  check(mSave.status === 200 && mSaveJson.ok === true && !!mSaveJson.id, '/api/marks 收 camelCase', JSON.stringify(mSaveJson).slice(0, 120));

  const mDel = await call('/api/marks', {
    method: 'POST', headers: AUTH,
    body: JSON.stringify({ action: 'remove', bookId: 'B1', id: mSaveJson.id }),
  });
  const mDelJson = await mDel.json();
  check(mDel.status === 200 && mDelJson.ok === true, '/api/marks 刪除不需要 book_id', JSON.stringify(mDelJson).slice(0, 120));

  const pDoc = await call('/api/progress', {
    method: 'POST', headers: AUTH,
    body: JSON.stringify({ lastBook: 'B1', books: { B1: { chapterId: 'c1', chapterNo: 1, title: '第一章', updated: 100 } } }),
  });
  const pDocJson = await pDoc.json();
  check(pDoc.status === 200 && pDocJson.ok === true && pDocJson.wrote === 1, '/api/progress 收 ui 的 {books} 文件', JSON.stringify(pDocJson).slice(0, 120));

  const openEmpty = await call('/api/open', { method: 'POST', headers: AUTH, body: JSON.stringify({}) });
  const openEmptyJson = await openEmpty.json();
  check(openEmpty.status === 200 && openEmptyJson.ok === false && /input/.test(openEmptyJson.error || ''), '/api/open 缺 input 明確報錯（不炸）', JSON.stringify(openEmptyJson).slice(0, 120));

  /* ── 10. 有資料時：last-book / progress / marks 的形狀 ── */
  env.DB = makeDB({
    progress: [{ book_id: 'B1', chapter_id: 'c1', chapter_no: '1', title: '第一章', updated_at: 500, device: 'phone' }],
    marks: [{ id: 'c1-3-pos', book_id: 'B1', chapter_id: 'c1', chapter_title: '第一章', para: 3, text: 't', type: 'pos', updated_at: 1 }],
    configRow: { value: 'cookie-here' },
  });
  const lb2 = await (await call('/api/last-book', { headers: AUTH })).json();
  check(lb2 && lb2.id === 'B1' && lb2.title === '第一章', '/api/last-book 回最新一本', JSON.stringify(lb2).slice(0, 120));

  const pr2 = await (await call('/api/progress', { headers: AUTH })).json();
  check(pr2.ok && pr2.lastBook === 'B1' && pr2.books && pr2.books.B1 && pr2.books.B1.chapterId === 'c1',
    '/api/progress GET 同時回 progress[] 與 ui 的 books/lastBook', JSON.stringify(pr2).slice(0, 160));
  check(Array.isArray(pr2.progress) && pr2.progress[0] && pr2.progress[0].book_id === 'B1', '/api/progress 保留表格原始列（舊殼相容）');

  const mk2 = await (await call('/api/marks?book=B1', { headers: AUTH })).json();
  check(mk2.ok && mk2.marks.length === 1 && mk2.marks[0].bookId === 'B1' && mk2.marks[0].chapterId === 'c1',
    '/api/marks GET 給 camelCase（ui 讀得到）', JSON.stringify(mk2).slice(0, 160));

  const cfg2 = await (await call('/api/config', { headers: AUTH })).json();
  check(cfg2.loggedIn === true, '/api/config 有 cookie 時 loggedIn=true', String(cfg2.loggedIn));

  /* ── 報告 ── */
  const fails = results.filter((r) => !r.pass).length;
  console.log('\n===== 鏡像站路由（worker.fetch，未 deploy） =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);

  fs.writeFileSync(path.join(OUT, 'mirror-routes.json'), JSON.stringify({
    at: new Date().toISOString(),
    pass: fails === 0,
    total: results.length,
    fails,
    results,
  }, null, 2), 'utf8');
  console.log('報告：_probe/mirror-routes.json');
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ 測試本身炸了：', e && e.stack || e);
  process.exit(2);
});
