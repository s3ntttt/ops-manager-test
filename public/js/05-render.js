// ═══════════════════════════════════
// RENDER
// ═══════════════════════════════════
const CAT_ORD = ['GL','LAT','LAE B1','LAE B2','TECH','SM','OTHER'];

function renderAll(){
  renderDept('cl','LO','lo');
  renderDept('ci','IRR','irreg');
  renderDept('cw','WO','wo');
  renderDept('cc','CIM','cim');
  renderSummary();
  updateCounts();
  scheduleSave();
}

// Returns the dept a person is actually working in (after swaps/transfers)
function effectiveDept(s){
  if(!s) return null;
  // ENG SPECIALIST TEAM always belong to IRR — override any section mis-parse
  if(S.engSpecialists.includes(s.id)) return 'IRR';
  // Check transfers first
  const tr = S.transfers.find(t=>t.id===s.id);
  if(tr) return tr.toDept;
  // Check swaps — swap means they go to the OTHER person's original team
  for(const sw of S.swaps){
    if(sw.id1===s.id){ const other=S.staff.find(x=>x.id===sw.id2); return other?other.team:s.team; }
    if(sw.id2===s.id){ const other=S.staff.find(x=>x.id===sw.id1); return other?other.team:s.team; }
  }
  return s.team;
}

// Returns tag info if person was moved into this dept from elsewhere
function movedFrom(s){
  const tr = S.transfers.find(t=>t.id===s.id);
  if(tr) return { type:'transfer', from:s.team };
  for(const sw of S.swaps){
    if(sw.id1===s.id||sw.id2===s.id) return { type:'swap', from:s.team };
  }
  return null;
}

function renderDept(elId, teamKey, dk){
  const el = document.getElementById(elId);
  if(!el) return;

  if(!S.staff.length){
    el.innerHTML='<div style="padding:30px;color:var(--txt2);font-size:12px">No staff loaded. Click ⟳ LOAD ROSTER.</div>';
    return;
  }

  // Staff showing in this dept = own staff (not moved out) + staff moved IN from other depts
  const allTeams = [...new Set(S.staff.map(s=>s.team))];
  const ownOriginal = S.staff.filter(s=>s.team===teamKey||(teamKey==='IRR'&&S.engSpecialists.includes(s.id)));

  if(!ownOriginal.length){
    el.innerHTML=`<div style="padding:20px;font-size:12px">
      <div style="color:var(--orange);margin-bottom:10px">⚠ No staff found with team = "${teamKey}"</div>
      <div style="color:var(--txt2);margin-bottom:6px">Total staff in S.staff: <b style="color:var(--amber)">${S.staff.length}</b></div>
      <div style="color:var(--txt2);margin-bottom:6px">Team values found: <b style="color:var(--amber)">${allTeams.join(', ')||'(none)'}</b></div>
      ${S.staff.slice(0,3).map(s=>`<div style="color:var(--txt3);font-size:10px;margin-left:10px">team="${s.team}" name="${s.shortName}"</div>`).join('')}
    </div>`;
    return;
  }

  // All staff whose effectiveDept is this teamKey
  const ds = S.staff.filter(s => effectiveDept(s) === teamKey);

  const grouped={};
  CAT_ORD.forEach(c=>grouped[c]=[]);
  const visible  = ds.filter(s => !isTransferred(s));
  const xferred  = ownOriginal.filter(s => isTransferred(s)); // physically absent (tool crib etc.)
  // Staff moved OUT of this dept via swap/transfer (hide from here)
  const movedOut = ownOriginal.filter(s => effectiveDept(s) !== teamKey && !isTransferred(s));

  visible.forEach(s=>{ const k=CAT_ORD.includes(s.category)?s.category:'OTHER'; grouped[k].push(s); });

  const avail = visible.filter(s=>isActive(effAvail(s))).length;
  const pct   = visible.length?Math.round(avail/visible.length*100):0;

  let h='';

  // ASSIGN ROLES button — only in IRREG
  if(teamKey==='IRR'){
    h+=`<div style="margin-bottom:14px" class="np">
      <button class="btn btn-amber" style="width:100%;font-size:13px;padding:10px;letter-spacing:2px" onclick="openRolesModal()">
        ✎ ASSIGN ROLES FOR THIS SHIFT
      </button>
    </div>`;
  }

  // Moved-out notice
  if(movedOut.length){
    h+=`<div style="background:var(--bbg);border:1px solid var(--blue);border-radius:var(--r);padding:8px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="background:var(--bbg);color:var(--blue);border:1px solid var(--blue);border-radius:3px;padding:1px 7px;font-size:9px;font-weight:700;letter-spacing:1px">${movedOut.length} MOVED OUT</span>
      <span style="font-size:10px;color:var(--txt2)">${movedOut.map(s=>{const ed=effectiveDept(s);return`${displayName(s)} → ${ed}`;}).join(' · ')}</span>
      <button class="btn btn-ghost btn-sm np" style="margin-left:auto;font-size:9px" onclick="openSwapModal()">⇄ MANAGE</button>
    </div>`;
  }

  // Transferred-out notice (tool crib etc.)
  if(xferred.length){
    const destStr = xferred.map(s=>{
      const a=effAvail(s);
      return `<span onclick="cycleOvr('${s.id}')" title="Click to restore ${s.shortName}" style="cursor:pointer;text-decoration:underline dotted;color:#86EFAC">${s.shortName}</span> <span style="color:var(--txt3)">(${a.lbl})</span>`;
    }).join(' &nbsp;·&nbsp; ');
    h+=`<div style="background:var(--gbg);border:1px solid var(--green);border-radius:var(--r);padding:8px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="background:var(--gbg);color:var(--green);border:1px solid var(--green);border-radius:3px;padding:1px 7px;font-size:9px;font-weight:700;letter-spacing:1px">${xferred.length} HIDDEN</span>
        <span style="font-size:10px;color:var(--txt2)">Transferred out · not counted</span>
        <span style="font-size:9px;color:var(--txt3)">(click name to restore)</span>
      </div>
      <span style="font-size:9px;font-style:italic">${destStr}</span>
    </div>`;
  }

  if(pct<60&&visible.length) h+=`<div class="alert np">⚠ Only ${avail}/${visible.length} (${pct}%) available tonight</div>`;

  for(const cat of CAT_ORD){
    const m=grouped[cat]; if(!m.length) continue;
    const ca=m.filter(s=>isActive(effAvail(s))).length;
    h+=`<div class="cat-sec">
      <div class="cat-hdr">
        <span class="cat-lbl">${cat}</span>
        <div class="cat-div"></div>
        <span class="cat-cnt">${ca}/${m.length}</span>
      </div>
      <div class="grid">${m.map(s=>cardHTML(s,teamKey)).join('')}</div>
    </div>`;
  }

  // Backup section
  const bk=S.backups[dk]||[];
  h+=`<div class="bk-sec">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div class="bk-title" style="margin-bottom:0">BACKUP MANPOWER</div>
      <button class="btn btn-teal btn-sm np" onclick="openSwapModal('${teamKey}')">⇄ SWAP / TRANSFER</button>
    </div>
    ${bk.length?`<div class="grid" style="margin-bottom:12px">${bk.map((b,i)=>bkCardHTML(b,dk,i)).join('')}</div>`:''}
    <div class="bk-form np">
      <input type="text" id="bn-${dk}" placeholder="Name" style="width:110px" onkeydown="if(event.key==='Enter')addBk('${dk}')">
      <select id="bp-${dk}">
        <option>GL</option><option>LAT</option><option>LAE B1</option>
        <option>LAE B2</option><option>TECH</option><option>TECH B1</option><option>TECH B2</option>
      </select>
      <input type="text" id="bt-${dk}" placeholder="A/C Type" style="width:90px" onkeydown="if(event.key==='Enter')addBk('${dk}')">
      <input type="text" id="btime-${dk}" placeholder="0800 or 1900-0100" style="width:100px" onkeydown="if(event.key==='Enter')addBk('${dk}')" title="Optional. Single time (e.g. 0800) = reports late, stays till shift end.\nRange (e.g. 1900-0100) = only present for that exact window.">
      <button class="btn btn-amber btn-sm" onclick="addBk('${dk}')">+ ADD</button>
    </div>
  </div>`;

  // TOWERS — only shown in IRREG tab, not counted in headcount
  if(teamKey==='IRR'){
    h += renderTowersSection();
    h += renderTraineesSection();
  }

  // MOC — only shown in LO tab
  if(teamKey==='LO') h += renderMocSection();

  el.innerHTML=h;
}

function saveNicknames(){
  localStorage.setItem('ops_nicknames', JSON.stringify(S.nicknames));
  // Also save to Firebase permanently (not date-specific)
  if(fbReady){
    fbDb.ref('settings/nicknames').set(S.nicknames)
      .catch(e=>console.warn('Nickname save error:',e));
  }
}


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

async function loadNicknames(){
  if(!fbReady) return;
  try {
    const snap=await fbDb.ref('settings/nicknames').get();
    if(snap.exists()){
      const cloud=snap.val()||{};
      S.nicknames=Object.assign({}, S.nicknames, cloud);
      localStorage.setItem('ops_nicknames', JSON.stringify(S.nicknames));
      if(S.loaded) renderAll(); // only re-render if roster is already loaded
    }
  } catch(e){ console.warn('Nickname load error:',e); }
}
function displayName(s){ return S.nicknames[s.id] || s.shortName; }
// Match staff by typed name: nickname > full shortName > last word of compound shortName
function staffMatchInput(s, inp){
  const nick=S.nicknames[s.id];
  if(nick) return nick===inp;
  if(s.shortName===inp) return true;
  const parts=s.shortName.split(' ');
  return parts.length>1 && parts[parts.length-1]===inp;
}

