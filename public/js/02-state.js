// ═══════════════════════════════════
// STATE
// ═══════════════════════════════════
const S = {
  cfg: {
    // API key removed — the backend proxies Google Sheets now (key lives in .env)
    sid:'1bdJVm15vGk7Av-LMxSbsj0mbUK8ln9x-gvMW5tTubpg',
    tab:'KUL/0526/R0'
  },
  sheetConfigs: {}, // keyed by MMYY e.g. "0526" → { sid, tab }
  staff: [],
  overrides: {},
  nicknames: {}, // id → custom nickname, persisted to localStorage
  debug: {},
  swaps: [],
  transfers: [],
  backups: { lo:[], irreg:[], wo:[], cim:[], moc:[] },
  towers: {
    permanent: [
      {name:'FIKRI',   status:'AVAIL'},
      {name:'ZAFFAR',  status:'AVAIL'},
      {name:'SYAHRIN', status:'AVAIL'},
      {name:'KHAIRI',  status:'AVAIL'},
      {name:'FIRDAUS', status:'AVAIL'},
      {name:'LUQMAN',  status:'AVAIL'},
    ],
    backups: []
  },
  trainees: {
    permanent: [], // [{name, status}] — saved to localStorage
    backups:   []
  },
  roles: {
    mocChaser: '',
    mojo: ['', '', ''],
    wc: [{ primary:'', asst:'' }, { primary:'', asst:'' }],
    runners: [
      { name:'', timing:'0700-1300' },
      { name:'', timing:'0700-1300' },
      { name:'', timing:'1300-1900' },
      { name:'', timing:'1300-1900' }
    ],
    towerSlots: [
      { a:'', b:'', backup:'' },
      { a:'', b:'', backup:'' },
      { a:'', b:'', backup:'' },
      { a:'', b:'', backup:'' }
    ]
  },
  ssTechs: [],  // staff IDs of LO TECH marked as SS (earlier shift)
  actingGL: { lo:'', irreg:'', wo:'', cim:'' }, // manually appointed acting GLs
  exclusions: [], // staff IDs permanently excluded from all lists
  soc: [{ flight:'', name:'', time:'', remark:'' }],
  pdsc: [{ reg:'', certifier:'' }],
  fgs:  [{ reg:'', remark:'' }],
  ops: { ARR:'', DEP:'', TOW:'' },
  tab: 'lo',
  loaded: false,
  engSpecialists: []  // staff IDs for ENG SPECIALIST TEAM in the selected shift
};

// ═══════════════════════════════════
// ENG SPECIALIST TEAM — per-shift IDs
// (identified from KUL/0626/R0)
// ═══════════════════════════════════
const ENG_SPECIALISTS = {
  A: ['M04675','M10856','M10852','M03615','M04486'],
  B: ['M10849','M13024','M11053','M13294','M06592'],
  C: ['M11669','M11499','M10857','M05984','M07046'],
  D: ['M13189','M13410','M12454','M10855','M02284']
};
function loadEngSpecialists(){
  const g = (document.getElementById('shift-group-sel')?.value||'C').toUpperCase();
  S.engSpecialists = ENG_SPECIALISTS[g] || [];
}

