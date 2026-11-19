// 端到端验证：项目审查报告（2026-11-19）8 项缺陷的修复效果。
// 与报告的 review-evidence/review-probes.cjs 场景一一对应，但断言的是「修复后」的行为。
// 用法：node harness/review_verify.cjs
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'src/dist/assets/index-C0NrTOjn.js'), 'utf8');

function grabFunction(name, input = source) {
  const marker = 'function ' + name + '(';
  const start = input.indexOf(marker);
  if (start < 0) throw new Error('Missing ' + name);
  const opening = input.indexOf('{', start);
  let depth = 0;
  for (let index = opening; index < input.length; index += 1) {
    if (input[index] === '{') depth += 1;
    if (input[index] === '}' && --depth === 0) return input.slice(start, index + 1);
  }
  throw new Error('Unbalanced ' + name);
}

function loadApp() {
  const element = () => ({
    style: {}, relList: { supports: () => true },
    setAttribute() {}, addEventListener() {}, appendChild() {},
    getContext: () => null,
  });
  const document = {
    createElement: element, getElementById: () => null, querySelectorAll: () => [],
    addEventListener() {}, head: element(), body: element(),
    documentElement: { style: {}, dataset: {} },
  };
  const storage = new Map();
  const window = {
    addEventListener() {}, removeEventListener() {},
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    location: { protocol: 'file:' },
    setTimeout: () => 0, clearTimeout() {},
  };
  const sandbox = {
    console, document, window,
    localStorage: window.localStorage,
    navigator: { userAgent: 'node-verify' },
    performance,
    crypto: require('node:crypto').webcrypto,
    setTimeout: () => 0, clearTimeout() {},
    URL, Headers, AbortController, TextEncoder, TextDecoder,
  };
  vm.createContext(sandbox);
  const runtime = source.slice(0, source.lastIndexOf('JM.createRoot('))
    .replaceAll('import.meta.url', '"file:///verify/index.js"');
  vm.runInContext(runtime, sandbox, { filename: 'application-bundle.js', timeout: 10000 });
  return sandbox;
}

const app = loadApp();
const componentSource = source.slice(source.indexOf('function XO('));
const results = [];
function check(name, fn) {
  try {
    const detail = fn() || {};
    results.push({ name, ok: true, ...detail });
    console.log('PASS ' + name + (detail.note ? '  ' + detail.note : ''));
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.log('FAIL ' + name + '  ' + error.message);
    process.exitCode = 1;
  }
}

function projectFor(endpoints, traces = [], jumpers = []) {
  const groups = new Map();
  for (const endpoint of endpoints) {
    if (!groups.has(endpoint.net)) groups.set(endpoint.net, []);
    groups.get(endpoint.net).push({ ref: endpoint.ref, pin: String(endpoint.pin) });
  }
  return {
    board: { kind: 'perfboard', width: 12, height: 12 },
    components: endpoints.map(endpoint => ({
      id: endpoint.ref, name: endpoint.ref, kind: 'pin_header',
      position: endpoint.grid, pinOffsets: [[0, 0]], rotation: 0, mounted: true,
      pinCount: 1, leadSpacing: 1, rowSpacing: 0,
    })),
    importState: { components: [], pinInfo: {}, nets: Array.from(groups, ([name, nodes]) => ({ name, nodes })) },
    routing: { traces, jumpers, warnings: [], failedNets: [] },
    constraints: [],
  };
}

function continueRoute(project) {
  let updated = project;
  app.H = updater => { updated = updater(updated); };
  vm.runInContext(grabFunction('__lcContinueRoute'), app);
  vm.runInContext('__lcContinueRoute()', app);
  return updated;
}

/* ---------- P2-6：手选脚序 = 显式覆盖 ---------- */
check('P2-6 手选脚序覆盖网表脚名', () => {
  const pinInfo = { 1: { name: 'B' }, 2: { name: 'E' }, 3: { name: 'C' } };
  const manual = app.__lcPinNamePlan('to92', pinInfo, 'EBC', 3, 'sot23');
  assert.equal(manual.join(''), 'EBC');
  assert.equal(manual.__lcFrom, 'manual');
  return { note: '选 EBC → 3D/面板就是 EBC（来源 manual）' };
});

/* ---------- P2-7：负电源电路里 K/A 脚名优先于拓扑 ---------- */
check('P2-7 明确 K/A 不再被拓扑画反', () => {
  app.window.__lcProject = {
    importState: {
      nets: [
        { name: 'GND', nodes: [{ ref: 'R1', pin: '1' }] },
        { name: 'ANODE', nodes: [{ ref: 'LED1', pin: '2' }, { ref: 'R1', pin: '2' }] },
        { name: '-5V', nodes: [{ ref: 'LED1', pin: '1' }] },
      ],
    },
  };
  const cathode = app.__lcLedCathodeIndex('LED1', ['K', 'A'], 2);
  assert.equal(cathode, 0, 'K 在脚 1（-5V 侧）就按脚 1 画');
  return { note: 'K→-5V、A→R1→GND，负极标记落在脚 1' };
});

