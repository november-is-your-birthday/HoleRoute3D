/* ===== __lc v3.3: 多选 / 全部拔起 / 空格旋转 / 跳线删除 / 撤销历史 / 引脚名 ===== */

/* 多选集合的镜像：组件内 state 同步写到这里，供渲染层与快捷键读取 */
if (!window.__lcSelIds) window.__lcSelIds = [];

/* ---------- 轻量提示条 ---------- */
function __lcStyleOnce(id, css) {
  if (document.getElementById(id)) return;
  var st = document.createElement("style");
  st.id = id;
  st.textContent = css;
  document.head.appendChild(st);
}
function __lcToast(msg, ms = 2600) {
  try {
    __lcStyleOnce("lc-toast-style", "#lc-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:10000;background:var(--ui-accent-soft,#223550);border:1px solid var(--ui-accent,#6f9fe8);color:var(--ui-text,#e6ebf2);padding:7px 18px;border-radius:3px;font-size:12px;line-height:1.5;box-shadow:0 6px 18px rgba(0,0,0,.3);pointer-events:none;max-width:70vw;text-align:center}");
    var el = document.getElementById("lc-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "lc-toast";
      document.body.appendChild(el);
    }
    el.textContent = String(msg || "");
    el.style.display = "block";
    if (window.__lcToastTimer) clearTimeout(window.__lcToastTimer);
    window.__lcToastTimer = setTimeout(function () {
      var t = document.getElementById("lc-toast");
      if (t) t.style.display = "none";
    }, Math.max(1200, Number(ms) || 2600));
  } catch (e) {}
}

/* ---------- 撤销历史上限（默认 200 步，可在设置里改） ---------- */
function __lcHistoryLimit() {
  var v = 200;
  try {
    var raw = localStorage.getItem("lc-history");
    var n = parseInt(raw, 10);
    if (isFinite(n)) v = n;
  } catch (e) {}
  return Math.max(20, Math.min(1000, v));
}

/* ---------- 引脚名规划：pinInfo > 字母脚表 > 手选脚序 > 数字 ---------- */
var __lcPinLetterTables = {
  /* 三极管：按「脚 1 / 脚 2 / 脚 3」给出 E・B・C 的三种常见排布 */
  to92: { EBC: ["E", "B", "C"], CBE: ["C", "B", "E"], BCE: ["B", "C", "E"] },
  to220: { EBC: ["B", "C", "E"], CBE: ["B", "C", "E"], BCE: ["B", "C", "E"] },
  to3: { EBC: ["B", "C", "E"], CBE: ["B", "C", "E"], BCE: ["B", "C", "E"] },
  to247: { EBC: ["B", "C", "E"], CBE: ["B", "C", "E"], BCE: ["B", "C", "E"] },
  to39: { EBC: ["E", "B", "C"], CBE: ["C", "B", "E"], BCE: ["B", "C", "E"] }
};
function __lcPinNamePlan(kind, pinInfoEntry, pinOrder, pinCount) {
  var n = Math.max(1, Number(pinCount) || 0);
  var out = [], i;
  /* 1) 网表自带引脚名（KiCad 的 pinInfo 最准）
   *    注意：嘉立创 / Protel 导入器会把引脚名合成为脚号本身（"1"/"2"/"3"），
   *    那不是有效名字，必须继续往下走，否则手选脚序永远被短路。 */
  if (pinInfoEntry && typeof pinInfoEntry === "object") {
    var names = [], real = false;
    for (i = 1; i <= n; i += 1) {
      var e = pinInfoEntry[i] || pinInfoEntry[String(i)];
      var nm = e && typeof e === "object" ? e.name : e;
      nm = nm == null ? "" : String(nm).trim();
      if (nm && !/^\d+$/.test(nm)) real = true;
      names.push(nm);
    }
    if (real) {
      for (i = 0; i < n; i += 1) if (!names[i] || /^\d+$/.test(names[i])) names[i] = String(i + 1);
      return names;
    }
  }
  /* 2) 用户在属性面板手选的脚序 */
  var table = __lcPinLetterTables[kind];
  var key = String(pinOrder || "").toUpperCase();
  if (table && table[key] && table[key].length >= n) return table[key].slice(0, n);
  /* 3) 无依据时只标脚号，不猜极性 */
  out = [];
  for (i = 1; i <= n; i += 1) out.push(String(i));
  return out;
}

