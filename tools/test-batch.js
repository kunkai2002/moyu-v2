// 批次測試：抽多章驗證還原品質與穩定性
const path = require('path');
const fanqie = require('../src/fanqie');

fanqie.setCharsetPath(path.join(__dirname, '..', 'src', 'charset.json'));

const BOOK = process.argv[2] || '7373660003258862617';
const SAMPLE = Number(process.argv[3] || 8);

const puaCount = (s) => [...s].filter((c) => {
  const cp = c.codePointAt(0);
  return cp >= 0xe000 && cp <= 0xf8ff;
}).length;

(async () => {
  console.log('=== 1. 開書 ===');
  const t0 = Date.now();
  const { book } = await fanqie.openBook(BOOK, '');
  console.log(`  ${book.title}  作者=${book.author}  章數=${book.total}  ${Date.now() - t0}ms`);

  const n = book.chapters.length;
  const picks = [];
  for (let i = 0; i < SAMPLE; i++) picks.push(book.chapters[Math.floor((i + 0.5) * n / SAMPLE)]);

  console.log(`\n=== 2. 抽 ${SAMPLE} 章測還原 ===`);
  let totalChars = 0, totalPua = 0, totalLatin = 0, fail = 0;
  for (const c of picks) {
    try {
      const t = Date.now();
      const r = await fanqie.loadChapter(book.id, c.id, '');
      const text = r.paragraphs.join('\n');
      const pua = puaCount(text);
      const latin = (text.match(/[A-Za-z]/g) || []).length;
      totalChars += r.chars; totalPua += pua; totalLatin += latin;
      const flag = pua === 0 && latin < 3 ? '✅' : '⚠️';
      console.log(`  ${flag} 第${c.no}章 ${String(r.chars).padStart(4)}字 ${String(r.paragraphs.length).padStart(3)}段  pua=${pua} latin=${latin}  ${Date.now() - t}ms  ${c.title.slice(0, 16)}`);
    } catch (e) {
      fail++;
      console.log(`  ❌ 第${c.no}章 ${e.message}`);
    }
  }

  console.log(`\n  合計 ${totalChars.toLocaleString()} 字｜殘留 PUA ${totalPua}｜英文字母 ${totalLatin}｜失敗 ${fail}`);

  console.log('\n=== 3. 錯誤處理 ===');
  for (const [name, fn] of [
    ['亂碼書號', () => fanqie.openBook('abc', '')],
    ['不存在的書', () => fanqie.openBook('123456789012345', '')],
  ]) {
    try { await fn(); console.log(`  ${name}: 沒擋住 ❌`); }
    catch (e) { console.log(`  ${name}: 正確報錯「${e.message.slice(0, 30)}」✅`); }
  }

  console.log('\n=== 4. 碼表版本評分 ===');
  const probe = '血！血腥残缺的尸体……阴森恐怖的鬼，你更怕哪个？';
  const fake = [...probe].map((c) => String.fromCodePoint(0xe3e8 + (c.codePointAt(0) % 300))).join('');
  const r = fanqie.deobfuscate(fake);
  console.log(`  選中版本 ${r.table}，未映射 ${r.unmapped}`);

  console.log('\n=== 5. 快取命中 ===');
  const c0 = book.chapters[0];
  const a = Date.now(); await fanqie.loadChapter(book.id, c0.id, ''); const t1 = Date.now() - a;
  console.log(`  抓一次 ${t1}ms（第二次會走 server 端快取）`);

  console.log(`\n${totalPua === 0 && fail === 0 ? '✅ 全部通過' : '❌ 有問題'}`);
})();
