// 後端驗證：健康、鏡像站靜態頁（新舊殼自動偵測）、權限、書架、開書、章節、進度、標記、同步
//
//   node tools/test-worker.js
//
// 鏡像站現在應該送「桌面版同一份 ui/」：/m/、/staging/m/ 的 html/css/js
// 要跟本機 ui/ 的檔案逐位元組相同（不是「有內容就好」）。
// 雲端還沒 deploy 新殼時（/m/ 還是舊 sync/m/），自動退回驗舊殼的檔名，
// 這樣在部署前後都驗得到，而且強度不降：新殼一律比位元組。
const fs = require('fs');
const path = require('path');

const BASE = 'https://moyu-sync.qiaoyuhua2002.workers.dev';
const TOKEN = fs.readFileSync(path.join(__dirname, '..', 'sync', '.token'), 'utf8').trim();
const COOKIE = fs.readFileSync(path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data', 'cookie.txt'), 'utf8').trim();
const UI = path.join(__dirname, '..', 'ui');

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });

const auth = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

const expectType = (rel) =>
  rel.endsWith('.css') ? 'text/css; charset=utf-8'
    : rel.endsWith('.js') ? 'text/javascript; charset=utf-8'
      : rel.endsWith('.html') ? 'text/html; charset=utf-8'
        : rel.endsWith('.svg') ? 'image/svg+xml'
          : rel.endsWith('.webmanifest') ? 'application/manifest+json; charset=utf-8'
            : '';

/* 抓遠端一個檔，跟本機 ui/<rel> 比位元組 */
async function sameAsUi(url, rel) {
  const r = await fetch(BASE + url);
  const buf = Buffer.from(await r.arrayBuffer());
  let want = null;
  try { want = fs.readFileSync(path.join(UI, rel)); } catch {}
  const type = r.headers.get('content-type') || '';
  const wantType = expectType(rel);
  return {
    status: r.status,
    type,
    same: !!want && buf.equals(want),
    typeOk: !wantType || type === wantType,
    size: buf.length,
    wantSize: want ? want.length : -1,
  };
}

