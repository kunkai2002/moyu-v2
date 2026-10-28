// 連讀再修：只有「真的使用者手勢」才武裝（滾輪/觸控/鍵盤），程式滾動不算
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const f = p('ui/flow.js');
let s = fs.readFileSync(f, 'utf8');

const oldScroll = `  stream.addEventListener('scroll', function () {
    if (st.streaming) return;
    if (!atBottom()) { armed = false; return; }
    armed = true;
    if (canAdvance()) advance(false);
  }, { passive: true });
  stream.addEventListener('wheel', function () { if (atBottom()) armed = true; }, { passive: true });`;

const newScroll = `  /* 只有真的手勢才武裝：程式自己捲到底（例如接章後還原位置）不該觸發連鎖 */
  ['wheel', 'touchmove'].forEach(function (ev) {
    stream.addEventListener(ev, function () { if (atBottom()) armed = true; }, { passive: true });
  });
  window.addEventListener('keydown', function (e) {
    if (/^(PageDown|ArrowDown|End|Down| )$/.test(e.key)) { if (atBottom()) armed = true; }
  });
  stream.addEventListener('scroll', function () {
    if (st.streaming) return;
    if (!atBottom()) { armed = false; return; }
    if (armed && canAdvance()) advance(false);
  }, { passive: true });`;

if (!s.includes('只有真的手勢才武裝')) {
  if (!s.includes(oldScroll)) { console.error('❌ flow.js 錨點失效'); process.exit(1); }
  s = s.replace(oldScroll, newScroll);
  fs.writeFileSync(f, s, 'utf8');
  console.log('flow.js 已改為手勢武裝');
} else {
  console.log('flow.js 已改過');
}
