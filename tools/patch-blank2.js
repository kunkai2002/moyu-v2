// 追加：避免背景節流造成首屏白/空
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const f = p('main.js');
let s = fs.readFileSync(f, 'utf8');
let n = 0;

if (!s.includes('disable-renderer-backgrounding')) {
  s = s.replace(
    "'use strict';\n",
    "'use strict';\n\n"
    + "// 首次顯示時不要讓 renderer 被背景節流，否則會出現白窗（要從托盤再點一次才畫）\n"
    + "require('electron').app.commandLine.appendSwitch('disable-renderer-backgrounding');\n"
    + "require('electron').app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');\n"
  );
  n++;
}

if (!s.includes('backgroundThrottling')) {
  s = s.replace(
    '      spellcheck: false,',
    '      spellcheck: false,\n      backgroundThrottling: false,'
  );
  n++;
}

if (n) { fs.writeFileSync(f, s, 'utf8'); }
console.log('main.js tweaks:', n);
