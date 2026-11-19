'use strict';
// 功能缺陷深查报告（2026-11-19）F01–F28 的修复回归。
// 报告中的复现探针断言的是「缺陷行为」；这里全部反转为「修复后行为」。
// 覆盖：电气与几何完整性、元件身份与端点守恒、事务与生命周期、
//      工程文件与恢复、编辑与派生状态。每个场景都执行真实主包业务函数，
//      React 根组件用可重渲染的 hook 替身驱动（DOM / 存储为受控替身）。
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const { source, grabFunction, loadApp } = require('../../harness/app-sandbox.cjs');
const { checkPlan } = require('../../harness/check.js');
const results = [];
const plain = v => JSON.parse(JSON.stringify(v));

function component(name, position, extra = {}) {
  return { id: name.toLowerCase(), name, kind: 'pin_header', label: 'J', value: '',
    position, rotation: 0, mounted: true, pinCount: 1, pinOffsets: [[0, 0]],
    leadSpacing: 1, rowSpacing: 0, sameSidePitch: 1, ...extra };
}
function projectFor(endpoints = [], extra = {}) {
  const groups = new Map();
  for (const e of endpoints) { if (!groups.has(e.net)) groups.set(e.net, []); groups.get(e.net).push({ ref: e.ref, pin: String(e.pin) }); }
  return { id: 'p', name: 'A', createdAt: '2026-11-19T00:00:00.000Z',
    board: { kind: 'perfboard', width: 12, height: 12 }, files: [],
    components: endpoints.map(e => component(e.ref, e.grid)),
    importState: { components: [], pinInfo: {}, warnings: [], nets: Array.from(groups, ([name, nodes]) => ({ name, nodes })) },
    routing: { traces: [], jumpers: [], failedNets: [], warnings: [] },
    constraints: [], constraintSchemaVersion: 1, ...extra };
}
function findElement(tree, name) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (tree.type?.name === name) return tree;
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findElement(child, name); if (found) return found;
  }
  return undefined;
}
function mount(initialProject) {
  const app = loadApp();
  const slots = []; let cursor = 0; let effects = []; let tree;
  app.qt.useState = initial => { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
    return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; };
  app.qt.useRef = initial => { const i = cursor++; if (!slots[i]) slots[i] = { value: { current: initial } }; return slots[i].value; };
  app.qt.useEffect = (cb, deps) => { effects.push({ callback: cb, dependencies: deps }); };
  app.qt.useMemo = cb => cb();
  app.window.alert = m => { app.lastAlert = m; };
  app.window.confirm = () => true;
  function render() { cursor = 0; effects = []; tree = app.XO(); return tree; }
  render(); slots[0].value = initialProject; slots[1].value.current = initialProject; render();
  return { app, slots, render, get current() { return slots[0].value; }, get effects() { return effects; },
    props(name) { const el = findElement(tree, name); assert.ok(el, 'Missing ' + name); return el.props; } };
}
const pending = [];
function check(id, name, run) {
  let out;
  try { out = run(); } catch (e) { results.push({ id, ok: false }); console.log('FAIL ' + id + ' ' + name + '  ' + e.message); process.exitCode = 1; return; }
  if (out && typeof out.then === 'function') { pending.push({ id, name, promise: out }); return; }
  results.push({ id, ok: true }); console.log('PASS ' + id + ' ' + name + (out ? '  ' + out : ''));
}
const crossings = () => [
  { ref: 'A1', pin: 1, net: 'A', grid: [1, 4] }, { ref: 'A2', pin: 1, net: 'A', grid: [9, 4] },
  { ref: 'B1', pin: 1, net: 'B', grid: [5, 1] }, { ref: 'B2', pin: 1, net: 'B', grid: [5, 9] },
];

check('F01', '缩短优化不再穿过旧跳线焊点，failedNets 无残留', () => {
  const app = loadApp();
  const endpoints = crossings();
  const initial = projectFor(endpoints);
  initial.routing.traces = [{ id: 'extra', net: 'C', points: [[1, 10], [2, 10]], locked: true }];
  initial.routing.jumpers = [
    { id: 'b-upper', net: 'B', from: [5, 1], to: [5, 4], locked: true },
    { id: 'b-lower', net: 'B', from: [5, 4], to: [5, 9], locked: true },
  ];
  const after = app.Y4(initial.board, endpoints, initial.components, initial.routing.traces, [], undefined, initial.routing.jumpers);
  const shorts = after.drc.errors.filter(e => e.code === 'SHORT_BETWEEN_NETS');
  assert.equal(shorts.length, 0, '不应有短路：' + JSON.stringify(plain(shorts)));
  assert.equal(after.failedNets.length, 0, 'failedNets 应为空');
  assert.equal(checkPlan(initial.board, initial.components, endpoints, after).shortGroups, 0);
  return 'errors=' + after.drc.errors.length;
});

