// bridge-http.js 補 marks
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'bridge-http.js');
let s = fs.readFileSync(p, 'utf8');
if (s.includes('marks:')) { console.log('= bridge.marks 已存在'); process.exit(0); }

const anchor = '    copy: async (text) => {';
if (!s.includes(anchor)) { console.log('! 找不到 copy 錨點'); process.exit(1); }

const add = [
  '    marks: {',
  "      list: (bookId) => api('/api/marks?book=' + encodeURIComponent(bookId)),",
  "      save: (m) => post('/api/marks', m),",
  "      remove: (bookId, id) => post('/api/marks', { action: 'remove', bookId, id }),",
  '    },',
  anchor,
].join('\n');

fs.writeFileSync(p, s.replace(anchor, add), 'utf8');
console.log('+ bridge.marks');
