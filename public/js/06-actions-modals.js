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
function rmSoc(i){ S.soc.splice(i,1); renderSummary(); scheduleSave(); }

function addPdsc(){ S.pdsc.push({reg:'',certifier:''}); renderSummary(); scheduleSave(); }
function rmPdsc(i){ S.pdsc.splice(i,1); renderSummary(); scheduleSave(); }
function addFgs() { S.fgs.push({reg:'',remark:''}); renderSummary(); scheduleSave(); }
function rmFgs(i) { S.fgs.splice(i,1); renderSummary(); scheduleSave(); }

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

function generateBriefingText(){
  const r=S.roles;
  const dateStr=fmtDate(document.getElementById('dp').value);
  const shift=document.getElementById('shift-sel').value;
  const isDay=shift==='DAY';

  // Format date as DD MMM YYYY uppercase
  const d=new Date(document.getElementById('dp').value+'T12:00:00');
  const M=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const dateFmt=`${String(d.getDate()).padStart(2,'0')} ${M[d.getMonth()]} ${d.getFullYear()}`;
  const shiftLabel=isDay?'DAY OPS':'NIGHT OPS';
  const timing=isDay?'0700-1900':'1900-0700';
  const ssTiming=isDay?'0600-1800':'1800-0600';

  // GL names
  const glN=team=>{
    const key={LO:'lo',IRR:'irreg',WO:'wo',CIM:'cim'}[team]||'lo';
    if(S.actingGL&&S.actingGL[key]) return S.actingGL[key];
    const dk=key;
    const gl=S.staff.filter(s=>effectiveDept(s)===team&&s.category==='GL');
    const bkGL=(S.backups[dk]||[]).filter(b=>normCat(b.pos)==='GL');
    return [...gl.map(s=>displayName(s)),...bkGL.map(b=>b.name)].join(' / ')||'TBA';
  };

  // MOC
  const mocNames=S.staff.filter(s=>isMocStaff(s)&&isActive(effAvail(s))).map(s=>displayName(s)).join(' / ')||'—';

  // Certifiers — all on-shift
  const isOnShift=s=>{const a=effAvail(s);if(a.st==='WORKING'||a.st==='BACKUP_SHIFT')return true;if(S.overrides[s.id])return false;const raw=(s.schedVal||'').toUpperCase().trim();return raw.startsWith(shift.toUpperCase());};
  const xsBk=S.staff.filter(s=>s.isBackup&&isActive(effAvail(s)));
  const byCat=(team,cat)=>{
    const dk={LO:'lo',IRR:'irreg',WO:'wo',CIM:'cim'}[team]||'lo';
    const own=S.staff.filter(s=>!s.isBackup&&effectiveDept(s)===team&&s.category===cat&&isOnShift(s));
    const xs=xsBk.filter(s=>effectiveDept(s)===team&&s.category===cat);
    const mb=(S.backups[dk]||[]).filter(b=>normCat(b.pos)===cat&&!b.mcEl).map(b=>({_manual:true,shortName:b.name,id:'mb_'+b.name}));
    return [...own,...xs,...mb];
  };
  const dn=s=>s._manual?s.shortName:displayName(s);
  // Acting GL names — exclude from certifier lists and headcount
  const actingGLNames=new Set(Object.values(S.actingGL||{}).filter(n=>n).map(n=>n.toUpperCase()));
  const notActingGL=s=>!actingGLNames.has((dn(s)||'').toUpperCase());
  const teams=['LO','IRR','WO','CIM'];
  const b1=teams.flatMap(t=>byCat(t,'LAE B1')).filter(notActingGL);
  const b2=teams.flatMap(t=>byCat(t,'LAE B2')).filter(notActingGL);
  const lat=teams.flatMap(t=>byCat(t,'LAT')).filter(notActingGL);

  // SS detection — runner timing starts with 06 or 12
  const isSS=t=>t&&(t.trim().startsWith('06')||t.trim().startsWith('12'));

  // Build SS person set from runners
  const ssPersons=new Set(r.runners.filter(rn=>rn.name&&isSS(rn.timing)).map(rn=>rn.name));

  // Trainee names set
  const traineeNames=new Set([...(S.trainees?.permanent||[]),...(S.trainees?.backups||[])].map(t=>(t.name||'').toUpperCase()));

  // Helper: strip (TR) suffix, add TRAINEE prefix if needed
  const cleanRoleName=name=>{
    if(!name) return '';
    // Strip existing (TR) suffix
    const stripped=name.replace(/\s*\(TR\)\s*$/i,'').trim();
    // If already has TRAINEE prefix, return as-is
    if(stripped.toUpperCase().startsWith('TRAINEE ')) return stripped;
    // If in trainees list OR had (TR) suffix → add TRAINEE prefix
    if(name.match(/\(TR\)/i)||traineeNames.has(stripped.toUpperCase())) return 'TRAINEE '+stripped;
    return stripped;
  };

  // Helper: format name with (1/2 DAY/NIGHT), timing override, and * for flying duty
  const curShiftLbl=(document.getElementById('shift-sel')?.value||'SHIFT');
  const dnHalf=s=>{
    if(s._manual) return s.shortName;
    const base=dn(s);
    const raw=(s.schedVal||'').toUpperCase();
    // Half-shift: show shift label e.g. (1/2 DAY)
    const halfSuffix=effAvail(s).half?` (1/2 ${curShiftLbl})`:'';
    // Flying duty: F1-F9 in schedVal → append *
    const isFly=/\(F\d\)/.test(raw);
    const flySuffix=isFly?'*':'';
    // Timing override: (0700-1700) or (0700) in schedVal, not a fly code
    let timeSuffix='';
    if(!isFly){
      const tm=raw.match(/\((\d{4})(?:-(\d{4}))?\)/);
      if(tm) timeSuffix=` (${tm[1]}${tm[2]?'-'+tm[2]:''})`;
    }
    return base+flySuffix+halfSuffix+timeSuffix;
  };

  // MOJO
  const mojoLine=r.mojo.filter(Boolean).map(cleanRoleName).join(' / ');

  // WC — first pair is always SS
  const wcLines=r.wc.filter(wc=>wc.primary).map((wc,i)=>{
    const asst=wc.asst?`+ ${cleanRoleName(wc.asst)}`:'';
    const ss=i===0||wc.ss||ssPersons.has(wc.primary);
    return `${cleanRoleName(wc.primary)} ${asst}${ss?' - SS':''}`.trim();
  });

  // Tower — first slot is always SS
  const towerLines=r.towerSlots.filter(t=>t.a).map((t,i)=>{
    let line=cleanRoleName(t.a);
    if(t.b) line+=` / ${cleanRoleName(t.b)}`;
    if(t.backup) line+=` + ${cleanRoleName(t.backup)}`;
    // Towers no longer get '- SS' label (Aug 2026)
    return line;
  });

  // Runners
  const runnerLines=r.runners.filter(rn=>rn.name).map(rn=>{
    const t=(rn.timing||'').split('/')[0].trim().replace(/[^\d-]/g,'');
    return `${cleanRoleName(rn.name)} ${t}`;
  });

  let txt='';
  txt+=`*SALAM AND GOOD ${isDay?'MORNING':'EVENING'}*\n`;
  txt+=`*${dateFmt} (${shiftLabel})*\n`;
  txt+=`*${timing}*\n`;
  txt+=`*SLIP SHIFT - SS (${ssTiming})*\n\n`;
  txt+=`*DUTY ENGINEER* : ${mocNames}\n`;
  txt+=`*GL LO* : ${glN('LO')}\n`;
  txt+=`*GL IRREG* : ${glN('IRR')}\n`;
  txt+=`*GL WO* : ${glN('WO')}\n`;
  txt+=`*GL CIM* : ${glN('CIM')}\n\n`;
  if(b1.length){ txt+=`*LAE B1*\n${b1.map(s=>dnHalf(s)).join(' / ')}\n\n`; }
  if(b2.length){ txt+=`*LAE B2*\n${b2.map(s=>dnHalf(s)).join(' / ')}\n\n`; }
  if(lat.length){ txt+=`*LAT*\n${lat.map(s=>dnHalf(s)).join(' / ')}\n\n`; }
  if(mojoLine){ txt+=`*MOJO*\n${mojoLine}\n\n`; }
  if(runnerLines.length){ txt+=`*RUNNER*\n${runnerLines.join('\n')}\n\n`; }
  if(wcLines.length){ txt+=`*WHEELCREW*\n${wcLines.join('\n')}\n\n`; }
  if(towerLines.length){ txt+=`*TOWER*\n${towerLines.join('\n')}\n\n`; }
  if(r.mocChaser){ txt+=`*CHASER*\n${r.mocChaser}\n`; }

  return txt.trim();
}

