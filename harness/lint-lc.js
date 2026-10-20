#!/usr/bin/env node
/**
 * lint-lc.js —— 检查主包 / worker 里 __lc* 补丁函数所调用的标识符是否真实存在、参数是否够用。
 *
 * 背景：minified bundle 里的两字母函数名在不同文件里含义完全不同。
 * 例如 `$e` 在 worker 中是"枚举路径边"，在主包里却是 React 的错误捕获函数；
 * `ri` 在 worker 中是"拐弯计数"，在主包里是"快捷键描述对象"。
 * 把 worker 的实现照搬到主包时，这类同名不同义会静默通过 `node --check`，运行时才抛错，
 * 表现是"点了按钮没反应"（异常打断了 React 的状态更新）。
 *
 * 检查内容：
 *   1. 目标文件里所有 function / class / const / let / var 声明（含解构）都进符号表；
 *   2. 抽出所有 `function __lc…` 的函数体，跳过字符串与注释后扫描其中的函数调用；
 *   3. 名字找不到 → ERROR；名字存在但实参少于必填形参 → WARN（很可能是同名不同义）。
 *
 * 用法：
 *   node harness/lint-lc.js            # 检查两个 bundle
 *   node harness/lint-lc.js --strict   # WARN 也算失败
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TARGETS = [
  'src/dist/assets/index-C0NrTOjn.js',
  'src/dist/assets/autoPlacement.worker-CtyuXT3o.js',
];
// 允许 `node harness/lint-lc.js path/to/bundle.js` 只检查指定文件
const CLI_TARGETS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const TARGETS = CLI_TARGETS.length ? CLI_TARGETS : DEFAULT_TARGETS;

const GLOBALS = new Set([
  'Math', 'JSON', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Array', 'Object', 'String', 'Number',
  'Boolean', 'Date', 'Error', 'TypeError', 'RangeError', 'Promise', 'RegExp', 'Symbol', 'BigInt',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'structuredClone', 'queueMicrotask', 'requestAnimationFrame',
  'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'console', 'window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'performance',
  'crypto', 'self', 'globalThis', 'alert', 'confirm', 'prompt', 'fetch', 'URL', 'URLSearchParams',
  'Intl', 'require', 'module', 'exports', 'process', 'Buffer', '__dirname', 'arguments',
  // 关键字
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof', 'new', 'do', 'else',
]);

/** 把字符串 / 模板字面量 / 注释内容替换为等长空格，保持下标不变。 */
function stripLiterals(src) {
  const out = src.split('');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') { out[i] = ' '; i += 1; }
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (; i < stop; i += 1) if (src[i] !== '\n') out[i] = ' ';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i += 1;
      while (i < src.length) {
        if (src[i] === '\\') { out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
        if (src[i] === q) break;
        if (src[i] !== '\n') out[i] = ' ';
        i += 1;
      }
    }
  }
  return out.join('');
}

function matchParen(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseParams(raw) {
  const params = raw.split(',').map((s) => s.trim()).filter(Boolean);
  let required = 0;
  params.forEach((p) => {
    if (p.startsWith('...') || p.includes('=')) return;
    required += 1;
  });
  return { total: params.length, required };
}

function loadFile(rel) {
  const file = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  const src = fs.readFileSync(file, 'utf8');

  const decls = new Map();   // name -> [{required, total, kind}]
  const symbols = new Set();

  const add = (name, info) => {
    symbols.add(name);
    if (!info) return;
    if (!decls.has(name)) decls.set(name, []);
    decls.get(name).push(info);
  };

  // function 声明
  const fnRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = fnRe.exec(src))) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(src, open);
    if (close < 0) continue;
    add(m[1], { ...parseParams(src.slice(open + 1, close)), kind: 'function' });
  }

  // class 声明
  const clsRe = /\bclass\s+([A-Za-z_$][\w$]*)/g;
  while ((m = clsRe.exec(src))) add(m[1], null);

  // 普通变量声明（记录种类，用于识别"只在小函数里 var 声明"的情况）
  const varRe = /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g;
  while ((m = varRe.exec(src))) add(m[2], { kind: m[1], required: 0, total: 0 });

  // 解构声明：const [a,b] = … / const {x,y} = …
  const desRe = /\b(?:const|let|var)\s*[[{]([^\]}]*)[\]}]\s*=/g;
  while ((m = desRe.exec(src))) {
    m[1].split(',').forEach((part) => {
      const name = part.split(':').pop().split('=')[0].trim().replace(/^\.\.\./, '');
      if (/^[A-Za-z_$][\w$]*$/.test(name)) symbols.add(name);
    });
  }

  // 解构赋值的续写形式：const [a,b]=x,[c,d]=y 里的 [c,d]
  const desAssignRe = /\[([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)+)\]\s*=/g;
  while ((m = desAssignRe.exec(src))) {
    m[1].split(',').forEach((n) => symbols.add(n.trim()));
  }

  // 补丁函数
  const patches = [];
  const lcRe = /\bfunction\s+(__lc[A-Za-z0-9_$]*)\s*\(/g;
  while ((m = lcRe.exec(src))) {
    const pOpen = m.index + m[0].length - 1;
    const pClose = matchParen(src, pOpen);
    if (pClose < 0) continue;
    const brace = src.indexOf('{', pClose);
    if (brace < 0) continue;
    const end = matchBrace(src, brace);
    if (end < 0) continue;
    patches.push({
      name: m[1],
      params: src.slice(pOpen + 1, pClose),
      body: src.slice(brace, end + 1),
    });
  }

  return { file, decls, symbols, patches };
}

