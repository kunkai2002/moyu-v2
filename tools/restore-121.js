// 把「十日终焉」的位置停回第 121 章（使用者在 13:42 真正讀到的地方）
const fs = require('fs');
const path = require('path');
const BASE = 'https://moyu-sync.qiaoyuhua2002.workers.dev';
const TOKEN = fs.readFileSync(path.join(__dirname, '..', 'sync', '.token'), 'utf8').trim();
const DATA = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');
const BOOK = '7143038691944959011';
const TARGET = { id: '7195932558943584823', no: '121', title: '第121章 闯入者' };

(async () => {
  /* 1. 本機 progress.json */
  const pFile = path.join(DATA, 'progress.json');
  const prog = fs.existsSync(pFile) ? JSON.parse(fs.readFileSync(pFile, 'utf8')) : { books: {} };
  prog.books = prog.books || {};
  prog.books[BOOK] = {
    chapterId: TARGET.id, chapterNo: TARGET.no, title: TARGET.title, updated: Date.now(),
  };
  fs.writeFileSync(pFile, JSON.stringify(prog, null, 1), 'utf8');
  console.log('本機：已寫回第 121 章');

  /* 2. 雲端（force） */
  const r = await fetch(BASE + '/push', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device: 'dev-4d4034b6',
      progress: [{ book_id: BOOK, chapter_id: TARGET.id, chapter_no: TARGET.no, title: TARGET.title, updated_at: Date.now() }],
      marks: [], deletedMarks: [], force: true,
    }),
  });
  console.log('雲端 force push:', await r.text());

  const after = await (await fetch(BASE + '/api/progress', { headers: { Authorization: 'Bearer ' + TOKEN } })).json();
  for (const p of after.progress || []) {
    if (p.book_id === BOOK) console.log('雲端現在：', p.chapter_no, p.title);
  }
})();