function openBriefingModal(){
  const txt=generateBriefingText();
  document.getElementById('briefing-out').value=txt;
  document.getElementById('briefing-ov').classList.add('show');
}
function closeBriefingModal(){ document.getElementById('briefing-ov').classList.remove('show'); }
function copyBriefingText(){
  const ta=document.getElementById('briefing-out');
  ta.select(); document.execCommand('copy');
  const btn=document.getElementById('briefing-copy-btn');
  btn.textContent='✓ COPIED!'; setTimeout(()=>btn.textContent='📋 COPY',2000);
}
function openAllocModal(){
  document.getElementById('alloc-input').value='';
  document.getElementById('alloc-preview').innerHTML='';
  document.getElementById('alloc-ov').classList.add('show');
}
function closeAllocModal(){ document.getElementById('alloc-ov').classList.remove('show'); }

// Match a name from allocation text to a staff member OR tower/trainee entry
function matchStaff(name){
  if(!name) return null;
  const n=name.trim().toUpperCase().replace(/^TRAINEE\s+/,'');
  if(!n) return null;

  // Staff with a custom nickname can ONLY be found by their nickname.
  // This prevents "AMIR" from matching "AMIR SYAMIM" when AMIRRUDDIN has nickname "AMIR".
  const hasNick = s => !!S.nicknames[s.id];
  const noNick  = s => !S.nicknames[s.id];

  // 1. Exact nickname match — staff with nicknames stop here (highest priority)
  let found = S.staff.find(s=>hasNick(s)&&S.nicknames[s.id].toUpperCase()===n);
  if(found) return found;

  // All steps below only search staff WITHOUT a custom nickname set
  // 2. Exact shortName
  if(!found) found=S.staff.find(s=>noNick(s)&&s.shortName.toUpperCase()===n);
  // 3. Exact fullName
  if(!found) found=S.staff.find(s=>noNick(s)&&(s.fullName||'').toUpperCase()===n);
  // 4. Unambiguous prefix on shortName (min 3 chars)
  if(!found){const m=S.staff.filter(s=>noNick(s)&&s.shortName.toUpperCase().length>=3&&(s.shortName.toUpperCase().startsWith(n)||n.startsWith(s.shortName.toUpperCase())));if(m.length===1)found=m[0];}
  // 5. Unambiguous prefix on fullName (min 3 chars)
  if(!found){const m=S.staff.filter(s=>noNick(s)&&(s.fullName||'').toUpperCase().length>=3&&((s.fullName||'').toUpperCase().startsWith(n)||n.startsWith((s.fullName||'').toUpperCase())));if(m.length===1)found=m[0];}
  // 6. Unambiguous word-within-fullName — catches "SYAMIM" matching "AMIR SYAMIM"
  if(!found&&n.length>=3){const m=S.staff.filter(s=>noNick(s)&&(s.fullName||'').toUpperCase().split(/\s+/).includes(n));if(m.length===1)found=m[0];}
  if(found) return found;

  // 5. Search towers — exact then startsWith
  const allTowers=[...(S.towers?.permanent||[]),...(S.towers?.backups||[])];
  let tw=allTowers.find(t=>t?.name&&t.name.toUpperCase()===n);
  if(!tw) tw=allTowers.find(t=>t?.name&&(t.name.toUpperCase().startsWith(n)||n.startsWith(t.name.toUpperCase())));
  if(tw) return {_isTower:true, shortName:tw.name, displayName_:tw.name, id:'_tw_'+tw.name};

  // 6. Search trainees — exact then startsWith
  const allTrainees=[...(S.trainees?.permanent||[]),...(S.trainees?.backups||[])];
  let tr=allTrainees.find(t=>t?.name&&t.name.toUpperCase()===n);
  if(!tr) tr=allTrainees.find(t=>t?.name&&(t.name.toUpperCase().startsWith(n)||n.startsWith(t.name.toUpperCase())));
  if(tr) return {_isTrainee:true, shortName:tr.name, displayName_:tr.name, id:'_tr_'+tr.name};

  return null;
}

