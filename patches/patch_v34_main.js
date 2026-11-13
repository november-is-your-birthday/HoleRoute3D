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

/* 布线结果落盘前把虚拟桥接剔掉。
 * 布线器会把输入的走锡原样回显到结果里，于是 __lcBridge 那条假铜箔会被写进工程，
 * 之后任何一次 DRC 都会把它当成真实铜箔，在中间孔上与别的网络判短路。
 * 桥接只需要在「本次布线计算」里存在，绝不能进工程。 */
function __lcStripBridges(rt) {
  if (!rt) return rt;
  var isB = function (x) {
    return !!x && (x.__lcBridge === true || String(x.id || "").indexOf("__lcBridge:") === 0);
  };
  var tr0 = rt.traces || [], jm0 = rt.jumpers || [];
  var tr = tr0.filter(function (t) { return !isB(t); });
  var jm = jm0.filter(function (j) { return !isB(j); });
  if (tr.length === tr0.length && jm.length === jm0.length) return rt;
  return Object.assign({}, rt, { traces: tr, jumpers: jm });
}

/* DRC 用：把每个 0Ω 元件（已放置、两脚同网络）的两个焊盘并进并查集。
 * 只动连通性 —— 不往两个焊盘之间「铺」铜箔，所以不会占用中间孔、
 * 也就不会在中间孔上误判「不同网络短路」。 */
function __lcDrcUnion(comps, byPin, uf, cells, keyFn) {
  var zeros = (comps || []).filter(function (c) { return c && c.mounted && __lcZeroOhm(c); });
  zeros.forEach(function (c) {
    var a = byPin.get(c.name + ":1"), b = byPin.get(c.name + ":2");
    if (!a || !b || !a.net || a.net !== b.net) return;
    var ka = keyFn(a.grid[0], a.grid[1]), kb = keyFn(b.grid[0], b.grid[1]);
    uf.add(ka); uf.add(kb);
    if (cells) { cells.add(ka); cells.add(kb); }
    uf.union(ka, kb);
  });
}

/* DRC 里 MANUAL 走锡的网络归属必须按「连通组」算，不能按单条线段算。
 *
 * 手动画的走锡是一段段存的（一次拖动 = 一条 trace）。原实现 z2() 对每条 trace
 * 单独看它经过的孔上有哪些焊盘网络：
 *   恰好 1 个 → 这条线就是那个网络（继承）
 *   0 个或 ≥2 个 → 保持 MANUAL
 * 于是同一条电气连线上会出现两种名字：碰到焊盘的段叫 $1N32，没碰到焊盘的段叫
 * MANUAL。两者共用同一个孔时，DRC 看到该孔的导电组里有 {MANUAL, $1N32}，
 * 就报「不同网络共用同一导电组」—— 明明是一根线，被当成两根线短路。
 *
 * 这里改成：先按孔把所有走锡/跳线归并成连通组，再逐段传播定名——
 * 碰到焊盘的段先定网，没碰到焊盘的中间段继承与它共孔的已定网络，循环到稳定；
 * 最后仍定不下来的，若整组只有一个网络就归入它（悬空铜箔跟组走），
 * 组内有多个网络才保留 MANUAL 交给 DRC（那才是真短路）。
 * 结果按对象引用缓存，主循环里用 __lcManualNetOf(线段) 取。
 */
var __lcManualNetMap = null;