check('F02', '缩短优化不穿越硬禁布区，edges 与 points 同步', () => {
  const app = loadApp();
  const endpoints = [
    { ref: 'A1', pin: 1, net: 'A', grid: [1, 4] }, { ref: 'A2', pin: 1, net: 'A', grid: [9, 4] },
    { ref: 'B1', pin: 1, net: 'B', grid: [1, 10] }, { ref: 'B2', pin: 1, net: 'B', grid: [9, 10] },
  ];
  const initial = projectFor(endpoints);
  const constraint = { id: 'keepout', kind: 'region_keepout', enabled: true, status: 'active', strength: 'hard',
    region: { x: 5, y: 4, width: 1, height: 1 }, blockBottomRouting: true, blockJumpers: true, blockPlacement: true };
  const optimized = app.Y4(initial.board, endpoints, initial.components, [], [constraint]);
  const trace = optimized.traces.find(t => t.net === 'A');
  assert.ok(trace, 'A 有走线');
  assert.ok(!trace.points.some(p => p[0] === 5 && p[1] === 4), 'A 不应穿过禁布孔 (5,4)：' + JSON.stringify(plain(trace.points)));
  assert.equal(optimized.drc.passed, true);
  if (trace.edges) {
    const want = trace.points.slice(1).map((p, i) => [trace.points[i], p]);
    assert.deepEqual(plain(trace.edges), plain(want), 'edges 必须与 points 一致');
  }
  return 'points=' + trace.points.length;
});

check('F03', '压缩旧走锡的中间孔已登记占用', () => {
  const app = loadApp();
  const endpoints = crossings();
  const initial = projectFor(endpoints);
  const old = { id: 'locked-a', net: 'A', points: [[1, 4], [9, 4]], locked: true };
  const result = app.Y4(initial.board, endpoints, initial.components, [old]);
  const shorts = result.drc.errors.filter(e => e.code === 'SHORT_BETWEEN_NETS' || e.code === 'BOTTOM_ROUTE_OVERLAP' || e.code === 'BOTTOM_ROUTE_CROSSING');
  assert.equal(shorts.length, 0, '压缩表示也不应短路/交叉：' + JSON.stringify(plain(shorts)));
  return 'errors=' + result.drc.errors.length;
});

check('F04', '缩板后出板走锡被 DRC 拒绝', () => {
  const initial = projectFor([
    { ref: 'J1', pin: 1, net: 'N', grid: [1, 1] }, { ref: 'J2', pin: 1, net: 'N', grid: [1, 3] },
  ]);
  initial.routing.traces = [{ id: 'detour', net: 'N', points: [[1, 1], [8, 1], [8, 3], [1, 3]], layer: 'bottom', locked: true }];
  const test = mount(initial);
  test.props('IR').onUpdateBoard({ ...initial.board, width: 5 });
  test.render();
  test.props('V3').toolbar.onRunDrc();
  assert.equal(test.current.routing.drc.passed, false, '出板走锡必须让 DRC 失败');
  assert.ok(test.current.routing.drc.errors.some(e => e.code === 'TRACE_OFF_BOARD'), '存在 TRACE_OFF_BOARD 错误');
  return 'errors=' + test.current.routing.drc.errors.length;
});

check('F13', '修通后重跑 DRC，failedNets 重建为空', () => {
  const initial = projectFor([{ ref: 'J1', pin: 1, net: 'N', grid: [1, 1] }, { ref: 'J2', pin: 1, net: 'N', grid: [4, 1] }]);
  initial.routing.failedNets = ['N'];
  initial.routing.traces = [{ id: 'fixed', net: 'N', points: [[1, 1], [4, 1]], locked: true }];
  const test = mount(initial);
  test.props('V3').toolbar.onRunDrc();
  assert.equal(test.current.routing.drc.passed, true);
  assert.deepEqual(plain(test.current.routing.failedNets), [], '失败列表必须按本次结果重建');
  return 'failedNets=[]';
});

