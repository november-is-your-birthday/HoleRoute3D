// 回归测试：v3.4 的四项改动
//   1. 走锡 / 跳线 / 删线时不再弹引脚网络提示框（模式暴露 + 提示框 gate）
//   2. 这三个模式下点中元件不选中（右侧属性面板不跳出）
//   3. 板子四个方向的行 / 列增删：左/上加要整体平移，缩小时该行/列必须为空
//   4. 零欧电阻按导线处理：参数解析、同网才桥接、虚拟铜箔不落盘
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

/* ---------- 1) 静态接线 ---------- */
const wires = [
  ['window.__lcRouteMode=x,', '暴露当前编辑模式供提示框判断'],
  ['if (!__lcRouteIdle()) { __lcPinTipHide(); return; }', '非选择模式不显示引脚网络框'],
  ['if (!__lcRouteIdle()) return;', '非选择模式点击也不弹提示框'],
  ['const vt=(x==="select"&&!D)?Ht(K):void 0;', '走锡/跳线/删线时点中元件不选中'],
  ['x==="select"&&(K.ctrlKey||K.metaKey||r(void 0),l(void 0))', '非选择模式点空白也不动选集'],
  ['window.__lcBoardGrow&&window.__lcBoardGrow("top",1)', '上侧加行按钮'],
  ['window.__lcBoardGrow&&window.__lcBoardGrow("top",-1)', '上侧减行按钮'],
  ['window.__lcBoardGrow&&window.__lcBoardGrow("bottom",1)', '下侧加行按钮'],
  ['window.__lcBoardGrow&&window.__lcBoardGrow("left",1)', '左侧加列按钮'],
  ['window.__lcBoardGrow&&window.__lcBoardGrow("right",-1)', '右侧减列按钮'],
  ['__lcBridgeTraces(Q,q)', '自动布线注入零欧桥接'],
  ['J0(Q.board,__lcRoutingBridges(Q),rt,Q.components)', 'DRC 看到零欧桥接'],
  ['__lcContinuePlan(Q.board,eps,Q.components,__lcBridgeTraces(', '继续布线注入零欧桥接'],
  ['for(var __li=0;__li<__lb.length;__li+=1)uni(key(__lb[__li].from),key(__lb[__li].to));', '飞线并查集合并零欧两端'],
  ['__lcZeroOhm(O)&&P.jsx("span"', '属性面板标注「0Ω 视为导线」'],
];
wires.forEach(([needle, label]) => assert(bundle.indexOf(needle) >= 0, label));

/* ---------- 2) 零欧解析 ---------- */
const box = { window: {}, Math, JSON, String, Number, Array, Object, console, parseFloat, isFinite, NaN, parseInt };
vm.createContext(box);
['__lcOhm', '__lcZeroOhm'].forEach(n => vm.runInContext(grabFn(bundle, 'function ' + n + '('), box));
const ohm = v => vm.runInContext('__lcOhm(__v)', Object.assign(box, { __v: v }));
[[0, 0], ['0', 0], ['0R', 0], ['0R0', 0], ['R0', 0], ['0Ω', 0], ['0 ohm', 0], ['0.0', 0], ['0欧', 0],
 ['000', 0], ['10', 10], ['100', 100], ['1K', 1000], ['4R7', 4.7], ['10K', 10000], ['1M', 1e6]]
  .forEach(([v, want]) => assert(ohm(v) === want, 'ohm(' + JSON.stringify(v) + ') = ' + want + '，实际 ' + ohm(v)));
['', null, '100uF', 'TL062IP', '1kΩ', 'abc'].forEach(v => assert(isNaN(ohm(v)), 'ohm(' + JSON.stringify(v) + ') 不是电阻值'));

const zBox = box;
const isZero = c => vm.runInContext('__lcZeroOhm(__c)', Object.assign(zBox, { __c: c }));
assert(isZero({ kind: 'resistor', value: '0R', pinOffsets: [[0, 0], [3, 0]] }) === true, '0Ω 电阻识别为导线');
assert(isZero({ kind: 'resistor', value: '10K', pinOffsets: [[0, 0], [3, 0]] }) === false, '10K 电阻不是导线');
assert(isZero({ kind: 'electrolytic_capacitor', value: '0', pinOffsets: [[0, 0], [3, 0]] }) === false, '电容即使 0 也不当导线');
assert(isZero({ kind: 'resistor', value: '0', pinOffsets: [[0, 0]] }) === false, '单脚元件不当导线');