/* ---------- P1-1：旧跳线焊点参与避让 + 合并后 DRC 重算 ---------- */
const endpoints = [
  { ref: 'A1', pin: 1, net: 'A', grid: [1, 4] },
  { ref: 'A2', pin: 1, net: 'A', grid: [9, 4] },
  { ref: 'B1', pin: 1, net: 'B', grid: [5, 1] },
  { ref: 'B2', pin: 1, net: 'B', grid: [5, 9] },
];
check('P1-1a 单跳线：合并后 DRC 与现场重算一致', () => {
  const existingJumper = { id: 'old-b', net: 'B', from: [5, 1], to: [5, 9], layer: 'jumper' };
  const routed = continueRoute(projectFor(endpoints, [], [existingJumper]));
  const fresh = app.J0(routed.board, routed.routing, endpoints, routed.components);
  assert.deepEqual(routed.routing.drc && routed.routing.drc.errors, fresh.drc.errors,
    '缓存的 DRC 必须与合并后重算一致（旧实现合并前算，会过期）');
  assert.ok(routed.routing.jumpers.some(j => j.id === 'old-b'), '旧跳线保留');
  return { note: 'cached === fresh，旧跳线保留' };
});
check('P1-1b 共用焊点：新走锡绕开旧跳线焊点（不短路）', () => {
  const occupiedJumpers = [
    { id: 'b-upper', net: 'B', from: [5, 1], to: [5, 4], layer: 'jumper' },
    { id: 'b-lower', net: 'B', from: [5, 4], to: [5, 9], layer: 'jumper' },
  ];
  const shorted = continueRoute(projectFor(endpoints, [], occupiedJumpers));
  // 独立复查：把 traces+jumpers 铺到孔位上做连通组分析
  const padNets = new Map();
  const addPad = (grid, net) => {
    const key = grid.join(',');
    const cur = padNets.get(key);
    if (cur && cur !== net) throw new Error('孔 ' + key + ' 同时压着 ' + cur + ' 和 ' + net);
    padNets.set(key, net);
  };
  (shorted.routing.traces || []).forEach(t => (t.points || []).forEach(p => addPad(p, t.net)));
  (shorted.routing.jumpers || []).forEach(j => { addPad(j.from, j.net); addPad(j.to, j.net); });
  const aTrace = (shorted.routing.traces || []).find(t => t.net === 'A');
  assert.ok(!aTrace || !aTrace.points.some(p => p[0] === 5 && p[1] === 4),
    'A 网络的新走锡不得穿过旧跳线共用焊点 (5,4)');
  return { note: 'A 绕开了 (5,4)；提示：' + String(shorted.routing.warnings.at(-1)).slice(0, 60) };
});

/* ---------- P1-2：跨工程重做被拒绝 ---------- */
check('P1-2 切换工程后重做不再把旧工程换回来', () => {
  const historyBox = {
    window: { __lcRedo: [] },
    e: { current: { id: 'project-A', name: 'A edited' } },
    v: { current: [{ id: 'project-A', name: 'A before edit' }] },
    S() {}, h() {}, R() {}, O() {}, r() {},
    HO: app.HO,
    __lcHistoryLimit: () => 200,
  };
  historyBox.G = project => { historyBox.e.current = project; };
  vm.createContext(historyBox);
  vm.runInContext(['le', 'xe', '__lcRedoStep', 'K'].map(name => grabFunction(name, componentSource)).join('\n'), historyBox);
  vm.runInContext('xe(); K("New project B", {kind:"perfboard",width:12,height:12})', historyBox);
  assert.equal(historyBox.e.current.name, 'New project B', 'K 切换到新工程');
  const redoWorked = vm.runInContext('__lcRedoStep()', historyBox);
  assert.equal(redoWorked, false, '跨工程重做必须被拒绝');
  assert.equal(historyBox.e.current.name, 'New project B', '当前工程不被换回 A');
  assert.equal(historyBox.window.__lcRedo.length, 0, '重做栈已被 le() 清空');
  return { note: 'Ctrl+Shift+Z 后仍停留在工程 B' };
});

/* ---------- P2-5：删除后再添加不产生重复位号 ---------- */
check('P2-5 删除 R2 后再添加得到 R2 而非第二个 R3', () => {
  let libraryProject = projectFor([]);
  libraryProject.components = [
    { id: 'r1', name: 'R1' },
    { id: 'r3', name: 'R3' },
  ];
  const libraryBox = {
    i: libraryProject,
    crypto: require('node:crypto').webcrypto,
    qO: app.qO,
    __lcUniqueRef: app.__lcUniqueRef,
    h() {},
    H: updater => { libraryProject = updater(libraryProject); },
  };
  vm.createContext(libraryBox);
  vm.runInContext(grabFunction('ht', componentSource), libraryBox);
  libraryBox.part = { kind: 'resistor', label: 'R', pinCount: 2, leadSpacing: 3, pinOffsets: [[0, 0], [3, 0]] };
  vm.runInContext('ht(part, [8,8])', libraryBox);
  const names = libraryProject.components.map(c => c.name);
  assert.equal(names.filter(n => n === 'R3').length, 1, '只有一个 R3');
  assert.ok(names.includes('R2'), '新元件补上空缺的 R2（实际 ' + names.join(',') + '）');
  return { note: '位号序列 ' + names.sort().join(',') };
});

