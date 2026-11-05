
function saveTowers(){
  const g=currentGroup();
  localStorage.setItem('ops_towers_'+g, JSON.stringify(S.towers.permanent));
  if(fbReady) fbDb.ref('settings/shifts/'+g+'/towers').set(S.towers.permanent).catch(e=>console.warn('Towers save error:',e));
}
function saveTrainees(){
  const g=currentGroup();
  localStorage.setItem('ops_trainees_'+g, JSON.stringify(S.trainees.permanent));
  if(fbReady) fbDb.ref('settings/shifts/'+g+'/trainees').set(S.trainees.permanent).catch(e=>console.warn('Trainees save error:',e));
}

// ═══════════════════════════════════
// SHEET CONFIGS (per-month)
// ═══════════════════════════════════
// Key format: MMYY e.g. "0526" = May 2026

function dateToMmyy(dateStr){
  // dateStr = "2026-05-18" → "0526"
  if(!dateStr) return '';
  const [yr, mo] = dateStr.split('-');
  return mo + yr.slice(2);
}

function mmyyToLabel(mmyy){
  // "0526" → "May 2026"
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mo = parseInt(mmyy.slice(0,2),10);
  const yr = '20' + mmyy.slice(2);
  return (months[mo-1]||mmyy)+' '+yr;
}

function getSheetConfigForDate(dateStr){
  const key = dateToMmyy(dateStr);
  if(key && S.sheetConfigs[key]) return S.sheetConfigs[key];
  return { sid: S.cfg.sid, tab: S.cfg.tab }; // fallback to default
}

async function loadSheetConfigs(){
  // Load from localStorage first (fast)
  try{ const lc=JSON.parse(localStorage.getItem('ops_sheetConfigs')||'{}'); if(lc) S.sheetConfigs=lc; }catch(_){}
  // Then sync from Firebase (authoritative)
  if(!fbReady) return;
  try{
    const snap=await fbDb.ref('settings/sheetConfigs').get();
    if(snap.exists()){ S.sheetConfigs=snap.val()||{}; localStorage.setItem('ops_sheetConfigs',JSON.stringify(S.sheetConfigs)); }
  }catch(e){ console.warn('loadSheetConfigs:',e); }
}

async function saveSheetConfigEntry(mmyy, sid, tab){
  if(!mmyy||!sid||!tab) return;
  S.sheetConfigs[mmyy]={ sid, tab };
  localStorage.setItem('ops_sheetConfigs', JSON.stringify(S.sheetConfigs));
  if(fbReady) await fbDb.ref('settings/sheetConfigs/'+mmyy).set({sid,tab}).catch(e=>console.warn(e));
  renderSheetConfigs();
}

async function deleteSheetConfigEntry(mmyy){
  if(!confirm('Remove config for '+mmyyToLabel(mmyy)+'?')) return;
  delete S.sheetConfigs[mmyy];
  localStorage.setItem('ops_sheetConfigs', JSON.stringify(S.sheetConfigs));
  if(fbReady) await fbDb.ref('settings/sheetConfigs/'+mmyy).remove().catch(e=>console.warn(e));
  renderSheetConfigs();
}

