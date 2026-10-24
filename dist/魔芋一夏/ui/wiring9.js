/* 同步設定：URL / Token / 立即同步 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const B = window.moyu;
  const body = $('#panel .panel-body');
  if (!B || !body) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="row"><span>同步</span><span class="muted" id="syncState">檢查中…</span></div>
    <div class="row"><span>網址</span><input id="syncUrl" placeholder="https://moyu-sync.xxx.workers.dev" spellcheck="false"></div>
    <div class="row"><span>金鑰</span><input id="syncToken" placeholder="SYNC_TOKEN" spellcheck="false" type="password"></div>
    <div class="row"><span></span>
      <button class="btn" id="syncSave">儲存</button>
      <button class="btn" id="syncNow">立即同步</button>
    </div>`;
  body.appendChild(wrap);

  const st = wrap.querySelector('#syncState');
  const urlIn = wrap.querySelector('#syncUrl');
  const tokIn = wrap.querySelector('#syncToken');

  async function refresh() {
    try {
      const s = await B.sync.status();
      st.textContent = s.configured
        ? `已設定 · ${s.deviceId}` + (s.lastSync ? ` · 上次 ${new Date(s.lastSync).toLocaleTimeString()}` : '')
        : '未設定';
      urlIn.value = s.url || '';
    } catch { st.textContent = '讀不到狀態'; }
  }
  refresh();

  wrap.querySelector('#syncSave').addEventListener('click', async () => {
    await B.sync.config({ url: urlIn.value.trim(), token: tokIn.value.trim() });
    tokIn.value = '';
    await refresh();
  });

  wrap.querySelector('#syncNow').addEventListener('click', async () => {
    st.textContent = '同步中…';
    try {
      const p = await B.sync.push();
      const l = await B.sync.pull();
      st.textContent = `已同步 · 上傳 ${p.applied || 0} · 下載 ${l.progress || 0} 進度 / ${l.marks || 0} 標記`;
    } catch (e) {
      st.textContent = '失敗：' + (e.message || e);
    }
  });
})();
