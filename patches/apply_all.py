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
P34 = os.path.join(HERE, 'patch_v34_main.js')
CHECK_ONLY = '--check' in sys.argv
# 排障用：LC_SKIP="U4,U9" 可临时跳过指定补丁（不改变最终产物以外的任何行为）
SKIP = set(x for x in os.environ.get('LC_SKIP', '').split(',') if x)

def rep(text, old, new, label):
    if any(label.split(' ')[0] == s for s in SKIP):
        print('  skip', label)
        return text
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
p34 = io.open(P34, encoding='utf-8').read().strip()

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
          'window.__lcScene=K,window.__lcBoardArgs={board:i,transparent:b,theme:y},window.__lcCamera=st,'
          'window.__lcCanvas=vt.domElement,window.__lcControls=vt;', 'M6 camera hook')
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
  else if(add==="keep")next=prev.indexOf(Q)>=0?prev.slice():prev.concat([Q]);
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

# v3.3.1：拖动被 !mounted 硬锁，用户多选后按 Shift 拖板上元件毫无反应（必须先 U 拔起）。
# 原软件对单个元件也是这样限制的，但既然多选的目标是「和操作单个一样顺手」，这里统一放开：
# Shift + 拖动可直接移动已放置元件（mounted 保持不变），走锡会留在旧孔，
# __lcAfterTransform 已会写入「引脚位置已改变，请重跑 DRC」的提示。
src = rep(src, 'ht&&vt&&!vt.mounted&&!df(ht,ot.current)&&(me(vt,ht),ot.current=ht)',
          'ht&&vt&&!df(ht,ot.current)&&(me(vt,ht),ot.current=ht)',
          'M14 allow dragging mounted components')
src = rep(src, 'ht&&Tt&&z&&!z.mounted&&!df(z.position,Tt)&&c(ht,Tt)',
          'ht&&Tt&&z&&!df(z.position,Tt)&&c(ht,Tt)',
          'M15 commit drag on mounted components')

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
# v3.3.1 实测：Tt 是「拖动修饰键（默认 Shift）是否按下」，原意是「按 Shift 时不选中元件、改为拖引脚」。
# 但多选后必须按 Shift 才能拖动，于是 pointerup 之前选择集就被 r(void 0) 清空，
# 组合移动永远只动被拖的那一个（Q1/R1 位置不变）。修法：Shift 点中「已在选集内」的成员时
# 用 "keep" 模式保持选集不变；Shift 点空格子/未选中元件仍按原逻辑清空（不影响拖引脚）。
src = rep(src, 'r(Tt?void 0:st.componentId,Tt?!1:(K.ctrlKey||K.metaKey))',
          'r(Tt?((window.__lcSelIds||[]).indexOf(st.componentId)>=0?st.componentId:void 0):st.componentId,'
          'Tt?((window.__lcSelIds||[]).indexOf(st.componentId)>=0?"keep":!1):(K.ctrlKey||K.metaKey))',
          'M8b shift drag keeps multi selection')
src = rep(src, 'ht&&(K.currentTarget.setPointerCapture(K.pointerId),xe(!1)),r(vt),l(void 0)',
          'ht&&(K.currentTarget.setPointerCapture(K.pointerId),xe(!1)),r(vt,K.ctrlKey||K.metaKey),l(void 0)',
          'M9 ctrl click on component')
# v3.3.1 实测：点击元件体（不是引脚环）走的是上面这条 else 分支，dt() 返回空 → 选择调用原本不认
# 「已在选集内」。于是多选后按住 Shift 开始拖动，第一帧就把选集重置成 1 个，组合移动永远是单件。
# 与 M8b 同一套语义：Shift + 已在选集内 → keep；Ctrl/Meta → 追加/取消；其余 → 单选。
src = rep(src, 'xe(!1)),r(vt,K.ctrlKey||K.metaKey),l(void 0)',
          'xe(!1)),r(vt,(K.ctrlKey||K.metaKey)?!0:'
          '(ht&&(window.__lcSelIds||[]).indexOf(vt)>=0?"keep":!1)),l(void 0)',
          'M9b shift drag keeps selection on body hit')

