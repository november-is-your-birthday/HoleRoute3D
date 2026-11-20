// 实机验收：元件库 NPN/PNP 条目 + 属性面板极性显示
// 用法：node check_pnp_live.mjs   （需先启动带 --remote-debugging-port=9362 的实例）
const PORT = process.env.CDP_PORT || 9362;
import os from 'node:os';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function pageTarget() {
  for (let i = 0; i < 20; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const p = list.find(x => x.type === 'page');
      if (p) return p;
    } catch (e) {}
    await sleep(500);
  }
  throw new Error('no page target on port ' + PORT);
}

const t = await pageTarget();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result || {});
  }
};
function call(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const evaluate = async (expr) => {
  const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'eval failed');
  return r.result.value;
};

await call('Page.enable'); await call('Runtime.enable');
await call('Page.bringToFront');
await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(2500);

const report = {};
report.title = await evaluate('document.title');

// 0) 先新建一个工程（否则工具栏与 3D 画布都不存在）
report.newProject = await evaluate(`(() => {
  if (window.__lcProject) return 'ALREADY_OPEN';
  const buttons = () => [...document.querySelectorAll('button')];
  let b = buttons().find(x => (x.textContent || '').trim() === '创建');
  if (b) { b.click(); return 'CREATE_CLICKED'; }
  b = buttons().find(x => (x.textContent || '').trim() === '新建工程');
  if (!b) return 'NO_NEW_BUTTON';
  b.click();
  return 'NEW_CLICKED';
})()`);
await sleep(400);
await evaluate(`(() => {
  if (window.__lcProject) return 'OPEN';
  const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === '创建');
  if (b) { b.click(); return 'CREATE_CLICKED'; }
  return 'NO_CREATE_BUTTON';
})()`);
await sleep(1200);

// 1) 打开元件库弹窗
await evaluate(`(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find(x => /元件库/.test(x.textContent || ''));
  if (!b) return 'NO_LIB_BUTTON';
  b.click(); return 'OK';
})()`);
await sleep(800);

report.lib = await evaluate(`(() => {
  const items = [...document.querySelectorAll('.component-library-dialog-grid .library-item')];
  const tri = items.map(x => (x.querySelector('span') || {}).textContent || '')
    .filter(t => /NPN|PNP/.test(t));
  return { total: items.length, tri: tri };
})()`);
report.libShot = await (async () => {
  const d = await call('Page.captureScreenshot', { format: 'png' });
  return d.data.length;
})();
{
  const d = await call('Page.captureScreenshot', { format: 'png' });
  const fs = await import('fs');
  fs.writeFileSync((process.env.TEMP || os.tmpdir()) + '/pr3d-pnp-lib.png', Buffer.from(d.data, 'base64'));
}

// 2) 点「TO-92 PNP（S8550）」→ 待放置 → 点板面落板
report.place = await evaluate(`(() => {
  const b = [...document.querySelectorAll('.component-library-dialog-grid .library-item')]
    .find(x => (x.getAttribute('title') || '').includes('TO-92 PNP（S8550）'));
  if (!b) return 'NO_ITEM';
  b.click();
  return 'CLICKED';
})()`);
await sleep(600);

// 板面中心按下/抬起，走真实的指针事件完成落板
{
  const box = await evaluate(`(() => {
    const c = document.querySelector('.three-viewport canvas') || document.querySelector('canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) report.boardClick = 'NO_CANVAS';
  else {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await call('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
    }
    report.boardClick = 'dispatched@' + Math.round(box.x) + ',' + Math.round(box.y);
  }
}
await sleep(800);

report.afterPlace = await evaluate(`(() => {
  const pj = window.__lcProject || {};
  const cs = pj.components || [];
  const q = cs.filter(c => /^Q/.test(c.name || ''));
  return {
    total: cs.length,
    q: q.map(c => ({ name: c.name, value: c.value, footprint: c.footprint, kind: c.kind })),
  };
})()`);
report.pnpPanel = await evaluate(`(() => {
  const pj = window.__lcProject || {};
  const c = (pj.components || []).find(x => x.value && /8550/.test(x.value));
  if (!c) return 'NO_PNP_PART';
  const body = document.body.innerText || '';
  const i = body.indexOf('脚1');
  return {
    comp: { name: c.name, value: c.value, footprint: c.footprint, kind: c.kind },
    panelSnippet: i >= 0 ? body.slice(Math.max(0, i - 40), i + 180) : 'NO_PANEL_TEXT',
    bodyHasPNP: /PNP/.test(body),
  };
})()`);
{
  const d = await call('Page.captureScreenshot', { format: 'png' });
  const fs = await import('fs');
  fs.writeFileSync((process.env.TEMP || os.tmpdir()) + '/pr3d-pnp-panel.png', Buffer.from(d.data, 'base64'));
}

// 3) 再放一颗 SOT-23 NPN，验证 NPN 显示与 SOT-23 封装族
await evaluate(`(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find(x => /元件库/.test(x.textContent || ''));
  if (b) b.click();
})()`);
await sleep(500);
await evaluate(`(() => {
  const b = [...document.querySelectorAll('.component-library-dialog-grid .library-item')]
    .find(x => (x.getAttribute('title') || '').includes('SOT-23 NPN（MMBT3904）'));
  if (!b) return 'NO_ITEM';
  b.click(); return 'OK';
})()`);
await sleep(500);
{
  const box = await evaluate(`(() => {
    const c = document.querySelector('.three-viewport canvas') || document.querySelector('canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width * 0.35, y: r.top + r.height * 0.45 };
  })()`);
  if (!box) report.boardClick2 = 'NO_CANVAS';
  else {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await call('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
    }
    report.boardClick2 = 'dispatched@' + Math.round(box.x) + ',' + Math.round(box.y);
  }
}
await sleep(800);
report.npnPanel = await evaluate(`(() => {
  const pj = window.__lcProject || {};
  const c = (pj.components || []).find(x => x.value && /MMBT3904/.test(x.value));
  if (!c) return 'NO_NPN_PART';
  const body = document.body.innerText || '';
  const i = body.indexOf('脚1');
  return {
    comp: { name: c.name, value: c.value, footprint: c.footprint, kind: c.kind },
    panelSnippet: i >= 0 ? body.slice(Math.max(0, i - 40), i + 180) : 'NO_PANEL_TEXT',
    bodyHasNPN: /NPN/.test(body),
  };
})()`);
{
  const d = await call('Page.captureScreenshot', { format: 'png' });
  const fs = await import('fs');
  fs.writeFileSync((process.env.TEMP || os.tmpdir()) + '/pr3d-pnp-npn.png', Buffer.from(d.data, 'base64'));
}

console.log(JSON.stringify(report, null, 2));
ws.close();
process.exit(0);
