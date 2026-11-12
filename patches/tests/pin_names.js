// 回归测试：三极管 / LED 的 3D 引脚名规划。
// 原则：不猜极性。网表给了引脚名就用；用户手选了脚序就用；都没有就只显示 1/2/3。
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BUNDLE = path.join(__dirname, '../../src/dist/assets/index-C0NrTOjn.js');
const bundle = fs.readFileSync(BUNDLE, 'utf8');

function grabFn(src, sig) {
  const i = src.indexOf(sig);
  if (i < 0) throw new Error('not found: ' + sig);
  const b = src.indexOf('{', i);
  let d = 0, e = -1;
  for (let k = b; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) { e = k; break; } }
  }
  return src.slice(i, e + 1) + '\n';
}
function grabTable(src) {
  const i = src.indexOf('var __lcPinLetterTables');
  if (i < 0) throw new Error('table not found');
  let k = src.indexOf('{', i), d = 0, e = -1;
  for (; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) { e = k; break; } }
  }
  return src.slice(i, e + 1) + ';\n';
}

const sandbox = { window: {}, Math, JSON, String, Number, Array, Object, console };
vm.createContext(sandbox);
vm.runInContext(grabTable(bundle) + grabFn(bundle, 'function __lcPinNamePlan('), sandbox);

const plan = (kind, info, order, n) => vm.runInContext(
  '__lcPinNamePlan(' + JSON.stringify(kind) + ',' + JSON.stringify(info) + ',' +
  JSON.stringify(order) + ',' + JSON.stringify(n) + ')', sandbox);

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1) 网表 pinInfo 最优先
assert(eq(plan('to92', { 1: { name: 'E' }, 2: { name: 'B' }, 3: { name: 'C' } }, 'CBE', 3), ['E', 'B', 'C']),
  'pinInfo 优先于手选脚序');

// 1b) 嘉立创 / Protel 导入器把引脚名合成为脚号本身（"1"/"2"/"3"）——不算有效名字，
//     必须让手选脚序生效，否则三极管永远标不出 E/C/B。
assert(eq(plan('to92', { 1: { name: '1' }, 2: { name: '2' }, 3: { name: '3' } }, 'EBC', 3), ['E', 'B', 'C']),
  '合成脚号名的 pinInfo 不阻断手选脚序');
assert(eq(plan('to92', { 1: { name: '1' }, 2: { name: '2' }, 3: { name: '3' } }, null, 3), ['1', '2', '3']),
  '合成脚号名且无手选脚序时仍显示脚号');
assert(eq(plan('to92', { 1: { name: '1' }, 2: { name: 'B' }, 3: { name: '3' } }, 'CBE', 3), ['1', 'B', '3']),
  '混有真实名字时以 pinInfo 为准（真实名优先于手选脚序）');

// 2) pinInfo 只有部分名字 → 有名字的用名字，其余用脚号
assert(eq(plan('to92', { 1: { name: 'E' } }, null, 3), ['E', '2', '3']),
  'pinInfo 部分缺失时其余回落脚号');

// 3) 无 pinInfo，用属性面板手选的脚序
assert(eq(plan('to92', null, 'EBC', 3), ['E', 'B', 'C']), '手选 EBC');
assert(eq(plan('to92', null, 'CBE', 3), ['C', 'B', 'E']), '手选 CBE');
assert(eq(plan('to92', null, 'BCE', 3), ['B', 'C', 'E']), '手选 BCE');
assert(eq(plan('to92', null, 'ebc', 3), ['E', 'B', 'C']), '手选脚序大小写不敏感');

// 4) 什么都没有 → 只显示脚号，绝不猜
assert(eq(plan('to92', null, null, 3), ['1', '2', '3']), '无依据时只显示 1/2/3');
assert(eq(plan('to92', {}, '', 3), ['1', '2', '3']), '空字符串脚序等同未指定');

// 5) 非三极管类型不受影响
assert(eq(plan('resistor', null, 'EBC', 2), ['1', '2']), '电阻不套用三极管脚序');
assert(eq(plan('dip', null, 'EBC', 8), ['1', '2', '3', '4', '5', '6', '7', '8']), 'DIP 按脚号');

// 6) 脚数与表长度不匹配时不越界
assert(eq(plan('to92', null, 'EBC', 5), ['1', '2', '3', '4', '5']), '脚数多于脚序表时回落脚号');
assert(plan('to92', null, 'EBC', 0).length === 1 || plan('to92', null, 'EBC', 0).length === 0,
  '脚数为 0 不抛异常');

// 7) LED 用网表给的 A / K
assert(eq(plan('led', { 1: { name: 'K' }, 2: { name: 'A' } }, null, 2), ['K', 'A']), 'LED 用网表的 K/A');

// 8) 3D 建模真的用上了这些名字
assert(bundle.indexOf('to92:i=>GP(i.label??"Q",hn(i),i.pinNames)') >= 0, 'to92 分派把 pinNames 传进 GP');
assert(bundle.indexOf('led:i=>UP(i.color??15220543,hn(i),i.pinNames)') >= 0, 'led 分派把 pinNames 传进 UP');
assert(bundle.indexOf('pinNames:__lcPinNamesOf(c)') >= 0, 'C2 在构建元件时计算 pinNames');
assert(bundle.indexOf('三极管脚序') >= 0, '属性面板有脚序下拉');

console.log(res.join('\n'));
console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
