// 合成网表 fixture：确定性生成，用于回归对比。
// 组件结构对齐 app：position 为 [x,y]，pinOffsets 相对 position，rotation 为 0。
'use strict';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 常见封装的引脚偏移（与 app 目录一致）
const FOOTPRINTS = {
  resistor: [[0, 0], [3, 0]],
  radial_capacitor: [[0, 0], [1, 0]],
  led: [[0, 0], [1, 0]],
  diode: [[0, 0], [2, 0]],
  dip8: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 3], [2, 3], [1, 3], [0, 3]],
  dip14: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [6, 3], [5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [0, 3]],
  dip16: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [7, 3], [6, 3], [5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [0, 3]],
  header6: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],
};

const KIND_META = {
  resistor: { kind: 'resistor', label: 'R', title: '电阻', leadSpacing: 3, rowSpacing: 0 },
  radial_capacitor: { kind: 'radial_capacitor', label: 'C', title: '普通电容', leadSpacing: 1, rowSpacing: 0 },
  led: { kind: 'led', label: 'LED', title: 'LED', leadSpacing: 1, rowSpacing: 0 },
  diode: { kind: 'diode', label: 'D', title: '二极管', leadSpacing: 2, rowSpacing: 0 },
  dip8: { kind: 'dip', label: 'U', title: 'DIP-8', leadSpacing: 1, rowSpacing: 3 },
  dip14: { kind: 'dip', label: 'U', title: 'DIP-14', leadSpacing: 1, rowSpacing: 3 },
  dip16: { kind: 'dip', label: 'U', title: 'DIP-16', leadSpacing: 1, rowSpacing: 3 },
  header6: { kind: 'pin_header', label: 'HDR', title: '排针 1×6', leadSpacing: 1, rowSpacing: 0 },
};

function makeComponent(fp, name, position, mounted) {
  const meta = KIND_META[fp];
  const offsets = FOOTPRINTS[fp];
  return {
    id: name.toLowerCase(),
    name,
    kind: meta.kind,
    label: meta.label,
    title: meta.title,
    pinCount: offsets.length,
    pinOffsets: offsets.map((o) => [o[0], o[1]]),
    rotation: 0,
    position: [position[0], position[1]],
    mounted: !!mounted,
    leadSpacing: meta.leadSpacing,
    rowSpacing: meta.rowSpacing,
  };
}

// 由组件位置推导端点（rotation=0）
function endpointsOf(components) {
  const out = [];
  for (const c of components) {
    if (!c.mounted) continue;
    c.pinOffsets.forEach((off, i) => {
      out.push({
        ref: c.name,
        pin: i + 1,
        net: null,
        grid: [c.position[0] + off[0], c.position[1] + off[1]],
      });
    });
  }
  return out;
}

// 分配网络：GND/VCC 多点 + 若干 2~3 脚信号网
function assignNets(endpoints, seed, opts = {}) {
  const rnd = mulberry32(seed);
  const order = endpoints.slice().sort((a, b) => (a.ref + a.pin).localeCompare(b.ref + b.pin));
  const n = order.length;
  const gndShare = opts.gndShare == null ? 0.28 : opts.gndShare;
  const vccShare = opts.vccShare == null ? 0.18 : opts.vccShare;
  // 打乱后按比例切分，保证每个网络至少 2 个脚
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  const gndCount = Math.max(2, Math.round(n * gndShare));
  const vccCount = Math.max(2, Math.round(n * vccShare));
  let cursor = 0;
  const gnd = order.slice(cursor, cursor + gndCount); cursor += gndCount;
  const vcc = order.slice(cursor, cursor + vccCount); cursor += vccCount;
  gnd.forEach((e) => { e.net = 'GND'; });
  vcc.forEach((e) => { e.net = 'VCC'; });
  let sig = 0;
  while (cursor < order.length) {
    const size = cursor + 3 <= order.length ? 2 + Math.floor(rnd() * 2) : order.length - cursor;
    const take = Math.max(1, Math.min(size, order.length - cursor));
    if (take < 2) { order[cursor].net = 'GND'; cursor += 1; continue; }
    sig += 1;
    for (let k = 0; k < take; k += 1) order[cursor + k].net = 'N' + sig;
    cursor += take;
  }
  return endpoints;
}

