// 右鍵選單整合：記住進度 / 劃線 / 筆記 / 複製 / 搜尋
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── main.js：純文字複製 ─────────────────────────────────── */
{
  const f = p('main.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes("clipboard:plain")) {
    must(s, "  ipcMain.handle('clipboard:write', (_e, text) => {", 'clipboard write');
    s = s.replace(
      "  ipcMain.handle('clipboard:write', (_e, text) => {",
      "  ipcMain.handle('clipboard:plain', (_e, text) => {\n"
      + "    clipboard.writeText(String(text == null ? '' : text));\n"
      + "    return true;\n"
      + "  });\n\n"
      + "  ipcMain.handle('clipboard:write', (_e, text) => {"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('main.js ok');
  } else console.log('main.js 已有 clipboard:plain');
}

/* ── preload.js ──────────────────────────────────────────── */
{
  const f = p('ui/preload.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('copyPlain')) {
    must(s, "  copy: (text) => ipcRenderer.invoke('clipboard:write', text),", 'preload copy');
    s = s.replace(
      "  copy: (text) => ipcRenderer.invoke('clipboard:write', text),",
      "  copy: (text) => ipcRenderer.invoke('clipboard:write', text),\n"
      + "  copyPlain: (text) => ipcRenderer.invoke('clipboard:plain', text),"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('preload.js ok');
  } else console.log('preload.js 已有 copyPlain');
}

/* ── icons.js：copy ──────────────────────────────────────── */
{
  const f = p('ui/icons.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('copy:')) {
    must(s, "    close:   '<path", 'icons close');
    s = s.replace(
      "    close:   '<path",
      "    copy:    '<rect x=\"8.6\" y=\"8.6\" width=\"10.2\" height=\"10.2\" rx=\"1.6\"/><path d=\"M15.4 5.6H6.6a1.4 1.4 0 0 0-1.4 1.4v8.6\"/>',\n"
      + "    close:   '<path"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('icons.js ok');
  } else console.log('icons.js 已有 copy');
}

/* ── app.js：把 searchInBook 暴露出去 ────────────────────── */
{
  const f = p('ui/app.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('searchInBook,')) {
    must(s, "window.__moyuDebug = {", 'debug exports');
    s = s.replace("window.__moyuDebug = {", "window.__moyuDebug = {\n  searchInBook,");
    fs.writeFileSync(f, s, 'utf8');
    console.log('app.js ok');
  } else console.log('app.js 已有 searchInBook');
}

/* ── wiring4.js：抽出 toggle / note，對外暴露 ────────────── */
{
  const f = p('ui/wiring4.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('__moyuMarks')) {
    const oldClick = `  document.addEventListener('click', async (e) => {
    const p = e.target.closest?.('#stream .p');
    if (!p || !st.book || !st.chapters?.length) return;
    const ch = st.chapters[st.index];
    if (!ch) return;
    const box = p.closest('.pb') || p.parentElement;
    if (!box) return;
    const all = [...box.querySelectorAll('.p')];
    const idx = all.indexOf(p);
    if (idx < 0) return;

    const text = (p.textContent || '').slice(0, 80);
    const id = ch.id + '-' + idx + '-highlight';

    if (p.classList.contains('marked')) {
      p.classList.remove('marked');
      await B.marks.remove(st.book.id, id);
    } else {
      p.classList.add('marked');
      noteTarget = { chapterId: ch.id, chapterTitle: ch.title, para: idx, text, type: 'highlight' };
      await B.marks.save({ ...noteTarget, bookId: st.book.id });
      // 連點第二次（同一段已標記狀態）才開筆記
      noteBox.hidden = false;
      noteIn.focus();
    }
  });`;

    must(s, oldClick, 'wiring4 click block');

    const newClick = `  /* 回傳這一頁段落的標記資訊 */
  function paraInfo(p) {
    if (!p || !st.book || !st.chapters?.length) return null;
    const ch = st.chapters[st.index];
    if (!ch) return null;
    const box = p.closest('.pb') || p.parentElement;
    if (!box) return null;
    const all = [...box.querySelectorAll('.p')];
    const idx = all.indexOf(p);
    if (idx < 0) return null;
    return {
      chapterId: ch.id, chapterTitle: ch.title, para: idx,
      text: (p.textContent || '').slice(0, 80), type: 'highlight',
      id: ch.id + '-' + idx + '-highlight',
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

  document.addEventListener('click', async (e) => {
    const p = e.target.closest?.('#stream .p');
    if (!p) return;
    const markedNow = await togglePara(p);
    // 新劃線就順手開筆記欄，取消劃線時收起來
    if (markedNow) { noteBox.hidden = false; noteIn.focus(); }
    else { noteBox.hidden = true; }
  });

  window.__moyuMarks = {
    toggle: togglePara,
    note: notePara,
    isMarked: (el) => !!el && el.classList.contains('marked'),
    has: () => marks.length,
  };`;

    s = s.replace(oldClick, newClick);
    fs.writeFileSync(f, s, 'utf8');
    console.log('wiring4.js ok');
  } else console.log('wiring4.js 已有 __moyuMarks');
}
