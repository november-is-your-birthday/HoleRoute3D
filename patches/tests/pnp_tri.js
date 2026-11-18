// 回归测试：PNP 三极管与元件库 NPN/PNP 条目。
// 背景：用户问「PNP 有没有问题、元件库是不是只有一种三极管」。
//   1) 引脚命名/落孔的规则本身与极性无关（E/B/C 角色一样），必须固定住不回归；
//   2) 元件库原来只有 5 个「空型号」封装条目，分不出 NPN/PNP，也没有 SOT-23；
//   3) 落板时 value 恒为空 → 极性无处可存，属性面板也无从显示。
// 极性识别只用于显示与归类，绝不参与脚序判定。
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
  if (i < 0) throw new Error('decl not found: ' + name);
  const semi = src.indexOf(';', i);
  return src.slice(i, semi + 1) + '\n';
}

const box = {
  window: { __lcProject: { importState: { pinInfo: {}, components: [], nets: [] } } },
  Math, JSON, String, Number, Array, Object, RegExp, console,
};
vm.createContext(box);
vm.runInContext(
  grabDecl(bundle, '__lcTriKinds') +
  grabDecl(bundle, '__lcPinOrderPresets') +
  grabDecl(bundle, '__lcPkgPresets') +
  grabDecl(bundle, '__lcPkgTitles') +
  grabDecl(bundle, '__lcPresetInk') +
  grabFn(bundle, 'function __lcTriPolarityText(') +
  grabFn(bundle, 'function __lcTriPolarity(') +
  grabFn(bundle, 'function __lcPkgText(') +
  grabFn(bundle, 'function __lcPkgFamily(') +
  grabFn(bundle, 'function __lcPinOrderOf(') +
  grabFn(bundle, 'function __lcPinPlanTag(') +
  grabFn(bundle, 'function __lcPinNamePlan(') +
  grabFn(bundle, 'function __lcPinInk(') +
  grabFn(bundle, 'function __lcPinNamesOf(') +
  grabFn(bundle, 'function __lcArrangeLeads(') +
  grabFn(bundle, 'function __lcPinHoleOf(') +
  grabFn(bundle, 'function __lcPinNetOf(') +
  grabFn(bundle, 'function __lcTriPinTable(') +
  grabFn(bundle, 'function __lcMSVocab(') +
  grabFn(bundle, 'function __lcEnetCategory('),
  box);

const R = (js) => vm.runInContext(js, box);
const polText = (s) => R('__lcTriPolarityText(' + JSON.stringify(s) + ')');
const polOf = (c) => R('__lcTriPolarity(' + JSON.stringify(c) + ')');
const names = (c) => JSON.parse(JSON.stringify(R('__lcPinNamesOf(' + JSON.stringify(c) + ')')));
const table = (c) => R('__lcTriPinTable(' + JSON.stringify(c) + ')');
const msCat = (ref, value, category, pkg) => R('__lcMSVocab(' +
  [ref, value, category, pkg].map(x => JSON.stringify(x)).join(',') + ')');
const enCat = (ref, value, fp, n) => R('__lcEnetCategory(' +
  [ref, value, fp, n].map(x => JSON.stringify(x)).join(',') + ')');

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- 1) 极性识别：明确字样 > 型号表 ---------- */
assert(polText('S8050_SOT_NPN') === 'npn', 'S8050_SOT_NPN → npn');
assert(polText('S8550_SOT_PNP') === 'pnp', 'S8550_SOT_PNP → pnp');
assert(polText('S8050') === 'npn', 'S8050 → npn');
assert(polText('S8550') === 'pnp', 'S8550 → pnp');
assert(polText('2N3904') === 'npn', '2N3904 → npn');
assert(polText('2N3906') === 'pnp', '2N3906 → pnp');
assert(polText('A1015') === 'pnp', 'A1015 → pnp');
assert(polText('C1815') === 'npn', 'C1815 → npn');
assert(polText('BC547') === 'npn', 'BC547 → npn');
assert(polText('BC557') === 'pnp', 'BC557 → pnp');
assert(polText('MMBT3904') === 'npn', 'MMBT3904 → npn');
assert(polText('MMBT3906') === 'pnp', 'MMBT3906 → pnp');
assert(polText('TIP41C') === 'npn', 'TIP41C → npn');
assert(polText('TIP42C') === 'pnp', 'TIP42C → pnp');
assert(polText('2N3055') === 'npn', '2N3055 → npn');
assert(polText('MJ2955') === 'pnp', 'MJ2955 → pnp');
assert(polText('2SC5200') === 'npn', '2SC5200 → npn（2SC 系列）');
assert(polText('2SA1943') === 'pnp', '2SA1943 → pnp（2SA 系列）');
assert(polText('2N2219 NPN') === 'npn', '2N2219（TO-39 对管）→ npn');
assert(polText('2N2905 PNP') === 'pnp', '2N2905（TO-39 对管）→ pnp');
assert(polText('S9013') === 'npn', 'S9013 → npn');
assert(polText('S9012') === 'pnp', 'S9012 → pnp');
assert(polText('') === '', '空串判不出');
assert(polText('10k') === '', '电阻值不误判');
assert(polText('IRF540N') === '', '功率 MOSFET 不误判成 BJT 极性');
assert(polText('2SK3018') === '', '2SK 小信号 MOS 不误判');

