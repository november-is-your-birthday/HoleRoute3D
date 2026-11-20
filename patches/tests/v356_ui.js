// 回归测试：v3.5.6 顶栏两处改动
//   1. 删掉品牌名右侧的红色「内测版」徽标（保留其余内测版提示）
//   2. 透视按钮由眼睛图标改成文字「透视」
// v3.5.7 追加：
//   3. 透视横排两字、紧凑宽度（lc-xray + 不换行，宽度自然收紧）
//   4. 刷新按钮移到「清空工程」（垃圾桶）右边
'use strict';
const fs = require('fs');
const path = require('path');

const BUNDLE = path.join(__dirname, '../../src/dist/assets/index-C0NrTOjn.js');
const bundle = fs.readFileSync(BUNDLE, 'utf8');

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

/* ---------- 1) 顶栏徽标已删除 ---------- */
assert(bundle.indexOf('lc-beta-badge') < 0, '顶栏不再注入「内测版」徽标');
assert(bundle.indexOf('children:["ProtoRoute 3D",') < 0, '品牌名恢复为纯文本，不再拼徽标子节点');
assert(bundle.indexOf('P.jsx("div",{className:"brand-title",children:"ProtoRoute 3D"})') >= 0,
  '品牌名节点保持原样');

/* ---------- 2) 透视按钮改成文字，位置不变 ---------- */
const xray = bundle.indexOf('children:"透视"');
assert(xray >= 0, '顶栏存在文字「透视」按钮');
assert(bundle.indexOf('"icon-text-button active":"icon-text-button"') >= 0, '透视按钮用文字按钮样式（含 active 态）');
assert(bundle.indexOf('$2,{size:18}') < 0, '顶栏不再使用眼睛图标（18px）');
assert(bundle.indexOf('title:"透视板体：透过板体查看背面走线（快捷键 T）"') >= 0, '悬停提示写明快捷键 T');

const refresh = bundle.indexOf('title:"刷新"');
const theme = bundle.indexOf('title:"切换深色/浅色模式"');
const clear = bundle.indexOf('title:"清空工程（删除全部元件与走线）"');
const settings = bundle.indexOf('title:"设置"');
assert(refresh >= 0 && theme >= 0 && clear >= 0 && settings >= 0, '顶栏仍有刷新/主题切换/清空/设置按钮');
assert(xray < theme, '透视按钮在主题切换之前');
assert(clear < refresh && refresh < settings, '刷新按钮在「清空工程」右边、设置左边');
assert(bundle.indexOf('onToggleTransparent&&d.onToggleTransparent()') >= 0, '点击仍切到同一个透视开关');

/* ---------- 3) 透视横排两字、紧凑宽度 ---------- */
assert(bundle.indexOf('"icon-text-button lc-xray active":"icon-text-button lc-xray"') >= 0,
  '透视按钮带 lc-xray 类（样式钩子）');
assert(bundle.indexOf('.header-actions .icon-text-button.lc-xray{white-space:nowrap;flex:none') >= 0,
  '透视按钮禁止换行、不被 flex 压缩（宽度自然收紧）');
assert(bundle.indexOf('.header-actions .icon-text-button.lc-xray{width:') < 0,
  '透视按钮不再锁两格宽（72px 已去掉）');

/* ---------- 4) 撤销图标换成 Undo2（↩ 弯钩箭头，区别于刷新） ---------- */
const undoBtn = bundle.indexOf('title:"撤销",disabled:!f,onClick:c,children:P.jsx(x3,{size:18})');
assert(undoBtn >= 0, '撤销按钮使用 Undo2 弯钩箭头图标');
assert(bundle.indexOf('title:"撤销",disabled:!f,onClick:c,children:P.jsx(d3,{size:18})') < 0,
  '撤销按钮不再使用 RotateCcw 圆箭头（与刷新易混）');

/* ---------- 3) 文字按钮高度与邻居对齐 ---------- */
assert(bundle.indexOf('.header-actions .icon-text-button{min-height:32px') >= 0,
  '文字按钮高度对齐顶栏图标按钮的 32px');

console.log(res.join('\n'));
console.log(res.every((r) => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
