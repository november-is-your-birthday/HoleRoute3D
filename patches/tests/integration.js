// e4-level integration test: run __lcImportBatch end-to-end (patch sources + e4 chain from the bundle).
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE = path.join(ROOT, 'src/dist/assets/index-C0NrTOjn.js');
const PATCH32 = path.join(ROOT, 'patches/patch_multisim.js');
const FIX = path.join(__dirname, 'fixtures');

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
  // varName=JSON.parse(`...`)
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
  window: { __lcMSPinCache: new Map() },
  Math, JSON, String, Number, Set, Map, Array, Object, RegExp, Date, console,
  crypto: { randomUUID: (() => { let c = 0; return () => 'u' + (++c); })() },
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
const file = (name, content) => ({ name, size: content.length, text: async () => content });
const run = files => vm.runInContext('__lcImportBatch(' + JSON.stringify(files.map(f => ({ name: f.name, content: f.content }))) + ')', sandbox)
  .then(null); // placeholder replaced below

// __lcImportBatch expects real file objects with .text(); build them inside the sandbox
async function runBatch(defs) {
  return vm.runInContext('(async function(){ var files = ' + JSON.stringify(defs) + '.map(function(d){ return { name: d.name, text: async function(){ return d.content; } }; }); return await __lcImportBatch(files); })()', sandbox);
}

