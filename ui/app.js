/* 魔芋一夏 · 介面邏輯
   ─────────────────────────────────────────────────────────────
   外殼（Electron main）給資料，這裡只負責畫成 Claude Code 的樣子。
   ══════════════════════════════════════════════════════════════ */

'use strict';

const had = (k) => typeof window[k] !== 'undefined';
const bridge = window.moyu || null;

/* 外殼：cc＝Claude Code 終端風、dsh＝DeepSeek Harness 風。
   這是「結構」不是「配色」：終端風沒有氣泡、用 > 和 ● 當角色行、段落之間插假 diff。 */
function currentShell() { return document.documentElement.getAttribute('data-shell') || 'dsh'; }
function applyShell(id) {
  document.documentElement.setAttribute('data-shell', id);
  try { localStorage.setItem('moyu.shell', id); } catch {}
}
try { const s0 = localStorage.getItem('moyu.shell'); if (s0 === 'cc' || s0 === 'dsh') applyShell(s0); } catch {}

const THEMES = [
  { id: 'claude-code', name: 'Claude Code', bg: '#1a1915', acc: '#d97757' },
  { id: 'claude', name: 'Claude 奶油白', bg: '#faf9f5', acc: '#c96442' },
  { id: 'vscode', name: 'VS Code', bg: '#1e1e1e', acc: '#007acc' },
  { id: 'excel', name: 'Excel 報表', bg: '#ffffff', acc: '#217346' },
  { id: 'terminal', name: '終端機綠', bg: '#04070a', acc: '#33ff99' },
  { id: 'word', name: 'Word 文件', bg: '#f4f4f4', acc: '#2b579a' },
  { id: 'dsh', name: 'DeepSeek Harness', bg: '#151517', acc: '#5686fe' },
  { id: 'dsh-light', name: 'DeepSeek Harness 淺色', bg: '#ffffff', acc: '#4176e6' },
];

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

const state = {
  config: { theme: 'claude-code', streamSpeed: 45, modelName: 'opus 4.5 · 中', bossKey: 'Alt+Q' },
  book: null,
  chapters: [],
  index: 0,
  progress: { books: {} },
  streaming: null,
  startedAt: 0,
  charsRead: 0,
  autoRead: false,
  slowRead: false,
};

/* ──────────────────────────────────────────────────────────────
   主題
   ────────────────────────────────────────────────────────────── */
function buildThemeMenu() {
  const list = $('#tmList');
  list.innerHTML = '';
  for (const t of THEMES) {
    const on = document.documentElement.dataset.theme === t.id;
    const item = el('div', 'tm-item' + (on ? ' on' : ''));
    item.innerHTML =
      `<span class="tm-sw" style="background:${t.bg}">
         <i style="background:${t.bg}"></i>
         <i class="half" style="background:${t.acc};left:auto;right:6px;width:38%"></i>
       </span>
       <span class="tm-name">${t.name}</span><span class="tm-check">✓</span>`;
    item.addEventListener('click', () => { setTheme(t.id); $('#themeMenu').classList.remove('open'); });
    list.appendChild(item);
  }
}

function setTheme(id) {
  // 隱身模式是 inline 色階，會蓋掉主題；換主題就代表使用者要回主題，先把隱身關掉
  try { if (window.__moyuGhost && window.__moyuGhost.state.on) window.__moyuGhost.set(false); } catch {}
  document.documentElement.dataset.theme = id;
  state.config.theme = id;
  try { localStorage.setItem('moyu.theme', id); } catch {}
  buildThemeMenu();
  bridge?.config.set({ theme: id });
}

/* ──────────────────────────────────────────────────────────────
   小工具
   ────────────────────────────────────────────────────────────── */
