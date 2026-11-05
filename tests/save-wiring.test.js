// Guards against "typed it but it didn't save": every inline oninput/onchange handler that writes into
// the app state (S.xxx = ...) must also trigger a save (scheduleSave / renderAll / a modal re-render that saves).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('inline handlers that edit S.* also save', () => {
  const dir = path.join(__dirname, '..', 'public', 'js');
  const SAVES = /scheduleSave|renderAll|saveTowers|saveTrainees|saveNicknames|saveAdp|saveWcAuth|fbSave/;
  const bad = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/on(?:input|change)="([^"]*)"/g)) {
        if (/\bS\.[A-Za-z_]+[^=;]*=(?!=)/.test(m[1]) && !SAVES.test(m[1])) bad.push(`${f}:${i + 1}  ${m[1]}`);
      }
    });
  }
  assert.deepEqual(bad, [], 'these handlers change data but never save it:\n' + bad.join('\n'));
});

test('view-only guard: only look/print/share handlers are allowed, anything that edits is blocked', () => {
  const { loadApp } = require('./helpers');
  const app = loadApp();
  const ok = c => { app.ctx.__c = c; return app.run('voAllowedHandler(__c)'); };
  for (const safe of ['switchTab(\'summary\')', 'printSummary()', 'openPrePlanSnapshot()', 'event.stopPropagation();closePrePlanModal()', "_adpDept='LO';renderAdpModal()", 'toggleDark()'])
    assert.equal(ok(safe), true, safe);
  for (const bad of ['cycleOvr(\'M1\')', 'event.stopPropagation();editNickname(\'a\',\'b\',event)', 'rmSoc(2)', "S.soc[0].done=true;scheduleSave()", 'openRolesModal()', 'takeSnapshot()', 'toggleSS(\'x\')', 'confirmSwap()'])
    assert.equal(ok(bad), false, bad);
});
