// marks.remove 兩種簽名都吃；標記清單顯示「位置」
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

{
  const f = p('ui/preload.js');
  let s = fs.readFileSync(f, 'utf8');
  must(s, "    remove: (payload) => ipcRenderer.invoke('marks:remove', payload),", 'preload marks remove');
  s = s.replace(
    "    remove: (payload) => ipcRenderer.invoke('marks:remove', payload),",
    "    // 兩種呼叫方式都支援：remove(bookId, id) 或 remove({ bookId, id })\n"
    + "    remove: (a, b) => ipcRenderer.invoke('marks:remove',\n"
    + "      (a && typeof a === 'object') ? a : { bookId: a, id: b }),"
  );
  fs.writeFileSync(f, s, 'utf8');
  console.log('preload.js ok');
}

{
  const f = p('ui/wiring4.js');
  let s = fs.readFileSync(f, 'utf8');
  must(s, "${m.type === 'bookmark' ? '· 書籤' : ''}", 'wiring4 label');
  s = s.replace(
    "${m.type === 'bookmark' ? '· 書籤' : ''}",
    "${m.type === 'bookmark' ? '· 書籤' : (m.type === 'pos' ? '· 位置' : '')}"
  );
  fs.writeFileSync(f, s, 'utf8');
  console.log('wiring4.js ok');
}
