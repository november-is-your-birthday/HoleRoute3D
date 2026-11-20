'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./app-sandbox.cjs');
const { buildFixtures, clone, mulberry32 } = require('./fixtures.js');
const { measure } = require('./metrics.js');
const { checkPlan } = require('./check.js');
const app = loadApp();
const previousArgument = process.argv.find(argument => argument.startsWith('--previous='));
const previous = previousArgument ? JSON.parse(fs.readFileSync(path.resolve(previousArgument.slice(11)), 'utf8')) : null;
const fixtures = buildFixtures().filter(fixture => fixture.components.every(component => component.mounted));
for (const seed of [7, 29, 101, 503, 2027, 65537]) {
  const fixture = clone(fixtures[0]), random = mulberry32(seed);
  fixture.name = 'seed-' + seed;
  for (let index = fixture.endpoints.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [fixture.endpoints[index], fixture.endpoints[other]] = [fixture.endpoints[other], fixture.endpoints[index]];
  }
  fixture.endpoints.forEach((endpoint, index) => { endpoint.net = 'N' + Math.floor(index / 3); });
  fixtures.push(fixture);
}

function run(fixture, route) {
  const input = clone(fixture), snapshot = JSON.stringify(input), start = performance.now();
  const plan = route(input.board, input.endpoints, input.components);
  const milliseconds = Math.round(performance.now() - start);
  assert.equal(JSON.stringify(input), snapshot, fixture.name + ': input mutation');
  const check = checkPlan(input.board, input.components, input.endpoints, plan);
  assert.equal(check.unconnectedNets + check.shortGroups + check.illegalSegments + check.offBoard, 0, JSON.stringify(check));
  assert.equal(plan.drc.errors.length, 0, fixture.name + ': DRC');
  assert.equal(plan.failedNets.length, 0, fixture.name + ': failed nets');
  return { ...measure(plan), milliseconds, check, optimization: plan.diagnostics?.optimization };
}

const results = fixtures.map(fixture => {
  const before = run(fixture, app.__lcLegacyRouteMain);
  const after = run(fixture, app.Y4);
  assert.ok(after.jumpers <= before.jumpers, fixture.name + ': more jumpers');
  assert.ok(after.milliseconds < 60000, fixture.name + ': exceeds one minute');
  const prior = previous?.results.find(entry => entry.name === fixture.name)?.after;
  if (prior) assert.ok(after.jumpers <= prior.jumpers, fixture.name + ': regresses the previous optimization');
  console.log(fixture.name.padEnd(16), String(before.jumpers).padStart(3), '->', String(after.jumpers).padStart(3),
    'jumpers;', String(after.milliseconds).padStart(5), 'ms; independent connectivity + DRC PASS');
  return { name: fixture.name, before, previous: prior, after };
});
const total = results.reduce((sum, entry) => ({ before: sum.before + entry.before.jumpers, after: sum.after + entry.after.jumpers }), { before: 0, after: 0 });
console.log('Total:', total.before, '->', total.after, 'jumpers');
const output = process.argv.find(argument => argument.startsWith('--save='));
if (output) fs.writeFileSync(path.resolve(output.slice(7)), JSON.stringify({ at: new Date().toISOString(), results, total }, null, 2) + '\n');
