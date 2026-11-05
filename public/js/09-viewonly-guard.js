// ═══════════════════════════════════
// VIEW-ONLY GUARD — a view-only login can look, search, switch tabs, print and share, but cannot change anything:
// typing is blocked (fields become read-only), and every button that edits is switched off with a short notice.
// (The database rules block writes too; this just stops the page from letting you try.)
// ═══════════════════════════════════
const VO_SAFE_CALLS=new Set([
  'switchTab','toggleActLog','toggleDark','filterStaff','clearSearch','closeSnap','printSummary','exportTxt','copyClip',
  'copyBriefingText','openBriefingModal','closeBriefingModal','openPrePlanSnapshot','sharePrePlanImage','downloadPrePlanImage',
  'copyPrePlanText','closePrePlanModal','renderSummary','renderAdpModal','logout','dateChanged','loadRoster','fbLoad',
  'openAdpModal','closeAdpModal','event.stopPropagation','document.getElementById',
]);

// A handler (inline onclick text) is allowed for view-only users if every function it calls is on the safe list
// and it doesn't assign into the app state.
function voAllowedHandler(code){
  code=String(code||'');
  if(/\bS\.[A-Za-z_]+[^=;]*=(?!=)/.test(code)) return false;
  const calls=[...code.matchAll(/([A-Za-z_$][\w$.]*)\s*\(/g)].map(m=>m[1]);
  return calls.every(c=>VO_SAFE_CALLS.has(c)||c.startsWith('classList.'));
}

function applyViewOnlyDom(){
  if(typeof isViewOnly!=='function' || !isViewOnly()) return;
  document.querySelectorAll('.panel input,.panel textarea,.panel select,.modal input,.modal textarea,.modal select').forEach(el=>{
    if(el.id==='adp-search' || el.id==='access-input' || el.closest('#access-ov') || el.dataset.voOk) return;
    if(el.type==='checkbox'||el.type==='radio'||el.type==='button'||el.tagName==='SELECT') el.disabled=true; else el.readOnly=true;
  });
  document.querySelectorAll('[onclick]').forEach(el=>{
    if(!voAllowedHandler(el.getAttribute('onclick'))) el.classList.add('vo-block');
  });
}

// Block clicks on anything that edits (checks the clicked element and every parent that has an onclick).
document.addEventListener('click',e=>{
  if(typeof isViewOnly!=='function' || !isViewOnly()) return;
  for(let el=e.target; el && el.getAttribute; el=el.parentElement){
    const code=el.getAttribute('onclick');
    if(code!==null && !voAllowedHandler(code)){
      e.preventDefault(); e.stopImmediatePropagation();
      if(typeof showToast==='function') showToast('View-only login — you can look but not change anything','err',2500);
      return;
    }
  }
},true);

// Re-apply after every re-render.
if(typeof MutationObserver!=='undefined'){
  let queued=false;
  new MutationObserver(()=>{ if(queued) return; queued=true; (window.requestAnimationFrame||setTimeout)(()=>{ queued=false; applyViewOnlyDom(); }); })
    .observe(document.body,{childList:true,subtree:true});
}