(async () => {
  /* 1. 健康 */
  const h = await (await fetch(BASE + '/health')).json();
  h.ok ? ok('後端：/health 正常') : bad('後端：/health 失敗', JSON.stringify(h));

  /* 2. 鏡像站首頁：偵測新殼（bridge-http.js / dsh-tokens.css）還是舊手機殼 */
  const page = await fetch(BASE + '/m/');
  const html = await page.text();
  const isNew = /bridge-http\.js|dsh-tokens\.css/.test(html);
  const htmlType = page.headers.get('content-type') || '';

  if (isNew) {
    ok(`鏡像站：新殼（/m/ ${(html.length / 1024).toFixed(1)} KB，${htmlType}）`);
    page.status === 200 && htmlType.startsWith('text/html') ? ok('靜態：/m/ 200 + text/html') : bad('靜態：/m/ 回應不對', `${page.status} ${htmlType}`);

    /* 新殼的核心檔：200 + Content-Type + 逐位元組等於 ui/ */
    for (const rel of ['index.html', 'theme.css', 'dsh-tokens.css', 'shell-dsh.js', 'bridge-http.js', 'app.js']) {
      const r = await sameAsUi('/m/' + rel, rel);
      r.status === 200 && r.same && r.typeOk
        ? ok(`靜態：/m/${rel} 200 · ${r.type} · 與 ui/ 相同（${(r.size / 1024).toFixed(1)} KB）`)
        : bad(`靜態：/m/${rel} 不合格`, `status ${r.status} type ${r.type} same=${r.same} ${r.size}/${r.wantSize}`);
    }

    /* index.html 引用的每一個本地檔都要能抓、且跟 ui/ 一樣（漏檔上線才發現就太晚） */
    const refs = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)]
      .map((m) => m[1].trim())
      .filter((v) => v && !/^(?:[a-z]+:|\/\/|#|data:)/i.test(v))
      .map((v) => v.replace(/^\.\//, '').split(/[?#]/)[0]);
    let refBad = 0;
    for (const rel of refs) {
      const r = await sameAsUi('/m/' + rel, rel);
      if (!(r.status === 200 && r.same && r.typeOk)) { refBad++; bad(`靜態：/m/${rel} 不合格`, `${r.status} ${r.type} same=${r.same}`); }
    }
    if (!refBad) ok(`靜態：首頁引用 ${refs.length} 檔全部 200 且與 ui/ 相同`);

    /* staging 掛同一份（兩邊永遠一致） */
    for (const rel of ['index.html', 'dsh-tokens.css']) {
      const r = await sameAsUi('/staging/m/' + rel, rel);
      r.status === 200 && r.same && r.typeOk
        ? ok(`靜態：/staging/m/${rel} 與 ui/ 相同`)
        : bad(`靜態：/staging/m/${rel} 不合格`, `${r.status} ${r.type} same=${r.same}`);
    }

    /* 舊手機殼已經沒有路由：這些檔不該再從 /m/ 出來 */
    const old = await fetch(BASE + '/m/app.css');
    old.status === 404 ? ok('舊殼：/m/app.css 404（sync/m/ 已停用、不再被路由）') : bad('舊殼：/m/app.css 還在供應', String(old.status));
  } else {
    ok('鏡像站：舊殼（雲端還沒 deploy 新 ui/，先驗舊檔名）');
    page.status === 200 && html.includes('魔芋一夏') ? ok(`手機頁：/m/ 200（${(html.length / 1024).toFixed(1)} KB）`) : bad('手機頁：打不開', String(page.status));
    for (const asset of ['/m/app.js', '/m/app.css', '/m/manifest.webmanifest', '/m/icon.svg']) {
      const r = await fetch(BASE + asset);
      r.status === 200 ? ok(`靜態：${asset} 200`) : bad(`靜態：${asset} ${r.status}`);
    }
  }

  /* 3. 未授權要被擋 */
  const noauth = await fetch(BASE + '/api/shelf');
  noauth.status === 401 ? ok('權限：沒金鑰時 401') : bad('權限：沒擋住', String(noauth.status));

  /* 4. 設定 cookie */
  const setup = await (await fetch(BASE + '/setup', {
    method: 'POST', headers: auth, body: JSON.stringify({ cookie: COOKIE }),
  })).json();
  setup.ok ? ok('設定：cookie 已寫入雲端') : bad('設定：寫入失敗', JSON.stringify(setup));

  /* 5. 書架 */
  const shelf = await (await fetch(BASE + '/api/shelf', { headers: auth })).json();
  shelf.ok && shelf.books.length ? ok(`書架：${shelf.books.length} 本`) : bad('書架：讀不到', JSON.stringify(shelf).slice(0, 120));

  /* 6. 開書 */
  const bookId = '7373660003258862617';
  const opened = await (await fetch(`${BASE}/api/open?input=${bookId}`, { headers: auth })).json();
  const chapters = opened.book && opened.book.chapters ? opened.book.chapters.length : 0;
  chapters > 100 ? ok(`開書：《${opened.book.title}》${chapters} 章`) : bad('開書：目錄異常', JSON.stringify(opened).slice(0, 120));

  /* 7. 章節 */
  let chars = 0;
  if (chapters) {
    const c = opened.book.chapters[0];
    const one = await (await fetch(`${BASE}/api/chapter?book=${bookId}&id=${c.id}`, { headers: auth })).json();
    chars = (one.paragraphs || []).join('').length;
    chars > 500 ? ok(`章節：第 1 章 ${chars} 字`) : bad('章節：內容太少', String(chars));
  }

  /* 8. 進度寫入 / 讀回 */
  const put = await (await fetch(BASE + '/api/progress', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ book_id: bookId, chapter_id: opened.book.chapters[0].id, chapter_no: '1', title: opened.book.chapters[0].title }),
  })).json();
  put.ok ? ok('進度：寫入成功') : bad('進度：寫入失敗', JSON.stringify(put));
  const prog = await (await fetch(BASE + '/api/progress', { headers: auth })).json();
  const hit = (prog.progress || []).some((p) => p.book_id === bookId && p.device === 'phone');
  hit ? ok(`進度：讀回 ${prog.progress.length} 筆（含手機寫的那筆）`) : bad('進度：讀不到剛寫的');

  /* 9. 標記 */
  const mark = await (await fetch(BASE + '/api/marks', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ book_id: bookId, chapter_id: opened.book.chapters[0].id, para: 3, text: '測試劃線', type: 'highlight' }),
  })).json();
  mark.ok ? ok('標記：寫入成功') : bad('標記：寫入失敗', JSON.stringify(mark));
  const marks = await (await fetch(`${BASE}/api/marks?book=${bookId}`, { headers: auth })).json();
  (marks.marks || []).length ? ok(`標記：讀回 ${marks.marks.length} 筆`) : bad('標記：讀不到');

  /* 10. 桌面 /push /pull 仍可用 */
  const pull = await (await fetch(BASE + '/pull?since=0', { headers: auth })).json();
  pull.ok ? ok(`同步：/pull 正常（進度 ${(pull.progress || []).length} / 標記 ${(pull.marks || []).length}）`) : bad('同步：/pull 失敗');

  console.log('\n===== 手機版後端 =====');
  for (const r of results) console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.e ? '  → ' + r.e : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? '✅ 全部通過' : `❌ ${fails} 項失敗`} (${results.length} 項)`);
  process.exit(fails === 0 ? 0 : 1);
})();