function __lcPrepManualNets(traces, jumpers, pinNets, keyFn, UfClass) {
  var map = new Map();
  var tr = traces || [], jm = jumpers || [];
  if (!tr.length && !jm.length) { __lcManualNetMap = map; return map; }
  var uf = new UfClass();
  var items = [];
  var keysOf = function (o) {
    if (!o) return [];
    var pts = o.points;
    if (pts && pts.length) {
      var ks = [];
      for (var i = 0; i < pts.length; i += 1) ks.push(keyFn(pts[i][0], pts[i][1]));
      return ks;
    }
    if (o.from && o.to) return [keyFn(o.from[0], o.from[1]), keyFn(o.to[0], o.to[1])];
    return [];
  };
  var addItem = function (o) {
    var ks = keysOf(o);
    if (!ks.length) return;
    for (var i = 0; i < ks.length; i += 1) {
      uf.add(ks[i]);
      if (i) uf.union(ks[i - 1], ks[i]);
    }
    items.push({ obj: o, keys: ks });
  };
  tr.forEach(addItem);
  jm.forEach(addItem);

  var groupNets = new Map();
  var pushNet = function (root, net) {
    if (!net) return;
    var s = groupNets.get(root);
    if (!s) { s = new Set(); groupNets.set(root, s); }
    s.add(net);
  };
  // 1) 自带网络名的走锡/跳线（自动布线的线本身就有 net）
  items.forEach(function (it) {
    var net = it.obj && it.obj.net;
    if (!net || net === "MANUAL") return;
    for (var i = 0; i < it.keys.length; i += 1) pushNet(uf.find(it.keys[i]), net);
  });
  // 2) 组内焊盘上的期望网络
  items.forEach(function (it) {
    for (var i = 0; i < it.keys.length; i += 1) {
      var hs = pinNets.get(it.keys[i]);
      if (!hs) continue;
      var root = uf.find(it.keys[i]);
      hs.forEach(function (n) { pushNet(root, n); });
    }
  });

  // 逐条定名：先给「自身就碰到焊盘」的段定网络，再让没碰到焊盘的中间段
  // 继承「与它共孔的已定网络」，循环到不再变化。
  // 这样一串「A 段-$1N32 / B 段悬空 / C 段-$1N32」会全部归到 $1N32，不再互相冲突；
  // 只有真正同时接上两个网络的段（真短路）才会留下 MANUAL 被报出来。
  var byHoleNet = new Map();
  var addNetToHoles = function (it, net) {
    for (var i = 0; i < it.keys.length; i += 1) {
      var s = byHoleNet.get(it.keys[i]);
      if (!s) { s = new Set(); byHoleNet.set(it.keys[i], s); }
      s.add(net);
    }
  };
  var netsOnHoles = function (it) {
    var s = new Set();
    for (var i = 0; i < it.keys.length; i += 1) {
      var have = byHoleNet.get(it.keys[i]);
      if (have) have.forEach(function (n) { s.add(n); });
    }
    return s;
  };
  var pending = [];
  items.forEach(function (it) {
    var o = it.obj;
    var net = o && o.net;
    if (net && net !== "MANUAL") { map.set(o, net); addNetToHoles(it, net); return; }
    var self = new Set();
    for (var i = 0; i < it.keys.length; i += 1) {
      var hs = pinNets.get(it.keys[i]);
      if (hs) hs.forEach(function (n) { self.add(n); });
    }
    if (self.size === 1) {
      var only = self.values().next().value;
      map.set(o, only);
      addNetToHoles(it, only);
    } else {
      pending.push(it);
    }
  });
  for (var round = 0; round < 8 && pending.length; round += 1) {
    var next = [];
    pending.forEach(function (it) {
      var found = netsOnHoles(it);
      if (found.size === 1) {
        var n = found.values().next().value;
        map.set(it.obj, n);
        addNetToHoles(it, n);
      } else {
        next.push(it);
      }
    });
    if (next.length === pending.length) break;
    pending = next;
  }
  // 仍未定的：若所在连通组只含一个网络，归入它（纯悬空铜箔跟组走）；
  // 组里有多个网络说明这处确实短路，保留 MANUAL 让 DRC 报出来。
  pending.forEach(function (it) {
    var gs = groupNets.get(uf.find(it.keys[0]));
    map.set(it.obj, gs && gs.size === 1 ? gs.values().next().value : "MANUAL");
  });
  __lcManualNetMap = map;
  return map;
}

function __lcManualNetOf(seg) {
  if (!seg) return "MANUAL";
  if (__lcManualNetMap && __lcManualNetMap.has(seg)) return __lcManualNetMap.get(seg);
  return seg.net || "MANUAL";
}

/* ==================================================================
 * v3.4.4：DRC 错误可定位
 * 原来的报错只有一句「网络间短路 @ 13,42：MANUAL、$1N11」——既不说这个孔上
 * 是哪个元件哪只脚，也不能点过去，用户只能自己数行列去找。
 * 这里做三件事：
 *   1) 从 drc.pinStatuses 反查「孔 → 引脚」，每条错误标出涉及的位号.脚号(网络)；
 *   2) 底层走锡重叠这类错误只有 segment（一条边的两个孔），补出完整的孔位；
 *   3) 点条目 → 相机移到该孔 + 红球标记，列表不再截断，可复制全部。
 * ================================================================== */
