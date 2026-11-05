// ═══════════════════════════════════
// SOC TABLE — spreadsheet-style editing
//   Enter ↓ / Shift+Enter ↑ · Tab → / Shift+Tab ← · arrow ↑↓ move between rows
//   click the row number to select a row (Shift = range, Ctrl/Cmd = add) · Ctrl+C (copy) / Ctrl+X (cut = empties the cells, row stays) / Ctrl+V on selected rows
//   drag the row number to re-order · paste Excel cells straight into a cell
// ═══════════════════════════════════
const SOC_COLS=['flight','name','time','remark'];
let _socSel=new Set(), _socAnchor=null, _socDragIdx=null, _socDragged=false;

// ── pure helpers (unit-tested) ──
// Clipboard text (tab/newline separated, as copied from Excel) → array of 4-field rows.
function socParseClipboard(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n');
  while(lines.length && !lines[lines.length-1].trim()) lines.pop();
  return lines.map(l=>l.split('\t').map(x=>x.trim()));
}
// Move the rows in `sel` so they sit before position `pos` of the original list. Returns {list, start, count}.
function socReorder(list, sel, pos){
  const idx=[...sel].sort((a,b)=>a-b);
  const moved=idx.map(i=>list[i]);
  const rest=list.filter((_,i)=>!sel.has(i));
  const at=pos-idx.filter(i=>i<pos).length;
  rest.splice(at,0,...moved);
  return { list:rest, start:at, count:moved.length };
}
const _socBlank=()=>({flight:'',name:'',time:'',remark:''});
const _socHasData=i=>{ const r=S.soc[i]; return !!(r && SOC_COLS.some(k=>String(r[k]||'').trim())); };

// ── helpers ──
function _socFocus(r,c){
  const el=document.querySelector(`#soc-table input[data-soc-r="${r}"][data-soc-c="${c}"]`);
  if(el){ el.focus(); try{ el.select(); }catch(e){} }
  return !!el;
}
function _socChanged(focusRC){ renderSummary(); scheduleSave(); if(focusRC) _socFocus(focusRC[0],focusRC[1]); }
function _socPaint(){
  document.querySelectorAll('#soc-table tr[data-soc-i]').forEach(tr=>tr.classList.toggle('soc-sel',_socSel.has(+tr.dataset.socI)));
}
function _socSelect(set, anchor){ _socSel=set; if(anchor!=null) _socAnchor=anchor; _socPaint(); }
function socAfterRender(){ // called at the end of every renderSummary()
  _socSel=new Set([..._socSel].filter(i=>i<S.soc.length));
  _socPaint();
}
// 5th column = the ✓ tick, so it travels with the row on copy / paste
function _socRowsTsv(idx){ return idx.map(i=>SOC_COLS.map(k=>String(S.soc[i][k]||'').replace(/[\t\r\n]+/g,' ')).concat(S.soc[i].done?'✓':'').join('\t')).join('\n'); }
const _socIsTick=v=>/^(✓|✔|x|1|true|yes|done)$/i.test(String(v||'').trim());
function _socSelActive(e){
  if(!_socSel.size) return false;
  const t=e.target; if(!t) return true;
  return !(t.matches && t.matches('input,textarea,select,[contenteditable="true"]'));
}
function _socClear(){ if(_socSel.size){ _socSel=new Set(); _socPaint(); } }

// ── keyboard ──
document.addEventListener('keydown',e=>{
  const t=e.target;
  if(e.key==='Escape'){ _socClear(); return; }
  if(!t || !t.matches || !t.matches('#soc-table input[data-soc-c]')) return;
  const r=+t.dataset.socR, c=+t.dataset.socC;
  if(e.key==='Enter'){
    e.preventDefault();
    const nr=e.shiftKey?r-1:r+1;
    if(nr>=0 && nr<S.soc.length) _socFocus(nr,c);
    else if(!e.shiftKey && !isViewOnly() && _socHasData(r)){ S.soc.push(_socBlank()); _socChanged([nr,c]); }
  } else if(e.key==='Tab'){
    let nr=r, nc=c+(e.shiftKey?-1:1);
    if(nc>3){ nc=0; nr++; } else if(nc<0){ nc=3; nr--; }
    if(nr<0) return;                       // let the browser leave the table
    if(nr>=S.soc.length){
      if(e.shiftKey || isViewOnly() || !_socHasData(r)) return;
      e.preventDefault(); S.soc.push(_socBlank()); _socChanged([nr,nc]); return;
    }
    e.preventDefault(); _socFocus(nr,nc);
  } else if(e.key==='ArrowDown' || e.key==='ArrowUp'){
    const nr=r+(e.key==='ArrowDown'?1:-1);
    if(nr>=0 && nr<S.soc.length){ e.preventDefault(); _socFocus(nr,c); }
  }
});

