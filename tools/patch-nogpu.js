// 關掉 GPU 加速：這台機器上 GPU 程序崩過，首屏會留白，要從托盤再點一次才畫
const fs = require('fs');
const path = require('path');
const p = (s) => path.join(__dirname, '..', s);
const f = p('main.js');
let s = fs.readFileSync(f, 'utf8');

if (!s.includes('disableHardwareAcceleration')) {
  const anchor = "require('electron').app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');";
  if (!s.includes(anchor)) { console.error('錨點不見了'); process.exit(1); }
  s = s.replace(anchor, anchor + "\n"
    + "// 純文字閱讀器不需要 GPU；停用可避開 GPU 程序崩潰造成的白窗\n"
    + "require('electron').app.disableHardwareAcceleration();");
  fs.writeFileSync(f, s, 'utf8');
  console.log('main.js: 已停用硬體加速');
} else {
  console.log('main.js: 已經停用過');
}
