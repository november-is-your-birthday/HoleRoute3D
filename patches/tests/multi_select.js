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
  ['[__lcSelArr,__lcSelSet]=qt.useState([])', '存在多选集合 state'],
  ['(window.__lcSelIds||[]).indexOf(c.id)>=0', '多选高亮'],
  ['function __lcMountAll(to)', '组合拔起/放置'],
  ['function __lcUnmountAll()', '全部拔起'],
  ['children:"全部拔起"', '工具栏「全部拔起」按钮'],
  ['function __lcRotateSpace()', '空格旋转'],
  ['rotateSpace:"Space"', '空格快捷键'],
  ['unmountAll:"Shift+U"', '全部拔起快捷键'],
  ['if(c.id!==Q&&ids.indexOf(c.id)<0)return c;', '组合移动按同一增量平移'],
  // ---- v3.3.1：用户反馈「多选操作无效」的两个真实断点，必须一直在 ----
  ['else if(add==="keep")next=prev.indexOf(Q)>=0?prev.slice():prev.concat([Q]);', '选择入口支持 keep（保持选集不动作）'],
  ['r(Tt?((window.__lcSelIds||[]).indexOf(st.componentId)>=0?st.componentId:void 0):st.componentId',
    '引脚命中分支：Shift 拖已选中成员不清空选集'],
  ['(ht&&(window.__lcSelIds||[]).indexOf(vt)>=0?"keep":!1)', '元件体命中分支：Shift 拖已选中成员保持选集'],
  ['if((K.ctrlKey||K.metaKey)&&T.current){', 'Ctrl 点击时抑制 OrbitControls 的平移/旋转'],
  ['(K.ctrlKey||K.metaKey)||r(void 0)', 'Ctrl 点空白不清空选集'],
];
wires.forEach(([needle, label]) => assert(bundle.indexOf(needle) >= 0, label));

// 拖动已放置元件不再要求先拔起（否则用户多选后按 Shift 拖板上元件毫无反应）
assert(bundle.indexOf('ht&&vt&&!vt.mounted&&!df(ht,ot.current)') < 0,
  '拖动不再硬性要求未放置（mounted）');
assert(bundle.indexOf('ht&&Tt&&z&&!df(z.position,Tt)&&c(ht,Tt)') >= 0,
  '已放置元件拖动同样提交位置');

// 4) 组合移动的计算：z() 必须把同一增量应用到整个选集
const zSrc = grabFn(bundle, 'function z(Q,rt){');
const zBox = {
  window: { __lcSelIds: ['a', 'b'] }, Math, JSON, String, Number, Array, Object, console,
};
vm.createContext(zBox);
vm.runInContext(grabFn(bundle, 'function __lcSelIdsOf(') + grabFn(bundle, 'function __lcAfterTransform('), zBox);
zBox.window.__lcSelIds = ['a', 'b'];
zBox.__lcSelIds = zBox.window.__lcSelIds;
zBox.H = (fn) => { zBox.__out = fn(zBox.__proj); };
vm.runInContext(zSrc, zBox);
zBox.__proj = {
  components: [
    { id: 'a', name: 'A', mounted: true, position: [2, 3] },
    { id: 'b', name: 'B', mounted: true, position: [10, 12] },
    { id: 'c', name: 'C', mounted: true, position: [20, 20] },
  ],
  routing: { traces: [], jumpers: [], drc: { errors: [] }, warnings: [] },
};
vm.runInContext('z("a",[5,9])', zBox);
const moved = zBox.__out.components;
assert(eq(moved.find(c => c.id === 'a').position, [5, 9]), '被拖元件移动到目标孔');
assert(eq(moved.find(c => c.id === 'b').position, [13, 18]), '同选集元件按 +3/+6 同步平移');
assert(eq(moved.find(c => c.id === 'c').position, [20, 20]), '未选中元件不动');
assert(zBox.__out.routing.warnings.some(w => String(w).indexOf('引脚位置已改变') >= 0),
  '组合移动后提示重跑 DRC');

// 选集为空时回落到主选中，仍然只移动一个
zBox.window.__lcSelIds = [];
zBox.__proj = {
  components: [
    { id: 'a', name: 'A', mounted: false, position: [0, 0] },
    { id: 'b', name: 'B', mounted: false, position: [4, 4] },
  ],
  routing: { traces: [], jumpers: [], warnings: [] },
};
vm.runInContext('z("a",[1,1])', zBox);
assert(eq(zBox.__out.components.find(c => c.id === 'b').position, [4, 4]), '空选集时不影响其它元件');

// 组合旋转必须是绕各自 1 脚（position 不动，只改 rotation）
const gt = grabFn(bundle, 'function Gt(cw)');
assert(gt.indexOf('position') < 0, '组合旋转不改 position（各自绕 1 脚，不会落在半孔）');
assert(gt.indexOf('rotation:c.rotation+d') >= 0, '组合旋转对每个选中元件加同一角度');

console.log(res.join('\n'));
console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
