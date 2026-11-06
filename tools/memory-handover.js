// 在 MEMORY.md 追加一段「交接」指標（node 寫檔才是正確 UTF-8，不要用 PowerShell）
//   node tools/memory-handover.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'MEMORY.md');
let s = fs.readFileSync(p, 'utf8');
const MARK = '## 交接（2026-11-06）';
if (s.includes(MARK)) { console.log('已經有交接段，跳過'); process.exit(0); }

s = s.trimEnd() + `

${MARK}
- **先讀 \`docs/交接_20261106.md\`**（185 行：架構、真值鏈、版面策略、測試、發布、陷阱、決策）。
- **發布順序不能顛倒**：改 ui → \`node tools/pack4.js\` → \`node tools/publish-app.js\` → 再同步安裝目錄。
  反過來做的檔案會被 app 內建熱更新（每 5 分鐘）從雲端**無聲還原**，追 bug 會追到瘋。
- **新增 ui 檔案一定要加進 \`tools/app-files.js\` 的 \`FILES\`**（發布白名單，72 個），漏了就是白屏。
- **版面定案**：側欄永遠 280（只有手動才收 56）、目錄 ≥1100 dock / <1100 抽屜、底部翻章列已刪、
  Enter＝空白翻頁／有字送出、翻頁出字＝邊吐邊把頁往上頂（時間軸 2 秒、一段打完才下一段）。
- **不要用 PowerShell 寫 UTF-8 或跑 \`node -e\` 帶引號的程式**：一律寫 \`tools/patch-*.js\` 再 \`node\` 跑。
- 驗收五件套：\`layout-gate\` / \`ui-lint\` / \`test-reveal\` / \`audit-chat-ui\` / \`test-mirror\`。
`;

fs.writeFileSync(p, s, 'utf8');
console.log('✅ MEMORY.md 追加交接指標');
