const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

test('gridParseClipboard reads Excel-style tab/newline text', () => {
  const app = loadApp();
  app.ctx.__t = 'LDG\tAMIR\t0715-1030\tEXT\r\nTOW\tZUL\t\t\r\n\r\n';
  const rows = JSON.parse(app.run('JSON.stringify(gridParseClipboard(__t))'));
  assert.deepEqual(rows, [['LDG', 'AMIR', '0715-1030', 'EXT'], ['TOW', 'ZUL', '', '']]);
});

test('gridReorder moves selected rows before the drop position', () => {
  const app = loadApp();
  const run = (list, sel, pos) => {
    app.ctx.__l = list; app.ctx.__s = new app.ctx.Set(sel);
    return JSON.parse(app.run(`JSON.stringify(gridReorder(__l, __s, ${pos}))`));
  };
  assert.deepEqual(run(['a', 'b', 'c', 'd'], [0], 3), { list: ['b', 'c', 'a', 'd'], start: 2, count: 1 });
  assert.deepEqual(run(['a', 'b', 'c', 'd'], [2, 3], 0), { list: ['c', 'd', 'a', 'b'], start: 0, count: 2 });
  assert.deepEqual(run(['a', 'b', 'c', 'd'], [1], 4), { list: ['a', 'c', 'd', 'b'], start: 3, count: 1 });
  assert.deepEqual(run(['a', 'b', 'c'], [1], 1).list, ['a', 'b', 'c']);     // dropped on itself
});

test('copy format: SOC carries the tick as a 5th column, PDSC / FGS have only their own columns', () => {
  const app = loadApp();
  app.run("S.soc=[{flight:'LDG',name:'A',time:'0700',remark:'',done:true},{flight:'TOW',name:'B',time:'',remark:''}]");
  assert.equal(app.run("_gRowsTsv('soc',[0,1])"), 'LDG\tA\t0700\t\t✓\nTOW\tB\t\t\t');
  app.run("S.pdsc=[{reg:'9M-ABC',certifier:'ZUL'}]; S.fgs=[{reg:'9M-XYZ',remark:'DEFER'}]");
  assert.equal(app.run("_gRowsTsv('pdsc',[0])"), '9M-ABC\tZUL');
  assert.equal(app.run("_gRowsTsv('fgs',[0])"), '9M-XYZ\tDEFER');
  assert.equal(JSON.stringify(app.run("_gRowFromCells('soc',['LDG','A','0700','','✓'])")), JSON.stringify({ flight: 'LDG', name: 'A', time: '0700', remark: '', done: true }));
  assert.equal(JSON.stringify(app.run("_gRowFromCells('fgs',['9M-XYZ','R','✓'])")), JSON.stringify({ reg: '9M-XYZ', remark: 'R' }));
});
