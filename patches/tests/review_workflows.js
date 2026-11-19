'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { source, grabFunction, loadApp } = require('../../harness/app-sandbox.cjs');
const { checkPlan } = require('../../harness/check.js');
const { buildFixtures, clone } = require('../../harness/fixtures.js');
const { loadWorker } = require('../../harness/extract.js');
const { measure } = require('../../harness/metrics.js');
const app = loadApp();
const componentSource = source.slice(source.indexOf('function XO('));
const tests = [];

function test(name, run) { tests.push({ name, run }); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }
function projectFor(grids, traces = [], jumpers = []) {
  return {
    id: 'workflow-project', name: 'workflow',
    board: { kind: 'perfboard', width: 12, height: 12 }, files: [],
    components: grids.map((grid, index) => ({
      id: 'j' + index, name: 'J' + index, kind: 'pin_header',
      position: grid, pinOffsets: [[0, 0]], rotation: 0, mounted: true,
      pinCount: 1, leadSpacing: 1, rowSpacing: 0,
    })),
    importState: {
      components: [], pinInfo: {},
      nets: [{ name: 'N', nodes: grids.map((grid, index) => ({ ref: 'J' + index, pin: '1' })) }],
    },
    routing: { traces, jumpers, warnings: [], failedNets: [] }, constraints: [],
  };
}
function continueRoute(project) {
  let updated = project;
  app.H = updater => { updated = updater(updated); };
  vm.runInContext(grabFunction('__lcContinueRoute'), app);
  app.__lcContinueRoute();
  return updated;
}
function assertConnected(project) {
  const endpoints = app.Io(project.importState, project.components);
  const checked = checkPlan(project.board, project.components, endpoints, project.routing);
  assert.equal(checked.unconnectedNets, 0, JSON.stringify(checked));
  assert.equal(checked.shortGroups, 0, JSON.stringify(checked));
  assert.equal(checked.illegalSegments, 0);
  assert.equal(checked.offBoard, 0);
  assert.deepEqual(plain(project.routing.drc.errors), []);
  assert.deepEqual(plain(project.routing.failedNets), []);
}
function transistorProject(mounted) {
  const project = projectFor([]);
  project.components = [{
    id: 'q1', name: 'Q1', kind: 'to92', footprint: 'SOT-23', pinCount: 3,
    pinOffsets: [[-1, 0], [0, 0], [1, 0]], position: [2, 3],
    rotation: 0, mounted, leadSpacing: 1,
  }];
  project.importState.nets = [];
  return project;
}
function historyFor(project) {
  const timers = [];
  app.setTimeout = callback => { timers.push(callback); return timers.length; };
  const box = {
    window: app.window, e: { current: project }, v: { current: [] },
    S() {}, h() {}, R() {}, O() {}, r() {},
    kO: app.kO, N2: app.N2, HO: app.HO,
    __lcArrangeApply: app.__lcArrangeApply,
    __lcValidateProject: app.__lcValidateProject,
    __lcHistoryLimit: () => 200,
    mf: 'workflow-test-storage',
    t: next => { app.window.__lcProject = next; },
  };
  app.window.alert = message => { throw new Error(message); };
  vm.createContext(box);
  vm.runInContext(['H', 'G', 'xe', '__lcRedoStep', 'le', 'K', 'Ct']
    .map(name => grabFunction(name, componentSource)).join('\n'), box);
  return { box, timers };
}

test('两段旧跳线通过继续布线接通，并保留原 ID', () => {
  const oldJumpers = [
    { id: 'island-a', net: 'N', from: [1, 2], to: [4, 2] },
    { id: 'island-b', net: 'N', from: [7, 7], to: [10, 7] },
  ];
  const routed = continueRoute(projectFor([[1, 2], [4, 2], [7, 7], [10, 7]], [], oldJumpers));
  assertConnected(routed);
  oldJumpers.forEach(jumper => assert.ok(routed.routing.jumpers.some(actual => actual.id === jumper.id)));
});

