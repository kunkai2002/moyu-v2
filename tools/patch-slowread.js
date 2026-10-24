// 一次性補丁：預設不逐字串流（用 Node 讀寫，保證 UTF-8）
const fs = require('fs');
const p = require('path').join(__dirname, '..', 'ui', 'app.js');
let s = fs.readFileSync(p, 'utf8');
let changed = 0;

if (!s.includes('slowRead:')) {
  s = s.replace('  autoRead: false,', '  autoRead: false,\n  slowRead: false,');
  changed++;
}

const head = 'function streamParagraphs(container, paras, onDone) {\n  stopStreaming();\n';
if (!s.includes('if (!state.slowRead)')) {
  s = s.replace(head, head + `
  // 預設一次畫完；只有開啟「慢讀」才逐字吐
  if (!state.slowRead) {
    for (const t of paras) container.appendChild(el('p', 'p', t));
    scrollBottom();
    onDone && onDone();
    return;
  }
`);
  changed++;
}

fs.writeFileSync(p, s, 'utf8');
console.log(changed ? `套用 ${changed} 處修改` : '無需修改');