check('F17', '短路交叉时继续布线如实报告冲突并写 DRC', () => {
  const endpoints = crossings();
  const initial = projectFor(endpoints);
  initial.routing.traces = [
    { id: 'a', net: 'A', points: [[1, 4], [9, 4]], locked: true },
    { id: 'b', net: 'B', points: [[5, 1], [5, 9]], locked: true },
  ];
  const test = mount(initial);
  test.props('V3').toolbar.onContinueRoute();
  assert.ok(test.current.routing.drc, '必须写入 DRC 结果');
  const warning = test.current.routing.warnings.at(-1);
  assert.ok(!warning.includes('所有网络均已连通'), '不能谎称全部连通：' + warning);
  assert.ok(/冲突|短路/.test(warning), '提示应指出冲突：' + warning);
  return warning.slice(0, 46);
});

check('F18', '拔起元件不再被施工 DRC 报为已连接', () => {
  const initial = projectFor([{ ref: 'J1', pin: 1, net: 'N', grid: [1, 1] }, { ref: 'J2', pin: 1, net: 'N', grid: [4, 1] }]);
  initial.routing.traces = [{ id: 'n', net: 'N', points: [[1, 1], [4, 1]], locked: true }];
  const test = mount(initial);
  test.props('IR').onSelectComponent('j1');
  test.render();
  test.props('IR').onUnmountSelected();
  test.render();
  assert.equal(test.current.components[0].mounted, false);
  test.props('V3').toolbar.onRunDrc();
  const status = (test.current.routing.drc.pinStatuses || []).find(item => item.ref === 'J1');
  assert.equal(status, undefined, '拔起的 J1 不应出现在施工连接状态里');
  return 'pinStatuses 已排除 J1';
});

check('F20', '非整数坐标不再让路径展开死循环', () => {
  const app = loadApp();
  const out = vm.runInContext('Dr([[1,1],[3.5,1]])', app, { timeout: 150 });
  assert.ok(out.length >= 2, '应返回原线段而不是挂死');
  return JSON.stringify(plain(out));
});



// ===== 批次 2 =====
check('F05', '改名同步网表，连接不丢', () => {
  const initial = projectFor([{ ref: 'R1', pin: 1, net: 'N', grid: [1, 1] }, { ref: 'J1', pin: 1, net: 'N', grid: [4, 1] }]);
  initial.routing.traces = [{ id: 'n', net: 'N', points: [[1, 1], [4, 1]], locked: true }];
  const test = mount(initial);
  test.props('IR').onSelectComponent('r1');
  test.render();
  test.props('IR').onUpdateSelected({ name: 'R9' });
  test.render();
  test.props('V3').toolbar.onRunDrc();
  const resolved = test.app.Io(test.current.importState, test.current.components);
  assert.equal(resolved.length, 2, '改名后两只脚都应可解析：' + JSON.stringify(plain(resolved)));
  assert.equal(test.current.routing.drc.passed, true, '改名前已连通的网络仍然通过');
  const nodes = plain(test.current.importState.nets[0].nodes);
  assert.ok(nodes.every(n => n.ref === 'R9' || n.ref === 'J1'), '网表节点已同步：' + JSON.stringify(nodes));
  assert.ok(test.current.importState.pinInfo === undefined || !test.current.importState.pinInfo.R1, 'pinInfo 已迁移');
  return 'names=' + test.current.components.map(c => c.name).join(',');
});

check('F06', '重复位号被拒绝', () => {
  const initial = projectFor([{ ref: 'R1', pin: 1, net: 'N1', grid: [1, 1] }, { ref: 'R2', pin: 1, net: 'N2', grid: [4, 1] }]);
  const test = mount(initial);
  test.props('IR').onSelectComponent('r1');
  test.render();
  test.props('IR').onUpdateSelected({ name: 'R2' });
  test.render();
  assert.equal(test.current.components.filter(c => c.name === 'R2').length, 1, '不允许两个 R2');
  assert.ok(test.current.routing.warnings.some(w => w.includes('占用')), '给出拒绝提示');
  const resolved = test.app.Io(test.current.importState, test.current.components);
  assert.equal(resolved.length, 2);
  return 'names=' + test.current.components.map(c => c.name).join(',');
});