/* ---------- 3) 桥接只在同网时成立 ---------- */
const bBox = {
  window: {}, Math, JSON, String, Number, Array, Object, console, parseFloat, isNaN,
  Si: (c, pin) => {
    const o = (c.pinOffsets || [])[pin - 1] || [0, 0];
    return [c.position[0] + o[0], c.position[1] + o[1]];
  },
};
vm.createContext(bBox);
['__lcOhm', '__lcZeroOhm', '__lcBridgeLinks', '__lcBridgeTraces'].forEach(n =>
  vm.runInContext(grabFn(bundle, 'function ' + n + '('), bBox));

const mkProj = (nets) => ({
  importState: { nets },
  components: [{ id: 'r1', name: 'R9', kind: 'resistor', value: '0R', mounted: true, position: [4, 4], pinOffsets: [[0, 0], [3, 0]] }],
});
bBox.Io = (st, comps) => (st.nets.length
  ? [{ net: st.nets[0], ref: 'R9', pin: 1, grid: [4, 4] }, { net: st.nets[1], ref: 'R9', pin: 2, grid: [7, 4] }]
  : []);
let links = vm.runInContext('__lcBridgeLinks(__p)', Object.assign(bBox, { __p: mkProj(['GND', 'GND']) }));
assert(links.length === 1 && links[0].net === 'GND', '同网络的 0Ω：生成一条桥接');
assert(JSON.stringify(links[0].from) === '[4,4]' && JSON.stringify(links[0].to) === '[7,4]', '桥接端点是两个焊盘孔');
links = vm.runInContext('__lcBridgeLinks(__p)', Object.assign(bBox, { __p: mkProj(['N1', 'N2']) }));
assert(links.length === 0, '跨网络的 0Ω 不桥接（元件本体即为桥，跨网络本来就不画飞线）');
links = vm.runInContext('__lcBridgeLinks(__p)', Object.assign(bBox, { __p: { importState: { nets: [] }, components: [] } }));
assert(links.length === 0, '没有 0Ω 元件时没有桥接');
const p0 = Object.assign({}, mkProj(['GND', 'GND']), { components: [Object.assign({}, mkProj([]).components[0], { mounted: false })] });
assert(vm.runInContext('__lcBridgeLinks(__p)', Object.assign(bBox, { __p: p0 })).length === 0, '未放置的 0Ω 不桥接');

const t0 = vm.runInContext('__lcBridgeTraces(__p,__t)', Object.assign(bBox, { __p: mkProj(['GND', 'GND']), __t: [{ id: 't1', net: 'GND', points: [[0, 0], [1, 0]] }] }));
assert(t0.length === 2, '桥接被追加到走锡入参');
assert(t0[1].__lcBridge === true && t0[1].locked === true, '桥接带 __lcBridge / locked 标记（不参与输出与渲染）');
assert(t0[1].net === 'GND' && t0[1].points.length === 2, '桥接是一条两端点的走锡');
const t1 = vm.runInContext('__lcBridgeTraces(__p,__t)', Object.assign(bBox, { __p: mkProj(['N1', 'N2']), __t: [] }));
assert(t1.length === 0, '无桥接时不改变入参');

/* ---------- 4) 板尺寸四向增删 ---------- */
function growBox(project) {
  const toasts = [];
  const state = { project };
  const gb = {
    window: { __lcProject: project, __lcCommit: fn => { state.project = fn(state.project); } },
    Math, JSON, String, Number, Array, Object, console,
    __lcToast: m => toasts.push(m),
    Zi: () => ({ capabilities: { canResizeWidth: true } }),
    Si: (c, pin) => {
      const o = (c.pinOffsets || [])[pin - 1] || [0, 0];
      return [c.position[0] + o[0], c.position[1] + o[1]];
    },
  };
  vm.createContext(gb);
  ['__lcLcName', '__lcLineBusy', '__lcBoardGrow'].forEach(n =>
    vm.runInContext(grabFn(bundle, 'function ' + n + '('), gb));
  return { gb, state, toasts };
}
function mkBoard(w, h, extra) {
  return Object.assign({
    board: { width: w, height: h, kind: 'perfboard' },
    components: [
      { id: 'a', name: 'A', mounted: true, position: [2, 3], pinOffsets: [[0, 0], [2, 0]] },
      { id: 'b', name: 'B', mounted: true, position: [5, 6], pinOffsets: [[0, 0], [2, 0]] },
    ],
    routing: {
      traces: [{ id: 't1', net: 'N1', points: [[2, 3], [4, 3]] }],
      jumpers: [{ id: 'j1', net: 'N2', from: [3, 3], to: [7, 3] }],
      drc: { errors: [{}] }, diagnostics: { x: 1 }, warnings: ['旧提示'],
    },
  }, extra || {});
}

