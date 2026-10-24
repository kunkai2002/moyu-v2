// ① 預覽章節不要進快取 ② 預覽提示改成實話，並把試讀片段顯示出來
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const must = (s, a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

/* ── main.js：預覽結果不快取 ─────────────────────────────── */
{
  const f = p('main.js');
  let s = fs.readFileSync(f, 'utf8');
  must(s, "    store.writeJson(path.join(DATA_DIR, 'chapters', `${chapterId}.json`), r);", 'chapter cache');
  s = s.replace(
    "    store.writeJson(path.join(DATA_DIR, 'chapters', `${chapterId}.json`), r);",
    "    // 只有試讀的結果不要存，之後有完整正文才有機會補上\n"
    + "    if (!r.previewOnly) store.writeJson(path.join(DATA_DIR, 'chapters', `${chapterId}.json`), r);"
  );
  fs.writeFileSync(f, s, 'utf8');
  console.log('main.js ok');
}

/* ── app.js：previewOnly 區塊重寫 ─────────────────────────── */
{
  const f = p('ui/app.js');
  let s = fs.readFileSync(f, 'utf8');
  const start = s.indexOf('  if (r.previewOnly) {');
  if (start < 0) { console.error('❌ 找不到 previewOnly 區塊'); process.exit(1); }
  const endMark = "    body.appendChild(el('div', 'next', `<span class=\"k\">⏎</span><span>繼續下一章</span>`));";
  const end = s.indexOf(endMark, start);
  if (end < 0) { console.error('❌ 找不到 previewOnly 收尾'); process.exit(1); }

  const blk = [
    '  if (r.previewOnly) {',
    "    body.innerHTML = '';",
    "    body.appendChild(el('div', 'meta',",
    "      `<span class=\"warn\">·</span>本章只取到 ${r.chars} 字試讀`));",
    "    for (const para of (r.paragraphs || [])) {",
    "      const d = el('div', 'p');",
    '      d.textContent = para;',
    '      body.appendChild(d);',
    '    }',
    "    body.insertAdjacentHTML('beforeend',",
    "      '<div class=\"toolres\"><div class=\"ln\"><span class=\"bar\">⎿</span><div>' +",
    "        '這一章在免費範圍外，只給試讀片段。<br>' +",
    "        '免費章節可以完整讀；付費章節目前取不到全文。' +",
    '      \'</div></div></div>\');',
    ''
  ].join('\n');

  s = s.slice(0, start) + blk + s.slice(end);
  fs.writeFileSync(f, s, 'utf8');
  console.log('app.js ok');
}
