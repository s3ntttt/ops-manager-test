const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

// Minimal roster: header row with the date anchor, own-shift (C) IRR section, and a Shift A section.
const HEAD = ['Team', 'Staff ID', 'Staff Name', 'Designation', 'Aircraft', 'Desig Code', 'Type', 'Team', 'Shift',
  '30 Apr 2026', '01 May 2026', '02 May 2026'];
const row = (id, name, code, desig, sched, shift = 'C') =>
  ['', id, name, desig, 'A330', code, '', 'IRR', shift, 'DAY', 'DAY', sched];
const ROWS = [
  [''],
  HEAD,
  ['IRREGULARITIES SHIFT C'],
  row('M10001', 'AHMAD BIN ALI', 'TECH', 'AIRCRAFT TECHNICIAN', 'NIGHT'),
  row('M10002', 'THONG BIN LEE', 'LAEB1', 'LAE (B1.1)', 'NIGHT (0000-0700)'),
  row('M10003', 'SITI BINTI OMAR', 'TECH', 'AIRCRAFT TECHNICIAN', 'AL'),
  ['IRREGULARITIES SHIFT A'],
  row('M13632', 'AHMAD FAIZUDDIN BIN MOHD', 'LAEB1', 'LAE (B1.1)', '(1/2) NIGHT', 'A'),
  row('M20001', 'RAJ KUMAR', 'TECH', 'AIRCRAFT TECHNICIAN', 'NIGHT', 'A'),
  row('M20002', 'LEE WEI', 'TECH', 'AIRCRAFT TECHNICIAN', 'DAY', 'A'),
  row('M20003', 'ZUL BIN HAMID', 'TECH', 'AIRCRAFT TECHNICIAN', '(N1) B/U (NIGHT)', 'A'),
];

test('parseRoster: own shift, half-shift backup and cross-shift backups', () => {
  const app = loadApp({ shift: 'NIGHT' });
  const staff = app.ctx.parseRoster(ROWS, '02 May 2026', 'NIGHT', 'C');
  const byId = Object.fromEntries(staff.map(s => [s.id, s]));

  // Shift C own staff
  assert.equal(byId.M10001.isBackup, false);
  assert.equal(byId.M10001.team, 'IRR');
  assert.equal(byId.M10002.category, 'LAE B1');
  assert.equal(byId.M10002.schedVal, 'NIGHT (0000-0700)');
  assert.equal(byId.M10003.avail.st !== 'WORKING', true);          // on AL

  // The reported bug: half-night backup from Shift A must be detected, counted as half
  const half = byId['M13632_BK'];
  assert.ok(half, '(1/2) NIGHT backup from Shift A must be detected');
  assert.equal(half.isBackup, true);
  assert.equal(half.fromShift, 'A');
  assert.equal(half.team, 'IRR');
  assert.equal(half.avail.half, true);
  assert.equal(app.ctx.schedValFraction(half.schedVal), 0.5);

  // Plain NIGHT / B/U NIGHT from Shift A are backups; plain DAY is not
  assert.ok(byId['M20001_BK']);
  assert.ok(byId['M20003_BK']);
  assert.equal(byId['M20002_BK'], undefined);
});

test('parseRoster: wrong date throws a clear error', () => {
  const app = loadApp({ shift: 'NIGHT' });
  assert.throws(() => app.ctx.parseRoster(ROWS, '15 Aug 2031', 'NIGHT', 'C'), /not found/i);
});

test('"(D5) B/U SZB" = backing up another station → not counted at KUL (neither as cross-shift backup nor as own staff)', () => {
  const app = loadApp({ shift: 'DAY' });
  const rows = JSON.parse(JSON.stringify(ROWS));
  const day = (id, name, sched, shift) => ['', id, name, 'LAE (B2)', 'A330', 'LAEB2', '', 'IRR', shift, 'DAY', 'DAY', sched];
  rows.splice(rows.findIndex(r => r[0] === 'IRREGULARITIES SHIFT A') + 0, 0,
    day('M10009', 'OWN SHIFT GUY', '(D5) B/U SZB\n(0800-2000)', 'C'));            // own-shift staff sent to SZB
  rows.push(day('M30001', 'AMMIRUL HAFIZ', '(D5) B/U SZB\n(0800-2000)', 'B'));     // other shift, backing up SZB
  rows.push(day('M30002', 'REAL BACKUP', '(D5) B/U DAY', 'B'));                    // other shift, normal KUL backup
  const staff = app.ctx.parseRoster(rows, '02 May 2026', 'DAY', 'C');
  const byId = Object.fromEntries(staff.map(s => [s.id, s]));
  assert.equal(byId['M30001_BK'], undefined, 'SZB backup must not appear in the KUL roster');
  assert.ok(byId['M30002_BK'], 'a normal (D5) B/U DAY backup still counts');
  const own = byId.M10009;
  assert.equal(own.avail.st, 'OUTSTATION');
  assert.equal(own.avail.lbl, 'B/U SZB');
  assert.equal(app.ctx.isActive(own.avail), false);
  // helper
  assert.equal(app.ctx.outstationOf('(D5) B/U SZB'), 'SZB');
  assert.equal(app.ctx.outstationOf('B/U PEN'), 'PEN');
  for (const k of ['(D5) B/U DAY', 'B/U NIGHT', '(N5) B/U (NIGHT)', 'B/U KUL', 'DAY', '(D2)*']) assert.equal(app.ctx.outstationOf(k), null, k);
});
