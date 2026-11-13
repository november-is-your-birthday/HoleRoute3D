// 语法门禁：bundle 是 ES module，必须按 **模块语义** 校验。
// 只用 `node --check x.js` 会按 CommonJS 解析，严格模式下非法的写法（如 `top:12px` 这种
// 非字符串样式值、少一个闭合花括号）可能漏检——v3.4 开发时就这样放过过一次。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'src/dist/assets/index-C0NrTOjn.js',
  'src/dist/assets/autoPlacement.worker-CtyuXT3o.js',
];

let bad = 0;
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  const src = fs.readFileSync(abs, 'utf8');
  const tmp = path.join(os.tmpdir(), 'lc-syntax-' + path.basename(rel) + '.mjs');
  fs.writeFileSync(tmp, src);
  const r = cp.spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  if (r.status === 0) {
    console.log('  OK  模块语义解析通过：' + rel);
  } else {
    bad += 1;
    const msg = (r.stderr || '').split('\n').filter(x => /SyntaxError|^\S+:\d+/.test(x)).slice(0, 3).join(' | ');
    console.log('  FAIL 模块语义解析失败：' + rel + ' :: ' + msg);
  }
  try { fs.unlinkSync(tmp); } catch (e) { /* 忽略 */ }
}
console.log(bad ? '语法检查失败 ' + bad + ' 项' : '语法检查全部通过（按 ES module 语义）');
process.exit(bad ? 1 : 0);
