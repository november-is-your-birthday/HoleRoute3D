// 回归测试：v3.4.11 二极管 / LED 的负极标记
//   1. 哪只脚是负极：网表给了 A/K 就按名字找，否则按行业约定取脚 1（KiCad / 立创都是 pin1=K）
//   2. 二极管：K 端套一圈黑色环带（+ 两条细银边，否则深色本体上看不出环）
//   3. LED：底座外圈套黑色环带（竖线只能朝向一侧，转到背面就看不见）
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

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

/* ---------- 1) 负极脚判定 ---------- */
const box = { String, Array, Math, Object, console };
vm.createContext(box);
vm.runInContext(grabFn(bundle, 'function __lcCathodeIndex('), box);
const idx = (names) => vm.runInContext('__lcCathodeIndex(__n)', Object.assign(box, { __n: names }));

assert(idx(['K', 'A']) === 0, '网表标 K/A 时，脚 1 是负极');
assert(idx(['A', 'K']) === 1, '网表标 A/K 时，脚 2 是负极');
assert(idx(['k', 'a']) === 0, '小写 k/a 也认');
assert(idx(['1', '2']) === 0, '导入器合成脚号时按约定取脚 1');
assert(idx([]) === 0, '没有引脚名时取脚 1');
assert(idx(null) === 0, 'null 不抛异常');
assert(idx(['C', 'A']) === 0, 'C（阴极）同样认作负极');assert(idx(['A', 'C']) === 1, 'A 在前时取另一只脚');

/* ---------- 2) 静态接线 ---------- */
assert(bundle.indexOf('function __lcCathodeIndex(') >= 0, '存在负极判定函数');
assert(bundle.indexOf('function __lcInkBlack(') >= 0, '存在近黑标记材质');
assert(bundle.indexOf('function __lcInkEdge(') >= 0, '存在环带边缘的浅色材质');

const markCount = (bundle.match(/__lcCathodeMark=1/g) || []).length;
assert(markCount === 2, '二极管与 LED 各生成一处负极标记（实际 ' + markCount + ' 处）');

assert(bundle.indexOf('diode:i=>IP(i.label??"D",hn(i),i.pinNames)') >= 0,
  '二极管分派把 pinNames 传进 IP（否则无法判断 A/K）');
assert(bundle.indexOf('led:i=>UP(i.color??15220543,hn(i),i.pinNames,i.ref)') >= 0,
  'LED 分派把 pinNames 与位号 ref 一起传进 UP（拓扑判定要用 ref）');

// 二极管环：比本体（0.42）粗，且落在 K 端（dir 由 __lcCathodeIndex 决定）
assert(bundle.indexOf('ze(.472,.472,.2,28)') >= 0, '二极管环带直径大于本体、有明显宽度');
assert(bundle.indexOf('dir=__lcCathodeIndex(names)===0?-1:1') >= 0, '环的位置由负极脚决定');
assert(bundle.indexOf('ze(.478,.478,.009,28)') >= 0, '环带两侧有细银边（深色本体上才分得清）');

// LED 竖线：只在 K 侧，带方向；整圈环无方向信息，已移除
assert(bundle.indexOf('const ki=__lcLedCathodeIndex(ref,names,t.length)') >= 0,
  'LED 竖线位置由 __lcLedCathodeIndex（拓扑优先）决定');
assert(bundle.indexOf('bar.userData.__lcCathodeMark=1') >= 0, 'LED 生成 K 侧黑色竖线');
assert(bundle.indexOf('ze(.752,.752,.075,32)') < 0, '整圈黑环已移除（360° 对称，无法表示方向）');

// 旧的白色条不能复活：它埋在底座内部（半径 0.74 内），等于没有标记
assert(bundle.indexOf('color:16777215})') < 0 || bundle.indexOf('__lcLedBar') < 0,
  '旧的白色阴极条已移除');

/* ---------- 3) LED 负极：明确脚名优先；拓扑只在没有真脚名时兜底 ----------
   审查报告 P2-7：老实现用「哪侧经电阻到 GND」覆盖明确 K/A，在负电源电路
   （GND→R→A、K→-5V）里会把负极画反。现在：
     明确脚名 > 拓扑（仅当没有真脚名）；
   例外（可追踪兼容规则）：立创 LED_TH-R_3mm 系列符号的 C/A 与焊盘对不上，
   对这类封装仍按拓扑判定。 */