const fmtTime = (sec) => {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

function scrollBottom() {
  const s = $('#stream');
  s.scrollTop = s.scrollHeight;
}

function clearStream() { $('#stream').innerHTML = ''; }

function thread() {
  let t = $('#stream .thread');
  if (!t) { t = el('div', 'thread'); $('#stream').appendChild(t); }
  return t;
}

/* 一則使用者發言（對話氣泡，靠右、字少） */
function addUser(text) {
  const t = el('div', 'turn user');
  t.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  thread().appendChild(t);
  scrollBottom();
  return t;
}

/* 一則助手發言容器（左側，沒有泡泡、字多） */
function addAssistant() {
  const t = el('div', 'turn ai');
  t.innerHTML = `<div class="gutter">${markSvg(14)}</div>`;
  const b = el('div', 'b');
  t.appendChild(b);
  thread().appendChild(t);
  scrollBottom();
  return b;
}

/* 品牌記號（跟 App 圖示同一顆星） */
function markSvg(size) {
  return window.MOYU_ICONS ? window.MOYU_ICONS.svg('mark', size || 14) : '';
}

/* 把一章切成 1–3 段（0–2 個切點）
   規則：
   · 切在「段落之間」＝段落結尾本來就是句尾，所以一定按句子切
   · 段落本身不拆開，data-pi 的索引就不會亂（劃線、筆記、進度都靠它）
   · 每段至少 120 字，第一段不超過 65%，避免「一句話＋九成內容」 */
function planChapter(paras) {
  const n = paras.length;
  const total = paras.reduce((s, p) => s + p.length, 0);
  if (n < 5 || total < 900) return [{ from: 0, to: n }];

  const cuts = Math.random() < 0.5 ? 1 : 2;
  const targets = cuts === 1
    ? [0.44 + Math.random() * 0.18]
    : [0.3 + Math.random() * 0.14, 0.62 + Math.random() * 0.18];

  const bounds = [];
  let acc = 0;
  for (let i = 1; i < n; i++) {
    acc += paras[i - 1].length;
    bounds.push({ i, at: acc / total });
  }
  const picked = [];
  for (const t of targets) {
    const near = bounds
      .filter((b) => b.i > (picked[picked.length - 1] || 0) && b.i < n)
      .sort((a, b) => Math.abs(a.at - t) - Math.abs(b.at - t))[0];
    if (!near) continue;
    const charsBefore = paras.slice(0, near.i).join('').length;
    if (charsBefore < 120 || total - charsBefore < 120) continue;
    if (picked.includes(near.i)) continue;
    picked.push(near.i);
  }
  picked.sort((a, b) => a - b);

  const out = [];
  let from = 0;
  for (const i of picked) { out.push({ from, to: i }); from = i; }
  out.push({ from, to: n });
  return out;
}

function addError(msg) {
  const b = addAssistant();
  b.insertAdjacentHTML('beforeend',
    `<div class="tool" style="color:var(--acc)">${markSvg(12)} <span class="fn">error</span></div>
     <div class="toolres"><div class="ln"><span class="bar">⎿</span><div>${escapeHtml(msg)}</div></div></div>`);
  scrollBottom();
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ──────────────────────────────────────────────────────────────
   側欄
   ────────────────────────────────────────────────────────────── */
function renderTree() {
  const tree = $('#tree');
  tree.innerHTML = '';
  if (!state.chapters.length) {
    tree.appendChild(el('div', 'vol', '<span class="car">▾</span><span>向 Chat 開口</span>'));
    return;
  }
  tree.appendChild(el('div', 'vol', `<span class="car">▾</span><span>第一卷 · ${state.chapters.length} 章</span>`));
  state.chapters.forEach((c, i) => {
    const row = el('div', 'ch' + (i === state.index ? ' on' : '') + (i < state.index ? ' read' : ''));
    row.innerHTML = `<span class="no">${c.no}</span><span class="nm">${escapeHtml(c.title.replace(/^第\s*\d+\s*[章回节節]\s*/, '') || c.title)}</span>`;
    row.addEventListener('click', () => goChapter(i));
    tree.appendChild(row);
  });
  updateCrumb();
}

function updateCrumb() {
  const c = state.chapters[state.index];
  if (!c || !state.book) return;
  $('#crumb').innerHTML = `${escapeHtml(state.book.title)} / <b>${escapeHtml(c.title)}</b>`;
  const pos = `${c.no} / ${state.chapters.length}`;
  $('#sbChapter').textContent = pos;
  $('#meTxt').textContent = pos;
  $('#mePct').textContent = ((state.index + 1) / state.chapters.length * 100).toFixed(1) + '%';
}

/* ──────────────────────────────────────────────────────────────
   串流播放
   ────────────────────────────────────────────────────────────── */

/* 「分析中… → 已完成」的預置詞（假裝 AI 正在處理段落） */
const STEP_WORDS = [
  ['思考中…', '已完成思考'],
  ['分析中…', '已完成分析'],
  ['整理段落中…', '段落已整理'],
  ['比對上下文中…', '比對完成'],
];
let stepSeq = 0;

function addStepLine(container) {
  const pair = STEP_WORDS[stepSeq++ % STEP_WORDS.length];
  const line = el('div', 'step');
  line.dataset.step = pair[0];
  line.innerHTML = `<span class="st-ico"><span class="st-run"></span></span><span class="st-t">${pair[0]}</span>`;
  container.appendChild(line);
  // 看起來真的跑完了：0.9–2.1 秒後換成「已完成」
  const done = 900 + Math.random() * 1200;
  setTimeout(() => {
    if (!line.isConnected) return;
    line.classList.add('done');
    const ico = line.querySelector('.st-ico');
    if (ico) ico.innerHTML = window.MOYU_ICONS ? window.MOYU_ICONS.svg('check', 12) : '';
    const t = line.querySelector('.st-t');
    if (t) t.textContent = pair[1];
    line.dataset.step = pair[1];
  }, done);
  return line;
}

const FAKE_FILES = [
  ['src/gateway/report.ts', 'typescript'],
  ['src/routes/portal.ts', 'typescript'],
  ['src/lib/query.ts', 'typescript'],
  ['web/src/App.tsx', 'tsx'],
  ['web/src/api/client.ts', 'typescript'],
  ['scripts/build.mjs', 'javascript'],
];
const FAKE_DIFFS = [
  ['const rows = await db.query(SQL_REPORT, [month]);', 'const rows = await db.query(SQL_REPORT, [month, scope]);'],
  ['const total = rows.length;', 'const total = rows.reduce((s, r) => s + (r.amount || 0), 0);'],
  ['if (!ctx.user) return null;', 'if (!ctx.user || !canRead(ctx.user, scope)) return null;'],
  ['export default function App() {', 'export default function App({ children }: Props) {'],
];

/* 段落之間的一塊假 diff：看起來像剛改完檔案，其實是偽裝 */
function fakeDiff(n) {
  const [file] = FAKE_FILES[n % FAKE_FILES.length];
  const [minus, plus] = FAKE_DIFFS[n % FAKE_DIFFS.length];
  const box = el('div', 'cc-diff');
  box.innerHTML = `<div class="cc-dh"><span class="cc-dot"></span>updated ${file}</div>`
    + `<pre class="cc-db">`
    + `<span class="cc-ln">@@ -${140 + n},7 +${140 + n},9 @@</span>\n`
    + `<span class="cc-ctx">  export async function buildReport(ctx: Ctx) {</span>\n`
    + `<span class="cc-del">- ${minus.replace(/</g, '&lt;')}</span>\n`
    + `<span class="cc-add">+ ${plus.replace(/</g, '&lt;')}</span>\n`
    + `<span class="cc-ctx">  }</span></pre>`;
  return box;
}

function streamParagraphs(container, paras, onDone, piBase) {
  stopStreaming();
  const base = Number(piBase) || 0;
  // 預設一次畫完；只有開啟「慢讀」才逐字吐
  if (!state.slowRead) {
    let sinceStep = 0;
    let steps = 0;
    let gap = 4 + Math.floor(Math.random() * 2);
    paras.forEach((t, idx) => {
      const p = el('p', 'p', t);
      p.dataset.pi = String(base + idx);   // 全章第幾段（切段後仍然對得回原文）
      container.appendChild(p);
      sinceStep++;
      // 終端風：每 6 段插一塊假 diff（像剛改完檔案）
      if (currentShell() === 'cc' && (idx + 1) % 6 === 0 && idx < paras.length - 1) {
        container.appendChild(fakeDiff(idx + 1));
      }
      // 每 4–6 段插一列「分析中… → 已完成分析」
      if (sinceStep >= gap && steps < 4 && idx < paras.length - 1) {
        sinceStep = 0;
        steps++;
        gap = 4 + Math.floor(Math.random() * 3);
        addStepLine(container);
      }
    });
    // 一次畫完時整章已經在 DOM 裡；在這裡 scrollBottom() 就等於「打開一章直接看到最後一句」
    onDone && onDone();
    return;
  }

  const speed = Math.max(8, Number(state.config.streamSpeed) || 45); // 字/秒
  let pi = 0;
  let node = null;
  let buf = '';
  let charIdx = 0;

  const ink = el('span', 'ink');
  let last = performance.now();

  function tick(now) {
    const dt = Math.min(120, now - last) / 1000;
    last = now;
    const quota = Math.max(1, Math.round(speed * dt));

    for (let k = 0; k < quota; k++) {
      if (pi >= paras.length) { finish(); return; }
      const src = paras[pi];
      if (!node) {
        node = el('p', 'p');
        node.dataset.pi = String(base + pi);
        container.appendChild(node);
        buf = '';
        charIdx = 0;
        container.appendChild(ink);
      }
      if (charIdx < src.length) {
        buf += src[charIdx++];
        node.textContent = buf;
        state.charsRead++;
      } else {
        if (ink.parentNode) ink.remove();
        node = null;
        pi++;
        if (pi < paras.length) container.appendChild(el('p', 'p')).textContent = '';
        // 上一段收尾
        if (pi < paras.length && node === null) {
          // 先把空節點收回，等下一段重建
          const lastP = container.lastElementChild;
          if (lastP && lastP.classList.contains('p')) lastP.remove();
        }
      }
    }
    scrollBottom();
    state.streaming = requestAnimationFrame(tick);
  }

  function finish() {
    if (ink.parentNode) ink.remove();
    state.streaming = null;
    scrollBottom();
    onDone && onDone();
  }

  state.streaming = requestAnimationFrame(tick);
}

function stopStreaming() {
  if (state.streaming) { cancelAnimationFrame(state.streaming); state.streaming = null; }
}

/* ──────────────────────────────────────────────────────────────
   開書 / 讀章
   ────────────────────────────────────────────────────────────── */
async function openBook(input) {
  if (!bridge) return;
  clearStream();
  addUser(`開一本書：${input}`);
  const b = addAssistant();
  b.insertAdjacentHTML('beforeend',
    `<div class="tool">${markSvg(12)} <span class="fn">open_book</span>(<span class="fn">${escapeHtml(String(input).slice(0, 40))}</span>)</div>
     <div class="toolres"><div class="ln"><span class="bar">⎿</span><div>抓取書頁與目錄…</div></div></div>`);

  let r;
  try { r = await bridge.openBook(input); }
  catch (e) { b.remove(); addError(e.message || String(e)); return; }

  b.querySelector('.toolres').innerHTML =
    `<div class="ln"><span class="bar">⎿</span><div>${escapeHtml(r.book.title)}　·　${r.book.total} 章${
      r.book.author ? '　·　' + escapeHtml(r.book.author) : ''}</div></div>`;

  state.book = r.book;
  state.chapters = r.book.chapters;
  state.index = 0;

  $('#bookName').textContent = r.book.title;
  $('#sideCount').textContent = r.book.total;
  $('#av').textContent = [...r.book.title][0] || '書';
  $('#crumb').innerHTML = `${escapeHtml(r.book.title)} / <b>${escapeHtml(state.chapters[0].title)}</b>`;

  // 續讀（章節 id → 章號，兩層回退；兩層都對不上才回第 1 章）
  const saved = state.progress.books?.[r.book.id];
  let startIdx = 0;
  if (saved) {
    let i = state.chapters.findIndex((c) => c.id === saved.chapterId);
    if (i < 0 && saved.chapterNo != null) {
      i = state.chapters.findIndex((c) => String(c.no) === String(saved.chapterNo));
    }
    if (i >= 0) startIdx = i;
  }
  state.index = startIdx;

  renderTree();
  await goChapter(state.index, { announce: true });
}

async function goChapter(i, { announce = false, autoAppend = false } = {}) {
  if (!bridge || !state.book) return;
  const ch = state.chapters[i];
  if (!ch) return;
  state.index = i;
  renderTree();

  /* 章節＝使用者的氣泡（短），內容＝助手回覆（長） */
  addUser(ch.title);
  const pending = addAssistant();
  const pbody = el('div', 'pb');
  pbody.dataset.ci = String(i);
  pbody.dataset.chapter = ch.id;
  pbody.dataset.part = '0';
  pending.appendChild(pbody);
  pbody.innerHTML = '<div class="meta loading"><span class="dots"></span></div>';
  const pendingTurn = pending.parentElement;

  let r;
  try { r = await bridge.loadChapter(state.book.id, ch.id); }
  catch (e) {
    if (pendingTurn && pendingTurn.parentNode) pendingTurn.remove();
    addError(e.message || String(e));
    return;
  }
  if (pendingTurn && pendingTurn.parentNode) pendingTurn.remove();

  state.startedAt = Date.now();
  state.charsRead = 0;

  /* 一章切成 1–3 段，段與段之間插一句使用者的「繼續」 */
  const paras = r.paragraphs || [];
  const parts = planChapter(paras);
  const last = parts.length - 1;

  const firstBody = document.querySelector('.pb[data-ci="' + i + '"]');
  const finishAll = () => {
    const secs = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
    const lastBody = [...document.querySelectorAll('#stream .pb')].pop() || null;
    const meta = el('div', 'meta');
    const okIcon = window.MOYU_ICONS ? window.MOYU_ICONS.svg('check', 12) : '';
    meta.innerHTML = `<span class="ok">${okIcon}</span>`
      + `<span>${Number(r.chars || 0).toLocaleString()} tok</span>`
      + `<span class="sep">·</span><span>${fmtTime(secs)}</span>`;
    (lastBody || document.body).appendChild(meta);
    if (lastBody) lastBody.dataset.done = '1';

    $('#sbTime').textContent = `⏱ ${fmtTime(secs)}`;
    // 連讀自動接進來的章節還不算「你在讀」，進度交給捲動監看
    if (!autoAppend) saveProgress();

    if (state.autoRead) {
      const nx = state.chapters[i + 1];
      if (nx) setTimeout(() => { if (state.autoRead) goChapter(i + 1, { announce: true }); }, 1400);
    }
    if (lastBody) showReviews(lastBody);
  };

  if (r.previewOnly) {
    /* 只有試讀：照實講，但一樣是對話形式 */
    const b = addAssistant();
    const body = el('div', 'pb');
    body.dataset.ci = String(i);
    body.dataset.chapter = ch.id;
    b.appendChild(body);
    const note = el('div', 'meta');
    note.innerHTML = `<span class="warn">${markSvg(12)}</span><span>僅取到 ${Number(r.chars || 0).toLocaleString()} tok 試讀</span>`;
    body.appendChild(note);
    paras.forEach((para, idx) => {
      const d = el('div', 'p');
      d.dataset.pi = String(idx);
      d.textContent = para;
      body.appendChild(d);
    });
    body.dataset.done = '1';
    $('#sbChapter').textContent = spec(ch.no);
    updateCrumb();
    if (!autoAppend) saveProgress();
    return;
  }

  parts.forEach((part, k) => {
    if (k > 0) addUser('繼續');
    const b = addAssistant();
    const body = el('div', 'pb');
    body.dataset.ci = String(i);
    body.dataset.chapter = ch.id;
    body.dataset.part = String(k);
    b.appendChild(body);
    const slice = paras.slice(part.from, part.to);
    streamParagraphs(body, slice, k === last ? finishAll : null, part.from);
  });

  $('#sbChapter').textContent = spec(ch.no);
  updateCrumb();

  /* 主動開章（點下一章／目錄／回去讀）停在這一章開頭；連讀自動接的不動畫面：
     內容是往下長的，人留在原來的位置就是正確的閱讀位置。 */
  if (!autoAppend) {
    const stream = document.querySelector('#stream');
    const body0 = document.querySelector(`.pb[data-ci="${i}"]`);
    if (stream && body0) {
      const delta = body0.getBoundingClientRect().top - stream.getBoundingClientRect().top;
      stream.scrollTop = Math.max(0, stream.scrollTop + delta - 6);
    }
  }
}

/* 狀態列／側欄的章號寫法：像編輯器的位置，不像小說（3 / 614） */
function spec(no) {
  return `${no} / ${state.chapters.length}`;
}

/* 「你現在眼睛在哪一章」：視窗上緣往下 56px 那條探測線，最後一個越線的 .pb 就是答案。
   連讀一次接了三章，進度也只會記你真正在看的那一章。 */
function readingIndex() {
  if (!state.chapters.length) return state.index;
  const stream = document.querySelector('#stream');
  const bodies = [...document.querySelectorAll('#stream .pb')];
  if (!stream || !bodies.length) return state.index;
  const probe = stream.getBoundingClientRect().top + 56;
  let pick = null;
  for (const b of bodies) {
    if (!Number.isFinite(Number(b.dataset.ci))) continue;
    if (b.getBoundingClientRect().top <= probe) pick = b;
    else break;
  }
  if (!pick) {
    for (const b of bodies) {
      const i = Number(b.dataset.ci);
      if (Number.isFinite(i)) return i;
    }
    return state.index;
  }
  const i = Number(pick.dataset.ci);
  return Number.isFinite(i) ? i : state.index;
}

function saveProgress() {
  if (!state.book) return;
  const ch = state.chapters[readingIndex()] || state.chapters[state.index];
  if (!ch) return;
  state.progress.lastBook = state.book.id;
  state.progress.books = state.progress.books || {};
  const prev = state.progress.books[state.book.id] || {};
  const next = {
    ...prev,
    chapterId: ch.id, chapterNo: ch.no, title: state.book.title, updated: Date.now(),
  };
  // 「記住進度」記下的段落在同一章要留著，換章就沒意義了（不要覆蓋掉它）
  if (prev.chapterId !== ch.id) delete next.para;
  state.progress.books[state.book.id] = next;
  bridge?.progress.set(state.progress);
}

/* 捲動停下來 800ms 後，如果已經真的換到別章，才更新進度。
   開書、接章都不會自己寫，只有你眼睛換章才會。 */
let readProgTimer = null;
function watchReadingPosition() {
  const stream = document.querySelector('#stream');
  if (!stream || stream.dataset.progWatch) return;
  stream.dataset.progWatch = '1';
  stream.addEventListener('scroll', () => {
    clearTimeout(readProgTimer);
    readProgTimer = setTimeout(() => {
      if (!state.book || state.streaming) return;
      // 剛手動按過「記住進度」就先別搶：那是使用者明確指定的位置
      if (Date.now() - (state.explicitProgressAt || 0) < 2500) return;
      const i = readingIndex();
      const ch = state.chapters[i];
      if (!ch) return;
      const cur = state.progress.books?.[state.book.id];
      if (cur && cur.chapterId === ch.id) return;
      saveProgress();
    }, 800);
  }, { passive: true });
}

/* ──────────────────────────────────────────────────────────────
   書評：包成 tool-call 卡片
   ────────────────────────────────────────────────────────────── */
async function showReviews(container) {
  if (!bridge?.comments || !state.book) return;
  const bookId = state.book.id;
  if (!state.reviews) state.reviews = {};
  let data = state.reviews[bookId];
  if (!data) {
    try { data = await bridge.comments(bookId, 1); } catch { return; }
    state.reviews[bookId] = data;
  }
  if (!data || !data.comments || !data.comments.length) return;
  if (container.dataset.reviews) return;
  container.dataset.reviews = '1';

  const top = data.comments.slice(0, 3);
  const tool = el('div', 'tool');
  tool.innerHTML =
    `<span class="gutter" style="width:auto;color:var(--acc)">${markSvg(12)}</span>` +
    `<span>read_reviews</span><span class="fn">(${escapeHtml(state.book.title.slice(0, 8))}…)</span>` +
    `<span class="arrow">→</span><span>${data.total.toLocaleString()} 則` +
    (data.scoreText ? ` · ${escapeHtml(data.scoreText)}` : '') + `</span>`;
  container.appendChild(tool);

  const res = el('div', 'toolres');
  for (const c of top) {
    const cm = el('div', 'cm');
    cm.innerHTML = `
      <div class="ln"><span class="bar">⎿</span><div>
        <div class="cm-h"><span class="cm-a">${escapeHtml([...c.user.name][0] || '評')}</span>
          <span class="cm-n">${escapeHtml(c.user.name)}</span>
          ${c.user.isAuthor ? '<span>· 作者</span>' : ''}
          ${c.score ? `<span>· ${c.score} 分</span>` : ''}</div>
        <div class="cm-t">${escapeHtml(c.text.slice(0, 90))}</div>
        <div class="cm-l"><span class="lk">♡ ${c.likes.toLocaleString()}</span> · 回覆 ${c.replies}</div>
      </div></div>`;
    res.appendChild(cm);
  }
  container.appendChild(res);
}

/* ──────────────────────────────────────────────────────────────
   假 AI 回覆（輸入框不是指令時）
   ────────────────────────────────────────────────────────────── */
function cannedReply(q) {
  const ch = state.chapters[state.index];
  const book = state.book;
  if (!book || !ch) {
    return `要開始的話，把番茄的書頁網址貼進來（長得像 fanqienovel.com/page/7373660003258862617），或直接給書號。\n\n也可以按「書架」抓你自己的收藏。`;
  }
  const options = [
    `這章在推進的是「${ch.title}」這條線。要我做的話可以：\n\n1. 把這章壓成三句話的摘要\n2. 抓出這章跟她之前提過的事對得上的地方\n3. 接著往下讀\n\n你要哪個？`,
    `看完了。這章的節奏偏慢，但鋪陳有用——後面大概會用到。\n\n要我幫你標一下值得回看的地方嗎？`,
    `你問的「${String(q).slice(0, 16)}」我從上下文推的：這章主要是在收上一章的尾巴，同時開一個新的懸念。\n\n想更確定的話，可以把前後三章一起給我。`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}

/* ──────────────────────────────────────────────────────────────
   輸入框
   ────────────────────────────────────────────────────────────── */
async function handleInput(raw) {
  const text = raw.trim();
  if (!text) { // Enter 空白＝下一章
    if (state.chapters.length) goChapter(Math.min(state.index + 1, state.chapters.length - 1), { announce: true });
    return;
  }

  addUser(text);

  // 指令
  if (/^n$|^下一章$|^next$|^繼續$/i.test(text)) {
    goChapter(Math.min(state.index + 1, state.chapters.length - 1), { announce: true });
    return;
  }
  if (/^\d{1,4}$/.test(text)) {
    const n = Number(text);
    const idx = state.chapters.findIndex((c) => Number(c.no) === n);
    if (idx >= 0) goChapter(idx, { announce: false });
    else addError(`找不到第 ${n} 章`);
    return;
  }
  if (/^\/theme\s+/i.test(text)) {
    const name = text.replace(/^\/theme\s+/i, '').trim();
    const t = THEMES.find((x) => x.id === name || x.name.includes(name));
    if (t) { setTheme(t.id); addAssistant().insertAdjacentHTML('beforeend', `<div class="p">已換成「${t.name}」。</div>`); }
    else addError('沒有這個主題。可用：' + THEMES.map((t) => t.id).join('、'));
    return;
  }
  if (/^\/grep\s+/i.test(text)) { searchInBook(text.replace(/^\/grep\s+/i, '').trim()); return; }
  if (/^\/ghost$/i.test(text)) { window.__moyuGhost?.toggle?.(); return; }
  if (/^\/shell\b/i.test(text)) {
    const m = text.match(/\/shell\s+(cc|dsh)/i);
    const id = m ? m[1].toLowerCase() : (currentShell() === 'cc' ? 'dsh' : 'cc');
    applyShell(id);
    const b0 = addAssistant();
    const sys = el('div', 'p');
    sys.textContent = '切換外殼：' + (id === 'cc' ? 'Claude Code 終端風' : 'DeepSeek Harness');
    b0.appendChild(sys);
    if (state.book && state.chapters.length) { const i = state.index; clearStream(); goChapter(i, { announce: true }); }
    return;
  }
  if (/^\/boss$/i.test(text)) { bridge?.boss(true); return; }
  if (/^\/hide$/i.test(text)) { bridge?.hide(); return; }
  if (/^\/(login|qr)$/i.test(text)) { showLoginPanel(); return; }
  if (/^\/(settings|set|config)$/i.test(text)) { window.__moyuOpenSettings?.(); return; }
  if (/^\/shelf$/i.test(text)) { openShelf(); return; }
  if (/^\/open\s+/i.test(text)) { openBook(text.replace(/^\/open\s+/i, '').trim()); return; }
  if (/^\/export$/i.test(text)) {
    if (!state.book) { addError('先開一本書'); return; }
    const b = addAssistant();
    b.insertAdjacentHTML('beforeend',
      `<div class="tool">${markSvg(12)} <span class="fn">export</span>(txt)</div>
       <div class="toolres"><div class="ln"><span class="bar">⎿</span><div>抓取中…（每章約 0.3 秒）</div></div></div>`);
    try {
      const r = await bridge.exportBook(state.book.id, 50);
      b.querySelector('.toolres').innerHTML =
        `<div class="ln"><span class="bar">⎿</span><div>${r.chapters} 章 · ${r.chars.toLocaleString()} 字<br>${escapeHtml(r.file)}</div></div>`;
    } catch (e) {
      b.querySelector('.toolres').innerHTML =
        `<div class="ln"><span class="bar">⎿</span><div>失敗：${escapeHtml(e.message)}</div></div>`;
    }
    return;
  }

  if (/^\/auto$/i.test(text)) {
    state.autoRead = !state.autoRead;
    if (!state.autoRead && state.autoTimer) { clearTimeout(state.autoTimer); state.autoTimer = null; }
    addAssistant().insertAdjacentHTML('beforeend',
      `<div class="p">自動模式${state.autoRead ? '已開啟' : '已關閉'}。</div>`);
    window.__moyuPaintMode?.();
    return;
  }

  // 看起來是網址 / 書號
  if (/fanqienovel\.com|\/page\/|\d{16,}/.test(text)) { openBook(text); return; }

  // 其他 → 假回覆
  const b = addAssistant();
  const p = el('div', 'p');
  b.appendChild(p);
  const reply = cannedReply(text);
  let i = 0;
  const timer = setInterval(() => {
    p.textContent = reply.slice(0, i += 3);
    scrollBottom();
    if (i >= reply.length) clearInterval(timer);
  }, 16);
}

/* ──────────────────────────────────────────────────────────────
   書架
   ────────────────────────────────────────────────────────────── */
async function openShelf() {
  if (!bridge) return;
  clearStream();
  addUser('打開書架');
  const b = addAssistant();
  b.insertAdjacentHTML('beforeend',
    `<div class="tool">${markSvg(12)} <span class="fn">read_shelf</span></div>
     <div class="toolres"><div class="ln"><span class="bar">⎿</span><div>讀取官方書架…</div></div></div>`);

  let list = [];
  let errMsg = '';
  try {
    const r = await bridge.shelf.raw();
    list = r.books || [];
    errMsg = r.error || '';
  } catch (e) { errMsg = e.message; }

  const res = b.querySelector('.toolres');
  if (!list.length) {
    res.innerHTML = `<div class="ln"><span class="bar">⎿</span><div>${escapeHtml(errMsg || '書架是空的。先打 /login 掃碼登入。')}</div></div>`;
    return;
  }
  res.innerHTML = `<div class="ln"><span class="bar">⎿</span><div>${list.length} 本</div></div>`;
  const wrap = el('div', 'shelf');
  for (const it of list) {
    const card = el('button', 'shelf-card');
    card.dataset.book = it.id;
    card.innerHTML = `
      ${it.cover ? `<img class="sc-cover" src="${escapeHtml(it.cover)}" loading="lazy" alt="">` : '<span class="sc-cover sc-noimg"></span>'}
      <span class="sc-body">
        <span class="sc-t">${escapeHtml(it.title || it.id)}</span>
        <span class="sc-a">${escapeHtml(it.author || '')}</span>
        <span class="sc-p">${it.chapterTitle ? '讀到 ' + escapeHtml(it.chapterTitle) : (it.chapterOrder ? '第 ' + it.chapterOrder + ' 章' : '未開始')}</span>
      </span>`;
    card.addEventListener('click', () => openBook(it.id));
    wrap.appendChild(card);
  }
  b.appendChild(wrap);
  scrollBottom();
}

/* ──────────────────────────────────────────────────────────────
   登入：手機掃碼（抖音 / 番茄小說 App）
   ────────────────────────────────────────────────────────────── */
function showLoginPanel() {
  if (!bridge?.qr) {
    addAssistant().insertAdjacentHTML('beforeend', '<div class="p">這個版本沒有掃碼能力，請更新後再試。</div>');
    return;
  }
  const b = addAssistant();

  b.insertAdjacentHTML('beforeend', `
    <div class="tool">${markSvg(12)} <span class="fn">login.qrcode</span></div>
    <div class="qr-wrap">
      <div class="qr-box" id="qrBox"><span class="qr-loading">產生 QR…</span></div>
      <div class="qr-side">
        <div class="p" style="margin-bottom:6px">用手機<strong>抖音</strong>或<strong>番茄小說 App</strong>掃碼。</div>
        <div class="p" style="opacity:.7;font-size:.92em">掃完在手機上確認一次就好，不用輸入帳密。</div>
        <div class="qr-status" id="qrStatus">等待掃碼…</div>
      </div>
    </div>`);

  const box = b.querySelector('#qrBox');
  const st = b.querySelector('#qrStatus');
  let stopped = false;

  (async () => {
    let q;
    try { q = await bridge.qr.start(); }
    catch (e) { box.innerHTML = `<span class="qr-loading">產生失敗：${escapeHtml(e.message)}</span>`; return; }
    if (!q || !q.token) { box.innerHTML = '<span class="qr-loading">產生失敗</span>'; return; }

    box.innerHTML = `<img src="${q.image}" alt="QR">`;
    const expireAt = q.expire ? q.expire * 1000 : Date.now() + 180000;

    const tick = async () => {
      if (stopped) return;
      if (Date.now() > expireAt) {
        st.textContent = 'QR 過期了，打 /login 重新產生';
        st.className = 'qr-status bad';
        return;
      }
      try {
        const r = await bridge.qr.poll(q.token);
        if (r.status === 'confirmed') {
          stopped = true;
          st.textContent = '登入成功 ✓';
          st.className = 'qr-status good';
          box.innerHTML = '<div class="qr-done">✓</div>';
          b.insertAdjacentHTML('beforeend',
            `<div class="p" style="margin-top:10px">好了。打 <code>/shelf</code> 讀你的書架。</div>`);
          scrollBottom();
          return;
        }
        if (r.status === 'scanning' || r.status === 'scanned') st.textContent = '已掃描，請在手機上確認…';
        else if (r.status === 'expired') { st.textContent = 'QR 過期了，打 /login 重新產生'; st.className = 'qr-status bad'; return; }
      } catch {}
      setTimeout(tick, 2000);
    };
    setTimeout(tick, 1500);
  })();

  scrollBottom();
}

/* ──────────────────────────────────────────────────────────────
   歡迎畫面
   ────────────────────────────────────────────────────────────── */
function welcome() {
  clearStream();
  const body = addAssistant();
  body.innerHTML = `
    <div class="who">我</div>
    <div class="p">要開始讀嗎？可以這樣開：</div>
    <div class="p">　· 貼上番茄的書頁網址或書號（例如 <code>7373660003258862617</code>）</div>
    <div class="p">　· 打 <code>/shelf</code> 抓你自己的書架（要先登入，<code>/login</code>）</div>
    <div class="p">　· 打 <code>/theme vscode</code> 換皮，或按 <code>Alt+1～8</code></div>
    <div class="p">　· <code>Alt+Q</code> 是老闆鍵</div>`;
}

/* ──────────────────────────────────────────────────────────────
   老闆畫面（假 git diff）
   ────────────────────────────────────────────────────────────── */
function buildBossScreen() {
  const pre = el('pre', 'bossary');
  pre.textContent = `diff --git a/src/gateway/report.ts b/src/gateway/report.ts
index 4b2c9a1..8f0e3d2 100644
--- a/src/gateway/report.ts
+++ b/src/gateway/report.ts
@@ -142,7 +142,9 @@ export async function buildReport(ctx: Ctx) {
-  const rows = await db.query(SQL_REPORT, [ctx.month]);
+  const rows = await db.query(SQL_REPORT, [ctx.month], { timeout: 8000 });
+  if (!rows.length) return { empty: true, month: ctx.month };
   return rows.map(toRow);
 }

$ npm test
 ✓ report/spec.ts (12 tests) 1.4s
 ✓ gateway/spec.ts (8 tests) 0.9s
 ✓ auth/spec.ts (5 tests) 0.6s

 Test Files  3 passed (3)
      Tests  25 passed (25)
   Duration  2.9s`;
  const wrap = el('div', 'bosscreen');
  wrap.appendChild(pre);
  document.querySelector('.main').insertBefore(wrap, document.querySelector('.composer'));
}

/* ──────────────────────────────────────────────────────────────
   啟動
   ────────────────────────────────────────────────────────────── */
async function boot() {
  const saved = (() => { try { return localStorage.getItem('moyu.theme'); } catch { return null; } })();
  if (saved) document.documentElement.dataset.theme = saved;

  buildThemeMenu();
  buildBossScreen();

  if (bridge) {
    try {
      const cfg = await bridge.config.get();
      state.config = { ...state.config, ...cfg };
      if (cfg.theme) document.documentElement.dataset.theme = cfg.theme;
      buildThemeMenu();
      state.progress = (await bridge.progress.get()) || { books: {} };
      const mt = $('#modelTag'); if (mt) mt.textContent = cfg.modelName || 'opus 4.5 · 中';
    } catch (e) { /* 開發模式沒有橋 */ }
  }

  // 續讀
  const last = state.progress.lastBook;
  if (last) {
    $('#sideTitle').textContent = '最近';
  }

  welcome();

  // ?open=<書號或網址> 直接開書（也方便測試）
  const qs = new URLSearchParams(location.search);
  if (qs.get('open')) {
    setTimeout(() => openBook(qs.get('open')), 120);
  } else if (bridge?.lastBook) {
    // 上次讀的那本 → 自動接著讀
    try {
      const last = await bridge.lastBook();
      if (last && last.id) setTimeout(() => openBook(last.id), 260);
    } catch {}
  } else if (sessionStorage.getItem('moyu.resume') === '1' && state.progress.lastBook) {
    // 熱更新 reload 之後：接回同一本書（不然更新完會掉回首頁）
    sessionStorage.removeItem('moyu.resume');
    setTimeout(() => openBook(state.progress.lastBook), 200);
  }

  // 事件
  $('#themeBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    $('#themeMenu').classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!$('#themeMenu').contains(e.target)) $('#themeMenu').classList.remove('open');
  });
  $('#bossBtn')?.addEventListener('click', () => {
    document.body.classList.toggle('bossing');
    bridge?.boss(document.body.classList.contains('bossing'));
  });

  const input = $('#input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = input.value;
        input.value = '';
        handleInput(v);
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(160, input.scrollHeight) + 'px';
    });
    input.focus();
  }

  // 全域快捷
  document.addEventListener('keydown', (e) => {
    if (e.altKey && /^[1-8]$/.test(e.key)) { setTheme(THEMES[+e.key - 1].id); return; }
    if (e.key === 'Escape') {
      stopStreaming();
      return;
    }
    if (e.altKey && (e.key === 'n' || e.key === 'N')) {
      if (state.chapters.length) goChapter(Math.min(state.index + 1, state.chapters.length - 1), { announce: true });
    }
  });

  bridge?.onBoss((on) => {
    document.body.classList.toggle('bossing', on);
  });

  // 全域老闆鍵：由搭檔程式（companion）觸發，經 SSE 送進來
  if (location.protocol === 'http:' && window.EventSource) {
    try {
      const es = new EventSource('/api/events');
      es.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === 'boss') document.body.classList.toggle('bossing', m.on);
        } catch {}
      };
    } catch {}
  }

  setInterval(() => {
    const j = (b, a) => Math.round(b + (Math.random() - 0.5) * a);
    $('#sbCpu').textContent = `CPU ${j(12, 6)}%`;
    $('#sbNet').textContent = `↑ ${j(8, 3)}ms ↓ ${j(3, 2)}ms`;
    $('#sbTok').textContent = `▍ ${j(42, 10)} tok/s`;
  }, 2000);

  watchReadingPosition();
}

