// ═══════════════════════════════════
function showDebug(){
  const d = S.debug;
  if(!d.totalRows){ alert('Load roster first, then click 🔍 DEBUG.'); return; }
  const colStr = d.cols ? Object.entries(d.cols).map(([k,v])=>`${k}=col[${v}]`).join('  ') : 'not detected';
  const sampleHTML = (d.sample||[]).map(s=>`
    <tr style="border-bottom:1px solid #1E2A38">
      <td style="padding:3px 8px;color:#60A5FA">${s.team}</td>
      <td style="padding:3px 8px;color:var(--txt);font-size:10px">${s.id}</td>
      <td style="padding:3px 8px;color:var(--txt);font-size:10px">${s.name.substring(0,22)}</td>
      <td style="padding:3px 8px;color:${s.shift==='C'?'#10B981':'#F87171'};font-weight:700">${s.shift||'(empty)'}</td>
      <td style="padding:3px 8px;color:var(--txt3);font-size:9px">read from col[${s.colShift}]</td>
    </tr>`).join('');

  document.body.insertAdjacentHTML('beforeend',`<div id="dbg-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;overflow-y:auto;padding:24px;font-family:'Inter',sans-serif">
    <div style="max-width:820px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="color:#F59E0B;font-size:16px;font-weight:700;letter-spacing:2px">🔍 DEBUG PANEL</div>
        <button onclick="document.getElementById('dbg-overlay').remove()" style="background:var(--surf3);border:1px solid var(--b2);color:var(--txt);padding:6px 16px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px">✕ CLOSE</button>
      </div>

      <div style="background:var(--surf);border:1px solid var(--b);border-radius:8px;padding:16px;margin-bottom:12px">
        <div style="color:#F59E0B;font-size:10px;letter-spacing:2px;margin-bottom:10px">SHEET FETCH RESULT</div>
        <div style="font-size:11px;color:var(--txt);line-height:2.2">
          Total rows received from API: <b style="color:#10B981">${d.totalRows}</b><br>
          Date column: <b style="color:${d.dateCol>=0?'#10B981':'#F87171'}">${d.dateCol>=0?`col[${d.dateCol}] found at row ${d.dateRow}`:'❌ NOT FOUND'}</b><br>
          Date cell value: <b style="color:#FBBF24">"${d.dateHeaderCell}"</b><br>
          Prev cell (col-1): <b style="color:var(--txt3)">"${d.dateAdjacentPrev}"</b><br>
          Next cell (col+1): <b style="color:var(--txt3)">"${d.dateAdjacentNext}"</b><br>
          Sample schedule values: <b style="color:#FBBF24">${(d.sampleSchedVals||[]).map(s=>`${s.name}="${s.schedVal}"`).join(', ')}</b><br>
          Column detection: <b style="color:${d.headerFound?'#10B981':'#FB923C'}">${d.headerFound?`✓ id=col[${d.cols?.id}] name=col[${d.cols?.name}]`:'⚠ fallback'}</b><br>
          Sections detected: <b style="color:${Object.keys(d.sections||{}).length>0?'#10B981':'#F87171'}">${Object.entries(d.sections||{}).map(([k,v])=>`${k}(${v.count} @ row ${v.startRow})`).join(' · ')||'NONE'}</b><br>
          Total Shift C staff loaded: <b style="color:${d.staffFound>0?'#10B981':'#F87171'}">${d.staffFound}</b><br>
          Cross-shift backups detected: <b style="color:${d.xsBkFound>0?'#10B981':'#FB923C'}">${d.xsBkFound||0}</b>
          ${d.xsBkSamples?.length?`<br><span style="font-size:9px;color:var(--txt3)">${d.xsBkSamples.map(s=>`${s.name} → ${s.team} (SHIFT ${s.fromShift}) val="${s.schedVal}"`).join(' · ')}</span>`:''}
        </div>
      </div>

      <div style="background:var(--surf);border:1px solid var(--b);border-radius:8px;padding:16px;margin-bottom:12px">
        <div style="color:#F59E0B;font-size:10px;letter-spacing:2px;margin-bottom:8px">ROW 5 — COLUMNS 38–55 (looking for end-of-month date cells)</div>
        <div style="font-size:10px;color:var(--txt3);line-height:2">
          ${(d.row5cols||[]).map(c=>`col[${c.col}]: <span style="color:#FBBF24">"${c.val}"</span>`).join(' &nbsp;|&nbsp; ')||'(no values found in this range)'}
        </div>
      </div>
        <div style="font-size:10px;color:var(--txt3);line-height:2;word-break:break-all">${colStr}</div>
      </div>

      <div style="background:var(--surf);border:1px solid var(--b);border-radius:8px;padding:16px;margin-bottom:12px">
        <div style="color:#F59E0B;font-size:10px;letter-spacing:2px;margin-bottom:8px">
          SAMPLE ROWS — LO/IRR/WO STAFF (ALL SHIFTS)
          <span style="color:var(--txt3);font-weight:400"> · Shift C shown in green · Others in red</span>
        </div>
        ${d.sample&&d.sample.length?`<table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="border-bottom:1px solid #28384A">
            <th style="padding:5px 8px;color:var(--txt3);text-align:left;font-weight:400">TEAM</th>
            <th style="padding:5px 8px;color:var(--txt3);text-align:left;font-weight:400">STAFF ID</th>
            <th style="padding:5px 8px;color:var(--txt3);text-align:left;font-weight:400">NAME</th>
            <th style="padding:5px 8px;color:var(--txt3);text-align:left;font-weight:400">SHIFT VALUE</th>
            <th style="padding:5px 8px;color:var(--txt3);text-align:left;font-weight:400">SOURCE</th>
          </tr></thead>
          <tbody>${sampleHTML}</tbody>
        </table>
        ${d.sample.filter(s=>s.shift==='C').length===0?
          `<div style="color:#F87171;font-size:11px;margin-top:12px;padding:10px;background:#1A0606;border-radius:4px">
            ⚠ No rows have Shift = "C". The SHIFT VALUE column above shows what values are actually in your sheet.<br>
            Screenshot this and share — I'll fix the parser to match.
          </div>`:''}`
        :`<div style="color:#FB923C;font-size:11px">No LO/IRR/WO rows found at all. The team column might be at the wrong index (currently col[${d.cols?.team}]).</div>`}
      </div>

      <div style="background:var(--surf);border:1px solid var(--b);border-radius:8px;padding:16px;margin-bottom:12px">
        <div style="color:#F59E0B;font-size:10px;letter-spacing:2px;margin-bottom:8px">OTHER SHIFT ROWS — SCHEDULE VALUES ON SELECTED DATE</div>
        ${d.otherShiftSamples?.length?`<table style="width:100%;border-collapse:collapse;font-size:10px">
          <thead><tr style="border-bottom:1px solid #28384A">
            <th style="padding:4px 8px;color:var(--txt3);text-align:left;font-weight:400">SHIFT</th>
            <th style="padding:4px 8px;color:var(--txt3);text-align:left;font-weight:400">STAFF ID</th>
            <th style="padding:4px 8px;color:var(--txt3);text-align:left;font-weight:400">NAME</th>
            <th style="padding:4px 8px;color:var(--txt3);text-align:left;font-weight:400">SCHEDULE VALUE</th>
          </tr></thead>
          <tbody>${(d.otherShiftSamples||[]).map(s=>`<tr style="border-bottom:1px solid #1E2A38">
            <td style="padding:3px 8px;color:#60A5FA">${s.shift}</td>
            <td style="padding:3px 8px;color:var(--txt3);font-size:9px">${s.id}</td>
            <td style="padding:3px 8px;color:var(--txt);font-size:9px">${s.name.substring(0,20)}</td>
            <td style="padding:3px 8px;color:#FBBF24;font-weight:700">${s.schedVal}</td>
          </tr>`).join('')}</tbody>
        </table>
        <div style="color:var(--txt3);font-size:10px;margin-top:8px">Share a screenshot of this — the SCHEDULE VALUE column shows the exact codes in your sheet so I can match them precisely.</div>`
        :`<div style="color:#FB923C;font-size:11px">No other-shift staff rows found. The section headers may not match "SHIFT A/B/D" pattern.</div>`}
      </div>
        <div style="font-size:11px;color:var(--txt3);line-height:2">
          1. Screenshot this panel and share it — I can fix the column detection from this info.<br>
          2. If SHIFT VALUE is blank or shows something other than A/B/C/D — the shift column is at the wrong index.<br>
          3. If no LO/IRR/WO rows appear — the team column is wrong.<br>
          4. If Date = NOT FOUND — check that the date exists in tab <b style="color:var(--txt)">"${S.cfg.tab}"</b> and month matches.
        </div>
      </div>
    </div>
  </div>`);
}


