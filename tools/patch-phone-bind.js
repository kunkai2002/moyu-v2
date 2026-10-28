// 手機按鈕由 phone.js 自己綁（不再依賴 shell.js 的時序）；歷史同理已在自己檔案
const fs = require('fs');

{
  const f = 'ui/phone.js';
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('phoneBound')) {
    const old = "  window.__moyuPhone = { toggle: toggle };";
    if (!s.includes(old)) { console.error('❌ phone.js 錨點失效'); process.exit(1); }
    s = s.replace(old, `  /* 自己綁按鈕：不依賴別的檔案的初始化順序 */
  function bindBtn() {
    var b = document.getElementById('tbPhone');
    if (!b || b.dataset.phoneBound) return;
    b.dataset.phoneBound = '1';
    b.addEventListener('click', toggle);
  }
  bindBtn();
  new MutationObserver(bindBtn).observe(document.body, { childList: true, subtree: true });

  window.__moyuPhone = { toggle: toggle };`);
    fs.writeFileSync(f, s, 'utf8');
    console.log('phone.js: 自行綁定');
  } else console.log('phone.js 已有綁定');
}

{
  const f = 'ui/shell.js';
  let s = fs.readFileSync(f, 'utf8');
  const old = `    var phoneBtn = document.querySelector('#tbPhone');
    if (phoneBtn && !phoneBtn.dataset.bound) {
      phoneBtn.dataset.bound = '1';
      phoneBtn.addEventListener('click', function () { window.__moyuPhone && window.__moyuPhone.toggle(); });
    }
`;
  if (s.includes(old)) {
    s = s.replace(old, '');
    fs.writeFileSync(f, s, 'utf8');
    console.log('shell.js: 移除重複的手機綁定');
  } else console.log('shell.js 沒有該段（略過）');
}