/* ---------- 2) 组件级极性（value/footprint 优先） ---------- */
box.window.__lcProject = { importState: { pinInfo: {}, components: [], nets: [] } };
assert(polOf({ value: 'S8550_PNP' }) === 'pnp', '组件 value 判 PNP');
assert(polOf({ value: 'S8050_SOT_NPN' }) === 'npn', '组件 value 判 NPN');
assert(polOf({ value: '2N3906' }) === 'pnp', '型号表判 PNP');
assert(polOf({ footprint: 'SOT-23', value: 'MMBT3906 PNP' }) === 'pnp', 'SOT-23 PNP 条目');
assert(polOf({ footprint: 'TO-92', value: 'S8050 NPN' }) === 'npn', 'TO-92 NPN 条目');
assert(polOf({}) === '', '什么线索都没有时不猜');
/* 值里的型号优先于类别：类别历史上一律写 NPN，不能拿它压过型号证据 */
box.window.__lcProject = {
  importState: {
    pinInfo: {}, nets: [],
    components: [{ ref: 'Q1', category: 'Transistor_BJT:NPN' }]
  }
};
assert(polOf({ name: 'Q1', value: '2N3906' }) === 'pnp', '型号证据优先于类别里的 NPN 字样');
assert(polOf({ name: 'Q1', value: '' }) === 'npn', '值判不出时才落到类别（NPN）');
box.window.__lcProject.importState.components = [{ ref: 'Q1', category: 'Transistor_BJT:PNP' }];
assert(polOf({ name: 'Q1', value: '' }) === 'pnp', '类别是 PNP 时按 PNP 显示');
box.window.__lcProject = { importState: { pinInfo: {}, components: [], nets: [] } };

/* ---------- 3) PNP 与 NPN 的脚序逻辑完全一致（极性不参与判定） ---------- */
const mk = (value, footprint) => ({
  kind: 'to92', label: 'Q', name: 'Q1', value: value, footprint: footprint || '',
  pinCount: 3, pinOffsets: [[-1, 0], [0, 0], [1, 0]], position: [5, 5], rotation: 0,
});
const npn = mk('S8050 NPN', 'TO-92');
const pnp = mk('S8550 PNP', 'TO-92');
assert(eq(names(npn), ['E', 'B', 'C']), 'NPN 的 TO-92 名字按 E-B-C（实际 ' + names(npn) + '）');
assert(eq(names(pnp), ['E', 'B', 'C']), 'PNP 的 TO-92 名字同样按 E-B-C（实际 ' + names(pnp) + '）');
R('__lcArrangeLeads(__c)', Object.assign(box, { __c: npn }));
R('__lcArrangeLeads(__c)', Object.assign(box, { __c: pnp }));
assert(eq(npn.pinOffsets, pnp.pinOffsets) && eq(npn.position, pnp.position),
  'NPN 与 PNP 落孔结果逐位相同');

/* SOT-23 口径（1=B 2=E 3=C）在两种极性下也一致 */
const npnS = mk('MMBT3904 NPN', 'SOT-23');
const pnpS = mk('MMBT3906 PNP', 'SOT-23');
assert(eq(names(npnS), ['B', 'E', 'C']), 'SOT-23 NPN 名字按 B-E-C（实际 ' + names(npnS) + '）');
assert(eq(names(pnpS), ['B', 'E', 'C']), 'SOT-23 PNP 名字同样按 B-E-C（实际 ' + names(pnpS) + '）');

/* 手选脚序对两种极性同样生效 */
const manual = mk('S8550 PNP', 'TO-92');
manual.pinOrder = 'CBE';
assert(eq(names(manual), ['C', 'B', 'E']), 'PNP 手选 CBE 同样生效（实际 ' + names(manual) + '）');

