// ═══════════════════════════════════
// TOWERS
// ═══════════════════════════════════
function renderTowersSection(){
  const perm = S.towers.permanent;
  const bkup = S.towers.backups;
  const all  = [...perm.map((t,i)=>({...t,isPerm:true,idx:i})), ...bkup.map((t,i)=>({...t,isPerm:false,idx:i}))];
  const avail = all.filter(t=>t.status==='AVAIL').length;

  return `<div style="margin-top:16px;background:var(--bg);border:1px solid #2A1A3A;border-radius:var(--r);padding:14px 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <span style="font-family:var(--cond);font-size:11px;font-weight:700;letter-spacing:3px;color:#C084FC">TOWERS</span>
        <span style="font-size:9px;color:var(--txt3);margin-left:8px">not counted in headcount</span>
      </div>
      <div style="display:flex;gap:6px">
        <span style="font-size:10px;color:var(--txt2);align-self:center">${avail}/${all.length} AVAIL</span>
        <button class="btn btn-sm np" onclick="openTowerEdit()" style="background:#1A0A2A;color:#C084FC;border:1px solid #3A1A5A;font-size:9px">✎ EDIT</button>
      </div>
    </div>

    ${all.length===0?`<div style="font-size:11px;color:var(--txt3);padding:8px 0">No tower staff added yet. Click ✎ EDIT to add permanent staff.</div>`:''}

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:7px">
      ${all.map(t=>{
        const isAvail = t.status==='AVAIL';
        const fn = t.isPerm ? `toggleTower('perm',${t.idx})` : `toggleTower('bk',${t.idx})`;
        const removeBtn = t.isPerm ? '' : `<button onclick="event.stopPropagation();removeTowerBackup(${t.idx})" title="Remove backup tower" style="position:absolute;top:4px;right:4px;background:transparent;border:none;color:var(--txt3);cursor:pointer;font-size:11px;line-height:1;padding:2px">✕</button>`;
        return `<div onclick="${fn}" style="position:relative;background:${isAvail?'#1A0A2A':'var(--surf)'};border:1px solid ${isAvail?'#6B21A8':'var(--b)'};border-radius:var(--r);padding:9px 11px;cursor:pointer;transition:border-color .15s">
          ${removeBtn}
          <div style="font-family:var(--cond);font-size:14px;font-weight:700;color:${isAvail?'#C084FC':'var(--txt2)'};letter-spacing:.5px;margin-bottom:4px">
            ${t.name}${!t.isPerm?` <span style="font-size:8px;padding:1px 4px;background:var(--ybg);color:var(--amber);border:1px solid var(--amber);border-radius:2px">BK</span>`:''}
          </div>
          <span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:1px;padding:2px 6px;border-radius:3px;border:1px solid;${isAvail?'background:#1A0A2A;color:#C084FC;border-color:#6B21A8':'background:var(--bg);color:var(--gray);border-color:var(--b)'}">
            ${isAvail?'AVAIL':'OFF'}
          </span>
        </div>`;
      }).join('')}
    </div>

    <div class="bk-form np" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--b)">
      <span style="font-size:9px;color:var(--txt3);letter-spacing:1px">ADD BACKUP TOWER</span>
      <input type="text" id="tw-bk-name" placeholder="Name" style="width:130px" onkeydown="if(event.key==='Enter')addTowerBackup()">
      <button class="btn btn-sm np" onclick="addTowerBackup()" style="background:#1A0A2A;color:#C084FC;border:1px solid #3A1A5A">+ ADD</button>
    </div>
  </div>`;
}

function toggleTower(type, idx){
  const list = type==='perm' ? S.towers.permanent : S.towers.backups;
  list[idx].status = list[idx].status==='AVAIL' ? 'OFF' : 'AVAIL';
  if(type==='perm') saveTowers();
  renderAll();
}

