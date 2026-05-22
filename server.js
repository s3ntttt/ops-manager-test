/**
 * OPS MANAGER – Express Backend
 * Shift C · Batik Air KUL
 *
 * Run:  node server.js
 * Dev:  npm run dev   (requires nodemon)
 */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const jwt        = require('jsonwebtoken');
const fetch      = require('node-fetch');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS — open to all origins. Security is enforced by JWT on every API route.
// The frontend and backend share the same Railway domain, so restricting CORS
// by origin would block same-domain POST requests (browsers send Origin on POST).
app.use(cors());

app.use(express.json());

// Serve the frontend from the "public" subfolder (index.html lives there)
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter – protects auth endpoint from brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 attempts per window
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

  // Allow session refresh via existing valid JWT (page reload)
  if (existingToken) {
    try {
      jwt.verify(existingToken, process.env.JWT_SECRET);
      // Token is still valid — return firebase config without a new token
      return res.json({ token: existingToken, firebaseConfig });
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

  const token = jwt.sign({ role: 'ops' }, process.env.JWT_SECRET, { expiresIn: '12h' });

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

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  OPS MANAGER server running`);
  console.log(`  → http://localhost:${PORT}\n`);
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_this_to_a_long_random_string_before_deploying') {
    console.warn('  ⚠  JWT_SECRET is using the default value. Change it in .env before sharing this server!\n');
  }
});
