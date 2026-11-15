// 回归测试：三极管脚序要按「封装」判定，而不是按内部 kind。
//
// 背景：立创 / 嘉立创导出的 Protel 网表不带引脚功能名，pinInfo 里只有 "1"/"2"/"3"。
// 唯一的依据是封装，而内部的 kind 只剩 5 种直插外形，SOT-23 会被归成 to92。
// TO-92 的常见排布是 1=E 2=B 3=C，SOT-23 的 BJT 却是 1=B 2=E 3=C（JEDEC 标准），
// 所以旧版本把 B 和 E 正好标反。
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
  const i = src.indexOf('var ' + name);
  if (i < 0) throw new Error('not found: var ' + name);
  const semi = src.indexOf(';', i);
  return src.slice(i, semi + 1) + '\n';
}

const sandbox = { window: {}, Math, JSON, String, Number, Array, Object, console };
vm.createContext(sandbox);
vm.runInContext(
  grabDecl(bundle, '__lcTriKinds') +
  grabDecl(bundle, '__lcPinOrderPresets') +
  grabDecl(bundle, '__lcPkgPresets') +
  grabDecl(bundle, '__lcPkgTitles') +
  grabDecl(bundle, '__lcPresetInk') +
  grabFn(bundle, 'function __lcPinOrderOf(') +
  grabFn(bundle, 'function __lcPinPlanTag(') +
  grabFn(bundle, 'function __lcPkgText(') +
  grabFn(bundle, 'function __lcPkgFamily(') +
  grabFn(bundle, 'function __lcPinNamePlan(') +
  grabFn(bundle, 'function __lcPinInk(') +
  grabFn(bundle, 'function __lcPinNamesOf(') +
  grabFn(bundle, 'function __lcTriPinTable('),
  sandbox);

const R = (js) => vm.runInContext(js, sandbox);
const fam = (c) => R('__lcPkgFamily(' + JSON.stringify(c) + ')');
const plan = (kind, info, order, n, pkg) => R(
  '__lcPinNamePlan(' + JSON.stringify(kind) + ',' + JSON.stringify(info) + ',' +
  JSON.stringify(order) + ',' + n + ',' + JSON.stringify(pkg) + ')');

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- 1) 封装族识别 ---------- */
assert(fam({ value: 'S8050_SOT_NPN' }) === 'sot23',
  '立创 Device 名 S8050_SOT_NPN → sot23（老工程只留了 value）');
assert(fam({ footprint: 'S8050_SOT-23' }) === 'sot23', 'FOOTPRINT S8050_SOT-23 → sot23');
assert(fam({ footprint: 'SOT-23-3P_L2.9-W1.3-H1.0-LS2.4-P0.95' }) === 'sot23',
  '立创 3D Model Title 里的 SOT-23-3P 也能认（含 -3P 后缀）');
assert(fam({ value: 'S8050_TO-92' }) === 'to92', 'TO-92 直插');
assert(fam({ footprint: 'TO-92-3' }) === 'to92', 'TO-92-3 直插');
assert(fam({ value: 'TO-220' }) === 'to220', 'TO-220');
assert(fam({ value: 'TO-247-3' }) === 'to247', 'TO-247');
assert(fam({ value: 'TO-3' }) === 'to3', 'TO-3 不被 TO-39 抢走');
assert(fam({ value: 'TO-39' }) === 'to39', 'TO-39');
assert(fam({ footprint: 'SOT-223-3P' }) === 'sot223', 'SOT-223 先于 SOT-23 命中');
assert(fam({ footprint: 'SOT-89-3' }) === 'sot89', 'SOT-89');
assert(fam({ footprint: 'TO-252-2' }) === 'to252', 'TO-252(DPAK)');
assert(fam({ value: 'SC-70' }) === 'sot23', 'SC-70 与 SOT-23 同排布');
assert(fam({ value: '2N3055' }) === '', '只有型号、没有封装信息时返回空（不瞎猜）');
assert(fam(null) === '', 'null 安全');
/* 直插优先：型号里同时出现 TO-92 与其他字样 */
assert(fam({ value: 'S8050', footprint: 'TO-92', note: 'SOT-23' }) === 'to92',
  'footprint 是 TO-92 时不被 value 里的 SOT 带偏');

