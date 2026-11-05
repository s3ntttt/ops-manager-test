// Firebase custom sign-in tokens, signed with the project's service-account key (the same thing the Firebase Admin SDK
// does, done directly with jsonwebtoken so there is no extra dependency).
//
// Why: the database rules can then tell WHO is connected — "edit" logins may write, "view" logins may only read — instead of
// treating every anonymous browser the same. The key lives only in the Railway variable FIREBASE_SERVICE_ACCOUNT.
// If the variable is not set, createFirebaseToken() returns null and the app falls back to anonymous sign-in
// (fine while the database rules are still the simple "auth != null" ones).
const jwt = require('jsonwebtoken');

const AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

function loadServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) return null;
  try {
    const txt = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'); // plain JSON or base64 of it
    const sa = JSON.parse(txt);
    if (!sa.client_email || !sa.private_key) throw new Error('client_email / private_key missing');
    return { email: sa.client_email, key: String(sa.private_key).replace(/\\n/g, '\n') };
  } catch (e) {
    console.error('FIREBASE_SERVICE_ACCOUNT is set but unreadable:', e.message);
    return null;
  }
}

function createFirebaseToken(uid, claims = {}) {
  const sa = loadServiceAccount();
  if (!sa) return null;
  const safeUid = String(uid || 'user').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 120) || 'user';
  return jwt.sign(
    { iss: sa.email, sub: sa.email, aud: AUDIENCE, uid: safeUid, claims },
    sa.key,
    { algorithm: 'RS256', expiresIn: 3600 }   // only used to sign in right away; the Firebase session then renews itself
  );
}

module.exports = { createFirebaseToken, isConfigured: () => !!loadServiceAccount() };