function renderSheetConfigs(){
  const el=document.getElementById('sheet-configs-list');
  if(!el) return;
  const keys=Object.keys(S.sheetConfigs).sort().reverse();
  if(!keys.length){
    el.innerHTML='<div style="font-size:11px;color:var(--txt3);padding:8px 0">No monthly configs yet. Add one below.</div>';
    return;
  }
  el.innerHTML=keys.map(k=>{
    const c=S.sheetConfigs[k];
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--b);font-size:11px">
      <div style="min-width:80px;font-weight:700;color:var(--amber)">${mmyyToLabel(k)}</div>
      <div style="flex:1;color:var(--txt2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.tab}">${c.tab}</div>
      <button class="btn btn-ghost btn-sm" onclick="deleteSheetConfigEntry('${k}')" style="padding:2px 8px;font-size:10px;color:var(--red)">✕</button>
    </div>`;
  }).join('');
}

function addSheetConfig(){
  const mmyy = (document.getElementById('sc-mmyy').value||'').trim().replace('/','');
  const sid  = (document.getElementById('sc-sid').value||'').trim();
  const tab  = (document.getElementById('sc-tab').value||'').trim();
  if(!mmyy||mmyy.length!==4){ alert('Enter month in MMYY format, e.g. 0626 for June 2026'); return; }
  if(!sid){ alert('Sheet ID is required'); return; }
  if(!tab){ alert('Tab name is required'); return; }
  saveSheetConfigEntry(mmyy, sid, tab);
  document.getElementById('sc-mmyy').value='';
  document.getElementById('sc-sid').value='';
  document.getElementById('sc-tab').value='';
}

async function loadTowers(){
  if(!fbReady) return;
  const g=currentGroup();
  try {
    const snap=await fbDb.ref('settings/shifts/'+g+'/towers').get();
    if(snap.exists()){
      const cloud=snap.val();
      if(Array.isArray(cloud)&&cloud.length){
        S.towers.permanent=cloud;
        localStorage.setItem('ops_towers_'+g,JSON.stringify(cloud));
        renderAll();
        return;
      }
    }
    // No data for this shift — clear so previous shift's list doesn't bleed through
    S.towers.permanent=[];
    renderAll();
  } catch(e){ console.warn('Towers load error:',e); }
}

function openExclusionsModal(){
  const el=document.getElementById('excl-body');
  const excl=S.exclusions||[];
  if(!excl.length){
    el.innerHTML=`<div style="color:var(--txt2);font-size:11px;text-align:center;padding:20px">No staff permanently hidden.</div>`;
  } else {
    // Try to find staff names from nicknames or full name lookup
    el.innerHTML=`<div style="font-size:9px;color:var(--txt2);margin-bottom:10px">These staff are permanently hidden from all lists. Click RESTORE to bring them back.</div>`+
    excl.map((id,i)=>{
      const knownName=S.nicknames[id]||id;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--surf2);border-radius:4px;margin-bottom:4px">
        <span style="font-size:11px;font-weight:600;color:var(--txt)">${knownName}</span>
        <button class="btn btn-sm" style="font-size:9px;background:var(--bbg);border:1px solid var(--blue);color:var(--blue);padding:2px 8px"
          onclick="restoreStaff('${id}',${i})">↩ RESTORE</button>
      </div>`;
    }).join('');
  }
  document.getElementById('excl-ov').classList.add('show');
}

function restoreStaff(id, idx){
  S.exclusions=(S.exclusions||[]).filter(e=>e!==id);
  saveExclusions();
  openExclModal();
  if(S.loaded) loadRoster();
}

function closeExclModal(){ document.getElementById('excl-ov').classList.remove('show'); }

function saveExclusions(){
  if(fbReady) fbDb.ref('settings/exclusions').set(S.exclusions).catch(e=>console.warn('Exclusions save error:',e));
}
async function loadExclusions(){
  if(!fbReady) return;
  try {
    const snap=await fbDb.ref('settings/exclusions').get();
    if(snap.exists()){ const d=snap.val(); if(Array.isArray(d)) S.exclusions=d; }
  } catch(e){ console.warn('Exclusions load error:',e); }
}
async function loadTrainees(){
  if(!fbReady) return;
  const g=currentGroup();
  try {
    const snap=await fbDb.ref('settings/shifts/'+g+'/trainees').get();
    if(snap.exists()){
      const cloud=snap.val();
      if(Array.isArray(cloud)&&cloud.length){
        S.trainees.permanent=cloud;
        localStorage.setItem('ops_trainees_'+g,JSON.stringify(cloud));
        return;
      }
    }
    // No data for this shift — clear so previous shift's list doesn't bleed through
    S.trainees.permanent=[];
  } catch(e){ console.warn('Trainees load error:',e); }
}

function close_setup(){ document.getElementById('setup-ov').classList.remove('show'); }

// ── Dynamic header shift label ──
function updateLogoShift(){
  const g = document.getElementById('shift-group-sel')?.value || 'C';
  const el = document.getElementById('logo-shift');
  if(el) el.textContent = '· SHIFT '+g;
}
function currentGroup(){ return (document.getElementById('shift-group-sel')?.value||'C').toUpperCase(); }