# v3.3.1 实测发现的两个真实缺陷（用户反馈「多选不生效」的直接原因）：
# ① three.js OrbitControls 把「Ctrl + 左键」映射成 PAN，Ctrl 点选元件时视角会跟着平移，
#    第二下点击就落在别处 → 表现为「多选怎么点都不对」。
#    修法：Ctrl / Cmd 按下时临时关掉 controls 的 rotate 与 pan，pointerup 恢复。
# ② Ctrl 点在空白处会走 r(void 0) 把整个选择集清空，手一抖前功尽弃。
#    修法：带修饰键时空点击保留已有选择，只有普通点击空白才清空。
src = rep(src, 'onPointerDown:K=>{if(K.button===2)return;',
          'onPointerDown:K=>{if(K.button===2)return;'
          'if((K.ctrlKey||K.metaKey)&&T.current){'
          'var __lcCtl=T.current;'
          'if(!window.__lcCtlHold)window.__lcCtlHold={rotate:!!__lcCtl.enableRotate,pan:!!__lcCtl.enablePan};'
          '__lcCtl.enableRotate=!1;__lcCtl.enablePan=!1;'
          'var __lcCtlEnd=function(){'
          'document.removeEventListener("pointerup",__lcCtlEnd,!0);'
          'var __hc=window.__lcCtlHold,__cc=T.current;'
          'if(__hc&&__cc){__cc.enableRotate=__hc.rotate;__cc.enablePan=__hc.pan}'
          'window.__lcCtlHold=null};'
          'document.addEventListener("pointerup",__lcCtlEnd,!0)}',
          'M12 ctrl suppresses orbit pan/rotate')
src = rep(src, 'else k.current=void 0,ot.current=void 0,r(void 0),l(void 0)',
          'else k.current=void 0,ot.current=void 0,(K.ctrlKey||K.metaKey)||r(void 0),l(void 0)',
          'M13 ctrl click empty keeps selection')

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
# v3.3.2: 右键菜单保持多选
# 实测反馈：Ctrl 选中多个元件后再右键点「拔起 / 放置」，结果只作用在一个元件上。
# 根因：视图组件的 onContextMenu 里第一步就是 r(st)，把选择集重写成 [被点中的那一个]；
# 而组合操作（_t / xt / Gt / Xt 已被 M3/M4/M2/M5 改成读 __lcSelIdsOf(f)）此时集合只剩 1 个，
# 于是「组合操作」退化成「单件操作」。这是纯粹的右键入口问题，与被调用的变换逻辑无关。
# 修法：
#   ① 选择入口新增 "keepPrimary" 模式：保留已有集合，只把主选中挪到被点中的元件。
#      为什么必须挪主选中：属性面板、工具栏 disabled、菜单 disabled 全都读单值 f，主选中不动会指错对象。
#   ② 菜单的可用状态改为按整个集合求值：全部已放置 → 只能拔起；全部已拔起 → 只能放置；
#      混合状态 → 两个按钮都可用（各自跳过无需变动的成员）。
# ---------------------------------------------------------------
src = rep(src, 'else if(add==="keep")next=prev.indexOf(Q)>=0?prev.slice():prev.concat([Q]);',
          'else if(add==="keep")next=prev.indexOf(Q)>=0?prev.slice():prev.concat([Q]);'
          'else if(add==="keepPrimary")next=prev.indexOf(Q)>=0?'
          'prev.filter(function(x){return x!==Q}).concat([Q]):prev.concat([Q]);',
          'M16 keepPrimary selection mode')
src = rep(src, 'const st=jt(K.clientX,K.clientY);st?(r(st),l(void 0),G({x:K.clientX,y:K.clientY}))',
          'const st=jt(K.clientX,K.clientY);st?('
          'r(st,(window.__lcSelIds||[]).indexOf(st)>=0?"keepPrimary":!1),'
          'l(void 0),G({x:K.clientX,y:K.clientY}))',
          'M17 context menu keeps selection')
src = rep_fn(src, 'function le(){return!!t.find(K=>K.id===e)?.mounted}',
             'function le(mode){'
             'var ids=window.__lcSelIds||[];'
             'var arr=ids.length?t.filter(function(c){return ids.indexOf(c.id)>=0}):[];'
             'if(!arr.length){var one=t.find(function(c){return c.id===e});arr=one?[one]:[]}'
             'if(!arr.length)return!1;'
             'if(mode==="mount")return arr.every(function(c){return !!c.mounted});'
             'if(mode==="unmount")return !arr.some(function(c){return !!c.mounted});'
             'if(mode==="rotate")return arr.every(function(c){return !!c.mounted});'
             'return!!t.find(function(c){return c.id===e})?.mounted}',
             'M18 context menu disabled state by group')
