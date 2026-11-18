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

/* ---------- 引脚名规划：pinInfo > 手选脚序 > 封装预设 ---------- */
/* 三极管封装：只有这几类才把手选脚序解释成 E/C/B 角色 */
var __lcTriKinds = { to92: 1, to39: 1, to220: 1, to247: 1, to3: 1 };
/* 各封装的常见排布，仅用于属性面板给「推荐值」提示，判定一律按用户实际选择 */
var __lcPinOrderPresets = { to92: "EBC", to39: "EBC", to220: "BCE", to247: "BCE", to3: "BEC" };

/* ---------- 按「封装」而不是按内部 kind 取预设 ----------
 * 根因：嘉立创 / 立创 EDA 导出的 Protel 网表里没有引脚功能名
 * （pinInfo 里是 "1"/"2"/"3"），而内部的 kind 只剩 5 种直插外形。
 * 贴片的 SOT-23 三极管会被归成 to92，于是预设按 TO-92 的 E-B-C 去套，
 * 而 SOT-23 的 BJT 是 JEDEC 标准 1=B 2=E 3=C —— B 和 E 正好互换。
 * 例：立创的 S8050_SOT-23，网表 Q1-1 接基极分压、Q1-2 经 R1 出射极、
 * Q1-3 接 +5V，与 1=B 2=E 3=C 完全对应，旧版本却标成 1=E 2=B。
 *
 * 所以预设改成两级：先看封装族（footprint / value 里的字符串），
 * 认不出来再退回 kind 的旧预设，两者都没有就只标脚号。
 */
var __lcPkgPresets = {
  to92: "EBC", to39: "EBC", to220: "BCE", to247: "BCE", to3: "BEC",
  /* 贴片三脚 BJT：1=B 2=E 3=C（S8050/S8550/MMBT3904/BC817 均如此） */
  sot23: "BEC",
  /* 带散热片的贴片功率管：1=B 2=C 3=E，散热片与 2 脚同电位 */
  sot223: "BCE", sot89: "BCE", to252: "BCE"
};
/* 封装族的中文/标准名，面板上显示用 */
var __lcPkgTitles = {
  to92: "TO-92", to39: "TO-39", to220: "TO-220", to247: "TO-247", to3: "TO-3",
  sot23: "SOT-23", sot223: "SOT-223", sot89: "SOT-89", to252: "TO-252(DPAK)"
};
/* 从封装名 / 型号里认封装族。取多个字段拼起来，因为立创的
 * FOOTPRINT 是 "S8050_SOT-23"、Device 是 "S8050_SOT_NPN"，
 * 而组件本身只留了 kind/label/name/value —— 封装名要靠 importState 补。
 *
 * 旧工程的兼容规则：明明没有 FOOTPRINT，value 只有 S8050_SOT_NPN 这种
 * 立创符号库名称时，仍要按 SOT-23 处理。它与同一电路的新 .enet 对照后
 * 确认就是 SOT-23；而且 $1N5（C2/R3 基极节点）在脚 1，正好对应 1=B。
 * 若显式 FOOTPRINT 是 TO-92，函数会先命中 TO-92 并直接返回，不会被 value 带偏。 */
