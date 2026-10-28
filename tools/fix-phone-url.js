// 手機配對網址由 sync 模組自己組（status() 不帶 token，別從那裡拿）
const fs = require('fs');

{
  const f = 'src/sync.js';
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('function phoneUrl')) {
    s = s.replace(
      'function status() {',
      `/* 手機版配對網址（金鑰放 fragment，不會進伺服器 log） */
function phoneUrl() {
  if (!configured()) return '';
  return String(state.url).replace(/\\/+$/, '') + '/m/#t=' + encodeURIComponent(state.token || '');
}

function status() {`
    );
    s = s.replace(
      "module.exports = { init, configure, push, pull, status, configured };",
      "module.exports = { init, configure, push, pull, status, configured, phoneUrl };"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('sync.js ok');
  } else console.log('sync.js 已有 phoneUrl');
}

{
  const f = 'main.js';
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('const base = String(st.url || ')) {
    s = s.replace(
      "      const base = String(st.url || '').replace(/\\/+$/, '');\n"
      + "      return {\n"
      + "        ok: !!j.ok, ...j, url: st.url,\n"
      + "        phoneUrl: base ? base + '/m/#t=' + encodeURIComponent(st.token || '') : '',\n"
      + "      };",
      "      return { ok: !!j.ok, ...j, url: st.url, phoneUrl: syncer.phoneUrl() };"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('main.js ok');
  } else console.log('main.js 已是新版寫法');
}