function editNickname(id, currentName, event){
  event.stopPropagation();
  const baseId=id.replace('_BK','');
  const isExcluded=(S.exclusions||[]).includes(baseId);
  const input=prompt(
    `Nickname for ${currentName} (leave blank to reset):\n\nType "EXCLUDE" to permanently hide this staff from all lists.\n${isExcluded?'Currently EXCLUDED — type "RESTORE" to show again.':''}`,
    S.nicknames[id]||''
  );
  if(input===null) return;
  if(input.trim().toUpperCase()==='EXCLUDE'){
    if(!S.exclusions) S.exclusions=[];
    if(!S.exclusions.includes(baseId)) S.exclusions.push(baseId);
    saveExclusions();
    renderAll();
    if(S.loaded) loadRoster(); // reload to apply exclusion
    return;
  }
  if(input.trim().toUpperCase()==='RESTORE'){
    S.exclusions=(S.exclusions||[]).filter(e=>e!==baseId);
    saveExclusions();
    renderAll();
    if(S.loaded) loadRoster();
    return;
  }
  if(input.trim()===''){
    delete S.nicknames[id];
  } else {
    S.nicknames[id]=input.trim().toUpperCase();
  }
  saveNicknames();
  renderAll();
}

function cardHTML(s, viewingDept){
  const a   = effAvail(s);
  const ov  = !!S.overrides[s.id];
  const mv  = movedFrom(s);
  const nm  = displayName(s);
  const hasCustomNick = !!S.nicknames[s.id];
  const raw = s.schedVal&&s.schedVal!==a.lbl?`<span style="font-size:8px;color:var(--txt3);margin-left:4px">${s.schedVal.substring(0,10)}</span>`:'';
  const fromTag = (mv && viewingDept && effectiveDept(s)===viewingDept && s.team!==viewingDept)
    ? `<span style="display:inline-block;margin-left:4px;padding:1px 5px;background:var(--bbg);color:var(--blue);border:1px solid var(--blue);border-radius:2px;font-size:8px;font-weight:700;letter-spacing:.5px">FROM ${s.team}</span>`
    : '';
  const isEng = S.engSpecialists.includes(s.id);
  const engTag = isEng
    ? `<span style="display:inline-block;padding:1px 6px;background:var(--ybg);color:var(--yellow);border:1px solid var(--yellow);border-radius:2px;font-size:8px;font-weight:700;letter-spacing:.5px">⚙ ENG</span>`
    : '';
  // ADP tag — only for TECH staff; uses staffId directly to avoid name-lookup ambiguity
  const adpTag = (()=>{
    if(s.category!=='TECH'||s.isBackup) return '';
    const exp=_adpExpiry[s.id];
    if(!exp||exp==='N/A') return '';
    const expD=new Date(exp), tod=new Date(); tod.setHours(0,0,0,0); expD.setHours(0,0,0,0);
    const days=Math.floor((expD-tod)/86400000);
    if(days<0) return `<span style="display:inline-block;padding:1px 4px;background:#DC2626;color:#fff;border-radius:2px;font-size:7px;font-weight:700;letter-spacing:.3px" title="ADP expired ${Math.abs(days)}d ago">ADP EXP</span>`;
    if(days<=_adpWarnDays) return `<span style="display:inline-block;padding:1px 4px;background:#F59E0B;color:#000;border-radius:2px;font-size:7px;font-weight:700;letter-spacing:.3px" title="ADP expiring in ${days} days">ADP ${days}d</span>`;
    return '';
  })();
  // WC auth tag — show green WC badge on authorized techs so you can spot eligible WC Primary at a glance
  const wcTag = (s.category==='TECH'&&!s.isBackup&&_wcAuth[s.id])
    ? `<span style="display:inline-block;padding:1px 4px;background:#059669;color:#fff;border-radius:2px;font-size:7px;font-weight:700;letter-spacing:.3px" title="Authorized WC Primary">WC✓</span>`
    : '';
  return `<div class="card ${a.cls}${mv?' card-moved':''}${isEng?' card-eng':''}" onclick="cycleOvr('${s.id}')" title="${s.fullName}\n${s.desig}\n${s.acType}\nScheduled: ${s.schedVal||'—'}\nClick to cycle status">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:2px">
      <div class="cname">${nm}${hasCustomNick?`<span style="font-size:7px;color:var(--txt3);margin-left:3px" title="Custom nickname">✎</span>`:''}${ov?` <span class="ovr-star">✱</span>`:''}</div>
      <div style="display:flex;gap:3px;flex-shrink:0">
        <button onclick="setStatus('${s.id}','MCEL',event)" class="np" title="Mark MC/EL" style="background:${ov==='MC/EL'?'#DC2626':'transparent'};border:1px solid ${ov==='MC/EL'?'#DC2626':'var(--b2)'};color:${ov==='MC/EL'?'#fff':'var(--txt3)'};border-radius:3px;font-size:7px;font-weight:700;cursor:pointer;padding:1px 4px;line-height:1">MC/EL</button>
        <button onclick="setStatus('${s.id}','AL',event)" class="np" title="Mark AL/OFF" style="background:${ov==='AL/OFF'?'#D97706':'transparent'};border:1px solid ${ov==='AL/OFF'?'#D97706':'var(--b2)'};color:${ov==='AL/OFF'?'#fff':'var(--txt3)'};border-radius:3px;font-size:7px;font-weight:700;cursor:pointer;padding:1px 4px;line-height:1">AL</button>
        <button onclick="editNickname('${s.id}','${(s.fullName||'').replace(/'/g,"\\'")}',event)" class="np" title="Edit nickname" style="background:transparent;border:none;color:var(--txt3);font-size:10px;cursor:pointer;padding:0;line-height:1">✎</button>
      </div>
    </div>
    <div class="cmeta">${s.desigCode||s.desig} · ${s.acType||s.fleet||'—'}</div>
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:3px;margin-top:5px">
      <span class="badge ${a.badge}">${a.lbl}</span>${raw}${fromTag}${engTag}${wcTag}${adpTag}
    </div>
  </div>`;
}

function bkCardHTML(b, dk, i){
  const mcEl = b.mcEl===true;
  const timeVal = b.time||'';
  const frac = bkFraction(b);
  const shType2 = (document.getElementById('shift-sel')?.value||'DAY').toUpperCase();
  const shiftEnd = shType2==='NIGHT'?'0600':'1800';
  const isRange = isBkRange(timeVal);
  const rangeTag = (timeVal && frac < 1)
    ? `<span style="font-size:8px;color:var(--amber);font-weight:600;margin-left:4px;opacity:.9">${isRange?timeVal:timeVal+'–'+shiftEnd}</span>`
    : '';
  return `<div class="card bkcard" style="position:relative;${mcEl?'opacity:.45;filter:grayscale(.5)':''}">
    <div class="cname">${b.name} <span class="bktag">BK</span></div>
    <div class="cmeta">${b.pos}${b.type?' · '+b.type:''}</div>
    <div style="display:flex;align-items:center;gap:4px;margin-top:4px;flex-wrap:wrap">
      <span style="font-size:9px;color:var(--txt3);white-space:nowrap">RPT:</span>
      <input type="text" value="${timeVal}" placeholder="—"
        style="font-size:9px;font-family:var(--mono);width:76px;background:transparent;border:none;border-bottom:1px solid var(--b);color:${timeVal?'var(--amber)':'var(--txt3)'};outline:none;padding:0 2px;text-align:center"
        title="Single time (e.g. 0800) = reports late, stays till shift end.\nRange (e.g. 1900-0100) = only present for that exact window."
        oninput="S.backups['${dk}'][${i}].time=this.value.trim().toUpperCase()||null;this.style.color=this.value?'var(--amber)':'var(--txt3)';scheduleSave();renderAll()"
        onclick="event.stopPropagation()">${rangeTag}
    </div>
    <div style="display:flex;align-items:center;gap:5px;margin-top:5px;flex-wrap:wrap">
      ${mcEl
        ? `<span class="badge bab">MC/EL</span>`
        : `<span class="badge bbk">BACKUP</span>`}
      <button class="btn btn-sm np" onclick="event.stopPropagation();toggleBkMcEl('${dk}',${i})"
        style="font-size:8px;padding:1px 6px;${mcEl
          ? 'background:var(--gbg);color:var(--green);border:1px solid var(--green)'
          : 'background:var(--rbg);color:var(--red);border:1px solid var(--red)'}"
        title="${mcEl?'Mark as available':'Mark as MC/EL'}">
        ${mcEl?'✓ RESTORE':'MC/EL'}
      </button>
    </div>
    <button class="btn btn-red btn-sm np" style="position:absolute;top:6px;right:6px;padding:1px 5px;font-size:9px" onclick="event.stopPropagation();removeBk('${dk}',${i})">✕</button>
  </div>`;
}

function cycleOvr(id){
  const cur=S.overrides[id];
  const idx=OVR_CYCLE.indexOf(cur);
  if(idx===-1||idx===OVR_CYCLE.length-1){ delete S.overrides[id]; logActivity(id,'RESTORED'); }
  else{ S.overrides[id]=OVR_CYCLE[idx+1]; logActivity(id,S.overrides[id]); }
  renderAll(); scheduleSave();
}

function setStatus(id, type, event){
  event.stopPropagation();
  const map={'MCEL':'MC/EL','AL':'AL/OFF'};
  const key=map[type];
  if(S.overrides[id]===key){ delete S.overrides[id]; logActivity(id,'RESTORED'); }
  else { S.overrides[id]=key; logActivity(id,key); }
  renderAll(); scheduleSave();
}

