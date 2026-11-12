// Targeted regression: sparse numeric pin beyond package size must expand libpart.
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const p32 = fs.readFileSync(path.join(ROOT, 'patches/patch_multisim.js'), 'utf8');
const bundle = fs.readFileSync(path.join(ROOT, 'src/dist/assets/index-C0NrTOjn.js'), 'utf8');
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  const b = src.indexOf('{', src.indexOf(')', i));
  let d = 0, e = -1;
  for (let k = b; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) { e = k; break; } }
  }
  return src.slice(i, e + 1);
}
const sb = { window: { __lcMSPinCache: new Map() }, Math, JSON, String, Number, Set, Map, Array, Object, RegExp, Date, console };
vm.createContext(sb);
vm.runInContext(grab(bundle, '__lcEsc'), sb);
vm.runInContext(p32, sb);
const wire = 'W1  -  U1  12\nW1  -  U1  1\nW2  -  R1  1\n';
const xref = 'RefDes  Value  Category  Package\nU1  NE555  IC  DIP8\nR1  10k  RESISTOR  -\n';
const out = vm.runInContext(
  '(function(){var w=[],x=[];' +
  'w.push(__lcMSWireParse(' + JSON.stringify(wire) + ',"w"));' +
  'x.push(__lcMSXRefParse(' + JSON.stringify(xref) + ',"x"));' +
  'return __lcMSBuild(w,x);})()', sb);
const dip = out.sexpr.match(/part "DIP(\d+)"/);
const r = out.sexpr.match(/part "(R\d*)"/);
const ok1 = dip && dip[1] === '12';
const ok2 = /pin "12"/.test(out.sexpr);
const ok3 = r && r[1] === 'R';
console.log('U1 DIP libpart pins:', dip && dip[1], '(expect 12) ->', ok1 ? 'PASS' : 'FAIL');
console.log('node pin 12 present:', ok2 ? 'PASS' : 'FAIL');
console.log('R libpart (wire only 1 pin, def 2):', r && r[1], '(expect R = 2-pin default) ->', ok3 ? 'PASS' : 'FAIL');
process.exitCode = ok1 && ok2 && ok3 ? 0 : 1;