function check({ decls, symbols, patches }) {
  const errors = [];
  const warnings = [];

  patches.forEach(({ name, params, body: rawBody }) => {
    const body = stripLiterals(rawBody);   // 只在函数体内屏蔽字符串，保持下标一致
    const local = new Set();
    params.split(',').map((s) => s.trim().replace(/^\.\.\./, '').split('=')[0].trim())
      .filter(Boolean).forEach((p) => local.add(p));

    // 体内的声明 + 箭头函数参数 + 回调参数
    const localRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)\s*=>|\bfunction\s*([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g;
    let lm;
    while ((lm = localRe.exec(body))) {
      if (lm[1]) local.add(lm[1]);
      if (lm[2]) local.add(lm[2]);
      if (lm[3]) local.add(lm[3]);
      if (lm[4]) lm[4].split(',').map((s) => s.trim()).filter(Boolean).forEach((p) => local.add(p));
    }
    // 解构（如 const {a,b}=…）
    const desRe = /(?:const|let|var)\s*[[{]([^\]}]*)[\]}]\s*=/g;
    let dm;
    while ((dm = desRe.exec(body))) {
      dm[1].split(',').forEach((part) => {
        const nm = part.split(':').pop().split('=')[0].trim().replace(/^\.\.\./, '');
        if (/^[A-Za-z_$][\w$]*$/.test(nm)) local.add(nm);
      });
    }

    const callRe = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
    let cm;
    while ((cm = callRe.exec(body))) {
      const target = cm[1];
      if (local.has(target) || GLOBALS.has(target)) continue;

      const open = cm.index + cm[0].length - 1;
      const close = matchParen(body, open);
      if (close < 0) continue;
      const argRaw = body.slice(open + 1, close);
      const argCount = argRaw.trim() === '' ? 0 : argRaw.split(',').length;

      if (!symbols.has(target)) {
        errors.push(`${name}(): 调用了文件里不存在的标识符 ${target}()`);
        continue;
      }
      const all = decls.get(target) || [];
      if (all.length && all.every((d) => d.kind === 'var')) {
        warnings.push(`${name}(): ${target}() 只以 var 声明在别处，补丁作用域里可能不可见`);
        continue;
      }
      const defs = all.filter((d) => d.kind === 'function');
      if (!defs.length) continue;
      if (!defs.some((d) => argCount >= d.required)) {
        const d = defs.reduce((a, b) => (a.required <= b.required ? a : b));
        warnings.push(
          `${name}(): ${target}() 实参 ${argCount} 个，声明至少需要 ${d.required} 个 —— 可能是同名不同义`
        );
      }
    }
  });

  return { errors, warnings };
}

function main() {
  const strict = process.argv.includes('--strict');
  let failed = 0;
  let totalPatches = 0;

  TARGETS.forEach((rel) => {
    const info = loadFile(rel);
    const { errors, warnings } = check(info);
    totalPatches += info.patches.length;

    console.log(`\n=== ${rel}（${info.patches.length} 个 __lc* 函数）===`);
    if (!errors.length && !warnings.length) {
      console.log('  OK：补丁函数调用的标识符都存在，参数数量合理');
    }
    errors.forEach((e) => console.log('  ERROR ' + e));
    warnings.forEach((w) => console.log('  WARN  ' + w));
    if (errors.length || (strict && warnings.length)) failed += 1;
  });

  console.log(`\n合计检查 ${totalPatches} 个补丁函数，${failed ? failed + ' 个文件有问题' : '全部通过'}`);
  process.exit(failed ? 1 : 0);
}

main();
