/* 書架管理：搜尋、篩選、排序（作用在已渲染的書架卡片上） */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const stream = $('#stream');
  if (!stream) return;

  const css = document.createElement('style');
  css.textContent = `
  .shelf-tools{display:flex;gap:8px;align-items:center;margin:8px 0 4px}
  .shelf-tools input{
    flex:1;min-width:0;background:var(--bg-elev);border:1px solid var(--line-strong);
    border-radius:5px;color:var(--fg);font:inherit;font-size:12px;padding:5px 8px;outline:0;
  }
  .shelf-tools input:focus{border-color:var(--acc)}
  .shelf-tools select{
    background:var(--bg-elev);border:1px solid var(--line);border-radius:5px;
    color:var(--fg2);font:inherit;font-size:12px;padding:5px 6px;cursor:pointer;
  }
  .shelf-card[data-hide]{display:none}
  `;
  document.head.appendChild(css);

  let tools = null;

  function buildTools(shelf) {
    if (tools && document.contains(tools)) return tools;
    tools = document.createElement('div');
    tools.className = 'shelf-tools';
    tools.innerHTML = `
      <input id="shelfQ" placeholder="篩選書名或作者…" spellcheck="false">
      <select id="shelfSort">
        <option value="default">書架順序</option>
        <option value="title">書名</option>
        <option value="author">作者</option>
      </select>`;
    shelf.parentNode.insertBefore(tools, shelf);

    tools.querySelector('#shelfQ').addEventListener('input', () => apply(shelf));
    tools.querySelector('#shelfSort').addEventListener('change', () => apply(shelf));
    return tools;
  }

  function apply(shelf) {
    const q = (tools?.querySelector('#shelfQ')?.value || '').trim().toLowerCase();
    const mode = tools?.querySelector('#shelfSort')?.value || 'default';
    const cards = [...shelf.querySelectorAll('.shelf-card')];

    for (const c of cards) {
      const txt = (c.textContent || '').toLowerCase();
      const hide = q && !txt.includes(q);
      if (hide) c.setAttribute('data-hide', '1'); else c.removeAttribute('data-hide');
    }

    if (mode === 'default') return;
    const key = (c) => {
      const t = c.querySelector('.sc-t')?.textContent || '';
      const a = c.querySelector('.sc-a')?.textContent || '';
      return (mode === 'author' ? a : t).toLowerCase();
    };
    cards.sort((x, y) => key(x).localeCompare(key(y), 'zh-Hant'));
    for (const c of cards) shelf.appendChild(c);
  }

  // 書架出現時掛上工具列
  const obs = new MutationObserver(() => {
    const shelf = stream.querySelector('.shelf');
    if (!shelf) { if (tools) { tools.remove(); tools = null; } return; }
    buildTools(shelf);
    apply(shelf);
  });
  obs.observe(stream, { childList: true, subtree: true });
})();
