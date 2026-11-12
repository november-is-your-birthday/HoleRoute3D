// 回归测试：撤销历史步数上限（此前硬编码 50 步）与重做。
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

const store = {};
const sandbox = {
  window: {}, Math, JSON, String, Number, Array, Object, console,
  localStorage: {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  },
};
vm.createContext(sandbox);
vm.runInContext(grabFn(bundle, 'function __lcHistoryLimit('), sandbox);

const limit = () => vm.runInContext('__lcHistoryLimit()', sandbox);
const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

assert(limit() === 200, '默认上限 200，实际 ' + limit());

store['lc-history'] = '500';
assert(limit() === 500, '可配置为 500，实际 ' + limit());

store['lc-history'] = '10';
assert(limit() === 20, '低于下限时夹到 20，实际 ' + limit());

store['lc-history'] = '99999';
assert(limit() === 1000, '高于上限时夹到 1000，实际 ' + limit());

store['lc-history'] = 'abc';
assert(limit() === 200, '非法值回落默认 200，实际 ' + limit());

store['lc-history'] = '';
assert(limit() === 200, '空串回落默认 200，实际 ' + limit());

delete store['lc-history'];
assert(limit() === 200, '清空后回到默认值');

// 提交流程真的用了这个上限，且不再有硬编码 50
assert(bundle.indexOf('v.current.slice(-49)') < 0, '不再存在硬编码 slice(-49)');
assert(bundle.indexOf('v.current=[...v.current.slice(-(__lcHistoryLimit()-1)),rt]') >= 0,
  '提交时按 __lcHistoryLimit() 截断');
assert(bundle.indexOf('window.__lcRedo=[]') >= 0, '提交时清空重做栈');
assert(bundle.indexOf('function __lcRedoStep()') >= 0, '存在重做函数');
assert(bundle.indexOf('undo:"Ctrl+Z"') >= 0 && bundle.indexOf('redo:"Ctrl+Shift+Z"') >= 0,
  '默认快捷键含 Ctrl+Z / Ctrl+Shift+Z');
assert(bundle.indexOf('ri(d.shortcuts.redo,!0,__lcRedoStep)') >= 0, '重做已注册到快捷键表');

console.log(res.join('\n'));
console.log(res.every(r => r.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
