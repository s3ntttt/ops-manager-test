// Firebase custom sign-in tokens, signed with the project's service-account key (the same thing the Firebase Admin SDK
// does, done directly with jsonwebtoken so there is no extra dependency).
//
// Why: the database rules can then tell WHO is connected — "edit" logins may write, "view" logins may only read — instead of
// treating every anonymous browser the same. The key lives only in the Railway variable FIREBASE_SERVICE_ACCOUNT.
// If the variable is not set, createFirebaseToken() returns null and the app falls back to anonymous sign-in
// (fine while the database rules are still the simple "auth != null" ones).
const jwt = require('jsonwebtoken');

const AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

// Accepts the key however it ended up in the Railway variable: plain JSON, JSON wrapped in quotes (with or without
// escaped inner quotes), JSON with stray characters around it, or base64 of the file (UTF-8 or UTF-16).
function parseServiceAccount(raw) {
  let txt = String(raw || '').replace(/^\uFEFF/, '').trim();
  const candidates = [];
  const unquote = t => { const m = t.match(/^["'\u201C\u2018]([\s\S]*)["'\u201D\u2019]$/); return m ? m[1].trim() : t; };
  txt = unquote(txt);
  candidates.push(txt);
  if (txt.includes('\\"')) candidates.push(txt.replace(/\\"/g, '"'));          // {\"type\": ...} (over-escaped)
  const i = txt.indexOf('{'), j = txt.lastIndexOf('}');
  if (i >= 0 && j > i) candidates.push(txt.slice(i, j + 1));                       // junk before/after the braces
  try {                                                                            // base64 of the file
    const buf = Buffer.from(txt.replace(/\s+/g, ''), 'base64');
    if (buf.length > 20) {
      const dec = (buf[0] === 0xFF && buf[1] === 0xFE) ? buf.toString('utf16le') : buf.toString('utf8');
      candidates.push(dec.replace(/^\uFEFF/, '').trim());
    }
  } catch {}
  for (const c of candidates) {
    try {
      const sa = JSON.parse(c);
      if (sa && sa.client_email && sa.private_key) return { email: sa.client_email, key: String(sa.private_key).replace(/\\n/g, '\n') };
    } catch {}
  }
  const codes = [...String(raw || '').slice(0, 3)].map(ch => ch.charCodeAt(0)).join(',');
  throw new Error(`could not read the key (length ${String(raw || '').length}, first characters' codes: ${codes}). It should start with { and contain "client_email" and "private_key"`);
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !raw.trim()) return null;
  try { return parseServiceAccount(raw); }
  catch (e) { console.error('FIREBASE_SERVICE_ACCOUNT is set but unreadable:', e.message); return null; }
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
