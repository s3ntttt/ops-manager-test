const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

test('socParseClipboard reads Excel-style tab/newline text', () => {
  const app = loadApp();
  app.ctx.__t = 'LDG\tAMIR\t0715-1030\tEXT\r\nTOW\tZUL\t\t\r\n\r\n';
  const rows = JSON.parse(app.run('JSON.stringify(socParseClipboard(__t))'));
  assert.deepEqual(rows, [['LDG', 'AMIR', '0715-1030', 'EXT'], ['TOW', 'ZUL', '', '']]);
});

test('socReorder moves selected rows before the drop position', () => {
  const app = loadApp();
  const run = (list, sel, pos) => {
    app.ctx.__l = list; app.ctx.__s = new app.ctx.Set(sel);
    return JSON.parse(app.run(`JSON.stringify(socReorder(__l, __s, ${pos}))`));
  };
  assert.deepEqual(run(['a', 'b', 'c', 'd'], [0], 3), { list: ['b', 'c', 'a', 'd'], start: 2, count: 1 });
  assert.deepEqual(run(['a', 'b', 'c', 'd'], [2, 3], 0), { list: ['c', 'd', 'a', 'b'], start: 0, count: 2 });
  assert.deepEqual(run(['a', 'b', 'c', 'd'], [1], 4), { list: ['a', 'c', 'd', 'b'], start: 3, count: 1 });
  assert.deepEqual(run(['a', 'b', 'c'], [1], 1).list, ['a', 'b', 'c']);     // dropped on itself
});

test('copy format carries the tick as a 5th column', () => {
  const app = loadApp();
  app.run("S.soc=[{flight:'LDG',name:'A',time:'0700',remark:'',done:true},{flight:'TOW',name:'B',time:'',remark:''}]");
  assert.equal(app.run('_socRowsTsv([0,1])'), 'LDG\tA\t0700\t\t✓\nTOW\tB\t\t\t');
  assert.equal(app.run("_socIsTick('✓')"), true);
  assert.equal(app.run("_socIsTick('')"), false);
});
