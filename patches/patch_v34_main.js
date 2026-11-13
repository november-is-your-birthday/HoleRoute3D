/* ===== __lc v3.4：板尺寸四向增删行 / 列、零欧电阻按导线处理 ===== */
/* 本文件由 patches/apply_all.py 注入到 bundle 顶层（与 patch_v31/v32/v33 同一作用域），
   函数声明在模块加载时即完成提升，实际调用发生在事件回调里，不存在 TDZ 问题。 */

/* ------------------------------------------------------------------
 * 一、板尺寸四向增删
 * 板的孔位坐标以左上角为 [0,0]（3D 映射 px=x-w/2+.5、pz=y-h/2+.5，
 * 正视图下 +x 向右、+y 向下）。因此：
 *   左/上加 → 尺寸 +1，并把已有内容整体平移 +1，新行/列出现在空的一侧；
 *   右/下加 → 只把尺寸 +1（坐标不变，新行/列追加在末尾）；
 *   缩小时必须保证被删的那一行/列上没有元件、走锡、跳线，否则拒绝并提示。
 * ------------------------------------------------------------------ */
function __lcLcName(side) {
  return side === "left" ? "最左一列" : side === "right" ? "最右一列" :
    side === "top" ? "最上一行" : "最下一行";
}
function __lcLineBusy(p, axis, index) {
  var g = function (pt) { return axis === "x" ? pt[0] : pt[1]; };
  var comps = p.components || [];
  for (var i = 0; i < comps.length; i += 1) {
    var c = comps[i];
    if (!c || !c.position) continue;
    if (g(c.position) === index) return c.name;
    var offs = c.pinOffsets || [];
    for (var k = 0; k < offs.length; k += 1) {
      var hole = null;
      try { hole = Si(c, k + 1); } catch (e) { hole = null; }
      if (hole && g(hole) === index) return c.name;
    }
  }
  var rt = p.routing || {};
  var traces = rt.traces || [];
  for (var a = 0; a < traces.length; a += 1) {
    var pts = (traces[a] && traces[a].points) || [];
    for (var b = 0; b < pts.length; b += 1) if (g(pts[b]) === index) return "走锡";
  }
  var js = rt.jumpers || [];
  for (var j = 0; j < js.length; j += 1) {
    var jm = js[j];
    if (!jm || !jm.from || !jm.to) continue;
    if (g(jm.from) === index || g(jm.to) === index) return "跳线";
  }
  return null;
}
function __lcBoardGrow(side, delta) {
  var pj = window.__lcProject;
  if (!pj || !pj.board) return;
  var b = pj.board;
  if (String(b.kind || "perfboard") === "breadboard") {
    __lcToast("面包板的行列由模块数决定，请在板设置里改模块数");
    return;
  }
  var cap = {};
  try { cap = (Zi(b) && Zi(b).capabilities) || {}; } catch (e) { cap = {}; }
  var horiz = side === "left" || side === "right";
  if (horiz && cap.canResizeWidth === false) {
    __lcToast("当前板型的宽度由板定义决定，不能增减列");
    return;
  }
  var w = Math.round(b.width), h = Math.round(b.height), MIN = 5, MAX = 150;
  var cur = horiz ? w : h, unit = horiz ? "列" : "行";
  if (delta > 0 && cur >= MAX) { __lcToast(unit + "数已达上限 " + MAX); return; }
  if (delta < 0 && cur <= MIN) { __lcToast(unit + "数已达下限 " + MIN); return; }
  var shiftX = side === "left" ? delta : 0;
  var shiftY = side === "top" ? delta : 0;
  if (delta < 0) {
    var idx = side === "left" ? 0 : side === "right" ? w - 1 : side === "top" ? 0 : h - 1;
    var busy = __lcLineBusy(pj, horiz ? "x" : "y", idx);
    if (busy) { __lcToast(__lcLcName(side) + "还有 " + busy + "，先移开再删除"); return; }
  }
  window.__lcCommit(function (p) {
    var bb = p.board;
    var nw = horiz ? Math.round(bb.width) + delta : Math.round(bb.width);
    var nh = horiz ? Math.round(bb.height) : Math.round(bb.height) + delta;
    var comps = (p.components || []).map(function (c) {
      if ((!shiftX && !shiftY) || !c || !c.position) return c;
      return Object.assign({}, c, { position: [c.position[0] + shiftX, c.position[1] + shiftY] });
    });
    var rt = p.routing || {};
    var traces = (rt.traces || []).map(function (t) {
      if ((!shiftX && !shiftY) || !t) return t;
      var o = Object.assign({}, t, {
        points: (t.points || []).map(function (q) { return [q[0] + shiftX, q[1] + shiftY]; })
      });
      if (t.edges) o.edges = t.edges.map(function (e) {
        return [[e[0][0] + shiftX, e[0][1] + shiftY], [e[1][0] + shiftX, e[1][1] + shiftY]];
      });
      return o;
    });
    var jumpers = (rt.jumpers || []).map(function (j) {
      if ((!shiftX && !shiftY) || !j) return j;
      return Object.assign({}, j, {
        from: [j.from[0] + shiftX, j.from[1] + shiftY],
        to: [j.to[0] + shiftX, j.to[1] + shiftY]
      });
    });
    var grown = horiz ? ("板宽 " + Math.round(bb.width) + " → " + nw + " 列")
      : ("板高 " + Math.round(bb.height) + " → " + nh + " 行");
    var msg = grown + (shiftX || shiftY ? "（左侧/上侧新增，已有内容整体平移 1 格）" : "") +
      "。板尺寸已改变，请重跑 DRC。";
    return Object.assign({}, p, {
      board: Object.assign({}, bb, { width: nw, height: nh }),
      components: comps,
      routing: Object.assign({}, rt, {
        traces: traces, jumpers: jumpers, drc: void 0, diagnostics: void 0,
        warnings: (rt.warnings || [])
          .filter(function (x) { return String(x).indexOf("板尺寸已改变") < 0; })
          .concat([msg])
      })
    });
  });
}

