/* 思考鏈（reasoning block）
   ─────────────────────────────────────────────────────────────
   偽裝成 AI 編碼工具「回覆前的推理過程」：Cursor／ChatGPT 那種思考塊。

   · 進行中：spinner ＋「思考中 · 1.4s」＋收合箭頭，下面 2–5 行推理逐行浮現
   · 其中 1–2 行先閃一個更短／不同措辭 200–400ms，再定稿
     （JOJO 2026-11-04：「時不時閃過一些類似思考的文字，讓人以為真的在思考」）
   · 結束：收合成單行「已完成思考 · 3.2s · 128 tok」；點 header 展開／收合，
     展開喜好記 localStorage.moyu.think.doneOpen（預設收合）
   · 全長 2–5 秒；不自動捲動、不碰 .p／data-pi、每個助手回覆只插一塊、重掃不重複
   · prefers-reduced-motion：不 shimmer、不淡入、不閃，行直接全部顯示（長度一樣 2–5 秒）

   顏色一律走主題代幣（--fg3/--fg2/--line/--acc），尺寸與動效走 ui/dsh-tokens.css 的 --dsh-*。
   接線（Lead 做）：
     index.html 加 <link rel="stylesheet" href="reasoning.css"> 與 <script src="reasoning.js"></script>
     tools/app-files.js 的 FILES 加 'ui/reasoning.css','ui/reasoning.js'（漏了雲端版會白屏）
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__moyuReasoning) return;

  var VERSION = '1.0.0';
  var PREF_DONE_OPEN = 'moyu.think.doneOpen';

  /* 推理片段：[定稿, 先閃的短句]。全部走工具語彙，
     不准出現 書／章／讀／頁／目錄（思考列屬於外殼，disguise-gate 會擋）。 */
  var PHRASES = [
    ['整理上下文，先把前後段接起來', '整理上下文…'],
    ['比對前面的稱呼，確認是同一個人', '對一下稱呼'],
    ['確認時間線沒有跳', '對時間線'],
    ['把重複的句子挑掉', '去重…'],
    ['這段的節奏偏慢，先保留原句', '節奏偏慢'],
    ['檢查代名詞指向，別讓兩個「他」指錯人', '誰指的是誰？'],
    ['上一句轉折太硬，換個銜接', '轉折太硬'],
    ['句尾語氣跟前面統一一下', '統一語氣'],
    ['名字第一次出現，翻前文確認寫法', '確認名字寫法'],
    ['資訊密度太高，拆成兩個短句', '太密了，拆開'],
    ['翻回三段前，這裡先埋一個呼應', '埋個呼應'],
    ['長句切成兩口氣，標點補上', '切兩口氣'],
    ['對白太整齊了，加一點停頓', '對白太順'],
    ['接上一段結尾，確認縫得起來', '接得上嗎'],
    ['時間副詞重複了，換一個', '副詞重複'],
    ['「忽然」改成「冷不防」，語氣更貼', '換個詞'],
    ['數字跟前文對一次', '數字對一下'],
    ['這句留白夠了，不用再解釋', '留白夠了'],
    ['重掃一遍，確認沒有跳視角', '再掃一遍'],
    ['同一個比喻用過了，換掉', '比喻重複'],
    ['段落長短交錯，別從頭密到尾', '長短交錯'],
    ['這裡少一個逗號，句子會斷', '少個逗號'],
    ['因果關係寫反了，調順', '因果反了'],
    ['把「於是」拿掉，句子更乾淨', '刪兩個字'],
    ['上一段埋的線索要收回來，先記著', '線索要回收'],
    ['確認場景沒有重複描述', '場景重複？'],
    ['這句話可以再短一點', '再短一點'],
    ['檢查錯字和異體字寫法', '錯字掃一遍'],
    ['前後兩段語氣差太多，拉近', '語氣差太多'],
    ['收尾留一個懸念，別講滿', '收尾留白'],
    ['刪掉解釋性的句子，讓動作自己說', '砍掉解釋'],
    ['同一個角色說話方式要一致', '角色語氣'],
    ['這一段資訊夠了，收在動作上', '收在動作'],
    ['引號成對了嗎？再對一次', '引號成對？'],
    ['破折號用得太多，換掉一半', '破折號太多'],
    ['把上一版改動的地方再看一眼', '掃一眼改動'],
    ['這段留著不動，其餘只做微調', '只微調'],
    ['先把結論壓到最後一句', '結論往後放'],
  ];

  var MQ = (window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null);
  var tidSeq = 0;

  function reduced() { return !!(MQ && MQ.matches); }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function nowMs() {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  }
  function icon(name, size) {
    return (window.MOYU_ICONS && window.MOYU_ICONS.svg(name, size)) || '';
  }
  function readPref() { try { return localStorage.getItem(PREF_DONE_OPEN); } catch (e) { return null; } }
  function savePref(v) { try { localStorage.setItem(PREF_DONE_OPEN, v); } catch (e) {} }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 回覆本身的字數 → 假裝是這次思考燒掉的 token（≈ 內容 5–7%，跟前例 128 tok 同量級） */
  function guessTokens(pb) {
    var s = '';
    var ps = pb ? pb.querySelectorAll('.p') : [];
    for (var i = 0; i < ps.length; i++) s += ps[i].textContent || '';
    var chars = s.replace(/\s+/g, '').length;
    if (!chars) return 0;
    return Math.max(40, Math.round(chars * rnd(0.05, 0.07)));
  }

  function setOpen(block, open) {
    block.dataset.open = open ? '1' : '0';
    var h = block.querySelector('.think-h');
    if (h) h.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function makeLine(body, text, index) {
    var row = document.createElement('div');
    row.className = 'think-l';
    row.dataset.li = String(index);
    var bu = document.createElement('span');
    bu.className = 'think-bu';
    bu.textContent = '·';
    var tx = document.createElement('span');
    tx.className = 'think-tx';
    tx.textContent = text;
    row.appendChild(bu);
    row.appendChild(tx);
    body.appendChild(row);
    return row;
  }

  function attach(b, pb) {
    var block = document.createElement('div');
    block.className = 'think';
    block.dataset.state = 'run';
    block.dataset.open = '1';
    block.dataset.tid = 't' + (++tidSeq);
    block.dataset.t0 = String(Date.now());
    block.setAttribute('role', 'group');
    block.setAttribute('aria-label', '推理過程');

    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'think-h';
    head.setAttribute('aria-expanded', 'true');

    var ico = document.createElement('span');
    ico.className = 'think-ico';
    ico.innerHTML = '<span class="think-spin"></span>';

    var label = document.createElement('span');
    label.className = 'think-t';
    label.textContent = '思考中';

    var dot1 = document.createElement('span');
    dot1.className = 'think-dot';
    dot1.textContent = '·';

    var sec = document.createElement('span');
    sec.className = 'think-sec';
    sec.textContent = '0.0s';

    var dot2 = document.createElement('span');
    dot2.className = 'think-dot';
    dot2.textContent = '·';
    dot2.hidden = true;

    var tok = document.createElement('span');
    tok.className = 'think-tok';
    tok.textContent = '0 tok';
    tok.hidden = true;

    var car = document.createElement('span');
    car.className = 'think-car';
    car.innerHTML = icon('chevronDown', 14);

    head.appendChild(ico);
    head.appendChild(label);
    head.appendChild(dot1);
    head.appendChild(sec);
    head.appendChild(dot2);
    head.appendChild(tok);
    head.appendChild(car);

    var body = document.createElement('div');
    body.className = 'think-body';

    block.appendChild(head);
    block.appendChild(body);
    b.insertBefore(block, pb);

    var started = nowMs();
    var timers = [];

    function later(ms, fn) {
      timers.push(setTimeout(function () {
        if (!block.isConnected) return;
        fn();
      }, ms));
    }

    var ticker = setInterval(function () {
      if (!block.isConnected) { clearInterval(ticker); return; }
      if (block.dataset.state !== 'run') return;
      sec.textContent = ((nowMs() - started) / 1000).toFixed(1) + 's';
    }, 100);

    head.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = block.dataset.open !== '1';
      setOpen(block, open);
      if (block.dataset.state === 'done') savePref(open ? '1' : '0');
    });

    function finish() {
      if (!block.isConnected) { clearInterval(ticker); return; }
      clearInterval(ticker);
      for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
      timers.length = 0;

      var secs = Math.max(0, (nowMs() - started) / 1000);
      block.dataset.state = 'done';
      block.dataset.t1 = String(Date.now());
      label.textContent = '已完成思考';
      sec.textContent = secs.toFixed(1) + 's';
      var n = guessTokens(pb);
      if (n > 0) {
        tok.textContent = n.toLocaleString() + ' tok';
        tok.hidden = false;
        dot2.hidden = false;
      }
      ico.innerHTML = icon('check', 12);
      /* 結束後預設收合成單行；使用者上次展開過就照他的 */
      setOpen(block, readPref() === '1');
    }

    var n = rint(2, 5);
    var lines = shuffle(PHRASES).slice(0, n);

    if (reduced()) {
      /* 減少動態：行全部直接顯示（不淡入、不 flash），長度照樣 2–5 秒 */
      for (var i = 0; i < lines.length; i++) makeLine(body, lines[i][0], i);
      later(rint(2200, 4000), finish);
      return;
    }

    /* 1–2 行先閃：先看到短句 200–400ms，再換成定稿 */
    var flashCount = n >= 4 ? rint(1, 2) : 1;
    var order = shuffle(lines.map(function (_, i) { return i; })).slice(0, flashCount);
    var flash = {};
    for (var f = 0; f < order.length; f++) flash[order[f]] = rint(200, 400);

    /* 逐行用「實際時間」排：這一行真的出現後再等 300–700ms 放下一個。
       不用「預先算好絕對時間」那種寫法——計時器被延遲時，兩行會黏在一起（JOJO 要的是逐行）。 */
    var wantTotal = rint(2200, 4600);   // 整體節奏 2–5 秒

    function finishAfterSettle() {
      var elapsed = nowMs() - started;
      var delay = Math.max(wantTotal - elapsed, 0);
      if (elapsed + delay > 5000) delay = Math.max(0, 5000 - elapsed);
      later(delay, finish);
    }

    function reveal(i) {
      var pair = lines[i];
      var row = makeLine(body, flash[i] ? pair[1] : pair[0], i);
      if (flash[i]) {
        row.dataset.flash = String(flash[i]);   // 規劃停留毫秒（測試要驗 200–400ms 的設計值）
        later(flash[i], function () {
          var tx = row.querySelector('.think-tx');
          if (tx) tx.textContent = pair[0];
        });
      }
      if (i + 1 < n) later(rint(300, 700), function () { reveal(i + 1); });
      else later(rint(450, 900), finishAfterSettle);
    }
    later(rint(200, 380), function () { reveal(0); });
  }

  /* 掃描新出現的助手回覆：一個 .turn.ai（有 .pb 的本體）＝一塊，插在 .pb 前面。
     用 turn.dataset.think 當哨兵，MutationObserver 重掃也不會重複插。 */
  function scan() {
    var stream = document.querySelector('#stream');
    if (!stream) return;
    var turns = stream.querySelectorAll('.turn.ai');
    for (var i = 0; i < turns.length; i++) {
      var turn = turns[i];
      if (turn.dataset.think === '1') continue;
      var b = turn.querySelector(':scope > .b');
      if (!b) continue;
      var pb = b.querySelector(':scope > .pb');
      if (!pb) continue;
      if (pb.querySelector('.meta.loading')) continue;   // 載入中的代理回覆，等真的內容
      if (!b.querySelector('.think')) attach(b, pb);
      turn.dataset.think = '1';
    }
  }

  function boot() {
    scan();
    var stream = document.querySelector('#stream');
    if (!stream) return;
    var mo = new MutationObserver(scan);
    mo.observe(stream, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__moyuReasoning = {
    version: VERSION,
    scan: scan,
    reduced: reduced,
    count: function () { return document.querySelectorAll('#stream .think').length; },
  };
})();
