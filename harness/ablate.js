// 消融实验：在内存里分别关掉 P1 的三项改动，量化每一项的边际贡献。
// 只作用于 worker 源码（软件实际自动布线走主包 Y4，两者同构）。
//   node harness/ablate.js
'use strict';
const fs = require('node:fs');
const { loadWorkerSource, WORKER } = require('./extract.js');
const { buildFixtures, clone } = require('./fixtures.js');
const { measure } = require('./metrics.js');

const BASE = fs.readFileSync(WORKER, 'utf8');

function once(src, old, neu, what) {
  const n = src.split(old).length - 1;
  if (n !== 1) throw new Error(`消融锚点失效（${what}）：命中 ${n} 次`);
  return src.replace(old, neu);
}

function revertOrder(src) {
  src = once(src,
    'function Hn(e,t,f){return[...e].sort((n,i)=>{const a=f&&f.has(n.net)?0:1,b=f&&f.has(i.net)?0:1;if(a!==b)return a-b;const c=__lcNetRank(n.net),d=__lcNetRank(i.net);if(c!==d)return c-d;const r=n.priority+(t?Et(n,t):0),o=i.priority+(t?Et(i,t):0);return r===o?0:o-r})}',
    'function Hn(e,t){return[...e].sort((n,i)=>{const r=n.priority+(t?Et(n,t):0);return i.priority+(t?Et(i,t):0)-r})}',
    '网络排序');
  return once(src, 'const w=Hn(c,I,__lcFailed);', 'const w=Hn(c,I);', '网络排序调用');
}

function revertRipup(src) {
  src = once(src,
    'if(O.jumpers.length>Math.max(0,Math.ceil(k.endpoints.length/2)-N)){const T=Cn(f,y,p,O.blockedRouteIds,k,$,N);',
    'if(O.jumpers.length>Math.max(1,Math.ceil(k.endpoints.length/2))){const T=Cn(f,y,p,O.blockedRouteIds,k,$);',
    '拆线触发');
  return once(src, 'let S,$=hn+ce*3;', 'let S,$=hn;', '拆线预算');
}

const TIGHT_BLOCK = 'if(T8&&S){__lcTightW(e,t,n,S,I);const __wq=lt(e,S,t,n);if(__wq){S.drc=__wq.drc,S.diagnostics={failedNetDetails:__wq.failedNetDetails},S.score=Pn(e,S,t,dt(e,t,new Map,I))}}';
function revertTight(src) {
  return once(src, TIGHT_BLOCK, '', 'pull-tight');
}

const VARIANTS = [
  { name: 'P1 全开（当前）', tf: (s) => s },
  { name: '仅关网络排序', tf: revertOrder },
  { name: '仅关拆线加码', tf: revertRipup },
  { name: '仅关 pull-tight', tf: revertTight },
  { name: '三项全关（≈P1 前）', tf: (s) => revertTight(revertRipup(revertOrder(s))) },
];

const NAMES = ['small-555', 'medium-mcu', 'dense-mixed'];

function runAll() {
  const fixtures = buildFixtures().filter((f) => NAMES.includes(f.name));
  const rows = [];
  for (const v of VARIANTS) {
    let src;
    try {
      src = v.tf(BASE);
    } catch (e) {
      // 该改动已被回滚，锚点不存在 → 跳过（保留脚本，便于将来重做同类实验）
      rows.push({ name: v.name, per: null, skipped: e.message });
      continue;
    }
    const { api } = loadWorkerSource(src, 'ablate:' + v.name);
    const per = {};
    for (const fx of fixtures) {
      const board = clone(fx.board);
      let components = clone(fx.components);
      const endpoints = clone(fx.endpoints);
      const t0 = Date.now();
      const plan = api.pn(board, endpoints, components, [], [], null, [], true);
      const m = measure(plan);
      m.ms = Date.now() - t0;
      m.drcE = ((plan.drc && plan.drc.errors) || []).length;
      per[fx.name] = m;
    }
    rows.push({ name: v.name, per });
  }
  return { rows, fixtures };
}

function pad(v, w) { return String(v).padStart(w, ' '); }

function main() {
  const { rows, fixtures } = runAll();
  for (const fx of fixtures) {
    console.log('\n=== ' + fx.name + ' (' + fx.board.width + 'x' + fx.board.height + ', ' + fx.components.length + ' 件) ===');
    console.log(pad('变体', 22) + pad('jump', 6) + pad('fail', 6) + pad('drcE', 6) + pad('traces', 8) + pad('len', 8) + pad('bend', 6) + pad('score', 9) + pad('ms', 6));
    const ref = rows[0].per[fx.name];
    for (const r of rows) {
      if (!r.per) { console.log(pad(r.name, 22) + '  （跳过：' + r.skipped + '）'); continue; }
      const m = r.per[fx.name];
      const mark = (k) => (m[k] === ref[k] ? ' ' : '*');
      console.log(
        pad(r.name, 22) + pad(m.jumpers, 6) + pad(m.failed, 6) + pad(m.drcE, 6) + pad(m.traces, 8) +
        pad(m.length, 8) + pad(m.bends, 6) + pad(m.score, 9) + pad(m.ms, 6) +
        (r === rows[0] ? '' : '  ' + (mark('jumpers') + mark('length') + mark('bends')).replace(/ /g, '·'))
      );
    }
  }
  console.log('\n=== 分数合计（越低越好；* 表示与全开有差异）===');
  rows.forEach((r) => {
    if (!r.per) { console.log(pad(r.name, 22) + pad('-', 9)); return; }
    const sum = fixtures.reduce((a, fx) => a + r.per[fx.name].score, 0);
    console.log(pad(r.name, 22) + pad(sum, 9));
  });
}

main();
