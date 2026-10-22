// 引擎自測：書頁解析、章節還原、品質檢查
const path = require('path');
const fanqie = require('../src/fanqie');

fanqie.setCharsetPath(path.join(__dirname, '..', 'src', 'charset.json'));

const BOOK = process.argv[2] || '7373660003258862617';

(async () => {
  const r = await fanqie.request(`https://fanqienovel.com/page/${BOOK}`, '');
  const html = r.body;
  console.log('書頁 HTTP', r.status, html.length, 'bytes');

  // 作者線索
  const pats = [
    /<meta name="author" content="([^"]+)"/,
    /href="\/author\/\d+"[^>]*>([^<]{1,20})</,
    /"authorName":"([^"]{1,20})"/,
    /"author":"([^"]{1,20})"/,
    /class="[^"]*author[^"]*"[^>]*>([^<]{1,20})</i,
  ];
  console.log('\n--- 作者線索 ---');
  for (const p of pats) {
    const m = html.match(p);
    console.log(p.source.slice(0, 42).padEnd(44), '→', m ? JSON.stringify(m[1]) : '(無)');
  }

  // 章節連結的上下文
  console.log('\n--- 前 6 個 /reader/ 連結 ---');
  let n = 0;
  for (const m of html.matchAll(/<a[^>]*href="\/reader\/(\d+)"[^>]*>([\s\S]{0,80}?)<\/a>/g)) {
    const t = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    console.log(`  ${m[1]}  ${JSON.stringify(t.slice(0, 30))}`);
    if (++n >= 6) break;
  }

  const book = await fanqie.openBook(BOOK, '');
  console.log('\n--- openBook ---');
  console.log('書名:', book.book.title, '｜作者:', JSON.stringify(book.book.author), '｜章數:', book.book.total);
  console.log('前三章:', book.book.chapters.slice(0, 3).map((c) => `${c.no}:${c.title}`).join(' | '));

  // 找真正的第 1 章
  const c1 = book.book.chapters.find((c) => /第\s*1\s*章/.test(c.title)) || book.book.chapters[1];
  console.log('\n--- 讀第 1 章', c1.title, c1.id, '---');
  const ch = await fanqie.loadChapter(BOOK, c1.id, '');
  console.log('段數:', ch.paragraphs.length, '字數:', ch.chars);
  ch.paragraphs.slice(0, 3).forEach((p, i) => console.log(`  [${i}] ${p}`));

  // 品質：不該再有 PUA
  const pua = [...ch.paragraphs.join('')].filter((c) => {
    const cp = c.codePointAt(0);
    return cp >= 0xe000 && cp <= 0xf8ff;
  });
  const latin = (ch.paragraphs.join('').match(/[A-Za-z]/g) || []).length;
  console.log('\n殘留 PUA:', pua.length, '｜英文字母:', latin);
  console.log(pua.length === 0 ? '✅ 還原乾淨' : '❌ 還有未映射字元');
})();
