'use strict';
const assert = require('node:assert/strict');
const { loadApp } = require('../../harness/app-sandbox.cjs');
const { checkPlan } = require('../../harness/check.js');
const app = loadApp();
const board = { kind: 'perfboard', width: 12, height: 8 };
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(grids) {
  const components = grids.map((grid, index) => ({
    id: 'j' + index, name: 'J' + index, kind: 'pin_header', pinCount: 1,
    position: grid, pinOffsets: [[0, 0]], rotation: 0, mounted: true,
    leadSpacing: 1, rowSpacing: 0,
  }));
  const endpoints = grids.map((grid, index) => ({ net: 'N', ref: 'J' + index, pin: 1, grid }));
  return { components, endpoints };
}

function verify(fx, plan) {
  const result = checkPlan(board, fx.components, fx.endpoints, plan);
  assert.equal(result.unconnectedNets + result.shortGroups + result.illegalSegments + result.offBoard, 0, JSON.stringify(result));
  assert.deepEqual(plain(app.J0(board, plan, fx.endpoints, fx.components).drc.errors), []);
  for (const trace of plan.traces) {
    if (trace.locked) continue;
    assert.deepEqual(plain(trace.edges), plain(trace.points.slice(1).map((point, index) => [trace.points[index], point])));
  }
}

const tree = fixture([[1, 1], [9, 1], [5, 5]]);
const treeSnapshot = JSON.stringify(tree);
const treePlan = app.__lcCopperRoute(board, app.gO(app.mO(tree.endpoints)), app.TO(tree.components, tree.endpoints), [], [], [], app.Dr,
  (from, to, constraints) => !app.wy(from, to, constraints));
verify(tree, treePlan);
assert.equal(treePlan.jumpers.length, 0);
assert.ok(app.__lcCopperCost(treePlan) <= 36, 'three-terminal tree shares copper without duplicating the trunk');
assert.equal(JSON.stringify(tree), treeSnapshot);

const islands = fixture([[1, 1], [8, 1], [1, 6], [8, 6]]);
const oldTraces = [
  { id: 'manual-a', net: 'N', layer: 'bottom', locked: true, points: [[1, 1], [8, 1]] },
  { id: 'manual-b', net: 'N', layer: 'bottom', locked: true, points: [[1, 6], [8, 6]] },
];
const jumper = { id: 'auto', net: 'N', layer: 'jumper', from: [1, 1], to: [1, 6] };
const initial = { traces: oldTraces, jumpers: [jumper], failedNets: [], warnings: [] };
const snapshot = JSON.stringify(initial);
const pins = app.TO(islands.components, islands.endpoints);
const improved = app.__lcCopperImprove(board, initial, pins, [], [], app.Dr);
assert.equal(improved.jumpers.length, 0);
verify(islands, improved);
assert.deepEqual(plain(improved.traces.slice(0, 2)), oldTraces);
assert.equal(JSON.stringify(initial), snapshot);
assert.equal(app.__lcCopperImprove(board, initial, pins, [], [jumper], app.Dr), initial, 'manual jumper is preserved');
assert.equal(app.__lcCopperImprove(board, { ...initial, jumpers: [{ ...jumper, locked: true }] }, pins, [], [], app.Dr).jumpers.length, 1);

const keepout = { id: 'barrier', enabled: true, status: 'active', strength: 'hard', kind: 'region_keepout',
  blockBottomRouting: true, blockJumpers: false, region: { x: 0, y: 3, width: 12, height: 1 } };
assert.equal(app.__lcCopperImprove(board, initial, pins, [keepout], [], app.Dr).jumpers.length, 1, 'cannot substitute copper through a keepout');
const impossible = app.Y4(board, islands.endpoints, islands.components, [], [{ ...keepout, blockJumpers: true }]);
assert.ok(impossible.failedNets.includes('N'));
assert.equal(impossible.jumpers.length, 0);
assert.ok(impossible.traces.every(trace => trace.points.every(point => point[1] !== 3)));

const limited = app.Y4(board, islands.endpoints, islands.components, [], [keepout,
  { id: 'limit', enabled: true, status: 'active', strength: 'hard', kind: 'net_jumper_limit', net: 'N', maxJumpers: 0 }]);
assert.ok(app.f4(limited, [
  { enabled: true, status: 'active', strength: 'hard', kind: 'net_jumper_limit', net: 'N', maxJumpers: 0 },
]).failedNets.includes('N'), 'a jumper limit is not hidden by a successful physical connection');

const noNetPins = new Map([['2,0', { expectedNet: undefined }]]);
assert.equal(app.__lcCopperPath({ width: 5, height: 1 }, 'N', [[0, 0]], [[4, 0]], noNetPins, new Map()), undefined);
noNetPins.set('2,0', { expectedNet: 'OTHER' });
assert.equal(app.__lcCopperPath({ width: 5, height: 1 }, 'N', [[0, 0]], [[4, 0]], noNetPins, new Map()), undefined);
assert.equal(app.__lcCopperPath({ width: 1000000, height: 1000000 }, 'N', [[0, 0]], [[4, 0]], new Map(), new Map()), undefined);