// ═══════════════════════════════════════════════════════
// ROSTER SNAPSHOT
// ═══════════════════════════════════════════════════════
function openSnap(){
  document.getElementById('snap-ov').classList.add('show');
  loadSnapList();
}
function closeSnap(){ document.getElementById('snap-ov').classList.remove('show'); }

async function takeSnapshot(){
  if(!S.loaded){ showToast('Load a roster first','err'); return; }
  if(!fbReady){ showToast('Firebase not ready','err'); return; }
  const key=fbKey(); if(!key) return;
  const avail=S.staff.filter(s=>{ const a=effAvail(s); return a.st==='WORKING'||a.st==='BACKUP_SHIFT'; }).length;
  const total=S.staff.filter(s=>!s.isBackup).length;
  const ts=Date.now();
  const payload={
    _takenAt:ts,
    label:`${document.getElementById('dp').value} ${document.getElementById('shift-sel').value} ${document.getElementById('shift-group-sel').value}`,
    avail, total,
    overrides:JSON.parse(JSON.stringify(S.overrides)),
    roles:JSON.parse(JSON.stringify(S.roles||{})),
    ssTechs:JSON.parse(JSON.stringify(S.ssTechs||[]))
  };
  try{
    await fbDb.ref(`snapshots/${key}/${ts}`).set(payload);
    showToast('Snapshot saved 📸','ok'); loadSnapList();
  }catch(e){ showToast('Snapshot failed: '+e.code,'err'); }
}

