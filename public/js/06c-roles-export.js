// Roles modal + export / print / copy.
// Split out of 06-actions-modals.js.

// ═══════════════════════════════════
// ROLES MODAL
// ═══════════════════════════════════
function openRolesModal(){ _rolesSnapshot=JSON.parse(JSON.stringify(S.roles||{})); renderRolesModal(); document.getElementById('roles-ov').classList.add('show'); }
function closeRolesModal(){
  document.getElementById('roles-ov').classList.remove('show');
  // Build detailed change log by diffing current S.roles vs snapshot
  const snap = _rolesSnapshot || {};
  const r = S.roles || {};
  const changes = [];
  // CHASER
  const prev_chaser = (snap.mocChaser||'NIL'), cur_chaser = (r.mocChaser||'NIL');
  if(prev_chaser !== cur_chaser) changes.push('CHASER: '+cur_chaser+(prev_chaser==='NIL'?'':' (was '+prev_chaser+')'));
  // MOJO
  const mojoLabels = ['MOJO','ASST MOJO','MOJO3'];
  (r.mojo||[]).forEach((v,i)=>{
    const pv = ((snap.mojo||[])[i]||'NIL'), cv = (v||'NIL');
    if(pv !== cv) changes.push(mojoLabels[i]+': '+cv+(pv==='NIL'?'':' (was '+pv+')'));
  });
  // WC Teams
  ['WC1','WC2'].forEach((lbl,i)=>{
    const pw = (snap.wc||[])[i]||{}, cw = (r.wc||[])[i]||{};
    const pp = (pw.primary||'NIL'), cp = (cw.primary||'NIL');
    if(pp !== cp) changes.push(lbl+' PRIMARY: '+cp+(pp==='NIL'?'':' (was '+pp+')'));
    const pa = (pw.asst||'NIL'), ca = (cw.asst||'NIL');
    if(pa !== ca) changes.push(lbl+' ASST: '+ca+(pa==='NIL'?'':' (was '+pa+')'));
  });
  // Runners
  (r.runners||[]).forEach((rn,i)=>{
    const pn = ((snap.runners||[])[i]||{}).name||'NIL', cn = (rn.name||'NIL');
    if(pn !== cn) changes.push('RNR'+(i+1)+': '+cn+(pn==='NIL'?'':' (was '+pn+')'));
  });
  // Tower slots
  const tLbls = ['TWR1','TWR2','TWR3','TWR4'];
  (r.towerSlots||[]).forEach((ts,i)=>{
    const pt = (snap.towerSlots||[])[i]||{};
    const pa2 = (pt.a||'NIL'), ca2 = (ts.a||'NIL');
    if(pa2 !== ca2) changes.push(tLbls[i]+' A: '+ca2+(pa2==='NIL'?'':' (was '+pa2+')'));
    const pb = (pt.b||'NIL'), cb = (ts.b||'NIL');
    if(pb !== cb) changes.push(tLbls[i]+' B: '+cb+(pb==='NIL'?'':' (was '+pb+')'));
    const pbk = (pt.backup||'NIL'), cbk = (ts.backup||'NIL');
    if(pbk !== cbk) changes.push(tLbls[i]+' BACKUP: '+cbk+(pbk==='NIL'?'':' (was '+pbk+')'));
  });
  if(changes.length > 0){
    logEvent('ROLES', changes.join(' | '));
  } else {
    logEvent('ROLES','No changes');
  }
  _rolesSnapshot = null;
  // Log ADP violations when roles are saved
  const adpW=adpWarningsForRoles();
  adpW.forEach(w=>{
    if(w.status==='expired') logEvent('ADP','⛔ '+w.name+' ADP EXPIRED ('+Math.abs(w.days)+'d ago) — assigned '+w.role);
    else if(w.status==='soon') logEvent('ADP','⚠ '+w.name+' ADP expiring in '+w.days+'d — assigned '+w.role);
  });
  // Log WC auth violations
  wcAuthWarningsForRoles().forEach(w=>logEvent('WC-AUTH','⛔ '+w.name+' NOT AUTHORIZED as WC Primary — assigned '+w.role));
  renderSummary(); scheduleSave();
}

