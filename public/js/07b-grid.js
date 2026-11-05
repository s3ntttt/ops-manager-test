// ═══════════════════════════════════
// SPREADSHEET-STYLE TABLES — SOC, PDSC, FGS
//   Enter ↓ / Shift+Enter ↑ · Tab → / Shift+Tab ← · arrow ↑↓ move between rows
//   click the row number to select a row (Shift = range, Ctrl/Cmd = add)
//   Ctrl+C copy · Ctrl+X cut (empties the cells, row stays) · Ctrl+V paste rows below
//   drag the row number to re-order · paste Excel cells straight into a cell
// ═══════════════════════════════════
const GRIDS={
  soc: { cols:['flight','name','time','remark'], tick:true,  get:()=>S.soc,  set:v=>{ S.soc=v; },  blank:()=>({flight:'',name:'',time:'',remark:''}) },
  pdsc:{ cols:['reg','certifier'],                tick:false, get:()=>S.pdsc, set:v=>{ S.pdsc=v; }, blank:()=>({reg:'',certifier:''}) },
  fgs: { cols:['reg','remark'],                   tick:false, get:()=>S.fgs,  set:v=>{ S.fgs=v; },  blank:()=>({reg:'',remark:''}) },
};
let _gName=null, _gSel=new Set(), _gAnchor=null, _gDragIdx=null, _gDragged=false; // one grid has the row selection at a time

// ── pure helpers (unit-tested) ──
// Clipboard text (tab/newline separated, as copied from Excel) → array of rows of trimmed cells.
function gridParseClipboard(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n');
  while(lines.length && !lines[lines.length-1].trim()) lines.pop();
  return lines.map(l=>l.split('\t').map(x=>x.trim()));
}
// Move the rows in `sel` so they sit before position `pos` of the original list. Returns {list, start, count}.
function gridReorder(list, sel, pos){
  const idx=[...sel].sort((a,b)=>a-b);
  const moved=idx.map(i=>list[i]);
  const rest=list.filter((_,i)=>!sel.has(i));
  const at=pos-idx.filter(i=>i<pos).length;
  rest.splice(at,0,...moved);
  return { list:rest, start:at, count:moved.length };
}
const _gIsTick=v=>/^(✓|✔|x|1|true|yes|done)$/i.test(String(v||'').trim());
function _gRowsTsv(name, idx){   // ✓ tick (SOC only) is an extra last column so it travels with the row
  const g=GRIDS[name], rows=g.get();
  return idx.map(i=>g.cols.map(k=>String(rows[i][k]||'').replace(/[\t\r\n]+/g,' ')).concat(g.tick?[rows[i].done?'✓':'']:[]).join('\t')).join('\n');
}
function _gRowFromCells(name, cells){
  const g=GRIDS[name], o=g.blank();
  g.cols.forEach((k,j)=>{ o[k]=cells[j]||''; });
  if(g.tick && _gIsTick(cells[g.cols.length])) o.done=true;
  return o;
}
const _gHasData=(name,i)=>{ const r=GRIDS[name].get()[i]; return !!(r && GRIDS[name].cols.some(k=>String(r[k]||'').trim())); };

// ── helpers ──
function _gOf(el){ const t=el && el.closest && el.closest('table[data-grid]'); return t?t.dataset.grid:null; }
function _gFocus(name,r,c){
  const el=document.querySelector(`table[data-grid="${name}"] input[data-g-r="${r}"][data-g-c="${c}"]`);
  if(el){ el.focus(); try{ el.select(); }catch(e){} }
  return !!el;
}
function _gChanged(name, focusRC){ renderSummary(); scheduleSave(); logSectionChanges(); if(focusRC) _gFocus(name,focusRC[0],focusRC[1]); }
function _gPaint(){
  document.querySelectorAll('table[data-grid] tr[data-g-i]').forEach(tr=>{
    tr.classList.toggle('grid-sel', _gOf(tr)===_gName && _gSel.has(+tr.dataset.gI));
  });
}
function _gSelect(name, set, anchor){ _gName=name; _gSel=set; if(anchor!=null) _gAnchor=anchor; _gPaint(); }
function _gClear(){ if(_gSel.size){ _gSel=new Set(); _gPaint(); } }
function gridAfterRender(){ // called at the end of every renderSummary()
  if(_gName) _gSel=new Set([..._gSel].filter(i=>i<GRIDS[_gName].get().length));
  _gPaint();
}
function _gSelActive(e){
  if(!_gSel.size || !_gName) return false;
  const t=e.target; if(!t) return true;
  return !(t.matches && t.matches('input,textarea,select,[contenteditable="true"]'));
}

