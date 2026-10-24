const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ap = path.join(ROOT, 'ui', 'app.js');
let a = fs.readFileSync(ap, 'utf8');
let changed = 0;

/* 1) boot() 對被 chrome.js 移除的元素做防護 */
a = a.replace("$('#bossBtn').addEventListener('click', () => {", "$('#bossBtn')?.addEventListener('click', () => {");
a = a.replace("$('#themeBtn').addEventListener('click', (e) => {", "$('#themeBtn')?.addEventListener('click', (e) => {");
a = a.replace(
  "document.addEventListener('click', (e) => {\n    if (!$('#themeMenu').contains(e.target)) $('#themeMenu').classList.remove('open');\n  });",
  "document.addEventListener('click', (e) => {\n    const m = $('#themeMenu');\n    if (m && !m.contains(e.target)) m.classList.remove('open');\n  });",
);
a = a.replace(
  "$('#modelTag').textContent = cfg.modelName || 'opus 4.5 · 中';",
  "const mt = $('#modelTag'); if (mt) mt.textContent = cfg.modelName || 'opus 4.5 · 中';",
);

/* 2) 自動閱讀：用 regex 找區塊，避免縮排差異 */
const re = /if \(state\.autoRead && nx\) \{[\s\S]*?\n    \}/;
if (re.test(a) && !a.includes('state.autoTimer')) {
  a = a.replace(re, `if (state.autoRead && nx) {
      if (state.autoTimer) clearTimeout(state.autoTimer);
      state.autoTimer = setTimeout(() => {
        if (!state.autoRead) return;
        const next = (window.__moyuDebug && window.__moyuDebug.goChapter) || goChapter;
        next(i + 1);
      }, 1400);
    }`);
  changed++;
  console.log('+ 自動閱讀改為可取消的排程');
} else {
  console.log('= 自動閱讀區塊：', re.test(a) ? '已改過' : '找不到');
}

fs.writeFileSync(ap, a, 'utf8');
console.log(changed || a.includes("?.addEventListener") ? '已套用防護' : '未變更');
