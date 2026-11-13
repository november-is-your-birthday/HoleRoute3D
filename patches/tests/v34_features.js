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
  ['(__lcDrcUnion(s,c,_,S,oe)),', 'DRC 内部按元件并接 0Ω 两脚（不占中间孔）'],
  ['__lcContinuePlan(Q.board,eps,Q.components,__lcBridgeTraces(', '继续布线注入零欧桥接'],
  ['for(var __li=0;__li<__lb.length;__li+=1)uni(key(__lb[__li].from),key(__lb[__li].to));', '飞线并查集合并零欧两端'],
  ['__lcZeroOhm(O)&&P.jsx("span"', '属性面板标注「0Ω 视为导线」'],
];
// v3.4.2：DRC 不能再收到「铺」在两焊盘之间的虚拟走锡，否则中间孔会被误判短路
assert(bundle.indexOf('J0(Q.board,__lcRoutingBridges(Q)') < 0,
  'DRC 不再接收虚拟桥接走锡（只在内部并连通性）');
assert(bundle.indexOf('function __lcDrcUnion(comps, byPin, uf, cells, keyFn)') >= 0,
  '存在只并连通性、不占孔的桥接辅助函数');

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
function growBox(project, opts) {
  const toasts = [];
  const confirms = [];
  const state = { project };
  const win = { __lcProject: project, __lcCommit: fn => { state.project = fn(state.project); } };
  if (opts && opts.confirm !== undefined) {
    win.confirm = m => { confirms.push(m); return opts.confirm; };
  }
  const gb = {
    window: win,
    Math, JSON, String, Number, Array, Object, console,
    __lcToast: m => toasts.push(m),
    Zi: () => ({ capabilities: { canResizeWidth: true } }),
    Si: (c, pin) => {
      const o = (c.pinOffsets || [])[pin - 1] || [0, 0];
      return [c.position[0] + o[0], c.position[1] + o[1]];
    },
  };
  vm.createContext(gb);
  ['__lcLcName', '__lcLineHits', '__lcAsk', '__lcBoardGrow'].forEach(n =>
    vm.runInContext(grabFn(bundle, 'function ' + n + '('), gb));
  return { gb, state, toasts, confirms };
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
let { gb, state, toasts, confirms } = growBox(mkBoard(10, 10));
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

// v3.4.5：边界上只有铜箔时不再硬拒绝 —— 连同行列一起删；元件仍然拒绝
function mkSmall(extra) {
  return Object.assign({
    board: { width: 6, height: 6, kind: 'perfboard' },
    components: [{ id: 'a', name: 'A', mounted: true, position: [2, 2], pinOffsets: [[0, 0], [2, 0]] }],
    routing: { traces: [], jumpers: [], warnings: [] },
  }, extra || {});
}

// 只有一个点的走锡（画不出任何东西）不能挡住删列，并且会被清掉
const degen = mkSmall({ routing: { traces: [{ id: 'd1', net: 'MANUAL', points: [[0, 0]], layer: 'bottom', locked: true }], jumpers: [], warnings: [] } });
({ gb, state, toasts } = growBox(degen));
vm.runInContext('__lcBoardGrow("left",-1)', gb);
assert(state.project.board.width === 5, '只有一个点的残片不再挡住删列（宽 ' + state.project.board.width + '）');
assert(state.project.routing.traces.length === 0, '残片顺带被清掉');

// 右边界有真走锡：确认后连铜箔一起删
const edge = mkSmall({ routing: { traces: [{ id: 't1', net: 'N1', points: [[4, 1], [5, 1]] }, { id: 't2', net: 'N2', points: [[1, 1], [1, 2]] }], jumpers: [], warnings: [] } });
({ gb, state, toasts, confirms } = growBox(edge, { confirm: true }));
vm.runInContext('__lcBoardGrow("right",-1)', gb);
assert(state.project.board.width === 5, '最右列有走锡时确认后可以删列');
assert(state.project.routing.traces.length === 1 && state.project.routing.traces[0].id === 't2', '只删掉碰到该列的走锡');
assert(confirms.length === 1 && confirms[0].indexOf('1 段走锡') >= 0, '确认框说明会删多少走锡（' + confirms[0] + '）');
assert(toasts.some(t => t.indexOf('同时移除 1 段走锡') >= 0), '成功提示写明移除了几段走锡');

// 取消确认则板与铜箔都不动
({ gb, state, toasts } = growBox(mkSmall({ routing: { traces: [{ id: 't1', net: 'N1', points: [[4, 1], [5, 1]] }], jumpers: [], warnings: [] } }), { confirm: false }));
vm.runInContext('__lcBoardGrow("right",-1)', gb);
assert(state.project.board.width === 6 && state.project.routing.traces.length === 1, '取消确认则板与走锡都不变');
assert(toasts.some(t => t.indexOf('已取消') >= 0), '取消时给出提示');

// 跳线同理
({ gb, state, toasts } = growBox(mkSmall({ routing: { traces: [], jumpers: [{ id: 'j1', net: 'N1', from: [1, 5], to: [3, 5] }], warnings: [] } }), { confirm: true }));
vm.runInContext('__lcBoardGrow("bottom",-1)', gb);
assert(state.project.board.height === 5 && state.project.routing.jumpers.length === 0, '最下一行的跳线随行一起删');
assert(toasts.some(t => t.indexOf('1 根跳线') >= 0), '提示写明移除了几根跳线');

// 元件优先：列上有元件就拒绝，绝不能因为「确认过」就偷偷删元件
const mixed = mkSmall({ routing: { traces: [{ id: 't1', net: 'N1', points: [[5, 1], [5, 2]] }], jumpers: [], warnings: [] } });
mixed.components[0].position = [5, 2];
({ gb, state, toasts } = growBox(mixed, { confirm: true }));
vm.runInContext('__lcBoardGrow("right",-1)', gb);
assert(state.project.board.width === 6, '列上有元件时仍然拒绝');
assert(state.project.routing.traces.length === 1, '拒绝时不动走锡');
assert(toasts.some(t => t.indexOf('先移开再删除') >= 0), '拒绝原因指向元件');

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

/* ---------- 6) v3.4.2：虚拟桥接不能落盘，也不能被 DRC 当成真铜箔 ---------- */
assert(bundle.indexOf('t=__lcStripBridges(t);') >= 0, 'DRC 入口兜底过滤残留的假桥接');
assert(bundle.indexOf('const Zt=__lcStripBridges(f4(yt,zt))') >= 0, '自动布线结果里剔掉假桥接');
assert(bundle.indexOf('var Zt=__lcStripBridges(f4(pl,Er(Q)))') >= 0, '继续布线结果里剔掉假桥接');

const stBox = { Math, JSON, String, Number, Array, Object, console };
vm.createContext(stBox);
vm.runInContext(grabFn(bundle, 'function __lcStripBridges('), stBox);
const strip = v => vm.runInContext('__lcStripBridges(__v)', Object.assign(stBox, { __v: v }));
const rtIn = {
  traces: [
    { id: 't1', net: 'N1', points: [[0, 0], [1, 0]] },
    { id: '__lcBridge:R24', net: 'GND', points: [[2, 2], [5, 2]], __lcBridge: true },
  ],
  jumpers: [{ id: 'j1', net: 'N2', from: [0, 4], to: [2, 4] }],
};
const rtOut = strip(rtIn);
assert(rtOut.traces.length === 1 && rtOut.traces[0].id === 't1', '假桥接被剔除，真实走锡保留');
assert(rtOut.jumpers.length === 1, '跳线不受影响');
assert(strip({ traces: [{ id: 'a', points: [] }], jumpers: [] }).traces.length === 1, '没有桥接时不改动');
const same = { traces: [], jumpers: [] };
assert(strip(same) === same, '没有需要剔除的项时返回原对象（避免多余提交）');

/* ---------- 7) v3.4.3：MANUAL 走锡的网络归属按连通段传播，不按单条线 ---------- */
assert(bundle.indexOf('__lcPrepManualNets(t.traces,t.jumpers,h,oe,Oy)') >= 0,
  'DRC 走锡循环前先做整组网络解析');
assert(bundle.indexOf('const O=Dr(M.points),C=__lcManualNetOf(M);') >= 0,
  '走锡网络名来自解析结果，而不是逐条 z2');
assert(bundle.indexOf(',R=__lcManualNetOf(M);') >= 0, '跳线与走锡共用同一套解析');

const mBox = {
  Map, Set, JSON, String, Number, Array, Object, console,
};
vm.createContext(mBox);
vm.runInContext(
  'class Uf{constructor(){this.p=new Map()}add(k){if(!this.p.has(k))this.p.set(k,k)}' +
  'find(k){if(!this.p.has(k))this.p.set(k,k);var r=k;while(this.p.get(r)!==r)r=this.p.get(r);' +
  'while(this.p.get(k)!==r){var n=this.p.get(k);this.p.set(k,r);k=n}return r}' +
  'union(a,b){var ra=this.find(a),rb=this.find(b);if(ra!==rb)this.p.set(ra,rb)}}\n' +
  'var __lcManualNetMap=null;\n' +
  grabFn(bundle, 'function __lcPrepManualNets(') +
  grabFn(bundle, 'function __lcManualNetOf(') +
  'function __prep(tr,jm,pins){var m=new Map();(pins||[]).forEach(function(x){m.set(x[0],new Set(x[1]))});' +
  '__lcPrepManualNets(tr,jm,m,function(x,y){return x+","+y},Uf)}' +
  'function __net(o){return __lcManualNetOf(o)}',
  mBox
);

// 7.1 一根线被拆成「碰焊盘段 + 悬空段」，两段必须同名（否则 DRC 会当成两根线短路）
const segA = { id: 'A', net: 'MANUAL', points: [[0, 0], [0, 1]] };
const segB = { id: 'B', net: 'MANUAL', points: [[0, 1], [0, 2]] };
vm.runInContext('__prep(__tr, [], __pins)', Object.assign(mBox, {
  __tr: [segA, segB],
  __pins: [['0,0', ['$1N32']]],
}));
const nA = vm.runInContext('__net(__a)', Object.assign(mBox, { __a: segA }));
const nB = vm.runInContext('__net(__b)', Object.assign(mBox, { __b: segB }));
assert(nA === '$1N32' && nB === '$1N32', '悬空段继承同组已定网络（' + nA + '/' + nB + '）');

// 7.2 三段链 A($1N11) - B(悬空) - C(GND)：B 归到先定下来的一侧，短路仍留在 0,2 上
const c1 = { id: 'C1', net: 'MANUAL', points: [[0, 0], [0, 1]] };
const c2 = { id: 'C2', net: 'MANUAL', points: [[0, 1], [0, 2]] };
const c3 = { id: 'C3', net: 'MANUAL', points: [[0, 2], [0, 3]] };
vm.runInContext('__prep(__tr, [], __pins)', Object.assign(mBox, {
  __tr: [c1, c2, c3],
  __pins: [['0,0', ['$1N11']], ['0,3', ['GND']]],
}));
const r1 = vm.runInContext('__net(__a)', Object.assign(mBox, { __a: c1 }));
const r2 = vm.runInContext('__net(__b)', Object.assign(mBox, { __b: c2 }));
const r3 = vm.runInContext('__net(__c)', Object.assign(mBox, { __c: c3 }));
assert(r1 === '$1N11', '碰到焊盘的一端保持自己的网络');
assert(r3 === 'GND', '另一端保持自己的网络');
assert(r2 === 'MANUAL', '两端各连一个网络的中间段保留 MANUAL —— 它就是短路点，必须报出来');
assert(r1 !== r3, '两端的网络名不同（真短路仍然存在，交给 DRC 报）');

// 7.3 整组没有任何焊盘：保持 MANUAL（纯悬空铜箔）
const d1 = { id: 'D1', net: 'MANUAL', points: [[5, 5], [5, 6]] };
vm.runInContext('__prep(__tr, [], [])', Object.assign(mBox, { __tr: [d1] }));
assert(vm.runInContext('__net(__a)', Object.assign(mBox, { __a: d1 })) === 'MANUAL',
  '没有焊盘的悬空铜箔仍叫 MANUAL');

// 7.4 自动布线的线自带网络名，不能被改写
const e1 = { id: 'E1', net: '$1N27', points: [[1, 1], [1, 2]] };
vm.runInContext('__prep(__tr, [], __pins)', Object.assign(mBox, {
  __tr: [e1],
  __pins: [['1,1', ['GND']]],
}));
assert(vm.runInContext('__net(__a)', Object.assign(mBox, { __a: e1 })) === '$1N27',
  '自带网络的走锡保持原名');

// 7.5 跳线参与同一套解析：MANUAL 跳线连到有焊盘的一侧后跟随该网络
const f1 = { id: 'F1', net: 'MANUAL', points: [[3, 0], [3, 1]] };
const f2 = { net: 'MANUAL', from: [3, 1], to: [3, 2] };
vm.runInContext('__prep(__tr, __jm, __pins)', Object.assign(mBox, {
  __tr: [f1], __jm: [f2],
  __pins: [['3,0', ['$1N33']]],
}));
assert(vm.runInContext('__net(__b)', Object.assign(mBox, { __b: f2 })) === '$1N33',
  'MANUAL 跳线与走锡同网络（' + vm.runInContext('__net(__b)', Object.assign(mBox, { __b: f2 })) + '）');

/* ---------- 8) v3.4.4：DRC 报错能定位到具体位置 ---------- */
assert(bundle.indexOf('function __lcDrcPanel(i){return __lcDrcPanelV2(i)}') >= 0,
  'DRC 面板换成可定位版本');
assert(bundle.indexOf('window.__lcControls=vt') >= 0, '暴露 OrbitControls 供定位使用');
assert(bundle.indexOf('e.slice(0,12).map') < 0, '错误列表不再只显示前 12 条');
assert(bundle.indexOf('window.__lcDrcGo = __lcDrcGo') >= 0, '错误条目可点击定位');
assert(bundle.indexOf('lc-drc-item') >= 0 && bundle.indexOf('复制全部') >= 0, '面板有定位条目与复制按钮');

const lBox = { console, JSON, String, Number, Math, Array, Object };
vm.createContext(lBox);
['__lcDrcHoles', '__lcDrcWhere', '__lcDrcPinText', '__lcPinIndex', '__lcPinLabel'].forEach(n =>
  vm.runInContext(grabFn(bundle, 'function ' + n + '('), lBox));

// 单孔错误：grid 就是位置
let dHoles = vm.runInContext('__lcDrcHoles({grid:[13,42]})', lBox);
assert(dHoles.length === 1 && dHoles[0][0] === 13 && dHoles[0][1] === 42, 'grid 单孔解析');
assert(vm.runInContext('__lcDrcWhere({grid:[13,42]})', lBox) === '13,42', '位置文案 13,42');

// 底层走锡重叠只有 segment：两端孔都要出来
dHoles = vm.runInContext('__lcDrcHoles({segment:[[8,23],[8,24]]})', lBox);
assert(dHoles.length === 2, 'segment 两端孔都解析出来（' + dHoles.length + '）');
assert(vm.runInContext('__lcDrcWhere({segment:[[8,23],[8,24]]})', lBox) === '8,23 ↔ 8,24',
  '边错误显示两个孔');

// grid 与 segment 指向同一孔时去重
dHoles = vm.runInContext('__lcDrcHoles({grid:[8,24],segment:[[8,23],[8,24]]})', lBox);
assert(dHoles.length === 2, 'grid 与 segment 重复孔去重（' + dHoles.length + '）');

// 没有任何位置信息的错误不能编造坐标
assert(vm.runInContext('__lcDrcWhere({code:"DIP_PIN_GEOMETRY"})', lBox) === '',
  '无位置错误不返回假坐标');

// 孔上的引脚：让「网络间短路」能指到具体是哪只脚
const dIdx = vm.runInContext('__lcPinIndex(__ps)', Object.assign(lBox, {
  __ps: [
    { ref: 'C7', pin: 2, grid: [13, 42], expectedNet: '$1N11', pinName: '2' },
    { ref: 'C7', pin: 2, grid: [13, 42], expectedNet: '$1N11' },
    { ref: 'U2', pin: 5, grid: [8, 23], expectedNet: '$1N32' },
  ],
}));
assert(dIdx['13,42'].length === 1, '同一引脚重复进索引只保留一条');

const dT1 = vm.runInContext('__lcDrcPinText(__e, __i)', Object.assign(lBox, {
  __e: { grid: [13, 42], actualNets: ['MANUAL', '$1N11'] }, __i: dIdx,
}));
assert(dT1.indexOf('C7.2') >= 0 && dT1.indexOf('$1N11') >= 0, '引脚文案带位号与网络（' + dT1 + '）');

const dT2 = vm.runInContext('__lcDrcPinText(__e, __i)', Object.assign(lBox, {
  __e: { segment: [[8, 23], [8, 24]] }, __i: dIdx,
}));
assert(dT2.indexOf('U2.5') >= 0, '边错误也能指出端点上的脚（' + dT2 + '）');

const dT3 = vm.runInContext('__lcDrcPinText(__e, __i)', Object.assign(lBox, {
  __e: { ref: 'R24', pin: 1, expectedNet: 'GND', grid: [11, 32] }, __i: dIdx,
}));
assert(dT3.indexOf('R24.1') === 0, '引脚错误以 R24.1 开头（' + dT3 + '）');

// 引脚名就是脚号时不要显示成 C7.2(2)
assert(dT1.indexOf('C7.2(2)') < 0, '数字引脚名不重复显示（' + dT1 + '）');
const dT4 = vm.runInContext('__lcPinLabel("Q1",2,"C","$1N5")', lBox);
assert(dT4 === 'Q1.2(C)（$1N5）', '带字母的引脚名保留（' + dT4 + '）');

console.log(res.join('\n'));
console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
