/**
 * HabitFlow Pro v3 — script.js
 * Complete Life Management System
 * Auth + Habits + Goals + Tracker + Timeline + Analytics +
 * Journal + Life Tracking + Pomodoro + Matrix + Badges + Admin
 */
'use strict';

/* ═══════════════════════════════════════════════
   1. CONSTANTS
═══════════════════════════════════════════════ */
const SK = 'hf_pro_v3';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_S = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const ACCENTS = ['#4F8EF7','#22C55E','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#EC4899','#14B8A6','#A855F7'];
const QUOTES = [
  "Small daily habits compound into extraordinary results.",
  "Consistency is the bridge between goals and accomplishments.",
  "Every action you take is a vote for who you wish to become.",
  "Discipline is choosing between what you want now vs what you want most.",
  "The secret of getting ahead is getting started.",
  "Habits are the compound interest of self-improvement.",
  "We are what we repeatedly do. Excellence is not an act but a habit.",
  "Build systems, not just goals. Systems deliver results.",
  "Your future is created by what you do today, not tomorrow.",
  "Motivation fades. Habits endure.",
];
const MOOD_MAP = {5:{e:'😄',l:'Amazing'},4:{e:'😊',l:'Good'},3:{e:'😐',l:'Okay'},2:{e:'😔',l:'Sad/Angry'},1:{e:'😴',l:'Tired'},0:{e:'😤',l:'Stressed'}};
const CAT_COLORS = {health:'#22C55E',fitness:'#4F8EF7',learning:'#8B5CF6',mindfulness:'#14B8A6',work:'#F59E0B',social:'#EC4899',finance:'#F97316',other:'#94A3B8'};
const BADGE_DEFS = [
  {id:'first_habit',ico:'🌱',name:'First Step',desc:'Add your first habit',check:s=>s.habits.length>=1},
  {id:'three_habits',ico:'🌿',name:'Growing',desc:'Track 3+ habits',check:s=>s.habits.length>=3},
  {id:'five_habits',ico:'🌳',name:'Committed',desc:'Track 5+ habits',check:s=>s.habits.length>=5},
  {id:'streak_3',ico:'🔥',name:'On Fire',desc:'3-day all-habit streak',check:s=>streaks(s).cur>=3},
  {id:'streak_7',ico:'🚀',name:'Weekly Warrior',desc:'7-day streak',check:s=>streaks(s).cur>=7},
  {id:'streak_30',ico:'⚡',name:'Monthly Master',desc:'30-day streak',check:s=>streaks(s).cur>=30},
  {id:'perfect_day',ico:'✨',name:'Perfect Day',desc:'Complete all habits',check:s=>hasPerfectDay(s)},
  {id:'perfect_week',ico:'🏅',name:'Perfect Week',desc:'7 perfect days in a row',check:s=>hasPerfectWeek(s)},
  {id:'goal_done',ico:'🎯',name:'Goal Crusher',desc:'Complete a goal',check:s=>s.goals.some(g=>parseInt(g.progress||0)>=100)},
  {id:'pomo_5',ico:'⏱️',name:'Focus Master',desc:'5 Pomodoro sessions',check:s=>s.pomoSessions>=5},
  {id:'journal_7',ico:'📖',name:'Consistent Mind',desc:'Journal 7 days',check:s=>Object.keys(s.journal).length>=7},
  {id:'xp_500',ico:'🏆',name:'Elite',desc:'Earn 500 XP',check:s=>s.xp>=500},
];

/* ═══════════════════════════════════════════════
   2. STATE
═══════════════════════════════════════════════ */
let DB = {
  users: [
    {id:'admin',name:'Admin',username:'admin',password:'admin123',role:'admin'},
    {id:'u1',name:'User',username:'user',password:'user123',role:'user'},
  ],
  habits:{}, records:{}, journal:{}, life:{}, goals:{}, todos:[], matrix:{do:[],schedule:[],delegate:[],eliminate:[]},
  xp:{}, level:{}, earnedBadges:{}, pomoSessions:{},
  editRequests:[], changeLogs:[],
  theme:'light',
};
let CU = null; // current user
let appState = {
  selMonth: new Date().getMonth(), selYear: new Date().getFullYear(),
  editHabitId: null, editGoalId: null, journalDate: null, lifeDate: null,
  selMood: null, selColor: ACCENTS[0],
  pendingCell: null,
  pomoTotal: 1500, pomoLeft: 1500, pomoRunning: false, pomoTimer: null, pomoPhase: 'Focus',
  anaFilter: 'month', adminTab: 'requests',
};

/* ═══════════════════════════════════════════════
   3. HELPERS
═══════════════════════════════════════════════ */
const $  = id => document.getElementById(id);
const $q = s  => document.querySelector(s);
const $a = s  => document.querySelectorAll(s);
const uid= ()=> Math.random().toString(36).slice(2,11);
const dIM= (m,y)=>new Date(y,m+1,0).getDate();
const tod= ()=>{const d=new Date();return{d:d.getDate(),m:d.getMonth(),y:d.getFullYear()}};
const t2m= t=>{ if(!t)return null; const[h,mn]=t.split(':').map(Number); return h*60+mn; };
const m2d= m=>{ const h=Math.floor(m/60)%24,mn=m%60,ap=h<12?'AM':'PM',hh=h%12||12; return `${hh}:${String(mn).padStart(2,'0')} ${ap}`; };
const rk = (hid,y,m,d)=>`${hid}_${y}_${String(m+1).padStart(2,'0')}_${String(d).padStart(2,'0')}`;
const dk = (y,m,d)=>`${y}_${String(m+1).padStart(2,'0')}_${String(d).padStart(2,'0')}`;
const esc= s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const cPct= p=>p>=80?'var(--ok)':p>=50?'var(--warn)':'var(--err)';
const uid_user= ()=> CU ? CU.id : 'guest';

function getRec(hid,y,m,d){ return ((DB.records[uid_user()]||{})[rk(hid,y,m,d)])||0; }
function setRec(hid,y,m,d,v){
  if(!DB.records[uid_user()]) DB.records[uid_user()]={};
  const k=rk(hid,y,m,d);
  if(v===0) delete DB.records[uid_user()][k]; else DB.records[uid_user()][k]=v;
}
function getHabits(){ return DB.habits[uid_user()]||[]; }
function getGoals(){ return DB.goals[uid_user()]||[]; }
function getTodos(){ return DB.todos[uid_user()]||[]; }
function getMatrix(){ return DB.matrix[uid_user()]||{do:[],schedule:[],delegate:[],eliminate:[]}; }
function getJournal(){ return DB.journal[uid_user()]||{}; }
function getLife(){ return DB.life[uid_user()]||{}; }
function getXP(){ return DB.xp[uid_user()]||0; }
function addXP(n){ DB.xp[uid_user()]=(getXP()+n); save(); updateXPBar(); }
function getPomoSessions(){ return DB.pomoSessions[uid_user()]||0; }
function getBadges(){ return DB.earnedBadges[uid_user()]||[]; }

function isPast(y,m,d){ const t=tod(); return y<t.y||(y===t.y&&m<t.m)||(y===t.y&&m===t.m&&d<t.d); }
function isToday(y,m,d){ const t=tod(); return d===t.d&&m===t.m&&y===t.y; }
function isFuture(y,m,d){ const t=tod(); return y>t.y||(y===t.y&&m>t.m)||(y===t.y&&m===t.m&&d>t.d); }

/* ═══════════════════════════════════════════════
   4. PERSISTENCE  (MERN — API-backed)
═══════════════════════════════════════════════ */
let _saveDbc;
function save(){
  // Always keep a localStorage cache as fallback
  try{ localStorage.setItem(SK,JSON.stringify(DB)); }catch(e){}
  // Debounce the server sync (800 ms)
  clearTimeout(_saveDbc);
  _saveDbc=setTimeout(()=>{
    if(window.HFApi&&window.HFApi.getToken()){
      window.HFApi.saveState(DB).catch(err=>console.warn('[HF] Sync failed:',err));
    }
  },800);
}
function load(){
  // Server is the source of truth; localStorage is just a boot cache
  try{
    const r=localStorage.getItem(SK);
    if(r){ const d=JSON.parse(r); DB={...DB,...d}; }
  }catch(e){}
}

