// Regression test: LCEDA PROTEL exports with LETTER pins (SW1-A / SW1-B on tact
// switches) must be parsed, renumbered to 1..n, and classified as tactile buttons.
// Also covers: numeric pins unchanged, slide switch stays SW_SPDT, lcClass KEY evidence.
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

// fixture modeled on a real LCEDA export: tact switch KEY_TH with A/B pins,
// slide switch with numeric pins, plus R/C for context
const FIX = [
  'PROTEL NETLIST 2.0',
  '[', 'DESIGNATOR', 'SW1', 'FOOTPRINT', 'Key_TH_3.5x6x4.3', 'PARTTYPE', 'Key_TH_3.5x6x4.3', '*', ']',
  '[', 'DESIGNATOR', 'SW2', 'FOOTPRINT', 'SS12D00_G3', 'PARTTYPE', 'SS12D00_G3', 'Value', 'SS12D00', '*', ']',
  '[', 'DESIGNATOR', 'R1', 'FOOTPRINT', 'Res_1/8W', 'PARTTYPE', 'Res_AXIAL-1/8W', 'Value', '1kΩ', '*', ']',
  '[', 'DESIGNATOR', 'C1', 'FOOTPRINT', 'C_Ele_SMD_3x5.4mm', 'PARTTYPE', 'C_Ele_SMD_3x5.4mm', 'Value', '10uF', '*', ']',
  '(', '+5V', 'SW1-A Key_TH_3.5x6x4.3-A Input', 'SW2-1 SS12D00_G3-1 Input', 'R1-1 Res_AXIAL-1/8W-1 Input', ')',
  '(', 'SIG', 'SW1-B Key_TH_3.5x6x4.3-B Input', 'SW2-3 SS12D00_G3-3 Input', 'C1-1 C_Ele_SMD_3x5.4mm-1 Input', ')',
  '(', 'GND', 'R1-2 Res_AXIAL-1/8W-2 Input', 'C1-2 C_Ele_SMD_3x5.4mm-2 Input', ')',
  '',
].join('\n');

(async () => {
  const t = await vm.runInContext('(async function(){var files=' + JSON.stringify([{ name: 'lceda.net', content: FIX }]) + '.map(function(d){return {name:d.name,text:function(){return Promise.resolve(d.content)}}});return await __lcImportBatch(files);})()', sandbox);
  const cat = ref => { const c = t.components.find(x => x.ref === ref); return c && c.category; };
  const pinsOf = (net, ref) => { const n = t.nets.find(x => x.name === net); return n ? n.nodes.filter(x => x.ref === ref).map(x => x.pin) : []; };
  assert(cat('SW1') === 'Button:SW_Push', 'SW1 (KEY footprint) -> Button:SW_Push, got ' + cat('SW1'));
  assert(cat('SW2') === 'Switch:SW_SPDT', 'SW2 (slide switch, no KEY evidence) stays Switch:SW_SPDT, got ' + cat('SW2'));
  assert(JSON.stringify(pinsOf('+5V', 'SW1')) === '["1"]', 'letter pin SW1-A -> net node pin 1, got ' + JSON.stringify(pinsOf('+5V', 'SW1')));
  assert(JSON.stringify(pinsOf('SIG', 'SW1')) === '["2"]', 'letter pin SW1-B -> net node pin 2, got ' + JSON.stringify(pinsOf('SIG', 'SW1')));
  assert(JSON.stringify(pinsOf('+5V', 'SW2')) === '["1"]', 'numeric pins unchanged (SW2-1), got ' + JSON.stringify(pinsOf('+5V', 'SW2')));
  assert(JSON.stringify(pinsOf('SIG', 'SW2')) === '["3"]', 'sparse numeric pins preserved (SW2-3), got ' + JSON.stringify(pinsOf('SIG', 'SW2')));
  assert(JSON.stringify(pinsOf('SIG', 'C1')) === '["1"]', 'electrolytic C1 still parsed (pin 1), got ' + JSON.stringify(pinsOf('SIG', 'C1')));
  assert(cat('C1') === 'Device:CP', 'C1 electrolytic classification unaffected, got ' + cat('C1'));
  assert(t.nets.length === 3 && t.components.length === 4, 'structure intact: 4 comps / 3 nets, got ' + t.components.length + '/' + t.nets.length);

  // lcClass fallback gets the same KEY evidence
  const cls = (r, v, f) => vm.runInContext('__lcClass(' + JSON.stringify(r) + ',' + JSON.stringify(v) + ',' + JSON.stringify(f) + ')', sandbox);
  assert(cls('SW1', '', 'Key_TH_3.5x6x4.3') === 'Button:SW_Push', 'lcClass KEY footprint -> Button:SW_Push, got ' + cls('SW1', '', 'Key_TH_3.5x6x4.3'));
  assert(cls('SW2', 'SS12D00', 'SS12D00_G3') === 'Switch:SW_SPDT', 'lcClass slide switch stays SW_SPDT, got ' + cls('SW2', 'SS12D00', 'SS12D00_G3'));

  console.log(res.join('\n'));
  console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
