/**
 * OPS MANAGER – Express Backend
 * Shift C · Batik Air KUL
 *
 * Run:  node server.js
 * Dev:  npm run dev   (requires nodemon)
 */

require('dotenv').config();
const express    = require('express');
const rateLimit  = require('express-rate-limit');
const jwt        = require('jsonwebtoken');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const TOKEN_TTL = '12h'; // each renewal restarts this clock

// ─── Middleware ───────────────────────────────────────────────────────────────

// Trust Railway's proxy so express-rate-limit can read the real client IP
// from X-Forwarded-For (required on all Railway/Heroku/Render deployments)
app.set('trust proxy', 1);

// No CORS middleware needed: the frontend is served by this same server (same origin).
app.use(express.json());

// Serve the frontend from the "public" subfolder (index.html lives there)
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter – protects auth endpoint from brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 FAILED attempts per window
  skipSuccessfulRequests: true, // successful logins / token renewals don't count against the limit
  message: { error: 'Too many attempts, please try again later.' }
});

// Rate limiter – protects Google Sheets API quota
const sheetsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute window
  max: 30,                   // max 30 fetches per minute per IP
  message: { error: 'Too many sheet requests, please slow down.' }
});

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth
 * Body: { code: "SHIFTC2026" }
 * Returns a short-lived JWT plus the Firebase config (safe to send once authenticated)
 */
app.post('/api/auth', authLimiter, (req, res) => {
  const { code, token: existingToken } = req.body || {};

  const firebaseConfig = {
    apiKey:      process.env.FIREBASE_API_KEY,
    authDomain:  process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId:   process.env.FIREBASE_PROJECT_ID
  };

  // Session renewal: a still-valid JWT is exchanged for a FRESH 12h token, so people who
  // keep the app open (e.g. a full night shift) are never logged out mid-use.
  if (existingToken) {
    try {
      jwt.verify(existingToken, process.env.JWT_SECRET);
      const fresh = jwt.sign({ role: 'ops' }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
      return res.json({ token: fresh, firebaseConfig });
    } catch {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
  }

  // Fresh login — validate the access code
  const expectedCode = (process.env.ACCESS_CODE || '').trim().toUpperCase();
  if (!expectedCode) {
    console.error('ACCESS_CODE is not set in environment variables!');
    return res.status(500).json({ error: 'Server misconfiguration: ACCESS_CODE not set.' });
  }
  if (!code || code.trim().toUpperCase() !== expectedCode) {
    return res.status(401).json({ error: 'Incorrect access code.' });
  }

  const token = jwt.sign({ role: 'ops' }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

  // Return the Firebase config so the browser can initialise the SDK
  // Safe: config is only handed out after the correct access code is provided
  res.json({ token, firebaseConfig });
});

/**
 * GET /api/sheets?sid=SHEET_ID&tab=TAB_NAME&range=RANGE
 * Proxies Google Sheets API — the API key stays on the server
 */
app.get('/api/sheets', sheetsLimiter, requireAuth, async (req, res) => {
  const { sid, tab, range } = req.query;
  if (!sid || !tab) return res.status(400).json({ error: 'Missing sid or tab' });

  const encodedRange = encodeURIComponent(tab + (range ? `!${range}` : ''));
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodedRange}?key=${process.env.GOOGLE_SHEETS_API_KEY}`;

  try {
    const upstream = await fetch(url);
    const data     = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.error?.message || 'Sheets API error' });
    }
    res.json(data);
  } catch (err) {
    console.error('Sheets proxy error:', err);
    res.status(502).json({ error: 'Failed to reach Google Sheets API' });
  }
});

/**
 * GET /api/health
 * Quick health check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Fallback — serve index.html for any unknown route (SPA behaviour)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Global error handler ────────────────────────────────────────────────────
// Catches any unexpected Express error not handled by individual routes.
// Returns clean JSON instead of a raw HTML crash page.
app.use((err, req, res, next) => {
  console.error('Unhandled Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Process-level crash guard ────────────────────────────────────────────────
// Keeps the server alive and logs clearly if something unexpected happens
// outside of Express (unhandled async errors or uncaught exceptions).
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception — server staying alive:', err);
});

// ─── Start ────────────────────────────────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_this_to_a_long_random_string_before_deploying') {
  console.error('FATAL: JWT_SECRET is missing or still the default value. Set a long random JWT_SECRET and restart.');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`\n  OPS MANAGER server running`);
  console.log(`  → http://localhost:${PORT}\n`);
});
