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

  var VERSION = '1.1.0';
  var PREF_DONE_OPEN = 'moyu.think.doneOpen';

  /* 推理片段：[定稿, 先閃的短句]。全部走工具語彙，
     不准出現 書／章／節／讀／頁／目錄（思考列屬於外殼，disguise-gate 會擋）。 */
  var PHRASES = [
    ['整理上下文，先把前後段接起來', '整理上下文…'],
    ['比對前面的稱呼，確認是同一個人', '對一下稱呼'],
    ['確認時間線沒有跳', '對時間線'],
    ['把重複的句子挑掉', '去重…'],
    ['這段的速度偏慢，先保留原句', '速度偏慢'],
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
    ['把「總之」開頭的句子改掉', '總之先刪'],
    ['這段對話的停頓不夠，補一個動作', '補個動作'],
    ['前一句的資訊已經講過，刪掉', '這句刪掉'],
    ['檢查段落裡有沒有一句到底的長句', '長句拆開'],
    ['把倒裝句調回正常語序', '語序調順'],
    ['這兩句主語換來換去，統一一下', '主語統一'],
    ['收尾的動作太快，放慢半拍', '收尾放慢'],
    ['補一句環境描述，讓畫面站得住', '補環境描述'],
    ['這句比喻跟前文撞了，換一個', '比喻撞了'],
    ['確認引號裡的語氣沒有跑掉', '引號語氣'],
    ['把「突然」和「忽然」錯開用', '換個副詞'],
    ['這段太順了，留一個不完美的停頓', '留點停頓'],
  ];

  /* 操作記錄素材（工具樣式）：形狀固定成 Read(path)／Grep("詞", dir/)／Diff(+18 −4)…
     檔名、搜尋詞、數字都是**抽選時才組**，所以不會每次一模一樣。
     外殼文字：不准出現 書／章／節／讀／頁／目錄。 */
  var OP_FILES = [
    'src/gateway/report.ts', 'src/routes/portal.ts', 'src/lib/query.ts',
    'src/lib/time.ts', 'src/core/agent.ts', 'src/store/cache.ts',
    'src/ui/stream.ts', 'src/util/text.ts', 'web/src/App.tsx',
    'web/src/api/client.ts', 'web/src/hooks/useTurn.ts', 'scripts/build.mjs',
  ];
  var OP_DIRS = ['src/lib/', 'src/gateway/', 'src/routes/', 'src/core/', 'web/src/', 'scripts/'];
  var OP_TERMS = ['轉折', '稱呼', '時間線', '視角', '伏筆', '語氣', '代名詞', '標點', '停頓', '比喻'];
  var OP_TOOLS = ['audit-chat-ui.js', 'layout-gate.js', 'disguise-gate.js', 'ui-lint.js',
    'click-check.js', 'shot-shell.js', 'test-reasoning.js'];
  var OPS = [
    { type: 'Read', make: function () { return 'Read(' + pick(OP_FILES) + ')'; } },
    { type: 'Grep', make: function () { return 'Grep("' + pick(OP_TERMS) + '", ' + pick(OP_DIRS) + ')'; } },
    { type: 'Edit', make: function () { return 'Edit(' + pick(OP_FILES) + ')'; } },
    { type: 'Run', make: function () { return 'Run(node tools/' + pick(OP_TOOLS) + ')'; } },
    { type: 'Typecheck', make: function () { return 'Typecheck(ok)'; } },
    { type: 'Test', make: function () { return 'Test(' + rint(8, 48) + ' passed)'; } },
    { type: 'Diff', make: function () { return 'Diff(+' + rint(4, 64) + ' \u2212' + rint(1, 24) + ')'; } },
    { type: 'Format', make: function () { return 'Format(prettier)'; } },
    { type: 'Search', make: function () { return 'Search("' + pick(OP_TERMS) + '")'; } },
    { type: 'Git', make: function () { return 'Git(status clean)'; } },
    { type: 'Lint', make: function () { var w = rint(0, 2); return 'Lint(' + w + (w === 1 ? ' warning)' : ' warnings)'); } },
    { type: 'Build', make: function () { return 'Build(ok ' + rnd(0.6, 2.4).toFixed(1) + 's)'; } },
  ];

  var MQ = (window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null);
  var tidSeq = 0;
  var lastSig = '';

  function reduced() { return !!(MQ && MQ.matches); }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[rint(0, list.length - 1)]; }
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

  function signature(lines) {
    return lines.map(function (l) { return l.text; }).join('\u0001');
  }
  function makeThoughts(n) {
    return shuffle(PHRASES).slice(0, n).map(function (p) {
      return { text: p[0], flash: p[1], op: false, type: '' };
    });
  }
  function drawOps(n) {
    return shuffle(OPS).slice(0, n).map(function (o) {
      return { text: o.make(), op: true, type: o.type };
    });
  }
  function hasAdjacentSameOpType(lines) {
    for (var i = 1; i < lines.length; i++) {
      if (lines[i].op && lines[i - 1].op && lines[i].type === lines[i - 1].type) return true;
    }
    return false;
  }
  /* 每塊 2–5 條，從「思考池＋操作池」抽：
     70% 的組合至少 1 條操作記錄；含操作時最多 2 條（不同型）且一定留至少 1 條思考（才能閃字）。 */
  function compose() {
    var n = rint(2, 5);
    if (Math.random() >= 0.7) return makeThoughts(n);
    var opCount = Math.min(n - 1, Math.random() < 0.35 ? 2 : 1);
    var lines = makeThoughts(n - opCount).concat(drawOps(opCount));
    // 同型操作被抽成相鄰的防護（drawOps 已經保證不同型，這裡留一層保險）
    for (var a = 0; a < 16 && hasAdjacentSameOpType(lines); a++) lines = shuffle(lines);
    return lines;
  }
  function forceDifferent(lines) {
    /* 重抽一次還撞同一組（機率極低）→ 換掉最後一條，保證不連莊 */
    var i = lines.length - 1;
    var last = lines[i];
    if (last.op) {
      var pool = OPS.filter(function (o) { return o.type !== last.type; });
      var o = pick(pool);
      lines[i] = { text: o.make(), op: true, type: o.type };
    } else {
      var p = pick(PHRASES);
      lines[i] = { text: p[0], flash: p[1], op: false, type: '' };
    }
    return lines;
  }
  function pickGroup() {
    var lines = compose();
    var sig = signature(lines);
    if (sig === lastSig) {
      lines = compose();               // 記住上一組，重抽一次
      sig = signature(lines);
      if (sig === lastSig) { lines = forceDifferent(lines); sig = signature(lines); }
    }
    lastSig = sig;
    return { lines: lines, sig: sig };
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

  function makeLine(body, text, index, op) {
    var row = document.createElement('div');
    row.className = 'think-l' + (op ? ' think-op' : '');
    row.dataset.li = String(index);
    var bu = document.createElement('span');
    bu.className = 'think-bu';
    bu.textContent = op ? '\u23fa' : '·';   // ⏺ 操作記錄、· 思考句
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

    /* 抽這一塊的素材：2–5 條，思考句＋操作記錄混搭（見 compose），不與上一組連莊 */
    var group = pickGroup();
    var lines = group.lines;
    var n = lines.length;

    if (reduced()) {
      /* 減少動態：行全部直接顯示（不淡入、不 flash），長度照樣 2–5 秒 */
      for (var i = 0; i < lines.length; i++) makeLine(body, lines[i].text, i, lines[i].op);
      later(rint(2200, 4000), finish);
      return;
    }

    /* 1–2 行先閃：先看到短句 200–400ms，再換成定稿。
       只挑「思考句」閃（操作記錄是結果，不該換字）；每塊一定至少一條思考，所以一定有得閃。 */
    var thoughtIdx = [];
    for (var t = 0; t < n; t++) if (!lines[t].op) thoughtIdx.push(t);
    var flashCount = Math.min(thoughtIdx.length, (thoughtIdx.length >= 3 && n >= 4) ? rint(1, 2) : 1);
    var order = shuffle(thoughtIdx).slice(0, flashCount);
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
      var item = lines[i];
      var flashing = !item.op && !!flash[i];
      var row = makeLine(body, flashing ? item.flash : item.text, i, item.op);
      if (flashing) {
        row.dataset.flash = String(flash[i]);   // 規劃停留毫秒（測試要驗 200–400ms 的設計值）
        later(flash[i], function () {
          var tx = row.querySelector('.think-tx');
          if (tx) tx.textContent = item.text;
        });
      }
      if (i + 1 < n) later(rint(300, 700), function () { reveal(i + 1); });
      else later(rint(450, 900), finishAfterSettle);
    }
    later(rint(200, 380), function () { reveal(0); });
  }

  /* 掃描新出現的助手回覆：一個 .turn.ai（有 .pb 的本體）＝一塊，插在 .pb 前面。
     用 turn.dataset.think 當哨兵，MutationObserver 重掃也不會重複插。
     每一則回覆都要有（JOJO 的產品定義：回覆前就是推理過程），
     塊長高會把下面內容往下推，那是正常排版；元件本身不會去動 scrollTop。 */
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
    pools: { thoughts: PHRASES.length, ops: OPS.length, opTypes: OPS.map(function (o) { return o.type; }) },
    /* 給測試／除錯用的同一支抽選器（正式 attach 也走這個，確保測的就是真的邏輯） */
    pickGroup: function () {
      var g = pickGroup();
      return {
        sig: g.sig,
        lines: g.lines.map(function (l) {
          return { text: l.text, op: !!l.op, type: l.type || '', glyph: l.op ? '⏺' : '·' };
        }),
      };
    },
  };
})();