src = rep(src, 'disabled:le(),onClick:()=>{g(),G(void 0)},children:"放置"',
          'disabled:le("mount"),onClick:()=>{g(),G(void 0)},children:"放置"',
          'M19 place enabled by group')
src = rep(src, 'disabled:!le(),onClick:()=>{_(),G(void 0)},children:"拔起"',
          'disabled:le("unmount"),onClick:()=>{_(),G(void 0)},children:"拔起"',
          'M20 unmount enabled by group')
src = rep(src, 'disabled:le(),onClick:()=>{h(),G(void 0)},children:"旋转 +90°"',
          'disabled:le("rotate"),onClick:()=>{h(),G(void 0)},children:"旋转 +90°"',
          'M21 rotate cw enabled by group')
src = rep(src, 'disabled:le(),onClick:()=>{h(-1),G(void 0)},children:"旋转 -90°"',
          'disabled:le("rotate"),onClick:()=>{h(-1),G(void 0)},children:"旋转 -90°"',
          'M22 rotate ccw enabled by group')

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
  /* 平面（印字面）朝向 +Z，用一条浅色窄条显式标出来：
   * TO-92 的脚序基准就是「平面对自己」，不标出来用户没法判断哪边是 1 脚。 */
  const fb=new Vt(new on(1.34,.24,.03),new qi({color:11708635}));
  fb.position.set(s[0],1.38,s[1]+.285),fb.userData.__lcFlatFace=1,e.add(fb);
  const f=.82;
  t.forEach(function(pr,idx){
    const h=pr[0],d=pr[1];
    if(Math.abs(h-s[0])>f-.04){const g=s[0]+Math.sign(h-s[0])*(f-.04);Ii(e,[g,d],[h,d],1.12)}
    bn(e,h,d,1.16);
    const nm=names&&names[idx]?String(names[idx]):"";
    /* 字要浮在本体上方、且水平正对各自的孔：原来在 +Z 且压在元件底下，
     * 俯视时中间那只脚的名字被本体整个挡住，等于没标；挪到外侧又会偏出
     * 整整一格，看起来像标的是隔壁的孔。 */
    if(nm)Un(e,nm,h,1.85,d,16777215,.62)
  });
  Un(e,i,s[0],2.3,s[1]+.48,4194258,1.8);
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

# P5b：TO-220 / TO-247 / TO-3 / TO-39 也把每个脚的字母标出来。
# 之前只有 TO-92 和 LED 会标，这几种封装在 3D 上一个字母都没有，
# 用户只能对着外部封装图数脚，极容易和软件里的脚号对错。
NEW_TO220 = '''function FP(i,t,names){
  const e=new Re,s=Ji(t),r=s.centerX,l=s.centerZ,c=new Vt(new on(2.25,2.2,.55),Ne.blackPlastic);
  c.position.set(r,1.72,l+.36),e.add(c);
  const f=new Vt(new on(2.5,.12,.7),Ne.lead);f.position.set(r,2.88,l+.36),e.add(f);
  const h=new Vt(new ze(.2,.2,.135,24),new Pe({color:724756,roughness:.35}));
  h.rotation.x=Math.PI/2,h.position.set(r,2.92,l+.36),e.add(h);
  t.forEach(([d,g])=>{const _=r+Math.sign(d-r)*1.125;Math.abs(d-r)>1.125?(Ii(e,[_,g],[d,g],.62),bn(e,d,g,.62)):bn(e,d,g,1.05)});
  __lcPinLetters(e,names,t,{y:1.02,dz:-.48,scale:.5});
  Un(e,i,r,2.12,l+.72,4194258,1.7);
  return e
}'''
src = rep_fn(src, 'function FP(i,t){const e=new Re,s=Ji(t)', NEW_TO220, 'P7 to220 pin letters')

NEW_TO39 = '''function zP(i,t,names){
  const e=new Re,s=W0(t),r=new Vt(new ze(.88,.88,.85,36),Ne.lead);
  r.position.set(s[0],1.25,s[1]),e.add(r);
  const l=new Vt(new ze(.82,.88,.18,36),new Pe({color:15067115,roughness:.18,metalness:.65}));
  l.position.set(s[0],1.78,s[1]),e.add(l);
  const c=new Vt(new on(.35,.12,.45),Ne.lead);
  c.position.set(s[0]-.72,1.25,s[1]),e.add(c);
  t.forEach(([f,h])=>{const d=f-s[0],g=h-s[1],_=Math.hypot(d,g);
    if(_>.78){const S=.78/_;Ii(e,[s[0]+d*S,s[1]+g*S],[f,h],.85)}bn(e,f,h,.86)});
  __lcPinLetters(e,names,t,{y:1.02,cx:s[0],cz:s[1],kx:.6,kz:.6,scale:.46});
  Un(e,i,s[0],1.98,s[1]+.48,1975339,1.6);
  return e
}'''
src = rep_fn(src, 'function zP(i,t){const e=new Re,s=W0(t)', NEW_TO39, 'P8 to39 pin letters')