/* ---------- 跳线打标 / 命中 ---------- */
function __lcTagJumper(group, jumper) {
  if (!group || !jumper) return group;
  var id = jumper.id != null ? String(jumper.id) : "";
  var net = jumper.net != null ? String(jumper.net) : "";
  try {
    group.userData.__lcJumperId = id;
    group.userData.__lcJumperNet = net;
    group.traverse(function (o) {
      if (!o.userData) o.userData = {};
      o.userData.__lcJumperId = id;
      o.userData.__lcJumperNet = net;
    });
  } catch (e) {}
  return group;
}
function __lcPickJumper(ev) {
  try {
    var sc = window.__lcScene, cm = window.__lcCamera, cv = window.__lcCanvas;
    if (!sc || !cm || !cv) return null;
    var r = cv.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    var ndc = new Ot((ev.clientX - r.left) / r.width * 2 - 1, 1 - (ev.clientY - r.top) / r.height * 2);
    var rc = new Xv;
    rc.setFromCamera(ndc, cm);
    /* 走线组挂在场景里带 routeSide 的 Group 下，直接全场景递归找带跳线标记的对象 */
    var hits = rc.intersectObjects(sc.children, !0);
    if (!hits.length) return null;
    var d0 = hits[0].distance;
    var xr = !!(window.__lcBoardArgs && window.__lcBoardArgs.transparent);
    for (var i = 0; i < hits.length; i += 1) {
      var o = hits[i].object, p = o;
      while (p && !(p.userData && p.userData.__lcJumperId)) p = p.parent;
      if (!p || !p.userData || !p.userData.__lcJumperId) continue;
      /* 被不透明板体挡住的跳线不删：只有最近命中、或透视模式下才认 */
      if (i > 0 && !xr && hits[i].distance > d0 + 0.15) return null;
      return p.userData.__lcJumperId;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/* ---------- 元件引脚名（供 3D 标注与悬停提示共用） ---------- */function __lcPinNamesOf(c) {
  var pj = window.__lcProject || {};
  var pi = (pj.importState && pj.importState.pinInfo) || {};
  var n = (c.pinOffsets && c.pinOffsets.length) || c.pinCount || 0;
  try {
    return __lcPinNamePlan(c.kind, pi[c.name], c.pinOrder, n);
  } catch (e) {
    return [];
  }
}

/* ---------- 悬停 / 点击引脚显示网络名 ---------- */
var __lcTipIdx = null;
function __lcTipBuildIndex() {
  var pj = window.__lcProject;
  if (!pj || !pj.importState || !pj.components) return {};
  var eps;
  try { eps = Io(pj.importState, pj.components) || []; } catch (e) { return {}; }
  var idx = {};
  eps.forEach(function (ep) {
    var k = ep.ref + "\u0000" + String(ep.pin);
    if (!idx[k]) idx[k] = { net: ep.net, role: ep.role };
  });
  return idx;
}
function __lcTipEl() {
  var el = document.getElementById("lc-pin-tip");
  if (el) return el;
  __lcStyleOnce("lc-pin-tip-style",
    "#lc-pin-tip{position:fixed;z-index:9998;background:var(--ui-accent-soft,#1b2735);" +
    "border:1px solid var(--ui-accent,#6f9fe8);color:var(--ui-text,#e8eef6);" +
    "padding:4px 10px;border-radius:3px;font-size:12px;line-height:1.5;pointer-events:none;" +
    "box-shadow:0 4px 12px rgba(0,0,0,.32);white-space:nowrap;display:none}");
  el = document.createElement("div");
  el.id = "lc-pin-tip";
  document.body.appendChild(el);
  return el;
}
function __lcPinTipHide() {
  var el = document.getElementById("lc-pin-tip");
  if (el) el.style.display = "none";
  __lcTipIdx = null;
}
function __lcPinTipShow(hit, ev, hold) {
  if (!hit) return;
  var idx = __lcTipIdx || (__lcTipIdx = __lcTipBuildIndex());
  var ent = idx[hit.ref + "\u0000" + String(hit.pin)];
  var pj = window.__lcProject || {};
  var comp = null;
  (pj.components || []).forEach(function (c) { if (c.name === hit.ref) comp = c; });
  var names = comp ? __lcPinNamesOf(comp) : [];
  var pname = names.length >= hit.pin ? String(names[hit.pin - 1]) : "";
  var txt = hit.ref + "." + hit.pin + (pname && pname !== String(hit.pin) ? "（" + pname + "）" : "");
  txt += ent && ent.net ? " — 网络 " + ent.net : " — 未连接任何网络";
  var el = __lcTipEl();
  el.textContent = txt;
  el.style.display = "block";
  var x = Math.min(window.innerWidth - el.offsetWidth - 12, ev.clientX + 14);
  var y = Math.max(8, ev.clientY - 34);
  el.style.left = x + "px";
  el.style.top = y + "px";
  if (hold) window.__lcTipHold = Date.now() + 3500;
}
document.addEventListener("pointermove", function (ev) {
  if (window.__lcPicking) return;
  var cv = window.__lcCanvas;
  if (!cv || ev.target !== cv) { if (!window.__lcTipHold || Date.now() > window.__lcTipHold) __lcPinTipHide(); return; }
  if (window.__lcTipHold && Date.now() < window.__lcTipHold) return;
  var now = Date.now();
  if (now - (window.__lcTipT || 0) < 55) return;
  window.__lcTipT = now;
  var hit = __lcPinFromEvent(ev);
  if (!hit) { __lcPinTipHide(); return; }
  __lcPinTipShow(hit, ev, !1);
}, !0);
document.addEventListener("pointerdown", function (ev) {
  if (window.__lcPicking) return;
  var cv = window.__lcCanvas;
  if (!cv || ev.target !== cv) return;
  var hit = __lcPinFromEvent(ev);
  if (hit) __lcPinTipShow(hit, ev, !0);
}, !0);
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Escape") { window.__lcTipHold = 0; __lcPinTipHide(); }
}, !0);

/* 调试 / 自动化测试入口（与既有的 window.__lcScene / __lcProject 一致） */
window.__lcPickJumper = __lcPickJumper;
