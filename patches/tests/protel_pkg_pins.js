// Regression test: a Chip with only a couple of pins wired must keep its PACKAGE pin
// count after import — "8 脚芯片只连了 1、2 脚，导入后变成 2 脚芯片" (real user report).
//
// Root cause: 立创/嘉立创 Protel netlists carry no `libparts` section, so `__lcProtel`
// synthesised the libpart from netlist nodes only → pin count = highest connected pin.
// Fix: derive the declared pin count from the footprint for IC references (U / IC / A),
// take max(highest connected pin, package pin count), and put the count into the DIP
// part name so DIP8 and DIP14 no longer share one libpart and inflate each other.
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
  .forEach((n) => { code += grabFn(bundle, n); });
// device pin models table referenced by the parser
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

// --- fixture helpers ---------------------------------------------------------
const comp = (ref, fp, value) => ['[', 'DESIGNATOR', ref, 'FOOTPRINT', fp, 'PARTTYPE', fp, 'Value', value || '', '*', ']'];
const net = (name, ...nodes) => ['(', name, ...nodes, ')'];

// U1 = DIP8 with only pins 1 and 2 wired (the reported case); U2 = DIP14, also sparse.
const FIX_SPARSE = [
  'PROTEL NETLIST 2.0',
  ...comp('U1', 'DIP-8_L9.8-W6.5-P2.54-LS10.2', 'NE555'),
  ...comp('U2', 'DIP-14_L19.3-W6.4-P2.54-LS10.2', 'CD4017'),
  ...comp('R1', 'R0805', '1k'),
  ...net('+5V', 'U1-1', 'U2-1', 'R1-1'),
  ...net('GND', 'U1-2', 'U2-2', 'R1-2'),
  '',
].join('\n');

// U3 = DIP8 whose highest connected pin is 8 (1,2,8 wired) → must stay 8, not 3.
const FIX_EDGE = [
  'PROTEL NETLIST 2.0',
  ...comp('U3', 'DIP8', 'NE555'),
  ...comp('U4', 'DIP8', ''),
  ...comp('U5', 'TO-92-3', 'LM7805'),
  ...net('A', 'U3-1', 'U4-1', 'U5-1'),
  ...net('B', 'U3-2', 'U4-2', 'U5-2'),
  ...net('C', 'U3-8', 'U5-3'),
  '',
].join('\n');

// sparse pin beyond the package (pin 12 on a DIP8 footprint) must win over the package count
const FIX_BEYOND = [
  'PROTEL NETLIST 2.0',
  ...comp('U6', 'DIP8', 'X'),
  ...net('A', 'U6-1', 'U6-12'),
  '',
].join('\n');

const run = async (text, name) => {
  const files = JSON.stringify([{ name, content: text }]);
  return vm.runInContext(
    '(async function(){var files=' + files +
    '.map(function(d){return {name:d.name,text:function(){return Promise.resolve(d.content)}}});' +
    'return await __lcImportBatch(files);})()', sandbox);
};
const pinCount = (t, ref) => Object.keys(t.pinInfo[ref] || {}).length;
const sexprOf = (text) => vm.runInContext('__lcProtel(' + JSON.stringify(text) + ')', sandbox);
const libpartPins = (sexpr, part) => {
  const chunks = sexpr.split('(libpart').slice(1);
  const chunk = chunks.find((c) => c.indexOf('(part "' + part + '")') >= 0);
  return chunk ? (chunk.match(/\(pin \(num/g) || []).length : -1;
};

(async () => {
  const t1 = await run(FIX_SPARSE, 'sparse.net');
  assert(pinCount(t1, 'U1') === 8, 'DIP8 with only pins 1/2 wired keeps 8 pins, got ' + pinCount(t1, 'U1'));
  assert(pinCount(t1, 'U2') === 14, 'DIP14 with only pins 1/2 wired keeps 14 pins, got ' + pinCount(t1, 'U2'));
  assert(pinCount(t1, 'R1') === 2, 'resistor unaffected (2 pins), got ' + pinCount(t1, 'R1'));
  assert(t1.nets.length === 2 && t1.components.length === 3, 'structure intact: 3 comps / 2 nets');

  const s1 = sexprOf(FIX_SPARSE);
  assert(libpartPins(s1, 'DIP') === 8, 'libpart Socket:DIP (DIP8) declares 8 pins, got ' + libpartPins(s1, 'DIP'));
  assert(libpartPins(s1, 'DIP14') === 14, 'libpart Socket:DIP14 declares 14 pins, got ' + libpartPins(s1, 'DIP14'));

  const t2 = await run(FIX_EDGE, 'edge.net');
  assert(pinCount(t2, 'U3') === 8, 'DIP8 with pins 1/2/8 wired stays 8 (not 3), got ' + pinCount(t2, 'U3'));
  assert(pinCount(t2, 'U4') === 8, 'fully unwired DIP8 still gets 8 pins, got ' + pinCount(t2, 'U4'));
  assert(pinCount(t2, 'U5') === 3, 'TO-92-3 regulator stays 3 pins (not 92), got ' + pinCount(t2, 'U5'));

  const t3 = await run(FIX_BEYOND, 'beyond.net');
  assert(pinCount(t3, 'U6') === 12, 'connected pin 12 beyond the DIP8 package wins, got ' + pinCount(t3, 'U6'));

  // sanity: no pin number is invented for non-IC references
  const t4 = await run(['PROTEL NETLIST 2.0', ...comp('J1', 'HDR-4', 'HDR'), ...net('A', 'J1-1'), ''].join('\n'), 'hdr.net');
  assert(pinCount(t4, 'J1') === 1, 'plain connector still follows the netlist (1 pin), got ' + pinCount(t4, 'J1'));

  console.log(res.join('\n'));
  console.log(res.every((r) => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