// Safe displayName for any matched object
function resolveDisplayName(s){
  if(!s) return '';
  if(s._isTower||s._isTrainee) return s.displayName_||s.shortName;
  return displayName(s);
}

function stripTrainee(name){ return name.trim().replace(/^TRAINEE\s+/i,'').trim(); }
function isTrainee(name){ return /^TRAINEE\s+/i.test(name.trim()); }

function parseAllocText(){
  const raw=document.getElementById('alloc-input').value;
  const lines=raw.split(/\r?\n/).map(l=>l.trim());

  const parsed={
    mocChaser:[], mojo:[], wc:[], runners:[], towerSlots:[],
    traineeNames: new Set() // names that had TRAINEE prefix
  };

  const SECTIONS={
    'MOC CHASER':'mocChaser','DUTY ENGINEER':'mocChaser','CHASER':'mocChaser','MOJO':'mojo','ASST MOJO':'mojo',
    'WHEELCREW':'wc','WHEEL CREW':'wc',
    'RUNNER':'runners','RUNNERS':'runners',
    'TOWING TEAM':'towerSlots','TOWING':'towerSlots','TOWER':'towerSlots'
  };

  const trackTrainee=(raw)=>{
    const stripped=stripTrainee(raw);
    if(isTrainee(raw)) parsed.traineeNames.add(stripped.toUpperCase());
    return stripped;
  };

  let curSection=null;
  for(const line of lines){
    if(!line){ curSection=null; continue; }
    const secKey=Object.keys(SECTIONS).find(k=>line.toUpperCase()===k||line.toUpperCase().startsWith(k));
    if(secKey){ curSection=SECTIONS[secKey]; continue; }
    if(!curSection) continue;

    if(curSection==='mocChaser'){
      parsed.mocChaser.push(trackTrainee(line));
    }
    else if(curSection==='mojo'){
      parsed.mojo.push(trackTrainee(line));
    }
    else if(curSection==='wc'){
      const ssFlag=/[-–]\s*SS\s*$/i.test(line);
      const cleaned=line.replace(/[-–]\s*SS\s*$/i,'').trim();
      const parts=cleaned.split(/\s*\+\s*/);
      parsed.wc.push({ primary:trackTrainee(parts[0]||''), asst:trackTrainee(parts[1]||''), ss:ssFlag });
    }
    else if(curSection==='runners'){
      const m=line.match(/^(.+?)\s+(\d{3,4}-\d{3,4})\s*$/);
      if(m) parsed.runners.push({ name:trackTrainee(m[1]), timing:m[2] });
      else parsed.runners.push({ name:trackTrainee(line), timing:'' });
    }
    else if(curSection==='towerSlots'){
      const ssFlag=/[-–]\s*SS\s*$/i.test(line);
      const cleaned=line.replace(/^\d+\.\s*[\u2060\u200B\u00A0]*/,'').replace(/[-–]\s*SS\s*$/i,'').trim();
      let a='',b='',backup='';
      if(cleaned.includes('/')){
        const [left,right]=cleaned.split('/').map(s=>s.trim());
        a=trackTrainee(left);
        const rparts=right.split(/\s*\+\s*/);
        b=trackTrainee(rparts[0]||'');
        backup=trackTrainee(rparts[1]||'');
      } else if(cleaned.includes('+')){
        const parts=cleaned.split(/\s*\+\s*/);
        a=trackTrainee(parts[0]||'');
        // No / means: a + backup (assistant), not a + b
        backup=trackTrainee(parts[1]||'');
        b='';
      } else {
        a=trackTrainee(cleaned);
      }
      if(a||b) parsed.towerSlots.push({a,b,backup,ss:ssFlag});
    }
  }

  renderAllocPreview(parsed);
}