async function loadSnapList(){
  const key=fbKey(); if(!key||!fbReady) return;
  const el=document.getElementById('snap-list'); if(!el) return;
  el.innerHTML='<div style="color:var(--txt3);font-size:11px;padding:10px">Loading…</div>';
  try{
    const snap=await fbDb.ref(`snapshots/${key}`).get();
    if(!snap.exists()){ el.innerHTML='<div style="color:var(--txt3);font-size:12px;padding:20px 0;text-align:center">No snapshots yet.</div>'; return; }
    const sorted=Object.entries(snap.val()).sort((a,b)=>b[0]-a[0]);
    el.innerHTML=sorted.map(([ts,d])=>{
      const dt=new Date(parseInt(ts));
      const tStr=dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      const dStr=dt.toLocaleDateString([],{day:'2-digit',month:'short'});
      return `<div class="snap-row" onclick="viewSnapshot('${key}','${ts}')">
        <div>
          <div class="snap-ts">${dStr} ${tStr}</div>
          <div class="snap-meta">Avail: ${d.avail??'?'}/${d.total??'?'} &nbsp;·&nbsp; ${Object.keys(d.overrides||{}).length} overrides</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteSnapshot('${key}','${ts}')" style="color:var(--red);border-color:var(--red);font-size:9px;padding:2px 5px">🗑</button>
      </div>`;
    }).join('');
  }catch(e){ el.innerHTML='<div style="color:var(--red);font-size:11px;padding:10px">Error: '+e.message+'</div>'; }
}

async function viewSnapshot(key,ts){
  if(!fbReady) return;
  try{
    const snap=await fbDb.ref(`snapshots/${key}/${ts}`).get();
    if(!snap.exists()) return;
    const d=snap.val();
    const dt=new Date(parseInt(ts));
    const overList=Object.entries(d.overrides||{}).map(([id,v])=>`  ${id}: ${v}`).join('\n')||'  None';
    alert(`📸 Snapshot — ${dt.toLocaleString()}\n\nAvail: ${d.avail}/${d.total}\nOverrides:\n${overList}`);
  }catch(e){ showToast('Load failed','err'); }
}

async function deleteSnapshot(key,ts){
  if(!confirm('Delete this snapshot?')) return;
  try{ await fbDb.ref(`snapshots/${key}/${ts}`).remove(); showToast('Deleted','ok',1500); loadSnapList(); }
  catch(e){ showToast('Delete failed','err'); }
}

// ═══════════════════════════════════════════════════════
// DUPLICATE NAME WARNING
// ═══════════════════════════════════════════════════════
function checkDuplicateNames(){
  if(!S.staff||!S.staff.length) return;
  const seen={};
  S.staff.forEach(s=>{
    if(s.isBackup) return;
    const nm=(displayName(s)||'').toUpperCase().trim();
    if(!nm) return;
    if(!seen[nm]) seen[nm]=[];
    seen[nm].push(s);
  });
  const dups=Object.entries(seen).filter(([,arr])=>arr.length>1);
  dups.forEach(([nm,arr])=>{
    showToast(`⚠ Duplicate name: ${nm} (${arr.length} staff)`, 'err', 5000);
  });
}

// ═══════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════
const _actLog=[];
let _actLogOpen=false;

function logActivity(staffId, action){
  const s=S.staff.find(x=>x.id===staffId);
  const name=s?displayName(s):staffId;
  const entry={ts:Date.now(), name, action, by:_user.name||''};
  _actLog.unshift(entry);
  if(_actLog.length>200) _actLog.length=200;
  if(fbReady){ const key=fbKey(); if(key) fbDb.ref(`activityLog/${key}`).push(entry).catch(()=>{}); }
  _renderActLog();
}

function logEvent(category, detail){
  const entry={ts:Date.now(), name:'['+category+']', action:detail, _evt:true, by:_user.name||''};
  _actLog.unshift(entry);
  if(_actLog.length>200) _actLog.length=200;
  if(fbReady){ const key=S._fbKey||fbKey(); if(key) fbDb.ref(`activityLog/${key}`).push(entry).catch(()=>{}); }
  _renderActLog();
}

