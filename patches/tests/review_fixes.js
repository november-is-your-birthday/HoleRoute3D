// 回归测试：项目审查报告（2026-11-19）修复项的新增覆盖。
//   P1-1 继续布线：旧跳线焊点进占用表（__lcSeedJumpers），rip-up 不拆手工跳线；
//   P1-2 重做栈：新建/打开工程清空两栈 + 工程令牌，跨工程重做直接拒绝；
//   P2-5 位号：按「前缀 + 未使用最小编号」生成，删除后再添加不产生重复；
//   P2-8 原型名：网络名叫 constructor / toString / __proto__ 不再炸导入器。
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

/* ================= P1-1：旧跳线焊点进占用表 ================= */
{
  const box = { String, Array, Math, Object, Number, Map, console };
  vm.createContext(box);
  vm.runInContext(
    grabFn(bundle, 'function oe(') +
    grabFn(bundle, 'function __lcSeedJumpers('), box);

  const seed = (js, M, O, d) => vm.runInContext(
    '__lcSeedJumpers(__j,__M,__O,__d)',
    Object.assign(box, { __j: js, __M: M, __O: O, __d: d }));

  const J1 = { id: 'j1', net: 'N1', from: [1, 1], to: [5, 1], layer: 'jumper' };
  const J2 = { id: 'j2', net: 'N2', from: [1, 1], to: [1, 5], layer: 'jumper' };

  let M = new Map(), O = new Map(), d = new Map();
  seed([J1, J2], M, O, d);

  assert(O.get('1,1') && O.get('1,1').net === 'N1',
    '焊点 (1,1) 登记进占用表（先到者 N1 保留，审查报告 P1-1）');
  assert(O.get('5,1') && O.get('5,1').net === 'N1', 'N1 跳线远端焊点也占用');
  assert(O.get('1,5') && O.get('1,5').net === 'N2', 'N2 跳线远端焊点也占用');
  assert(M.size === 2 && M.get('j1') && M.get('j1').jumpers.length === 1,
    '每根旧跳线成为独立路由组（SO 汇总时保留原 ID）');
  assert(M.get('j2').priority === Number.MAX_SAFE_INTEGER,
    '旧跳线组优先级最低，规划器只补线不重排它');
  assert(JSON.stringify(d.get('N1')) === JSON.stringify([[1, 1], [5, 1]]),
    '同网络可从旧跳线焊点续线（d 已并入）');
  assert(d.get('N2').length === 2, 'N2 的两个焊点也进已知点集');

  // 幂等：重复登记不产生重复组、不重复追加锚点（Y4 每轮都会重新登记）
  seed([J1], M, O, d);
  assert(M.size === 2, '重复登记幂等（不新建路由组）');
  assert(d.get('N1').length === 2, '重复登记不重复追加锚点（Y4 多轮循环安全）');

  // 空值安全
  seed(null, M, O, d);
  seed([{ id: 'j3', net: 'N3' }], M, O, d);
  assert(M.size === 2, '缺 from/to 的坏跳线被跳过，不炸');

  // Y4 洞洞板分支真的调用了它；rip-up 不拆纯跳线组
  assert(bundle.indexOf('__lcSeedJumpers(c,M,O,d)') >= 0,
    'Y4 洞洞板分支把旧跳线登记进占用/连通');
  assert(bundle.indexOf('!(f.jumpers&&f.jumpers.length&&f.traces.length===0)') >= 0,
    'rip-up 保护：纯跳线路由组（无走锡）不被拆掉');
}

/* ================= P1-2：重做栈跨工程令牌 ================= */
{
  const store = {};
  const box = {
    window: {}, Math, JSON, String, Number, Array, Object, console,
    // 闭包变量的替身（xe / __lcRedoStep / le 引用的真实闭包）
    v: { current: [] },
    e: { current: null },
    S: () => {}, h: () => {},
    Ft: {},
    localStorage: {
      getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, x) => { store[k] = String(x); },
    },
  };
  box.G = x => { box.e.current = x; };
  vm.createContext(box);
  vm.runInContext(
    grabFn(bundle, 'function __lcHistoryLimit(') +
    grabFn(bundle, 'function le(){v.current=') +
    grabFn(bundle, 'function xe(){const Q=v.current.at(-1)') +
    grabFn(bundle, 'function __lcRedoStep('), box);

  const run = js => vm.runInContext(js, box);
  const projA1 = { id: 'A1' }, projA2 = { id: 'A2' }, projB1 = { id: 'B1' }, projB2 = { id: 'B2' };

  // 同工程内：撤销 → 重做 正常
  box.v.current = [projA1]; box.e.current = projA2;
  run('xe()');
  assert(box.e.current === projA1, '同工程撤销：回到 A1');
  assert(Array.isArray(box.window.__lcRedo) && box.window.__lcRedo.length === 1,
    '撤销把 A2 压入重做栈');
  assert(run('__lcRedoStep()') === true && box.e.current === projA2,
    '同工程重做：恢复 A2');

  // 跨工程：撤销后切换工程（le），旧重做必须作废
  box.v.current = [projA1]; box.e.current = projA2;
  run('xe()');                       // 重做栈里有 A2
  run('le()');                       // 新建/打开工程 B
  assert(Array.isArray(box.window.__lcRedo) && box.window.__lcRedo.length === 0,
    'le() 清空重做栈（旧实现只清撤销栈，审查报告 P1-2）');
  const token = box.window.__lcHistoryToken;
  assert(Number.isInteger(token) && token >= 1, 'le() 递增工程令牌');
  assert(run('__lcRedoStep()') === false,
    '跨工程重做被拒绝（Ctrl+Shift+Z 不再把工程 B 换回 A）');
  assert(box.e.current === projA1,
    '被拒绝的重做不改动当前工程');

  // 切换后在新工程里编辑 → 撤销 → 重做 正常（令牌重新对齐）
  box.v.current = [projB1]; box.e.current = projB2;
  run('xe()');
  assert(box.window.__lcRedo.length === 1 && box.window.__lcRedo[0] === projB2,
    '新工程里的撤销正常入栈（旧栈已被令牌重置）');
  assert(run('__lcRedoStep()') === true && box.e.current === projB2,
    '新工程里的重做正常恢复');

  // 陈旧栈（令牌不匹配）在撤销时也会被清空重贴
  box.window.__lcRedo = [{ stale: true }];
  box.window.__lcRedo.__lcToken = 0;
  box.window.__lcHistoryToken = 99;
  box.v.current = [projB1]; box.e.current = projB2;
  run('xe()');
  assert(box.window.__lcRedo.length === 1 && !box.window.__lcRedo[0].stale,
    '撤销时清理陈旧重做栈并重新贴令牌');
}

