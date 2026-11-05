// ═══════════════════════════════════
// BACKEND API — replaces hardcoded secrets
// All credentials now live in .env on the server
// ═══════════════════════════════════

// Session token stored after successful auth
let _sessionToken = sessionStorage.getItem('ops_token') || null;

// Firebase is initialised lazily after auth succeeds (config comes from server)
let fbAuth = null;
let fbDb   = null;
let fbReady = false;
const _myClientId = Math.random().toString(36).slice(2,10); // unique per browser tab — used to ignore own save echoes
let _fbLiveRef = null; // holds active Firebase .on('value') listener for real-time sync
let _loadedKey = null; // fbKey whose cloud state has been successfully loaded — saves are blocked until it matches (prevents blank state overwriting real data)
let _fbLoadRetries = 0;
let _applyingRemote = false; // true while merging a remote update in — blocks scheduleSave() from echoing it back
let _rolesSnapshot = null; // snapshot of S.roles taken when roles modal opens (for diff logging)
let _adpExpiry = {}; // { staffId: "YYYY-MM-DD" } — ADP expiry dates, loaded globally from Firebase
let _wcAuth   = {}; // { staffId: true } — techs authorized as WC Primary
let _adpDept = ''; // dept filter for ADP modal ('' = all)
let _adpWarnDays = 30; // ADP warning threshold in days (30 or 45) — configurable, persisted to Firebase

// Who is logged in (set from the server's login/renewal response). mode "view" = can look, not change.
let _user = { name: '', mode: 'edit' };
let _writesLocked = false;
let _lastBlockedToast = 0;
function isViewOnly(){ return _user.mode==='view'; }

// View-only: every Firebase write (except the "who is viewing" presence marker) becomes a no-op,
// so a view-only login can never change saved data from the app.
function lockFirebaseWrites(){
  if(_writesLocked || !fbDb) return;
  _writesLocked = true;
  const origRef = fbDb.ref.bind(fbDb);
  fbDb.ref = (path) => {
    const r = origRef(path);
    if(/^presence\//.test(String(path||''))) return r;
    ['set','update','remove','push','transaction'].forEach(m=>{
      r[m] = () => {
        if(Date.now()-_lastBlockedToast>4000){ _lastBlockedToast=Date.now(); if(typeof showToast==='function') showToast('View-only login — changes are not saved','err',3000); }
        return Promise.resolve();
      };
    });
    return r;
  };
}

function applyUser(u){
  if(u && u.name) _user = { name: String(u.name), mode: u.mode==='view' ? 'view' : 'edit' };
  document.body.classList.toggle('viewonly', isViewOnly());
  const chip=document.getElementById('user-chip');
  if(chip && _user.name){ chip.style.display='inline-block'; chip.textContent='👤 '+_user.name+(isViewOnly()?' · VIEW ONLY':''); chip.classList.toggle('vo',isViewOnly()); }
  if(isViewOnly()) lockFirebaseWrites();
}

/**
 * Authenticate against the backend.
 * On success: receives JWT + Firebase config, then initialises Firebase.
 */
async function checkAccess(){
  const val = (document.getElementById('access-input').value||'').trim();
  const errEl = document.getElementById('access-err');
  errEl.textContent = '';

  try {
    const res  = await fetch('/api/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code: val })
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Incorrect code. Try again.';
      document.getElementById('access-input').value = '';
      document.getElementById('access-input').focus();
      return;
    }

    // Store token for API calls
    _sessionToken = data.token;
    sessionStorage.setItem('ops_token', _sessionToken);
    sessionStorage.setItem('ops_access', 'OK'); // backward compat flag

    // Initialise Firebase with config returned by server
    if (!firebase.apps.length) {
      firebase.initializeApp(data.firebaseConfig);
    }
    fbAuth = firebase.auth();
    fbDb   = firebase.database();
    applyUser(data.user);

    document.getElementById('access-ov').style.display = 'none';
    fbSignIn();

  } catch(e) {
    errEl.textContent = 'Could not reach server. Is it running?';
  }
}

// ── Session renewal ──
// The server swaps a still-valid token for a fresh 12h one, so a page that stays open
// (e.g. all through a night shift) never hits the expiry. Runs every 30 min + when the tab wakes up.
let _lastTokenRefresh = Date.now();
async function refreshSession(){
  if(!_sessionToken) return false;
  try{
    const res = await fetch('/api/auth', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token: _sessionToken })
    });
    if(res.status===401){ showSessionExpired(); return false; }
    if(!res.ok) return false;            // server hiccup — keep the current token, try again later
    const data = await res.json();
    if(data.token){
      _sessionToken = data.token;
      sessionStorage.setItem('ops_token', _sessionToken);
      _lastTokenRefresh = Date.now();
      if(data.user) applyUser(data.user);
    }
    return true;
  }catch(e){ console.warn('refreshSession:', e); return false; } // offline — try again later
}
function showSessionExpired(){
  sessionStorage.removeItem('ops_token'); sessionStorage.removeItem('ops_access');
  _sessionToken = null; _user={name:'',mode:'edit'};
  const ov=document.getElementById('access-ov'); if(ov) ov.style.display='flex';
  const err=document.getElementById('access-err'); if(err) err.textContent='Session expired — enter the access code to continue. Your unsaved changes are kept.';
}
setInterval(refreshSession, 30*60*1000);
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='visible' && Date.now()-_lastTokenRefresh > 10*60*1000) refreshSession();
});

