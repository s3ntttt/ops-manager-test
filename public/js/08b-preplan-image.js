// ═══════════════════════════════════
// PRE-PLAN SNAPSHOT — a picture of just the Allocation + Technicians + Certifiers (plus the title and cross-shift banner)
// for pasting into the WhatsApp group. The SOC / PDSC / FGS / Avail panel on the right and all buttons are left out.
// Built from copies of the live summary elements, so it always matches the screen.
// ═══════════════════════════════════
const HTML2CANVAS_URL='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
let _ppBlob=null, _ppName='preplan.png';

function _loadHtml2Canvas(){
  if(window.html2canvas) return Promise.resolve();
  return new Promise((res,rej)=>{
    const s=document.createElement('script'); s.src=HTML2CANVAS_URL; s.onload=res; s.onerror=()=>rej(new Error('Could not load the image library — check your internet connection'));
    document.head.appendChild(s);
  });
}

// The message that goes with the picture in the WhatsApp group.
function prePlanMessage(){
  const night=(document.getElementById('shift-sel')?.value||'DAY').toUpperCase()==='NIGHT';
  return night
    ? 'PREPLAN FOR TONIGHT\n\nNAME IN BLUE TO REPORT IN 1800 - 0600. TQ'
    : 'PREPLAN FOR TOMORROW\n\nNAME IN BLUE TO REPORT IN 0600-1800. TQ';
}

function _buildPrePlanNode(){
  const root=document.getElementById('cs'); if(!root) return null;
  const pick=k=>root.querySelector(`[data-pp="${k}"]`);
  const title=pick('title'), left=pick('left'), mid=pick('mid');
  if(!left||!mid) return null;
  const wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;left:-10000px;top:0;width:1120px;padding:16px 18px;background:#fff;color:var(--txt);box-sizing:border-box';
  const group=document.getElementById('shift-group-sel')?.value||'C';
  const now=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  if(title){
    const t=title.cloneNode(true);
    t.style.marginBottom='12px';
    const sub=t.children[1]; if(sub) sub.textContent=`SHIFT ${group} · PRE-PLAN · as of ${now}`;
    wrap.appendChild(t);
  }
  const xs=pick('xs'); if(xs) wrap.appendChild(xs.cloneNode(true));
  const grid=document.createElement('div');
  grid.style.cssText='display:grid;grid-template-columns:200px 1fr;gap:10px;align-items:start';
  grid.appendChild(left.cloneNode(true)); grid.appendChild(mid.cloneNode(true));
  wrap.appendChild(grid);
  wrap.querySelectorAll('.np,button').forEach(n=>n.remove());     // no buttons / hints in the picture
  wrap.querySelectorAll('[onclick]').forEach(n=>{ n.removeAttribute('onclick'); n.style.cursor='default'; });
  return wrap;
}

async function openPrePlanSnapshot(){
  const wrap=_buildPrePlanNode();
  if(!wrap){ showToast('Open the Summary tab first','err'); return; }
  showToast('Making snapshot…','ok',1500);
  document.body.appendChild(wrap);
  try{
    await _loadHtml2Canvas();
    const canvas=await html2canvas(wrap,{backgroundColor:'#ffffff',scale:Math.max(3,Math.ceil(window.devicePixelRatio||1)),useCORS:true,logging:false});
    _ppBlob=await new Promise(r=>canvas.toBlob(r,'image/png'));
    const d=(document.getElementById('dp')?.value||'').replace(/-/g,''), sh=document.getElementById('shift-sel')?.value||'', g=document.getElementById('shift-group-sel')?.value||'C';
    _ppName=`PREPLAN_${g}_${d}_${sh}.png`;
    _showPrePlanModal(URL.createObjectURL(_ppBlob));
  }catch(e){
    console.error('preplan snapshot:',e); showToast('Snapshot failed: '+e.message,'err',4000);
  }finally{ wrap.remove(); }
}