function _actCls(action){
  const a=(action||'').toUpperCase();
  if(a.includes('MC')) return 'mc';
  if(a.includes('AL/OFF')) return 'al';
  if(a.includes('WORKING')) return 'wk';
  if(a.includes('FLYING')) return 'fly';
  if(a.includes('RESTORED')) return 'rst';
  if(a.includes('↔')) return 'sw';
  if(a.includes('TRANSFER')||a.includes('→')) return 'tr';
  return '';
}
function _evtCls(cat){
  const c=(cat||'').toUpperCase();
  if(c.includes('SWAP')) return 'sw';
  if(c.includes('TRANSFER')) return 'tr';
  if(c.includes('BACKUP')) return 'bk';
  if(c.includes('SS')) return 'ss';
  if(c.includes('GL')) return 'gl';
  if(c.includes('ROLE')) return 'rl';
  return '';
}

function _renderActLog(){
  const el=document.getElementById('actlog-list'); if(!el) return;
  if(!_actLog.length){ el.innerHTML='<div style="padding:20px;color:var(--txt3);font-size:12px;text-align:center">No activity yet this session.</div>'; return; }
  el.innerHTML=_actLog.map(e=>{
    const t=new Date(e.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const cls=e._evt?_evtCls(e.name):_actCls(e.action);
    return `<div class="alog-row"><span class="alog-t">${t}</span><span><span class="alog-nm">${e.name}</span> <span class="alog-ac ${cls}">→ ${e.action}</span>${e.by?` <span class="alog-by">· ${String(e.by).replace(/[<>&]/g,'')}</span>`:''}</span></div>`;
  }).join('');
}

async function loadActLogFromFb(){
  if(!fbReady) return;
  const key=S._fbKey||fbKey(); if(!key) return;
  _actLog.length=0; // clear previous date's entries before loading new date
  _renderActLog();
  try{
    const snap=await fbDb.ref(`activityLog/${key}`).limitToLast(80).get();
    if(snap.exists()){
      const entries=Object.values(snap.val()).sort((a,b)=>b.ts-a.ts);
      entries.forEach(e=>{ _actLog.push(e); });
      _actLog.sort((a,b)=>b.ts-a.ts);
      _renderActLog();
    }
  }catch(e){ console.warn('actlog:',e); }
}

function toggleActLog(){
  _actLogOpen=!_actLogOpen;
  document.getElementById('actlog-panel').classList.toggle('open',_actLogOpen);
  if(_actLogOpen) _renderActLog();
}

// ═══════════════════════════════════════════════════════
// MULTI-USER PRESENCE
// ═══════════════════════════════════════════════════════
const _presId=Math.random().toString(36).slice(2,10);
let _presRef=null, _presKey=null, _presListener=null;

function setupPresence(){
  if(!fbReady) return;
  const key=fbKey(); if(!key||key===_presKey) return;
  _presKey=key;
  // Remove old ref
  if(_presRef){ _presRef.onDisconnect().cancel(); _presRef.remove().catch(()=>{}); }
  if(_presListener){ fbDb.ref(`presence/${_presKey}`).off('value',_presListener); }
  _presRef=fbDb.ref(`presence/${key}/${_presId}`);
  _presRef.onDisconnect().remove();
  _presRef.set({at:firebase.database.ServerValue.TIMESTAMP,name:(typeof _user!=='undefined'&&_user&&_user.name)||'?',mode:(typeof _user!=='undefined'&&_user&&_user.mode)||'edit'}).catch(()=>{});
  // Listen to count
  _presListener=fbDb.ref(`presence/${key}`).on('value',snap=>{
    const v=snap.exists()?snap.val():{};
    const list=Object.keys(v).map(id=>({id,name:(v[id]&&v[id].name)||'?',mode:v[id]&&v[id].mode}));
    const count=Math.max(list.length,1);
    // names sorted alphabetically; same person on 2 devices shown once
    const label=l=>l.name+(l.mode==='view'?' (view)':'');
    const uniq=[...new Set(list.map(label))].sort();
    const chip=document.getElementById('presence-chip');
    if(chip){
      chip.style.display='inline-block';
      const shown=uniq.slice(0,3).join(', ')+(uniq.length>3?` +${uniq.length-3}`:'');
      chip.textContent=count===1?'👁 Only you':`👁 ${shown}`;
      chip.classList.toggle('multi',count>1);
      chip.title=count===1?'Only you are viewing':`Online now (${count}): ${uniq.join(', ')}`;
    }
  });
}

window.addEventListener('beforeunload',()=>{ if(_presRef) _presRef.remove().catch(()=>{}); });