/* ---------- 2) 核心：SOT-23 的 1=B 2=E 3=C ---------- */
const synth = { 1: { name: '1' }, 2: { name: '2' }, 3: { name: '3' } };
assert(eq(plan('to92', synth, null, 3, 'sot23'), ['B', 'E', 'C']),
  'SOT-23 三极管：合成脚号名 + 未选脚序 → 1=B 2=E 3=C（' + JSON.stringify(plan('to92', synth, null, 3, 'sot23')) + '）');
assert(eq(plan('to92', synth, null, 3, 'to92'), ['E', 'B', 'C']), 'TO-92 仍是 1=E 2=B 3=C');
assert(eq(plan('to92', synth, null, 3, ''), ['E', 'B', 'C']), '封装认不出时退回 kind 旧预设（向后兼容）');
assert(eq(plan('to92', synth, null, 3), ['E', 'B', 'C']), '不传 pkg 参数也不炸（旧调用点）');
assert(R('__lcPinNamePlan("to92",{1:{name:"1"},2:{name:"2"},3:{name:"3"}},null,3,"sot23").__lcFrom') === 'preset',
  '封装预设仍标记 preset（黄色，表示「没确认过」）');

/* ---------- 3) 优先级不变：网表名 > 手选 > 预设 ---------- */
assert(eq(plan('to92', { 1: { name: 'B' }, 2: { name: 'E' }, 3: { name: 'C' } }, null, 3, 'to92'), ['B', 'E', 'C']),
  '网表给了真名就用真名，不被封装预设覆盖');
assert(eq(plan('to92', synth, 'EBC', 3, 'sot23'), ['E', 'B', 'C']),
  '手选脚序优先于封装预设（用户说 1=E 就是 1=E）');
assert(R('__lcPinNamePlan("to92",{1:{name:"1"},2:{name:"2"},3:{name:"3"}},"BEC",3,"sot23").__lcFrom') === 'manual',
  '手选来源标记 manual（白色）');

/* ---------- 4) 不能把六脚 SOT-23-6 芯片当成三极管 ---------- */
assert(eq(plan('dip', synth, null, 6, 'sot23'), ['1', '2', '3', '4', '5', '6']),
  'SOT-23-6 六脚芯片不套 B-E-C，只标脚号');
assert(eq(plan('to92', { 1: { name: 'A' }, 2: { name: 'K' } }, null, 2, 'sot23'), ['A', 'K']),
  '两脚元件即使封装含 SOT 也走网表名');

/* ---------- 5) 属性面板文案 ---------- */
const cQ1 = {
  kind: 'to92', label: 'Q', name: 'Q1', value: 'S8050_SOT_NPN', pinCount: 3,
  pinOffsets: [[-1, 0], [0, 0], [1, 0]], pinOrder: undefined
};
sandbox.window.__lcProject = { importState: { pinInfo: { Q1: synth } } };
const txt = R('__lcTriPinTable(' + JSON.stringify(cQ1) + ')');
assert(txt.indexOf('封装 SOT-23') >= 0, '面板标出识别到的封装（' + txt + '）');
assert(txt.indexOf('脚1 B') >= 0 && txt.indexOf('脚2 E') >= 0 && txt.indexOf('脚3 C') >= 0,
  '面板对照行按 SOT-23 给 B/E/C（' + txt + '）');
assert(txt.indexOf('SOT-23 常见排布 B-E-C') >= 0, '面板说明这是 SOT-23 的常见排布、属暂标');
assert(txt.indexOf('黄色') >= 0, '面板说明黄色 = 暂标');

const cTO92 = { kind: 'to92', name: 'Q2', value: 'S8050_TO-92', pinCount: 3, pinOffsets: [[-1, 0], [0, 0], [1, 0]] };
sandbox.window.__lcProject = { importState: { pinInfo: { Q2: synth } } };
const txt2 = R('__lcTriPinTable(' + JSON.stringify(cTO92) + ')');
assert(txt2.indexOf('脚1 E') >= 0 && txt2.indexOf('脚2 B') >= 0,
  'TO-92 的对照行仍是 E/B/C（' + txt2 + '）');

