// 跑分入口：对每个 fixture 执行「自动放置（若需要）→ 自动布线」，输出可比对的指标。
//   node harness/run.js            打印当前结果
//   node harness/run.js --save     写入 harness/baseline.json
//   node harness/run.js --compare  与 baseline.json 对比并给出差异
//   node harness/run.js --only=dense-mixed
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { loadWorker } = require('./extract.js');
const { buildFixtures, clone } = require('./fixtures.js');

const BASELINE = path.resolve(__dirname, 'baseline.json');
const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const doSave = args.includes('--save');
const doCompare = args.includes('--compare');

const { measure } = require('./metrics.js');

function runFixture(api, fx) {
  const board = clone(fx.board);
  let components = clone(fx.components);
  let endpoints = clone(fx.endpoints);
  const out = { name: fx.name, board: `${board.width}x${board.height}`, components: components.length };

  const needsPlacement = components.some((c) => !c.mounted);
  if (needsPlacement) {
    const t0 = Date.now();
    const region = { x: 0, y: 0, width: board.width, height: board.height };
    const res = api.hi(components, region, board.width, board.height, endpoints, [], () => {}, board);
    out.placeMs = Date.now() - t0;
    out.placed = res.placedCount;
    out.placeWarnings = (res.warnings || []).length;
    components = res.components;
    // 用 worker 自己的 Dt 重算引脚孔位，保证与组件实际位置一致
    endpoints = api.Dt(endpoints, components);
    if (endpoints.length !== fx.endpoints.length) {
      out.endpointsKept = endpoints.length;
    }
  }

  const t1 = Date.now();
  const plan = api.pn(board, endpoints, components, [], [], null, [], true);
  out.routeMs = Date.now() - t1;

  Object.assign(out, measure(plan));
  // 明细：未布通网络与跳线端点，便于定位退化
  out.drcErrors = ((plan.drc && plan.drc.errors) || []).length;
  out.drcWarnings = ((plan.drc && plan.drc.warnings) || []).length;
  out.failedNets = (plan.failedNets || []).slice(0, 12);
  out.jumperList = (plan.jumpers || []).slice(0, 12).map((j) => `${j.net}:${j.from}->${j.to}`);
  return out;
}

function fmt(v, w) { return String(v).padStart(w, ' '); }

function printTable(rows) {
  const head = ['fixture', 'board', 'comp', 'placeMs', 'routeMs', 'traces', 'jump', 'failed', 'drcE', 'len', 'bend', 'score'];
  console.log(head.map((h, i) => fmt(h, i < 2 ? 14 : 8)).join(' '));
  rows.forEach((r) => {
    const vals = [r.name, r.board, r.components, r.placeMs ?? '-', r.routeMs, r.traces, r.jumpers, r.failed, r.drcErrors, r.length, r.bends, r.score];
    console.log(vals.map((v, i) => fmt(v, i < 2 ? 14 : 8)).join(' '));
  });
}

function main() {
  const { api } = loadWorker();
  const fixtures = buildFixtures().filter((f) => !only || f.name === only);
  const rows = fixtures.map((fx) => runFixture(api, fx));
  printTable(rows);

  if (doSave) {
    fs.writeFileSync(BASELINE, JSON.stringify({ at: new Date().toISOString(), rows }, null, 1) + '\n');
    console.log('\nbaseline 已写入 ' + path.relative(process.cwd(), BASELINE));
  }
  if (doCompare) {
    if (!fs.existsSync(BASELINE)) { console.log('\n没有 baseline.json，先跑 --save'); return; }
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    console.log('\n对比 baseline (' + base.at + ')');
    console.log(['fixture', 'jump', 'failed', 'drcE', 'len', 'bend', 'score', 'routeMs'].map((h, i) => fmt(h, i ? 12 : 14)).join(' '));
    rows.forEach((r) => {
      const b = base.rows.find((x) => x.name === r.name);
      if (!b) { console.log(fmt(r.name, 14) + '  (新增)'); return; }
      const d = (k) => {
        const dv = r[k] - b[k];
        return (dv > 0 ? '+' : '') + (Number.isInteger(dv) ? dv : dv.toFixed(1));
      };
      const delta = [d('jumpers'), d('failed'), d('drcErrors'), d('length'), d('bends'), d('score'), d('routeMs')];
      const changed = ['jumpers', 'failed', 'length', 'bends', 'score', 'drcErrors'].some((k) => r[k] !== b[k]);
      console.log([r.name, ...delta].map((v, i) => fmt(v, i ? 12 : 14)).join(' ') + (changed ? '  *' : ''));
    });
  }
  const total = rows.reduce((a, r) => a + r.score, 0);
  console.log('\n合计 score: ' + total);
}

main();
