// v3.5.0：新手教程与小范围界面优化回归测试
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const bundle = fs.readFileSync(path.join(__dirname, '../../src/dist/assets/index-C0NrTOjn.js'), 'utf8');
const res = [];
const assert = (ok, msg) => { res.push((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) process.exitCode = 1; };
function grabFn(src, sig) {
  const i = src.indexOf(sig);
  if (i < 0) throw new Error('not found: ' + sig);
  const b = src.indexOf('{', i);
  let d = 0;
  for (let k = b; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + sig);
}
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  return textOf(node.props && node.props.children);
}
function findAll(node, pred, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach((n) => findAll(n, pred, out)); return out; }
  if (pred(node)) out.push(node);
  const children = node.props && node.props.children;
  if (children) findAll(children, pred, out);
  return out;
}
function byClass(node, cls) {
  return findAll(node, (n) => String(n.props && n.props.className || '').split(/\s+/).includes(cls));
}

/* ---------- 静态接线与教程内容 ---------- */
assert(bundle.includes('className:"lc-guide-button"'), '顶部存在专用教程按钮');
assert(bundle.includes('children:"新手教程"'), '入口文案为「新手教程」');
assert(bundle.includes('background:#ffd34e'), '教程按钮使用黄色背景');
assert(bundle.includes('onClick:()=>window.__lcOpenGuide&&window.__lcOpenGuide()'), '按钮调用教程打开入口');
assert(bundle.includes('P.jsx(__lcGuideHost,{}),l&&i&&P.jsx(jR'), '教程挂载不依赖已创建工程');
assert(/e\.key\s*!==\s*"F1"/.test(bundle), '注册 F1 快捷键');
assert(bundle.includes('role:"dialog"') && bundle.includes('"aria-modal":"true"'), '教程使用标准模态对话框语义');
assert(/"aria-labelledby":\s*"lc-guide-title"/.test(bundle), '对话框关联标题');
assert(bundle.includes('querySelectorAll("button:not([disabled])'), 'Tab 焦点被限制在教程内');
assert(/restoreFocusRef\.current\s*=\s*document\.activeElement/.test(bundle), '关闭后恢复之前焦点');
assert(bundle.includes('"aria-pressed":typeof i==="boolean"?i:void 0'), '工具栏开关状态暴露给辅助技术');
assert(bundle.includes('（快捷键 "+r+"）'), '原隐藏快捷键可通过悬停提示查看');
assert(bundle.includes('button:focus-visible'), '键盘焦点清晰可见');
assert(bundle.includes(':root[data-theme=dark] .lc-guide-overlay'), '教程适配深色主题');
assert(bundle.includes('@media(max-width:760px)'), '教程适配窄窗口');
assert(bundle.includes('.app-shell{grid-template-rows:52px 1fr}'), '仅增加顶部高度，不重排主工作区');
assert(!bundle.includes('.main-layout{grid-template-columns'), '没有大改主布局');

/* ---------- 用最小 React hooks 模拟器驱动教程 ---------- */
const state = [], refs = [], effectSlots = [];
let sIdx = 0, rIdx = 0, eIdx = 0, effects = [], dirty = false;
const listeners = {};
const documentMock = {
  activeElement: { focus() {} },
  addEventListener(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); },
  removeEventListener(type, fn) { if (listeners[type]) listeners[type] = listeners[type].filter((f) => f !== fn); },
};
const qt = {
  useState(init) {
    const i = sIdx++;
    if (!(i in state)) state[i] = init;
    return [state[i], (v) => { const next = typeof v === 'function' ? v(state[i]) : v; if (state[i] !== next) { state[i] = next; dirty = true; } }];
  },
  useRef(init) { const i = rIdx++; if (!(i in refs)) refs[i] = { current: init }; return refs[i]; },
  useEffect(fn, deps) {
    const i = eIdx++;
    const prev = effectSlots[i];
    const changed = !prev || !deps || !prev.deps || deps.length !== prev.deps.length || deps.some((v, k) => v !== prev.deps[k]);
    if (changed) effects.push(() => {
      if (prev && typeof prev.cleanup === 'function') prev.cleanup();
      const cleanup = fn();
      effectSlots[i] = { deps, cleanup };
    });
  },
};
const P = { jsx: (type, props, key) => ({ type, props: props || {}, key }), jsxs: (type, props, key) => ({ type, props: props || {}, key }) };
const windowMock = {};
const box = { qt, P, window: windowMock, document: documentMock, Math, String, Number, Object, Array, console,
  setTimeout(fn) { fn(); return 1; }, clearTimeout() {} };
