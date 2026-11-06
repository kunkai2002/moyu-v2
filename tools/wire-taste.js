// 把 ui/taste.css 接進 index.html（a11y-normalize.css 之後）與 tools/app-files.js
//   node tools/wire-taste.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let n = 0;

{
  const p = path.join(ROOT, 'ui', 'index.html');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('taste.css')) {
    s = s.replace(
      '<link rel="stylesheet" href="a11y-normalize.css">',
      '<link rel="stylesheet" href="a11y-normalize.css">\n<link rel="stylesheet" href="taste.css">'
    );
    fs.writeFileSync(p, s, 'utf8');
    n++; console.log('· index.html 接上 taste.css');
  }
}
{
  const p = path.join(ROOT, 'tools', 'app-files.js');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes("'ui/taste.css'")) {
    s = s.replace("'ui/a11y-tokens.css', 'ui/a11y-normalize.css',", "'ui/a11y-tokens.css', 'ui/a11y-normalize.css', 'ui/taste.css',");
    fs.writeFileSync(p, s, 'utf8');
    n++; console.log('· app-files.js 加上 ui/taste.css');
  }
}
console.log(n ? '✅ 改了 ' + n + ' 處' : '沒有需要改的');
