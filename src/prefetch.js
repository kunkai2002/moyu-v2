'use strict';

/* 整本快取：背景逐章抓，寫進 data/chapters
   ─────────────────────────────────────────────────────────────
   一次只跑一本；已快取（非預覽）的章節會跳過。
   ══════════════════════════════════════════════════════════════ */

const path = require('path');
const fanqie = require('./fanqie');
const store = require('./store');

let job = null;   // { bookId, total, done, errors, running, startedAt, finishedAt }

function status() { return job; }

function stop() {
  if (job && job.running) { job.running = false; job.stopped = true; }
  return status();
}

/**
 * @param {string} dataDir
 * @param {{id:string, chapters:Array}} book
 * @param {string} cookie
 */
function start(dataDir, book, cookie) {
  if (job && job.running) throw new Error('已經有一個下載任務在跑');
  const chapters = book.chapters || [];
  if (!chapters.length) throw new Error('這本書沒有章節');

  job = {
    bookId: book.id,
    title: book.title || '',
    total: chapters.length,
    done: 0,
    skipped: 0,
    errors: 0,
    running: true,
    startedAt: Date.now(),
    finishedAt: 0,
  };

  const dir = path.join(dataDir, 'chapters');

  (async () => {
    for (const c of chapters) {
      if (!job.running) break;
      const file = path.join(dir, `${c.id}.json`);
      const cached = store.readJson(file, null);
      if (cached && !cached.previewOnly) { job.skipped++; job.done++; continue; }
      try {
        const r = await fanqie.loadChapter(book.id, c.id, cookie);
        store.writeJson(file, r);
        if (r.previewOnly) job.errors++;
      } catch {
        job.errors++;
      }
      job.done++;
      // 溫和一點，不連發
      await new Promise((res) => setTimeout(res, 250));
    }
    job.running = false;
    job.finishedAt = Date.now();
  })().catch(() => { job.running = false; });

  return status();
}

module.exports = { start, status, stop };