function __lcPinIndex(statuses) {
  var idx = {};
  (statuses || []).forEach(function (p) {
    if (!p || !p.grid || p.grid.length < 2) return;
    var k = p.grid[0] + "," + p.grid[1];
    var arr = idx[k] || (idx[k] = []);
    for (var i = 0; i < arr.length; i += 1) {
      if (arr[i].ref === p.ref && arr[i].pin === p.pin) return;
    }
    arr.push({ ref: p.ref, pin: p.pin, name: p.pinName, net: p.expectedNet, status: p.status });
  });
  return idx;
}

/* 一条错误涉及的所有孔：grid（单孔）、segment（两点）都要算上 */
function __lcDrcHoles(e) {
  if (!e) return [];
  if (e.holes && e.holes.length) return e.holes;
  var out = [];
  var add = function (g) {
    if (!g || typeof g[0] !== "number" || typeof g[1] !== "number") return;
    var k = g[0] + "," + g[1];
    for (var i = 0; i < out.length; i += 1) if (out[i][0] + "," + out[i][1] === k) return;
    out.push([g[0], g[1]]);
  };
  add(e.grid);
  if (e.segment && e.segment.length) {
    add(e.segment[0]);
    add(e.segment[e.segment.length - 1]);
  }
  return out;
}

function __lcDrcWhere(e) {
  var hs = __lcDrcHoles(e);
  if (!hs.length) return "";
  return hs.map(function (g) { return g[0] + "," + g[1]; }).join(" ↔ ");
}

/* 位号.脚号(引脚名)（网络）——定位到「哪只脚」靠这一行。
   引脚名是纯数字（嘉立创网表就是 "1"/"2"）时不重复显示，只留脚号。 */
function __lcPinLabel(ref, pin, name, net) {
  var nm = name && String(name) !== String(pin) && /[A-Za-z]/.test(String(name)) ? "(" + name + ")" : "";
  return ref + "." + pin + nm + (net ? "（" + net + "）" : "");
}
function __lcDrcPinText(e, idx) {
  var parts = [];
  var push = function (s) { if (s && parts.indexOf(s) < 0) parts.push(s); };
  if (e && e.ref) push(__lcPinLabel(e.ref, e.pin, e.pinName, e.expectedNet));
  __lcDrcHoles(e).forEach(function (g) {
    var list = (idx || {})[g[0] + "," + g[1]] || [];
    list.forEach(function (p) { push(__lcPinLabel(p.ref, p.pin, p.name, p.net)); });
  });
  if (parts.length > 8) return parts.slice(0, 8).join("  ") + "  +" + (parts.length - 8);
  return parts.join("  ");
}

function __lcDrcClearMark() {
  var list = window.__lcDrcMarks || [];
  var sc = window.__lcScene;
  list.forEach(function (m) {
    try {
      if (sc && m.parent === sc) sc.remove(m);
      if (m.geometry && m.geometry.dispose) m.geometry.dispose();
      if (m.material && m.material.dispose) m.material.dispose();
    } catch (e) {}
  });
  window.__lcDrcMarks = [];
}

function __lcDrcMark(holes) {
  try {
    var sc = window.__lcScene, ba = window.__lcBoardArgs;
    if (!sc || !ba || !holes || !holes.length) return;
    __lcDrcClearMark();
    var w = ba.board.width, h = ba.board.height, out = [];
    holes.slice(0, 24).forEach(function (g) {
      var m = new Vt(new Ki(0.42, 16, 12),
        new Pe({ color: 16726832, emissive: 16724736, roughness: 0.32, transparent: true, opacity: 0.95 }));
      m.position.set(g[0] - w / 2 + 0.5, 0.62, g[1] - h / 2 + 0.5);
      m.renderOrder = 12;
      if (m.material) { m.material.depthTest = false; m.material.emissiveIntensity = 1.1; }
      sc.add(m);
      out.push(m);
    });
    window.__lcDrcMarks = out;
  } catch (e) {}
}

