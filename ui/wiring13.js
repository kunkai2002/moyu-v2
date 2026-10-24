/* 公開網址（Cloudflare Tunnel）：顯示 + 複製 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const B = window.moyu;
  const body = $('#panel .panel-body');
  if (!B?.tunnel || !body) return;

  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = '<span>公開網址</span><span class="muted" id="tnUrl">未啟動</span>';
  body.appendChild(row);

  const row2 = document.createElement('div');
  row2.className = 'row';
  row2.innerHTML = '<span></span><button class="btn" id="tnCopy">複製手機網址</button>';
  body.appendChild(row2);

  let current = '';

  async function refresh() {
    const el = $('#tnUrl');
    try {
      const r = await B.tunnel();
      if (r.url) {
        current = r.url;
        el.textContent = r.url.replace(/^https:\/\//, '').slice(0, 34) + '…';
        el.style.color = 'var(--ok)';
      } else {
        current = '';
        el.textContent = '未啟動（雙擊 隧道.cmd）';
        el.style.color = '';
      }
    } catch {
      el.textContent = '讀不到';
    }
  }

  $('#tnCopy')?.addEventListener('click', async () => {
    if (!current) { alert('隧道還沒啟動，請先雙擊 隧道.cmd'); return; }
    try { await navigator.clipboard.writeText(current); } catch {}
    $('#tnCopy').textContent = '已複製';
    setTimeout(() => { $('#tnCopy').textContent = '複製手機網址'; }, 1500);
  });

  // 打開設定面板時更新
  new MutationObserver(() => { if (!$('#panel')?.hidden) refresh(); })
    .observe($('#panel'), { attributes: true, attributeFilter: ['hidden'] });
  refresh();
  setInterval(refresh, 30000);
})();
