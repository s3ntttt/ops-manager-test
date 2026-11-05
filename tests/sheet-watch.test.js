const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

test('live-sync helpers exist (they were once lost in a refactor)', () => {
  const app = loadApp();
  for (const fn of ['applyRemoteData', 'captureFocusSnapshot', 'restoreFocusSnapshot', 'pollRoster', 'diffRoster'])
    assert.equal(app.run(`typeof ${fn}`), 'function', fn);
});

test('diffRoster reports only on-duty changes and the headcount delta', () => {
  const app = loadApp();
  const mk = (id, st, schedVal, half) => ({ id, shortName: id, avail: { st, half }, schedVal });
  app.ctx.__a = [mk('A', 'WORKING', 'NIGHT'), mk('B', 'WORKING', 'NIGHT'), mk('C', 'OFF', 'AL'), mk('D', 'WORKING', 'NIGHT')];
  app.ctx.__b = [mk('A', 'WORKING', 'NIGHT'), mk('B', 'OFF', 'MC'), mk('C', 'WORKING', '(1/2) NIGHT', true), mk('D', 'WORKING', 'NIGHT'), mk('E', 'WORKING', 'B/U NIGHT')];
  const d = JSON.parse(app.run('JSON.stringify(diffRoster(__a, __b))'));
  assert.equal(d.before, 3);
  assert.equal(d.after, 3.5);
  assert.deepEqual(d.changes.map(c => c.name + ':' + c.delta).sort(), ['B:-1', 'C:0.5', 'E:1']);
  assert.equal(JSON.parse(app.run('JSON.stringify(diffRoster(__a, __a).changes)')).length, 0);
});