document.addEventListener('DOMContentLoaded', boot);

/* 除錯／快照用的鉤子 */

/* ──────────────────────────────────────────────────────────────
   全書搜尋：章節標題 + 已讀過的正文
   ────────────────────────────────────────────────────────────── */
async function searchInBook(q) {
  const query = String(q || "").trim();
  if (!query) return;
  if (!state.book) { addError('先開一本書再搜尋'); return; }
  addUser(`搜尋「${query}」`);
  const b = addAssistant();
  b.insertAdjacentHTML('beforeend',
    `<div class="tool">${markSvg(12)} <span class="fn">grep</span>("${escapeHtml(query)}")</div>` +
    '<div class="toolres" id="searchRes"><div class="ln"><span class="bar">⎿</span><div>搜尋中…</div></div></div>');
  const box = b.querySelector('#searchRes');
  let r = null;
  try { r = await bridge.search?.(state.book.id, query); }
  catch (e) { r = { ok: false, error: e.message }; }
  if (!r || r.ok === false) {
    box.innerHTML = `<div class="ln"><span class="bar">⎿</span><div>${escapeHtml((r && r.error) || "搜尋失敗")}</div></div>`;
    return;
  }
  const hits = r.hits || [];
  if (!hits.length) {
    box.innerHTML = `<div class="ln"><span class="bar">⎿</span><div>沒有找到「${escapeHtml(query)}」。正文只搜已讀過的章節。</div></div>`;
    scrollBottom();
    return;
  }
  box.innerHTML = `<div class="ln"><span class="bar">⎿</span><div>${hits.length} 個結果（正文掃了 ${r.scanned || 0} 個已讀章節）</div></div>`;
  const list = el('div', 'search-hits');
  for (const h of hits) {
    const row = el('button', 'search-hit');
    row.innerHTML = `<span class="sh-t">第 ${escapeHtml(String(h.no || "?"))} 章 ${escapeHtml(h.title || "")}</span>` +
      `<span class="sh-x">${escapeHtml(h.snippet || "")}</span>` +
      `<span class="sh-k">${h.where === "title" ? "標題" : "正文"}</span>`;
    row.addEventListener('click', () => {
      const i = state.chapters.findIndex((c) => String(c.id) === String(h.chapterId));
      if (i >= 0) goChapter(i, { announce: true });
    });
    list.appendChild(row);
  }
  box.appendChild(list);
  scrollBottom();
}

window.__moyuDebug = {
  setShell: (id) => { applyShell(id === 'cc' ? 'cc' : 'dsh'); },
  shell: () => currentShell(),
  searchInBook,
  openBook,
  openShelf,
  setTheme,
  state,
  login: showLoginPanel,
  goChapter: (i, o) => goChapter(i, Object.assign({ announce: true }, o || {})),
  readingIndex,
  boss: (on) => document.body.classList.toggle('bossing', !!on),
  showReviewsInStream() {
    const b = addAssistant();
    const d = el('div', 'pb');
    b.appendChild(d);
    showReviews(d);
  },
  toggleHelp() {
    const p = document.getElementById('helpPanel');
    if (p) p.hidden = !p.hidden;
  },
};
