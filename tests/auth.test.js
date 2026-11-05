const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const jwt = require('jsonwebtoken');

const PORT = 3200 + Math.floor(Math.random() * 500);
const SECRET = 'test-secret-for-auth-tests';
let proc;
const post = (body) => fetch(`http://localhost:${PORT}/api/auth`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test.before(async () => {
  proc = spawn(process.execPath, ['server.js'], {
    cwd: require('path').join(__dirname, '..'),
    env: { ...process.env, PORT, JWT_SECRET: SECRET, ACCESS_CODE: 'legacy1',
      USER_CODES: 'WILSENT:abc123:edit;amir:Xyz789:view\nBADENTRY;ZUL:zzz:edit' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {            // wait for the server to come up
    try { if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
test.after(() => proc && proc.kill());

test('each person logs in with their own passcode (case-insensitive)', async () => {
  const r = await post({ code: 'abc123' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.deepEqual(d.user, { name: 'WILSENT', mode: 'edit' });
  assert.equal(jwt.verify(d.token, SECRET).name, 'WILSENT');
  const v = await (await post({ code: 'XYZ789' })).json();
  assert.deepEqual(v.user, { name: 'AMIR', mode: 'view' });
});

test('legacy ACCESS_CODE still works as a shared TEAM login', async () => {
  const d = await (await post({ code: 'LEGACY1' })).json();
  assert.deepEqual(d.user, { name: 'TEAM', mode: 'edit' });
});

test('wrong passcode is rejected', async () => {
  assert.equal((await post({ code: 'nope' })).status, 401);
  assert.equal((await post({})).status, 401);
});

test('renewal keeps the same person and mode, with a fresh token', async () => {
  const first = await (await post({ code: 'xyz789' })).json();
  await new Promise(r => setTimeout(r, 1100));
  const renewed = await (await post({ token: first.token })).json();
  assert.deepEqual(renewed.user, { name: 'AMIR', mode: 'view' });
  assert.ok(jwt.decode(renewed.token).exp > jwt.decode(first.token).exp);
  assert.equal((await post({ token: 'garbage' })).status, 401);
});
