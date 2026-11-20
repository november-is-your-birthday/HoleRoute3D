// 回归测试：嘉立创 EDA 专业版 .enet（JSON）网表解析。
//
// __lcEnet 的产物要与 KiCad 解析器的 e4() 同构（components / nets / pinInfo / warnings），
// 才能直接交给 t4() 合并。这里分别用「合成样本」和「真实导出文件」验证：
//   - 合成样本保证逻辑本身正确（不依赖外部文件）；
//   - 真实文件保证与立创导出的实际字段名、脚号形态对得上。
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

const sandbox = { window: {}, Math, JSON, String, Number, Array, Object, console };
vm.createContext(sandbox);
vm.runInContext(
  grabFn(bundle, 'function __lcTriPolarityText(') +
  grabFn(bundle, 'function __lcEnetCategory(') +
  grabFn(bundle, 'function __lcEnet('),
  sandbox);

const R = (js) => vm.runInContext(js, sandbox);
const parse = (obj, name) => JSON.parse(JSON.stringify(R(
  '__lcEnet(' + JSON.stringify(obj) + ',' + JSON.stringify(name || 't.enet') + ')')));
const cat = (ref, value, fp, n) => R('__lcEnetCategory(' + [ref, value, fp, n].map(x => JSON.stringify(x)).join(',') + ')');

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- 1) 合成样本：结构和字段 ---------- */
const sample = {
  version: '2.0.0',
  components: {
    gge1: {
      props: { Designator: 'Q1', Value: 'S8050_SOT_NPN', DeviceName: 'S8050_SOT_NPN', FootprintName: 'S8050_SOT-23' },
      pinInfoMap: {
        '1': { name: '1', number: '1', net: '$1N5' },
        '2': { name: '2', number: '2', net: '$1N4' },
        '3': { name: '3', number: '3', net: '+5V' }
      }
    },
    gge2: {
      props: { Designator: 'LED1', Value: 'LED_TH-R_3mm', FootprintName: 'LED_TH-3mm' },
      pinInfoMap: {
        '1': { name: 'C', number: '1', net: '$1N36' },
        '2': { name: 'A', number: '2', net: '$1N37' }
      }
    },
    gge3: {
      props: { Designator: 'PR1', Value: '2kΩ', FootprintName: 'R_3296' },
      pinInfoMap: {
        '1': { name: '1', number: '1', net: '' },
        '2': { name: '2', number: '2', net: '$1N11' },
        '3': { name: '3', number: '3', net: '$1N3' }
      }
    },
    gge4: {
      props: { Designator: 'U1', Value: 'NE555PE4', FootprintName: 'PDIP-8_L9.6-W6.4-P2.54-LS7.9' },
      pinInfoMap: {
        '1': { name: 'GND', number: '1', net: 'GND' },
        '8': { name: 'VCC', number: '8', net: '+5V' }
      }
    }
  }
};
const p1 = parse(sample, 'Synthetic.enet');
assert(p1.components.length === 4, '合成样本解析出 4 个元件（' + p1.components.length + '）');
const q = p1.components.find(c => c.ref === 'Q1');
assert(q && q.value === 'S8050_SOT_NPN', 'Q1 的 value 取 Value 字段');
assert(q && q.packageName === 'S8050_SOT-23', 'Q1 的 packageName 取 FootprintName（后续靠它认 SOT-23）');
assert(q && q.category === 'Transistor_BJT:NPN', 'Q1 归为 Transistor_BJT:BJT（' + (q && q.category) + '）');
assert(eq(p1.pinInfo.Q1, { 1: { name: '1', type: '' }, 2: { name: '2', type: '' }, 3: { name: '3', type: '' } }),
  'Q1 的 pinInfo 是 1/2/3 → {name,type}（' + JSON.stringify(p1.pinInfo.Q1) + '）');
assert(eq(p1.pinInfo.LED1, { 1: { name: 'C', type: '' }, 2: { name: 'A', type: '' } }),
  'LED 的引脚名 C/A 原样保留（' + JSON.stringify(p1.pinInfo.LED1) + '）');
assert(p1.components.find(c => c.ref === 'LED1').category === 'Device:LED', 'LED 归为 Device:LED');
assert(p1.components.find(c => c.ref === 'PR1').category === 'Device:R_Potentiometer', 'PR 归为电位器');
assert(p1.components.find(c => c.ref === 'U1').category === 'Socket:DIP2', 'U1（样本只给 2 脚）→ Socket:DIP2');

/* ---------- 2) 网络反向聚合 ---------- */
const names = p1.nets.map(n => n.name).sort();
assert(eq(names, ['$1N11', '$1N3', '$1N36', '$1N37', '$1N4', '$1N5', '+5V', 'GND']),
  '网络由各引脚的 net 字段反向聚合（' + names.join(',') + '）');