function __lcPkgText(c) {
  if (!c) return "";
  var keys = ["footprint", "packageName", "value", "package", "pkg", "device", "footprintName"];
  var out = [], i;
  for (i = 0; i < keys.length; i += 1) {
    var v = c[keys[i]];
    if (v == null) continue;
    var s = String(v).trim();
    if (s) out.push(s);
  }
  /* 导入时认到的封装名存在 importState.components 的同 ref 条目里 */
  var pj = window.__lcProject || {};
  var ic = pj.importState && pj.importState.components;
  if (ic && c.name) {
    for (i = 0; i < ic.length; i += 1) {
      var e = ic[i];
      if (e && e.ref === c.name) {
        var pn = e.packageName;
        if (pn) out.push(String(pn).trim());
        break;
      }
    }
  }
  return out.join(" ").toUpperCase();
}
function __lcPkgFamily(c) {
  var s = __lcPkgText(c);
  if (!s) return "";
  /* 直插优先：名字里同时出现 "TO-92" 与其它字样时以直插为准 */
  if (/TO[-_ ]?92/.test(s)) return "to92";
  if (/TO[-_ ]?39/.test(s)) return "to39";
  if (/TO[-_ ]?247/.test(s)) return "to247";
  if (/TO[-_ ]?220/.test(s)) return "to220";
  if (/TO[-_ ]?3(\b|[^0-9])/.test(s)) return "to3";
  /* 贴片：先认带型号的具体封装，再兜底 SOT */
  if (/SOT[-_ ]?223/.test(s)) return "sot223";
  if (/SOT[-_ ]?89/.test(s)) return "sot89";
  if (/TO[-_ ]?252|D2?PAK/.test(s)) return "to252";
  if (/SOT[-_ ]?23|SC[-_ ]?70|SOT[-_ ]?323|SOT[-_ ]?523|TSOT/.test(s)) return "sot23";
  /* 立创旧工程常见：只有 value=S8050_SOT_NPN，没有 FOOTPRINT。
     这是三脚 SOT-23 BJT 的符号库名，按 SOT-23 处理。 */
  if (/SOT/.test(s)) return "sot23";
  return "";
}
/* 手选脚序就是「逐脚角色」：EBC 表示脚1=E、脚2=B、脚3=C。
 * 不再按封装查表 —— 以前 to220/to3/to247 三个键全返回 B-C-E，
 * 用户选 EBC 得到的却是 1=B 2=C 3=E，与封装完全对不上。 */
function __lcPinOrderOf(pinOrder) {
  var key = String(pinOrder == null ? "" : pinOrder).toUpperCase().replace(/\s+/g, "");
  if (!key || !/^[CEB]+$/.test(key)) return "";
  return key;
}
/* 预设排布用的暖黄色（0xFFC857）。3D 上白色 = 有确切依据，
 * 黄色 = 「还没选脚序，先按这个封装的常见排布标着」，一眼能区分。 */
var __lcPresetInk = 16762967;
/* 名字来源写在返回数组上：3D 建模据此换色，属性面板据此改文案。
 * 数组挂属性不参与 JSON 序列化，不会写进工程文件。 */
function __lcPinPlanTag(out, from) {
  try { out.__lcFrom = from; } catch (e) {}
  return out;
}
function __lcPinNamePlan(kind, pinInfoEntry, pinOrder, pinCount, pkg) {
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
      return __lcPinPlanTag(names, "pinInfo");
    }
  }
  /* 2) 用户在属性面板手选的脚序（逐脚角色，与封装无关）
   *    封装族只在「三脚」时才算三极管：SOT-23 也有六脚版本（SOT-23-6），
   *    那种是芯片，不能套 B-E-C。 */
  var tri = !!__lcTriKinds[kind] || (!!__lcPkgPresets[pkg] && n === 3);
  if (tri) {
    var key = __lcPinOrderOf(pinOrder);
    if (key) {
      out = [];
      /* 脚序短于实际脚数时，多出来的脚退回脚号，不编造角色 */
      for (i = 0; i < n; i += 1) out.push(key.charAt(i) || String(i + 1));
      return __lcPinPlanTag(out, "manual");
    }
    /* 3) 还没选脚序：先按封装族的常见排布标出来（黄色）。
     *    封装认不出来时退回旧的 kind 预设，两者都没有就落到 4) 只标脚号。
     *    以前这里只认 kind，SOT-23 被当成 TO-92 就得到反过来的 E/B —— 用户提的就是这一点。 */
    var pre = __lcPkgPresets[pkg] || __lcPinOrderPresets[kind];
    if (pre) {
      out = [];
      for (i = 0; i < n; i += 1) out.push(pre.charAt(i) || String(i + 1));
      return __lcPinPlanTag(out, "preset");
    }
  }
  /* 4) 无依据时只标脚号，不猜极性 */
  out = [];
  for (i = 1; i <= n; i += 1) out.push(String(i));
  return __lcPinPlanTag(out, "number");
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
    return __lcPinNamePlan(c.kind, pi[c.name], c.pinOrder, n, __lcPkgFamily(c));
  } catch (e) {
    return [];
  }
}

