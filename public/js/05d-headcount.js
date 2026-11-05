// Headcount maths: category normalising, fractional (part-shift) counting. Pure functions — covered by tests/logic.test.js.
// Split out of 05-render.js.

function normCat(pos){
  const p=pos.toUpperCase();
  if(p.includes('LAE B1')||p==='TECH B1') return 'LAE B1';
  if(p.includes('LAE B2')||p==='TECH B2') return 'LAE B2';
  if(p==='LAT') return 'LAT';
  if(p==='GL') return 'GL';
  return 'TECH';
}
// Returns the fraction of the 12-hour shift a manual backup covers based on their RPT time.
// DAY shift = 0600-1800, NIGHT shift = 1800-0600. Returns 1 if no time set or time is invalid.
// Sum headcount for a staff list: each person counts 1, or their _fraction when they only cover
// part of the shift (manual backup RPT / bounded window / half-shift). People already assigned
// to a role (their displayName is in `assigned`) are excluded. Returns a tidy string: "6", "5.5", "5.42".
function sumHeadcount(list, assigned){
  let t=0;
  list.filter(s=>!assigned.has(displayName(s))).forEach(s=>{ t+=(s._fraction!==undefined)?s._fraction:1; });
  const r=Math.round(t*100)/100;
  return Number.isInteger(r)?String(r):r.toFixed(2).replace(/\.?0+$/,'');
}

// A manual backup's time field can be either:
//   "0800"        — single report time: reports late, stays till shift end
//   "1900-0100"   — bounded window: only present for this exact span
//                   (e.g. reports late AND leaves early), regardless of shift end
function isBkRange(time){ return /^\d{3,4}\s*-\s*\d{3,4}$/.test((time||'').trim()); }

function bkFraction(b){
  if(!b.time||b.mcEl) return 1;
  const shType=(document.getElementById('shift-sel')?.value||'DAY').toUpperCase();
  const startMin=shType==='NIGHT'?18*60:6*60;
  const endMin=startMin+720; // 12h shift window, in minutes-of-day (extends past 1440 for NIGHT)

  const rangeMatch=b.time.trim().match(/^(\d{3,4})\s*-\s*(\d{3,4})$/);
  if(rangeMatch){
    const toMin=t=>{ const s=t.padStart(4,'0'); return parseInt(s.slice(0,2),10)*60+parseInt(s.slice(2,4),10); };
    let from=toMin(rangeMatch[1]), to=toMin(rangeMatch[2]);
    if(shType==='NIGHT'){
      if(from<12*60) from+=24*60;   // after-midnight side of a night shift
      if(to<=12*60)  to+=24*60;
    }
    if(to<=from) to+=24*60; // window rolls past midnight (e.g. 1900-0100)
    const dur=Math.min(to,endMin)-Math.max(from,startMin);
    if(dur<=0) return 0;
    if(dur>=720) return 1;
    return Math.round(dur/720*100)/100;
  }

  // Single report time — reports late, stays till shift end
  const tStr=b.time.replace(/[^0-9]/g,'').padStart(4,'0');
  const rptH=parseInt(tStr.slice(0,2),10), rptM=parseInt(tStr.slice(2,4),10);
  if(isNaN(rptH)||isNaN(rptM)||rptH>23||rptM>59) return 1;
  let rptMin=rptH*60+rptM;
  if(shType==='NIGHT'&&rptMin<12*60) rptMin+=24*60; // after-midnight RPT on night shift
  const remaining=endMin-rptMin;
  if(remaining<=0) return 0;
  if(remaining>=720) return 1;
  return Math.round(remaining/720*100)/100;
}

// Own/cross-shift roster staff can also carry a bounded working window right in their
// schedule cell, e.g. "NIGHT (0000-0700)" — meaning they're only actually present for
// that window, not the full 12h shift. Reuse bkFraction's range math by building the
// same synthetic {time:"HHMM-HHMM"} shape it already knows how to weigh.
function schedValFraction(schedVal){
  const raw=(schedVal||'').toUpperCase();
  if(/\(1\/2\)/.test(raw)) return 0.5;
  const m=raw.match(/\((\d{4})-(\d{4})\)/);
  if(!m) return 1;
  return bkFraction({time:`${m[1]}-${m[2]}`, mcEl:false});
}