// 左加一列：宽度 +1，所有内容整体右移 1 格
let { gb, state, toasts } = growBox(mkBoard(10, 10));
vm.runInContext('__lcBoardGrow("left",1)', gb);
let p = state.project;
assert(p.board.width === 11 && p.board.height === 10, '左加一列：宽度 10 → 11');
assert(JSON.stringify(p.components[0].position) === '[3,3]' && JSON.stringify(p.components[1].position) === '[6,6]', '左加一列：元件整体右移 1 格');
assert(JSON.stringify(p.routing.traces[0].points) === '[[3,3],[5,3]]', '左加一列：走锡跟着平移');
assert(JSON.stringify(p.routing.jumpers[0].from) === '[4,3]' && JSON.stringify(p.routing.jumpers[0].to) === '[8,3]', '左加一列：跳线跟着平移');
assert(p.routing.drc === undefined && p.routing.diagnostics === undefined, '板尺寸变化后清掉失效的 DRC');
assert(p.routing.warnings.some(w => String(w).indexOf('板尺寸已改变') >= 0), '给出重跑 DRC 的提示');
assert(p.routing.warnings.some(w => w === '旧提示'), '保留无关旧提示');

// 右加一列：只改宽度，坐标不动
({ gb, state } = growBox(mkBoard(10, 10)));
vm.runInContext('__lcBoardGrow("right",1)', gb);
p = state.project;
assert(p.board.width === 11, '右加一列：宽度 10 → 11');
assert(JSON.stringify(p.components[0].position) === '[2,3]', '右加一列：坐标不变');

// 上加一行：高度 +1，所有内容下移 1 格
({ gb, state } = growBox(mkBoard(10, 10)));
vm.runInContext('__lcBoardGrow("top",1)', gb);
p = state.project;
assert(p.board.height === 11 && JSON.stringify(p.components[0].position) === '[2,4]', '上加一行：高度 +1 且内容下移');

// 减一列 / 减一行：该行或列必须为空
const busyLeft = mkBoard(10, 10);
busyLeft.components[0].position = [0, 3];   // 最左列住着元件
({ gb, state, toasts } = growBox(busyLeft));
vm.runInContext('__lcBoardGrow("left",-1)', gb);
assert(state.project.board.width === 10, '最左列有元件时拒绝缩列');
assert(toasts.some(t => t.indexOf('先移开再删除') >= 0), '拒绝时给出明确原因');

({ gb, state } = growBox(mkBoard(10, 10)));
vm.runInContext('__lcBoardGrow("right",-1)', gb);
p = state.project;
assert(p.board.width === 9, '最右列空闲时缩列成功');
assert(JSON.stringify(p.components[0].position) === '[2,3]', '缩右列不移动内容');

({ gb, state } = growBox(mkBoard(10, 10)));
vm.runInContext('__lcBoardGrow("top",-1)', gb);
p = state.project;
assert(p.board.height === 9 && JSON.stringify(p.components[0].position) === '[2,2]', '缩上侧：高度 -1 且内容上移');

// 边界与面包板
({ gb, state, toasts } = growBox(mkBoard(150, 10)));
vm.runInContext('__lcBoardGrow("right",1)', gb);
assert(state.project.board.width === 150 && toasts.some(t => t.indexOf('上限') >= 0), '宽度上限 150 拒绝');
({ gb, state, toasts } = growBox(mkBoard(5, 10)));
vm.runInContext('__lcBoardGrow("left",-1)', gb);
assert(state.project.board.width === 5 && toasts.some(t => t.indexOf('下限') >= 0), '宽度下限 5 拒绝');
({ gb, state, toasts } = growBox(mkBoard(10, 10, { board: { width: 10, height: 10, kind: 'breadboard' } })));
vm.runInContext('__lcBoardGrow("left",1)', gb);
assert(state.project.board.width === 10 && toasts.some(t => t.indexOf('面包板') >= 0), '面包板不走行列增删');