const p5 = p1.nets.find(n => n.name === '+5V');
assert(eq(p5.nodes.map(n => n.ref + '-' + n.pin).sort(), ['Q1-3', 'U1-8']), '+5V 上挂着 Q1-3 和 U1-8');
assert(!p1.nets.some(n => n.nodes.some(x => x.ref === 'PR1' && x.pin === '1')),
  'net 为空字符串的引脚不建网络（PR1-1 悬空）');
assert(p1.nets.every(n => n.sourceFile === 'Synthetic.enet'), '每个网络记下来源文件名');

/* ---------- 3) 字母脚号重编号 ---------- */
const sw = {
  version: '2.0.0',
  components: {
    g1: {
      props: { Designator: 'SW1', Value: 'Key_TH', FootprintName: 'Key_TH_3.5x6x4.3' },
      pinInfoMap: { A: { name: 'A', net: '$1N5' }, B: { name: 'B', net: '+5V' } }
    },
    g2: {
      props: { Designator: 'D1', Value: '1N4148', FootprintName: 'DO-35' },
      pinInfoMap: { K: { name: 'K', net: 'GND' }, A: { name: 'A', net: '$1N2' } }
    }
  }
};
const p2 = parse(sw, 'sw.enet');
assert(eq(p2.pinInfo.SW1, { 1: { name: 'A', type: '' }, 2: { name: 'B', type: '' } }),
  '字母脚号 A/B 按顺序重编号为 1/2，名字保留（' + JSON.stringify(p2.pinInfo.SW1) + '）');
assert(eq(p2.pinInfo.D1, { 1: { name: 'A', type: '' }, 2: { name: 'K', type: '' } }),
  'D 的 K/A 也重编号（按字母序 A→1、K→2）');
assert(p2.components.find(c => c.ref === 'SW1').category === 'Button:SW_Push', 'SW1 → Button:SW_Push');
assert(p2.nets.find(n => n.name === '+5V').nodes[0].pin === '2', '重编号后网络节点也用新脚号');
assert(p2.warnings.some(w => /字母脚号/.test(w.message)), '字母脚号重编号会给出提示');

/* ---------- 4) 边界 ---------- */
assert(parse(null).warnings.some(w => /components/.test(w.message)), 'null 输入给出可读提示，不抛异常');
assert(parse({ components: [] }).warnings.some(w => /components/.test(w.message)), 'components 是数组时判定为不是 enet');
assert(parse({ components: {} }).warnings.some(w => /没有可用元件/.test(w.message)), '空 components 给提示');
const noDes = parse({ components: { g1: { props: { FootprintName: 'X' }, pinInfoMap: {} } } });
assert(noDes.components.length === 0 && noDes.warnings.some(w => /没有位号/.test(w.message)),
  '缺 Designator 的元件被跳过并提示');
const noPin = parse({ components: { g1: { props: { Designator: 'R9', Value: '1k' } } } });
assert(noPin.components.length === 1 && noPin.warnings.some(w => /没有引脚信息/.test(w.message)),
  '缺 pinInfoMap 不丢元件，只给提示');
const ver3 = parse({ version: '3.0.0', components: { g1: { props: { Designator: 'R1', Value: '1k' }, pinInfoMap: { '1': { name: '1', net: 'A' } } } } });
assert(ver3.warnings.some(w => /3\.0\.0/.test(w.message)), '非 2.x 版本给出提示但仍尝试解析');

/* ---------- 5) category 与 Protel 路径一致 ---------- */
assert(cat('C1', '1uF', 'C_Ele_SMD_3x5.4mm', 2) === 'Device:CP', '1uF + ELE 封装 → 电解电容');
assert(cat('C3', '100nF', 'C0603', 2) === 'Device:C', '100nF + 0603 → 普通电容');
assert(cat('R1', '1kΩ', 'Res_1/8W', 2) === 'Device:R', 'R → Device:R');
assert(cat('LED3', 'LED_TH-R_3mm', 'LED_TH-3mm', 2) === 'Device:LED', 'LED 前缀优先于其它规则');
assert(cat('D2', '1N4148', 'DO-35', 2) === 'Device:D', 'D → Device:D');
assert(cat('Q1', 'S8050_SOT_NPN', 'S8050_SOT-23', 3) === 'Transistor_BJT:NPN', 'SOT-23 的 BJT → to92 外形');
assert(cat('Q5', 'IRF540N', 'TO-220', 3) === 'Transistor_FET:NMOS', 'TO-220 的 MOSFET → to220 外形');
assert(cat('Q6', '2SK3018', 'SOT-323-3', 3) === 'Transistor_BJT:NPN', '小信号 MOS 也用三脚小管外形');
assert(cat('U2', '4017BDM', 'PDIP-16', 16) === 'Socket:DIP16', '16 脚 IC → Socket:DIP16');
assert(cat('Y1', '8MHz', 'XTAL-3', 2) === 'Device:Crystal', 'Y → 晶振');
assert(cat('Z9', 'BGA', 'BGA-64', 64) === 'Unknown:BGA-64', '认不出的位号前缀给 Unknown');
assert(cat('X1', '8MHz', 'XTAL-3', 2) === 'Device:Crystal', 'X 前缀当晶振（与 libPart 一致）');

