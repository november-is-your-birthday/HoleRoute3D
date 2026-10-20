// 离线回归基准：把真实的自动放置 worker 载入 Node，直接调用其内部算法函数。
// 仅用于开发期跑分对比，不参与打包，不影响 app.asar。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const WORKER = path.resolve(__dirname, '..', 'src', 'dist', 'assets', 'autoPlacement.worker-CtyuXT3o.js');

// 需要从 IIFE 内部导出的函数（worker 路由副本 = 主包 Y4 的等价实现）
const EXPORTS = ['pn', 'wn', 'hi', 'gi', 'q', 'Pn', 'lt', 'dt', 'Kn', 'mn', 'A', 'Dt'];

function loadWorker(workerPath = WORKER) {
  return loadWorkerSource(fs.readFileSync(workerPath, 'utf8'), workerPath);
}

// 直接载入一段 worker 源码（消融实验用：先对源码做开关变换，再执行）
function loadWorkerSource(src, label = '<inline>') {
  const anchor = 'self.onmessage=';
  if (src.indexOf(anchor) < 0) throw new Error('worker 结构变化：找不到 self.onmessage 锚点');
  const hook = 'self.__H={' + EXPORTS.join(',') + '};';
  const patched = src.replace(anchor, hook + anchor);

  const sandbox = {
    self: { onmessage: null, postMessage() {} },
    crypto: require('node:crypto').webcrypto,
    console,
    performance,
    setTimeout: undefined,
    clearTimeout: undefined,
  };
  vm.createContext(sandbox);
  vm.runInContext(patched, sandbox, { filename: label });

  const api = sandbox.self.__H;
  if (!api) throw new Error('worker 内部导出失败');
  const missing = EXPORTS.filter((k) => typeof api[k] !== 'function' && typeof api[k] !== 'object');
  if (missing.length) throw new Error('缺少导出: ' + missing.join(','));
  return { api, patchedSource: patched, source: src };
}

module.exports = { loadWorker, loadWorkerSource, WORKER, EXPORTS };
