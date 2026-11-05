const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { createFirebaseToken, isConfigured } = require('../lib/firebase-token');

const keys = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const sa = { client_email: 'svc@p.iam.gserviceaccount.com', private_key: keys.privateKey };

test('no service account configured → no token (app falls back to anonymous sign-in)', () => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  assert.equal(createFirebaseToken('u_X', { mode: 'edit' }), null);
  assert.equal(isConfigured(), false);
});

test('token is signed with the service-account key and carries uid + claims; JSON, base64 and \\n-escaped keys all work', () => {
  const variants = [
    JSON.stringify(sa),
    Buffer.from(JSON.stringify(sa)).toString('base64'),
    JSON.stringify({ ...sa, private_key: sa.private_key.replace(/\n/g, '\\n') }).replace(/\\\\n/g, '\\n'),
  ];
  for (const v of variants) {
    process.env.FIREBASE_SERVICE_ACCOUNT = v;
    const t = createFirebaseToken('u_AMIR ZUL', { mode: 'view', name: 'AMIR' });
    const p = jwt.verify(t, keys.publicKey, { algorithms: ['RS256'] });
    assert.equal(p.uid, 'u_AMIR_ZUL');               // unsafe characters replaced
    assert.deepEqual(p.claims, { mode: 'view', name: 'AMIR' });
    assert.ok(p.exp - p.iat <= 3600);
  }
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
});

test('garbage in the variable is reported, not fatal', () => {
  process.env.FIREBASE_SERVICE_ACCOUNT = '{not json';
  assert.equal(createFirebaseToken('u_X', {}), null);
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
});