/* ---------- 4) 属性面板标出 NPN / PNP ---------- */
const tN = table(mk('S8050 NPN', 'TO-92'));
const tP = table(mk('S8550 PNP', 'TO-92'));
assert(tN.indexOf('NPN　') === 0, 'NPN 面板行以 NPN 开头（' + tN.slice(0, 24) + '）');
assert(tP.indexOf('PNP　') === 0, 'PNP 面板行以 PNP 开头（' + tP.slice(0, 24) + '）');
assert(tN.indexOf('PNP') < 0, 'NPN 行不混入 PNP 字样');
assert(tP.indexOf('脚1 E') >= 0 && tP.indexOf('脚2 B') >= 0, 'PNP 行仍列出 E/B/C 脚序');
const tU = table(mk('', ''));
assert(tU.indexOf('NPN') !== 0 && tU.indexOf('PNP') !== 0, '判不出极性时不硬标');

/* ---------- 5) 导入路径分出 PNP 类别 ---------- */
assert(msCat('Q1', 'S8550_PNP', '', 'TO-92') === 'Transistor_BJT:PNP', 'MSVocab 把 S8550 归 PNP');
assert(msCat('Q1', '2N3906', '', 'TO-92') === 'Transistor_BJT:PNP', 'MSVocab 把 2N3906 归 PNP');
assert(msCat('Q1', 'S8050_SOT_NPN', '', 'SOT-23') === 'Transistor_BJT:NPN', 'MSVocab 把 S8050 归 NPN');
assert(msCat('Q1', '2N3904', '', 'TO-92') === 'Transistor_BJT:NPN', 'MSVocab 把 2N3904 归 NPN');
assert(enCat('Q1', 'S8550', 'SOT-23', 3) === 'Transistor_BJT:PNP', 'enet 分类把 S8550 归 PNP');
assert(enCat('Q1', 'S8050_SOT_NPN', 'S8050_SOT-23', 3) === 'Transistor_BJT:NPN', 'enet 分类 S8050 仍是 NPN');
assert(enCat('Q6', '2SK3018', 'SOT-323-3', 3) === 'Transistor_BJT:NPN', '小信号 MOS 分类不变');
assert(enCat('Q5', 'IRF540N', 'TO-220', 3) === 'Transistor_FET:NMOS', '功率 MOS 分类不变');

/* ---------- 6) 元件库：NPN/PNP 成对 + SOT-23，落板带上 value/footprint ---------- */
const libTitles = [];
{
  const m = bundle.match(/title:"(?:TO-92|SOT-23|TO-39|TO-220|TO-3|TO-247)[^"]*"/g) || [];
  for (const t of m) if (/NPN|PNP/.test(t)) libTitles.push(t);
}
['TO-92 NPN（S8050）', 'TO-92 PNP（S8550）', 'SOT-23 NPN（MMBT3904）', 'SOT-23 PNP（MMBT3906）',
 'TO-39 NPN（2N2219）', 'TO-39 PNP（2N2905）', 'TO-220 NPN（TIP41）', 'TO-220 PNP（TIP42）',
 'TO-3 NPN（2N3055）', 'TO-3 PNP（MJ2955）', 'TO-247 NPN（2SC5200）', 'TO-247 PNP（2SA1943）']
  .forEach(t => assert(bundle.indexOf('title:"' + t + '"') >= 0, '元件库有条目：' + t));
assert(libTitles.length === 12, '库里的三极管条目一共 12 条（实际 ' + libTitles.length + '）');
assert(bundle.indexOf('title:"TO-92",pinCount:3') < 0, '旧的「空型号」TO-92 条目已替换');
assert(bundle.indexOf('value:Q.value||""') >= 0, '落板把库条目的 value 写进元件');
assert(bundle.indexOf('footprint:Q.footprint||""') >= 0, '落板把库条目的 footprint 写进元件');
assert(bundle.indexOf('${i.kind}:${i.pinCount??""}:${i.label}:${i.title||""}') >= 0,
  '库条目键带 title，同封装的 NPN/PNP 不互相覆盖');

/* ---------- 7) 导入端的 PNP 兜底：DefPins 必须有 PNP 键 ---------- */
assert(bundle.indexOf('"Transistor_BJT:PNP":3') >= 0, 'MSDefPins 有 PNP 键（否则 PNP 会被当 2 脚）');

console.log(res.join('\n'));
console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