/* 保持当前视角方向，把观察点平移到目标孔并适当拉近 */
function __lcDrcFocus(holes) {
  try {
    var cam = window.__lcCamera, ctl = window.__lcControls, ba = window.__lcBoardArgs;
    if (!cam || !ba || !holes || !holes.length) return;
    var w = ba.board.width, h = ba.board.height, cx = 0, cz = 0;
    holes.forEach(function (g) { cx += g[0] - w / 2 + 0.5; cz += g[1] - h / 2 + 0.5; });
    cx /= holes.length;
    cz /= holes.length;
    var ty = 0.6;
    if (ctl && ctl.target) {
      var dx = cam.position.x - ctl.target.x;
      var dy = cam.position.y - ctl.target.y;
      var dz = cam.position.z - ctl.target.z;
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      var nd = Math.min(Math.max(len, 7), 16);
      ctl.target.set(cx, ty, cz);
      cam.position.set(cx + dx / len * nd, ty + dy / len * nd, cz + dz / len * nd);
      cam.lookAt(ctl.target);
      if (ctl.update) ctl.update();
    } else {
      cam.position.set(cx + 8, 12, cz + 10);
      cam.lookAt(cx, ty, cz);
    }
  } catch (e) {}
}

function __lcDrcGo(e) {
  var holes = __lcDrcHoles(e);
  if (!holes.length) { __lcToast("这条记录没有孔位，无法定位"); return; }
  __lcDrcMark(holes);
  __lcDrcFocus(holes);
  var who = e && e.ref ? e.ref + "." + e.pin + " · " : "";
  __lcToast("已定位 " + who + "孔 " + __lcDrcWhere(e));
}

function __lcDrcCopy(project) {
  var d = (project && project.routing && project.routing.drc) || {};
  var idx = __lcPinIndex(d.pinStatuses);
  var lines = [];
  var fmt = function (e, tag) {
    var where = __lcDrcWhere(e);
    var pins = __lcDrcPinText(e, idx);
    return tag + " " + __lcDrcCode(e.code) + (where ? " @ " + where : "") +
      (pins ? " | " + pins : "") + "\n    " + e.message;
  };
  (d.errors || []).forEach(function (e, i) { lines.push((i + 1) + ". " + fmt(e, "[错误]")); });
  (d.warnings || []).forEach(function (e, i) { lines.push((i + 1) + ". " + fmt(e, "[警告]")); });
  var text = lines.join("\n");
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    else {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  } catch (e) {}
  __lcToast("已复制 " + (d.errors || []).length + " 条错误、" + (d.warnings || []).length + " 条警告");
}

function __lcDrcItem(e, idx, key, no) {
  var isErr = e.severity === "error";
  var where = __lcDrcWhere(e);
  var pins = __lcDrcPinText(e, idx);
  return P.jsxs("button", {
    type: "button",
    className: "lc-drc-item" + (isErr ? " is-error" : " is-warn"),
    title: where ? "点击定位到孔 " + where : "点击定位",
    onClick: function () { __lcDrcGo(e); },
    children: [
      P.jsxs("span", { className: "lc-drc-head", children: [
        P.jsx("span", { className: "lc-drc-no", children: no }),
        P.jsx("span", { className: "lc-drc-code", children: __lcDrcCode(e.code) }),
        where ? P.jsx("span", { className: "lc-drc-pos", children: where }) : null
      ] }),
      pins ? P.jsx("span", { className: "lc-drc-pins", children: pins }) : null,
      P.jsx("span", { className: "lc-drc-msg", children: e.message })
    ]
  }, key);
}

