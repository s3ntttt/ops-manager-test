const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const app = loadApp({ shift: 'NIGHT' });
const call = (fn, ...args) => app.ctx[fn](...args);

test('shortify: compound given names stay distinct', () => {
  assert.equal(call('shortify', 'AMIR SYAMIM BIN RAZALI'), 'AMIR SYAMIM');
  assert.equal(call('shortify', 'AMIRUDDIN BIN HASSAN'), 'AMIRUDDIN');
  assert.equal(call('shortify', 'NUR SYAHIRA BINTI ALI'), 'SYAHIRA');       // prefix skipped
  assert.equal(call('shortify', 'MUHAMMAD AMIR BIN ZAINAL'), 'AMIR');
});

test('parseBkCode: backup codes incl. half-shift', () => {
  const p = (v, sh) => app.ctx.parseBkCode(v, sh);
  assert.equal(p('NIGHT', 'NIGHT'), null);                                   // plain shift is not a backup
  assert.deepEqual({ ...p('(1/2) NIGHT', 'NIGHT') }, { matchesShift: true, dept: null, half: true });
  assert.equal(p('(1/2) NIGHT (IRR)', 'NIGHT').dept, 'IRR');
  assert.equal(p('(1/2) DAY', 'NIGHT').matchesShift, false);                 // other shift's half-day
  assert.equal(p('B/U (NIGHT)', 'NIGHT').matchesShift, true);
  assert.equal(p('(N2) B/U (NIGHT)', 'NIGHT').matchesShift, true);
  assert.equal(p('NIGHT (MD)', 'DAY').matchesShift, false);
  assert.equal(p('(2) B737NG REC (CGK)', 'DAY').matchesShift, true);
});

test('bkFraction: single report time vs bounded window (NIGHT 1800-0600)', () => {
  app.setShift('NIGHT');
  const f = time => app.ctx.bkFraction({ time, mcEl: false });
  assert.equal(f(''), 1);
  assert.equal(f('1800'), 1);
  assert.equal(f('2200'), 0.67);        // 8h left of 12
  assert.equal(f('0000'), 0.5);         // after-midnight report time
  assert.equal(f('1900-0100'), 0.5);    // bounded window, 6h
  assert.equal(f('0100-0600'), 0.42);
  assert.equal(app.ctx.bkFraction({ time: '2200', mcEl: true }), 1); // MC/EL handled elsewhere
});

test('bkFraction: DAY shift 0600-1800', () => {
  app.setShift('DAY');
  const f = time => app.ctx.bkFraction({ time, mcEl: false });
  assert.equal(f('0800'), 0.83);
  assert.equal(f('0900-1400'), 0.42);
  assert.equal(f('1900-2200'), 0);      // entirely outside the shift
  app.setShift('NIGHT');
});

test('schedValFraction: roster-cell windows and half shifts', () => {
  app.setShift('NIGHT');
  assert.equal(app.ctx.schedValFraction('NIGHT'), 1);
  assert.equal(app.ctx.schedValFraction('NIGHT (F1)'), 1);                  // fly marker is not a window
  assert.equal(app.ctx.schedValFraction('(1/2) NIGHT'), 0.5);
  assert.equal(app.ctx.schedValFraction('NIGHT (0000-0700)'), 0.5);         // only the part inside this shift counts
});

test('sumHeadcount: fractions add up, assigned staff excluded, tidy formatting', () => {
  app.run('S').nicknames = {};
  const mk = (n, fr) => ({ id: n, shortName: n, ...(fr === undefined ? {} : { _fraction: fr }) });
  const none = new Set();
  assert.equal(app.ctx.sumHeadcount([mk('A'), mk('B'), mk('C')], none), '3');
  assert.equal(app.ctx.sumHeadcount([mk('A'), mk('B', 0.5)], none), '1.5');
  assert.equal(app.ctx.sumHeadcount([mk('A', 0.83), mk('B', 0.42)], none), '1.25');
  assert.equal(app.ctx.sumHeadcount([mk('A'), mk('B'), mk('C', 0.5)], new Set(['B'])), '1.5');
  assert.equal(app.ctx.sumHeadcount([], none), '0');
});

