// ═══════════════════════════════════
// BACKUP
// ═══════════════════════════════════
function addBk(dk){
  const name=(document.getElementById(`bn-${dk}`).value||'').trim().toUpperCase();
  if(!name) return;
  const _bkPos=document.getElementById(`bp-${dk}`).value;
  const _bkTime=(document.getElementById(`btime-${dk}`)?.value||'').trim().toUpperCase();
  S.backups[dk].push({
    name,
    pos: _bkPos,
    type:(document.getElementById(`bt-${dk}`).value||'').trim().toUpperCase(),
    time: _bkTime||null,
    mcEl: false
  });
  logEvent('BACKUP', name+' added → '+dk.toUpperCase()+' ('+_bkPos+')'+(_bkTime?' RPT '+_bkTime:''));
  document.getElementById(`bn-${dk}`).value='';
  document.getElementById(`bt-${dk}`).value='';
  if(document.getElementById(`btime-${dk}`)) document.getElementById(`btime-${dk}`).value='';
  renderAll(); scheduleSave();
}

function removeBk(dk,i){
  const _bk=S.backups[dk]&&S.backups[dk][i];
  if(_bk) logEvent('BACKUP', _bk.name+' removed from '+dk.toUpperCase());
  S.backups[dk].splice(i,1);
  renderAll(); scheduleSave();
}
function toggleBkMcEl(dk,i){
  if(!S.backups[dk]||!S.backups[dk][i]) return;
  S.backups[dk][i].mcEl = !S.backups[dk][i].mcEl;
  const _bk=S.backups[dk][i];
  logEvent('BACKUP', _bk.name+' ('+dk.toUpperCase()+') '+(S.backups[dk][i].mcEl?'→ MC/EL':'→ restored'));
  renderAll(); scheduleSave();
}

// ═══════════════════════════════════
// SOC
// ═══════════════════════════════════
function addSoc(){
  S.soc.push({flight:'',name:'',time:'',remark:''});
  renderSummary(); switchTab('summary'); scheduleSave();
}
function rmSoc(i){ S.soc.splice(i,1); renderSummary(); scheduleSave(); logSectionChanges(); }

function addPdsc(){ S.pdsc.push({reg:'',certifier:''}); renderSummary(); scheduleSave(); }
function rmPdsc(i){ S.pdsc.splice(i,1); renderSummary(); scheduleSave(); logSectionChanges(); }
function addFgs() { S.fgs.push({reg:'',remark:''}); renderSummary(); scheduleSave(); }
function rmFgs(i) { S.fgs.splice(i,1); renderSummary(); scheduleSave(); logSectionChanges(); }

// ═══════════════════════════════════
// TABS
// ═══════════════════════════════════
function switchTab(t){
  clearSearch();
  S.tab=t;
  document.querySelectorAll('.tab').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(el=>el.classList.remove('active'));
  document.getElementById(`tab-${t}`).classList.add('active');
  document.getElementById(`panel-${t}`).classList.add('active');
}

// ═══════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════
function setSt(m){ document.getElementById('fetch-st').textContent=m; }
function showLoading(){
  document.getElementById('content').innerHTML=`<div class="loading-wrap"><div class="spinner"></div>Fetching from Google Sheets...</div>`;
}
function hideLoading(){
  document.getElementById('content').innerHTML=`
    <div id="panel-lo"      class="panel active"><div id="cl"></div></div>
    <div id="panel-irreg"   class="panel"><div id="ci"></div></div>
    <div id="panel-wo"      class="panel"><div id="cw"></div></div>
    <div id="panel-cim"     class="panel"><div id="cc"></div></div>
    <div id="panel-summary" class="panel"><div id="cs"></div></div>`;
  switchTab(S.tab);
}
function showErr(m){
  const tips = m.includes('403')||m.includes('API key')
    ? '· Your API key may be invalid or the Google Sheets API is not enabled.\n· Go to Google Cloud Console → APIs & Services → Library → enable Google Sheets API.'
    : m.includes('404')
    ? '· Sheet ID or Tab name is wrong. Check ⚙ CONFIG.'
    : m.includes('not found')
    ? '· The selected date may not exist in this tab yet.'
    : '· Check your API key, Sheet ID, and Tab name in ⚙ CONFIG.\n· Make sure the sheet is shared as "Anyone with the link - Viewer".';
  document.getElementById('content').innerHTML=`
    <div style="padding:24px;max-width:600px">
      <div style="background:var(--rbg);border:1px solid var(--red);border-radius:var(--r);padding:16px 20px;margin-bottom:12px">
        <div style="color:var(--red);font-weight:700;font-size:13px;margin-bottom:6px">⚠ Failed to load roster</div>
        <div style="color:var(--orange);font-size:12px;margin-bottom:10px">${m}</div>
        <div style="color:var(--txt2);font-size:11px;white-space:pre-line;line-height:2">${tips}</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-amber" onclick="loadRoster()">⟳ RETRY</button>
        <button class="btn btn-ghost" onclick="openSettings()">⚙ OPEN CONFIG</button>
      </div>
    </div>`;
}

