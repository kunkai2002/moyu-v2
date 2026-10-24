// 1) E2E 印出錯誤堆疊 2) 自動閱讀改為健壯版本
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* e2e：印 stack */
const ep = path.join(__dirname, 'e2e-auto.js');
let e = fs.readFileSync(ep, 'utf8');
if (!e.includes('e.stack')) {
  e = e.replace("page.on('pageerror', (e) => errs.push(e.message));",
    "page.on('pageerror', (e) => errs.push((e.stack || e.message || '').split('\\n').slice(0, 3).join(' | ')));");
  fs.writeFileSync(ep, e, 'utf8');
  console.log('+ e2e 印出堆疊');
}

/* app.js：自動閱讀健壯化 */
const ap = path.join(ROOT, 'ui', 'app.js');
let a = fs.readFileSync(ap, 'utf8');

const oldBlock = `    if (state.autoRead && nx) {
      setTimeout(() => {
        if (state.autoRead) goChapter(i + 1, { announce: true });
      }, 1400);
    }`;

const newBlock = `    // 自動閱讀：讀完這章就排下一章（用 window.__moyuDebug 走同一條有歷史記錄的路）
    if (state.autoRead && nx) {
      state.autoTimer && clearTimeout(state.autoTimer);
      state.autoTimer = setTimeout(() => {
        if (!state.autoRead) return;
        const next = (window.__moyuDebug && window.__moyuDebug.goChapter) || goChapter;
        next(i + 1);
      }, 1400);
    }`;

if (a.includes(oldBlock)) {
  a = a.replace(oldBlock, newBlock);
  fs.writeFileSync(ap, a, 'utf8');
  console.log('+ 自動閱讀改為健壯版本');
} else {
  console.log('! 找不到自動閱讀區塊（可能已改過）');
}

/* 關閉自動閱讀時清掉排程 */
if (!a.includes('state.autoTimer && clearTimeout')) {
  a = a.replace(
    "    state.autoRead = !state.autoRead;",
    "    state.autoRead = !state.autoRead;\n    if (!state.autoRead && state.autoTimer) { clearTimeout(state.autoTimer); state.autoTimer = null; }",
  );
  fs.writeFileSync(ap, a, 'utf8');
  console.log('+ 關閉時取消排程');
}
