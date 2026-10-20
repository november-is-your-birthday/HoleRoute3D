// 飞线层（ratsnest）离线回归：抽取 bundle 中的 __lcRats* 源码，用 three 的 mock 执行。
// 核心断言：飞线按「铜是否实际连通」决定显示——已被走锡/跳线连起来的引脚不再有飞线。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BUNDLE = path.join(__dirname, '..', 'src', 'dist', 'assets', 'index-C0NrTOjn.js');
const src = fs.readFileSync(BUNDLE, 'utf8');

const start = src.indexOf('var __lcRatsOn=');
const end = src.indexOf('function __lcThumbKey(');
if (start < 0 || end < 0 || end <= start) throw new Error('找不到 __lcRats 代码块');
const block = src.slice(start, end);

function Re() {
  this.children = [];
  this.userData = {};
  this.parent = null;
  this.visible = true;
  this.add = (o) => { o.parent = this; this.children.push(o); };
  this.remove = (o) => { this.children = this.children.filter((x) => x !== o); o.parent = null; };
}
function X(x, y, z) { this.x = x; this.y = y; this.z = z; }
function Fx(o) { Object.assign(this, o); }
function Gn() {
  this.setFromPoints = (p) => { this.pts = p; return this; };
  this.dispose = () => {};
}
function zx(g, m) { this.geometry = g; this.material = m; }

function build(project, board) {
  const scene = new Re();
  const win = {
    __lcScene: scene,
    __lcProject: project,
    __lcBoardArgs: { board, transparent: false, theme: 'light' },
    __lcRatsOn: true,
    localStorage: { getItem: () => null, setItem: () => {} },
  };
  const sandbox = {
    window: win,
    localStorage: win.localStorage,
    Set, Map, Array, Math, Infinity, Number, String, JSON,
    Io: () => project.__io,
    X, Fx, zx, Gn, Re,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(block, sandbox, { filename: 'rats-block.js' });
  sandbox.__lcRatsRebuild();
  const g = win.__lcRats;
  if (!g) return { segs: 0, scene };
  const line = g.children[0];
  return { segs: line.geometry.pts.length / 2, scene, group: g, pts: line.geometry.pts };
}

function comp(name, mounted = true) { return { id: name, name, mounted }; }
function E(net, ref, pin, gx, gy) { return { net, ref, pin, grid: [gx, gy] }; }
function trace(net, pts) { return { id: 't', net, points: pts, layer: 'bottom', locked: true }; }
function jumper(net, a, b) { return { id: 'j', net, from: a, to: b, layer: 'jumper' }; }

const board = { width: 20, height: 12 };
let fail = 0;
function check(name, got, want) {
  const ok = got === want;
  if (!ok) fail += 1;
  console.log(`${name} 期望 ${want} 段，实际 ${got}`, ok ? 'PASS' : 'FAIL');
}

// 1. 无布线：GND 3 孔 → 2 段，N1 2 孔 → 1 段；未放置元件 R3 的端点被忽略
check('用例1 未布线', build({
  components: [comp('R1'), comp('R2'), comp('U1')],
  importState: {}, routing: {},
  __io: [E('GND', 'R1', 1, 1, 1), E('GND', 'R2', 1, 5, 1), E('GND', 'U1', 1, 1, 8),
         E('N1', 'R1', 2, 3, 3), E('N1', 'R2', 2, 7, 3),
         E('N2', 'R3', 2, 11, 5)],
}, board).segs, 3);

// 2. GND 三个脚已被两条走锡连成一条链 → GND 飞线全消失，只剩 N1 的 1 段
check('用例2 走锡已连通整网', build({
  components: [comp('R1'), comp('R2'), comp('U1')],
  importState: {},
  routing: { traces: [trace('GND', [[1, 1], [3, 1], [5, 1]]), trace('GND', [[5, 1], [5, 4], [1, 4], [1, 8]]), trace('N1', [[3, 3], [3, 5]])] },
  __io: [E('GND', 'R1', 1, 1, 1), E('GND', 'R2', 1, 5, 1), E('GND', 'U1', 1, 1, 8),
         E('N1', 'R1', 2, 3, 3), E('N1', 'R2', 2, 7, 3)],
}, board).segs, 1);

// 3. 三脚网络只连上两个 → 组间仍有 1 段
check('用例3 部分连通', build({
  components: [comp('R1'), comp('R2'), comp('R3')],
  importState: {},
  routing: { traces: [trace('N1', [[2, 2], [6, 2]])] },
  __io: [E('N1', 'R1', 1, 2, 2), E('N1', 'R2', 1, 6, 2), E('N1', 'R3', 1, 2, 9)],
}, board).segs, 1);

// 4. 跳线也能判定连通 → 0 段
check('用例4 跳线连通', build({
  components: [comp('R1'), comp('R2')],
  importState: {},
  routing: { jumpers: [jumper('N1', [4, 4], [9, 9])] },
  __io: [E('N1', 'R1', 1, 4, 4), E('N1', 'R2', 1, 9, 9)],
}, board).segs, 0);

// 5. 走锡的 net 名与网表不一致（手动走锡未选网络）也应判定为已连
check('用例5 net 名不匹配', build({
  components: [comp('R1'), comp('R2')],
  importState: {},
  routing: { traces: [trace('__default', [[4, 4], [9, 9]])] },
  __io: [E('N1', 'R1', 1, 4, 4), E('N1', 'R2', 1, 9, 9)],
}, board).segs, 0);

// 6. 同网络重复孔位去重 → 1 段
check('用例6 重复孔位', build({
  components: [comp('R1'), comp('R2')],
  importState: {}, routing: {},
  __io: [E('GND', 'R1', 1, 2, 2), E('GND', 'R2', 1, 2, 2), E('GND', 'R1', 2, 6, 6)],
}, board).segs, 1);

// 坐标检查
const r1 = build({
  components: [comp('R1'), comp('R2')],
  importState: {}, routing: {},
  __io: [E('N1', 'R1', 1, 1, 1), E('N1', 'R2', 1, 5, 1)],
}, board);
const p0 = r1.pts && r1.pts[0];
const okCoord = !!p0 && p0.y === -0.62 && p0.x === 1 - board.width / 2 + 0.5 && p0.z === 1 - board.height / 2 + 0.5;
console.log('坐标检查 首点', JSON.stringify(p0), okCoord ? 'PASS' : 'FAIL');
if (!okCoord) fail += 1;

process.exit(fail ? 1 : 0);
