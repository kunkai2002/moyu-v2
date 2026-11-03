/* 完整的指令表 + 版本資訊 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const B = window.moyu;
  const list = $('#helpList');
  if (!list) return;

  const HELP = [
    ['書號 / 網址', '貼上就開這本書'],
    ['/shelf', '書架（需登入）'],
    ['/login', '手機掃碼登入'],
    ['/settings', '設定：主題、字級、行距、速度、登入'],
    ['/help', '這張表'],
    ['/grep 關鍵字', '全書搜尋（已讀過的段落）'],
    ['/theme <名字>', 'claude-code / claude / vscode / excel / terminal / word'],
    ['/auto', '自動模式開關'],
    ['/export', '匯出 TXT'],
    ['/boss', '切到假畫面（工作用）'],
    ['12', '跳到第 12 章'],
    ['Alt+1~6', '快速換主題'],
    ['Alt+Q', '老闆鍵'],
    ['Ctrl+K', '搜尋'],
    ['點段落', '劃線 / 取消'],
    ['頂欄 標記', '書籤、劃線、筆記'],
    ['頂欄 統計', '閱讀量'],
    ['頂欄 下載', '匯出這本書'],
    ['拖側欄邊界', '調整寬度（雙擊回復）'],
    ['Esc', '停止 / 關閉面板'],
  ];

  list.innerHTML = HELP.map(([k, v]) =>
    `<div class="help-row"><code>${k}</code><span>${v}</span></div>`).join('');

  // 版本資訊
  const foot = document.createElement('div');
  foot.className = 'help-row';
  foot.style.borderBottom = '0';
  foot.innerHTML = '<code>版本</code><span id="verText">…</span>';
  list.appendChild(foot);

  (async () => {
    const el = document.getElementById('verText');
    try {
      const v = await (B?.version?.() ?? Promise.reject(new Error('n/a')));
      if (el) el.textContent = `${v.branch} @ ${v.sha}　·　${v.dataDir}`;
    } catch {
      if (el) el.textContent = '本機版本（無法讀取 git 資訊）';
    }
  })();
})();
