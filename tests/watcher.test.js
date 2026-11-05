const test = require('node:test');
const assert = require('node:assert/strict');
const { runOnce } = require('../lib/watcher');

const HEAD = ['Team', 'Staff ID', 'Staff Name', 'Designation', 'Aircraft', 'Desig Code', 'Type', 'Team', 'Shift', '30 Apr 2026', '01 May 2026', '02 May 2026'];
const row = (id, name, sched, shift = 'C') => ['', id, name, 'AIRCRAFT TECHNICIAN', 'A330', 'TECH', '', 'IRR', shift, 'DAY', 'DAY', sched];
const sheet = (aSched, bSched) => [[''], HEAD, ['IRREGULARITIES SHIFT C'],
  row('M10001', 'AHMAD BIN ALI', 'NIGHT'), row('M10002', 'SITI BINTI OMAR', bSched),
  ['IRREGULARITIES SHIFT A'], row('M20001', 'RAJ KUMAR', aSched, 'A')];

test('watcher: first run sets a baseline, a later sheet change is logged once', async () => {
  const db = {}; let rows = sheet('DAY', 'NIGHT');
  const realFetch = global.fetch;
  global.fetch = async (url, opt = {}) => {
    const u = String(url), ok = body => ({ ok: true, status: 200, json: async () => body });
    if (u.includes('identitytoolkit')) return ok({ idToken: 't', refreshToken: 'r', expiresIn: '3600' });
    if (u.includes('sheets.googleapis')) return ok({ values: rows });
    const p = decodeURIComponent(u.split('.json')[0].split('/').slice(3).join('/'));
    if (opt.method === 'PUT') { db[p] = JSON.parse(opt.body); return ok(null); }
    return ok(db[p] ?? null);
  };
  const cfg = { key: 'k', db: 'https://db.test', sheetsKey: 's', groups: ['C'], tz: 'UTC', dates: ['2026-05-02'] };
  const quiet = process.env.DBG ? console : { log() {}, warn() {} };
  try {
    assert.equal(await runOnce(cfg, quiet), 0);                 // baseline only
    assert.ok(db['settings/rosterSnap/2026-05-02_C_NIGHT']);
    rows = sheet('NIGHT', 'MC');                                // RAJ becomes a backup, SITI goes MC
    assert.equal(await runOnce(cfg, quiet), 5);                 // NIGHT: 2 people + total, DAY: RAJ leaves + total
    const lines = Object.entries(db).filter(([k]) => k.startsWith('activityLog/shifts/2026-05-02_C_NIGHT/')).map(([, v]) => v.action);
    assert.ok(lines.some(l => /SITI.*NIGHT → MC \(-1\)/.test(l)), lines.join('\n'));
    assert.ok(lines.some(l => /RAJ.*→ NIGHT \(\+1\)/.test(l)), lines.join('\n'));
    assert.ok(lines.some(l => /On duty 2 → 2/.test(l)), lines.join('\n'));
    assert.equal(await runOnce(cfg, quiet), 0);                 // nothing new — no duplicates
  } finally { global.fetch = realFetch; }
});
