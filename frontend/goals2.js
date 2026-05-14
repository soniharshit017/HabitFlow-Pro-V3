'use strict';

/**
 * Premium Smart Goal Management System
 * Re-built from scratch for HabitFlow-Pro-V3
 */
(function() {
  const $ = id => document.getElementById(id);
  const $$ = s => document.querySelectorAll(s);
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const uid = () => 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const today = () => new Date().toISOString().slice(0, 10);
  const fmt = d => { if (!d) return '—'; try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return d; } };
  const sv = () => { try { localStorage.setItem('hf_pro_v3', JSON.stringify(window.DB || {})); } catch (e) {} if (window.save) window.save(); };
  const toast = m => { if (window.toast) window.toast(m); else if (window.HFCore && window.HFCore.toast) window.HFCore.toast(m); };
  
  const DB = () => window.DB || (window.HFCore ? window.HFCore.getDB() : {});
  const uid_u = () => (window.CU || (window.HFCore ? window.HFCore.getCurrentUser() : {}))?.id || 'guest';

  // Constants
  const FREQ = { none: 'One-time', daily: 'Daily', '1week': 'Once a week', '2week': 'Twice a week', '10days': 'Once in 10 days', '15days': 'Once in 15 days', monthly: 'Once a month' };
  const PRIO = { high: 'High', medium: 'Medium', low: 'Low' };
  const STATUS = { active: 'Active', completed: 'Completed', paused: 'Paused', archived: 'Archived' };

  // Data Accessors
  function getGoals() { return (DB().goals || {})[uid_u()] || []; }
  function setGoals(gs) { const db = DB(); if (!db.goals) db.goals = {}; db.goals[uid_u()] = gs; if(window.DB) window.DB = db; }
  
  function getTasks(gid) { return (((DB().goalTasks || {})[uid_u()]) || {})[gid] || []; }
  function setTasks(gid, ts) { const db = DB(); if (!db.goalTasks) db.goalTasks = {}; if (!db.goalTasks[uid_u()]) db.goalTasks[uid_u()] = {}; db.goalTasks[uid_u()][gid] = ts; if(window.DB) window.DB = db; }
  
  function getNotes(gid) { return (((DB().goalNotes || {})[uid_u()]) || {})[gid] || []; }
  function setNotes(gid, ns) { const db = DB(); if (!db.goalNotes) db.goalNotes = {}; if (!db.goalNotes[uid_u()]) db.goalNotes[uid_u()] = {}; db.goalNotes[uid_u()][gid] = ns; if(window.DB) window.DB = db; }

  // State
  let activeGoalId = null;
  let editTaskId = null;
  let activeNoteTaskId = null;

  /* ═══════════════════════════════════════════
     1. GOAL CRUD
  ═══════════════════════════════════════════ */
  function openGoalModal(gid = null) {
    const isEdit = !!gid;
    $('gam-title').textContent = isEdit ? 'Edit Goal' : 'Create New Goal';
    
    if (isEdit) {
      const g = getGoals().find(x => x.id === gid);
      if (g) {
        $('gam-title-inp').value = g.title || '';
        $('gam-desc').value = g.desc || '';
        $('gam-emoji').value = g.emoji || '🎯';
        $('gam-priority').value = g.priority || 'medium';
        $('gam-status').value = g.status || 'active';
        $('gam-deadline').value = g.deadline || '';
        $('gam-reward').value = g.reward || '';
      }
    } else {
      ['gam-title-inp', 'gam-desc', 'gam-emoji', 'gam-deadline', 'gam-reward'].forEach(i => $(i).value = '');
      $('gam-emoji').value = '🎯';
      $('gam-priority').value = 'medium';
      $('gam-status').value = 'active';
    }
    
    $('gam-overlay').classList.add('open');
    $('gam-title-inp').focus();
    
    $('btn-gam-save').onclick = () => saveGoal(gid);
  }

  function closeGoalModal() {
    $('gam-overlay').classList.remove('open');
  }

  function saveGoal(gid) {
    const title = $('gam-title-inp').value.trim();
    if (!title) return toast('⚠️ Goal title is required');
    
    const data = {
      title,
      desc: $('gam-desc').value.trim(),
      emoji: $('gam-emoji').value.trim() || '🎯',
      priority: $('gam-priority').value || 'medium',
      status: $('gam-status').value || 'active',
      deadline: $('gam-deadline').value,
      reward: $('gam-reward').value.trim(),
      updated: today()
    };

    let goals = getGoals();
    if (gid) {
      const idx = goals.findIndex(g => g.id === gid);
      if (idx >= 0) {
        goals[idx] = { ...goals[idx], ...data };
        toast('Goal updated');
      }
    } else {
      data.id = uid();
      data.created = today();
      data.progress = 0;
      goals.push(data);
      toast('Goal created! 🎯');
    }
    
    setGoals(goals);
    sv();
    closeGoalModal();
    renderGoals();
  }

  function deleteGoal(gid) {
    if (!confirm('Are you sure you want to delete this goal and all its tasks?')) return;
    setGoals(getGoals().filter(g => g.id !== gid));
    setTasks(gid, []);
    setNotes(gid, []);
    sv();
    toast('Goal deleted');
    closeGoalDetail();
    renderGoals();
  }

  /* ═══════════════════════════════════════════
     2. PROGRESS CALCULATION
  ═══════════════════════════════════════════ */
  function recalcProgress(gid) {
    const tasks = getTasks(gid);
    if (!tasks.length) return 0;
    
    let score = 0;
    let maxScore = 0;
    
    tasks.forEach(t => {
      const isRecurring = t.freq && t.freq !== 'none';
      if (isRecurring) {
        maxScore += 10;
        score += Math.min(Object.keys(t.history || {}).length, 10);
      } else {
        maxScore += 10;
        if (t.status === 'done') score += 10;
      }
    });
    
    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    
    let goals = getGoals();
    const g = goals.find(x => x.id === gid);
    if (g) {
      g.progress = pct;
      if (pct >= 100 && g.status !== 'completed') {
        g.status = 'completed';
        toast('🎉 Goal Achieved: ' + g.title);
      } else if (pct < 100 && g.status === 'completed') {
        g.status = 'active';
      }
      setGoals(goals);
      sv();
    }
    return pct;
  }

  function getNextDateObj(t) {
    if (!t.freq || t.freq === 'none') return null;
    const cDate = new Date((t.startDate || t.created) + 'T00:00:00');
    const td = today();
    
    let nextDate = new Date(cDate);
    let daysToAdd = 1;
    if (t.freq === 'daily') daysToAdd = 1;
    else if (t.freq === '1week') daysToAdd = 7;
    else if (t.freq === '2week') daysToAdd = 3;
    else if (t.freq === '10days') daysToAdd = 10;
    else if (t.freq === '15days') daysToAdd = 15;
    
    let nextStr = nextDate.toISOString().slice(0, 10);
    
    while (nextStr < td) {
       if (t.freq === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
       else nextDate.setDate(nextDate.getDate() + daysToAdd);
       nextStr = nextDate.toISOString().slice(0, 10);
    }
    
    if (nextStr === td && t.history && t.history[td] === 'done') {
       if (t.freq === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
       else nextDate.setDate(nextDate.getDate() + daysToAdd);
    }
    
    return nextDate;
  }

  function formatNextDate(d) {
    if (!d) return '';
    const diffDays = Math.round((d - new Date(today() + 'T00:00:00')) / 86400000);
    if (diffDays === 0) return "Due Today";
    if (diffDays === 1) return "Due Tomorrow";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `Next: ${day}-${month}-${d.getFullYear()}`;
  }

  function getTimelineItems() {
    let items = [];
    const goals = getGoals();
    goals.forEach(g => {
      if (g.status === 'completed') return;
      if (g.deadline) {
        items.push({type:'goal', title:g.title, date:g.deadline, time:'23:59', icon:g.emoji||'🎯', color:'#3B82F6', sub:'Goal deadline'});
      }
      const tasks = getTasks(g.id);
      tasks.forEach(t => {
        if (t.freq && t.freq !== 'none') {
          const nextD = getNextDateObj(t);
          if (nextD) {
            const dStr = nextD.toISOString().slice(0, 10);
            items.push({type:'task', title:t.title, date:dStr, time:'09:00', icon:'✅', color:'#60A5FA', sub:'Goal: '+g.title});
          }
        } else {
          if (t.status !== 'done') {
            items.push({type:'task', title:t.title, date:t.created, time:'09:00', icon:'✅', color:'#60A5FA', sub:'Goal: '+g.title});
          }
        }
      });
    });
    return items;
  }

  /* ═══════════════════════════════════════════
     3. RENDER MAIN DASHBOARD
  ═══════════════════════════════════════════ */
  function renderGoals() {
    const grid = $('goals-grid-new');
    if (!grid) return;
    
    const goals = getGoals();
    
    if (!goals.length) {
      grid.innerHTML = `
        <div class="goals-empty-new">
          <div class="ei">🎯</div>
          <h3>No goals yet</h3>
          <p>Set a new goal to start tracking your progress.</p>
          <button class="btn btn-primary" onclick="HFGoals.openGoalModal()">+ Create Premium Goal</button>
        </div>
      `;
      return;
    }
    
    grid.innerHTML = goals.map(g => {
      const tasks = getTasks(g.id);
      const isDone = g.status === 'completed';
      const pct = g.progress || 0;
      
      // Inline tasks preview (max 3)
      let tasksPreview = '';
      if (tasks.length > 0) {
        const previewTasks = tasks.slice(0, 3);
        const td = today();
        tasksPreview = `<div class="goal-tasks-preview" style="margin-top:12px;">` + previewTasks.map(t => {
          const isRecurring = t.freq && t.freq !== 'none';
          const tDone = isRecurring ? (t.history && t.history[td] === 'done') : (t.status === 'done');
          const hasNote = !!(t.noteTitle || t.noteDesc);
          const noteIcon = hasNote ? `<span class="gtp-note-icon" title="${esc(t.noteTitle||'')}\n${esc(t.noteDesc||'')}" style="cursor:help; margin-left:6px; font-size:12px; color:var(--pri);">📝</span>` : '';
          return `
            <div class="goal-task-preview-item ${tDone ? 'done' : ''}" data-gact="toggle-task" data-gid="${g.id}" data-tid="${t.id}">
              <div class="gtp-check ${tDone ? 'done' : ''}">${tDone ? '✓' : ''}</div>
              <span class="gtp-title-span" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.title)} ${noteIcon}</span>
              ${isRecurring ? `<span style="font-size:10px;color:var(--ts);background:var(--bg2);padding:2px 6px;border-radius:10px;white-space:nowrap;">${formatNextDate(getNextDateObj(t))}</span>` : ''}
            </div>
          `;
        }).join('') + (tasks.length > 3 ? `<div style="font-size:11px;color:var(--ts);margin-top:4px;">+ ${tasks.length - 3} more</div>` : '') + `</div>`;
      } else {
        tasksPreview = `<div style="font-size:12px;color:var(--ts);margin-top:12px;font-style:italic;">No tasks added yet.</div>`;
      }
      
      return `
      <div class="goal-card-new" data-gact="open-detail" data-gid="${g.id}">
        <div class="goal-card-header">
          <div class="goal-emoji-badge">${g.emoji || '🎯'}</div>
          <div class="goal-card-title-wrap">
            <h3 class="goal-card-title">${esc(g.title)}</h3>
            ${g.desc ? `<div class="goal-card-desc">${esc(g.desc)}</div>` : ''}
          </div>
        </div>
        
        <div class="goal-badges">
          <span class="gbadge gbadge-${g.status}">${STATUS[g.status] || g.status}</span>
          ${g.priority ? `<span class="gbadge gbadge-${g.priority}">${PRIO[g.priority]} Prio</span>` : ''}
          ${g.deadline ? `<span class="gbadge gbadge-date">📅 ${fmt(g.deadline)}</span>` : ''}
        </div>
        
        <div class="goal-progress-wrap" style="margin-top:8px;">
          <div class="goal-progress-bar-outer">
            <div class="goal-progress-bar-inner" style="width:${pct}%"></div>
          </div>
          <div class="goal-progress-pct">${pct}%</div>
        </div>
        
        ${tasksPreview}
        
        <div class="goal-card-actions">
          <button class="gc-btn" data-gact="add-inline-task" data-gid="${g.id}">➕ Task</button>
          <button class="gc-btn" data-gact="edit-goal" data-gid="${g.id}">✏️ Edit</button>
          <button class="gc-btn danger" data-gact="delete-goal" data-gid="${g.id}">🗑️</button>
        </div>
      </div>
      `;
    }).join('');
  }

  /* ═══════════════════════════════════════════
     4. GOAL DETAIL MODAL
  ═══════════════════════════════════════════ */
  function openGoalDetail(gid) {
    activeGoalId = gid;
    const g = getGoals().find(x => x.id === gid);
    if (!g) return;
    
    $('gmd-title').textContent = g.title;
    $('gmd-emoji').textContent = g.emoji || '🎯';
    
    let meta = `<span class="gbadge gbadge-${g.status}">${STATUS[g.status] || g.status}</span>`;
    if (g.priority) meta += ` <span class="gbadge gbadge-${g.priority}">${PRIO[g.priority]} Prio</span>`;
    if (g.deadline) meta += ` <span class="gbadge gbadge-date">📅 ${fmt(g.deadline)}</span>`;
    if (g.reward) meta += ` <span class="gbadge gbadge-date" style="color:var(--pri)">🎁 ${esc(g.reward)}</span>`;
    $('gmd-meta').innerHTML = meta;
    
    $('gmd-progress-pct').textContent = (g.progress || 0) + '%';
    $('gmd-progress-fill').style.width = (g.progress || 0) + '%';
    
    switchTab('tasks');
    $('goal-detail-modal-new').classList.add('open');
  }

  function closeGoalDetail() {
    $('goal-detail-modal-new').classList.remove('open');
    activeGoalId = null;
  }

  function switchTab(tab) {
    $$('.gm-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    $$('.gm-panel').forEach(p => p.classList.toggle('active', p.id === 'gmp-' + tab));
    
    if (tab === 'tasks') renderDetailTasks();
    else if (tab === 'tracker') renderTracker();
    else if (tab === 'analytics') renderAnalytics();
    else if (tab === 'notes') renderNotes();
  }

  /* ═══════════════════════════════════════════
     5. TASK MANAGEMENT (Smart Frequency)
  ═══════════════════════════════════════════ */
  function renderDetailTasks() {
    const list = $('gmd-tasks-list');
    if (!list) return;
    const tasks = getTasks(activeGoalId);
    const td = today();
    
    if (!tasks.length) {
      list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--ts);"><div style="font-size:40px;margin-bottom:10px;">📝</div><p>No tasks yet. Break down your goal.</p></div>`;
      return;
    }
    
    list.innerHTML = tasks.map(t => {
      const isRecurring = t.freq && t.freq !== 'none';
      const isDone = isRecurring ? (t.history && t.history[td] === 'done') : (t.status === 'done');
      const isEditingNote = activeNoteTaskId === t.id;
      const noteHtml = isEditingNote ? `
        <div style="margin-top:12px; padding-top:12px; border-top:1px dashed var(--border);">
          <input type="text" id="gmd-tn-title-${t.id}" class="gm-input" placeholder="Note Title (e.g. Recipe of shake)" value="${esc(t.noteTitle||'')}" style="margin-bottom:8px; width:100%; padding:8px; font-size:13px;" onclick="event.stopPropagation()" />
          <textarea id="gmd-tn-desc-${t.id}" class="gm-input" rows="3" placeholder="Note details..." style="width:100%; margin-bottom:8px; padding:8px; font-size:13px; resize:vertical;" onclick="event.stopPropagation()">${esc(t.noteDesc||'')}</textarea>
          <div style="display:flex; gap:8px;">
            <button class="gm-task-btn" data-gact="save-task-note" data-gid="${activeGoalId}" data-tid="${t.id}" style="background:var(--pri); color:#fff; border-color:var(--pri);">Save Note</button>
            <button class="gm-task-btn" data-gact="cancel-task-note">Cancel</button>
          </div>
        </div>
      ` : (t.noteTitle || t.noteDesc ? `
        <div style="margin-top:8px; padding:10px; background:rgba(0,0,0,0.03); border-radius:8px; font-size:12px; color:var(--ts);">
          ${t.noteTitle ? `<strong style="color:var(--tp); display:block; margin-bottom:4px; font-size:13px;">${esc(t.noteTitle)}</strong>` : ''}
          ${t.noteDesc ? `<div style="white-space:pre-wrap; line-height:1.4;">${esc(t.noteDesc)}</div>` : ''}
        </div>
      ` : '');

      return `
        <div class="gm-task-card ${isDone ? 'done' : ''}" style="flex-direction:column; align-items:stretch;" data-gact="toggle-task" data-gid="${activeGoalId}" data-tid="${t.id}">
          <div style="display:flex; align-items:center; gap:12px; width:100%;">
            <div class="gm-task-check ${isDone ? (isRecurring ? 'today-done' : 'done') : ''}">${isDone ? '✓' : ''}</div>
            <div class="gm-task-body">
              <div class="gm-task-title">${esc(t.title)}</div>
              <div class="gm-task-meta">
                ${t.freq && t.freq !== 'none' ? `<span class="gbadge gbadge-freq">🔄 ${FREQ[t.freq] || t.freq}</span>` : ''}
                ${t.priority && t.priority !== 'medium' ? `<span class="gbadge gbadge-${t.priority}">${PRIO[t.priority]}</span>` : ''}
                ${isRecurring ? `<span>🔥 ${Object.keys(t.history || {}).length} Total</span>` : ''}
                ${isRecurring ? `<span class="gbadge gbadge-date" style="background:#fefce8;color:#a16207;">🗓️ ${formatNextDate(getNextDateObj(t))}</span>` : ''}
              </div>
            </div>
            <div class="gm-task-actions">
              <button class="gm-task-btn" data-gact="toggle-task-note" data-gid="${activeGoalId}" data-tid="${t.id}">📝 Note</button>
              <button class="gm-task-btn" data-gact="edit-task" data-gid="${activeGoalId}" data-tid="${t.id}">✏️ Edit</button>
              <button class="gm-task-btn del" data-gact="delete-task" data-gid="${activeGoalId}" data-tid="${t.id}">🗑️</button>
            </div>
          </div>
          ${noteHtml}
        </div>
      `;
    }).join('');
  }

  function toggleTask(gid, tid) {
    const tasks = getTasks(gid);
    const t = tasks.find(x => x.id === tid);
    if (!t) return;
    
    const td = today();
    const isRecurring = t.freq && t.freq !== 'none';
    
    if (isRecurring) {
      t.history = t.history || {};
      if (t.history[td] === 'done') {
        delete t.history[td];
        toast('Task unchecked for today');
      } else {
        t.history[td] = 'done';
        toast('Task completed for today! 🎉');
      }
    } else {
      t.status = t.status === 'done' ? 'pending' : 'done';
      toast(t.status === 'done' ? 'Task completed!' : 'Task reopened');
    }
    
    setTasks(gid, tasks);
    recalcProgress(gid);
    renderGoals();
    if (activeGoalId === gid) {
      renderDetailTasks();
      if ($('gmp-tracker').classList.contains('active')) renderTracker();
    }
  }

  function toggleAddTaskForm() {
    const form = $('gmd-add-task-form');
    if (form.style.display === 'none') {
      form.style.display = 'block';
      editTaskId = null;
      $('gmd-t-title').value = '';
      $('gmd-t-prio').value = 'medium';
      if ($('gmd-t-note-title')) $('gmd-t-note-title').value = '';
      if ($('gmd-t-note-desc')) $('gmd-t-note-desc').value = '';
      $('gmd-t-btn').textContent = 'Add Task';
      if ($('gmd-t-start')) $('gmd-t-start').value = today();
      previewNextDate();
      $('gmd-t-title').focus();
    } else {
      form.style.display = 'none';
    }
  }

  function previewNextDate() {
    const freq = $('gmd-t-freq').value;
    const preview = $('gmd-t-date-preview');
    if (!preview) return;
    
    if (freq === 'none') {
      preview.style.display = 'none';
      return;
    }
    
    const startVal = $('gmd-t-start') ? $('gmd-t-start').value : today();
    const d = new Date((startVal || today()) + 'T00:00:00');
    if (freq === 'daily') d.setDate(d.getDate() + 1);
    else if (freq === '1week') d.setDate(d.getDate() + 7);
    else if (freq === '2week') d.setDate(d.getDate() + 3);
    else if (freq === '10days') d.setDate(d.getDate() + 10);
    else if (freq === '15days') d.setDate(d.getDate() + 15);
    else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    
    preview.innerHTML = `📅 First cycle ends on: <b>${day}-${month}-${year}, ${dayName}</b>`;
    preview.style.display = 'block';
  }

  function saveTask() {
    const title = $('gmd-t-title').value.trim();
    if (!title) return toast('Task title required');
    
    const freq = $('gmd-t-freq').value;
    const priority = $('gmd-t-prio').value;
    
    let tasks = getTasks(activeGoalId);
    if (editTaskId) {
      const idx = tasks.findIndex(x => x.id === editTaskId);
      if (idx >= 0) {
        tasks[idx].title = title;
        tasks[idx].freq = freq;
        tasks[idx].priority = priority;
        if ($('gmd-t-start')) tasks[idx].startDate = $('gmd-t-start').value || today();
        if ($('gmd-t-note-title')) tasks[idx].noteTitle = $('gmd-t-note-title').value.trim();
        if ($('gmd-t-note-desc')) tasks[idx].noteDesc = $('gmd-t-note-desc').value.trim();
      }
      toast('Task updated');
    } else {
      tasks.push({
        id: uid(),
        title,
        freq,
        priority,
        status: 'pending',
        created: today(),
        startDate: $('gmd-t-start') ? ($('gmd-t-start').value || today()) : today(),
        history: {},
        noteTitle: $('gmd-t-note-title') ? $('gmd-t-note-title').value.trim() : '',
        noteDesc: $('gmd-t-note-desc') ? $('gmd-t-note-desc').value.trim() : ''
      });
      toast('Task added');
    }
    
    setTasks(activeGoalId, tasks);
    recalcProgress(activeGoalId);
    $('gmd-t-title').value = '';
    editTaskId = null;
    $('gmd-add-task-form').style.display = 'none';
    
    renderDetailTasks();
    renderGoals();
  }

  function editTask(gid, tid) {
    const t = getTasks(gid).find(x => x.id === tid);
    if (!t) return;
    $('gmd-add-task-form').style.display = 'block';
    $('gmd-t-title').value = t.title;
    $('gmd-t-freq').value = t.freq || 'none';
    $('gmd-t-prio').value = t.priority || 'medium';
    if ($('gmd-t-start')) $('gmd-t-start').value = t.startDate || t.created || today();
    if ($('gmd-t-note-title')) $('gmd-t-note-title').value = t.noteTitle || '';
    if ($('gmd-t-note-desc')) $('gmd-t-note-desc').value = t.noteDesc || '';
    $('gmd-t-btn').textContent = 'Update Task';
    editTaskId = tid;
    previewNextDate();
    $('gmd-t-title').focus();
  }

  function deleteTask(gid, tid) {
    if (!confirm('Delete this task?')) return;
    setTasks(gid, getTasks(gid).filter(x => x.id !== tid));
    if (activeNoteTaskId === tid) activeNoteTaskId = null;
    recalcProgress(gid);
    renderDetailTasks();
    renderGoals();
  }

  function saveTaskNote(gid, tid) {
    const titleEl = $(`gmd-tn-title-${tid}`);
    const descEl = $(`gmd-tn-desc-${tid}`);
    if (!titleEl || !descEl) return;
    
    const tasks = getTasks(gid);
    const idx = tasks.findIndex(x => x.id === tid);
    if (idx >= 0) {
      tasks[idx].noteTitle = titleEl.value.trim();
      tasks[idx].noteDesc = descEl.value.trim();
      setTasks(gid, tasks);
      toast('Task note saved');
    }
    activeNoteTaskId = null;
    renderDetailTasks();
    renderGoals();
  }

  /* ═══════════════════════════════════════════
     6. TRACKER & ANALYTICS
  ═══════════════════════════════════════════ */
  function renderTracker() {
    const tasks = getTasks(activeGoalId);
    const td = today();
    
    let totalDoneToday = 0;
    let pendingToday = 0;
    let totalHits = 0;
    let recurringCount = 0;
    
    tasks.forEach(t => {
      const isRecurring = t.freq && t.freq !== 'none';
      if (isRecurring) {
        recurringCount++;
        totalHits += Object.keys(t.history || {}).length;
        if (t.history && t.history[td] === 'done') totalDoneToday++;
        else pendingToday++;
      } else {
        if (t.status === 'done') totalDoneToday++;
        else pendingToday++;
      }
    });

    $('gmd-stat-tasks').textContent = tasks.length;
    $('gmd-stat-done').textContent = totalDoneToday;
    $('gmd-stat-hits').textContent = totalHits;
    $('gmd-stat-rec').textContent = recurringCount;

    // Calendar Heatmap (Last 14 days logic for simplicity)
    const calGrid = $('gmd-cal-grid');
    if (calGrid) {
      let html = '';
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        
        // Calculate hits for this day across all recurring tasks
        let dayHits = 0;
        tasks.forEach(t => {
          if (t.freq && t.freq !== 'none' && t.history && t.history[ds] === 'done') {
            dayHits++;
          }
        });
        
        let level = dayHits === 0 ? 0 : dayHits === 1 ? 1 : dayHits <= 3 ? 2 : dayHits <= 5 ? 3 : 4;
        html += `<div class="gm-cal-day" data-count="${level}" title="${fmt(ds)}: ${dayHits} completed"></div>`;
      }
      calGrid.innerHTML = html;
    }
  }

  function renderAnalytics() {
    // Analytics logic placeholder - visual representation in HTML
    renderTracker(); // Use tracker data to fill out charts if needed
  }

  /* ═══════════════════════════════════════════
     7. NOTES & LOGS
  ═══════════════════════════════════════════ */
  function renderNotes() {
    const notes = getNotes(activeGoalId);
    const tl = $('gmd-timeline');
    if (!tl) return;
    
    if (!notes.length) {
      tl.innerHTML = `<div style="text-align:center;padding:30px;color:var(--ts);">No notes or logs yet.</div>`;
      return;
    }
    
    tl.innerHTML = notes.slice().reverse().map(n => `
      <div class="gm-tl-item">
        <div class="gm-tl-date">${fmt(n.date)}</div>
        <div class="gm-tl-text">${esc(n.text)}</div>
      </div>
    `).join('');
  }

  function saveNote() {
    const text = $('gmd-note-inp').value.trim();
    if (!text) return;
    const notes = getNotes(activeGoalId);
    notes.push({ id: uid(), text, date: today() });
    setNotes(activeGoalId, notes);
    $('gmd-note-inp').value = '';
    renderNotes();
  }

  /* ═══════════════════════════════════════════
     8. GLOBAL BINDINGS
  ═══════════════════════════════════════════ */
  document.body.addEventListener('click', e => {
    const t = e.target.closest('[data-gact]');
    if (!t) return;
    
    const act = t.dataset.gact;
    const gid = t.dataset.gid;
    const tid = t.dataset.tid;
    
    if (act === 'open-detail') openGoalDetail(gid);
    if (act === 'edit-goal') { e.stopPropagation(); openGoalModal(gid); }
    if (act === 'delete-goal') { e.stopPropagation(); deleteGoal(gid); }
    if (act === 'add-inline-task') { e.stopPropagation(); openGoalDetail(gid); toggleAddTaskForm(); }
    if (act === 'toggle-task') { e.stopPropagation(); toggleTask(gid, tid); }
    if (act === 'edit-task') { e.stopPropagation(); editTask(gid, tid); }
    if (act === 'delete-task') { e.stopPropagation(); deleteTask(gid, tid); }
    if (act === 'toggle-task-note') { e.stopPropagation(); activeNoteTaskId = activeNoteTaskId === tid ? null : tid; renderDetailTasks(); }
    if (act === 'cancel-task-note') { e.stopPropagation(); activeNoteTaskId = null; renderDetailTasks(); }
    if (act === 'save-task-note') { e.stopPropagation(); saveTaskNote(gid, tid); }
  });

  // Expose API
  window.HFGoals = {
    render: renderGoals,
    openGoalModal,
    closeGoalModal,
    deleteGoal: () => { if(activeGoalId) deleteGoal(activeGoalId); },
    switchTab,
    toggleAddTaskForm,
    saveTask,
    saveNote,
    closeGoalDetail,
    previewNextDate,
    getTimelineItems
  };
  
  // Hook for script.js
  window.renderGoals = renderGoals;

})();
