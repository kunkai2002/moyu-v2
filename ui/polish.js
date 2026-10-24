/* 打磨層：圖標化、面板互斥、段落提示、書籍詳情、自動更新提示 */
(function () {
  'use strict';
  const I = window.MOYU_ICONS;
  const D = window.__moyuDebug;
  const B = window.moyu;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  if (!I || !D) return;

  /* ── 樣式 ── */
  const css = document.createElement('style');
  css.textContent = `
  /* 翻章列：只留兩個箭頭 */
  .cn-btn{padding:0;width:30px;height:30px;border-radius:50%;justify-content:center;gap:0}
  .cn-btn span{display:none}
  .cn-pos{min-width:auto;padding:0 6px;font-size:11.5px}
  .chapter-nav{gap:10px}
  .cn-btn:hover{border-color:var(--acc);color:var(--acc)}

  /* 段落 hover 提示 */
  #stream .p{position:relative;transition:background .12s}
  #stream .p:hover{background:color-mix(in srgb, var(--fg) 5%, transparent);border-radius:3px}
  #stream .p:hover::after{
    content:"";position:absolute;left:-14px;top:8px;width:4px;height:14px;
    border-radius:2px;background:var(--acc);opacity:.7;
  }

  /* 詳情面板 */
  .detail{position:absolute;inset:44px 18px 34px 18px;z-index:48;background:var(--bg);
    display:flex;flex-direction:column;overflow:auto;padding:18px 22px}
  .detail[hidden]{display:none}
  .dt-head{display:flex;gap:16px}
  .dt-cover{width:104px;height:144px;flex:none;border-radius:6px;object-fit:cover;background:var(--sel)}
  .dt-meta{flex:1;min-width:0}
  .dt-title{font-size:17px;color:var(--fg);margin-bottom:4px}
  .dt-author{font-size:12px;color:var(--fg3);margin-bottom:8px}
  .dt-line{font-size:12px;color:var(--fg2);margin-bottom:3px}
  .dt-actions{display:flex;gap:8px;margin:14px 0 6px;flex-wrap:wrap}
  .dt-btn{display:flex;align-items:center;gap:6px;border:1px solid var(--line-strong);
    border-radius:7px;padding:7px 12px;background:var(--bg-elev);color:var(--fg2);
    font:inherit;font-size:12.5px;cursor:pointer}
  .dt-btn:hover{border-color:var(--acc);color:var(--fg)}
  .dt-btn.primary{background:var(--acc);border-color:var(--acc);color:#fff}
  .dt-sum{font-size:12.5px;line-height:1.75;color:var(--fg2);margin-top:10px;
    white-space:pre-wrap;max-width:76ch}

  /* 更新提示條 */
  .upd-bar{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:8px 12px;
    border:1px solid var(--acc2);border-radius:8px;background:color-mix(in srgb, var(--acc2) 12%, transparent);
    font-size:12.5px;color:var(--fg2)}
  .upd-bar[hidden]{display:none}
  .upd-bar .u-t{flex:1}
  .upd-bar button{border:1px solid var(--line-strong);background:var(--bg-elev);color:var(--fg2);
    border-radius:6px;padding:4px 10px;font:inherit;font-size:12px;cursor:pointer}
  .upd-bar button:hover{border-color:var(--acc2);color:var(--fg)}

  /* 首次引導 */
  .onboard{display:flex;flex-direction:column;gap:10px;margin:6px 0 18px}
  .ob-step{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--line);
    border-radius:8px;background:var(--bg-elev)}
  .ob-step .n{width:20px;height:20px;border-radius:50%;background:var(--sel);color:var(--fg2);
    display:grid;place-items:center;font-size:11px;flex:none}
  .ob-step .b{flex:1;min-width:0}
  .ob-step b{display:block;font-size:13px;color:var(--fg);margin-bottom:2px;font-weight:500}
  .ob-step span{font-size:11.5px;color:var(--fg3);line-height:1.6}
  `;
  document.head.appendChild(css);

  /* ── 1. 翻章鈕：補 tooltip ── */
  function iconizeNav() {
    const prev = $('#cnPrev'), next = $('#cnNext');
    if (prev && !prev.title) prev.title = '上一章';
    if (next && !next.title) next.title = '下一章';
    $$('.tb-btn').forEach((b) => { if (!b.title) b.title = b.id; });
  }

  /* ── 2. 面板互斥 ── */
  function exclusivity() {
    const panes = $$('.panel, .marks-panel, .stats-panel, .detail');
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        const el = m.target;
        if (el.hidden || !el.classList) continue;
        for (const other of panes) {
          if (other !== el && !other.hidden) other.hidden = true;
        }
      }
    });
    panes.forEach((p) => obs.observe(p, { attributes: true, attributeFilter: ['hidden'] }));
  }

  /* ── 3. 書籍詳情 ── */
  const detail = document.createElement('div');
  detail.className = 'detail';
  detail.hidden = true;
  document.querySelector('.main')?.appendChild(detail);

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showDetail() {
    const book = D.state.book;
    if (!book) { D.openShelf(); return; }
    const chs = D.state.chapters || [];
    const i = D.state.index || 0;
    const cur = chs[i] || {};
    const prog = D.state.progress?.books?.[book.id];
    const pct = chs.length ? Math.round(((i + 1) / chs.length) * 100) : 0;

    detail.innerHTML = `
      <div class="dt-head">
        ${book.cover ? `<img class="dt-cover" src="${esc(book.cover)}" alt="">` : '<div class="dt-cover"></div>'}
        <div class="dt-meta">
          <div class="dt-title">${esc(book.title)}</div>
          <div class="dt-author">${esc(book.author || '未知作者')}</div>
          <div class="dt-line">共 ${chs.length} 章</div>
          <div class="dt-line">目前：${esc(cur.title || '—')}（${pct}%）</div>
          <div class="dt-actions">
            <button class="dt-btn primary" id="dtRead">${I.svg('book', 15)}<span>繼續閱讀</span></button>
            <button class="dt-btn" id="dtFirst">${I.svg('list', 15)}<span>從第一章</span></button>
            <button class="dt-btn" id="dtDl">${I.svg('down', 15)}<span>整本下載</span></button>
            <button class="dt-btn" id="dtClose">${I.svg('close', 15)}<span>關閉</span></button>
          </div>
        </div>
      </div>`;
    detail.hidden = false;

    $('#dtRead').addEventListener('click', () => { detail.hidden = true; });
    $('#dtFirst').addEventListener('click', () => { detail.hidden = true; D.goChapter(0); });
    $('#dtClose').addEventListener('click', () => { detail.hidden = true; });
    $('#dtDl').addEventListener('click', () => {
      detail.hidden = true;
      const b = $$('.ov-row').find((r) => r.textContent.includes('整本下載'));
      if (b) b.click();
    });
  }

  // 頂欄加「詳情」圖示（書的資訊）
  const right = $('.topbar-r');
  if (right) {
    const btn = document.createElement('button');
    btn.className = 'tb-btn';
    btn.id = 'tbDetail';
    btn.title = '書籍詳情';
    btn.innerHTML = I.svg('book', 18);
    btn.addEventListener('click', showDetail);
    right.insertBefore(btn, right.firstChild);
  }

  /* ── 4. 首次引導（首頁） ── */
  function enhanceWelcome() {
    const stream = $('#stream');
    if (!stream) return;
    const obs = new MutationObserver(() => {
      const p = stream.querySelector('.thread .b');
      if (!p || stream.dataset.onboarded) return;
      if (!/要開始讀嗎/.test(p.textContent || '')) return;
      stream.dataset.onboarded = '1';
      const wrap = document.createElement('div');
      wrap.className = 'onboard';
      wrap.innerHTML = `
        <div class="ob-step"><span class="n">1</span><div class="b">
          <b>手機掃碼登入</b><span>抖音或番茄 App 掃一下，書架就會出現在這裡</span></div></div>
        <div class="ob-step"><span class="n">2</span><div class="b">
          <b>從書架挑一本</b><span>點封面直接接著上次的章節讀</span></div></div>
        <div class="ob-step"><span class="n">3</span><div class="b">
          <b>點段落就能劃線</b><span>右鍵有更多：複製、搜尋、跳章</span></div></div>`;
      p.appendChild(wrap);
      const btn = document.createElement('button');
      btn.className = 'dt-btn primary';
      btn.innerHTML = I.svg('search', 15) + '<span>手機掃碼登入</span>';
      btn.addEventListener('click', () => D.login());
      p.appendChild(btn);
      const btn2 = document.createElement('button');
      btn2.className = 'dt-btn';
      btn2.style.marginLeft = '8px';
      btn2.innerHTML = I.svg('shelf', 15) + '<span>我的書架</span>';
      btn2.addEventListener('click', () => D.openShelf());
      p.appendChild(btn2);
    });
    obs.observe(stream, { childList: true, subtree: true });
  }

  /* ── 5. 自動更新檢查 ── */
  let banner = null;
  function ensureBanner() {
    if (banner) return banner;
    banner = document.createElement('div');
    banner.className = 'upd-bar';
    banner.hidden = true;
    banner.innerHTML = '<span class="u-t"></span><button id="updGo">更新</button><button id="updLater">稍後</button>';
    const thread = $('#stream .thread') || $('#stream');
    thread.prepend(banner);
    return banner;
  }

  async function checkUpdate(manual) {
    if (!B?.update) return;
    try {
      const r = await B.update.check();
      if (!r.ok || r.upToDate) {
        if (manual) alert(r.ok ? '已是最新版本（' + r.local + '）' : '檢查失敗：' + (r.error || ''));
        return;
      }
      const b = ensureBanner();
      b.hidden = false;
      b.querySelector('.u-t').textContent = `有新版本 ${r.remote}（目前 ${r.local}）`;
      b.querySelector('#updLater').onclick = () => { b.hidden = true; };
      b.querySelector('#updGo').onclick = async () => {
        b.querySelector('.u-t').textContent = '正在更新…';
        try {
          const res = await B.update.apply();
          if (res.applied) {
            b.querySelector('.u-t').textContent = '已更新，請重新啟動程式';
            b.querySelector('#updGo').style.display = 'none';
          } else {
            b.querySelector('.u-t').textContent = res.message || '需要重新執行啟動器才能更新';
          }
        } catch (e) {
          b.querySelector('.u-t').textContent = '更新失敗：' + e.message;
        }
      };
    } catch { /* 離線就忽略 */ }
  }

  /* ── 啟動 ── */
  iconizeNav();
  exclusivity();
  enhanceWelcome();

  const stream = $('#stream');
  if (stream) new MutationObserver(() => iconizeNav()).observe(stream, { childList: true, subtree: true });

  setTimeout(() => checkUpdate(false), 4000);
  setInterval(() => checkUpdate(false), 30 * 60 * 1000);

  // 設定面板「檢查更新」按鈕沿用
  document.addEventListener('click', (e) => {
    if (e.target?.id === 'updCheck') checkUpdate(true);
  });

  window.__moyuPolish = { showDetail, checkUpdate };
})();
