// Loads the browser scripts (public/js/*.js, except main) into a sandbox with a tiny fake DOM,
// so the pure logic (roster parsing, headcount maths, name matching) can be tested in Node.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadApp({ shift = 'NIGHT', group = 'C' } = {}) {
  const els = {
    'shift-sel': { value: shift },
    'shift-group-sel': { value: group },
    dp: { value: '2026-05-02' },
  };
  const noop = () => {};
  const sandbox = {
    console, Math, JSON, Date, Set, Map, Array, Object, String, Number, RegExp, Error, Promise,
    setInterval: noop, setTimeout: noop, clearTimeout: noop,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    firebase: { apps: [] },
    window: { addEventListener: noop },
    document: {
      getElementById: id => els[id] || null,
      addEventListener: noop,
      querySelectorAll: () => [],
      body: { classList: { add: noop, toggle: noop } },
    },
    location: { search: '' },
    fetch: async () => { throw new Error('no network in tests'); },
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const dir = path.join(__dirname, '..', 'public', 'js');
  fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('99-')).sort()
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  const run = code => vm.runInContext(code, ctx);
  return { ctx, run, els, setShift: v => { els['shift-sel'].value = v; } };
}
module.exports = { loadApp };