var _allocStore={};
var _swapInProgress=false;

function renderAllocPreview(parsed){
  const el=document.getElementById('alloc-preview');
  _allocStore={_parsed:parsed};

  const checkName=(name,skipIrreg=false)=>{
    if(!name) return {name:'',found:null,ok:true,dept:''};
    // If name was originally prefixed with TRAINEE → always ok
    if(parsed.traineeNames&&parsed.traineeNames.has(name.toUpperCase()))
      return {name,found:{_isTrainee:true},ok:true,dept:'TRAINEE',dn:name};
    const s=matchStaff(name);
    if(!s) return {name,found:null,ok:false,dept:'NOT FOUND'};
    if(s._isTower) return {name,found:s,ok:true,dept:'TOWER',dn:resolveDisplayName(s)};
    if(s._isTrainee) return {name,found:s,ok:true,dept:'TRAINEE',dn:resolveDisplayName(s)};
    const dept=effectiveDept(s);
    return {name,found:s,ok:dept==='IRR',dept,dn:resolveDisplayName(s)};
  };

  const chip=r=>{
    if(!r.name) return `<span style="color:var(--txt3);font-size:10px">—</span>`;
    const col=r.found?(r.ok?'var(--green)':'var(--orange)'):'var(--red)';
    const warn=r.found&&!r.ok&&r.dept!=='NOT FOUND'?` ⚠ ${r.dept}`:'';
    const nf=!r.found?' ✗ NOT FOUND':'';
    return `<span style="display:inline-block;background:${col}22;border:1px solid ${col};border-radius:4px;padding:2px 7px;font-size:10px;color:${col};margin:2px">${r.dn||r.name}${warn}${nf}</span>`;
  };

  const row=(lbl,cnt)=>`<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid var(--b)">
    <div style="min-width:100px;font-size:9px;color:var(--txt3);font-weight:700;letter-spacing:1px;padding-top:4px">${lbl}</div>
    <div style="flex:1">${cnt}</div></div>`;

  let html=`<div style="background:var(--surf2);border:1px solid var(--b);border-radius:8px;padding:12px;margin-bottom:12px">
    <div style="font-size:10px;font-weight:700;color:var(--amber);letter-spacing:1px;margin-bottom:6px">PREVIEW</div>
    <div style="font-size:9px;margin-bottom:8px"><span style="color:var(--green)">■</span> IRREG &nbsp;<span style="color:var(--orange)">■</span> Needs swap/transfer &nbsp;<span style="color:var(--red)">■</span> Not found</div>`;

  if(parsed.mocChaser.length) html+=row('CHASER',parsed.mocChaser.map(n=>chip(checkName(n))).join(''));
  if(parsed.mojo.length) html+=row('MOJO',parsed.mojo.map(n=>chip(checkName(n))).join(''));
  parsed.wc.forEach((wc,i)=>html+=row(`WC ${i+1}`,chip(checkName(wc.primary))+`<span style="color:var(--txt3);font-size:10px"> + </span>`+chip(checkName(wc.asst))));
  parsed.runners.forEach((r,i)=>html+=row(`RUNNER ${i+1}`,chip(checkName(r.name))+`<span style="color:var(--txt3);font-size:10px;margin-left:4px">${r.timing}</span>`));
  parsed.towerSlots.forEach((t,i)=>{
    const p=[chip(checkName(t.a,true))];
    if(t.b) p.push(`<span style="color:var(--txt3);font-size:10px"> / </span>`+chip(checkName(t.b,true)));
    if(t.backup) p.push(`<span style="color:var(--txt3);font-size:10px"> + </span>`+chip(checkName(t.backup,true)));
    html+=row(`TOWER ${i+1}`,p.join(''));
  });
  html+=`</div>`;

  // Check ALL names for warnings — including tower slot regular staff
  const irregNames=[...parsed.mocChaser,...parsed.mojo,
    ...parsed.wc.flatMap(w=>[w.primary,w.asst]),...parsed.runners.map(r=>r.name)].filter(Boolean);
  const towerNames=parsed.towerSlots.flatMap(t=>[t.a,t.b,t.backup]).filter(Boolean);
  const allNames=[...irregNames,...towerNames];
  const warnings=[...irregNames,...towerNames].filter(n=>{const r=checkName(n);return r.found&&!r.ok;});
  const notFound=allNames.filter(n=>!matchStaff(n));

  if(warnings.length){
    const isOnShiftFn=s=>{const a=effAvail(s);if(a.st==='WORKING'||a.st==='BACKUP_SHIFT')return true;if(S.overrides[s.id])return false;const raw=(s.schedVal||'').toUpperCase().trim();const _sh=document.getElementById('shift-sel').value.toUpperCase();return raw.startsWith(_sh);};
    const allocSet=new Set(allNames.map(n=>{const s=matchStaff(n);return s?resolveDisplayName(s):n;}));
    const irrPool=S.staff.filter(s=>effectiveDept(s)==='IRR'&&s.category==='TECH'&&isOnShiftFn(s)&&!allocSet.has(displayName(s)));

    html+=`<div style="background:#FFF7ED;border:1px solid var(--orange);border-radius:6px;padding:10px 12px;margin-bottom:10px">
      <b style="color:var(--orange);font-size:10px">⚠ ${warnings.length} STAFF NEED SWAP / TRANSFER TO IRREG</b>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">`;

    warnings.forEach((n,wi)=>{
      const s=matchStaff(n); if(!s) return;
      const dn=resolveDisplayName(s), dept=effectiveDept(s);
      // Store swap candidates in _allocStore for safe access — store IDs to avoid name-clash
      _allocStore[`w${wi}`]={dn,dept,allocId:s.id};
      irrPool.forEach((irS,si)=>{ _allocStore[`w${wi}_s${si}`]={allocName:dn,allocDept:dept,irrName:displayName(irS),allocId:s.id,irrId:irS.id}; });

      html+=`<div style="background:var(--surf);border:1px solid var(--b2);border-radius:6px;padding:8px 10px">
        <div style="font-size:10px;margin-bottom:6px">
          <b style="color:var(--orange)">${dn}</b> <span style="color:var(--txt2)">is in</span>
          <b style="color:var(--blue)">${dept}</b> <span style="color:var(--txt2)">— choose action:</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:9px;color:var(--txt3);font-weight:700">SWAP WITH:</span>
          ${irrPool.map((irS,si)=>{
            const key=`w${wi}_s${si}`;
            _allocStore[key]={allocName:dn,allocDept:dept,irrName:displayName(irS),allocId:s.id,irrId:irS.id};
            return `<button class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 8px" onclick="window._doSwap('${key}')">⇄ ${displayName(irS)}</button>`;
          }).join('')}
          ${!irrPool.length?`<span style="color:var(--txt3);font-size:9px">No IRREG staff available to swap</span>`:''}
          <button class="btn btn-sm" style="font-size:9px;padding:2px 8px;background:var(--bbg);border:1px solid var(--blue);color:var(--blue)" onclick="window._doTransfer('w${wi}')">→ TRANSFER TO IRREG</button>
        </div>
      </div>`;
    });
    html+=`</div></div>`;
  }

  if(notFound.length) html+=`<div style="background:#FEF2F2;border:1px solid var(--red);border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:10px">
    <b style="color:var(--red)">✗ ${notFound.length} name(s) not found:</b> ${notFound.join(', ')}
  </div>`;

  html+=`<div style="display:flex;gap:8px">
    <button class="btn btn-amber" onclick="window._doApplyAllocation()">✓ APPLY ROLES</button>
    <button class="btn btn-ghost" onclick="document.getElementById('alloc-preview').innerHTML=''">CLEAR</button>
  </div>`;
  el.innerHTML=html;
}

function _doSwap(key){
  if(_swapInProgress) return;
  _swapInProgress=true;
  const d=_allocStore[key];
  if(!d){ _swapInProgress=false; return; }
  // Find staff IDs — prefer stored IDs to avoid name-collision when displayNames are shared
  const s1=d.irrId?S.staff.find(s=>s.id===d.irrId):S.staff.find(s=>displayName(s)===d.irrName||s.shortName===d.irrName);
  const s2=d.allocId?S.staff.find(s=>s.id===d.allocId):S.staff.find(s=>displayName(s)===d.allocName||s.shortName===d.allocName);
  if(!s1||!s2){ alert('Could not match staff IDs for: '+d.irrName+' / '+d.allocName); _swapInProgress=false; return; }
  const id1=s1.id, id2=s2.id;
  // Remove existing swaps for either person
  S.swaps=S.swaps.filter(sw=>sw.id1!==id1&&sw.id2!==id1&&sw.id1!==id2&&sw.id2!==id2);
  S.swaps.push({id1, id2});
  logEvent('SWAP', displayName(s1)+' ↔ '+displayName(s2));
  renderAll(); scheduleSave();
  if(document.getElementById('alloc-input').value.trim()) parseAllocText();
  setTimeout(()=>{_swapInProgress=false;},500);
}

function _doTransfer(key){
  if(_swapInProgress) return;
  _swapInProgress=true;
  const d=_allocStore[key];
  if(!d){ _swapInProgress=false; return; }
  const s=d.allocId?S.staff.find(st=>st.id===d.allocId):S.staff.find(st=>displayName(st)===d.dn||st.shortName===d.dn);
  if(!s){ alert('Could not match staff for: '+d.dn); _swapInProgress=false; return; }
  const id=s.id, toDept='IRR';
  S.transfers=S.transfers.filter(t=>t.id!==id);
  S.transfers.push({id, toDept});
  logEvent('TRANSFER', displayName(s)+' → '+toDept);
  renderAll(); scheduleSave();
  if(document.getElementById('alloc-input').value.trim()) parseAllocText();
  setTimeout(()=>{_swapInProgress=false;},500);
}

function _doApplyAllocation(){
  const parsed=_allocStore._parsed; if(!parsed) return;
  const resolve=name=>{ if(!name) return ''; const s=matchStaff(name); return s?resolveDisplayName(s):name; };
  const resolveWithTrainee=name=>{ if(!name) return ''; const isT=parsed.traineeNames&&parsed.traineeNames.has(name.toUpperCase()); const r=resolve(name); return isT?'TRAINEE '+r:r; };
  if(parsed.mocChaser[0]) S.roles.mocChaser=resolve(parsed.mocChaser[0]);
  parsed.mojo.forEach((n,i)=>{ if(i<3) S.roles.mojo[i]=resolve(n); });
  parsed.wc.forEach((wc,i)=>{ if(i<2){ S.roles.wc[i].primary=resolve(wc.primary); S.roles.wc[i].asst=resolveWithTrainee(wc.asst); S.roles.wc[i].ss=!!wc.ss; } });
  parsed.runners.forEach((r,i)=>{ if(i<4){ S.roles.runners[i].name=resolve(r.name); if(r.timing) S.roles.runners[i].timing=r.timing; } });
  parsed.towerSlots.forEach((t,i)=>{ if(i<4){ S.roles.towerSlots[i].a=resolve(t.a); S.roles.towerSlots[i].b=resolve(t.b); S.roles.towerSlots[i].backup=resolveWithTrainee(t.backup); S.roles.towerSlots[i].ss=!!t.ss; } });
  closeAllocModal(); renderAll();
  // Save immediately — scheduleSave() has 500ms delay which loses data if user changes date first
  if(fbReady && S.loaded) fbSave(); else { pendingSave=true; }
}


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

