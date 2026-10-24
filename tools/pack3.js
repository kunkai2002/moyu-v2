const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'dist','魔芋一夏');
const FILES=['server.js','README.md','啟動.cmd','src/fanqie.js','src/store.js','src/appapi.js','src/comments.js','src/login.js','src/shelf.js','src/charset.json','src/sign/index.js','src/sign/sm3.js','src/sign/cipher.js','src/sign/protobuf.js','ui/index.html','ui/theme.css','ui/app.js','ui/bridge-http.js','ui/wiring.js','tools/start.vbs'];
if(fs.existsSync(OUT))fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(OUT,{recursive:true});
let n=0;
for(const f of FILES){const s=path.join(ROOT,f);if(!fs.existsSync(s)){console.log('缺少',f);continue}const d=path.join(OUT,f);fs.mkdirSync(path.dirname(d),{recursive:true});fs.copyFileSync(s,d);n++}
const C=path.join(ROOT,'dist_moyu_companion');
if(fs.existsSync(path.join(C,'MoyuCompanion.exe'))){const d=path.join(OUT,'companion');fs.mkdirSync(d,{recursive:true});for(const f of fs.readdirSync(C)){if(f.endsWith('.pdb'))continue;fs.copyFileSync(path.join(C,f),path.join(d,f))}console.log('  + companion/')}
fs.mkdirSync(path.join(OUT,'data','chapters'),{recursive:true});
fs.writeFileSync(path.join(OUT,'data','.gitkeep'),'');
console.log('完成',n,'個檔案');