test('独立走锡、跳线和裸引脚三个连通块都接通', () => {
  const routed = continueRoute(projectFor(
    [[1, 2], [4, 2], [7, 7], [10, 7], [2, 9]],
    [{ id: 'old-trace', net: 'N', points: [[1, 2], [4, 2]], locked: true }],
    [{ id: 'old-jumper', net: 'N', from: [7, 7], to: [10, 7] }]
  ));
  assertConnected(routed);
  assert.ok(routed.routing.traces.some(trace => trace.id === 'old-trace'));
});

test('压缩走锡中间孔和跳线焊点按物理相接合并', () => {
  const routed = continueRoute(projectFor(
    [[1, 2], [4, 2], [7, 7], [10, 7]],
    [{ id: 'old-trace', net: 'N', points: [[1, 2], [4, 2]] }],
    [{ id: 'old-jumper', net: 'N', from: [3, 2], to: [7, 7] }]
  ));
  assertConnected(routed);
});

test('主包首次布线与 worker 的三个既有基准一致', () => {
  const { api } = loadWorker();
  for (const fixture of buildFixtures().filter(entry => entry.components.every(component => component.mounted))) {
    const mainPlan = app.Y4(clone(fixture.board), clone(fixture.endpoints), clone(fixture.components));
    const workerPlan = api.pn(clone(fixture.board), clone(fixture.endpoints), clone(fixture.components));
    assert.deepEqual(plain(measure(mainPlan)), plain(measure(workerPlan)), fixture.name);
  }
});

for (const reference of ['U1', 'IC1', 'ic1']) {
  for (const pins of [[1, 2], [1, 8], [1, 12]]) {
    test(reference + ' DIP-8 稀疏引脚 ' + pins.join('/') + ' 保留声明脚数与全部端点', () => {
      const imported = app.__lcEnet({ components: { chip: {
        props: { Designator: reference, Value: 'NE555', FootprintName: 'DIP-8' },
        pinInfoMap: Object.fromEntries(pins.map(pin => [pin, { number: String(pin), net: 'N' + pin }])),
      } } }, 'sparse.enet');
      const roundTrip = JSON.parse(JSON.stringify(imported));
      const components = app._A(roundTrip, [], 20);
      assert.equal(components[0].pinOffsets.length, Math.max(8, ...pins));
      assert.deepEqual(Array.from(app.Io(roundTrip, components), endpoint => endpoint.pin).sort((first, second) => first - second), pins);
      delete roundTrip.components[0].declaredPinCount;
      assert.equal(app._A(roundTrip, [], 20)[0].pinOffsets.length, Math.max(8, ...pins));
    });
  }
}

test('未放置元件直接完成迁移，后续放置不会再挪脚', () => {
  const original = transistorProject(false);
  original.routing.drc = { passed: true };
  original.routing.diagnostics = { failedNetDetails: [] };
  const migrated = app.__lcArrangeApply(original);
  assert.notEqual(migrated, original);
  assert.deepEqual(plain(original.components[0].position), [2, 3]);
  assert.deepEqual(plain(migrated.components[0].position), [3, 3]);
  assert.deepEqual(plain(migrated.routing.warnings), []);
  assert.equal(migrated.routing.drc, undefined);
  assert.equal(migrated.routing.diagnostics, undefined);
  migrated.components[0].mounted = true;
  assert.equal(app.__lcArrangeApply(migrated), migrated);
});

