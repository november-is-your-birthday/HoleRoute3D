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

if CHECK_ONLY:
    print('check only, not written')
    raise SystemExit(0)
shutil.copyfile(MAIN, MAIN + '.prev')
shutil.copyfile(WORKER, WORKER + '.prev')
io.open(MAIN, 'w', encoding='utf-8', newline='').write(src)
io.open(WORKER, 'w', encoding='utf-8', newline='').write(wk)
print('OK main %d chars, worker %d chars' % (len(src), len(wk)))
