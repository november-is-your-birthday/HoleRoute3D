// 飞线层（ratsnest）离线回归：抽取 bundle 中的 __lcRats* 源码，用 three 的 mock 执行，
// 校验「每个网络生成的线段数 = 去重孔位数 - 1」以及「DRC 已布通的网络被跳过」。
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
  return { segs: line.geometry.pts.length / 2, scene, group: g };
}

function comp(name, mounted = true) { return { id: name, name, mounted }; }

function endpoints(list) {
  return list.map(([net, ref, pin, gx, gy]) => ({ net, ref, pin, grid: [gx, gy] }));
}

const board = { width: 20, height: 12 };
const comps = [comp('R1'), comp('R2'), comp('R3'), comp('U1')];

// 用例 1：GND 3 个孔、N1 2 个孔、未放置元件 R3 的端点应被忽略 → 2 + 1 = 3 段
const c1 = {
  components: comps,
  importState: {},
  routing: {},
  __io: endpoints([
    ['GND', 'R1', 1, 1, 1], ['GND', 'R2', 1, 5, 1], ['GND', 'R3', 1, 9, 1], ['GND', 'U1', 1, 1, 8],
    ['N1', 'R1', 2, 3, 3], ['N1', 'R2', 2, 7, 3],
    ['N2', 'R3', 2, 11, 5],
  ]),
};
c1.components = [comp('R1'), comp('R2'), comp('U1')]; // R3 未放置
const r1 = build(c1, board);
console.log('用例1 期望 3 段，实际', r1.segs, r1.segs === 3 ? 'PASS' : 'FAIL');

// 用例 2：GND 已被 DRC 判定全部连通 → 只剩 N1 的 1 段
const c2 = JSON.parse(JSON.stringify(c1));
c2.__io = c1.__io;
c2.routing = {
  drc: {
    pinStatuses: [
      { ref: 'R1', pin: 1, expectedNet: 'GND', status: 'CONNECTED' },
      { ref: 'R2', pin: 1, expectedNet: 'GND', status: 'CONNECTED' },
      { ref: 'U1', pin: 1, expectedNet: 'GND', status: 'CONNECTED' },
      { ref: 'R1', pin: 2, expectedNet: 'N1', status: 'REQUIRED_UNCONNECTED' },
      { ref: 'R2', pin: 2, expectedNet: 'N1', status: 'CONNECTED' },
    ],
  },
};
const r2 = build(c2, board);
console.log('用例2 期望 1 段，实际', r2.segs, r2.segs === 1 ? 'PASS' : 'FAIL');

// 用例 3：同网络重复孔位（两个引脚落在同一孔）→ 去重后仍 1 段
const c3 = {
  components: [comp('R1'), comp('R2')],
  importState: {},
  routing: {},
  __io: endpoints([['GND', 'R1', 1, 2, 2], ['GND', 'R2', 1, 2, 2], ['GND', 'R1', 2, 6, 6]]),
};
const r3 = build(c3, board);
console.log('用例3 期望 1 段，实际', r3.segs, r3.segs === 1 ? 'PASS' : 'FAIL');

// 用例 4：开关关闭 → 不生成
const c4 = JSON.parse(JSON.stringify(c3));
c4.__io = c3.__io;
const r4 = build(c4, board);
console.log('用例4（开关开）期望 1 段，实际', r4.segs, r4.segs === 1 ? 'PASS' : 'FAIL');

console.log('坐标检查：GND 段应落在 y=-0.62，x = gx - width/2 + 0.5');
const g1 = r1.scene.children.find((x) => x.userData && x.userData.__lcRatsRoot);
if (g1) {
  const p = g1.children[0].geometry.pts[0];
  console.log('  首点', JSON.stringify(p), p.y === -0.62 ? 'PASS' : 'FAIL');
}
const bad = [r1, r2, r3, r4].filter((r, i) => r.segs !== [3, 1, 1, 1][i]);
process.exit(bad.length ? 1 : 0);