check('F12', '只改参数保留手工脚位', () => {
  const part = { id: 'r1', name: 'R1', kind: 'resistor', label: 'R', value: '', position: [1, 1], rotation: 0,
    mounted: false, pinCount: 2, leadSpacing: 3, rowSpacing: 0, sameSidePitch: 1, pinOffsets: [[0, 0], [3, 0]] };
  const initial = projectFor([], { components: [part] });
  const test = mount(initial);
  test.props('IR').onSelectComponent('r1');
  test.render();
  test.props('IR').onMovePin('r1', 2, [3, 3]);
  test.render();
  const before = plain(test.app.Si(test.current.components[0], 2));
  test.props('IR').onUpdateSelected({ value: '10k' });
  test.render();
  const after = plain(test.app.Si(test.current.components[0], 2));
  assert.deepEqual(after, before, '参数编辑不应重建脚位：' + JSON.stringify({ before, after }));
  assert.equal(test.current.components[0].value, '10k');
  return 'pin2=' + JSON.stringify(after);
});

check('F21', '四脚端子生成四孔且端点齐全', () => {
  const app = loadApp();
  const enet = JSON.stringify({ version: '2.0', components: { part: {
    props: { Designator: 'TB1', Value: 'TB1', FootprintName: 'TerminalBlock_1x04' },
    pinInfoMap: Object.fromEntries(['A', 'B', 'C', 'D'].map((net, i) => [i + 1, { number: String(i + 1), name: String(i + 1), net }])),
  } } });
  const imported = app.__lcEnet(JSON.parse(enet), 'terminal.enet');
  const components = app._A(imported, [], 30);
  const endpoints = app.Io(imported, components);
  assert.equal(components[0].pinCount, 4);
  assert.equal(components[0].pinOffsets.length, 4, '必须生成四个孔：' + JSON.stringify(plain(components[0].pinOffsets)));
  assert.equal(endpoints.length, 4, '四个脚都要有端点');
  return 'offsets=' + JSON.stringify(plain(components[0].pinOffsets));
});

check('F22', '双排 2x5 生成两行五列', () => {
  const app = loadApp();
  const enet = JSON.stringify({ version: '2.0', components: { part: {
    props: { Designator: 'J1', Value: 'J1', FootprintName: 'PinHeader_2x05_P2.54mm_Vertical' },
    pinInfoMap: Object.fromEntries(Array.from({ length: 10 }, (x, i) => [i + 1, { number: String(i + 1), name: String(i + 1), net: 'N' + i }])),
  } } });
  const imported = app.__lcEnet(JSON.parse(enet), 'header.enet');
  const generated = app._A(imported, [], 30)[0];
  assert.equal(new Set(generated.pinOffsets.map(p => p[1])).size, 2, '应有两行');
  assert.deepEqual(plain(generated.pinOffsets), plain(app.ex(2, 5, 1)), '行列应为 2x5');
  return 'offsets=' + generated.pinOffsets.length;
});

check('F23', '同名脚进两个网络时导入告警', () => {
  const initial = projectFor([]);
  const test = mount(initial);
  const enet = (nets) => JSON.stringify({ version: '2.0', components: { part: {
    props: { Designator: 'R1', Value: '10k', FootprintName: 'AXIAL-0.3' },
    pinInfoMap: Object.fromEntries(nets.map((net, i) => [i + 1, { number: String(i + 1), name: String(i + 1), net }])),
  } } });
  const file = (name, content) => ({ name, size: content.length, text: async () => content });
  return (async () => {
    await test.props('K3').onImportFiles([file('first.enet', enet(['A', 'GND']))]);
    test.render();
    await test.props('K3').onImportFiles([file('second.enet', enet(['B', 'GND']))]);
    test.render();
    const warnings = test.current.importState.warnings || [];
    assert.ok(warnings.some(w => String(w).includes('导入冲突') && String(w).includes('R1.1')), '应有冲突告警：' + JSON.stringify(warnings));
  })();
});

