// 修：跳章清空畫面時要同時清「已載入」記錄，否則會變空白；開書時重置手勢
const fs = require('fs');
const f = 'sync/m/app.js';
let s = fs.readFileSync(f, 'utf8');
const must = (a, t) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + t); process.exit(1); } };

must(`    if (opts.wipe) {
      view.innerHTML = '<div class="read" id="readBox"></div>';
      window.scrollTo(0, 0);
    }`, 'mobile readFrom wipe');
s = s.replace(
  `    if (opts.wipe) {
      view.innerHTML = '<div class="read" id="readBox"></div>';
      window.scrollTo(0, 0);
    }`,
  `    if (opts.wipe) {
      view.innerHTML = '<div class="read" id="readBox"></div>';
      state.loadedChapters = {};   // 清畫面就要清「已載入」，否則新章不會渲染
      userGesture = false;
      window.scrollTo(0, 0);
    }`
);

must(`    state.done = false;
    state.loadedChapters = {};
    await loadMarks(bookId);`, 'mobile openBook reset');
s = s.replace(
  `    state.done = false;
    state.loadedChapters = {};
    await loadMarks(bookId);`,
  `    state.done = false;
    state.loadedChapters = {};
    userGesture = false;
    await loadMarks(bookId);`
);

fs.writeFileSync(f, s, 'utf8');
console.log('sync/m/app.js: 跳章空白修正');
