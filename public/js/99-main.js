// ═══════════════════════════════════
// INIT
// ═══════════════════════════════════
(function init(){
  try { const c=JSON.parse(localStorage.getItem('ops_cfg')||'{}'); if(c.key) Object.assign(S.cfg,c); } catch(_){}
  try { const n=JSON.parse(localStorage.getItem('ops_nicknames')||'{}'); S.nicknames=n; } catch(_){}
  try { const _g=currentGroup(); const t=JSON.parse(localStorage.getItem('ops_towers_'+_g)||'null'); if(t) S.towers.permanent=t; } catch(_){}
  try { const _g=currentGroup(); const tr=JSON.parse(localStorage.getItem('ops_trainees_'+_g)||'[]'); if(Array.isArray(tr)&&tr.length) S.trainees.permanent=tr; } catch(_){}
  document.getElementById('dp').value = new Date().toISOString().split('T')[0];
  close_setup();
  // Auto-login if session is still valid (page refresh)
  if(_sessionToken && sessionStorage.getItem('ops_access')==='OK'){
    // Re-initialise Firebase using stored token — fetch config from server
    (async()=>{
      try {
        const res  = await fetch('/api/auth', {
          method:  'POST',
          headers: { 'Content-Type':'application/json' },
          // Send a dummy code; server accepts stored tokens separately
          // Instead, we validate the token via a config endpoint
          body: JSON.stringify({ token: _sessionToken })
        });
        // If the token is still valid the server returns firebase config
        if(res.ok){
          const data = await res.json();
          if(data.token){ _sessionToken=data.token; sessionStorage.setItem('ops_token',_sessionToken); _lastTokenRefresh=Date.now(); }
          if(data.firebaseConfig && !firebase.apps.length){
            firebase.initializeApp(data.firebaseConfig);
            fbAuth = firebase.auth();
            fbDb   = firebase.database();
          }
          applyUser(data.user);
          document.getElementById('access-ov').style.display='none';
          fbSignIn();
        } else {
          // Token expired — show login screen
          sessionStorage.removeItem('ops_token');
          sessionStorage.removeItem('ops_access');
        }
      } catch(e){
        // Server unreachable on refresh — show login
        console.warn('Could not refresh session:', e);
      }
    })();
  } else {
    // Fresh device — wait for access code, don't pre-load
  }
  populateRosterDropdown();
})();

// 🔍 DEBUG button is hidden unless the page is opened with ?debug=1
if(/[?&]debug=1/.test(location.search)){ const b=document.getElementById('debug-btn'); if(b) b.style.display=''; }
