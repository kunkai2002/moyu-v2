// 用桌機本機進度「強制」覆蓋雲端，救回被手機蓋掉的位置
const fs = require('fs');
const path = require('path');
const BASE = 'https://moyu-sync.qiaoyuhua2002.workers.dev';
const TOKEN = fs.readFileSync(path.join(__dirname, '..', 'sync', '.token'), 'utf8').trim();
const DATA = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');

(async () => {
  const progFile = path.join(DATA, 'progress.json');
  if (!fs.existsSync(progFile)) { console.log('找不到本機 progress.json'); return; }
  const local = JSON.parse(fs.readFileSync(progFile, 'utf8'));
  const books = local.books || {};

  const progress = Object.entries(books).map(([bookId, v]) => ({
    book_id: bookId,
    chapter_id: v.chapterId || '',
    chapter_no: v.chapterNo || '',
    title: v.title || '',
    updated_at: Number(v.updated) || Date.now(),
  }));
  if (!progress.length) { console.log('本機沒有進度可推'); return; }

  const r = await fetch(BASE + '/push', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device: 'dev-4d4034b6', progress, marks: [], deletedMarks: [], force: true }),
  });
  console.log('force push:', await r.text());

  const after = await (await fetch(BASE + '/api/progress', {
    headers: { Authorization: 'Bearer ' + TOKEN },
  })).json();
  for (const p of after.progress || []) {
    console.log(`  ${p.book_id}  ch=${p.chapter_no}  ${(p.title || '').slice(0, 20)}  device=${p.device}`);
  }
})();