// Only include staff whose designation is actually MOC (exclude PPCC, PPC etc.)
function isMocStaff(s){
  if(s.team!=='MOC') return false;
  const d=(s.desigCode||s.desig||'').toUpperCase();
  const name=(s.fullName||'').toUpperCase();
  // Exclude known non-MOC roles in the MOC section
  if(d.includes('PPCC')||d.includes('PPC')||d.includes('PPCO')) return false;
  // Include if desig contains MOC or is a known MOC role
  return d.includes('MOC')||d.includes('MANAGER ON CALL')||d.includes('CERTIFYING STAFF')||d.includes('DUTY ENGINEER');
}

function getAssignedNames(){
  const r=S.roles;
  if(!r) return new Set();
  const ns=new Set();
  if(r.mocChaser) ns.add(r.mocChaser);
  (r.mojo||[]).forEach(n=>n&&ns.add(n));
  (r.wc||[]).forEach(w=>{w.primary&&ns.add(w.primary);w.asst&&ns.add(w.asst);});
  (r.runners||[]).forEach(rn=>rn.name&&ns.add(rn.name));
  (r.towerSlots||[]).forEach(ts=>{ts.a&&ns.add(ts.a);ts.b&&ns.add(ts.b);ts.backup&&ns.add(ts.backup);});
  // Acting GLs should not appear in staff lists
  if(S.actingGL){ Object.values(S.actingGL).forEach(n=>n&&ns.add(n)); }
  return ns;
}

function toggleSS(id){
  const idx=S.ssTechs.indexOf(id);
  const _ssS=S.staff.find(x=>x.id===id);
  const _ssN=_ssS?displayName(_ssS):id;
  if(idx>=0){ S.ssTechs.splice(idx,1); logEvent('SS TECH',_ssN+' removed'); }
  else if(S.ssTechs.length<3){ S.ssTechs.push(id); logEvent('SS TECH',_ssN+' assigned'); }
  renderSummary();
  scheduleSave();
}

function renderSummary(){
  const el=document.getElementById('cs');
  if(!el) return;
  try {
    _renderSummaryInner(el);
  } catch(err){
    el.innerHTML=`<div style="padding:20px;max-width:600px">
      <div style="background:var(--rbg);border:1px solid var(--red);border-radius:8px;padding:16px 20px">
        <div style="color:var(--red);font-weight:700;font-size:13px;margin-bottom:6px">⚠ Summary render error</div>
        <div style="color:var(--orange);font-size:11px;margin-bottom:8px">${err.message}</div>
        <button class="btn btn-amber btn-sm" onclick="renderSummary()">⟳ RETRY</button>
      </div></div>`;
    console.error('renderSummary crash:', err);
  }
}

