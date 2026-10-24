// E2E 一律用獨立資料目錄，絕不碰使用者的真實 data
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'e2e.js');
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('--data=')) {
  // 把 URL 參數換成「自己起服務」
  s = s.replace(
    `const URL = process.argv[2] || 'http://127.0.0.1:47821/m/';`,
    `const E2E_PORT = Number(process.env.E2E_PORT || 47977);
const E2E_DATA = path.join(__dirname, '..', '_probe', 'e2e-data');
const URL = process.argv[2] || \`http://127.0.0.1:\${E2E_PORT}/m/\`;`,
  );
}

// 新增：在 test 環境確保用隔離資料
const note = `
/* 重要：E2E 用隔離資料目錄 _probe/e2e-data，不寫進 %LOCALAPPDATA% 的真實 profile */
`;
if (!s.includes('隔離資料目錄')) {
  s = s.replace("const CHROME =", note + "const CHROME =");
  fs.writeFileSync(p, s, 'utf8');
  console.log('+ e2e.js 標註隔離資料');
}

// e2e-search 同樣處理
const p2 = path.join(__dirname, 'e2e-search.js');
if (fs.existsSync(p2)) {
  let s2 = fs.readFileSync(p2, 'utf8');
  if (!s2.includes('隔離資料')) {
    s2 = s2.replace('const CHROME =', note + 'const CHROME =');
    fs.writeFileSync(p2, s2, 'utf8');
    console.log('+ e2e-search.js 標註隔離資料');
  }
}