const t2 = { String, Array, Math, Object, console, window: {} };
vm.createContext(t2);
vm.runInContext(
  grabFn(bundle, 'function __lcCathodeIndex(') +
  grabFn(bundle, 'function __lcPinNetOf(') +
  grabFn(bundle, 'function __lcNetByName(') +
  grabFn(bundle, 'function __lcNetToGnd(') +
  grabFn(bundle, 'function __lcNetToNeg(') +
  grabFn(bundle, 'function __lcNetToPos(') +
  grabFn(bundle, 'function __lcPkgText(') +
  grabFn(bundle, 'function __lcCompByName(') +
  grabFn(bundle, 'function __lcLedTopoIndex(') +
  grabFn(bundle, 'function __lcLedCathodeIndex('), t2);
const mkProj = (nets, comps) => ({ importState: { nets }, components: comps || [] });
const N = (name, nodes) => ({ name, nodes: nodes.map(([ref, pin]) => ({ ref, pin: String(pin) })) });

/* 本工程拓扑：脚 2 经 R5 到 GND → 脚 2 是负极 */
t2.window.__lcProject = mkProj([
  N('$1N36', [['U2', 1], ['LED1', 1]]),
  N('$1N37', [['LED1', 2], ['LED2', 2], ['R5', 2]]),
  N('GND', [['R5', 1], ['U2', 8]])
]);
const ledIdx = (ref, names, n) => vm.runInContext(
  '__lcLedCathodeIndex(__r,__n,__c)', Object.assign(t2, { __r: ref, __n: names, __c: n }));
assert(ledIdx('LED1', ['1', '2'], 2) === 1,
  '没有真脚名时：限流电阻在脚 2 侧到 GND → 脚 2 是负极');
assert(ledIdx('LED2', ['1', '2'], 2) === 1, '同网络的其它 LED 同样判定');

/* 明确脚名优先（审查报告 P2-7 的反例：负电源电路） */
t2.window.__lcProject = mkProj([
  N('GND', [['R1', 1]]),
  N('ANODE', [['R1', 2], ['LED1', 2]]),
  N('-5V', [['LED1', 1]])
]);
assert(ledIdx('LED1', ['K', 'A'], 2) === 0,
  '明确脚名优先：K 在脚 1 就按脚 1（拓扑经 R 到 GND 不再覆盖）');
assert(ledIdx('LED1', ['A', 'K'], 2) === 1,
  '明确脚名优先：K 在脚 2 就按脚 2');

/* 已知错误库（立创 LED_TH-R_3mm 符号 C/A 与焊盘对不上）→ 仍按拓扑 */
t2.window.__lcProject = mkProj([
  N('$1N36', [['U2', 1], ['LED9', 1]]),
  N('$1N37', [['LED9', 2], ['R5', 2]]),
  N('GND', [['R5', 1], ['U2', 8]])
], [{ name: 'LED9', footprint: 'LED_TH-3mm', kind: 'led' }]);
assert(ledIdx('LED9', ['C', 'A'], 2) === 1,
  '立创 LED_TH-3mm：符号名与焊盘对不上，按拓扑取脚 2 为负极');

/* 负电源电路 + 无真脚名：负电源一侧才是阴极（旧规则会画反） */
t2.window.__lcProject = mkProj([
  N('GND', [['R1', 1]]),
  N('ANODE', [['R1', 2], ['LED5', 2]]),
  N('-5V', [['LED5', 1]])
]);
assert(ledIdx('LED5', ['1', '2'], 2) === 0,
  '无脚名 + 负电源：落在 -5V 的脚 1 是阴极（不是「经 R 到 GND」的那侧）');

/* 负极直接接 GND 的情形 */
t2.window.__lcProject = mkProj([
  N('NET_A', [['U1', 3], ['D1', 1]]),
  N('GND', [['D1', 2]])
]);
assert(ledIdx('D1', ['1', '2'], 2) === 1, '一脚直接落 GND → 该脚是负极');

/* 共阳极到 +5V：接电源的是阳极，另一脚才是负极 */
t2.window.__lcProject = mkProj([
  N('+5V', [['LED3', 1]]),
  N('NET_K', [['LED3', 2], ['U1', 5]])
]);
assert(ledIdx('LED3', ['1', '2'], 2) === 1, '共阳极：接 +5V 的是阳极，另一脚为负极');

/* 判不出来时退回引脚名，不硬猜 */
t2.window.__lcProject = mkProj([
  N('N1', [['LED4', 1], ['U1', 1]]),
  N('N2', [['LED4', 2], ['U1', 2]])
]);
assert(ledIdx('LED4', ['A', 'K'], 2) === 1, '拓扑不可判定时按引脚名 A/K');
assert(ledIdx('LED4', ['K', 'A'], 2) === 0, '拓扑不可判定时按引脚名 K/A');
assert(ledIdx('LED4', ['1', '2'], 2) === 0, '拓扑与引脚名都没有时退回脚 1 约定');

console.log(res.join('\n'));
console.log(res.every((r) => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