test('catOf: categories from designation code', () => {
  assert.equal(call('catOf', 'LT', 'X'), 'GL');
  assert.equal(call('catOf', 'LAT', 'X'), 'LAT');
  assert.equal(call('catOf', 'LAEB1', 'X'), 'LAE B1');
  assert.equal(call('catOf', 'LAEB2', 'X'), 'LAE B2');
  assert.equal(call('catOf', 'TECH', 'AIRCRAFT TECHNICIAN'), 'TECH');
});

test('availOf: half-shift and plain shift', () => {
  const half = call('availOf', '(1/2) NIGHT', 'NIGHT');
  assert.equal(half.st, 'WORKING');
  assert.equal(half.half, true);
  assert.equal(call('availOf', 'NIGHT', 'NIGHT').st, 'WORKING');
});

test('staffMatchInput: nickname vs compound shortName (AMIR vs AMIR SYAMIM)', () => {
  const S = app.run('S');
  const amiruddin = { id: 'M1', shortName: 'AMIRUDDIN' };
  const syamim = { id: 'M2', shortName: 'AMIR SYAMIM' };
  S.nicknames = { M1: 'AMIR' };
  assert.equal(app.ctx.staffMatchInput(amiruddin, 'AMIR'), true);
  assert.equal(app.ctx.staffMatchInput(syamim, 'AMIR'), false);     // first word must not collide
  assert.equal(app.ctx.staffMatchInput(syamim, 'SYAMIM'), true);    // last word works without a nickname
  assert.equal(app.ctx.staffMatchInput(syamim, 'AMIR SYAMIM'), true);
  S.nicknames = {};
});

test('Duty Engineers: core shift first, backups always behind (roster backups and manual backups)', () => {
  const { loadApp } = require('./helpers');
  const app = loadApp();
  app.run(`
    const av = { st:'WORKING', lbl:'NIGHT', cls:'working', badge:'bwk', raw:'NIGHT' };
    S.nicknames = {};
    S.overrides = {};
    S.staff = [
      { id:'B1_BK', fullName:'BACKUP ONE', shortName:'BKONE', team:'MOC', desig:'DUTY ENGINEER', isBackup:true,  avail:av },
      { id:'C1',    fullName:'CORE ONE',   shortName:'COREONE', team:'MOC', desig:'DUTY ENGINEER', isBackup:false, avail:av },
      { id:'C2',    fullName:'CORE TWO',   shortName:'CORETWO', team:'MOC', desig:'DUTY ENGINEER', isBackup:false, avail:av },
    ];
    S.backups.moc = [{ name:'MANUAL', status:'AVAIL' }, { name:'OFFGUY', status:'OFF' }];
  `);
  assert.deepEqual(JSON.parse(app.run('JSON.stringify(mocActiveNames())')), ['COREONE', 'CORETWO', 'BKONE', 'MANUAL']);
});

test('dutyPageNow: login opens on the current roster page (local clock)', () => {
  const { loadApp } = require('./helpers');
  const app = loadApp();
  const at = (y, m, d, h, min) => { app.ctx.__n = new Date(y, m - 1, d, h, min); return JSON.parse(app.run('JSON.stringify(dutyPageNow(__n))')); };
  assert.deepEqual(at(2026, 11, 10, 9, 30),  { date: '2026-11-10', shift: 'DAY' });
  assert.deepEqual(at(2026, 11, 10, 6, 0),   { date: '2026-11-10', shift: 'DAY' });
  assert.deepEqual(at(2026, 11, 10, 17, 59), { date: '2026-11-10', shift: 'DAY' });
  assert.deepEqual(at(2026, 11, 10, 18, 0),  { date: '2026-11-10', shift: 'NIGHT' });
  assert.deepEqual(at(2026, 11, 10, 23, 30), { date: '2026-11-10', shift: 'NIGHT' });
  assert.deepEqual(at(2026, 11, 10, 2, 30),  { date: '2026-11-09', shift: 'NIGHT' });   // still last night's shift
  assert.deepEqual(at(2026, 3, 1, 1, 0),     { date: '2026-02-28', shift: 'NIGHT' });   // month boundary
});
