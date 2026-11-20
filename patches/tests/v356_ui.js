// 回归测试：v3.5.6 顶栏两处改动
//   1. 删掉品牌名右侧的红色「内测版」徽标（保留其余内测版提示）
//   2. 透视按钮由眼睛图标改成文字「透视」，位置不变（刷新 与 主题切换 之间）
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
assert(refresh >= 0 && theme >= 0, '顶栏仍有刷新与主题切换按钮');
assert(refresh < xray && xray < theme, '透视按钮仍在刷新与主题切换之间（位置未变）');
assert(bundle.indexOf('onToggleTransparent&&d.onToggleTransparent()') >= 0, '点击仍切到同一个透视开关');

/* ---------- 3) 文字按钮高度与邻居对齐 ---------- */
assert(bundle.indexOf('.header-actions .icon-text-button{min-height:32px') >= 0,
  '文字按钮高度对齐顶栏图标按钮的 32px');

console.log(res.join('\n'));
console.log(res.every((r) => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