/* ------------------------------------------------------------------
 * 二、零欧电阻 = 导线
 * 判定：kind === "resistor"、脚数 ≥ 2、参数解析为 0Ω（0 / 0R / 0R0 / 0Ω / 0.0 …）。
 * 语义：若它的 1、2 脚被指派到**同一个网络**，则该网络在这两个孔之间已经连通
 *       （导体就是电阻本体），于是：
 *         · 飞线不再在这两个脚之间画线；
 *         · 自动布线 / 继续布线不再为这两个脚铺一段多余铜箔；
 *         · DRC 不会把它们报成未连通。
 * 实现上不往工程里写任何“假铜箔”：只在喂给布线器 / DRC / 飞线的入参里追加一条
 * 带 __lcBridge 标记的虚拟走锡（locked，不参与输出、不渲染、不落盘）。
 * 跨网络的情况不需要处理——那时它们本来就是两个网络，元件本体即为桥接，
 * 飞线不会跨网络画线，布线器也各布各的。
 * ------------------------------------------------------------------ */
function __lcOhm(v) {
  var s = String(v == null ? "" : v).trim().toUpperCase();
  if (!s) return NaN;
  s = s.replace(/\s+/g, "").replace(/\u03A9/g, "R").replace(/OHMS?$/, "").replace(/欧姆|欧/g, "");
  if (!s) return NaN;
  var m = s.match(/^(\d*)R(\d*)$/);          /* 0R / 0R0 / R0 / 4R7 */
  if (m) {
    if (m[1] === "" && m[2] === "") return NaN;
    return parseFloat((m[1] || "0") + "." + (m[2] || "0"));
  }
  m = s.match(/^(\d+(?:\.\d+)?)([KM]?)$/);   /* 0 / 0.0 / 100 / 1K / 1M */
  if (m) {
    var n = parseFloat(m[1]);
    return m[2] === "K" ? n * 1e3 : m[2] === "M" ? n * 1e6 : n;
  }
  return NaN;
}
function __lcZeroOhm(c) {
  if (!c) return false;
  if (String(c.kind || "") !== "resistor") return false;
  if ((c.pinOffsets || []).length < 2) return false;
  return __lcOhm(c.value) === 0;
}
function __lcBridgeLinks(p) {
  if (!p) return [];
  var comps = p.components || [];
  var zeros = comps.filter(__lcZeroOhm);
  if (!zeros.length) return [];
  var eps = [];
  try { eps = Io(p.importState, comps) || []; } catch (e) { return []; }
  var netOf = {};
  eps.forEach(function (e) { netOf[String(e.ref) + ":" + String(e.pin)] = e.net; });
  var out = [];
  zeros.forEach(function (c) {
    if (!c.mounted) return;
    var na = netOf[c.name + ":1"], nb = netOf[c.name + ":2"];
    if (!na || !nb || na !== nb) return;
    var a = null, b = null;
    try { a = Si(c, 1); b = Si(c, 2); } catch (e) { return; }
    if (!a || !b) return;
    out.push({ net: na, from: a, to: b, ref: c.name });
  });
  return out;
}
function __lcBridgeTraces(p, traces) {
  var links = __lcBridgeLinks(p);
  if (!links.length) return traces || [];
  var extra = links.map(function (l) {
    return {
      id: "__lcBridge:" + l.ref, net: l.net, points: [l.from, l.to],
      edges: [[l.from, l.to]], layer: "bottom", locked: !0, __lcBridge: !0
    };
  });
  return (traces || []).concat(extra);
}
function __lcRoutingBridges(p) {
  var rt = (p && p.routing) || {};
  return Object.assign({}, rt, { traces: __lcBridgeTraces(p, rt.traces) });
}

window.__lcBoardGrow = __lcBoardGrow;
window.__lcZeroOhm = __lcZeroOhm;
window.__lcOhm = __lcOhm;
window.__lcBridgeLinks = __lcBridgeLinks;