/* 属性面板里的「脚号 → 角色」对照行：让用户能直接拿实物封装图核对。
 * 只列脚号与角色，不列绝对坐标 —— 那个随摆放位置和旋转变化，看着更晕。 */
/* ---------- 三极管脚按「模型的实际引脚排布」落孔 ----------
 * 根因：网表的脚号顺序是按符号排的，3D 模型是按实物封装排的，两者可能对不上。
 * 例：本工程 Q1 的网表是 SOT-23 口径（脚1=B、脚2=E、脚3=C），但 3D 模型是 TO-92，
 * 而 TO-92 实物的引脚顺序是 E-B-C（平面对自己、引脚朝下，从左到右）—— 基极在中间。
 * 旧实现按脚号 1/2/3 直接排孔，基极就落在最左边的孔上，和实物差一位，
 * 表现为「中间才是 B」「模型和引脚定位是错的」。
 *
 * 做法：把脚号按角色映射到模型的物理槽位（E 所在的槽位放角色 E 的脚，依此类推）。
 * 三个孔的集合不变，只重排归属；`position` 同步平移，锚点仍落在脚 1 的孔上，
 * 所以孔位换算（脚1 为锚点）与 3D 摆放（Ey 减去锚点偏移）都保持一致。
 * 角色判不出来时（名字只有 1/2/3）不动，交给用户在面板里手选脚序。
 * 本函数幂等：排好之后再跑一遍不会来回翻。 */
function __lcArrangeLeads(c) {
  try {
    if (!c || !__lcTriKinds[c.kind]) return c;
    var offs = c.pinOffsets || [];
    if (offs.length !== 3 || !c.position) return c;
    var order = String(__lcPinOrderPresets[c.kind] || "").toUpperCase();
    if (order.length !== 3) return c;
    var names = __lcPinNamesOf(c);
    if (!names || names.length !== 3) return c;
    var i, s, slot = [-1, -1, -1], used = [0, 0, 0];
    for (i = 0; i < 3; i += 1) {
      s = order.indexOf(String(names[i] == null ? "" : names[i]).toUpperCase());
      if (s < 0 || used[s]) return c;
      used[s] = 1;
      slot[i] = s;
    }
    /* 当前各脚位于哪个物理槽位：偏移沿引脚方向跨度大的那一维排序 */
    var xs = [], zs = [], k;
    for (k = 0; k < 3; k += 1) { xs.push(offs[k][0]); zs.push(offs[k][1]); }
    var byX = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) >=
              (Math.max.apply(null, zs) - Math.min.apply(null, zs));
    var ord = [0, 1, 2].sort(function (a, b) {
      return byX ? (offs[a][0] - offs[b][0]) : (offs[a][1] - offs[b][1]);
    });
    var done = true;
    for (i = 0; i < 3; i += 1) if (ord[slot[i]] !== i) { done = false; break; }
    if (done) return c;
    var next = [[0, 0], [0, 0], [0, 0]];
    for (i = 0; i < 3; i += 1) {
      next[i] = [offs[ord[slot[i]]][0], offs[ord[slot[i]]][1]];
    }
    var d0 = [offs[ord[slot[0]]][0] - offs[0][0], offs[ord[slot[0]]][1] - offs[0][1]];
    var a = Number(c.rotation) || 0;
    var ca = Math.round(Math.cos(a)), sa = Math.round(Math.sin(a));
    c.position = [c.position[0] + d0[0] * ca - d0[1] * sa,
                  c.position[1] + d0[0] * sa + d0[1] * ca];
    c.pinOffsets = next;
  } catch (e) {}
  return c;
}
function __lcArrangeAll(pj) {
  var cs = (pj && pj.components) || [];
  for (var i = 0; i < cs.length; i += 1) __lcArrangeLeads(cs[i]);
  return pj;
}