// ── Alias so both open/closeExclusionsModal and open/closeExclModal work ──
function closeExclusionsModal(){ closeExclModal(); }

// ── Global Escape key closes any open overlay ──
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  document.querySelectorAll('.overlay.show').forEach(ov => ov.classList.remove('show'));
});

function openSettings(){
  document.getElementById('cfg-sid').value = S.cfg.sid;
  document.getElementById('cfg-tab').value = S.cfg.tab;
  renderSheetConfigs();
  document.getElementById('cfg-ov').classList.add('show');
}
function closeCfg(){ document.getElementById('cfg-ov').classList.remove('show'); }

// ═══════════════════════════════════
// ROSTER HISTORY
// ═══════════════════════════════════
function loadRosterHistory(){ try{ return JSON.parse(localStorage.getItem('ops_roster_history')||'[]'); }catch(e){ return []; } }
function saveRosterHistory(h){ localStorage.setItem('ops_roster_history', JSON.stringify(h)); }

function populateRosterDropdown(){
  const sel = document.getElementById('roster-sel');
  if(!sel) return;
  const history = loadRosterHistory();
  const cur = S.cfg.sid+'|'+S.cfg.tab;
  sel.innerHTML = '<option value="">— saved rosters —</option>' +
    history.map((r,i)=>`<option value="${i}" ${r.sid+'|'+r.tab===cur?'selected':''}>${r.label}</option>`).join('');
}

function switchSavedRoster(idx){
  if(idx==='') return;
  const history = loadRosterHistory();
  const r = history[parseInt(idx)];
  if(!r) return;
  S.cfg.sid = r.sid;
  S.cfg.tab = r.tab;
  S.cfg.key = r.key || S.cfg.key; // keep existing key if not stored
  localStorage.setItem('ops_cfg', JSON.stringify(S.cfg));
  loadRoster();
}

function openRosterHistory(){
  renderRosterHistoryModal();
  document.getElementById('roster-hist-ov').classList.add('show');
}
function closeRosterHistory(){ document.getElementById('roster-hist-ov').classList.remove('show'); populateRosterDropdown(); }

function renderRosterHistoryModal(){
  const el = document.getElementById('roster-hist-body');
  const history = loadRosterHistory();

  el.innerHTML = `
    <div style="font-size:10px;color:var(--txt2);margin-bottom:16px;line-height:1.8">
      Save each month's roster link here. When a new roster is shared, add it below and switch between months anytime.
    </div>

    <!-- Saved entries -->
    <div id="rh-list" style="margin-bottom:16px">
      ${history.length===0?`<div style="font-size:11px;color:var(--txt3);padding:8px 0">No saved rosters yet. Add the current one below.</div>`:''}
      ${history.map((r,i)=>`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:10px 12px;background:var(--bg);border:1px solid ${r.sid===S.cfg.sid&&r.tab===S.cfg.tab?'var(--amber)':'var(--b)'};border-radius:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;color:${r.sid===S.cfg.sid&&r.tab===S.cfg.tab?'var(--amber)':'var(--txt)'};margin-bottom:2px">${r.label} ${r.sid===S.cfg.sid&&r.tab===S.cfg.tab?'<span style="font-size:9px;color:var(--amber)">● ACTIVE</span>':''}</div>
            <div style="font-size:9px;color:var(--txt3);font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Tab: ${r.tab} · ${r.sid.substring(0,28)}…</div>
          </div>
          <button class="btn btn-amber btn-sm" onclick="loadSavedRoster(${i})">LOAD</button>
          <button class="btn btn-red btn-sm" onclick="deleteSavedRoster(${i})">✕</button>
        </div>`).join('')}
    </div>

    <!-- Add new -->
    <div style="background:var(--bg);border:1px solid var(--b);border-radius:6px;padding:14px">
      <div style="font-size:9px;color:var(--amber);letter-spacing:2px;font-weight:700;margin-bottom:12px">ADD ROSTER</div>
      <div style="display:grid;gap:8px">
        <div>
          <div style="font-size:8px;color:var(--txt3);margin-bottom:3px">LABEL (e.g. Jun 2026 KUL)</div>
          <input id="rh-label" type="text" placeholder="Jun 2026 KUL" style="width:100%;background:var(--surf);border:1px solid var(--b);border-radius:4px;color:var(--txt);padding:6px 10px;font-family:var(--mono);font-size:12px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <div style="font-size:8px;color:var(--txt3);margin-bottom:3px">GOOGLE SHEET ID</div>
          <input id="rh-sid" type="text" placeholder="1bdJVm15vGk7Av..." style="width:100%;background:var(--surf);border:1px solid var(--b);border-radius:4px;color:var(--txt);padding:6px 10px;font-family:var(--mono);font-size:11px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <div style="font-size:8px;color:var(--txt3);margin-bottom:3px">TAB NAME (station tab, e.g. KUL/0626/R0)</div>
          <input id="rh-tab" type="text" placeholder="KUL/0626/R0" style="width:100%;background:var(--surf);border:1px solid var(--b);border-radius:4px;color:var(--txt);padding:6px 10px;font-family:var(--mono);font-size:12px;outline:none;box-sizing:border-box">
        </div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-amber" style="flex:1" onclick="addAndLoadRoster()">SAVE & LOAD</button>
          <button class="btn btn-ghost" onclick="saveCurrentAsRoster()">SAVE CURRENT CONFIG</button>
        </div>
      </div>
    </div>`;
}

