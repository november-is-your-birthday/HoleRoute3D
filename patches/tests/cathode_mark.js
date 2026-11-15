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
assert(idx(['C', 'A']) === 0, 'C（阴极）同样认作负极');
assert(idx(['A', 'C']) === 1, 'A 在前时取另一只脚');

/* ---------- 2) 静态接线 ---------- */
assert(bundle.indexOf('function __lcCathodeIndex(') >= 0, '存在负极判定函数');
assert(bundle.indexOf('function __lcInkBlack(') >= 0, '存在近黑标记材质');
assert(bundle.indexOf('function __lcInkEdge(') >= 0, '存在环带边缘的浅色材质');

const markCount = (bundle.match(/__lcCathodeMark=1/g) || []).length;
assert(markCount === 2, '二极管与 LED 各生成一处负极标记（实际 ' + markCount + ' 处）');

assert(bundle.indexOf('diode:i=>IP(i.label??"D",hn(i),i.pinNames)') >= 0,
  '二极管分派把 pinNames 传进 IP（否则无法判断 A/K）');
assert(bundle.indexOf('led:i=>UP(i.color??15220543,hn(i),i.pinNames)') >= 0,
  'LED 分派原本就传 pinNames');

// 二极管环：比本体（0.42）粗，且落在 K 端（dir 由 __lcCathodeIndex 决定）
assert(bundle.indexOf('ze(.472,.472,.2,28)') >= 0, '二极管环带直径大于本体、有明显宽度');
assert(bundle.indexOf('dir=__lcCathodeIndex(names)===0?-1:1') >= 0, '环的位置由负极脚决定');
assert(bundle.indexOf('ze(.478,.478,.009,28)') >= 0, '环带两侧有细银边（深色本体上才分得清）');

// LED 环：整圈套在底座（0.74）外侧
assert(bundle.indexOf('ze(.752,.752,.075,32)') >= 0, 'LED 环带套在底座外圈');
assert(bundle.indexOf('bar.userData.__lcCathodeMark') < 0, '旧的白/黑竖线实现已移除');

// 旧的白色条不能复活：它埋在底座内部（半径 0.74 内），等于没有标记
assert(bundle.indexOf('color:16777215})') < 0 || bundle.indexOf('__lcLedBar') < 0,
  '旧的白色阴极条已移除');

console.log(res.join('\n'));
console.log(res.every((r) => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