// ═══════════════════════════════════
// PASTE ALLOCATION
// ═══════════════════════════════════
function openExclModal(){
  const excl=S.exclusions||[];
  const body=document.getElementById('excl-body');
  if(!excl.length){
    body.innerHTML=`<div style="text-align:center;padding:20px;color:var(--txt3);font-size:11px">No hidden staff.</div>`;
  } else {
    body.innerHTML=excl.map(id=>{
      // Try to find their name from staff or nicknames
      const s=S.staff.find(st=>st.id===id||st.id===id+'_BK');
      const name=s?displayName(s):(S.nicknames[id]||id);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--b)">
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--txt)">${name}</div>
          <div style="font-size:9px;color:var(--txt3)">${id}</div>
        </div>
        <button class="btn btn-amber btn-sm" style="font-size:9px" onclick="restoreStaff('${id}')">↩ RESTORE</button>
      </div>`;
    }).join('');
  }
  document.getElementById('excl-ov').classList.add('show');
}
function closeExclModal(){ document.getElementById('excl-ov').classList.remove('show'); }
function restoreStaff(id){
  S.exclusions=(S.exclusions||[]).filter(e=>e!==id);
  saveExclusions();
  openExclModal();
  renderAll();
  if(S.loaded) loadRoster();
}

function openActingGLModal(team, key){
  document.getElementById('actgl-title').textContent=`✎ ACTING GL — ${team}`;
  const current=S.actingGL[key]||'';
  // Get all on-shift staff for this team (any category)
  const isOnShiftFn=s=>{const a=effAvail(s);if(a.st==='WORKING')return true;if(S.overrides[s.id])return false;const raw=(s.schedVal||'').toUpperCase().trim();const _sh=document.getElementById('shift-sel').value.toUpperCase();return raw.startsWith(_sh);};
  const candidates=S.staff.filter(s=>effectiveDept(s)===team&&isOnShiftFn(s));

  let html=`<div style="font-size:10px;color:var(--txt2);margin-bottom:12px">Select a staff member to appoint as Acting GL for ${team}. This overrides the auto-detected GL until cleared.</div>`;
  
  if(current){
    html+=`<div style="background:#FFF7ED;border:1px solid var(--orange);border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:10px">
      <b style="color:var(--orange)">Current Acting GL:</b> ${current}
      <button class="btn btn-ghost btn-sm" style="margin-left:8px;font-size:9px" onclick="clearActingGL('${key}')">✕ CLEAR</button>
    </div>`;
  }

  html+=`<div style="display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto">`;
  candidates.forEach(s=>{
    const dn=displayName(s);
    const sel=dn===current;
    html+=`<button class="btn ${sel?'btn-amber':'btn-ghost'}" style="text-align:left;font-size:11px;padding:6px 12px" onclick="setActingGL('${key}','${dn}')">
      ${dn} <span style="color:var(--txt3);font-size:9px;margin-left:4px">${s.category} · ${s.desigCode||''}</span>
    </button>`;
  });
  html+=`</div>`;
  document.getElementById('actgl-body').innerHTML=html;
  document.getElementById('actgl-ov').classList.add('show');
}
function closeActingGLModal(){ document.getElementById('actgl-ov').classList.remove('show'); }
function setActingGL(key,name){
  if(!S.actingGL) S.actingGL={lo:'',irreg:'',wo:'',cim:''};
  S.actingGL[key]=name;
  logEvent('ACTING GL', name+' set as '+key.toUpperCase()+' GL');
  closeActingGLModal(); renderAll(); scheduleSave();
}
function clearActingGL(key){
  const _prevGL=S.actingGL&&S.actingGL[key];
  if(S.actingGL) S.actingGL[key]='';
  if(_prevGL) logEvent('ACTING GL', _prevGL+' cleared from '+key.toUpperCase()+' GL');
  closeActingGLModal(); renderAll(); scheduleSave();
}
