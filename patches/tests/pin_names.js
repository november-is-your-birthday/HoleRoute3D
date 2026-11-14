// 回归测试：三极管 / LED 的 3D 引脚名规划。
// 原则：有确切依据就用（网表 pinInfo > 手选脚序）；都没有时按本封装的常见排布暂标，
//       并用暖黄色 + 面板文案说明「这是默认、不是你选的」，不再退回 1/2/3。
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
function grabDecl(src, name) {
  const i = src.indexOf('var ' + name);
  if (i < 0) throw new Error('not found: var ' + name);
  const semi = src.indexOf(';', i);
  return src.slice(i, semi + 1) + '\n';
}

const sandbox = { window: {}, Math, JSON, String, Number, Array, Object, console };
vm.createContext(sandbox);
vm.runInContext(
  grabDecl(bundle, '__lcTriKinds') +
  grabDecl(bundle, '__lcPinOrderPresets') +
  grabFn(bundle, 'function __lcPinOrderOf(') +
  grabFn(bundle, 'function __lcPinPlanTag(') +
  grabFn(bundle, 'function __lcPinNamePlan('),
  sandbox);

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
assert(eq(plan('to92', { 1: { name: '1' }, 2: { name: '2' }, 3: { name: '3' } }, null, 3), ['E', 'B', 'C']),
  '合成脚号名且无手选脚序时按本封装常见排布标（不是一片 1/2/3）');
assert(vm.runInContext('__lcPinNamePlan("to92",{1:{name:"1"},2:{name:"2"},3:{name:"3"}},null,3).__lcFrom', sandbox) === 'preset',
  '合成脚号名仍归入 preset（黄色），不冒充网表给的名字');
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

// 3b) v3.4.6 回归：手选脚序是「逐脚角色」，必须与封装无关。
//     旧实现给 to220 / to3 / to247 三个键全部返回 B-C-E，
//     用户选 EBC 拿到的却是 1=B 2=C 3=E —— 这就是「标注和封装对不上」。
[['to92', 'EBC'], ['to39', 'EBC'], ['to220', 'EBC'], ['to247', 'EBC'], ['to3', 'EBC']]
  .forEach(([k, o]) => assert(eq(plan(k, null, o, 3), ['E', 'B', 'C']),
    k + ' 选 EBC 即脚1=E 脚2=B 脚3=C（不再被封装覆盖）'));
[['to220', 'CBE', ['C', 'B', 'E']], ['to3', 'BEC', ['B', 'E', 'C']],
 ['to247', 'ECB', ['E', 'C', 'B']], ['to92', 'CEB', ['C', 'E', 'B']]]
  .forEach(([k, o, want]) => assert(eq(plan(k, null, o, 3), want), k + ' 选 ' + o));

// 3c) 六种排列互不相同且各给各的答案
const all6 = ['EBC', 'ECB', 'BCE', 'BEC', 'CBE', 'CEB'].map(o => plan('to220', null, o, 3).join(''));
assert(new Set(all6).size === 6, '六种排布必须给出六种不同结果，实际 ' + all6.join(' / '));
assert(all6.every(s => s.split('').sort().join('') === 'BCE'), '每种排布都恰好含 E/B/C 各一次');

// 3d) 推荐值表只做提示，不能被当成判定依据
assert(vm.runInContext('__lcPinOrderPresets.to220', sandbox) === 'BCE', 'TO-220 推荐 B-C-E');
assert(vm.runInContext('__lcPinOrderPresets.to3', sandbox) === 'BEC', 'TO-3 推荐 B-E-C');
assert(eq(plan('to220', null, 'ECB', 3), ['E', 'C', 'B']), '推荐值与实际选择无关');

// 4) 没选脚序 → 按本封装常见排布标出来（黄色暂标），不再是一片 1/2/3
assert(eq(plan('to92', null, null, 3), ['E', 'B', 'C']), '未指定脚序时 TO-92 按常见 E-B-C 标出');
assert(eq(plan('to92', {}, '', 3), ['E', 'B', 'C']), '空字符串脚序等同未指定（同样按常见排布）');
assert(eq(plan('to220', null, null, 3), ['B', 'C', 'E']), '未指定脚序时 TO-220 按常见 B-C-E 标出');
assert(eq(plan('to3', null, null, 3), ['B', 'E', 'C']), '未指定脚序时 TO-3 按常见 B-E-C 标出');
assert(vm.runInContext('__lcPinNamePlan("to92",null,null,3).__lcFrom', sandbox) === 'preset',
  '预设来源标记为 preset（3D 据此用黄色）');
assert(vm.runInContext('__lcPinNamePlan("to92",null,"CBE",3).__lcFrom', sandbox) === 'manual',
  '手选来源标记为 manual（3D 用白色）');
assert(vm.runInContext('__lcPinNamePlan("resistor",null,null,2).__lcFrom', sandbox) === 'number',
  '非三极管标记为 number');
assert(vm.runInContext('__lcPinNamePlan("to92",{1:{name:"E"},2:{name:"B"},3:{name:"C"}},null,3).__lcFrom', sandbox) === 'pinInfo',
  '网表来源标记为 pinInfo');