/* 脚 i 落在洞洞板的哪一孔：与放置逻辑一致，脚 1 为锚点，其余按旋转后的相对位移推算 */
function __lcPinHoleOf(c, i) {
  try {
    var offs = (c && c.pinOffsets) || [];
    if (!offs.length || !c.position) return null;
    var base = offs[0];
    var dx = offs[i][0] - base[0];
    var dz = offs[i][1] - base[1];
    var a = Number(c.rotation) || 0;
    var ca = Math.round(Math.cos(a)), sa = Math.round(Math.sin(a));
    return [c.position[0] + dx * ca - dz * sa, c.position[1] + dx * sa + dz * ca];
  } catch (e) {
    return null;
  }
}
/* 该脚在网表里属于哪个网络（没有就返回空串） */
function __lcPinNetOf(ref, pinNo) {
  try {
    var pj = window.__lcProject || {};
    var nets = (pj.importState && pj.importState.nets) || pj.nets || [];
    var want = String(pinNo);
    for (var i = 0; i < nets.length; i += 1) {
      var nds = nets[i].nodes || [];
      for (var j = 0; j < nds.length; j += 1) {
        if (nds[j].ref === ref && String(nds[j].pin) === want) return String(nets[i].name || "");
      }
    }
  } catch (e) {}
  return "";
}

function __lcTriPinTable(c) {
  try {
    var offs = (c && c.pinOffsets) || [];
    if (!offs.length) return "该封装没有引脚信息";
    var names = __lcPinNamesOf(c);
    var parts = [];
    for (var i = 0; i < offs.length; i += 1) {
      var nm = names[i] || String(i + 1);
      /* 同时给出「孔位 + 网络」，可以直接对着实物核：字母说的脚是不是真的接了那个网 */
      var hole = __lcPinHoleOf(c, i);
      var net = __lcPinNetOf(c && c.name, i + 1);
      var extra = [];
      if (hole) extra.push("孔" + hole[0] + "," + hole[1]);
      if (net) extra.push(net);
      parts.push("脚" + (i + 1) + " " + nm + (extra.length ? "（" + extra.join(" · ") + "）" : ""));
    }
    var txt = parts.join("  ｜  ");
    /* 封装族与 kind 可能不一致：立创的 SOT-23 三极管在内部是 to92，
     * 3D 外形用的还是 TO-92。把认到的真实封装标出来，免得用户以为软件认错了。 */
    var pkg = __lcPkgFamily(c);
    if (pkg && pkg !== String(c.kind)) {
      txt = "封装 " + (__lcPkgTitles[pkg] || pkg) + "　" + txt;
    }
    var rec = __lcPkgPresets[pkg] || __lcPinOrderPresets[c.kind];
    var key = __lcPinOrderOf(c.pinOrder);
    if (!key) {
      if (rec) {
        var who = pkg ? (__lcPkgTitles[pkg] || pkg)
          : (__lcPkgTitles[c.kind] || "当前外形");
        txt += "　（未指定脚序，按 " + who + " 常见排布 " + rec.split("").join("-") +
          " 暂标，黄色；与实物不符就在上面换一种）";
      } else {
        txt += "　（未指定脚序，只显示脚号）";
      }
      return txt;
    }
    return txt + "　（" + key.split("").join("-") + "）";
  } catch (e) {
    return "";
  }
}

/* 标注颜色：有确切依据（网表 / 手选）用白，按常见排布暂标用暖黄。 */
function __lcPinInk(names) {
  return (names && names.__lcFrom === "preset") ? __lcPresetInk : 16777215;
}

/* ---------- 二极管 / LED 的负极（阴极 K）标记 ---------- */
/* 哪只脚是负极：网表给了 A/K 就按名字找；没给就按行业约定取脚 1。
 * KiCad、立创 EDA 的二极管与 LED 符号都是 pin1 = K、pin2 = A。
 * 注意导入器常把引脚名合成为 "1"/"2"，那种情况等同于没给名字。 */
