/* 完整的指令表 + 版本資訊 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const B = window.moyu;
  const list = $('#helpList');
  if (!list) return;

  const HELP = [
    ['書號 / 網址', '貼上就開這本書'],
    ['/shelf', '我的書架（需登入）'],
    ['/login', '手機掃碼登入（QR）'],
    ['/settings', '設定面板：主題、字級、行距、速度、登入'],
    ['/help', '這張表'],
    ['/grep 關鍵字', '全書搜尋（已讀過的章節）'],
    ['/theme <名字>', '換主題：claude-code / claude / vscode / excel / terminal / word'],
    ['/auto', '自動閱讀開關'],
    ['/export', '匯出前 50 章為 TXT'],
    ['/boss', '切到假畫面（工作用）'],
    ['n / 空 Enter', '下一章'],
    ['12', '跳到第 12 章'],
    ['Alt+1~6', '快速換主題'],
    ['Alt+N', '下一章'],
    ['Alt+Q', '老闆鍵'],
    ['Ctrl+K', '搜尋章節（聚焦左側篩選框）'],
    ['點段落', '劃線 / 取消'],
    ['頂欄 標記', '書籤、劃線、筆記'],
    ['頂欄 統計', '今日與近七日閱讀量'],
    ['頂欄 下載', '匯出這本書'],
    ['拖側欄邊界', '調整章節欄寬（雙擊回復）'],
    ['左側 <', '收合章節欄'],
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