function fbSignIn(){
  const el=document.getElementById('save-ts');
  if(el) el.textContent='☁ Connecting…';
  fbAuth.signInAnonymously()
    .then(()=>{
      fbReady=true;
      if(el) el.textContent='☁ Connected';
      setupPresence();
      // Load nicknames first, then shift data so nicknames are ready when rendering
      loadNicknames().then(async ()=>{
        loadEngSpecialists();
        await loadExclusions();
        await loadAdpExpiry();
        await loadWcAuth();
        await loadAdpWarnDays();
        await loadSheetConfigs();
        const oldDate=document.getElementById('dp')?.value;
        const oldShift=document.getElementById('shift-sel')?.value;
        const oldGroup=document.getElementById('shift-group-sel')?.value;
        await loadLastDate(); // sets correct shift group FIRST
        await loadTowers();   // now loads the correct shift's towers
        await loadTrainees(); // now loads the correct shift's trainees
        const newDate=document.getElementById('dp')?.value;
        const newShift=document.getElementById('shift-sel')?.value;
        const newGroup=document.getElementById('shift-group-sel')?.value;
        if(S.loaded && newDate===oldDate && newShift===oldShift && newGroup===oldGroup){
          // Roster already loaded for the same date/shift — just refresh from Firebase
          await fbLoad();
        } else {
          // Date/shift changed or roster not yet loaded — fetch roster first;
          // loadRoster() will call fbLoad() when done
          loadRoster();
        }
        flushPendingSave();
      });
    })
    .catch(e=>{ 
      if(el) el.textContent='⚠ Offline mode'; 
      console.warn('Firebase auth error:',e); 
    });
}

// ── Save / Load key ──
function fbKey(){
  const date  = document.getElementById('dp')?.value||'';
  const group = document.getElementById('shift-group-sel')?.value||'';
  const shift = document.getElementById('shift-sel')?.value||'';
  if(!date||!shift) return '';
  return `shifts/${date}_${group}_${shift}`;
}

const SAVE_FIELDS=['overrides','swaps','transfers','backups','ssTechs',
  'soc','pdsc','fgs','ops','roles','actingGL','exclusions'];

// Force save when tab goes to background or closes — works on mobile too
window.addEventListener('beforeunload', ()=>{ if(fbReady&&S.loaded){ fbSave(); } });
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='hidden'&&fbReady&&S.loaded){ fbSave(); }
});



function saveLastDate(){
  if(!fbReady) return;
  const d =document.getElementById('dp')?.value;
  const sh=document.getElementById('shift-sel')?.value;
  const sg=document.getElementById('shift-group-sel')?.value;
  if(d&&sh) fbDb.ref('settings/lastDate').set({date:d,shift:sh,shiftGroup:sg||'C'}).catch(()=>{});
}

function fbSave(){
  if(!fbReady||!S.loaded||isViewOnly()){ return; }
  const key=S._fbKey||fbKey(); // use stored key so mid-switch saves don't write to wrong date
  if(!key){ return; }
  // Never write until we've actually read this date's cloud state — otherwise a failed/slow
  // load (e.g. after the page sat idle and the connection dropped) would overwrite real data with blank.
  if(_loadedKey!==key){ pendingSave=true; return; }
  const payload={_savedAt:Date.now(),_key:key,_clientId:_myClientId};
  SAVE_FIELDS.forEach(f=>{
    try{ payload[f]=JSON.parse(JSON.stringify(S[f])); }catch(e){}
  });
  // Synchronous localStorage backup — survives async Firebase timing issues
  try{ localStorage.setItem('ops_ls_'+key, JSON.stringify(payload)); }catch(e){}
  const el=document.getElementById('save-ts');
  fbDb.ref(key).set(payload)
    .then(()=>{ if(el) el.textContent='☁ Saved '+new Date().toLocaleTimeString(); saveLastDate(); showToast('Saved','ok',1500); })
    .catch(e=>{ if(el) el.textContent='⚠ Save failed: '+e.code; console.error('fbSave:',e); showToast('Save failed: '+e.code,'err'); });
}