/* ---------- P1-4：稀疏导出的 DIP-8 生成 8 脚模型 ---------- */
function enetComponent(netName = 'A') {
  return {
    version: '2.0',
    components: {
      chip: {
        props: { Designator: 'U1', Value: 'NE555', FootprintName: 'DIP-8' },
        pinInfoMap: {
          first: { number: '1', net: netName },
          last: { number: '8', net: 'GND' },
        },
      },
    },
  };
}
check('P1-4 只导出脚 1、8 的 DIP-8 生成 8 脚模型', () => {
  const sparseImport = app.__lcEnet(enetComponent());
  const sparseParts = app._A(sparseImport, [], 20);
  const sparseEndpoints = app.Io(sparseImport, sparseParts);
  assert.equal(sparseParts[0].pinOffsets.length, 8, '物理脚数按封装/最大脚号取 8');
  assert.deepEqual(Array.from(sparseEndpoints, e => e.pin).sort(), [1, 8], '脚 1 和脚 8 的网络连接都保留');
  return { note: 'pinCount=' + sparseParts[0].pinOffsets.length + '，端点脚号 ' + sparseEndpoints.map(e => e.pin).join(',') };
});

/* ---------- P2-8：网络名撞原型属性 ---------- */
check('P2-8 网络名叫 constructor/toString/__proto__ 不炸', () => {
  for (const netName of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const out = app.__lcEnet(enetComponent(netName));
    assert.ok(out.nets.some(n => n.name === netName), '网络 ' + netName + ' 被正常聚合');
  }
  return { note: '四个原型名网络全部导入成功' };
});

/* ---------- P1-3：渲染期迁移走显式提交并作废 DRC ---------- */
check('P1-3 引脚迁移不再静默改工程，DRC 同步作废', () => {
  const migrationEndpoints = [
    { ref: 'Q1', pin: 1, net: 'B', grid: [2, 3] },
    { ref: 'Q1', pin: 2, net: 'E', grid: [3, 3] },
    { ref: 'Q1', pin: 3, net: 'C', grid: [4, 3] },
    { ref: 'J1', pin: 1, net: 'B', grid: [2, 1] },
    { ref: 'J2', pin: 1, net: 'E', grid: [3, 6] },
    { ref: 'J3', pin: 1, net: 'C', grid: [4, 8] },
  ];
  const migrationTraces = [
    { id: 'b', net: 'B', points: [[2, 3], [2, 2], [2, 1]] },
    { id: 'e', net: 'E', points: [[3, 3], [3, 4], [3, 5], [3, 6]] },
    { id: 'c', net: 'C', points: [[4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8]] },
  ];
  const migrated = projectFor(migrationEndpoints, migrationTraces);
  migrated.components = migrated.components.filter(component => component.name !== 'Q1');
  migrated.components.unshift({
    id: 'q1', name: 'Q1', kind: 'to92', footprint: 'SOT-23',
    value: 'MMBT3904', pinCount: 3, pinOffsets: [[-1, 0], [0, 0], [1, 0]],
    position: [2, 3], rotation: 0, mounted: true, leadSpacing: 1,
  });
  const initialDrc = app.J0(migrated.board, migrated.routing, app.Io(migrated.importState, migrated.components), migrated.components);
  assert.equal(initialDrc.drc.passed, true, '迁移前布线是通的');
  migrated.routing.drc = initialDrc.drc;

  app.window.__lcProject = migrated;
  let committed = null;
  app.window.__lcCommit = fn => { committed = fn(migrated); };
  // 让 setTimeout 立即执行（沙箱默认是空操作）
  app.setTimeout = fn => { fn(); return 0; };
  app.__lcArrangeDeferred(migrated);

  assert.ok(committed, '延迟迁移通过 __lcCommit 显式提交');
  assert.equal(migrated.components[0].position[0], 2, '原工程对象未被就地修改（渲染期无副作用）');
  assert.equal(committed.components[0].position[0], 3, '迁移后 position 平移到脚 1 新孔');
  assert.equal(committed.routing.drc, undefined, '旧 DRC 结果作废');
  assert.equal(committed.routing.diagnostics, undefined, '旧诊断作废');
  assert.ok((committed.routing.warnings || []).some(w => String(w).indexOf('三极管引脚排布已迁移') >= 0 && String(w).indexOf('Q1') >= 0),
    '警告写明受影响元件');

  // 幂等：对已迁移工程再跑一次，不产生新的提交
  let second = null;
  app.window.__lcCommit = fn => { second = fn(committed); };
  app.window.__lcProject = committed;
  app.__lcArrangeDeferred(committed);
  assert.equal(second, null, '已迁移工程不重复提交');
  return { note: '一次性迁移 + DRC 作废 + Q1 平移到 (3,3)' };
});

console.log(results.every(r => r.ok) ? 'ALL PASS (' + results.length + '/' + results.length + ')' : 'HAS FAILURES');
