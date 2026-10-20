// 走锡结果评分：与 app 内 iO() 同权重（去掉拥挤/引脚可达两项，避免依赖内部地图）
'use strict';

const W = { failed: 1e4, jumper: 360, jumperLen: 28, len: 3, bend: 55, routedNet: 500 };

function pathLen(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i += 1) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

function bends(pts) {
  let n = 0, prev = null;
  for (let i = 1; i < pts.length; i += 1) {
    const d = pts[i][0] === pts[i - 1][0] ? 'v' : 'h';
    if (prev && prev !== d) n += 1;
    prev = d;
  }
  return n;
}

function measure(plan) {
  const traces = plan.traces || [];
  const jumpers = plan.jumpers || [];
  const failed = plan.failedNets || [];
  const len = traces.reduce((a, t) => a + pathLen(t.points), 0);
  const bend = traces.reduce((a, t) => a + bends(t.points), 0);
  const jumperLen = jumpers.reduce((a, j) => a + pathLen([j.from, j.to]), 0);
  const nets = new Set();
  traces.forEach((t) => nets.add(t.net));
  jumpers.forEach((j) => nets.add(j.net));
  return {
    traces: traces.length,
    jumpers: jumpers.length,
    failed: failed.length,
    routedNets: nets.size,
    length: +len.toFixed(2),
    bends: bend,
    jumperLen: +jumperLen.toFixed(2),
    score: Math.round(
      failed.length * W.failed + jumpers.length * W.jumper + jumperLen * W.jumperLen +
      len * W.len + bend * W.bend - nets.size * W.routedNet
    ),
  };
}

module.exports = { W, pathLen, bends, measure };
