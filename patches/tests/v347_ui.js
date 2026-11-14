// 回归测试：v3.4.7
//   1. 板宽 / 板高输入框改成「编辑草稿 + 提交生效」——
//      57 改成 28 的过程中，删掉 7 不能立刻把板宽提交成 5。
//   2. 工具栏删掉「透视」按钮（飞线右侧那个），「飞线」改名「飞线层」。
//
// 组件本身是 React 函数组件，这里用最小 hooks 模拟器直接渲染并驱动事件，
// 不依赖浏览器，也不依赖 react 包。
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BUNDLE = path.join(__dirname, '../../src/dist/assets/index-C0NrTOjn.js');
const bundle = fs.readFileSync(BUNDLE, 'utf8');

function grabFn(src, sig) {
  const i = src.indexOf(sig);
  if (i < 0) throw new Error('not found: ' + sig);
  const b = src.indexOf('{', i);
  let d = 0, e = -1;
  for (let k = b; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) { e = k; break; } }
  }
  return src.slice(i, e + 1) + '\n';
}

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

/* ---------- 1) 静态接线 ---------- */
assert(bundle.indexOf('function __lcBoardSizeField(props)') >= 0, '存在板尺寸输入组件');
assert(bundle.indexOf('P.jsx(__lcBoardSizeField,{label:"W"') >= 0, '板宽用新组件');
assert(bundle.indexOf('P.jsx(__lcBoardSizeField,{label:"H"') >= 0, '板高用新组件');
assert(bundle.indexOf('onChange:K=>S({...i,width:Jp(') < 0, '板宽不再逐键提交（旧写法已移除）');
assert(bundle.indexOf('onChange:K=>S(i.kind==="breadboard"?M0(Jp(') < 0, '板高不再逐键提交（旧写法已移除）');
assert(bundle.indexOf('children:"飞线层"') >= 0, '工具栏按钮文案为「飞线层」');
assert(bundle.indexOf('children:"透视"') < 0, '工具栏不再有「透视」按钮');

/* ---------- 2) 组件行为 ---------- */
function makeCtx() {
  const state = [];
  const refs = [];
  let sIdx = 0;
  let rIdx = 0;
  let effects = [];
  let dirty = false;
  const setAt = (i, v) => { if (state[i] !== v) { state[i] = v; dirty = true; } };
  const qt = {
    useState(init) {
      const i = sIdx++;
      if (!(i in state)) state[i] = init;
      return [state[i], (v) => setAt(i, typeof v === 'function' ? v(state[i]) : v)];
    },
    useRef(init) {
      const i = rIdx++;
      if (!(i in refs)) refs[i] = { current: init };
      return refs[i];
    },
    useEffect(fn) { effects.push(fn); },
  };
  const P = {
    jsx: (type, props) => ({ type, props: props || {} }),
    jsxs: (type, props) => ({ type, props: props || {} }),
  };
  const box = {
    qt, P, Math, Number, String, Object, Array, isFinite, console, NaN,
    props: null,
    __render() {
      let out = null;
      for (let round = 0; round < 8; round++) {
        sIdx = 0; rIdx = 0; effects = []; dirty = false;
        out = box.__Comp(box.props);
        effects.forEach((f) => f());
        if (!dirty) break;
      }
      return out;
    },
  };
  vm.createContext(box);
  vm.runInContext(grabFn(bundle, 'function __lcBoardSizeField('), box);
  return box;
}

function mount(initial) {
  const box = makeCtx();
  const commits = [];
  const props = {
    label: 'W', min: 5, max: 150,
    value: initial,
    onCommit: (n) => commits.push(n),
  };
  box.props = props;
  box.__Comp = vm.runInContext('__lcBoardSizeField', box);
  const api = {
    commits,
    props,
    input() { return box.__render().props.children[1].props; },
    shown() { return api.input().value; },
    selected: 0,
    focus() {
      api.input().onFocus({ target: { select() { api.selected += 1; } } });
      return api;
    },
    type(v) { api.input().onChange({ target: { value: v } }); return api; },
    blur() { api.input().onBlur(); return api; },
    press(k) {
      const ev = { key: k, preventDefault() {}, currentTarget: { blur() { api.blur(); } } };
      api.input().onKeyDown(ev);
      return api;
    },
    /* 宿主收到提交后回写工程值（真实场景是 onUpdateBoard → board.width 变化） */
    apply() {
      if (commits.length) props.value = commits[commits.length - 1];
      return api;
    },
  };
  return api;
}

