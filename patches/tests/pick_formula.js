// Regression test for the __lcPinFromEvent NDC mapping (v3.2.1 P0 fix).
// Extracts the LIVE formula from the built bundle, then verifies numerically
// (hand-rolled three.js-equivalent projection, mirroring review agent2's math)
// that a click on a pin's projected screen position casts a ray through that pin.
'use strict';
const fs = require('fs');
const path = require('path');

const BUNDLE = path.join(__dirname, '../../src/dist/assets/index-C0NrTOjn.js');
const bundle = fs.readFileSync(BUNDLE, 'utf8');

let fails = 0;
const assert = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails = 1; };

// ---- extract the live NDC expression from the bundle ----
const i0 = bundle.indexOf('function __lcPinFromEvent');
if (i0 < 0) { console.error('FATAL __lcPinFromEvent not in bundle'); process.exit(1); }
const callIdx = bundle.indexOf('new Ot(', i0);
let depth = 0, end = -1;
for (let k = callIdx + 7; k < bundle.length; k++) {
  if (bundle[k] === '(') depth++;
  else if (bundle[k] === ')') { if (depth === 0) { end = k; break; } depth--; }
}
const args = bundle.slice(callIdx + 7, end); // "AX,AY"
const comma = args.indexOf(',');
const AX = args.slice(0, comma), AY = args.slice(comma + 1);
const evalNDC = new Function('ev', 'r', 'return [' + AX + ',' + AY + '];');

// semantic: top of canvas must map to y=+1, bottom to y=-1
const rect = { left: 0, top: 0, width: 800, height: 600 };
const yTop = evalNDC({ clientX: 400, clientY: 0 }, rect)[1];
const yBot = evalNDC({ clientX: 400, clientY: 600 }, rect)[1];
assert(Math.abs(yTop - 1) < 1e-9, 'canvas top -> NDC y=+1 (buggy formula gave -1), got ' + yTop);
assert(Math.abs(yBot + 1) < 1e-9, 'canvas bottom -> NDC y=-1, got ' + yBot);

// ---- minimal three.js-equivalent projection math ----
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function mul(a, b) { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function apply(m, v) { const o = [0, 0, 0, 0]; for (let r = 0; r < 4; r++) o[r] = m[0 * 4 + r] * v[0] + m[1 * 4 + r] * v[1] + m[2 * 4 + r] * v[2] + m[3 * 4 + r] * v[3]; return o; }
function inv4(m) {
  const a = m.slice(), o = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (let col = 0; col < 4; col++) {
    let piv = col;
    for (let r = col + 1; r < 4; r++) if (Math.abs(a[col * 4 + r]) > Math.abs(a[col * 4 + piv])) piv = r;
    if (a[col * 4 + piv] === 0) throw new Error('singular');
    if (piv !== col) for (let c = 0; c < 4; c++) { const ca = c * 4 + col, cp = c * 4 + piv; const t1 = a[ca]; a[ca] = a[cp]; a[cp] = t1; const t2 = o[ca]; o[ca] = o[cp]; o[cp] = t2; }
    const d = a[col * 4 + col];
    for (let c = 0; c < 4; c++) { a[c * 4 + col] /= d; o[c * 4 + col] /= d; }
    for (let r = 0; r < 4; r++) {
      if (r === col) continue;
      const f = a[col * 4 + r]; if (!f) continue;
      for (let c = 0; c < 4; c++) { a[c * 4 + r] -= f * a[c * 4 + col]; o[c * 4 + r] -= f * o[c * 4 + col]; }
    }
  }
  return o;
}
function lookAt(eye, target) {
  const z = norm(sub(eye, target)), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
  return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, eye[0], eye[1], eye[2], 1];
}
function viewOf(eye, target) {
  const z = norm(sub(eye, target)), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]), -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]), -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1];
}
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
const BOARD_W = 30, BOARD_H = 20;                 // default new-project board (holes)
const eye = [49.5, 41.25, 49.5];                  // app first-frame camera (te=55? default view)
const world = lookAt(eye, [0, 0, 0]);
const view = viewOf(eye, [0, 0, 0]);
const proj = perspective(45 * Math.PI / 180, 1.6, .1, 6000);
const viewProj = mul(proj, view);
const viewProjInv = mul(world, inv4(proj));
function rayFromNDC(x, y) {
  const w = apply(viewProjInv, [x, y, 0.5, 1]);
  const dir = norm(sub([w[0] / w[3], w[1] / w[3], w[2] / w[3]], eye));
  return { o: eye, d: dir };
}
function ndcOf(p) { const c = apply(viewProj, [p[0], p[1], p[2], 1]); return [c[0] / c[3], c[1] / c[3]]; }
// dev_board 2x15 pin grid world positions (py=0.95 as in __lcPinFromEvent)
const pins = [];
for (let gx = 0; gx <= 14; gx++) for (let gz = 0; gz <= 5; gz++) {
  pins.push([gx - BOARD_W / 2 + .5, .95, gz * 6 - BOARD_H / 2 + .5]);
}
function minDist(ray) {
  let best = Infinity;
  for (const p of pins) {
    const vx = p[0] - ray.o[0], vy = p[1] - ray.o[1], vz = p[2] - ray.o[2];
    const t = vx * ray.d[0] + vy * ray.d[1] + vz * ray.d[2];
    if (t < 0) continue;
    const dx = vx - ray.d[0] * t, dy = vy - ray.d[1] * t, dz = vz - ray.d[2] * t;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < best) best = d;
  }
  return best;
}

// click exactly on projected pin positions -> live formula must cast through the pin
let hits = 0, worst = 0;
const probes = pins.filter((_, idx) => idx % 7 === 0);
for (const p of probes) {
  const ndc = ndcOf(p);
  const clientX = (ndc[0] + 1) / 2 * rect.width;
  const clientY = (1 - ndc[1]) / 2 * rect.height;
  const ndc2 = evalNDC({ clientX, clientY }, rect);
  const rt = Math.hypot(ndc2[0] - ndc[0], ndc2[1] - ndc[1]);
  worst = Math.max(worst, rt);
  if (minDist(rayFromNDC(ndc2[0], ndc2[1])) < 0.62) hits++;
}
assert(worst < 1e-6, 'extracted formula roundtrips screen<->NDC (max err ' + worst.toExponential(2) + ')');
assert(hits === probes.length, 'clicking projected pin positions picks the pin: ' + hits + '/' + probes.length + ' (was 0% with the buggy formula)');

console.log(fails ? 'HAS FAILURES' : 'ALL PASS');
process.exitCode = fails;
