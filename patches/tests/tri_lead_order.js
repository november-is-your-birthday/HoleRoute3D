// 回归测试：三极管引脚按模型的实际引脚排布落孔（TO-92 = E-B-C，基极居中）
// 背景：网表脚号按符号排（SOT-23 口径 1=B 2=E 3=C），3D 模型是 TO-92，
//       实物 TO-92 的引脚顺序是 E-B-C。旧实现按脚号排孔，基极落在最左边。
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
function grabDecl(src, name) {
  const i = src.indexOf('var ' + name + ' =');
  if (i < 0) throw new Error('decl not found: ' + name);
  const e = src.indexOf('};', i);
  return src.slice(i, e + 2) + '\n';
}

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

const box = { String, Array, Math, Object, console, window: { __lcProject: { importState: {} } } };
vm.createContext(box);
vm.runInContext(
  grabDecl(bundle, '__lcTriKinds') +
  grabDecl(bundle, '__lcPinOrderPresets') +
  grabDecl(bundle, '__lcPkgPresets') +
  grabDecl(bundle, '__lcPkgTitles') +
  grabFn(bundle, 'function __lcPkgText(') +
  grabFn(bundle, 'function __lcPkgFamily(') +
  grabFn(bundle, 'function __lcPinOrderOf(') +
  grabFn(bundle, 'function __lcPinPlanTag(') +
  grabFn(bundle, 'function __lcPinNamePlan(') +
  grabFn(bundle, 'function __lcPinNamesOf(') +
  grabFn(bundle, 'function __lcArrangePlan(') +
  grabFn(bundle, 'function __lcArrangeLeads(') +
  grabFn(bundle, 'function __lcArrangeApply(') +
  grabFn(bundle, 'function __lcPinHoleOf('), box);

const arrange = (c) => vm.runInContext('__lcArrangeLeads(__c)', Object.assign(box, { __c: c }));
const holeOf = (c, i) => vm.runInContext('__lcPinHoleOf(__c,' + i + ')', Object.assign(box, { __c: c }));

/* ---------- 1) 核心：Q1 的基极必须落到中间孔 ---------- */
const q1 = {
  kind: 'to92', label: 'Q', name: 'Q1', value: 'S8050_SOT_NPN', pinCount: 3,
  pinOffsets: [[-1, 0], [0, 0], [1, 0]], position: [18, 38], rotation: 0
};
box.window.__lcProject = { importState: { pinInfo: { Q1: { 1: { name: '1' }, 2: { name: '2' }, 3: { name: '3' } } } } };
arrange(q1);
const h1 = holeOf(q1, 0), h2 = holeOf(q1, 1), h3 = holeOf(q1, 2);
assert(String(h1) === '19,38', '脚1（B，$1N5 基极）落在中间孔 19,38（实际 ' + h1 + '）');
assert(String(h2) === '18,38', '脚2（E）落在左边孔 18,38（实际 ' + h2 + '）');
assert(String(h3) === '20,38', '脚3（C）落在右边孔 20,38（实际 ' + h3 + '）');
assert(String(q1.position) === '19,38', '锚点跟着基极走到中间孔（实际 ' + q1.position + '）');
const holes = [String(h1), String(h2), String(h3)].sort().join(' ');
assert(holes === '18,38 19,38 20,38', '三个孔的集合不变，只是归属重排（实际 ' + holes + '）');

/* ---------- 2) 幂等：再跑一遍不能翻回去 ---------- */
const before = JSON.stringify([q1.position, q1.pinOffsets]);
arrange(q1);
assert(JSON.stringify([q1.position, q1.pinOffsets]) === before, '重复调用结果不变（幂等）');
assert(String(holeOf(q1, 0)) === '19,38', '幂等后基极仍在中间孔');

/* ---------- 3) 已经是 E-B-C 的不动 ---------- */
const good = {
  kind: 'to92', name: 'Q2', value: 'S8050', pinCount: 3,
  pinOffsets: [[-1, 0], [0, 0], [1, 0]], position: [5, 5], rotation: 0,
  pinOrder: 'EBC'
};
box.window.__lcProject = { importState: {} };
arrange(good);
assert(String(good.pinOffsets) === '-1,0,0,0,1,0', '已经是 E-B-C 时不重排（实际 ' + good.pinOffsets + '）');
assert(String(good.position) === '5,5', '位置也不动（实际 ' + good.position + '）');

/* ---------- 4) 默认预设就是 E-B-C，等于已经排好，不能乱动 ---------- */
const unknown = {
  kind: 'to92', name: 'Q3', value: '2N3904', pinCount: 3,
  pinOffsets: [[-1, 0], [0, 0], [1, 0]], position: [7, 7], rotation: 0
};
box.window.__lcProject = { importState: {} };
arrange(unknown);
assert(String(unknown.pinOffsets) === '-1,0,0,0,1,0', '默认 E-B-C 排布时不改动引脚（实际 ' + unknown.pinOffsets + '）');
assert(String(unknown.position) === '7,7', '位置同样不动（实际 ' + unknown.position + '）');

