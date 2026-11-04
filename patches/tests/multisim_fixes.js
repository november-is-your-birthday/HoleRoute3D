// Regression tests for v3.2.1 review fixes (agent1 findings B1-B9, B13).
// Runs __lcImportBatch end-to-end from patch sources + e4 chain extracted from the bundle.
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
function grabTemplate(src, varName) {
  const i = src.indexOf(varName + '=JSON.parse(`');
  if (i < 0) throw new Error('template not found: ' + varName);
  const start = src.indexOf('`', i) + 1;
  const end = src.indexOf('`', start);
  return 'var ' + varName + '=JSON.parse(' + JSON.stringify(src.slice(start, end)) + ');\n';
}

let code = '';
['e4', 'n4', 'i4', 'Ay', 'Wi', 'Cy', 'Ri', 's4', 'a4', 'r4', 'D2', 'pA', '__lcClass', '__lcProtel', '__lcEsc', 't4']
  .forEach(n => { code += grabFn(bundle, n); });
code += grabTemplate(bundle, 'rA');
code += 'var cA={devicePinModels:rA};\n';
code += 'var dx=(cA.devicePinModels??[]).map(pA);\n';
code += p32 + '\n';

const sandbox = {
  window: {}, Math, JSON, String, Number, Set, Map, Array, Object, RegExp, Date, console,
  crypto: { randomUUID: (() => { let c = 0; return () => 'u' + (++c); })() },
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

async function runBatch(defs) {
  return vm.runInContext('(async function(){ var files = ' + JSON.stringify(defs) + '.map(function(d){ return { name: d.name, text: async function(){ return d.content; } }; }); return await __lcImportBatch(files); })()', sandbox);
}
const W = 'Net Name  Color  RefDes  Pin\n';

(async () => {
  // B2: pin cache must not leak across batches
  const a1 = await runBatch([
    { name: 'w.txt', content: W + 'VCC  -  U1  1\nVCC  -  U1  14\n' },
    { name: 'x.txt', content: 'RefDes  Value  Category  Package\nU1  MCU  IC  DIP14\n' },
  ]);
  assert(Object.keys(a1.pinInfo['U1']).length === 14, 'B2 batchA U1 = 14 pins, got ' + Object.keys(a1.pinInfo['U1']).length);
  const a2 = await runBatch([
    { name: 'w.txt', content: W + 'VCC  -  U1  1\nVCC  -  U1  3\n' },
    { name: 'x.txt', content: 'RefDes  Value  Category  Package\nU1  NE555  IC  DIP8\n' },
  ]);
  assert(Object.keys(a2.pinInfo['U1']).length === 8, 'B2 batchB U1 = 8 pins (cache pollution fixed), got ' + Object.keys(a2.pinInfo['U1']).length);

  // B1: multi-unit fold cross-net pin conflict -> conflict warning, later net loses the contested pin
  const b1 = await runBatch([
    { name: 'w.txt', content: W + 'NA  -  U1A  1\nNA  -  U1A  2\nNB  -  U1B  1\nNB  -  U1B  2\n' },
    { name: 'x.txt', content: 'RefDes  Value  Category  Package\nU1A  74HC00  IC  DIP14\nU1B  74HC00  IC  DIP14\n' },
  ]);
  assert(b1.warnings.some(w => /冲突/.test(w.message)), 'B1 conflict warning present');
  const na = b1.nets.find(n => n.name === 'NA');
  assert(na && na.nodes.some(n => n.ref === 'U1' && n.pin === '1'), 'B1 NA keeps U1.1');
  assert(!b1.nets.some(n => n.name === 'NB'), 'B1 NB dropped (its nodes all conflict with NA)');

  // B3: extended ref whitelist (crystal Y, ferrite bead FB)
  const b3 = await runBatch([
    { name: 'w.txt', content: W + 'N1  -  Y1  1\nN1  -  Y1  2\nN2  -  FB1  1\nN2  -  FB1  2\n' },
    { name: 'x.txt', content: 'RefDes  Value  Category  Package\nY1  16MHZ  CRYSTAL  -\nFB1  FERRITE BEAD  FILTER  -\n' },
  ]);
  assert(b3.components.some(c => c.ref === 'Y1'), 'B3 Y1 crystal imported');
  assert(b3.components.some(c => c.ref === 'FB1'), 'B3 FB1 ferrite bead imported');
  const n1 = b3.nets.find(n => n.name === 'N1');
  assert(n1 && n1.nodes.length === 2, 'B3 N1 keeps Y1.1+Y1.2');

  // B4: identity-mode letter pins grow the libpart instead of overflowing
  const b4 = await runBatch([
    { name: 'w.txt', content: W + 'NA  -  U1  A\nNB  -  U1  B\n' },
    { name: 'x.txt', content: 'RefDes  Value  Category  Package\nU1  NE555  IC  DIP-8\n' },
  ]);
  assert(Object.keys(b4.pinInfo['U1']).length === 10, 'B4 U1 libpart grown to 10 pins, got ' + Object.keys(b4.pinInfo['U1']).length);
  const b4na = b4.nets.find(n => n.name === 'NA');
  assert(b4na && b4na.nodes.some(n => n.pin === '9'), 'B4 letter pin A -> node pin 9 survives');
  const b4nb = b4.nets.find(n => n.name === 'NB');
  assert(b4nb && b4nb.nodes.some(n => n.pin === '10'), 'B4 letter pin B -> node pin 10 survives');

  // B5: wire referencing component missing from xref -> dropped + warning
  const b5 = await runBatch([
    { name: 'w.txt', content: W + 'NA  -  R1  1\nNA  -  U2  1\nNB  -  U2  2\n' },
    { name: 'x.txt', content: 'RefDes  Value  Category  Package\nR1  1k  RESISTOR  -\n' },
  ]);
  assert(b5.warnings.some(w => /不存在/.test(w.message)), 'B5 dangling-ref warning present');
  const b5na = b5.nets.find(n => n.name === 'NA');
  assert(b5na && b5na.nodes.length === 1 && b5na.nodes[0].ref === 'R1', 'B5 NA keeps only R1.1');
  assert(!b5.nets.some(n => n.name === 'NB'), 'B5 NB dropped (only dangling nodes)');

  // B6: unrecognizable file no longer aborts the whole batch
  const b6 = await runBatch([
    { name: 'garbage.txt', content: 'N1 R1 1\nN1 R1 2\n' },
    { name: 'k.net', content: '(export (version "E")\n  (components\n    (comp (ref "R8") (value "2k") (footprint "")\n      (libsource (lib "Device") (part "R") (description ""))))\n  (nets\n    (net (code "1") (name "NB") (node (ref "R8") (pin "1")) (node (ref "R8") (pin "2")))))' },
  ]);
  assert(b6.components.some(c => c.ref === 'R8'), 'B6 valid file in same batch still imported');
  assert(b6.warnings.some(w => /无法识别/.test(w.message)), 'B6 garbage file -> per-file warning, no abort');

  // B7: leading-zero pin "01" maps to pin 1
  const b7 = await runBatch([
    { name: 'w.txt', content: W + 'NA  -  U1  01\nNA  -  R1  1\n' },
    { name: 'x.txt', content: 'RefDes  Value  Category  Package\nU1  NE555  IC  DIP8\nR1  1k  RESISTOR  -\n' },
  ]);
  const b7na = b7.nets.find(n => n.name === 'NA');
  assert(b7na && b7na.nodes.some(n => n.ref === 'U1' && n.pin === '1'), 'B7 pin "01" -> U1.1');

  // B8: lowercase wire ref folds onto uppercase xref ref
  const b8 = await runBatch([
    { name: 'w.txt', content: W + 'NA  -  u1a  1\n' },
    { name: 'x.txt', content: 'RefDes  Value  Category  Package\nU1A  74HC00  IC  DIP14\n' },
  ]);
  assert(b8.components.some(c => c.ref === 'U1'), 'B8 xref U1A folded to U1');
  const b8na = b8.nets.find(n => n.name === 'NA');
  assert(b8na && b8na.nodes.some(n => n.ref === 'U1' && n.pin === '1'), 'B8 wire "u1a" node lands on U1.1');
  assert(!b8.warnings.some(w => /不存在/.test(w.message)), 'B8 no dangling warning');

  // B9: 3-column xref-shaped file sniffs as xref, not wire
  const b9 = await runBatch([
    { name: 'x.txt', content: 'RefDes  Value  Category\nU1  R2  IC\nU2  R3  IC\n' },
  ]);
  assert(b9.components.length === 2 && b9.nets.length === 0, 'B9 3-col xref -> 2 comps, 0 garbage nets');

  // B13: package pin extraction accepts "DIP 8" / "8-DIP"
  const p1 = vm.runInContext('__lcMSPkgPins("DIP 8","U")', sandbox);
  const p2 = vm.runInContext('__lcMSPkgPins("8-DIP","U")', sandbox);
  const p3 = vm.runInContext('__lcMSPkgPins("SOT-23-6","U")', sandbox);
  assert(p1 === 8, 'B13 "DIP 8" -> 8, got ' + p1);
  assert(p2 === 8, 'B13 "8-DIP" -> 8, got ' + p2);
  assert(p3 === void 0, 'B13 "SOT-23-6" still not misread, got ' + p3);

  console.log(res.join('\n'));
  console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