test('加载迁移建立历史基线，编辑后撤销和重做不受迁移阻挡', async () => {
  const original = transistorProject(true);
  original.routing.drc = { passed: true };
  const { box, timers } = historyFor(projectFor([]));
  await box.Ct({ text: async () => JSON.stringify(original) });
  assert.deepEqual(plain(box.e.current.components[0].position), [3, 3]);
  assert.equal(box.e.current.routing.drc, undefined);
  assert.equal(box.v.current.length, 0);
  const baseline = box.e.current;
  box.H(current => ({ ...current, name: 'edited' }));
  assert.equal(box.v.current.length, 1);
  box.xe();
  assert.equal(box.e.current, baseline);
  assert.equal(box.window.__lcRedo.length, 1);
  assert.equal(timers.length, 0);
  assert.equal(box.__lcRedoStep(), true);
  assert.equal(box.e.current.name, 'edited');
  assert.equal(timers.length, 0);
});

test('手选脚序与引脚重排属于同一个可撤销编辑', () => {
  const { box, timers } = historyFor(app.__lcArrangeApply(transistorProject(true)));
  const baseline = box.e.current;
  box.H(current => ({ ...current, components: current.components.map(component => ({ ...component, pinOrder: 'EBC' })) }));
  assert.equal(box.v.current.length, 1);
  assert.deepEqual(plain(box.e.current.components[0].position), [2, 3]);
  box.xe();
  assert.equal(box.e.current, baseline);
  assert.deepEqual(plain(box.e.current.components[0].position), [3, 3]);
  assert.equal(timers.length, 0);
  assert.equal(box.__lcRedoStep(), true);
  assert.deepEqual(plain(box.e.current.components[0].position), [2, 3]);
});

test('重新导入的脚名和封装立即用于迁移，不读取上一工程', () => {
  const original = transistorProject(true);
  original.components[0].footprint = '';
  const { box } = historyFor(original);
  app.window.__lcProject = transistorProject(true);
  box.H(current => ({ ...current, importState: { ...current.importState, pinInfo: {
    Q1: { 1: { name: 'B' }, 2: { name: 'E' }, 3: { name: 'C' } },
  } } }));
  assert.deepEqual(plain(box.e.current.components[0].position), [3, 3]);
  assert.equal(box.v.current.length, 1);
  box.xe();
  assert.equal(box.e.current, original);
  const reimported = { ...original, importState: { ...original.importState, components: [{ ref: 'Q1', packageName: 'SOT-23' }] } };
  assert.deepEqual(plain(app.__lcArrangeApply(reimported).components[0].position), [3, 3]);
});

for (const footprint of ['LED-TH_5mm_GENERIC', 'LED_TH-R_5mm', 'LED_TH-3mm']) {
  test('普通或非 enet 来源 ' + footprint + ' 保留明确 K/A', () => {
    const project = projectFor([]);
    project.components = [{ name: 'LED1', footprint, kind: 'led' }];
    project.importState.components = [{ ref: 'LED1', packageName: footprint, sourceFile: 'circuit.net' }];
    project.importState.nets = [
      { name: 'GND', nodes: [{ ref: 'LED1', pin: '1' }] },
      { name: '-5V', nodes: [{ ref: 'R1', pin: '1' }] },
      { name: 'RETURN', nodes: [{ ref: 'LED1', pin: '2' }, { ref: 'R1', pin: '2' }] },
    ];
    app.window.__lcProject = project;
    assert.equal(app.__lcLedCathodeIndex('LED1', ['K', 'A'], 2), 0);
    assert.equal(app.__lcLedCathodeIndex('LED1', ['C', 'A'], 2), 0);
    project.importState.components[0].sourceFile = 'circuit.enet';
    assert.equal(app.__lcLedCathodeIndex('LED1', ['K', 'A'], 2), 0);
    if (footprint !== 'LED_TH-3mm') assert.equal(app.__lcLedCathodeIndex('LED1', ['C', 'A'], 2), 0);
  });
}

(async () => {
  for (const entry of tests) {
    try {
      await entry.run();
      console.log('PASS ' + entry.name);
    } catch (error) {
      process.exitCode = 1;
      console.error('FAIL ' + entry.name + '\n' + error.stack);
    }
  }
  console.log(process.exitCode ? 'HAS FAILURES' : 'ALL PASS (' + tests.length + ')');
})();
