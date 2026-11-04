/* 書籤 / 劃線 / 筆記
   點段落 = 劃線（再點取消）；頂欄「標記」開啟清單；可寫筆記。 */
(function () {
  'use strict';
  const D = window.__moyuDebug;
  const B = window.moyu;
  const $ = (s) => document.querySelector(s);
  if (!D || !B) return;

  const st = D.state;
  let marks = [];
  let noteTarget = null;

  /* ── 樣式 ── */
  const css = document.createElement('style');
  css.textContent = `
  .p{cursor:text}
  .p.marked{background:var(--hl,#33291c);box-shadow:0 0 0 3px var(--hl,#33291c);border-radius:2px}
  .p.marked::selection{background:transparent}
  .mk-note{display:block;font-size:11.5px;color:var(--acc2);border-left:2px solid var(--acc2);
    padding:1px 0 1px 8px;margin-top:4px;font-style:normal}
  .marks-panel{position:absolute;right:18px;top:44px;bottom:34px;width:360px;z-index:45;
    background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;
    box-shadow:0 18px 50px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden}
  .marks-panel[hidden]{display:none}
  .mk-row{display:flex;flex-direction:column;gap:2px;padding:7px 8px;border-radius:5px;cursor:pointer;
    border-bottom:1px solid var(--line);font-size:12px}
  .mk-row:hover{background:var(--sel)}
  .mk-row .m-t{color:var(--acc2);font-size:11px}
  .mk-row .m-x{color:var(--fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mk-row .m-n{color:var(--fg3);font-size:10.5px}
  .mk-empty{padding:14px;color:var(--fg3);font-size:12px;text-align:center}
  .note-box{padding:8px 12px;border-top:1px solid var(--line);display:flex;gap:6px}
  .note-box input{flex:1;background:var(--bg);border:1px solid var(--line-strong);border-radius:5px;
    color:var(--fg);font:inherit;font-size:12px;padding:5px 7px;outline:0}
  .note-box button{border:1px solid var(--line-strong);background:var(--bg);color:var(--fg2);
    border-radius:5px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer}
  .note-box button:hover{background:var(--sel);color:var(--fg)}
  `;
  document.head.appendChild(css);

  /* ── 面板 ── */
  const panel = document.createElement('div');
  panel.className = 'marks-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="panel-head"><b>標記</b>
      <button class="ghost icon" id="mkClose"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2"/></svg></button>
    </div>
    <div class="panel-body" id="mkList" style="flex:1;overflow:auto"></div>
    <div class="note-box" id="mkNoteBox" hidden>
      <input id="mkNoteIn" placeholder="寫一句筆記…" spellcheck="false">
      <button id="mkNoteSave">存</button>
    </div>`;
  document.querySelector('.main')?.appendChild(panel);

  const listEl = panel.querySelector('#mkList');
  const noteBox = panel.querySelector('#mkNoteBox');
  const noteIn = panel.querySelector('#mkNoteIn');

  /* ── 頂欄「標記」按鈕 ── */
  async function toggleMarks() {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) await load();
  }
  window.__moyuMarksPanel = { toggle: toggleMarks, panel };

  const bar = $('.topbar-r');
  if (bar) {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.textContent = '標記';
    btn.title = '書籤 / 劃線 / 筆記';
    btn.addEventListener('click', toggleMarks);
    bar.insertBefore(btn, bar.firstChild);
  }
  panel.querySelector('#mkClose').addEventListener('click', () => { panel.hidden = true; });

  /* ── 讀寫 ── */
  async function load() {
    if (!st.book) { listEl.innerHTML = '<div class="mk-empty">先開一本書</div>'; return; }
    try {
      const r = await B.marks.list(st.book.id);
      marks = r.marks || [];
    } catch { marks = []; }
    paint();
  }

  function paint() {
    const chs = st.chapters || [];
    const order = (m) => {
      const i = chs.findIndex((c) => c.id === m.chapterId);
      return (i < 0 ? 9999 : i) * 1000 + (m.para || 0);
    };
    const list = [...marks].sort((a, b) => order(a) - order(b));
    if (!list.length) { listEl.innerHTML = '<div class="mk-empty">還沒有標記。點段落就能劃線。</div>'; return; }
    listEl.innerHTML = '';
    for (const m of list) {
      const row = document.createElement('div');
      row.className = 'mk-row';
      row.innerHTML = `<span class="m-t">${esc(m.chapterTitle || '')} ${m.type === 'bookmark' ? '· 書籤' : (m.type === 'pos' ? '· 位置' : '')}</span>
        <span class="m-x">${esc(m.text || '')}</span>
        ${m.note ? `<span class="m-n">✎ ${esc(m.note)}</span>` : ''}`;
      row.addEventListener('click', () => {
        const i = (st.chapters || []).findIndex((c) => c.id === m.chapterId);
        if (i >= 0) { panel.hidden = true; D.goChapter(i); }
      });
      row.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        await B.marks.remove(m.bookId, m.id);
        await load();
      });
      listEl.appendChild(row);
    }
  }

  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ── 點段落 → 劃線 ── */
  /* 回傳這一頁段落的標記資訊 */
  function paraInfo(p) {
    if (!p || !st.book || !st.chapters?.length) return null;
    const box = p.closest('.pb') || p.parentElement;
    if (!box) return null;
    // 段落在「整章」裡的第幾段：切段之後 DOM 位置會重排，但 data-pi 不會
    const all = [...box.querySelectorAll('.p')];
    let idx = p.dataset.pi !== undefined ? Number(p.dataset.pi) : all.indexOf(p);
    if (!Number.isFinite(idx) || idx < 0) idx = all.indexOf(p);
    if (idx < 0) return null;
    const chId = box.dataset.chapter || '';
    const ci = Number(box.dataset.ci);
    const ch = (Number.isFinite(ci) && st.chapters[ci]) ? st.chapters[ci] : st.chapters[st.index];
    if (!ch) return null;
    return {
      chapterId: chId || ch.id, chapterTitle: ch.title, para: idx,
      text: (p.textContent || '').slice(0, 80), type: 'highlight',
      id: (chId || ch.id) + '-' + idx + '-highlight',
    };
  }

  async function togglePara(p) {
    const info = paraInfo(p);
    if (!info) return false;
    if (p.classList.contains('marked')) {
      p.classList.remove('marked');
      await B.marks.remove(st.book.id, info.id);
      return false;
    }
    p.classList.add('marked');
    noteTarget = info;
    await B.marks.save({ ...info, bookId: st.book.id });
    return true;
  }

  async function notePara(p) {
    const info = paraInfo(p);
    if (!info) return false;
    if (!p.classList.contains('marked')) await togglePara(p);
    noteTarget = info;
    noteBox.hidden = false;
    noteIn.focus();
    return true;
  }

  /* 段落「點一下就選取／劃線」在 2026-11-04 拿掉了（JOJO：完全沒用）。
     劃線、筆記一律走右鍵選單，正文就是純文字，點它不會有任何反應。 */

  window.__moyuMarks = {
    toggle: togglePara,
    note: notePara,
    isMarked: (el) => !!el && el.classList.contains('marked'),
    has: () => marks.length,
  };

  panel.querySelector('#mkNoteSave').addEventListener('click', async () => {
    const v = noteIn.value.trim();
    if (!noteTarget || !v) { noteBox.hidden = true; noteIn.value = ''; return; }
    await B.marks.save({ ...noteTarget, bookId: st.book.id, note: v });
    noteIn.value = '';
    noteBox.hidden = true;
    await load();
  });

  /* 開啟時若已有標記，補上樣式
     一章現在會切成好幾段 .pb，所以：①每一段看自己的 data-chapter
     ②段落在整章的第幾段看 data-pi（不是它在這一段裡的第幾個） */
  const obs = new MutationObserver(() => {
    if (!marks.length || !st.chapters?.length) return;
    document.querySelectorAll('#stream .pb').forEach((box) => {
      const chId = box.dataset.chapter || '';
      if (!chId) return;
      const ps = [...box.querySelectorAll('.p')];
      ps.forEach((p, i) => {
        const pi = p.dataset.pi !== undefined ? Number(p.dataset.pi) : i;
        const has = marks.some((m) => m.chapterId === chId && Number(m.para) === pi);
        p.classList.toggle('marked', has);
      });
    });
  });
  const stream = $('#stream');
  if (stream) obs.observe(stream, { childList: true, subtree: true });

  D.loadMarks = load;
})();
