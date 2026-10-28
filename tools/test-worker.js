// 手機版後端驗證：靜態頁、設定 cookie、書架、開書、章節、進度、標記
const fs = require('fs');
const path = require('path');

const BASE = 'https://moyu-sync.qiaoyuhua2002.workers.dev';
const TOKEN = fs.readFileSync(path.join(__dirname, '..', 'sync', '.token'), 'utf8').trim();
const COOKIE = fs.readFileSync(path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data', 'cookie.txt'), 'utf8').trim();

const results = [];
const ok = (n, e = '') => results.push({ pass: true, n, e });
const bad = (n, e = '') => results.push({ pass: false, n, e });

const auth = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

(async () => {
  /* 1. 健康 */
  const h = await (await fetch(BASE + '/health')).json();
  h.ok ? ok('後端：/health 正常') : bad('後端：/health 失敗', JSON.stringify(h));

  /* 2. 手機頁 */
  const page = await fetch(BASE + '/m/');
  const html = await page.text();
  page.status === 200 && html.includes('魔芋一夏') ? ok(`手機頁：/m/ 200（${(html.length / 1024).toFixed(1)} KB）`) : bad('手機頁：打不開', String(page.status));
  for (const asset of ['/m/app.js', '/m/app.css', '/m/manifest.webmanifest', '/m/icon.svg']) {
    const r = await fetch(BASE + asset);
    r.status === 200 ? ok(`靜態：${asset} 200`) : bad(`靜態：${asset} ${r.status}`);
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