// Phone / tablet → SHARE (picture + message go to WhatsApp together).   Computer → DOWNLOAD + COPY TEXT (full quality).
function _isPhone(){
  if(navigator.userAgentData && navigator.userAgentData.mobile) return true;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints>1 && /Mac/i.test(navigator.platform)); // iPadOS
}

function _showPrePlanModal(url){
  closePrePlanModal();
  const phone=_isPhone();
  const ov=document.createElement('div');
  ov.id='pp-ov';
  ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  const steps=phone
    ? `<b>📱 On your phone:</b> tap <b>SHARE</b> → choose <b>WhatsApp</b> → pick the group → send. The picture and the message go together.`
    : `<b>💻 On a computer</b> (WhatsApp Web / Desktop), so the picture stays sharp:<br>
       1. Click <b>COPY TEXT</b> (copies the message).<br>
       2. Click <b>DOWNLOAD</b> (saves the picture).<br>
       3. In the WhatsApp group click the <b>📎 paperclip → Document</b> → choose the downloaded picture, paste the message (Ctrl+V) in the caption box and send.<br>
       <span style="color:var(--txt3)">(Pasting the picture straight into WhatsApp Web makes it blurry.)</span>`;
  ov.innerHTML=`<div style="background:var(--surf);border-radius:12px;max-width:min(1100px,96vw);max-height:94vh;display:flex;flex-direction:column;padding:14px 16px;gap:10px;box-shadow:0 10px 40px rgba(0,0,0,.4)">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="font-family:var(--cond);font-weight:700;letter-spacing:2px;font-size:13px">📸 PRE-PLAN SNAPSHOT</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${phone
          ? '<button class="btn btn-amber" onclick="sharePrePlanImage()">📤 SHARE</button>'
          : '<button class="btn btn-amber" onclick="copyPrePlanText()">📝 COPY TEXT</button><button class="btn btn-amber" onclick="downloadPrePlanImage()">⬇ DOWNLOAD</button>'}
        <button class="btn btn-ghost" onclick="closePrePlanModal()">✕ CLOSE</button>
      </div>
    </div>
    <div style="font-size:11px;line-height:1.6;color:var(--txt2);background:var(--surf2);border:1px solid var(--b);border-radius:8px;padding:8px 10px">${steps}</div>
    <pre id="pp-msg" style="margin:0;padding:8px 10px;background:var(--surf2);border:1px solid var(--b);border-radius:8px;font-family:var(--mono);font-size:11px;white-space:pre-wrap">${prePlanMessage()}</pre>
    <div style="overflow:auto;border:1px solid var(--b);border-radius:8px;background:#fff"><img src="${url}" alt="Pre-plan snapshot" style="display:block;max-width:100%;height:auto"></div>
  </div>`;
  ov.addEventListener('mousedown',e=>{ if(e.target===ov) closePrePlanModal(); });
  document.body.appendChild(ov);
}
function closePrePlanModal(){ const ov=document.getElementById('pp-ov'); if(ov){ const im=ov.querySelector('img'); if(im) URL.revokeObjectURL(im.src); ov.remove(); } }

function downloadPrePlanImage(){
  const a=document.createElement('a'); a.href=URL.createObjectURL(_ppBlob); a.download=_ppName; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000);
  showToast('Picture downloaded — attach it in WhatsApp as a Document','ok',4000);
}
async function copyPrePlanText(){
  try{ await navigator.clipboard.writeText(prePlanMessage()); showToast('Message copied — paste it in the caption','ok',3000); }
  catch(e){ const t=document.getElementById('pp-msg'); if(t){ const r=document.createRange(); r.selectNodeContents(t); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); } showToast('Message selected — press Ctrl+C to copy it','ok',3500); }
}
async function sharePrePlanImage(){
  const file=new File([_ppBlob],_ppName,{type:'image/png'});
  try{
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],text:prePlanMessage()}); return; }
    showToast('Sharing pictures is not supported here — use DOWNLOAD','err',4000);
  }catch(e){ if(e.name!=='AbortError') showToast('Share failed — try DOWNLOAD','err',3500); }
}
