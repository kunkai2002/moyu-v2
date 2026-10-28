// 查：雲端進度裡的 chapter_id 是否出現在章節表裡（手機續讀失敗的根因）
const fs = require('fs');
const path = require('path');
const BASE = 'https://moyu-sync.qiaoyuhua2002.workers.dev';
const TOKEN = fs.readFileSync(path.join(__dirname, '..', 'sync', '.token'), 'utf8').trim();
const auth = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

(async () => {
  const prog = await (await fetch(BASE + '/api/progress', { headers: auth })).json();
  console.log('雲端進度筆數:', (prog.progress || []).length);
  for (const p of prog.progress || []) {
    console.log(`  ${p.book_id}  ch=${p.chapter_no}  title=${(p.title || '').slice(0, 18)}  id=${p.chapter_id}  device=${p.device}`);
  }

  /* 拿一本真實書的目錄來比對 */
  const rows = (prog.progress || []).filter((p) => p.chapter_id && p.chapter_id !== '0');
  const target = rows[0];
  if (!target) { console.log('沒有可比的進度'); return; }

  const opened = await (await fetch(`${BASE}/api/open?input=${target.book_id}`, { headers: auth })).json();
  const chapters = opened.book?.chapters || [];
  console.log(`\n書《${opened.book?.title}》章節數 ${chapters.length}`);
  const idx = chapters.findIndex((c) => c.id === target.chapter_id);
  console.log('用 chapter_id 找索引 →', idx, idx >= 0 ? `(第 ${chapters[idx].no} 章)` : '❌ 找不到');
  const byNo = chapters.findIndex((c) => String(c.no) === String(target.chapter_no));
  console.log('用 chapter_no 找索引 →', byNo, byNo >= 0 ? `(${chapters[byNo].title})` : '❌ 找不到');
  if (chapters.length) {
    console.log('目錄前 3 個 id:', chapters.slice(0, 3).map((c) => c.id).join(', '));
    console.log('進度 chapter_id  :', target.chapter_id);
  }
})();
