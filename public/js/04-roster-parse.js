// ═══════════════════════════════════
// FETCH & PARSE
// ═══════════════════════════════════
let _rosterGen=0; // increment on each call; stale calls abort on completion
async function loadRoster(){
  const gen=++_rosterGen; // capture this call's generation
  const dateStr = fmtDate(document.getElementById('dp').value);
  const shift   = document.getElementById('shift-sel').value;
  setSt(`Fetching ${dateStr}...`);
  showLoading();
  try{
    const rows = await fetchSheet();
    if(gen!==_rosterGen) return; // a newer loadRoster started — abort this one
    const group = document.getElementById('shift-group-sel')?.value || 'C';
    const staff = parseRoster(rows, dateStr, shift, group);
    // Force ENG SPECIALIST TEAM members into IRR regardless of how the parser sectioned them
    const engIds = ENG_SPECIALISTS[group.toUpperCase()] || [];
    staff.forEach(s => { if(engIds.includes(s.id)) s.team = 'IRR'; });
    S.staff = staff;
    // Reset shift-specific state before loading saved data
    // Flush any unsaved changes from the PREVIOUS roster before switching date
    if(S.loaded && pendingSave && fbReady){ clearTimeout(saveTimer); fbSave(); }
    clearTimeout(saveTimer); saveTimer=null; pendingSave=false;
    if(_fbLiveRef){ _fbLiveRef.off('value'); _fbLiveRef=null; } // detach live listener before switching date
    S._fbKey = fbKey(); // lock in the key for this roster now (before any async ops change the DOM)
    S.overrides={}; S.swaps=[]; S.transfers=[];
    S.backups={lo:[],irreg:[],wo:[],cim:[],moc:[]};
    S.ssTechs=[]; S.soc=[{flight:'',name:'',time:'',remark:''}];
    S.pdsc=[{reg:'',certifier:''}]; S.fgs=[{reg:'',remark:''}];
    S.ops={ARR:'',DEP:'',TOW:''};
    S.actingGL={lo:'',irreg:'',wo:'',cim:''}; // acting GLs are per-day — must not carry over to the next date
    S.roles={
      mocChaser:'',mojo:['','',''],
      wc:[{primary:'',asst:''},{primary:'',asst:''}],
      runners:shift==='NIGHT'
        ?[{name:'',timing:'1900-0100'},{name:'',timing:'1900-0100'},{name:'',timing:'0100-0700'},{name:'',timing:'0100-0700'}]
        :[{name:'',timing:'0700-1300'},{name:'',timing:'0700-1300'},{name:'',timing:'1300-1900'},{name:'',timing:'1300-1900'}],
      towerSlots:[{a:'',b:'',backup:''},{a:'',b:'',backup:''},{a:'',b:'',backup:''},{a:'',b:'',backup:''}]
    };
    S.loaded = true;
    setSt(`${staff.length} staff · ${dateStr} · Shift ${group} ${shift}`);
    showToast(`Roster loaded — ${staff.length} staff`,'ok');
    hideLoading();
    // Immediately restore from localStorage (synchronous) before Firebase responds
    const _lsKey = fbKey();
    if(_lsKey){
      try{
        const _lsRaw = localStorage.getItem('ops_ls_'+_lsKey);
        if(_lsRaw){
          const _lsD = sanitizeState(JSON.parse(_lsRaw));
          SAVE_FIELDS.forEach(f=>{ if(_lsD[f]!=null) try{ S[f]=JSON.parse(JSON.stringify(_lsD[f])); }catch(e){} });
        }
      }catch(e){}
    }
    _restoringFromFb = true; // block scheduleSave until fbLoad finishes (Firebase overrides localStorage)
    renderAll();
    staggerCards();
    checkDuplicateNames();
    // Load saved Firebase state — if not ready yet, fbSignIn will call fbLoad when auth completes
    if(fbReady){ fbLoad(); setupPresence(); loadActLogFromFb(); } else _restoringFromFb = false;
  }catch(err){
    hideLoading();
    showErr(err.message);
    setSt('Failed to load'); showToast('Failed to load roster','err');
    console.error(err);
  }
}

async function fetchSheet(){
  // Pick the right sheet config for the selected month
  const dateStr = document.getElementById('dp')?.value || '';
  const cfg = getSheetConfigForDate(dateStr);
  // Route through the backend proxy — API key stays server-side
  const params = new URLSearchParams({ sid: cfg.sid, tab: cfg.tab });
  const doFetch = () => fetch(`/api/sheets?${params}`, { headers: _sessionToken ? { 'Authorization': `Bearer ${_sessionToken}` } : {} });
  let r = await doFetch();
  if(r.status===401 && await refreshSession()) r = await doFetch(); // token lapsed — renew once and retry
  if(!r.ok){
    let msg = `HTTP ${r.status}`;
    try{ const j=await r.json(); msg=j.error||msg; }catch(_){}
    throw new Error(msg);
  }
  const d = await r.json();
  return d.values||[];
}

