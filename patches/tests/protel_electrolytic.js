// Regression test: electrolytic vs regular capacitor distinction on the LCEDA
// "PROTEL NETLIST 2.0" channel (fixture modeled on a real 嘉立创EDA export:
// 电解 C_Ele_SMD_3x5.4mm + 1uF/10uF vs 贴片陶瓷 C0603 + 100nF).
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BUNDLE = path.join(__dirname, '../../src/dist/assets/index-C0NrTOjn.js');
const PATCH32 = path.join(__dirname, '../patch_multisim.js');
const bundle = fs.readFileSync(BUNDLE, 'utf8');
const p32 = fs.readFileSync(PATCH32, 'utf8');

function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
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

// Mini LCEDA export: block format + net section. C1/C2 electrolytic (footprint C_Ele_SMD_*),
// C3 ceramic 0603, C4 chip-size footprint but big uF value (heuristic conflict -> ceramic wins),
// C5 no footprint evidence at all, electrolytic by uF value only.
const FIX = [
  'PROTEL NETLIST 2.0',
  '[', 'DESIGNATOR', 'C1', 'FOOTPRINT', 'C_Ele_SMD_3x5.4mm', 'PARTTYPE', 'C_Ele_SMD_3x5.4mm', 'Value', '1uF', '*', ']',
  '[', 'DESIGNATOR', 'C2', 'FOOTPRINT', 'C_Ele_SMD_3x5.4mm', 'PARTTYPE', 'C_Ele_SMD_3x5.4mm', 'Value', '10uF', '*', ']',
  '[', 'DESIGNATOR', 'C3', 'FOOTPRINT', 'C0603', 'PARTTYPE', 'CAP_0603', 'Value', '100nF', '*', ']',
  '[', 'DESIGNATOR', 'C4', 'FOOTPRINT', 'C0805', 'PARTTYPE', 'CAP_0805', 'Value', '10uF', '*', ']',
  '[', 'DESIGNATOR', 'C5', 'FOOTPRINT', 'RADIAL-0.1', 'PARTTYPE', 'CAP', 'Value', '220uF/25V', '*', ']',
  '[', 'DESIGNATOR', 'R1', 'FOOTPRINT', 'Res_1/8W', 'PARTTYPE', 'Res_AXIAL-1/8W', 'Value', '1kΩ', '*', ']',
  '(', 'VCC', 'C1-1 C_Ele_SMD_3x5.4mm-1 Passive', 'C3-1 CAP_0603-1 Passive', 'R1-1 Res_AXIAL-1/8W-1 Passive', ')',
  '(', 'GND', 'C1-2 C_Ele_SMD_3x5.4mm-2 Passive', 'C3-2 CAP_0603-2 Passive', 'R1-2 Res_AXIAL-1/8W-2 Passive', ')',
  '(', 'SIG', 'C5-1 RADIAL-0.1-1 Passive', 'C5-2 RADIAL-0.1-2 Passive', ')',
  '',
].join('\n');

(async () => {
  const t = await vm.runInContext('(async function(){var files=' + JSON.stringify([{ name: 'lceda.net', content: FIX }]) + '.map(function(d){return {name:d.name,text:function(){return Promise.resolve(d.content)}}});return await __lcImportBatch(files);})()', sandbox);
  const cat = ref => { const c = t.components.find(x => x.ref === ref); return c && c.category; };
  assert(cat('C1') === 'Device:CP', 'C1 (C_Ele_SMD + 1uF) -> Device:CP, got ' + cat('C1'));
  assert(cat('C2') === 'Device:CP', 'C2 (C_Ele_SMD + 10uF) -> Device:CP, got ' + cat('C2'));
  assert(cat('C3') === 'Device:C', 'C3 (C0603 + 100nF) -> Device:C, got ' + cat('C3'));
  assert(cat('C4') === 'Device:C', 'C4 (chip-size C0805 beats uF value) -> Device:C, got ' + cat('C4'));
  assert(cat('C5') === 'Device:CP', 'C5 (RADIAL footprint + 220uF/25V) -> Device:CP, got ' + cat('C5'));
  assert(cat('R1') === 'Device:R', 'R1 unchanged -> Device:R, got ' + cat('R1'));
  assert(t.nets.length === 3 && t.components.length === 6, 'structure intact: 6 comps / 3 nets, got ' + t.components.length + '/' + t.nets.length);

  // __lcClass (fallback classifier) — same discrimination
  const cls = (r, v, f) => vm.runInContext('__lcClass(' + JSON.stringify(r) + ',' + JSON.stringify(v) + ',' + JSON.stringify(f) + ')', sandbox);
  assert(cls('C1', '10UF', 'CAP-SMD_3X5.4') === 'Device:CP', 'lcClass ELE footprint -> CP');
  assert(cls('C3', '100NF', 'C0603') === 'Device:C', 'lcClass chip + nF -> C');
  assert(cls('C5', '10UF/25V', 'CAP-RADIAL') === 'Device:CP', 'lcClass RADIAL -> CP');
  assert(cls('C9', '2.2UF', 'C_ELEC_4X5.4') === 'Device:CP', 'lcClass ELEC + uF -> CP');

  console.log(res.join('\n'));
  console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
