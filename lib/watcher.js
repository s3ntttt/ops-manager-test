// Server-side sheet watcher: re-reads the roster sheet every few minutes even when nobody has the app open,
// and writes "[ROSTER] ..." lines to the same Firebase activity log the app shows.
// Reuses the browser's own parser (public/js) through lib/sandbox.js so server and app always agree.
//
// Env (all optional):  WATCH_GROUPS=C,D   WATCH_INTERVAL_MIN=5   WATCH_TZ=Asia/Kuala_Lumpur   WATCH_DISABLED=1
const { loadApp } = require('./sandbox');
const { createFirebaseToken } = require('./firebase-token');

const cfg = () => ({
  key: process.env.FIREBASE_API_KEY, db: (process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, ''),
  sheetsKey: process.env.GOOGLE_SHEETS_API_KEY,
  groups: (process.env.WATCH_GROUPS || 'C,D').split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
  everyMin: Math.max(1, Number(process.env.WATCH_INTERVAL_MIN) || 5),
  tz: process.env.WATCH_TZ || 'Asia/Kuala_Lumpur',
});

let idToken = null, refreshToken = null, tokenExp = 0;
async function authToken(c) {
  if (idToken && Date.now() < tokenExp - 60000) return idToken;
  let r;
  if (refreshToken) {
    r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${c.key}`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}` });
    const j = await r.json();
    if (r.ok) { idToken = j.id_token; refreshToken = j.refresh_token; tokenExp = Date.now() + Number(j.expires_in) * 1000; return idToken; }
  }
  // With the service-account key set, the watcher signs in as an "edit" user (needed once the database rules require it);
  // otherwise it falls back to an anonymous sign-in like before.
  const custom = createFirebaseToken('sheet-watcher', { mode: 'edit', name: 'SHEET' });
  r = custom
    ? await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${c.key}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) })
    : await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${c.key}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error('Firebase sign-in failed: ' + (j.error && j.error.message));
  idToken = j.idToken; refreshToken = j.refreshToken; tokenExp = Date.now() + Number(j.expiresIn) * 1000;
  return idToken;
}
async function dbGet(c, p) {
  const r = await fetch(`${c.db}/${p}.json?auth=${await authToken(c)}`);
  if (!r.ok) throw new Error(`DB read ${p}: HTTP ${r.status}`);
  return r.json();
}
async function dbPut(c, p, v) {
  const r = await fetch(`${c.db}/${p}.json?auth=${await authToken(c)}`, { method: 'PUT', body: JSON.stringify(v) });
  if (!r.ok) throw new Error(`DB write ${p}: HTTP ${r.status}`);
}

const isoDay = (tz, offset) => {
  const d = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

async function sheetRows(c, sid, tab) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(tab)}?key=${c.sheetsKey}`);
  const j = await r.json();
  if (!r.ok) throw new Error('Sheets: ' + (j.error && j.error.message));
  return j.values || [];
}

async function runOnce(c = cfg(), log = console) {
  const sheetConfigs = (await dbGet(c, 'settings/sheetConfigs').catch(() => null)) || {};
  const rowCache = new Map();
  const dates = c.dates || [isoDay(c.tz, -1), isoDay(c.tz, 0), isoDay(c.tz, 1)]; // yesterday's night shift runs into today
  let logged = 0;
  for (const date of dates) for (const group of c.groups) for (const shift of ['DAY', 'NIGHT']) {
    const app = loadApp({ shift, group });
    app.els.dp.value = date;
    app.ctx.__sc = sheetConfigs;
    app.run('S.sheetConfigs = __sc');
    const sc = app.run('getSheetConfigForDate(document.getElementById("dp").value)');
    const ck = sc.sid + '|' + sc.tab;
    if (!rowCache.has(ck)) rowCache.set(ck, await sheetRows(c, sc.sid, sc.tab).catch(e => { log.warn('watcher:', e.message); return null; }));
    const rows = rowCache.get(ck);
    if (!rows) continue;
    app.ctx.__rows = rows;
    let fresh;
    try { fresh = app.run(`buildStaff(__rows, fmtDate(${JSON.stringify(date)}), ${JSON.stringify(shift)}, ${JSON.stringify(group)})`); }
    catch (e) { log.warn(`watcher: parse ${date} ${shift}:`, e.message); continue; }
    if (!fresh || !fresh.length) continue; // date not on the sheet / sheet broken — leave baseline alone
    const k = `${date}_${group}_${shift}`;
    app.ctx.__fresh = fresh;
    const snapNew = app.run('rosterSnapshot(__fresh)');
    const old = await dbGet(c, `settings/rosterSnap/${k}`);
    if (old && old.staff) {
      app.ctx.__old = app.run(`snapshotToStaff(${JSON.stringify(old.staff)})`);
      const d = app.run('diffRoster(__old, __fresh)');
      if (d.changes.length) {
        app.ctx.__d = d;
        const entries = app.run('rosterChangeEntries(__d)');
        for (const e of entries) {
          const lk = app.run(`rosterLogKey(${JSON.stringify(e.sig)})`);
          const path = `activityLog/shifts/${k}/${lk}`;
          const cur = await dbGet(c, path);
          if (cur && Date.now() - cur.ts < 60 * 60 * 1000) continue; // an open browser already logged it
          await dbPut(c, path, { ts: Date.now(), name: '[ROSTER]', action: e.detail, _evt: true, by: 'SHEET' });
          logged++;
        }
        log.log(`watcher: ${k} — ${d.changes.length} roster change(s), on duty ${d.before} → ${d.after}`);
      }
    }
    await dbPut(c, `settings/rosterSnap/${k}`, { at: Date.now(), staff: snapNew });
  }
  return logged;
}

function start() {
  const c = cfg();
  if (process.env.WATCH_DISABLED === '1') return console.log('  Sheet watcher: disabled (WATCH_DISABLED=1)');
  if (!c.key || !c.db || !c.sheetsKey) return console.log('  Sheet watcher: off (needs FIREBASE_API_KEY, FIREBASE_DATABASE_URL, GOOGLE_SHEETS_API_KEY)');
  let busy = false;
  const tick = async () => {
    if (busy) return; busy = true;
    try { await runOnce(c); } catch (e) { console.warn('watcher error:', e.message); } finally { busy = false; }
  };
  console.log(`  Sheet watcher: on — groups ${c.groups.join(',')} every ${c.everyMin} min`);
  setTimeout(tick, 15000);
  setInterval(tick, c.everyMin * 60000).unref?.();
}
module.exports = { start, runOnce };