NEW_TO3 = '''function tR(i,t,names){
  const e=new Re,s=W0(t),r=new Vt(new ze(1.25,1.25,.34,44),Ne.lead);
  r.position.set(s[0],1.28,s[1]),e.add(r);
  const l=new Vt(new ze(.98,1.18,.16,44),new Pe({color:15067115,roughness:.2,metalness:.7}));
  l.position.set(s[0],1.52,s[1]),e.add(l);
  t.forEach(([c,f])=>{const h=c-s[0],d=f-s[1],g=Math.hypot(h,d);
    if(g>1.08){const _=1.08/g;Ii(e,[s[0]+h*_,s[1]+d*_],[c,f],1.1)}bn(e,c,f,1.1)});
  __lcPinLetters(e,names,t,{y:1.02,cx:s[0],cz:s[1],kx:.75,kz:.75,scale:.5});
  Un(e,i,s[0],1.8,s[1]+.45,1975339,1.7);
  return e
}'''
src = rep_fn(src, 'function tR(i,t){const e=new Re,s=W0(t)', NEW_TO3, 'P9 to3 pin letters')

NEW_TO247 = '''function eR(i,t,names){
  const e=new Re,s=Ji(t),r=s.centerX,l=s.centerZ,
    c=new Vt(new on(Math.max(3.1,s.width+.7),2.9,.65),Ne.blackPlastic);
  c.position.set(r,1.88,l+.42),e.add(c);
  const f=new Vt(new on(Math.max(3.3,s.width+.9),.14,.85),Ne.lead);f.position.set(r,3.42,l+.42),e.add(f);
  const h=new Vt(new ze(.24,.24,.15,24),new Pe({color:724756,roughness:.35}));
  h.rotation.x=Math.PI/2,h.position.set(r,3.46,l+.42),e.add(h);
  t.forEach(([d,g])=>bn(e,d,g,1.15));
  __lcPinLetters(e,names,t,{y:1.02,dz:-.5,scale:.55});
  Un(e,i,r,2.35,l+.8,4194258,1.8);
  return e
}'''
src = rep_fn(src, 'function eR(i,t){const e=new Re,s=Ji(t)', NEW_TO247, 'P10 to247 pin letters')

for _k, _fn in (('to39', 'zP'), ('to220', 'FP'), ('to3', 'tR'), ('to247', 'eR')):
    src = rep(src, '%s:i=>%s(i.label??"Q",hn(i))' % (_k, _fn),
              '%s:i=>%s(i.label??"Q",hn(i),i.pinNames)' % (_k, _fn),
              'P11 %s dispatch passes pinNames' % _k)

# 文字精灵把自己的文字记在 userData 上：既方便以后做「点引脚看脚名」，
# 也让自动化能直接核对「哪个孔上标的是哪个字母」。
src = rep(src, '_.position.set(e,s,r),_.scale.set(c,c*.25,1),i.add(_)}',
          '_.position.set(e,s,r),_.scale.set(c,c*.25,1),_.userData.__lcLabel=t,i.add(_)}',
          'P12 text sprite keeps its own text')

