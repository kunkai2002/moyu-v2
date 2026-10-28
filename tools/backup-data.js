'use strict';

/* 關程式前先備份使用者資料（JOJO 的規矩：不准二話不說就關掉）
   ─────────────────────────────────────────────────────────────
   用法：
     node tools/backup-data.js            # 備份到 D:\kun-workspace\backup\moyu-data-<時間>
     node tools/backup-data.js --list     # 看有哪些備份

   備份內容：progress / marks / prefs / settings / window / sync / stats / shelf /
            cookies / cookie / device，外加章節快取索引（chapters 只記檔名不搬內容）。
   不備份：Electron 的 Chromium 快取（Preferences、DIPS、*.db 那些重開就有了）。
   ══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const DATA = path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏', 'data');
const BACKUP_ROOT = path.join('D:\\kun-workspace', 'backup');
const KEEP = [
  'progress.json', 'marks.json', 'prefs.json', 'settings.json', 'window.json',
  'sync.json', 'stats.json', 'shelf.json', 'cookies.json', 'cookie.txt', 'device.json',
];

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

if (process.argv.includes('--list')) {
  if (!fs.existsSync(BACKUP_ROOT)) return console.log('（還沒有備份）');
  const dirs = fs.readdirSync(BACKUP_ROOT).filter((f) => f.startsWith('moyu-data-')).sort();
  for (const d of dirs) console.log(d);
  return;
}

if (!fs.existsSync(DATA)) {
  console.error('❌ 找不到使用者資料夾：' + DATA);
  process.exit(2);
}

const out = path.join(BACKUP_ROOT, 'moyu-data-' + stamp());
fs.mkdirSync(out, { recursive: true });

let n = 0;
for (const f of KEEP) {
  const src = path.join(DATA, f);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(out, f));
  n++;
}

/* 章節快取：只留清單，不搬內容（重抓就好） */
const cacheDir = path.join(DATA, 'chapters');
if (fs.existsSync(cacheDir)) {
  const list = fs.readdirSync(cacheDir).filter((f) => f.endsWith('.json'));
  fs.writeFileSync(path.join(out, 'chapters-index.txt'), list.join('\n'), 'utf8');
}

/* 順手記一下當時的進度，方便人看 */
try {
  const prog = JSON.parse(fs.readFileSync(path.join(DATA, 'progress.json'), 'utf8'));
  const lines = ['lastBook: ' + (prog.lastBook || '')];
  for (const [id, v] of Object.entries(prog.books || {})) {
    lines.push(`${id}  第 ${v.chapterNo} 章  ${v.title || ''}  (updated ${v.updated || 0})`);
  }
  fs.writeFileSync(path.join(out, '進度摘要.txt'), lines.join('\n') + '\n', 'utf8');
} catch {}

console.log(`✅ 已備份 ${n} 個檔案 → ${out}`);