// ── row selection (click the row number) ──
document.addEventListener('mousedown',e=>{
  const h=e.target.closest && e.target.closest('#soc-table .soc-handle');
  if(!h){ _socClear(); return; }
  const i=+h.dataset.socH;
  if(e.shiftKey && _socAnchor!=null){
    const a=Math.min(_socAnchor,i), b=Math.max(_socAnchor,i), s=new Set();
    for(let k=a;k<=b;k++) s.add(k);
    _socSelect(s);
  } else if(e.ctrlKey||e.metaKey){
    const s=new Set(_socSel); s.has(i)?s.delete(i):s.add(i); _socSelect(s,i);
  } else if(!_socSel.has(i)) _socSelect(new Set([i]),i);   // an already-selected row keeps the group so it can be dragged together
  _socDragged=false;
});
document.addEventListener('click',e=>{
  const h=e.target.closest && e.target.closest('#soc-table .soc-handle');
  if(h && !_socDragged && !e.shiftKey && !e.ctrlKey && !e.metaKey && _socSel.size>1) _socSelect(new Set([+h.dataset.socH]),+h.dataset.socH);
});

// ── copy / cut / paste of whole rows ──
document.addEventListener('copy',e=>{
  if(!_socSelActive(e)) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain',_socRowsTsv([..._socSel].sort((a,b)=>a-b)));
  showToast(`Copied ${_socSel.size} row${_socSel.size>1?'s':''}`,'ok',1200);
});
document.addEventListener('cut',e=>{
  if(!_socSelActive(e)) return;
  e.preventDefault();
  const idx=[...(_socSel)].sort((a,b)=>a-b);
  e.clipboardData.setData('text/plain',_socRowsTsv(idx));
  if(isViewOnly()) return;
  // Excel behaviour: the contents go to the clipboard and the cells are emptied — the rows themselves stay in place
  idx.forEach(i=>{ SOC_COLS.forEach(k=>{ S.soc[i][k]=''; }); delete S.soc[i].done; });
  _socChanged();
  showToast(`Cut ${idx.length} row${idx.length>1?'s':''}`,'ok',1200);
});
document.addEventListener('paste',e=>{
  if(isViewOnly()) return;
  const text=(e.clipboardData&&e.clipboardData.getData('text/plain'))||'';
  const t=e.target;
  // 1) rows are selected → insert the pasted rows below the selection
  if(_socSelActive(e)){
    const rows=socParseClipboard(text); if(!rows.length) return;
    e.preventDefault();
    const at=Math.max(..._socSel)+1;
    S.soc.splice(at,0,...rows.map(r=>{ const o={flight:r[0]||'',name:r[1]||'',time:r[2]||'',remark:r[3]||''}; if(_socIsTick(r[4])) o.done=true; return o; }));
    _socSel=new Set(rows.map((_,k)=>at+k)); _socChanged(); return;
  }
  // 2) cursor in a SOC cell and the clipboard is multi-cell (e.g. copied from Excel) → fill the grid from that cell
  if(t && t.matches && t.matches('#soc-table input[data-soc-c]') && (text.includes('\t')||/\n[^\n]/.test(text.replace(/\r/g,'').trim()))){
    e.preventDefault();
    const r0=+t.dataset.socR, c0=+t.dataset.socC, rows=socParseClipboard(text);
    rows.forEach((cells,k)=>{
      while(r0+k>=S.soc.length) S.soc.push(_socBlank());
      cells.forEach((v,j)=>{ if(c0+j<SOC_COLS.length) S.soc[r0+k][SOC_COLS[c0+j]]=v; });
      if(c0===0 && cells.length>4) S.soc[r0+k].done=_socIsTick(cells[4]) || undefined;
    });
    _socChanged([r0,c0]);
  }
});

// ── drag a row (by its number) to re-order ──
function _socDropPos(e){
  const tr=e.target.closest && e.target.closest('#soc-table tr[data-soc-i]'); if(!tr) return null;
  const box=tr.getBoundingClientRect(), after=e.clientY>box.top+box.height/2;
  return { tr, pos:+tr.dataset.socI+(after?1:0), after };
}
function _socClearDrop(){ document.querySelectorAll('#soc-table .soc-drop-before,#soc-table .soc-drop-after').forEach(x=>x.classList.remove('soc-drop-before','soc-drop-after')); }
document.addEventListener('dragstart',e=>{
  const h=e.target.closest && e.target.closest('#soc-table .soc-handle'); if(!h) return;
  if(isViewOnly()){ e.preventDefault(); return; }
  const i=+h.dataset.socH;
  if(!_socSel.has(i)) _socSelect(new Set([i]),i);
  _socDragIdx=i; _socDragged=true;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',_socRowsTsv([..._socSel].sort((a,b)=>a-b)));
});
document.addEventListener('dragover',e=>{
  if(_socDragIdx==null) return;
  const d=_socDropPos(e); if(!d) return;
  e.preventDefault(); e.dataTransfer.dropEffect='move';
  _socClearDrop(); d.tr.classList.add(d.after?'soc-drop-after':'soc-drop-before');
});
document.addEventListener('drop',e=>{
  if(_socDragIdx==null) return;
  const d=_socDropPos(e); _socClearDrop(); if(!d) return;
  e.preventDefault();
  const r=socReorder(S.soc,_socSel,d.pos);
  S.soc=r.list;
  const s=new Set(); for(let k=0;k<r.count;k++) s.add(r.start+k);
  _socSel=s; _socChanged();
});
document.addEventListener('dragend',()=>{ _socClearDrop(); _socDragIdx=null; });
