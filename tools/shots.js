// 產生 6 個主題的靜態快照頁，給截圖用
const fs = require('fs');
const path = require('path');

const uiDir = path.join(__dirname, '..', 'ui');
const outDir = path.join(uiDir, '_shot');
fs.mkdirSync(outDir, { recursive: true });

const THEMES = ['claude-code', 'claude', 'vscode', 'excel', 'terminal', 'word'];
let src = fs.readFileSync(path.join(uiDir, 'index.html'), 'utf8');

src = src.replace('href="theme.css"', 'href="../theme.css"');
src = src.replace('src="app.js"', 'src="../app.js"');

for (const t of THEMES) {
  const inject = `<script>window.MOYU_FORCE_THEME=${JSON.stringify(t)};window.MOYU_INSTANT=true;</script>\n`;
  const html = src
    .replace(/data-theme="[^"]*"/, `data-theme="${t}"`)
    .replace('<script src="../app.js"></script>', inject + '<script src="../app.js"></script>');
  fs.writeFileSync(path.join(outDir, `${t}.html`), html, 'utf8');
  console.log('wrote', `${t}.html`);
}