/* ---------- 6) 打包产物里配套改动确实生效 ---------- */
assert(bundle.indexOf('var __lcPkgPresets = {') >= 0, '存在封装预设表');
assert(/sot23:\s*"BEC"/.test(bundle), 'SOT-23 预设为 BEC');
assert(bundle.indexOf('function __lcPkgFamily(c)') >= 0, '存在封装族识别函数');
assert(bundle.indexOf('footprint:String(c.footprint||c.packageName||"")') >= 0,
  '导入时把认到的封装也写进组件（footprint 或 packageName）');
assert(bundle.indexOf('(fields (field (name "Footprint") "\' + __lcEsc(c.footprint) + \'"))') >= 0,
  'Protel 转换器补上 KiCad 8 的 fields 结构，否则 packageName 永远是空');
assert(bundle.indexOf('__lcPinNamePlan(c.kind, pi[c.name], c.pinOrder, n, __lcPkgFamily(c))') >= 0,
  '3D 标注与面板都按封装取预设');
assert(bundle.indexOf('||!!__lcPkgPresets[__lcPkgFamily(O)])') >= 0,
  'SOT 系列封装也显示「三极管脚序」下拉');
assert(bundle.indexOf('未指定（按封装常见排布暂标）') >= 0, '下拉首项文案与实际行为一致');

/* ---------- 7) 真实工程：v1.json 的 Q1 ---------- */
const v1Path = 'C:/Users/kai/Desktop/v1.json';
if (fs.existsSync(v1Path)) {
  let pj = null;
  try { pj = JSON.parse(fs.readFileSync(v1Path, 'utf8')); } catch (e) { pj = null; }
  const q = pj && (pj.components || []).find(x => x.name === 'Q1');
  if (q) {
    sandbox.window.__lcProject = pj;
    assert(fam(q) === 'sot23', 'v1.json 的 Q1 被认出是 SOT-23（value=' + q.value + '）');
    const got = R('__lcPinNamesOf(' + JSON.stringify(q) + ')');
    assert(eq(got.slice(0, 3), ['B', 'E', 'C']),
      'v1.json 的 Q1 三只脚依次是 B/E/C（实际 ' + JSON.stringify(got) + '）');
    assert(R('__lcPinInk(__lcPinNamesOf(' + JSON.stringify(q) + '))') === 16762967,
      '仍按「暂标」用暖黄色，没冒充网表给的名字');
    /* 与网表交叉验证：Q1-3 接 +5V（集电极）、Q1-1 在基极分压网（R3/C2/SW1）、
       Q1-2 经 R1 出到定时网络（发射极）。 */
    const nets = (pj.importState && pj.importState.nets) || pj.nets || [];
    const netOf = (pin) => {
      for (const n of nets) for (const nd of (n.nodes || [])) {
        if (nd.ref === 'Q1' && String(nd.pin) === pin) return n.name;
      }
      return null;
    };
    assert(netOf('3') === '+5V', 'Q1-3 在网表里接 +5V（' + netOf('3') + '）');
    assert(got[2] === 'C', 'Q1-3 接 +5V → 应为集电极 C（实际 ' + got[2] + '）');
    const n1 = netOf('1') || '';
    assert(n1.indexOf('$1N5') >= 0, 'Q1-1 落在基极分压网 $1N5（' + n1 + '）');
    assert(got[0] === 'B', 'Q1-1 接基极分压（R3/C2/SW1）→ 应为 B（实际 ' + got[0] + '）');
    assert(got[1] === 'E', 'Q1-2 经 R1 出到定时网络 → 应为 E（实际 ' + got[1] + '）');
  } else {
    res.push('SKIP v1.json 里没有 Q1');
  }
} else {
  res.push('SKIP 未找到 v1.json');
}

console.log(res.join('\n'));
console.log('\n' + (res.some(x => x.startsWith('FAIL')) ? 'HAS FAILURES' : 'ALL PASS') +
  ' (' + res.filter(x => x.startsWith('PASS')).length + '/' + res.length + ')');