function clone(v) { return JSON.parse(JSON.stringify(v)); }

// ---------------- fixtures ----------------
// 1) 小尺寸：DIP-8 + 分立件（对应 555 类电路）
function fixtureSmall() {
  const comps = [
    makeComponent('dip8', 'U1', [4, 4], true),
    makeComponent('resistor', 'R1', [12, 3], true),
    makeComponent('resistor', 'R2', [12, 6], true),
    makeComponent('resistor', 'R3', [12, 9], true),
    makeComponent('radial_capacitor', 'C1', [18, 3], true),
    makeComponent('radial_capacitor', 'C2', [18, 6], true),
    makeComponent('led', 'D1', [22, 9], true),
  ];
  const eps = assignNets(endpointsOf(comps), 1234);
  return { name: 'small-555', board: { kind: 'perfboard', width: 30, height: 16 }, components: comps, endpoints: eps };
}

// 2) 中等：DIP-14 + 排针 + 分立件
function fixtureMedium() {
  const comps = [
    makeComponent('dip14', 'U1', [3, 3], true),
    makeComponent('header6', 'J1', [3, 12], true),
    makeComponent('resistor', 'R1', [13, 2], true),
    makeComponent('resistor', 'R2', [13, 5], true),
    makeComponent('resistor', 'R3', [13, 8], true),
    makeComponent('resistor', 'R4', [13, 11], true),
    makeComponent('radial_capacitor', 'C1', [19, 2], true),
    makeComponent('radial_capacitor', 'C2', [19, 5], true),
    makeComponent('radial_capacitor', 'C3', [19, 8], true),
    makeComponent('led', 'D1', [23, 11], true),
    makeComponent('diode', 'D2', [19, 13], true),
  ];
  const eps = assignNets(endpointsOf(comps), 20261020);
  return { name: 'medium-mcu', board: { kind: 'perfboard', width: 32, height: 18 }, components: comps, endpoints: eps };
}

// 3) 密集：两块 DIP-16 + 大量分立件（压测跳线/失败）
function fixtureDense() {
  const comps = [
    makeComponent('dip16', 'U1', [3, 3], true),
    makeComponent('dip16', 'U2', [3, 12], true),
  ];
  let n = 0;
  const rnd = mulberry32(777);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      n += 1;
      const kinds = ['resistor', 'resistor', 'radial_capacitor', 'led', 'diode'];
      const fp = kinds[Math.floor(rnd() * kinds.length)];
      comps.push(makeComponent(fp, 'R' + n, [12 + col * 4, 2 + row * 6], true));
    }
  }
  const eps = assignNets(endpointsOf(comps), 424242);
  return { name: 'dense-mixed', board: { kind: 'perfboard', width: 48, height: 26 }, components: comps, endpoints: eps };
}

// 4) 放置测试：全部未放置（用于自动放置跑分）
function fixturePlaceMedium() {
  const base = fixtureMedium();
  const comps = base.components.map((c) => ({ ...c, mounted: false, position: [0, 0] }));
  const eps = assignNets(endpointsOf(base.components), 20261020);
  return { name: 'place-medium', board: base.board, components: comps, endpoints: eps };
}

function fixturePlaceDense() {
  // 取密集布局的前 2 个 DIP + 8 个分立件，控制跑分耗时
  const base = fixtureDense();
  const keep = base.components.slice(0, 10);
  const comps = keep.map((c) => ({ ...c, mounted: false, position: [0, 0] }));
  const eps = assignNets(endpointsOf(keep), 424242);
  return { name: 'place-10', board: base.board, components: comps, endpoints: eps };
}

const ALL = [fixtureSmall, fixtureMedium, fixtureDense, fixturePlaceMedium, fixturePlaceDense];

function buildFixtures() {
  return ALL.map((f) => f());
}

module.exports = { buildFixtures, clone, endpointsOf, mulberry32, FOOTPRINTS };
