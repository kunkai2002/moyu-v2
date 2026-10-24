// 把 dsh-mcp 加進 profile 的 bundles
const fs = require('fs');
const path = require('path');

const PROF = 'D:\\dsh desktop\\data\\profiles\\desktop';
const pkgPath = path.join(PROF, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const bundles = pkg?.dsh?.profile?.bundles || [];
if (!bundles.includes('dsh-mcp')) {
  bundles.push('dsh-mcp');
  pkg.dsh.profile.bundles = bundles;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log('+ bundles 加入 dsh-mcp');
} else console.log('= dsh-mcp 已在 bundles');

const deps = pkg.dependencies || {};
console.log('dsh-mcp 版本:', deps['dsh-mcp'] || '(未列在 dependencies)');
console.log('bundles:', (pkg.dsh.profile.bundles || []).join(', '));
console.log('patchReload:', pkg.dsh.profile.patchReload);