function _renderSummaryInner(el){
  const dateStr=fmtDate(document.getElementById('dp').value);
  const shift=document.getElementById('shift-sel').value;
  const isDay=shift==='DAY';
  if(!S.roles||!Array.isArray(S.roles.mojo)){
    S.roles = {
      mocChaser:'', mojo:['','',''],
      wc:[{primary:'',asst:''},{primary:'',asst:''}],
      runners:isDay
        ?[{name:'',timing:'0700-1300'},{name:'',timing:'0700-1300'},{name:'',timing:'1300-1900'},{name:'',timing:'1300-1900'}]
        :[{name:'',timing:'1900-0100'},{name:'',timing:'1900-0100'},{name:'',timing:'0100-0700'},{name:'',timing:'0100-0700'}],
      towerSlots:[{a:'',b:'',backup:''},{a:'',b:'',backup:''},{a:'',b:'',backup:''},{a:'',b:'',backup:''}]
    };
  }
  const r = S.roles;

  // ── helpers ──
  const getDept = (team,dk) => {
    const own = S.staff.filter(s=>effectiveDept(s)===team&&!isTransferred(s));
    const bk  = S.backups[dk]||[];
    let mc=0,lv=0,cr=0,fl=0;
    own.forEach(s=>{ const a=effAvail(s);
      if(a.st==='ABSENT')mc++; else if(a.st==='LEAVE'||a.st==='OFF')lv++;
      else if(a.st==='COURSE'||a.st==='TASK'||a.st==='OTHER_SHIFT')cr++; else if(a.st==='FLYING')fl++;
    });
    return {own,bk,mc,lv,cr,fl};
  };
  const lo=getDept('LO','lo'), irr=getDept('IRR','irreg'), wo=getDept('WO','wo'), cim=getDept('CIM','cim');
  const TEAM_KEY = { lo:'LO', irreg:'IRR', wo:'WO', cim:'CIM' };

  const glNames = team => {
    const dk = {LO:'lo',IRR:'irreg',WO:'wo',CIM:'cim'}[team]||'lo';
    const key = {LO:'lo',IRR:'irreg',WO:'wo',CIM:'cim'}[team]||'lo';
    // Check acting GL override first
    if(S.actingGL[key]) return S.actingGL[key];
    const rosterGL = S.staff.filter(s=>effectiveDept(s)===team&&s.category==='GL');
    const bkGL     = (S.backups[dk]||[]).filter(b=>normCat(b.pos)==='GL');
    const all = [
      ...rosterGL.map(s=>displayName(s)+(isActive(effAvail(s))?'':' ⚠')),
      ...bkGL.map(b=>b.name+' (BK)')
    ];
    return all.length ? all.join(' / ') : 'TBA';
  };

  const glBtn = team => {
    const key={LO:'lo',IRR:'irreg',WO:'wo',CIM:'cim'}[team]||'lo';
    return `<button class="btn btn-ghost btn-sm np" style="font-size:8px;padding:1px 5px;margin-left:4px" onclick="openActingGLModal('${team}','${key}')">✎</button>`;
  };
  const mocStaff   = S.staff.filter(s=>isMocStaff(s)&&isActive(effAvail(s)));
  const mocNames   = mocStaff.length?mocStaff.map(s=>displayName(s)).join(' / '):'—';

  // Staff lists — own + cross-shift backups + manual backups
  const xsBk = S.staff.filter(s=>s.isBackup&&isActive(effAvail(s)));

  const bycat = (teamKey, cat, manualBk=[]) => {
    const isOnShift = s => { const a=effAvail(s); if(a.st==='WORKING'||a.st==='BACKUP_SHIFT') return true; if(S.overrides[s.id]) return false; const raw=(s.schedVal||'').toUpperCase().trim(); return raw.startsWith(shift.toUpperCase()); };
    const own = S.staff.filter(s=>!s.isBackup&&effectiveDept(s)===teamKey&&s.category===cat&&isOnShift(s));
    const xs  = xsBk.filter(s=>effectiveDept(s)===teamKey&&s.category===cat);
    // A bounded window in the schedule cell (e.g. "(0000-0700)") counts as partial
    // headcount too, same as a manual backup's RPT range — not a full 1.
    own.forEach(s=>{ s._fraction=schedValFraction(s.schedVal); });
    xs.forEach(s=>{ s._fraction=schedValFraction(s.schedVal); });
    const mb  = manualBk.filter(b=>normCat(b.pos)===cat&&!b.mcEl);
    return [...own, ...xs, ...mb.map(b=>({id:'mb_'+b.name, shortName:b.name, fullName:b.name, desigCode:b.pos, acType:b.type||'', fleet:'', isManualBk:true, _bkTime:b.time||null, _fraction:bkFraction(b)}))];
  };

  const loTech=bycat('LO','TECH', lo.bk), loLat=bycat('LO','LAT', lo.bk);
  const irTech=bycat('IRR','TECH', irr.bk), irB1=bycat('IRR','LAE B1', irr.bk), irB2=bycat('IRR','LAE B2', irr.bk);
  const woTech=bycat('WO','TECH', wo.bk), woB1=bycat('WO','LAE B1', wo.bk), woB2=bycat('WO','LAE B2', wo.bk);
  const cimTech=bycat('CIM','TECH', cim.bk), cimLat=bycat('CIM','LAT', cim.bk), cimB1=bycat('CIM','LAE B1', cim.bk), cimB2=bycat('CIM','LAE B2', cim.bk);

  const avTbl = (rows) => `
    <table style="width:100%;border-collapse:collapse;font-size:10px">
      <tr style="background:var(--surf2)">
        <th style="padding:2px 5px;font-size:8px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)"> </th>
        <th style="padding:2px 5px;font-size:8px;color:var(--txt3);font-weight:400;text-align:center;border:1px solid var(--b)">MC/EL</th>
        <th style="padding:2px 5px;font-size:8px;color:var(--txt3);font-weight:400;text-align:center;border:1px solid var(--b)">AL/OFF</th>
        <th style="padding:2px 5px;font-size:8px;color:var(--txt3);font-weight:400;text-align:center;border:1px solid var(--b)">CRS/PRO</th>
        <th style="padding:2px 5px;font-size:8px;color:var(--txt3);font-weight:400;text-align:center;border:1px solid var(--b)">FLYING</th>
      </tr>
      ${rows.map(([lbl,dept,cat])=>{
        const staff=dept.own.filter(s=>s.category===cat);
        let mc=0,lv=0,cr=0,fl=0;
        staff.forEach(s=>{const a=effAvail(s);
          if(a.st==='ABSENT')mc++; else if(a.st==='LEAVE'||a.st==='OFF')lv++;
          else if(a.st==='COURSE'||a.st==='TASK'||a.st==='OTHER_SHIFT')cr++;
          else if(a.st==='FLYING')fl+=1;
          else if(/\(F\d\)/.test((s.schedVal||'').toUpperCase()))fl+=0.5;
        });
        // Add MC/EL manual backups for this category
        mc += (dept.bk||[]).filter(b=>normCat(b.pos)===cat&&b.mcEl===true).length;
        return `<tr>
          <td style="padding:2px 5px;color:var(--txt2);border:1px solid var(--b)">${lbl}</td>
          <td style="padding:2px 5px;text-align:center;color:${mc?'var(--red)':'var(--txt3)'};border:1px solid var(--b)">${mc}</td>
          <td style="padding:2px 5px;text-align:center;color:${lv?'var(--orange)':'var(--txt3)'};border:1px solid var(--b)">${lv}</td>
          <td style="padding:2px 5px;text-align:center;color:${cr?'var(--yellow)':'var(--txt3)'};border:1px solid var(--b)">${cr}</td>
          <td style="padding:2px 5px;text-align:center;color:${fl?'var(--blue)':'var(--txt3)'};border:1px solid var(--b)">${fl}</td>
        </tr>`;
      }).join('')}
    </table>`;

  const assigned = getAssignedNames();
  // Acting GL names — exclude from certifier headcounts
  const actingGLSet=new Set(Object.values(S.actingGL||{}).filter(n=>n).map(n=>n.toUpperCase()));
  const excActingGL=arr=>arr.filter(s=>!actingGLSet.has((displayName(s)||'').toUpperCase()));
  const ssSet    = new Set(S.ssTechs);
  const traineeNames = new Set([...(S.trainees?.permanent||[]),...(S.trainees?.backups||[])].map(t=>(t.name||'').toUpperCase()));

  // Build role lookup: name → role label
  const roleMap={};
  const r2=S.roles;
  if(r2){
    if(r2.mocChaser) roleMap[r2.mocChaser]='CHASER';
    (r2.mojo||[]).forEach((n,i)=>{ if(n) roleMap[n]=i===0?'MOJO':'MOJO'; });
    (r2.wc||[]).forEach((wc,i)=>{ if(wc.primary) roleMap[wc.primary]=`WC${i+1}`; if(wc.asst) roleMap[wc.asst]=`WC${i+1}`; });
    (r2.runners||[]).forEach((rn,i)=>{ if(rn.name) roleMap[rn.name]=`RNR${i+1}`; });
    (r2.towerSlots||[]).forEach((ts,i)=>{ if(ts.a) roleMap[ts.a]=`TWR${i+1}`; if(ts.b) roleMap[ts.b]=`TWR${i+1}`; });
    if(r2.actingGL){ Object.entries(r2.actingGL||{}).forEach(([k,n])=>{ if(n) roleMap[n]='GL'; }); }
    if(S.actingGL){ Object.entries(S.actingGL||{}).forEach(([k,n])=>{ if(n) roleMap[n]='GL'; }); }
  }
  const roleBadge=name=>{
    const label=roleMap[name];
    if(!label) return '';
    const colors={'CHASER':'var(--amber)','MOJO':'var(--blue)','WC1':'var(--blue)','WC2':'var(--blue)','RNR1':'var(--txt3)','RNR2':'var(--txt3)','RNR3':'var(--txt3)','RNR4':'var(--txt3)','TWR1':'var(--amber)','TWR2':'var(--amber)','TWR3':'var(--amber)','TWR4':'var(--amber)','GL':'var(--amber)'};
    const c=colors[label]||'#555';
    return `<span style="font-size:7px;font-weight:800;color:#fff;background:${c};border-radius:3px;padding:0 4px;margin-left:4px;letter-spacing:0.5px;vertical-align:middle">${label}</span>`;
  };

  const numList = (own, bkList=[], opts={}) => {
    const fOwn = own.filter(s => !assigned.has(displayName(s)));
    const fBk  = bkList.filter(b => !assigned.has(b.name+' (BK)'));
    // Helper: timing/fly badge for any staff row
    const timingTag = s => {
      if(!s||s.isManualBk||s.isBackup) return '';
      const raw=(s.schedVal||'').toUpperCase();
      const flyM=raw.match(/\(F(\d)\)/);
      if(flyM) return `<span style="font-size:7px;color:#fff;font-weight:700;margin-left:4px;background:#7C3AED;border-radius:3px;padding:0 4px;vertical-align:middle">F${flyM[1]}</span>`;
      const tmM=raw.match(/\((\d{4})(?:-(\d{4}))?\)/);
      if(tmM) return `<span style="font-size:7px;color:var(--blue);font-weight:700;margin-left:4px;background:var(--bbg);border:1px solid var(--b2);border-radius:3px;padding:0 4px;vertical-align:middle">${tmM[1]}${tmM[2]?'-'+tmM[2]:''}</span>`;
      return '';
    };

    if(opts.ss){
      const ssOwn = fOwn.filter(s=>ssSet.has(s.id));
      const nmOwn = fOwn.filter(s=>!ssSet.has(s.id));
      let h='';
      h+=`<div style="font-size:8px;color:var(--amber);letter-spacing:1px;margin-bottom:2px;font-weight:700">SS</div>`;
      ssOwn.forEach((s,i)=>{ const tp=s.acType||s.fleet||''; const dn=displayName(s); const tt=timingTag(s); h+=`<div onclick="toggleSS('${s.id}')" title="Click to unmark SS" style="display:flex;gap:3px;cursor:pointer;padding:1px 0"><span style="font-size:9px;color:var(--blue);width:13px;flex-shrink:0;text-align:right">${i+1}</span><span style="font-size:10px;color:var(--blue);font-weight:700;line-height:1.6">${dn}${tp?` <span style="font-size:8px;color:var(--blue)">(${tp})</span>`:''}${tt}${roleBadge(dn)}</span></div>`; });
      for(let i=ssOwn.length;i<3;i++) h+=`<div style="display:flex;gap:3px;padding:1px 0"><span style="font-size:9px;color:var(--txt3);width:13px;text-align:right">${i+1}</span><span style="font-size:9px;color:var(--txt3);font-style:italic">click ↓ to assign</span></div>`;
      if(nmOwn.length||fBk.length){
        h+=`<div style="font-size:8px;color:var(--txt3);font-weight:700;letter-spacing:1px;margin:5px 0 2px">NORMAL</div>`;
        nmOwn.forEach((s,i)=>{ const tp=s.acType||s.fleet||''; const dn=displayName(s); const tt=timingTag(s); h+=`<div onclick="toggleSS('${s.id}')" title="Click to mark as SS" style="display:flex;gap:3px;cursor:pointer;padding:1px 0"><span style="font-size:9px;color:var(--txt3);width:13px;text-align:right">${ssOwn.length+i+1}</span><span style="font-size:10px;color:var(--txt);font-weight:600;line-height:1.6">${dn}${tp?` <span style="font-size:8px;color:var(--txt3)">(${tp})</span>`:''}${tt}${roleBadge(dn)}</span></div>`; });
        fBk.forEach((b,i)=>{ h+=`<div style="display:flex;gap:3px;padding:1px 0"><span style="font-size:9px;color:var(--txt3);width:13px;text-align:right">${ssOwn.length+nmOwn.length+i+1}</span><span style="font-size:10px;color:var(--txt);font-weight:600">${b.name}${b.type?` <span style="font-size:8px;color:var(--txt3)">(${b.type})</span>`:''} <span style="font-size:8px;color:var(--txt3)">(BK)</span></span></div>`; });
      }
      return h||'<div style="font-size:9px;color:var(--txt3)">—</div>';
    }

    const all=[...fOwn,...fBk];
    if(!all.length) return '<div style="font-size:9px;color:var(--txt3);padding:2px 0">—</div>';
    return all.map((s,i)=>{
      const isBk  = i>=fOwn.length || s.isManualBk;
      const isXsBk = s.isBackup && s.fromShift;
      const isMoved = !isBk && !isXsBk && s.team && effectiveDept(s)!==s.team;
      const base  = isBk ? (s.name||s.shortName)+' (BK)' : displayName(s);
      const tp    = isBk ? (s.acType||s.type||'') : (s.acType||s.fleet||'');
      const isHalf = !isBk && !isXsBk && effAvail(s).half;
      const schedRaw = (!isBk&&!isXsBk) ? (s.schedVal||'').toUpperCase() : '';
      const flyMatch  = schedRaw.match(/\(F(\d)\)/);
      const timeMatch = !flyMatch ? schedRaw.match(/\((\d{4})(?:-(\d{4}))?\)/) : null;
      const tags = [];
      if(isXsBk)        tags.push(`<span style="font-size:8px;color:var(--txt3);font-weight:700;margin-left:2px">BK-${s.fromShift}</span>`);
      else if(isMoved)  tags.push(`<span style="font-size:8px;color:var(--txt3);margin-left:2px">↔</span>`);
      if(s._fraction!==undefined&&s._fraction<1){
        const _pct=Math.round(s._fraction*100);
        const _ttl=s.isManualBk?`Reports at ${s._bkTime||'?'} — ${_pct}% of shift`:`Partial shift ${(s.schedVal||'').match(/\(([^)]+)\)/)?.[1]||''} — ${_pct}% of shift`;
        tags.push(`<span style="font-size:8px;color:var(--amber);font-weight:700;margin-left:4px;background:var(--obg);border:1px solid var(--amber);border-radius:3px;padding:0 4px" title="${_ttl}">×${s._fraction}</span>`);
      }
      if(isHalf)        tags.push(`<span style="font-size:8px;color:var(--orange);font-weight:700;margin-left:4px;background:var(--obg);border:1px solid var(--orange);border-radius:3px;padding:0 3px">½ ${(document.getElementById('shift-sel')?.value||'SHIFT')}</span>`);
      if(flyMatch)      tags.push(`<span style="font-size:7px;color:#fff;font-weight:700;margin-left:4px;background:#7C3AED;border-radius:3px;padding:0 4px;vertical-align:middle">F${flyMatch[1]}</span>`);
      if(timeMatch)     tags.push(`<span style="font-size:7px;color:var(--blue);font-weight:700;margin-left:4px;background:var(--bbg);border:1px solid var(--b2);border-radius:3px;padding:0 4px;vertical-align:middle">${timeMatch[1]}${timeMatch[2]?'-'+timeMatch[2]:''}</span>`);
      const tag = tags.join('');
      const rb = isBk ? '' : roleBadge(base);
      const nm = tp ? `${base} <span style="font-size:8px;color:var(--txt3)">(${tp})</span>${tag}${rb}` : `${base}${tag}${rb}`;
      return `<div style="display:flex;gap:3px;padding:1px 0"><span style="font-size:9px;color:var(--txt3);width:13px;flex-shrink:0;text-align:right">${i+1}</span><span style="font-size:10px;font-weight:600;color:var(--txt);line-height:1.6">${nm}</span></div>`;
    }).join('');
  };

  const col  = `background:var(--surf);border:1px solid var(--b);border-radius:var(--r);padding:8px 10px`;
  const chdr = (t,n,c='#000') => `<div style="font-family:var(--cond);font-size:10px;font-weight:700;letter-spacing:2px;color:${c};margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--b)">${t} <span style="color:var(--txt3);font-size:9px">${n}</span></div>`;

  // sumAvail: sums fractional headcount (manual backups with RPT time count as fraction of shift)
  const sumAvail = list => sumHeadcount(list, assigned);
  const loTechAvail = sumAvail(loTech);
  const irTechAvail = sumAvail(irTech);
  const woTechAvail = sumAvail(woTech);

  // ── MIDDLE PANEL: TECH side | CERTIFIER side ──
  const midPanel = `<div>
    <div style="font-size:9px;color:var(--txt);letter-spacing:2px;font-weight:700;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid var(--b)">TECHNICIANS</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
      <div style="${col}">
        <div style="font-family:var(--cond);font-size:10px;font-weight:700;letter-spacing:2px;color:var(--txt);margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid var(--b)">TECH (L/O) <span style="color:var(--txt3);font-size:9px">${loTechAvail}</span></div>
        <div style="font-size:8px;color:var(--txt3);margin-bottom:4px">Click name to toggle SS (3 max)</div>
        ${numList(loTech, [], {ss:true})}
      </div>
      <div style="${col}">
        <div style="font-family:var(--cond);font-size:10px;font-weight:700;letter-spacing:2px;color:var(--txt);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--b)">IRR <span style="color:var(--txt3);font-size:9px">${irTechAvail}</span></div>
        ${numList(irTech)}
      </div>
      <div style="${col}">
        <div style="font-family:var(--cond);font-size:10px;font-weight:700;letter-spacing:2px;color:var(--txt);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--b)">WO <span style="color:var(--txt3);font-size:9px">${woTechAvail}</span></div>
        ${numList(woTech)}
      </div>
      <div style="${col}">
        <div style="font-family:var(--cond);font-size:10px;font-weight:700;letter-spacing:2px;color:var(--txt);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--b)">CIM <span style="color:var(--txt3);font-size:9px">${sumAvail(cimTech)}</span></div>
        ${numList(cimTech)}
      </div>
    </div>
    <div style="font-size:9px;color:var(--txt);letter-spacing:2px;font-weight:700;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid var(--b)">CERTIFIERS</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      <div style="${col}">
        ${chdr('LAT',sumAvail([...loLat,...cimLat]))}
        ${numList([...loLat,...cimLat])}
      </div>
      <div style="${col}">
        ${chdr('LAE B1',sumAvail([...irB1,...woB1,...cimB1]))}
        ${numList([...irB1,...woB1,...cimB1])}
      </div>
      <div style="${col}">
        ${chdr('LAE B2',sumAvail([...irB2,...woB2,...cimB2]))}
        ${numList([...irB2,...woB2,...cimB2])}
      </div>
    </div>
  </div>`;
  // ── ADP EXPIRY WARNING BANNER ──
  const wcAuthBannerHtml = (()=>{
    const warns=wcAuthWarningsForRoles();
    if(!warns.length) return '';
    return `<div style="background:#F5F3FF;border:2px solid #7C3AED;border-radius:6px;padding:10px 14px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;color:#7C3AED;letter-spacing:1px;margin-bottom:6px">⛔ WC PRIMARY AUTHORIZATION VIOLATION</div>
      ${warns.map(w=>`<div style="font-size:9px;color:#4C1D95;padding:2px 0">
        <b>${w.name}</b> is <b>not authorized</b> as WC Primary — assigned as <b>${w.role}</b>
        <span style="display:inline-block;margin-left:6px;background:#7C3AED;color:#fff;font-size:7px;font-weight:800;border-radius:3px;padding:0 4px">UNAUTHORIZED</span>
      </div>`).join('')}
    </div>`;
  })();
  const adpBannerHtml = (()=>{
    const warns = adpWarningsForRoles();
    if(!warns.length) return '';
    const expired=warns.filter(w=>w.status==='expired');
    const soon=warns.filter(w=>w.status==='soon');
    const isErr=expired.length>0;
    const bg=isErr?'#FEF2F2':'#FEF3C7';
    const border=isErr?'#DC2626':'#F59E0B';
    const hdrColor=isErr?'#DC2626':'#B45309';
    const rowColor=isErr?'#7F1D1D':'#78350F';
    return `<div style="background:${bg};border:2px solid ${border};border-radius:6px;padding:10px 14px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;color:${hdrColor};letter-spacing:1px;margin-bottom:6px">🔖 ${warns.length} ADP ${isErr?'EXPIRY VIOLATION':'EXPIRY WARNING'}</div>
      ${expired.map(w=>`<div style="font-size:9px;color:#7F1D1D;padding:2px 0;border-bottom:1px solid #FEE2E2">
        <b>${w.name}</b> — ADP <b>EXPIRED ${Math.abs(w.days)} days ago</b> · assigned as <b>${w.role}</b>
        <span style="display:inline-block;margin-left:6px;background:#DC2626;color:#fff;font-size:7px;font-weight:800;border-radius:3px;padding:0 4px">INVALID</span>
      </div>`).join('')}
      ${soon.map(w=>`<div style="font-size:9px;color:#78350F;padding:2px 0;border-bottom:1px solid #FDE68A">
        <b>${w.name}</b> — ADP expires in <b>${w.days} days</b> · assigned as <b>${w.role}</b>
        <span style="display:inline-block;margin-left:6px;background:#F59E0B;color:#000;font-size:7px;font-weight:800;border-radius:3px;padding:0 4px">RENEW SOON</span>
      </div>`).join('')}
      <div style="font-size:8px;color:${rowColor};margin-top:6px;font-style:italic">Update ADP dates via 🔖 ADP button in top right.</div>
    </div>`;
  })();

  // ── AVAILABILITY CONFLICT CHECK ──
  const conflictBanner = (()=>{
    const r=S.roles;
    if(!r) return '';
    const conflicts=[];

    const statusLabel=st=>({'LEAVE':'AL/OFF','OFF':'AL/OFF','ABSENT':'MC/EL',
      'COURSE':'COURSE','TASK':'TASK','FLYING':'FLYING'}[st]||st||'UNAVAILABLE');

    const isUnavail=s=>{ const a=effAvail(s); return a.st!=='WORKING'&&a.st!=='BACKUP_SHIFT'; };
    // findStaff: when multiple staff share the same name, prefer the unavailable one
    // so conflicts are never silently missed (conservative / safe-side).
    const findStaff=name=>{
      const dn=n=>S.nicknames[n.id]||n.shortName;
      const all=S.staff.filter(s=>dn(s)===name||s.shortName===name);
      if(!all.length) return undefined;
      return all.find(s=>isUnavail(s)) || all[0];
    };

    // 1. Direct role assignment conflicts
    const roleEntries=[
      {name:r.mocChaser, role:'CHASER'},
      ...(r.mojo||[]).filter(Boolean).map((n,i)=>({name:n,role:`MOJO ${i+1}`})),
      ...(r.wc||[]).flatMap((wc,i)=>[
        {name:wc.primary,role:`WC ${i+1} PRIMARY`},
        {name:wc.asst,role:`WC ${i+1} ASST`}
      ]),
      ...(r.runners||[]).filter(rn=>rn.name).map((rn,i)=>({name:rn.name,role:`RUNNER ${i+1}`})),
      ...(r.towerSlots||[]).flatMap((ts,i)=>[
        {name:ts.a,role:`TOWER ${i+1}A`},
        {name:ts.b,role:`TOWER ${i+1}B`}
      ])
    ].filter(e=>e.name);

    roleEntries.forEach(({name,role})=>{
      const s=findStaff(name);
      if(s&&isUnavail(s)) conflicts.push({
        type:'role', name, role,
        status:statusLabel(effAvail(s).st),
        msg:`<b>${name}</b> is <b>${statusLabel(effAvail(s).st)}</b> — assigned as <b>${role}</b>`
      });
    });

    // 2. Swap chain conflicts
    // If a swap partner is unavailable AND the other party has a role, flag it
    (S.swaps||[]).forEach(sw=>{
      const s1=S.staff.find(s=>s.id===sw.id1);
      const s2=S.staff.find(s=>s.id===sw.id2);
      if(!s1||!s2) return;
      const dn1=displayName(s1), dn2=displayName(s2);
      const hasRole1=roleEntries.some(e=>e.name===dn1);
      const hasRole2=roleEntries.some(e=>e.name===dn2);
      // s1 is unavailable and s2 has a role → swap breaks s2's situation
      if(isUnavail(s1)&&hasRole2) conflicts.push({
        type:'swap', name:dn1, partner:dn2, partnerDept:effectiveDept(s2),
        msg:`<b>${dn1}</b> is <b>${statusLabel(effAvail(s1).st)}</b> — swap partner of <b>${dn2}</b> who is assigned a role. Replacement needed`
      });
      // s2 is unavailable and s1 has a role
      if(isUnavail(s2)&&hasRole1) conflicts.push({
        type:'swap', name:dn2, partner:dn1, partnerDept:effectiveDept(s1),
        msg:`<b>${dn2}</b> is <b>${statusLabel(effAvail(s2).st)}</b> — swap partner of <b>${dn1}</b> who is assigned a role. Replacement needed`
      });
      // Either party unavailable regardless of role
      if(isUnavail(s1)&&!hasRole2) conflicts.push({
        type:'swap', name:dn1, partner:dn2, partnerDept:effectiveDept(s2),
        msg:`<b>${dn1}</b> is <b>${statusLabel(effAvail(s1).st)}</b> — existing swap with <b>${dn2}</b> affected`
      });
      if(isUnavail(s2)&&!hasRole1) conflicts.push({
        type:'swap', name:dn2, partner:dn1, partnerDept:effectiveDept(s1),
        msg:`<b>${dn2}</b> is <b>${statusLabel(effAvail(s2).st)}</b> — existing swap with <b>${dn1}</b> affected`
      });
    });

    const isOnShiftFn=s=>{const a=effAvail(s);return a.st==='WORKING'||a.st==='BACKUP_SHIFT';};
    const assignedNames=new Set(roleEntries.map(e=>e.name));

    if(!conflicts.length) return '';
    const roleConflicts=conflicts.filter(c=>c.type==='role');
    const swapConflicts=conflicts.filter(c=>c.type==='swap');
    return `<div style="background:#FEF2F2;border:2px solid #DC2626;border-radius:6px;padding:10px 14px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;color:#DC2626;letter-spacing:1px;margin-bottom:8px">⚠ ${conflicts.length} CONFLICT${conflicts.length>1?'S':''} DETECTED</div>
      ${roleConflicts.length?`<div style="font-size:9px;font-weight:700;color:#991B1B;margin-bottom:4px">ROLE ASSIGNMENTS AFFECTED:</div>
        ${roleConflicts.map(c=>`<div style="font-size:9px;color:#7F1D1D;padding:3px 0;border-bottom:1px solid #FEE2E2">
          ${c.msg}
          <span style="display:inline-block;margin-left:6px;background:#DC2626;color:#fff;font-size:7px;font-weight:800;border-radius:3px;padding:0 4px">${c.role}</span>
        </div>`).join('')}`:''}
      ${swapConflicts.length?`<div style="font-size:9px;font-weight:700;color:#991B1B;margin-top:6px;margin-bottom:4px">SWAPS AFFECTED:</div>
        ${swapConflicts.map(c=>{
          // Suggest available IRREG staff for quick swap
          const suggestions=S.staff.filter(s=>effectiveDept(s)==='IRR'&&s.category==='TECH'&&isOnShiftFn(s)&&!assignedNames.has(displayName(s))).slice(0,5);
          const key=`cf_${c.name.replace(/\s/g,'_')}`;
          suggestions.forEach((s,i)=>{ _allocStore[`${key}_${i}`]={allocName:c.partner,allocDept:c.partnerDept,irrName:displayName(s)}; });
          return `<div style="padding:4px 0;border-bottom:1px solid #FEE2E2">
            <div style="font-size:9px;color:#7F1D1D;margin-bottom:4px">${c.msg}</div>
            ${suggestions.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">
              <span style="font-size:8px;color:#991B1B;font-weight:700">SWAP WITH:</span>
              ${suggestions.map((s,i)=>`<button class="btn btn-ghost btn-sm" style="font-size:8px;padding:1px 6px;border-color:#DC2626;color:#DC2626" onclick="window._doSwap('${key}_${i}')">⇄ ${displayName(s)}</button>`).join('')}
            </div>`:'<span style="font-size:8px;color:var(--txt3)">No IRREG staff available</span>'}
          </div>`;
        }).join('')}`:''}
      <div style="font-size:8px;color:#991B1B;margin-top:6px;font-style:italic">Review assignments and swaps before shift briefing.</div>
    </div>`;
  })();

  const shdr = (t,c='var(--amber)') => `<div style="font-family:var(--cond);font-size:10px;font-weight:700;letter-spacing:2px;color:${c};margin:8px 0 4px;padding-top:6px;border-top:1px solid var(--b)">${t}</div>`;
  const lrow = (lbl,val) => `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid var(--b)"><span style="font-size:9px;color:var(--amber);font-weight:700">${lbl}</span><span style="font-size:10px;color:var(--txt);font-weight:700">${val||'—'}</span></div>`;
  const leftPanel = `<div style="${col}">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-size:9px;color:#0D9488;font-weight:700;letter-spacing:2px">ALLOCATION</div>
      <button class="btn btn-amber btn-sm np" onclick="openRolesModal()" style="font-size:9px;padding:3px 8px">✎ EDIT</button>
    </div>
    <div style="border-bottom:1px solid var(--b);padding-bottom:5px;margin-bottom:5px">
      <div style="font-size:11px;color:var(--amber);font-weight:700;letter-spacing:2px;margin-bottom:1px">DE</div>
      <div style="font-size:14px;font-weight:700;color:var(--txt)">${mocNames}</div>
    </div>
    ${lrow('GL LO', glNames('LO')+glBtn('LO'))}
    ${lrow('GL IRREG', glNames('IRR')+glBtn('IRR'))}
    ${lrow('GL WO', glNames('WO')+glBtn('WO'))}
    ${lrow('GL CIM', glNames('CIM')+glBtn('CIM'))}
    ${lrow('CHASER', r.mocChaser||'NIL')}
    ${shdr('MOJO')}
    ${(r.mojo||[]).map((n,i)=>`<div style="font-size:10px;font-weight:600;color:${n?'var(--txt)':'var(--txt3)'};padding:2px 4px">${n||'NIL'}</div>`).join('')}
    ${shdr('WC / GSE')}
    ${(r.wc||[]).map((wc,i)=>{
      const ss=i===0||wc.ss;
      const col=ss?'var(--blue)':'var(--txt)';
      return `<div style="display:grid;grid-template-columns:1fr 12px 1fr;gap:2px;padding:2px 0;border-bottom:1px solid var(--b);align-items:center">
        <span style="font-size:9px;font-weight:600;color:${wc.primary?col:'var(--txt3)'};min-width:0">${wc.primary||'NIL'}</span>
        <span style="font-size:9px;font-weight:700;color:var(--txt3);text-align:center">${wc.asst?'+':''}</span>
        <span style="font-size:9px;font-weight:600;color:${wc.asst?col:'var(--txt3)'};text-align:right">${wc.asst||'—'}</span>
      </div>`;
    }).join('')}
    ${shdr('RUNNER')}
    ${(r.runners||[]).map((rn,i)=>{
      const parts=(rn.timing||'').split('/').map(s=>s.trim());
      const dispTiming=isDay?(parts[0]||rn.timing):(parts[1]||parts[0]||rn.timing);
      return `<div style="display:grid;grid-template-columns:1fr auto;gap:6px;padding:2px 0;border-bottom:1px solid var(--b);align-items:center">
        <span style="font-size:9px;font-weight:600;color:${rn.name?'var(--txt)':'var(--txt3)'};min-width:0">${rn.name||'NIL'}</span>
        <span style="font-size:9px;font-weight:600;color:var(--txt2);white-space:nowrap;text-align:right">${dispTiming}</span>
      </div>`;
    }).join('')}
    ${shdr('TOWER')}
    ${(r.towerSlots||[]).map((ts,i)=>{
      const col='var(--txt)';
      const primary=ts.a&&ts.b?ts.a+' / '+ts.b:ts.a||ts.b||'NIL';
      return `<div style="display:grid;grid-template-columns:1fr 12px 1fr;gap:2px;padding:2px 0;border-bottom:1px solid var(--b);align-items:center">
        <span style="font-size:9px;font-weight:600;color:${(ts.a||ts.b)?col:'var(--txt3)'};min-width:0">${primary}</span>
        <span style="font-size:9px;font-weight:700;color:var(--txt3);text-align:center">${ts.backup?'+':''}</span>
        <span style="font-size:9px;font-weight:600;color:${ts.backup?col:'var(--txt3)'};text-align:right">${ts.backup||'—'}</span>
      </div>`;
    }).join('')}
  </div>`;

  // ── MIDDLE PANEL: numbered staff lists ──
  // ── RIGHT PANEL ──
  const totalTech = loTech.length+irTech.length+woTech.length;
  const totalB1   = irB1.length+woB1.length;
  const totalB2   = irB2.length+woB2.length;

  // ── SPLIT RIGHT PANEL: top = SOC/PDSC/FGS, bottom = Avail/HC/ARR ──
  const topRightPanel = `
    <div style="${col};margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:9px;color:var(--amber);font-weight:700;letter-spacing:2px">SOC</div>
        <button class="btn btn-ghost btn-sm np" onclick="addSoc()" style="font-size:9px;padding:2px 8px">+ ADD</button>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:8px;table-layout:fixed">
        <tr style="background:var(--surf2)">
          <th style="width:16px;padding:1px 3px;font-size:7px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)">#</th>
          <th style="width:36px;padding:1px 3px;font-size:7px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)">REG</th>
          <th style="width:54px;padding:1px 3px;font-size:7px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)">NAME</th>
          <th style="width:76px;padding:1px 3px;font-size:7px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)">TIME</th>
          <th style="width:44px;padding:1px 3px;font-size:7px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)">REMARK</th>
          <th class="np" style="width:20px;padding:1px 3px;font-size:7px;color:var(--txt3);font-weight:400;text-align:center;border:1px solid var(--b)">✓</th>
          <th class="np" style="width:18px;border:1px solid var(--b)"></th>
        </tr>
        ${S.soc.map((sr,i)=>{
          const done=sr.done||false;
          const rmk=(sr.remark||'').toUpperCase();
          const isExt=rmk.includes('EXT');
          const isHo=rmk.includes('HO');
          const rowBg=done?'#D1FAE5':isExt?'#CFFAFE':isHo?'#FEF3C7':'transparent';
          const rowTxt=done?'#065F46':isExt?'#0E7490':isHo?'var(--yellow)':'var(--txt)';
          return `<tr style="background:${rowBg};color:${rowTxt}">
          <td style="padding:1px 3px;border:1px solid var(--b);font-size:8px;color:var(--txt3)">${i+1}</td>
          <td style="padding:1px 3px;border:1px solid var(--b)"><input value="${sr.flight}" oninput="S.soc[${i}].flight=this.value;scheduleSave()" placeholder="LDG" style="background:transparent;border:none;color:${rowTxt};font-family:var(--mono);font-size:8px;width:32px;outline:none"></td>
          <td style="padding:1px 3px;border:1px solid var(--b)"><input value="${sr.name}" oninput="S.soc[${i}].name=this.value;scheduleSave()" placeholder="Name" style="background:transparent;border:none;color:${rowTxt};font-family:var(--mono);font-size:8px;width:48px;outline:none"></td>
          <td style="padding:1px 3px;border:1px solid var(--b)"><input value="${sr.time}" oninput="S.soc[${i}].time=this.value;scheduleSave()" placeholder="0715-1030" style="background:transparent;border:none;color:${rowTxt};font-family:var(--mono);font-size:8px;width:68px;outline:none"></td>
          <td style="padding:1px 3px;border:1px solid var(--b)"><input value="${sr.remark||''}" oninput="S.soc[${i}].remark=this.value;scheduleSave()" placeholder="EXT/HO" style="background:transparent;border:none;color:${rowTxt};font-family:var(--mono);font-size:8px;width:36px;outline:none"></td>
          <td class="np" style="padding:1px 3px;border:1px solid var(--b);text-align:center">
            <input type="checkbox" ${done?'checked':''} onchange="S.soc[${i}].done=this.checked;scheduleSave();renderSummary()" style="cursor:pointer;accent-color:#10B981">
          </td>
          <td class="np" style="padding:1px 3px;border:1px solid var(--b)"><button class="btn btn-red btn-sm" onclick="rmSoc(${i})" style="padding:0 4px;font-size:8px">✕</button></td>
        </tr>`;}).join('')}
      </table>
    </div>

    <div style="${col};margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:9px;color:var(--amber);font-weight:700;letter-spacing:2px">PDSC</div>
        <button class="btn btn-ghost btn-sm np" onclick="addPdsc()" style="font-size:9px;padding:2px 8px">+ ADD</button>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <tr style="background:var(--surf2)">
          <th style="padding:2px 5px;font-size:8px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)">A/C REG</th>
          <th style="padding:2px 5px;font-size:8px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)">CERTIFIER</th>
          <th class="np" style="border:1px solid var(--b)"></th>
        </tr>
        ${S.pdsc.map((p,i)=>`<tr>
          <td style="padding:2px 4px;border:1px solid var(--b)"><input value="${p.reg}" oninput="S.pdsc[${i}].reg=this.value;scheduleSave()" placeholder="9M-XXX" style="background:transparent;border:none;color:var(--txt);font-family:var(--mono);font-size:10px;width:70px;outline:none"></td>
          <td style="padding:2px 4px;border:1px solid var(--b)"><input value="${p.certifier}" oninput="S.pdsc[${i}].certifier=this.value;scheduleSave()" placeholder="Name" style="background:transparent;border:none;color:var(--txt);font-family:var(--mono);font-size:10px;width:110px;outline:none"></td>
          <td class="np" style="padding:2px 4px;border:1px solid var(--b)"><button class="btn btn-red btn-sm" onclick="rmPdsc(${i})" style="padding:1px 5px;font-size:9px">✕</button></td>
        </tr>`).join('')}
      </table>
    </div>

    <div style="${col};margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:9px;color:var(--amber);font-weight:700;letter-spacing:2px">FGS</div>
        <button class="btn btn-ghost btn-sm np" onclick="addFgs()" style="font-size:9px;padding:2px 8px">+ ADD</button>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <tr style="background:var(--surf2)">
          <th style="padding:2px 5px;font-size:8px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)">#</th>
          <th style="padding:2px 5px;font-size:8px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)">A/C REG</th>
          <th style="padding:2px 5px;font-size:8px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)">REMARK</th>
          <th class="np" style="border:1px solid var(--b)"></th>
        </tr>
        ${S.fgs.map((f,i)=>`<tr>
          <td style="padding:2px 4px;color:var(--txt3);border:1px solid var(--b)">${i+1}</td>
          <td style="padding:2px 4px;border:1px solid var(--b)"><input value="${f.reg}" oninput="S.fgs[${i}].reg=this.value;scheduleSave()" placeholder="9M-XXX" style="background:transparent;border:none;color:var(--txt);font-family:var(--mono);font-size:10px;width:70px;outline:none"></td>
          <td style="padding:2px 4px;border:1px solid var(--b)"><input value="${f.remark||''}" oninput="S.fgs[${i}].remark=this.value;scheduleSave()" placeholder="Remark" style="background:transparent;border:none;color:var(--txt2);font-family:var(--mono);font-size:10px;width:90px;outline:none"></td>
          <td class="np" style="padding:2px 4px;border:1px solid var(--b)"><button class="btn btn-red btn-sm" onclick="rmFgs(${i})" style="padding:1px 5px;font-size:9px">✕</button></td>
        </tr>`).join('')}
      </table>
    </div>`;

  // Count staff — half-shift and flying-on-duty count as 0.5
  const isFlyDuty=s=>s&&!s._manual&&/\(F\d\)/.test((s.schedVal||'').toUpperCase());
  const hCount=arr=>arr.reduce((s,st)=>s+(st&&(effAvail(st)?.half||isFlyDuty(st))?0.5:1),0);
  const fmtN=n=>n%1?n.toFixed(1):n;
  const bottomPanel = `
    <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:start;margin-top:10px;padding-top:10px;border-top:2px solid var(--b)">

      <div style="${col}">
        <div style="font-size:9px;color:var(--amber);font-weight:700;letter-spacing:2px;margin-bottom:6px">AVAILABILITY</div>
        <div style="display:grid;grid-template-columns:repeat(${(cim.own.length)?4:3},1fr);gap:10px">
          <div>
            <div style="font-size:8px;color:var(--txt3);letter-spacing:1px;margin-bottom:3px;font-weight:600">LINE OPS</div>
            ${avTbl([['LAT',lo,'LAT'],['TECH',lo,'TECH']])}
          </div>
          <div>
            <div style="font-size:8px;color:var(--txt3);letter-spacing:1px;margin-bottom:3px;font-weight:600">IRREG</div>
            ${avTbl([['LAE B1',irr,'LAE B1'],['LAE B2',irr,'LAE B2'],['TECH',irr,'TECH']])}
          </div>
          <div>
            <div style="font-size:8px;color:var(--txt3);letter-spacing:1px;margin-bottom:3px;font-weight:600">WORK ORDER</div>
            ${avTbl([['LAE B1',wo,'LAE B1'],['LAE B2',wo,'LAE B2'],['TECH',wo,'TECH']])}
          </div>
          ${(cim.own.length)?`<div>
            <div style="font-size:8px;color:var(--txt3);letter-spacing:1px;margin-bottom:3px;font-weight:600">CABIN (CIM)</div>
            ${avTbl([['LAE B1',cim,'LAE B1'],['LAE B2',cim,'LAE B2'],['TECH',cim,'TECH']])}
          </div>`:''}
        </div>
      </div>

      <div style="${col}">
        <div style="font-size:9px;color:var(--amber);font-weight:700;letter-spacing:2px;margin-bottom:8px">HEADCOUNT</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px">
          <tr style="background:var(--surf2)">
            <th style="padding:3px 6px;font-size:8px;color:var(--txt3);font-weight:400;text-align:left;border:1px solid var(--b)"> </th>
            <th style="padding:3px 6px;font-size:8px;color:var(--txt3);font-weight:400;text-align:center;border:1px solid var(--b)">LO</th>
            <th style="padding:3px 6px;font-size:8px;color:var(--txt3);font-weight:400;text-align:center;border:1px solid var(--b)">IRREG</th>
            <th style="padding:3px 6px;font-size:8px;color:var(--txt3);font-weight:400;text-align:center;border:1px solid var(--b)">WO</th>
            <th style="padding:3px 6px;font-size:8px;color:var(--txt3);font-weight:400;text-align:center;border:1px solid var(--b)">CIM</th>
            <th style="padding:3px 6px;font-size:8px;color:var(--amber);font-weight:700;text-align:center;border:1px solid var(--b)">TTL</th>
          </tr>
          ${(()=>{
            let html='';
            [['TECH','TECH'],['LAT','LAT'],['LAE B1','LAE B1'],['LAE B2','LAE B2']].forEach(([lbl,cat])=>{
              const loArr=excActingGL({'TECH':loTech,'LAT':loLat}[cat]||[]);
              const irArr=excActingGL({'TECH':irTech,'LAE B1':irB1,'LAE B2':irB2}[cat]||[]);
              const woArr=excActingGL({'TECH':woTech,'LAE B1':woB1,'LAE B2':woB2}[cat]||[]);
              const cmArr=excActingGL({'TECH':cimTech,'LAT':cimLat,'LAE B1':cimB1,'LAE B2':cimB2}[cat]||[]);
              const lv=hCount(loArr),iv=hCount(irArr),wv=hCount(woArr),cv=hCount(cmArr),tot=lv+iv+wv+cv;
              if(!tot) return;
              html+=`<tr><td style="padding:3px 6px;color:var(--txt2);border:1px solid var(--b)">${lbl}</td>
                <td style="padding:3px 6px;text-align:center;color:${lv?'var(--green)':'var(--txt3)'};border:1px solid var(--b)">${fmtN(lv)||'—'}</td>
                <td style="padding:3px 6px;text-align:center;color:${iv?'var(--green)':'var(--txt3)'};border:1px solid var(--b)">${fmtN(iv)||'—'}</td>
                <td style="padding:3px 6px;text-align:center;color:${wv?'var(--green)':'var(--txt3)'};border:1px solid var(--b)">${fmtN(wv)||'—'}</td>
                <td style="padding:3px 6px;text-align:center;color:${cv?'var(--green)':'var(--txt3)'};border:1px solid var(--b)">${fmtN(cv)||'—'}</td>
                <td style="padding:3px 6px;text-align:center;color:var(--amber);font-weight:700;border:1px solid var(--b)">${fmtN(tot)}</td></tr>`;
            });
            const tlo=hCount(excActingGL(loTech))+hCount(excActingGL(loLat)),ti=hCount(excActingGL(irTech))+hCount(excActingGL(irB1))+hCount(excActingGL(irB2));
            const tw=hCount(excActingGL(woTech))+hCount(excActingGL(woB1))+hCount(excActingGL(woB2)),tc=hCount(excActingGL(cimTech))+hCount(excActingGL(cimLat))+hCount(excActingGL(cimB1))+hCount(excActingGL(cimB2));
            html+=`<tr style="background:var(--surf2)"><td style="padding:3px 6px;color:var(--amber);font-weight:700;border:1px solid var(--b)">TOTAL</td>
              <td style="padding:3px 6px;text-align:center;color:var(--amber);font-weight:700;border:1px solid var(--b)">${fmtN(tlo)}</td>
              <td style="padding:3px 6px;text-align:center;color:var(--amber);font-weight:700;border:1px solid var(--b)">${fmtN(ti)}</td>
              <td style="padding:3px 6px;text-align:center;color:var(--amber);font-weight:700;border:1px solid var(--b)">${fmtN(tw)}</td>
              <td style="padding:3px 6px;text-align:center;color:var(--amber);font-weight:700;border:1px solid var(--b)">${fmtN(tc)}</td>
              <td style="padding:3px 6px;text-align:center;color:var(--amber);font-weight:700;border:1px solid var(--b)">${fmtN(tlo+ti+tw+tc)}</td></tr>`;
            return html;
          })()}
        </table>
      </div>

      <div style="${col};min-width:180px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
          ${['ARR','DEP','TOW'].map(k=>`<div style="text-align:center">
            <div style="font-size:8px;color:var(--txt3);letter-spacing:1px;margin-bottom:3px">${k}</div>
            <input type="text" value="${S.ops[k]}" oninput="S.ops['${k}']=this.value;scheduleSave()" placeholder="—"
              style="background:var(--bg);border:1px solid var(--b);border-radius:4px;color:var(--amber);font-family:var(--cond);font-size:22px;font-weight:700;text-align:center;width:100%;outline:none;padding:4px 0">
          </div>`).join('')}
        </div>
      </div>

    </div>`;
  const xsBkAll2 = S.staff.filter(s=>s.isBackup&&isActive(effAvail(s)));
  const xsBkByShift = {};
  xsBkAll2.forEach(s=>{ const sh=s.fromShift||'?'; if(!xsBkByShift[sh]) xsBkByShift[sh]=[]; xsBkByShift[sh].push(s); });
  const xsBanner = xsBkAll2.length ? `
    <div style="background:var(--bbg);border:1px solid var(--blue);border-radius:var(--r);padding:8px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="background:var(--blue);color:#fff;border-radius:3px;padding:1px 7px;font-size:9px;font-weight:700;letter-spacing:1px">${xsBkAll2.length} CROSS-SHIFT BK</span>
      <span style="font-size:10px;color:var(--blue)">${Object.entries(xsBkByShift).map(([sh,ppl])=>`SHIFT ${sh}: ${ppl.map(s=>displayName(s)).join(', ')}`).join(' · ')}</span>
    </div>` : '';

  let h=`
    <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-family:var(--cond);font-size:20px;font-weight:700;letter-spacing:3px;color:var(--amber)">${dateStr} · ${shift}</div>
        <div style="font-size:9px;color:var(--txt2);margin-top:1px;letter-spacing:1px">SHIFT ${document.getElementById('shift-group-sel')?.value||'C'} · SUMMARY OPS</div>
      </div>
      <button class="btn btn-amber np" onclick="openRolesModal()">✎ ASSIGN ROLES</button>
      <button class="btn btn-ghost np" onclick="openAllocModal()" style="font-size:11px">📋 PASTE ALLOCATION</button>
      <button class="btn btn-ghost np" onclick="openBriefingModal()" style="font-size:11px">📤 GENERATE TEXT</button>
      <button class="btn btn-ghost np" onclick="openExclusionsModal()" style="font-size:11px;color:var(--red)">🚫 HIDDEN STAFF${(S.exclusions||[]).length?` (${S.exclusions.length})`:''}</button>
    </div>
    ${xsBanner}
    ${adpBannerHtml}${wcAuthBannerHtml}
    ${conflictBanner}
    <div style="display:grid;grid-template-columns:200px 1fr 300px;gap:10px;align-items:start">
      <div>${leftPanel}</div>
      <div>${midPanel}</div>
      <div>${topRightPanel}</div>
    </div>
    ${bottomPanel}
    <div class="np" style="display:flex;gap:8px;margin-top:10px">
      <button class="btn btn-amber btn-sm" onclick="printSummary()">🖨 PRINT</button>
      <button class="btn btn-ghost btn-sm" onclick="exportTxt()">⬇ TXT</button>
      <button class="btn btn-ghost btn-sm" onclick="copyClip()">📋 COPY</button>
    </div>`;

  el.innerHTML=h;
}

function normCat(pos){
  const p=pos.toUpperCase();
  if(p.includes('LAE B1')||p==='TECH B1') return 'LAE B1';
  if(p.includes('LAE B2')||p==='TECH B2') return 'LAE B2';
  if(p==='LAT') return 'LAT';
  if(p==='GL') return 'GL';
  return 'TECH';
}
// Returns the fraction of the 12-hour shift a manual backup covers based on their RPT time.
// DAY shift = 0600-1800, NIGHT shift = 1800-0600. Returns 1 if no time set or time is invalid.
// Sum headcount for a staff list: each person counts 1, or their _fraction when they only cover
// part of the shift (manual backup RPT / bounded window / half-shift). People already assigned
// to a role (their displayName is in `assigned`) are excluded. Returns a tidy string: "6", "5.5", "5.42".
function sumHeadcount(list, assigned){
  let t=0;
  list.filter(s=>!assigned.has(displayName(s))).forEach(s=>{ t+=(s._fraction!==undefined)?s._fraction:1; });
  const r=Math.round(t*100)/100;
  return Number.isInteger(r)?String(r):r.toFixed(2).replace(/\.?0+$/,'');
}

// A manual backup's time field can be either:
//   "0800"        — single report time: reports late, stays till shift end
//   "1900-0100"   — bounded window: only present for this exact span
//                   (e.g. reports late AND leaves early), regardless of shift end
function isBkRange(time){ return /^\d{3,4}\s*-\s*\d{3,4}$/.test((time||'').trim()); }

function bkFraction(b){
  if(!b.time||b.mcEl) return 1;
  const shType=(document.getElementById('shift-sel')?.value||'DAY').toUpperCase();
  const startMin=shType==='NIGHT'?18*60:6*60;
  const endMin=startMin+720; // 12h shift window, in minutes-of-day (extends past 1440 for NIGHT)

  const rangeMatch=b.time.trim().match(/^(\d{3,4})\s*-\s*(\d{3,4})$/);
  if(rangeMatch){
    const toMin=t=>{ const s=t.padStart(4,'0'); return parseInt(s.slice(0,2),10)*60+parseInt(s.slice(2,4),10); };
    let from=toMin(rangeMatch[1]), to=toMin(rangeMatch[2]);
    if(shType==='NIGHT'){
      if(from<12*60) from+=24*60;   // after-midnight side of a night shift
      if(to<=12*60)  to+=24*60;
    }
    if(to<=from) to+=24*60; // window rolls past midnight (e.g. 1900-0100)
    const dur=Math.min(to,endMin)-Math.max(from,startMin);
    if(dur<=0) return 0;
    if(dur>=720) return 1;
    return Math.round(dur/720*100)/100;
  }

  // Single report time — reports late, stays till shift end
  const tStr=b.time.replace(/[^0-9]/g,'').padStart(4,'0');
  const rptH=parseInt(tStr.slice(0,2),10), rptM=parseInt(tStr.slice(2,4),10);
  if(isNaN(rptH)||isNaN(rptM)||rptH>23||rptM>59) return 1;
  let rptMin=rptH*60+rptM;
  if(shType==='NIGHT'&&rptMin<12*60) rptMin+=24*60; // after-midnight RPT on night shift
  const remaining=endMin-rptMin;
  if(remaining<=0) return 0;
  if(remaining>=720) return 1;
  return Math.round(remaining/720*100)/100;
}

// Own/cross-shift roster staff can also carry a bounded working window right in their
// schedule cell, e.g. "NIGHT (0000-0700)" — meaning they're only actually present for
// that window, not the full 12h shift. Reuse bkFraction's range math by building the
// same synthetic {time:"HHMM-HHMM"} shape it already knows how to weigh.
function schedValFraction(schedVal){
  const raw=(schedVal||'').toUpperCase();
  if(/\(1\/2\)/.test(raw)) return 0.5;
  const m=raw.match(/\((\d{4})-(\d{4})\)/);
  if(!m) return 1;
  return bkFraction({time:`${m[1]}-${m[2]}`, mcEl:false});
}

function updateCounts(){
  [['LO','lo'],['IRR','irreg'],['WO','wo'],['CIM','cim']].forEach(([t,k])=>{
    const own = S.staff.filter(s => effectiveDept(s)===t && !isTransferred(s));
    const av  = own.filter(s=>isActive(effAvail(s))).length;
    const el  = document.getElementById(`cnt-${k}`);
    if(el) el.textContent=`${av}/${own.length}`;
  });
}