/* ---------- 5) 旋转 180° 后仍然对齐 ---------- */
const rot = {
  kind: 'to92', name: 'Q4', value: 'S8050_SOT_NPN', pinCount: 3,
  pinOffsets: [[-1, 0], [0, 0], [1, 0]], position: [20, 38], rotation: Math.PI
};
box.window.__lcProject = { importState: { pinInfo: { Q4: { 1: { name: '1' }, 2: { name: '2' }, 3: { name: '3' } } } } };
arrange(rot);
const r1 = String(holeOf(rot, 0)), r2 = String(holeOf(rot, 1)), r3 = String(holeOf(rot, 2));
assert(r1 === '19,38', '旋转 180° 后基极仍在中间孔（实际 ' + r1 + '）');
assert([r1, r2, r3].sort().join(' ') === '18,38 19,38 20,38', '旋转后孔位集合仍是 18/19/20（实际 ' + [r1, r2, r3].sort().join(' ') + '）');

/* ---------- 6) 手选脚序 B-C-E 也按实物排布落孔 ----------
   手选 B-C-E：脚1=B、脚2=C、脚3=E；TO-92 物理排布是 E-B-C
   → E 在槽位 0、B 在槽位 1、C 在槽位 2。 */
const manual = {
  kind: 'to92', name: 'Q5', value: 'x', pinCount: 3,
  pinOffsets: [[-1, 0], [0, 0], [1, 0]], position: [3, 3], rotation: 0,
  pinOrder: 'BCE'
};
box.window.__lcProject = { importState: {} };
arrange(manual);
assert(String(holeOf(manual, 0)) === '4,3', '手选 B-C-E：B 落到中间孔 4,3（实际 ' + holeOf(manual, 0) + '）');
assert(String(holeOf(manual, 1)) === '5,3', 'C 落到槽位 2 的孔 5,3（实际 ' + holeOf(manual, 1) + '）');
assert(String(holeOf(manual, 2)) === '3,3', 'E 落到槽位 0 的孔 3,3（实际 ' + holeOf(manual, 2) + '）');

/* ---------- 7) 静态接线 ---------- */
assert(bundle.indexOf('function __lcArrangeLeads(') >= 0, '存在引脚排布校正函数');
assert(bundle.indexOf('__lcArrangeDeferred(i);') >= 0,
  '主渲染只做延迟迁移（不在渲染期直接改工程）');
assert(bundle.indexOf('function __lcArrangeApply(') >= 0, '存在返回新工程对象的显式迁移');
assert(bundle.indexOf('三极管引脚排布已迁移') >= 0, '迁移已布线引脚时作废 DRC 并写明受影响元件');
assert(bundle.indexOf('__lcPinOrderPresets[c.kind]') >= 0, '物理槽位顺序取自模型的引脚排布');

/* ---------- 7) __lcArrangeApply：显式迁移的工程级语义（审查报告 P1-3） ---------- */
{
  const c1 = {
    /* 手选 BEC（脚1=B）+ 默认孔位 → 与 TO-92 实物 E-B-C 不一致，需要迁移 */
    kind: 'to92', label: 'Q', name: 'Q1', value: 'S8050 NPN', id: 'q1id',
    pinCount: 3, pinOffsets: [[-1, 0], [0, 0], [1, 0]], pinOrder: 'BEC',
    position: [10, 10], rotation: 0, mounted: true, extraField: 'keep-me'
  };
  const proj = {
    components: [c1],
    routing: { traces: [], jumpers: [], drc: { errors: [{ code: 'X' }] }, warnings: ['旧警告'] }
  };
  const out = vm.runInContext('__lcArrangeApply(__p)', Object.assign(box, { __p: proj }));

  assert(out !== proj, '__lcArrangeApply 返回新工程对象，不改入参');
  assert(proj.components[0].pinOffsets[0][0] === -1 && proj.components[0].position[0] === 10,
    '入参工程的元件保持原样（渲染期不再偷偷改工程）');
  assert(out.components[0].extraField === 'keep-me',
    '迁移复制保留元件全部字段（Object.assign 展开）');
  assert(out.components[0].position[0] === 11,
    '迁移后 position 同步平移（锚点仍落在脚 1 孔上，实际 x=' + out.components[0].position[0] + '）');
  assert(out.routing.drc === undefined && out.routing.diagnostics === undefined,
    '迁移已布线引脚时旧 DRC 结果作废（不再显示过期的「检查通过」）');
  assert((out.routing.warnings || []).some(w => String(w).indexOf('三极管引脚排布已迁移') >= 0 && String(w).indexOf('Q1') >= 0),
    '警告写明受影响元件（Q1）');
  assert((out.routing.warnings || []).some(w => String(w) === '旧警告'),
    '无关的旧警告保留');

  // 幂等：已迁移的工程再 apply 一次，引用不变（没有可迁移项时原样返回）
  const again = vm.runInContext('__lcArrangeApply(__p2)', Object.assign(box, { __p2: out }));
  assert(again === out, '已迁移工程再次 apply 原样返回（幂等）');

  // 未挂装的元件迁移不产生警告（没有附着铜箔的顾虑）
  const c2 = Object.assign({}, c1, { name: 'Q2', mounted: false });
  const proj2 = { components: [c2], routing: { traces: [], warnings: [] } };
  const out2 = vm.runInContext('__lcArrangeApply(__p3)', Object.assign(box, { __p3: proj2 }));
  assert(!(out2.routing.warnings || []).some(w => String(w).indexOf('三极管引脚排布已迁移') >= 0),
    '未挂装元件迁移不写警告');
}
console.log(res.join('\n'));
console.log(res.every((r) => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
