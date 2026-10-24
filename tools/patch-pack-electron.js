// 讓 pack4 自己把 Electron 執行檔一起帶上（不然每次重打包都會掉）
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pp = path.join(ROOT, 'tools', 'pack4.js');
let p = fs.readFileSync(pp, 'utf8');

if (!p.includes('node_modules")) {\n  const src')) {
  // 在「完成」輸出行之前插入 electron 複製
  const marker = "console.log(`完成 ${n} 個檔案 → ${OUT}`);";
  if (p.includes(marker)) {
    p = p.replace(marker, `// 帶上 Electron 執行檔（不入版控，但安裝包需要）
{
  const SRC = path.join(ROOT, 'node_modules', 'electron', 'dist');
  const DST = path.join(OUT, 'electron');
  if (fs.existsSync(path.join(SRC, 'electron.exe'))) {
    fs.mkdirSync(DST, { recursive: true });
    fs.cpSync(SRC, DST, { recursive: true });
    console.log('  + electron/');
  } else {
    console.log('  ! 找不到 node_modules/electron/dist（略過 Electron）');
  }
}

${marker}`);
    fs.writeFileSync(pp, p, 'utf8');
    console.log('+ pack4 會一起打包 Electron');
  } else {
    console.log('! 找不到完成輸出行');
  }
} else {
  console.log('= 已處理');
}