async function fbLoad(){
  if(!fbReady){ _restoringFromFb=false; return; }
  const key=fbKey();
  if(!key){ _restoringFromFb=false; return; }
  const el=document.getElementById('save-ts');
  if(el) el.textContent='☁ Loading…';
  let stale=false, failed=false;
  try{
    const snap=await fbDb.ref(key).get();
    // Date/shift changed while we were waiting — a newer load owns the state now; discard this result
    if(key!==(S._fbKey||fbKey())){ stale=true; return; }
    if(snap.exists()){
      const raw=snap.val();
      const d=sanitizeState(raw);
      SAVE_FIELDS.forEach(f=>{ if(d[f]!=null) try{ S[f]=JSON.parse(JSON.stringify(d[f])); }catch(e){} });
      if(el) el.textContent='☁ Synced '+new Date(d._savedAt||Date.now()).toLocaleTimeString(); showToast('Synced from cloud','ok',1800);
    } else {
      if(el) el.textContent='☁ No saved data';
    }
    _loadedKey=key; _fbLoadRetries=0; // cloud state confirmed — saving is now safe
    renderAll();
  }catch(e){
    failed=true;
    if(el) el.textContent='⚠ Cloud load failed — retrying… (saving paused)';
    console.error('fbLoad:',e);
  } finally {
    if(!stale){
      _restoringFromFb=false;
      if(failed){
        if(_fbLoadRetries++<8) setTimeout(()=>{ if(key===(S._fbKey||fbKey())){ _restoringFromFb=true; fbLoad(); } }, Math.min(2000*_fbLoadRetries,15000));
      } else {
        setupFbLiveSync(); // start live listener after initial snapshot load
        if(pendingSave) flushPendingSave();
      }
    }
  }
}

function setupFbLiveSync(){
  // Detach previous listener if any
  if(_fbLiveRef){ _fbLiveRef.off('value'); _fbLiveRef=null; }
  const key=S._fbKey||fbKey();
  if(!key||!fbReady||!S.loaded) return;
  _fbLiveRef=fbDb.ref(key);
  _fbLiveRef.on('value', snap=>{
    if(_restoringFromFb||!S.loaded) return; // mid-load — skip
    if(!snap.exists()) return;
    const raw=snap.val();
    if(raw._clientId===_myClientId) return; // our own save echoed back — ignore
    applyRemoteData(raw);
    showToast('🔄 Live update from another user','ok',2000);
  }, err=>console.error('FB live sync error:',err));
}

async function clearDateData(){
  if(!S.loaded){ alert('Load a roster first before resetting.'); return; }
  const key = fbKey();
  if(!key){ alert('No date/shift selected.'); return; }
  const label = key.replace('shifts/','');
  if(!confirm(`RESET all saved data for ${label}?\n\nThis clears:\n• SS techs\n• Roles (WC, MOJO, RUNNERS, TOWERS)\n• Swaps & transfers\n• Backups\n• SOC / PDSC / FGS / OPS\n\nThe roster staff list stays. This cannot be undone.`)) return;
  // 1. Wipe Firebase
  if(fbReady){
    try{ await fbDb.ref(key).remove(); }catch(e){ console.warn('FB delete error:',e); }
  }
  // 2. Wipe localStorage backup
  try{ localStorage.removeItem('ops_ls_'+key); }catch(e){}
  // 3. Reset state fields to defaults
  S.overrides  = {};
  S.swaps      = [];
  S.transfers  = [];
  S.backups    = { lo:[], irreg:[], wo:[], cim:[], moc:[] };
  S.ssTechs    = [];
  S.soc        = [{ flight:'', name:'', time:'', remark:'' }];
  S.pdsc       = [{ reg:'', certifier:'' }];
  S.fgs        = [{ reg:'', remark:'' }];
  S.ops        = { ARR:'', DEP:'', TOW:'' };
  S.actingGL   = { lo:'', irreg:'', wo:'', cim:'' };
  S.roles      = {
    mocChaser: '',
    mojo: ['','',''],
    wc: [{ primary:'', asst:'' },{ primary:'', asst:'' }],
    runners: [
      { name:'', timing:'0700-1300' },
      { name:'', timing:'0700-1300' },
      { name:'', timing:'1300-1900' },
      { name:'', timing:'1300-1900' }
    ],
    towerSlots: [
      { a:'', b:'', backup:'' },
      { a:'', b:'', backup:'' },
      { a:'', b:'', backup:'' },
      { a:'', b:'', backup:'' }
    ]
  };
  // 4. Re-render & update status bar
  renderAll();
  const el = document.getElementById('save-ts');
  if(el) el.textContent = '🗑 Reset — ' + label;
}