function addTowerBackup(){
  const inp = document.getElementById('tw-bk-name');
  const name = (inp?.value||'').trim().toUpperCase();
  if(!name) return;
  S.towers.backups.push({ name, status:'AVAIL' });
  inp.value='';
  renderAll();
}

function removeTowerBackup(idx){
  S.towers.backups.splice(idx,1);
  renderAll();
}

function openTowerEdit(){
  renderTowerEditModal();
  document.getElementById('tower-edit-ov').classList.add('show');
}
function closeTowerEdit(){ document.getElementById('tower-edit-ov').classList.remove('show'); }

function renderTowerEditModal(){
  const el = document.getElementById('tower-edit-body');
  const perm = S.towers.permanent;
  el.innerHTML=`
    <div style="font-size:10px;color:var(--txt2);margin-bottom:14px;line-height:1.6">
      These are your 6 permanent tower staff. Names are saved to your browser and persist across sessions.
    </div>
    <div id="tower-perm-list" style="margin-bottom:14px">
      ${perm.map((t,i)=>`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <input type="text" value="${t.name}" oninput="updatePermTower(${i},this.value)"
            style="flex:1;background:var(--bg);border:1px solid var(--b);border-radius:4px;color:var(--txt);padding:6px 10px;font-family:var(--mono);font-size:12px;outline:none">
          <button class="btn btn-red btn-sm" onclick="removePermTower(${i})">✕</button>
        </div>`).join('')}
    </div>
    ${perm.length<8?`<button class="btn btn-ghost btn-sm" onclick="addPermTower()">+ ADD PERMANENT TOWER</button>`:''}
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--b);display:flex;gap:8px">
      <button class="btn btn-amber" style="flex:1" onclick="savePermTowers()">SAVE</button>
      <button class="btn btn-ghost" onclick="closeTowerEdit()">CANCEL</button>
    </div>`;
}

function addPermTower(){
  S.towers.permanent.push({ name:'', status:'AVAIL' });
  renderTowerEditModal();
}

function updatePermTower(idx, val){
  S.towers.permanent[idx].name = val.toUpperCase().trim();
}

function removePermTower(idx){
  S.towers.permanent.splice(idx,1);
  renderTowerEditModal();
}

function savePermTowers(){
  // Remove empty entries
  S.towers.permanent = S.towers.permanent.filter(t=>t.name);
  saveTowers();
  closeTowerEdit();
  renderAll();
}

