// 回归测试：Ctrl 多选与组合操作的纯函数部分。
// 交互（点击、拖拽）依赖 React 状态，无法在离线环境完全模拟，因此这里覆盖：
//   1. 选择集取用规则（空集合时回落到主选中）
//   2. 组合变换后的副作用（已放置元件的引脚位置变了 → 清 DRC 并给出提示）
//   3. 关键接线是否真的存在（Ctrl 点击传入修饰键、各操作遍历选择集）
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

const sandbox = { window: {}, Math, JSON, String, Number, Array, Object, console };
vm.createContext(sandbox);
vm.runInContext(grabFn(bundle, 'function __lcSelIdsOf(') + grabFn(bundle, 'function __lcAfterTransform('), sandbox);

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1) 选择集取用规则
sandbox.window.__lcSelIds = [];
assert(eq(vm.runInContext('__lcSelIdsOf("a")', sandbox), ['a']), '集合为空时回落到主选中');
assert(eq(vm.runInContext('__lcSelIdsOf()', sandbox), []), '集合为空且无回落时返回空数组');
sandbox.window.__lcSelIds = ['a', 'b'];
assert(eq(vm.runInContext('__lcSelIdsOf("c")', sandbox), ['a', 'b']), '集合非空时优先用集合');
assert(eq(vm.runInContext('__lcSelIdsOf()', sandbox), ['a', 'b']), '集合非空时可省略回落');
// 必须是副本，不能把内部数组泄漏出去
const copy = vm.runInContext('__lcSelIdsOf()', sandbox);
copy.push('x');
assert(eq(sandbox.window.__lcSelIds, ['a', 'b']), '返回的是副本，改动不影响集合');

// 2) 组合变换副作用
const plain = { routing: { traces: [], jumpers: [] }, components: [] };
const same = vm.runInContext('__lcAfterTransform(__p,__c)', Object.assign(sandbox, {
  __p: plain, __c: [{ id: 'a', mounted: false }],
}));
assert(same === plain, '全部未放置时不改对象（保持引用不变，避免多余提交）');

const withDrc = { routing: { traces: [], jumpers: [], drc: { errors: [1] }, diagnostics: { x: 1 }, warnings: ['旧提示'] } };
const out = vm.runInContext('__lcAfterTransform(__p,__c)', Object.assign(sandbox, {
  __p: withDrc, __c: [{ id: 'a', mounted: true }],
}));
assert(out !== withDrc, '有已放置元件时产生新对象');
assert(out.routing.drc === undefined, '清掉失效的 DRC 结果');
assert(out.routing.diagnostics === undefined, '清掉失效的诊断');
assert(out.routing.warnings.some(w => String(w).indexOf('引脚位置已改变') >= 0), '写入引脚位置变化提示');
assert(out.routing.warnings.some(w => w === '旧提示'), '保留无关的旧提示');

// 重复调用不会堆叠同一条提示
const twice = vm.runInContext('__lcAfterTransform(__p,__c)', Object.assign(sandbox, {
  __p: out, __c: [{ id: 'a', mounted: true }],
}));
assert(twice.routing.warnings.filter(w => String(w).indexOf('引脚位置已改变') >= 0).length === 1,
  '同一条提示不重复堆叠');

// 3) 关键接线
const wires = [
  ['r(vt,K.ctrlKey||K.metaKey),l(void 0)', '点击元件时把 Ctrl 传给选择入口'],
  ['r(Tt?void 0:st.componentId,Tt?!1:(K.ctrlKey||K.metaKey)),l(st)', '点击引脚时把 Ctrl 传给选择入口'],
  ['[__lcSelArr,__lcSelSet]=qt.useState([])', '存在多选集合 state'],
  ['(window.__lcSelIds||[]).indexOf(c.id)>=0', '多选高亮'],
  ['function __lcMountAll(to)', '组合拔起/放置'],
  ['function __lcUnmountAll()', '全部拔起'],
  ['children:"全部拔起"', '工具栏「全部拔起」按钮'],
  ['function __lcRotateSpace()', '空格旋转'],
  ['rotateSpace:"Space"', '空格快捷键'],
  ['unmountAll:"Shift+U"', '全部拔起快捷键'],
  ['if(c.id!==Q&&ids.indexOf(c.id)<0)return c;', '组合移动按同一增量平移'],
];
wires.forEach(([needle, label]) => assert(bundle.indexOf(needle) >= 0, label));

// 组合旋转必须是绕各自 1 脚（position 不动，只改 rotation）
const gt = grabFn(bundle, 'function Gt(cw)');
assert(gt.indexOf('position') < 0, '组合旋转不改 position（各自绕 1 脚，不会落在半孔）');
assert(gt.indexOf('rotation:c.rotation+d') >= 0, '组合旋转对每个选中元件加同一角度');

console.log(res.join('\n'));
console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
