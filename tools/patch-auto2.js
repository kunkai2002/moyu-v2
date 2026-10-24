// 在 polish.js 裡獨立實作自動閱讀：觀察章節讀完（.meta 出現）→ 排下一章
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const p = path.join(ROOT, 'ui', 'polish.js');
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('autoAdvance')) {
  const block = `
  /* ── 6. 自動閱讀（獨立實作，不依賴 app.js 內部排程）── */
  let autoTimer = null;
  let autoLastKey = '';
  function autoAdvance() {
    const stream = $('#stream');
    if (!stream) return;
    new MutationObserver(() => {
      if (!D.state.autoRead) return;
      const metas = stream.querySelectorAll('.meta');
      const m = metas[metas.length - 1];
      if (!m) return;
      const key = (m.textContent || '').trim();
      if (!key || key === autoLastKey) return;
      autoLastKey = key;
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        if (!D.state.autoRead) return;
        const n = (D.state.chapters || []).length;
        const i = D.state.index || 0;
        if (i < n - 1) {
          const g = (window.__moyuDebug.goChapter) || null;
          if (g) g(i + 1);
        }
      }, 1500);
    }).observe(stream, { childList: true, subtree: true });
  }
  autoAdvance();

  /* 切換時同步狀態文字，並在關閉時取消排程 */
  document.addEventListener('click', (e) => {
    if (e.target?.id !== 'modeTag') return;
    if (!D.state.autoRead && autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    autoLastKey = '';
  });
`;
  s = s.replace('  window.__moyuPolish = { showDetail, checkUpdate };',
    block + '\n  window.__moyuPolish = { showDetail, checkUpdate };');
  fs.writeFileSync(p, s, 'utf8');
  console.log('+ polish.js 加入自動閱讀');
} else {
  console.log('= 已有');
}
