/* 整本下載：頂欄按鈕 + 進度條 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const B = window.moyu;
  const D = window.__moyuDebug;
  if (!B?.prefetch || !D) return;

  const bar = $('.topbar-r');
  if (!bar) return;

  const btn = document.createElement('button');
  btn.className = 'pill';
  btn.textContent = '整本下載';
  btn.title = '把整本書抓成本機快取，斷網也能讀';
  bar.insertBefore(btn, bar.firstChild);

  const prog = document.createElement('span');
  prog.className = 'pill';
  prog.hidden = true;
  prog.style.cursor = 'pointer';
  prog.title = '點一下停止';
  bar.insertBefore(prog, btn.nextSibling);

  let timer = null;

  function paint(job) {
    if (!job) { prog.hidden = true; return; }
    prog.hidden = false;
    const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
    prog.textContent = job.running
      ? `↓ ${pct}%（${job.done}/${job.total}）`
      : `✓ 已快取 ${job.done - job.errors}/${job.total}${job.errors ? ` · 失敗 ${job.errors}` : ''}`;
    prog.style.color = job.running ? 'var(--acc2)' : (job.errors ? 'var(--acc)' : 'var(--ok)');
  }

  async function poll() {
    try {
      const r = await B.prefetch.status();
      paint(r.job);
      if (r.job?.running) return;
      clearInterval(timer); timer = null;
    } catch { /* 忽略 */ }
  }

  btn.addEventListener('click', async () => {
    const book = D.state.book;
    if (!book) {
      const b = D.openShelf ? D.openShelf() : null;
      return;
    }
    btn.textContent = '啟動中…';
    try {
      const r = await B.prefetch.start(book.id);
      if (!r.ok) { btn.textContent = '整本下載'; alert(r.error || '啟動失敗'); return; }
      paint(r.job);
      btn.textContent = '下載中…';
      clearInterval(timer);
      timer = setInterval(poll, 1200);
    } catch (e) {
      btn.textContent = '整本下載';
      alert(e.message);
    }
  });

  prog.addEventListener('click', async () => {
    if (!timer) return;
    await B.prefetch.stop();
    await poll();
    btn.textContent = '整本下載';
  });

  // 開程式時若有殘留任務，接上進度
  poll();
})();