check('F25', '重新导入脚数增长后模型同步扩容', () => {
  const test = mount(projectFor([]));
  const enet = (pins) => JSON.stringify({ version: '2.0', components: { part: {
    props: { Designator: 'U1', Value: 'NE555', FootprintName: 'DIP-' + pins },
    pinInfoMap: Object.fromEntries(Array.from({ length: pins }, (x, i) => [i + 1, { number: String(i + 1), name: String(i + 1), net: 'N' + i }])),
  } } });
  const file = (name, content) => ({ name, size: content.length, text: async () => content });
  return (async () => {
    await test.props('K3').onImportFiles([file('chip.enet', enet(8))]);
    test.render();
    test.props('V3').toolbar.onCreateComponentsFromImport();
    test.render();
    await test.props('K3').onImportFiles([file('chip.enet', enet(14))]);
    test.render();
    test.props('V3').toolbar.onCreateComponentsFromImport();
    test.render();
    const generated = test.current.components[0];
    const endpoints = test.app.Io(test.current.importState, test.current.components);
    assert.equal(generated.pinOffsets.length, 14, '模型应扩到 14 脚：' + generated.pinOffsets.length);
    assert.equal(endpoints.length, 14, '14 个端点都要在');
    assert.ok(test.current.routing.warnings.some(w => w.includes('导入模型已更新')), '给出模型更新提示');
  })();
});


// ===== 批次 3/4 =====
check('F07', '新增元件同步选择，删除删新元件', () => {
  const initial = projectFor([], { components: [component('J1', [1, 1])] });
  const test = mount(initial);
  test.props('IR').onSelectComponent('j1');
  test.render();
  test.props('IR').onPlaceComponent({ kind: 'pin_header', label: 'J', pinCount: 1, pinOffsets: [[0, 0]], leadSpacing: 1 }, [4, 4]);
  test.render();
  const selectedId = test.props('IR').selectedComponentId;
  assert.notEqual(selectedId, 'j1');
  test.props('IR').onDeleteSelected();
  assert.ok(test.current.components.some(c => c.id === 'j1'), '旧选中的 J1 应保留');
  assert.ok(!test.current.components.some(c => c.id === selectedId), '删除的是新选中的元件');
  return 'remaining=' + test.current.components.map(c => c.name).join(',');
});

check('F08', '读取网表期间新建工程，旧导入不写入', () => {
  const test = mount(projectFor());
  let finish;
  const content = JSON.stringify({ components: { resistor: {
    props: { Designator: 'R1', Value: '1k', FootprintName: 'AXIAL-0.3' },
    pinInfoMap: { first: { number: '1', net: 'N' }, second: { number: '2', net: 'GND' } },
  } } });
  const pendingImport = test.props('K3').onImportFiles([{ name: 'old.enet', size: content.length, text: () => new Promise(resolve => { finish = resolve; }) }]);
  assert.equal(typeof finish, 'function');
  test.props('V3').onNewProject();
  test.render();
  test.props('k3').onCreate('Unrelated B', { kind: 'perfboard', width: 5, height: 5 });
  test.render();
  finish(content);
  return (async () => {
    await pendingImport;
    assert.equal(test.current.name, 'Unrelated B');
    assert.equal((test.current.importState.components || []).length, 0, '新工程不应收到迟到的导入');
    assert.equal(test.current.files.length, 0);
  })();
});

check('F09', 'AI 草稿不跨工程生效', () => {
  const test = mount(projectFor([], { components: [component('J1', [1, 1])] }));
  test.app.by = async () => ({ action: 'apply_constraints', constraints: [{
    kind: 'component_lock', componentRef: 'J1', lockPosition: true, lockRotation: true, strength: 'hard' }] });
  return (async () => {
    await test.props('K3').aiAssistant.parseInstruction('锁住 J1');
    test.render();
    assert.equal(test.props('K3').aiAssistant.draftConstraints.length, 1);
    test.props('V3').onNewProject();
    test.render();
    test.props('k3').onCreate('Unrelated B', { kind: 'perfboard', width: 5, height: 5 });
    test.render();
    assert.equal(test.current.components.length, 0);
    test.props('K3').aiAssistant.confirmDrafts();
    assert.equal(test.current.constraints.length, 0, '旧草稿不得写入新工程');
    return 'drafts 被丢弃';
  })();
});

check('F10', '新建工程复位走锡模式与起点', () => {
  const test = mount(projectFor());
  test.props('V3').toolbar.onToggleRouteEditMode('solder');
  test.render();
  test.props('IR').onRouteEditPoint([8, 1]);
  test.render();
  test.props('V3').onNewProject();
  test.render();
  test.props('k3').onCreate('Small B', { kind: 'perfboard', width: 5, height: 5 });
  test.render();
  assert.ok(!test.props('IR').routeEditMode, '走锡模式应复位');
  assert.ok(!test.props('IR').routeDraftStart, '起点应清空');
  test.props('IR').onRouteEditPoint([1, 1]);
  assert.equal(test.current.routing.traces.length, 0, '不应画出板外线路');
  return 'mode/draft 已复位';
});

