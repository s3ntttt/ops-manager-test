// ADP expiry + WC-authorised techs: global (not per-date) settings, their badges/warnings and the ADP modal.
// Split out of 05-render.js — plain functions, shared globals, loaded after it.

// ═══════════════════════════════════
// ADP EXPIRY — global (not per date)
// ═══════════════════════════════════
async function loadAdpExpiry(){
  if(!fbReady) return;
  try{
    const snap=await fbDb.ref('settings/adpExpiry').get();
    if(snap.exists()) _adpExpiry=snap.val()||{};
    else _adpExpiry={};
  }catch(e){ console.warn('adpExpiry load:',e); }
}
function saveAdpExpiry(){
  if(!fbReady) return;
  fbDb.ref('settings/adpExpiry').set(_adpExpiry).catch(e=>console.warn('adpExpiry save:',e));
}
async function loadWcAuth(){
  if(!fbReady) return;
  try{
    const snap=await fbDb.ref('settings/wcAuth').get();
    _wcAuth=snap.exists()?snap.val()||{}:{};
  }catch(e){ console.warn('wcAuth load:',e); }
}
function saveWcAuth(){
  if(!fbReady) return;
  fbDb.ref('settings/wcAuth').set(_wcAuth).catch(e=>console.warn('wcAuth save:',e));
}
async function loadAdpWarnDays(){
  if(!fbReady) return;
  try{
    const snap=await fbDb.ref('settings/adpWarnDays').get();
    if(snap.exists() && (snap.val()===30||snap.val()===45)) _adpWarnDays=snap.val();
  }catch(e){ console.warn('adpWarnDays load:',e); }
}
function saveAdpWarnDays(){
  if(!fbReady) return;
  fbDb.ref('settings/adpWarnDays').set(_adpWarnDays).catch(e=>console.warn('adpWarnDays save:',e));
}
function setAdpWarnDays(days){
  if(days!==30&&days!==45) return;
  _adpWarnDays=days;
  saveAdpWarnDays();
  renderAdpModal();
  if(typeof renderSummary==='function') renderSummary();
  renderCards();
}
function toggleWcAuth(staffId){
  if(!staffId) return;
  if(_wcAuth[staffId]) delete _wcAuth[staffId];
  else _wcAuth[staffId]=true;
  saveWcAuth();
  renderAdpModal();
  if(document.getElementById('roles-ov').classList.contains('show')) renderRolesModal();
  if(typeof renderSummary==='function') renderSummary();
}
// Returns true if staffId (or any staff matching name) is WC-authorized
function isWcAuthorizedByName(name){
  if(!name) return true; // empty slot — not a violation
  const clean=name.replace(/\s*\(BK\)|\s*\(TR\)/g,'').trim();
  return S.staff.some(x=>staffMatchInput(x,clean) && _wcAuth[x.id]);
}
// Badge shown in roles modal when WC primary is not authorized
function wcAuthBadge(name){
  if(!name) return '';
  if(isWcAuthorizedByName(name)) return '';
  return `<span style="background:#7C3AED;color:#fff;font-size:8px;font-weight:700;border-radius:3px;padding:0 5px;margin-left:4px" title="Not authorized as WC Primary">NOT AUTH</span>`;
}
// Returns warnings for summary banner
function wcAuthWarningsForRoles(){
  const r=S.roles; if(!r) return [];
  const warns=[];
  (r.wc||[]).forEach((wc,i)=>{
    if(wc.primary && !isWcAuthorizedByName(wc.primary))
      warns.push({name:wc.primary, role:'WC'+(i+1)+' PRIMARY'});
  });
  return warns;
}