vm.createContext(box);
const a = bundle.indexOf('var __lcGuideSections = [');
const b = bundle.indexOf('\n\nfunction __lcGuideBlock', a);
assert(a >= 0 && b > a, '教程章节数据可提取');
vm.runInContext(bundle.slice(a, b), box);
vm.runInContext(grabFn(bundle, 'function __lcGuideBlock('), box);
vm.runInContext(grabFn(bundle, 'function __lcGuideHost('), box);
function render() {
  let out = null;
  for (let round = 0; round < 10; round++) {
    sIdx = 0; rIdx = 0; eIdx = 0; effects = []; dirty = false;
    out = box.__lcGuideHost();
    effects.forEach((fn) => fn());
    if (!dirty) break;
  }
  return out;
}
function emit(type, key) {
  (listeners[type] || []).slice().forEach((fn) => fn({
    key, target: { tagName: 'DIV' }, currentTarget: {}, preventDefault() {}, stopPropagation() {},
  }));
}
let view = render();
assert(view === null, '默认不弹教程，不打扰老用户');
assert(box.__lcGuideSections.length === 7, '共 7 个教程章节');
const allText = box.__lcGuideSections.map((s) => JSON.stringify(s)).join('\n');
['生成元件', '自动放置', '自动布线', 'DRC', '导出工程 JSON', '暖黄色字母', '黑色圆环', 'Multisim', 'Wire List', 'Cross Reference', '万用表', '通电前'].forEach((term) => {
  assert(allText.includes(term), '教程覆盖：' + term);
});
assert(typeof windowMock.__lcOpenGuide === 'function', '教程全局入口已注册');
windowMock.__lcOpenGuide();
view = render();
assert(view && view.props.className === 'lc-guide-overlay', '点击入口后显示教程');
assert(byClass(view, 'lc-guide-nav-item').length === 7, '目录显示 7 个章节按钮');
assert(textOf(byClass(view, 'lc-guide-content-head')[0]).includes('从零完成第一块洞洞板'), '默认显示快速上手');
assert(byClass(view, 'lc-guide-steps')[0].props.children.length === 5, '快速上手给出明确 5 步');
assert(byClass(view, 'lc-guide-secondary')[0].props.disabled === true, '第一章禁用上一章');
byClass(view, 'lc-guide-primary')[0].props.onClick();
view = render();
assert(textOf(byClass(view, 'lc-guide-content-head')[0]).includes('把原理图变成元件与网络'), '下一章进入导入网表');
assert(byClass(view, 'lc-guide-secondary')[0].props.disabled === false, '第二章可以使用上一章');
emit('keydown', 'ArrowRight');
view = render();
assert(textOf(byClass(view, 'lc-guide-content-head')[0]).includes('先摆好元件'), '右方向键切换下一章');
emit('keydown', 'ArrowLeft');
view = render();
assert(textOf(byClass(view, 'lc-guide-content-head')[0]).includes('把原理图变成元件与网络'), '左方向键返回上一章');
byClass(view, 'lc-guide-nav-item')[6].props.onClick();
view = render();
assert(textOf(byClass(view, 'lc-guide-content-head')[0]).includes('常用快捷键'), '目录可直达快捷键章节');
assert(byClass(view, 'lc-guide-key').length >= 20, '快捷键表内容完整');
assert(textOf(byClass(view, 'lc-guide-primary')[0]).includes('完成'), '最后一章主按钮改为完成');
byClass(view, 'lc-guide-close')[0].props.onClick();
view = render();
assert(view === null, '关闭按钮退出教程');
emit('keydown', 'F1');
view = render();
assert(view && byClass(view, 'lc-guide-dialog').length === 1, 'F1 可重新打开教程');
emit('keydown', 'Escape');
view = render();
assert(view === null, 'Esc 关闭教程');

console.log(res.join('\n'));
console.log(res.every((r) => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
