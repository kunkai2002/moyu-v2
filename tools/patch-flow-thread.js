// ① flow.js：改看 #stream 的直接子節點（首頁/換書會重建 thread）
// ② 自檢：tbList 是「聚焦篩選框」，不算沒反應
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);

{
  const f = p('ui/flow.js');
  let s = fs.readFileSync(f, 'utf8');
  const old = `  new MutationObserver(function () {
    observeThread(document.querySelector('#stream .thread'));
  }).observe(document.body, { childList: true });`;
  const neu = `  new MutationObserver(function () {
    observeThread(document.querySelector('#stream .thread'));
  }).observe(stream, { childList: true });`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    fs.writeFileSync(f, s, 'utf8');
    console.log('flow.js 觀察對象改為 #stream');
  } else console.log('flow.js 錨點不符（可能已改）');
}

{
  const f = p('tools/e2e-buttons.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('activeElement')) {
    s = s.replace(
      `      const panels = [...document.querySelectorAll('.panel, .marks-panel, .stats-panel, .detail, .hist-panel')]
        .filter((p) => !p.hidden).length;
      return { ok: true, changed: document.body.innerHTML.length !== html, panels };`,
      `      const panels = [...document.querySelectorAll('.panel, .marks-panel, .stats-panel, .detail, .hist-panel')]
        .filter((p) => !p.hidden).length;
      const focused = document.activeElement ? document.activeElement.id : '';
      return { ok: true, changed: document.body.innerHTML.length !== html, panels, focused };`
    );
    s = s.replace(
      "    else if (!r.changed && r.panels === 0) warn(`按鈕 ${id}：按了沒有可見變化`);",
      "    else if (!r.changed && r.panels === 0 && !r.focused) warn(`按鈕 ${id}：按了沒有可見變化`);"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('e2e-buttons.js ok');
  } else console.log('e2e-buttons.js 已改過');
}
