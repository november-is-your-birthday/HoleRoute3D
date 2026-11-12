# -*- coding: utf-8 -*-
"""Rebuild both bundles from pristine backups, applying fork patches in order:
  pristine (upstream v2.0.0 as shipped in the fork) -> v3.1 (dev_board + net editor) -> v3.2 (Multisim).
Usage:  python patches/apply_all.py [--check]
Every replacement asserts exactly one occurrence; aborts without writing on any mismatch."""
import io, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAIN = os.path.join(ROOT, 'src/dist/assets/index-C0NrTOjn.js')
WORKER = os.path.join(ROOT, 'src/dist/assets/autoPlacement.worker-CtyuXT3o.js')
PRISTINE_MAIN = os.path.join(HERE, 'pristine/index-C0NrTOjn.js.bak-lc31')
PRISTINE_WORKER = os.path.join(HERE, 'pristine/autoPlacement.worker-CtyuXT3o.js.bak-lc31')
P31 = os.path.join(HERE, 'patch_v31_main.js')
P32 = os.path.join(HERE, 'patch_multisim.js')
P33 = os.path.join(HERE, 'patch_v33_main.js')
CHECK_ONLY = '--check' in sys.argv

def rep(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit('FAIL %s: found %d occurrences (expected 1)' % (label, n))
    print('  ok', label)
    return text.replace(old, new)

def fn_span(text, sig):
    """定位 `sig` 开头、花括号配平的整段函数，返回 (start, end)。"""
    n = text.count(sig)
    if n != 1:
        raise SystemExit('FAIL sig %r: found %d occurrences (expected 1)' % (sig, n))
    i = text.index(sig)
    b = text.index('{', i)
    depth = 0
    for k in range(b, len(text)):
        ch = text[k]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return i, k + 1
    raise SystemExit('FAIL sig %r: unbalanced braces' % sig)

def rep_fn(text, sig, new, label):
    """按函数签名整段替换。比逐字拼长串安全，也不会误伤同名短符号。"""
    a, b = fn_span(text, sig)
    print('  ok', label)
    return text[:a] + new + text[b:]

src = io.open(PRISTINE_MAIN, encoding='utf-8').read()
wk = io.open(PRISTINE_WORKER, encoding='utf-8').read()
p31 = io.open(P31, encoding='utf-8').read().strip()
p32 = io.open(P32, encoding='utf-8').read().strip()
p33 = io.open(P33, encoding='utf-8').read().strip()

print('== v3.1 structural patches ==')
src = rep(src, 'v0=Wf("dip","dip_switch","seven_segment_display","alphanumeric_display")',
          'v0=Wf("dip","dip_switch","seven_segment_display","alphanumeric_display","dev_board")', 'M1 v0 set')
src = rep(src, 'const ge={min:1,max:1},w3={resistor:',
          'const ge={min:1,max:1},w3={dev_board:{leadSpacing:ge,rowSpacing:{min:3,max:8},sameSidePitch:ge},resistor:', 'M2 w3')
src = rep(src, 'const LP={resistor:', 'const LP={dev_board:i=>__lcDevBoard3D(i),resistor:', 'M3 LP builder')
src = rep(src, 'var __lcThumbCache={}', p31 + '\nvar __lcThumbCache={}', 'M4 code inject v3.1')
src = rep(src, 'window.__lcProject=i;return P.jsxs("div",{className:"app-shell"',
          'window.__lcProject=i,window.__lcCommit=H;return P.jsxs("div",{className:"app-shell"', 'M5 commit hook')
src = rep(src, 'window.__lcScene=K,window.__lcBoardArgs={board:i,transparent:b,theme:y};',
          'window.__lcScene=K,window.__lcBoardArgs={board:i,transparent:b,theme:y},window.__lcCamera=st,window.__lcCanvas=vt.domElement;', 'M6 camera hook')
src = rep(src, 's&&P.jsxs("section",{className:"pin-header-configurator","aria-label":"排针"',
          'P.jsx(LcFpPanel,{onPick:i,close:()=>e(!1)}),s&&P.jsxs("section",{className:"pin-header-configurator","aria-label":"排针"', 'M7 fp panel in I3')
src = rep(src, 'P.jsx(Z3,{project:i,onSelectNet:r})',
          'P.jsx(__lcNetPanel,{project:i,onSelectNet:r}),P.jsx(Z3,{project:i,onSelectNet:r})', 'M8 net panel in K3')
src = rep(src, 'f.kind!=="pin_header"&&f.kind!=="to92"&&f.kind!=="to39"&&f.kind!=="to220")return;',
          'f.kind!=="pin_header"&&f.kind!=="to92"&&f.kind!=="to39"&&f.kind!=="to220"&&f.kind!=="dev_board")return;', 'M9 inline whitelist')
wk = rep(wk, 'Ne=Z("dip","dip_switch","seven_segment_display","alphanumeric_display")',
         'Ne=Z("dip","dip_switch","seven_segment_display","alphanumeric_display","dev_board")', 'W1 worker Ne')
wk = rep(wk, 'a.kind!=="pin_header"&&a.kind!=="to92"&&a.kind!=="to39"&&a.kind!=="to220"',
         'a.kind!=="pin_header"&&a.kind!=="to92"&&a.kind!=="to39"&&a.kind!=="to220"&&a.kind!=="dev_board"', 'W2 worker whitelist')

print('== v3.2 Multisim patches ==')
src = rep(src, 'var __lcThumbCache={}', p32 + '\nvar __lcThumbCache={}', 'S1 code inject multisim')
src = rep(src, 'async function ZR(i){const t={components:[],nets:[],pinInfo:{},warnings:[]};for(const e of i){const s=__lcAdapt(await e.text());t4(t,e4(s,e.name))}return t}',
          'async function ZR(i){return __lcImportBatch(i)}', 'S2 ZR batch dispatcher')
src = rep(src, '{title:"网表 (.net)",accept:".net,.txt",onFiles:e}',
          '{title:"网表 / Multisim 报告",accept:".net,.txt,.csv,.cir",onFiles:e}', 'S3 drop-zone accept')
src = rep(src, 'function __lcClearPrev(){const g=__lcPG.current;if(!g)return;while(g.children.length){const c=g.children[0];g.remove(c),c.traverse&&c.traverse(o=>{o.geometry&&o.geometry.dispose&&o.geometry.dispose()})}}',
          'function __lcClearPrev(){const g=__lcPG.current;if(!g)return;while(g.children.length){const c=g.children[0];g.remove(c),c.traverse&&c.traverse(o=>{o.geometry&&o.geometry.dispose&&o.geometry.dispose();const mt=o.material;if(mt&&!(mt.userData&&mt.userData.shared)){mt.map&&mt.map.dispose&&mt.map.dispose(),mt.dispose&&mt.dispose()}})}}', 'S4 ghost dispose materials')

# v3.2.2: 电解电容识别增强（嘉立创导出的 C_Ele_SMD / 1uF 等真实信号）。
# __lcProtel 有两处 C 分支（精确前缀 + 首字母兜底），__lcClass 有一处压缩分支，判别词统一扩为：
#   CP / POLAR / 电解（原有）+ ELE / TANT / RADIAL / RB<数字或点>（封装证据）
#   + 值含 uF 且封装不是贴片尺寸（0402/0603/0805/1206/1210/2010/2512）
ELE_NEG = '/CBB|FILM|MLCC|涤纶|薄膜|独石|陶瓷|NP0|NPO|X7R|X5R|C0G/'
ELE_TEST_SP = ('(!' + ELE_NEG + '.test(b)) && (b.indexOf("CP") >= 0 || b.indexOf("POLAR") >= 0 '
               '|| b.indexOf("电解") >= 0 || /ELE|TANT|RADIAL|RB[\\d.]/.test(b) '
               '|| (/\\d\\s*[UΜμ]F/.test(b) && !/(0402|0603|0805|1206|1210|2010|2512)/.test(b)))')
ELE_TEST_MIN = ('(!' + ELE_NEG + '.test(b))&&(b.indexOf("CP")>=0||b.indexOf("POLAR")>=0'
                '||b.indexOf("电解")>=0||/ELE|TANT|RADIAL|RB[\\d.]/.test(b)'
                '||(/\\d\\s*[UΜμ]F/.test(b)&&!/(0402|0603|0805|1206|1210|2010|2512)/.test(b)))')
src = rep(src, 'if (p === "C") return (b.indexOf("CP") >= 0 || b.indexOf("POLAR") >= 0 || b.indexOf("电解") >= 0) ? ["Device", "CP"] : ["Device", "C"];',
          'if (p === "C") return (' + ELE_TEST_SP + ') ? ["Device", "CP"] : ["Device", "C"];', 'S5 protel exact-C electrolytic')
src = rep(src, 'if (p.charAt(0) === "C") return (b.indexOf("CP") >= 0 || b.indexOf("POLAR") >= 0 || b.indexOf("电解") >= 0) ? ["Device", "CP"] : ["Device", "C"];',
          'if (p.charAt(0) === "C") return (' + ELE_TEST_SP + ') ? ["Device", "CP"] : ["Device", "C"];', 'S6 protel fallback-C electrolytic')
src = rep(src, '(b.indexOf("CP")>=0||b.indexOf("POLAR")>=0||b.indexOf("电解")>=0)?"Device:CP":"Device:C"',
          '(' + ELE_TEST_MIN + ')?"Device:CP":"Device:C"', 'S7 lcClass electrolytic')

# v3.2.3: 嘉立创导出按键/开关的字母脚（SW1-A/SW1-B）+ 轻触按键分类 + 工具栏透视按钮
src = rep(src, 'var mm = tok.match(/^(.+)-(\\d+)$/);',
          'var mm = tok.match(/^(.+)-([0-9A-Za-z]+)$/);', 'S8a protel letter pins in nets')
S8B_OLD = '''  function pinsOf(ref) {
    var o = pinMap[ref] || { "1": 1, "2": 1 };
    return Object.keys(o).map(Number).sort(function (a, b) { return a - b; });
  }'''
S8B_NEW = '''  var pinNumMaps = {};
  function pinNumMapOf(ref) {
    var m = pinNumMaps[ref];
    if (m) return m;
    var o = pinMap[ref] || { "1": 1, "2": 1 };
    var nums = [], words = [];
    Object.keys(o).forEach(function (p) {
      if (/^\\d+$/.test(p)) nums.push(Number(p)); else words.push(p);
    });
    nums.sort(function (a, b) { return a - b; });
    words.sort(function (a, b) { return a.localeCompare(b, void 0, { numeric: true }); });
    m = {};
    var next = 1;
    nums.forEach(function (x) { m[String(x)] = String(x); if (x >= next) next = x + 1; });
    words.forEach(function (w) { m[w] = String(next); next += 1; });
    pinNumMaps[ref] = m;
    return m;
  }
  function pinsOf(ref) {
    var m = pinNumMapOf(ref);
    return Object.keys(m).map(function (k) { return Number(m[k]); }).sort(function (a, b) { return a - b; });
  }'''
src = rep(src, S8B_OLD, S8B_NEW, 'S8b protel pin renumber map')
src = rep(src, """      out.push('      (node (ref "' + __lcEsc(nd.ref) + '") (pin "' + __lcEsc(nd.pin) + '"))');""",
          """      var mpin = pinNumMapOf(nd.ref)[nd.pin] || nd.pin;
      out.push('      (node (ref "' + __lcEsc(nd.ref) + '") (pin "' + __lcEsc(mpin) + '"))');""", 'S8c protel node pin mapping')
src = rep(src, 'if (p === "SW" || p === "KEY") return ["Switch", "SW_SPDT"];',
          'if (p === "SW" || p === "KEY") return (b.indexOf("KEY") >= 0 || b.indexOf("TACT") >= 0 || b.indexOf("PUSH") >= 0 || b.indexOf("BUTTON") >= 0 || b.indexOf("轻触") >= 0) ? ["Button", "SW_Push"] : ["Switch", "SW_SPDT"];', 'S9 protel KEY -> tactile button')
src = rep(src, 'children:"飞线"})]})',
          'children:"飞线"}),P.jsx($n,{active:v,"aria-label":"透视板体，快捷键 T",title:"透视板体：透过板体查看背面走线（快捷键 T）",onClick:w,children:"透视"})]})', 'S10 toolbar xray button')
src = rep(src, 'if(b.indexOf("PUSH")>=0||b.indexOf("TACT")>=0||b.indexOf("轻触")>=0||b.indexOf("BUTTON")>=0)return"Button:SW_Push";return"Switch:SW_SPDT"',
          'if(b.indexOf("PUSH")>=0||b.indexOf("TACT")>=0||b.indexOf("KEY")>=0||b.indexOf("轻触")>=0||b.indexOf("BUTTON")>=0)return"Button:SW_Push";return"Switch:SW_SPDT"', 'S11 lcClass KEY evidence')

# v3.2.5: 立创/嘉立创 Protel 网表按封装名补全引脚数。
# 根因：Protel 网表没有 libparts 段，__lcProtel 只能用网表节点合成 libpart，
# 于是「8 脚芯片只连了 1、2 脚」会被合成为 2 脚 DIP（3D 模型、脚距、DRC 全按 2 脚算）。
# 修法：只对 IC 类位号（U / IC / A）+ IC 封装族（DIP / SOIC / QFN / LQFP …）从封装名提取脚数，
# 取 max(最大已连脚号, 封装脚数) 作为声明脚数；DIP 的 part 名带脚数，避免 DIP8 与 DIP14
# 共用同一个 libpart 被并集放大。
PKG_FN = '''  /* 从封装名推断引脚数：立创/嘉立创的 Protel 网表不带 libparts，只看网表节点会低估脚数。 */
  function pkgPinCount(fp, prefix) {
    var s = String(fp || "").toUpperCase();
    if (!s || (prefix !== "U" && prefix !== "IC" && prefix !== "A")) return 0;
    var m = s.match(/(?:PDIP|SDIP|DIP|TSSOP|SSOP|MSOP|SOIC|SOP|VQFN|WQFN|QFN|DFN|LQFP|TQFP)[-_ ]?P?[-_ ]?(\\d+)/)
      || s.match(/\\b(\\d+)[-_ ]?(?:DIP|PDIP|SOIC|SOP|QFN|DFN|LQFP|TQFP)\\b/)
      || s.match(/(\\d+)\\s*(?:PIN|PINS|PINOUT)\\b/);
    if (!m) return 0;
    var n = Number(m[1]);
    return n >= 4 && n <= 64 ? n : 0;
  }
'''
src = rep(src, '  function libPart(c) {', PKG_FN + '  function libPart(c) {', 'S12 pkgPinCount helper')
src = rep(src, '    var n = pinsOf(c.ref).length;\n    var pad = n < 10 ? "0" + n : "" + n;',
          '    var pinList = pinsOf(c.ref);\n'
          '    var maxPin = 0;\n'
          '    pinList.forEach(function (x) { if (x > maxPin) maxPin = x; });\n'
          '    var n = Math.max(maxPin, pkgPinCount(c.footprint, p));\n'
          '    c.__lcPins = n;\n'
          '    var pad = n < 10 ? "0" + n : "" + n;', 'S13 declared pin count')
src = rep(src, '    if (p === "U" || p === "IC") return ["Socket", "DIP"];',
          '    if (p === "U" || p === "IC") return ["Socket", n === 8 ? "DIP" : "DIP" + n];',
          'S14 DIP part name carries pin count')
src = rep(src, '    pinsOf(c.ref).forEach(function (p) { libparts[key].pins[p] = 1; });',
          '    pinsOf(c.ref).forEach(function (p) { libparts[key].pins[p] = 1; });\n'
          '    for (var q = 1; q <= (c.__lcPins || 0); q += 1) libparts[key].pins[q] = 1;',
          'S15 fill declared pins into libpart')

# ================= v3.3.0 =================
print('== v3.3 shared helpers ==')
src = rep(src, 'var __lcThumbCache={}', p33 + '\nvar __lcThumbCache={}', 'T1 code inject v3.3')

# v3.3: 透视模式（X-ray）看不到对面走线。
# 根因不是透明度：MR() 每帧按相机高度把 reverse 侧的走线组整组 visible=false。
# 透视时两侧都放出来，飞线也一并可见；同时把走线材质的 depthTest 打开，
# 让线被元件正确遮挡，而不是穿透一切。
XRAY_FLAG = 'var xr=!!(window.__lcBoardArgs&&window.__lcBoardArgs.transparent);'
src = rep_fn(src, 'function MR(',
             'function MR(i,t,e){' + XRAY_FLAG +
             'const s=t.position.y>=e.y;'
             'i.children.forEach(r=>{const l=r.userData.routeSide;'
             '(l==="top"||l==="bottom")&&(r.visible=xr||l===(s?"top":"bottom"))});'
             'var g=window.__lcRats;g&&g.parent&&(g.visible=!!window.__lcRatsOn&&(!s||xr))}',
             'X1 MR xray visibility')
src = rep_fn(src, 'function $p(',
             'function $p(i=AR){' + XRAY_FLAG +
             'return{outline:new qi({color:1515819,depthTest:!xr,depthWrite:!1}),'
             'halo:new qi({color:16777215,depthTest:!xr,depthWrite:!1}),'
             'core:new qi({color:i,depthTest:!xr,depthWrite:!1}),'
             'endpoint:new qi({color:i,depthTest:!xr,depthWrite:!1})}}',
             'X2 trace material depth test')
src = rep(src, 'return d.castShadow=!0,d.receiveShadow=!0,s.add(d)',
          'return d.castShadow=!t,d.receiveShadow=!0,s.add(d)', 'X3 board shadow off when xray')

# v3.3: 擦除模式删不掉跳线。
# 根因：Lt() 只用孔坐标严格相等判定（om），而点击坐标永远是「屏幕射线 → 板平面 → 取整孔」，
# 所以只有点到跳线两端那两个孔才删得掉；点拱起的弧线本身得到的是弧下方的孔，永远不匹配，
# 而且静默无任何提示。跳线 mesh 也不带 userData，射线命中根本无法识别。
# 修法：给跳线打 __lcJumperId 标记 + 射线按 id 命中 + 孔位优先、id 兜底 + 删不到时提示。
src = rep(src, 'i.jumpers.forEach((f,h)=>{l.add(RR(f.from,f.to,t,$p(16762967),c[h]))})',
          'i.jumpers.forEach((f,h)=>{const jg=RR(f.from,f.to,t,$p(16762967),c[h]);__lcTagJumper(jg,f);l.add(jg)})',
          'E1 tag jumper meshes')
src = rep_fn(src, 'function Lt(Q){',
             'function Lt(Q,jumperId){'
             'var pj=window.__lcProject,rt=(pj&&pj.routing)||{};'
             'var jid=jumperId!=null?String(jumperId):"";'
             'var jumpers=rt.jumpers||[];'
             'var hitHole=!1;'
             'jumpers.forEach(function(j){if(!hitHole&&((j.from&&om(j.from,Q))||(j.to&&om(j.to,Q))))hitHole=!0});'
             'var at=ZO(rt.traces||[],Q);'
             'var byHole=hitHole||at.removed;'
             'var hitId=!!jid&&jumpers.some(function(j){return String(j.id)===jid});'
             'if(!byHole&&!hitId)return!1;'
             'H(function(cur){'
             'var keep=(cur.routing.jumpers||[]).filter(function(j){'
             'if(byHole)return!((j.from&&om(j.from,Q))||(j.to&&om(j.to,Q)));'
             'return String(j.id)!==jid});'
             'var ct=ZO(cur.routing.traces||[],Q);'
             'return{...cur,routing:{...cur.routing,traces:ct.traces,jumpers:keep}}});'
             'return!0}',
             'E2 Lt erase accepts jumper id')
src = rep(src, 'te&&M?.(te)', 'te&&M?.(te,__lcPickJumper(K))', 'E3 pointerup passes jumper hit')
src = rep(src, 'function Ut(Q){if(M){ht(M,Q)&&O(void 0);return}',
          'function Ut(Q,J){if(M){ht(M,Q)&&O(void 0);return}', 'E4 erase entry signature')
src = rep(src, 'if(y==="erase"){Lt(Q),w(void 0);return}',
          'if(y==="erase"){Lt(Q,J)||__lcToast("此处没有可删除的走锡或跳线（跳线请点拱起的弧线本身）"),w(void 0);return}',
          'E5 erase miss feedback')

# ---------------------------------------------------------------
# v3.3: Ctrl 多选 + 组合操作（旋转 / 拔起 / 放置 / 删除 / 移动）
# 选择模型：主选中仍是单值 f（大量代码在读它），另用 window.__lcSelIds 维护集合，
# 主选中恒等于集合最后一个，任何增删都会改变主选中 → 现有 effect 自然会重绘高亮。
# ---------------------------------------------------------------
src = rep(src, '[f,h]=qt.useState(),[d,g]=qt.useState(Q2)',
          '[f,h]=qt.useState(),[__lcSelArr,__lcSelSet]=qt.useState([]),[d,g]=qt.useState(Q2)',
          'M0 selection set state')
SEL_HELPERS = '''function __lcSelIdsOf(fallback){var a=window.__lcSelIds;return a&&a.length?a.slice():fallback?[fallback]:[]}
function __lcAfterTransform(p,comps){
  var anyMounted=!1;
  comps.forEach(function(c){if(c&&c.mounted)anyMounted=!0});
  if(!anyMounted)return p;
  var rt=p.routing||{};
  return{...p,routing:{...rt,drc:void 0,diagnostics:void 0,
    warnings:(rt.warnings||[]).filter(function(x){return String(x).indexOf("引脚位置已改变")<0})
      .concat(["所选元件的引脚位置已改变：原走锡 / 跳线还在旧孔上，请重跑 DRC 或重新布线。"])}}
}
'''
NEW_TT = '''function Tt(Q,add){
  R(function(rt){return rt&&rt.componentId!==Q?void 0:rt});
  var prev=window.__lcSelIds||[];
  var next;
  if(!Q)next=[];
  else if(!add)next=[Q];
  else next=prev.indexOf(Q)>=0?prev.filter(function(x){return x!==Q}):prev.concat([Q]);
  window.__lcSelIds=next;
  __lcSelSet(next);
  var primary=next.length?next[next.length-1]:void 0;
  h(primary);
}
function __lcSelClear(){window.__lcSelIds=[];__lcSelSet([]);h(void 0)}
'''
src = rep_fn(src, 'function Tt(Q){',
             SEL_HELPERS + NEW_TT,
             'M1 multi-select entry')

NEW_GT = '''function __lcRotateSpace(){
  var ids=__lcSelIdsOf(f);
  if(!ids.length){__lcToast("先选中要旋转的元件");return}
  var pj=window.__lcProject||{},comps=pj.components||[],onBoard=[];
  ids.forEach(function(id){
    var c=null;
    for(var k=0;k<comps.length;k+=1)if(comps[k].id===id){c=comps[k];break}
    if(c&&c.mounted)onBoard.push(c.name);
  });
  if(onBoard.length){__lcToast("元件还在板上（"+onBoard.slice(0,3).join("、")+(onBoard.length>3?" 等":"")+"）：先拔起（U）再按空格旋转");return}
  Gt(-1);
}
function Gt(cw){
  var ids=__lcSelIdsOf(f);
  if(!ids.length)return;
  var d=cw===-1?-Math.PI/2:Math.PI/2;
  H(function(p){
    var touched=[];
    var comps=p.components.map(function(c){
      if(ids.indexOf(c.id)<0)return c;
      touched.push(c);
      return{...c,rotation:c.rotation+d}});
    if(!touched.length)return p;
    return __lcAfterTransform({...p,components:comps},touched);
  })
}
function __lcMountAll(to){
  var ids=__lcSelIdsOf(f);
  if(!ids.length)return;
  H(function(p){
    var n=0;
    var comps=p.components.map(function(c){
      if(ids.indexOf(c.id)<0)return c;
      if(!!c.mounted===!!to)return c;
      n+=1;
      return{...c,mounted:!!to}});
    if(!n)return p;
    if(to)return{...p,components:comps};
    var rt=p.routing||{};
    var msg="已拔起 "+n+" 个元件：原孔位上的走锡 / 跳线仍保留，重新放置后请重跑 DRC。";
    return{...p,components:comps,routing:{...rt,drc:void 0,diagnostics:void 0,
      warnings:(rt.warnings||[]).filter(function(x){return String(x).indexOf("已拔起")<0}).concat([msg])}};
  })
}
function __lcUnmountAll(){
  var pj=window.__lcProject||{},comps=pj.components||[];
  var onBoard=comps.filter(function(c){return c.mounted});
  if(!onBoard.length){__lcToast("板上没有已放置的元件");return}
  var rt=pj.routing||{};
  var hasCopper=(rt.traces||[]).length+(rt.jumpers||[]).length>0;
  if(hasCopper&&!window.confirm("即将一次拔起 "+onBoard.length+" 个元件。\\n原孔位上的走锡 / 跳线会保留（不会自动清除），重新放置后需要重跑 DRC。\\n\\n继续？"))return;
  H(function(p){
    var n=0;
    var next=p.components.map(function(c){
      if(!c.mounted)return c;
      n+=1;
      return{...c,mounted:!1}});
    if(!n)return p;
    var r=p.routing||{};
    var msg="已拔起 "+n+" 个元件：原孔位上的走锡 / 跳线仍保留，重新放置后请重跑 DRC。";
    return{...p,components:next,routing:{...r,drc:void 0,diagnostics:void 0,
      warnings:(r.warnings||[]).filter(function(x){return String(x).indexOf("已拔起")<0}).concat([msg])}};
  });
}
'''
src = rep_fn(src, 'function Gt(cw)', NEW_GT, 'M2 group rotate + space rotate + unmount all')

src = rep_fn(src, 'function _t(){f&&',
             'function _t(){__lcMountAll(!0)}', 'M3 group mount')
src = rep_fn(src, 'function xt(){f&&',
             'function xt(){__lcMountAll(!1)}', 'M4 group unmount')

NEW_XT = '''function Xt(){
  var ids=__lcSelIdsOf(f);
  if(!ids.length)return;
  H(function(p){
    var gone=p.components.filter(function(c){return ids.indexOf(c.id)>=0});
    if(!gone.length)return p;
    var holes=[];
    gone.forEach(function(c){c.pinOffsets.forEach(function(_,i){holes.push(Si(c,i+1))})});
    var rest=p.components.filter(function(c){return ids.indexOf(c.id)<0});
    var keep=rest.flatMap(function(c){return c.pinOffsets.map(function(_,i){return Si(c,i+1)})});
    return{...p,components:rest,routing:BO(p.routing,holes,keep)};
  });
  __lcSelClear();
}
'''
src = rep_fn(src, 'function Xt(){f&&', NEW_XT, 'M5 group delete')

NEW_Z = '''function z(Q,rt){
  var ids=__lcSelIdsOf(Q);
  H(function(p){
    var me0=null;
    for(var k=0;k<p.components.length;k+=1)if(p.components[k].id===Q){me0=p.components[k];break}
    if(!me0)return p;
    var dx=Math.round(rt[0]-me0.position[0]),dy=Math.round(rt[1]-me0.position[1]);
    if(!dx&&!dy)return p;
    var touched=[];
    var comps=p.components.map(function(c){
      if(c.id!==Q&&ids.indexOf(c.id)<0)return c;
      touched.push(c);
      return{...c,position:[c.position[0]+dx,c.position[1]+dy]}});
    return __lcAfterTransform({...p,components:comps},touched);
  })
}
'''
src = rep_fn(src, 'function z(Q,rt){', NEW_Z, 'M6 group move')

# v3.3: 撤销步数上限 50 → 可配置（默认 200）+ 重做栈
src = rep(src, 'v.current=[...v.current.slice(-49),rt],S(v.current.length),G(Ft)',
          'v.current=[...v.current.slice(-(__lcHistoryLimit()-1)),rt],window.__lcRedo=[],S(v.current.length),G(Ft)',
          'H1 history limit + redo reset')
src = rep_fn(src, 'function xe(){',
             'function xe(){'
             'const Q=v.current.at(-1);'
             'if(!Q)return;'
             '(window.__lcRedo||(window.__lcRedo=[])).push(e.current);'
             'v.current=v.current.slice(0,-1),S(v.current.length),G(Q),h(void 0)}'
             'function __lcRedoStep(){'
             'var st=window.__lcRedo||[];'
             'var Q=st.pop();'
             'if(!Q)return!1;'
             'v.current=[...v.current,e.current].slice(-__lcHistoryLimit()),S(v.current.length),G(Q),h(void 0);'
             'return!0}',
             'H2 redo stack')
src = rep(src, 'erase:"E"},Q2={dragMoveModifier:"shift",shortcuts:Vy,theme:"light"}',
          'erase:"E",unmountAll:"Shift+U",rotateSpace:"Space",undo:"Ctrl+Z",redo:"Ctrl+Shift+Z"},'
          'Q2={dragMoveModifier:"shift",shortcuts:Vy,theme:"light"}',
          'H3 default shortcuts')
src = rep(src, 'ri(d.shortcuts.delete,!!j,Xt),',
          'ri(d.shortcuts.delete,!!j,Xt),'
          'ri(d.shortcuts.unmountAll,gt,__lcUnmountAll),'
          'ri(d.shortcuts.rotateSpace,!0,__lcRotateSpace),'
          'ri(d.shortcuts.undo,!!_,xe),'
          'ri(d.shortcuts.redo,!0,__lcRedoStep),',
          'H4 register new shortcuts')

# v3.3: 多选高亮（主选中之外的选中项也画环）
src = rep(src, '}),c.id===e){const h=new Vt(new Rr(.4,.5,36)',
          '}),c.id===e||(window.__lcSelIds||[]).indexOf(c.id)>=0){const h=new Vt(new Rr(.4,.5,36)',
          'M7 multi-select highlight')
# 点击时把 Ctrl / Cmd 带进选择入口
src = rep(src, 'r(Tt?void 0:st.componentId),l(st);return',
          'r(Tt?void 0:st.componentId,Tt?!1:(K.ctrlKey||K.metaKey)),l(st);return',
          'M8 ctrl click on pin')
src = rep(src, 'ht&&(K.currentTarget.setPointerCapture(K.pointerId),xe(!1)),r(vt),l(void 0)',
          'ht&&(K.currentTarget.setPointerCapture(K.pointerId),xe(!1)),r(vt,K.ctrlKey||K.metaKey),l(void 0)',
          'M9 ctrl click on component')

# v3.3: 工具栏「全部拔起」
src = rep(src, 'children:"继续布线"})]})',
          'children:"继续布线"})]})'
          ',P.jsxs(Hl,{label:"",openMenu:h,onOpenMenu:d,children:['
          'P.jsx($n,{disabled:!r,title:"把板上所有元件一次拔起（保留已布的走锡 / 跳线）",'
          'onClick:function(){window.__lcUnmountAll&&window.__lcUnmountAll()},children:"全部拔起"})]})',
          'M10 toolbar unmount-all button')

# v3.3: 术语统一 —— 「移除」→「拔起」；网络面板的「拾取」→「点选引脚」
src = rep(src, 'disabled:!le(),onClick:()=>{_(),G(void 0)},children:"移除"',
          'disabled:!le(),onClick:()=>{_(),G(void 0)},children:"拔起"', 'N1 menu unmount label')
src = rep(src, '{action:"unmount",label:"移除所选"}',
          '{action:"unmount",label:"拔起所选"},'
          '{action:"unmountAll",label:"全部拔起"},'
          '{action:"rotateSpace",label:"旋转所选（空格·顺时针）"},'
          '{action:"undo",label:"撤销"},'
          '{action:"redo",label:"重做"}',
          'N2 settings labels')
src = rep(src, 'O.mounted?"已放置":"未放置"', 'O.mounted?"已在板上":"已拔起"', 'N3 status wording')
src = rep(src, 'children:picking?"停止":"拾取"', 'children:picking?"停止":"点选引脚"', 'N4 net panel button')
src = rep(src, 'children:"空网络：点「拾取」后直接点板上引脚加入"',
          'children:"空网络：点「点选引脚」后直接点板上引脚加入"', 'N5 empty net hint')

# ---------------------------------------------------------------
# v3.3: 继续布线（Continue route）
# 实测（3.2.5）：继续布线后 5 条手工跳线（net === "MANUAL"）全部消失，被 10 条新建跳线取代。
# 根因：Y4() 的第 7 参 jumpers 只在面包板分支（q4）里被使用，洞洞板分支完全不读，
# 于是「保留已有走锡 / 跳线」这条 README 承诺只兑现了走锡那一半。
# 修法：在 __lcContinuePlan 之后合并新旧跳线（按 net+from+to 去重），并给出结果反馈。
# 注意：飞线的并查集保持「按铜是否实际连通」的语义（harness/rats-check.js 用例5 明确要求），
# 不做按网络隔离——否则会把「已被别的网络铜箔短接的引脚」重新画上飞线，与物理事实相悖。
# 「继续布线后飞线消失」的真实成因是：走锡画在板子背面，而顶部视角下 MR() 隐藏整个背面走线组，
# 用户只看到飞线消失、看不到新增的铜箔；该问题由 X1（透视放开两侧走线）一并解决。
# ---------------------------------------------------------------
NEW_CONT = '''function __lcContinueRoute(){H(Q=>{try{
  var eps=Io(Q.importState,Q.components);
  if(!eps.length)return Q;
  var oldJ=(Q.routing&&Q.routing.jumpers)||[];
  var pl=__lcContinuePlan(Q.board,eps,Q.components,Q.routing.traces||[],oldJ,Er(Q));
  if(!pl)return{...Q,routing:{...Q.routing,warnings:[...Q.routing.warnings,"所有网络均已连通，无需继续布线。"]}};
  var Zt=f4(pl,Er(Q));
  /* 洞洞板分支下 Y4() 只会新建跳线、不会保留旧的（第 7 参只在面包板用），必须在这里合并 */
  var seen={},merged=[];
  oldJ.forEach(function(j){if(!j)return;var k=String(j.net)+"|"+j.from+"|"+j.to;if(seen[k])return;seen[k]=1;merged.push(j)});
  (Zt.jumpers||[]).forEach(function(j){if(!j)return;var k=String(j.net)+"|"+j.from+"|"+j.to;if(seen[k])return;seen[k]=1;merged.push(j)});
  var newTrace=(Zt.traces||[]).length-(Q.routing.traces||[]).length;
  var newJump=merged.length-oldJ.length;
  var failed=(Zt.failedNets||[]).length;
  var msg=failed===0
    ?"继续布线：新增走锡 "+Math.max(0,newTrace)+" 段、跳线 "+Math.max(0,newJump)+" 条；全部网络已连通（走锡在板背面，按 T 透视可见）。"
    :"继续布线：新增走锡 "+Math.max(0,newTrace)+" 段、跳线 "+Math.max(0,newJump)+" 条；仍有 "+failed+" 个网络未连通，已用飞线标出。";
  setTimeout(function(){__lcToast(msg,4600)},120);
  return{...Q,routing:{...Zt,jumpers:merged,
    warnings:(Zt.warnings||[]).filter(function(x){return String(x).indexOf("继续布线：")<0}).concat([msg])}};
}catch(err){return{...Q,routing:{...Q.routing,warnings:[...Q.routing.warnings,"继续布线失败："+(err&&err.message?err.message:String(err))]}}}})}'''
src = rep_fn(src, 'function __lcContinueRoute(){', NEW_CONT, 'R8 continue route keeps jumpers')

# ---------------------------------------------------------------
# v3.3: 三极管 E/C/B、LED A/K 的 3D 标注 + 属性面板脚序下拉
# 3D 里此前只画类别前缀（"Q" / "LED"），引脚位置全靠数孔，三极管极易接反。
# 引脚名优先级：网表 pinInfo > 手选脚序（属性面板）> 仅显示 1/2/3（不猜极性）。
# ---------------------------------------------------------------
src = rep(src, 'OP({kind:c.kind,label:c.label,pinCount:c.pinCount,pinOffsets:c.pinOffsets,isFallback:c.isFallback})',
          'OP({kind:c.kind,label:c.label,pinCount:c.pinCount,pinOffsets:c.pinOffsets,isFallback:c.isFallback,'
          'pinNames:__lcPinNamesOf(c)})',
          'P1 pass pin names into builder')
src = rep(src, 'to92:i=>GP(i.label??"Q",hn(i))', 'to92:i=>GP(i.label??"Q",hn(i),i.pinNames)', 'P2 to92 pin names')
src = rep(src, 'led:i=>UP(i.color??15220543,hn(i))', 'led:i=>UP(i.color??15220543,hn(i),i.pinNames)', 'P3 led pin names')

NEW_GP = '''function GP(i,t,names){
  const e=new Re,s=W0(t),r=new qx;
  r.moveTo(-.82,-.26),r.lineTo(.82,-.26),r.absarc(0,-.26,.82,0,Math.PI,!1),r.lineTo(-.82,-.26);
  const l=new H0(r,{depth:.52,bevelEnabled:!0,bevelThickness:.04,bevelSize:.04,bevelSegments:3});l.center();
  const c=new Vt(l,Ne.blackPlastic);c.rotation.x=-Math.PI/2,c.position.set(s[0],1.38,s[1]),e.add(c);
  const f=.82;
  t.forEach(function(pr,idx){
    const h=pr[0],d=pr[1];
    if(Math.abs(h-s[0])>f-.04){const g=s[0]+Math.sign(h-s[0])*(f-.04);Ii(e,[g,d],[h,d],1.12)}
    bn(e,h,d,1.16);
    const nm=names&&names[idx]?String(names[idx]):"";
    if(nm)Un(e,nm,h,1.02,d+.52,16777215,.62)
  });
  Un(e,i,s[0],2,s[1]+.48,4194258,1.8);
  return e
}'''
src = rep_fn(src, 'function GP(i,t){const e=new Re,s=W0(t)', NEW_GP, 'P4 to92 E/C/B labels')

NEW_UP = '''function UP(i,t,names){
  const e=new Re,[s,r]=Qa(t),l=(s[0]+r[0])/2,c=(s[1]+r[1])/2,
    f=new Pe({color:i,roughness:.12,transparent:!0,opacity:.72}),
    h=new Vt(new Ki(.72,28,16),f);h.scale.y=.85,h.position.set(l,1.65,c),e.add(h);
  const d=new Vt(new ze(.74,.74,.24,28),f);d.position.set(l,.98,c),e.add(d);
  Y0(e,[s,r],[l,c],.74,.88,.98);
  if(t.length>=2){
    const kx=s[0]+(r[0]-s[0])*.22,kz=s[1]+(r[1]-s[1])*.22;
    const bar=new Vt(new on(.09,.05,.46),new qi({color:16777215}));
    bar.position.set(kx,1.02,kz),bar.userData.__lcLedBar=1,e.add(bar)
  }
  t.forEach(function(pr,idx){
    const nm=names&&names[idx]?String(names[idx]):"";
    if(nm)Un(e,nm,pr[0],1.05,pr[1]+.52,16777215,.62)
  });
  return e
}'''
src = rep_fn(src, 'function UP(i,t){const e=new Re,[s,r]=Qa(t)', NEW_UP, 'P5 led A/K labels + cathode bar')

PIN_ORDER_SELECT = ('P.jsxs("label",{children:[P.jsx("span",{children:"三极管脚序"}),'
                    'P.jsx("select",{value:O.pinOrder||"",onChange:T=>v({pinOrder:T.target.value||void 0}),children:['
                    'P.jsx("option",{value:"",children:"未指定（显示 1/2/3）"}),'
                    'P.jsx("option",{value:"EBC",children:"1=E 2=B 3=C（E-B-C）"}),'
                    'P.jsx("option",{value:"CBE",children:"1=C 2=B 3=E（C-B-E）"}),'
                    'P.jsx("option",{value:"BCE",children:"1=B 2=C 3=E（B-C-E）"})]})]}),')
src = rep(src, 'onChange:T=>v({value:T.target.value})})]}),',
          'onChange:T=>v({value:T.target.value})})]}),'
          '["to92","to220","to3","to247","to39"].indexOf(O.kind)>=0&&' + PIN_ORDER_SELECT,
          'P6 pin order select in inspector')

src = rep(src, 'window.__lcProject=i,window.__lcCommit=H;return P.jsxs("div",{className:"app-shell"',
          'window.__lcProject=i,window.__lcCommit=H,window.__lcUnmountAll=__lcUnmountAll;return P.jsxs("div",{className:"app-shell"',
          'M11 expose unmount-all to toolbar')

if CHECK_ONLY:
    print('check only, not written')
    raise SystemExit(0)
shutil.copyfile(MAIN, MAIN + '.prev')
shutil.copyfile(WORKER, WORKER + '.prev')
io.open(MAIN, 'w', encoding='utf-8', newline='').write(src)
io.open(WORKER, 'w', encoding='utf-8', newline='').write(wk)
print('OK main %d chars, worker %d chars' % (len(src), len(wk)))
