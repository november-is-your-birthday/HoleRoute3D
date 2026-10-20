// 独立连通性校验器：只吃「板 + 元件 + 引脚 + 走锡/跳线」，不调用被改动的任何算法代码。
// 用最朴素的并查集判断：同一网络的引脚是否真的连通、不同网络是否被铜连在一起。
//   node harness/check.js            # 校验全部 fixture
//   node harness/check.js --only=dense-mixed
'use strict';
const { loadWorker } = require('./extract.js');
const { buildFixtures, clone } = require('./fixtures.js');

const key = (x, y) => x + ',' + y;

function makeDSU() {
  const parent = new Map();
  const find = (a) => {
    if (!parent.has(a)) parent.set(a, a);
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r);
    let c = a;
    while (parent.get(c) !== r) { const n = parent.get(c); parent.set(c, r); c = n; }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  return { find, union };
}

function checkPlan(board, components, endpoints, plan) {
  const dsu = makeDSU();
  const issues = [];
  const W = board.width, H = board.height;
  const inBoard = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  // 引脚：孔 → 所属网络
  const pinNets = new Map();
  for (const e of endpoints) {
    const k = key(e.grid[0], e.grid[1]);
    if (!pinNets.has(k)) pinNets.set(k, new Set());
    pinNets.get(k).add(e.net);
    dsu.find(k);
  }

  // 走锡：每段必须正交；沿途每个孔都视为被同一网络占用并相连
  for (const t of plan.traces || []) {
    const pts = t.points || [];
    for (let i = 1; i < pts.length; i += 1) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const dx = x1 - x0, dy = y1 - y0;
      if (dx !== 0 && dy !== 0) {
        issues.push({ type: '斜线段', net: t.net, detail: `${x0},${y0} -> ${x1},${y1}` });
        continue;
      }
      if (dx === 0 && dy === 0) continue;
      const n = Math.abs(dx || dy);
      const sx = Math.sign(dx), sy = Math.sign(dy);
      let prev = key(x0, y0);
      if (!inBoard(x0, y0)) issues.push({ type: '出板', net: t.net, detail: key(x0, y0) });
      for (let s = 1; s <= n; s += 1) {
        const cur = key(x0 + sx * s, y0 + sy * s);
        if (!inBoard(x0 + sx * s, y0 + sy * s)) issues.push({ type: '出板', net: t.net, detail: cur });
        dsu.union(prev, cur);
        prev = cur;
      }
    }
    if (pts.length === 1) dsu.find(key(pts[0][0], pts[0][1]));
  }

  // 跳线：只在两端焊接，不碰中途的孔
  for (const j of plan.jumpers || []) {
    const a = key(j.from[0], j.from[1]), b = key(j.to[0], j.to[1]);
    dsu.union(a, b);
  }

  // 1) 同一网络的所有引脚必须在同一连通块
  const netPins = new Map();
  for (const e of endpoints) {
    const k = key(e.grid[0], e.grid[1]);
    if (!netPins.has(e.net)) netPins.set(e.net, []);
    netPins.get(e.net).push(k);
  }
  let unconnectedNets = 0;
  for (const [net, pins] of netPins) {
    const roots = new Set(pins.map((k) => dsu.find(k)));
    if (roots.size > 1) {
      unconnectedNets += 1;
      issues.push({ type: '未连通', net, detail: `${pins.length} 个引脚分散在 ${roots.size} 个连通块` });
    }
  }

  // 2) 同一连通块内不允许出现两个网络的引脚（= 短路）
  const compNets = new Map();
  for (const [k, nets] of pinNets) {
    const r = dsu.find(k);
    if (!compNets.has(r)) compNets.set(r, new Set());
    for (const n of nets) compNets.get(r).add(n);
  }
  let shortGroups = 0;
  for (const [, nets] of compNets) {
    if (nets.size > 1) {
      shortGroups += 1;
      issues.push({ type: '短路', net: [...nets].join(' + '), detail: '同一块铜上有多网络引脚' });
    }
  }

  return {
    unconnectedNets,
    shortGroups,
    illegalSegments: issues.filter((i) => i.type === '斜线段').length,
    offBoard: issues.filter((i) => i.type === '出板').length,
    issues: issues.slice(0, 8),
  };
}

function main() {
  const only = (process.argv.slice(2).find((a) => a.startsWith('--only=')) || '').split('=')[1];
  const { api } = loadWorker();
  const fixtures = buildFixtures().filter((f) => !only || f.name === only);
  let bad = 0;
  console.log(['fixture', 'nets', 'jump', 'traces', '未连通', '短路', '斜线', '出板', '结论'].map((h, i) => h.padEnd(i === 0 ? 16 : 8)).join(''));
  for (const fx of fixtures) {
    const board = clone(fx.board);
    let components = clone(fx.components);
    let endpoints = clone(fx.endpoints);
    const needsPlacement = components.some((c) => !c.mounted);
    if (needsPlacement) {
      const region = { x: 0, y: 0, width: board.width, height: board.height };
      const res = api.hi(components, region, board.width, board.height, endpoints, [], () => {}, board);
      components = res.components;
      endpoints = api.Dt(endpoints, components);
    }
    const plan = api.pn(board, endpoints, components, [], [], null, [], true);
    const r = checkPlan(board, components, endpoints, plan);
    const nets = new Set(endpoints.map((e) => e.net)).size;
    const ok = r.unconnectedNets === 0 && r.shortGroups === 0 && r.illegalSegments === 0 && r.offBoard === 0;
    if (!ok) bad += 1;
    console.log(
      fx.name.padEnd(16) + String(nets).padEnd(8) + String(plan.jumpers.length).padEnd(8) +
      String(plan.traces.length).padEnd(8) + String(r.unconnectedNets).padEnd(8) + String(r.shortGroups).padEnd(8) +
      String(r.illegalSegments).padEnd(8) + String(r.offBoard).padEnd(8) + (ok ? '通过' : '不合格')
    );
    if (!ok) r.issues.forEach((i) => console.log('    -', i.type, i.net, i.detail));
  }
  console.log('\n' + (bad === 0 ? '全部通过' : bad + ' 个 fixture 不合格'));
  process.exitCode = bad === 0 ? 0 : 1;
}

if (require.main === module) main();
module.exports = { checkPlan };