PIN_ORDER_SELECT = ('P.jsxs("label",{children:[P.jsx("span",{children:"三极管脚序"}),'
                    'P.jsx("select",{value:O.pinOrder||"",onChange:T=>v({pinOrder:T.target.value||void 0}),children:['
                    'P.jsx("option",{value:"",children:"未指定（只显示脚号）"}),'
                    'P.jsx("option",{value:"EBC",children:"1=E 2=B 3=C"}),'
                    'P.jsx("option",{value:"ECB",children:"1=E 2=C 3=B"}),'
                    'P.jsx("option",{value:"BCE",children:"1=B 2=C 3=E"}),'
                    'P.jsx("option",{value:"BEC",children:"1=B 2=E 3=C"}),'
                    'P.jsx("option",{value:"CBE",children:"1=C 2=B 3=E"}),'
                    'P.jsx("option",{value:"CEB",children:"1=C 2=E 3=B"})]}),'
                    'P.jsx("div",{onClick:T=>T.preventDefault(),style:{flexBasis:"100%",width:"100%",'
                    'gridColumn:"1 / -1",marginTop:"2px",fontSize:"11px",lineHeight:"1.45",'
                    'color:"var(--ui-text-dim,#8b98a8)",whiteSpace:"normal",wordBreak:"break-word"},'
                    'children:__lcTriPinTable(O)}),'
                    'P.jsx("div",{onClick:T=>T.preventDefault(),style:{flexBasis:"100%",width:"100%",'
                    'gridColumn:"1 / -1",fontSize:"11px",lineHeight:"1.45",'
                    'color:"var(--ui-text-dim,#7d8899)",whiteSpace:"normal",wordBreak:"break-word"},'
                    'children:"基准：平面对自己、引脚朝下，从左→右为 1→2→3。实物顺序不同就换一种排布。"})]}),')
src = rep(src, 'onChange:T=>v({value:T.target.value})})]}),',
          'onChange:T=>v({value:T.target.value})})]}),'
          '["to92","to220","to3","to247","to39"].indexOf(O.kind)>=0&&' + PIN_ORDER_SELECT,
          'P6 pin order select in inspector')

src = rep(src, 'window.__lcProject=i,window.__lcCommit=H;return P.jsxs("div",{className:"app-shell"',
          'window.__lcProject=i,window.__lcCommit=H,window.__lcUnmountAll=__lcUnmountAll;return P.jsxs("div",{className:"app-shell"',
          'M11 expose unmount-all to toolbar')

# =================================================================
# v3.4.0
# =================================================================
print('== v3.4 shared helpers ==')
src = rep(src, 'var __lcThumbCache={}', p34 + '\nvar __lcThumbCache={}', 'U0 code inject v3.4')

# --- 1) 走锡 / 跳线 / 删线时不要弹引脚网络框 ---------------------------
# 提示框的 pointermove 监听只看 __lcPicking，不看当前编辑模式；
# 而这三个模式里光标本来就贴着孔位移动，浮窗正好盖住落点。
# 把当前模式暴露成全局，提示框据此静默（patch_v33_main.js 里已加判断）。
src = rep(src, 'qt.useEffect(()=>{__lcPaint(__lcHover.current)},[x,__lcDS,i])',
          'qt.useEffect(()=>{window.__lcRouteMode=x,__lcPaint(__lcHover.current)},[x,__lcDS,i])',
          'U1 expose route edit mode')

# --- 2) 走锡 / 跳线 / 删线时点中元件不选中（避免右侧属性面板跳出）--------
# 原实现里只有「引脚命中」按模式 gate 过，「元件体命中」是无条件执行的，
# 于是在走锡时点到元件就会 r(vt) 选中它、右侧栏立刻弹出。
src = rep(src, 'const vt=Ht(K);if(vt){',
          'const vt=(x==="select"&&!D)?Ht(K):void 0;if(vt){',
          'U2 component hit only in select mode')
src = rep(src, '}else k.current=void 0,ot.current=void 0,(K.ctrlKey||K.metaKey)||r(void 0),l(void 0)},onPointerMove:',
          '}else{k.current=void 0,ot.current=void 0,'
          'x==="select"&&(K.ctrlKey||K.metaKey||r(void 0),l(void 0))}},onPointerMove:',
          'U3 empty click clears selection only in select mode')

# --- 3) 板子四个方向的行 / 列增删按钮 -----------------------------------
GROW_BTN = (
    'P.jsxs("div",{className:"lc-board-grow",onPointerDown:K=>K.stopPropagation(),'
    'style:{position:"absolute",%s,display:"flex",gap:6,zIndex:7},children:['
    'P.jsx("button",{className:"view-button",type:"button",title:"%s",style:{padding:"0 8px",height:"26px"},'
    'onClick:()=>window.__lcBoardGrow&&window.__lcBoardGrow("%s",1),children:"%s"}),'
    'P.jsx("button",{className:"view-button",type:"button",title:"%s",style:{padding:"0 8px",height:"26px"},'
    'onClick:()=>window.__lcBoardGrow&&window.__lcBoardGrow("%s",-1),children:"%s"})]})'
)
GROW_UI = ','.join([
    GROW_BTN % ('top:"12px",left:"50%",transform:"translateX(-50%)"',
                '在上方加一行', 'top', '＋行', '删除最上一行（该行必须为空）', 'top', '－行'),
    GROW_BTN % ('bottom:"12px",left:"50%",transform:"translateX(-50%)"',
                '在下方加一行', 'bottom', '＋行', '删除最下一行（该行必须为空）', 'bottom', '－行'),
    GROW_BTN % ('left:"12px",top:"50%",transform:"translateY(-50%)",flexDirection:"column"',
                '在左侧加一列', 'left', '＋列', '删除最左一列（该列必须为空）', 'left', '－列'),
    GROW_BTN % ('right:"12px",top:"50%",transform:"translateY(-50%)",flexDirection:"column"',
                '在右侧加一列', 'right', '＋列', '删除最右一列（该列必须为空）', 'right', '－列'),
])
src = rep(src,
          'children:"斜视"})]})]});function et(K){return It(K.clientX,K.clientY)}',
          'children:"斜视"})]})' + ',' + GROW_UI + ']});function et(K){return It(K.clientX,K.clientY)}',
          'U4 board grow buttons')