// 初始显示工程值
const a = mount(57);
assert(a.shown() === '57', '初始显示工程值 57（' + a.shown() + '）');
assert(a.selected === 0, '未聚焦时不触发全选');

// 聚焦即全选：直接敲新值就是替换，不必先逐字删除
a.focus();
assert(a.selected === 1, '聚焦时全选整个值（select 调用 ' + a.selected + ' 次）');

// 核心回归：57 → 28 过程中不能提交中间态
a.type('5');
assert(a.commits.length === 0, '删掉 7 只剩 5 时不提交（commits=' + a.commits.length + '）');
assert(a.shown() === '5', '输入框显示草稿 5（' + a.shown() + '）');
a.type('28');
assert(a.commits.length === 0, '继续输入 28 时仍不提交（commits=' + a.commits.length + '）');
assert(a.shown() === '28', '输入框显示草稿 28（' + a.shown() + '）');
a.blur();
assert(a.commits.length === 1 && a.commits[0] === 28, '失焦时提交一次 28（' + JSON.stringify(a.commits) + '）');
a.apply();
assert(a.shown() === '28', '提交后回显工程值 28（' + a.shown() + '）');

// 空值放弃编辑
a.focus();
a.type('');
a.blur();
assert(a.commits.length === 1, '清空后失焦不提交（commits=' + a.commits.length + '）');
assert(a.shown() === '28', '清空后回显工程值（' + a.shown() + '）');

// 越界夹紧
a.focus();
a.type('999');
a.blur();
assert(a.commits[1] === 150, '超过上限夹到 150（' + a.commits[1] + '）');
a.apply();
a.focus();
a.type('3');
a.blur();
assert(a.commits[2] === 5, '低于下限夹到 5（' + a.commits[2] + '）');
a.apply();

// 同值不提交（避免污染撤销历史）
const before = a.commits.length;
a.focus();
a.type('5');
a.blur();
assert(a.commits.length === before, '输入与当前值相同不提交（commits=' + a.commits.length + '）');

// 上下键步进仍然即时生效
a.focus();
a.press('ArrowUp');
assert(a.commits[a.commits.length - 1] === 6, '↑ 步进 +1 立即提交（' + a.commits[a.commits.length - 1] + '）');
a.apply();
a.press('ArrowDown');
assert(a.commits[a.commits.length - 1] === 5, '↓ 步进 -1 立即提交（' + a.commits[a.commits.length - 1] + '）');
a.apply();

// Esc 放弃编辑，且 blur 不能再把它提交出去
const n0 = a.commits.length;
a.type('99');
a.press('Escape');
assert(a.commits.length === n0, 'Esc 放弃编辑不提交（commits=' + a.commits.length + '）');
assert(a.shown() === '5', 'Esc 后回显工程值（' + a.shown() + '）');

// 回车提交但不夺焦点（避免二次 onBlur 重复提交同一尺寸）
const n1 = a.commits.length;
a.focus();
a.type('12');
a.press('Enter');
assert(a.commits.length === n1 + 1 && a.commits[a.commits.length - 1] === 12,
  '回车提交一次 12（' + JSON.stringify(a.commits.slice(n1)) + '）');
a.apply();

// 面包板：高度提交后走 M0 换算，这里只确认组件把数值原样交给宿主
const b = mount(30);
b.focus();
b.type('46');
b.blur();
assert(b.commits.length === 1 && b.commits[0] === 46, '板高同样只在提交时落盘（' + JSON.stringify(b.commits) + '）');

console.log(res.join('\n'));
console.log(res.every((r) => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
