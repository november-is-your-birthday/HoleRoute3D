// 回归测试：继续布线必须保留已有的（手工）跳线。
// 历史 bug：主包 Y4() 的第 7 个参数（旧跳线）只在面包板分支被读取，洞洞板分支完全忽略，
// 于是「保留已有走锡 / 跳线」只兑现了走锡那一半——手工跳线在继续布线后全部消失。
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

const OLD = [
  { id: 'm1', net: 'MANUAL', from: [3, 3], to: [7, 3], layer: 'jumper' },
  { id: 'm2', net: 'MANUAL', from: [3, 9], to: [7, 9], layer: 'jumper' },
];

let planResult = { ok: true };
let newRouting = {
  traces: [{ id: 't9', net: 'N1', points: [[1, 1], [2, 1]] }],
  jumpers: [
    { id: 'n1', net: 'N2', from: [5, 5], to: [9, 5], layer: 'jumper' },
    { id: 'dup', net: 'MANUAL', from: [3, 3], to: [7, 3], layer: 'jumper' },
  ],
  failedNets: [],
  warnings: [],
};

const sandbox = {
  window: {}, Math, JSON, String, Number, Array, Object, console,
  setTimeout: () => 0,
  Io: () => [{ net: 'N1', ref: 'R1', pin: 1, grid: [1, 1] }],
  Er: () => ({}),
  __lcContinuePlan: () => (planResult.ok ? { plan: 1 } : null),
  f4: () => newRouting,
  __lcToast: () => {},
};
vm.createContext(sandbox);

function run(project) {
  let out = project;
  sandbox.H = fn => { out = fn(out); };
  sandbox.__lcToast = () => {};
  vm.runInContext(grabFn(bundle, 'function __lcContinueRoute('), sandbox);
  vm.runInContext('__lcContinueRoute()', sandbox);
  return out;
}

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

const mk = () => ({
  board: { width: 10, height: 10 },
  components: [],
  importState: { nets: [] },
  routing: { traces: [{ id: 't1', net: 'N1', points: [[1, 1], [3, 1]] }], jumpers: OLD.slice(), warnings: [] },
});

// 1) 旧跳线一条不少
let out = run(mk());
const ids = out.routing.jumpers.map(j => j.id);
assert(ids.indexOf('m1') >= 0 && ids.indexOf('m2') >= 0, '手工跳线 m1 / m2 被保留，实际 ' + JSON.stringify(ids));
assert(ids.indexOf('n1') >= 0, '新建跳线 n1 也在，实际 ' + JSON.stringify(ids));

// 2) 与旧跳线完全一致的重复项只保留一条
assert(ids.filter(x => x === 'm1' || x === 'dup').length === 1, '同 net+from+to 的重复跳线被去重');

// 3) 走锡不被这次合并影响
assert(out.routing.traces.length === newRouting.traces.length, '走锡取自新结果，未被合并逻辑污染');

// 4) 有结果反馈
assert((out.routing.warnings || []).some(w => String(w).indexOf('继续布线：') === 0),
  '写入「继续布线：…」结果反馈');

// 5) 剩余未连通网络数写进反馈
newRouting = Object.assign({}, newRouting, { failedNets: ['N3', 'N4'] });
out = run(mk());
assert((out.routing.warnings || []).some(w => String(w).indexOf('仍有 2 个网络未连通') >= 0),
  '未连通网络数进入反馈文案');
newRouting = Object.assign({}, newRouting, { failedNets: [] });

// 6) 全部连通时的文案
out = run(mk());
assert((out.routing.warnings || []).some(w => String(w).indexOf('全部网络已连通') >= 0),
  '全部连通时的反馈文案');

// 7) 无需继续布线时不破坏原 routing
planResult = { ok: false };
const before = mk();
out = run(before);
assert(out.routing.jumpers.length === OLD.length, '无需布线时跳线原样保留');
assert((out.routing.warnings || []).some(w => String(w).indexOf('无需继续布线') >= 0), '给出「无需继续布线」提示');
planResult = { ok: true };

// 8) 没有任何旧跳线时也能正常工作
const empty = mk();
empty.routing.jumpers = [];
out = run(empty);
assert(out.routing.jumpers.length === newRouting.jumpers.length,
  '无旧跳线时完全采用新结果，实际 ' + out.routing.jumpers.length);

console.log(res.join('\n'));
console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
