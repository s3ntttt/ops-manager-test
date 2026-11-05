// Briefing text + paste-allocation modal (parse pasted allocation text, match names, apply swaps/transfers).
// Split out of 06-actions-modals.js.

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
