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

function updateCounts(){
  [['LO','lo'],['IRR','irreg'],['WO','wo'],['CIM','cim']].forEach(([t,k])=>{
    const own = S.staff.filter(s => effectiveDept(s)===t && !isTransferred(s));
    const av  = own.filter(s=>isActive(effAvail(s))).length;
    const el  = document.getElementById(`cnt-${k}`);
    if(el) el.textContent=`${av}/${own.length}`;
  });
}