// 5) 非三极管类型不受影响
assert(eq(plan('resistor', null, 'EBC', 2), ['1', '2']), '电阻不套用三极管脚序');
assert(eq(plan('dip', null, 'EBC', 8), ['1', '2', '3', '4', '5', '6', '7', '8']), 'DIP 按脚号');

// 6) 脚数与脚序长度不匹配时不越界
assert(eq(plan('to92', null, 'EBC', 5), ['E', 'B', 'C', '4', '5']),
  '脚数多于脚序时，前三个按角色、其余回落脚号，不编造');
assert(plan('to92', null, 'EBC', 0).length === 1 || plan('to92', null, 'EBC', 0).length === 0,
  '脚数为 0 不抛异常');

// 7) LED 用网表给的 A / K
assert(eq(plan('led', { 1: { name: 'K' }, 2: { name: 'A' } }, null, 2), ['K', 'A']), 'LED 用网表的 K/A');

// 8) 3D 建模真的用上了这些名字
assert(bundle.indexOf('to92:i=>GP(i.label??"Q",hn(i),i.pinNames)') >= 0, 'to92 分派把 pinNames 传进 GP');
assert(bundle.indexOf('led:i=>UP(i.color??15220543,hn(i),i.pinNames)') >= 0, 'led 分派把 pinNames 传进 UP');
['to39:zP', 'to220:FP', 'to3:tR', 'to247:eR'].forEach(pair => {
  const [k, fn] = pair.split(':');
  assert(bundle.indexOf(k + ':i=>' + fn + '(i.label??"Q",hn(i),i.pinNames)') >= 0,
    k + ' 分派也把 pinNames 传进 ' + fn);
});
assert(bundle.indexOf('function __lcPinLetters(') >= 0, '存在统一的引脚字母标注辅助函数');
assert(bundle.indexOf('function __lcPinInk(names)') >= 0, '存在按来源取色的辅助函数');
assert(bundle.indexOf('var __lcPresetInk = 16762967') >= 0, '预设色是暖黄 0xFFC857');
assert((bundle.match(/color:__lcPinInk\(names\)/g) || []).length === 4,
  'TO-220 / TO-39 / TO-3 / TO-247 都按来源上色');
assert(bundle.indexOf('nmc=__lcPinInk(names)') >= 0, 'TO-92 也按来源上色');
['function FP(i,t,names)', 'function zP(i,t,names)', 'function tR(i,t,names)', 'function eR(i,t,names)']
  .forEach(sig => assert(bundle.indexOf(sig) >= 0, '接受 pinNames：' + sig.slice(9, 13)));
assert(bundle.indexOf('pinNames:__lcPinNamesOf(c)') >= 0, 'C2 在构建元件时计算 pinNames');
assert(bundle.indexOf('三极管脚序') >= 0, '属性面板有脚序下拉');
assert(bundle.indexOf('__lcTriPinTable(O)') >= 0, '属性面板显示「脚号→角色」对照行');
assert(bundle.indexOf('平面对自己、引脚朝下') >= 0, '属性面板写明判定基准');

// 9) 属性面板的「脚号→角色」对照行
const tBox = {
  window: { __lcProject: { importState: { pinInfo: {} } } },
  Math, JSON, String, Number, Array, Object, console,
};
vm.createContext(tBox);
vm.runInContext(
  grabDecl(bundle, '__lcTriKinds') +
  grabDecl(bundle, '__lcPinOrderPresets') +
  grabFn(bundle, 'function __lcPinOrderOf(') +
  grabFn(bundle, 'function __lcPinPlanTag(') +
  grabFn(bundle, 'function __lcPinNamePlan(') +
  grabFn(bundle, 'function __lcPinNamesOf(') +
  grabFn(bundle, 'function __lcTriPinTable('),
  tBox);
const table = c => vm.runInContext('__lcTriPinTable(__c)', Object.assign(tBox, { __c: c }));

const t1 = table({ kind: 'to92', pinOrder: 'EBC', pinOffsets: [[-1, 0], [0, 0], [1, 0]] });
assert(t1.indexOf('脚1 E') >= 0 && t1.indexOf('脚2 B') >= 0 && t1.indexOf('脚3 C') >= 0,
  '对照行按脚序列出 E/B/C（' + t1 + '）');
assert(t1.indexOf('E-B-C') >= 0, '对照行括注当前排布');

const t2 = table({ kind: 'to220', pinOrder: 'CBE', pinOffsets: [[-1, 0], [0, 0], [1, 0]] });
assert(t2.indexOf('脚1 C') >= 0 && t2.indexOf('脚3 E') >= 0, 'TO-220 换成 CBE 后对照行跟着变（' + t2 + '）');

const t3 = table({ kind: 'to92', pinOffsets: [[-1, 0], [0, 0], [1, 0]] });
assert(t3.indexOf('脚1 E') >= 0 && t3.indexOf('未指定脚序') >= 0 && t3.indexOf('黄色') >= 0,
  '未指定脚序时按常见排布显示、并说明是暂标（' + t3 + '）');

assert(table({ kind: 'to92', pinOffsets: [] }).indexOf('没有引脚信息') >= 0, '无引脚时不抛异常');
assert(table(null).indexOf('没有引脚信息') >= 0, '传 null 也不抛异常');

console.log(res.join('\n'));
console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