function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso+'T00:00:00');
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Backup code parser ──
// Matches exact patterns seen in sheet. Returns {matchesShift, dept} or null.
// STBY and plain DAY/NIGHT are NOT backup — those are own-shift or standby.
function parseBkCode(raw, selectedShift){
  const v = raw.toUpperCase().trim();

  // Extract dept suffix: (LO), (IRR), (IRREG), (WO)
  const deptMatch = v.match(/\((LO|IRR|IRREG|WO)\)/);
  const dept = deptMatch ? (deptMatch[1]==='LO'?'LO':deptMatch[1]==='WO'?'WO':'IRR') : null;

  // ── Pattern 0: (1/2) DAY / (1/2) NIGHT — half-shift backup from another shift ──
  // e.g. "(1/2) NIGHT", "(1/2) NIGHT (IRR)" — staff covers only half the shift
  if(/^\(1\/2\)\s*DAY/.test(v))   return { matchesShift: selectedShift==='DAY',   dept, half:true };
  if(/^\(1\/2\)\s*NIGHT/.test(v)) return { matchesShift: selectedShift==='NIGHT', dept, half:true };

  // ── Pattern 1: DAY (MD) / NIGHT (MD) — mandatory duty ──
  // e.g. "DAY (MD)", "NIGHT (MD)"
  if(/^DAY\s*\(MD\)/.test(v))   return { matchesShift: selectedShift==='DAY',   dept };
  if(/^NIGHT\s*\(MD\)/.test(v)) return { matchesShift: selectedShift==='NIGHT', dept };

  // ── Pattern 2: B/U DAY/NIGHT — allow optional parenthesis e.g. "B/U (NIGHT)", "(N5) B/U (NIGHT)" ──
  if(/B\/U\s*\(?\s*DAY/.test(v)||/BU\s*\(?\s*DAY/.test(v)||/B\/UP\s*\(?\s*DAY/.test(v)||/BACKUP\s*\(?\s*DAY/.test(v))
    return { matchesShift: selectedShift==='DAY',   dept };
  if(/B\/U\s*\(?\s*NIGHT/.test(v)||/BU\s*\(?\s*NIGHT/.test(v)||/B\/UP\s*\(?\s*NIGHT/.test(v)||/BACKUP\s*\(?\s*NIGHT/.test(v))
    return { matchesShift: selectedShift==='NIGHT', dept };

  // ── Pattern 3: (D1)-(D6) / (N1)-(N5) prefix — match regardless of what follows ──
  // e.g. "(N5) B/U (NIGHT)", "(D2)*", "(N1) B/U NIGHT (LO)"
  if(/^\(D[1-6]\)/.test(v)) return { matchesShift: selectedShift==='DAY',   dept };
  if(/^\(N[1-5]\)/.test(v)) return { matchesShift: selectedShift==='NIGHT', dept };

  // ── Pattern 4: (1),(2),(3) etc — generic backup slot for current shift ──
  // e.g. "(2) B737NG REC (CGK)" = backup slot 2
  if(/^\(\d+\)/.test(v)) return { matchesShift: true, dept };

  return null; // plain DAY, NIGHT, STBY etc → not backup
}

function parseRoster(rows, targetDate, shiftType, shiftGroup){
  shiftGroup = (shiftGroup||'C').toUpperCase();
  const sn = parseShortNames(rows);

  // 1. Find date column using anchor-offset approach
  // Find "30 Apr 2026" (or nearby known date) in the REAL roster header row
  // Validate: next cell must be "01 May 2026" (consecutive days confirm real header)
  let dateCol = -1, dateRow = -1;
  const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const tdLower = targetDate.toLowerCase();

  const anchorStr  = '30 apr 2026';
  const anchorNext = '01 may 2026'; // must follow immediately
  const anchorDate = new Date('2026-04-30T12:00:00');
  const targetDate0= new Date(targetDate+'T12:00:00');
  const dayOffset  = Math.round((targetDate0-anchorDate)/(864e5));

  // Find anchor cell where NEXT cell is the consecutive date (confirms real header)
  let anchorCol=-1, anchorRow=-1;
  for(let i=0;i<rows.length&&anchorCol===-1;i++){
    const row=rows[i]||[];
    for(let j=0;j<row.length-1;j++){
      const v =String(row[j]  ||'').trim().toLowerCase();
      const vn=String(row[j+1]||'').trim().toLowerCase();
      if(v.includes(anchorStr) && vn.includes(anchorNext)){
        anchorCol=j; anchorRow=i; break;
      }
    }
  }

  if(anchorCol>=0 && dayOffset>=0){
    dateCol = anchorCol + dayOffset;
    dateRow = anchorRow;
    // Verify ±2 columns in case of merged cells
    if(!String((rows[dateRow]||[])[dateCol]||'').toLowerCase().includes(tdLower)){
      for(let d=-2;d<=2;d++){
        if(String((rows[dateRow]||[])[dateCol+d]||'').toLowerCase().includes(tdLower)){
          dateCol+=d; break;
        }
      }
    }
  }

  // Fallback: score all occurrences, pick best
  if(dateCol===-1){
    const SCHED=/^(day|night|al|el|mc|od|rd|stby|lil|normal|exam|\(f|\(c|\(n|\(d|hosp|mia)/i;
    const cands=[];
    for(let i=0;i<rows.length;i++)
      for(let j=0;j<(rows[i]||[]).length;j++)
        if(String(rows[i][j]||'').toLowerCase().includes(tdLower)) cands.push([i,j]);
    let best=-999;
    for(const [ci,cj] of cands){
      let sc=0;
      for(let r=ci+1;r<Math.min(ci+300,rows.length);r++){
        const v=String((rows[r]||[])[cj]||'').trim();
        if(SCHED.test(v)) sc+=2; else if(v==='0'||/^\d+(\.\d+)?$/.test(v)) sc-=2;
      }
      if(sc>best){best=sc;dateCol=cj;dateRow=ci;}
    }
  }

  if(dateCol===-1) throw new Error(`Date "${targetDate}" not found in sheet.\n\nCheck:\n· Date exists in tab "${S.cfg.tab}"\n· Tab name is spelled exactly right`);

  // Fallback: search all rows for day-name prefixed cell
  if(dateCol===-1){
    for(let i=0;i<rows.length&&dateCol===-1;i++){
      const row=rows[i]||[];
      for(let j=0;j<row.length;j++){
        const v=String(row[j]||'').trim().toLowerCase();
        if(v.includes(tdLower)&&DAYS.some(d=>v.startsWith(d))){
          dateCol=j; dateRow=i; break;
        }
      }
    }
  }

  if(dateCol===-1) throw new Error(`Date "${targetDate}" not found in sheet.\n\nCheck:\n· Date exists in tab "${S.cfg.tab}"\n· Tab name is spelled exactly right`);

  // 2. Section title detection — maps row text → internal team key
  const SECTION_MAP = [
    { key:'LO',  pats:['LINE OPERATIONS'] },
    { key:'IRR', pats:['IRREGULARITIES','DMI','TROUBLESHOOTING','ENG SPECIALIST'] },
    { key:'WO',  pats:['WORK ORDER'] },
    { key:'CIM', pats:['CABIN MAINTENANCE','CABIN','CIM'] },
    { key:'MOC', pats:['MOC SHIFT','MOC ','DUTY ENGINEER SHIFT','DUTY ENGINEER ','DE SHIFT','DE '] },
  ];
  function detectSection(row){
    const txt = row.map(v=>String(v||'').toUpperCase()).join(' ');
    // Must explicitly say the selected shift group — ignores other shift rows
    if(!txt.includes('SHIFT '+shiftGroup)) return null;
    for(const {key,pats} of SECTION_MAP){
      for(const p of pats){ if(txt.includes(p)) return key; }
    }
    return null;
  }

  // 3. Detect column positions from any header row (row containing "Designation" or "Staff")
  let cols = { id:null, name:null, desig:null, acType:null, desigCode:null, fleet:null, shift:null, team:null };
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    const joined=row.map(v=>String(v||'').toLowerCase()).join('|');
    if(!joined.includes('designation')&&!(joined.includes('staff')&&joined.includes('name'))&&!joined.includes('staff id')) continue;
    row.forEach((cell,j)=>{
      const v=String(cell||'').toLowerCase().trim();
      if(/^staff.?id$|^id$/.test(v)             && cols.id===null)       cols.id=j;
      if(/staff.?name|full.?name|^name$/.test(v) && cols.name===null)     cols.name=j;
      if(v==='designation'                        && cols.desig===null)    cols.desig=j;
      if((v.includes('aircraft')||v.includes('certif')) && cols.acType===null) cols.acType=j;
      if(v.includes('desig code')                && cols.desigCode===null) cols.desigCode=j;
      if(v==='type'                               && cols.fleet===null)    cols.fleet=j;
      if(v==='shift'                              && cols.shift===null)    cols.shift=j;
      if((v==='team'||v==='group')              && cols.team===null)    cols.team=j;
    });
    if(cols.id!==null||cols.name!==null) break;
  }
  // Fallback: if Shift column not found via header, try to detect it from data rows
  // The roster structure has: Team,Staff ID,Staff Name,Desig,AcType,DesigCode,Type,Team,Shift,...
  // so Shift is typically at index 8
  if(cols.shift===null && cols.id!==null && cols.id>=1){
    // Check index 8 of a staff row for A/B/C/D/OFC pattern
    for(let i=10;i<Math.min(rows.length,50);i++){
      const row=rows[i];
      if(!row||!row.length) continue;
      const idRaw=String(row[cols.id]||'').trim();
      if(!/^M\d{4,}/i.test(idRaw)) continue;
      for(let j=cols.id+1;j<Math.min(row.length,cols.id+10);j++){
        const v=String(row[j]||'').trim().toUpperCase();
        if(/^(A|B|C|D|OFC)$/.test(v)){ cols.shift=j; break; }
      }
      if(cols.shift!==null) break;
    }
  }
  // Fallback: if Team column not found via header, it's the column just before Staff ID
  if(cols.team===null && cols.id!==null && cols.id>0) cols.team=cols.id-1;

  // Fallback: find id col from first M##### occurrence
  if(cols.id===null){
    outer: for(let i=10;i<rows.length;i++){
      for(let j=0;j<rows[i].length;j++){
        if(/^M\d{4,}/i.test(String(rows[i][j]||'').trim())){
          cols.id=j; if(cols.name===null) cols.name=j+1;
          if(cols.desig===null) cols.desig=j+2;
          if(cols.desigCode===null) cols.desigCode=j+3;
          break outer;
        }
      }
    }
  }

  // Staff permanently excluded from TRANSITION/DEPLOYMENT/LONG LEAVE scanning
  // (They are listed in that section but should not appear as working from it)
  const TRANS_EXCL = new Set([
    'M13339','M11057','M05673','M14100','M14795','M14794','M14973',
    'M14844','M14845','M14972','M00136','M14911','M12122','M14465',
    'M14966','M13594'
  ]);

  // Helper: map raw Team column value → internal team key
  function teamKeyOf(raw){
    const v=String(raw||'').toUpperCase().trim();
    if(v==='LO') return 'LO';
    if(v==='IRR'||v==='IRREG') return 'IRR';
    if(v==='WO') return 'WO';
    if(v==='CIM') return 'CIM';
    return null;
  }

  // 4. Walk rows — TWO passes in one loop:
  //    Pass A: collect Shift C own staff (existing logic)
  //    Pass B: collect backup staff from other shifts with matching backup code
  const staff=[], dbgSections={};
  let curSection=null;       // current Shift C section
  let curOtherSection=null;  // current other-shift section (for backup detection)
  let curOtherShift=null;    // 'A'|'B'|'D'
  let curTransSection=false;      // true = inside TRANSITION/DEPLOYMENT/LONG LEAVE section
  let curTransDefaultTeam=null;  // fallback team when Team column blank in trans section

  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(!row||!row.length) continue;
    const txt = row.map(v=>String(v||'').toUpperCase()).join(' ');

    // Detect EXCLUDED sections — clear curSection so staff below are skipped.
    // Check only the first 6 cells (not date columns) to avoid false matches
    // on schedule values like "(PG) JED POSTING" in staff rows.
    // Also gate on "no valid M##### in ID column" to skip staff data rows entirely.
    {
      const idChk = cols.id!==null ? String(row[cols.id]||'').trim() : '';
      if(!/^M\d{4,}/i.test(idChk)){
        const hdr = row.slice(0, Math.min(6,row.length)).map(v=>String(v||'').toUpperCase()).join(' ');
        const isExcluded =
          /\bPOSTING\b/.test(hdr)                                    || // POSTING section
          hdr.includes('VEHICLE') || hdr.includes('TRANSPORT')       || // Vehicle/Transport team
          hdr.includes('TOOL CRIB')                                  || // Tool Crib team
          hdr.includes('SS NILAI')                                   || // SS Nilai outstation
          (hdr.includes('STORE') && hdr.includes('LOGISTIC'))        || // Store & Logistics
          hdr.includes('PRODUCTION PLANNING')                        || // PPC management header
          hdr.includes('PPC');                                          // PPC SHIFT A/B/C/D (all variants)
        if(isExcluded){
          curSection=null; curOtherSection=null; curOtherShift=null; curTransSection=false; curTransDefaultTeam=null;
          continue;
        }
        // Detect TRANSITION / DEPLOYMENT / LONG LEAVE section — scan for own-shift staff
        if(hdr.includes('TRANSITION')||hdr.includes('DEPLOYMENT')||hdr.includes('LONG LEAVE')||hdr.includes('INDUCTION')||hdr.includes('BAT VAML')){
          curSection=null; curOtherSection=null; curOtherShift=null; curTransSection=true;
          // BAT VAML section has no Team column — default to IRR (LAE/TECH on posting)
          curTransDefaultTeam = hdr.includes('BAT VAML') ? 'IRR' : null;
          continue;
        }
      }
    }

    // Detect own-shift section headers
    const sec=detectSection(row);
    if(sec!==null){
      curSection=sec; curOtherSection=null; curOtherShift=null; curTransSection=false; curTransDefaultTeam=null;
      if(!dbgSections[sec]) dbgSections[sec]={startRow:i,count:0};
      continue;
    }

    // Detect other-shift section headers (any shift except selected)
    const otherM = txt.match(/\bSHIFT\s+([ABCD])\b/);
    if(otherM && otherM[1]!==shiftGroup && txt.includes('SHIFT '+otherM[1]) && !txt.includes('SHIFT '+shiftGroup)){
      // Which dept is this?
      let otherTeam=null;
      for(const {key,pats} of SECTION_MAP){
        for(const p of pats){ if(txt.includes(p)){ otherTeam=key; break; } }
        if(otherTeam) break;
      }
      curOtherSection=otherTeam; curOtherShift=otherM[1]; curSection=null; curTransSection=false; curTransDefaultTeam=null;
      continue;
    }

    // Staff row must have valid ID
    const idRaw=cols.id!==null?String(row[cols.id]||'').trim():'';
    if(!/^M\d{4,}/i.test(idRaw)) continue;

    const id        = idRaw.toUpperCase();
    const fullName  = cols.name!==null      ? c(row[cols.name])      : '';
    const desig     = cols.desig!==null     ? c(row[cols.desig])     : '';
    const desigCode = cols.desigCode!==null ? c(row[cols.desigCode]) : '';
    const acType    = cols.acType!==null    ? c(row[cols.acType]||''): '';
    const fleet     = cols.fleet!==null     ? c(row[cols.fleet]||''): '';
    const schedVal  = dateCol<row.length    ? c(row[dateCol])        : '';

    // Exclude non-technical roles from ALL paths
    const excl=desigCode.toUpperCase();
    const exclDesig=desig.toUpperCase();
    const isExcluded=
      excl.includes('PPC')||excl.includes('PPCC')||excl.includes('PPCO')||
      excl==='TC'||excl==='TCR'||excl==='TCT'||excl.includes('TOOLCRIB')||exclDesig.includes('TOOL CRIB')||
      excl==='SL'||excl==='SNL'||excl==='STO'||exclDesig.includes('STORE')||exclDesig.includes('LOGISTIC')||
      (S.exclusions||[]).includes(id); // permanently excluded staff
    if(isExcluded) continue;

    // Read Shift column value for this staff member
    const staffShiftVal = cols.shift!==null ? String(row[cols.shift]||'').trim().toUpperCase() : '';

    // ── Own-shift staff ──
    if(curSection){
      // If Shift column is detectable, only collect staff whose shift matches selected group
      // Section header is authoritative: if the header says "IRREGULARITIES SHIFT C",
      // all staff listed under it belong to Shift C — ignore the individual row's shift column.
      if(dbgSections[curSection]) dbgSections[curSection].count++;
      staff.push({ id, fullName,
        shortName: sn[fullName]||shortify(fullName),
        desig, acType, desigCode, fleet,
        team: curSection, schedVal,
        category: catOf(desigCode,desig),
        avail: availOf(schedVal,shiftType),
        fromShift: null,
        isBackup:false });
    }

    // ── Cross-shift backup detection ──
    else if(curOtherSection){
      // If Shift column detectable, skip if staff actually belongs to selected shift
      if(staffShiftVal && staffShiftVal===shiftGroup) continue;
      const schedUpper=schedVal.toUpperCase().trim();
      const bk=parseBkCode(schedVal, shiftType);
      // Include if: specific backup code OR plain NIGHT/DAY matching current shift
      const isPlainMatch=schedUpper===shiftType||schedUpper===shiftType+' (MD)';
      if((!bk||!bk.matchesShift)&&!isPlainMatch) continue;
      if(staff.some(s=>s.id===id||s.id===id+'_BK')) continue; // already in own shift
      // Use Team column value as tiebreaker: bk.dept > Team column > section header.
      // This fixes cases where a staff is physically listed under the wrong section
      // (e.g. an LO/IRR person grouped under CIM in the other shift's roster).
      const bkColTeam = cols.team!==null ? teamKeyOf(String(row[cols.team]||'').trim()) : null;
      const targetTeam=(bk&&bk.dept)||bkColTeam||curOtherSection;
      // Backup GLs → TECH (own-shift GL is present). NON-CS LAE → TECH (cannot certify).
      const bkRawCat=catOf(desigCode,desig);
      const bkIsNonCS=desig.toUpperCase().includes('(NON-CS)');
      const bkCat=(bkRawCat==='GL'||bkIsNonCS)?'TECH':bkRawCat;
      staff.push({ id: id+'_BK', fullName,
        shortName: sn[fullName]||shortify(fullName),
        desig, acType, desigCode, fleet,
        team: targetTeam, schedVal,
        category: bkCat,
        avail: { st:'WORKING', lbl:`BK-${curOtherShift||'?'}${bk&&bk.half?' ½':''}`, cls:'standby', badge:'bst', raw:schedVal, half:!!(bk&&bk.half) },
        fromShift: curOtherShift||'?',
        isBackup: true });
    }
    // ── TRANSITION/DEPLOYMENT/LONG LEAVE section staff ──
    else if(curTransSection){
      const rawTeam = cols.team!==null ? String(row[cols.team]||'').trim() : '';
      const tTeam   = teamKeyOf(rawTeam) || curTransDefaultTeam;
      if(!tTeam) continue; // unknown/blank team column → skip
      if(TRANS_EXCL.has(id)) continue; // this staff is excluded from transition scanning
      const schedUpper = schedVal.toUpperCase().trim();
      const bk = parseBkCode(schedVal, shiftType);
      const isOwnShift = schedUpper===shiftType || schedUpper===shiftType+' (MD)';
      const isMatchingBk = bk && bk.matchesShift;
      if(!isOwnShift && !isMatchingBk) continue; // not working this shift
      // Duplicate check — but for own-shift: if previously added as cross-shift _BK
      // (because the person is still listed in another shift's section), upgrade to
      // own-shift by removing the backup entry first.
      if(isOwnShift){
        const prevBkIdx = staff.findIndex(s=>s.id===id+'_BK');
        if(prevBkIdx!==-1) staff.splice(prevBkIdx,1); // remove stale cross-shift BK entry
      }
      if(staff.some(s=>s.id===id||s.id===id+'_BK')) continue; // already collected
      const targetTeam = (bk&&bk.dept) || tTeam;
      // GL and NON-CS → TECH in TRANSITION context.
      // GL: supervisory role irrelevant on posting. NON-CS: cannot certify, functions as TECH.
      const rawCat = catOf(desigCode,desig);
      const isNonCS = desig.toUpperCase().includes('(NON-CS)');
      const transCat = (rawCat==='GL' || isNonCS) ? 'TECH' : rawCat;
      if(isOwnShift){
        // Working own shift — appears as regular staff in their team
        staff.push({ id, fullName,
          shortName: sn[fullName]||shortify(fullName),
          desig, acType, desigCode, fleet,
          team: targetTeam, schedVal,
          category: transCat,
          avail: availOf(schedVal,shiftType),
          fromShift: null,
          isBackup: false });
      } else {
        // Has a backup code — appears as cross-shift backup labelled 'T' (Transition)
        staff.push({ id: id+'_BK', fullName,
          shortName: sn[fullName]||shortify(fullName),
          desig, acType, desigCode, fleet,
          team: targetTeam, schedVal,
          category: transCat,
          avail: { st:'WORKING', lbl:`BK-T${bk&&bk.half?' ½':''}`, cls:'standby', badge:'bst', raw:schedVal, half:!!(bk&&bk.half) },
          fromShift: 'T',
          isBackup: true });
      }
    }
    // Only scan within known LO/IRREG/WO/CIM/MOC sections — no fallback for unknown sections
  }

  // Debug info
  const xsBkFound = staff.filter(s=>s.isBackup);
  const dbgOtherSamples = [];

  // Re-scan to collect samples of other-shift rows with their raw schedule values
  let dbgOtherSec=null;
  for(let i=0;i<rows.length&&dbgOtherSamples.length<30;i++){
    const row=rows[i];
    if(!row||!row.length) continue;
    const txt=row.map(v=>String(v||'').toUpperCase()).join(' ');
    const otherM=txt.match(/\bSHIFT\s+([ABCD])\b/);
    if(otherM&&otherM[1]!==shiftGroup&&!txt.includes('SHIFT '+shiftGroup)){ dbgOtherSec='SHIFT '+otherM[1]; continue; }
    if(!dbgOtherSec) continue;
    const idRaw=cols.id!==null?String(row[cols.id]||'').trim():'';
    if(!/^M\d{4,}/i.test(idRaw)) continue;
    const sv=dateCol<row.length?c(row[dateCol]):'';
    if(sv) dbgOtherSamples.push({ shift:dbgOtherSec, id:idRaw, name:cols.name!==null?c(row[cols.name]):'', schedVal:sv });
  }

  S.debug = { totalRows:rows.length, staffFound:staff.filter(s=>!s.isBackup).length,
    xsBkFound: xsBkFound.length, xsBkSamples: xsBkFound.slice(0,5).map(s=>({name:s.shortName,team:s.team,schedVal:s.schedVal,fromShift:s.fromShift})),
    otherShiftSamples: dbgOtherSamples,
    dateCol, dateRow,
    dateHeaderCell: rows[dateRow]?.[dateCol]||'(empty)',
    dateAdjacentPrev: rows[dateRow]?.[dateCol-1]||'(empty)',
    dateAdjacentNext: rows[dateRow]?.[dateCol+1]||'(empty)',
    sampleSchedVals: staff.filter(s=>!s.isBackup).slice(0,5).map(s=>({name:s.shortName,schedVal:s.schedVal})),
    // Show row 5 columns 38-55 to find actual date header format
    row5cols: (rows[5]||[]).slice(38,56).map((v,i)=>({col:i+38,val:String(v||'')})).filter(x=>x.val),
    headerFound:cols.id!==null, cols,
    sections:dbgSections,
    sample: staff.filter(s=>!s.isBackup).slice(0,20).map(s=>({
      team:s.team, id:s.id, name:s.shortName,
      shift:s.schedVal, colShift:dateCol, rawRow:[]
    }))
  };

  return staff;
}

function c(v){ return String(v||'').trim().toUpperCase(); }

function parseShortNames(rows){
  const map={};
  let on=false;
  for(const row of rows){
    const a=String(row[0]||'').trim(), b=String(row[1]||'').trim();
    if(a==='NAME'&&(b==='SHORT NAME'||b==='SHORTNAME')){ on=true; continue; }
    if(on&&a&&b&&!/^(TYPE|STATION|CODE|WEEK|FLEET|DESIG|AVERAGE|SP |NO_)/i.test(a)){
      map[a.toUpperCase()]=b;
    }
  }
  return map;
}

function shortify(name){
  const pre=new Set(['MOHD','MUHAMMAD','MUHAMAD','MOHAMAD','NUR','WAN','TENGKU','SITI','NURUL','MOHD.']);
  const con=new Set(['BIN','BINTI','A/L','A/P','@']);
  const words=name.split(/\s+/);
  // Collect all given-name words (after prefixes, before connectors)
  const given=[];
  for(let i=0;i<words.length;i++){
    if(con.has(words[i])) break;
    if(!pre.has(words[i])) given.push(words[i]);
  }
  if(!given.length) return words[0]||name;
  // "AMIR SYAMIM" → use both words; single word → use as-is
  return given.join(' ');
}

function catOf(dc, desig){
  const dcc = dc.replace(/\s+/g,'').toUpperCase();
  if(dcc==='LT'||desig.includes('GROUP LEADER')) return 'GL';
  if(dc==='LAT') return 'LAT';
  // Check TECH codes FIRST before any (B1)/(B2) text matching
  if(['LATNCS','LAENCS','LAENCSB1','LAENCSB2'].includes(dcc)) return 'TECH';
  if(['TECH','TECHB1','TECHB2'].includes(dcc)) return 'TECH';
  if(desig.includes('AIRCRAFT TECHNICIAN')) return 'TECH';
  // LAE B1 / B2 only for actual licensed engineers
  if(dc==='LAEB1'||desig.includes('(B1.1)')) return 'LAE B1';
  if(dc==='LAEB2') return 'LAE B2';
  if(dc==='SM') return 'SM';
  return 'OTHER';
}

const OVERRIDE_MAP = {
  'WORKING':     { st:'WORKING',     lbl:'WORKING',  cls:'working', badge:'bwk' },
  'AL/OFF':      { st:'LEAVE',       lbl:'AL/OFF',   cls:'leave',   badge:'blv' },
  'MC/EL':       { st:'ABSENT',      lbl:'MC/EL',    cls:'absent',  badge:'bab' },
  'FLYING':      { st:'FLYING',      lbl:'FLYING',   cls:'flying',  badge:'bfl' },
  'CRS/PROJECT': { st:'COURSE',      lbl:'CRS/PRJ',  cls:'course',  badge:'bcr' },
  'TRANSFERRED': { st:'TRANSFERRED', lbl:'TRANSFER', cls:'xfer',    badge:'bxf' },
};
const OVR_CYCLE = ['WORKING','AL/OFF','MC/EL','FLYING','CRS/PROJECT','TRANSFERRED'];

// Codes that mean the person is physically NOT in your dept this shift
const XFER_DEST = {
  // Posting shift / general department transfer
  'PG': 'POSTING SHIFT',
  // Tool Crib
  'TC': 'TOOL CRIB', 'TCR': 'TOOL CRIB',
  // Store & Logistics
  'SL': 'STORE & LOG', 'SNL': 'STORE & LOG', 'STO': 'STORE & LOG',
  // CIM / other
  'CIM': 'CIM',
};

function isXferCode(raw){
  // Match patterns like (PG) REMARK, (TC), (SL) ..., (TC1), etc.
  const m = raw.match(/^\(([A-Z0-9]+)\)/);
  if(!m) return null;
  const code = m[1];
  // Direct match
  if(XFER_DEST[code]) return XFER_DEST[code];
  // Prefix match e.g. TC1, SL2
  for(const k of Object.keys(XFER_DEST)){
    if(code.startsWith(k)) return XFER_DEST[k];
  }
  return null;
}

function availOf(v, shift){
  const raw=v.toUpperCase().trim();
  if(!raw||raw==='-'||raw==='0'||raw==='FALSE') return { st:'UNKNOWN', lbl:'—', cls:'off', badge:'bof', raw };
  if(raw===shift) return { st:'WORKING', lbl:shift, cls:'working', badge:'bwk', raw };
  if(raw===`(1/2) ${shift}`) return { st:'WORKING', lbl:'½', cls:'working', badge:'bwk', raw, half:true };
  // If cell contains the shift word but also has a course/task code, treat as WORKING
  if(raw.includes(shift)&&(raw.includes('(C')||raw.includes('COURSE')||raw.includes('TRNG')||raw.includes('REC')||raw.includes('(T')))
    return { st:'WORKING', lbl:shift+' (C)', cls:'working', badge:'bwk', raw };
  // If cell starts with NIGHT/DAY regardless of suffix, treat as working for that shift
  if(raw.startsWith(shift)) return { st:'WORKING', lbl:shift, cls:'working', badge:'bwk', raw };
  if(/^DAY\s*\(MD\)/.test(raw)&&shift==='DAY')   return { st:'WORKING', lbl:'DAY MD',   cls:'working', badge:'bwk', raw };
  if(/^NIGHT\s*\(MD\)/.test(raw)&&shift==='NIGHT') return { st:'WORKING', lbl:'NIGHT MD', cls:'working', badge:'bwk', raw };
  // B/U codes on own staff
  if((/B\/U\s+DAY|BACKUP\s+DAY/.test(raw))&&shift==='DAY')   return { st:'WORKING', lbl:'BK DAY', cls:'working', badge:'bwk', raw };
  if((/B\/U\s+NIGHT|BACKUP\s+NIGHT/.test(raw))&&shift==='NIGHT') return { st:'WORKING', lbl:'BK NIGHT', cls:'working', badge:'bwk', raw };
  // Detect opposite shift
  const SHIFTS=['DAY','NIGHT','AM','PM'];
  if(SHIFTS.includes(raw)&&raw!==shift) return { st:'OTHER_SHIFT', lbl:raw, cls:'course', badge:'bcr', raw };
  if(raw==='STBY') return { st:'STANDBY', lbl:'STBY', cls:'standby', badge:'bst', raw };
  if(/^\(D[1-6]\)\*?/.test(raw)||/^\(N[1-5]\)\*?/.test(raw)) return { st:'BACKUP_SHIFT', lbl:raw.substring(0,4), cls:'standby', badge:'bst', raw };
  if(/^\(F[0-8]\)/.test(raw)||/^\(P[01]\)/.test(raw)) return { st:'FLYING', lbl:'FLYING', cls:'flying', badge:'bfl', raw };
  const xdest = isXferCode(raw);
  if(xdest) return { st:'TRANSFERRED', lbl:xdest, cls:'xfer', badge:'bxf', raw };
  if(/^\(C[1-9T]\)/.test(raw)||/^\(Q[AO]\)/.test(raw)) return { st:'COURSE', lbl:'COURSE', cls:'course', badge:'bcr', raw };
  if(/^\(T[1-5]\)/.test(raw)) return { st:'TASK', lbl:'TASK', cls:'course', badge:'bcr', raw };
  const LV=['AL','LIL','EL','PIL','PTL','MTL','MRG','EXAM','CL','UPL','MRGL','ADML'];
  // Also match leave variants like 'AL (R)', 'AL RPL', 'EL OD' etc.
  if(LV.includes(raw)||LV.some(lv=>raw.startsWith(lv+' ')||raw.startsWith(lv+'('))||raw.startsWith('(1/2) AL')||raw.startsWith('(1/2) LIL')||raw.startsWith('OFF: RPL'))
    return { st:'LEAVE', lbl:raw.substring(0,8), cls:'leave', badge:'blv', raw };
  if(['MC','HOSP','MIA','SOCSO'].includes(raw)) return { st:'ABSENT', lbl:raw, cls:'absent', badge:'bab', raw };
  if(['OD','RD'].includes(raw)) return { st:'OFF', lbl:raw, cls:'off', badge:'bof', raw };
  if(raw==='NORMAL'||raw==='(1/2) NORMAL') return { st:'OFFICE', lbl:'NORMAL', cls:'off', badge:'bof', raw };
  return { st:'OTHER', lbl:raw.substring(0,10), cls:'course', badge:'bcr', raw };
}

function isTransferred(s){ return effAvail(s).st === 'TRANSFERRED'; }

function effAvail(s){
  if(!s) return {st:'OFF',lbl:'?',cls:'off',badge:'bof',raw:'',half:false};
  const ov=S.overrides[s.id];
  if(ov) return OVERRIDE_MAP[ov]||{st:'OFF',lbl:ov,cls:'off',badge:'bof',raw:ov,half:false};
  return s.avail||{st:'OFF',lbl:'?',cls:'off',badge:'bof',raw:'',half:false};
}

function isActive(a){ return ['WORKING','BACKUP_SHIFT'].includes(a.st); }