(async () => {
  const f1 = fs.readFileSync(path.join(FIX, 'f1_wire_txt.txt'), 'utf8');
  const f2 = fs.readFileSync(path.join(FIX, 'f2_xref_txt.txt'), 'utf8');
  const f3 = fs.readFileSync(path.join(FIX, 'f3_wire_csv.csv'), 'utf8');
  const f4 = fs.readFileSync(path.join(FIX, 'f4_xref_csv.csv'), 'utf8');
  const f6 = fs.readFileSync(path.join(FIX, 'f6_alpha_pins.txt'), 'utf8');
  const f7 = fs.readFileSync(path.join(FIX, 'f7_alpha_xref.txt'), 'utf8');
  const f8 = '* simple spice\nR1 N001 N002 1k\nC1 N002 0 100n\n.end\n';
  const f10 = fs.readFileSync(path.join(FIX, 'f10_only_wire.txt'), 'utf8');

  // 1) full batch: wire + xref
  const t1 = await runBatch([{ name: 'wire.txt', content: f1 }, { name: 'xref.txt', content: f2 }]);
  assert(t1.components.length === 5, 'batch1 components = 5 (V1/0 ignored), got ' + t1.components.length);
  assert(t1.nets.length === 4, 'batch1 nets = 4 (ghost header filtered), got ' + t1.nets.length);
  const u1 = t1.components.find(c => c.ref === 'U1');
  assert(u1 && u1.category === 'Socket:DIP', 'U1 category Socket:DIP, got ' + (u1 && u1.category));
  const pi = t1.pinInfo['U1'];
  assert(pi && Object.keys(pi).length === 8, 'U1 pinInfo 8 pins (DIP8 from package), got ' + (pi && Object.keys(pi).length));
  assert(t1.pinInfo['R1'] && Object.keys(t1.pinInfo['R1']).length === 2, 'R1 pinInfo 2 pins');
  const vcc = t1.nets.find(n => n.name === 'VCC');
  assert(vcc && vcc.nodes.some(n => n.ref === 'U1' && n.pin === '8') && vcc.nodes.some(n => n.ref === 'R1' && n.pin === '1'), 'VCC nodes U1.8 + R1.1');
  assert(!t1.nets.some(n => n.name === 'Net Name' || /_uc/i.test(n.name) || n.name.toLowerCase() === 'net'), 'no ghost/_uc/net networks');
  assert(!t1.components.some(c => c.ref === 'V1' || c.ref === '0'), 'V1/0 ignored');

  // 2) alpha pins renumbered to numbers, e4 accepts (no unresolved)
  const t2 = await runBatch([{ name: 'w.txt', content: f6 }, { name: 'x.txt', content: f7 }]);
  const net1 = t2.nets.find(n => n.name === 'N001');
  assert(net1 && net1.nodes[0].pin === '1', 'D1.A renumbered to pin 1');
  const r4 = t2.nets.find(n => n.name === 'N005');
  assert(r4 && r4.nodes[0].pin === '3', 'Q1.E renumbered to pin 3');
  assert(t2.components.length === 3, 'alpha batch components = 3 (D1,Q1,R1), got ' + t2.components.length);
  const q1 = t2.components.find(c => c.ref === 'Q1');
  assert(q1 && q1.category === 'Transistor_BJT:NPN', 'Q1 -> Transistor_BJT:NPN, got ' + (q1 && q1.category));

  // 3) csv pair (agent fixtures: VCC/GND nets; R1,C1 comps)
  const t3 = await runBatch([{ name: 'w.csv', content: f3 }, { name: 'x.csv', content: f4 }]);
  assert(t3.components.length === 2, 'csv components = 2 (R1,C1), got ' + t3.components.length);
  assert(t3.nets.length === 2, 'csv nets = 2 (VCC,GND), got ' + t3.nets.length);
  const gnd = t3.nets.find(n => n.name === 'GND');
  assert(gnd && gnd.nodes.some(n => n.ref === 'U1' && n.pin === '1'), 'csv GND has U1.1');
  // 3b) quoted-comma csv handled (inline sample): quoted value in xref, invalid ref filtered in wire
  const t3b = await runBatch([
    { name: 'q.csv', content: 'RefDes,Value,Category,Package\nR5,"1k, 5%",RESISTOR,-\n' },
    { name: 'qw.csv', content: 'Net Name,Color,RefDes,Pin\nSIG,-,R5,1\nSIG,-,"R,3",2\n' },
  ]);
  const r5 = t3b.components.find(c => c.ref === 'R5');
  assert(r5 && r5.value === '1k, 5%', 'quoted value parsed intact, got ' + (r5 && JSON.stringify(r5.value)));
  assert(t3b.components.length === 1, 'invalid ref "R,3" filtered');
  assert(t3b.nets.length === 1 && t3b.nets[0].nodes.length === 1, 'SIG only keeps R5.1, got ' + JSON.stringify(t3b.nets));

  // 4) spice -> warning, no comps
  const t4 = await runBatch([{ name: 'x.cir', content: f8 }]);
  assert(t4.components.length === 0 && t4.nets.length === 0, 'spice: nothing imported');
  assert(t4.warnings.some(w => /SPICE/.test(w.message)), 'spice warning present');

  // 5) wire-only -> missing-xref warning
  const t5 = await runBatch([{ name: 'w.txt', content: f1 }]);
  assert(t5.components.length === 0 && t5.nets.length > 0, 'wire-only: nets but no components');
  assert(t5.warnings.some(w => /缺少元件报告|Cross Reference/.test(w.message)), 'wire-only warning present');

  // 6) kicad passthrough unaffected
  const t6 = await runBatch([{ name: 'k.net', content: '(export (version "E")\n  (design (source "t") (date "d") (tool "t"))\n  (components\n    (comp (ref "R9") (value "1k") (footprint "")\n      (libsource (lib "Device") (part "R") (description ""))))\n  (libparts\n    (libpart (lib "Device") (part "R")\n      (pins (pin (num "1") (name "~") (type "passive")) (pin (num "2") (name "~") (type "passive")))))\n  (nets\n    (net (code "1") (name "NA") (node (ref "R9") (pin "1")) (node (ref "R9") (pin "2")))))' }]);
  assert(t6.components.length === 1 && t6.components[0].ref === 'R9', 'kicad passthrough works');

  // 7) mixed batch: KiCad + Multisim coexist via t4 merge
  const t7 = await runBatch([{ name: 'k.net', content: '(export (version "E")\n  (components\n    (comp (ref "R8") (value "2k") (footprint "")\n      (libsource (lib "Device") (part "R") (description ""))))\n  (nets\n    (net (code "1") (name "NB") (node (ref "R8") (pin "1")) (node (ref "R8") (pin "2")))))' }, { name: 'x.txt', content: f2 }]);
  assert(t7.components.some(c => c.ref === 'R8') && t7.components.some(c => c.ref === 'U1'), 'mixed batch merges both sources');

  console.log(res.join('\n'));
  console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