function loadSavedRoster(i){
  const history = loadRosterHistory();
  const r = history[i];
  if(!r) return;
  S.cfg.sid=r.sid; S.cfg.tab=r.tab;
  if(r.key) S.cfg.key=r.key;
  localStorage.setItem('ops_cfg',JSON.stringify(S.cfg));
  closeRosterHistory();
  loadRoster();
}

function deleteSavedRoster(i){
  const history = loadRosterHistory();
  history.splice(i,1);
  saveRosterHistory(history);
  renderRosterHistoryModal();
  populateRosterDropdown();
}

function addAndLoadRoster(){
  const label = (document.getElementById('rh-label').value||'').trim();
  const sid   = (document.getElementById('rh-sid').value||'').trim();
  const tab   = (document.getElementById('rh-tab').value||'').trim();
  if(!label||!sid||!tab){ alert('Please fill in all fields.'); return; }
  const history = loadRosterHistory();
  history.unshift({ label, sid, tab, key: S.cfg.key, addedAt: new Date().toISOString() });
  saveRosterHistory(history);
  S.cfg.sid=sid; S.cfg.tab=tab;
  localStorage.setItem('ops_cfg',JSON.stringify(S.cfg));
  closeRosterHistory();
  loadRoster();
}

function saveCurrentAsRoster(){
  const label = (document.getElementById('rh-label').value||'').trim() ||
    prompt('Label for current roster (e.g. May 2026 KUL):','');
  if(!label) return;
  const history = loadRosterHistory();
  // Don't duplicate
  if(history.some(r=>r.sid===S.cfg.sid&&r.tab===S.cfg.tab)){
    alert('This roster is already saved.'); return;
  }
  history.unshift({ label, sid:S.cfg.sid, tab:S.cfg.tab, key:S.cfg.key, addedAt:new Date().toISOString() });
  saveRosterHistory(history);
  renderRosterHistoryModal();
  populateRosterDropdown();
}

function saveCfg(fromSetup){
  const [sEl,tEl] = fromSetup
    ? ['su-sid','su-tab']
    : ['cfg-sid','cfg-tab'];
  S.cfg.sid = document.getElementById(sEl).value.trim();
  S.cfg.tab = document.getElementById(tEl).value.trim();
  if(!S.cfg.sid){ alert('Please enter the Sheet ID.'); return; }
  localStorage.setItem('ops_cfg', JSON.stringify(S.cfg));
  close_setup(); closeCfg();
  loadRoster();
  populateRosterDropdown();
}

function dateChanged(){ if(S.loaded) loadRoster(); }