// ═══════════════════════════════════
// TRAINEES
// ═══════════════════════════════════
function renderTraineesSection(){
  const perm  = S.trainees.permanent;
  const bkup  = S.trainees.backups;
  const all   = [...perm.map((t,i)=>({...t,isPerm:true,idx:i})), ...bkup.map((t,i)=>({...t,isPerm:false,idx:i}))];
  const avail = all.filter(t=>t.status==='AVAIL').length;

  return `<div style="margin-top:12px;background:var(--bg);border:1px solid #1A2A1A;border-radius:var(--r);padding:14px 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <span style="font-family:var(--cond);font-size:11px;font-weight:700;letter-spacing:3px;color:#4ade80">TRAINEES</span>
        <span style="font-size:9px;color:var(--txt3);margin-left:8px">not counted in headcount</span>
      </div>
      <div style="display:flex;gap:6px">
        <span style="font-size:10px;color:var(--txt2);align-self:center">${avail}/${all.length} AVAIL</span>
        <button class="btn btn-sm np" onclick="openTraineeEdit()" style="background:#0A1A0A;color:#4ade80;border:1px solid #1A4A1A;font-size:9px">✎ EDIT</button>
      </div>
    </div>

    ${all.length===0?`<div style="font-size:11px;color:var(--txt3);padding:4px 0">No trainees added. Click ✎ EDIT to add permanent trainees.</div>`:''}

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:7px">
      ${all.map(t=>{
        const isAvail = t.status==='AVAIL';
        const fn = t.isPerm ? `toggleTrainee('perm',${t.idx})` : `toggleTrainee('bk',${t.idx})`;
        return `<div onclick="${fn}" style="background:${isAvail?'#0A1A0A':'var(--surf)'};border:1px solid ${isAvail?'#166534':'var(--b)'};border-radius:var(--r);padding:9px 11px;cursor:pointer;transition:border-color .15s">
          <div style="font-family:var(--cond);font-size:14px;font-weight:700;color:${isAvail?'#4ade80':'var(--txt2)'};letter-spacing:.5px;margin-bottom:4px">
            ${t.name}${!t.isPerm?` <span style="font-size:8px;padding:1px 4px;background:var(--ybg);color:var(--amber);border:1px solid var(--amber);border-radius:2px">BK</span>`:''}
          </div>
          <span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:1px;padding:2px 6px;border-radius:3px;border:1px solid;${isAvail?'background:#0A1A0A;color:#4ade80;border-color:#166534':'background:var(--bg);color:var(--gray);border-color:var(--b)'}">
            ${isAvail?'AVAIL':'OFF'}
          </span>
        </div>`;
      }).join('')}
    </div>

    <div class="bk-form np" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--b)">
      <span style="font-size:9px;color:var(--txt3);letter-spacing:1px">ADD TRAINEE</span>
      <input type="text" id="tr-bk-name" placeholder="Name" style="width:130px" onkeydown="if(event.key==='Enter')addTraineeBackup()">
      <button class="btn btn-sm np" onclick="addTraineeBackup()" style="background:#0A1A0A;color:#4ade80;border:1px solid #1A4A1A">+ ADD</button>
    </div>
  </div>`;
}

function toggleTrainee(type, idx){
  const list = type==='perm' ? S.trainees.permanent : S.trainees.backups;
  list[idx].status = list[idx].status==='AVAIL' ? 'OFF' : 'AVAIL';
  if(type==='perm') saveTrainees();
  renderAll();
}

function addTraineeBackup(){
  const inp  = document.getElementById('tr-bk-name');
  const name = (inp?.value||'').trim().toUpperCase();
  if(!name) return;
  S.trainees.backups.push({ name, status:'AVAIL' });
  inp.value='';
  renderAll();
}

function openTraineeEdit(){
  renderTraineeEditModal();
  document.getElementById('trainee-edit-ov').classList.add('show');
}
function closeTraineeEdit(){ document.getElementById('trainee-edit-ov').classList.remove('show'); }

function renderTraineeEditModal(){
  const el   = document.getElementById('trainee-edit-body');
  const perm = S.trainees.permanent;
  el.innerHTML=`
    <div style="font-size:10px;color:var(--txt2);margin-bottom:14px;line-height:1.6">
      Permanent trainees are saved to your browser. Toggle availability each shift by clicking their card.
    </div>
    <div style="margin-bottom:14px">
      ${perm.map((t,i)=>`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <input type="text" value="${t.name}" oninput="updatePermTrainee(${i},this.value)"
            style="flex:1;background:var(--bg);border:1px solid var(--b);border-radius:4px;color:var(--txt);padding:6px 10px;font-family:var(--mono);font-size:12px;outline:none">
          <button class="btn btn-red btn-sm" onclick="removePermTrainee(${i})">✕</button>
        </div>`).join('')}
    </div>
    <button class="btn btn-ghost btn-sm" onclick="addPermTrainee()">+ ADD TRAINEE</button>
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--b);display:flex;gap:8px">
      <button class="btn btn-amber" style="flex:1" onclick="savePermTrainees()">SAVE</button>
      <button class="btn btn-ghost" onclick="closeTraineeEdit()">CANCEL</button>
    </div>`;
}

function addPermTrainee(){
  S.trainees.permanent.push({ name:'', status:'AVAIL' });
  renderTraineeEditModal();
}

function updatePermTrainee(idx, val){
  S.trainees.permanent[idx].name = val.toUpperCase().trim();
}

