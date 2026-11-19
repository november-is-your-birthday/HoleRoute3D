'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'src/dist/assets/index-C0NrTOjn.js'), 'utf8');

function grabFunction(name, input = source) {
  const marker = 'function ' + name + '(';
  let start = input.indexOf(marker);
  if (start < 0) throw new Error('Missing ' + name);
  if (input.slice(start - 6, start) === 'async ') start -= 6;
  const opening = input.indexOf('{', start);
  let depth = 0;
  for (let index = opening; index < input.length; index += 1) {
    if (input[index] === '{') depth += 1;
    if (input[index] === '}' && --depth === 0) return input.slice(start, index + 1);
  }
  throw new Error('Unbalanced ' + name);
}

function loadApp() {
  const element = () => ({
    style: {}, relList: { supports: () => true },
    setAttribute() {}, addEventListener() {}, appendChild() {},
    getContext: () => null,
  });
  const document = {
    createElement: element, getElementById: () => null, querySelectorAll: () => [],
    addEventListener() {}, head: element(), body: element(),
    documentElement: { style: {}, dataset: {} },
  };
  const storage = new Map();
  const window = {
    addEventListener() {}, removeEventListener() {},
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    location: { protocol: 'file:' },
    setTimeout: () => 0, clearTimeout() {},
  };
  const sandbox = {
    console, document, window,
    localStorage: window.localStorage,
    navigator: { userAgent: 'node-verify' },
    performance,
    crypto: require('node:crypto').webcrypto,
    setTimeout: () => 0, clearTimeout() {},
    URL, Headers, AbortController, TextEncoder, TextDecoder,
  };
  vm.createContext(sandbox);
  const runtime = source.slice(0, source.lastIndexOf('JM.createRoot('))
    .replaceAll('import.meta.url', '"file:///verify/index.js"');
  vm.runInContext(runtime, sandbox, { filename: 'application-bundle.js', timeout: 10000 });
  return sandbox;
}

module.exports = { ROOT, source, grabFunction, loadApp };