check('F19', '读取旧工程期间新建，旧读取不覆盖', () => {
  const test = mount(projectFor());
  let finish;
  const pendingOpen = test.props('V3').onOpenProject({ text: () => new Promise(resolve => { finish = resolve; }) });
  test.props('V3').onNewProject();
  test.render();
  test.props('k3').onCreate('Latest B', { kind: 'perfboard', width: 5, height: 5 });
  test.render();
  const wantedId = test.current.id;
  finish(JSON.stringify(projectFor([], { id: 'old-file', name: 'Old file A' })));
  return (async () => {
    await pendingOpen;
    assert.equal(test.current.id, wantedId, '当前仍是新建的 B');
    assert.equal(test.current.name, 'Latest B');
  })();
});

check('F11', '缺字段的 JSON 被拒绝且不写入自动保存', () => {
  const test = mount(projectFor());
  return (async () => {
    await test.props('V3').onOpenProject({ text: async () => JSON.stringify({ components: [], board: { kind: 'perfboard', width: 10, height: 10 } }) });
    assert.ok(String(test.app.lastAlert || '').includes('无法打开工程文件'), '应明确拒绝：' + test.app.lastAlert);
    assert.ok(!test.app.window.localStorage.getItem('perfboard-autoroute-project'), '不应写入自动保存');
    let threw = null;
    try { test.render(); } catch (e) { threw = e; }
    assert.equal(threw, null, '渲染不应崩溃');
  })();
});

check('F16', '无工程缓存时恢复已存设置且不被默认值覆盖', () => {
  const test = mount(undefined);
  const key = 'perfboard-autoroute-settings';
  test.app.window.localStorage.setItem(key, JSON.stringify({ theme: 'dark', shortcuts: { select: 'F8' } }));
  test.effects[0].callback();
  test.render();
  assert.equal(test.props('V3').theme, 'dark', '主题应恢复');
  test.effects[2].callback();
  const after = JSON.parse(test.app.window.localStorage.getItem(key));
  assert.equal(after.shortcuts.select, 'F8', '已存快捷键不应被默认值覆盖');
  return 'theme=dark, select=F8';
});

check('F27', '打开时保存失败提示准确', () => {
  const test = mount(projectFor([], { name: 'Original A' }));
  test.app.window.__lcCommit(current => ({ ...current, name: 'A edited' }));
  test.render();
  test.app.window.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  return (async () => {
    await test.props('V3').onOpenProject({ text: async () => JSON.stringify(projectFor([], { id: 'opened-b', name: 'Opened B' })), name: 'new.json' });
    test.render();
    assert.equal(test.current.name, 'Opened B', '工程应已切换');
    assert.equal(test.props('V3').canUndo, false, '历史应已清空');
    const msg = String(test.app.lastAlert || '');
    assert.ok(msg.includes('已打开'), '提示应说明已打开：' + msg);
    assert.ok(!msg.includes('无法打开工程文件'), '不应谎称无法打开：' + msg);
  })();
});

check('F28', '存在退出刷盘且自动保存仍可落盘', () => {
  const { source } = require('../../harness/app-sandbox.cjs');
  assert.ok(/beforeunload/.test(source), '应有 beforeunload 刷盘');
  const test = mount(projectFor([], { name: 'Before edit' }));
  const key = 'perfboard-autoroute-project';
  test.app.window.localStorage.setItem(key, JSON.stringify(test.current));
  test.app.window.__lcCommit(cur => ({ ...cur, name: 'Latest edit' }));
  test.render();
  let pendingWrite;
  test.app.window.setTimeout = cb => { pendingWrite = cb; return 1; };
  const cleanup = test.effects[1].callback();
  assert.equal(typeof pendingWrite, 'function', '自动保存应设置防抖定时器');
  pendingWrite();
  assert.equal(JSON.parse(test.app.window.localStorage.getItem(key)).name, 'Latest edit');
  cleanup();
  return '定时器与刷盘均在';
});