// ── keyboard ──
document.addEventListener('keydown',e=>{
  const t=e.target;
  if(e.key==='Escape'){ _gClear(); return; }
  if(!t || !t.matches || !t.matches('table[data-grid] input[data-g-c]')) return;
  const name=_gOf(t), g=GRIDS[name], rows=g.get(), last=g.cols.length-1;
  const r=+t.dataset.gR, c=+t.dataset.gC;
  if(e.key==='Enter'){
    e.preventDefault();
    const nr=e.shiftKey?r-1:r+1;
    if(nr>=0 && nr<rows.length) _gFocus(name,nr,c);
    else if(!e.shiftKey && !isViewOnly() && _gHasData(name,r)){ rows.push(g.blank()); _gChanged(name,[nr,c]); }
  } else if(e.key==='Tab'){
    let nr=r, nc=c+(e.shiftKey?-1:1);
    if(nc>last){ nc=0; nr++; } else if(nc<0){ nc=last; nr--; }
    if(nr<0) return;                       // let the browser leave the table
    if(nr>=rows.length){
      if(e.shiftKey || isViewOnly() || !_gHasData(name,r)) return;
      e.preventDefault(); rows.push(g.blank()); _gChanged(name,[nr,nc]); return;
    }
    e.preventDefault(); _gFocus(name,nr,nc);
  } else if(e.key==='ArrowDown' || e.key==='ArrowUp'){
    const nr=r+(e.key==='ArrowDown'?1:-1);
    if(nr>=0 && nr<rows.length){ e.preventDefault(); _gFocus(name,nr,c); }
  }
});

// ── row selection (click the row number) ──
document.addEventListener('mousedown',e=>{
  const h=e.target.closest && e.target.closest('table[data-grid] .grid-handle');
  if(!h){ _gClear(); return; }
  const name=_gOf(h), i=+h.dataset.gH;
  if(name!==_gName){ _gSel=new Set(); _gAnchor=null; }
  if(e.shiftKey && _gAnchor!=null && name===_gName){
    const a=Math.min(_gAnchor,i), b=Math.max(_gAnchor,i), s=new Set();
    for(let k=a;k<=b;k++) s.add(k);
    _gSelect(name,s);
  } else if(e.ctrlKey||e.metaKey){
    const s=new Set(_gSel); s.has(i)?s.delete(i):s.add(i); _gSelect(name,s,i);
  } else if(!_gSel.has(i)) _gSelect(name,new Set([i]),i);   // an already-selected row keeps the group so it can be dragged together
  _gDragged=false;
});
document.addEventListener('click',e=>{
  const h=e.target.closest && e.target.closest('table[data-grid] .grid-handle');
  if(h && !_gDragged && !e.shiftKey && !e.ctrlKey && !e.metaKey && _gSel.size>1) _gSelect(_gOf(h),new Set([+h.dataset.gH]),+h.dataset.gH);
});