/* ---------- 6) 打包产物里的接入点 ---------- */
assert(bundle.indexOf('function __lcEnet(obj, fileName)') >= 0, '解析器已打进 bundle');
assert(bundle.indexOf('return"enet";') >= 0, '__lcSniff 能识别 enet');
assert(bundle.indexOf('t4(t,__lcEnet(JSON.parse(p.text),p.name))') >= 0, '__lcImportBatch 走 enet 分支');
assert(bundle.indexOf('accept:".net,.enet,.json,.txt,.csv,.cir"') >= 0, '文件选择框接受 .enet / .json');
assert(!/Array\.isArray\(jo\.components\)/.test(bundle) || bundle.indexOf('!Array.isArray(jo.components)') >= 0,
  '用「components 是不是数组」区分工程文件和 enet');

/* ---------- 7) 真实导出文件 ---------- */
const real = process.env.PR3D_REAL_ENET || '';  // 设为本机立创导出的 .enet 路径后运行真实文件分支
if (fs.existsSync(real)) {
  const obj = JSON.parse(fs.readFileSync(real, 'utf8'));
  const p = parse(obj, 'Netlist_Schematic2_2026-11-15.enet');
  assert(p.components.length === 23, '真实文件解析出 23 个元件（' + p.components.length + '）');
  assert(p.nets.length === 20, '真实文件聚合出 20 个网络（' + p.nets.length + '）');
  const rq = p.components.find(c => c.ref === 'Q1');
  assert(rq && rq.packageName === 'S8050_SOT-23', 'Q1 的封装是 S8050_SOT-23（' + (rq && rq.packageName) + '）');
  assert(rq && rq.category === 'Transistor_BJT:NPN', 'Q1 落入三极管分类');
  assert(eq(p.pinInfo.Q1, { 1: { name: '1', type: '' }, 2: { name: '2', type: '' }, 3: { name: '3', type: '' } }),
    '该库的 Q1 引脚名就是 1/2/3（会退回封装预设，不会被当功能名）');
  const rU1 = p.components.find(c => c.ref === 'U1');
  assert(rU1 && rU1.category === 'Socket:DIP', 'U1（8 脚）→ Socket:DIP，label 由脚数补成 DIP8（' + (rU1 && rU1.category) + '）');
  assert(p.pinInfo.U1['1'].name === 'GND' && p.pinInfo.U1['8'].name === 'VCC', 'U1 的电源脚名来自 enet');
  assert(p.pinInfo.LED1['1'].name === 'C' && p.pinInfo.LED1['2'].name === 'A', 'LED 的 C/A 来自 enet');
  assert(p.components.find(c => c.ref === 'C1').category === 'Device:CP', 'C1（1uF 电解）→ Device:CP');
  assert(p.components.find(c => c.ref === 'C3').category === 'Device:C', 'C3（100nF 贴片）→ Device:C');
  assert(p.components.find(c => c.ref === 'PR1').category === 'Device:R_Potentiometer', 'PR1 → 电位器');
  assert(p.components.find(c => c.ref === 'SW1').category === 'Button:SW_Push', 'SW1 → Button:SW_Push');
  const n5 = p.nets.find(n => n.name === '+5V');
  assert(n5 && n5.nodes.some(x => x.ref === 'Q1' && x.pin === '3'), '+5V 上确实挂着 Q1-3');
  const nd = p.nets.find(n => n.name === '$1N5');
  assert(nd && nd.nodes.some(x => x.ref === 'Q1' && x.pin === '1'), '$1N5（基极分压）上是 Q1-1');
  assert(p.warnings.every(w => !/没有可用元件/.test(w.message)), '真实文件不产生「没有可用元件」告警');
} else {
  res.push('SKIP 未找到真实 .enet 样本');
}

console.log(res.join('\n'));
console.log('\n' + (res.some(x => x.startsWith('FAIL')) ? 'HAS FAILURES' : 'ALL PASS') +
  ' (' + res.filter(x => x.startsWith('PASS')).length + '/' + res.length + ')');