async function loadLastDate(){
  if(!fbReady) return;
  try {
    const snap=await fbDb.ref('settings/lastDate').get();
    if(snap.exists()){
      const {date,shift,shiftGroup}=snap.val();
      const dp=document.getElementById('dp');
      const ss=document.getElementById('shift-sel');
      const sg=document.getElementById('shift-group-sel');
      if(dp&&date) dp.value=date;
      if(ss&&shift) ss.value=shift;
      if(sg&&shiftGroup){ sg.value=shiftGroup; updateLogoShift(); loadEngSpecialists(); }
    }
  } catch(e){}
}


let saveTimer=null, pendingSave=false;
// ── DARK MODE ──
function toggleDark(){
  const dark=document.body.classList.toggle('dark');
  localStorage.setItem('opsDark',dark?'1':'0');
  document.getElementById('darkToggle').textContent=dark?'☀ LIGHT':'🌙 DARK';
}
(function(){
  if(localStorage.getItem('opsDark')==='1'){
    document.body.classList.add('dark');
    const btn=document.getElementById('darkToggle');
    if(btn)btn.textContent='☀ LIGHT';
  }
})();
// ── STAFF SEARCH ──
function filterStaff(q){
  const query=q.toLowerCase().trim();
  const clr=document.getElementById('search-clr');
  const info=document.getElementById('search-info');
  if(clr)clr.style.display=query?'':'none';
  let shown=0,total=0;
  document.querySelectorAll('.card').forEach(card=>{
    const name=(card.querySelector('.cname')?.textContent||'').toLowerCase();
    const match=!query||name.includes(query);
    card.style.display=match?'':'none';
    total++; if(match)shown++;
  });
  if(info)info.textContent=query?`${shown}/${total} staff`:''
}
function clearSearch(){
  const inp=document.getElementById('staff-search');
  if(inp){inp.value='';filterStaff('');}
}
function staggerCards(){
  requestAnimationFrame(()=>{
    const cards=document.querySelectorAll('.card');
    cards.forEach((card,i)=>{
      card.style.opacity='0';
      card.style.animation='none';
      const delay=Math.min(i*28,700);
      setTimeout(()=>{
        card.style.opacity='';
        card.style.animation=`cardIn .3s ease ${delay}ms both`;
      },0);
    });
  });
}
function showToast(msg,type='info',ms=2500){
  const w=document.getElementById('toast-wrap'); if(!w) return;
  const t=document.createElement('div');
  t.className='toast'+(type==='ok'?' ok':type==='err'?' err':'');
  t.innerHTML=(type==='ok'?'✓':type==='err'?'✕':'ℹ')+' <span>'+msg+'</span>';
  w.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),250);},ms);
}
let _restoringFromFb=false; // true while fbLoad() is running — blocks scheduleSave from overwriting Firebase with blank state



function scheduleSave(){
  if(!S.loaded || _restoringFromFb || _applyingRemote || isViewOnly()) return;
  pendingSave=true;
  if(!fbReady) return; // will flush when fbReady
  clearTimeout(saveTimer);
  saveTimer=setTimeout(fbSave, 500);
}

function flushPendingSave(){
  if(pendingSave && fbReady){ pendingSave=false; fbSave(); }
}