// ── copy / cut / paste of whole rows ──
const _gSorted=()=>[..._gSel].sort((a,b)=>a-b);
document.addEventListener('copy',e=>{
  if(!_gSelActive(e)) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain',_gRowsTsv(_gName,_gSorted()));
  showToast(`Copied ${_gSel.size} row${_gSel.size>1?'s':''}`,'ok',1200);
});
document.addEventListener('cut',e=>{
  if(!_gSelActive(e)) return;
  e.preventDefault();
  const name=_gName, g=GRIDS[name], idx=_gSorted();
  e.clipboardData.setData('text/plain',_gRowsTsv(name,idx));
  if(isViewOnly()) return;
  // Excel behaviour: the contents go to the clipboard and the cells are emptied — the rows themselves stay in place
  const rows=g.get();
  idx.forEach(i=>{ g.cols.forEach(k=>{ rows[i][k]=''; }); delete rows[i].done; });
  _gChanged(name);
  showToast(`Cut ${idx.length} row${idx.length>1?'s':''}`,'ok',1200);
});
document.addEventListener('paste',e=>{
  if(isViewOnly()) return;
  const text=(e.clipboardData&&e.clipboardData.getData('text/plain'))||'';
  const t=e.target;
  // 1) rows are selected → insert the pasted rows below the selection
  if(_gSelActive(e)){
    const parsed=gridParseClipboard(text); if(!parsed.length) return;
    e.preventDefault();
    const name=_gName, at=Math.max(..._gSel)+1;
    GRIDS[name].get().splice(at,0,...parsed.map(cells=>_gRowFromCells(name,cells)));
    _gSel=new Set(parsed.map((_,k)=>at+k)); _gChanged(name); return;
  }
  // 2) cursor in a cell and the clipboard is multi-cell (e.g. copied from Excel) → fill the grid from that cell
  if(t && t.matches && t.matches('table[data-grid] input[data-g-c]') && (text.includes('\t')||/\n[^\n]/.test(text.replace(/\r/g,'').trim()))){
    e.preventDefault();
    const name=_gOf(t), g=GRIDS[name], rows=g.get(), r0=+t.dataset.gR, c0=+t.dataset.gC, parsed=gridParseClipboard(text);
    parsed.forEach((cells,k)=>{
      while(r0+k>=rows.length) rows.push(g.blank());
      cells.forEach((v,j)=>{ if(c0+j<g.cols.length) rows[r0+k][g.cols[c0+j]]=v; });
      if(g.tick && c0===0 && cells.length>g.cols.length) rows[r0+k].done=_gIsTick(cells[g.cols.length]) || undefined;
    });
    _gChanged(name,[r0,c0]);
  }
});

// ── drag a row (by its number) to re-order ──
function _gDropPos(e){
  const tr=e.target.closest && e.target.closest('table[data-grid] tr[data-g-i]'); if(!tr) return null;
  if(_gOf(tr)!==_gName) return null;                 // rows can only be dropped inside their own table
  const box=tr.getBoundingClientRect(), after=e.clientY>box.top+box.height/2;
  return { tr, pos:+tr.dataset.gI+(after?1:0), after };
}
function _gClearDrop(){ document.querySelectorAll('.grid-drop-before,.grid-drop-after').forEach(x=>x.classList.remove('grid-drop-before','grid-drop-after')); }
document.addEventListener('dragstart',e=>{
  const h=e.target.closest && e.target.closest('table[data-grid] .grid-handle'); if(!h) return;
  if(isViewOnly()){ e.preventDefault(); return; }
  const name=_gOf(h), i=+h.dataset.gH;
  if(name!==_gName || !_gSel.has(i)) _gSelect(name,new Set([i]),i);
  _gDragIdx=i; _gDragged=true;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',_gRowsTsv(name,_gSorted()));
});
document.addEventListener('dragover',e=>{
  if(_gDragIdx==null) return;
  const d=_gDropPos(e); if(!d) return;
  e.preventDefault(); e.dataTransfer.dropEffect='move';
  _gClearDrop(); d.tr.classList.add(d.after?'grid-drop-after':'grid-drop-before');
});
document.addEventListener('drop',e=>{
  if(_gDragIdx==null) return;
  const d=_gDropPos(e); _gClearDrop(); if(!d) return;
  e.preventDefault();
  const name=_gName, r=gridReorder(GRIDS[name].get(),_gSel,d.pos);
  GRIDS[name].set(r.list);
  const s=new Set(); for(let k=0;k<r.count;k++) s.add(r.start+k);
  _gSel=s; _gChanged(name);
});
document.addEventListener('dragend',()=>{ _gClearDrop(); _gDragIdx=null; });