function removePermTrainee(idx){
  S.trainees.permanent.splice(idx,1);
  renderTraineeEditModal();
}

function savePermTrainees(){
  S.trainees.permanent = S.trainees.permanent.filter(t=>t.name);
  saveTrainees();
  closeTraineeEdit();
  renderAll();
}

// ═══════════════════════════════════
// MOC SECTION (shown in LO tab)
// ═══════════════════════════════════
function renderMocSection(){
  const mocStaff = S.staff.filter(s=>isMocStaff(s));
  const mocBk    = S.backups.moc||[];
  const avail    = mocStaff.filter(s=>isActive(effAvail(s))).length + mocBk.filter(b=>b.status==='AVAIL').length;
  const total    = mocStaff.length + mocBk.length;

  return `<div style="margin-top:16px;background:var(--bg);border:1px solid #2A2000;border-radius:var(--r);padding:14px 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <span style="font-family:var(--cond);font-size:11px;font-weight:700;letter-spacing:3px;color:var(--amber)">DUTY ENGINEER</span>
        <span style="font-size:9px;color:var(--txt3);margin-left:8px">not counted in headcount</span>
      </div>
      <span style="font-size:10px;color:var(--txt2)">${avail}/${total} AVAIL</span>
    </div>

    ${total===0?`<div style="font-size:11px;color:var(--txt3);padding:4px 0">No Duty Engineer staff detected from roster.</div>`:''}

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:7px;margin-bottom:12px">
      ${mocStaff.map(s=>{
        const a=effAvail(s), avl=isActive(a), nm=displayName(s), hasNick=!!S.nicknames[s.id];
        return `<div style="background:${avl?'var(--ybg)':'var(--surf)'};border:1px solid ${avl?'var(--amber)':'var(--b)'};border-radius:var(--r);padding:9px 11px;opacity:${avl?1:0.6}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px">
            <div style="font-family:var(--cond);font-size:14px;font-weight:700;color:${avl?'var(--amber2)':'var(--txt2)'}">${nm}${hasNick?`<span style="font-size:7px;color:var(--txt3);margin-left:3px">✎</span>`:''}
            </div>
            <button onclick="editNickname('${s.id}','${(s.fullName||'').replace(/'/g,"\\'")}',event)" class="np" title="Edit nickname" style="background:transparent;border:none;color:var(--txt3);font-size:10px;cursor:pointer;padding:0;line-height:1;flex-shrink:0">✎</button>
          </div>
          <div style="font-size:9px;color:var(--txt3);margin-bottom:4px">${s.desigCode||s.desig}</div>
          <span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:1px;padding:2px 6px;border-radius:3px;border:1px solid;background:${avl?'var(--ybg)':'var(--bg)'};color:${avl?'var(--amber)':'var(--gray)'};border-color:${avl?'var(--amber)':'var(--b)'}">
            ${avl?'AVAIL':a.lbl||'OFF'}
          </span>
        </div>`;
      }).join('')}
      ${mocBk.map((b,i)=>`<div style="background:${b.status==='AVAIL'?'var(--ybg)':'var(--surf)'};border:1px solid ${b.status==='AVAIL'?'var(--amber)':'var(--b)'};border-radius:var(--r);padding:9px 11px">
        <div style="font-family:var(--cond);font-size:14px;font-weight:700;color:${b.status==='AVAIL'?'var(--amber2)':'var(--txt2)'};margin-bottom:4px">
          ${b.name} <span style="font-size:8px;padding:1px 4px;background:var(--ybg);color:var(--amber);border:1px solid var(--amber);border-radius:2px">BK</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <span onclick="toggleMocBk(${i})" style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:1px;padding:2px 6px;border-radius:3px;border:1px solid;cursor:pointer;background:${b.status==='AVAIL'?'var(--ybg)':'var(--bg)'};color:${b.status==='AVAIL'?'var(--amber)':'var(--gray)'};border-color:${b.status==='AVAIL'?'var(--amber)':'var(--b)'}">
            ${b.status==='AVAIL'?'AVAIL':'OFF'}
          </span>
          <button onclick="removeMocBk(${i})" class="np" style="background:transparent;border:none;color:var(--txt3);font-size:12px;cursor:pointer;padding:0 2px">✕</button>
        </div>
      </div>`).join('')}
    </div>

    <div class="bk-form np" style="padding-top:10px;border-top:1px solid var(--b)">
      <span style="font-size:9px;color:var(--txt3);letter-spacing:1px">ADD BACKUP DE</span>
      <input type="text" id="moc-bk-name" placeholder="Name" style="width:130px" onkeydown="if(event.key==='Enter')addMocBackup()">
      <button class="btn btn-amber btn-sm np" onclick="addMocBackup()">+ ADD</button>
    </div>
  </div>`;
}