function sanitizeState(data){
  if(!data||typeof data!=='object') return data||{};

  // Arrays that must always be arrays
  const mustBeArr = ['swaps','transfers','ssTechs'];
  mustBeArr.forEach(f=>{ if(!Array.isArray(data[f])) data[f]=[]; });

  // backups object
  if(!data.backups||typeof data.backups!=='object') data.backups={};
  ['lo','irreg','wo','cim','moc'].forEach(k=>{ if(!Array.isArray(data.backups[k])) data.backups[k]=[]; else data.backups[k].forEach(b=>{ if(b.time===undefined) b.time=null; }); });

  // towers
  if(!data.towers||typeof data.towers!=='object') data.towers={permanent:[],backups:[]};
  if(!Array.isArray(data.towers.permanent)) data.towers.permanent=[];
  if(!Array.isArray(data.towers.backups))   data.towers.backups=[];
  data.towers.permanent.forEach((t,i)=>{ if(!t||typeof t!=='object') data.towers.permanent[i]={name:'',status:'AVAIL'}; });

  // trainees
  if(!data.trainees||typeof data.trainees!=='object') data.trainees={permanent:[],backups:[]};
  if(!Array.isArray(data.trainees.permanent)) data.trainees.permanent=[];
  if(!Array.isArray(data.trainees.backups))   data.trainees.backups=[];

  // soc/pdsc/fgs
  if(!Array.isArray(data.soc)||!data.soc.length)   data.soc=[{flight:'',name:'',time:'',remark:''}];
  if(!Array.isArray(data.pdsc)||!data.pdsc.length)  data.pdsc=[{reg:'',certifier:''}];
  if(!Array.isArray(data.fgs)||!data.fgs.length)    data.fgs=[{reg:'',remark:''}];

  // ops
  if(!data.ops||typeof data.ops!=='object') data.ops={ARR:'',DEP:'',TOW:''};

  if(!data.actingGL||typeof data.actingGL!=='object') data.actingGL={lo:'',irreg:'',wo:'',cim:''};
  ['lo','irreg','wo','cim'].forEach(k=>{ if(typeof data.actingGL[k]!=='string') data.actingGL[k]=''; });

  // nicknames/overrides
  if(!data.nicknames||typeof data.nicknames!=='object') data.nicknames={};
  if(!data.overrides||typeof data.overrides!=='object') data.overrides={};

  // ssTechs
  if(!Array.isArray(data.ssTechs)) data.ssTechs=[];

  // roles — full deep sanitize
  const defRoles = {
    mocChaser:'', mojo:['','',''],
    wc:[{primary:'',asst:''},{primary:'',asst:''}],
    runners:[
      {name:'',timing:'0700-1300'},{name:'',timing:'0700-1300'},
      {name:'',timing:'1300-1900'},{name:'',timing:'1300-1900'}
    ],
    towerSlots:[{a:'',b:'',backup:''},{a:'',b:'',backup:''},{a:'',b:'',backup:''},{a:'',b:'',backup:''}]
  };
  if(!data.roles||typeof data.roles!=='object'){ data.roles=defRoles; return data; }
  const r=data.roles;
  if(!Array.isArray(r.mojo)||r.mojo.length<3)       r.mojo=[0,1,2].map(i=>r.mojo?.[i]||'');
  if(!Array.isArray(r.wc)||r.wc.length<2)
    r.wc=[0,1].map(i=>({primary:r.wc?.[i]?.primary||'',asst:r.wc?.[i]?.asst||''}));
  if(!Array.isArray(r.runners)||r.runners.length<4)
    r.runners=defRoles.runners.map((d,i)=>({name:r.runners?.[i]?.name||'',timing:r.runners?.[i]?.timing||d.timing}));
  // Aug 2026: update old slash-format runner timings to new flat schedule
  { const nt=['0700-1300','0700-1300','1300-1900','1300-1900'];
    r.runners.forEach((rn,i)=>{ if(rn.timing&&rn.timing.includes('/')) rn.timing=nt[i]||rn.timing; }); }
  // Aug 2026: migrate old SS night-runner timings to new schedule
  { const nm={'1800-0000':'1900-0100','1800-2400':'1900-0100','0000-0600':'0100-0700','0000-0700':'0100-0700'};
    r.runners.forEach(rn=>{ const t=(rn.timing||'').trim(); if(nm[t]) rn.timing=nm[t]; }); }
  if(!Array.isArray(r.towerSlots)||r.towerSlots.length<4)
    r.towerSlots=[0,1,2,3].map(i=>({a:r.towerSlots?.[i]?.a||'',b:r.towerSlots?.[i]?.b||'',backup:r.towerSlots?.[i]?.backup||''}));
  if(typeof r.mocChaser!=='string') r.mocChaser='';

  return data;
}

// Auto-save hook — patch renderAll