function renderRolesModal(){
  const el=document.getElementById('roles-body');
  const r=S.roles;

  // Build pools fresh from S.staff (not relying on renderSummary locals)
  // Include WORKING + BACKUP_SHIFT staff — STBY is treated as OFF (not counted)
  const isOnShift = s => { const a=effAvail(s); if(a.st==='WORKING'||a.st==='BACKUP_SHIFT') return true; if(S.overrides[s.id]) return false; const raw=(s.schedVal||'').toUpperCase().trim(); const _sh=document.getElementById('shift-sel').value.toUpperCase(); return raw.startsWith(_sh); };
  const irTechAll = S.staff.filter(s=>effectiveDept(s)==='IRR'&&s.category==='TECH'&&isOnShift(s));
  const irPool=[
    ...irTechAll.map(s=>displayName(s)),
    ...irr_bk_pool(),
    ...[...S.trainees.permanent,...S.trainees.backups].filter(t=>t.name&&t.status==='AVAIL').map(t=>t.name+' (TR)')
  ];
  function irr_bk_pool(){ try{ return (S.backups.irreg||[]).filter(b=>normCat(b.pos)==='TECH').map(b=>b.name+' (BK)'); }catch(e){ return []; } }

  const twPool=[...S.towers.permanent,...S.towers.backups].filter(t=>t.name&&t.status==='AVAIL').map(t=>t.name);
  const trPool=[...S.trainees.permanent,...S.trainees.backups].filter(t=>t.name&&t.status==='AVAIL').map(t=>t.name+' (TR)');

  const assigned2 = getAssignedNames();
  const makePool = (pool, curVal) => pool.filter(n => !assigned2.has(n) || n === curVal);

  const sel=(val,pool,onch)=>{
    const opts = makePool(pool, val);
    return `<select onchange="${onch}" style="background:var(--bg);border:1px solid var(--b);border-radius:4px;color:var(--txt);padding:4px 6px;font-family:var(--mono);font-size:11px;width:100%;outline:none"><option value="">NIL</option>${opts.map(n=>`<option value="${n}"${val===n?' selected':''}>${n}</option>`).join('')}</select>`;
  };
  const fld=(lbl,inp)=>`<div><div style="font-size:8px;color:var(--txt3);margin-bottom:3px">${lbl}</div>${inp}</div>`;
  const sh=(t,c='var(--amber)')=>`<div style="font-size:9px;font-weight:700;letter-spacing:2px;color:${c};margin:14px 0 8px;padding-top:10px;border-top:1px solid var(--b)">${t}</div>`;

  el.innerHTML=`
    ${sh('LEADERSHIP')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">
      ${fld('CHASER', sel(r.mocChaser,irPool,'S.roles.mocChaser=this.value;scheduleSave()'))}
      <div></div>
    </div>
    ${sh('MOJO')}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:6px">
      ${r.mojo.map((v,i)=>fld(i===0?'MOJO':i===1?'ASST MOJO':' ',sel(v,irPool,`S.roles.mojo[${i}]=this.value;renderRolesModal();scheduleSave()`)+adpBadge(v))).join('')}
    </div>
    ${sh('WC / GSE')}
    ${r.wc.map((wc,i)=>`<div style="margin-bottom:8px">
      <div style="font-size:8px;color:var(--txt3);margin-bottom:4px">PAIR ${i+1}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${fld('WC',sel(wc.primary,irPool,`S.roles.wc[${i}].primary=this.value;renderRolesModal();scheduleSave()`)+adpBadge(wc.primary)+wcAuthBadge(wc.primary))}
        ${fld('ASST / TRAINEE',sel(wc.asst,[...irPool,...trPool],`S.roles.wc[${i}].asst=this.value;scheduleSave()`))}
      </div>
    </div>`).join('')}
    ${sh('RUNNERS','#C084FC')}
    ${r.runners.map((rn,i)=>`<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-bottom:6px">
      ${sel(rn.name,twPool,`S.roles.runners[${i}].name=this.value;scheduleSave()`)}
      <span style="font-size:9px;color:var(--txt2);white-space:nowrap">${rn.timing}</span>
    </div>`).join('')}
    ${sh('TOWER POSITIONS','#C084FC')}
    ${r.towerSlots.map((ts,i)=>`<div style="margin-bottom:10px">
      <div style="font-size:8px;color:var(--txt3);margin-bottom:4px">TOWER ${i+1}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
        ${fld('PERSON A',sel(ts.a,twPool,`S.roles.towerSlots[${i}].a=this.value;scheduleSave()`))}
        ${fld('PERSON B',sel(ts.b,twPool,`S.roles.towerSlots[${i}].b=this.value;scheduleSave()`))}
        ${fld('BACKUP / ASST',sel(ts.backup,[...irPool,...trPool],`S.roles.towerSlots[${i}].backup=this.value;scheduleSave()`))}
      </div>
    </div>`).join('')}
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--b)">
      <button class="btn btn-amber" style="width:100%" onclick="closeRolesModal()">DONE</button>
    </div>`;
}