function addMocBackup(){
  const inp=document.getElementById('moc-bk-name');
  const name=(inp?.value||'').trim().toUpperCase();
  if(!name) return;
  if(!S.backups.moc) S.backups.moc=[];
  S.backups.moc.push({name,status:'AVAIL'});
  inp.value='';
  renderAll();
}
function toggleMocBk(i){ S.backups.moc[i].status=S.backups.moc[i].status==='AVAIL'?'OFF':'AVAIL'; renderAll(); }
function removeMocBk(i){ S.backups.moc.splice(i,1); renderAll(); }

let swapState = { step:1, person1:null, mode:null, focusDept:null };

function openSwapModal(focusDept){
  swapState = { step:1, person1:null, mode:null, focusDept: focusDept||null };
  renderSwapModal();
  document.getElementById('swap-ov').classList.add('show');
}
function closeSwapModal(){ document.getElementById('swap-ov').classList.remove('show'); }

function renderSwapModal(){
  const el = document.getElementById('swap-body');
  const DEPT_LABELS = { LO:'LINE OPS', IRR:'IRREGULARITIES', WO:'WORK ORDER', CIM:'CABIN (CIM)' };
  const DEPTS_LIST  = ['LO','IRR','WO','CIM'];

  // Active swaps/transfers list
  const activeHTML = [
    ...S.swaps.map((sw,i)=>{
      const p1=S.staff.find(s=>s.id===sw.id1), p2=S.staff.find(s=>s.id===sw.id2);
      if(!p1||!p2) return '';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg);border:1px solid var(--b);border-radius:4px;margin-bottom:5px">
        <span style="font-size:11px;color:var(--txt)">${displayName(p1)} <span style="color:var(--txt2)">(${p1.team})</span> ⇄ ${p2.shortName} <span style="color:var(--txt2)">(${p2.team})</span></span>
        <button class="btn btn-red btn-sm" onclick="removeSwap(${i})">✕</button>
      </div>`;
    }),
    ...S.transfers.map((tr,i)=>{
      const p=S.staff.find(s=>s.id===tr.id);
      if(!p) return '';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg);border:1px solid var(--b);border-radius:4px;margin-bottom:5px">
        <span style="font-size:11px;color:var(--txt)">${displayName(p)} <span style="color:var(--txt2)">(${p.team})</span> → <span style="color:var(--teal)">${tr.toDept}</span> <span style="font-size:9px;color:var(--txt3)">[TRANSFER]</span></span>
        <button class="btn btn-red btn-sm" onclick="removeTransfer(${i})">✕</button>
      </div>`;
    })
  ].join('');

  const isTechAvail = s => s.category==='TECH' && isActive(effAvail(s)) && !isTransferred(s);

  if(swapState.step===1){
    // Step 1: pick a person — TECH + available only
    const staffByDept = {};
    DEPTS_LIST.forEach(d=>{ staffByDept[d] = S.staff.filter(s=>effectiveDept(s)===d && isTechAvail(s)); });

    el.innerHTML=`
      ${activeHTML?`<div style="margin-bottom:16px">
        <div style="font-size:9px;color:var(--amber);letter-spacing:2px;font-weight:700;margin-bottom:8px">ACTIVE SWAPS & TRANSFERS</div>
        ${activeHTML}
      </div>`:''}
      <div style="font-size:9px;color:var(--amber);letter-spacing:2px;font-weight:700;margin-bottom:4px">STEP 1 — SELECT TECH TO SWAP OR TRANSFER</div>
      <div style="font-size:10px;color:var(--txt2);margin-bottom:12px">Only showing available TECH staff</div>
      ${DEPTS_LIST.map(dept=>{
        const members = staffByDept[dept]; if(!members.length) return '';
        return `<div style="margin-bottom:12px">
          <div style="font-size:9px;color:var(--txt2);letter-spacing:2px;margin-bottom:6px">${DEPT_LABELS[dept]||dept}</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">
            ${members.map(s=>`<button onclick="swapPickPerson1('${s.id}')"
              style="background:${swapState.person1?.id===s.id?'var(--amber)':'var(--surf2)'};color:${swapState.person1?.id===s.id?'#000':'var(--txt)'};border:1px solid ${swapState.person1?.id===s.id?'var(--amber)':'var(--b2)'};border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:var(--mono)">
              ${displayName(s)}
            </button>`).join('')}
          </div>
        </div>`;
      }).join('')}`;
  }
  else if(swapState.step===2){
    // Step 2: pick mode
    const p = swapState.person1;
    el.innerHTML=`
      <div style="font-size:9px;color:var(--amber);letter-spacing:2px;font-weight:700;margin-bottom:10px">STEP 2 — CHOOSE ACTION FOR ${displayName(p)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div onclick="swapPickMode('swap')" style="background:var(--surf2);border:2px solid ${swapState.mode==='swap'?'var(--amber)':'var(--b)'};border-radius:8px;padding:16px;cursor:pointer;text-align:center">
          <div style="font-size:20px;margin-bottom:6px">⇄</div>
          <div style="font-size:12px;font-weight:700;color:var(--txt)">SWAP</div>
          <div style="font-size:10px;color:var(--txt2);margin-top:4px">Exchange with someone from another dept</div>
        </div>
        <div onclick="swapPickMode('transfer')" style="background:var(--surf2);border:2px solid ${swapState.mode==='transfer'?'var(--amber)':'var(--b)'};border-radius:8px;padding:16px;cursor:pointer;text-align:center">
          <div style="font-size:20px;margin-bottom:6px">→</div>
          <div style="font-size:12px;font-weight:700;color:var(--txt)">TRANSFER</div>
          <div style="font-size:10px;color:var(--txt2);margin-top:4px">Move to another dept (one-way)</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="swapBack()">← BACK</button>`;
  }
  else if(swapState.step===3 && swapState.mode==='swap'){
    // Step 3a: pick person to swap WITH — TECH + available from other depts only
    const p1 = swapState.person1;
    const others = S.staff.filter(s => effectiveDept(s)!==effectiveDept(p1) && isTechAvail(s));
    const byDept = {};
    others.forEach(s=>{ const d=effectiveDept(s); if(!byDept[d]) byDept[d]=[]; byDept[d].push(s); });

    el.innerHTML=`
      <div style="font-size:9px;color:var(--amber);letter-spacing:2px;font-weight:700;margin-bottom:4px">STEP 3 — PICK TECH TO SWAP WITH ${displayName(p1)}</div>
      <div style="font-size:10px;color:var(--txt2);margin-bottom:12px">${displayName(p1)} → their dept · they → ${effectiveDept(p1)} · Only showing available TECH</div>
      ${Object.keys(byDept).length===0?`<div style="color:var(--orange);font-size:11px;padding:12px 0">No available TECH found in other departments.</div>`:''}
      ${Object.entries(byDept).map(([dept,members])=>`
        <div style="margin-bottom:12px">
          <div style="font-size:9px;color:var(--txt2);letter-spacing:2px;margin-bottom:6px">${DEPT_LABELS[dept]||dept}</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">
            ${members.map(s=>`<button onclick="confirmSwap('${s.id}')"
              style="background:var(--surf2);color:var(--txt);border:1px solid var(--b2);border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:var(--mono)">
              ${displayName(s)}
            </button>`).join('')}
          </div>
        </div>`).join('')}
      <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="swapBack()">← BACK</button>`;
  }
  else if(swapState.step===3 && swapState.mode==='transfer'){
    // Step 3b: pick destination dept
    const p1  = swapState.person1;
    const depts = DEPTS_LIST.filter(d=>d!==effectiveDept(p1));
    el.innerHTML=`
      <div style="font-size:9px;color:var(--amber);letter-spacing:2px;font-weight:700;margin-bottom:4px">STEP 3 — SELECT DESTINATION FOR ${displayName(p1)}</div>
      <div style="font-size:10px;color:var(--txt2);margin-bottom:12px">${displayName(p1)} will appear in the new dept with a "FROM ${p1.team}" tag</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px">
        ${depts.map(d=>`<button onclick="confirmTransfer('${d}')"
          style="background:var(--surf2);color:var(--txt);border:1px solid var(--b2);border-radius:6px;padding:12px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--mono);letter-spacing:1px">
          ${DEPT_LABELS[d]||d}
        </button>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="swapBack()">← BACK</button>`;
  }
}

function swapPickPerson1(id){
  swapState.person1 = S.staff.find(s=>s.id===id);
  swapState.step = 2;
  renderSwapModal();
}
function swapPickMode(mode){
  swapState.mode = mode;
  swapState.step = 3;
  renderSwapModal();
}
function swapBack(){
  swapState.step = Math.max(1, swapState.step-1);
  if(swapState.step===1){ swapState.person1=null; swapState.mode=null; }
  renderSwapModal();
}
function confirmSwap(id2){
  const id1 = swapState.person1.id;
  // Remove any existing swap/transfer for these two
  S.swaps     = S.swaps.filter(sw=>sw.id1!==id1&&sw.id2!==id1&&sw.id1!==id2&&sw.id2!==id2);
  S.transfers = S.transfers.filter(t=>t.id!==id1&&t.id!==id2);
  S.swaps.push({ id1, id2 });
  const _s2=S.staff.find(s=>s.id===id2);
  logEvent('SWAP', displayName(swapState.person1)+' ↔ '+(_s2?displayName(_s2):id2));
  closeSwapModal();
  renderAll();
}
function confirmTransfer(toDept){
  const id = swapState.person1.id;
  S.swaps     = S.swaps.filter(sw=>sw.id1!==id&&sw.id2!==id);
  S.transfers = S.transfers.filter(t=>t.id!==id);
  S.transfers.push({ id, toDept });
  logEvent('TRANSFER', displayName(swapState.person1)+' → '+toDept);
  closeSwapModal();
  renderAll();
}
function removeSwap(i){
  const sw=S.swaps[i];
  if(sw){ const _a=S.staff.find(s=>s.id===sw.id1),_b=S.staff.find(s=>s.id===sw.id2); logEvent('SWAP','Removed '+(_a?displayName(_a):sw.id1)+' ↔ '+(_b?displayName(_b):sw.id2)); }
  S.swaps.splice(i,1); renderSwapModal(); renderAll();
}
function removeTransfer(i){
  const tr=S.transfers[i];
  if(tr){ const _s=S.staff.find(s=>s.id===tr.id); logEvent('TRANSFER','Removed '+(_s?displayName(_s):tr.id)+' → '+tr.toDept); }
  S.transfers.splice(i,1); renderSwapModal(); renderAll();
}

