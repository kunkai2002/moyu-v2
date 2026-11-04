// 全套流程：一次跑完所有檢查（不開視窗），最後給一張總表
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const APP = process.env.MOYU_APP || path.join(process.env.LOCALAPPDATA, 'Programs', '魔芋一夏');

const quick = process.argv.includes('--quick');

const STEPS = [
  { name: '自檢（語法/DOM/打包）', cmd: 'node', args: ['tools/selfcheck.js'] },
  { name: '幾何閘門（DSH 真值 ±2px・3 視窗）', cmd: 'node', args: ['tools/layout-gate.js'] },
  { name: '桌面版開機 + 設定/登入', cmd: 'node', args: ['tools/e2e-electron.js', APP] },
  { name: '設定持久化', cmd: 'node', args: ['tools/e2e-persist.js', APP] },
  { name: '連讀 + 記住進度', cmd: 'node', args: ['tools/e2e-flow.js', APP] },
  { name: '一次滑動只接一章', cmd: 'node', args: ['tools/e2e-jump.js', APP] },
  { name: '書架（真帳號）', cmd: 'node', args: ['tools/e2e-shelf.js', APP] },
  { name: '全按鈕自檢', cmd: 'node', args: ['tools/e2e-buttons.js', APP] },
  { name: '頂欄與更多選單', cmd: 'node', args: ['tools/e2e-topbar.js', APP] },
  { name: '視窗狀態記憶', cmd: 'node', args: ['tools/e2e-window.js', APP] },
  { name: '手機後端', cmd: 'node', args: ['tools/test-worker.js'], skip: quick },
  { name: '鏡像站＝同一份 ui/（本機，不碰雲端）', cmd: 'node', args: ['tools/test-mirror.js'], skip: quick },
  // ⚠ e2e-mobile.js 驗的是舊的 sync/m/ 手機殼，Worker 部署新殼（deploy 後）這步會紅；
  //   屆時改跑 `node tools/serve-ui.js --verify`（43 項：390x844 + 1280x720），再把它從 STEPS 移除。
  { name: '手機 PWA（舊殼，deploy 後改 serve-ui --verify）', cmd: 'node', args: ['tools/e2e-mobile.js'], skip: quick },
  { name: '雲端熱更新', cmd: 'node', args: ['tools/e2e-update.js', APP], skip: quick },
  { name: '對話界面驗收', cmd: 'node', args: ['tools/audit-chat-ui.js', APP] },
];

console.log('⚙ 魔芋一夏 · 全套檢查' + (quick ? '（quick：跳過雲端）' : ''));
console.log('  使用安裝位置：' + APP + '\n');

const started = Date.now();
const rows = [];
let failed = 0;

for (const step of STEPS) {
  if (step.skip) { rows.push({ name: step.name, state: 'skip' }); continue; }
  const t0 = Date.now();
  const r = spawnSync(step.cmd, step.args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const out = (r.stdout || '') + '\n' + (r.stderr || '');
  const pass = r.status === 0;
  if (!pass) failed++;
  // 抓出這一步最有代表性的結果行
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
  const summary = lines.filter((l) => /全部通過|項失敗|通過 \d+|❌/.test(l)).slice(-2).join('  ') || (pass ? 'ok' : '失敗');
  rows.push({ name: step.name, state: pass ? 'pass' : 'fail', ms: Date.now() - t0, summary });
  console.log(`${pass ? '✅' : '❌'} ${step.name}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${summary}`);
  if (!pass) {
    console.log('   ── 失敗細節 ──');
    for (const l of lines.filter((x) => x.includes('❌')).slice(0, 6)) console.log('   ' + l);
  }
}

const total = (Date.now() - started) / 1000;
console.log('\n════════ 總表 ════════');
for (const r of rows) {
  const mark = r.state === 'pass' ? '✅' : (r.state === 'skip' ? '⏭' : '❌');
  console.log(`${mark}  ${r.name}${r.ms ? '  ' + (r.ms / 1000).toFixed(1) + 's' : ''}`);
}
console.log(`\n${failed === 0 ? '✅ 全部通過' : `❌ ${failed} 步失敗`} · 總耗時 ${total.toFixed(1)}s`);

const reportPath = path.join(ROOT, '_probe', 'check-all.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify({ at: Date.now(), app: APP, total, rows }, null, 2), 'utf8');
console.log('報告：_probe/check-all.json');

process.exit(failed === 0 ? 0 : 1);