// ═══════════════════════════════════
// EXPORT / PRINT
// ═══════════════════════════════════
function printSummary(){
  switchTab('summary');
  setTimeout(()=>window.print(), 200);
}

function buildTxt(){
  const ds=fmtDate(document.getElementById('dp').value);
  const sh=document.getElementById('shift-sel').value;
  const sg=document.getElementById('shift-group-sel').value;
  let t=`SHIFT C · OPS SUMMARY\n${ds} · SHIFT ${sg} ${sh}\n${'═'.repeat(40)}\n\n`;
  t+=`OPS: ARR ${S.ops.ARR||'—'} | DEP ${S.ops.DEP||'—'} | TOW ${S.ops.TOW||'—'}\n\n`;
  if(S.pdsc.some(p=>p.reg||p.certifier)){
    t+=`PDSC\n${'─'.repeat(30)}\n`;
    S.pdsc.forEach((p,i)=>t+=`${i+1}. ${(p.reg||'—').padEnd(10)} ${p.certifier||'—'}${p.acType?' ('+p.acType+')':''}\n`);
    t+='\n';
  }
  if(S.fgs.some(f=>f.reg)){
    t+=`FGS\n${'─'.repeat(30)}\n`;
    S.fgs.forEach((f,i)=>t+=`${i+1}. ${f.reg||'—'}\n`);
    t+='\n';
  }
  [['LO','lo','LINE OPS'],['IRR','irreg','IRREGULARITIES'],['WO','wo','WORK ORDER'],['CIM','cim','CABIN (CIM)']].forEach(([tm,dk,lb])=>{
    const own=S.staff.filter(s=>s.team===tm);
    const av=own.filter(s=>isActive(effAvail(s)));
    t+=`${lb} — ${av.length}/${own.length} AVAIL\n`;
    av.forEach(s=>t+=`  · ${displayName(s).padEnd(14)} ${s.desigCode}\n`);
    if(S.backups[dk].length){ t+=`  BACKUP:\n`; S.backups[dk].forEach(b=>t+=`  · ${b.name.padEnd(14)} ${b.pos}${b.time?(isBkRange(b.time)?' ('+b.time+')':' (RPT '+b.time+')'):''}\n`); }
    t+='\n';
  });
  t+=`IRREG ROLES\n${'─'.repeat(30)}\n`;
  const r=S.roles;
  t+=`CHASER        : ${r.mocChaser||'NIL'}\n`;
  t+=`MOJO         : ${r.mojo[0]||'NIL'}\n`;
  t+=`ASST MOJO    : ${r.mojo[1]||'NIL'}\n`;
  r.wc.forEach((wc,i)=>t+=`WC ${i+1}         : ${wc.primary||'NIL'} / ${wc.asst||'—'}\n`);
  t+=`\nRUNNERS\n${'─'.repeat(30)}\n`;
  r.runners.forEach(rn=>t+=`${(rn.name||'NIL').padEnd(14)} ${rn.timing}\n`);
  t+=`\nTOWER\n${'─'.repeat(30)}\n`;
  r.towerSlots.forEach((ts,i)=>t+=`${i+1}. ${ts.a&&ts.b?ts.a+' / '+ts.b:ts.a||ts.b||'NIL'} | ${ts.backup||'—'}\n`);
  if(S.soc.length){ t+=`\nSOC FLIGHTS\n${'─'.repeat(30)}\n`; S.soc.forEach(r=>t+=`${(r.flight||'—').padEnd(8)} ${(r.name||'—').padEnd(14)} ${(r.time||'—').padEnd(12)} ${r.remark||''}\n`); }
  return t;
}

function exportTxt(){
  const t=buildTxt();
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([t],{type:'text/plain'}));
  a.download=`OPS_SHIFTC_${fmtDate(document.getElementById('dp').value).replace(/ /g,'_')}.txt`;
  a.click();
}

function copyClip(){
  navigator.clipboard.writeText(buildTxt()).then(()=>{
    setSt('Copied to clipboard ✓');
    showToast('Copied to clipboard','ok',1800);
    setTimeout(()=>setSt(''),2000);
  });
}
