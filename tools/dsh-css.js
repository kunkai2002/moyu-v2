// 從 DSH 打包後的 client.js 抽出 CSS 字串，印成可讀的 CSS
// 用法：node tools/dsh-css.js <dir-or-file> [...]
//   目錄：掃該目錄下所有 .js 的 `const cssXXX = "..."`
const fs = require('fs');
const path = require('path');

const files = [];
for (const a of process.argv.slice(2)) {
  const st = fs.existsSync(a) ? fs.statSync(a) : null;
  if (!st) continue;
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(a)) if (/\.js$/.test(f)) files.push(path.join(a, f));
  } else files.push(a);
}

function unesc(s) {
  return s.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /(?:const|let|var)\s+(css[A-Za-z0-9_$]*)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  let m, n = 0;
  while ((m = re.exec(src))) {
    const name = m[1];
    const css = unesc(m[2]);
    const at = src.slice(Math.max(0, m.index - 200), m.index).split('\n').pop();
    console.log(`\n/* ===== ${path.basename(f)} : ${name} (${css.length} chars) ===== */`);
    console.log(css.replace(/}/g, '}\n').replace(/\{/g, ' {\n  ').replace(/;/g, ';\n  '));
    n++;
  }
  if (!n) console.log(`/* ${path.basename(f)}: no css var found */`);
}
