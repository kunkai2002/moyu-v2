/* 多書切換：最近開啟的書單，一鍵換書（進度各自獨立保存） */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const D = window.__moyuDebug;
  if (!D) return;

  const KEY = 'moyu.recent';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20))); } catch {} };

  /* 包一層 openBook，記下開過的書 */
  const origOpen = D.openBook;
  if (typeof origOpen === 'function' && !origOpen.__wrapped) {
    const wrapped = async function (input) {
      const r = await origOpen.call(this, input);
      const book = D.state.book;
      if (book && book.id) {
        const list = load().filter((x) => x.id !== book.id);
        list.unshift({ id: book.id, title: book.title, at: Date.now() });
        save(list);
      }
      return r;
    };
    wrapped.__wrapped = true;
    D.openBook = wrapped;
  }

  // 最近/歷史的 UI 已由 shell.js 的歷史抽屜接手，這裡只負責記下開過的書
})();