/* ================= P2-5：位号唯一 ================= */
{
  const box = { String, Array, Math, Object, Number, console };
  vm.createContext(box);
  vm.runInContext(
    grabFn(bundle, 'function __lcUniqueRef(') +
    grabFn(bundle, 'function qO('), box);
  const R = js => vm.runInContext(js, box);

  assert(R('qO("R",3)') === 'R3', 'qO 旧格式化保持不变');

  assert(R('__lcUniqueRef("R",[{name:"R1"},{name:"R2"},{name:"R3"}])') === 'R4',
    '无空洞时取下一个编号 R4');
  assert(R('__lcUniqueRef("R",[{name:"R1"},{name:"R3"}])') === 'R2',
    '删掉 R2 后再添加 → 补 R2，不再产生第二个 R3（审查报告 P2-5）');
  assert(R('__lcUniqueRef("R",[])') === 'R1', '空工程从 R1 开始');
  assert(R('__lcUniqueRef("Q1",[])') === 'Q1', 'label 里的数字被剥掉后重排（Q1 → Q1）');
  assert(R('__lcUniqueRef("R",[{id:"x1",name:"R1"},{id:"x2",name:"R2"}],"x2")') === 'R2',
    '重命名时排除自身（excludeId），自己的名字可复用');
  assert(R('__lcUniqueRef("R",[{name:"R1"},{name:"R2"},{name:"R3"},{name:"R4"}])') === 'R5',
    '连续编号正确递增');

  // 落板点真的用了它（不再 components.length+1）
  assert(bundle.indexOf('name:__lcUniqueRef(Q.label,i.components)') >= 0,
    '库放置用 __lcUniqueRef 生成位号');
  assert(bundle.indexOf('name:qO(Q.label,i.components.length+1)') < 0,
    '旧的 length+1 位号生成已移除');
}

/* ================= P2-8：网络名撞原型属性 ================= */
{
  const box = { window: {}, Math, JSON, String, Number, Array, Object, console };
  vm.createContext(box);
  vm.runInContext(
    grabFn(bundle, 'function __lcTriPolarityText(') +
    grabFn(bundle, 'function __lcEnetCategory(') +
    grabFn(bundle, 'function __lcEnet('), box);

  const sample = {
    components: {
      c1: {
        props: { Designator: 'D1', Value: '1N4148', FootprintName: 'SOD-123' },
        pinInfoMap: {
          '1': { name: 'K', number: '1', net: 'constructor' },
          '2': { name: 'A', number: '2', net: 'toString' }
        }
      },
      c2: {
        props: { Designator: 'R1', Value: '10k', FootprintName: 'R_0603' },
        pinInfoMap: {
          '1': { name: '1', number: '1', net: '__proto__' },
          '2': { name: '2', number: '2', net: 'hasOwnProperty' }
        }
      }
    }
  };
  box.__sample = sample;
  let out = null;
  let err = null;
  try { out = box.JSON.parse(box.__dummy = vm.runInContext('JSON.stringify(__lcEnet(__sample,"t.enet"))', box)); }
  catch (ex) { err = ex; }
  assert(!err, '网络名叫 constructor/toString/__proto__ 不再抛错（审查报告 P2-8' + (err ? '：' + err.message : '') + '）');
  if (out) {
    const names = out.nets.map(n => n.name).sort();
    assert(JSON.stringify(names) === JSON.stringify(['__proto__', 'constructor', 'hasOwnProperty', 'toString']),
      '四个原型名网络全部聚合成功（' + names.join(',') + '）');
    const nC = out.nets.find(n => n.name === 'constructor');
    assert(nC && nC.nodes.length === 1 && nC.nodes[0].ref === 'D1' && nC.nodes[0].pin === '1',
      'constructor 网络的节点归属正确');
    assert(vm.runInContext('var __o=__lcEnet(__sample,"t.enet");Object.getPrototypeOf(__o.pinInfo)===null', box),
      'pinInfo 用无原型字典（Object.create(null)）');
  }
}

console.log(res.join('\n'));
console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
