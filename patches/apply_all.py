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
CHECK_ONLY = '--check' in sys.argv

def rep(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit('FAIL %s: found %d occurrences (expected 1)' % (label, n))
    print('  ok', label)
    return text.replace(old, new)

src = io.open(PRISTINE_MAIN, encoding='utf-8').read()
wk = io.open(PRISTINE_WORKER, encoding='utf-8').read()
p31 = io.open(P31, encoding='utf-8').read().strip()
p32 = io.open(P32, encoding='utf-8').read().strip()

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
ELE_TEST_SP = 'b.indexOf("CP") >= 0 || b.indexOf("POLAR") >= 0 || b.indexOf("电解") >= 0 || /ELE|TANT|RADIAL|RB[\\d.]/.test(b) || (/\\d\\s*[UΜμ]F/.test(b) && !/(0402|0603|0805|1206|1210|2010|2512)/.test(b))'
ELE_TEST_MIN = 'b.indexOf("CP")>=0||b.indexOf("POLAR")>=0||b.indexOf("电解")>=0||/ELE|TANT|RADIAL|RB[\\d.]/.test(b)||(/\\d\\s*[UΜμ]F/.test(b)&&!/(0402|0603|0805|1206|1210|2010|2512)/.test(b))'
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

if CHECK_ONLY:
    print('check only, not written')
    raise SystemExit(0)
shutil.copyfile(MAIN, MAIN + '.prev')
shutil.copyfile(WORKER, WORKER + '.prev')
io.open(MAIN, 'w', encoding='utf-8', newline='').write(src)
io.open(WORKER, 'w', encoding='utf-8', newline='').write(wk)
print('OK main %d chars, worker %d chars' % (len(src), len(wk)))
