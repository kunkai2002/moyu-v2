// 手機網址要帶金鑰（#t=...）才能一開就配對好；順手修 e2e 的插入腳本
const fs = require('fs');

/* 1. main.js：sync:setup 回傳 phoneUrl */
{
  const f = 'main.js';
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('phoneUrl')) {
    s = s.replace(
      "      const j = await r.json().catch(() => ({}));\n      return { ok: !!j.ok, ...j, url: st.url };",
      "      const j = await r.json().catch(() => ({}));\n"
      + "      const base = String(st.url || '').replace(/\\/+$/, '');\n"
      + "      return {\n"
      + "        ok: !!j.ok, ...j, url: st.url,\n"
      + "        phoneUrl: base ? base + '/m/#t=' + encodeURIComponent(st.token || '') : '',\n"
      + "      };"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('main.js: phoneUrl');
  } else console.log('main.js 已有 phoneUrl');
}

/* 2. ui/phone.js：直接用 phoneUrl */
{
  const f = 'ui/phone.js';
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('phoneUrl')) {
    s = s.replace(
      "      urlEl.value = base ? base.replace(/\\/$/, '') + '/m/' : '';",
      "      urlEl.value = (r && r.phoneUrl) || (base ? base.replace(/\\/$/, '') + '/m/' : '');"
    );
    fs.writeFileSync(f, s, 'utf8');
    console.log('phone.js: phoneUrl');
  } else console.log('phone.js 已有 phoneUrl');
}

/* 3. e2e-buttons.js：加手機面板斷言（用字串拼接避免巢狀模板） */
{
  const f = 'tools/e2e-buttons.js';
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('手機面板：打得開')) {
    const block = [
      '  /* 手機面板 */',
      '  const phone = await page.evaluate(async () => {',
      "    document.querySelector('#tbPhone').click();",
      '    await new Promise((r) => setTimeout(r, 1000));',
      "    const panel = document.querySelector('.phone-panel');",
      "    const url = panel ? panel.querySelector('#phUrl').value : '';",
      '    const open = !!panel && !panel.hidden;',
      '    if (panel) panel.hidden = true;',
      '    return { open, url };',
      '  });',
      "  phone.open ? ok('手機面板：打得開') : bad('手機面板：打不開');",
      "  /\\/m\\/#t=.+/.test(phone.url) ? ok('手機面板：網址帶金鑰') : bad('手機面板：網址不對', phone.url);",
      '',
      '',
    ].join('\n');
    s = s.replace('  /* ── 3. 首頁 ── */', block + '  /* ── 3. 首頁 ── */');
    fs.writeFileSync(f, s, 'utf8');
    console.log('e2e-buttons.js: 手機面板');
  } else console.log('e2e-buttons.js 已有手機面板');
}
