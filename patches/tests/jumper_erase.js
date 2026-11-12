// 回归测试：擦除模式必须能删掉跳线。
// 历史 bug：Lt() 只用孔坐标严格相等（om）匹配跳线的 from/to，
// 点拱起的弧线得到的是弧下方的孔 → 永远不匹配，且没有任何提示。
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BUNDLE = path.join(__dirname, '../../src/dist/assets/index-C0NrTOjn.js');
const bundle = fs.readFileSync(BUNDLE, 'utf8');

function grabFn(src, name) {
  const sig = name.startsWith('function ') ? name : 'function ' + name + '(';
  const i = src.indexOf(sig);
  if (i < 0) throw new Error('fn not found: ' + name);
  const b = src.indexOf('{', src.indexOf(')', i));
  let d = 0, e = -1;
  for (let k = b; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) { e = k; break; } }
  }
  return src.slice(i, e + 1) + '\n';
}

const sandbox = {
  window: {}, Math, JSON, String, Number, Array, Object, console,
  crypto: { randomUUID: (() => { let c = 0; return () => 'new' + (++c); })() },
};
vm.createContext(sandbox);

let commits = 0;
sandbox.__setProject = p => { sandbox.window.__lcProject = p; };
sandbox.H = fn => {
  const cur = sandbox.window.__lcProject;
  const next = fn(cur);
  if (next !== cur) { commits += 1; sandbox.window.__lcProject = next; }
};

['om', '$O', 'q2', 'JO', 'ZO', 'function Lt(Q,jumperId)'].forEach(n => vm.runInContext(grabFn(bundle, n), sandbox));

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

const mkProject = () => ({
  routing: {
    traces: [{ id: 't1', net: 'N1', points: [[0, 0], [1, 0], [2, 0]] }],
    jumpers: [
      { id: 'j1', net: 'N1', from: [5, 5], to: [9, 5] },
      { id: 'j2', net: 'N2', from: [20, 5], to: [24, 5] },
    ],
  },
});

const call = (Q, jid) => vm.runInContext(
  'Lt(' + JSON.stringify(Q) + ',' + JSON.stringify(jid === undefined ? null : jid) + ')', sandbox);

// 1) 点跳线端点孔 → 按孔位删掉
let p = mkProject(); sandbox.__setProject(p); commits = 0;
let ok = call([5, 5]);
assert(ok === true, '点跳线 from 孔应删除成功');
assert(sandbox.window.__lcProject.routing.jumpers.length === 1, '删除后只剩 1 条跳线，实际 ' +
  sandbox.window.__lcProject.routing.jumpers.length);
assert(sandbox.window.__lcProject.routing.jumpers[0].id === 'j2', '删掉的是 j1');

// 2) 点拱起的弧线中段：孔位上没有任何铜箔，但射线命中了 j2 → 按 id 删除
p = mkProject(); sandbox.__setProject(p); commits = 0;
ok = call([22, 4], 'j2');
assert(ok === true, '按 jumperId 删除成功（弧线中段点击）');
assert(sandbox.window.__lcProject.routing.jumpers.length === 1 &&
  sandbox.window.__lcProject.routing.jumpers[0].id === 'j1', '只剩 j1');

// 3) 点空白孔、也没有命中跳线 → 不提交、返回 false（上层给提示）
p = mkProject(); sandbox.__setProject(p); commits = 0;
ok = call([15, 15], null);
assert(ok === false, '空白处返回 false');
assert(commits === 0, '空白处不产生提交，实际提交 ' + commits + ' 次');

// 4) 跳出线外（id 不存在）也不能误删
p = mkProject(); sandbox.__setProject(p); commits = 0;
ok = call([15, 15], 'nope');
assert(ok === false && commits === 0, '不存在的 jumperId 不删任何东西');

// 5) 走锡删除仍然工作（点走锡上的孔 → 该段被移除）
p = mkProject(); sandbox.__setProject(p); commits = 0;
ok = call([1, 0], null);
assert(ok === true, '点走锡上的孔应删除成功');
assert(sandbox.window.__lcProject.routing.traces.length === 0,
  '删除后该走锡被移除，实际剩余 ' + sandbox.window.__lcProject.routing.traces.length);

// 5b) 点在走锡之外（没有铜箔）→ 返回 false，不提交
p = mkProject(); sandbox.__setProject(p); commits = 0;
ok = call([1, 7], null);
assert(ok === false && commits === 0, '走锡外空白处返回 false 且不提交');

// 6) 孔位优先：同一孔上既有走锡端点又有跳线端点，都被删掉
p = {
  routing: {
    traces: [{ id: 't1', net: 'N1', points: [[3, 3], [4, 3]] }],
    jumpers: [{ id: 'j9', net: 'N1', from: [3, 3], to: [9, 9] }],
  },
};
sandbox.__setProject(p); commits = 0;
ok = call([3, 3], 'j-something-else');
assert(ok === true, '孔位命中时以孔位为准');
assert(sandbox.window.__lcProject.routing.jumpers.length === 0, '该孔上的跳线被删');

// 7) from 缺失的脏数据不能抛异常
p = {
  routing: {
    traces: [],
    jumpers: [{ id: 'bad', net: 'N1', from: null, to: [9, 9] }],
  },
};
sandbox.__setProject(p);
let threw = false;
try { call([9, 9], null); } catch (e) { threw = true; }
assert(!threw, '脏数据（from 为空）不抛异常');

console.log(res.join('\n'));
console.log(res.every(x => x.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
