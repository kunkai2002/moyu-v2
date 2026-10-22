// 測試簽名堆疊：先驗證能不能拿到完整章節
const path = require('path');
const api = require('../src/appapi');

const DATA = path.join(__dirname, '..', 'data');
api.loadDevice(DATA);

const ITEM = process.argv[2] || '7381070904006033945'; // 第39章（網頁版只有 162 字預覽）

(async () => {
  console.log('匿名裝置:', JSON.stringify(api.loadDevice(DATA)));

  console.log('\n[1] 註冊密鑰…');
  try {
    const k = await api.registerKey();
    console.log('   keyver =', k.keyver, ' keyLen =', k.key.length);
  } catch (e) {
    console.log('   ❌', e.message);
    return;
  }

  console.log('\n[2] 取章節正文…');
  try {
    const r = await api.getChapter(ITEM);
    console.log('   標題:', r.title);
    console.log('   段數:', r.paragraphs.length, ' 字數:', r.paragraphs.join('').length);
    r.paragraphs.slice(0, 3).forEach((p, i) => console.log(`   [${i}] ${p.slice(0, 60)}`));
    console.log('\n   ✅ 成功');
  } catch (e) {
    console.log('   ❌', e.message);
  }
})();