# --- 4) 零欧电阻按导线处理 ---------------------------------------------
# 布线 / 继续布线的入参里追加虚拟桥接（__lcBridge，locked、不渲染、不落盘），
# 飞线的并查集也把同一网络的两个脚并起来。详见 patch_v34_main.js 注释。
src = rep(src, 'yt=Y4(Q.board,rt,Q.components,q,zt,void 0,Bt)',
          'yt=Y4(Q.board,rt,Q.components,__lcBridgeTraces(Q,q),zt,void 0,Bt)',
          'U5 autoroute passes bridges')
# v3.4.2：DRC 不再接收虚拟走锡（原来的 U7 已删除，见下方 V4 注释）
src = rep(src, 'var pl=__lcContinuePlan(Q.board,eps,Q.components,Q.routing.traces||[],oldJ,Er(Q));',
          'var pl=__lcContinuePlan(Q.board,eps,Q.components,'
          '__lcBridgeTraces(Q,Q.routing.traces||[]),oldJ,Er(Q));',
          'U8 continue route sees bridges')
src = rep(src, 'for(var ji=0;ji<jumpers.length;ji+=1){var jm=jumpers[ji];if(jm&&jm.from&&jm.to)uni(key(jm.from),key(jm.to))}',
          'for(var ji=0;ji<jumpers.length;ji+=1){var jm=jumpers[ji];if(jm&&jm.from&&jm.to)uni(key(jm.from),key(jm.to))}'
          'var __lb=[];try{__lb=__lcBridgeLinks(pj)||[]}catch(e){__lb=[]}'
          'for(var __li=0;__li<__lb.length;__li+=1)uni(key(__lb[__li].from),key(__lb[__li].to));',
          'U9 ratsnest unions 0-ohm bridges')
# 属性面板给出明确提示，否则「0Ω 当导线」是个不可见的行为变化
src = rep(src, 'P.jsx("span",{children:O.mounted?"已在板上":"已拔起"})',
          'P.jsx("span",{children:O.mounted?"已在板上":"已拔起"}),'
          '__lcZeroOhm(O)&&P.jsx("span",{title:"0Ω 电阻：1、2 脚视为同一节点（同网络时），'
          '飞线不再在它们之间画线、自动布线不会为它们铺铜；'
          '但每一端仍需要铜箔接到本网络，否则那一端就是悬空的",children:"0Ω 视为导线"})',
          'U10 inspector 0-ohm hint')

# =================================================================
# v3.4.1：DRC 对「没有网络」的焊盘别再报错网短路
# 根因：sO() 里引脚在两个映射里都找不到（= 从没被指派过网络）时，
#       只要有铜箔压在上面就判 WRONG_NET_SHORT —— 于是「期望 无网络，实际 $1N39」这种
#       自相矛盾的错误。没有期望网络就谈不上「错网」，降级成 warning（未使用引脚）。
# =================================================================
src = rep(src, 'if(!d)return{ref:l.name,pin:h,grid:g,actualNets:S,status:S.length>0?"WRONG_NET_SHORT":"NO_NET_UNUSED"};',
          'if(!d)return{ref:l.name,pin:h,grid:g,actualNets:S,status:"NO_NET_UNUSED"};',
          'V1 unassigned pad is a warning')
