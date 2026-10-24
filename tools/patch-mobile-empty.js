// 手機版空狀態：插圖 + 登入按鈕，去掉開發者文案
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── m.js：空狀態 / 錯誤狀態 ── */
const jsPath = path.join(ROOT, 'ui', 'm', 'm.js');
let js = fs.readFileSync(jsPath, 'utf8');

js = js.replace(
  `      if (!r.ok) {
        state.textContent = r.error || '書架是空的';
        grid.innerHTML = '';
        return;
      }
      st.shelf = r.books || [];
      state.textContent = st.shelf.length ? '' : '書架是空的';`,
  `      if (!r.ok) { emptyState(state, grid, r.error || '還沒登入'); return; }
      st.shelf = r.books || [];
      if (!st.shelf.length) { emptyState(state, grid, 'empty'); return; }
      state.textContent = '';`,
);

js = js.replace(
  `    } catch (e) {
      state.innerHTML = '連不上本機服務（請確認電腦端的魔芋一夏有開著）'
        + '<button id="mRetry" style="margin-left:8px;color:#ff6b35">重試</button>';
      grid.innerHTML = '';
      document.getElementById('mRetry')?.addEventListener('click', loadShelf);
    }`,
  `    } catch (e) {
      emptyState(state, grid, 'offline');
    }`,
);

// 插入 emptyState 函式（放在 loadShelf 之前）
js = js.replace(
  '  async function loadShelf() {',
  `  const ART = {
    login: "<circle cx='32' cy='26' r='9'/><path d='M14 54c0-10 8-16 18-16s18 6 18 16'/>",
    book: "<path d='M12 10h24a6 6 0 0 1 6 6v38H18a6 6 0 0 0-6 6z'/><path d='M12 10v50'/>",
    wifi: "<path d='M10 40a30 30 0 0 1 44 0'/><path d='M20 49a18 18 0 0 1 24 0'/><circle cx='32' cy='57' r='2'/>",
  };
  function emptyState(stateEl, gridEl, kind) {
    gridEl.innerHTML = '';
    const conf = {
      login:   { art: 'login', t: '還沒有登入', d: '用抖音或番茄 App 掃一下，書架就會出現在這裡', btn: '立即登入', run: () => $('#btnLogin').click() },
      empty:   { art: 'book',  t: '書架是空的', d: '在番茄裡收藏幾本，這裡就會同步過來',     btn: '重新整理', run: loadShelf },
      offline: { art: 'wifi',  t: '連不上電腦', d: '請確認電腦端的魔芋一夏還開著，兩台在同一個 Wi-Fi', btn: '重試', run: loadShelf },
    }[kind] || { art: 'book', t: kind, d: '', btn: '重試', run: loadShelf };

    stateEl.innerHTML = \`
      <div class="empty">
        <svg viewBox="0 0 64 64" class="empty-art">\${ART[conf.art]}</svg>
        <b>\${conf.t}</b>
        <span>\${conf.d}</span>
        <button class="empty-btn">\${conf.btn}</button>
        <button class="empty-link">或貼上書號開書</button>
      </div>\`;
    stateEl.querySelector('.empty-btn').addEventListener('click', conf.run);
    stateEl.querySelector('.empty-link').addEventListener('click', () => {
      document.querySelector('.tab[data-tab="search"]').click();
      setTimeout(() => $('#q').focus(), 120);
    });
  }

  async function loadShelf() {`,
);

fs.writeFileSync(jsPath, js, 'utf8');
console.log('+ 空狀態');

/* ── m.css：空狀態樣式 ── */
const cssPath = path.join(ROOT, 'ui', 'm', 'm.css');
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.empty-art')) {
  css += `
/* ── 空狀態 ── */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;padding:56px 24px;text-align:center}
.empty-art{width:64px;height:64px;fill:none;stroke:#d8d3cc;stroke-width:2.2;
  stroke-linecap:round;stroke-linejoin:round;margin-bottom:6px}
.empty b{font-size:15.5px;font-weight:600;color:var(--t1)}
.empty span{font-size:12.5px;color:var(--t3);line-height:1.7;max-width:24ch}
.empty-btn{margin-top:14px;background:var(--orange);color:#fff;border-radius:22px;
  padding:11px 30px;font-size:14.5px;font-weight:500;box-shadow:0 2px 10px rgba(255,107,53,.28)}
.empty-btn:active{transform:scale(.97);transition:transform .12s var(--ease)}
.empty-link{margin-top:10px;color:var(--t3);font-size:12.5px}
.empty-link:active{color:var(--orange)}
`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('+ 空狀態樣式');
}

/* ── index.html：補 meta ── */
const htmlPath = path.join(ROOT, 'ui', 'm', 'index.html');
let h = fs.readFileSync(htmlPath, 'utf8');
if (!h.includes('mobile-web-app-capable')) {
  h = h.replace('<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">');
  fs.writeFileSync(htmlPath, h, 'utf8');
  console.log('+ mobile-web-app-capable');
}