function __lcCathodeIndex(names) {
  if (names && names.length) {
    for (var i = 0; i < names.length; i += 1) {
      var t = String(names[i] == null ? "" : names[i]).toUpperCase();
      if (t === "K" || t === "C") return i;
      if (t === "A") return i === 0 ? 1 : 0;
    }
  }
  return 0;
}
/* 按网络名取网络对象 */
function __lcNetByName(nm) {
  if (!nm) return null;
  try {
    var pj = window.__lcProject || {};
    var nets = (pj.importState && pj.importState.nets) || pj.nets || [];
    for (var i = 0; i < nets.length; i += 1) {
      if (String(nets[i].name) === String(nm)) return nets[i];
    }
  } catch (e) {}
  return null;
}
/* 该网络是不是「低到地」：本身就是 GND，或只隔一颗电阻就到 GND。
 * 后者是限流电阻接在 LED 负极侧的常见画法（本工程：10 颗 LED 的脚 2 并接后经 R5 到 GND）。 */
function __lcNetToGnd(net) {
  if (!net) return false;
  if (/GND|VSS|^0V$/i.test(String(net.name || ""))) return true;
  var nds = net.nodes || [];
  for (var i = 0; i < nds.length; i += 1) {
    var r = String(nds[i].ref || "");
    if (!/^R\d/i.test(r)) continue;
    var other = String(nds[i].pin) === "1" ? "2" : "1";
    var nm = __lcPinNetOf(r, other);
    if (nm && nm !== String(net.name) && /GND|VSS|^0V$/i.test(nm)) return true;
  }
  return false;
}
/* LED 的负极脚（0 基索引）：电路拓扑优先，引脚名兜底。
 * 为什么不能只看引脚名：立创部分 LED 符号的 C/A 名字与封装焊盘对不上。
 * 例：LED_TH-R_3mm 的 .enet 写 pin1 name=C，但该脚接的是 CD4017 的输出，
 * pin2 才是 10 颗 LED 共用、经 R5 到 GND 的一侧 —— 显然 pin2 才是负极。
 * 因此只在「一侧确定到 GND / 接电源、另一侧不是」这种可判定的情况下覆盖引脚名，
 * 两侧都判不出来时退回 __lcCathodeIndex（引脚名 → 脚号约定）。 */
function __lcLedCathodeIndex(ref, names, n) {
  try {
    if (n === 2 && ref) {
      var a = __lcNetByName(__lcPinNetOf(ref, 1));
      var b = __lcNetByName(__lcPinNetOf(ref, 2));
      var ga = __lcNetToGnd(a), gb = __lcNetToGnd(b);
      if (ga !== gb) return gb ? 1 : 0;
      var va = !!(a && /VCC|VDD|^\+/i.test(String(a.name || "")));
      var vb = !!(b && /VCC|VDD|^\+/i.test(String(b.name || "")));
      if (va !== vb) return va ? 1 : 0;
    }
  } catch (e) {}
  return __lcCathodeIndex(names);
}

/* 标记用的黑：纯黑（0x000000）在深色本体上会糊成一片，这里用近黑 + 一点金属度，
 * 靠圆柱面的高光和几何凸出的轮廓把「环」显出来。 */
function __lcInkBlack(rough) {
  return new Pe({ color: 0x0b0d0e, roughness: rough == null ? 0.5 : rough, metalness: 0.08 });
}
/* 黑环两侧的浅色细边：二极管本体本身就是深色（#1F2A2B），
 * 纯黑环会糊成一片，靠这两条银边把环的边界显出来。 */
function __lcInkEdge() {
  return new Pe({ color: 0x7c858c, roughness: 0.5, metalness: 0.3 });
}

/* 引脚字母用**方形** canvas。
 * 原来的 Un() 是给位号用的：canvas 256×64（4:1），Sprite 又按 scale.y = scale.x*0.25 压扁，
 * 于是 scale=0.46 时真正的字高只有 0.07 格 —— 贴在元件上就是三个白点，肉眼几乎看不见。
 * 这里改成 128×128、字号占 72%，同样的 scale 下字高有 0.36 格，和位号一个量级。 */
function __lcPinSprite(g, txt, x, y, z, color, size) {
  var cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  var h = cv.getContext("2d");
  if (!h) return;
  h.clearRect(0, 0, 128, 128);
  h.fillStyle = "#" + rR(color).toString(16).padStart(6, "0");
  h.font = "700 92px Segoe UI, Arial";
  h.textAlign = "center";
  h.textBaseline = "middle";
  h.lineJoin = "round";
  h.lineWidth = 8;
  h.strokeStyle = "rgba(8,12,18,0.6)";
  h.strokeText(txt, 64, 68);
  h.fillText(txt, 64, 68);
  var sp = new B0(new U0({ map: new Vf(cv), transparent: !0 }));
  sp.position.set(x, y, z);
  sp.scale.set(size, size, 1);
  sp.userData.__lcLabel = txt;
  g.add(sp);
}