/* ---------- 5) v3.4.1：DRC 对「没有网络」的焊盘与 0Ω 未连通的措辞 ---------- */
assert(bundle.indexOf('if(!d)return{ref:l.name,pin:h,grid:g,actualNets:S,status:"NO_NET_UNUSED"};') >= 0,
  '没有指派过网络的焊盘 → 未使用引脚（warning），不再报错网短路');
assert(bundle.indexOf('if(!d)return{ref:l.name,pin:h,grid:g,actualNets:S,status:S.length>0?') < 0,
  '旧的「有铜箔就报 WRONG_NET_SHORT」分支已移除');
assert(bundle.indexOf('hint:(!x&&__lcZeroOhm(l))') >= 0, '0Ω 引脚未连通时给出原因提示');
assert(bundle.indexOf('${M.hint||""}') >= 0, 'DRC 文案拼接提示');

// 直接跑 sO()：三种输入分别对应 无网络 / 0Ω 未连通 / 普通过电阻未连通
const sBox = {
  Math, JSON, String, Number, Array, Object, console,
  oe: (x, y) => x + ',' + y,
  Si: (c, pin) => {
    const o = (c.pinOffsets || [])[pin - 1] || [0, 0];
    return [c.position[0] + o[0], c.position[1] + o[1]];
  },
  // d0(孔, 并查集, 已连通集合)：真实实现是 e.has(孔) ? t.find(孔) : 'open:孔'
  d0: (k, t, e) => (e && typeof e.has === 'function' && e.has(k) ? 'g:' + k : 'open:' + k),
};
vm.createContext(sBox);
vm.runInContext(grabFn(bundle, 'function __lcOhm(') + grabFn(bundle, 'function __lcZeroOhm(') +
  grabFn(bundle, 'function sO('), sBox);

const ZERO = { name: 'R24', kind: 'resistor', value: '0Ω', mounted: true, position: [4, 4], pinOffsets: [[0, 0], [3, 0]] };
const PLAIN = Object.assign({}, ZERO, { name: 'R1', value: '1kΩ' });
const runSO = (comps, eps, copper) => vm.runInContext('sO(__c,__e,__m,__s,__r)', Object.assign(sBox, {
  __c: comps,
  __e: new Map(eps),
  __m: new Map(copper),
  __s: new Set(copper.map(([k]) => k)),
  __r: new Set(),
}));
// ① 完全没网络、但有铜箔压在上面
let st = runSO([Object.assign({}, ZERO, { name: 'R25' })], [], [['4,4', new Set(['$1N39'])]]);
assert(st[0].status === 'NO_NET_UNUSED', '无网络焊盘有铜箔 → 未使用引脚，实际 ' + st[0].status);
// ② 0Ω 引脚在网络上但没连通（两个组）
st = runSO([ZERO], [['R24:1', { ref: 'R24', pin: 1, net: 'GND', grid: [4, 4] }],
  ['R24:2', { ref: 'R24', pin: 2, net: 'GND', grid: [7, 4] }]],
  [['4,4', new Set(['GND'])], ['7,4', new Set(['GND'])]]);
assert(st.some(x => x.status === 'REQUIRED_UNCONNECTED'), '0Ω 未连通时状态为 REQUIRED_UNCONNECTED');
assert(st.filter(x => x.hint).length >= 1 && /0Ω/.test(st.find(x => x.hint).hint), '0Ω 未连通时文案说明「只连自身两脚」');
// ③ 普通电阻未连通不应该带这个提示
st = runSO([PLAIN], [['R1:1', { ref: 'R1', pin: 1, net: 'GND', grid: [4, 4] }],
  ['R1:2', { ref: 'R1', pin: 2, net: 'GND', grid: [7, 4] }]],
  [['4,4', new Set(['GND'])], ['7,4', new Set(['GND'])]]);
assert(!st.some(x => x.hint), '普通电阻不出现 0Ω 提示');

console.log(res.join('\n'));
console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