# 0Ω 元件引脚未连通时，把「0Ω 只连自身两脚」写进错误文案，避免误解成「0Ω 能替两端接线」
src = rep(src,
          'return{ref:d.ref,pin:d.pin,pinName:d.role,grid:g,expectedNet:v,actualNets:S,'
          'status:x?"CONNECTED":"REQUIRED_UNCONNECTED"}',
          'return{ref:d.ref,pin:d.pin,pinName:d.role,grid:g,expectedNet:v,actualNets:S,'
          'status:x?"CONNECTED":"REQUIRED_UNCONNECTED",'
          'hint:(!x&&__lcZeroOhm(l))?"（0Ω 只把自身 1、2 脚连起来，这一端仍需要铜箔接到网络）":void 0}',
          'V2 0-ohm unconnected hint')
src = rep(src, '，位置 ${M.grid[0]},${M.grid[1]}`',
          '，位置 ${M.grid[0]},${M.grid[1]}${M.hint||""}`',
          'V3 drc message carries hint')

# =================================================================
# v3.4.2：0Ω 的桥接改为「只并连通性、不占中间孔」
# v3.4.0 把桥接当成一条真实走锡塞进 DRC，它在两个焊盘之间铺出一串中间孔
# （11,32 → 12,32 → 13,32 → 14,32）。若中间孔上有别的网络（这里 12,32 是 $1N39），
# DRC 就判 GND 与 $1N39 短路 —— 凭空多出 2 条假错误，用户看到的「原先正常连接变成错的」。
# 物理事实：0Ω 只连通自身两个焊盘，中间那几格空间不属于任何铜箔。
# 修法：在 J0 内部按元件直接把两个焊盘并进并查集（_ ），只动连通性，
# 不碰 d（每个孔上的期望网络）与走锡几何检查，因此不会产生短路 / 重叠误报。
# 放在 J0 里而不是调用点，是为了让「DRC 检查按钮」与「自动布线内部的 DRC」走同一套。
# =================================================================
src = rep(src, 't.traces.forEach(M=>{const O=Dr(M.points),C=z2(M.net,O,h,d);',
          '(__lcDrcUnion(s,c,_,S,oe)),'
          't.traces.forEach(M=>{const O=Dr(M.points),C=z2(M.net,O,h,d);',
          'V4 drc unions 0-ohm pads without claiming holes')
# 布线器会把输入走锡回显到结果里，假桥接会被写进工程 → 落盘前剔掉
src = rep(src, 'const Zt=f4(yt,zt);return{...Q,routing:{...Zt,warnings:[...Zt.warnings,...Ft]}}',
          'const Zt=__lcStripBridges(f4(yt,zt));return{...Q,routing:{...Zt,warnings:[...Zt.warnings,...Ft]}}',
          'V5 strip bridge traces from autoroute result')
src = rep(src, 'var Zt=f4(pl,Er(Q));',
          'var Zt=__lcStripBridges(f4(pl,Er(Q)));',
          'V6 strip bridge traces from continue-route result')
# 兜底：老工程里若已残留假桥接（3.4.0/3.4.1 布线过），DRC 也当它不存在
src = rep(src, 'function J0(i,t,e,s){const r=Zi(i),',
          'function J0(i,t,e,s){t=__lcStripBridges(t);const r=Zi(i),',
          'V7 drc ignores persisted bridge traces')
# MANUAL 走锡的网络归属：按连通组解析，不再按单条线段解析。
# 逐条解析会让同一条手画线的「碰到焊盘段」继承到真实网络、「没碰到焊盘段」留在 MANUAL，
# 两者共享同一孔时被判定为「不同网络共用同一导电组」（典型的一根线报成两根线短路）。
src = rep(src, '(__lcDrcUnion(s,c,_,S,oe)),t.traces.forEach(M=>{const O=Dr(M.points),C=z2(M.net,O,h,d);',
          '(__lcDrcUnion(s,c,_,S,oe)),'
          '__lcPrepManualNets(t.traces,t.jumpers,h,oe,Oy),'
          't.traces.forEach(M=>{const O=Dr(M.points),C=__lcManualNetOf(M);',
          'V8 manual nets resolved per connected group')
src = rep(src, ',R=z2(M.net,[M.from,M.to],h,d);',
          ',R=__lcManualNetOf(M);',
          'V9 jumper uses group-resolved net')

