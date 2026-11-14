const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

// Table-driven guard for the roster-code table in the ops-manager-dev skill.
// Add a row here whenever a new sheet code appears (and to the skill table).
const app = loadApp({ shift: 'NIGHT' });
const { parseBkCode, availOf } = app.ctx;

// [cell text, shift, expected parseBkCode.matchesShift (null = not a KUL backup)]
const BK = [
  ['B/U NIGHT', 'NIGHT', true],
  ['B/U DAY', 'NIGHT', false],
  ['(D5) B/U DAY', 'DAY', true],
  ['(N1) B/U (NIGHT)', 'NIGHT', true],
  ['(N1) B/U (NIGHT)', 'DAY', false],
  ['(D3)', 'DAY', true],
  ['(1/2) NIGHT', 'NIGHT', true],
  ['(1/2) NIGHT', 'DAY', false],
  ['(D5) B/U SZB', 'DAY', null],          // outstation → never a KUL backup
  ['(D5) B/U SZB\n(0800-2000)', 'DAY', null],
  ['B/U PEN', 'NIGHT', null],
  ['NIGHT', 'NIGHT', null],               // own shift, not backup
  ['STBY', 'NIGHT', null],
];
for (const [cell, shift, want] of BK) {
  test(`parseBkCode ${JSON.stringify(cell)} @${shift}`, () => {
    const r = parseBkCode(cell, shift);
    if (want === null) assert.equal(r, null);
    else assert.equal(r && r.matchesShift, want);
  });
}

// [cell text, shift, expected avail.st]
const AV = [
  ['NIGHT', 'NIGHT', 'WORKING'],
  ['NIGHT (0000-0700)', 'NIGHT', 'WORKING'],
  ['(1/2) NIGHT', 'NIGHT', 'WORKING'],
  ['DAY', 'NIGHT', 'OTHER_SHIFT'],
  ['(D5) B/U SZB', 'DAY', 'OUTSTATION'],
  ['AL', 'NIGHT', 'LEAVE'],
  ['MC', 'NIGHT', 'ABSENT'],
  ['(F2)', 'NIGHT', 'FLYING'],
  ['(C3)', 'NIGHT', 'COURSE'],
  ['(T2)', 'NIGHT', 'TASK'],
  ['STBY', 'NIGHT', 'STANDBY'],
];
for (const [cell, shift, want] of AV) {
  test(`availOf ${JSON.stringify(cell)} @${shift} -> ${want}`, () => {
    assert.equal(availOf(cell, shift).st, want);
  });
}
