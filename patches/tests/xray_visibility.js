// 回归测试：透视模式（X-ray）下两侧走线组都应可见。
// 历史 bug：MR() 每帧按相机高度把背面走线组整组 visible=false，
// 导致「透视」只让板体变透明，却始终看不到对面走线。
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BUNDLE = path.join(__dirname, '../../src/dist/assets/index-C0NrTOjn.js');
const bundle = fs.readFileSync(BUNDLE, 'utf8');

function grabFn(src, name) {
  const sig = 'function ' + name + '(';
  const i = src.indexOf(sig);
  if (i < 0) throw new Error('fn not found: ' + name);
  const b = src.indexOf('{', src.indexOf(')', i));
  let d = 0, e = -1;
  for (let k = b; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) { e = k; break; } }
  }
  return src.slice(i, e + 1) + '\n';
}

const sandbox = { window: {}, Math, JSON, String, Number, Array, Object, console };
vm.createContext(sandbox);
vm.runInContext(grabFn(bundle, 'MR'), sandbox);

const res = [];
const assert = (cond, msg) => { res.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

function mkSides() {
  return {
    children: [
      { userData: { routeSide: 'top' }, visible: true },
      { userData: { routeSide: 'bottom' }, visible: true },
      { userData: {}, visible: true },
    ],
  };
}

const run = (transparent, camY) => {
  sandbox.window.__lcBoardArgs = { transparent: transparent };
  sandbox.window.__lcRats = null;
  sandbox.window.__lcRatsOn = true;
  const group = mkSides();
  const cam = { position: { y: camY } };
  const target = { y: 0 };
  vm.runInContext('MR(__g,__cam,__tgt)', Object.assign(sandbox, { __g: group, __cam: cam, __tgt: target }));
  return { top: group.children[0].visible, bottom: group.children[1].visible };
};

// 1) 非透视 + 相机在上方：只露正面（top），背面隐藏 —— 保持原有行为
let r = run(false, 80);
assert(r.top === true && r.bottom === false, '非透视 / 上方视角：top=true bottom=false，实际 ' + JSON.stringify(r));

// 2) 非透视 + 相机在下方：只露背面（bottom）
r = run(false, -80);
assert(r.top === false && r.bottom === true, '非透视 / 下方视角：top=false bottom=true，实际 ' + JSON.stringify(r));

// 3) 透视 + 上方视角：两侧都要可见（本次修复的核心断言）
r = run(true, 80);
assert(r.top === true && r.bottom === true, '透视 / 上方视角：两侧都可见，实际 ' + JSON.stringify(r));

// 4) 透视 + 下方视角：同样两侧可见
r = run(true, -80);
assert(r.top === true && r.bottom === true, '透视 / 下方视角：两侧都可见，实际 ' + JSON.stringify(r));

// 5) 没有 routeSide 的子组不应被误改
sandbox.window.__lcBoardArgs = { transparent: false };
const g5 = mkSides();
g5.children[2].visible = true;
vm.runInContext('MR(__g,__cam,__tgt)', Object.assign(sandbox, { __g: g5, __cam: { position: { y: 80 } }, __tgt: { y: 0 } }));
assert(g5.children[2].visible === true, '无 routeSide 的子组保持原状');

// 6) 飞线在透视模式下也应可见（此前只在相机位于板下方才显示）
const rats = { visible: false, parent: {} };
sandbox.window.__lcBoardArgs = { transparent: false };
sandbox.window.__lcRats = rats;
sandbox.window.__lcRatsOn = true;
vm.runInContext('MR(__g,__cam,__tgt)', Object.assign(sandbox, { __g: mkSides(), __cam: { position: { y: 80 } }, __tgt: { y: 0 } }));
assert(rats.visible === false, '非透视 / 上方视角：飞线隐藏（保持原行为）');

rats.visible = false;
sandbox.window.__lcBoardArgs = { transparent: true };
vm.runInContext('MR(__g,__cam,__tgt)', Object.assign(sandbox, { __g: mkSides(), __cam: { position: { y: 80 } }, __tgt: { y: 0 } }));
assert(rats.visible === true, '透视 / 上方视角：飞线可见');

// 7) 飞线开关关闭时，透视也不该强行显示
rats.visible = true;
sandbox.window.__lcRatsOn = false;
vm.runInContext('MR(__g,__cam,__tgt)', Object.assign(sandbox, { __g: mkSides(), __cam: { position: { y: 80 } }, __tgt: { y: 0 } }));
assert(rats.visible === false, '飞线开关关闭时透视也不显示');

console.log(res.join('\n'));
console.log(res.every(x => x.startsWith('PASS')) ? 'ALL PASS' : 'HAS FAILURES');