/* ═══════════════════════════════════════════════
   5. TOAST
═══════════════════════════════════════════════ */
let _tt;
function toast(msg,dur=2800){
  const el=$('toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(_tt); _tt=setTimeout(()=>el.classList.remove('show'),dur);
}

/* ═══════════════════════════════════════════════
   6. MODALS
═══════════════════════════════════════════════ */
function openM(id){ const m=$(id); m.classList.add('open'); m.setAttribute('aria-hidden','false'); }
function closeM(id){ const m=$(id); m.classList.remove('open'); m.setAttribute('aria-hidden','true'); }
function confirm(title,msg,icon,onY){
  $('ci-title').textContent=title; $('ci-msg').textContent=msg; $('ci-icon').textContent=icon;
  openM('confirm-modal');
  const ok=$('ci-ok'),cc=$('ci-cancel');
  const nok=ok.cloneNode(true),ncc=cc.cloneNode(true);
  ok.replaceWith(nok); cc.replaceWith(ncc);
  $('ci-ok').addEventListener('click',()=>{ closeM('confirm-modal'); onY(); });
  $('ci-cancel').addEventListener('click',()=>closeM('confirm-modal'));
}

/* ═══════════════════════════════════════════════
   7. AUTH  (MERN — async API calls)
═══════════════════════════════════════════════ */
function _showLoginErr(msg){ const e=$('login-err'); e.textContent=msg; e.classList.remove('hidden'); }
function _showRegErr(msg){ const e=$('reg-err'); e.textContent=msg; e.classList.remove('hidden'); }

function initAuth(){
  // ── Login ────────────────────────────────────────────────────────────────
  $('btn-login').addEventListener('click',async()=>{
    const u=$('login-user').value.trim(), p=$('login-pass').value.trim();
    if(!u||!p){ _showLoginErr('Username and password are required.'); return; }
    const btn=$('btn-login');
    btn.disabled=true; btn.textContent='Signing in…';
    try{
      const res=await window.HFApi.login(u,p);
      btn.disabled=false; btn.textContent='Login →';
      if(res.error){ _showLoginErr(res.error); return; }
      $('login-err').classList.add('hidden');
      window.HFApi.setToken(res.token);
      DB={...DB,...res.db};
      try{ localStorage.setItem(SK,JSON.stringify(DB)); }catch(e){}
      loginUser(res.user);
    }catch(err){
      btn.disabled=false; btn.textContent='Login →';
      _showLoginErr('Could not connect to server. Is the backend running on port 5000?');
    }
  });
  $('login-pass').addEventListener('keydown',e=>{ if(e.key==='Enter') $('btn-login').click(); });

  // ── Register ─────────────────────────────────────────────────────────────
  $('btn-register').addEventListener('click',async()=>{
    const name=$('reg-name').value.trim(), u=$('reg-user').value.trim(), p=$('reg-pass').value.trim();
    if(!name||!u||!p){ _showRegErr('All fields required.'); return; }
    const btn=$('btn-register');
    btn.disabled=true; btn.textContent='Creating account…';
    try{
      const res=await window.HFApi.register(name,u,p);
      btn.disabled=false; btn.textContent='Create Account →';
      if(res.error){ _showRegErr(res.error); return; }
      $('reg-err').classList.add('hidden');
      window.HFApi.setToken(res.token);
      DB={...DB,...res.db};
      try{ localStorage.setItem(SK,JSON.stringify(DB)); }catch(e){}
      loginUser(res.user);
    }catch(err){
      btn.disabled=false; btn.textContent='Create Account →';
      _showRegErr('Could not connect to server. Is the backend running on port 5000?');
    }
  });

  // ── Tab switching ─────────────────────────────────────────────────────────
  $a('.auth-tab').forEach(t=>t.addEventListener('click',()=>{
    $a('.auth-tab').forEach(x=>x.classList.remove('active'));
    $a('.auth-form-wrap').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    $('tab-'+t.dataset.tab).classList.add('active');
  }));

  $('btn-logout').addEventListener('click',logout);
}

function loginUser(user){
  CU=user;
  $('auth-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
  // Initialize user data if first time
  if(!DB.habits[CU.id]) DB.habits[CU.id]=getDefaultHabits();
  if(!DB.records[CU.id]) DB.records[CU.id]={};
  if(!DB.goals[CU.id]) DB.goals[CU.id]=[];
  if(!DB.todos[CU.id]) DB.todos[CU.id]=[];
  if(!DB.matrix[CU.id]) DB.matrix[CU.id]={do:[],schedule:[],delegate:[],eliminate:[]};
  if(!DB.journal[CU.id]) DB.journal[CU.id]={};
  if(!DB.life[CU.id]) DB.life[CU.id]={};
  if(!DB.xp[CU.id]) DB.xp[CU.id]=0;
  if(!DB.earnedBadges[CU.id]) DB.earnedBadges[CU.id]=[];
  if(!DB.pomoSessions[CU.id]) DB.pomoSessions[CU.id]=0;
  save(); initApp();
}

function logout(){
  const doLogout=()=>{
    CU=null;
    if(window.HFApi) window.HFApi.clearToken();
    localStorage.removeItem('hf_session');
    $('auth-screen').classList.remove('hidden');
    $('app').classList.add('hidden');
    $('login-user').value=''; $('login-pass').value='';
  };
  if(window.HFApi&&window.HFApi.getToken()){
    window.HFApi.logout().finally(doLogout);
  } else {
    doLogout();
  }
}

function getDefaultHabits(){
  return [
    {id:uid(),name:'Exercise',emoji:'💪',category:'fitness',priority:'high',color:ACCENTS[0],desc:'',notes:'Push-ups, squats, cardio',startTime:'07:00',endTime:'07:45',reminder:10,repeat:'daily'},
    {id:uid(),name:'Read Book',emoji:'📚',category:'learning',priority:'medium',color:ACCENTS[1],desc:'',notes:'30 min minimum',startTime:'21:00',endTime:'21:30',reminder:10,repeat:'daily'},
    {id:uid(),name:'Meditation',emoji:'🧘',category:'mindfulness',priority:'medium',color:ACCENTS[4],desc:'',notes:'Deep breathing focus',startTime:'06:30',endTime:'07:00',reminder:5,repeat:'daily'},
    {id:uid(),name:'Drink Water',emoji:'💧',category:'health',priority:'low',color:'#06B6D4',desc:'',notes:'8 glasses',startTime:'',endTime:'',reminder:0,repeat:'daily'},
    {id:uid(),name:'Coding',emoji:'💻',category:'work',priority:'high',color:ACCENTS[2],desc:'',notes:'Build projects daily',startTime:'20:00',endTime:'22:00',reminder:15,repeat:'weekdays'},
  ];
}

/* ═══════════════════════════════════════════════
   8. APP INIT
═══════════════════════════════════════════════ */
function initApp(){
  applyTheme(); updateClock(); updateGreeting();
  renderSidebarUser(); updateXPBar();
  renderSelectors(); renderTracker(); updateDashboard();
  renderTimeline(); renderGoals(); renderTodos(); renderMatrix();
  renderJournal(); renderLife(); renderBadges();
  // Show admin button only for admin
  const adminBtn=$('btn-admin-panel')||$('btn-admin');
  if(adminBtn) adminBtn.style.display = CU&&CU.role==='admin'?'inline-flex':'none';
  setTimeout(showDailyReminder, 4000);
  checkBadges();
}

function renderSidebarUser(){
  $('sidebar-user').innerHTML=`<div class="su-name">${esc(CU.name)}</div><div class="su-role">${CU.role==='admin'?'🛡️ Admin':'👤 User'} · ${esc(CU.username)}</div>`;
}

/* ═══════════════════════════════════════════════
   9. THEME & CLOCK
═══════════════════════════════════════════════ */
function applyTheme(){
  document.documentElement.setAttribute('data-theme',DB.theme);
  $('theme-tog').classList.toggle('on',DB.theme==='dark');
}
function toggleTheme(){ DB.theme=DB.theme==='light'?'dark':'light'; applyTheme(); save(); }

function updateClock(){
  const n=new Date();
  const hh=String(n.getHours()).padStart(2,'0'),mm=String(n.getMinutes()).padStart(2,'0'),ss=String(n.getSeconds()).padStart(2,'0');
  $('clock').textContent=`${hh}:${mm}:${ss}`;
  $('tdate').textContent=n.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
function updateGreeting(){
  const h=new Date().getHours();
  let g='Good Morning'; if(h>=12&&h<17)g='Good Afternoon'; else if(h>=17)g='Good Evening';
  $('greet').textContent=g+' 👋';
  const day=Math.floor((new Date()-new Date(new Date().getFullYear(),0,0))/86400000);
  $('quote').textContent='"'+QUOTES[day%QUOTES.length]+'"';
}

/* ═══════════════════════════════════════════════
   10. NAVIGATION
═══════════════════════════════════════════════ */
function goTo(s){
  $a('.sec').forEach(x=>x.classList.remove('active'));
  $('sec-'+s).classList.add('active');
  $a('.nav-i').forEach(n=>n.classList.toggle('active',n.dataset.s===s));
  if(window.innerWidth<=768) $('sidebar').classList.remove('open');
  if(s==='analytics') renderAnalytics();
  if(s==='badges') renderBadges();
  if(s==='journal') renderJournal();
  if(s==='life') renderLife();
  if(s==='tracker'){ renderSelectors(); renderTracker(); }
  if(s==='timeline') renderTimeline();
  if(s==='goals') renderGoals();
  if(s==='todo') renderTodos();
  if(s==='matrix') renderMatrix();
}

/* ═══════════════════════════════════════════════
   11. SELECTORS
═══════════════════════════════════════════════ */
function renderSelectors(){
  const ms=$('mon-sel'),ys=$('yr-sel');
  if(!ms||!ys) return;
  ms.innerHTML=MONTHS.map((m,i)=>`<option value="${i}" ${i===appState.selMonth?'selected':''}>${m}</option>`).join('');
  const cy=new Date().getFullYear();
  ys.innerHTML=Array.from({length:6},(_,i)=>cy-2+i).map(y=>`<option value="${y}" ${y===appState.selYear?'selected':''}>${y}</option>`).join('');
  const lbl=$('tracker-lbl'); if(lbl) lbl.textContent=`${MONTHS[appState.selMonth]} ${appState.selYear}`;
  const dl=$('dash-month-lbl'); if(dl) dl.textContent=`${MONTHS[appState.selMonth]} ${appState.selYear}`;
}

/* ═══════════════════════════════════════════════
   12. SWATCH SETUP
═══════════════════════════════════════════════ */
function setupSwatches(containerId){
  const c=$(containerId);
  if(!c) return;
  c.innerHTML=ACCENTS.map(a=>`<span class="sw ${a===appState.selColor?'on':''}" data-color="${a}" style="background:${a}"></span>`).join('');
  c.addEventListener('click',e=>{
    const sw=e.target.closest('.sw'); if(!sw) return;
    c.querySelectorAll('.sw').forEach(s=>s.classList.remove('on'));
    sw.classList.add('on'); appState.selColor=sw.dataset.color;
  });
}

/* ═══════════════════════════════════════════════
   13. HABIT MODAL
═══════════════════════════════════════════════ */
function openHabitModal(id=null){
  appState.editHabitId=id;
  $('hm-title').textContent=id?'Edit Habit':'Add Habit';
  appState.selColor=ACCENTS[getHabits().length%ACCENTS.length];
  if(id){
    const h=getHabits().find(x=>x.id===id);
    if(h){
      $('hm-name').value=h.name; $('hm-emoji').value=h.emoji||'';
      $('hm-category').value=h.category||'health'; $('hm-priority').value=h.priority||'medium';
      $('hm-freq').value=h.repeat||'daily'; $('hm-notes').value=h.notes||'';
      $('hm-start').value=h.startTime||''; $('hm-end').value=h.endTime||'';
      $('hm-reminder').value=h.reminder||0; appState.selColor=h.color||ACCENTS[0];
    }
  } else {
    ['hm-name','hm-emoji','hm-notes','hm-start','hm-end'].forEach(id=>$(id).value='');
    $('hm-category').value='health'; $('hm-priority').value='medium';
    $('hm-freq').value='daily'; $('hm-reminder').value=10;
  }
  setupSwatches('hm-swatches');
  openM('habit-modal'); setTimeout(()=>$('hm-name').focus(),100);
}

function saveHabit(){
  const name=$('hm-name').value.trim();
  if(!name){ toast('⚠️ Habit name required'); return; }
  const data={name,emoji:$('hm-emoji').value.trim()||'🎯',category:$('hm-category').value,priority:$('hm-priority').value,
    notes:$('hm-notes').value.trim(),startTime:$('hm-start').value,endTime:$('hm-end').value,
    reminder:parseInt($('hm-reminder').value)||0,repeat:$('hm-freq').value,color:appState.selColor};
  if(appState.editHabitId){
    const i=DB.habits[CU.id].findIndex(x=>x.id===appState.editHabitId);
    if(i>=0) DB.habits[CU.id][i]={...DB.habits[CU.id][i],...data};
    toast('✅ Habit updated!');
  } else {
    DB.habits[CU.id].push({id:uid(),...data});
    addXP(10); toast('✅ Habit added!');
  }
  closeM('habit-modal'); save(); renderTracker(); updateDashboard(); checkBadges();
}

function deleteHabit(id){
  const h=getHabits().find(x=>x.id===id); if(!h) return;
  confirm('Delete Habit',`Delete "${h.name}"? All data lost.`,'🗑️',()=>{
    DB.habits[CU.id]=DB.habits[CU.id].filter(x=>x.id!==id);
    const recs=DB.records[CU.id]||{};
    Object.keys(recs).filter(k=>k.startsWith(id)).forEach(k=>delete recs[k]);
    save(); renderTracker(); updateDashboard(); toast('🗑️ Deleted');
  });
}

/* ═══════════════════════════════════════════════
   14. TRACKER
═══════════════════════════════════════════════ */
function renderTracker(){
  const m=appState.selMonth,y=appState.selYear;
  const days=dIM(m,y), t=tod();
  const search=($('search').value||'').toLowerCase();
  const catF=($('cat-sel')?$('cat-sel').value:'');
  const statF=($('filter-sel')?$('filter-sel').value:'all');
  const pillF=($q('.filter-pills .pill.active')||{}).dataset?.pf||'all';

  // Build head
  const hr=$('tbl-head');
  let heads=`<th class="th-habit">Habit <span style="font-size:10px;opacity:.5;cursor:help" title="✅ done → ❌ missed → ⏳ pending → clear. Past = 🔒">ℹ️</span></th>`;
  for(let d=1;d<=days;d++){
    const dow=new Date(y,m,d).getDay();
    const isSun=dow===0, isTod=isToday(y,m,d);
    heads+=`<th class="${isSun?'col-sun':''} ${isTod?'col-today':''}" style="min-width:38px"><span style="display:block;font-size:12px;font-weight:700">${d}</span><span style="font-size:9px;opacity:.65">${DAYS_S[dow]}</span></th>`;
  }
  heads+=`<th style="min-width:36px;font-size:10px;color:var(--tm);padding:4px 6px">%</th>`;
  hr.innerHTML=heads;

  // Filter habits
  const habits=getHabits().filter(h=>{
    if(search && !h.name.toLowerCase().includes(search) && !h.emoji.includes(search)) return false;
    if(catF && h.category!==catF) return false;
    if(pillF==='high'&&h.priority!=='high') return false;
    if(pillF==='medium'&&h.priority!=='medium') return false;
    if(pillF==='low'&&h.priority!=='low') return false;
    return true;
  });

  const tbody=$('tbl-body'); tbody.innerHTML='';

  habits.forEach(h=>{
    const tr=document.createElement('tr');
    // Habit cell
    const tdH=document.createElement('td'); tdH.className='td-habit';
    const timeStr=h.startTime?m2d(t2m(h.startTime)):'';
    tdH.innerHTML=`<div class="hc">
      <span class="hc-em">${esc(h.emoji)}</span>
      <div class="hc-nw">
        <div class="hc-name" title="${esc(h.name)}">${esc(h.name)}</div>
        ${timeStr?`<div class="hc-time">⏰ ${timeStr}</div>`:''}
      </div>
      ${h.notes?`<div class="hc-note-tip">📝 ${esc(h.notes)}</div>`:''}
      <div class="hc-acts">
        <button class="hc-btn" data-act="edit" data-id="${h.id}" title="Edit">✏️</button>
        <button class="hc-btn del" data-act="del" data-id="${h.id}" title="Delete">🗑️</button>
      </div>
    </div>`;
    tr.appendChild(tdH);

    let done=0,missed=0;
    for(let d=1;d<=days;d++){
      const v=getRec(h.id,y,m,d);
      const past=isPast(y,m,d), today_=isToday(y,m,d), future_=isFuture(y,m,d);
      // Status filter
      if(statF==='completed'&&v!==1&&!today_){ const td=document.createElement('td'); td.className='td-day'; td.innerHTML=`<div class="dc" style="opacity:.25">—</div>`; tr.appendChild(td); continue; }
      if(statF==='missed'&&v!==2&&!today_){ const td=document.createElement('td'); td.className='td-day'; td.innerHTML=`<div class="dc" style="opacity:.25">—</div>`; tr.appendChild(td); continue; }
      if(statF==='pending'&&v!==3&&!today_){ const td=document.createElement('td'); td.className='td-day'; td.innerHTML=`<div class="dc" style="opacity:.25">—</div>`; tr.appendChild(td); continue; }
      const td=document.createElement('td'); td.className='td-day';
      let cls='dc', ico='';
      if(today_) cls+=' today-ring';
      if(v===1){cls+=' done';ico='✓';done++;}
      else if(v===2){cls+=' missed';ico='✗';missed++;}
      else if(v===3){cls+=' pending';ico='⏳';}
      else if(future_) cls+=' future';
      if(past&&!today_) cls+=' locked';
      const lockIco=(past&&!today_)?'<span class="lock-ico">🔒</span>':'';
      td.innerHTML=`<div class="${cls}" data-hid="${h.id}" data-d="${d}" role="button" tabindex="0">${ico}${lockIco}</div>`;
      tr.appendChild(td);
    }
    const pct=days>0?Math.round((done/days)*100):0;
    const tdP=document.createElement('td'); tdP.className='row-pct'; tdP.style.color=cPct(pct); tdP.textContent=pct+'%';
    tr.appendChild(tdP);
    tbody.appendChild(tr);
  });

  if(!habits.length){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td colspan="100" class="empty-msg" style="padding:40px">No habits match your filters.</td>`;
    tbody.appendChild(tr);
  }
}

function handleCellClick(e){
  const btn=e.target.closest('[data-act]');
  if(btn){ const{act,id}=btn.dataset; if(act==='edit')openHabitModal(id); if(act==='del')deleteHabit(id); return; }
  const cell=e.target.closest('.dc'); if(!cell) return;
  const hid=cell.dataset.hid, d=parseInt(cell.dataset.d);
  const m=appState.selMonth,y=appState.selYear;
  if(isPast(y,m,d)&&!isToday(y,m,d)){
    appState.pendingCell={hid,y,m,d};
    $('er-reason').value=''; openM('editreq-modal'); return;
  }
  const cur=getRec(hid,y,m,d);
  const next=(cur+1)%4;
  setRec(hid,y,m,d,next);
  if(next===1) addXP(5);
  save(); renderTracker(); updateDashboard(); checkBadges(); checkMilestones();
}

/* ═══════════════════════════════════════════════
   15. DASHBOARD
═══════════════════════════════════════════════ */
function updateDashboard(){
  const m=appState.selMonth,y=appState.selYear;
  const t=tod(), days=dIM(m,y), habits=getHabits();
  renderSelectors();

  // Today
  const todayDone=habits.filter(h=>getRec(h.id,t.y,t.m,t.d)===1).length;
  const todayPct=habits.length>0?Math.round((todayDone/habits.length)*100):0;
  $('ring-pct').textContent=todayPct+'%';
  $('ring-prog').style.strokeDashoffset=314-(todayPct/100)*314;
  $('sd-done').textContent=`${todayDone}/${habits.length}`;

  // Scores
  $('sc-today').textContent=todayPct+'%'; $('sc-today-bar').style.width=todayPct+'%';
  const {weekPct,monthPct,avgPct}=calcScores(habits,m,y);
  $('sc-week').textContent=weekPct+'%'; $('sc-week-bar').style.width=weekPct+'%';
  $('sc-month').textContent=monthPct+'%'; $('sc-month-bar').style.width=monthPct+'%';
  $('sc-avg').textContent=avgPct+'%'; $('sc-avg-bar').style.width=avgPct+'%';

  // Stats
  $('sd-total').textContent=habits.length;
  const {cur,best}=streaks(DB);
  $('sd-streak').textContent=cur; $('sd-best').textContent=best;
  let missed=0; habits.forEach(h=>{ for(let d=1;d<=days;d++) if(getRec(h.id,y,m,d)===2)missed++; });
  $('sd-missed').textContent=missed;
  $('sd-goals').textContent=getGoals().filter(g=>parseInt(g.progress||0)<100).length;

  // Moti banner
  const banner=$('moti-banner');
  if(todayPct===100&&habits.length>0){ banner.textContent='🎉 PERFECT! All habits done today! You\'re incredible!'; banner.classList.remove('hidden'); }
  else if(todayPct>=75){ banner.textContent=`💪 Great! ${todayPct}% done today — almost perfect!`; banner.classList.remove('hidden'); }
  else banner.classList.add('hidden');

  renderUpcoming(); renderDashProgress(); renderLifeSnapshot();
}

function calcScores(habits,m,y){
  const t=tod(), days=dIM(m,y);
  let md=0,mt=0; habits.forEach(h=>{ for(let d=1;d<=days;d++){if(getRec(h.id,y,m,d)===1)md++; mt++;} });
  const monthPct=mt>0?Math.round((md/mt)*100):0;
  // Weekly
  const now=new Date(); const ws=new Date(now); ws.setDate(now.getDate()-now.getDay());
  let wd=0,wt=0;
  for(let i=0;i<7;i++){const dd=new Date(ws);dd.setDate(ws.getDate()+i);habits.forEach(h=>{if(getRec(h.id,dd.getFullYear(),dd.getMonth(),dd.getDate())===1)wd++;wt++;});}
  const weekPct=wt>0?Math.round((wd/wt)*100):0;
  // Avg per habit
  let sumPcts=0;
  habits.forEach(h=>{let d=0;for(let i=1;i<=days;i++)if(getRec(h.id,y,m,i)===1)d++;sumPcts+=days>0?d/days:0;});
  const avgPct=habits.length>0?Math.round((sumPcts/habits.length)*100):0;
  return {weekPct,monthPct,avgPct};
}

function streaks(db){
  const t=tod(),uid_=CU?CU.id:'guest',habits=db.habits[uid_]||[];
  if(!habits.length) return{cur:0,best:0};
  let cur=0,best=0,streak=0;
  for(let o=0;o<365;o++){
    const d=new Date(t.y,t.m,t.d-o);
    const all=habits.every(h=>(((db.records[uid_]||{})[rk(h.id,d.getFullYear(),d.getMonth(),d.getDate())])||0)===1);
    if(all){streak++;if(o===0)cur=streak;if(streak>best)best=streak;}
    else{if(o===0)cur=0;if(streak>best)best=streak;if(o>0&&cur===0)break;streak=0;}
  }
  return{cur,best};
}
function hasPerfectDay(db){ const t=tod(),uid_=CU?CU.id:'guest',h=db.habits[uid_]||[]; return h.length>0&&h.every(x=>(((db.records[uid_]||{})[rk(x.id,t.y,t.m,t.d)])||0)===1); }
function hasPerfectWeek(db){ const t=tod(),uid_=CU?CU.id:'guest',h=db.habits[uid_]||[]; for(let o=0;o<7;o++){const d=new Date(t.y,t.m,t.d-o);if(!h.length||!h.every(x=>(((db.records[uid_]||{})[rk(x.id,d.getFullYear(),d.getMonth(),d.getDate())])||0)===1))return false;} return true; }

function renderUpcoming(){
  const t=tod(), now=new Date().getHours()*60+new Date().getMinutes();
  const list=$('upcoming-list'); if(!list) return;
  const timed=getHabits().filter(h=>h.startTime&&t2m(h.startTime)>=now).sort((a,b)=>t2m(a.startTime)-t2m(b.startTime)).slice(0,5);
  if(!timed.length){ list.innerHTML='<div class="empty-msg" style="padding:16px;text-align:left;color:var(--tm);font-size:13px">No upcoming habits scheduled for today.</div>'; return; }
  list.innerHTML=timed.map(h=>`<div class="upcoming-item">
    <div class="up-time">${m2d(t2m(h.startTime))}</div>
    <div>
      <div class="up-name">${esc(h.emoji)} ${esc(h.name)}</div>
      <div class="up-cat">${h.category}</div>
    </div>
  </div>`).join('');
}

function renderDashProgress(){
  const m=appState.selMonth,y=appState.selYear,days=dIM(m,y);
  const el=$('dash-progress'); if(!el) return;
  const habits=getHabits();
  if(!habits.length){ el.innerHTML='<div class="empty-msg">No habits yet. Click "+ Add Habit"!</div>'; return; }
  el.innerHTML=habits.map(h=>{
    let done=0; for(let d=1;d<=days;d++) if(getRec(h.id,y,m,d)===1)done++;
    const pct=days>0?Math.round((done/days)*100):0;
    return `<div class="pl-item">
      <span class="pl-emoji">${esc(h.emoji)}</span>
      <div class="pl-info">
        <div class="pl-name">${esc(h.name)}</div>
        <div class="pl-meta">${h.category} · ${h.priority}${h.startTime?' · ⏰ '+m2d(t2m(h.startTime)):''}</div>
      </div>
      <div class="pl-bar-wrap"><div class="pl-bar" style="width:${pct}%;background:${h.color}"></div></div>
      <span class="pl-pct" style="color:${cPct(pct)}">${pct}%</span>
    </div>`;
  }).join('');
}

function renderLifeSnapshot(){
  const el=$('life-snapshot'); if(!el) return;
  const t=tod(); const dk_=dk(t.y,t.m,t.d);
  const lifeEntry=getLife()[dk_]; const journalEntry=getJournal()[dk_];
  const mood=lifeEntry?.mood!==undefined?MOOD_MAP[lifeEntry.mood]:null;
  const jmood=journalEntry?.mood!==undefined?MOOD_MAP[journalEntry.mood]:null;
  const energy=lifeEntry?.energy||journalEntry?.energy||null;
  const stress=lifeEntry?.stress||journalEntry?.stress||null;
  el.innerHTML=`
    <div class="ls-card"><div class="ls-icon">${mood?mood.e:jmood?jmood.e:'😶'}</div><div class="ls-val">${mood?mood.l:jmood?jmood.l:'—'}</div><div class="ls-lbl">Today's Mood</div></div>
    <div class="ls-card"><div class="ls-icon">⚡</div><div class="ls-val">${energy||'—'}</div><div class="ls-lbl">Energy Level</div></div>
    <div class="ls-card"><div class="ls-icon">😰</div><div class="ls-val">${stress||'—'}</div><div class="ls-lbl">Stress Level</div></div>`;
}

function updateXPBar(){
  if(!CU) return;
  const xp=getXP(), lvl=Math.floor(xp/100)+1, inLvl=xp%100;
  const badges=['🌱 Beginner','🌿 Learner','💪 Achiever','🔥 Warrior','⚡ Elite','🏆 Legend'];
  $('xp-lvl').textContent=`Lvl ${lvl}`; $('xp-pts').textContent=`${xp} XP`;
  $('xp-bar').style.width=inLvl+'%';
  $('xp-badge').textContent=badges[Math.min(lvl-1,badges.length-1)];
}

/* ═══════════════════════════════════════════════
   16. TIMELINE
═══════════════════════════════════════════════ */
function renderTimeline(){
  const t=tod(),now=new Date().getHours()*60+new Date().getMinutes();
  const wrap=$('timeline'), empty=$('tl-empty');
  const timed=getHabits().filter(h=>h.startTime).sort((a,b)=>t2m(a.startTime)-t2m(b.startTime));
  if(!timed.length){ if(wrap)wrap.innerHTML=''; if(empty)empty.classList.remove('hidden'); return; }
  if(empty) empty.classList.add('hidden');
  wrap.innerHTML=timed.map(h=>{
    const sm=t2m(h.startTime),em=h.endTime?t2m(h.endTime):null;
    const v=getRec(h.id,t.y,t.m,t.d);
    const done_=v===1,miss_=em&&now>em&&v===0;
    return `<div class="tl-item ${done_?'done-i':''} ${miss_?'missed-i':''}" data-tl="${h.id}">
      <div class="tl-time">${m2d(sm)}</div>
      <div class="tl-dot"></div>
      <div class="tl-info">
        <div class="tl-name">${esc(h.emoji)} ${esc(h.name)}</div>
        ${h.notes?`<div class="tl-desc">${esc(h.notes)}</div>`:''}
        ${em?`<div class="tl-desc">⏱ ${em-sm} min${h.endTime?' → '+m2d(em):''}</div>`:''}
      </div>
      ${h.endTime?`<div class="tl-time" style="color:var(--tm)">${m2d(em)}</div>`:''}
      <button class="tl-btn" data-tl-id="${h.id}">${done_?'✅ Done':'○ Mark Done'}</button>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════
   17. GOALS
═══════════════════════════════════════════════ */
function openGoalModal(id=null){
  appState.editGoalId=id;
  $('gm-title').textContent=id?'Edit Goal':'Add Goal';
  if(id){
    const g=getGoals().find(x=>x.id===id);
    if(g){ $('gm-title-input').value=g.title;$('gm-deadline').value=g.deadline||'';$('gm-emoji').value=g.emoji||'';$('gm-why').value=g.why||'';$('gm-reward').value=g.reward||''; }
  } else {
    ['gm-title-input','gm-deadline','gm-emoji','gm-why','gm-reward'].forEach(id=>$(id).value='');
  }
  openM('goal-modal'); setTimeout(()=>$('gm-title-input').focus(),100);
}

function saveGoal(){
  const title=$('gm-title-input').value.trim(); if(!title){toast('⚠️ Goal title required');return;}
  const data={title,deadline:$('gm-deadline').value,emoji:$('gm-emoji').value.trim()||'🎯',why:$('gm-why').value.trim(),reward:$('gm-reward').value.trim(),progress:0,status:'active'};
  if(appState.editGoalId){
    const i=DB.goals[CU.id].findIndex(x=>x.id===appState.editGoalId);
    if(i>=0) DB.goals[CU.id][i]={...DB.goals[CU.id][i],...data,progress:DB.goals[CU.id][i].progress};
    toast('✅ Goal updated!');
  } else {
    DB.goals[CU.id].push({id:uid(),...data}); addXP(15); toast('✅ Goal added!');
  }
  closeM('goal-modal'); save(); renderGoals(); updateDashboard(); checkBadges();
}

function renderGoals(){
  const el=$('goals-grid'); if(!el) return;
  const goals=getGoals();
  if(!goals.length){ el.innerHTML='<div class="empty-msg">No goals yet. Click "+ Add Goal" to start!</div>'; return; }
  el.innerHTML=goals.map(g=>{
    const pct=parseInt(g.progress||0), done_=pct>=100;
    const dl=g.deadline?new Date(g.deadline).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'No deadline';
    return `<div class="goal-card ${done_?'done-goal':''}">
      <div class="gc-top">
        <span class="gc-emoji">${esc(g.emoji)}</span>
        <div class="gc-acts">
          <button class="hc-btn" data-gact="edit" data-gid="${g.id}" title="Edit">✏️</button>
          <button class="hc-btn del" data-gact="del" data-gid="${g.id}" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="gc-title">${esc(g.title)}</div>
      ${g.why?`<div class="gc-why">💡 ${esc(g.why)}</div>`:''}
      <div class="gc-progress-wrap">
        <div class="gc-progress-bar-outer">
          <div class="gc-progress-bar" style="width:${pct}%;background:${done_?'var(--ok)':'var(--pri)'}"></div>
        </div>
        <div class="gc-progress-label"><span>${pct}% complete</span><input type="number" class="gc-pct-input" min="0" max="100" value="${pct}" data-update-goal="${g.id}" placeholder="%"/></div>
      </div>
      <div class="gc-deadline">📅 ${dl}</div>
      ${g.reward?`<div class="gc-reward">🎁 Reward: ${esc(g.reward)}</div>`:''}
      ${done_?`<div style="color:var(--ok);font-weight:700;font-size:13px;margin-top:8px">🏆 GOAL ACHIEVED!</div>`:''}
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════
   18. TO-DO
═══════════════════════════════════════════════ */
function renderTodos(){
  const el=$('todo-list'); if(!el) return;
  const cf=$('todo-cat-filter')?$('todo-cat-filter').value:'';
  const todos=(getTodos()||[]).filter(t=>!cf||t.cat===cf);
  if(!todos.length){ el.innerHTML='<div class="empty-msg" style="padding:24px">No tasks. Click "+ Add Task" to start!</div>'; return; }
  el.innerHTML=todos.map(t=>`
    <div class="todo-item ${t.done?'done-todo':''}" data-tid="${t.id}">
      <div class="todo-check ${t.done?'checked':''}" data-tcheck="${t.id}">${t.done?'✓':''}</div>
      <span class="todo-text">${esc(t.text)}</span>
      <span class="todo-cat-badge">${esc(t.cat||'other')}</span>
      <button class="todo-del" data-tdel="${t.id}">✕</button>
    </div>`).join('');
}

function addTodo(text,cat){
  if(!DB.todos[CU.id]) DB.todos[CU.id]=[];
  DB.todos[CU.id].push({id:uid(),text,cat:cat||'other',done:false,createdAt:Date.now()});
  save(); renderTodos();
}

/* ═══════════════════════════════════════════════
   19. EISENHOWER MATRIX
═══════════════════════════════════════════════ */
function renderMatrix(){
  const mx=getMatrix();
  ['do','schedule','delegate','eliminate'].forEach(q=>{
    const el=$('mq-'+q+'-items'); if(!el) return;
    const items=mx[q]||[];
    el.innerHTML=items.length?items.map((it,i)=>`<div class="mq-item">${esc(it)}<button class="mq-item-del" data-mq="${q}" data-mi="${i}">✕</button></div>`).join('')
      :`<div style="font-size:12px;color:var(--tm);padding:8px">Drop tasks here</div>`;
  });
}

/* ═══════════════════════════════════════════════
   20. ANALYTICS
═══════════════════════════════════════════════ */
function renderAnalytics(){
  const el=$('analytics-lbl');
  if(el) el.textContent=`${MONTHS[appState.selMonth]} ${appState.selYear}`;
  renderHeatmap(); renderBarChart(); renderDowChart(); renderMoodAnaChart(); renderLineChart(); renderPieChart(); renderTopStats();
}

function renderHeatmap(){
  const m=appState.selMonth,y=appState.selYear,days=dIM(m,y),fd=new Date(y,m,1).getDay();
  const el=$('heatmap'); if(!el) return;
  let html=DAYS_S.map(d=>`<div class="hml">${d}</div>`).join('');
  for(let i=0;i<fd;i++) html+=`<div class="hmc hm-empty"></div>`;
  for(let d=1;d<=days;d++){
    const dow=new Date(y,m,d).getDay(), isSun=dow===0;
    let done=0; getHabits().forEach(h=>{if(getRec(h.id,y,m,d)===1)done++;});
    const pct=getHabits().length>0?done/getHabits().length:0;
    const lvl=pct===0?0:pct<.3?1:pct<.6?2:pct<1?3:4;
    html+=`<div class="hmc hm${lvl} ${isSun?'hm-sun':''}" title="${d} ${MONTHS_S[m]}: ${done}/${getHabits().length}">${d}</div>`;
  }
  el.innerHTML=html;
}

function renderBarChart(){
  const m=appState.selMonth,y=appState.selYear,days=dIM(m,y);
  const el=$('bar-chart'); if(!el) return;
  if(!getHabits().length){el.innerHTML='<div class="empty-msg">No habits.</div>';return;}
  el.innerHTML=getHabits().map(h=>{
    let done=0; for(let d=1;d<=days;d++) if(getRec(h.id,y,m,d)===1)done++;
    const pct=days>0?Math.round((done/days)*100):0;
    return `<div class="bc-row">
      <div class="bc-lbl">${esc(h.emoji)} ${esc(h.name)}</div>
      <div class="bc-bw"><div class="bc-b" style="width:${pct}%;background:${h.color}"></div></div>
      <div class="bc-pct" style="color:${cPct(pct)}">${pct}%</div>
    </div>`;
  }).join('');
}

function renderDowChart(){
  const m=appState.selMonth,y=appState.selYear,days=dIM(m,y);
  const el=$('dow-chart'); if(!el) return;
  const tot=Array(7).fill(0),cnt=Array(7).fill(0);
  for(let d=1;d<=days;d++){
    const dow=new Date(y,m,d).getDay();
    getHabits().forEach(h=>{if(getRec(h.id,y,m,d)===1)tot[dow]++;});
    cnt[dow]++;
  }
  const mx=Math.max(...tot,1);
  el.innerHTML=DAYS_S.map((l,i)=>{
    const pct=Math.round((tot[i]/Math.max(cnt[i]*Math.max(getHabits().length,1),1))*100);
    const h=Math.max(4,(tot[i]/mx)*100);
    const c=pct>=70?'var(--ok)':pct>=40?'var(--warn)':'var(--pri)';
    const isSun=i===0;
    return `<div class="dow-col"><div class="dow-bar" style="height:${h}%;background:${isSun?'var(--err)':c}" title="${l}: ${pct}%"></div><div class="dow-lbl" style="${isSun?'color:var(--err)':''}">${l}</div></div>`;
  }).join('');
}

function renderMoodAnaChart(){
  const el=$('mood-chart'); if(!el) return;
  const j=getJournal(), l=getLife(), counts={5:0,4:0,3:0,2:0,1:0,0:0};
  Object.values(j).forEach(x=>{if(x.mood!==undefined)counts[x.mood]=(counts[x.mood]||0)+1;});
  Object.values(l).forEach(x=>{if(x.mood!==undefined)counts[x.mood]=(counts[x.mood]||0)+1;});
  const mx=Math.max(...Object.values(counts),1);
  el.innerHTML=[5,4,3,2,1,0].map(mood=>{
    const p=Math.round((counts[mood]/mx)*100);
    return `<div class="mc-row"><div class="mc-em">${MOOD_MAP[mood].e}</div><div class="mc-bw"><div class="mc-b" style="width:${p}%"></div></div><div class="mc-cnt">${counts[mood]}</div></div>`;
  }).join('');
}

function renderLineChart(){
  const el=$('line-chart'); if(!el) return;
  const days30=[]; const now=new Date();
  for(let i=29;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); days30.push({y:d.getFullYear(),m:d.getMonth(),d:d.getDate()}); }
  const pts=days30.map(({y,m,d})=>{
    const h=getHabits(); if(!h.length) return 0;
    const done=h.filter(hh=>getRec(hh.id,y,m,d)===1).length;
    return Math.round((done/h.length)*100);
  });
  const max=100, w=100/29;
  const polyline=pts.map((v,i)=>`${(i*w).toFixed(1)},${(100-v).toFixed(1)}`).join(' ');
  el.innerHTML=`<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:120px">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--pri)" stop-opacity=".3"/><stop offset="100%" stop-color="var(--pri)" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${pts.map((v,i)=>`${(i*w).toFixed(1)},${(100-v).toFixed(1)}`).join(' ')} ${((29*w)).toFixed(1)},100 0,100" fill="url(#lg)"/>
    <polyline points="${polyline}" fill="none" stroke="var(--pri)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((v,i)=>v>0?`<circle cx="${(i*w).toFixed(1)}" cy="${(100-v).toFixed(1)}" r="1.5" fill="var(--pri)"/>`:'').join('')}
  </svg>`;
}

function renderPieChart(){
  const el=$('pie-chart'); if(!el) return;
  const m=appState.selMonth,y=appState.selYear,days=dIM(m,y);
  const catTotals={};
  getHabits().forEach(h=>{
    let done=0; for(let d=1;d<=days;d++) if(getRec(h.id,y,m,d)===1)done++;
    catTotals[h.category]=(catTotals[h.category]||0)+done;
  });
  const total=Object.values(catTotals).reduce((a,b)=>a+b,0)||1;
  el.innerHTML=Object.entries(catTotals).map(([cat,v])=>{
    const pct=Math.round((v/total)*100);
    return `<div class="pie-row"><div class="pie-dot" style="background:${CAT_COLORS[cat]||'#888'}"></div><div class="pie-lbl">${cat}</div><div class="pie-pct">${pct}%</div></div>`;
  }).join('');
}

function renderTopStats(){
  const el=$('top-stats'); if(!el) return;
  const m=appState.selMonth,y=appState.selYear,days=dIM(m,y);
  let best=null,worst=null,bestP=-1,worstP=101;
  getHabits().forEach(h=>{
    let done=0; for(let d=1;d<=days;d++) if(getRec(h.id,y,m,d)===1)done++;
    const pct=days>0?done/days:0;
    if(pct>bestP){bestP=pct;best=h;} if(pct<worstP){worstP=pct;worst=h;}
  });
  const {cur,best:bestS}=streaks(DB);
  el.innerHTML=`
    <div class="ts-row"><span class="ts-lbl">🏆 Best Habit</span><span class="ts-val">${best?`${best.emoji} ${best.name}`:'—'}</span></div>
    <div class="ts-row"><span class="ts-lbl">😓 Most Missed</span><span class="ts-val">${worst&&worstP<1?`${worst.emoji} ${worst.name}`:'—'}</span></div>
    <div class="ts-row"><span class="ts-lbl">🔥 Current Streak</span><span class="ts-val">${cur} days</span></div>
    <div class="ts-row"><span class="ts-lbl">⚡ Best Streak</span><span class="ts-val">${bestS} days</span></div>
    <div class="ts-row"><span class="ts-lbl">📓 Journal Entries</span><span class="ts-val">${Object.keys(getJournal()).length}</span></div>
    <div class="ts-row"><span class="ts-lbl">🎯 Goals</span><span class="ts-val">${getGoals().length} total</span></div>`;
}

/* ═══════════════════════════════════════════════
   21. JOURNAL
═══════════════════════════════════════════════ */
function openJournalModal(dateOverride=null){
  const t=tod(); const dk_=dateOverride||dk(t.y,t.m,t.d);
  appState.journalDate=dk_; appState.selMood=null;
  const ex=getJournal()[dk_]||{};
  $('jm-date-lbl').textContent=fmtDateKey(dk_);
  $('jm-title').value=ex.title||''; $('jm-desc').value=ex.desc||'';
  $('jm-wins').value=ex.wins||''; $('jm-improve').value=ex.improve||'';
  $('jm-energy').value=ex.energy||7; $('jm-energy-val').textContent=ex.energy||7;
  $('jm-stress').value=ex.stress||5; $('jm-stress-val').textContent=ex.stress||5;
  $a('#jm-mood-picker .mood-btn').forEach(b=>{
    b.classList.toggle('active',ex.mood!==undefined&&Number(b.dataset.mood)===ex.mood);
    if(ex.mood!==undefined&&Number(b.dataset.mood)===ex.mood) appState.selMood=ex.mood;
  });
  openM('journal-modal'); setTimeout(()=>$('jm-title').focus(),100);
}

function saveJournal(){
  if(!DB.journal[CU.id]) DB.journal[CU.id]={};
  DB.journal[CU.id][appState.journalDate]={
    title:$('jm-title').value.trim(), mood:appState.selMood,
    desc:$('jm-desc').value.trim(), wins:$('jm-wins').value.trim(),
    improve:$('jm-improve').value.trim(),
    energy:parseInt($('jm-energy').value), stress:parseInt($('jm-stress').value),
  };
  addXP(5); save(); closeM('journal-modal'); renderJournal(); renderLifeSnapshot(); checkBadges();
  toast('📔 Journal saved!');
}

function renderJournal(){
  const el=$('journal-grid'); if(!el) return;
  const entries=Object.entries(getJournal()).filter(([,v])=>v.title||v.desc||v.mood!==undefined).sort(([a],[b])=>b.localeCompare(a));
  if(!entries.length){ el.innerHTML='<div class="empty-msg">No journal entries yet. Start from the Dashboard!</div>'; return; }
  el.innerHTML=entries.map(([dk_,v])=>{
    const ml=v.mood!==undefined?MOOD_MAP[v.mood]:null;
    return `<div class="jc">
      <div class="jc-date">${fmtDateKey(dk_)}</div>
      ${v.title?`<div class="jc-title">${esc(v.title)}</div>`:''}
      ${ml?`<div class="jc-mood">${ml.e} <span style="font-size:13px;color:var(--ts)">${ml.l}</span></div>`:''}
      ${v.desc?`<div class="jc-desc">${esc(v.desc)}</div>`:''}
      ${v.wins?`<div class="jc-wins">🏆 ${esc(v.wins)}</div>`:''}
      ${v.energy?`<div style="font-size:11px;color:var(--tm);margin-top:6px">⚡${v.energy}/10  😰${v.stress||'—'}/10</div>`:''}
    </div>`;
  }).join('');
}

function fmtDateKey(dk_){
  const [y,m,d]=dk_.split('_').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric'});
}

/* ═══════════════════════════════════════════════
   22. LIFE TRACKING
═══════════════════════════════════════════════ */
function openLifeModal(dateOverride=null){
  const t=tod(); const dk_=dateOverride||dk(t.y,t.m,t.d);
  appState.lifeDate=dk_; appState.selMood=null;
  const ex=getLife()[dk_]||{};
  $('lm-date').textContent=fmtDateKey(dk_);
  $('lm-energy').value=ex.energy||7; $('lm-energy-val').textContent=ex.energy||7;
  $('lm-stress').value=ex.stress||5; $('lm-stress-val').textContent=ex.stress||5;
  $a('#lm-mood .mood-btn').forEach(b=>{ b.classList.toggle('active',ex.mood!==undefined&&Number(b.dataset.mood)===ex.mood); if(ex.mood!==undefined&&Number(b.dataset.mood)===ex.mood)appState.selMood=ex.mood; });
  openM('life-modal');
}

function saveLife(){
  if(!DB.life[CU.id]) DB.life[CU.id]={};
  DB.life[CU.id][appState.lifeDate]={mood:appState.selMood,energy:parseInt($('lm-energy').value),stress:parseInt($('lm-stress').value)};
  save(); closeM('life-modal'); renderLifeSnapshot(); renderLife(); toast('🌟 Check-in saved!');
}

function renderLife(){
  // Life charts
  renderLifeMoodChart(); renderLifeTrend('life-energy-chart','energy','var(--ok)'); renderLifeTrend('life-stress-chart','stress','var(--err)');
  // Log
  const el=$('life-log'); if(!el) return;
  const entries=Object.entries(getLife()).sort(([a],[b])=>b.localeCompare(a)).slice(0,20);
  if(!entries.length){ el.innerHTML='<div class="empty-msg">No life check-ins yet.</div>'; return; }
  el.innerHTML=entries.map(([dk_,v])=>{
    const ml=v.mood!==undefined?MOOD_MAP[v.mood]:null;
    return `<div class="life-log-item"><div class="lli-mood">${ml?ml.e:'😶'}</div><div class="lli-info"><div class="lli-date">${fmtDateKey(dk_)}</div><div class="lli-vals">${ml?ml.l+' · ':''} ⚡ Energy: ${v.energy||'—'} · 😰 Stress: ${v.stress||'—'}</div></div></div>`;
  }).join('');
}

function renderLifeMoodChart(){
  const el=$('life-mood-chart'); if(!el) return;
  const all={...getLife(),...getJournal()};
  const counts={5:0,4:0,3:0,2:0,1:0,0:0};
  Object.values(all).forEach(v=>{ if(v.mood!==undefined) counts[v.mood]=(counts[v.mood]||0)+1; });
  const mx=Math.max(...Object.values(counts),1);
  el.innerHTML=[5,4,3,2,1,0].map(mood=>{
    const p=Math.round((counts[mood]/mx)*100);
    return `<div class="mc-row"><div class="mc-em">${MOOD_MAP[mood].e}</div><div class="mc-bw"><div class="mc-b" style="width:${p}%"></div></div><div class="mc-cnt">${counts[mood]}</div></div>`;
  }).join('');
}

function renderLifeTrend(elId,field,color){
  const el=$(elId); if(!el) return;
  const days14=[]; const now=new Date();
  for(let i=13;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);days14.push(dk(d.getFullYear(),d.getMonth(),d.getDate()));}
  const combined={...getLife(),...getJournal()};
  const vals=days14.map(k=>combined[k]?combined[k][field]||0:0);
  const mx=10;
  el.innerHTML=vals.map((v,i)=>`<div class="lt-col"><div class="lt-bar" style="height:${(v/mx)*100}%;background:${color}"></div><div class="lt-lbl">${days14[i].split('_')[2]}</div></div>`).join('');
}

/* ═══════════════════════════════════════════════
   23. BADGES
═══════════════════════════════════════════════ */
function checkBadges(){
  if(!CU) return;
  const stateProxy={habits:DB.habits[CU.id]||[],records:DB.records[CU.id]||{},journal:DB.journal[CU.id]||{},xp:getXP(),goals:DB.goals[CU.id]||[],pomoSessions:getPomoSessions()};
  BADGE_DEFS.forEach(b=>{
    if(!getBadges().includes(b.id)){
      try{ if(b.check(stateProxy)){ DB.earnedBadges[CU.id].push(b.id); addXP(25); toast(`🏅 Badge: ${b.ico} ${b.name}!`,4000); } }catch(e){}
    }
  });
  save();
}

function renderBadges(){
  const el=$('badges-grid'); if(!el) return;
  el.innerHTML=BADGE_DEFS.map(b=>{
    const e=getBadges().includes(b.id);
    return `<div class="badge-card ${e?'earned':'badge-locked'}"><span class="bi">${b.ico}</span><div class="bn">${esc(b.name)}</div><div class="bd2">${esc(b.desc)}</div><div style="font-size:11px;font-weight:700;margin-top:6px;color:${e?'var(--ok)':'var(--tm)'}">${e?'✅ Earned!':'🔒 Locked'}</div></div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════
   24. MILESTONES & CONFETTI
═══════════════════════════════════════════════ */
function checkMilestones(){
  const t=tod(), done=getHabits().filter(h=>getRec(h.id,t.y,t.m,t.d)===1).length;
  if(done===getHabits().length&&getHabits().length>0) launchConfetti();
}
function launchConfetti(){
  const canvas=$('confetti-canvas'),ctx=canvas.getContext('2d');
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  const cols=['#4F8EF7','#22C55E','#F59E0B','#EF4444','#8B5CF6','#F97316','#EC4899'];
  const p=Array.from({length:150},()=>({x:Math.random()*canvas.width,y:-20,vx:(Math.random()-.5)*5,vy:Math.random()*5+2,r:Math.random()*9+4,angle:Math.random()*360,va:(Math.random()-.5)*8,color:cols[Math.floor(Math.random()*cols.length)],life:1}));
  let f=0;
  const run=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);p.forEach(x=>{x.x+=x.vx;x.y+=x.vy;x.vy+=.08;x.angle+=x.va;x.life-=.005;if(x.life<=0||x.y>canvas.height)return;ctx.save();ctx.globalAlpha=Math.max(0,x.life);ctx.translate(x.x,x.y);ctx.rotate(x.angle*Math.PI/180);ctx.fillStyle=x.color;ctx.fillRect(-x.r/2,-x.r/2,x.r,x.r*1.6);ctx.restore();});if(f++<220&&p.some(x=>x.life>0))requestAnimationFrame(run);else ctx.clearRect(0,0,canvas.width,canvas.height);};
  run();
}

/* ═══════════════════════════════════════════════
   25. POMODORO
═══════════════════════════════════════════════ */
function openPomo(){ resetPomo(); openM('pomo-modal'); }
function resetPomo(){ stopPomo(); appState.pomoLeft=appState.pomoTotal; appState.pomoPhase='Focus'; updatePomoUI(); }
function stopPomo(){ if(appState.pomoTimer){ clearInterval(appState.pomoTimer); appState.pomoTimer=null; } appState.pomoRunning=false; $('pomo-toggle').textContent='▶ Start'; }
function togglePomo(){
  if(appState.pomoRunning){ stopPomo(); return; }
  appState.pomoRunning=true; $('pomo-toggle').textContent='⏸ Pause';
  appState.pomoTimer=setInterval(()=>{
    appState.pomoLeft--;
    if(appState.pomoLeft<=0){
      stopPomo(); appState.pomoLeft=0; updatePomoUI();
      DB.pomoSessions[CU.id]=(getPomoSessions()+1); addXP(10);
      $('pomo-sessions').textContent=getPomoSessions();
      toast('⏱️ Pomodoro complete! Great focus!',4000);
      checkBadges();
    } else updatePomoUI();
  },1000);
}
function updatePomoUI(){
  const m=Math.floor(appState.pomoLeft/60),s=appState.pomoLeft%60;
  $('pomo-time-display').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  $('pomo-phase').textContent=appState.pomoPhase;
  const circ=364, off=circ-(appState.pomoLeft/appState.pomoTotal)*circ;
  $('pomo-arc').style.strokeDashoffset=Math.max(0,off);
  $('pomo-sessions').textContent=getPomoSessions();
}

/* ═══════════════════════════════════════════════
   26. ADMIN PANEL
═══════════════════════════════════════════════ */
function openAdmin(){
  if(!CU||CU.role!=='admin'){ toast('⚠️ Admin access required'); return; }
  renderAdminContent(); openM('admin-modal');
}
function renderAdminContent(){
  const tab=appState.adminTab, el=$('admin-content'); if(!el) return;
  if(tab==='requests'){
    const reqs=DB.editRequests||[];
    if(!reqs.length){ el.innerHTML='<div class="empty-msg">No edit requests.</div>'; return; }
    el.innerHTML=reqs.map((r,i)=>`<div class="req-card ${r.status||''}">
      <div class="req-meta">User: <strong>${r.username}</strong> · Habit: <strong>${r.habitName}</strong> · Date: <strong>${r.date}</strong> · Status: <strong>${r.status||'pending'}</strong></div>
      <div class="req-reason">"${esc(r.reason)}"</div>
      ${(!r.status||r.status==='pending')?`<div class="req-acts">
        <button class="btn btn-sm" style="background:var(--ok);color:#fff" data-approve="${i}">✅ Approve</button>
        <button class="btn btn-danger btn-sm" data-reject="${i}">❌ Reject</button>
      </div>`:''}
    </div>`).join('');
  } else if(tab==='users'){
    el.innerHTML=DB.users.map(u=>`<div class="user-row"><span><strong>${esc(u.name)}</strong> (@${esc(u.username)}) · ${u.role}</span><span style="color:var(--tm)">${DB.xp[u.id]||0} XP</span></div>`).join('');
  } else if(tab==='logs'){
    const logs=DB.changeLogs||[];
    if(!logs.length){ el.innerHTML='<div class="empty-msg">No change logs.</div>'; return; }
    el.innerHTML=logs.slice(-30).reverse().map(l=>`<div style="padding:8px 12px;background:var(--bg-s);border-radius:8px;margin-bottom:6px;font-size:12px;color:var(--ts)">${new Date(l.at).toLocaleString()}: <strong>${l.username}</strong> — ${esc(l.action)}</div>`).join('');
  }
}

/* ═══════════════════════════════════════════════
   27. RESET / EXPORT / IMPORT
═══════════════════════════════════════════════ */
function resetToday(){
  const t=tod();
  confirm('Reset Today',`Clear today's entries?`,'🔄',()=>{
    getHabits().forEach(h=>setRec(h.id,t.y,t.m,t.d,0));
    save(); renderTracker(); updateDashboard(); toast('🔄 Today cleared!');
  });
}
function resetMonth(){
  const m=appState.selMonth,y=appState.selYear,ms=String(m+1).padStart(2,'0');
  confirm('Reset Month',`Clear all of ${MONTHS[m]} ${y}?`,'🗑️',()=>{
    const r=DB.records[CU.id]||{};
    Object.keys(r).filter(k=>k.includes(`_${y}_${ms}_`)).forEach(k=>delete r[k]);
    save(); renderTracker(); updateDashboard(); toast('🗑️ Month cleared!');
  });
}
function fullReset(){
  confirm('Full Reset','Delete ALL data? This cannot be undone!','☠️',()=>{
    DB.habits[CU.id]=[]; DB.records[CU.id]={}; DB.goals[CU.id]=[];
    DB.todos[CU.id]=[]; DB.journal[CU.id]={}; DB.life[CU.id]={};
    DB.xp[CU.id]=0; DB.earnedBadges[CU.id]=[]; DB.pomoSessions[CU.id]=0;
    save(); initApp(); toast('☠️ Reset complete');
  });
}
function exportCSV(){
  const m=appState.selMonth,y=appState.selYear,days=dIM(m,y);
  const h=['Habit','Emoji','Category','Priority','Start',...Array.from({length:days},(_,i)=>`D${i+1}`),'%'];
  const rows=getHabits().map(hb=>{
    let done=0; const cells=Array.from({length:days},(_,i)=>{const v=getRec(hb.id,y,m,i+1);if(v===1){done++;return'Done';}if(v===2)return'Missed';if(v===3)return'Pending';return'';});
    return [hb.name,hb.emoji,hb.category,hb.priority,hb.startTime||'',...cells,Math.round((done/days)*100)+'%'];
  });
  dl(new Blob([[h,...rows].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n')],{type:'text/csv'}),`HabitFlow_${MONTHS[m]}_${y}.csv`);
  toast('📤 CSV exported!');
}
function exportJSON(){
  dl(new Blob([JSON.stringify({habits:DB.habits[CU.id],records:DB.records[CU.id],journal:DB.journal[CU.id],life:DB.life[CU.id],goals:DB.goals[CU.id],xp:getXP(),earnedBadges:getBadges()},null,2)],{type:'application/json'}),`HabitFlow_backup_${Date.now()}.json`);
  toast('📦 JSON exported!');
}
function importJSON(file){
  const r=new FileReader();
  r.onload=e=>{
    try{
      const d=JSON.parse(e.target.result);
      if(d.habits){ DB.habits[CU.id]=d.habits; DB.records[CU.id]=d.records||{}; DB.journal[CU.id]=d.journal||{}; DB.life[CU.id]=d.life||{}; DB.goals[CU.id]=d.goals||[]; if(d.xp)DB.xp[CU.id]=d.xp; save(); initApp(); toast('📥 Imported!'); } else toast('⚠️ Invalid format');
    }catch{toast('⚠️ Parse error');}
  };
  r.readAsText(file);
}
function dl(blob,name){ const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u); }

/* ═══════════════════════════════════════════════
   28. NOTIFICATIONS
═══════════════════════════════════════════════ */
function reqNotif(){ if(!('Notification'in window)){toast('⚠️ Not supported');return;} Notification.requestPermission().then(p=>{toast(p==='granted'?'🔔 Reminders enabled!':'⚠️ Denied');}); }
function checkReminders(){
  if(!CU) return;
  const t=tod(),now=new Date().getHours()*60+new Date().getMinutes();
  getHabits().forEach(h=>{
    if(!h.startTime||!h.reminder) return;
    const starts=t2m(h.startTime),rt=starts-h.reminder;
    if(now>=rt&&now<rt+1){
      const k=`notif_${h.id}_${dk(t.y,t.m,t.d)}`;
      if(!sessionStorage.getItem(k)){
        if(Notification.permission==='granted') try{new Notification(`⏰ ${h.emoji} ${h.name}`,{body:`Starts in ${h.reminder} min at ${m2d(starts)}`});}catch(e){}
        sessionStorage.setItem(k,'1');
      }
    }
  });
}

function showDailyReminder(){
  if(!CU) return;
  const t=tod(),done=getHabits().filter(h=>getRec(h.id,t.y,t.m,t.d)===1).length;
  if(done===getHabits().length||!getHabits().length) return;
  if(document.querySelector('.rem-popup')) return;
  const el=document.createElement('div');
  el.className='rem-popup';
  el.style.cssText=`position:fixed;bottom:80px;right:24px;background:var(--bg-c);border:1px solid var(--bd);border-radius:var(--r-lg);padding:var(--s4);box-shadow:var(--sh-lg);z-index:500;max-width:280px;animation:fadeUp .4s var(--ease)`;
  el.innerHTML=`<span style="position:absolute;top:10px;right:12px;cursor:pointer;color:var(--tm);font-size:16px" id="rem-x">✕</span><div style="font-weight:700;font-size:15px;color:var(--tp);margin-bottom:4px">⏰ Daily Check-in</div><div style="font-size:13px;color:var(--ts);margin-bottom:12px">You've done ${done}/${getHabits().length} habits today!</div><button class="btn btn-primary btn-sm" id="rem-go">Track Now</button>`;
  document.body.appendChild(el);
  $('rem-x').addEventListener('click',()=>el.remove());
  $('rem-go').addEventListener('click',()=>{ goTo('tracker'); el.remove(); });
  setTimeout(()=>{ if(el.parentNode) el.remove(); },10000);
}

/* ═══════════════════════════════════════════════
   29. EVENT BINDINGS
═══════════════════════════════════════════════ */
function bindEvents(){
  // Nav
  $a('.nav-i').forEach(n=>n.addEventListener('click',e=>{ e.preventDefault(); goTo(n.dataset.s); }));
  $('burger').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
  $('theme-tog').addEventListener('click',toggleTheme);

  // Habit modal
  $('btn-add-habit').addEventListener('click',()=>openHabitModal());
  $('hm-save').addEventListener('click',saveHabit);
  $('hm-cancel').addEventListener('click',()=>closeM('habit-modal'));
  $('hm-x').addEventListener('click',()=>closeM('habit-modal'));
  $('hm-name').addEventListener('keydown',e=>{ if(e.key==='Enter') saveHabit(); });

  // Tracker table
  $('tbl-body').addEventListener('click',handleCellClick);
  $('tbl-body').addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); const c=e.target.closest('.dc'); if(c) c.click(); } });

  // Month/year selectors
  $('mon-sel').addEventListener('change',e=>{ appState.selMonth=parseInt(e.target.value); save(); renderTracker(); updateDashboard(); });
  $('yr-sel').addEventListener('change',e=>{ appState.selYear=parseInt(e.target.value); save(); renderTracker(); updateDashboard(); });
  $('cat-sel').addEventListener('change',()=>renderTracker());
  $('filter-sel').addEventListener('change',()=>renderTracker());

  // Filter pills
  $a('#filter-pills .pill').forEach(p=>p.addEventListener('click',()=>{ $a('#filter-pills .pill').forEach(x=>x.classList.remove('active')); p.classList.add('active'); renderTracker(); }));

  // Search
  $('search').addEventListener('input',()=>renderTracker());

  // Reset / Export / Import
  $('btn-rst-today').addEventListener('click',resetToday);
  $('btn-rst-month').addEventListener('click',resetMonth);
  $('btn-full-reset').addEventListener('click',fullReset);
  $('btn-csv').addEventListener('click',exportCSV);
  $('btn-json').addEventListener('click',exportJSON);
  $('btn-imp').addEventListener('click',()=>$('imp-file').click());
  $('imp-file').addEventListener('change',e=>{ if(e.target.files[0]) importJSON(e.target.files[0]); e.target.value=''; });

  // Goals
  $('btn-add-goal').addEventListener('click',()=>openGoalModal());
  $('gm-save').addEventListener('click',saveGoal);
  $('gm-cancel').addEventListener('click',()=>closeM('goal-modal'));
  $('gm-x').addEventListener('click',()=>closeM('goal-modal'));
  $('goals-grid').addEventListener('click',e=>{
    const ea=e.target.closest('[data-gact]'); if(!ea) return;
    const{gact,gid}=ea.dataset;
    if(gact==='edit') openGoalModal(gid);
    if(gact==='del') confirm('Delete Goal',`Delete this goal?`,'🗑️',()=>{ DB.goals[CU.id]=DB.goals[CU.id].filter(g=>g.id!==gid); save(); renderGoals(); updateDashboard(); toast('Deleted'); });
  });
  $('goals-grid').addEventListener('change',e=>{
    const inp=e.target.closest('[data-update-goal]'); if(!inp) return;
    const gid=inp.dataset.updateGoal;
    const g=DB.goals[CU.id].find(x=>x.id===gid);
    if(g){ g.progress=Math.max(0,Math.min(100,parseInt(inp.value)||0)); if(g.progress>=100) toast('🎉 Goal Achieved! Reward yourself: '+(g.reward||'Great job!')); save(); renderGoals(); updateDashboard(); checkBadges(); }
  });

  // Journal
  $('btn-journal-today').addEventListener('click',()=>openJournalModal());
  $('btn-journal2').addEventListener('click',()=>openJournalModal());
  $('jm-save').addEventListener('click',saveJournal);
  $('jm-cancel').addEventListener('click',()=>closeM('journal-modal'));
  $('jm-x').addEventListener('click',()=>closeM('journal-modal'));
  $a('#jm-mood-picker .mood-btn').forEach(b=>b.addEventListener('click',()=>{ $a('#jm-mood-picker .mood-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); appState.selMood=parseInt(b.dataset.mood); }));
  $('jm-energy').addEventListener('input',()=>$('jm-energy-val').textContent=$('jm-energy').value);
  $('jm-stress').addEventListener('input',()=>$('jm-stress-val').textContent=$('jm-stress').value);

  // Life tracking
  $('btn-life-checkin').addEventListener('click',()=>openLifeModal());
  $('btn-life2').addEventListener('click',()=>openLifeModal());
  $('lm-save').addEventListener('click',saveLife);
  $('lm-cancel').addEventListener('click',()=>closeM('life-modal'));
  $('lm-x').addEventListener('click',()=>closeM('life-modal'));
  $a('#lm-mood .mood-btn').forEach(b=>b.addEventListener('click',()=>{ $a('#lm-mood .mood-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); appState.selMood=parseInt(b.dataset.mood); }));
  $('lm-energy').addEventListener('input',()=>$('lm-energy-val').textContent=$('lm-energy').value);
  $('lm-stress').addEventListener('input',()=>$('lm-stress-val').textContent=$('lm-stress').value);

  // Edit request
  $('er-x').addEventListener('click',()=>{ appState.pendingCell=null; closeM('editreq-modal'); });
  $('er-cancel').addEventListener('click',()=>{ appState.pendingCell=null; closeM('editreq-modal'); });
  $('er-submit').addEventListener('click',()=>{
    const reason=$('er-reason').value.trim();
    if(!reason){ toast('⚠️ Reason required'); return; }
    if(!appState.pendingCell) return;
    const {hid,y,m,d}=appState.pendingCell;
    const h=getHabits().find(x=>x.id===hid);
    const req={id:uid(),userId:CU.id,username:CU.username,habitId:hid,habitName:h?h.name:'?',date:fmtDateKey(dk(y,m,d)),year:y,month:m,day:d,reason,status:'pending',at:Date.now()};
    DB.editRequests.push(req);
    DB.changeLogs.push({at:Date.now(),username:CU.username,action:`Requested edit for "${req.habitName}" on ${req.date}`});
    appState.pendingCell=null; save(); closeM('editreq-modal');
    toast('✅ Edit request submitted! Awaiting admin approval.');
  });

  // Admin panel
  const adminPanelBtn=document.querySelector('[id="btn-admin-panel"]')||document.querySelector('[id="btn-admin"]');
  if(adminPanelBtn) adminPanelBtn.addEventListener('click',openAdmin);
  $('adm-x').addEventListener('click',()=>closeM('admin-modal'));
  $a('.admin-tab').forEach(t=>t.addEventListener('click',()=>{ $a('.admin-tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); appState.adminTab=t.dataset.atab; renderAdminContent(); }));
  $('admin-content').addEventListener('click',e=>{
    const ab=e.target.closest('[data-approve]'); if(ab){ const i=parseInt(ab.dataset.approve); const r=DB.editRequests[i]; if(r&&r.status==='pending'){ r.status='approved'; setRec(r.habitId,r.year,r.month,r.day,(getRec(r.habitId,r.year,r.month,r.day)+1)%4); DB.changeLogs.push({at:Date.now(),username:'admin',action:`Approved edit for "${r.habitName}" by ${r.username}`}); save(); renderAdminContent(); toast('✅ Approved'); } return; }
    const rb=e.target.closest('[data-reject]'); if(rb){ const i=parseInt(rb.dataset.reject); const r=DB.editRequests[i]; if(r&&r.status==='pending'){ r.status='rejected'; DB.changeLogs.push({at:Date.now(),username:'admin',action:`Rejected edit for "${r.habitName}" by ${r.username}`}); save(); renderAdminContent(); toast('❌ Rejected'); } }
  });

  // Pomodoro
  $('btn-pomo').addEventListener('click',openPomo);
  $('btn-pomo2').addEventListener('click',openPomo);
  $('pomo-x').addEventListener('click',()=>{ stopPomo(); closeM('pomo-modal'); });
  $('pomo-toggle').addEventListener('click',togglePomo);
  $('pomo-reset').addEventListener('click',resetPomo);
  $('pomo-skip').addEventListener('click',()=>{ stopPomo(); appState.pomoLeft=0; updatePomoUI(); });
  $a('.pomo-preset').forEach(b=>b.addEventListener('click',()=>{
    $a('.pomo-preset').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    appState.pomoTotal=parseInt(b.dataset.sec); stopPomo(); appState.pomoLeft=appState.pomoTotal; updatePomoUI();
  }));

  // Timeline
  $('timeline').addEventListener('click',e=>{
    const btn=e.target.closest('[data-tl-id]'); if(!btn) return;
    const t=tod(),id=btn.dataset.tlId;
    const cur=getRec(id,t.y,t.m,t.d);
    setRec(id,t.y,t.m,t.d,cur===1?0:1);
    if(cur!==1) addXP(5);
    save(); renderTimeline(); updateDashboard(); checkBadges(); checkMilestones();
  });

  // To-do
  $('btn-add-todo').addEventListener('click',()=>{ $('todo-add-row').classList.remove('hidden'); setTimeout(()=>$('todo-inp').focus(),100); });
  $('todo-inp-cancel').addEventListener('click',()=>$('todo-add-row').classList.add('hidden'));
  $('todo-inp-save').addEventListener('click',()=>{ const t=$('todo-inp').value.trim(); if(t){ addTodo(t,$('todo-cat-inp').value); $('todo-inp').value=''; $('todo-add-row').classList.add('hidden'); } });
  $('todo-inp').addEventListener('keydown',e=>{ if(e.key==='Enter'){ const t=$('todo-inp').value.trim(); if(t){ addTodo(t,$('todo-cat-inp').value); $('todo-inp').value=''; $('todo-add-row').classList.add('hidden'); } } });
  $('todo-cat-filter').addEventListener('change',renderTodos);
  $('todo-list').addEventListener('click',e=>{
    const ch=e.target.closest('[data-tcheck]'); if(ch){ const id=ch.dataset.tcheck; const t=getTodos().find(x=>x.id===id); if(t){ t.done=!t.done; if(t.done)addXP(3); save(); renderTodos(); } return; }
    const dl=e.target.closest('[data-tdel]'); if(dl){ const id=dl.dataset.tdel; DB.todos[CU.id]=DB.todos[CU.id].filter(t=>t.id!==id); save(); renderTodos(); }
  });

  // Matrix
  $('matrix-add').addEventListener('click',()=>{
    const txt=$('matrix-inp').value.trim(),q=$('matrix-quad').value;
    if(!txt) return;
    if(!DB.matrix[CU.id]) DB.matrix[CU.id]={do:[],schedule:[],delegate:[],eliminate:[]};
    DB.matrix[CU.id][q].push(txt); $('matrix-inp').value=''; save(); renderMatrix();
  });
  $('matrix-inp').addEventListener('keydown',e=>{ if(e.key==='Enter') $('matrix-add').click(); });
  ['do','schedule','delegate','eliminate'].forEach(q=>{
    const el=$('mq-'+q+'-items'); if(!el) return;
    el.addEventListener('click',e=>{
      const btn=e.target.closest('[data-mq]'); if(!btn) return;
      const{mq,mi}=btn.dataset; DB.matrix[CU.id][mq].splice(parseInt(mi),1); save(); renderMatrix();
    });
  });

  // Analytics filter
  $a('.analytics-filter-row .pill').forEach(p=>p.addEventListener('click',()=>{ $a('.analytics-filter-row .pill').forEach(x=>x.classList.remove('active')); p.classList.add('active'); appState.anaFilter=p.dataset.af; renderAnalytics(); }));

  // Notifications
  $('btn-pomo2').addEventListener('click',openPomo);
  document.getElementById('request-notif') && document.getElementById('request-notif').addEventListener('click',reqNotif);
  $('notif-btn').addEventListener('click',reqNotif);

  // Overlay close on outside click
  $a('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{ if(e.target===m){ m.classList.remove('open'); m.setAttribute('aria-hidden','true'); } }));

  // Escape key
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape') $a('.modal-overlay.open').forEach(m=>{ m.classList.remove('open'); m.setAttribute('aria-hidden','true'); });
    if(e.altKey){
      const map={'1':'dashboard','2':'tracker','3':'timeline','4':'goals','5':'todo','6':'matrix','7':'analytics','8':'journal','9':'life'};
      if(map[e.key]) goTo(map[e.key]);
      if(e.key==='n') openHabitModal();
    }
  });

  window.addEventListener('resize',()=>{ const c=$('confetti-canvas'); c.width=window.innerWidth; c.height=window.innerHeight; });
}

/* ═══════════════════════════════════════════════
   30. BOOT
═══════════════════════════════════════════════ */
window.HFCore = {
  getDB: () => DB,
  getCurrentUser: () => CU,
  getAppState: () => appState,
  getFns: () => ({
    load,
    save,
    initAuth,
    bindEvents,
    loginUser,
    logout,
    initApp,
    renderSidebarUser,
    renderTracker,
    updateDashboard,
    renderGoals,
    renderJournal,
    renderBadges,
    renderLife,
    renderTodos,
    renderMatrix,
    renderTimeline,
    renderAnalytics,
    openGoalModal,
    saveGoal,
    openJournalModal,
    saveJournal,
    handleCellClick,
    openAdmin,
    renderAdminContent,
    reqNotif,
    saveHabit,
    deleteHabit,
    resetToday,
    resetMonth,
    fullReset,
    goTo,
    updateXPBar,
    renderLifeSnapshot,
    checkBadges,
  }),
  override(map){
    if(map.load) load = map.load;
    if(map.save) save = map.save;
    if(map.initAuth) initAuth = map.initAuth;
    if(map.bindEvents) bindEvents = map.bindEvents;
    if(map.loginUser) loginUser = map.loginUser;
    if(map.logout) logout = map.logout;
    if(map.initApp) initApp = map.initApp;
    if(map.renderSidebarUser) renderSidebarUser = map.renderSidebarUser;
    if(map.renderTracker) renderTracker = map.renderTracker;
    if(map.updateDashboard) updateDashboard = map.updateDashboard;
    if(map.renderGoals) renderGoals = map.renderGoals;
    if(map.renderJournal) renderJournal = map.renderJournal;
    if(map.renderBadges) renderBadges = map.renderBadges;
    if(map.renderLife) renderLife = map.renderLife;
    if(map.renderTodos) renderTodos = map.renderTodos;
    if(map.renderMatrix) renderMatrix = map.renderMatrix;
    if(map.renderTimeline) renderTimeline = map.renderTimeline;
    if(map.renderAnalytics) renderAnalytics = map.renderAnalytics;
    if(map.openGoalModal) openGoalModal = map.openGoalModal;
    if(map.saveGoal) saveGoal = map.saveGoal;
    if(map.openJournalModal) openJournalModal = map.openJournalModal;
    if(map.saveJournal) saveJournal = map.saveJournal;
    if(map.handleCellClick) handleCellClick = map.handleCellClick;
    if(map.openAdmin) openAdmin = map.openAdmin;
    if(map.renderAdminContent) renderAdminContent = map.renderAdminContent;
    if(map.reqNotif) reqNotif = map.reqNotif;
    if(map.saveHabit) saveHabit = map.saveHabit;
    if(map.deleteHabit) deleteHabit = map.deleteHabit;
    if(map.resetToday) resetToday = map.resetToday;
    if(map.resetMonth) resetMonth = map.resetMonth;
    if(map.fullReset) fullReset = map.fullReset;
    if(map.goTo) goTo = map.goTo;
    if(map.renderLifeSnapshot) renderLifeSnapshot = map.renderLifeSnapshot;
    if(map.checkBadges) checkBadges = map.checkBadges;
  },
  helpers: {
    $,
    $q,
    $a,
    uid,
    dIM,
    tod,
    t2m,
    m2d,
    rk,
    dk,
    esc,
    cPct,
    getRec,
    setRec,
    getHabits,
    getGoals,
    getTodos,
    getMatrix,
    getJournal,
    getLife,
    getXP,
    addXP,
    getPomoSessions,
    getBadges,
    isPast,
    isToday,
    isFuture,
    openM,
    closeM,
    confirm,
    toast,
    fmtDateKey,
    MONTHS,
    DAYS_S,
    ACCENTS,
    BADGE_DEFS,
    MOOD_MAP,
    CAT_COLORS,
    getDefaultHabits,
  },
};

document.addEventListener('DOMContentLoaded',()=>{
  load(); initAuth();

  // ── Auto-login via stored JWT token ────────────────────────────────────
  if(window.HFApi&&window.HFApi.hasToken()){
    window.HFApi.autoLogin().then(res=>{
      if(res&&!res.error){
        DB={...DB,...res.db};
        try{ localStorage.setItem(SK,JSON.stringify(DB)); }catch(e){}
        loginUser(res.user);
      } else {
        // Token invalid — clear it and try localStorage fallback
        window.HFApi.clearToken();
        _tryLocalFallback();
      }
    }).catch(()=>{
      // Server unreachable — try localStorage session fallback
      _tryLocalFallback();
    });
  } else {
    _tryLocalFallback();
  }

  function _tryLocalFallback(){
    const saved=localStorage.getItem('hf_session');
    if(saved){
      try{
        const u=JSON.parse(saved);
        const found=DB.users.find(x=>x.id===u.id);
        if(found) loginUser(found);
      }catch(e){}
    }
  }

  setInterval(updateClock,1000);
  setInterval(updateGreeting,60000);
  setInterval(checkReminders,60000);

  bindEvents();

  console.log('%c🚀 HabitFlow Pro v3 Ready (MERN Edition)','color:#4F8EF7;font-size:18px;font-weight:900');
  console.log('%c  Alt+1-9: Navigate | Alt+N: Add Habit | Admin: admin/admin123','color:#888;font-size:12px');
});
