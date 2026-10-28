// 修視窗自檢：位置欄位是 x/y，不是 left/top；並把這支加進全套流程
const fs = require('fs');

{
  const f = 'tools/e2e-window.js';
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(
    "  Math.abs((second.bounds.left ?? 0) - (first.bounds.left ?? 0)) <= 4\n    ? ok(`還原：位置 ${second.bounds.left},${second.bounds.top}`) : bad('還原：位置沒還原', JSON.stringify({ first: first.bounds, second: second.bounds }));",
    "  Math.abs((second.bounds.x ?? 0) - (first.bounds.x ?? 0)) <= 4\n    ? ok(`還原：位置 ${second.bounds.x},${second.bounds.y}`) : bad('還原：位置沒還原', JSON.stringify({ first: first.bounds, second: second.bounds }));"
  );
  fs.writeFileSync(f, s, 'utf8');
  console.log('e2e-window.js: 位置欄位修正');
}

{
  const f = 'tools/check-all.js';
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('e2e-window.js')) {
    s = s.replace(
      "  { name: '全按鈕自檢', cmd: 'node', args: ['tools/e2e-buttons.js', APP] },",
      "  { name: '全按鈕自檢', cmd: 'node', args: ['tools/e2e-buttons.js', APP] },\n"
      + "  { name: '視窗狀態記憶', cmd: 'node', args: ['tools/e2e-window.js', APP] },"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('check-all.js: 加入視窗狀態');
  } else console.log('check-all.js 已有視窗狀態');
}
