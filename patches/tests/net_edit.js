// Regression test: the in-app net editor must clear the copper of EVERY net whose
// pin set changed — not only the net a pin was moved INTO.
//
// Bug (v3.2.3): moving R3.2 from $1N5 to GND cleared GND's traces but left $1N5's
// traces untouched. Those traces still press on R3.2's hole, which now belongs to
// GND, so the two nets became one piece of copper → DRC reported
// SHORT_BETWEEN_NETS / WRONG_NET_SHORT on a project the user had just edited.
//
// The test drives the pure helpers extracted from the shipped bundle.
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BUNDLE = path.join(__dirname, '../../src/dist/assets/index-C0NrTOjn.js');
const bundle = fs.readFileSync(BUNDLE, 'utf8');

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
['__lcNetAfter', '__lcNetClearCopper', '__lcNetAddTo', '__lcNetCommit', '__lcNetDel', '__lcNetDelNet']
  .forEach((n) => { code += grabFn(bundle, n); });
// __lcNetDel / __lcNetDelNet go through __lcNetCommit → window.__lcCommit: capture the updater.
code += 'var __committed;var window={__lcCommit:function(fn){__committed=fn}};\n';

const sandbox = { window: {}, Math, JSON, String, Number, Set, Map, Array, Object, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

// R3.2 is shared by $1N5; SIG holds a single pin (R4.1) so it empties out on a move.
function fixture() {
  return {
    name: 'fx',
    board: { kind: 'perfboard', width: 30, height: 20 },
    importState: {
      components: [],
      pinInfo: {},
      warnings: [],
      nets: [
        { name: '$1N5', nodes: [{ ref: 'R3', pin: '2' }, { ref: 'C2', pin: '1' }] },
        { name: 'GND', nodes: [{ ref: 'R2', pin: '1' }, { ref: 'R3', pin: '1' }] },
        { name: 'SIG', nodes: [{ ref: 'R4', pin: '1' }] },
      ],
    },
    routing: {
      traces: [
        { net: '$1N5', points: [[1, 1], [2, 1]] },
        { net: '$1N5', points: [[2, 1], [3, 1]] },
        { net: 'GND', points: [[5, 5], [6, 5]] },
        { net: 'SIG', points: [[7, 7], [8, 7]] },
        { net: 'MANUAL', points: [[9, 9], [9, 10]] },
      ],
      jumpers: [{ net: '$1N5', from: [1, 1], to: [4, 4] }, { net: 'GND', from: [5, 5], to: [9, 5] }],
      failedNets: ['$1N5', 'GND'],
      warnings: ['Bottom routing used 1 jumper(s).'],
      drc: { errors: [1], warnings: [] },
      score: { score: 1 },
    },
    selectedNetName: 'GND',
  };
}

const call = (fn, p, args) => vm.runInContext(
  fn + '(' + JSON.stringify(p) + (args ? ',' + args.map((a) => JSON.stringify(a)).join(',') : '') + ')',
  sandbox);
const names = (p) => p.importState.nets.map((n) => n.name + '=' + n.nodes.map((d) => d.ref + '.' + d.pin).join('+'));
const traceNets = (p) => [...new Set(p.routing.traces.map((t) => t.net))].sort();

// --- 1. move R3.2 out of $1N5 into GND ---------------------------------------
let out = call('__lcNetAddTo', fixture(), ['GND', 'R3', '2']);
assert(names(out).indexOf('GND=R2.1+R3.1+R3.2') >= 0, 'pin R3.2 lands in GND, got ' + names(out).join(' | '));
assert(names(out).indexOf('$1N5=C2.1') >= 0, 'pin R3.2 leaves $1N5, got ' + names(out).join(' | '));
assert(traceNets(out).indexOf('$1N5') < 0, 'source net $1N5 copper cleared (the bug), routes kept: ' + traceNets(out).join(','));
assert(traceNets(out).indexOf('GND') < 0, 'target net GND copper cleared, routes kept: ' + traceNets(out).join(','));
assert(traceNets(out).indexOf('MANUAL') >= 0 && traceNets(out).indexOf('SIG') >= 0, 'unrelated nets untouched');
assert(out.routing.jumpers.every((j) => j.net !== '$1N5' && j.net !== 'GND'), 'jumpers of both nets cleared');
assert(out.routing.failedNets.length === 0, 'failedNets of both nets cleared');
assert(out.routing.drc === undefined && out.routing.diagnostics === undefined, 'DRC result invalidated');
assert(out.routing.warnings.some((w) => w.indexOf('$1N5') >= 0 && w.indexOf('走锡') >= 0),
  'warning names the source net whose copper was dropped');

// --- 2. a net emptied by the move is removed instead of left as a stub -------
out = call('__lcNetAddTo', fixture(), ['GND', 'R4', '1']);
assert(out.importState.nets.every((n) => n.name !== 'SIG'), 'single-pin net SIG removed once emptied');
assert(traceNets(out).indexOf('SIG') < 0, 'SIG copper cleared with it');

// --- 3. adding a pin that is already in the target net stays idempotent ------
out = call('__lcNetAddTo', fixture(), ['GND', 'R3', '1']);
let gnd = out.importState.nets.find((n) => n.name === 'GND');
assert(gnd.nodes.filter((d) => d.ref === 'R3' && d.pin === '1').length === 1, 'duplicate add stays single');
assert(gnd.nodes.length === 2, 'GND still R2.1 + R3.1, got ' + JSON.stringify(gnd.nodes));

// --- 4. removing one pin clears that net's copper ----------------------------
out = vm.runInContext('(function(){var p=' + JSON.stringify(fixture()) +
  ';var r;window.__lcCommit=function(fn){r=fn(p)};__lcNetDel("$1N5","C2","1");return r})()', sandbox);
assert(traceNets(out).indexOf('$1N5') < 0, 'pin removal also clears its own net copper');
assert(traceNets(out).indexOf('GND') >= 0, 'other nets keep copper on pin removal');

// --- 5. deleting a whole net is silent (no "引脚已变更" note) -----------------
out = vm.runInContext('(function(){var p=' + JSON.stringify(fixture()) +
  ';var r;window.__lcCommit=function(fn){r=fn(p)};__lcNetDelNet("GND");return r})()', sandbox);
assert(out.importState.nets.every((n) => n.name !== 'GND'), 'net deleted');
assert(out.selectedNetName === undefined, 'selection cleared when the selected net is deleted');
assert(!out.routing.warnings.some((w) => w.indexOf('引脚已变更') >= 0), 'silent for an explicit delete');
assert(JSON.stringify(out.routing.warnings) === JSON.stringify(['Bottom routing used 1 jumper(s).']),
  'unrelated warnings preserved, got ' + JSON.stringify(out.routing.warnings));

// --- 6. legacy project JSON without jumpers / failedNets must not throw -----
const legacy = fixture();
delete legacy.routing.jumpers;
delete legacy.routing.failedNets;
try {
  out = call('__lcNetAddTo', legacy, ['GND', 'R3', '2']);
  assert(traceNets(out).indexOf('$1N5') < 0, 'legacy project without jumpers/failedNets handled');
} catch (e) {
  assert(false, 'legacy project without jumpers/failedNets threw: ' + e.message);
}

console.log(res.join('\n'));
console.log(res.every((r) => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