// Returns { days: <number>, status: 'ok'|'soon'|'expired'|'none'|'na' }
// name = display name string (as stored in S.roles)
function adpStatusFor(name, preferDept){
  if(!name) return {days:null,status:'none'};
  const cleanName = name.replace(/\s*\(BK\)|\s*\(TR\)/g,'').trim();
  // Find all staff matching this display name
  const matches = S.staff.filter(x=>staffMatchInput(x,cleanName));
  if(!matches.length) return {days:null,status:'none'};
  // If dept hint given (e.g. from role pool context), prefer that dept's staff
  const ordered = preferDept
    ? [...matches.filter(x=>x.team===preferDept), ...matches.filter(x=>x.team!==preferDept)]
    : matches;
  // Compute status for each match; return worst-case (most urgent)
  const statOrder={expired:0,soon:1,ok:2,none:3,na:4};
  let worst = {days:null,status:'none'};
  for(const s of ordered){
    const sid = s.id;
    if(!_adpExpiry[sid]){ continue; }
    if(_adpExpiry[sid]==='N/A'){ if(worst.status==='none') worst={days:null,status:'na'}; continue; }
    const exp = new Date(_adpExpiry[sid]);
    const today = new Date(); today.setHours(0,0,0,0); exp.setHours(0,0,0,0);
    const days = Math.floor((exp-today)/(1000*86400));
    const st = days<0?'expired':days<=_adpWarnDays?'soon':'ok';
    if((statOrder[st]??3) < (statOrder[worst.status]??3)) worst={days,status:st};
  }
  return worst;
}
function adpBadge(name){
  const {days,status}=adpStatusFor(name);
  if(status==='none'||status==='na') return ''; // no badge for N/A or unknown
  if(status==='expired') return `<span style="background:#DC2626;color:#fff;font-size:8px;font-weight:700;border-radius:3px;padding:0 5px;margin-left:4px" title="ADP EXPIRED">ADP EXP</span>`;
  if(status==='soon') return `<span style="background:#F59E0B;color:#000;font-size:8px;font-weight:700;border-radius:3px;padding:0 5px;margin-left:4px" title="ADP expiring in ${days} days">ADP ${days}d</span>`;
  return `<span style="background:#10B981;color:#fff;font-size:8px;font-weight:600;border-radius:3px;padding:0 5px;margin-left:4px" title="ADP valid ${days} days left">ADP ✓</span>`;
}
function adpWarningsForRoles(){
  // Returns array of warning objects for MOJO and WC Primary slots only
  const r=S.roles; if(!r) return [];
  const warns=[];
  const check=(name,role)=>{
    const {days,status}=adpStatusFor(name);
    if(status==='expired') warns.push({name,role,days,status});
    else if(status==='soon') warns.push({name,role,days,status});
  };
  (r.mojo||[]).forEach((n,i)=>{ if(n) check(n, i===0?'MOJO':'MOJO '+(i+1)); });
  (r.wc||[]).forEach((wc,i)=>{ if(wc.primary) check(wc.primary,'WC'+(i+1)+' PRIMARY'); });
  return warns;
}

// ── ADP MODAL ──
function openAdpModal(){
  _adpDept='';
  if(document.getElementById('adp-filter')) document.getElementById('adp-filter').value='all';
  renderAdpModal();
  document.getElementById('adp-ov').classList.add('show');
}
function closeAdpModal(){ document.getElementById('adp-ov').classList.remove('show'); }

