// ① 連讀節流：一次只接一章，等使用者再滾才接下一章
// ② 溢出選單標籤：用 title 補名字、去重、丟掉純資訊項
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);

/* ── flow.js ─────────────────────────────────────────────── */
{
  const f = p('ui/flow.js');
  let s = fs.readFileSync(f, 'utf8');

  // 加入 armed 狀態
  if (!s.includes('var armed')) {
    s = s.replace('  var busy = false;', '  var busy = false;\n  var armed = false;   // 使用者滾到底才允許自動接');
  }

  // 只有 armed 才自動接；手動點哨兵不受限
  s = s.replace(
    `  function advance(manual) {
    if (!canAdvance()) { paintSentinel(); return; }
    if (!manual && !atBottom()) return;`,
    `  function advance(manual) {
    if (!canAdvance()) { paintSentinel(); return; }
    if (!manual) {
      if (!atBottom()) return;
      // 沒有滾動（內容比視窗短）時允許自動補齊；其餘要等使用者滾
      var noScrollbar = stream.scrollHeight <= stream.clientHeight + 4;
      if (!armed && !noScrollbar) return;
    }`
  );

  // 接完一章就解除 armed（手動點也一樣，一次一章）
  s = s.replace(
    `      busy = false;
      setTimeout(function () { if (canAdvance() && atBottom()) advance(false); }, 200);`,
    `      busy = false;
      armed = false;
      // 內容仍比視窗短就再補一章，否則停下等使用者滾
      setTimeout(function () {
        if (!canAdvance()) return;
        var noScrollbar = stream.scrollHeight <= stream.clientHeight + 4;
        if (noScrollbar) advance(false);
      }, 220);`
  );

  // 使用者滾動 → armed
  s = s.replace(
    `  stream.addEventListener('scroll', function () {
    if (canAdvance() && atBottom()) advance(false);
  }, { passive: true });`,
    `  stream.addEventListener('scroll', function () {
    if (st.streaming) return;
    if (!atBottom()) { armed = false; return; }
    armed = true;
    if (canAdvance()) advance(false);
  }, { passive: true });
  stream.addEventListener('wheel', function () { if (atBottom()) armed = true; }, { passive: true });`
  );

  // 哨兵被看到時視為「使用者已經到位」；但只在內容無滾動條時自動接
  s = s.replace(
    `          if (entries[i].isIntersecting) advance(false);`,
    `          if (entries[i].isIntersecting) {
            var noScrollbar = stream.scrollHeight <= stream.clientHeight + 4;
            if (armed || noScrollbar) advance(false);
          }`
  );

  fs.writeFileSync(f, s, 'utf8');
  console.log('flow.js ok');
}

/* ── chrome.js：溢出標籤修正 ─────────────────────────────── */
{
  const f = p('ui/chrome.js');
  let s = fs.readFileSync(f, 'utf8');
  const old = `  function addToOverflow(el) {
    if (!el || el.dataset.moved) return;
    el.dataset.moved = '1';
    const label = (el.textContent || '').trim() || '功能';`;
  const neu = `  function addToOverflow(el) {
    if (!el || el.dataset.moved) return;
    el.dataset.moved = '1';
    // 純圖標按鈕沒有文字，用 title 當名字；真的沒有就跳過（不要出現「功能」這種空殼）
    const raw = (el.textContent || '').trim() || (el.getAttribute('title') || '').trim();
    if (!raw) { el.remove(); return; }
    // 純資訊項（章節 0 這種）不需要進選單
    if (/^章節\\s*\\d+$/.test(raw)) { el.remove(); return; }
    const label = raw;
    if ([...ov.querySelectorAll('.ov-row')].some((r) => r.textContent.trim() === label)) { el.remove(); return; }`;
  if (!s.includes('ov.querySelectorAll') || !s.includes('純圖標按鈕')) {
    if (!s.includes(old)) { console.error('❌ chrome.js 錨點失效'); process.exit(1); }
    s = s.replace(old, neu);
    fs.writeFileSync(f, s, 'utf8');
    console.log('chrome.js ok');
  } else console.log('chrome.js 已修過');
}
