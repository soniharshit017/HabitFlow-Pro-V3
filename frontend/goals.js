/**
 * HabitFlow Pro v3 — goals.js
 * Advanced Goal Management System
 * Modules: Goal Management, Goal Tasks, Goal Notes & Summary,
 *          Goal Task Tracker, Goal Reminders, Upcoming Timeline
 *
 * Integrates via HFCore.override() to keep script.js intact.
 */
(function(){
'use strict';

// ─── Helpers ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function uid(){ return 'gt_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7); }
function uidGoal(){ return 'g_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7); }
function getToday(){ return new Date().toISOString().slice(0,10); }
function fmtDate(d){ if(!d) return '—'; const dt=new Date(d); return dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function toast(msg,type='info'){ if(window.HFCore&&window.HFCore.toast) window.HFCore.toast(msg,type); else if(window.toast) window.toast(msg); }
function save(){ if(window.HFCore&&window.HFCore.save) window.HFCore.save(); else if(window.save) window.save(); }
function getDB(){ return window.HFCore&&window.HFCore.getDB?window.HFCore.getDB():{}; }
function getCU(){ return window.HFCore&&window.HFCore.getCurrentUser?window.HFCore.getCurrentUser():null; }
function uid_user(){ const u=getCU(); return u?u.id:''; }

// Frequency definitions
const FREQ_LABELS={
  daily:'Daily', alternate:'Alternate day', 'weekly':'1 in week', '2week':'2 in week', '10days':'1 in 10 day', '15days':'1 in 15 day', monthly:'1 in month', custom:'Custom', none:'One-time'
};
const FREQ_OPTIONS=Object.entries(FREQ_LABELS).map(([v,l])=>({value:v,label:l}));

// ─── DB accessors ─────────────────────────────────────────────────────────
function getGoals(){ const db=getDB(); const u=uid_user(); return db.goals&&db.goals[u]?db.goals[u]:[]; }
function getGoalTasks(gid){ const db=getDB(); const u=uid_user(); return db.goalTasks&&db.goalTasks[u]&&db.goalTasks[u][gid]?db.goalTasks[u][gid]:[]; }
function setGoalTasks(gid,tasks){ const db=getDB(); const u=uid_user(); if(!db.goalTasks)db.goalTasks={}; if(!db.goalTasks[u])db.goalTasks[u]={}; db.goalTasks[u][gid]=tasks; }
function getGoalNotes(gid){ const db=getDB(); const u=uid_user(); return db.goalNotes&&db.goalNotes[u]&&db.goalNotes[u][gid]?db.goalNotes[u][gid]:[]; }
function setGoalNotes(gid,notes){ const db=getDB(); const u=uid_user(); if(!db.goalNotes)db.goalNotes={}; if(!db.goalNotes[u])db.goalNotes[u]={}; db.goalNotes[u][gid]=notes; }
function getGoalReminders(gid){ const db=getDB(); const u=uid_user(); return db.goalReminders&&db.goalReminders[u]&&db.goalReminders[u][gid]?db.goalReminders[u][gid]:[]; }
function setGoalReminders(gid,reminders){ const db=getDB(); const u=uid_user(); if(!db.goalReminders)db.goalReminders={}; if(!db.goalReminders[u])db.goalReminders[u]={}; db.goalReminders[u][gid]=reminders; }

// ─── Goal CRUD ────────────────────────────────────────────────────────────
let _editGoalId=null, _activeGoalId=null;

function openGoalModal(id=null){
  _editGoalId=id;
  $('gm-title').textContent=id?'Edit Goal':'Add Goal';
  if(id){
    const g=getGoals().find(x=>x.id===id);
    if(g){ $('gm-title-input').value=g.title||''; $('gm-deadline').value=g.deadline||''; $('gm-emoji').value=g.emoji||''; $('gm-why').value=g.why||''; $('gm-reward').value=g.reward||''; $('gm-status').value=g.status||'active'; $('gm-priority').value=g.priority||'medium'; }
  } else {
    ['gm-title-input','gm-deadline','gm-emoji','gm-why','gm-reward'].forEach(i=>$(i).value=''); $('gm-status').value='active'; $('gm-priority').value='medium';
  }
  openModal('goal-modal');
}

function saveGoal(){
  const title=$('gm-title-input').value.trim(); if(!title){toast('⚠️ Goal title required','warn'); return;}
  const data={
    title, deadline:$('gm-deadline').value, emoji:$('gm-emoji').value.trim()||'🎯',
    why:$('gm-why').value.trim(), reward:$('gm-reward').value.trim(),
    status:$('gm-status').value||'active', priority:$('gm-priority').value||'medium',
    progress:0, created:getToday()
  };
  const db=getDB(); const u=uid_user();
  if(!db.goals) db.goals={}; if(!db.goals[u]) db.goals[u]=[];
  if(_editGoalId){
    const i=db.goals[u].findIndex(x=>x.id===_editGoalId);
    if(i>=0) db.goals[u][i]={...db.goals[u][i],...data,progress:db.goals[u][i].progress};
    toast('✅ Goal updated');
  } else {
    db.goals[u].push({id:uidGoal(),...data}); toast('🎯 Goal added!');
  }
  closeModal('goal-modal'); save(); renderGoals(); updateDashboardGoals();
}

function deleteGoal(id){
  const db=getDB(); const u=uid_user();
  db.goals[u]=(db.goals[u]||[]).filter(g=>g.id!==id);
  // Cascade delete tasks, notes, reminders
  if(db.goalTasks&&db.goalTasks[u]) delete db.goalTasks[u][id];
  if(db.goalNotes&&db.goalNotes[u]) delete db.goalNotes[u][id];
  if(db.goalReminders&&db.goalReminders[u]) delete db.goalReminders[u][id];
  save(); renderGoals(); updateDashboardGoals(); toast('Goal deleted');
}

function recalcGoalProgress(gid){
  const tasks=getGoalTasks(gid); if(!tasks.length) return;
  let score = 0;
  let maxScore = 0;
  
  tasks.forEach(t => {
    const isRecurring = t.frequency && t.frequency !== 'none';
    if (isRecurring) {
      // For recurring tasks, we consider them "progressing" if they have at least 1 history log.
      // But to be fair to one-time tasks, let's just count a recurring task as 1 point per check-in (up to 30 max for example) or simply 100% if they hit a certain threshold.
      // Simplest logic: If it's recurring, it contributes fully if it has been done at least once, or proportionally. Let's just track how many times it was done.
      // Actually, the user wants "progress pta kr sku". Let's give each recurring task a max score of 10 for progress calculation.
      maxScore += 10;
      score += Math.min(Object.keys(t.history || {}).length, 10); 
    } else {
      maxScore += 10;
      if (t.status === 'done') score += 10;
    }
  });
  
  const db=getDB(); const u=uid_user(); const g=(db.goals[u]||[]).find(x=>x.id===gid);
  if(g){ 
    g.progress= maxScore > 0 ? Math.round((score/maxScore)*100) : 0; 
    if(g.progress>=100&&g.status!=='completed'){ 
      g.status='completed'; toast('🎉 Goal Achieved: '+g.title); 
    } else if (g.progress < 100 && g.status === 'completed') {
      g.status = 'active';
    }
  }
  save(); renderGoals();
}

// ─── Goal Detail View (Tasks, Notes, Tracker, Reminders) ──────────────────
function openGoalDetail(gid){
  _activeGoalId=gid;
  const g=getGoals().find(x=>x.id===gid); if(!g) return;
  $('gd-title').textContent=g.title; $('gd-emoji').textContent=g.emoji||'🎯';
  $('gd-meta').innerHTML=`<span class="gd-badge ${g.status}">${g.status}</span><span class="gd-badge priority-${g.priority}">${g.priority}</span><span>📅 ${fmtDate(g.deadline)}</span>${g.reward?`<span>🎁 ${esc(g.reward)}</span>`:''}`;
  $('gd-why').textContent=g.why||'No motivation note yet.';
  $('gd-progress-fill').style.width=(g.progress||0)+'%';
  $('gd-progress-text').textContent=(g.progress||0)+'% complete';

  // Reset tabs
  switchGoalTab('tasks');
  openModal('goal-detail-modal');
}

function switchGoalTab(tab){
  document.querySelectorAll('.gd-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.querySelectorAll('.gd-panel').forEach(p=>p.classList.toggle('active',p.id==='gd-'+tab));
  if(tab==='tasks') renderGoalTasks(_activeGoalId);
  if(tab==='notes') renderGoalNotes(_activeGoalId);
  if(tab==='tracker') renderGoalTracker(_activeGoalId);
  if(tab==='reminders') renderGoalReminders(_activeGoalId);
}

// ─── Goal Tasks ───────────────────────────────────────────────────────────
function renderGoalTasks(gid){
  const tasks=getGoalTasks(gid);
  const today=getToday();
  const els = document.querySelectorAll('[id="gd-tasks-list"]');
  if(!els.length) return;
  
  if(!tasks.length){ 
    els.forEach(el => el.innerHTML='<div class="empty-state compact"><div class="empty-state-icon">📋</div><h4>No tasks yet</h4><p>Break this goal into smaller steps.</p></div>');
    return; 
  }
  
  const html = tasks.map((t,i)=>{
    const isRecurring = t.frequency && t.frequency !== 'none';
    const isDone = isRecurring ? (t.history && t.history[today] === 'done') : (t.status === 'done');
    return `
    <div class="gtask-card ${isDone ? 'done' : ''}" data-gtid="${t.id}" style="border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 12px; background: var(--surface); display: flex; flex-direction: column; gap: 8px; transition: all 0.2s;">
      <div class="gtask-hd" style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="gtask-emoji" style="font-size: 20px;">${t.emoji||'✅'}</span>
          <div class="gtask-info">
            <div class="gtask-title" style="font-weight: 600; font-size: 16px; color: ${isDone ? 'var(--ts)' : 'var(--tp)'}; text-decoration: ${isDone ? 'line-through' : 'none'};">${esc(t.title)}</div>
            <div class="gtask-meta" style="font-size: 12px; color: var(--ts); display: flex; gap: 8px; margin-top: 4px;">
              ${t.frequency ? `<span class="gtag" style="background: var(--bg); padding: 2px 8px; border-radius: 12px; border: 1px solid var(--border);">🔄 ${FREQ_LABELS[t.frequency]||t.frequency}</span>` : ''}
              ${t.priority ? `<span class="gtag priority-${t.priority}" style="background: var(--bg); padding: 2px 8px; border-radius: 12px; border: 1px solid var(--border);">⚡ ${t.priority}</span>` : ''}
              ${isRecurring ? `<span class="gtag" style="background: var(--bg); padding: 2px 8px; border-radius: 12px; border: 1px solid var(--border);">🔥 ${Object.keys(t.history||{}).length} Total</span>` : ''}
            </div>
          </div>
        </div>
        <button class="hc-btn" data-gact="toggle-task" data-gid="${gid}" data-tid="${t.id}" title="Toggle" style="background: ${isDone ? 'var(--ok)' : 'var(--bg)'}; color: ${isDone ? '#fff' : 'var(--tp)'}; border: 1px solid ${isDone ? 'var(--ok)' : 'var(--border)'}; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;">
          ${isDone ? '✓' : ''}
        </button>
      </div>
      ${t.description ? `<div class="gtask-desc" style="font-size: 14px; color: var(--ts); margin-top: 4px;">${esc(t.description)}</div>` : ''}
      ${t.notes ? `<div class="gtask-notes" style="font-size: 13px; color: var(--ts); background: var(--bg); padding: 8px; border-radius: 8px; margin-top: 4px;">📝 ${esc(t.notes)}</div>` : ''}
      <div class="gtask-acts" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
        <button class="btn btn-ghost btn-xs" data-gact="edit-task" data-gid="${gid}" data-tid="${t.id}">✏️ Edit</button>
        <button class="btn btn-ghost btn-xs del" data-gact="delete-task" data-gid="${gid}" data-tid="${t.id}" style="color: var(--danger);">🗑️ Delete</button>
      </div>
    </div>`;
  }).join('');
  
  els.forEach(el => el.innerHTML = html);
}

function openTaskModal(gid, tid=null){
  _activeGoalId=gid; _editTaskId=tid;
  $('tkm-title').textContent=tid?'Edit Task':'Add Task';
  if(tid){
    const t=getGoalTasks(gid).find(x=>x.id===tid);
    if(t){ $('tkm-title-inp').value=t.title||''; $('tkm-desc').value=t.description||''; $('tkm-notes').value=t.notes||''; $('tkm-emoji').value=t.emoji||''; $('tkm-start').value=t.startDate||''; $('tkm-time').value=t.time||''; $('tkm-freq').value=t.frequency||'daily'; $('tkm-priority').value=t.priority||'medium'; $('tkm-reminder').value=t.reminder||''; $('tkm-status').value=t.status||'pending'; }
  } else {
    ['tkm-title-inp','tkm-desc','tkm-notes','tkm-emoji','tkm-start','tkm-time','tkm-reminder'].forEach(i=>$(i).value=''); $('tkm-freq').value='daily'; $('tkm-priority').value='medium'; $('tkm-status').value='pending';
  }
  openModal('task-modal');
}

let _editTaskId=null;
function saveTask(){
  const title=$('tkm-title-inp').value.trim(); if(!title){toast('⚠️ Task title required','warn'); return;}
  const data={
    title, description:$('tkm-desc').value.trim(), notes:$('tkm-notes').value.trim(),
    emoji:$('tkm-emoji').value.trim()||'✅', startDate:$('tkm-start').value, time:$('tkm-time').value,
    frequency:$('tkm-freq').value, priority:$('tkm-priority').value, reminder:$('tkm-reminder').value.trim(),
    status:$('tkm-status').value||'pending', created:getToday()
  };
  const tasks=getGoalTasks(_activeGoalId);
  if(_editTaskId){
    const i=tasks.findIndex(x=>x.id===_editTaskId);
    if(i>=0) tasks[i]={...tasks[i],...data};
  } else {
    tasks.push({id:uid(),...data});
  }
  setGoalTasks(_activeGoalId,tasks); save(); renderGoalTasks(_activeGoalId); recalcGoalProgress(_activeGoalId);
  closeModal('task-modal'); toast(_editTaskId?'Task updated':'Task added');
}

function toggleTask(gid,tid){
  const tasks=getGoalTasks(gid); const t=tasks.find(x=>x.id===tid);
  if(!t) return;
  const today=getToday();
  const isRecurring = t.frequency && t.frequency !== 'none';
  if (isRecurring) {
    t.history = t.history || {};
    if (t.history[today] === 'done') {
      delete t.history[today];
      toast('Task unchecked for today');
    } else {
      t.history[today] = 'done';
      toast('Task completed for today! 🎉');
    }
  } else {
    t.status=(t.status==='done')?'pending':'done';
    toast(t.status==='done'?'Task completed!':'Task reopened');
  }
  setGoalTasks(gid,tasks); save(); renderGoalTasks(gid); recalcGoalProgress(gid);
}
function deleteTask(gid,tid){ const tasks=getGoalTasks(gid).filter(x=>x.id!==tid); setGoalTasks(gid,tasks); save(); renderGoalTasks(gid); recalcGoalProgress(gid); toast('Task deleted'); }
function editTask(gid,tid){ openTaskModal(gid,tid); }

function addInlineTask(gid){
  const titleInput=document.getElementById(`inline-t-title-${gid}`);
  const freqInput=document.getElementById(`inline-t-freq-${gid}`);
  if(!titleInput) return;
  const title=titleInput.value.trim(); if(!title){toast('⚠️ Task required','warn'); return;}
  const frequency=freqInput?freqInput.value:'none';
  const tasks=getGoalTasks(gid);
  tasks.push({
    id:uid(), title, description:'', notes:'', emoji:'✅', startDate:getToday(), time:'',
    frequency, priority:'medium', reminder:'', status:'pending', created:getToday()
  });
  setGoalTasks(gid,tasks); save(); recalcGoalProgress(gid); toast('Task added');
}

// ─── Goal Notes & Summary ─────────────────────────────────────────────────
function renderGoalNotes(gid){
  const notes=getGoalNotes(gid);
  const listEls = document.querySelectorAll('[id="gd-notes-list"]');
  const timeEls = document.querySelectorAll('[id="gd-notes-timeline"]');
  if(!listEls.length) return;
  
  if(!notes.length){ 
    const emptyHtml = '<div class="empty-state compact"><div class="empty-state-icon">📝</div><h4>No notes yet</h4><p>Track your progress, learnings, and reflections.</p></div>';
    listEls.forEach(el => el.innerHTML = emptyHtml);
    timeEls.forEach(el => el.innerHTML = '');
    return; 
  }
  
  const listHtml = notes.slice().reverse().map(n=>`
    <div class="gnote-card">
      <div class="gnote-hd"><span class="gnote-date">${fmtDate(n.date)}</span><span class="gnote-type">${n.type||'Note'}</span></div>
      <div class="gnote-body">${esc(n.text)}</div>
      ${n.tags?`<div class="gnote-tags">${n.tags.map(t=>`<span class="gnote-tag">#${esc(t)}</span>`).join('')}</div>`:''}
    </div>`).join('');
    
  listEls.forEach(el => el.innerHTML = listHtml);
  
  // Timeline view
  const timeHtml = notes.map((n,i)=>`
    <div class="gtl-item ${i===notes.length-1?'last':''}">
      <div class="gtl-dot"></div>
      <div class="gtl-content">
        <div class="gtl-date">${fmtDate(n.date)}</div>
        <div class="gtl-text">${esc(n.text.slice(0,120))}${n.text.length>120?'…':''}</div>
      </div>
    </div>`).join('');
    
  timeEls.forEach(el => el.innerHTML = timeHtml);
}

function addGoalNote(){
  const gid=_activeGoalId; const text=$('gn-text').value.trim(); if(!text){toast('Write something first','warn'); return;}
  const type=$('gn-type').value||'progress'; const tags=($('gn-tags').value||'').split(',').map(t=>t.trim()).filter(Boolean);
  const notes=getGoalNotes(gid); notes.push({id:uid(), text, type, tags, date:getToday()});
  setGoalNotes(gid,notes); $('gn-text').value=''; $('gn-tags').value=''; save(); renderGoalNotes(gid); toast('Note saved');
}

// ─── Goal Tracker ─────────────────────────────────────────────────────────
function renderGoalTracker(gid){
  const tasks=getGoalTasks(gid); const today=getToday();
  const statEls = document.querySelectorAll('[id="gd-tracker-stats"]');
  const listEls = document.querySelectorAll('[id="gd-tracker-list"]');
  
  let doneCount = 0;
  let pendingCount = 0;
  let recurringCount = 0;
  let totalCompletions = 0;

  tasks.forEach(t => {
    const isRecurring = t.frequency && t.frequency !== 'none';
    if (isRecurring) {
      recurringCount++;
      totalCompletions += Object.keys(t.history || {}).length;
      if (t.history && t.history[today] === 'done') doneCount++;
      else pendingCount++;
    } else {
      if (t.status === 'done') doneCount++;
      else pendingCount++;
    }
  });

  const stats={
    'Total Tasks': tasks.length,
    'Done Today': doneCount,
    'Pending': pendingCount,
    'Recurring': recurringCount,
    'Total Hits': totalCompletions
  };
  
  const statsHtml = Object.entries(stats).map(([k,v])=>`<div class="gstat-box" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; text-align: center; flex: 1; min-width: 80px;"><div class="gstat-num" style="font-size: 24px; font-weight: bold; color: var(--pri);">${v}</div><div class="gstat-label" style="font-size: 11px; color: var(--ts); text-transform: uppercase; margin-top: 4px;">${k}</div></div>`).join('');
  statEls.forEach(el => el.innerHTML = statsHtml);
  
  // Try to find the filter input, fallback to 'all'
  let filter = 'all';
  const filterInput = document.querySelector('[id="gd-tracker-filter"]');
  if(filterInput) filter = filterInput.value;
  
  let filtered=tasks;
  if(filter==='pending') filtered=tasks.filter(t => (t.frequency && t.frequency !== 'none' ? !(t.history && t.history[today] === 'done') : t.status !== 'done'));
  else if(filter==='done') filtered=tasks.filter(t => (t.frequency && t.frequency !== 'none' ? (t.history && t.history[today] === 'done') : t.status === 'done'));
  
  const listHtml = filtered.length ? filtered.map(t=>{
    const isRecurring = t.frequency && t.frequency !== 'none';
    const isDone = isRecurring ? (t.history && t.history[today] === 'done') : (t.status === 'done');
    return `
    <div class="gtrack-row ${isDone ? 'done' : ''}" style="display: grid; grid-template-columns: auto 1fr auto auto; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border); align-items: center;">
      <span class="gtrack-check" style="font-size: 18px; color: ${isDone ? 'var(--ok)' : 'var(--ts)'};">${isDone ? '✅' : '⬜'}</span>
      <span class="gtrack-title" style="font-weight: 500; color: ${isDone ? 'var(--ts)' : 'var(--tp)'}; text-decoration: ${isDone ? 'line-through' : 'none'};">${esc(t.title)}</span>
      <span class="gtrack-freq" style="font-size: 12px; padding: 4px 8px; border-radius: 8px; background: var(--bg); border: 1px solid var(--border);">${FREQ_LABELS[t.frequency]||t.frequency||'—'}</span>
      <span class="gtrack-date" style="font-size: 12px; color: var(--ts);">${isRecurring ? `🔥 ${Object.keys(t.history||{}).length}` : (t.startDate||'—')}</span>
    </div>`;
  }).join('') : '<p class="empty-msg" style="padding: 24px; text-align: center; color: var(--ts);">No tasks match this filter.</p>';
  
  listEls.forEach(el => el.innerHTML = listHtml);
}

// ─── Goal Reminders ────────────────────────────────────────────────────────
function renderGoalReminders(gid){
  const reminders=getGoalReminders(gid);
  if(!reminders.length){ $('gd-rem-list').innerHTML='<div class="empty-state compact"><div class="empty-state-icon">🔔</div><h4>No reminders</h4><p>Set reminders for tasks and milestones.</p></div>'; return; }
  $('gd-rem-list').innerHTML=reminders.map(r=>`
    <div class="grem-card ${r.sent?'sent':''}">
      <div class="grem-hd"><span class="grem-time">${r.time}</span><span class="grem-offset">${r.offset||'On time'}</span></div>
      <div class="grem-body">${esc(r.message)}</div>
      <div class="grem-acts"><button class="btn btn-ghost btn-xs del" data-gact="delete-rem" data-gid="${gid}" data-rid="${r.id}">Delete</button></div>
    </div>`).join('');
}

function addGoalReminder(){
  const gid=_activeGoalId; const time=$('grm-time').value; const msg=$('grm-msg').value.trim(); const offset=$('grm-offset').value;
  if(!time||!msg){toast('Fill time and message','warn'); return;}
  const reminders=getGoalReminders(gid); reminders.push({id:uid(), time, message:msg, offset, sent:false, created:getToday()});
  setGoalReminders(gid,reminders); $('grm-msg').value=''; save(); renderGoalReminders(gid); toast('Reminder set');
}
function deleteReminder(gid,rid){ const r=getGoalReminders(gid).filter(x=>x.id!==rid); setGoalReminders(gid,r); save(); renderGoalReminders(gid); toast('Reminder removed'); }

// ─── Render Goals Grid (expanded cards with tabs preview) ─────────────────
function renderGoals(){
  const el=$('goals-grid'); if(!el) return;
  const goals=getGoals();
  if(!goals.length){ el.innerHTML='<div class="empty-state"><div class="empty-state-icon">🎯</div><h3>No goals yet</h3><p>Set a goal and stay motivated with rewards.</p><button class="btn btn-primary" onclick="HF.GoalManager.openGoalModal()">+ Add Your First Goal</button></div>'; return; }
  el.innerHTML=goals.map(g=>{
    const pct=parseInt(g.progress||0), done_=pct>=100;
    const tasks=getGoalTasks(g.id)||[]; const tDone=tasks.filter(t=>t.status==='done').length;
    return `<div class="goal-card ${done_?'done-goal':''}" data-gact="detail" data-gid="${g.id}" style="cursor:pointer; transition:transform 0.2s; border:1px solid transparent;">
      <div class="gc-top">
        <span class="gc-emoji">${esc(g.emoji||'🎯')}</span>
        <div class="gc-acts">
          <button class="btn btn-ghost btn-sm" data-gact="edit" data-gid="${g.id}" title="Edit" style="padding:0 8px; height:28px;">✏️ Edit</button>
          <button class="btn btn-ghost btn-sm" data-gact="delete" data-gid="${g.id}" title="Delete" style="padding:0 8px; height:28px; color:var(--danger)">🗑️ Delete</button>
        </div>
      </div>
      <div class="gc-title">${esc(g.title)}</div>
      ${g.why?`<div class="gc-why">💡 ${esc(g.why)}</div>`:''}
      <div class="gc-progress-wrap">
        <div class="gc-progress-bar-outer"><div class="gc-progress-bar" style="width:${pct}%;background:${done_?'var(--ok)':'var(--pri)'}"></div></div>
        <div class="gc-progress-label"><span>${pct}% — ${tDone}/${tasks.length} tasks</span></div>
      </div>
      
      <div class="gc-inline-tasks" style="margin-top:12px; border-top:1px solid var(--bdr); padding-top:12px;" data-gact="none">
        <div style="font-weight:600; font-size:13px; margin-bottom:8px; color:var(--tp); display:flex; justify-content:space-between;">
          <span>📋 To-Do List</span>
          <span style="font-size:11px; font-weight:normal; color:var(--pri); cursor:pointer;" data-gact="detail" data-gid="${g.id}">View Details →</span>
        </div>
        ${tasks.slice(0, 5).map(t=>`
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:13px;">
            <input type="checkbox" ${t.status==='done'?'checked':''} data-gact="toggle-task-chk" data-gid="${g.id}" data-tid="${t.id}">
            <span style="flex:1; ${t.status==='done'?'text-decoration:line-through; opacity:0.6':''}">${esc(t.title)}</span>
            ${t.frequency&&t.frequency!=='none'?`<span style="font-size:10px; background:var(--bg3); padding:2px 4px; border-radius:4px; color:var(--ts)">${FREQ_LABELS[t.frequency]||t.frequency}</span>`:''}
            <button data-gact="delete-task" data-gid="${g.id}" data-tid="${t.id}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:12px; padding:0 4px;" title="Delete Task">✕</button>
          </div>
        `).join('')}
        ${tasks.length > 5 ? `<div style="font-size:11px; color:var(--ts); text-align:center; cursor:pointer; padding:4px 0;" data-gact="detail" data-gid="${g.id}">View ${tasks.length - 5} more tasks...</div>` : ''}
        
        <div style="display:flex; gap:6px; margin-top:8px;">
          <input type="text" id="inline-t-title-${g.id}" class="form-input" style="flex:1; padding:4px 8px; font-size:13px; min-height:0; height:28px;" placeholder="New to-do..."/>
          <select id="inline-t-freq-${g.id}" class="form-select" style="width:105px; padding:4px 8px; font-size:12px; min-height:0; height:28px;">
            <option value="none">One-time</option>
            <option value="daily">Daily</option>
            <option value="weekly">1 in week</option>
            <option value="2week">2 in week</option>
            <option value="10days">1 in 10 day</option>
            <option value="15days">1 in 15 day</option>
            <option value="monthly">1 in month</option>
          </select>
          <button class="btn btn-primary" style="padding:0 8px; min-height:0; height:28px; font-size:16px; line-height:1;" data-gact="add-inline-task" data-gid="${g.id}">+</button>
        </div>
      </div>
      
      <div class="gc-meta" style="margin-top:12px;">
        <span class="gc-badge ${g.status}">${g.status}</span>
        <span class="gc-badge priority-${g.priority}">${g.priority}</span>
        <span class="gc-deadline">📅 ${fmtDate(g.deadline)}</span>
      </div>
      ${g.reward&&!done_?`<div class="gc-reward">🎁 ${esc(g.reward)}</div>`:''}
      ${done_?`<div style="color:var(--ok);font-weight:700;font-size:13px;margin-top:8px">🏆 GOAL ACHIEVED!</div>`:''}
    </div>`;
  }).join('');
}

function confirmDeleteGoal(id){ 
  if(window.HFCore&&window.HFCore.helpers&&window.HFCore.helpers.confirm){
    window.HFCore.helpers.confirm('Delete Goal','Delete this goal and all its tasks/notes/reminders?','🗑️',()=>deleteGoal(id));
  } else {
    if(confirm('Delete this goal and all its tasks/notes/reminders?')) deleteGoal(id);
  }
}

// ─── Dashboard Stats Integration ──────────────────────────────────────────
function updateDashboardGoals(){
  const goals=getGoals();
  const sdGoals=$('sd-goals'); if(sdGoals) sdGoals.textContent=goals.filter(g=>g.status==='active').length;
}

// ─── Modal helpers (shadow existing openM/closeM to add focus trap) ─────────
function openModal(id){ const ov=$(id); if(!ov) return; ov.classList.add('open'); ov.setAttribute('aria-hidden','false'); const fb=ov.querySelector('input, textarea, button, select'); if(fb) fb.focus(); }
function closeModal(id){ const ov=$(id); if(!ov) return; ov.classList.remove('open'); ov.setAttribute('aria-hidden','true'); }

// ─── Event Bindings (delegated from script.js or manual here) ─────────────
function bindGoalEvents(){
  if($('btn-add-goal')) $('btn-add-goal').addEventListener('click',()=>openGoalModal());
  if($('gm-save')) $('gm-save').addEventListener('click',saveGoal);
  if($('gm-cancel')) $('gm-cancel').addEventListener('click',()=>closeModal('goal-modal'));
  if($('gm-x')) $('gm-x').addEventListener('click',()=>closeModal('goal-modal'));

  // Goal detail modal
  if($('gd-x')) $('gd-x').addEventListener('click',()=>closeModal('goal-detail-modal'));
  if($('gd-close')) $('gd-close').addEventListener('click',()=>closeModal('goal-detail-modal'));
  document.querySelectorAll('.gd-tab').forEach(t=>t.addEventListener('click',()=>switchGoalTab(t.dataset.tab)));
  if($('btn-add-task')) $('btn-add-task').addEventListener('click',()=>openTaskModal(_activeGoalId));
  if($('tkm-save')) $('tkm-save').addEventListener('click',saveTask);
  if($('tkm-cancel')) $('tkm-cancel').addEventListener('click',()=>closeModal('task-modal'));
  if($('tkm-x')) $('tkm-x').addEventListener('click',()=>closeModal('task-modal'));
  if($('btn-save-note')) $('btn-save-note').addEventListener('click',addGoalNote);
  if($('btn-add-reminder')) $('btn-add-reminder').addEventListener('click',addGoalReminder);
  if($('gd-tracker-filter')) $('gd-tracker-filter').addEventListener('change',()=>renderGoalTracker(_activeGoalId));

  // Global Event Delegation for Goals
  if (!window._goalEventsBound) {
    document.body.addEventListener('click', e => {
      const el = e.target.closest('[data-gact]');
      if(!el) return;
      const act = el.dataset.gact;
      const gid = el.dataset.gid;
      const tid = el.dataset.tid;
      const rid = el.dataset.rid;
      
      if (act === 'none') { e.stopPropagation(); return; }
      
      if (act === 'detail' || act === 'edit' || act === 'delete' || act === 'add-inline-task' || act === 'delete-task' || act === 'edit-task') {
        e.stopPropagation();
      }
      
      if(act === 'detail') HF.GoalManager.openGoalDetail(gid);
      if(act === 'edit') HF.GoalManager.openGoalModal(gid);
      if(act === 'delete') HF.GoalManager.confirmDeleteGoal(gid);
      if(act === 'toggle-task') HF.GoalManager.toggleTask(gid, tid);
      if(act === 'delete-task') HF.GoalManager.deleteTask(gid, tid);
      if(act === 'edit-task') HF.GoalManager.editTask(gid, tid);
      if(act === 'add-inline-task') HF.GoalManager.addInlineTask(gid);
      if(act === 'delete-rem') HF.GoalManager.deleteReminder(gid, rid);
    });

    document.body.addEventListener('click', e => {
      if (e.target.id === 'btn-add-task' || e.target.closest('#btn-add-task')) {
        if (window._activeGoalId) {
          HF.GoalManager.openTaskModal(window._activeGoalId);
        }
      }
    });

    document.body.addEventListener('change', e => {
      const el = e.target.closest('[data-gact]');
      if(!el) return;
      if(el.dataset.gact === 'toggle-task-chk') HF.GoalManager.toggleTask(el.dataset.gid, el.dataset.tid);
    });
    
    // Add hover effect via CSS injection
    if (!document.getElementById('goal-hover-style')) {
      const style = document.createElement('style');
      style.id = 'goal-hover-style';
      style.innerHTML = '.goal-card[data-gact="detail"]:hover { transform: translateY(-2px) !important; border-color: var(--pri) !important; }';
      document.head.appendChild(style);
    }
    
    window._goalEventsBound = true;
  }
}

// ─── Upcoming Timeline (goals + tasks only) ────────────────────────────────
function getUpcomingItems(){
  const u=uid_user(); const items=[];
  const goals=getGoals().filter(g=>g.deadline&&g.status!=='completed');
  goals.forEach(g=>items.push({type:'goal', title:g.title, date:g.deadline, time:'', icon:'🎯', color:'var(--pri)'}));
  goals.forEach(g=>{
    const tasks=getGoalTasks(g.id).filter(t=>t.status!=='done'&&t.startDate);
    tasks.forEach(t=>items.push({type:'task', title:t.title, date:t.startDate, time:t.time||'', icon:t.emoji||'✅', color:'var(--pri-l)', goalTitle:g.title}));
  });
  items.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  return items;
}

// ─── Export to global ─────────────────────────────────────────────────────
window.HF = window.HF || {};
window.HF.GoalManager = {
  renderGoals, openGoalModal, saveGoal, deleteGoal, confirmDeleteGoal, recalcGoalProgress,
  openGoalDetail, switchGoalTab,
  renderGoalTasks, openTaskModal, saveTask, toggleTask, deleteTask, editTask, addInlineTask,
  renderGoalNotes, addGoalNote,
  renderGoalTracker,
  renderGoalReminders, addGoalReminder, deleteReminder,
  getUpcomingItems, updateDashboardGoals,
  bindGoalEvents,
  openModal, closeModal,
  // Expose internals for timeline module
  _getGoalTasks: getGoalTasks,
  _getGoals: getGoals,
};

// Override global renderGoals and openGoalModal to wire into existing app lifecycle
window.renderGoals = () => { renderGoals(); updateDashboardGoals(); };
window.openGoalModal = (id) => openGoalModal(id);

if (window.HFCore && window.HFCore.override) {
  window.HFCore.override({
    renderGoals: window.renderGoals,
    openGoalModal: window.openGoalModal
  });
}

// Boot bindings on DOM ready
document.addEventListener('DOMContentLoaded', ()=>{
  setTimeout(bindGoalEvents, 200);
});

})();
