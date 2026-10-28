// 連讀：手勢令牌制 —— 一次手勢最多接一章，杜絕連鎖
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const f = p('ui/flow.js');
let s = fs.readFileSync(f, 'utf8');
const must = (a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

must('var armed = false;', 'armed decl');

/* 1) 用 gestureSeq / usedSeq 取代 armed */
s = s.replace('var armed = false;   // 使用者滾到底才允許自動接',
  'var gestureSeq = 0;      // 每次真實手勢 +1\n  var usedSeq = 0;         // 已經用掉的手勢');

/* 2) advance 開頭：自動模式必須有新的手勢 */
must(`    if (!manual) {
      if (!atBottom()) return;
      // 沒有滾動（內容比視窗短）時允許自動補齊；其餘要等使用者滾
      var noScrollbar = stream.scrollHeight <= stream.clientHeight + 4;
      if (!armed && !noScrollbar) return;
    }`, 'advance guard');
s = s.replace(`    if (!manual) {
      if (!atBottom()) return;
      // 沒有滾動（內容比視窗短）時允許自動補齊；其餘要等使用者滾
      var noScrollbar = stream.scrollHeight <= stream.clientHeight + 4;
      if (!armed && !noScrollbar) return;
    }`, `    var noScrollbar = stream.scrollHeight <= stream.clientHeight + 4;
    if (!manual) {
      if (!atBottom() && !noScrollbar) return;
      // 一次手勢只能接一章；內容還沒滿一屏時才允許自動補齊
      if (!noScrollbar && usedSeq >= gestureSeq) return;
    }
    var usedAtStart = gestureSeq;`);

/* 3) 完成後把這個手勢標記為已用 */
s = s.replace('      busy = false;\n      armed = false;', '      busy = false;\n      usedSeq = usedAtStart;');

/* 4) 手勢來源：wheel / touch / 鍵盤 都 +1 */
must(`  ['wheel', 'touchmove'].forEach(function (ev) {
    stream.addEventListener(ev, function () { if (atBottom()) armed = true; }, { passive: true });
  });
  window.addEventListener('keydown', function (e) {
    if (/^(PageDown|ArrowDown|End|Down| )$/.test(e.key)) { if (atBottom()) armed = true; }
  });`, 'gesture listeners');
s = s.replace(`  ['wheel', 'touchmove'].forEach(function (ev) {
    stream.addEventListener(ev, function () { if (atBottom()) armed = true; }, { passive: true });
  });
  window.addEventListener('keydown', function (e) {
    if (/^(PageDown|ArrowDown|End|Down| )$/.test(e.key)) { if (atBottom()) armed = true; }
  });`, `  ['wheel', 'touchmove'].forEach(function (ev) {
    stream.addEventListener(ev, function () { if (atBottom()) gestureSeq++; }, { passive: true });
  });
  window.addEventListener('keydown', function (e) {
    if (/^(PageDown|ArrowDown|End|Down| )$/.test(e.key)) { if (atBottom()) gestureSeq++; }
  });`);

/* 5) scroll 處理：不再改 armed，只檢查是否有新手勢 */
must(`  stream.addEventListener('scroll', function () {
    if (st.streaming) return;
    if (!atBottom()) { armed = false; return; }
    if (armed && canAdvance()) advance(false);
  }, { passive: true });`, 'scroll handler');
s = s.replace(`  stream.addEventListener('scroll', function () {
    if (st.streaming) return;
    if (!atBottom()) { armed = false; return; }
    if (armed && canAdvance()) advance(false);
  }, { passive: true });`, `  stream.addEventListener('scroll', function () {
    if (st.streaming) return;
    if (!atBottom()) return;
    if (canAdvance()) advance(false);
  }, { passive: true });`);

/* 6) 接完後的補章計時器：只用 noScrollbar，不碰 armed */
must(`      busy = false;
      armed = false;
      // 內容仍比視窗短就再補一章，否則停下等使用者滾
      setTimeout(function () {
        if (!canAdvance()) return;
        var noScrollbar = stream.scrollHeight <= stream.clientHeight + 4;
        if (noScrollbar) advance(false);
      }, 220);`, 'post-advance timer');
s = s.replace(`      busy = false;
      armed = false;
      // 內容仍比視窗短就再補一章，否則停下等使用者滾
      setTimeout(function () {
        if (!canAdvance()) return;
        var noScrollbar = stream.scrollHeight <= stream.clientHeight + 4;
        if (noScrollbar) advance(false);
      }, 220);`, `      busy = false;
      // 內容仍比視窗短才自動補，其餘等下一次手勢
      setTimeout(function () {
        if (!canAdvance()) return;
        if (stream.scrollHeight <= stream.clientHeight + 4) advance(false);
      }, 220);`);

/* 7) 移除殘留的 armed 參照 */
s = s.replace(/\s*if \(armed \|\| noScrollbar\) advance\(false\);/g, '\n            if (noScrollbar || usedSeq < gestureSeq) advance(false);');

if (/armed/.test(s)) {
  console.error('⚠️ 還有 armed 殘留，請人工檢查');
  console.error(s.split('\n').filter((l) => l.includes('armed')).join('\n'));
  process.exit(1);
}

fs.writeFileSync(f, s, 'utf8');
console.log('flow.js: 手勢令牌制完成');
