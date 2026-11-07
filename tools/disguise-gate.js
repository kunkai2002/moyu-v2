/* 偽裝閘門（disguise gate）
   ─────────────────────────────────────────────────────────────
   一個「上班摸魚」的界面，只要使用者一眼掃到就知道是閱讀器 → 失敗。
   做法：把介面文字抓出來，黑名單一律不准出現；工具語彙至少要有幾個。
   這是結構性閘門，不是靠提醒：改壞了 check-all 直接紅，推不出去。
   用法：node tools/disguise-gate.js <html...> */
'use strict';
const fs = require('fs');
const path = require('path');

/* 2026-11-07 起 DSH 殼的介面字是簡體、cc 殼是英文（照真工具）——黑名單三種寫法都要擋，
   不然「书架／目录」「Bookshelf／Chapter」會直接溜過去 */
const BAD = [
  /示例書/, /小說/, /閱讀器/, /閱讀中/, /未開始/, /讀到第/, /第\s*\d+\s*章/,
  /書架/, /藏書/, /字體大小/, /書名/, /目錄/,
  /示例书/, /小说/, /阅读器/, /阅读中/, /未开始/, /读到第/, /书架/, /藏书/, /字体大小/, /书名/, /目录/,
  /\bnovels?\b/i, /\bchapters?\b/i, /\bbookshel(f|ves)\b/i, /\bebook\b/i, /\breading progress\b/i,
];
const GOOD = [/工作區|工作区|workspace/i, /檔案|文件|file|src\//i, /assistant|user|会话|session/i, /tok|token|diff|commit/i];

function scan(html) {
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // 屬性裡的 title/placeholder 也算介面文字
    .replace(/<[^>]*\b(?:title|placeholder|aria-label)="([^"]*)"/gi, ' $1 ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ');
  const bad = [];
  for (const re of BAD) {
    const m = text.match(re);
    if (m) bad.push(m[0]);
  }
  const good = GOOD.filter((re) => re.test(text)).length;
  return { bad: [...new Set(bad)], good };
}

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('用法：node tools/disguise-gate.js <html...>');
  process.exit(2);
}
let fail = 0;
for (const f of targets) {
  if (!fs.existsSync(f)) { console.log('跳過（不存在）', f); continue; }
  const r = scan(fs.readFileSync(f, 'utf8'));
  const ok = r.bad.length === 0 && r.good >= 1;
  const msg = ok ? '工具語彙 ' + r.good + ' 項' : JSON.stringify(r);
  console.log((ok ? '✅' : '❌'), path.basename(f), msg);
  if (!ok) fail++;
}
process.exit(fail ? 1 : 0);
