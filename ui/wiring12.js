/* 更新檢查：比對 GitHub 最新 commit */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const B = window.moyu;
  const body = $('#panel .panel-body');
  if (!B?.update || !body) return;

  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = '<span>版本</span><span class="muted" id="updText">—</span>';
  body.appendChild(row);

  const r2 = document.createElement('div');
  r2.className = 'row';
  r2.innerHTML = '<span></span><button class="btn" id="updCheck">檢查更新</button>';
  body.appendChild(r2);

  const txt = row.querySelector('#updText');

  async function check() {
    txt.textContent = '檢查中…';
    try {
      const r = await B.update.check();
      if (!r.ok) { txt.textContent = '檢查失敗：' + (r.error || ''); return; }
      txt.textContent = r.upToDate
        ? '已是最新（' + r.local + '）'
        : '有新版本：' + r.remote + ' → 本機 ' + r.local;
      txt.style.color = r.upToDate ? 'var(--ok)' : 'var(--acc)';
    } catch (e) {
      txt.textContent = '檢查失敗：' + e.message;
    }
  }

  r2.querySelector('#updCheck').addEventListener('click', check);
  check();
})();
