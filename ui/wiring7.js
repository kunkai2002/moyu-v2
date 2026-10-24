/* 閱讀統計：章節讀完自動記一筆，頂欄「統計」看今日/本週 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const stream = $('#stream');
  const B = window.moyu;
  if (!stream || !B) return;

  const css = document.createElement('style');
  css.textContent = `
  .stats-panel{position:absolute;right:18px;top:44px;width:340px;z-index:46;
    background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;
    box-shadow:0 18px 50px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden}
  .stats-panel[hidden]{display:none}
  .st-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px}
  .st-cell{text-align:center}
  .st-cell b{display:block;font-size:17px;color:var(--fg);font-variant-numeric:tabular-nums}
  .st-cell span{font-size:10.5px;color:var(--fg3)}
  .st-bars{display:flex;align-items:flex-end;gap:4px;height:64px;padding:0 12px 12px}
  .st-bar{flex:1;background:var(--acc);opacity:.55;border-radius:2px 2px 0 0;min-height:2px}
  .st-bar:hover{opacity:1}
  `;
  document.head.appendChild(css);

  const panel = document.createElement('div');
  panel.className = 'stats-panel';
  panel.hidden = true;
  panel.innerHTML = `<div class="panel-head"><b>閱讀統計</b>
      <button class="ghost icon" id="stClose"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2"/></svg></button>
    </div>
    <div class="st-grid" id="stGrid"></div>
    <div class="st-bars" id="stBars"></div>`;
  document.querySelector('.main')?.appendChild(panel);
  panel.querySelector('#stClose').addEventListener('click', () => { panel.hidden = true; });

  const bar = $('.topbar-r');
  if (bar) {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.textContent = '統計';
    btn.title = '閱讀統計';
    btn.addEventListener('click', async () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) await render();
    });
    bar.insertBefore(btn, bar.firstChild);
  }

  const fmt = (n) => (n >= 10000 ? (n / 10000).toFixed(1) + '萬' : String(n));
  const hhmm = (sec) => {
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
  };

  async function render() {
    let r;
    try { r = await B.stats.get(); } catch { return; }
    const t = r.today || {};
    panel.querySelector('#stGrid').innerHTML = `
      <div class="st-cell"><b>${fmt(t.chars || 0)}</b><span>今日字數</span></div>
      <div class="st-cell"><b>${t.chapters || 0}</b><span>今日章節</span></div>
      <div class="st-cell"><b>${hhmm(t.seconds || 0)}</b><span>今日時長</span></div>`;
    const w = r.last7 || [];
    const max = Math.max(1, ...w.map((d) => d.chars));
    panel.querySelector('#stBars').innerHTML = w.map((d) =>
      `<div class="st-bar" style="height:${Math.round((d.chars / max) * 100)}%" title="${d.date} · ${fmt(d.chars)} 字 · ${d.chapters} 章"></div>`
    ).join('') || '';
  }

  /* 章節讀完時（.meta 出現）記一筆 */
  let lastKey = '';
  const obs = new MutationObserver(() => {
    const metas = stream.querySelectorAll('.meta');
    const m = metas[metas.length - 1];
    if (!m) return;
    const txt = m.textContent || '';
    const cm = txt.match(/已讀\s*([\d,]+)\s*字/);
    if (!cm) return;
    const key = (document.querySelector('#sbChapter')?.textContent || '') + cm[1];
    if (key === lastKey) return;
    lastKey = key;
    const chars = Number(cm[1].replace(/,/g, '')) || 0;
    const tm = txt.match(/(\d{2}):(\d{2})/);
    const seconds = tm ? Number(tm[1]) * 60 + Number(tm[2]) : 0;
    B.stats.add({ chars, seconds }).catch(() => {});
    if (!panel.hidden) render();
  });
  obs.observe(stream, { childList: true, subtree: true });
})();