# =================================================================
# v3.4.4：DRC 列表可定位
# 原来的面板只有一行行纯文本，最多显示 12 条，没有元件位号、不能跳转 ——
# 「网络间短路 @ 13,42：MANUAL、$1N11」这种报错用户没法在板上找到位置。
# 新版面板（patch_v34_main.js 的 __lcDrcPanelV2）补三件事：
#   1) 每条错误标出孔位 + 该孔上的 位号.脚号(网络)；
#   2) 点击条目把相机拉到该孔并打红球标记；
#   3) 不再截断到 12 条，可按「复制全部」导出完整清单。
# 这里只把原组件改成一层薄壳，逻辑全在注入文件里，方便单测。
# =================================================================
# 原组件是单行 `function __lcDrcPanel({project:i}){...}` —— 不能用 rep_fn，
# 它的花括号配平会被参数解构的 {} 骗到，只能按起止标记整体切掉。
_a = src.count('function __lcDrcPanel({project:i}){')
if _a != 1:
    raise SystemExit('FAIL W1 drc panel: found %d anchors (expected 1)' % _a)
_a = src.index('function __lcDrcPanel({project:i}){')
_b = src.index('function __lcColorPanel(', _a)
src = src[:_a] + 'function __lcDrcPanel(i){return __lcDrcPanelV2(i)}' + src[_b:]
print('  ok W1 drc panel delegates to locatable version')

# =================================================================
# v3.4.7
# 1) 板宽 / 板高输入框改成「编辑草稿 + 提交生效」
#    原串 onChange 直接把每个按键写进工程：57 改 28 时删掉 7 就提交成 5，
#    板子立刻缩到 5 列、场景重建，后面的数字输不进去。
#    换成 __lcBoardSizeField（见 patch_v34_main.js），失焦 / 回车才落盘。
# =================================================================
src = rep(src,
          'P.jsxs("label",{className:"board-size-control",children:[P.jsx("span",{children:"W"}),'
          'P.jsx("input",{type:"number",min:5,max:150,value:i.width,disabled:!O.capabilities.canResizeWidth,'
          'title:O.capabilities.canResizeWidth?void 0:"板宽由板定义决定",'
          'onChange:K=>S({...i,width:Jp(K.target.value)})})]}),'
          'P.jsxs("label",{className:"board-size-control",children:[P.jsx("span",{children:"H"}),'
          'P.jsx("input",{type:"number",min:5,max:150,value:i.height,'
          'onChange:K=>S(i.kind==="breadboard"?M0(Jp(K.target.value),i.breadboard?.modules??1):{...i,height:Jp(K.target.value)})})]})',
          'P.jsx(__lcBoardSizeField,{label:"W",value:i.width,min:5,max:150,'
          'disabled:!O.capabilities.canResizeWidth,'
          'title:O.capabilities.canResizeWidth?void 0:"板宽由板定义决定",'
          'onCommit:K=>S({...i,width:K})}),'
          'P.jsx(__lcBoardSizeField,{label:"H",value:i.height,min:5,max:150,'
          'onCommit:K=>S(i.kind==="breadboard"?M0(K,i.breadboard?.modules??1):{...i,height:K})})',
          'X1 board size fields commit on blur')

# 2) 工具栏：删掉「透视」按钮（与飞线并排、容易被误当成走线相关），
#    「飞线」改名「飞线层」。透视仍可从右上角图标或快捷键 T 切换。
src = rep(src,
          'P.jsxs(Hl,{label:"",openMenu:h,onOpenMenu:d,children:['
          'P.jsx($n,{active:__lcRats,"aria-label":"飞线层（背面视角显示）",'
          'onClick:()=>__lcSetRats(__lcRatsToggle()),children:"飞线"}),'
          'P.jsx($n,{active:v,"aria-label":"透视板体，快捷键 T",'
          'title:"透视板体：透过板体查看背面走线（快捷键 T）",onClick:w,children:"透视"})]})',
          'P.jsxs(Hl,{label:"",openMenu:h,onOpenMenu:d,children:['
          'P.jsx($n,{active:__lcRats,"aria-label":"飞线层（背面视角显示）",'
          'title:"飞线层：显示尚未连通网络的飞线（背面视角下可见）",'
          'onClick:()=>__lcSetRats(__lcRatsToggle()),children:"飞线层"})]})',
          'X2 toolbar drops transparency button, renames ratsnest')

if CHECK_ONLY:
    print('check only, not written')
    raise SystemExit(0)
shutil.copyfile(MAIN, MAIN + '.prev')
shutil.copyfile(WORKER, WORKER + '.prev')
io.open(MAIN, 'w', encoding='utf-8', newline='').write(src)
io.open(WORKER, 'w', encoding='utf-8', newline='').write(wk)
print('OK main %d chars, worker %d chars' % (len(src), len(wk)))