// ===== 批次 5 =====
check('F14', '重复加入同网络同脚不清铜线', () => {
  const app = loadApp();
  const initial = projectFor([{ ref: 'J1', pin: 1, net: 'N', grid: [1, 1] }, { ref: 'J2', pin: 1, net: 'N', grid: [4, 1] }]);
  initial.routing.traces = [{ id: 'n', net: 'N', points: [[1, 1], [4, 1]], locked: true }];
  const result = app.__lcNetAddTo(initial, 'N', 'J1', 1);
  assert.equal(result.importState.nets[0].nodes.length, 2);
  assert.equal(result.routing.traces.length, 1, '重复操作必须幂等，铜线保留');
  return 'traces=1';
});

check('F15', '左加一列同步平移母线约束', () => {
  const initial = projectFor([]);
  initial.constraints = [{ id: 'rail', kind: 'power_rail', enabled: true, status: 'active', strength: 'hard', net: 'VCC', axis: 'column', index: 3, from: 1, to: 8 }];
  initial.routing.traces = [{ id: 'constraint-rail-rail', net: 'VCC', points: [[3, 1], [3, 8]], locked: true }];
  const test = mount(initial);
  test.app.__lcBoardGrow('left', 1);
  test.render();
  const shiftedColumn = test.current.routing.traces[0].points[0][0];
  assert.equal(shiftedColumn, 4, '铜线应右移一格');
  assert.equal(test.current.constraints[0].index, 4, '约束 index 必须随板平移：' + test.current.constraints[0].index);
  const regenerated = test.app.u4(test.current.constraints, [], test.current.components);
  assert.equal(regenerated.traces[0].points[0][0], 4, '下次自动布线应落在新列');
  return 'index=4';
});

check('F24', 'Multisim 双报告移除后整批消失', () => {
  const test = mount(projectFor());
  const wire = 'Net Name  Color  RefDes  Pin\nVCC  -  R1  1\nGND  -  R1  2\n';
  const xref = 'RefDes  Value  Category  Package\nR1  10k  RESISTOR  RESISTOR\n';
  const file = (name, content) => ({ name, size: content.length, text: async () => content });
  return (async () => {
    await test.props('K3').onImportFiles([file('wire.txt', wire), file('xref.txt', xref)]);
    test.render();
    assert.equal(test.current.importState.components.length, 1);
    for (const id of test.current.files.map(f => f.id)) {
      test.props('K3').onRemoveImportedFile(id);
      test.render();
    }
    assert.equal(test.current.files.length, 0);
    assert.equal(test.current.importState.components.length, 0, '合成元件应整批移除');
    assert.equal(test.current.importState.nets.length, 0, '合成网络应整批移除');
  })();
});

check('F26', 'Esc 取消走锡起点与待放置元件', () => {
  const test = mount(projectFor());
  const listeners = [];
  test.app.HTMLElement = class HTMLElement {};
  test.app.window.addEventListener = (type, cb) => { if (type === 'keydown') listeners.push(cb); };
  test.props('V3').toolbar.onToggleRouteEditMode('solder');
  test.render();
  test.props('IR').onRouteEditPoint([2, 2]);
  test.render();
  test.effects.find(e => e.callback.toString().includes('window.addEventListener("keydown"')).callback();
  listeners.at(-1)({ key: 'Escape', target: {}, preventDefault() {} });
  test.render();
  assert.ok(!test.props('IR').routeDraftStart, 'Esc 应清空走锡起点');
  test.props('V3').toolbar.onPickComponent({ kind: 'resistor', label: 'R', pinCount: 2, pinOffsets: [[0, 0], [3, 0]], leadSpacing: 3 });
  test.render();
  test.effects.find(e => e.callback.toString().includes('window.addEventListener("keydown"')).callback();
  listeners.at(-1)({ key: 'Escape', target: {}, preventDefault() {} });
  test.render();
  assert.ok(!test.props('IR').pendingComponent, 'Esc 应取消待放置元件');
  return 'draft/pending 均已取消';
});

(async () => {
  for (const item of pending) {
    try { const note = (await item.promise) || ''; results.push({ id: item.id, ok: true }); console.log('PASS ' + item.id + ' ' + item.name + (note ? '  ' + note : '')); }
    catch (e) { results.push({ id: item.id, ok: false }); console.log('FAIL ' + item.id + ' ' + item.name + '  ' + e.message); process.exitCode = 1; }
  }
  console.log(results.every(r => r.ok) ? 'ALL PASS (' + results.length + ')' : 'HAS FAILURES');
})();
