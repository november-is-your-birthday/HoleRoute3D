// 回归测试：无极性电容不能被判成电解电容。
// 历史问题：只凭「值里有 uF」就判电解，`1uF` 的涤纶 / 薄膜 / CBB / MLCC 电容会在 3D 里
// 被画上 +/− 与色带，用户会误以为接反了。判定改为「否定词优先」：
// 命中 CBB / FILM / MLCC / 涤纶 / 薄膜 / 独石 / 陶瓷 / NP0 / X7R / X5R / C0G → 一定不是电解。
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BUNDLE = path.join(__dirname, '../../src/dist/assets/index-C0NrTOjn.js');
const PATCH32 = path.join(__dirname, '../patch_multisim.js');
const bundle = fs.readFileSync(BUNDLE, 'utf8');
const p32 = fs.readFileSync(PATCH32, 'utf8');

function grabFn(src, name) {
  const sig = 'function ' + name + '(';
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

let code = '';
['e4', 'n4', 'i4', 'Ay', 'Wi', 'Cy', 'Ri', 's4', 'a4', 'r4', 'D2', 'pA', '__lcClass', '__lcProtel', '__lcEsc', 't4']
  .forEach(n => { code += grabFn(bundle, n); });
const ti = bundle.indexOf('rA=JSON.parse(`');
const ts = bundle.indexOf('`', ti) + 1, te = bundle.indexOf('`', ts);
code += 'var rA=JSON.parse(' + JSON.stringify(bundle.slice(ts, te)) + ');\n';
code += 'var cA={devicePinModels:rA};var dx=(cA.devicePinModels??[]).map(pA);\n';
code += p32 + '\n';

const sandbox = {
  window: {}, Math, JSON, String, Number, Set, Map, Array, Object, RegExp, Date, console,
  crypto: { randomUUID: (() => { let c = 0; return () => 'u' + (++c); })() },
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

const blk = (ref, fp, part, val) => ['[', 'DESIGNATOR', ref, 'FOOTPRINT', fp, 'PARTTYPE', part, 'Value', val, '*', ']'];
const FIX = [
  'PROTEL NETLIST 2.0',
  ...blk('C1', 'CBB-1uF-63V', 'CBB', '1uF'),
  ...blk('C2', 'C_FILM_104', 'FILM', '100nF'),
  ...blk('C3', 'MC0805', 'MLCC', '10uF'),
  ...blk('C4', 'C_Ele_SMD_3x5.4mm', 'C_Ele_SMD_3x5.4mm', '1uF'),
  ...blk('C5', 'RADIAL-0.1', 'CAP', '220uF/25V'),
  ...blk('C6', 'C0603', 'CAP_0603', '100nF'),
  ...blk('C7', 'CAP-X7R-1206', 'CAP', '4.7uF'),
  ...blk('C8', 'C_POLAR-10', 'CP', '47uF'),
  '(', 'N1', 'C1-1 x-1 Passive', 'C2-1 x-1 Passive', 'C3-1 x-1 Passive', 'C4-1 x-1 Passive', ')',
  '(', 'N2', 'C1-2 x-2 Passive', 'C2-2 x-2 Passive', 'C3-2 x-2 Passive', 'C4-2 x-2 Passive', ')',
  '(', 'N3', 'C5-1 x-1 Passive', 'C5-2 x-2 Passive', 'C6-1 x-1 Passive', 'C6-2 x-2 Passive', ')',
  '(', 'N4', 'C7-1 x-1 Passive', 'C7-2 x-2 Passive', 'C8-1 x-1 Passive', 'C8-2 x-2 Passive', ')',
  '',
].join('\n');

(async () => {
  const t = await vm.runInContext(
    '(async function(){var files=' + JSON.stringify([{ name: 'caps.net', content: FIX }]) +
    '.map(function(d){return {name:d.name,text:function(){return Promise.resolve(d.content)}}});return await __lcImportBatch(files);})()',
    sandbox);
  const cat = ref => { const c = t.components.find(x => x.ref === ref); return c && c.category; };

  assert(cat('C1') === 'Device:C', 'CBB 1uF → 无极性，实际 ' + cat('C1'));
  assert(cat('C2') === 'Device:C', 'FILM 100nF → 无极性，实际 ' + cat('C2'));
  assert(cat('C3') === 'Device:C', 'MLCC 10uF → 无极性，实际 ' + cat('C3'));
  assert(cat('C4') === 'Device:CP', 'C_Ele_SMD 1uF → 电解，实际 ' + cat('C4'));
  assert(cat('C5') === 'Device:CP', 'RADIAL 220uF/25V → 电解，实际 ' + cat('C5'));
  assert(cat('C6') === 'Device:C', 'C0603 100nF → 无极性，实际 ' + cat('C6'));
  assert(cat('C7') === 'Device:C', 'X7R 4.7uF → 无极性，实际 ' + cat('C7'));
  assert(cat('C8') === 'Device:CP', 'CP 47uF → 电解，实际 ' + cat('C8'));

  // __lcClass 兜底分类器：同样必须尊重否定词
  const cls = (r, v, f) => vm.runInContext(
    '__lcClass(' + JSON.stringify(r) + ',' + JSON.stringify(v) + ',' + JSON.stringify(f) + ')', sandbox);
  assert(cls('C1', '1UF', 'CBB-63V') === 'Device:C', 'lcClass CBB + 1UF → C');
  assert(cls('C2', '10UF', 'MLCC-0805') === 'Device:C', 'lcClass MLCC + 10UF → C');
  assert(cls('C3', '10UF', 'CAP-SMD_3X5.4') === 'Device:CP', 'lcClass 无否定词 + 10UF 维持原判定');
  assert(cls('C4', '2.2UF', 'C_ELEC_4X5.4') === 'Device:CP', 'lcClass ELEC → CP');
  assert(cls('C5', '1UF', 'C-薄膜-63V') === 'Device:C', 'lcClass 中文「薄膜」→ C');

  console.log(res.join('\n'));
  console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
