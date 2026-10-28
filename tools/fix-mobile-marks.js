// 手機版劃線：段落要帶自己的章節與序號，不能跨章一起數
const fs = require('fs');
const f = 'sync/m/app.js';
let s = fs.readFileSync(f, 'utf8');
const must = (a, tag) => { if (!s.includes(a)) { console.error('❌ 錨點失效: ' + tag); process.exit(1); } };

must(`    (r.paragraphs || []).forEach(function (text) {
      var p = document.createElement('p');
      p.className = 'p';
      p.textContent = text;
      p.addEventListener('click', function () { toggleMark(p); });
      box.appendChild(p);
    });`, 'render paragraphs');

s = s.replace(`    (r.paragraphs || []).forEach(function (text) {
      var p = document.createElement('p');
      p.className = 'p';
      p.textContent = text;
      p.addEventListener('click', function () { toggleMark(p); });
      box.appendChild(p);
    });`, `    (r.paragraphs || []).forEach(function (text, idx) {
      var p = document.createElement('p');
      p.className = 'p';
      p.textContent = text;
      p.dataset.para = String(idx);
      p.dataset.chapter = ch.id;
      p.addEventListener('click', function () { toggleMark(p); });
      box.appendChild(p);
    });`);

must(`  function paintMarks(box, chapterId) {
    var ps = box.querySelectorAll('.p');
    var list = state.marks.filter(function (m) { return m.chapter_id === chapterId && !m.deleted; });
    ps.forEach(function (p, i) {
      var hit = list.some(function (m) { return Number(m.para) === i; });
      p.classList.toggle('marked', hit);
    });
  }`, 'paintMarks');

s = s.replace(`  function paintMarks(box, chapterId) {
    var ps = box.querySelectorAll('.p');
    var list = state.marks.filter(function (m) { return m.chapter_id === chapterId && !m.deleted; });
    ps.forEach(function (p, i) {
      var hit = list.some(function (m) { return Number(m.para) === i; });
      p.classList.toggle('marked', hit);
    });
  }`, `  function paintMarks(box, chapterId) {
    var list = state.marks.filter(function (m) { return m.chapter_id === chapterId && !m.deleted; });
    var set = {};
    list.forEach(function (m) { set[Number(m.para)] = 1; });
    box.querySelectorAll('.p').forEach(function (p) {
      if (p.dataset.chapter !== chapterId) return;
      p.classList.toggle('marked', !!set[Number(p.dataset.para)]);
    });
  }`);

must(`    var box = p.parentElement;
    var idx = Array.prototype.indexOf.call(box.querySelectorAll('.p'), p);`, 'toggleMark idx');

s = s.replace(`    var box = p.parentElement;
    var idx = Array.prototype.indexOf.call(box.querySelectorAll('.p'), p);`, `    var idx = Number(p.dataset.para);
    var chId = p.dataset.chapter || ch.id;`);

s = s.replace("    var id = ch.id + '-' + idx + '-highlight';", "    var id = chId + '-' + idx + '-highlight';");
s = s.replace(
  "        action: 'save', id: id, book_id: state.book.id, chapter_id: ch.id,",
  "        action: 'save', id: id, book_id: state.book.id, chapter_id: chId,"
);
s = s.replace(
  "    await api('/api/marks', { method: 'POST', body: payload });\n    await loadMarks(state.book.id);",
  "    await api('/api/marks', { method: 'POST', body: payload });\n    await loadMarks(state.book.id);\n    paintMarks(p.parentElement, chId);"
);

if (!s.includes('data-para')) { console.error('❌ 改動沒生效'); process.exit(1); }
fs.writeFileSync(f, s, 'utf8');
console.log('sync/m/app.js: 段落自帶章節與序號');