/* 给任意封装的每个脚标字母。
 * 关键约束：字母要**贴在元件主体表面**上，不能悬在引脚上空。
 * 所以每个封装都按自己的形体给出「贴面高度 + 贴面深度」，而不是统一 y=1.02：
 *   TO-92              顶面 y≈1.64，x 夹在本体宽度内（引脚比本体宽）
 *   TO-220 / TO-247    正面（+Z 的大平面）z = 前面 + 0.015
 *   TO-39 / TO-3       金属盖顶面 y = 盖顶 + 0.03，沿引脚方向按比例内推
 * 这样从俯视看字母就落在本体上，不再漂在引脚旁边。 */
function __lcPinLetters(g, names, pts, cfg) {
  if (!g || !names || !pts || !pts.length) return;
  var o = cfg || {};
  var n = Math.min(names.length, pts.length);
  var col = __lcPinInk(names);
  var sc = o.scale == null ? 0.55 : o.scale;
  var y = o.y == null ? 1.02 : o.y;
  for (var i = 0; i < n; i += 1) {
    var nm = names[i] ? String(names[i]) : "";
    if (!nm) continue;
    var px = pts[i][0], pz = pts[i][1];
    var x = px, z = o.z == null ? pz : o.z;
    /* 圆形封装：沿引脚方向往中心收，避免字母跑到罐体外面 */
    if (o.k != null && o.cx != null && o.cz != null) {
      x = o.cx + (px - o.cx) * o.k;
      z = o.cz + (pz - o.cz) * o.k;
    }
    /* 本体比引脚跨度窄时（TO-92 : 本体 1.64、引脚跨度 2），把 x 夹进本体里 */
    if (o.span != null && o.cx != null) {
      x = Math.max(o.cx - o.span, Math.min(o.cx + o.span, x));
    }
    __lcPinSprite(g, nm, x, y, z, col, sc);
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
/* v3.4：只有「选择」模式才显示引脚网络提示框。
   走锡 / 跳线 / 删线时光标本来就在逐孔移动，提示框会盖住落点，属于纯干扰。 */
function __lcRouteIdle() {
  var m = window.__lcRouteMode;
  return !m || m === "select";
}
document.addEventListener("pointermove", function (ev) {
  if (window.__lcPicking) return;
  if (!__lcRouteIdle()) { __lcPinTipHide(); return; }
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
  if (!__lcRouteIdle()) return;
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

/* ------------------------------------------------------------------
 * v3.4.9：内测版标识
 * 这个 fork 是在上游 2.0.0 的压缩包上打补丁改出来的，功能没有经过完整验证，
 * 用户拿去焊板之前必须知道「软件可能是错的」。三处常驻 + 一次启动提示：
 *   1) 顶栏品牌名后面一枚红色「内测版」标签（见 apply_all.py Y1）
 *   2) 窗口标题带「内测版」（src/dist/index.html）
 *   3) 没有工程时的空面板上加一行红字
 *   4) 每次启动弹一条提示条 —— 提醒先导出工程留档再反馈
 * ------------------------------------------------------------------ */
__lcStyleOnce("lc-beta-style",
  ".lc-beta-badge{display:inline-block;margin-left:8px;padding:0 6px;border-radius:8px;" +
  "background:#c0392b;color:#fff;font-size:10px;font-weight:700;line-height:16px;" +
  "letter-spacing:.5px;vertical-align:middle;white-space:nowrap;" +
  "box-shadow:0 0 0 1px rgba(255,255,255,.22) inset}");

setTimeout(function () {
  try {
    if (!document.body) return;
    __lcToast("内测版：本软件仍在打磨，可能存在缺陷。遇到异常请先用「导出工程 JSON」留档再反馈。", 6000);
  } catch (e) {}
}, 1800);