function renderAdpModal(){
  const el=document.getElementById('adp-body'); if(!el) return;
  // Highlight active warn-threshold button
  const btn30=document.getElementById('adp-warn-30');
  const btn45=document.getElementById('adp-warn-45');
  if(btn30&&btn45){
    btn30.style.background=_adpWarnDays===30?'#F59E0B':'';
    btn30.style.color=_adpWarnDays===30?'#000':'';
    btn30.style.borderColor=_adpWarnDays===30?'#F59E0B':'';
    btn45.style.background=_adpWarnDays===45?'#F59E0B':'';
    btn45.style.color=_adpWarnDays===45?'#000':'';
    btn45.style.borderColor=_adpWarnDays===45?'#F59E0B':'';
  }
  const search=(document.getElementById('adp-search')?.value||'').toLowerCase();
  const filter=document.getElementById('adp-filter')?.value||'all';
  const deptFilter=(_adpDept||'').toUpperCase();

  // All TECH staff across all depts (IRR, LO, WO, CIM) — permanent only
  const techs=S.staff.filter(s=>s.category==='TECH'&&!s.isBackup);

  const deptColor={'IRR':'#3B82F6','LO':'#10B981','WO':'#F59E0B','CIM':'#A855F7'};

  const rows=[];
  techs.forEach(s=>{
    const dn=S.nicknames[s.id]||s.shortName;
    const dept=s.team||'?';
    if(deptFilter && dept!==deptFilter) return;
    if(search && !dn.toLowerCase().includes(search) && !s.id.toLowerCase().includes(search) && !dept.toLowerCase().includes(search)) return;
    const expDate=_adpExpiry[s.id]||'';
    const {days,status}=adpStatusFor(dn);
    if(filter==='warn' && status!=='expired' && status!=='soon') return;
    if(filter==='warn' && status==='na') return;
    rows.push({id:s.id,name:dn,dept,expDate,days,status});
  });

  // Sort: expired first, soon, ok, none, na (N/A at the very bottom)
  const sortOrder={expired:0,soon:1,ok:2,none:3,na:4};
  rows.sort((a,b)=>(sortOrder[a.status]??3)-(sortOrder[b.status]??3)||a.dept.localeCompare(b.dept)||a.name.localeCompare(b.name));

  if(!rows.length){
    el.innerHTML='<div style="font-size:11px;color:var(--txt3);text-align:center;padding:20px">'+
      (S.staff.length?'No techs match filter.':'Load a roster first to see tech list.')+'</div>';
    return;
  }

  const statusStyle=st=>({
    'expired':'background:#FEE2E2;border-color:#DC2626',
    'soon':'background:#FEF3C7;border-color:#F59E0B',
    'ok':'background:var(--bg);border-color:var(--b)',
    'none':'background:var(--bg);border-color:var(--b)',
    'na':'background:var(--bg);border-color:var(--b);opacity:0.5'
  }[st]||'');
  const badge=st=>st==='expired'?'<span style="background:#DC2626;color:#fff;font-size:8px;font-weight:700;border-radius:3px;padding:1px 5px">EXPIRED</span>':
    st==='soon'?`<span style="background:#F59E0B;color:#000;font-size:8px;font-weight:700;border-radius:3px;padding:1px 5px">EXP SOON</span>`:
    st==='ok'?'<span style="background:#10B981;color:#fff;font-size:8px;font-weight:600;border-radius:3px;padding:1px 5px">VALID</span>':
    st==='na'?'<span style="background:var(--bg2,#6B7280);color:var(--txt2);border:1px solid var(--b);font-size:8px;font-weight:600;border-radius:3px;padding:1px 5px">N/A</span>':
    '<span style="font-size:8px;color:var(--txt3)">NO DATE</span>';

  // Count summary
  const exp=rows.filter(r=>r.status==='expired').length;
  const sn=rows.filter(r=>r.status==='soon').length;
  const na=rows.filter(r=>r.status==='na').length;
  const sumHtml=`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
    <span style="font-size:9px;color:var(--txt3);letter-spacing:1px">${rows.length} TECH${rows.length!==1?'S':''}</span>
    ${exp?`<span style="background:#DC2626;color:#fff;font-size:8px;font-weight:700;border-radius:3px;padding:1px 6px">${exp} EXPIRED</span>`:''}
    ${sn?`<span style="background:#F59E0B;color:#000;font-size:8px;font-weight:700;border-radius:3px;padding:1px 6px">${sn} EXP SOON</span>`:''}
    ${na?`<span style="font-size:8px;color:var(--txt3)">${na} N/A</span>`:''}
  </div>`;

  el.innerHTML=sumHtml+rows.map(r=>{
    const isNA=r.status==='na';
    return `
    <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:6px 8px;border-radius:4px;margin-bottom:4px;border:1px solid var(--b);${statusStyle(r.status)}">
      <div>
        <div style="display:flex;align-items:center;gap:5px">
          <span style="background:${deptColor[r.dept]||'var(--txt3)'};color:#fff;font-size:7px;font-weight:800;border-radius:2px;padding:1px 4px;letter-spacing:0.5px">${r.dept}</span>
          <span style="font-size:11px;font-weight:700;color:var(--txt)">${r.name}</span>
        </div>
        <div style="font-size:9px;color:var(--txt3);margin-top:1px">${r.id}</div>
      </div>
      <div style="text-align:right">
        ${badge(r.status)}
        ${r.days!=null?`<div style="font-size:9px;color:var(--txt3);margin-top:2px">${r.days<0?Math.abs(r.days)+'d ago':r.days+'d left'}</div>`:''}
      </div>
      <div style="min-width:130px;display:flex;flex-direction:column;gap:4px">
        ${isNA
          ? `<div style="font-size:9px;color:var(--txt3);text-align:center;padding:4px 0">ADP not required</div>`
          : `<input type="date" value="${r.expDate}" data-staffid="${r.id}"
              onchange="setAdpExpiry(this.dataset.staffid,this.value)"
              style="font-size:11px;padding:4px 6px;background:var(--bg);border:1px solid var(--b);border-radius:4px;color:var(--txt);width:100%;box-sizing:border-box">`
        }
        <button class="btn btn-ghost btn-sm" style="font-size:8px;padding:2px 6px;${isNA?'color:var(--amber)':''}"
          onclick="toggleAdpNA('${r.id}',${isNA})">${isNA?'↩ UNDO N/A':'✕ MARK N/A'}</button>
        <button class="btn btn-ghost btn-sm" style="font-size:8px;padding:2px 6px;${_wcAuth[r.id]?'color:#10B981;border-color:#10B981':''}"
          onclick="toggleWcAuth('${r.id}')" title="${_wcAuth[r.id]?'Remove WC Primary authorization':'Mark as authorized WC Primary'}">${_wcAuth[r.id]?'✓ WC AUTH':'+ WC AUTH'}</button>
      </div>
    </div>`;
  }).join('');
}

function toggleAdpNA(staffId, currentlyNA){
  if(!staffId) return;
  if(currentlyNA){ delete _adpExpiry[staffId]; } // remove N/A → back to "no date"
  else { _adpExpiry[staffId]='N/A'; }             // mark as N/A
  saveAdpExpiry();
  renderAdpModal();
  if(document.getElementById('roles-ov').classList.contains('show')) renderRolesModal();
  if(typeof renderSummary==='function') renderSummary();
}
function setAdpExpiry(staffId, dateVal){
  if(!staffId) return;
  if(dateVal){ _adpExpiry[staffId]=dateVal; }
  else { delete _adpExpiry[staffId]; }
  saveAdpExpiry();
  renderAdpModal();
  // Re-render roles modal if open (to refresh ADP badges)
  if(document.getElementById('roles-ov').classList.contains('show')) renderRolesModal();
  // Refresh summary ADP banner
  if(typeof renderSummary==='function') renderSummary();
}