const shorted = { traces: [], jumpers: [], failedNets: [], drc: { errors: [{}] } };
assert.equal(app.__lcCopperBetter(shorted, { ...shorted, jumpers: [jumper], drc: { errors: [] } }), false);
assert.equal(app.__lcCopperBetter({ ...shorted, failedNets: ['N'], drc: { errors: [] } }, shorted), false);

const crossing = fixture([[1, 2], [10, 2], [5, 1], [5, 6]]);
crossing.endpoints.forEach((endpoint, index) => { endpoint.net = index < 2 ? 'A' : 'B'; });
const crossingPins = app.TO(crossing.components, crossing.endpoints);
const barrier = { id: 'auto-barrier', net: 'B', layer: 'bottom', locked: false,
  points: [[5, 0], [5, 7]], edges: [[[5, 0], [5, 7]]] };
const crossingJumper = { id: 'auto-crossing', net: 'A', layer: 'jumper', from: [1, 2], to: [10, 2] };
const crossingBase = { traces: [barrier], jumpers: [crossingJumper], failedNets: [], warnings: [], drc: { errors: [] } };
const crossingSnapshot = JSON.stringify(crossingBase);
const tools = {
  expand: app.Dr, pins: app.TO, validate: app.J0,
  tasks: endpoints => app.gO(app.mO(endpoints)),
  canJump: (from, to, constraints) => !app.wy(from, to, constraints),
  score: () => ({ score: 0 }),
};
function evaluateCrossing(plan) {
  const result = app.J0(board, plan, crossing.endpoints, crossing.components);
  return { ...plan, drc: result.drc, failedNets: result.failedNetDetails.map(detail => detail.net) };
}
const repaired = app.__lcCopperRepair(board, crossingBase, tools.tasks(crossing.endpoints), crossingPins, [], [], [], tools,
  { deadline: performance.now() + 10000 }, evaluateCrossing);
assert.equal(repaired.jumpers.length, 0, 'move a blocking automatic trace and replace the crossing jumper with copper');
verify(crossing, repaired);
assert.equal(JSON.stringify(crossingBase), crossingSnapshot);
const fixedBarrier = { ...barrier, locked: true };
const fixedBase = { ...crossingBase, traces: [fixedBarrier] };
const protectedResult = app.__lcCopperRepair(board, fixedBase, tools.tasks(crossing.endpoints), crossingPins, [], [], [], tools,
  { deadline: performance.now() + 10000 }, evaluateCrossing);
assert.equal(protectedResult.jumpers.length, 1);
assert.deepEqual(plain(protectedResult.traces[0]), fixedBarrier);

const history = new Float64Array(15);
history[7] = 100;
const detour = app.__lcCopperPath({ width: 5, height: 3 }, 'N', [[0, 1]], [[4, 1]], new Map(), new Map(), { history });
assert.ok(detour && detour.every(point => point[0] !== 2 || point[1] !== 1), 'history cost avoids a repeatedly contested cell');
assert.equal(app.__lcCopperPath(board, 'N', [[0, 0]], [[12, -1]], new Map(), new Map()), undefined);

const originalClock = app.performance;
let ticks = 0;
try {
  app.performance = { now: () => ticks++ };
  assert.equal(app.__lcCopperPath(board, 'N', [[0, 0]], [[11, 7]], new Map(), new Map(), { deadline: 2 }), undefined);
  assert.ok(ticks >= 3, 'deadline is checked inside the search');
  const partial = app.__lcCopperRoute(board, tools.tasks(crossing.endpoints), crossingPins, [], [], [], app.Dr, tools.canJump, { deadline: -1 });
  assert.equal(partial.timedOut, true);
  const timed = app.__lcCopperOptimize(board, crossing.endpoints, crossing.components, crossingBase, [], [], [], tools, undefined,
    { startedAt: 0, deadline: -1 });
  assert.equal(timed.jumpers.length, crossingBase.jumpers.length);
  assert.equal(timed.diagnostics.optimization.timedOut, true);
  verify(crossing, timed);
  ticks = 0;
  app.performance = { now: () => (ticks++) * 27000 };
  const limitedLegacy = app.Y4(board, tree.endpoints, tree.components);
  assert.ok(limitedLegacy.failedNets.includes('N'));
  assert.ok(limitedLegacy.drc.errors.length > 0);
  assert.ok(limitedLegacy.warnings.some(warning => warning.includes('计算时限')));
  ticks = 0;
  const retained = app.Y4(board, islands.endpoints, islands.components, oldTraces, [], undefined, [jumper]);
  assert.deepEqual(plain(retained.traces), oldTraces);
  assert.equal(retained.jumpers[0].id, jumper.id);
  verify(islands, retained);
} finally {
  app.performance = originalClock;
}
console.log('PASS copper sharing, protected routes, keepouts, pad safety, local rip-up, congestion history, deadline interruption and validated fallback');