function __lcDrcPanelV2(props) {
  var i = (props && props.project) || {};
  var d = i.routing && i.routing.drc;
  if (!d) {
    if (window.__lcDrcMarks && window.__lcDrcMarks.length) __lcDrcClearMark();
    return null;
  }
  __lcStyleOnce("lc-drc-css",
    ".lc-drc-list{display:flex;flex-direction:column;gap:6px;max-height:44vh;overflow:auto;padding-right:2px;margin-top:8px}" +
    ".lc-drc-item{display:flex;flex-direction:column;gap:3px;width:100%;text-align:left;border:1px solid #e3e8ef;" +
    "border-left:3px solid #d9534f;border-radius:6px;background:#fff;padding:6px 8px;cursor:pointer;transition:background .12s,border-color .12s}" +
    ".lc-drc-item:hover{background:#f5f9ff;border-color:#b9cdf0}" +
    ".lc-drc-item.is-warn{border-left-color:#e0a800}" +
    ".lc-drc-head{display:flex;align-items:center;gap:6px;min-width:0}" +
    ".lc-drc-no{flex:none;min-width:14px;color:#98a2b3;font-size:11px;font-variant-numeric:tabular-nums}" +
    ".lc-drc-code{flex:none;color:#1f2937;font-size:12px;font-weight:600}" +
    ".lc-drc-pos{flex:none;margin-left:auto;color:#1d6b3a;background:#eef7f0;border:1px solid #cfe6d6;" +
    "border-radius:4px;padding:0 5px;font-size:11px;font-family:ui-monospace,Consolas,monospace}" +
    ".lc-drc-pins{color:#334155;font-size:11.5px;line-height:1.5;word-break:break-all}" +
    ".lc-drc-msg{color:#7b8794;font-size:11px;line-height:1.45;word-break:break-all}" +
    ".lc-drc-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}" +
    ".lc-drc-chip{background:#f2f4f7;border:1px solid #e4e7ec;border-radius:10px;padding:0 7px;color:#475467;font-size:11px;line-height:17px}" +
    ".lc-drc-chip.is-warn{background:#fdf7e6;border-color:#f0dca6;color:#8a6d1f}" +
    ".lc-drc-actions{display:flex;gap:10px;margin-top:8px}" +
    ".lc-drc-badge{margin-left:6px;color:#b42318;font-size:11px;font-weight:600}" +
    ".lc-drc-tip{margin:6px 0 0;color:#8b95a1;font-size:11px}");
  var errs = d.errors || [], warns = d.warnings || [];
  var idx = __lcPinIndex(d.pinStatuses);
  // 按错误码计数：错误在前、警告在后；只有警告时也要有标签，否则一行空白看着像坏了
  var chips = [];
  [errs, warns].forEach(function (list, li) {
    var counts = {};
    list.forEach(function (e) { counts[e.code] = (counts[e.code] || 0) + 1; });
    Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .forEach(function (c) {
        chips.push(P.jsxs("span", {
          className: "lc-drc-chip" + (li === 1 ? " is-warn" : ""),
          title: (li === 1 ? "警告：" : "错误：") + __lcDrcCode(c),
          children: [__lcDrcCode(c), " ×", counts[c]]
        }, (li === 1 ? "w-" : "e-") + c));
      });
  });
  var items = [];
  errs.forEach(function (e, n) { items.push(__lcDrcItem(e, idx, "e" + n, n + 1)); });
  warns.forEach(function (e, n) { items.push(__lcDrcItem(e, idx, "w" + n, "警" + (n + 1))); });
  var capped = items.length > 120 ? items.slice(0, 120) : items;
  var hidden = items.length - capped.length;
  return P.jsxs("section", {
    className: "sidebar-section",
    children: [
      P.jsxs("h2", {
        children: ["DRC 检查", errs.length ? P.jsxs("span", { className: "lc-drc-badge", children: [errs.length, " 错"] }) : null]
      }),
      P.jsxs("div", {
        className: "import-summary",
        children: [
          P.jsx(kl, { label: "错误", value: errs.length }),
          P.jsx(kl, { label: "警告", value: warns.length })
        ]
      }),
      !errs.length && !warns.length ? P.jsx("p", { className: "drc-ok", children: "DRC 通过，未发现问题。" }) : null,
      chips.length ? P.jsx("div", { className: "lc-drc-chips", children: chips }) : null,
      capped.length ? P.jsx("p", { className: "lc-drc-tip", children: "点任一条可定位到对应孔位（相机拉到该处并打红球标记）" }) : null,
      capped.length ? P.jsx("div", { className: "lc-drc-list", children: capped }) : null,
      hidden > 0 ? P.jsxs("p", { className: "lc-drc-tip", children: ["另有 ", hidden, " 条未显示，用「复制全部」导出"] }) : null,
      capped.length ? P.jsxs("div", {
        className: "lc-drc-actions",
        children: [
          P.jsx("button", { type: "button", className: "text-button", onClick: function () { __lcDrcCopy(i); }, children: "复制全部" }),
          P.jsx("button", { type: "button", className: "text-button", onClick: function () { __lcDrcClearMark(); __lcToast("已清除定位标记"); }, children: "清除标记" })
        ]
      }) : null
    ]
  });
}

window.__lcBoardGrow = __lcBoardGrow;
window.__lcDrcGo = __lcDrcGo;
window.__lcDrcClearMark = __lcDrcClearMark;
window.__lcDrcPanelV2 = __lcDrcPanelV2;
window.__lcZeroOhm = __lcZeroOhm;
window.__lcOhm = __lcOhm;
window.__lcBridgeLinks = __lcBridgeLinks;
